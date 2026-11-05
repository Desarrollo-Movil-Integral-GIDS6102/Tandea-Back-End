/**
 * Token de Inyección de Dependencias para el repositorio de tokens FCM.
 */
export const FCM_TOKEN_REPOSITORY_PORT = Symbol('FCM_TOKEN_REPOSITORY_PORT');

/**
 * Puerto Secundario / Salida (Driven Port): FcmTokenRepositoryPort
 *
 * Gestiona la persistencia del token de Firebase Cloud Messaging asociado a cada usuario.
 */
export interface FcmTokenRepositoryPort {
  /**
   * Obtiene el token FCM actual del usuario, o null si no tiene uno registrado.
   */
  obtenerTokenPorUsuario(userId: number): Promise<string | null>;

  /**
   * Guarda o actualiza el token FCM del usuario.
   */
  guardarToken(userId: number, fcmToken: string): Promise<void>;

  /**
   * Borra (establece en null) el token FCM del usuario cuando deja de ser válido
   * (ej. cuando FCM responde messaging/registration-token-not-registered).
   */
  borrarToken(userId: number): Promise<void>;
}

