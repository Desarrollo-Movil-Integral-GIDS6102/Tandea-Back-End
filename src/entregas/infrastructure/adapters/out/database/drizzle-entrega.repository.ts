import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, isNull, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import {
  disputeTable,
  evidenceTable,
  numberTable,
  payoutTable,
  tandaTable,
} from '../../../../../database/tandea.schema';
import {
  EntregaRecord,
  EntregaRepositoryPort,
  NumeroParaEntrega,
  RegistrarEntregaData,
} from '../../../../domain/ports/out/entrega-repository.port';

@Injectable()
export class DrizzleEntregaRepository implements EntregaRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async buscarNumero(idNumber: number): Promise<NumeroParaEntrega | null> {
    const [row] = await this.db
      .select({
        idNumber: numberTable.idNumber,
        numberValue: numberTable.numberValue,
        idUser: numberTable.idUser,
        isDeadNumber: numberTable.isDeadNumber,
        status: numberTable.status,
        idTanda: tandaTable.idTanda,
        idAdmin: tandaTable.idAdmin,
        tandaStatus: tandaTable.status,
        contributionAmount: tandaTable.contributionAmount,
        numParticipants: tandaTable.numParticipants,
      })
      .from(numberTable)
      .innerJoin(tandaTable, eq(tandaTable.idTanda, numberTable.idTanda))
      .where(and(eq(numberTable.idNumber, idNumber), isNull(numberTable.deletedAt)))
      .limit(1);

    return row ? { ...row, contributionAmount: Number(row.contributionAmount) } : null;
  }

  async buscarTurnoVigente(idTanda: number): Promise<number | null> {
    const [row] = await this.db
      .select({ idNumber: numberTable.idNumber })
      .from(numberTable)
      .where(this.turnoAbierto(idTanda))
      .orderBy(asc(numberTable.numberValue))
      .limit(1);

    return row?.idNumber ?? null;
  }

  async registrar(data: RegistrarEntregaData): Promise<number | null> {
    return this.db.transaction(async (tx) => {
      // Solo un registro pasa de PENDIENTE: evita dos entregas simultáneas del mismo turno
      const actualizados = await tx
        .update(numberTable)
        .set({ status: 'ENTREGA_PENDIENTE_CONFIRMACION' })
        .where(
          and(
            eq(numberTable.idNumber, data.idNumber),
            ne(numberTable.status, 'ENTREGA_PENDIENTE_CONFIRMACION'),
            ne(numberTable.status, 'ENTREGADO'),
          ),
        )
        .returning({ idNumber: numberTable.idNumber });
      if (actualizados.length === 0) {
        return null;
      }

      const [payout] = await tx
        .insert(payoutTable)
        .values({
          idNumber: data.idNumber,
          transferAmount: data.transferAmount.toFixed(2),
          cashAmount: data.cashAmount.toFixed(2),
          totalAmount: data.totalAmount.toFixed(2),
          confirmedByAdmin: true,
        })
        .returning({ idPayout: payoutTable.idPayout });

      await tx.insert(evidenceTable).values({ idPayout: payout.idPayout, fileUrl: data.evidenceUrl });
      return payout.idPayout;
    });
  }

  async buscarPorId(idPayout: number): Promise<EntregaRecord | null> {
    const [row] = await this.db
      .select({
        idPayout: payoutTable.idPayout,
        idNumber: payoutTable.idNumber,
        numberValue: numberTable.numberValue,
        idTanda: tandaTable.idTanda,
        nombreTanda: tandaTable.name,
        idUser: numberTable.idUser,
        idAdmin: tandaTable.idAdmin,
        transferAmount: payoutTable.transferAmount,
        cashAmount: payoutTable.cashAmount,
        totalAmount: payoutTable.totalAmount,
        confirmedByAdmin: payoutTable.confirmedByAdmin,
        confirmedByRecipient: payoutTable.confirmedByRecipient,
        status: payoutTable.status,
        evidenceUrl: evidenceTable.fileUrl,
        createdAt: payoutTable.createdAt,
      })
      .from(payoutTable)
      .innerJoin(numberTable, eq(numberTable.idNumber, payoutTable.idNumber))
      .innerJoin(tandaTable, eq(tandaTable.idTanda, numberTable.idTanda))
      .leftJoin(evidenceTable, eq(evidenceTable.idPayout, payoutTable.idPayout))
      .where(eq(payoutTable.idPayout, idPayout))
      .limit(1);

    if (!row) {
      return null;
    }
    return {
      ...row,
      transferAmount: Number(row.transferAmount),
      cashAmount: Number(row.cashAmount),
      totalAmount: Number(row.totalAmount),
    };
  }

  async confirmarRecepcion(idPayout: number): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [payout] = await tx
        .update(payoutTable)
        .set({ confirmedByRecipient: true, status: 'CONFIRMADO' })
        .where(and(eq(payoutTable.idPayout, idPayout), eq(payoutTable.status, 'PENDIENTE')))
        .returning({ idNumber: payoutTable.idNumber });
      if (!payout) {
        return false;
      }

      const [numero] = await tx
        .update(numberTable)
        .set({ status: 'ENTREGADO' })
        .where(eq(numberTable.idNumber, payout.idNumber))
        .returning({ idTanda: numberTable.idTanda });

      const [abiertos] = await tx
        .select({ total: count() })
        .from(numberTable)
        .where(this.turnoAbierto(numero.idTanda));

      // shortcut: los números solo existen para la vuelta 1; con varias vueltas hay que
      // generar la siguiente aquí en lugar de finalizar
      if (Number(abiertos?.total ?? 0) === 0) {
        await tx
          .update(tandaTable)
          .set({ status: 'FINALIZADA' })
          .where(eq(tandaTable.idTanda, numero.idTanda));
      }
      return true;
    });
  }

  async crearDisputa(
    idTanda: number,
    idPayout: number,
    idReporter: number,
    motivo: string,
  ): Promise<void> {
    await this.db.insert(disputeTable).values({ idTanda, idPayout, idReporter, reason: motivo });
  }

  /** Números de participantes (#1..#N) cuyo turno sigue sin cerrarse. */
  private turnoAbierto(idTanda: number) {
    return and(
      eq(numberTable.idTanda, idTanda),
      eq(numberTable.isDeadNumber, false),
      gte(numberTable.numberValue, 1),
      ne(numberTable.status, 'ENTREGADO'),
      isNull(numberTable.deletedAt),
    );
  }
}
