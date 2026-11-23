import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';
import { DrizzleAdminDisputasRepository } from '../src/admin/infrastructure/adapters/out/database/drizzle-admin-disputas.repository';
import {
  ACCION_DISPUTA_RESUELTA,
  AdminDisputasService,
} from '../src/admin/application/services/admin-disputas.service';

const testDbUrl = process.env.TEST_DATABASE_URL;

/**
 * [SP-4 BE-ADMIN] Prueba de integración contra PostgreSQL local:
 *  - Un miembro de la tanda abre una disputa (POST /disputas) y el admin global la ve en su lista.
 *  - Resolver con mantener, revertir o suspender guarda notas en audit_log en la misma transacción.
 *  - Ningún flujo de resolución modifica los montos en payment, payout ni tanda.
 */
describe.skipIf(!testDbUrl)('[SP-4 BE-ADMIN] Gestionar disputas y audit_log (BD local)', () => {
  let pool: Pool;
  let servicio: AdminDisputasService;
  let idAdminGlobal: number;
  let idParticipante: number;
  let idTanda: number;
  let idNumber: number;
  let idPayment: number;
  let idPayout: number;
  const creadas: number[] = [];

  beforeAll(async () => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
    const db = drizzle(pool) as NodePgDatabase;
    servicio = new AdminDisputasService(new DrizzleAdminDisputasRepository(db));

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

    const hash = await bcrypt.hash('Tandea-Disputa-2026!', 4);
    const { rows: userRows } = await pool.query<{ id_user: number }>(
      `INSERT INTO "user" (name, last_name, email, password_hash, id_role, active)
       VALUES ('Lucía', 'Disputas', $1, $2, $3, true)
       RETURNING id_user`,
      [`lucia.disputas.${Date.now()}@tandea.test`, hash, idRolUsuario],
    );
    idParticipante = userRows[0].id_user;

    const { rows: tipos } = await pool.query<{ id_tanda_type: number }>(
      `SELECT id_tanda_type FROM tanda_type ORDER BY id_tanda_type LIMIT 1`,
    );

    const { rows: tandaRows } = await pool.query<{ id_tanda: number }>(
      `INSERT INTO tanda
         (name, description, start_date, contribution_amount, num_participants, num_rounds,
          grace_days, periodicity, has_dead_number, id_tanda_type, id_admin, status, invite_code)
       VALUES ('Tanda Prueba Disputas SP4', 'Integración de disputas', CURRENT_DATE, 750.00,
               2, 1, 2, 'quincenal', false, $1, $2, 'ACTIVA', $3)
       RETURNING id_tanda`,
      [tipos[0].id_tanda_type, idParticipante, `DSP-${Date.now().toString().slice(-6)}`],
    );
    idTanda = tandaRows[0].id_tanda;

    const { rows: numRows } = await pool.query<{ id_number: number }>(
      `INSERT INTO number (number_value, id_user, id_tanda, is_dead_number, round_number, status)
       VALUES (1, $1, $2, false, 1, 'ENTREGA_PENDIENTE_CONFIRMACION')
       RETURNING id_number`,
      [idParticipante, idTanda],
    );
    idNumber = numRows[0].id_number;

    const { rows: payRows } = await pool.query<{ id_payment: number }>(
      `INSERT INTO payment (id_number, transfer_amount, cash_amount, total_amount,
                            confirmed_by_participant, confirmed_by_admin, status)
       VALUES ($1, 500.00, 250.00, 750.00, true, true, 'CONFIRMADO')
       RETURNING id_payment`,
      [idNumber],
    );
    idPayment = payRows[0].id_payment;

    const { rows: payoutRows } = await pool.query<{ id_payout: number }>(
      `INSERT INTO payout (id_number, transfer_amount, cash_amount, total_amount,
                           confirmed_by_admin, confirmed_by_recipient, status)
       VALUES ($1, 1000.00, 500.00, 1500.00, true, false, 'PENDIENTE')
       RETURNING id_payout`,
      [idNumber],
    );
    idPayout = payoutRows[0].id_payout;
  });

  afterAll(async () => {
    if (pool && idTanda) {
      if (creadas.length > 0) {
        await pool.query(
          `DELETE FROM audit_log WHERE entity_type = 'dispute' AND entity_id = ANY($1)`,
          [creadas],
        );
      }
      await pool.query(`DELETE FROM dispute WHERE id_tanda = $1`, [idTanda]);
      await pool.query(`DELETE FROM payment WHERE id_payment = $1`, [idPayment]);
      await pool.query(`DELETE FROM payout WHERE id_payout = $1`, [idPayout]);
      await pool.query(`DELETE FROM number WHERE id_number = $1`, [idNumber]);
      await pool.query(`DELETE FROM tanda WHERE id_tanda = $1`, [idTanda]);
      await pool.query(`DELETE FROM "user" WHERE id_user = $1`, [idParticipante]);
    }
    await pool?.end();
  });

  it('resuelve con mantener, revertir y suspender guardando audit_log en la misma transacción y sin tocar montos', async () => {
    // 1) Abrir 3 disputas como miembro de la tanda
    const dMantener = await servicio.crearDisputa({
      idTanda,
      idReporter: idParticipante,
      rolReporter: 'usuario',
      motivo: 'Revisión de comprobante de pago',
      idPayment,
    });
    const dRevertir = await servicio.crearDisputa({
      idTanda,
      idReporter: idParticipante,
      rolReporter: 'usuario',
      motivo: 'Pago confirmado por error',
      idPayment,
    });
    const dSuspender = await servicio.crearDisputa({
      idTanda,
      idReporter: idParticipante,
      rolReporter: 'usuario',
      motivo: 'Irregularidad grave en la entrega',
      idPayout,
    });
    creadas.push(dMantener.idDispute, dRevertir.idDispute, dSuspender.idDispute);

    // El admin global las ve en su lista
    const lista = await servicio.listarDisputas({ idTanda });
    expect(lista.map((d) => d.idDispute)).toEqual(
      expect.arrayContaining([dMantener.idDispute, dRevertir.idDispute, dSuspender.idDispute]),
    );

    // 2) Resolver con "mantener", "revertir" y "suspender"
    await servicio.resolverDisputa({
      idDispute: dMantener.idDispute,
      idAdminGlobal,
      accion: 'mantener',
      notas: 'El comprobante coincide con el depósito',
    });
    await servicio.resolverDisputa({
      idDispute: dRevertir.idDispute,
      idAdminGlobal,
      accion: 'revertir',
      notas: 'Se revierte la confirmación del pago',
    });
    await servicio.resolverDisputa({
      idDispute: dSuspender.idDispute,
      idAdminGlobal,
      accion: 'suspender',
      notas: 'Se suspende la tanda por incumplimiento',
    });

    // 3) Verificar audit_log para las 3 disputas
    const { rows: logs } = await pool.query<{
      entity_id: number;
      action_type: string;
      description: string;
    }>(
      `SELECT entity_id, action_type, description
         FROM audit_log
        WHERE entity_type = 'dispute' AND entity_id = ANY($1)
        ORDER BY id_log ASC`,
      [creadas],
    );
    expect(logs).toHaveLength(3);
    expect(logs[0].action_type).toBe(ACCION_DISPUTA_RESUELTA);
    expect(logs[0].description).toContain('acción "mantener"');
    expect(logs[1].description).toContain('acción "revertir"');
    expect(logs[2].description).toContain('acción "suspender"');

    // 4) Verificar que ningún monto en payment, payout ni tanda fue modificado
    const { rows: pago } = await pool.query<{
      transfer_amount: string;
      cash_amount: string;
      total_amount: string;
      status: string;
    }>(
      `SELECT transfer_amount, cash_amount, total_amount, status FROM payment WHERE id_payment = $1`,
      [idPayment],
    );
    expect(Number(pago[0].transfer_amount)).toBe(500);
    expect(Number(pago[0].cash_amount)).toBe(250);
    expect(Number(pago[0].total_amount)).toBe(750);
    expect(pago[0].status).toBe('RECHAZADO');

    const { rows: entrega } = await pool.query<{
      transfer_amount: string;
      cash_amount: string;
      total_amount: string;
    }>(
      `SELECT transfer_amount, cash_amount, total_amount FROM payout WHERE id_payout = $1`,
      [idPayout],
    );
    expect(Number(entrega[0].transfer_amount)).toBe(1000);
    expect(Number(entrega[0].cash_amount)).toBe(500);
    expect(Number(entrega[0].total_amount)).toBe(1500);

    const { rows: tanda } = await pool.query<{
      contribution_amount: string;
      status: string;
    }>(`SELECT contribution_amount, status FROM tanda WHERE id_tanda = $1`, [idTanda]);
    expect(Number(tanda[0].contribution_amount)).toBe(750);
    expect(tanda[0].status).toBe('SUSPENDIDA');
  });
});
