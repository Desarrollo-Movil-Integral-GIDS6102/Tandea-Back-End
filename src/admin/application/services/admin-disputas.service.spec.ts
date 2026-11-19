import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DisputaDetalle,
  DisputaResumen,
} from '../../domain/ports/in/admin-disputas-use-case.port';
import type {
  AdminDisputasRepositoryPort,
  ResolucionDisputaTransaccion,
} from '../../domain/ports/out/admin-disputas-repository.port';
import type { AdminEventsPort } from '../../domain/ports/out/admin-events.port';
import { AdminController } from '../../infrastructure/adapters/in/http/admin.controller';
import { DisputasController } from '../../infrastructure/adapters/in/http/disputas.controller';
import { zResolverDisputaDto } from '../dtos/admin-disputas.dto';
import {
  ACCION_DISPUTA_RESUELTA,
  AdminDisputasService,
} from './admin-disputas.service';

function disputaEjemplo(parcial: Partial<DisputaDetalle> = {}): DisputaDetalle {
  return {
    idDispute: 10,
    idTanda: 3,
    nombreTanda: 'Tanda Oficina',
    idReporter: 7,
    nombreReporter: 'Ana López',
    emailReporter: 'ana@tandea.com',
    idResolver: null,
    reason: 'No se reflejó mi pago en transferencia',
    status: 'ABIERTA',
    resolutionNotes: null,
    idPayment: 45,
    idPayout: null,
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    updatedAt: new Date('2026-11-10T12:00:00.000Z'),
    resolvedAt: null,
    bitacora: [],
    ...parcial,
  };
}

