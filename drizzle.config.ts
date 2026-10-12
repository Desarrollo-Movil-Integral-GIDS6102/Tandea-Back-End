import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno.');
}

const isSslEnabled = process.env.DATABASE_SSL === 'true';

export default defineConfig({
  schema: 'src/database/tandea.schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
    ssl: isSslEnabled ? { rejectUnauthorized: false } : false,
  },
  verbose: true,
  strict: true,
});
