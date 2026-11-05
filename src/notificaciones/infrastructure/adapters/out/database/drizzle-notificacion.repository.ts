import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
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
  TipoNotificacion,
} from '../../../../domain/ports/out/notificacion-repository.port';
import type { TandaParaRecordatorio } from '../../../../domain/services/recordatorios-pago';
import type { PeriodicidadTanda } from '../../../../../tandas/domain/services/calcular-plan';

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

  async listarTandasParaRecordatorio(): Promise<TandaParaRecordatorio[]> {
    const tandas = await this.db
      .select({
        idTanda: tandaTable.idTanda,
        nombre: tandaTable.name,
        startDate: tandaTable.startDate,
        periodicidad: tandaTable.periodicity,
        montoCuota: tandaTable.contributionAmount,
        numParticipantes: tandaTable.numParticipants,
        numVueltas: tandaTable.numRounds,
        tieneNumeroMuerto: tandaTable.hasDeadNumber,
        diasGracia: tandaTable.graceDays,
      })
      .from(tandaTable)
      .where(
        and(
          eq(tandaTable.status, 'ACTIVA'),
          eq(tandaTable.active, true),
          isNull(tandaTable.deletedAt),
        ),
      );

    if (tandas.length === 0) return [];

    const numeros = await this.db
      .select({
        idTanda: numberTable.idTanda,
        idNumber: numberTable.idNumber,
        numero: numberTable.numberValue,
        idUser: numberTable.idUser,
        tienePagoActivo: sql<boolean>`exists (
          select 1 from ${paymentTable}
          where ${paymentTable.idNumber} = ${numberTable.idNumber}
            and ${paymentTable.status} in ('PENDIENTE', 'CONFIRMADO')
        )`,
      })
      .from(numberTable)
      .where(
        and(
          inArray(numberTable.idTanda, tandas.map((t) => t.idTanda)),
          eq(numberTable.isDeadNumber, false),
          isNotNull(numberTable.idUser),
          isNull(numberTable.deletedAt),
        ),
      );

    return tandas.map((t) => ({
      ...t,
      periodicidad: t.periodicidad as PeriodicidadTanda,
      montoCuota: Number(t.montoCuota),
      numeros: numeros
        .filter((n) => n.idTanda === t.idTanda)
        .map((n) => ({
          idNumber: n.idNumber,
          numero: n.numero,
          idUser: n.idUser!,
          tienePagoActivo: Boolean(n.tienePagoActivo),
        })),
    }));
  }

  async existeNotificacionDesde(
    idUser: number,
    idTanda: number,
    type: TipoNotificacion,
    desde: Date,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ idNotification: notificationTable.idNotification })
      .from(notificationTable)
      .where(
        and(
          eq(notificationTable.idUser, idUser),
          eq(notificationTable.idTanda, idTanda),
          eq(notificationTable.type, type),
          gte(notificationTable.createdAt, desde),
        ),
      )
      .limit(1);

    return row !== undefined;
  }
}
