import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq } from 'drizzle-orm';

import { PagoRepositoryPort } from '../../../../domain/ports/out/pago-repository.port';
import { Pago } from '../../../../domain/entities/Pago';
import {
  paymentTable,
  evidenceTable,
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
        ocrDetectedAmount: data.ocrDetectedAmount,
        ocrVerified: data.ocrVerified,
      })
      .where(eq(paymentTable.idPayment, data.idPayment!))
      .returning();

    return toDomain(updatedRow, pago.evidenceUrl);
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