describe('[SP-4 BE-ADMIN / INT-ADMIN] AdminDisputasService — Gestionar disputas y registrar en audit_log', () => {
  let repo: {
    obtenerTanda: ReturnType<typeof vi.fn>;
    esParticipanteDeTanda: ReturnType<typeof vi.fn>;
    pagoPerteneceATanda: ReturnType<typeof vi.fn>;
    entregaPerteneceATanda: ReturnType<typeof vi.fn>;
    crearDisputa: ReturnType<typeof vi.fn>;
    listarDisputas: ReturnType<typeof vi.fn>;
    obtenerPorId: ReturnType<typeof vi.fn>;
    resolverConAuditoria: ReturnType<typeof vi.fn>;
  };
  let eventos: {
    publicarUsuarioSuspendido: ReturnType<typeof vi.fn>;
    publicarDisputaResuelta: ReturnType<typeof vi.fn>;
  };
  let servicio: AdminDisputasService;

  beforeEach(() => {
    repo = {
      obtenerTanda: vi.fn().mockResolvedValue({
        idTanda: 3,
        idAdmin: 2,
        name: 'Tanda Oficina',
      }),
      esParticipanteDeTanda: vi.fn().mockResolvedValue(true),
      pagoPerteneceATanda: vi.fn().mockResolvedValue(true),
      entregaPerteneceATanda: vi.fn().mockResolvedValue(true),
      crearDisputa: vi.fn().mockResolvedValue(disputaEjemplo()),
      listarDisputas: vi.fn().mockResolvedValue([disputaEjemplo()]),
      obtenerPorId: vi.fn().mockResolvedValue(disputaEjemplo()),
      resolverConAuditoria: vi
        .fn()
        .mockImplementation(async (tx: ResolucionDisputaTransaccion): Promise<DisputaResumen> =>
          disputaEjemplo({
            idDispute: tx.idDispute,
            status: 'RESUELTA',
            idResolver: tx.idAdminGlobal,
            resolutionNotes: tx.notas,
            resolvedAt: new Date('2026-11-18T15:00:00.000Z'),
          }),
        ),
    };
    eventos = {
      publicarUsuarioSuspendido: vi.fn().mockResolvedValue(undefined),
      publicarDisputaResuelta: vi.fn().mockResolvedValue(undefined),
    };
    servicio = new AdminDisputasService(
      repo as unknown as AdminDisputasRepositoryPort,
      eventos as unknown as AdminEventsPort,
    );
  });

  describe('crearDisputa (POST /disputas)', () => {
    it('permite a un participante miembro de la tanda abrir una disputa y verla en la lista del admin', async () => {
      const creada = await servicio.crearDisputa({
        idTanda: 3,
        idReporter: 7,
        rolReporter: 'usuario',
        motivo: '  No se reflejó mi pago en transferencia  ',
        idPayment: 45,
      });

      expect(repo.esParticipanteDeTanda).toHaveBeenCalledWith(3, 7);
      expect(repo.pagoPerteneceATanda).toHaveBeenCalledWith(45, 3);
      expect(repo.crearDisputa).toHaveBeenCalledWith({
        idTanda: 3,
        idReporter: 7,
        reason: 'No se reflejó mi pago en transferencia',
        idPayment: 45,
        idPayout: null,
      });
      expect(creada.status).toBe('ABIERTA');

      const listaAdmin = await servicio.listarDisputas();
      expect(listaAdmin).toHaveLength(1);
      expect(listaAdmin[0].idDispute).toBe(10);
    });

    it('permite al organizador de la tanda abrir una disputa sin consultar number', async () => {
      await servicio.crearDisputa({
        idTanda: 3,
        idReporter: 2, // idAdmin de la tanda
        rolReporter: 'usuario',
        motivo: 'Discrepancia en el turno actual',
      });

      expect(repo.esParticipanteDeTanda).not.toHaveBeenCalled();
      expect(repo.crearDisputa).toHaveBeenCalledOnce();
    });

    it('lanza ForbiddenException (403) si el usuario no es miembro de la tanda', async () => {
      repo.esParticipanteDeTanda.mockResolvedValue(false);

      await expect(
        servicio.crearDisputa({
          idTanda: 3,
          idReporter: 99,
          rolReporter: 'usuario',
          motivo: 'Intento externo',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.crearDisputa).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException (404) si la tanda no existe', async () => {
      repo.obtenerTanda.mockResolvedValue(null);

      await expect(
        servicio.crearDisputa({
          idTanda: 404,
          idReporter: 7,
          rolReporter: 'usuario',
          motivo: 'Tanda inexistente',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza BadRequestException (400) si el pago no pertenece a la tanda', async () => {
      repo.pagoPerteneceATanda.mockResolvedValue(false);

      await expect(
        servicio.crearDisputa({
          idTanda: 3,
          idReporter: 7,
          rolReporter: 'usuario',
          motivo: 'Pago de otra tanda',
          idPayment: 999,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolverDisputa (PATCH /admin/disputas/:id/resolver)', () => {
    it.each(['mantener', 'revertir', 'suspender'] as const)(
      'resuelve con acción "%s", registra las notas en audit_log y emite el evento disputa.resuelta',
      async (accion) => {
        const resuelta = await servicio.resolverDisputa({
          idDispute: 10,
          idAdminGlobal: 1,
          accion,
          notas: `Se revisó la evidencia y se decide ${accion}`,
        });

        expect(resuelta.status).toBe('RESUELTA');
        expect(resuelta.idResolver).toBe(1);
        expect(resuelta.resolutionNotes).toBe(`Se revisó la evidencia y se decide ${accion}`);
        expect(repo.resolverConAuditoria).toHaveBeenCalledWith({
          idDispute: 10,
          idTanda: 3,
          idPayment: 45,
          idPayout: null,
          idAdminGlobal: 1,
          accion,
          notas: `Se revisó la evidencia y se decide ${accion}`,
          actionType: ACCION_DISPUTA_RESUELTA,
          auditDescription: `Disputa resuelta con acción "${accion}": Se revisó la evidencia y se decide ${accion}`,
        });
        expect(eventos.publicarDisputaResuelta).toHaveBeenCalledWith({
          idDispute: 10,
          idTanda: 3,
          nombreTanda: 'Tanda Oficina',
          emailReporter: 'ana@tandea.com',
          nombreReporter: 'Ana López',
          accion,
          notas: `Se revisó la evidencia y se decide ${accion}`,
        });
      },
    );

    it('lanza ConflictException (409) si la disputa ya fue resuelta', async () => {
      repo.obtenerPorId.mockResolvedValue(disputaEjemplo({ status: 'RESUELTA' }));

      await expect(
        servicio.resolverDisputa({
          idDispute: 10,
          idAdminGlobal: 1,
          accion: 'mantener',
          notas: 'Intento duplicado',
        }),
      ).rejects.toThrow(ConflictException);
      expect(repo.resolverConAuditoria).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException (404) si la disputa no existe', async () => {
      repo.obtenerPorId.mockResolvedValue(null);

      await expect(
        servicio.resolverDisputa({
          idDispute: 404,
          idAdminGlobal: 1,
          accion: 'mantener',
          notas: 'No existe',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('prohíbe modificar montos directamente en el payload de resolución', () => {
      expect(() =>
        zResolverDisputaDto.parse({
          accion: 'revertir',
          notas: 'Ajustar monto',
          totalAmount: 1500,
        }),
      ).toThrow('Prohibido modificar montos directamente');

      expect(() =>
        zResolverDisputaDto.parse({
          accion: 'mantener',
          notas: 'Ajustar monto',
          monto: 500,
        }),
      ).toThrow('Prohibido modificar montos directamente');
    });
  });
});

describe('[SP-4 BE-ADMIN] DisputasController & AdminController — Endpoints de disputas', () => {
  it('POST /disputas crea la disputa con el usuario autenticado y responde 201', async () => {
    const disputasMock = {
      crearDisputa: vi.fn().mockResolvedValue(disputaEjemplo()),
      listarDisputas: vi.fn(),
      obtenerDisputa: vi.fn(),
      resolverDisputa: vi.fn(),
    };
    const controller = new DisputasController(disputasMock);

    const res = await controller.crearDisputa(
      { idTanda: 3, motivo: 'El organizador no confirmó mi pago', idPayment: 45 },
      { idUser: 7, email: 'ana@tandea.com', role: 'usuario' },
    );

    expect(disputasMock.crearDisputa).toHaveBeenCalledWith({
      idTanda: 3,
      idReporter: 7,
      rolReporter: 'usuario',
      motivo: 'El organizador no confirmó mi pago',
      idPayment: 45,
      idPayout: undefined,
    });
    expect(res.statusCode).toBe(HttpStatus.CREATED);
    expect(res.data.idDispute).toBe(10);
  });

  it('GET /admin/disputas y PATCH /admin/disputas/:id/resolver delegan al caso de uso', async () => {
    const resuelta = disputaEjemplo({
      status: 'RESUELTA',
      idResolver: 1,
      resolutionNotes: 'Comprobante válido',
    });
    const disputasMock = {
      crearDisputa: vi.fn(),
      listarDisputas: vi.fn().mockResolvedValue([disputaEjemplo()]),
      obtenerDisputa: vi.fn().mockResolvedValue(disputaEjemplo()),
      resolverDisputa: vi.fn().mockResolvedValue(resuelta),
    };
    const controller = new AdminController({} as any, {} as any, disputasMock);

    const lista = await controller.listarDisputas({ status: 'ABIERTA' });
    expect(disputasMock.listarDisputas).toHaveBeenCalledWith({
      status: 'ABIERTA',
      idTanda: undefined,
    });
    expect(lista.statusCode).toBe(HttpStatus.OK);

    const resultado = await controller.resolverDisputa(
      10,
      { accion: 'mantener', notas: 'Comprobante válido' },
      { idUser: 1, email: 'admin@tandea.com', role: 'admin_global' },
    );
    expect(disputasMock.resolverDisputa).toHaveBeenCalledWith({
      idDispute: 10,
      idAdminGlobal: 1,
      accion: 'mantener',
      notas: 'Comprobante válido',
    });
    expect(resultado).toEqual({
      statusCode: HttpStatus.OK,
      mensaje: 'Disputa resuelta exitosamente',
      data: resuelta,
    });
  });
});
