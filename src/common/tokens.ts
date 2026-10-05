/**
 * Tokens de inyección de dependencias compartidos en toda la aplicación.
 * Centralizar los tokens previene dependencias circulares entre módulos.
 */

export const DATABASE_TOKEN = Symbol('DATABASE_CONNECTION');
