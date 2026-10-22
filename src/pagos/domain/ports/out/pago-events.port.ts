/**
 * Nombre del evento interno emitido al registrar un pago.
 */
export const PAGO_REGISTRADO = 'pago.registrado';

export interface PagoRegistradoEvent {
  paymentId: number;
  tandaId: number;
  userId: number;
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
}
