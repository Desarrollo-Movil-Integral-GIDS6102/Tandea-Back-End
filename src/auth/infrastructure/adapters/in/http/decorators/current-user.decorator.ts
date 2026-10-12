import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Decorador @CurrentUser(prop?) para extraer los datos del usuario autenticado
 * desde el request (previamente inyectado por JwtAuthGuard).
 *
 * Ejemplos:
 *  @CurrentUser() user: AuthenticatedUser
 *  @CurrentUser('idUser') userId: number
 *  @CurrentUser('role') role: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
