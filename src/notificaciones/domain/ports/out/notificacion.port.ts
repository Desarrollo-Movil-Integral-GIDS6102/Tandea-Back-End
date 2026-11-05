export const NOTIFICACION_PORT = Symbol('NOTIFICACION_PORT');

/**
 * Puerto de salida: envío de notificaciones push al dispositivo del usuario.
 *
 * El adaptador real (NotificacionFcmAdapter, tarjeta INT-NOTIF) resuelve el
 * fcm_token del usuario y lo borra si FCM responde `not-registered`.
 * `data.route` es la ruta de la app a la que navega al tocar la notificación.
 */
export interface NotificacionPort {
  enviar(
    userId: number,
    titulo: string,
    cuerpo: string,
    data?: Record<string, string>,
  ): Promise<void>;
}
