import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../common/tokens';

/**
 * DatabaseModule — Proveedor global de la conexión Drizzle + PostgreSQL.
 *
 * @Global() permite que cualquier módulo lo inyecte sin importarlo explícitamente.
 * Se recomienda mover DATABASE_TOKEN a un archivo common/tokens.ts cuando haya más módulos.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
        });

        return drizzle(pool);
      },
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
