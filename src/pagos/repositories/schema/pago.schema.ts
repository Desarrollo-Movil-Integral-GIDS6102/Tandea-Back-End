import { pgTable, uuid, numeric, varchar, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

/**
 * Definición de la tabla `pagos` en Drizzle ORM.
 *
 * Principios:
 *  - Los nombres de columna siguen snake_case (convención de PostgreSQL).
 *  - El modelo de dominio (PagoModel) usará camelCase — la conversión la hace el mapper.
 *  - numeric() para montos monetarios para evitar errores de punto flotante en BD.
 */
export const pagosTable = pgTable('pagos', {
  id: uuid('id').primaryKey().defaultRandom(),

  tandaId: uuid('tanda_id').notNull(),
  participanteId: uuid('participante_id').notNull(),
  numeroPago: integer('numero_pago').notNull(),

  // ── Montos ────────────────────────────────────────────────────────────────
  // precision=12, scale=2 → soporta hasta $9,999,999,999.99
  monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),
  montoEfectivo: numeric('monto_efectivo', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  montoTransferencia: numeric('monto_transferencia', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),

  // ── Método y Estado ───────────────────────────────────────────────────────
  metodoPago: varchar('metodo_pago', { length: 20 }).notNull(),
  estado: varchar('estado', { length: 30 }).notNull().default('pendiente'),

  // ── Comprobante y OCR ─────────────────────────────────────────────────────
  comprobanteUrl: varchar('comprobante_url', { length: 500 }),
  montoOcrValidado: numeric('monto_ocr_validado', { precision: 12, scale: 2 }),
  ocrAprobado: boolean('ocr_aprobado'),

  // ── Doble Confirmación ────────────────────────────────────────────────────
  confirmadoOrganizadorEn: timestamp('confirmado_organizador_en', {
    withTimezone: true,
  }),
  confirmadoReceptorEn: timestamp('confirmado_receptor_en', {
    withTimezone: true,
  }),

  // ── Fechas ────────────────────────────────────────────────────────────────
  fechaPago: timestamp('fecha_pago', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Tipo inferido de una fila SELECT — usado SOLO dentro del mapper, nunca exportado al dominio */
export type PagoRow = typeof pagosTable.$inferSelect;

/** Tipo inferido para INSERT — usado SOLO en el repository */
export type NewPagoRow = typeof pagosTable.$inferInsert;
