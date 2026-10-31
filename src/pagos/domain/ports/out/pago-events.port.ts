/**
 * Nombres de eventos internos emitidos por el módulo de Pagos.
 */
export const PAGO_REGISTRADO = 'pago.registrado';
export const PAGO_CONFIRMADO = 'pago.confirmado';
export const PAGO_RECHAZADO = 'pago.rechazado';

export interface PagoRegistradoEvent {
  paymentId: number;
  tandaId: number;
  userId: number;
}

export interface PagoConfirmadoEvent {
  paymentId: number;
  tandaId?: number;
  confirmedByAdmin: boolean;
}

export interface PagoRechazadoEvent {
  paymentId: number;
  tandaId?: number;
  motivo: string;
}

/**
 * Token de Inyección de Dependencias para el puerto de eventos de Pagos.
 */
export const PAGO_EVENTS_PORT = Symbol('PAGO_EVENTS_PORT');

/**
 * Puerto Secundario / Salida (Driven Port): PagoEventsPort
 *
 * Publica eventos de dominio de Pagos sin acoplar el caso de uso a un bus concreto.
 */
export interface PagoEventsPort {
  publicarPagoRegistrado(evento: PagoRegistradoEvent): Promise<void>;
  publicarPagoConfirmado(evento: PagoConfirmadoEvent): Promise<void>;
  publicarPagoRechazado(evento: PagoRechazadoEvent): Promise<void>;
}
