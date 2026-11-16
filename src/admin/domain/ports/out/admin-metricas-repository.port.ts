export const ADMIN_METRICAS_REPOSITORY_PORT = Symbol('ADMIN_METRICAS_REPOSITORY_PORT');

/** Conteos globales; nunca incluyen datos de una persona en particular. */
export interface ConteoUsuarios {
  total: number;
  activos: number;
  suspendidos: number;
}

export interface ConteoTandas {
  total: number;
  pendientes: number;
  activas: number;
  finalizadas: number;
  suspendidas: number;
  canceladas: number;
}

/** Monto confirmado en un mes (`mes` = YYYY-MM en hora de la Ciudad de México). */
export interface MontoMensual {
  mes: string;
  monto: number;
  pagos: number;
}

/**
 * Puerto de salida: consultas agregadas (count / sum / group by) para el panel
 * global del Administrador. Ninguna devuelve filas individuales.
 */
export interface AdminMetricasRepositoryPort {
  contarUsuarios(): Promise<ConteoUsuarios>;
  contarTandas(): Promise<ConteoTandas>;
  /** Suma de los pagos CONFIRMADO de toda la plataforma. */
  sumarMontoGestionado(): Promise<number>;
  /** Disputas que aún requieren atención (ABIERTA y EN_REVISION). */
  contarDisputasPendientes(): Promise<number>;
  /** Pagos confirmados agrupados por mes desde `desde` (YYYY-MM-DD); solo meses con movimiento. */
  sumarMontoPorMes(desde: string): Promise<MontoMensual[]>;
}
