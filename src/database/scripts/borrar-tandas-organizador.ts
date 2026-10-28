import 'dotenv/config';
import { Pool, PoolClient } from 'pg';

/**
 * Borra en cascada (hard delete) todas las tandas que organiza un usuario, buscado por correo.
 *
 * Orden: evidence → dispute → payment → payout → notification → number → tanda.
 * El usuario no se borra. audit_log no tiene FK a tanda y se deja intacto.
 *
 * Uso:
 *   npx tsx src/database/scripts/borrar-tandas-organizador.ts <correo>              (solo muestra qué borraría)
 *   npx tsx src/database/scripts/borrar-tandas-organizador.ts <correo> --confirmar  (borra)
 *   Contra Railway además se exige --permitir-railway.
 */
async function contar(client: PoolClient, sql: string, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await client.query<{ id: number }>(sql, [ids]);
  return rows.map((r) => r.id);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const correo = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();
  const confirmar = args.includes('--confirmar');
  const permitirRailway = args.includes('--permitir-railway');

  if (!correo) {
    throw new Error('Indica el correo del organizador como primer argumento.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está definida.');
  }

  const host = new URL(url).hostname;
  const esRailway = host.includes('rlwy.net') || host.includes('railway.internal');
  console.log(`[Database Host]: ${host}${esRailway ? ' (RAILWAY)' : ''}`);
  if (confirmar && esRailway && !permitirRailway) {
    throw new Error('La base es de Railway: agrega --permitir-railway para borrar en ella.');
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: usuarios } = await client.query<{ id_user: number }>(
      'SELECT id_user FROM "user" WHERE lower(email) = $1',
      [correo],
    );
    if (usuarios.length === 0) {
      throw new Error(`No existe un usuario con el correo ${correo}.`);
    }
    const idUser = usuarios[0].id_user;

    const { rows: tandas } = await client.query<{ id_tanda: number; name: string }>(
      'SELECT id_tanda, name FROM tanda WHERE id_admin = $1 ORDER BY id_tanda',
      [idUser],
    );
    const idsTanda = tandas.map((t) => t.id_tanda);
    const idsNumber = await contar(client, 'SELECT id_number AS id FROM number WHERE id_tanda = ANY($1)', idsTanda);
    const idsPayment = await contar(client, 'SELECT id_payment AS id FROM payment WHERE id_number = ANY($1)', idsNumber);
    const idsPayout = await contar(client, 'SELECT id_payout AS id FROM payout WHERE id_number = ANY($1)', idsNumber);

    console.log(`Organizador ${correo} (id_user ${idUser}): ${tandas.length} tandas`);
    for (const t of tandas) console.log(`  - #${t.id_tanda} ${t.name}`);
    console.log(
      `  números: ${idsNumber.length}, pagos: ${idsPayment.length}, entregas: ${idsPayout.length}`,
    );

    if (!confirmar) {
      await client.query('ROLLBACK');
      console.log('Simulación: no se borró nada. Agrega --confirmar para borrar.');
      return;
    }

    const borrar = async (tabla: string, where: string, params: unknown[]) => {
      const { rowCount } = await client.query(`DELETE FROM ${tabla} WHERE ${where}`, params);
      console.log(`  ✓ ${tabla}: ${rowCount ?? 0}`);
    };
    await borrar('evidence', 'id_payment = ANY($1) OR id_payout = ANY($2)', [idsPayment, idsPayout]);
    await borrar('dispute', 'id_tanda = ANY($1) OR id_payment = ANY($2) OR id_payout = ANY($3)', [
      idsTanda,
      idsPayment,
      idsPayout,
    ]);
    await borrar('payment', 'id_payment = ANY($1)', [idsPayment]);
    await borrar('payout', 'id_payout = ANY($1)', [idsPayout]);
    await borrar('notification', 'id_tanda = ANY($1)', [idsTanda]);
    await borrar('number', 'id_number = ANY($1)', [idsNumber]);
    await borrar('tanda', 'id_tanda = ANY($1)', [idsTanda]);

    await client.query('COMMIT');
    console.log('🗑️  Tandas borradas.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌', error instanceof Error ? error.message : error);
    process.exit(1);
  });
