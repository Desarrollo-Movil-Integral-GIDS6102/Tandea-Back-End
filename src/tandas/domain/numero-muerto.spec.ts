import { describe, expect, it } from 'vitest';
import { NumeroTanda, type NumeroDeLaVuelta } from './entities/numero-tanda.entity';
import { NumeroMuertoCobroBloqueadoError } from './errors/numero.errors';
import {
  planificarTurno,
  turnoVencido,
  type NumeroParaCobertura,
  type TandaParaCobertura,
} from './services/evaluar-turno';

/**
 * [SP-4 QA-AJUSTE] Lógica del número muerto (AP-10):
 *   sin número muerto → en_riesgo; con número muerto → cubre;
 *   cobro antes de terminar la vuelta → excepción; después → permitido.
 */

// ── Cobro del número muerto ─────────────────────────────────────────────────────────────
const muerto = () =>
  new NumeroTanda({ idTanda: 1, roundNumber: 1, numberValue: 0, idUser: null, isDeadNumber: true });
const real = (n: number) =>
  new NumeroTanda({ idTanda: 1, roundNumber: 1, numberValue: n, idUser: 10 + n, isDeadNumber: false });
const deLaVuelta = (...estados: Array<NumeroDeLaVuelta['status']>): NumeroDeLaVuelta[] => [
  { roundNumber: 1, isDeadNumber: true, status: 'PENDIENTE' },
  ...estados.map((status) => ({ roundNumber: 1, isDeadNumber: false, status })),
];

describe('NumeroTanda.puedeCobrarse — cobro del número muerto', () => {
  it('antes de terminar la vuelta lanza NumeroMuertoCobroBloqueadoError', () => {
    const numeros = deLaVuelta('ENTREGADO', 'PENDIENTE', 'PENDIENTE');

    expect(muerto().puedeCobrarse(numeros)).toBe(false);
    expect(() => muerto().asegurarCobro(numeros)).toThrow(NumeroMuertoCobroBloqueadoError);
    expect(() => muerto().asegurarCobro(numeros)).toThrow('faltan 2 turnos por entregar');
  });

  it('un solo turno pendiente se dice en singular', () => {
    expect(() => muerto().asegurarCobro(deLaVuelta('ENTREGADO', 'EN_RIESGO'))).toThrow(
      'faltan 1 turno por entregar',
    );
  });

  it('un turno con la entrega pendiente de confirmar todavía cuenta como no entregado', () => {
    const numeros = deLaVuelta('ENTREGADO', 'ENTREGA_PENDIENTE_CONFIRMACION');

    expect(muerto().puedeCobrarse(numeros)).toBe(false);
  });

  it('cuando todos los números reales de la vuelta están ENTREGADO, se permite', () => {
    const numeros = deLaVuelta('ENTREGADO', 'ENTREGADO', 'ENTREGADO');

    expect(muerto().puedeCobrarse(numeros)).toBe(true);
    expect(() => muerto().asegurarCobro(numeros)).not.toThrow();
  });

  it('solo mira los números de su misma vuelta', () => {
    const numeros: NumeroDeLaVuelta[] = [
      { roundNumber: 1, isDeadNumber: false, status: 'ENTREGADO' },
      { roundNumber: 2, isDeadNumber: false, status: 'PENDIENTE' },
    ];

    expect(muerto().puedeCobrarse(numeros)).toBe(true);
  });

  it('sin números reales en la vuelta no se puede cobrar (la tanda aún no existe)', () => {
    expect(muerto().puedeCobrarse([])).toBe(false);
  });

  it('un número real siempre puede cobrarse en su turno', () => {
    expect(real(1).puedeCobrarse(deLaVuelta('PENDIENTE'))).toBe(true);
  });
});

// ── Cobertura y riesgo ──────────────────────────────────────────────────────────────────
const num = (
  numero: number,
  tienePagoActivo: boolean,
  status: NumeroParaCobertura['status'] = 'PENDIENTE',
): NumeroParaCobertura => ({ idNumber: 100 + numero, numero, idUser: 10 + numero, status, tienePagoActivo });

