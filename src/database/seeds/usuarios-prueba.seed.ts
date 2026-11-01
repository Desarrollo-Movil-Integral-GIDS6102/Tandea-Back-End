import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

/**
 * Crea 5 usuarios de prueba en la base local. Se puede correr varias veces:
 * los correos que ya existen se dejan intactos.
 *
 * Uso: npx tsx src/database/seeds/usuarios-prueba.seed.ts
 */
const PASSWORD_PRUEBA = 'Tandea-Pruebas-2026';

const USUARIOS = [
  { name: 'Ana', lastName: 'Prueba', email: 'ana@tandea.test' },
  { name: 'Beto', lastName: 'Prueba', email: 'beto@tandea.test' },
  { name: 'Carla', lastName: 'Prueba', email: 'carla@tandea.test' },
  { name: 'Diego', lastName: 'Prueba', email: 'diego@tandea.test' },
  { name: 'Elena', lastName: 'Prueba', email: 'elena@tandea.test' },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está definida.');
  }

  const host = new URL(url).hostname;
  console.log(`[Database Host]: ${host}`);
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error('Los usuarios de prueba solo se crean en la base local.');
  }

  const pool = new Pool({ connectionString: url });
  try {
    const { rows: roles } = await pool.query<{ id_role: number }>(
      `SELECT id_role FROM role WHERE name_role = 'usuario' LIMIT 1`,
    );
    const idRole =
      roles[0]?.id_role ??
      (
        await pool.query<{ id_role: number }>(
          `INSERT INTO role (name_role) VALUES ('usuario') RETURNING id_role`,
        )
      ).rows[0].id_role;

    const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 10);
    for (const u of USUARIOS) {
      const { rowCount } = await pool.query(
        `INSERT INTO "user" (name, last_name, email, password_hash, id_role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.lastName, u.email, passwordHash, idRole],
      );
      console.log(`${rowCount ? '  ✓ creado' : '  - ya existía'}: ${u.email}`);
    }
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('❌', error instanceof Error ? error.message : error);
    process.exit(1);
  });
