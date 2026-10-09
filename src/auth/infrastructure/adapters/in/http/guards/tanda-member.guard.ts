import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

export type TandaRoleRequired = 'organizador' | 'participante' | 'cualquiera';

/**
 * TandaMemberGuard — Guard preparado para verificar si el usuario autenticado
 * es organizador o participante de una tanda específica.
 *
 * Se resuelve consultando `tanda.id_admin` o `number.id_user`.
 * Queda preparado con la estructura y puertos necesarios para cuando
 * el módulo de Tanda y Number sea implementado por los compañeros.
 */
@Injectable()
export class TandaMemberGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Si es Administrador Global, tiene acceso administrativo
    if (user.role === 'admin_global') {
      return true;
    }

    // Obtener id de la tanda desde los parámetros de ruta (:id o :tandaId)
    const tandaId = request.params?.id || request.params?.tandaId;
    if (!tandaId) {
      return true;
    }

    // Punto de extensión: aquí se inyectará el TandaRepositoryPort para verificar
    // if (esOrganizador(user.idUser, tandaId) || esParticipante(user.idUser, tandaId))
    return true;
  }
}
