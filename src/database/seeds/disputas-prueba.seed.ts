import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Pool, type PoolClient } from 'pg';
import { validateLocalDatabaseUrl } from './tanda-type.seed';

/**
 * [SP-4 BD-ADMIN] Seed de desarrollo con 3 disputas en distintos estados
 * (ABIERTA, EN_REVISION y RESUELTA) para probar el panel del Administrador Global.
 *
 * Solo corre contra la base local. Se puede ejecutar varias veces: si la tanda
 * demo ya existe no se vuelve a crear nada.
 *
 * Requiere que ya exista el rol `admin_global` con un usuario (`npx tsx src/database/seed.ts`)
 * y los tipos de tanda (`npm run db:seed`).
 *
 * Uso: npm run db:seed:disputas
 */
export const CODIGO_TANDA_DEMO = 'DISPUTAS-DEMO';
const PASSWORD_PRUEBA = 'Tandea-Pruebas-2026';

const PARTICIPANTES = [
  { name: 'Olga', lastName: 'Organizadora', email: 'olga.disputas@tandea.test' },
  { name: 'Pablo', lastName: 'Participante', email: 'pablo.disputas@tandea.test' },
  { name: 'Rosa', lastName: 'Reportera', email: 'rosa.disputas@tandea.test' },
];

export interface ResultadoSeedDisputas {
  creado: boolean;
  idTanda: number;
  disputas: number;
}

async function obtenerIdRol(client: PoolClient, nombre: string): Promise<number> {
  const { rows } = await client.query<{ id_role: number }>(
    `SELECT id_role FROM role WHERE name_role = $1 LIMIT 1`,
    [nombre],
  );
  if (rows[0]) return rows[0].id_role;
  const { rows: nuevo } = await client.query<{ id_role: number }>(
    `INSERT INTO role (name_role) VALUES ($1) RETURNING id_role`,
    [nombre],
  );
  return nuevo[0].id_role;
}

