import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElegirNumeroService } from './elegir-numero.service';
import { NumberRepositoryPort } from '../../domain/ports/out/number-repository.port';
import { TandaRepositoryPort } from '../../domain/ports/out/tanda-repository.port';
import { Tanda } from '../../domain/entities/tanda.entity';
import { NumeroTanda } from '../../domain/entities/numero-tanda.entity';
import {
  NumeroYaTomadoError,
  NumeroMuertoNoElegibleError,
  NumeroInexistenteError,
  NumeroFueraDeRangoError,
} from '../../domain/errors/numero.errors';

describe('[AP-02] ElegirNumeroService (Caso de uso Elegir Número)', () => {
  let service: ElegirNumeroService;
  let mockNumberRepo: NumberRepositoryPort;
  let mockTandaRepo: TandaRepositoryPort;

  const fakeTanda = new Tanda({
    idTanda: 10,
    name: 'Tanda Verano',
    startDate: '2026-06-01',
    contributionAmount: 1000,
    numParticipants: 5,
    numRounds: 1,
    graceDays: 2,
    hasDeadNumber: false,
    idTandaType: 1,
    idAdmin: 1,
    inviteCode: 'TND-VRN01',
    status: 'PENDIENTE',
    active: true,
  });

  beforeEach(() => {
    mockNumberRepo = {
      createNumber: vi.fn(),
      findOccupiedNumbers: vi.fn(),
      findByUserInTanda: vi.fn(),
      countParticipants: vi.fn(),
      findNumbersByTanda: vi.fn(),
      asignarSiLibre: vi.fn(),
      findByTandaRoundAndValue: vi.fn(),
    };

    mockTandaRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByInviteCode: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      findAll: vi.fn(),
    };

    service = new ElegirNumeroService(mockNumberRepo, mockTandaRepo);
  });

  it('debe asignar exitosamente un número libre al usuario participante', async () => {
    vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(fakeTanda);

    const numeroEsperado = new NumeroTanda({
      idNumber: 1,
      idTanda: 10,
      roundNumber: 1,
      numberValue: 3,
      idUser: 42,
      isDeadNumber: false,
      status: 'PENDIENTE',
    });
    vi.spyOn(mockNumberRepo, 'asignarSiLibre').mockResolvedValue(numeroEsperado);

    const resultado = await service.elegirNumero({
      idTanda: 10,
      idUsuario: 42,
      valorNumero: 3,
    });

    expect(resultado).toBeDefined();
    expect(resultado.idUser).toBe(42);
    expect(resultado.numberValue).toBe(3);
    expect(mockNumberRepo.asignarSiLibre).toHaveBeenCalledWith(10, 1, 3, 42);
  });

  it('debe lanzar NumeroInexistenteError si la tanda no existe o está inactiva', async () => {
    vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(null);

    await expect(
      service.elegirNumero({
        idTanda: 999,
        idUsuario: 42,
        valorNumero: 2,
      }),
    ).rejects.toThrow(NumeroInexistenteError);
  });

  it('debe lanzar NumeroFueraDeRangoError si el número solicitado excede los participantes', async () => {
    vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(fakeTanda);

    await expect(
      service.elegirNumero({
        idTanda: 10,
        idUsuario: 42,
        valorNumero: 6, // fakeTanda tiene 5 participantes sin número muerto
      }),
    ).rejects.toThrow(NumeroFueraDeRangoError);
  });

  it('debe permitir seleccionar el número adicional si la tanda tiene número muerto configurado', async () => {
    const tandaConMuerto = new Tanda({
      idTanda: 10,
      name: 'Tanda Con Muerto',
      startDate: '2026-06-01',
      contributionAmount: 1000,
      numParticipants: 5,
      numRounds: 1,
      graceDays: 2,
      hasDeadNumber: true,
      idTandaType: 1,
      idAdmin: 1,
      inviteCode: 'TND-MTO01',
      status: 'PENDIENTE',
      active: true,
    });
    vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tandaConMuerto);

    // Si el número 6 es el muerto, el repo atómico lanzará NumeroMuertoNoElegibleError
    vi.spyOn(mockNumberRepo, 'asignarSiLibre').mockRejectedValue(
      new NumeroMuertoNoElegibleError(6),
    );

    await expect(
      service.elegirNumero({
        idTanda: 10,
        idUsuario: 42,
        valorNumero: 6,
      }),
    ).rejects.toThrow(NumeroMuertoNoElegibleError);
  });

  it('debe propagar NumeroYaTomadoError si el repositorio detecta que el número ya está ocupado', async () => {
    vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(fakeTanda);
    vi.spyOn(mockNumberRepo, 'asignarSiLibre').mockRejectedValue(
      new NumeroYaTomadoError(2, 1),
    );

    await expect(
      service.elegirNumero({
        idTanda: 10,
        idUsuario: 42,
        valorNumero: 2,
      }),
    ).rejects.toThrow(NumeroYaTomadoError);
  });

  it('debe respetar el número de vuelta (roundNumber) enviado en el comando', async () => {
    vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(fakeTanda);

    const numeroEsperado = new NumeroTanda({
      idNumber: 2,
      idTanda: 10,
      roundNumber: 2,
      numberValue: 3,
      idUser: 42,
      isDeadNumber: false,
      status: 'PENDIENTE',
    });
    vi.spyOn(mockNumberRepo, 'asignarSiLibre').mockResolvedValue(numeroEsperado);

    const resultado = await service.elegirNumero({
      idTanda: 10,
      idUsuario: 42,
      valorNumero: 3,
      roundNumber: 2,
    });

    expect(resultado.roundNumber).toBe(2);
    expect(mockNumberRepo.asignarSiLibre).toHaveBeenCalledWith(10, 2, 3, 42);
  });
});
