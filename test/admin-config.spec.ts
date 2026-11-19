import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { DrizzleAdminConfigRepository } from '../src/admin/infrastructure/adapters/out/database/drizzle-admin-config.repository';
import { AdminConfigService } from '../src/admin/application/services/admin-config.service';
import { DrizzleTandaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-tanda.repository';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import type { ConfiguracionPlataforma } from '../src/admin/domain/ports/in/admin-config-use-case.port';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [SP-4 BE-ADMIN] Prueba de integración contra PostgreSQL local:
 *  - GET y PUT /admin/config leen y actualizan platform_config guardando id_updated_by.
 *  - TandaService.crearTanda lee los límites actualizados y rechaza cuando se exceden.
 */
describe.skipIf(!testDbUrl)('[SP-4 BE-ADMIN] Configurar parámetros globales (BD local)', () => {
  let pool: Pool;
  let configService: AdminConfigService;
  let tandaService: TandaService;
  let idAdminGlobal: number;
  let configOriginal: ConfiguracionPlataforma;

  beforeAll(async () => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    const db = drizzle(pool) as NodePgDatabase;

    configService = new AdminConfigService(new DrizzleAdminConfigRepository(db));
    const tandaRepo = new DrizzleTandaRepository(db);
    tandaService = new TandaService(tandaRepo, tandaRepo);

    const { rows: admins } = await pool.query<{ id_user: number }>(
      `SELECT u.id_user FROM "user" u JOIN role r ON r.id_role = u.id_role
        WHERE r.name_role = 'admin_global' AND u.deleted_at IS NULL
        ORDER BY u.id_user LIMIT 1`,
    );
    idAdminGlobal = admins[0].id_user;
    configOriginal = await configService.obtenerConfiguracion();
  });

  afterAll(async () => {
    if (pool && configOriginal && idAdminGlobal) {
      await pool.query(
        `UPDATE platform_config
            SET max_users_per_tanda = $1,
                max_active_tandas_per_user = $2,
                max_grace_days = $3,
                id_updated_by = $4,
                updated_at = now()
          WHERE id_config = $5`,
        [
          configOriginal.maxUsersPerTanda,
          configOriginal.maxActiveTandasPerUser,
          configOriginal.maxGraceDays,
          configOriginal.idUpdatedBy ?? idAdminGlobal,
          configOriginal.idConfig,
        ],
      );
      await pool.query(
        `DELETE FROM audit_log WHERE entity_type = 'platform_config' AND entity_id = $1`,
        [configOriginal.idConfig],
      );
    }
    await pool?.end();
  });

  it('guarda id_updated_by al actualizar platform_config y CreateTanda rechaza si se exceden los límites', async () => {
    const nueva = await configService.actualizarConfiguracion({
      maxUsersPerTanda: 6,
      maxActiveTandasPerUser: 4,
      maxGraceDays: 2,
      idUpdatedBy: idAdminGlobal,
    });

    expect(nueva.maxUsersPerTanda).toBe(6);
    expect(nueva.maxActiveTandasPerUser).toBe(4);
    expect(nueva.maxGraceDays).toBe(2);
    expect(nueva.idUpdatedBy).toBe(idAdminGlobal);

    // Verificar en BD que id_updated_by quedó persistido
    const { rows } = await pool.query<{
      max_users_per_tanda: number;
      max_active_tandas_per_user: number;
      max_grace_days: number;
      id_updated_by: number;
    }>(`SELECT max_users_per_tanda, max_active_tandas_per_user, max_grace_days, id_updated_by FROM platform_config WHERE id_config = $1`, [
      nueva.idConfig,
    ]);
    expect(rows[0].id_updated_by).toBe(idAdminGlobal);
    expect(rows[0].max_users_per_tanda).toBe(6);

    // Crear una tanda con 7 participantes (> 6) se rechaza
    await expect(
      tandaService.crearTanda({
        name: 'Tanda Excede Config',
        startDate: '2026-12-01',
        contributionAmount: 500,
        numParticipants: 7,
        graceDays: 1,
        idAdmin: idAdminGlobal,
      }),
    ).rejects.toThrow(BadRequestException);

    // Crear una tanda con 3 días de gracia (> 2) se rechaza
    await expect(
      tandaService.crearTanda({
        name: 'Tanda Excede Gracia',
        startDate: '2026-12-01',
        contributionAmount: 500,
        numParticipants: 4,
        graceDays: 3,
        idAdmin: idAdminGlobal,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
