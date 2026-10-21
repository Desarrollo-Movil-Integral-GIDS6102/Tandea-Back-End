import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import {
  roleTable,
  userTable,
  tandaTypeTable,
  tandaTable,
  numberTable,
} from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';

const testDbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)('Restricción única de number (Integración)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  let testRoleId: number;
  let testUserId: number;
  let testTandaTypeId: number;
  let idTanda1: number;
  let idTanda2: number;

  beforeAll(async () => {
    if (!testDbUrl) return;

    validateLocalDatabaseUrl(testDbUrl);

    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);

    // 1. Obtener o crear rol temporal
    const [existingRole] = await db
      .select()
      .from(roleTable)
      .where(eq(roleTable.nameRole, 'test_role_unique'))
      .limit(1);

    if (existingRole) {
      testRoleId = existingRole.idRole;
    } else {
      const [newRole] = await db
        .insert(roleTable)
        .values({
          nameRole: 'test_role_unique',
          description: 'Rol para pruebas de integración de restricción única',
          active: true,
        })
        .returning({ idRole: roleTable.idRole });
      testRoleId = newRole.idRole;
    }

    // 2. Crear usuario temporal
    const uniqueEmail = `test_unique_${Date.now()}@tandea.test`;
    const [user] = await db
      .insert(userTable)
      .values({
        name: 'Test',
        lastName: 'Unique',
        email: uniqueEmail,
        passwordHash: 'dummy_hash',
        idRole: testRoleId,
        active: true,
      })
      .returning({ idUser: userTable.idUser });
    testUserId = user.idUser;

    // 3. Obtener o crear tanda_type
    const [existingType] = await db
      .select()
      .from(tandaTypeTable)
      .limit(1);

    if (existingType) {
      testTandaTypeId = existingType.idTandaType;
    } else {
      const [newType] = await db
        .insert(tandaTypeTable)
        .values({
          name: 'test_type_unique',
          description: 'Tipo de prueba única',
        })
        .returning({ idTandaType: tandaTypeTable.idTandaType });
      testTandaTypeId = newType.idTandaType;
    }

    // 4. Crear tanda 1 y tanda 2
    const [tanda1] = await db
      .insert(tandaTable)
      .values({
        name: 'Tanda Test Unique 1',
        startDate: '2026-11-01',
        contributionAmount: '1000.00',
        numParticipants: 5,
        numRounds: 2,
        graceDays: 2,
        hasDeadNumber: false,
        idTandaType: testTandaTypeId,
        idAdmin: testUserId,
        status: 'PENDIENTE',
        active: true,
        inviteCode: `TU1_${Date.now()}`.slice(0, 20),
      })
      .returning({ idTanda: tandaTable.idTanda });
    idTanda1 = tanda1.idTanda;

    const [tanda2] = await db
      .insert(tandaTable)
      .values({
        name: 'Tanda Test Unique 2',
        startDate: '2026-11-01',
        contributionAmount: '1000.00',
        numParticipants: 5,
        numRounds: 2,
        graceDays: 2,
        hasDeadNumber: false,
        idTandaType: testTandaTypeId,
        idAdmin: testUserId,
        status: 'PENDIENTE',
        active: true,
        inviteCode: `TU2_${Date.now()}`.slice(0, 20),
      })
      .returning({ idTanda: tandaTable.idTanda });
    idTanda2 = tanda2.idTanda;
  });

  afterAll(async () => {
    if (!pool || !db) return;

    try {
      // Limpiar datos insertados en orden inverso de claves foráneas
      if (idTanda1 && idTanda2) {
        await db
          .delete(numberTable)
          .where(inArray(numberTable.idTanda, [idTanda1, idTanda2]));

        await db
          .delete(tandaTable)
          .where(inArray(tandaTable.idTanda, [idTanda1, idTanda2]));
      }

      if (testUserId) {
        await db.delete(userTable).where(eq(userTable.idUser, testUserId));
      }
    } finally {
      await pool.end();
    }
  });

  it('a) Insertar dos number con el mismo (id_tanda, round_number, number_value) falla con el código 23505 de PostgreSQL', async () => {
    // Primer insert válido
    await db.insert(numberTable).values({
      idTanda: idTanda1,
      roundNumber: 1,
      numberValue: 1,
      idUser: testUserId,
      isDeadNumber: false,
      status: 'PENDIENTE',
      active: true,
    });

    // Segundo insert con exactamente la misma tupla (id_tanda, round_number, number_value)
    let caughtError: any = null;
    try {
      await db.insert(numberTable).values({
        idTanda: idTanda1,
        roundNumber: 1,
        numberValue: 1,
        idUser: testUserId,
        isDeadNumber: false,
        status: 'PENDIENTE',
        active: true,
      });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    // En Drizzle 0.44 el error de PostgreSQL puede venir en err.code o anidado en err.cause.code
    const pgCode = caughtError?.code || caughtError?.cause?.code;
    expect(pgCode).toBe('23505');
  });

  it('b) El mismo number_value en OTRA vuelta (round_number distinto) de la misma tanda SÍ se permite', async () => {
    const result = await db
      .insert(numberTable)
      .values({
        idTanda: idTanda1,
        roundNumber: 2,
        numberValue: 1,
        idUser: testUserId,
        isDeadNumber: false,
        status: 'PENDIENTE',
        active: true,
      })
      .returning();

    expect(result).toHaveLength(1);
    expect(result[0].idTanda).toBe(idTanda1);
    expect(result[0].roundNumber).toBe(2);
    expect(result[0].numberValue).toBe(1);
  });

  it('c) El mismo number_value en otra tanda SÍ se permite', async () => {
    const result = await db
      .insert(numberTable)
      .values({
        idTanda: idTanda2,
        roundNumber: 1,
        numberValue: 1,
        idUser: testUserId,
        isDeadNumber: false,
        status: 'PENDIENTE',
        active: true,
      })
      .returning();

    expect(result).toHaveLength(1);
    expect(result[0].idTanda).toBe(idTanda2);
    expect(result[0].roundNumber).toBe(1);
    expect(result[0].numberValue).toBe(1);
  });
});
