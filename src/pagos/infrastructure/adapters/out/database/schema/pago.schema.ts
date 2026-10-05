import { pgTable, uuid, numeric, varchar, boolean, timestamp, integer } from 'drizzle-orm/pg-core';

/**
 * Esquema de base de datos para `pagos` (Drizzle ORM).
 *
 * En Arquitectura Hexagonal:
 *  - Este archivo pertenece exclusivamente a la infraestructura (Adaptador de persistencia).
 *  - El dominio NO conoce esta definición de tabla.
 */
export const pagosTable = pgTable('pagos', {
  id: uuid('id').primaryKey().defaultRandom(),

  tandaId: uuid('tanda_id').notNull(),
  participanteId: uuid('participante_id').notNull(),
  numeroPago: integer('numero_pago').notNull(),

  // ── Montos ────────────────────────────────────────────────────────────────
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

export type PagoRow = typeof pagosTable.$inferSelect;
export type NewPagoRow = typeof pagosTable.$inferInsert;
