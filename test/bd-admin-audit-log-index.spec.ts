import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { auditLogTable } from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';

/**
 * [SP-4 BD-ADMIN] Índice (entity_type, entity_id) en audit_log para buscar la bitácora de
 * una disputa, un usuario o una tanda sin recorrer toda la tabla.
 */
describe('[SP-4 BD-ADMIN] Verificación estática del Schema Drizzle', () => {
  it('audit_log define el índice compuesto (entity_type, entity_id) en ese orden', () => {
    const indice = getTableConfig(auditLogTable).indexes.find(
      (idx) => idx.config.name === 'audit_log_entity_idx',
    );

    expect(indice).toBeDefined();
    expect(indice?.config.columns.map((c: any) => c.name)).toEqual(['entity_type', 'entity_id']);
  });

  it('audit_log sigue siendo inmutable: sin deleted_at ni updated_at', () => {
    const columnas = getTableConfig(auditLogTable).columns.map((c) => c.name);

    expect(columnas).not.toContain('deleted_at');
    expect(columnas).not.toContain('updated_at');
  });
});

const testDbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)('[SP-4 BD-ADMIN] Integración BD local: índice de audit_log', () => {
  let pool: Pool;

  beforeAll(() => {
    validateLocalDatabaseUrl(testDbUrl!);
    pool = new Pool({ connectionString: testDbUrl });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('existe audit_log_entity_idx sobre (entity_type, entity_id) en PostgreSQL', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'audit_log' AND indexname = 'audit_log_entity_idx'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/\(entity_type, entity_id\)/);
  });
});
