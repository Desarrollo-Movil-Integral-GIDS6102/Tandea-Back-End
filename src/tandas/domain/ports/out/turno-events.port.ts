/**
 * Nombres de eventos internos de los turnos de una tanda.
 */
export const TURNO_EN_RIESGO = 'turno.en_riesgo';

export interface TurnoEnRiesgoEvent {
  idTanda: number;
  nombreTanda: string;
  idNumber: number;
  /** Número del turno que está en riesgo. */
  numero: number;
  idOrganizador: number;
  /** Dueño del número que debía cobrar. */
  idBeneficiario: number;
  pagosFaltantes: number;
  montoFaltante: number;
}

export const TURNO_EVENTS_PORT = Symbol('TURNO_EVENTS_PORT');

/**
 * Puerto de salida: publica eventos de los turnos sin acoplar el caso de uso a un bus concreto.
 */
export interface TurnoEventsPort {
  publicarTurnoEnRiesgo(evento: TurnoEnRiesgoEvent): Promise<void>;
}
