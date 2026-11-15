import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { DrizzleAdminMetricasRepository } from '../src/admin/infrastructure/adapters/out/database/drizzle-admin-metricas.repository';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [SP-4 BE-ADMIN] Las consultas agregadas de GET /admin/metricas contra PostgreSQL local.
 * Son solo de lectura: se comparan con SQL crudo para confirmar que los totales cuadran.
 */
describe.skipIf(!testDbUrl)('[SP-4 BE-ADMIN] DrizzleAdminMetricasRepository (BD local)', () => {
  let pool: Pool;
  let repo: DrizzleAdminMetricasRepository;

  beforeAll(() => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    repo = new DrizzleAdminMetricasRepository(drizzle(pool) as NodePgDatabase);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('usuarios: activos + suspendidos = total y coincide con SQL crudo', async () => {
    const usuarios = await repo.contarUsuarios();
    const { rows } = await pool.query<{ total: string; activos: string }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE u.active) AS activos
         FROM "user" u JOIN role r ON r.id_role = u.id_role
        WHERE r.name_role = 'usuario' AND u.deleted_at IS NULL`,
    );

    expect(usuarios.total).toBe(Number(rows[0].total));
    expect(usuarios.activos).toBe(Number(rows[0].activos));
    expect(usuarios.activos + usuarios.suspendidos).toBe(usuarios.total);
  });

  it('tandas: el total es la suma de todos los estados', async () => {
    const t = await repo.contarTandas();
    const { rows } = await pool.query<{ total: string }>(
      `SELECT count(*) AS total FROM tanda WHERE deleted_at IS NULL`,
    );

    expect(t.pendientes + t.activas + t.finalizadas + t.suspendidas + t.canceladas).toBe(t.total);
    expect(t.total).toBe(Number(rows[0].total));
  });

  it('monto gestionado: coincide con la suma de pagos CONFIRMADO', async () => {
    const monto = await repo.sumarMontoGestionado();
    const { rows } = await pool.query<{ monto: string }>(
      `SELECT coalesce(sum(total_amount), 0) AS monto FROM payment WHERE status = 'CONFIRMADO'`,
    );

    expect(monto).toBe(Number(rows[0].monto));
  });

  it('disputas pendientes: cuenta ABIERTA y EN_REVISION', async () => {
    const pendientes = await repo.contarDisputasPendientes();
    const { rows } = await pool.query<{ total: string }>(
      `SELECT count(*) AS total FROM dispute WHERE status IN ('ABIERTA', 'EN_REVISION')`,
    );

    expect(pendientes).toBe(Number(rows[0].total));
  });

  it('monto por mes: meses con formato YYYY-MM, ordenados y sin pasar del monto total', async () => {
    const serie = await repo.sumarMontoPorMes('2000-01-01');
    const total = await repo.sumarMontoGestionado();

    for (const fila of serie) expect(fila.mes).toMatch(/^\d{4}-\d{2}$/);
    expect(serie.map((s) => s.mes)).toEqual([...serie.map((s) => s.mes)].sort());
    expect(serie.reduce((suma, s) => suma + s.monto, 0)).toBeCloseTo(total, 2);
  });
});
