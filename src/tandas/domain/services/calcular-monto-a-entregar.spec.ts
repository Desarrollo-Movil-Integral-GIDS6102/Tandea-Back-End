import { describe, expect, it } from 'vitest';
import { calcularMontoAEntregar } from './calcular-monto-a-entregar';

describe('calcularMontoAEntregar (AP-10)', () => {
  it('sin cuotas pendientes se entrega el total del turno', () => {
    expect(calcularMontoAEntregar({ montoCuota: 500, numParticipantes: 4, cuotasNoConfirmadas: 0 })).toEqual({
      totalTurno: 2000,
      descuento: 0,
      montoAEntregar: 2000,
      cuotasNoConfirmadas: 0,
    });
  });

  it('descuenta una cuota por cada pago no confirmado', () => {
    const r = calcularMontoAEntregar({ montoCuota: 500, numParticipantes: 4, cuotasNoConfirmadas: 2 });

    expect(r.descuento).toBe(1000);
    expect(r.montoAEntregar).toBe(1000);
  });

  it('si ninguna cuota está confirmada no queda nada por entregar', () => {
    expect(
      calcularMontoAEntregar({ montoCuota: 500, numParticipantes: 4, cuotasNoConfirmadas: 4 }).montoAEntregar,
    ).toBe(0);
  });

  it('nunca da un monto negativo aunque lleguen más cuotas pendientes que participantes', () => {
    const r = calcularMontoAEntregar({ montoCuota: 500, numParticipantes: 3, cuotasNoConfirmadas: 9 });

    expect(r.montoAEntregar).toBe(0);
    expect(r.cuotasNoConfirmadas).toBe(3);
  });

  it('ignora una cantidad negativa de cuotas pendientes', () => {
    expect(
      calcularMontoAEntregar({ montoCuota: 100, numParticipantes: 3, cuotasNoConfirmadas: -2 }).montoAEntregar,
    ).toBe(300);
  });

  it('no arrastra errores de punto flotante con cuotas con centavos', () => {
    const r = calcularMontoAEntregar({ montoCuota: 33.33, numParticipantes: 3, cuotasNoConfirmadas: 1 });

    expect(r.totalTurno).toBe(99.99);
    expect(r.descuento).toBe(33.33);
    expect(r.montoAEntregar).toBe(66.66);
  });
});
