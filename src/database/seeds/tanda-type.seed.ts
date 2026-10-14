import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { tandaTypeTable } from '../tandea.schema';

/**
 * Valida que la URL de base de datos no pertenezca a Railway para evitar escrituras accidentales.
 */
export function validateLocalDatabaseUrl(url: string): string {
  let host = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
  } catch {
    const match = url.match(/@([^:/]+)/);
    host = match ? match[1] : url;
  }

  console.log(`[Database Host]: ${host}`);

  if (host.includes('rlwy.net') || host.includes('railway.internal')) {
    console.error('⛔ ABORTADO: Está PROHIBIDO ejecutar seeds o pruebas contra la base de Railway.');
    throw new Error('Operación abortada por regla de seguridad: No se permite ejecutar contra Railway.');
  }

  return host;
}

export const TANDA_TYPES_SEED = [
  {
    name: 'familiar',
    description: 'Tanda para miembros de la familia con aportaciones flexibles y ahorro colaborativo.',
  },
  {
    name: 'laboral',
    description: 'Tanda para compañeros de trabajo organizada en torno a ciclos de pago de nómina.',
  },
  {
    name: 'amigos',
    description: 'Tanda para grupos de amistades orientada a metas recreativas o proyectos compartidos.',
  },
];

/**
 * Seed idempotente para tanda_type.
 * Consulta antes de insertar dentro de una transacción ya que name no tiene restricción única a nivel de schema.
 */
export async function seedTandaTypes(databaseUrl?: string): Promise<void> {
  const url = databaseUrl || process.env.DATABASE_URL;

  if (!url) {
    console.error('❌ Error: DATABASE_URL no está definida.');
    throw new Error('DATABASE_URL no está definida');
  }

  validateLocalDatabaseUrl(url);

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log('🌱 Iniciando seed de tanda_type...');

  try {
    await db.transaction(async (tx) => {
      for (const item of TANDA_TYPES_SEED) {
        const [existing] = await tx
          .select()
          .from(tandaTypeTable)
          .where(eq(tandaTypeTable.name, item.name))
          .limit(1);

        if (!existing) {
          await tx.insert(tandaTypeTable).values(item);
          console.log(`  ✓ Tipo de tanda creado: ${item.name}`);
        } else {
          console.log(`  • Tipo de tanda ya existente: ${item.name}`);
        }
      }
    });

    console.log('🎉 Seed de tanda_type completado exitosamente.');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed de tanda_type:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar directamente si se llama desde la terminal/CLI
if (require.main === module) {
  seedTandaTypes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