/** Quincenal desde el 2026-11-01: turno 1 cobra el 11-01, turno 2 el 11-16, turno 3 el 12-01. */
const tandaBase = (cambios: Partial<TandaParaCobertura> = {}): TandaParaCobertura => ({
  idTanda: 1,
  nombre: 'Tanda de la oficina',
  idAdmin: 99,
  startDate: '2026-11-01',
  periodicidad: 'quincenal',
  montoCuota: 100,
  numParticipantes: 3,
  numVueltas: 1,
  tieneNumeroMuerto: false,
  diasGracia: 2,
  idNumeroMuerto: null,
  numeros: [num(1, true), num(2, false), num(3, true)],
  ...cambios,
});

describe('turnoVencido', () => {
  it('es el último turno cuya fecha límite (cobro + gracia) ya pasó', () => {
    // El turno 1 vence el 11-03; el turno 2, el 11-18
    expect(turnoVencido(tandaBase(), '2026-11-03')).toBeNull();
    expect(turnoVencido(tandaBase(), '2026-11-04')?.turno).toBe(1);
    expect(turnoVencido(tandaBase(), '2026-11-18')?.turno).toBe(1);
    expect(turnoVencido(tandaBase(), '2026-11-19')?.turno).toBe(2);
  });
});

describe('planificarTurno', () => {
  it('sin número muerto y con pagos faltantes: el turno del beneficiario queda en riesgo', () => {
    const plan = planificarTurno(tandaBase({ numeros: [num(1, true), num(2, false), num(3, false)] }), '2026-11-04');

    expect(plan.decision).toBe('EN_RIESGO');
    expect(plan.beneficiario?.numero).toBe(1);
    expect(plan.faltantes.map((f) => f.numero)).toEqual([2, 3]);
  });

  it('con número muerto y pagos faltantes: el número muerto cubre', () => {
    const plan = planificarTurno(
      tandaBase({ tieneNumeroMuerto: true, idNumeroMuerto: 500, startDate: '2026-11-01' }),
      '2026-11-19',
    );

    expect(plan.decision).toBe('CUBRIR_CON_NUMERO_MUERTO');
    expect(plan.faltantes.map((f) => f.numero)).toEqual([2]);
  });

  it('con número muerto, el primer turno del calendario es el #0 y no tiene beneficiario', () => {
    // El turno 1 (11-01) es el #0; vence el 11-03 y no hay nadie a quien proteger todavía
    const plan = planificarTurno(tandaBase({ tieneNumeroMuerto: true, idNumeroMuerto: 500 }), '2026-11-04');

    expect(plan.turno).toBeNull();
    expect(plan.decision).toBeNull();
  });

  it('si la tanda dice tener número muerto pero no existe la fila, el turno queda en riesgo', () => {
    const plan = planificarTurno(
      tandaBase({ tieneNumeroMuerto: true, idNumeroMuerto: null }),
      '2026-11-19',
    );

    expect(plan.decision).toBe('EN_RIESGO');
  });

  it('sin pagos faltantes no hay nada que hacer', () => {
    const plan = planificarTurno(tandaBase({ numeros: [num(1, true), num(2, true), num(3, true)] }), '2026-11-04');

    expect(plan.decision).toBe('SIN_FALTANTES');
    expect(plan.faltantes).toEqual([]);
  });

  it('antes de que termine la gracia no se decide nada', () => {
    const plan = planificarTurno(tandaBase(), '2026-11-03');

    expect(plan.turno).toBeNull();
    expect(plan.decision).toBeNull();
  });

  it('si el beneficiario ya cobró no hay nada en riesgo', () => {
    const numeros = [num(1, true, 'ENTREGADO'), num(2, false), num(3, true)];

    expect(planificarTurno(tandaBase({ numeros }), '2026-11-04').decision).toBeNull();
  });

  it('al regularizarse los pagos, los números en riesgo vuelven a pendiente', () => {
    const numeros = [num(1, true, 'EN_RIESGO'), num(2, true), num(3, true)];

    const plan = planificarTurno(tandaBase({ numeros }), '2026-11-04');

    expect(plan.aRegularizar.map((n) => n.numero)).toEqual([1]);
  });

  it('con pagos todavía faltantes no se regulariza nada', () => {
    const numeros = [num(1, true, 'EN_RIESGO'), num(2, false), num(3, true)];

    expect(planificarTurno(tandaBase({ numeros }), '2026-11-04').aRegularizar).toEqual([]);
  });
});
