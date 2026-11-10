import { describe, it, expect } from 'vitest';
import {
  seleccionarCobrosProximos,
  seleccionarRecordatorios,
  seleccionarVencidos,
  turnoEnCobro,
  type TandaParaRecordatorio,
} from './recordatorios-pago';

// Semanal desde el 2 de nov con 2 días de gracia:
// turno 1 cobra el 02-nov (límite 04-nov), turno 2 el 09-nov (límite 11-nov), turno 3 el 16-nov (límite 18-nov)
const tanda = (cambios: Partial<TandaParaRecordatorio> = {}): TandaParaRecordatorio => ({
  idTanda: 3,
  nombre: 'Tanda de la oficina',
  startDate: '2026-11-02',
  periodicidad: 'semanal',
  montoCuota: 150.5,
  numParticipantes: 3,
  numVueltas: 1,
  tieneNumeroMuerto: false,
  diasGracia: 2,
  numeros: [
    { idNumber: 11, numero: 1, idUser: 7, tienePagoActivo: false },
    { idNumber: 12, numero: 2, idUser: 8, tienePagoActivo: true },
    { idNumber: 13, numero: 3, idUser: 9, tienePagoActivo: false },
  ],
  ...cambios,
});

describe('turnoEnCobro', () => {
  it('toma el primer turno cuya fecha límite (cobro + gracia) no ha pasado', () => {
    expect(turnoEnCobro(tanda(), '2026-11-04')).toMatchObject({
      turno: { turno: 1, fechaCobro: '2026-11-02' },
      fechaLimite: '2026-11-04',
    });
    expect(turnoEnCobro(tanda(), '2026-11-05')).toMatchObject({
      turno: { turno: 2, fechaCobro: '2026-11-09' },
      fechaLimite: '2026-11-11',
    });
  });

  it('salta el turno #0 del número muerto porque no genera pagos', () => {
    const conMuerto = tanda({ tieneNumeroMuerto: true });
    // #0 cobra el 02-nov; el primer turno con pagos (#1) cobra el 09-nov
    expect(turnoEnCobro(conMuerto, '2026-11-02')).toMatchObject({
      turno: { numero: 1, fechaCobro: '2026-11-09' },
      fechaLimite: '2026-11-11',
    });
  });

  it('devuelve null cuando ya pasó el último turno', () => {
    expect(turnoEnCobro(tanda(), '2026-11-19')).toBeNull();
  });
});

describe('seleccionarRecordatorios', () => {
  it('avisa a quien no ha pagado cuando faltan exactamente los días configurados', () => {
    const avisos = seleccionarRecordatorios(tanda(), '2026-11-10', 1);

    expect(avisos).toEqual([
      expect.objectContaining({ idUser: 7, numeros: [1], monto: 150.5, fechaLimite: '2026-11-11', diasRestantes: 1 }),
      expect.objectContaining({ idUser: 9, numeros: [3], monto: 150.5, fechaLimite: '2026-11-11', diasRestantes: 1 }),
    ]);
  });

  it('no avisa a quien ya tiene un pago pendiente o confirmado', () => {
    const avisos = seleccionarRecordatorios(tanda(), '2026-11-10', 1);
    expect(avisos.map((a) => a.idUser)).not.toContain(8);
  });

  it('no avisa si faltan más o menos días de los configurados', () => {
    expect(seleccionarRecordatorios(tanda(), '2026-11-09', 1)).toEqual([]);
    expect(seleccionarRecordatorios(tanda(), '2026-11-11', 1)).toEqual([]);
  });

  it('agrupa en un solo aviso los números sin pagar del mismo participante', () => {
    const avisos = seleccionarRecordatorios(
      tanda({
        numeros: [
          { idNumber: 13, numero: 3, idUser: 7, tienePagoActivo: false },
          { idNumber: 11, numero: 1, idUser: 7, tienePagoActivo: false },
        ],
      }),
      '2026-11-10',
      1,
    );

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ idUser: 7, numeros: [1, 3], monto: 301 });
  });

  it('con diasAntes = 0 avisa el mismo día de la fecha límite', () => {
    expect(seleccionarRecordatorios(tanda(), '2026-11-11', 0)).toHaveLength(2);
  });
});

describe('seleccionarVencidos', () => {
  it('el día siguiente a la fecha límite avisa a quien no pagó', () => {
    // Turno 1: límite 04-nov, así que el 05-nov ya venció
    expect(seleccionarVencidos(tanda(), '2026-11-05')).toEqual([
      expect.objectContaining({ idUser: 7, numeros: [1], fechaLimite: '2026-11-04', diasRestantes: -1 }),
      expect.objectContaining({ idUser: 9, numeros: [3], fechaLimite: '2026-11-04', diasRestantes: -1 }),
    ]);
  });

  it('solo avisa una vez: dentro de la gracia o días después no hay aviso', () => {
    expect(seleccionarVencidos(tanda(), '2026-11-04')).toEqual([]);
    expect(seleccionarVencidos(tanda(), '2026-11-06')).toEqual([]);
  });

  it('el turno #0 del número muerto nunca vence', () => {
    // #0 cobra el 02-nov con límite 04-nov, pero no genera pagos
    expect(seleccionarVencidos(tanda({ tieneNumeroMuerto: true }), '2026-11-05')).toEqual([]);
  });
});

describe('seleccionarCobrosProximos', () => {
  it('avisa al dueño del número que cobra mañana', () => {
    expect(seleccionarCobrosProximos(tanda(), '2026-11-08')).toEqual([
      { idUser: 8, idTanda: 3, nombreTanda: 'Tanda de la oficina', numero: 2, fechaCobro: '2026-11-09', monto: 451.5 },
    ]);
  });

  it('no avisa por el turno #0 del número muerto ni en días sin cobro', () => {
    expect(seleccionarCobrosProximos(tanda({ tieneNumeroMuerto: true }), '2026-11-01')).toEqual([]);
    expect(seleccionarCobrosProximos(tanda(), '2026-11-10')).toEqual([]);
  });
});
