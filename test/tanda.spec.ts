import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TandaService } from '../src/tandas/application/services/tanda.service';
import { TandaRepositoryPort } from '../src/tandas/domain/ports/out/tanda-repository.port';
import { NumberRepositoryPort } from '../src/tandas/domain/ports/out/number-repository.port';
import { Tanda } from '../src/tandas/domain/entities/tanda.entity';
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
      findOccupiedNumbers: vi.fn(),
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
        numberValue: 5,
        idUser: null,
        isDeadNumber: true,
        status: 'PENDIENTE',
      });
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

  describe('Unirse a Tanda (Join)', () => {
    it('debe permitir unirse a una tanda asignando el número seleccionado', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);
      vi.spyOn(mockNumberRepo, 'countParticipants').mockResolvedValue(1);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1]);
      vi.spyOn(mockNumberRepo, 'createNumber').mockResolvedValue({} as any);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 30,
        selectedNumber: 3,
      });

      expect(res.numeroAsignado).toBe(3);
      expect(mockNumberRepo.createNumber).toHaveBeenCalledWith(
        expect.objectContaining({
          numberValue: 3,
          idUser: 30,
        }),
      );
    });

    it('debe rechazar si el turno seleccionado ya está tomado', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);
      vi.spyOn(mockNumberRepo, 'countParticipants').mockResolvedValue(2);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1, 2]);

      await expect(
        service.unirseTanda({
          inviteCode: 'TND-TEST01',
          idUser: 30,
          selectedNumber: 2,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe asignar automáticamente el primer número libre si no se especifica', async () => {
      const tanda = new Tanda(mockTandaData);
      vi.spyOn(mockTandaRepo, 'findByInviteCode').mockResolvedValue(tanda);
      vi.spyOn(mockNumberRepo, 'findByUserInTanda').mockResolvedValue([]);
      vi.spyOn(mockNumberRepo, 'countParticipants').mockResolvedValue(1);
      vi.spyOn(mockNumberRepo, 'findOccupiedNumbers').mockResolvedValue([1]);
      vi.spyOn(mockNumberRepo, 'createNumber').mockResolvedValue({} as any);

      const res = await service.unirseTanda({
        inviteCode: 'TND-TEST01',
        idUser: 30,
      });

      expect(res.numeroAsignado).toBe(2);
    });
  });
});
