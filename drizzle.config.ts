import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/**/repositories/schema/*.schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
