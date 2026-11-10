import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { paymentTable, paymentStatusEnum } from '../src/database/tandea.schema';
import { validateLocalDatabaseUrl } from '../src/database/seeds/tanda-type.seed';

/**
 * [SP-3 BD-PAGO] Validación de valor 'VENCIDO' en enum payment_status.
 */
describe('[SP-3 BD-PAGO] Verificación estática del Schema Drizzle', () => {
  it('el enum paymentStatusEnum debe incluir los 4 valores de estado: PENDIENTE, CONFIRMADO, RECHAZADO, VENCIDO', () => {
    expect(paymentStatusEnum.enumValues).toEqual([
      'PENDIENTE',
      'CONFIRMADO',
      'RECHAZADO',
      'VENCIDO',
    ]);
  });

  it('la tabla payment debe definir la columna status con default PENDIENTE', () => {
    const config = getTableConfig(paymentTable);
    const statusCol = config.columns.find((col) => col.name === 'status');

    expect(statusCol).toBeDefined();
    expect(statusCol?.notNull).toBe(true);
    expect(statusCol?.hasDefault).toBe(true);
  });
});

const testDbUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDbUrl)('[SP-3 BD-PAGO] Integración BD Local: payment_status incluye VENCIDO', () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!testDbUrl) return;

    validateLocalDatabaseUrl(testDbUrl);
    pool = new Pool({ connectionString: testDbUrl });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('el tipo enum payment_status en PostgreSQL incluye VENCIDO según enum_range', async () => {
    const res = await pool.query<{ val: string }>(
      `SELECT unnest(enum_range(NULL::payment_status))::text AS val;`,
    );

    const values = res.rows.map((r) => r.val);
    expect(values).toContain('PENDIENTE');
    expect(values).toContain('CONFIRMADO');
    expect(values).toContain('RECHAZADO');
    expect(values).toContain('VENCIDO');
  });

  it('permite castear un string a payment_status con valor VENCIDO sin error', async () => {
    const res = await pool.query<{ casted: string }>(
      `SELECT 'VENCIDO'::payment_status AS casted;`,
    );

    expect(res.rows[0].casted).toBe('VENCIDO');
  });
});
