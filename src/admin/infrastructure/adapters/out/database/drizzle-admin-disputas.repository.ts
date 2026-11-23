import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  auditLogTable,
  disputeTable,
  numberTable,
  paymentTable,
  payoutTable,
  tandaTable,
  userTable,
} from '../../../../../database/tandea.schema';
import type {
  DisputaDetalle,
  DisputaResumen,
  EstadoDisputa,
  ListarDisputasFiltro,
} from '../../../../domain/ports/in/admin-disputas-use-case.port';
import type {
  AdminDisputasRepositoryPort,
  NuevaDisputaDatos,
  ResolucionDisputaTransaccion,
  TandaParaDisputa,
} from '../../../../domain/ports/out/admin-disputas-repository.port';

@Injectable()
export class DrizzleAdminDisputasRepository implements AdminDisputasRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async obtenerTanda(idTanda: number): Promise<TandaParaDisputa | null> {
    const [fila] = await this.db
      .select({
        idTanda: tandaTable.idTanda,
        idAdmin: tandaTable.idAdmin,
        name: tandaTable.name,
      })
      .from(tandaTable)
      .where(and(eq(tandaTable.idTanda, idTanda), isNull(tandaTable.deletedAt)))
      .limit(1);

    return fila ?? null;
  }

  async esParticipanteDeTanda(idTanda: number, idUser: number): Promise<boolean> {
    const [fila] = await this.db
      .select({ idNumber: numberTable.idNumber })
      .from(numberTable)
      .where(
        and(
          eq(numberTable.idTanda, idTanda),
          eq(numberTable.idUser, idUser),
          isNull(numberTable.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(fila);
  }

  async pagoPerteneceATanda(idPayment: number, idTanda: number): Promise<boolean> {
    const [fila] = await this.db
      .select({ idPayment: paymentTable.idPayment })
      .from(paymentTable)
      .innerJoin(numberTable, eq(numberTable.idNumber, paymentTable.idNumber))
      .where(and(eq(paymentTable.idPayment, idPayment), eq(numberTable.idTanda, idTanda)))
      .limit(1);

    return Boolean(fila);
  }

  async entregaPerteneceATanda(idPayout: number, idTanda: number): Promise<boolean> {
    const [fila] = await this.db
      .select({ idPayout: payoutTable.idPayout })
      .from(payoutTable)
      .innerJoin(numberTable, eq(numberTable.idNumber, payoutTable.idNumber))
      .where(and(eq(payoutTable.idPayout, idPayout), eq(numberTable.idTanda, idTanda)))
      .limit(1);

    return Boolean(fila);
  }

  async crearDisputa(datos: NuevaDisputaDatos): Promise<DisputaResumen> {
    const [insertada] = await this.db
      .insert(disputeTable)
      .values({
        idTanda: datos.idTanda,
        idReporter: datos.idReporter,
        reason: datos.reason,
        status: 'ABIERTA',
        idPayment: datos.idPayment ?? null,
        idPayout: datos.idPayout ?? null,
      })
      .returning({ idDispute: disputeTable.idDispute });

    const resumen = await this.obtenerResumenPorId(this.db, insertada.idDispute);
    return resumen!;
  }

  async listarDisputas(filtro?: ListarDisputasFiltro): Promise<DisputaResumen[]> {
    const condiciones: SQL[] = [];
    if (filtro?.status) {
      condiciones.push(eq(disputeTable.status, filtro.status));
    }
    if (filtro?.idTanda !== undefined) {
      condiciones.push(eq(disputeTable.idTanda, filtro.idTanda));
    }

    const filas = await this.db
      .select({
        idDispute: disputeTable.idDispute,
        idTanda: disputeTable.idTanda,
        nombreTanda: tandaTable.name,
        idReporter: disputeTable.idReporter,
        reporterName: userTable.name,
        reporterLastName: userTable.lastName,
        emailReporter: userTable.email,
        idResolver: disputeTable.idResolver,
        reason: disputeTable.reason,
        status: disputeTable.status,
        resolutionNotes: disputeTable.resolutionNotes,
        idPayment: disputeTable.idPayment,
        idPayout: disputeTable.idPayout,
        createdAt: disputeTable.createdAt,
        updatedAt: disputeTable.updatedAt,
        resolvedAt: disputeTable.resolvedAt,
      })
      .from(disputeTable)
      .innerJoin(tandaTable, eq(tandaTable.idTanda, disputeTable.idTanda))
      .innerJoin(userTable, eq(userTable.idUser, disputeTable.idReporter))
      .where(condiciones.length > 0 ? and(...condiciones) : undefined)
      .orderBy(desc(disputeTable.createdAt), desc(disputeTable.idDispute));

    return filas.map((f) => this.mapearResumen(f));
  }

  async obtenerPorId(idDispute: number): Promise<DisputaDetalle | null> {
    const resumen = await this.obtenerResumenPorId(this.db, idDispute);
    if (!resumen) {
      return null;
    }

    const bitacora = await this.db
      .select({
        idLog: auditLogTable.idLog,
        idUser: auditLogTable.idUser,
        actionType: auditLogTable.actionType,
        entityType: auditLogTable.entityType,
        entityId: auditLogTable.entityId,
        description: auditLogTable.description,
        createdAt: auditLogTable.createdAt,
      })
      .from(auditLogTable)
      .where(
        and(eq(auditLogTable.entityType, 'dispute'), eq(auditLogTable.entityId, idDispute)),
      )
      .orderBy(asc(auditLogTable.createdAt), asc(auditLogTable.idLog));

    return {
      ...resumen,
      bitacora,
    };
  }

  async resolverConAuditoria(datos: ResolucionDisputaTransaccion): Promise<DisputaResumen> {
    return this.db.transaction(async (tx) => {
      const ahora = new Date();

      // 1. Aplicar efecto de estado según la acción (SIN modificar ningún monto)
      if (datos.accion === 'revertir') {
        if (datos.idPayment !== null) {
          await tx
            .update(paymentTable)
            .set({
              status: 'RECHAZADO',
              confirmedByAdmin: false,
              rejectionReason: datos.notas,
              updatedAt: ahora,
            })
            .where(eq(paymentTable.idPayment, datos.idPayment));
        }

        if (datos.idPayout !== null) {
          const [payout] = await tx
            .update(payoutTable)
            .set({
              status: 'RECHAZADO',
              confirmedByRecipient: false,
              updatedAt: ahora,
            })
            .where(eq(payoutTable.idPayout, datos.idPayout))
            .returning({ idNumber: payoutTable.idNumber });

          if (payout) {
            await tx
              .update(numberTable)
              .set({ status: 'PENDIENTE', updatedAt: ahora })
              .where(eq(numberTable.idNumber, payout.idNumber));
          }
        }
      } else if (datos.accion === 'suspender') {
        await tx
          .update(tandaTable)
          .set({ status: 'SUSPENDIDA', updatedAt: ahora })
          .where(eq(tandaTable.idTanda, datos.idTanda));
      }

      // 2. Actualizar la disputa a RESUELTA con sus notas de resolución
      await tx
        .update(disputeTable)
        .set({
          status: 'RESUELTA',
          idResolver: datos.idAdminGlobal,
          resolutionNotes: datos.notas,
          resolvedAt: ahora,
          updatedAt: ahora,
        })
        .where(eq(disputeTable.idDispute, datos.idDispute));

      // 3. Registrar en audit_log en la misma transacción
      await tx.insert(auditLogTable).values({
        idUser: datos.idAdminGlobal,
        actionType: datos.actionType,
        entityType: 'dispute',
        entityId: datos.idDispute,
        description: datos.auditDescription,
      });

      const actualizado = await this.obtenerResumenPorId(tx, datos.idDispute);
      return actualizado!;
    });
  }

  private async obtenerResumenPorId(
    ejecutor: Pick<NodePgDatabase, 'select'>,
    idDispute: number,
  ): Promise<DisputaResumen | null> {
    const [fila] = await ejecutor
      .select({
        idDispute: disputeTable.idDispute,
        idTanda: disputeTable.idTanda,
        nombreTanda: tandaTable.name,
        idReporter: disputeTable.idReporter,
        reporterName: userTable.name,
        reporterLastName: userTable.lastName,
        emailReporter: userTable.email,
        idResolver: disputeTable.idResolver,
        reason: disputeTable.reason,
        status: disputeTable.status,
        resolutionNotes: disputeTable.resolutionNotes,
        idPayment: disputeTable.idPayment,
        idPayout: disputeTable.idPayout,
        createdAt: disputeTable.createdAt,
        updatedAt: disputeTable.updatedAt,
        resolvedAt: disputeTable.resolvedAt,
      })
      .from(disputeTable)
      .innerJoin(tandaTable, eq(tandaTable.idTanda, disputeTable.idTanda))
      .innerJoin(userTable, eq(userTable.idUser, disputeTable.idReporter))
      .where(eq(disputeTable.idDispute, idDispute))
      .limit(1);

    return fila ? this.mapearResumen(fila) : null;
  }

  private mapearResumen(fila: {
    idDispute: number;
    idTanda: number;
    nombreTanda: string;
    idReporter: number;
    reporterName: string;
    reporterLastName: string;
    emailReporter: string;
    idResolver: number | null;
    reason: string;
    status: EstadoDisputa;
    resolutionNotes: string | null;
    idPayment: number | null;
    idPayout: number | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  }): DisputaResumen {
    return {
      idDispute: fila.idDispute,
      idTanda: fila.idTanda,
      nombreTanda: fila.nombreTanda,
      idReporter: fila.idReporter,
      nombreReporter: [fila.reporterName, fila.reporterLastName].filter(Boolean).join(' '),
      emailReporter: fila.emailReporter,
      idResolver: fila.idResolver,
      reason: fila.reason,
      status: fila.status,
      resolutionNotes: fila.resolutionNotes,
      idPayment: fila.idPayment,
      idPayout: fila.idPayout,
      createdAt: fila.createdAt,
      updatedAt: fila.updatedAt,
      resolvedAt: fila.resolvedAt,
    };
  }
}
