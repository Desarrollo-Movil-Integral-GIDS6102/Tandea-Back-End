import type { AccionResolucionDisputa } from '../in/admin-disputas-use-case.port';

/**
 * Nombres de eventos internos emitidos por el módulo de Administración Global.
 */
export const USUARIO_SUSPENDIDO_EVENT = 'usuario.suspendido';
export const DISPUTA_RESUELTA_EVENT = 'disputa.resuelta';

export interface UsuarioSuspendidoEvent {
  idUser: number;
  name: string;
  lastName: string;
  email: string;
  motivo?: string;
}

export interface DisputaResueltaEvent {
  idDispute: number;
  idTanda: number;
  nombreTanda: string;
  emailReporter: string;
  nombreReporter: string;
  accion: AccionResolucionDisputa;
  notas: string;
}

/**
 * Token de Inyección de Dependencias para el puerto de eventos de Admin.
 */
export const ADMIN_EVENTS_PORT = Symbol('ADMIN_EVENTS_PORT');

/**
 * Puerto Secundario / Salida (Driven Port): AdminEventsPort
 *
 * Publica eventos de dominio de Administración Global (`usuario.suspendido`, `disputa.resuelta`)
 * sin acoplar los casos de uso a un bus o canal de notificaciones concreto.
 */
export interface AdminEventsPort {
  publicarUsuarioSuspendido(evento: UsuarioSuspendidoEvent): Promise<void>;
  publicarDisputaResuelta(evento: DisputaResueltaEvent): Promise<void>;
}
