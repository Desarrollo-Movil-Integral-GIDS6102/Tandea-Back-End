import { describe, it, expect } from 'vitest';
import { generarCalendario, fechaInicioPagos, type GenerarCalendarioInput } from './generar-calendario';
import { calcularPlan } from './calcular-plan';
import { PlanTandaInvalidoError } from '../errors/tanda.errors';

const base = (overrides: Partial<GenerarCalendarioInput> = {}): GenerarCalendarioInput => ({
  startDate: '2026-11-01',
  periodicidad: 'semanal',
  montoCuota: 500,
  numParticipantes: 3,
  numVueltas: 1,
  tieneNumeroMuerto: false,
  numeros: [
    { numberValue: 1, idUser: 10, nombre: 'Ana López' },
    { numberValue: 2, idUser: 11, nombre: 'Luis Pérez' },
    { numberValue: 3, idUser: 12, nombre: 'Eva Ruiz' },
  ],
  ...overrides,
});

describe('[BE-CAL] generarCalendario (AP-06)', () => {
  describe('sin número muerto', () => {
    it('ordena los turnos por número y suma un periodo por turno', () => {
      const calendario = generarCalendario(base());

      expect(calendario.map((t) => t.numero)).toEqual([1, 2, 3]);
      expect(calendario.map((t) => t.fechaCobro)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15']);
      expect(calendario.map((t) => t.turno)).toEqual([1, 2, 3]);
    });

    it('asigna el usuario de cada número y espera la cuota de todos los participantes', () => {
      const [primero] = generarCalendario(base());

      expect(primero.usuario).toEqual({ idUser: 10, nombre: 'Ana López' });
      expect(primero.esNumeroMuerto).toBe(false);
      expect(primero.montoAEsperar).toBe(1500);
    });

    it('deja el usuario en null si el número sigue libre', () => {
      const calendario = generarCalendario(base({ numeros: [{ numberValue: 2, idUser: 11, nombre: null }] }));

      expect(calendario[0].usuario).toBeNull();
      expect(calendario[1].usuario).toEqual({ idUser: 11, nombre: null });
    });
  });

  describe('con número muerto', () => {
    it('el primer turno es el #0 y también genera pagos', () => {
      const calendario = generarCalendario(base({ tieneNumeroMuerto: true }));

      expect(calendario.map((t) => t.numero)).toEqual([0, 1, 2, 3]);
      expect(calendario[0]).toMatchObject({
        esNumeroMuerto: true,
        usuario: null,
        fechaCobro: '2026-11-01',
        montoAEsperar: 1500,
      });
      expect(calendario[1]).toMatchObject({ numero: 1, fechaCobro: '2026-11-08', montoAEsperar: 1500 });
    });

    it('los pagos inician desde la fecha de inicio, también con turno #0', () => {
      expect(fechaInicioPagos('2026-11-01', 'semanal', true)).toBe('2026-11-01');
      expect(fechaInicioPagos('2026-11-01', 'semanal', false)).toBe('2026-11-01');
    });
  });

  describe('varias vueltas', () => {
    it('repite el orden en cada vuelta sin reiniciar las fechas', () => {
      const calendario = generarCalendario(base({ numVueltas: 2, tieneNumeroMuerto: true }));

      expect(calendario).toHaveLength(8);
      expect(calendario.map((t) => `${t.vuelta}-${t.numero}`)).toEqual([
        '1-0', '1-1', '1-2', '1-3', '2-0', '2-1', '2-2', '2-3',
      ]);
      expect(calendario[4].fechaCobro).toBe('2026-11-29');
      expect(calendario[7].turno).toBe(8);
    });

    it('el último turno coincide con la fechaFin de calcularPlan', () => {
      const input = base({ periodicidad: 'mensual', startDate: '2026-01-31', numVueltas: 2, tieneNumeroMuerto: true });
      const calendario = generarCalendario(input);
      const { fechaFin } = calcularPlan({
        periodicidad: 'mensual',
        montoCuota: input.montoCuota,
        numParticipantes: input.numParticipantes,
        numVueltas: input.numVueltas,
        tieneNumeroMuerto: true,
        fechaInicio: new Date(`${input.startDate}T12:00:00.000Z`),
      });

      expect(calendario[calendario.length - 1].fechaCobro).toBe(fechaFin.toISOString().slice(0, 10));
    });
  });

  describe('periodicidades', () => {
    it.each([
      ['diaria', '2026-11-02'],
      ['quincenal', '2026-11-16'],
      ['mensual', '2026-12-01'],
    ] as const)('%s: el segundo turno cae en %s', (periodicidad, fecha) => {
      expect(generarCalendario(base({ periodicidad }))[1].fechaCobro).toBe(fecha);
    });

    it('mensual ajusta al último día del mes (31 ene → 28 feb)', () => {
      const calendario = generarCalendario(base({ periodicidad: 'mensual', startDate: '2026-01-31' }));

      expect(calendario[1].fechaCobro).toBe('2026-02-28');
    });
  });

  it('calcula el monto en centavos sin errores de punto flotante', () => {
    const [turno] = generarCalendario(base({ montoCuota: 0.1 }));

    expect(turno.montoAEsperar).toBe(0.3);
  });

  it('lanza PlanTandaInvalidoError con una fecha de inicio inválida', () => {
    expect(() => generarCalendario(base({ startDate: '01/11/2026' }))).toThrow(PlanTandaInvalidoError);
  });
});
