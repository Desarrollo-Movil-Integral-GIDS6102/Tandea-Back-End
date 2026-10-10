// =============================================================================
// Tandea — src/database/tandea.schema.ts (Drizzle ORM + PostgreSQL)
// Basado en el "Anexo — Documentación de la Base de Datos".
//
// REVISIÓN OBLIGATORIA: debe ser revisado y aprobado por los 3 integrantes
// (Brandon, Karen, Lizeth) vía Pull Request antes de migrar.
//
// Convención: exports con sufijo `Table` (igual que `pagosTable` de la plantilla).
// Todas las tablas se definen juntas para que las FK cruzadas
// (evidence -> payment/payout, dispute -> payment/payout) salgan en UNA sola
// migración. El CHECK de `evidence` se genera solo en esa migración.
// =============================================================================

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

// -----------------------------------------------------------------------------
// ENUMs de status (PROPUESTA de valores: confirmar entre los 3)
// -----------------------------------------------------------------------------
export const tandaStatusEnum = pgEnum('tanda_status', [
  'PENDIENTE', // creada, aún se unen participantes
  'ACTIVA', // en curso
  'FINALIZADA', // todas las vueltas completadas
  'SUSPENDIDA', // suspendida por Administrador Global
  'CANCELADA',
]);

export const numberStatusEnum = pgEnum('number_status', [
  'PENDIENTE', // aún no le toca cobrar
  'EN_RIESGO', // pagos faltantes y sin número muerto disponible
  'ENTREGA_PENDIENTE_CONFIRMACION', // organizador subió evidencia, falta receptor
  'ENTREGADO', // doble confirmación completa, turno cerrado
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDIENTE', // falta alguna de las dos confirmaciones
  'CONFIRMADO', // confirmed_by_participant AND confirmed_by_admin
  'RECHAZADO', // el organizador lo rechazó
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'PENDIENTE',
  'CONFIRMADO', // confirmed_by_admin AND confirmed_by_recipient
  'RECHAZADO',
]);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'ABIERTA',
  'EN_REVISION',
  'RESUELTA',
  'DESCARTADA',
]);

// -----------------------------------------------------------------------------
// Helpers de timestamps (con zona horaria, como en la plantilla)
// -----------------------------------------------------------------------------
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Solo role, user, tanda y number. NUNCA en payment, payout, evidence, audit_log.
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

