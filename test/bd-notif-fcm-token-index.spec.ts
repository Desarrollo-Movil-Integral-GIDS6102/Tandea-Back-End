import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { userTable, notificationTable, roleTable } from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';

/**
 * [SP-3 BD-NOTIF] Validación de fcmToken opcional en user e índice (id_user, is_read) en notification.
 */
describe('[SP-3 BD-NOTIF] Verificación estática del Schema Drizzle', () => {
  it('la tabla user debe definir la columna fcmToken como opcional (nullable)', () => {
    const config = getTableConfig(userTable);
    const fcmCol = config.columns.find((col) => col.name === 'fcm_token');

    expect(fcmCol).toBeDefined();
    expect(fcmCol?.notNull).toBe(false);
  });

  it('la tabla notification debe incluir el índice compuesto (id_user, is_read)', () => {
    const config = getTableConfig(notificationTable);
    expect(config.indexes).toBeDefined();

    const notifIdx = config.indexes.find(
      (idx) => idx.config.name === 'notification_user_read_idx',
    );

    expect(notifIdx).toBeDefined();
    const columnNames = notifIdx?.config.columns.map((c: any) => c.name);
    expect(columnNames).toEqual(['id_user', 'is_read']);
  });
});

const testDbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)('[SP-3 BD-NOTIF] Integración BD Local: fcmToken e índice notification', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  const createdUserIds: number[] = [];
  let testRoleId: number;

  beforeAll(async () => {
    if (!testDbUrl) return;

    validateLocalDatabaseUrl(testDbUrl);

    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);

    // Obtener o crear rol temporal
    const [existingRole] = await db
      .select()
      .from(roleTable)
      .where(eq(roleTable.nameRole, 'test_role_bd_notif'))
      .limit(1);

    if (existingRole) {
      testRoleId = existingRole.idRole;
    } else {
      const [newRole] = await db
        .insert(roleTable)
        .values({
          nameRole: 'test_role_bd_notif',
          description: 'Rol para pruebas de fcmToken e índice notification',
          active: true,
        })
        .returning({ idRole: roleTable.idRole });
      testRoleId = newRole.idRole;
    }
  });

  afterAll(async () => {
    if (db && createdUserIds.length > 0) {
      await db.delete(userTable).where(inArray(userTable.idUser, createdUserIds));
    }
    if (pool) {
      await pool.end();
    }
  });

  it('la columna fcm_token existe en la base, es nullable y se puede insertar un usuario sin ella', async () => {
    const emailSinFcm = `user_sin_fcm_${Date.now()}@tandea.test`;
    const [created] = await db
      .insert(userTable)
      .values({
        name: 'SinFcm',
        lastName: 'Prueba',
        email: emailSinFcm,
        passwordHash: 'dummy_hash',
        idRole: testRoleId,
        active: true,
      })
      .returning({
        idUser: userTable.idUser,
        email: userTable.email,
        fcmToken: userTable.fcmToken,
      });

    createdUserIds.push(created.idUser);

    expect(created.idUser).toBeDefined();
    expect(created.fcmToken).toBeNull();

    // Confirmar en information_schema que es nullable
    const colInfo = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'user' AND column_name = 'fcm_token';`,
    );

    expect(colInfo.rows.length).toBe(1);
    expect(colInfo.rows[0].column_name).toBe('fcm_token');
    expect(colInfo.rows[0].is_nullable).toBe('YES');
  });

  it('se puede guardar y leer un fcmToken', async () => {
    const emailConFcm = `user_con_fcm_${Date.now()}@tandea.test`;
    const tokenPrueba = 'fcm_token_example_abc123xyz_test';

    const [created] = await db
      .insert(userTable)
      .values({
        name: 'ConFcm',
        lastName: 'Prueba',
        email: emailConFcm,
        passwordHash: 'dummy_hash',
        idRole: testRoleId,
        active: true,
        fcmToken: tokenPrueba,
      })
      .returning({
        idUser: userTable.idUser,
        email: userTable.email,
        fcmToken: userTable.fcmToken,
      });

    createdUserIds.push(created.idUser);

    expect(created.idUser).toBeDefined();
    expect(created.fcmToken).toBe(tokenPrueba);

    // Leerlo directamente con select de drizzle
    const [fetched] = await db
      .select({
        idUser: userTable.idUser,
        fcmToken: userTable.fcmToken,
      })
      .from(userTable)
      .where(eq(userTable.idUser, created.idUser))
      .limit(1);

    expect(fetched).toBeDefined();
    expect(fetched.fcmToken).toBe(tokenPrueba);
  });

  it('el índice sobre (id_user, is_read) existe en pg_indexes con las columnas en ese orden', async () => {
    const res = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE tablename = 'notification' AND indexname = 'notification_user_read_idx';`,
    );

    expect(res.rows.length).toBe(1);
    const indexDef = res.rows[0].indexdef;
    expect(indexDef).toMatch(/USING\s+btree\s*\(\s*id_user\s*,\s*is_read\s*\)/i);
  });
});
