import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

import { PagoRepositoryPort } from '../../../../domain/ports/out/pago-repository.port';
import { Pago } from '../../../../domain/entities/pago.entity';
import { pagosTable } from './schema/pago.schema';
import { toDomain, toPersistence } from './mappers/pago.mapper';
import { DATABASE_TOKEN } from '../../../../../common/tokens';

/**
 * Adaptador Secundario (Driven / Outbound Adapter): DrizzlePagoRepository
 *
 * Implementa el puerto de salida `PagoRepositoryPort`.
 * Maneja los detalles específicos del ORM Drizzle y la base de datos PostgreSQL.
 */
@Injectable()
export class DrizzlePagoRepository implements PagoRepositoryPort {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  async create(pago: Pago): Promise<Pago> {
    const data = toPersistence(pago);
    const [row] = await this.db.insert(pagosTable).values(data).returning();
    return toDomain(row);
  }

  async findById(id: string): Promise<Pago | null> {
    const [row] = await this.db
      .select()
      .from(pagosTable)
      .where(eq(pagosTable.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return toDomain(row);
  }

  async update(pago: Pago): Promise<Pago> {
    const data = toPersistence(pago);
    const [updatedRow] = await this.db
      .update(pagosTable)
      .set({
        estado: data.estado,
        confirmadoOrganizadorEn: data.confirmadoOrganizadorEn,
        confirmadoReceptorEn: data.confirmadoReceptorEn,
        montoOcrValidado: data.montoOcrValidado,
        ocrAprobado: data.ocrAprobado,
        updatedAt: new Date(),
      })
      .where(eq(pagosTable.id, data.id!))
      .returning();

    return toDomain(updatedRow);
  }
}
