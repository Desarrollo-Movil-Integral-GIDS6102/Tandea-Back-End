/**
 * Nombres de eventos internos emitidos por el módulo de Entregas.
 */
export const ENTREGA_REGISTRADA = 'entrega.registrada';

export interface EntregaRegistradaEvent {
  idPayout: number;
  idTanda: number;
  nombreTanda: string;
  /** Dueño del número que debe confirmar que recibió el dinero. */
  idReceptor: number;
  numero: number;
  totalAmount: number;
}

export const ENTREGA_EVENTS_PORT = Symbol('ENTREGA_EVENTS_PORT');

/**
 * Puerto de salida: publica eventos de Entregas sin acoplar el caso de uso a un bus concreto.
 */
export interface EntregaEventsPort {
  publicarEntregaRegistrada(evento: EntregaRegistradaEvent): Promise<void>;
}