// -----------------------------------------------------------------------------
// role  (con deleted_at)
// -----------------------------------------------------------------------------
export const roleTable = pgTable('role', {
  idRole: serial('id_role').primaryKey(),
  nameRole: varchar('name_role', { length: 100 }).notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

// -----------------------------------------------------------------------------
// user  (con deleted_at)
// -----------------------------------------------------------------------------
export const userTable = pgTable(
  'user',
  {
    idUser: serial('id_user').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    age: integer('age'),
    gender: varchar('gender', { length: 50 }), // informativo, sin uso en MVP
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    idRole: integer('id_role')
      .notNull()
      .references(() => roleTable.idRole),
    active: boolean('active').notNull().default(true), // false = suspendido
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('user_id_role_idx').on(t.idRole)],
);

// -----------------------------------------------------------------------------
// tanda_type  (catálogo, sin deleted_at)
// -----------------------------------------------------------------------------
export const tandaTypeTable = pgTable('tanda_type', {
  idTandaType: serial('id_tanda_type').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
});

// -----------------------------------------------------------------------------
// tanda  (con deleted_at)
// -----------------------------------------------------------------------------
export const tandaTable = pgTable(
  'tanda',
  {
    idTanda: serial('id_tanda').primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'), // nulo mientras esté activa
    contributionAmount: numeric('contribution_amount', {
      precision: 12,
      scale: 2,
    }).notNull(),
    numParticipants: integer('num_participants').notNull(),
    numRounds: integer('num_rounds').notNull(),
    graceDays: integer('grace_days').notNull(),
    hasDeadNumber: boolean('has_dead_number').notNull().default(false),
    idTandaType: integer('id_tanda_type')
      .notNull()
      .references(() => tandaTypeTable.idTandaType),
    idAdmin: integer('id_admin')
      .notNull()
      .references(() => userTable.idUser), // organizador de ESTA tanda
    status: tandaStatusEnum('status').notNull().default('PENDIENTE'),
    active: boolean('active').notNull().default(true),
    inviteCode: varchar('invite_code', { length: 20 }).notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('tanda_id_admin_idx').on(t.idAdmin),
    index('tanda_id_tanda_type_idx').on(t.idTandaType),
  ],
);

// -----------------------------------------------------------------------------
// number  (con deleted_at) — identidad del turno dentro de una vuelta.
// Sin campos cacheados (pending_balance, missed_payments_count,
// has_received_payout): se derivan consultando payment/payout.
// -----------------------------------------------------------------------------
export const numberTable = pgTable(
  'number',
  {
    idNumber: serial('id_number').primaryKey(),
    numberValue: integer('number_value').notNull(),
    idUser: integer('id_user').references(() => userTable.idUser), // null = número muerto
    idTanda: integer('id_tanda')
      .notNull()
      .references(() => tandaTable.idTanda),
    isDeadNumber: boolean('is_dead_number').notNull().default(false),
    roundNumber: integer('round_number').notNull(),
    status: numberStatusEnum('status').notNull().default('PENDIENTE'),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    // El mismo número puede repetirse entre vueltas, nunca dos veces en la
    // misma vuelta de la misma tanda.
    unique('number_tanda_round_value_uq').on(
      t.idTanda,
      t.roundNumber,
      t.numberValue,
    ),
    index('number_id_user_idx').on(t.idUser),
  ],
);

// -----------------------------------------------------------------------------
// payment  (SIN deleted_at)
// total_amount = transfer_amount + cash_amount -> validar en PagoService
// -----------------------------------------------------------------------------
export const paymentTable = pgTable(
  'payment',
  {
    idPayment: serial('id_payment').primaryKey(),
    idNumber: integer('id_number')
      .notNull()
      .references(() => numberTable.idNumber, { onDelete: 'restrict' }),
    transferAmount: numeric('transfer_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    cashAmount: numeric('cash_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    ocrDetectedAmount: numeric('ocr_detected_amount', {
      precision: 12,
      scale: 2,
    }),
    ocrVerified: boolean('ocr_verified').notNull().default(false),
    confirmedByParticipant: boolean('confirmed_by_participant')
      .notNull()
      .default(false),
    confirmedByAdmin: boolean('confirmed_by_admin').notNull().default(false),
    status: paymentStatusEnum('status').notNull().default('PENDIENTE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payment_id_number_idx').on(t.idNumber)],
);

// -----------------------------------------------------------------------------
// payout  (SIN deleted_at)
// -----------------------------------------------------------------------------
export const payoutTable = pgTable(
  'payout',
  {
    idPayout: serial('id_payout').primaryKey(),
    idNumber: integer('id_number')
      .notNull()
      .references(() => numberTable.idNumber, { onDelete: 'restrict' }),
    transferAmount: numeric('transfer_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    cashAmount: numeric('cash_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    confirmedByAdmin: boolean('confirmed_by_admin').notNull().default(false),
    confirmedByRecipient: boolean('confirmed_by_recipient')
      .notNull()
      .default(false),
    status: payoutStatusEnum('status').notNull().default('PENDIENTE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payout_id_number_idx').on(t.idNumber)],
);

// -----------------------------------------------------------------------------
// evidence  (SIN deleted_at)
// CHECK: exactamente uno de id_payment / id_payout lleno.
// -----------------------------------------------------------------------------
export const evidenceTable = pgTable(
  'evidence',
  {
    idEvidence: serial('id_evidence').primaryKey(),
    idPayment: integer('id_payment').references(() => paymentTable.idPayment, {
      onDelete: 'restrict',
    }),
    idPayout: integer('id_payout').references(() => payoutTable.idPayout, {
      onDelete: 'restrict',
    }),
    fileUrl: varchar('file_url', { length: 500 }).notNull(), // Cloudinary / Firebase
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'evidence_exactly_one_parent_chk',
      sql`num_nonnulls(${t.idPayment}, ${t.idPayout}) = 1`,
    ),
    index('evidence_id_payment_idx').on(t.idPayment),
    index('evidence_id_payout_idx').on(t.idPayout),
  ],
);

// -----------------------------------------------------------------------------
// notification
// -----------------------------------------------------------------------------
export const notificationTable = pgTable(
  'notification',
  {
    idNotification: serial('id_notification').primaryKey(),
    idUser: integer('id_user')
      .notNull()
      .references(() => userTable.idUser),
    idTanda: integer('id_tanda').references(() => tandaTable.idTanda),
    type: varchar('type', { length: 50 }).notNull(), // recordatorio, confirmacion...
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('notification_user_read_idx').on(t.idUser, t.isRead),
    index('notification_id_tanda_idx').on(t.idTanda),
  ],
);

// -----------------------------------------------------------------------------
// dispute  (sin deleted_at; tiene resolved_at)
// -----------------------------------------------------------------------------
export const disputeTable = pgTable(
  'dispute',
  {
    idDispute: serial('id_dispute').primaryKey(),
    idTanda: integer('id_tanda')
      .notNull()
      .references(() => tandaTable.idTanda),
    idReporter: integer('id_reporter')
      .notNull()
      .references(() => userTable.idUser),
    idResolver: integer('id_resolver').references(() => userTable.idUser), // Admin Global
    reason: text('reason').notNull(),
    status: disputeStatusEnum('status').notNull().default('ABIERTA'),
    resolutionNotes: text('resolution_notes'),
    idPayment: integer('id_payment').references(() => paymentTable.idPayment, {
      onDelete: 'restrict',
    }),
    idPayout: integer('id_payout').references(() => payoutTable.idPayout, {
      onDelete: 'restrict',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('dispute_id_tanda_idx').on(t.idTanda),
    index('dispute_id_reporter_idx').on(t.idReporter),
    index('dispute_id_resolver_idx').on(t.idResolver),
    index('dispute_id_payment_idx').on(t.idPayment),
    index('dispute_id_payout_idx').on(t.idPayout),
    index('dispute_status_idx').on(t.status),
  ],
);

// -----------------------------------------------------------------------------
// audit_log  (SIN deleted_at, solo created_at: inmutable)
// entity_type + entity_id = referencia polimórfica (sin FK a propósito)
// -----------------------------------------------------------------------------
export const auditLogTable = pgTable(
  'audit_log',
  {
    idLog: serial('id_log').primaryKey(),
    idUser: integer('id_user')
      .notNull()
      .references(() => userTable.idUser),
    actionType: varchar('action_type', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: integer('entity_id').notNull(),
    description: text('description').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_id_user_idx').on(t.idUser),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);

// -----------------------------------------------------------------------------
// platform_config
// -----------------------------------------------------------------------------
export const platformConfigTable = pgTable(
  'platform_config',
  {
    idConfig: serial('id_config').primaryKey(),
    maxUsersPerTanda: integer('max_users_per_tanda').notNull(),
    maxActiveTandasPerUser: integer('max_active_tandas_per_user').notNull(),
    maxGraceDays: integer('max_grace_days').notNull(),
    idUpdatedBy: integer('id_updated_by')
      .notNull()
      .references(() => userTable.idUser),
    updatedAt: updatedAt(),
  },
  (t) => [index('platform_config_updated_by_idx').on(t.idUpdatedBy)],
);

// -----------------------------------------------------------------------------
// Tipos inferidos (mismo estilo que PagoRow / NewPagoRow de la plantilla)
// -----------------------------------------------------------------------------
export type RoleRow = typeof roleTable.$inferSelect;
export type NewRoleRow = typeof roleTable.$inferInsert;
export type UserRow = typeof userTable.$inferSelect;
export type NewUserRow = typeof userTable.$inferInsert;
export type TandaTypeRow = typeof tandaTypeTable.$inferSelect;
export type NewTandaTypeRow = typeof tandaTypeTable.$inferInsert;
export type TandaRow = typeof tandaTable.$inferSelect;
export type NewTandaRow = typeof tandaTable.$inferInsert;
export type NumberRow = typeof numberTable.$inferSelect;
export type NewNumberRow = typeof numberTable.$inferInsert;
export type PaymentRow = typeof paymentTable.$inferSelect;
export type NewPaymentRow = typeof paymentTable.$inferInsert;
export type PayoutRow = typeof payoutTable.$inferSelect;
export type NewPayoutRow = typeof payoutTable.$inferInsert;
export type EvidenceRow = typeof evidenceTable.$inferSelect;
export type NewEvidenceRow = typeof evidenceTable.$inferInsert;
export type NotificationRow = typeof notificationTable.$inferSelect;
export type NewNotificationRow = typeof notificationTable.$inferInsert;
export type DisputeRow = typeof disputeTable.$inferSelect;
export type NewDisputeRow = typeof disputeTable.$inferInsert;
export type AuditLogRow = typeof auditLogTable.$inferSelect;
export type NewAuditLogRow = typeof auditLogTable.$inferInsert;
export type PlatformConfigRow = typeof platformConfigTable.$inferSelect;
export type NewPlatformConfigRow = typeof platformConfigTable.$inferInsert;
