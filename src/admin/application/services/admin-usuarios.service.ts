import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AdminUsuariosUseCasePort,
  BuscarUsuariosFiltro,
  SuspenderUsuarioCommand,
  UsuarioAdminResumen,
} from '../../domain/ports/in/admin-usuarios-use-case.port';
import {
  ADMIN_EVENTS_PORT,
  type AdminEventsPort,
} from '../../domain/ports/out/admin-events.port';
import {
  ADMIN_USUARIOS_REPOSITORY_PORT,
  type AdminUsuariosRepositoryPort,
} from '../../domain/ports/out/admin-usuarios-repository.port';

export const ACCION_USUARIO_SUSPENDIDO = 'USUARIO_SUSPENDIDO';

/**
 * [SP-4 BE-ADMIN / INT-ADMIN] Búsqueda y suspensión de usuarios por el Administrador Global.
 * Cada suspensión desactiva la cuenta (`active = false`), deja constancia inmutable
 * en `audit_log` (`entity_type = 'user'`) y emite el evento `usuario.suspendido`.
 */
@Injectable()
export class AdminUsuariosService implements AdminUsuariosUseCasePort {
  constructor(
    @Inject(ADMIN_USUARIOS_REPOSITORY_PORT)
    private readonly repositorio: AdminUsuariosRepositoryPort,
    @Optional()
    @Inject(ADMIN_EVENTS_PORT)
    private readonly eventos?: AdminEventsPort,
  ) {}

  async buscarUsuarios(filtro?: BuscarUsuariosFiltro): Promise<UsuarioAdminResumen[]> {
    const termino = filtro?.q?.trim();
    return this.repositorio.buscarUsuarios({
      q: termino && termino.length > 0 ? termino : undefined,
      active: filtro?.active,
    });
  }

  async suspenderUsuario(comando: SuspenderUsuarioCommand): Promise<UsuarioAdminResumen> {
    const usuario = await this.repositorio.obtenerPorId(comando.idUser);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (usuario.idUser === comando.idAdminGlobal || usuario.role === 'admin_global') {
      throw new ForbiddenException('No se puede suspender a un administrador global');
    }

    if (!usuario.active) {
      throw new ConflictException('El usuario ya se encuentra suspendido');
    }

    const motivo = comando.motivo?.trim();
    const description = motivo
      ? `Usuario ${usuario.name} ${usuario.lastName} (${usuario.email}) suspendido: ${motivo}`
      : `Usuario ${usuario.name} ${usuario.lastName} (${usuario.email}) suspendido por el Administrador Global`;

    const suspendido = await this.repositorio.suspenderConAuditoria({
      idAdminGlobal: comando.idAdminGlobal,
      idUsuarioAfectado: usuario.idUser,
      actionType: ACCION_USUARIO_SUSPENDIDO,
      description,
    });

    await this.eventos?.publicarUsuarioSuspendido({
      idUser: usuario.idUser,
      name: usuario.name,
      lastName: usuario.lastName,
      email: usuario.email,
      motivo: motivo && motivo.length > 0 ? motivo : undefined,
    });

    return suspendido;
  }
}
