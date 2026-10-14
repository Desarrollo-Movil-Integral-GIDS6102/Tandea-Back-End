import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../common/tokens';

/**
 * DatabaseModule — Proveedor global de la conexión Drizzle + PostgreSQL.
 *
 * Conectividad y SSL en Railway:
 * - Red interna de Railway (ej. host postgres.railway.internal):
 *   No requiere SSL (DATABASE_SSL=false o no definido). La comunicación ocurre
 *   dentro de la red privada del clúster de Railway de forma segura.
 * - URL pública / Proxy de Railway (o servicios externos):
 *   Sí requiere SSL. Se activa configurando DATABASE_SSL=true en las variables
 *   de entorno, lo que aplica ssl: { rejectUnauthorized: false }.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_TOKEN,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error(
            'DATABASE_URL no está definida en las variables de entorno.',
          );
        }

        const isSslEnabled = process.env.DATABASE_SSL === 'true';

        const pool = new Pool({
          connectionString,
          ssl: isSslEnabled ? { rejectUnauthorized: false } : false,
        });

        return drizzle(pool);
      },
    },
  ],
  exports: [DATABASE_TOKEN],
})
export class DatabaseModule {}