export async function seedDisputasPrueba(databaseUrl?: string): Promise<ResultadoSeedDisputas> {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está definida.');
  }
  const host = validateLocalDatabaseUrl(url);
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Las disputas de prueba solo se crean en la base local.');
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existente } = await client.query<{ id_tanda: number }>(
      `SELECT id_tanda FROM tanda WHERE invite_code = $1 LIMIT 1`,
      [CODIGO_TANDA_DEMO],
    );
    if (existente[0]) {
      await client.query('ROLLBACK');
      return { creado: false, idTanda: existente[0].id_tanda, disputas: 0 };
    }

    const { rows: admins } = await client.query<{ id_user: number }>(
      `SELECT u.id_user FROM "user" u JOIN role r ON r.id_role = u.id_role
        WHERE r.name_role = 'admin_global' AND u.deleted_at IS NULL
        ORDER BY u.id_user LIMIT 1`,
    );
    if (!admins[0]) {
      throw new Error('No hay un usuario admin_global. Corre primero `npx tsx src/database/seed.ts`.');
    }
    const idAdminGlobal = admins[0].id_user;

    const { rows: tipos } = await client.query<{ id_tanda_type: number }>(
      `SELECT id_tanda_type FROM tanda_type ORDER BY id_tanda_type LIMIT 1`,
    );
    if (!tipos[0]) {
      throw new Error('No hay tipos de tanda. Corre primero `npm run db:seed`.');
    }

    // Usuarios demo (organizadora + 2 participantes); los que ya existen se reutilizan
    const idRolUsuario = await obtenerIdRol(client, 'usuario');
    const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 10);
    const ids: number[] = [];
    for (const p of PARTICIPANTES) {
      const { rows } = await client.query<{ id_user: number }>(
        `INSERT INTO "user" (name, last_name, email, password_hash, id_role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id_user`,
        [p.name, p.lastName, p.email, passwordHash, idRolUsuario],
      );
      ids.push(rows[0].id_user);
    }
    const [idOrganizadora, idPablo, idRosa] = ids;

    const { rows: tanda } = await client.query<{ id_tanda: number }>(
      `INSERT INTO tanda
         (name, description, start_date, contribution_amount, num_participants, num_rounds,
          grace_days, periodicity, has_dead_number, id_tanda_type, id_admin, status, invite_code)
       VALUES ('Tanda demo de disputas', 'Datos de prueba para el panel de casos reportados',
               CURRENT_DATE, 500, 3, 1, 2, 'quincenal', false, $1, $2, 'ACTIVA', $3)
       RETURNING id_tanda`,
      [tipos[0].id_tanda_type, idOrganizadora, CODIGO_TANDA_DEMO],
    );
    const idTanda = tanda[0].id_tanda;

    // Un número por participante y un pago confirmado por número
    const pagos: number[] = [];
    const numeros: number[] = [];
    for (const [i, idUser] of ids.entries()) {
      const { rows: numero } = await client.query<{ id_number: number }>(
        `INSERT INTO number (number_value, id_user, id_tanda, is_dead_number, round_number, status)
         VALUES ($1, $2, $3, false, 1, 'PENDIENTE') RETURNING id_number`,
        [i + 1, idUser, idTanda],
      );
      numeros.push(numero[0].id_number);
      const { rows: pago } = await client.query<{ id_payment: number }>(
        `INSERT INTO payment (id_number, transfer_amount, cash_amount, total_amount,
                              confirmed_by_participant, confirmed_by_admin, status)
         VALUES ($1, 500, 0, 500, true, true, 'CONFIRMADO') RETURNING id_payment`,
        [numero[0].id_number],
      );
      pagos.push(pago[0].id_payment);
    }

    // Entrega del turno #1 pendiente de confirmar por quien la recibe
    const { rows: entrega } = await client.query<{ id_payout: number }>(
      `INSERT INTO payout (id_number, transfer_amount, cash_amount, total_amount,
                           confirmed_by_admin, confirmed_by_recipient, status)
       VALUES ($1, 1500, 0, 1500, true, false, 'PENDIENTE') RETURNING id_payout`,
      [numeros[0]],
    );
    const idPayout = entrega[0].id_payout;

    // 1) ABIERTA: Pablo reporta que no recibió completa la entrega
    await client.query(
      `INSERT INTO dispute (id_tanda, id_reporter, reason, status, id_payout)
       VALUES ($1, $2, 'No recibí el monto completo de la entrega', 'ABIERTA', $3)`,
      [idTanda, idPablo, idPayout],
    );

    // 2) EN_REVISION: Rosa dice que su pago fue rechazado sin motivo
    await client.query(
      `INSERT INTO dispute (id_tanda, id_reporter, reason, status, id_payment)
       VALUES ($1, $2, 'El organizador no registró mi pago en efectivo', 'EN_REVISION', $3)`,
      [idTanda, idRosa, pagos[2]],
    );

    // 3) RESUELTA: ya la atendió el Administrador Global y quedó en la bitácora
    const { rows: resuelta } = await client.query<{ id_dispute: number }>(
      `INSERT INTO dispute (id_tanda, id_reporter, id_resolver, reason, status,
                            resolution_notes, id_payment, resolved_at)
       VALUES ($1, $2, $3, 'Mi pago aparece como pendiente', 'RESUELTA',
               'Se verificó el comprobante y se mantiene el pago confirmado', $4, now())
       RETURNING id_dispute`,
      [idTanda, idPablo, idAdminGlobal, pagos[1]],
    );
    await client.query(
      `INSERT INTO audit_log (id_user, action_type, entity_type, entity_id, description)
       VALUES ($1, 'DISPUTA_RESUELTA', 'dispute', $2,
               'Disputa resuelta con acción "mantener": se verificó el comprobante')`,
      [idAdminGlobal, resuelta[0].id_dispute],
    );

    await client.query('COMMIT');
    return { creado: true, idTanda, disputas: 3 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDisputasPrueba()
    .then((r) => {
      console.log(
        r.creado
          ? `✓ Tanda demo ${r.idTanda} creada con ${r.disputas} disputas (ABIERTA, EN_REVISION, RESUELTA)`
          : `• La tanda demo ya existe (id ${r.idTanda}); no se creó nada`,
      );
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('❌', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
