import type { ConteoTandas, ConteoUsuarios, MontoMensual } from '../out/admin-metricas-repository.port';

export const ADMIN_METRICAS_USE_CASE_PORT = Symbol('ADMIN_METRICAS_USE_CASE_PORT');

/** Respuesta de GET /admin/metricas (AP-11): solo totales, sin datos individuales. */
export interface MetricasGlobales {
  usuarios: ConteoUsuarios;
  tandas: ConteoTandas;
  /** Suma en MXN de los pagos confirmados. */
  montoGestionado: number;
  disputasPendientes: number;
  /** Últimos 12 meses (incluido el actual), con 0 en los meses sin movimiento. */
  montoPorMes: MontoMensual[];
}

export interface AdminMetricasUseCasePort {
  obtenerMetricas(ahora?: Date): Promise<MetricasGlobales>;
}
