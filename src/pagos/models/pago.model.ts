/**
 * Modelo de dominio puro para Pago.
 * No tiene dependencias de infraestructura (ORM, HTTP, etc.).
 * Es el "lenguaje" interno del sistema de negocio.
 */

export type MetodoPago = 'efectivo' | 'transferencia' | 'hibrido';
export type EstadoPago = 'pendiente' | 'confirmado_parcial' | 'confirmado' | 'rechazado';

export interface PagoModel {
  /** UUID generado en la base de datos */
  id: string;

  /** ID de la tanda a la que pertenece el pago */
  tandaId: string;

  /** ID del participante que realiza el pago */
  participanteId: string;

  /** Número de ronda dentro de la tanda */
  numeroPago: number;

  /**
   * Monto total del pago.
   * En pagos híbridos: montoEfectivo + montoTransferencia
   */
  monto: number;

  /** Monto cubierto en efectivo (puede ser 0) */
  montoEfectivo: number;

  /** Monto cubierto por transferencia (puede ser 0) */
  montoTransferencia: number;

  /** Método de pago determinado por la lógica de negocio */
  metodoPago: MetodoPago;

  /** Estado actual dentro del flujo de doble confirmación */
  estado: EstadoPago;

  /**
   * URL del comprobante de transferencia (opcional).
   * Requerido cuando montoTransferencia > 0.
   */
  comprobanteUrl: string | null;

  /**
   * Monto validado por el OCR del comprobante.
   * null si no se ha procesado o no aplica.
   */
  montoOcrValidado: number | null;

  /**
   * Indica si el OCR confirmó que el monto del comprobante
   * coincide con montoTransferencia.
   */
  ocrAprobado: boolean | null;

  /** Timestamp de confirmación del organizador */
  confirmadoOrganizadorEn: Date | null;

  /** Timestamp de confirmación del receptor */
  confirmadoReceptorEn: Date | null;

  /** Fecha en que se realizó el pago (declarada por el participante) */
  fechaPago: Date;

  createdAt: Date;
  updatedAt: Date;
}
