import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { paymentTable, evidenceTable } from '../src/database/tandea.schema';

/**
 * [BD-PAGO] Verificación de Índices para el Panel de Seguimiento de Pagos.
 *
 * Valida que los índices requeridos estén definidos en la capa de persistencia
 * (Drizzle ORM) para optimizar las consultas de seguimiento de pagos por turno
 * y estado, así como la consulta de evidencias asociadas a cada pago.
 */
describe('[BD-PAGO] Índices de Seguimiento de Pagos', () => {
  it('la tabla payment debe incluir el índice compuesto (id_number, status)', () => {
    const config = getTableConfig(paymentTable);

    expect(config.indexes).toBeDefined();
    const compositeIdx = config.indexes.find(
      (idx) => idx.config.name === 'payment_id_number_status_idx',
    );

    expect(compositeIdx).toBeDefined();
    expect(compositeIdx?.config.name).toBe('payment_id_number_status_idx');

    // Comprobar que las columnas del índice son exactamente id_number y status en ese orden
    const columnNames = compositeIdx?.config.columns.map((c: any) => c.name);
    expect(columnNames).toEqual(['id_number', 'status']);
  });

  it('la tabla payment debe conservar el índice payment_id_number_idx', () => {
    const config = getTableConfig(paymentTable);
    const idNumberIdx = config.indexes.find(
      (idx) => idx.config.name === 'payment_id_number_idx',
    );

    expect(idNumberIdx).toBeDefined();
    const columnNames = idNumberIdx?.config.columns.map((c: any) => c.name);
    expect(columnNames).toEqual(['id_number']);
  });

  it('la tabla evidence debe contar con el índice evidence_id_payment_idx', () => {
    const config = getTableConfig(evidenceTable);

    expect(config.indexes).toBeDefined();
    const idPaymentIdx = config.indexes.find(
      (idx) => idx.config.name === 'evidence_id_payment_idx',
    );

    expect(idPaymentIdx).toBeDefined();
    const columnNames = idPaymentIdx?.config.columns.map((c: any) => c.name);
    expect(columnNames).toEqual(['id_payment']);
  });
});
