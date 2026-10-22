import { Injectable, Inject } from '@nestjs/common';
import { Pago, PagoFactory } from '../../domain/entities/Pago';
import { PagoNotFoundError } from '../../domain/errors/pago.errors';
import {
  PAGO_REPOSITORY_PORT,
  type PagoRepositoryPort,
} from '../../domain/ports/out/pago-repository.port';
import {
  type PagoUseCasesPort,
  type CrearPagoCommand,
} from '../../domain/ports/in/pago-use-cases.port';

/**
 * PagoService — Servicio de Aplicación (Orquestador de Casos de Uso).
 *
 * En Arquitectura Hexagonal:
 *  - Implementa el puerto primario `PagoUseCasesPort`.
 *  - Depende EXCLUSIVAMENTE del puerto secundario `PagoRepositoryPort` (Inversión de Dependencias).
 *  - No conoce Drizzle, PostgreSQL ni detalles de persistencia.
 *  - No maneja excepciones HTTP — lanza o propaga DomainErrors puros.
 *  - Delega las mutaciones y validaciones de estado a la entidad rica de dominio `Pago` y su `PagoFactory`.
 */
@Injectable()
export class PagoService implements PagoUseCasesPort {
  constructor(
    @Inject(PAGO_REPOSITORY_PORT)
    private readonly pagoRepository: PagoRepositoryPort,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: CREAR PAGO
  // ─────────────────────────────────────────────────────────────────────────

  async crearPago(command: CrearPagoCommand): Promise<Pago> {
    // TODO(AP-03): Validar que command.monto sea igual a la cuota real de la tanda (contributionAmount)
    // una vez que se defina el puerto/contrato secundario de comunicación entre el módulo de Pagos y Tandas.
    // 1. Instanciar la entidad de dominio garantizando el estado inicial y validaciones de negocio
    const pago = Pago.create({
      tandaId: command.tandaId,
      participanteId: command.participanteId,
      numeroPago: command.numeroPago,
      totalAmount: command.monto,
      cashAmount: command.montoEfectivo,
      transferAmount: command.montoTransferencia,
      metodoPago: command.metodoPago,
      evidenceUrl: command.comprobanteUrl ?? null,
      fechaPago: command.fechaPago,
      confirmedByParticipant: true,
    });


    // 2. Persistir a través del puerto de salida
    const pagoGuardado = await this.pagoRepository.create(pago);

    // 3. Orquestación con servicios externos asíncronos (ej. OCR)
    if (pagoGuardado.comprobanteUrl) {
      // TODO: Disparar caso de uso o evento a través de un puerto de salida IOcrServicePort
    }

    return pagoGuardado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: OBTENER PAGO
  // ─────────────────────────────────────────────────────────────────────────

  async obtenerPago(id: string): Promise<Pago> {
    const pago = await this.pagoRepository.findById(id);

    if (!pago) {
      throw new PagoNotFoundError(id);
    }

    return pago;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: CONFIRMAR ORGANIZADOR (1ra confirmación)
  // ─────────────────────────────────────────────────────────────────────────

  async confirmarOrganizador(id: string): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Ejecuta las reglas de negocio en la entidad de dominio
    pago.confirmarPorOrganizador();

    // Persiste el estado actualizado
    return this.pagoRepository.update(pago);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: CONFIRMAR RECEPTOR (2da confirmación)
  // ─────────────────────────────────────────────────────────────────────────

  async confirmarReceptor(id: string): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Ejecuta las reglas de negocio en la entidad de dominio
    pago.confirmarPorReceptor();

    // Persiste el estado actualizado
    const pagoActualizado = await this.pagoRepository.update(pago);

    // TODO: Disparar evento de dominio a través de un puerto de eventos
    // await this.eventBus.publish(new PagoConfirmadoEvent(pagoActualizado));

    return pagoActualizado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASO DE USO: ACTUALIZAR RESULTADO OCR
  // ─────────────────────────────────────────────────────────────────────────

  async actualizarResultadoOcr(
    id: string,
    montoDetectado: number,
  ): Promise<Pago> {
    const pago = await this.obtenerPago(id);

    // Aplica la lógica de tolerancia en la entidad
    pago.registrarResultadoOcr(montoDetectado);

    return this.pagoRepository.update(pago);
  }
}
