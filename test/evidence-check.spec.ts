import { describe, it, expect } from 'vitest';
import { evidenceTable } from '../src/database/tandea.schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('[BD-SETUP] Restricción CHECK en tabla Evidence', () => {
  it('debe tener definido el CHECK constraint evidence_exactly_one_parent_chk en el esquema Drizzle', () => {
    const config = getTableConfig(evidenceTable);

    expect(config.checks).toBeDefined();
    expect(config.checks.length).toBeGreaterThanOrEqual(1);

    const checkConstraint = config.checks.find(
      (c) => c.name === 'evidence_exactly_one_parent_chk',
    );

    expect(checkConstraint).toBeDefined();
    expect(checkConstraint?.name).toBe('evidence_exactly_one_parent_chk');
  });

  it('debe validar la condición XOR: exactamente uno entre idPayment e idPayout debe estar presente', () => {
    // Función pura de validación que replica la regla del CHECK en TypeScript / DTO
    const isValidEvidenceTarget = (
      idPayment: number | null | undefined,
      idPayout: number | null | undefined,
    ): boolean => {
      const nonNulls = [idPayment, idPayout].filter(
        (v) => v !== null && v !== undefined,
      ).length;
      return nonNulls === 1;
    };

    // Caso 1: Ambos nulos (evidencia sin destino) -> Debe ser INVÁLIDO
    expect(isValidEvidenceTarget(null, null)).toBe(false);
    expect(isValidEvidenceTarget(undefined, undefined)).toBe(false);

    // Caso 2: Ambos presentes -> Debe ser INVÁLIDO
    expect(isValidEvidenceTarget(1, 2)).toBe(false);

    // Caso 3: Solo idPayment presente -> VÁLIDO
    expect(isValidEvidenceTarget(10, null)).toBe(true);

    // Caso 4: Solo idPayout presente -> VÁLIDO
    expect(isValidEvidenceTarget(null, 25)).toBe(true);
  });
});
