import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PagoRepository } from '../repositories/pago.repository';
import type { PagoModel } from '../models/pago.model';
import type { CreatePagoDto } from '../contracts/pago.contract';

/**
 * PagoService — Contiene TODA la lógica de negocio del módulo de Pagos.
 *
 * Responsabilidades:
 *  - Aplicar reglas de negocio antes de persistir (ej. verificar que la ronda esté activa).
 *  - Orquestar el flujo de doble confirmación.
 *  - Disparar eventos de dominio (ej. enviar notificación cuando pago está confirmado).
 *  - Coordinar con servicios externos (ej. servicio OCR).
 *
 * Lo que NO hace:
 *  - Acceder a la base de datos directamente.
 *  - Validar el formato del HTTP request (eso es responsabilidad del Controller).
 *  - Serializar la respuesta HTTP.
 */
@Injectable()
export class PagoService {
  constructor(private readonly pagoRepository: PagoRepository) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREAR PAGO
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra un nuevo pago aplicando las reglas de negocio:
   *  1. Verifica que la ronda del participante esté activa (pendiente de impl. con TandaService).
   *  2. Si hay comprobante adjunto, despacha el proceso de validación OCR de forma asíncrona.
   *  3. Persiste el pago con estado "pendiente".
   */
  async crearPago(dto: CreatePagoDto): Promise<PagoModel> {
    // TODO: Inyectar TandaService para verificar que la ronda está activa
    // await this.tandaService.verificarRondaActiva(dto.tandaId, dto.numeroPago);

    const pago = await this.pagoRepository.create(dto);

    // Si el pago tiene comprobante de transferencia, disparar validación OCR asíncrona
    if (pago.comprobanteUrl) {
      // TODO: Inyectar OcrService
      // this.ocrService.validarComprobante(pago.id, pago.comprobanteUrl).catch(err => {
      //   this.logger.error('Error al procesar OCR', err);
      // });
    }

    return pago;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OBTENER PAGO
  // ─────────────────────────────────────────────────────────────────────────

  async obtenerPago(id: string): Promise<PagoModel> {
    const pago = await this.pagoRepository.findById(id);

    if (!pago) {
      throw new NotFoundException(`Pago con id "${id}" no encontrado`);
    }

    return pago;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRMAR ORGANIZADOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Primera confirmación del flujo de doble confirmación.
   * El organizador verifica que recibió el pago (en efectivo o vio el comprobante).
   */
  async confirmarOrganizador(pagoId: string): Promise<PagoModel> {
    const pago = await this.obtenerPago(pagoId);

    if (pago.estado === 'confirmado') {
      throw new UnprocessableEntityException('Este pago ya está completamente confirmado');
    }

    if (pago.confirmadoOrganizadorEn) {
      throw new UnprocessableEntityException('El organizador ya confirmó este pago');
    }

    return this.pagoRepository.confirmarOrganizador(pagoId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRMAR RECEPTOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Segunda confirmación del flujo de doble confirmación.
   * El receptor (ganador de la tanda) confirma que recibió el dinero.
   * Cuando ambas confirmaciones existen, el estado pasa a "confirmado".
   */
  async confirmarReceptor(pagoId: string): Promise<PagoModel> {
    const pago = await this.obtenerPago(pagoId);

    if (pago.estado === 'confirmado') {
      throw new UnprocessableEntityException('Este pago ya está completamente confirmado');
    }

    if (!pago.confirmadoOrganizadorEn) {
      throw new UnprocessableEntityException(
        'El organizador debe confirmar primero antes de que el receptor pueda confirmar',
      );
    }

    const pagoActualizado = await this.pagoRepository.confirmarReceptor(pagoId);

    // TODO: Disparar evento de dominio PagoConfirmadoEvent
    // await this.eventBus.publish(new PagoConfirmadoEvent(pagoActualizado));

    return pagoActualizado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTUALIZAR RESULTADO OCR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Callback invocado por el OcrService cuando termina el procesamiento.
   * Persiste el resultado y marca si el monto del comprobante coincide.
   */
  async actualizarResultadoOcr(
    pagoId: string,
    montoDetectado: number,
  ): Promise<PagoModel> {
    const pago = await this.obtenerPago(pagoId);

    // Tolerancia de ±1 peso para diferencias de redondeo en el OCR
    const diferencia = Math.abs(montoDetectado - (pago.montoTransferencia ?? 0));
    const ocrAprobado = diferencia <= 1;

    return this.pagoRepository.updateOcr(pagoId, montoDetectado, ocrAprobado);
  }
}
