import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../auth/application/services/auth.service';
import { AuthUserEntity } from '../../../auth/domain/entities/auth-user.entity';
import type { AuthUserRepositoryPort } from '../../../auth/domain/ports/out/auth-user-repository.port';
import type { UsuarioAdminResumen } from '../../domain/ports/in/admin-usuarios-use-case.port';
import type { AdminEventsPort } from '../../domain/ports/out/admin-events.port';
import type {
  AdminUsuariosRepositoryPort,
  RegistroAuditoriaUsuario,
} from '../../domain/ports/out/admin-usuarios-repository.port';
import { AdminController } from '../../infrastructure/adapters/in/http/admin.controller';
import {
  ACCION_USUARIO_SUSPENDIDO,
  AdminUsuariosService,
} from './admin-usuarios.service';

function crearUsuarioEjemplo(parcial: Partial<UsuarioAdminResumen> = {}): UsuarioAdminResumen {
  return {
    idUser: 15,
    name: 'Carlos',
    lastName: 'Ramírez',
    email: 'carlos@tandea.com',
    role: 'usuario',
    active: true,
    createdAt: new Date('2026-10-10T12:00:00.000Z'),
    ...parcial,
  };
}

describe('[SP-4 BE-ADMIN / INT-ADMIN] AdminUsuariosService — Buscar y suspender usuarios', () => {
  let repo: {
    buscarUsuarios: ReturnType<typeof vi.fn>;
    obtenerPorId: ReturnType<typeof vi.fn>;
    suspenderConAuditoria: ReturnType<typeof vi.fn>;
  };
  let eventos: {
    publicarUsuarioSuspendido: ReturnType<typeof vi.fn>;
    publicarDisputaResuelta: ReturnType<typeof vi.fn>;
  };
  let servicio: AdminUsuariosService;

  beforeEach(() => {
    repo = {
      buscarUsuarios: vi.fn().mockResolvedValue([crearUsuarioEjemplo()]),
      obtenerPorId: vi.fn().mockResolvedValue(crearUsuarioEjemplo()),
      suspenderConAuditoria: vi
        .fn()
        .mockImplementation(async (registro: RegistroAuditoriaUsuario) =>
          crearUsuarioEjemplo({ idUser: registro.idUsuarioAfectado, active: false }),
        ),
    };
    eventos = {
      publicarUsuarioSuspendido: vi.fn().mockResolvedValue(undefined),
      publicarDisputaResuelta: vi.fn().mockResolvedValue(undefined),
    };
    servicio = new AdminUsuariosService(
      repo as unknown as AdminUsuariosRepositoryPort,
      eventos as unknown as AdminEventsPort,
    );
  });

  describe('buscarUsuarios', () => {
    it('envía el término recortado y el filtro active al repositorio', async () => {
      const resultado = await servicio.buscarUsuarios({ q: '  carlos@tandea.com  ', active: true });

      expect(repo.buscarUsuarios).toHaveBeenCalledWith({
        q: 'carlos@tandea.com',
        active: true,
      });
      expect(resultado).toHaveLength(1);
      expect(resultado[0].email).toBe('carlos@tandea.com');
    });

    it('convierte una búsqueda en blanco en undefined para listar todos', async () => {
      await servicio.buscarUsuarios({ q: '   ' });

      expect(repo.buscarUsuarios).toHaveBeenCalledWith({
        q: undefined,
        active: undefined,
      });
    });
  });

  describe('suspenderUsuario', () => {
    it('desactiva al usuario (active = false), registra en audit_log y emite el evento usuario.suspendido', async () => {
      const suspendido = await servicio.suspenderUsuario({
        idUser: 15,
        idAdminGlobal: 1,
        motivo: 'Incumplimiento reiterado de pagos',
      });

      expect(suspendido.active).toBe(false);
      expect(repo.suspenderConAuditoria).toHaveBeenCalledWith({
        idAdminGlobal: 1,
        idUsuarioAfectado: 15,
        actionType: ACCION_USUARIO_SUSPENDIDO,
        description:
          'Usuario Carlos Ramírez (carlos@tandea.com) suspendido: Incumplimiento reiterado de pagos',
      });
      expect(eventos.publicarUsuarioSuspendido).toHaveBeenCalledWith({
        idUser: 15,
        name: 'Carlos',
        lastName: 'Ramírez',
        email: 'carlos@tandea.com',
        motivo: 'Incumplimiento reiterado de pagos',
      });
    });

    it('usa una descripción por defecto en audit_log y emite evento sin motivo cuando no se envía motivo', async () => {
      await servicio.suspenderUsuario({
        idUser: 15,
        idAdminGlobal: 1,
      });

      expect(repo.suspenderConAuditoria).toHaveBeenCalledWith({
        idAdminGlobal: 1,
        idUsuarioAfectado: 15,
        actionType: ACCION_USUARIO_SUSPENDIDO,
        description:
          'Usuario Carlos Ramírez (carlos@tandea.com) suspendido por el Administrador Global',
      });
      expect(eventos.publicarUsuarioSuspendido).toHaveBeenCalledWith({
        idUser: 15,
        name: 'Carlos',
        lastName: 'Ramírez',
        email: 'carlos@tandea.com',
        motivo: undefined,
      });
    });

    it('lanza NotFoundException (404) si el usuario no existe', async () => {
      repo.obtenerPorId.mockResolvedValue(null);

      await expect(
        servicio.suspenderUsuario({ idUser: 999, idAdminGlobal: 1 }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.suspenderConAuditoria).not.toHaveBeenCalled();
    });

    it('lanza ForbiddenException (403) si se intenta suspender a un admin_global', async () => {
      repo.obtenerPorId.mockResolvedValue(
        crearUsuarioEjemplo({ idUser: 1, role: 'admin_global' }),
      );

      await expect(
        servicio.suspenderUsuario({ idUser: 1, idAdminGlobal: 1 }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.suspenderConAuditoria).not.toHaveBeenCalled();
    });

    it('lanza ConflictException (409) si el usuario ya está suspendido', async () => {
      repo.obtenerPorId.mockResolvedValue(crearUsuarioEjemplo({ active: false }));

      await expect(
        servicio.suspenderUsuario({ idUser: 15, idAdminGlobal: 1 }),
      ).rejects.toThrow(ConflictException);
      expect(repo.suspenderConAuditoria).not.toHaveBeenCalled();
    });

    it('tras suspender al usuario, ya no puede iniciar sesión en AuthService (403 Forbidden)', async () => {
      const password = 'Password123!*';
      const passwordHash = await bcrypt.hash(password, 4);
      let estadoActivo = true;

      repo.obtenerPorId.mockImplementation(async () =>
        crearUsuarioEjemplo({ active: estadoActivo }),
      );
      repo.suspenderConAuditoria.mockImplementation(async () => {
        estadoActivo = false;
        return crearUsuarioEjemplo({ active: false });
      });

      const authRepo: Partial<AuthUserRepositoryPort> = {
        findByEmail: vi.fn().mockImplementation(
          async () =>
            new AuthUserEntity(
              15,
              'carlos@tandea.com',
              passwordHash,
              'Carlos',
              'Ramírez',
              1,
              'usuario',
              estadoActivo,
            ),
        ),
      };

      const authService = new AuthService(
        authRepo as AuthUserRepositoryPort,
        { sendMail: vi.fn().mockResolvedValue(true) },
        { sign: vi.fn().mockReturnValue('jwt') } as any,
      );

      // Antes de suspender: puede iniciar sesión
      const antes = await authService.validateUser('carlos@tandea.com', password);
      expect(antes.active).toBe(true);

      // El admin global lo suspende
      await servicio.suspenderUsuario({
        idUser: 15,
        idAdminGlobal: 1,
        motivo: 'Cuenta suspendida por fraude',
      });

      // Después de suspender: ya no puede iniciar sesión
      await expect(
        authService.validateUser('carlos@tandea.com', password),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('[SP-4 BE-ADMIN] AdminController — Endpoints de usuarios', () => {
  it('GET /admin/usuarios valida query params y delega al caso de uso', async () => {
    const usuariosMock = {
      buscarUsuarios: vi.fn().mockResolvedValue([crearUsuarioEjemplo()]),
      suspenderUsuario: vi.fn(),
    };

    const controller = new AdminController({} as any, usuariosMock, {} as any);
    const respuesta = await controller.buscarUsuarios({ search: 'Carlos', active: 'true' });

    expect(usuariosMock.buscarUsuarios).toHaveBeenCalledWith({
      q: 'Carlos',
      active: true,
    });
    expect(respuesta).toEqual({
      statusCode: HttpStatus.OK,
      data: [crearUsuarioEjemplo()],
    });
  });

  it('PATCH /admin/usuarios/:id/suspender suspende al usuario con el id del admin autenticado', async () => {
    const suspendido = crearUsuarioEjemplo({ active: false });
    const usuariosMock = {
      buscarUsuarios: vi.fn(),
      suspenderUsuario: vi.fn().mockResolvedValue(suspendido),
    };
    const controller = new AdminController({} as any, usuariosMock, {} as any);
    const respuesta = await controller.suspenderUsuario(
      15,
      { motivo: 'Impago reiterado' },
      { idUser: 1, email: 'admin@tandea.com', role: 'admin_global' },
    );

    expect(usuariosMock.suspenderUsuario).toHaveBeenCalledWith({
      idUser: 15,
      idAdminGlobal: 1,
      motivo: 'Impago reiterado',
    });
    expect(respuesta).toEqual({
      statusCode: HttpStatus.OK,
      mensaje: 'Usuario suspendido exitosamente',
      data: suspendido,
    });
  });
});
