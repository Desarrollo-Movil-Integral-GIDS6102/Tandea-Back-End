import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

import { pagosTable, NewPagoRow } from './schema/pago.schema';
import { toPagoModel } from './mappers/pago.mapper';
import type { PagoModel } from '../models/pago.model';
import type { CreatePagoDto } from '../contracts/pago.contract';
import { DATABASE_TOKEN } from '../../common/tokens';

/**
 * PagoRepository — La única capa autorizada a tocar la base de datos en el módulo Pagos.
 *
 * Reglas de oro:
 *  1. NUNCA retorna una PagoRow directamente — siempre pasa por toPagoModel().
 *  2. No contiene lógica de negocio.
 *  3. Los errores de BD se propagan como excepciones nativas de NestJS.
 */
@Injectable()
export class PagoRepository {
  constructor(
    @Inject(DATABASE_TOKEN)
    private readonly db: NodePgDatabase,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inserta un nuevo pago en la base de datos.
   *
   * @param dto - DTO validado por Zod (nunca llega raw del HTTP request)
   * @returns PagoModel — modelo de dominio listo para el Service
   */
  async create(dto: CreatePagoDto): Promise<PagoModel> {
    const insert: NewPagoRow = {
      tandaId: dto.tandaId,
      participanteId: dto.participanteId,
      numeroPago: dto.numeroPago,
      monto: String(dto.monto),
      montoEfectivo: String(dto.montoEfectivo),
      montoTransferencia: String(dto.montoTransferencia),
      metodoPago: dto.metodoPago,
      estado: 'pendiente', // el estado inicial siempre lo decide el repositorio/dominio
      comprobanteUrl: dto.comprobanteUrl ?? null,
      fechaPago: dto.fechaPago,
    };

    const [row] = await this.db
      .insert(pagosTable)
      .values(insert)
      .returning();

    // ✅ Nunca retornamos `row` directamente — siempre mapeamos al modelo
    return toPagoModel(row);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<PagoModel | null> {
    const [row] = await this.db
      .select()
      .from(pagosTable)
      .where(eq(pagosTable.id, id))
      .limit(1);

    return row ? toPagoModel(row) : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND BY TANDA
  // ─────────────────────────────────────────────────────────────────────────

  async findByTandaId(tandaId: string): Promise<PagoModel[]> {
    const rows = await this.db
      .select()
      .from(pagosTable)
      .where(eq(pagosTable.tandaId, tandaId));

    return rows.map(toPagoModel);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRM — Doble confirmación (organizador / receptor)
  // ─────────────────────────────────────────────────────────────────────────

  async confirmarOrganizador(id: string): Promise<PagoModel> {
    const [row] = await this.db
      .update(pagosTable)
      .set({
        confirmadoOrganizadorEn: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pagosTable.id, id))
      .returning();

    return toPagoModel(row);
  }

  async confirmarReceptor(id: string): Promise<PagoModel> {
    const [row] = await this.db
      .update(pagosTable)
      .set({
        confirmadoReceptorEn: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pagosTable.id, id))
      .returning();

    return toPagoModel(row);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE OCR — Persistir resultado del proceso de validación OCR
  // ─────────────────────────────────────────────────────────────────────────

  async updateOcr(
    id: string,
    montoOcrValidado: number,
    ocrAprobado: boolean,
  ): Promise<PagoModel> {
    const [row] = await this.db
      .update(pagosTable)
      .set({
        montoOcrValidado: String(montoOcrValidado),
        ocrAprobado,
        updatedAt: new Date(),
      })
      .where(eq(pagosTable.id, id))
      .returning();

    return toPagoModel(row);
  }
}
