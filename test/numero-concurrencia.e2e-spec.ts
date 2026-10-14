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
import { DrizzleTandaRepository } from '../src/tandas/infrastructure/adapters/out/database/drizzle-tanda.repository';
import { NumeroYaTomadoError } from '../src/tandas/domain/errors/numero.errors';

const testDbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)('Asignación concurrente de números en base de datos (AP-02 Integración)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;
  let repository: DrizzleTandaRepository;

  let testRoleId: number;
  let userAId: number;
  let userBId: number;
  let testTandaTypeId: number;
  let idTanda: number;

  beforeAll(async () => {
    if (!testDbUrl) return;

    validateLocalDatabaseUrl(testDbUrl);

    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);
    repository = new DrizzleTandaRepository(db as any);

    // 1. Obtener o crear rol temporal
    const [existingRole] = await db
      .select()
      .from(roleTable)
      .where(eq(roleTable.nameRole, 'test_role_concurrency'))
      .limit(1);

    if (existingRole) {
      testRoleId = existingRole.idRole;
    } else {
      const [newRole] = await db
        .insert(roleTable)
        .values({
          nameRole: 'test_role_concurrency',
          description: 'Rol para pruebas de concurrencia de asignación de números',
          active: true,
        })
        .returning({ idRole: roleTable.idRole });
      testRoleId = newRole.idRole;
    }

    // 2. Crear dos usuarios temporales competidores
    const now = Date.now();
    const [u1] = await db
      .insert(userTable)
      .values({
        name: 'UserA',
        lastName: 'Concurrente',
        email: `usera_${now}@tandea.test`,
        passwordHash: 'dummy_hash',
        idRole: testRoleId,
        active: true,
      })
      .returning({ idUser: userTable.idUser });
    userAId = u1.idUser;

    const [u2] = await db
      .insert(userTable)
      .values({
        name: 'UserB',
        lastName: 'Concurrente',
        email: `userb_${now}@tandea.test`,
        passwordHash: 'dummy_hash',
        idRole: testRoleId,
        active: true,
      })
      .returning({ idUser: userTable.idUser });
    userBId = u2.idUser;

    // 3. Obtener o crear tipo de tanda
    const [existingType] = await db.select().from(tandaTypeTable).limit(1);
    if (existingType) {
      testTandaTypeId = existingType.idTandaType;
    } else {
      const [newType] = await db
        .insert(tandaTypeTable)
        .values({
          name: 'test_type_concurrency',
          description: 'Tipo de prueba concurrente',
        })
        .returning({ idTandaType: tandaTypeTable.idTandaType });
      testTandaTypeId = newType.idTandaType;
    }

    // 4. Crear tanda de prueba
    const [tanda] = await db
      .insert(tandaTable)
      .values({
        name: 'Tanda Concurrencia AP-02',
        startDate: '2026-11-01',
        contributionAmount: '1000.00',
        numParticipants: 5,
        numRounds: 1,
        graceDays: 2,
        hasDeadNumber: false,
        idTandaType: testTandaTypeId,
        idAdmin: userAId,
        status: 'PENDIENTE',
        active: true,
        inviteCode: `TC_${now}`.slice(0, 20),
      })
      .returning({ idTanda: tandaTable.idTanda });
    idTanda = tanda.idTanda;

    // 5. Pre-insertar el turno 1 libre (id_user = null)
    await db.insert(numberTable).values({
      idTanda,
      roundNumber: 1,
      numberValue: 1,
      idUser: null,
      isDeadNumber: false,
      status: 'PENDIENTE',
      active: true,
    });
  });

  afterAll(async () => {
    if (!pool || !db) return;

    try {
      if (idTanda) {
        await db.delete(numberTable).where(eq(numberTable.idTanda, idTanda));
        await db.delete(tandaTable).where(eq(tandaTable.idTanda, idTanda));
      }
      if (userAId && userBId) {
        await db
          .delete(userTable)
          .where(inArray(userTable.idUser, [userAId, userBId]));
      }
    } finally {
      await pool.end();
    }
  });

  it('lanza dos asignaciones simultáneas del mismo número con Promise.all y verifica que exactamente una tenga éxito y la otra reciba NumeroYaTomadoError', async () => {
    // Disparar las dos promesas simultáneamente compitiendo por el número 1 en la vuelta 1
    const results = await Promise.allSettled([
      repository.asignarSiLibre(idTanda, 1, 1, userAId),
      repository.asignarSiLibre(idTanda, 1, 1, userBId),
    ]);

    const exitosos = results.filter((r) => r.status === 'fulfilled');
    const fallidos = results.filter((r) => r.status === 'rejected');

    // Exactamente una promesa debe haber tenido éxito y la otra fallado
    expect(exitosos).toHaveLength(1);
    expect(fallidos).toHaveLength(1);

    // La promesa rechazada debe contener específicamente NumeroYaTomadoError
    const motivoFallo = (fallidos[0] as PromiseRejectedResult).reason;
    expect(motivoFallo).toBeInstanceOf(NumeroYaTomadoError);

    // Verificar en base de datos que el número quedó asignado al ganador
    const ganador = (exitosos[0] as PromiseFulfilledResult<any>).value;
    expect([userAId, userBId]).toContain(ganador.idUser);
  });
});
