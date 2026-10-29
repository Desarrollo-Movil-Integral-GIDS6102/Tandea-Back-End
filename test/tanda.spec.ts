import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import { TandaRepositoryPort } from '../src/tandas/domain/ports/out/tanda-repository.port';
import { NumberRepositoryPort } from '../src/tandas/domain/ports/out/number-repository.port';
import { Tanda } from '../src/tandas/domain/entities/tanda.entity';
import { NumeroYaTomadoError } from '../src/tandas/domain/errors/numero.errors';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('[BE-TANDA] Servicio de Tandas (CRUD, Filtros y Unirse)', () => {
  let service: TandaService;
  let mockTandaRepo: TandaRepositoryPort;
  let mockNumberRepo: NumberRepositoryPort;

  const mockTandaData = {
    idTanda: 1,
    name: 'Tanda Navideña 2026',
    description: 'Ahorro para fin de año',
    startDate: '2026-11-01',
    contributionAmount: 1000,
    numParticipants: 5,
    numRounds: 1,
    graceDays: 2,
    hasDeadNumber: false,
    idTandaType: 1,
    idAdmin: 10,
    inviteCode: 'TND-TEST01',
    status: 'PENDIENTE' as const,
    active: true,
  };

  beforeEach(() => {
    mockTandaRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByInviteCode: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      findAll: vi.fn(),
    };

    mockNumberRepo = {
      createNumber: vi.fn(),
      createNumbers: vi.fn(),
      countNumbersWithoutPayment: vi.fn().mockResolvedValue(0),
      findOccupiedNumbers: vi.fn().mockResolvedValue([]),
      findByUserInTanda: vi.fn(),
      countParticipants: vi.fn(),
      findNumbersByTanda: vi.fn(),
    };

    service = new TandaService(mockTandaRepo, mockNumberRepo);
  });

  describe('Crear Tanda (Create)', () => {
    it('debe crear una tanda exitosamente con código único generado', async () => {
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(null);
      vi.spyOn(mockTandaRepo, 'create').mockImplementation(async (t) => t);

      const result = await service.crearTanda({
        name: 'Tanda Navideña',
        startDate: '2026-11-01',
        contributionAmount: 500,
        numParticipants: 5,
        idAdmin: 10,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Tanda Navideña');
      expect(result.status).toBe('PENDIENTE');
      expect(result.inviteCode).toMatch(/^TND-[2-9A-HJ-NP-Z]{6}$/);
      expect(mockTandaRepo.create).toHaveBeenCalledOnce();
    });

    it('debe reservar el número muerto si hasDeadNumber es true', async () => {
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(null);
      const createdTanda = new Tanda({
        ...mockTandaData,
        hasDeadNumber: true,
      });
      vi.spyOn(mockTandaRepo, 'create').mockResolvedValue(createdTanda);

      await service.crearTanda({
        name: 'Tanda con respaldo',
        startDate: '2026-11-01',
        contributionAmount: 1000,
        numParticipants: 5,
        hasDeadNumber: true,
        idAdmin: 10,
      });

      expect(mockNumberRepo.createNumber).toHaveBeenCalledWith({
        idTanda: 1,
        roundNumber: 1,
        numberValue: 0,
        idUser: null,
        isDeadNumber: true,
        status: 'PENDIENTE',
      });
    });

    it('sin número muerto no crea el #0', async () => {
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(null);
      vi.spyOn(mockTandaRepo, 'create').mockResolvedValue(new Tanda(mockTandaData));

      await service.crearTanda({
        name: 'Tanda sin respaldo',
        startDate: '2026-11-01',
        contributionAmount: 1000,
        numParticipants: 5,
        hasDeadNumber: false,
        idAdmin: 10,
      });

      expect(mockNumberRepo.createNumber).not.toHaveBeenCalled();
    });

    it('debe permitir crear una tanda con el mínimo válido de 3 participantes', async () => {
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(null);
      const createSpy = vi.spyOn(mockTandaRepo, 'create').mockImplementation(async (t) => t);

      const result = await service.crearTanda({
        name: 'Tanda Mínima 3',
        startDate: '2026-11-01',
        contributionAmount: 500,
        numParticipants: 3,
        idAdmin: 10,
      });

      expect(result).toBeDefined();
      expect(result.numParticipants).toBe(3);
      expect(createSpy).toHaveBeenCalledOnce();
    });

    it('debe rechazar con BadRequestException si se intenta crear una tanda con menos de 3 participantes (ej. 2)', async () => {
      const createSpy = vi.spyOn(mockTandaRepo, 'create');
      await expect(
        service.crearTanda({
          name: 'Tanda Inválida 2',
          startDate: '2026-11-01',
          contributionAmount: 500,
          numParticipants: 2,
          idAdmin: 10,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('debe rechazar con BadRequestException si se intenta crear con 0 participantes', async () => {
      const createSpy = vi.spyOn(mockTandaRepo, 'create');
      await expect(
        service.crearTanda({
          name: 'Tanda Inválida 0',
          startDate: '2026-11-01',
          contributionAmount: 500,
          numParticipants: 0,
          idAdmin: 10,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(createSpy).not.toHaveBeenCalled();
    });
  });

  describe('Obtener y Listar Tandas (Read & Filters)', () => {
    it('debe permitir obtener detalle de tanda si el usuario es el dueño', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);
      vi.spyOn(mockNumberRepo, 'findNumbersByTanda').mockResolvedValue([]);

      const result = await service.obtenerTandaPorId(1, 10, 'usuario');

      expect(result.name).toBe('Tanda Navideña 2026');
      expect(result.rolUsuario).toBe('DUENO');
    });

    it('debe permitir obtener detalle si el usuario es participante', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([
        {
          idNumber: 101,
          idTanda: 1,
          roundNumber: 1,
          numberValue: 2,
          idUser: 25,
          isDeadNumber: false,
          status: 'PENDIENTE',
        },
      ]);
      vi.spyOn(mockNumberRepo, 'findNumbersByTanda').mockResolvedValue([]);

      const result = await service.obtenerTandaPorId(1, 25, 'usuario');

      expect(result.rolUsuario).toBe('PARTICIPANTE');
    });

    it('debe rechazar con 403 Forbidden si el usuario no es dueño ni participante', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);

      await expect(
        service.obtenerTandaPorId(1, 999, 'usuario'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe listar tandas con paginación y asignación de rol en cada elemento', async () => {
      const tanda1 = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findAll').mockResolvedValue({
        data: [tanda1],
        total: 1,
      });
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);

      const res = await service.listarTandas(
        { page: 1, limit: 10, scope: 'todos' },
        10,
        'usuario',
      );

      expect(res.total).toBe(1);
      expect(res.data[0].rolUsuario).toBe('DUENO');
      expect(res.totalPages).toBe(1);
    });
  });

  describe('Actualizar Tanda (Update)', () => {
    it('debe permitir actualizar nombre y descripción por el dueño', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockTandaRepo, 'update').mockImplementation(async (t) => t);

      const updated = await service.actualizarTanda(
        1,
        { name: 'Nuevo Nombre Tanda' },
        10,
        'usuario',
      );

      expect(updated.name).toBe('Nuevo Nombre Tanda');
      expect(mockTandaRepo.update).toHaveBeenCalledOnce();
    });

    it('debe rechazar actualización si el usuario no es el dueño ni admin global', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);

      await expect(
        service.actualizarTanda(1, { name: 'Hack' }, 999, 'usuario'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debe permitir cambiar estado a ACTIVA por el dueño', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockTandaRepo, 'updateStatus').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2, 3, 4, 5]);

      await service.cambiarEstadoTanda(1, 'ACTIVA', 10, 'usuario');

      expect(mockTandaRepo.updateStatus).toHaveBeenCalledWith(1, 'ACTIVA');
    });
  });

  describe('Eliminar Tanda (Delete / Soft Delete)', () => {
    it('debe ejecutar soft delete si es solicitada por el dueño', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockTandaRepo, 'softDelete').mockResolvedValue();

      await service.eliminarTanda(1, 10, 'usuario');

      expect(mockTandaRepo.softDelete).toHaveBeenCalledWith(1);
    });

    it('debe denegar eliminación a usuarios que no son dueños', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);

      await expect(service.eliminarTanda(1, 45, 'usuario')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Iniciar Tanda', () => {
    it('debe rechazar iniciar la tanda si faltan números por apartar', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2]);

      await expect(service.cambiarEstadoTanda(1, 'ACTIVA', 10, 'usuario')).rejects.toThrow(
        'Faltan 3 números',
      );
      expect(mockTandaRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('Unirse a Tanda (Join)', () => {
    it('debe permitir unirse a una tanda asignando el número seleccionado', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1]);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 30,
        selectedNumbers: [3],
      });

      expect(res.numeroAsignado).toBe(3);
      expect(mockNumberRepo.createNumbers).toHaveBeenCalledWith([
        expect.objectContaining({ numberValue: 3, idUser: 30 }),
      ]);
    });

    it('debe permitir apartar varios números al mismo usuario aunque ya esté en la tanda', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1]);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 10,
        selectedNumbers: [2, 4, 4],
      });

      expect(res.numerosAsignados).toEqual([2, 4]);
      expect(mockNumberRepo.createNumbers).toHaveBeenCalledOnce();
    });

    it('debe rechazar si el turno seleccionado ya está tomado', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2]);

      await expect(
        service.unirseTanda({
          inviteCode: 'TND-TEST01',
          idUser: 30,
          selectedNumbers: [2],
        }),
      ).rejects.toThrow('El número #2 ya fue tomado por otro participante. Elige otro.');
      expect(mockNumberRepo.createNumbers).not.toHaveBeenCalled();
    });

    it('en Tradicional exige elegir números y nunca asigna otro', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1]);

      await expect(
        service.unirseTanda({ inviteCode: 'TND-TEST01', idUser: 30, cantidad: 1 }),
      ).rejects.toThrow('Elige al menos un número');
      expect(mockNumberRepo.createNumbers).not.toHaveBeenCalled();
    });

    it('si otro participante toma un número a la vez, rechaza todo y nombra el número', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([]);
      vi.spyOn(mockNumberRepo, 'createNumbers').mockRejectedValue(new NumeroYaTomadoError(4));

      await expect(
        service.unirseTanda({ inviteCode: 'TND-TEST01', idUser: 30, selectedNumbers: [3, 4] }),
      ).rejects.toThrow('El número #4 ya fue tomado por otro participante. Elige otro.');
    });

    it('debe asignar automáticamente los primeros números libres según la cantidad', async () => {
      const tanda = new Tanda({ ...mockTandaData, idTandaType: 2 });
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 3]);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 30,
        cantidad: 2,
      });

      expect(res.numerosAsignados).toEqual([2, 4]);
    });

    it('el número muerto no ocupa lugar: una tanda de 3 admite 3 números de personas', async () => {
      const tanda = new Tanda({ ...mockTandaData, numParticipants: 3, hasDeadNumber: true });
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      // #1 y #2 apartados, #0 es el número muerto
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([0, 1, 2]);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 30,
        selectedNumbers: [3],
      });

      expect(res.numeroAsignado).toBe(3);
      expect(mockTandaRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('permite unirse a una tanda ACTIVA mientras queden números libres', async () => {
      const tanda = new Tanda({ ...mockTandaData, status: 'ACTIVA' });
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2, 3, 5]);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 30,
        selectedNumbers: [4],
      });

      expect(res.numerosAsignados).toEqual([4]);
    });

    it('rechaza con "sin números disponibles" solo cuando no queda ninguno', async () => {
      const tanda = new Tanda({ ...mockTandaData, status: 'ACTIVA' });
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2, 3, 4, 5]);

      await expect(
        service.unirseTanda({ inviteCode: 'TND-TEST01', idUser: 30, selectedNumbers: [4] }),
      ).rejects.toThrow('La tanda ya no tiene números disponibles');
    });

    it('rechaza una tanda finalizada con un mensaje propio', async () => {
      const tanda = new Tanda({ ...mockTandaData, status: 'FINALIZADA' });
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);

      await expect(
        service.unirseTanda({ inviteCode: 'TND-TEST01', idUser: 30, selectedNumbers: [4] }),
      ).rejects.toThrow('La tanda está finalizada y ya no acepta participantes');
    });

    it('el detalle y el código devuelven los mismos números libres en una tanda ACTIVA', async () => {
      const tanda = new Tanda({ ...mockTandaData, status: 'ACTIVA' });
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockTandaRepo, 'findById').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2, 3, 5]);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);
      vi.spyOn(mockNumberRepo, 'findNumbersByTanda').mockResolvedValue([]);

      const porCodigo = await service.obtenerPorCodigoInvitacion('TND-TEST01');
      const detalle = await service.obtenerTandaPorId(1, 10, 'usuario');

      expect(porCodigo.numerosDisponibles).toEqual([4]);
      expect(detalle.numerosDisponibles).toEqual([4]);
    });
  });
});
