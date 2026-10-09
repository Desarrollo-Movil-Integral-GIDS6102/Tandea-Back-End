import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { roleTable, userTable, platformConfigTable } from './tandea.schema';

/**
 * Seed script para Tandea (Drizzle ORM + PostgreSQL)
 *
 * Tarea: [BD-SETUP] Agregar CHECK de evidence y seed de roles y Administrador Global
 *
 * Acciones:
 *  1. Inserta los roles 'usuario' y 'admin_global' si no existen.
 *  2. Inserta el Administrador Global con contraseña hasheada (bcrypt, 10 rounds)
 *     obtenida de la variable de entorno ADMIN_PASSWORD (o valor seguro por defecto).
 *  3. Inserta una fila inicial en platform_config referenciando al Administrador Global.
 */
export async function runSeed(databaseUrl?: string) {
  const url = databaseUrl || process.env.DATABASE_URL;

  if (!url) {
    console.error('❌ Error: DATABASE_URL no está definida.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log('🌱 Iniciando seed de la base de datos Tandea...');

  try {
    // 1. Roles por defecto
    const rolesToSeed = [
      {
        nameRole: 'usuario',
        description: 'Usuario participante y organizador de tandas',
        active: true,
      },
      {
        nameRole: 'admin_global',
        description: 'Administrador global de la plataforma Tandea',
        active: true,
      },
    ];

    for (const r of rolesToSeed) {
      const existing = await db
        .select()
        .from(roleTable)
        .where(eq(roleTable.nameRole, r.nameRole))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(roleTable).values(r);
        console.log(`  ✓ Rol creado: ${r.nameRole}`);
      } else {
        console.log(`  • Rol ya existe: ${r.nameRole}`);
      }
    }

    // Obtener id_role para admin_global
    const [adminRole] = await db
      .select()
      .from(roleTable)
      .where(eq(roleTable.nameRole, 'admin_global'))
      .limit(1);

    if (!adminRole) {
      throw new Error('No se pudo encontrar el rol admin_global.');
    }

    // 2. Administrador Global
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@tandea.com';
    const rawPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!*';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const existingAdmin = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, adminEmail))
      .limit(1);

    let adminUserId: number;

    if (existingAdmin.length === 0) {
      const [insertedAdmin] = await db
        .insert(userTable)
        .values({
          name: 'Administrador',
          lastName: 'Global',
          email: adminEmail,
          passwordHash,
          idRole: adminRole.idRole,
          active: true,
        })
        .returning({ idUser: userTable.idUser });

      adminUserId = insertedAdmin.idUser;
      console.log(`  ✓ Administrador Global creado con email: ${adminEmail}`);
    } else {
      adminUserId = existingAdmin[0].idUser;
      console.log(`  • Administrador Global ya existe (${adminEmail})`);
    }

    // 3. Fila inicial en platform_config
    const existingConfig = await db.select().from(platformConfigTable).limit(1);

    if (existingConfig.length === 0) {
      await db.insert(platformConfigTable).values({
        maxUsersPerTanda: Number(process.env.MAX_USERS_PER_TANDA ?? 20),
        maxActiveTandasPerUser: Number(
          process.env.MAX_ACTIVE_TANDAS_PER_USER ?? 5,
        ),
        maxGraceDays: Number(process.env.MAX_GRACE_DAYS ?? 3),
        idUpdatedBy: adminUserId,
      });
      console.log('  ✓ Configuración de plataforma inicial creada.');
    } else {
      console.log('  • Configuración de plataforma ya existe.');
    }

    console.log('🎉 Seed completado exitosamente.');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar automáticamente si se corre como script directo
if (require.main === module) {
  runSeed().catch(() => process.exit(1));
}
