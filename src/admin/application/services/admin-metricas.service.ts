import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_METRICAS_REPOSITORY_PORT,
  type AdminMetricasRepositoryPort,
} from '../../domain/ports/out/admin-metricas-repository.port';
import type {
  AdminMetricasUseCasePort,
  MetricasGlobales,
} from '../../domain/ports/in/admin-metricas-use-case.port';
import { completarMeses, inicioDeLaGrafica, mesActual } from '../../domain/services/serie-mensual';

/**
 * Métricas globales del panel del Administrador (AP-11).
 * Solo agrega totales: no expone usuarios, pagos ni tandas individuales.
 */
@Injectable()
export class AdminMetricasService implements AdminMetricasUseCasePort {
  constructor(
    @Inject(ADMIN_METRICAS_REPOSITORY_PORT)
    private readonly repositorio: AdminMetricasRepositoryPort,
  ) {}

  async obtenerMetricas(ahora: Date = new Date()): Promise<MetricasGlobales> {
    const mesFinal = mesActual(ahora);

    const [usuarios, tandas, montoGestionado, disputasPendientes, mensual] = await Promise.all([
      this.repositorio.contarUsuarios(),
      this.repositorio.contarTandas(),
      this.repositorio.sumarMontoGestionado(),
      this.repositorio.contarDisputasPendientes(),
      this.repositorio.sumarMontoPorMes(inicioDeLaGrafica(mesFinal)),
    ]);

    return {
      usuarios,
      tandas,
      montoGestionado,
      disputasPendientes,
      montoPorMes: completarMeses(mensual, mesFinal),
    };
  }
}
