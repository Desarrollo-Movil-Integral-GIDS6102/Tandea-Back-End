import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TandaService } from './tanda.service';
import { codificarCursor, decodificarCursor } from '../../domain/services/cursor-historial';
import type { MovimientoRecord, TandaRepositoryPort } from '../../domain/ports/out/tanda-repository.port';
import type { NumberRepositoryPort } from '../../domain/ports/out/number-repository.port';

const ID_TANDA = 2;
const ORGANIZADOR = 2;
const PARTICIPANTE = 5;

const movimiento = (cambios: Partial<MovimientoRecord>): MovimientoRecord => ({
  tipo: 'PAGO',
  id: 1,
  idNumber: 10,
  numero: 4,
  idUser: PARTICIPANTE,
  nombre: 'Diego Prueba',
  monto: 100,
  transferAmount: 0,
  cashAmount: 100,
  estado: 'CONFIRMADO',
  fecha: '2026-11-04T23:01:36.855123Z',
  ...cambios,
});

describe('cursor del historial', () => {
  it('codifica y decodifica sin perder los microsegundos', () => {
    const cursor = { fecha: '2026-11-04T23:01:36.855123Z', tipo: 'COBRO' as const, id: 9 };
    expect(decodificarCursor(codificarCursor(cursor))).toEqual(cursor);
  });

  it('rechaza textos que no son cursores', () => {
    expect(decodificarCursor('basura')).toBeNull();
    expect(decodificarCursor(Buffer.from('2026-11-04|PAGO|1').toString('base64url'))).toBeNull();
    expect(decodificarCursor(Buffer.from('2026-11-04T23:01:36.855123Z|OTRO|1').toString('base64url'))).toBeNull();
  });
});

describe('TandaService.obtenerHistorial', () => {
  let tandaRepo: { findById: ReturnType<typeof vi.fn>; listarMovimientos: ReturnType<typeof vi.fn> };
  let numberRepo: { findByUserInTanda: ReturnType<typeof vi.fn> };
  let service: TandaService;

  beforeEach(() => {
    tandaRepo = {
      findById: vi.fn().mockResolvedValue({ idTanda: ID_TANDA, idAdmin: ORGANIZADOR, active: true }),
      listarMovimientos: vi.fn().mockResolvedValue([]),
    };
    numberRepo = { findByUserInTanda: vi.fn().mockResolvedValue([{ idNumber: 10 }]) };
    service = new TandaService(
      tandaRepo as unknown as TandaRepositoryPort,
      numberRepo as unknown as NumberRepositoryPort,
    );
  });

  it('el organizador ve todo y puede filtrar por participante', async () => {
    await service.obtenerHistorial(ID_TANDA, ORGANIZADOR, 'usuario', { userId: PARTICIPANTE, limit: 20 });

    expect(tandaRepo.listarMovimientos).toHaveBeenCalledWith(ID_TANDA, {
      idUser: PARTICIPANTE,
      cursor: undefined,
      limit: 20,
    });
  });

  it('un participante solo ve sus propios movimientos', async () => {
    await service.obtenerHistorial(ID_TANDA, PARTICIPANTE, 'usuario', { limit: 20 });

    expect(tandaRepo.listarMovimientos).toHaveBeenCalledWith(
      ID_TANDA,
      expect.objectContaining({ idUser: PARTICIPANTE }),
    );
  });

  it('un participante no puede pedir el historial de otro', async () => {
    await expect(
      service.obtenerHistorial(ID_TANDA, PARTICIPANTE, 'usuario', { userId: 3, limit: 20 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('quien no es de la tanda recibe 403 y una tanda inexistente 404', async () => {
    numberRepo.findByUserInTanda.mockResolvedValue([]);
    await expect(service.obtenerHistorial(ID_TANDA, 77, 'usuario', { limit: 20 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    tandaRepo.findById.mockResolvedValue(null);
    await expect(service.obtenerHistorial(99, ORGANIZADOR, 'usuario', { limit: 20 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('un cursor inválido es 400', async () => {
    await expect(
      service.obtenerHistorial(ID_TANDA, ORGANIZADOR, 'usuario', { cursor: 'basura', limit: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('regresa nextCursor del último elemento solo si hay otra página', async () => {
    tandaRepo.listarMovimientos.mockResolvedValue([
      movimiento({ id: 3 }),
      movimiento({ id: 2, tipo: 'COBRO', fecha: '2026-11-03T10:00:00.000000Z' }),
      movimiento({ id: 1 }),
    ]);

    const pagina = await service.obtenerHistorial(ID_TANDA, ORGANIZADOR, 'usuario', { limit: 2 });

    expect(pagina.items.map((m) => [m.tipo, m.id])).toEqual([
      ['PAGO', 3],
      ['COBRO', 2],
    ]);
    expect(decodificarCursor(pagina.nextCursor!)).toEqual({
      fecha: '2026-11-03T10:00:00.000000Z',
      tipo: 'COBRO',
      id: 2,
    });

    tandaRepo.listarMovimientos.mockResolvedValue([movimiento({ id: 1 })]);
    const ultima = await service.obtenerHistorial(ID_TANDA, ORGANIZADOR, 'usuario', { limit: 2 });
    expect(ultima.nextCursor).toBeNull();
  });
});
