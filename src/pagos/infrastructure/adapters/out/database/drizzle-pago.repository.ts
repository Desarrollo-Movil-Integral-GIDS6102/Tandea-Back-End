import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import {
  NumeroConCuota,
  PagoRepositoryPort,
} from '../../../../domain/ports/out/pago-repository.port';
import { Pago } from '../../../../domain/entities/Pago';
import { PagoDuplicadoError } from '../../../../domain/errors/pago.errors';
import {
  paymentTable,
  evidenceTable,
  numberTable,
  tandaTable,
} from '../../../../../database/tandea.schema';
import { toDomain, toPersistence } from './mappers/pago.mapper';
import { DATABASE_TOKEN } from '../../../../../common/tokens';

/**
 * Adaptador Secundario (Driven / Outbound Adapter): DrizzlePagoRepository
 *
 * Implementa el puerto de salida `PagoRepositoryPort` sobre las tablas
 * definitivas `payment` y `evidence` (src/database/tandea.schema.ts).
 */
@Injectable()
export class DrizzlePagoRepository implements PagoRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async create(pago: Pago): Promise<Pago> {
    const { idPayment: _omit, ...data } = toPersistence(pago);

    return this.db.transaction(async (tx) => {
      // Bloquea el número para que dos registros simultáneos no generen duplicados
      await tx
        .select({ idNumber: numberTable.idNumber })
        .from(numberTable)
        .where(eq(numberTable.idNumber, data.idNumber))
        .for('update');

      const [activo] = await tx
        .select({ idPayment: paymentTable.idPayment })
        .from(paymentTable)
        .where(this.pagoActivoDe(data.idNumber))
        .limit(1);

      if (activo) {
        throw new PagoDuplicadoError(data.idNumber);
      }

      const [row] = await tx.insert(paymentTable).values(data).returning();

      if (pago.evidenceUrl) {
        await tx.insert(evidenceTable).values({
          idPayment: row.idPayment,
          idPayout: null, // Satisface la restricción XOR evidence_exactly_one_parent_chk
          fileUrl: pago.evidenceUrl,
        });
      }

      return toDomain(row, pago.evidenceUrl);
    });
  }

  async buscarNumeroConCuota(idNumber: number): Promise<NumeroConCuota | null> {
    const [row] = await this.db
      .select({
        idNumber: numberTable.idNumber,
        idUser: numberTable.idUser,
        roundNumber: numberTable.roundNumber,
        idTanda: tandaTable.idTanda,
        contributionAmount: tandaTable.contributionAmount,
        idAdmin: tandaTable.idAdmin,
      })
      .from(numberTable)
      .leftJoin(
        tandaTable,
        and(
          eq(tandaTable.idTanda, numberTable.idTanda),
          isNull(tandaTable.deletedAt),
        ),
      )
      .where(and(eq(numberTable.idNumber, idNumber), isNull(numberTable.deletedAt)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      idNumber: row.idNumber,
      idUser: row.idUser,
      roundNumber: row.roundNumber,
      tanda:
        row.idTanda != null && row.contributionAmount != null
          ? {
              idTanda: row.idTanda,
              contributionAmount: parseFloat(row.contributionAmount),
              idAdmin: row.idAdmin ?? undefined,
            }
          : null,
    };
  }

  async existePagoActivo(idNumber: number): Promise<boolean> {
    const [row] = await this.db
      .select({ idPayment: paymentTable.idPayment })
      .from(paymentTable)
      .where(this.pagoActivoDe(idNumber))
      .limit(1);

    return row !== undefined;
  }

  async findById(idPayment: number): Promise<Pago | null> {
    const [row] = await this.db
      .select()
      .from(paymentTable)
      .where(eq(paymentTable.idPayment, idPayment))
      .limit(1);

    if (!row) {
      return null;
    }

    return toDomain(row, await this.ultimaEvidencia(idPayment));
  }

  async update(pago: Pago): Promise<Pago> {
    const data = toPersistence(pago);
    const [updatedRow] = await this.db
      .update(paymentTable)
      .set({
        status: data.status,
        confirmedByParticipant: data.confirmedByParticipant,
        confirmedByAdmin: data.confirmedByAdmin,
        rejectionReason: data.rejectionReason,
        ocrDetectedAmount: data.ocrDetectedAmount,
        ocrVerified: data.ocrVerified
      })
      .where(eq(paymentTable.idPayment, data.idPayment!))
      .returning();

    return toDomain(updatedRow, pago.evidenceUrl);
  }

  private pagoActivoDe(idNumber: number) {
    return and(
      eq(paymentTable.idNumber, idNumber),
      inArray(paymentTable.status, ['PENDIENTE', 'CONFIRMADO']),
    );
  }

  private async ultimaEvidencia(idPayment: number): Promise<string | null> {
    const [evidence] = await this.db
      .select({ fileUrl: evidenceTable.fileUrl })
      .from(evidenceTable)
      .where(eq(evidenceTable.idPayment, idPayment))
      .orderBy(desc(evidenceTable.createdAt))
      .limit(1);

    return evidence?.fileUrl ?? null;
  }
}
