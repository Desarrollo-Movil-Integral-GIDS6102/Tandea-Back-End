-- CreateEnum
CREATE TYPE "tanda_status" AS ENUM ('PENDIENTE', 'ACTIVA', 'FINALIZADA', 'SUSPENDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "number_status" AS ENUM ('PENDIENTE', 'EN_RIESGO', 'ENTREGA_PENDIENTE_CONFIRMACION', 'ENTREGADO');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('ABIERTA', 'EN_REVISION', 'RESUELTA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "role" (
    "id_role" SERIAL NOT NULL,
    "name_role" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "role_pkey" PRIMARY KEY ("id_role")
);

-- CreateTable
CREATE TABLE "user" (
    "id_user" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "age" INTEGER,
    "gender" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "id_role" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "tanda_type" (
    "id_tanda_type" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "tanda_type_pkey" PRIMARY KEY ("id_tanda_type")
);

-- CreateTable
CREATE TABLE "tanda" (
    "id_tanda" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "contribution_amount" DECIMAL(12,2) NOT NULL,
    "num_participants" INTEGER NOT NULL,
    "num_rounds" INTEGER NOT NULL,
    "grace_days" INTEGER NOT NULL,
    "has_dead_number" BOOLEAN NOT NULL DEFAULT false,
    "id_tanda_type" INTEGER NOT NULL,
    "id_admin" INTEGER NOT NULL,
    "status" "tanda_status" NOT NULL DEFAULT 'PENDIENTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invite_code" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tanda_pkey" PRIMARY KEY ("id_tanda")
);

-- CreateTable
CREATE TABLE "number" (
    "id_number" SERIAL NOT NULL,
    "number_value" INTEGER NOT NULL,
    "id_user" INTEGER,
    "id_tanda" INTEGER NOT NULL,
    "is_dead_number" BOOLEAN NOT NULL DEFAULT false,
    "round_number" INTEGER NOT NULL,
    "status" "number_status" NOT NULL DEFAULT 'PENDIENTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "number_pkey" PRIMARY KEY ("id_number")
);

-- CreateTable
CREATE TABLE "payment" (
    "id_payment" SERIAL NOT NULL,
    "id_number" INTEGER NOT NULL,
    "transfer_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "ocr_detected_amount" DECIMAL(12,2),
    "ocr_verified" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_participant" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "status" "payment_status" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id_payment")
);

-- CreateTable
CREATE TABLE "payout" (
    "id_payout" SERIAL NOT NULL,
    "id_number" INTEGER NOT NULL,
    "transfer_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "confirmed_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_recipient" BOOLEAN NOT NULL DEFAULT false,
    "status" "payout_status" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id_payout")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id_evidence" SERIAL NOT NULL,
    "id_payment" INTEGER,
    "id_payout" INTEGER,
    "file_url" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id_evidence")
);

-- CreateTable
CREATE TABLE "notification" (
    "id_notification" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "id_tanda" INTEGER,
    "type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id_notification")
);

