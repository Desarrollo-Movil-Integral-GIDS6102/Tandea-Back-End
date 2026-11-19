import 'reflect-metadata';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TandaService } from '../../../tandas/application/services/tanda.service';
import type { NumberRepositoryPort } from '../../../tandas/domain/ports/out/number-repository.port';
import type { TandaRepositoryPort } from '../../../tandas/domain/ports/out/tanda-repository.port';
import type {
  ActualizarConfiguracionCommand,
  ConfiguracionPlataforma,
} from '../../domain/ports/in/admin-config-use-case.port';
import type { AdminConfigRepositoryPort } from '../../domain/ports/out/admin-config-repository.port';
import { AdminController } from '../../infrastructure/adapters/in/http/admin.controller';
import { AdminConfigService, CONFIG_POR_DEFECTO } from './admin-config.service';

function configEjemplo(
  parcial: Partial<ConfiguracionPlataforma> = {},
): ConfiguracionPlataforma {
  return {
    idConfig: 1,
    maxUsersPerTanda: 15,
    maxActiveTandasPerUser: 3,
    maxGraceDays: 2,
    idUpdatedBy: 1,
    updatedAt: new Date('2026-11-18T18:00:00.000Z'),
    ...parcial,
  };
}

describe('[SP-4 BE-ADMIN] AdminConfigService — Parámetros globales de la plataforma', () => {
  let repo: {
    obtenerConfiguracion: ReturnType<typeof vi.fn>;
    guardarConfiguracion: ReturnType<typeof vi.fn>;
  };
  let servicio: AdminConfigService;

  beforeEach(() => {
    repo = {
      obtenerConfiguracion: vi.fn().mockResolvedValue(configEjemplo()),
      guardarConfiguracion: vi
        .fn()
        .mockImplementation(
          async (cmd: ActualizarConfiguracionCommand): Promise<ConfiguracionPlataforma> =>
            configEjemplo({
              maxUsersPerTanda: cmd.maxUsersPerTanda,
              maxActiveTandasPerUser: cmd.maxActiveTandasPerUser,
              maxGraceDays: cmd.maxGraceDays,
              idUpdatedBy: cmd.idUpdatedBy,
            }),
        ),
    };
    servicio = new AdminConfigService(repo as unknown as AdminConfigRepositoryPort);
  });

  it('GET: devuelve la configuración almacenada en platform_config', async () => {
    const config = await servicio.obtenerConfiguracion();

    expect(config.maxUsersPerTanda).toBe(15);
    expect(config.maxActiveTandasPerUser).toBe(3);
    expect(config.maxGraceDays).toBe(2);
    expect(config.idUpdatedBy).toBe(1);
  });

  it('GET: si no hay fila en BD devuelve los valores por defecto', async () => {
    repo.obtenerConfiguracion.mockResolvedValue(null);

    const config = await servicio.obtenerConfiguracion();

    expect(config.maxUsersPerTanda).toBe(CONFIG_POR_DEFECTO.maxUsersPerTanda);
    expect(config.maxActiveTandasPerUser).toBe(CONFIG_POR_DEFECTO.maxActiveTandasPerUser);
    expect(config.maxGraceDays).toBe(CONFIG_POR_DEFECTO.maxGraceDays);
  });

  it('PUT: actualiza los límites y guarda id_updated_by con el admin que hizo el cambio', async () => {
    const actualizada = await servicio.actualizarConfiguracion({
      maxUsersPerTanda: 12,
      maxActiveTandasPerUser: 4,
      maxGraceDays: 5,
      idUpdatedBy: 42,
    });

    expect(repo.guardarConfiguracion).toHaveBeenCalledWith({
      maxUsersPerTanda: 12,
      maxActiveTandasPerUser: 4,
      maxGraceDays: 5,
      idUpdatedBy: 42,
    });
    expect(actualizada.maxUsersPerTanda).toBe(12);
    expect(actualizada.maxActiveTandasPerUser).toBe(4);
    expect(actualizada.maxGraceDays).toBe(5);
    expect(actualizada.idUpdatedBy).toBe(42);
  });

  it('PUT: rechaza valores fuera de rango (< 3 participantes, < 1 tanda activa o < 0 días de gracia)', async () => {
    await expect(
      servicio.actualizarConfiguracion({
        maxUsersPerTanda: 2,
        maxActiveTandasPerUser: 3,
        maxGraceDays: 2,
        idUpdatedBy: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      servicio.actualizarConfiguracion({
        maxUsersPerTanda: 10,
        maxActiveTandasPerUser: 0,
        maxGraceDays: 2,
        idUpdatedBy: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      servicio.actualizarConfiguracion({
        maxUsersPerTanda: 10,
        maxActiveTandasPerUser: 3,
        maxGraceDays: -1,
        idUpdatedBy: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('[SP-4 BE-ADMIN] TandaService.crearTanda — Validación contra límites de platform_config', () => {
  let createFn: ReturnType<typeof vi.fn>;
  let contarActivasFn: ReturnType<typeof vi.fn>;
  let tandaRepo: TandaRepositoryPort;
  let numberRepo: NumberRepositoryPort;
  let tandaService: TandaService;

  beforeEach(() => {
    createFn = vi.fn().mockImplementation(async (t) => t);
    contarActivasFn = vi.fn().mockResolvedValue(1);

    tandaRepo = {
      create: createFn,
      findById: vi.fn(),
      findByInviteCode: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      findAll: vi.fn(),
      listarMovimientos: vi.fn(),
      obtenerLimitesPlataforma: vi.fn().mockResolvedValue({
        maxUsersPerTanda: 10,
        maxActiveTandasPerUser: 2,
        maxGraceDays: 3,
      }),
      contarTandasActivasDeOrganizador: contarActivasFn,
    };

    numberRepo = {
      createNumber: vi.fn(),
      createNumbers: vi.fn(),
      countNumbersWithoutPayment: vi.fn().mockResolvedValue(0),
      findOccupiedNumbers: vi.fn().mockResolvedValue([]),
      findByUserInTanda: vi.fn(),
      countParticipants: vi.fn(),
      findNumbersByTanda: vi.fn(),
    };

    tandaService = new TandaService(tandaRepo, numberRepo);
  });

  it('permite crear una tanda cuando respeta maxUsersPerTanda, maxGraceDays y maxActiveTandasPerUser', async () => {
    const creada = await tandaService.crearTanda({
      name: 'Tanda Dentro de Límites',
      startDate: '2026-12-01',
      contributionAmount: 500,
      numParticipants: 10,
      graceDays: 3,
      idAdmin: 7,
    });

    expect(creada.numParticipants).toBe(10);
    expect(creada.graceDays).toBe(3);
    expect(createFn).toHaveBeenCalledOnce();
  });

  it('rechaza crear una tanda si numParticipants excede maxUsersPerTanda', async () => {
    await expect(
      tandaService.crearTanda({
        name: 'Tanda Excede Participantes',
        startDate: '2026-12-01',
        contributionAmount: 500,
        numParticipants: 11,
        graceDays: 2,
        idAdmin: 7,
      }),
    ).rejects.toThrow('El número de participantes (11) excede el máximo permitido (10)');
    expect(createFn).not.toHaveBeenCalled();
  });

  it('rechaza crear una tanda si graceDays excede maxGraceDays', async () => {
    await expect(
      tandaService.crearTanda({
        name: 'Tanda Excede Días de Gracia',
        startDate: '2026-12-01',
        contributionAmount: 500,
        numParticipants: 5,
        graceDays: 4,
        idAdmin: 7,
      }),
    ).rejects.toThrow('Los días de gracia (4) exceden el máximo permitido (3)');
    expect(createFn).not.toHaveBeenCalled();
  });

  it('rechaza crear una tanda si el organizador ya alcanzó maxActiveTandasPerUser', async () => {
    contarActivasFn.mockResolvedValue(2);

    await expect(
      tandaService.crearTanda({
        name: 'Tanda Excede Tandas Activas',
        startDate: '2026-12-01',
        contributionAmount: 500,
        numParticipants: 5,
        graceDays: 1,
        idAdmin: 7,
      }),
    ).rejects.toThrow('Has alcanzado el máximo de tandas activas permitidas por usuario (2)');
    expect(createFn).not.toHaveBeenCalled();
  });
});

describe('[SP-4 BE-ADMIN] AdminController — Endpoints GET y PUT /admin/config', () => {
  it('GET /admin/config y PUT /admin/config delegan a AdminConfigUseCasePort guardando idUpdatedBy', async () => {
    const configMock = {
      obtenerConfiguracion: vi.fn().mockResolvedValue(configEjemplo()),
      actualizarConfiguracion: vi
        .fn()
        .mockResolvedValue(configEjemplo({ maxUsersPerTanda: 12, idUpdatedBy: 9 })),
    };
    const controller = new AdminController({} as any, {} as any, {} as any, configMock);

    const getRes = await controller.obtenerConfiguracion();
    expect(getRes).toEqual({
      statusCode: HttpStatus.OK,
      data: configEjemplo(),
    });

    const putRes = await controller.actualizarConfiguracion(
      {
        maxUsersPerTanda: 12,
        maxActiveTandasPerUser: 3,
        maxGraceDays: 2,
      },
      { idUser: 9, email: 'admin@tandea.com', role: 'admin_global' },
    );

    expect(configMock.actualizarConfiguracion).toHaveBeenCalledWith({
      maxUsersPerTanda: 12,
      maxActiveTandasPerUser: 3,
      maxGraceDays: 2,
      idUpdatedBy: 9,
    });
    expect(putRes.statusCode).toBe(HttpStatus.OK);
    expect(putRes.data.idUpdatedBy).toBe(9);
  });
});
