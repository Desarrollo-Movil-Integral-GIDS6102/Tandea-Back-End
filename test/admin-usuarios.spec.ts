import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { DrizzleAdminUsuariosRepository } from '../src/admin/infrastructure/adapters/out/database/drizzle-admin-usuarios.repository';
import {
  ACCION_USUARIO_SUSPENDIDO,
  AdminUsuariosService,
} from '../src/admin/application/services/admin-usuarios.service';
import { DrizzleAuthUserRepository } from '../src/auth/infrastructure/adapters/out/database/drizzle-auth-user.repository';
import { AuthService } from '../src/auth/application/services/auth.service';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [SP-4 BE-ADMIN] Prueba de integración contra PostgreSQL local:
 *  1. El admin global busca al usuario por nombre o correo.
 *  2. Lo suspende (active = false, fcm_token = null).
 *  3. Queda registrado en audit_log (entity_type = 'user', action_type = 'USUARIO_SUSPENDIDO').
 *  4. El usuario suspendido ya no puede iniciar sesión (403 ForbiddenException).
 */
describe.skipIf(!testDbUrl)('[SP-4 BE-ADMIN] Buscar y suspender usuarios (BD local)', () => {
  let pool: Pool;
  let adminUsuariosService: AdminUsuariosService;
  let authService: AuthService;
  let idAdminGlobal: number;
  let idUsuarioPrueba: number;
  const emailPrueba = `suspendido.sp4.${Date.now()}@tandea.test`;
  const passwordPrueba = 'Tandea-Suspend-2026!';

  beforeAll(async () => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    const db = drizzle(pool) as NodePgDatabase;

    const adminRepo = new DrizzleAdminUsuariosRepository(db);
    adminUsuariosService = new AdminUsuariosService(adminRepo);

    const authRepo = new DrizzleAuthUserRepository(db);
    authService = new AuthService(
      authRepo,
      { sendMail: async () => true },
      { sign: () => 'jwt.test' } as any,
    );

    const { rows: roles } = await pool.query<{ id_role: number; name_role: string }>(
      `SELECT id_role, name_role FROM role WHERE name_role IN ('usuario', 'admin_global')`,
    );
    const idRolUsuario = roles.find((r) => r.name_role === 'usuario')!.id_role;
    const idRolAdmin = roles.find((r) => r.name_role === 'admin_global')!.id_role;

    const { rows: admins } = await pool.query<{ id_user: number }>(
      `SELECT id_user FROM "user" WHERE id_role = $1 AND deleted_at IS NULL LIMIT 1`,
      [idRolAdmin],
    );
    idAdminGlobal = admins[0].id_user;

    const hash = await bcrypt.hash(passwordPrueba, 4);
    const { rows: creado } = await pool.query<{ id_user: number }>(
      `INSERT INTO "user" (name, last_name, email, password_hash, id_role, active, fcm_token)
       VALUES ('Mario', 'Suspendible', $1, $2, $3, true, 'token-fcm-activo')
       RETURNING id_user`,
      [emailPrueba, hash, idRolUsuario],
    );
    idUsuarioPrueba = creado[0].id_user;
  });

  afterAll(async () => {
    if (pool && idUsuarioPrueba) {
      await pool.query(
        `DELETE FROM audit_log WHERE entity_type = 'user' AND entity_id = $1`,
        [idUsuarioPrueba],
      );
      await pool.query(`DELETE FROM "user" WHERE id_user = $1`, [idUsuarioPrueba]);
    }
    await pool?.end();
  });

  it('encuentra al usuario por correo o nombre y permite suspenderlo registrando audit_log y bloqueando login', async () => {
    const encontrados = await adminUsuariosService.buscarUsuarios({ q: emailPrueba });
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].idUser).toBe(idUsuarioPrueba);
    expect(encontrados[0].active).toBe(true);

    const resultado = await adminUsuariosService.suspenderUsuario({
      idUser: idUsuarioPrueba,
      idAdminGlobal,
      motivo: 'Incumplimiento reiterado en tanda',
    });

    expect(resultado.active).toBe(false);

    // 1. Verificar en BD que active = false y fcm_token fue limpiado
    const { rows: filaUser } = await pool.query<{ active: boolean; fcm_token: string | null }>(
      `SELECT active, fcm_token FROM "user" WHERE id_user = $1`,
      [idUsuarioPrueba],
    );
    expect(filaUser[0].active).toBe(false);
    expect(filaUser[0].fcm_token).toBeNull();

    // 2. Verificar registro inmutable en audit_log
    const { rows: bitacora } = await pool.query<{
      id_user: number;
      action_type: string;
      entity_type: string;
      entity_id: number;
      description: string;
    }>(
      `SELECT id_user, action_type, entity_type, entity_id, description
         FROM audit_log
        WHERE entity_type = 'user' AND entity_id = $1`,
      [idUsuarioPrueba],
    );
    expect(bitacora).toHaveLength(1);
    expect(bitacora[0].id_user).toBe(idAdminGlobal);
    expect(bitacora[0].action_type).toBe(ACCION_USUARIO_SUSPENDIDO);
    expect(bitacora[0].description).toContain('Incumplimiento reiterado en tanda');

    // 3. El usuario suspendido ya no puede iniciar sesión
    await expect(authService.validateUser(emailPrueba, passwordPrueba)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
