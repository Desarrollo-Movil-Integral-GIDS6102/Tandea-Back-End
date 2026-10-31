import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../../../../../common/tokens';
import {
  paymentTable,
  numberTable,
  tandaTable,
} from '../../../../../../database/tandea.schema';

export type TandaRoleRequired = 'organizador' | 'participante' | 'cualquiera';

/**
 * TandaMemberGuard — Verifica si el usuario autenticado es el organizador (id_admin)
 * de la tanda asociada al recurso solicitado.
 *
 * Si es 'admin_global', permite el acceso administrativo irrestricto.
 * Para rutas de pagos (/pagos/:id/...), resuelve la tanda vinculada al pago.
 * Si el usuario no es el organizador de la tanda, lanza ForbiddenException (403).
 */
@Injectable()
export class TandaMemberGuard implements CanActivate {
  constructor(
    @Optional()
    @Inject(DATABASE_TOKEN)
    private readonly db?: NodePgDatabase,
  ) {}

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

    // Obtener id desde los parámetros de ruta (:id o :tandaId)
    const paramId = request.params?.id || request.params?.tandaId;
    if (!paramId) {
      return true;
    }

    const numericId = Number(paramId);
    if (isNaN(numericId)) {
      return true;
    }

    if (!this.db) {
      return true;
    }

    const url = request.raw?.url || request.url || '';

    // Si la ruta pertenece al módulo de pagos (/pagos/:id/...)
    if (url.includes('/pagos')) {
      const [record] = await this.db
        .select({
          idPayment: paymentTable.idPayment,
          idAdmin: tandaTable.idAdmin,
        })
        .from(paymentTable)
        .leftJoin(numberTable, eq(numberTable.idNumber, paymentTable.idNumber))
        .leftJoin(tandaTable, eq(tandaTable.idTanda, numberTable.idTanda))
        .where(eq(paymentTable.idPayment, numericId))
        .limit(1);

      // Si el pago no existe en base de datos, permitimos continuar para que
      // el caso de uso del servicio lance PagoNotFoundError (HTTP 404).
      if (!record) {
        return true;
      }

      // Si el usuario autenticado no es el organizador (idAdmin) de la tanda:
      if (record.idAdmin !== user.idUser) {
        throw new ForbiddenException(
          'Solo el administrador de la tanda puede realizar esta acción',
        );
      }

      return true;
    }

    // Si la ruta pertenece a tandas directas (/tandas/:id o :tandaId)
    const [tanda] = await this.db
      .select({ idAdmin: tandaTable.idAdmin })
      .from(tandaTable)
      .where(eq(tandaTable.idTanda, numericId))
      .limit(1);

    if (tanda && tanda.idAdmin !== user.idUser) {
      throw new ForbiddenException(
        'Solo el administrador de la tanda puede realizar esta acción',
      );
    }

    return true;
  }
}
