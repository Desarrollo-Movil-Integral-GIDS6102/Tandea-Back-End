import type { TandaParaRecordatorio } from '../../services/recordatorios-pago';

/**
 * Tipos de notificación que se guardan en `notification.type`.
 */
export const TIPO_NOTIFICACION = {
  PAGO_REGISTRADO: 'pago_registrado',
  PAGO_CONFIRMADO: 'pago_confirmado',
  PAGO_RECHAZADO: 'pago_rechazado',
  RECORDATORIO_PAGO: 'recordatorio_pago',
} as const;

export type TipoNotificacion =
  (typeof TIPO_NOTIFICACION)[keyof typeof TIPO_NOTIFICACION];

/**
 * Datos de un pago necesarios para decidir a quién avisar y con qué texto.
 */
export interface ContextoPago {
  paymentId: number;
  idTanda: number;
  nombreTanda: string;
  idOrganizador: number;
  /** Dueño del número que pagó (null solo en un número muerto). */
  idParticipante: number | null;
  nombreParticipante: string | null;
  numero: number;
}

export interface NuevaNotificacion {
  idUser: number;
  idTanda: number | null;
  type: TipoNotificacion;
  message: string;
}

export const NOTIFICACION_REPOSITORY_PORT = Symbol('NOTIFICACION_REPOSITORY_PORT');

/**
 * Puerto de salida: persistencia de la bandeja de notificaciones.
 */
export interface NotificacionRepositoryPort {
  buscarContextoPago(paymentId: number): Promise<ContextoPago | null>;
  guardar(notificacion: NuevaNotificacion): Promise<number>;
  /** Tandas ACTIVAS con los números de sus participantes y si ya tienen pago en curso. */
  listarTandasParaRecordatorio(): Promise<TandaParaRecordatorio[]>;
  /** Para no repetir el mismo aviso: ¿ya se guardó uno de este tipo desde `desde`? */
  existeNotificacionDesde(
    idUser: number,
    idTanda: number,
    type: TipoNotificacion,
    desde: Date,
  ): Promise<boolean>;
}
