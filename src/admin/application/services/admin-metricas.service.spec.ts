import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ROLES_KEY } from '../../../auth/infrastructure/adapters/in/http/decorators/roles.decorator';
import { AdminController } from '../../infrastructure/adapters/in/http/admin.controller';
import type { AdminMetricasRepositoryPort } from '../../domain/ports/out/admin-metricas-repository.port';
import { AdminMetricasService } from './admin-metricas.service';

function repositorioFalso(): AdminMetricasRepositoryPort {
  return {
    contarUsuarios: vi.fn().mockResolvedValue({ total: 10, activos: 8, suspendidos: 2 }),
    contarTandas: vi.fn().mockResolvedValue({
      total: 5,
      pendientes: 1,
      activas: 2,
      finalizadas: 1,
      suspendidas: 0,
      canceladas: 1,
    }),
    sumarMontoGestionado: vi.fn().mockResolvedValue(12500),
    contarDisputasPendientes: vi.fn().mockResolvedValue(3),
    sumarMontoPorMes: vi.fn().mockResolvedValue([{ mes: '2026-11', monto: 12500, pagos: 25 }]),
  };
}

describe('AdminMetricasService (AP-11)', () => {
  it('junta los totales de la plataforma y la serie mensual de 12 meses', async () => {
    const repo = repositorioFalso();
    const servicio = new AdminMetricasService(repo);

    const metricas = await servicio.obtenerMetricas(new Date('2026-11-15T18:00:00.000Z'));

    expect(metricas.usuarios).toEqual({ total: 10, activos: 8, suspendidos: 2 });
    expect(metricas.tandas.activas).toBe(2);
    expect(metricas.montoGestionado).toBe(12500);
    expect(metricas.disputasPendientes).toBe(3);
    expect(metricas.montoPorMes).toHaveLength(12);
    expect(metricas.montoPorMes[11]).toEqual({ mes: '2026-11', monto: 12500, pagos: 25 });
    expect(metricas.montoPorMes[0]).toEqual({ mes: '2025-12', monto: 0, pagos: 0 });
  });

  it('pide al repositorio la serie desde el primer día del mes más antiguo', async () => {
    const repo = repositorioFalso();

    await new AdminMetricasService(repo).obtenerMetricas(new Date('2026-11-15T18:00:00.000Z'));

    expect(repo.sumarMontoPorMes).toHaveBeenCalledWith('2025-12-01');
  });

  it('no devuelve datos individuales: solo totales y la serie', async () => {
    const metricas = await new AdminMetricasService(repositorioFalso()).obtenerMetricas();

    expect(Object.keys(metricas).sort()).toEqual([
      'disputasPendientes',
      'montoGestionado',
      'montoPorMes',
      'tandas',
      'usuarios',
    ]);
  });
});

describe('AdminController', () => {
  it('exige el rol admin_global en todo el controlador', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(['admin_global']);
  });
});
