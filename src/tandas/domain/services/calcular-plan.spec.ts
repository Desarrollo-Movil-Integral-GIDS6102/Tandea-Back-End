import { describe, it, expect } from 'vitest';
import { calcularPlan } from './calcular-plan';
import { PlanTandaInvalidoError } from '../errors/tanda.errors';

describe('[QA-TANDA] Pruebas unitarias de cálculo de plan de tanda (AP-01)', () => {
  describe('Ejemplo de referencia del diseño y casos base', () => {
    it('debe calcular correctamente el caso de referencia: 10 participantes, cuota 1200, quincenal, 1 vuelta, sin número muerto', () => {
      const fechaInicio = new Date('2026-01-01T00:00:00');
      const resultado = calcularPlan({
        periodicidad: 'quincenal',
        montoCuota: 1200,
        numParticipantes: 10,
        numVueltas: 1,
        tieneNumeroMuerto: false,
        fechaInicio,
      });

      expect(resultado.totalNumeros).toBe(10);
      expect(resultado.totalPagos).toBe(10);
      expect(resultado.totalTurnos).toBe(10);
      expect(resultado.montoPorTurno).toBe(12000);
      expect(resultado.montoTotalPorParticipante).toBe(12000);

      // 10 turnos = fechaInicio + 9 quincenas (9 * 15 días = 135 días)
      const expectedFechaFin = new Date(fechaInicio.getTime());
      expectedFechaFin.setDate(expectedFechaFin.getDate() + 9 * 15);
      expect(resultado.fechaFin.getTime()).toBe(expectedFechaFin.getTime());
    });

    it('debe calcular correctamente con número muerto: 10 participantes + 1 -> totalNumeros 11', () => {
      const fechaInicio = new Date('2026-01-01T00:00:00');
      const resultado = calcularPlan({
        periodicidad: 'quincenal',
        montoCuota: 1200,
        numParticipantes: 10,
        numVueltas: 1,
        tieneNumeroMuerto: true,
        fechaInicio,
      });

      expect(resultado.totalNumeros).toBe(11);
      expect(resultado.totalPagos).toBe(11);
      expect(resultado.totalTurnos).toBe(11);
      expect(resultado.montoPorTurno).toBe(13200);
      expect(resultado.montoTotalPorParticipante).toBe(13200);
    });

    it('soporta invocación con argumentos posicionales', () => {
      const fechaInicio = new Date('2026-05-01T00:00:00');
      const resultado = calcularPlan('semanal', 500, 4, 1, false, fechaInicio);

      expect(resultado.totalNumeros).toBe(4);
      expect(resultado.totalPagos).toBe(4);
      expect(resultado.montoPorTurno).toBe(2000);
    });
  });

  describe('Todas las periodicidades (con y sin número muerto)', () => {
    const fechaInicio = new Date('2026-06-01T12:00:00');

    it('periodicidad diaria sin número muerto', () => {
      const res = calcularPlan('diaria', 100, 5, 1, false, fechaInicio);
      expect(res.totalNumeros).toBe(5);
      expect(res.totalTurnos).toBe(5);
      // 5 turnos - 1 = 4 días después
      const expectedDate = new Date(fechaInicio.getTime());
      expectedDate.setDate(expectedDate.getDate() + 4);
      expect(res.fechaFin.getTime()).toBe(expectedDate.getTime());
    });

    it('periodicidad diaria con número muerto', () => {
      const res = calcularPlan('diaria', 100, 5, 1, true, fechaInicio);
      expect(res.totalNumeros).toBe(6);
      expect(res.totalTurnos).toBe(6);
      const expectedDate = new Date(fechaInicio.getTime());
      expectedDate.setDate(expectedDate.getDate() + 5);
      expect(res.fechaFin.getTime()).toBe(expectedDate.getTime());
    });

    it('periodicidad semanal sin número muerto', () => {
      const res = calcularPlan('semanal', 200, 4, 1, false, fechaInicio);
      expect(res.totalNumeros).toBe(4);
      expect(res.totalTurnos).toBe(4);
      const expectedDate = new Date(fechaInicio.getTime());
      expectedDate.setDate(expectedDate.getDate() + 3 * 7);
      expect(res.fechaFin.getTime()).toBe(expectedDate.getTime());
    });

    it('periodicidad semanal con número muerto', () => {
      const res = calcularPlan('semanal', 200, 4, 1, true, fechaInicio);
      expect(res.totalNumeros).toBe(5);
      expect(res.totalTurnos).toBe(5);
      const expectedDate = new Date(fechaInicio.getTime());
      expectedDate.setDate(expectedDate.getDate() + 4 * 7);
      expect(res.fechaFin.getTime()).toBe(expectedDate.getTime());
    });

    it('periodicidad quincenal sin número muerto', () => {
      const res = calcularPlan('quincenal', 300, 4, 1, false, fechaInicio);
      expect(res.totalNumeros).toBe(4);
      expect(res.totalTurnos).toBe(4);
      const expectedDate = new Date(fechaInicio.getTime());
      expectedDate.setDate(expectedDate.getDate() + 3 * 15);
      expect(res.fechaFin.getTime()).toBe(expectedDate.getTime());
    });

    it('periodicidad quincenal con número muerto', () => {
      const res = calcularPlan('quincenal', 300, 4, 1, true, fechaInicio);
      expect(res.totalNumeros).toBe(5);
      expect(res.totalTurnos).toBe(5);
      const expectedDate = new Date(fechaInicio.getTime());
      expectedDate.setDate(expectedDate.getDate() + 4 * 15);
      expect(res.fechaFin.getTime()).toBe(expectedDate.getTime());
    });

    it('periodicidad mensual sin número muerto', () => {
      const res = calcularPlan('mensual', 1000, 4, 1, false, new Date('2026-03-10T00:00:00'));
      expect(res.totalNumeros).toBe(4);
      expect(res.totalTurnos).toBe(4);
      // 3 meses después de marzo es junio
      expect(res.fechaFin.getFullYear()).toBe(2026);
      expect(res.fechaFin.getMonth()).toBe(5); // Junio (0-indexed)
      expect(res.fechaFin.getDate()).toBe(10);
    });

    it('periodicidad mensual con número muerto', () => {
      const res = calcularPlan('mensual', 1000, 4, 1, true, new Date('2026-03-10T00:00:00'));
      expect(res.totalNumeros).toBe(5);
      expect(res.totalTurnos).toBe(5);
      // 4 meses después de marzo es julio
      expect(res.fechaFin.getFullYear()).toBe(2026);
      expect(res.fechaFin.getMonth()).toBe(6); // Julio (0-indexed)
      expect(res.fechaFin.getDate()).toBe(10);
    });
  });

  describe('Vueltas: 1 vuelta vs varias vueltas', () => {
    it('calcula correctamente con 1 vuelta', () => {
      const res = calcularPlan('semanal', 500, 5, 1, false, new Date('2026-01-01'));
      expect(res.totalPagos).toBe(5);
      expect(res.totalTurnos).toBe(5);
      expect(res.montoPorTurno).toBe(2500);
      expect(res.montoTotalPorParticipante).toBe(2500);
    });

    it('calcula correctamente con 3 vueltas', () => {
      const res = calcularPlan('semanal', 500, 5, 3, false, new Date('2026-01-01'));
      expect(res.totalNumeros).toBe(5);
      expect(res.totalPagos).toBe(15);
      expect(res.totalTurnos).toBe(15);
      expect(res.montoPorTurno).toBe(2500);
      expect(res.montoTotalPorParticipante).toBe(7500);
    });

    it('calcula con varias vueltas y número muerto', () => {
      const res = calcularPlan('quincenal', 1000, 4, 2, true, new Date('2026-01-01'));
      // 4 participantes + 1 muerto = 5 números
      expect(res.totalNumeros).toBe(5);
      // 5 números * 2 vueltas = 10 pagos y 10 turnos
      expect(res.totalPagos).toBe(10);
      expect(res.totalTurnos).toBe(10);
      expect(res.montoPorTurno).toBe(5000);
      expect(res.montoTotalPorParticipante).toBe(10000);
    });
  });

  describe('Límites y validación de participantes', () => {
    const fecha = new Date('2026-01-01');

    it('permite 2 participantes (mínimo válido)', () => {
      const res = calcularPlan('diaria', 100, 2, 1, false, fecha);
      expect(res.totalNumeros).toBe(2);
    });

    it('lanza PlanTandaInvalidoError con 1 participante', () => {
      expect(() => calcularPlan('diaria', 100, 1, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
    });

    it('lanza PlanTandaInvalidoError con 0 o participantes negativos', () => {
      expect(() => calcularPlan('diaria', 100, 0, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
      expect(() => calcularPlan('diaria', 100, -3, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
    });

    it('lanza PlanTandaInvalidoError con participantes decimales o NaN', () => {
      expect(() => calcularPlan('diaria', 100, 3.5, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
      expect(() => calcularPlan('diaria', 100, NaN, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
    });

    it('lanza PlanTandaInvalidoError con vueltas menores a 1 o decimales', () => {
      expect(() => calcularPlan('diaria', 100, 3, 0, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
      expect(() => calcularPlan('diaria', 100, 3, 1.5, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
    });
  });

  describe('Cuota y precisión de punto flotante', () => {
    const fecha = new Date('2026-01-01');

    it('lanza PlanTandaInvalidoError si cuota es 0 o negativa', () => {
      expect(() => calcularPlan('diaria', 0, 5, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
      expect(() => calcularPlan('diaria', -50, 5, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
    });

    it('lanza PlanTandaInvalidoError si cuota es NaN o no finita', () => {
      expect(() => calcularPlan('diaria', NaN, 5, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
      expect(() => calcularPlan('diaria', Infinity, 5, 1, false, fecha)).toThrow(
        PlanTandaInvalidoError,
      );
    });

    it('opera con cuotas decimales (0.1 y 0.2) sin errores de coma flotante de IEEE 754', () => {
      // 0.1 * 3 en JS nativo da 0.30000000000000004
      const res1 = calcularPlan('diaria', 0.1, 3, 1, false, fecha);
      expect(res1.montoPorTurno).toBe(0.3);
      expect(res1.montoTotalPorParticipante).toBe(0.3);

      const res2 = calcularPlan('diaria', 0.2, 3, 1, false, fecha);
      expect(res2.montoPorTurno).toBe(0.6);
      expect(res2.montoTotalPorParticipante).toBe(0.6);

      const res3 = calcularPlan('semanal', 100.55, 4, 2, false, fecha);
      expect(res3.montoPorTurno).toBe(402.2);
      expect(res3.montoTotalPorParticipante).toBe(804.4);
    });
  });

  describe('Cálculos de fechas especiales', () => {
    it('maneja fin de mes ajustando al último día: 31 de enero + 1 mes = 28 de febrero en año no bisiesto', () => {
      const fecha31Ene = new Date('2026-01-31T00:00:00');
      // 2 turnos con periodicidad mensual -> fechaFin = fechaInicio + 1 mes
      const res = calcularPlan('mensual', 500, 2, 1, false, fecha31Ene);

      expect(res.fechaFin.getFullYear()).toBe(2026);
      expect(res.fechaFin.getMonth()).toBe(1); // Febrero (0-indexed)
      expect(res.fechaFin.getDate()).toBe(28); // 2026 no es bisiesto, feb tiene 28 días
    });

    it('maneja año bisiesto correctamente: 31 de enero 2024 + 1 mes = 29 de febrero', () => {
      const fecha31EneBisiesto = new Date('2024-01-31T00:00:00');
      const res = calcularPlan('mensual', 500, 2, 1, false, fecha31EneBisiesto);

      expect(res.fechaFin.getFullYear()).toBe(2024);
      expect(res.fechaFin.getMonth()).toBe(1); // Febrero (0-indexed)
      expect(res.fechaFin.getDate()).toBe(29); // 2024 sí es bisiesto
    });

    it('maneja fin de mes de 31 a mes de 30 días: 31 de agosto + 1 mes = 30 de septiembre', () => {
      const fecha31Ago = new Date('2026-08-31T00:00:00');
      const res = calcularPlan('mensual', 500, 2, 1, false, fecha31Ago);

      expect(res.fechaFin.getFullYear()).toBe(2026);
      expect(res.fechaFin.getMonth()).toBe(8); // Septiembre (0-indexed)
      expect(res.fechaFin.getDate()).toBe(30);
    });

    it('maneja cambio de año correctamente', () => {
      const fechaNov = new Date('2026-11-15T00:00:00');
      // 3 turnos mensuales -> 2 meses -> Enero 2027
      const res = calcularPlan('mensual', 500, 3, 1, false, fechaNov);

      expect(res.fechaFin.getFullYear()).toBe(2027);
      expect(res.fechaFin.getMonth()).toBe(0); // Enero
      expect(res.fechaFin.getDate()).toBe(15);
    });

    it('lanza PlanTandaInvalidoError con fecha inválida', () => {
      expect(() =>
        calcularPlan('mensual', 500, 3, 1, false, new Date('fecha-invalida')),
      ).toThrow(PlanTandaInvalidoError);
    });

    it('lanza PlanTandaInvalidoError con periodicidad desconocida', () => {
      expect(() =>
        calcularPlan('bimestral' as any, 500, 3, 1, false, new Date('2026-01-01')),
      ).toThrow(PlanTandaInvalidoError);
    });
  });

  describe('Inmutabilidad del resultado', () => {
    it('el objeto retornado es inmutable (congelado con Object.freeze)', () => {
      const res = calcularPlan('diaria', 100, 3, 1, false, new Date('2026-01-01'));

      expect(Object.isFrozen(res)).toBe(true);
      expect(() => {
        (res as any).montoPorTurno = 99999;
      }).toThrow();
    });
  });
});
