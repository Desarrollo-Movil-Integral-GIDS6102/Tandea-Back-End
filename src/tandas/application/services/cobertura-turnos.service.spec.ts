import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoberturaTurnosService } from './cobertura-turnos.service';
import type { CoberturaRepositoryPort } from '../../domain/ports/out/cobertura-repository.port';
import type { TurnoEventsPort } from '../../domain/ports/out/turno-events.port';
import type { NumeroParaCobertura, TandaParaCobertura } from '../../domain/services/evaluar-turno';

const num = (numero: number, tienePagoActivo: boolean, status: NumeroParaCobertura['status'] = 'PENDIENTE'): NumeroParaCobertura => ({
  idNumber: 100 + numero,
  numero,
  idUser: 10 + numero,
  status,
  tienePagoActivo,
});

/** Quincenal desde 2026-11-01 con 2 días de gracia: el turno 1 vence el 11-03. */
const tanda = (cambios: Partial<TandaParaCobertura> = {}): TandaParaCobertura => ({
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
  numeros: [num(1, true), num(2, false), num(3, false)],
  ...cambios,
});

// 9:00 CDMX del 4 de noviembre (la gracia del turno 1 venció el 3)
const AHORA = new Date('2026-11-04T15:00:00.000Z');

describe('CoberturaTurnosService (AP-10)', () => {
  let repo: { [K in keyof CoberturaRepositoryPort]: ReturnType<typeof vi.fn> };
  let eventos: { [K in keyof TurnoEventsPort]: ReturnType<typeof vi.fn> };
  let service: CoberturaTurnosService;

  beforeEach(() => {
    repo = {
      listarTandasActivas: vi.fn().mockResolvedValue([tanda()]),
      cubrirConNumeroMuerto: vi.fn().mockResolvedValue([]),
      marcarEnRiesgo: vi.fn().mockResolvedValue(true),
      quitarRiesgo: vi.fn().mockResolvedValue(undefined),
    };
    eventos = {
      publicarTurnoEnRiesgo: vi.fn().mockResolvedValue(undefined),
      publicarNumeroMuertoUsado: vi.fn().mockResolvedValue(undefined),
    };
    service = new CoberturaTurnosService(repo as unknown as CoberturaRepositoryPort, eventos);
  });

  describe('sin número muerto', () => {
    it('marca el turno del beneficiario en riesgo y emite turno.en_riesgo', async () => {
      const r = await service.revisarTurnosVencidos(AHORA);

      expect(repo.marcarEnRiesgo).toHaveBeenCalledWith(101);
      expect(eventos.publicarTurnoEnRiesgo).toHaveBeenCalledWith({
        idTanda: 1,
        nombreTanda: 'Tanda de la oficina',
        idNumber: 101,
        numero: 1,
        idOrganizador: 99,
        idBeneficiario: 11,
        pagosFaltantes: 2,
        montoFaltante: 200,
      });
      expect(r).toMatchObject({ enRiesgo: 1, cubiertos: 0 });
      expect(repo.cubrirConNumeroMuerto).not.toHaveBeenCalled();
    });

    it('no repite el aviso si el turno ya estaba en riesgo', async () => {
      repo.marcarEnRiesgo.mockResolvedValue(false);

      const r = await service.revisarTurnosVencidos(AHORA);

      expect(eventos.publicarTurnoEnRiesgo).not.toHaveBeenCalled();
      expect(r.enRiesgo).toBe(0);
    });

    it('si el bus de eventos falla, el turno igual queda en riesgo', async () => {
      eventos.publicarTurnoEnRiesgo.mockRejectedValue(new Error('bus caído'));

      await expect(service.revisarTurnosVencidos(AHORA)).resolves.toMatchObject({ enRiesgo: 1 });
    });

    it('al regularizarse los pagos, quita el riesgo y no avisa', async () => {
      repo.listarTandasActivas.mockResolvedValue([
        tanda({ numeros: [num(1, true, 'EN_RIESGO'), num(2, true), num(3, true)] }),
      ]);

      const r = await service.revisarTurnosVencidos(AHORA);

      expect(repo.quitarRiesgo).toHaveBeenCalledWith([101]);
      expect(r.regularizados).toBe(1);
      expect(eventos.publicarTurnoEnRiesgo).not.toHaveBeenCalled();
    });

    it('antes de que termine la gracia no hace nada', async () => {
      await service.revisarTurnosVencidos(new Date('2026-11-03T15:00:00.000Z'));

      expect(repo.marcarEnRiesgo).not.toHaveBeenCalled();
      expect(repo.cubrirConNumeroMuerto).not.toHaveBeenCalled();
    });
  });

  describe('con número muerto', () => {
    beforeEach(() => {
      // Con número muerto el turno 1 es el #0; el turno 2 (beneficiario #1) vence el 11-18
      repo.listarTandasActivas.mockResolvedValue([
        tanda({
          tieneNumeroMuerto: true,
          idNumeroMuerto: 500,
          numeros: [num(1, true), num(2, false), num(3, false)],
        }),
      ]);
      repo.cubrirConNumeroMuerto.mockResolvedValue([
        { idPayment: 900, idNumber: 102 },
        { idPayment: 901, idNumber: 103 },
      ]);
    });
    const DESPUES_DEL_CERO = new Date('2026-11-19T15:00:00.000Z');

    it('cubre los pagos faltantes con el número muerto y emite numero_muerto.usado', async () => {
      const r = await service.revisarTurnosVencidos(DESPUES_DEL_CERO);

      expect(repo.cubrirConNumeroMuerto).toHaveBeenCalledWith({
        idNumeroMuerto: 500,
        montoCuota: 100,
        idNumbers: [102, 103],
      });
      expect(eventos.publicarNumeroMuertoUsado).toHaveBeenCalledWith({
        idTanda: 1,
        nombreTanda: 'Tanda de la oficina',
        idNumeroMuerto: 500,
        idOrganizador: 99,
        numeroDelTurno: 1,
        montoCubierto: 200,
        cubiertos: [
          { idPayment: 900, idNumber: 102, numero: 2, idUser: 12 },
          { idPayment: 901, idNumber: 103, numero: 3, idUser: 13 },
        ],
      });
      expect(r).toMatchObject({ cubiertos: 2, enRiesgo: 0 });
    });

    it('no marca el turno en riesgo cuando el número muerto cubre', async () => {
      await service.revisarTurnosVencidos(DESPUES_DEL_CERO);

      expect(repo.marcarEnRiesgo).not.toHaveBeenCalled();
      expect(eventos.publicarTurnoEnRiesgo).not.toHaveBeenCalled();
    });

    it('es idempotente: si la transacción no creó pagos nuevos no emite el evento', async () => {
      repo.cubrirConNumeroMuerto.mockResolvedValue([]);

      const r = await service.revisarTurnosVencidos(DESPUES_DEL_CERO);

      expect(eventos.publicarNumeroMuertoUsado).not.toHaveBeenCalled();
      expect(r.cubiertos).toBe(0);
    });

    it('si el bus de eventos falla, los pagos de cobertura se conservan', async () => {
      eventos.publicarNumeroMuertoUsado.mockRejectedValue(new Error('bus caído'));

      await expect(service.revisarTurnosVencidos(DESPUES_DEL_CERO)).resolves.toMatchObject({ cubiertos: 2 });
    });
  });

  it('una tanda con datos inválidos no detiene la revisión de las demás', async () => {
    repo.listarTandasActivas.mockResolvedValue([
      tanda({ idTanda: 7, startDate: 'no-es-fecha' }),
      tanda({ idTanda: 8 }),
    ]);

    const r = await service.revisarTurnosVencidos(AHORA);

    expect(r.enRiesgo).toBe(1);
    expect(eventos.publicarTurnoEnRiesgo).toHaveBeenCalledWith(expect.objectContaining({ idTanda: 8 }));
  });
});
