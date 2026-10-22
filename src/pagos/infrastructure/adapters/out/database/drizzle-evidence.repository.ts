import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DATABASE_TOKEN } from '../../../../../common/tokens';
import { evidenceTable } from '../../../../../database/tandea.schema';
import {
  EvidenceRepositoryPort,
  GuardarEvidenceProps,
  EvidenceRecord,
} from '../../../../domain/ports/out/evidence-repository.port';

@Injectable()
export class DrizzleEvidenceRepository implements EvidenceRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async guardarComprobantePago(
    props: GuardarEvidenceProps,
  ): Promise<EvidenceRecord> {
    const [inserted] = await this.db
      .insert(evidenceTable)
      .values({
        idPayment: props.idPayment,
        idPayout: null, // Satisface la restricción XOR evidence_exactly_one_parent_chk
        fileUrl: props.fileUrl,
      })
      .returning();

    return {
      idEvidence: inserted.idEvidence,
      idPayment: inserted.idPayment,
      idPayout: inserted.idPayout,
      fileUrl: inserted.fileUrl,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  }

  async obtenerEvidenciasPorPago(idPayment: number): Promise<EvidenceRecord[]> {
    const rows = await this.db
      .select()
      .from(evidenceTable)
      .where(eq(evidenceTable.idPayment, idPayment));

    return rows.map((row) => ({
      idEvidence: row.idEvidence,
      idPayment: row.idPayment,
      idPayout: row.idPayout,
      fileUrl: row.fileUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
