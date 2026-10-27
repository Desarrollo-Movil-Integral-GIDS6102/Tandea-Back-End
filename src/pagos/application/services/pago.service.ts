import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pago, PagoFactory } from '../../domain/entities/Pago';
import {
  ComprobanteRequeridoError,
  NumeroAjenoError,
  NumeroNoEncontradoError,
  PagoDuplicadoError,
  PagoNotFoundError,
  TandaNoEncontradaError,
} from '../../domain/errors/pago.errors';
import {
  PAGO_REPOSITORY_PORT,
  type PagoRepositoryPort,
} from '../../domain/ports/out/pago-repository.port';
import {
  STORAGE_PORT,
  type StoragePort,
} from '../../domain/ports/out/storage.port';
import {
  OCR_SERVICE_PORT,
  type OcrServicePort,
} from '../../domain/ports/out/ocr-service.port';
import {
  PAGO_EVENTS_PORT,
  type PagoEventsPort,
} from '../../domain/ports/out/pago-events.port';
import {
  type PagoUseCasesPort,
  type RegistrarPagoCommand,
} from '../../domain/ports/in/pago-use-cases.port';

/**
 * PagoService — Servicio de Aplicación (Orquestador de Casos de Uso).
 *
 * En Arquitectura Hexagonal:
 *  - Implementa el puerto primario `PagoUseCasesPort`.
 *  - Depende EXCLUSIVAMENTE de puertos secundarios (repositorio, storage, OCR y eventos).
 *  - No conoce Drizzle, PostgreSQL ni detalles de persistencia.
 *  - No maneja excepciones HTTP — lanza o propaga DomainErrors puros.
 *  - Delega las mutaciones y validaciones de estado a la entidad rica de dominio `Pago` y su `PagoFactory`.
 */
@Injectable()
export class PagoService implements PagoUseCasesPort {
  private readonly logger = new Logger(PagoService.name);

