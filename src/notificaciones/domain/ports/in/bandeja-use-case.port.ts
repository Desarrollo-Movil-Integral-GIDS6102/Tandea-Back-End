import type { NotificacionBandeja } from '../out/notificacion-repository.port';

export const BANDEJA_USE_CASE_PORT = Symbol('BANDEJA_USE_CASE_PORT');

export interface Bandeja {
  noLeidas: number;
  notificaciones: NotificacionBandeja[];
}

/**
 * Puerto de entrada: bandeja de notificaciones del usuario autenticado.
 */
export interface BandejaUseCasePort {
  listar(idUser: number): Promise<Bandeja>;
  /** Lanza NotFoundException si la notificación no existe o es de otro usuario. */
  marcarLeida(idNotification: number, idUser: number): Promise<void>;
}