-- CreateTable
CREATE TABLE "dispute" (
    "id_dispute" SERIAL NOT NULL,
    "id_tanda" INTEGER NOT NULL,
    "id_reporter" INTEGER NOT NULL,
    "id_resolver" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'ABIERTA',
    "resolution_notes" TEXT,
    "id_payment" INTEGER,
    "id_payout" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "dispute_pkey" PRIMARY KEY ("id_dispute")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id_log" SERIAL NOT NULL,
    "id_user" INTEGER NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "platform_config" (
    "id_config" SERIAL NOT NULL,
    "max_users_per_tanda" INTEGER NOT NULL,
    "max_active_tandas_per_user" INTEGER NOT NULL,
    "max_grace_days" INTEGER NOT NULL,
    "id_updated_by" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id_config")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_id_role_idx" ON "user"("id_role");

-- CreateIndex
CREATE UNIQUE INDEX "tanda_invite_code_key" ON "tanda"("invite_code");

-- CreateIndex
CREATE INDEX "tanda_id_admin_idx" ON "tanda"("id_admin");

-- CreateIndex
CREATE INDEX "tanda_id_tanda_type_idx" ON "tanda"("id_tanda_type");

-- CreateIndex
CREATE INDEX "number_id_user_idx" ON "number"("id_user");

-- CreateIndex
CREATE UNIQUE INDEX "number_id_tanda_round_number_number_value_key" ON "number"("id_tanda", "round_number", "number_value");

-- CreateIndex
CREATE INDEX "payment_id_number_idx" ON "payment"("id_number");

-- CreateIndex
CREATE INDEX "payout_id_number_idx" ON "payout"("id_number");

-- CreateIndex
CREATE INDEX "evidence_id_payment_idx" ON "evidence"("id_payment");

-- CreateIndex
CREATE INDEX "evidence_id_payout_idx" ON "evidence"("id_payout");

-- CreateIndex
CREATE INDEX "notification_id_user_is_read_idx" ON "notification"("id_user", "is_read");

-- CreateIndex
CREATE INDEX "notification_id_tanda_idx" ON "notification"("id_tanda");

-- CreateIndex
CREATE INDEX "dispute_id_tanda_idx" ON "dispute"("id_tanda");

-- CreateIndex
CREATE INDEX "dispute_id_reporter_idx" ON "dispute"("id_reporter");

-- CreateIndex
CREATE INDEX "dispute_id_resolver_idx" ON "dispute"("id_resolver");

-- CreateIndex
CREATE INDEX "dispute_id_payment_idx" ON "dispute"("id_payment");

-- CreateIndex
CREATE INDEX "dispute_id_payout_idx" ON "dispute"("id_payout");

-- CreateIndex
CREATE INDEX "dispute_status_idx" ON "dispute"("status");

-- CreateIndex
CREATE INDEX "audit_log_id_user_idx" ON "audit_log"("id_user");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "platform_config_id_updated_by_idx" ON "platform_config"("id_updated_by");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_id_role_fkey" FOREIGN KEY ("id_role") REFERENCES "role"("id_role") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanda" ADD CONSTRAINT "tanda_id_tanda_type_fkey" FOREIGN KEY ("id_tanda_type") REFERENCES "tanda_type"("id_tanda_type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tanda" ADD CONSTRAINT "tanda_id_admin_fkey" FOREIGN KEY ("id_admin") REFERENCES "user"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number" ADD CONSTRAINT "number_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "user"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number" ADD CONSTRAINT "number_id_tanda_fkey" FOREIGN KEY ("id_tanda") REFERENCES "tanda"("id_tanda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_number_fkey" FOREIGN KEY ("id_number") REFERENCES "number"("id_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_id_number_fkey" FOREIGN KEY ("id_number") REFERENCES "number"("id_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_id_payment_fkey" FOREIGN KEY ("id_payment") REFERENCES "payment"("id_payment") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_id_payout_fkey" FOREIGN KEY ("id_payout") REFERENCES "payout"("id_payout") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "user"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_id_tanda_fkey" FOREIGN KEY ("id_tanda") REFERENCES "tanda"("id_tanda") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_tanda_fkey" FOREIGN KEY ("id_tanda") REFERENCES "tanda"("id_tanda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_reporter_fkey" FOREIGN KEY ("id_reporter") REFERENCES "user"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_resolver_fkey" FOREIGN KEY ("id_resolver") REFERENCES "user"("id_user") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_payment_fkey" FOREIGN KEY ("id_payment") REFERENCES "payment"("id_payment") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_payout_fkey" FOREIGN KEY ("id_payout") REFERENCES "payout"("id_payout") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "user"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_id_updated_by_fkey" FOREIGN KEY ("id_updated_by") REFERENCES "user"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "evidence"
  ADD CONSTRAINT "evidence_exactly_one_parent_chk"
  CHECK (num_nonnulls("id_payment", "id_payout") = 1);