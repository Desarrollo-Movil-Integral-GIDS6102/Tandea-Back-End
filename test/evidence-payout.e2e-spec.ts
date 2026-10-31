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
  paymentTable,
  payoutTable,
  evidenceTable,
} from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [BD-ENTREGA] Pruebas de Integración para Enlace Evidence.idPayout y CHECK Constraint.
 *
 * Se ejecutan exclusivamente contra base de datos PostgreSQL local si TEST_DATABASE_URL está definida.
 */
describe.skipIf(!testDbUrl)('Enlace Evidence.idPayout y CHECK de entrega (Integración)', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  let testRoleId: number;
  let testUserId: number;
  let testTandaTypeId: number;
  let testTandaId: number;
  let testNumberId: number;
  let testPaymentId: number;
  let testPayoutId: number;

  beforeAll(async () => {
    if (!testDbUrl) return;

    validateLocalDatabaseUrl(testDbUrl);

    pool = new Pool({ connectionString: testDbUrl });
    db = drizzle(pool);

    // 1. Obtener o crear rol de prueba
    const [existingRole] = await db
      .select()
      .from(roleTable)
      .where(eq(roleTable.nameRole, 'test_role_payout'))
      .limit(1);

    if (existingRole) {
      testRoleId = existingRole.idRole;
    } else {
      const [newRole] = await db
        .insert(roleTable)
        .values({
          nameRole: 'test_role_payout',
          description: 'Rol para pruebas de payout y evidence',
          active: true,
        })
        .returning({ idRole: roleTable.idRole });
      testRoleId = newRole.idRole;
    }

    // 2. Crear usuario de prueba
    const [user] = await db
      .insert(userTable)
      .values({
        name: 'Test',
        lastName: 'Payout',
        email: `test_payout_${Date.now()}@tandea.test`,
        passwordHash: 'dummy_hash',
        idRole: testRoleId,
        active: true,
      })
      .returning({ idUser: userTable.idUser });
    testUserId = user.idUser;

    // 3. Obtener o crear tanda_type
    const [existingType] = await db.select().from(tandaTypeTable).limit(1);
    if (existingType) {
      testTandaTypeId = existingType.idTandaType;
    } else {
      const [newType] = await db
        .insert(tandaTypeTable)
        .values({
          name: 'test_type_payout',
          description: 'Tipo de tanda para pruebas payout',
        })
        .returning({ idTandaType: tandaTypeTable.idTandaType });
      testTandaTypeId = newType.idTandaType;
    }

    // 4. Crear tanda de prueba
    const [tanda] = await db
      .insert(tandaTable)
      .values({
        name: 'Tanda Test Payout',
        startDate: '2026-11-01',
        contributionAmount: '1000.00',
        numParticipants: 5,
        numRounds: 1,
        graceDays: 2,
        hasDeadNumber: false,
        idTandaType: testTandaTypeId,
        idAdmin: testUserId,
        status: 'PENDIENTE',
        active: true,
        inviteCode: `TPO_${Date.now()}`.slice(0, 20),
      })
      .returning({ idTanda: tandaTable.idTanda });
    testTandaId = tanda.idTanda;

    // 5. Crear turno (number)
    const [num] = await db
      .insert(numberTable)
      .values({
        idTanda: testTandaId,
        roundNumber: 1,
        numberValue: 1,
        idUser: testUserId,
        isDeadNumber: false,
        status: 'PENDIENTE',
        active: true,
      })
      .returning({ idNumber: numberTable.idNumber });
    testNumberId = num.idNumber;

    // 6. Crear payout de prueba
    const [payout] = await db
      .insert(payoutTable)
      .values({
        idNumber: testNumberId,
        transferAmount: '1000.00',
        cashAmount: '0.00',
        totalAmount: '1000.00',
        confirmedByAdmin: true,
        confirmedByRecipient: false,
        status: 'PENDIENTE',
      })
      .returning({ idPayout: payoutTable.idPayout });
    testPayoutId = payout.idPayout;

    // 7. Crear payment de prueba (para probar conflicto en CHECK)
    const [payment] = await db
      .insert(paymentTable)
      .values({
        idNumber: testNumberId,
        transferAmount: '1000.00',
        cashAmount: '0.00',
        totalAmount: '1000.00',
        confirmedByParticipant: true,
        confirmedByAdmin: false,
        status: 'PENDIENTE',
      })
      .returning({ idPayment: paymentTable.idPayment });
    testPaymentId = payment.idPayment;
  });

  afterAll(async () => {
    if (!pool || !db) return;

    try {
      // Limpiar datos generados en orden inverso por FKs
      await db
        .delete(evidenceTable)
        .where(
          inArray(
            evidenceTable.idPayout,
            testPayoutId ? [testPayoutId] : [],
          ),
        );
      if (testPaymentId) {
        await db
          .delete(evidenceTable)
          .where(eq(evidenceTable.idPayment, testPaymentId));
      }
      if (testPayoutId) {
        await db.delete(payoutTable).where(eq(payoutTable.idPayout, testPayoutId));
      }
      if (testPaymentId) {
        await db
          .delete(paymentTable)
          .where(eq(paymentTable.idPayment, testPaymentId));
      }
      if (testNumberId) {
        await db
          .delete(numberTable)
          .where(eq(numberTable.idNumber, testNumberId));
      }
      if (testTandaId) {
        await db.delete(tandaTable).where(eq(tandaTable.idTanda, testTandaId));
      }
      if (testUserId) {
        await db.delete(userTable).where(eq(userTable.idUser, testUserId));
      }
    } finally {
      await pool.end();
    }
  });

  it('1. Evidence.idPayout enlaza correctamente con Payout mediante clave foránea', async () => {
    const fileUrl = 'https://storage.tandea.app/entregas/evidencia_valida.jpg';

    const [createdEvidence] = await db
      .insert(evidenceTable)
      .values({
        idPayout: testPayoutId,
        idPayment: null,
        fileUrl,
      })
      .returning();

    expect(createdEvidence).toBeDefined();
    expect(createdEvidence.idPayout).toBe(testPayoutId);
    expect(createdEvidence.idPayment).toBeNull();
    expect(createdEvidence.fileUrl).toBe(fileUrl);

    // Consulta con JOIN para validar integridad referencial
    const [joined] = await db
      .select({
        idEvidence: evidenceTable.idEvidence,
        fileUrl: evidenceTable.fileUrl,
        idPayout: payoutTable.idPayout,
        payoutTotal: payoutTable.totalAmount,
        payoutStatus: payoutTable.status,
      })
      .from(evidenceTable)
      .innerJoin(payoutTable, eq(evidenceTable.idPayout, payoutTable.idPayout))
      .where(eq(evidenceTable.idEvidence, createdEvidence.idEvidence))
      .limit(1);

    expect(joined).toBeDefined();
    expect(joined.idPayout).toBe(testPayoutId);
    expect(joined.fileUrl).toBe(fileUrl);
    expect(joined.payoutTotal).toBe('1000.00');
  });

  it('2. El CHECK de Evidence acepta una evidencia de entrega válida (idPayout presente, idPayment nulo)', async () => {
    const fileUrl = 'https://storage.tandea.app/entregas/entrega_segunda.jpg';

    const [evidence] = await db
      .insert(evidenceTable)
      .values({
        idPayout: testPayoutId,
        idPayment: null,
        fileUrl,
      })
      .returning();

    expect(evidence.idEvidence).toBeDefined();
    expect(evidence.idPayout).toBe(testPayoutId);
    expect(evidence.idPayment).toBeNull();
  });

  it('3. El CHECK de Evidence rechaza una evidencia inválida con ambos campos nulos', async () => {
    let error: any;
    try {
      await db.insert(evidenceTable).values({
        idPayout: null,
        idPayment: null,
        fileUrl: 'https://storage.tandea.app/entregas/invalida_sin_padre.jpg',
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    const pgCode = error?.code || error?.cause?.code;
    expect(pgCode).toBe('23514'); // check_violation
  });

  it('4. El CHECK de Evidence rechaza una evidencia inválida con ambos campos presentes (idPayment e idPayout)', async () => {
    let error: any;
    try {
      await db.insert(evidenceTable).values({
        idPayout: testPayoutId,
        idPayment: testPaymentId,
        fileUrl: 'https://storage.tandea.app/entregas/invalida_dos_padres.jpg',
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    const pgCode = error?.code || error?.cause?.code;
    expect(pgCode).toBe('23514'); // check_violation
  });
});
