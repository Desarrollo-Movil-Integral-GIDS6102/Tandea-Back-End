import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordatoriosPagoService, mensajeRecordatorio } from './recordatorios-pago.service';
import type { NotificacionesService } from './notificaciones.service';
import type { NotificacionRepositoryPort } from '../../domain/ports/out/notificacion-repository.port';
import type { TandaParaRecordatorio } from '../../domain/services/recordatorios-pago';

const tanda: TandaParaRecordatorio = {
  idTanda: 3,
  nombre: 'Tanda de la oficina',
  startDate: '2026-11-02',
  periodicidad: 'semanal',
  montoCuota: 100,
  numParticipantes: 2,
  numVueltas: 1,
  tieneNumeroMuerto: false,
  diasGracia: 2,
  numeros: [
    { idNumber: 11, numero: 1, idUser: 7, tienePagoActivo: false },
    { idNumber: 12, numero: 2, idUser: 8, tienePagoActivo: false },
  ],
};

// 10-nov a las 9:00 en CDMX (15:00 UTC); la fecha límite del turno 2 es el 11-nov
const AHORA = new Date('2026-11-10T15:00:00.000Z');

describe('RecordatoriosPagoService', () => {
  let repositorio: {
    listarTandasParaRecordatorio: ReturnType<typeof vi.fn>;
    existeNotificacionDesde: ReturnType<typeof vi.fn>;
  };
  let notificaciones: { notificar: ReturnType<typeof vi.fn> };
  let service: RecordatoriosPagoService;

  beforeEach(() => {
    repositorio = {
      listarTandasParaRecordatorio: vi.fn().mockResolvedValue([tanda]),
      existeNotificacionDesde: vi.fn().mockResolvedValue(false),
    };
    notificaciones = { notificar: vi.fn().mockResolvedValue(undefined) };
    service = new RecordatoriosPagoService(
      repositorio as unknown as NotificacionRepositoryPort,
      notificaciones as unknown as NotificacionesService,
    );
  });

  it('envía un recordatorio por participante sin pagar', async () => {
    const resultado = await service.enviarRecordatorios(AHORA, 1);

    expect(resultado).toEqual({ enviados: 2, omitidosPorDuplicado: 0 });
    expect(notificaciones.notificar).toHaveBeenCalledWith({
      idUser: 7,
      idTanda: 3,
      type: 'recordatorio_pago',
      titulo: 'Recuerda tu pago',
      mensaje: 'Tu pago de $100.00 del número 1 en la tanda "Tanda de la oficina" vence mañana (11/11/2026).',
      route: '/tandas/detalle/3',
    });
  });

  it('revisa los avisos desde el inicio del día en CDMX para no duplicar', async () => {
    repositorio.existeNotificacionDesde.mockImplementation(async (idUser: number) => idUser === 7);

    const resultado = await service.enviarRecordatorios(AHORA, 1);

    expect(resultado).toEqual({ enviados: 1, omitidosPorDuplicado: 1 });
    expect(repositorio.existeNotificacionDesde).toHaveBeenCalledWith(
      7,
      3,
      'recordatorio_pago',
      new Date('2026-11-10T06:00:00.000Z'),
    );
    expect(notificaciones.notificar).toHaveBeenCalledTimes(1);
  });

  it('una tanda con fecha inválida no detiene a las demás', async () => {
    repositorio.listarTandasParaRecordatorio.mockResolvedValue([
      { ...tanda, idTanda: 1, startDate: 'no-es-fecha' },
      tanda,
    ]);

    const resultado = await service.enviarRecordatorios(AHORA, 1);

    expect(resultado.enviados).toBe(2);
  });
});

describe('mensajeRecordatorio', () => {
  it('lista varios números y los días restantes', () => {
    expect(
      mensajeRecordatorio({
        idUser: 7,
        idTanda: 3,
        nombreTanda: 'Familia',
        numeros: [2, 5],
        monto: 1500,
        fechaLimite: '2026-12-01',
        diasRestantes: 3,
      }),
    ).toBe('Tu pago de $1,500.00 de los números 2, 5 en la tanda "Familia" vence en 3 días (01/12/2026).');
  });
});
