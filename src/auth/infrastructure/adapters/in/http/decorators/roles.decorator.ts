import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir endpoints a uno o varios roles específicos.
 * Ejemplo de uso:
 *  @Roles('admin_global')
 *  @Roles('usuario', 'admin_global')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
