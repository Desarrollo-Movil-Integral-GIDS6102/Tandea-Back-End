export const FCM_TOKEN_USE_CASE_PORT = Symbol('FCM_TOKEN_USE_CASE_PORT');

export interface FcmTokenUseCasePort {
  /**
   * Registra o actualiza el token FCM del usuario autenticado.
   */
  actualizarToken(userId: number, fcmToken: string): Promise<void>;
}

