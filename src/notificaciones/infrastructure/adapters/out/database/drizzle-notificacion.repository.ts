import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  notificationTable,
  numberTable,
  paymentTable,
  tandaTable,
  userTable,
} from '../../../../../database/tandea.schema';
import {
  ContextoPago,
  NotificacionRepositoryPort,
  NuevaNotificacion,
} from '../../../../domain/ports/out/notificacion-repository.port';

@Injectable()
export class DrizzleNotificacionRepository implements NotificacionRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async buscarContextoPago(paymentId: number): Promise<ContextoPago | null> {
    const [row] = await this.db
      .select({
        idTanda: tandaTable.idTanda,
        nombreTanda: tandaTable.name,
        idOrganizador: tandaTable.idAdmin,
        idParticipante: numberTable.idUser,
        nombre: userTable.name,
        apellido: userTable.lastName,
        numero: numberTable.numberValue,
      })
      .from(paymentTable)
      .innerJoin(numberTable, eq(numberTable.idNumber, paymentTable.idNumber))
      .innerJoin(tandaTable, eq(tandaTable.idTanda, numberTable.idTanda))
      .leftJoin(userTable, eq(userTable.idUser, numberTable.idUser))
      .where(eq(paymentTable.idPayment, paymentId))
      .limit(1);

    if (!row) return null;

    return {
      paymentId,
      idTanda: row.idTanda,
      nombreTanda: row.nombreTanda,
      idOrganizador: row.idOrganizador,
      idParticipante: row.idParticipante,
      nombreParticipante: row.nombre ? `${row.nombre} ${row.apellido ?? ''}`.trim() : null,
      numero: row.numero,
    };
  }

  async guardar(notificacion: NuevaNotificacion): Promise<number> {
    const [row] = await this.db
      .insert(notificationTable)
      .values({
        idUser: notificacion.idUser,
        idTanda: notificacion.idTanda,
        type: notificacion.type,
        message: notificacion.message,
      })
      .returning({ idNotification: notificationTable.idNotification });

    return row.idNotification;
  }
}