  constructor(
    @Inject(PAGO_REPOSITORY_PORT)
    private readonly pagoRepository: PagoRepositoryPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    @Inject(OCR_SERVICE_PORT)
    private readonly ocr: OcrServicePort,
    @Inject(PAGO_EVENTS_PORT)
    private readonly eventos: PagoEventsPort,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: REGISTRAR PAGO (AP-03)
  // ─────────────────────────────────────────────────────────────────────────

  async registrar(command: RegistrarPagoCommand): Promise<Pago> {
    const { idUser, idNumber, comprobante } = command;

    // 1. El número debe existir, tener tanda y pertenecer al usuario del JWT
    const numero = await this.pagoRepository.buscarNumeroConCuota(idNumber);
    if (!numero) {
      throw new NumeroNoEncontradoError(idNumber);
    }
    if (!numero.tanda) {
      throw new TandaNoEncontradaError(idNumber);
    }
    if (numero.idUser !== idUser) {
      throw new NumeroAjenoError();
    }

    // 2. Un solo pago pendiente/confirmado por número (cada número es de una vuelta)
    if (await this.pagoRepository.existePagoActivo(idNumber)) {
      throw new PagoDuplicadoError(idNumber);
    }

    // 3. Validar montos contra la cuota (en centavos) ANTES de subir archivos
    const datosPago = {
      idNumber,
      metodoPago: command.metodoPago,
      totalAmount: numero.tanda.contributionAmount,
      transferAmount: command.transferAmount,
      cashAmount: command.cashAmount,
      confirmedByParticipant: true,
      confirmedByAdmin: false,
    };
    const montos = PagoFactory.validarMontos(datosPago);
    if (montos.metodoPago !== 'efectivo' && !comprobante) {
      throw new ComprobanteRequeridoError(montos.metodoPago);
    }

    // 4. Subir el comprobante (opcional en efectivo)
    const evidenceUrl = comprobante
      ? await this.storage.subir(comprobante.buffer, {
          carpeta: 'comprobantes',
          nombreArchivo: `pago_numero_${idNumber}_${Date.now()}`,
          mimetype: comprobante.mimetype,
        })
      : null;

    const pago = PagoFactory.crear({ ...datosPago, evidenceUrl });

    // 5. OCR sobre la parte transferida; si falla, el pago sigue sin verificar
    if (comprobante && montos.transferAmount > 0) {
      await this.aplicarOcr(pago, comprobante.buffer, montos.transferAmount);
    }

    // 6. Persistir payment + evidence en una sola transacción
    const pagoGuardado = await this.pagoRepository.create(pago);

    // 7. Avisar al resto del sistema
    await this.publicarPagoRegistrado(
      pagoGuardado.idPayment!,
      numero.tanda.idTanda,
      idUser,
    );

    return pagoGuardado;
  }

  private async aplicarOcr(
    pago: Pago,
    imagen: Buffer,
    montoEsperado: number,
  ): Promise<void> {
    try {
      const { montoDetectado } = await this.ocr.verificarMonto(imagen, montoEsperado);
      if (montoDetectado !== null) {
        pago.registrarResultadoOcr(montoDetectado);
      }
    } catch (error: unknown) {
      // El OCR nunca rechaza el pago: queda ocr_verified = false para revisión manual
      this.logger.warn(
        `OCR no disponible para el número ${pago.idNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async publicarPagoRegistrado(
    paymentId: number,
    tandaId: number,
    userId: number,
  ): Promise<void> {
    try {
      await this.eventos.publicarPagoRegistrado({ paymentId, tandaId, userId });
    } catch (error: unknown) {
      // El pago ya quedó guardado; un fallo del bus no debe convertirse en error para el cliente
      this.logger.error(
        `No se pudo publicar pago.registrado del pago ${paymentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: OBTENER PAGO
  // ─────────────────────────────────────────────────────────────────────────

  async obtenerPago(id: number): Promise<Pago> {
    const pago = await this.pagoRepository.findById(id);

    if (!pago) {
      throw new PagoNotFoundError(id);
    }

    return pago;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: CONFIRMAR PAGO POR EL ORGANIZADOR (AP-05)
  // ─────────────────────────────────────────────────────────────────────────

  async confirmar(id: number): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Ejecuta las reglas de negocio en la entidad de dominio
    pago.confirmarPorOrganizador();

    // Persiste el estado actualizado
    const pagoActualizado = await this.pagoRepository.update(pago);

    // Emite el evento de dominio pago.confirmado
    const numero = await this.pagoRepository.buscarNumeroConCuota(pago.idNumber);
    const tandaId = numero?.tanda?.idTanda ?? 0;
    const userId = numero?.idUser;
    await this.publicarPagoConfirmado(pagoActualizado.idPayment!, tandaId, userId);

    return pagoActualizado;
  }

  /**
   * Alias de compatibilidad hacia confirmar(id).
   */
  async confirmarOrganizador(id: number): Promise<Pago> {
    return this.confirmar(id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: RECHAZAR PAGO POR EL ORGANIZADOR (AP-05)
  // ─────────────────────────────────────────────────────────────────────────

  async rechazar(id: number, motivo: string): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Ejecuta las reglas de negocio en la entidad de dominio
    pago.rechazar(motivo);

    // Persiste el estado actualizado
    const pagoActualizado = await this.pagoRepository.update(pago);

    // Emite el evento de dominio pago.rechazado
    const numero = await this.pagoRepository.buscarNumeroConCuota(pago.idNumber);
    const tandaId = numero?.tanda?.idTanda ?? 0;
    const userId = numero?.idUser;
    await this.publicarPagoRechazado(pagoActualizado.idPayment!, tandaId, motivo, userId);

    return pagoActualizado;
  }

  private async publicarPagoConfirmado(
    paymentId: number,
    tandaId: number,
    userId?: number | null,
  ): Promise<void> {
    try {
      await this.eventos.publicarPagoConfirmado({ paymentId, tandaId, userId });
    } catch (error: unknown) {
      this.logger.error(
        `No se pudo publicar pago.confirmado del pago ${paymentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async publicarPagoRechazado(
    paymentId: number,
    tandaId: number,
    motivo: string,
    userId?: number | null,
  ): Promise<void> {
    try {
      await this.eventos.publicarPagoRechazado({ paymentId, tandaId, motivo, userId });
    } catch (error: unknown) {
      this.logger.error(
        `No se pudo publicar pago.rechazado del pago ${paymentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: CONFIRMAR RECEPTOR (2da confirmación)
  // ─────────────────────────────────────────────────────────────────────────

  async confirmarReceptor(id: number): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Ejecuta las reglas de negocio en la entidad de dominio
    pago.confirmarPorReceptor();

    // Persiste el estado actualizado
    const pagoActualizado = await this.pagoRepository.update(pago);

    return pagoActualizado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: ACTUALIZAR RESULTADO OCR
  // ─────────────────────────────────────────────────────────────────────────

  async actualizarResultadoOcr(
    id: number,
    montoDetectado: number,
  ): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Aplica la lógica de tolerancia en la entidad
    pago.registrarResultadoOcr(montoDetectado);

    return this.pagoRepository.update(pago);
  }
}
