import { describe, expect, it } from 'vitest';
import {
  completarMeses,
  inicioDeLaGrafica,
  mesActual,
  ultimosMeses,
} from './serie-mensual';

describe('serie mensual de la gráfica (AP-11)', () => {
  it('lista 12 meses terminando en el mes dado, del más antiguo al más reciente', () => {
    const meses = ultimosMeses('2026-11');

    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe('2025-12');
    expect(meses[11]).toBe('2026-11');
  });

  it('cruza el cambio de año sin saltarse meses', () => {
    expect(ultimosMeses('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('el inicio de la gráfica es el día 1 del mes más antiguo', () => {
    expect(inicioDeLaGrafica('2026-11')).toBe('2025-12-01');
  });

  it('mesActual usa la fecha de la Ciudad de México, no la UTC', () => {
    // 1 de diciembre 02:00 UTC todavía es 30 de noviembre en CDMX (UTC-6)
    expect(mesActual(new Date('2026-12-01T02:00:00.000Z'))).toBe('2026-11');
    expect(mesActual(new Date('2026-12-01T12:00:00.000Z'))).toBe('2026-12');
  });

  it('rellena con ceros los meses sin pagos y conserva los que sí tienen', () => {
    const serie = completarMeses(
      [
        { mes: '2026-09', monto: 1500, pagos: 3 },
        { mes: '2026-11', monto: 500, pagos: 1 },
      ],
      '2026-11',
      4,
    );

    expect(serie).toEqual([
      { mes: '2026-08', monto: 0, pagos: 0 },
      { mes: '2026-09', monto: 1500, pagos: 3 },
      { mes: '2026-10', monto: 0, pagos: 0 },
      { mes: '2026-11', monto: 500, pagos: 1 },
    ]);
  });

  it('ignora filas de meses fuera de la ventana', () => {
    const serie = completarMeses([{ mes: '2020-01', monto: 99, pagos: 1 }], '2026-11', 2);

    expect(serie.map((s) => s.monto)).toEqual([0, 0]);
  });
});
