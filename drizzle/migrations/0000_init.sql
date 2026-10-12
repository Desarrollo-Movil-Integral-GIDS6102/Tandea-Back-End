CREATE TYPE "public"."dispute_status" AS ENUM('ABIERTA', 'EN_REVISION', 'RESUELTA', 'DESCARTADA');--> statement-breakpoint
CREATE TYPE "public"."number_status" AS ENUM('PENDIENTE', 'EN_RIESGO', 'ENTREGA_PENDIENTE_CONFIRMACION', 'ENTREGADO');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDIENTE', 'CONFIRMADO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."tanda_status" AS ENUM('PENDIENTE', 'ACTIVA', 'FINALIZADA', 'SUSPENDIDA', 'CANCELADA');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id_log" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" integer NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute" (
	"id_dispute" serial PRIMARY KEY NOT NULL,
	"id_tanda" integer NOT NULL,
	"id_reporter" integer NOT NULL,
	"id_resolver" integer,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'ABIERTA' NOT NULL,
	"resolution_notes" text,
	"id_payment" integer,
	"id_payout" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id_evidence" serial PRIMARY KEY NOT NULL,
	"id_payment" integer,
	"id_payout" integer,
	"file_url" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_exactly_one_parent_chk" CHECK (num_nonnulls("evidence"."id_payment", "evidence"."id_payout") = 1)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id_notification" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"id_tanda" integer,
	"type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number" (
	"id_number" serial PRIMARY KEY NOT NULL,
	"number_value" integer NOT NULL,
	"id_user" integer,
	"id_tanda" integer NOT NULL,
	"is_dead_number" boolean DEFAULT false NOT NULL,
	"round_number" integer NOT NULL,
	"status" "number_status" DEFAULT 'PENDIENTE' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "number_tanda_round_value_uq" UNIQUE("id_tanda","round_number","number_value")
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id_payment" serial PRIMARY KEY NOT NULL,
	"id_number" integer NOT NULL,
	"transfer_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cash_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"ocr_detected_amount" numeric(12, 2),
	"ocr_verified" boolean DEFAULT false NOT NULL,
	"confirmed_by_participant" boolean DEFAULT false NOT NULL,
	"confirmed_by_admin" boolean DEFAULT false NOT NULL,
	"status" "payment_status" DEFAULT 'PENDIENTE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id_payout" serial PRIMARY KEY NOT NULL,
	"id_number" integer NOT NULL,
	"transfer_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cash_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"confirmed_by_admin" boolean DEFAULT false NOT NULL,
	"confirmed_by_recipient" boolean DEFAULT false NOT NULL,
	"status" "payout_status" DEFAULT 'PENDIENTE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id_config" serial PRIMARY KEY NOT NULL,
	"max_users_per_tanda" integer NOT NULL,
	"max_active_tandas_per_user" integer NOT NULL,
	"max_grace_days" integer NOT NULL,
	"id_updated_by" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id_role" serial PRIMARY KEY NOT NULL,
	"name_role" varchar(100) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tanda" (
	"id_tanda" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"contribution_amount" numeric(12, 2) NOT NULL,
	"num_participants" integer NOT NULL,
	"num_rounds" integer NOT NULL,
	"grace_days" integer NOT NULL,
	"has_dead_number" boolean DEFAULT false NOT NULL,
	"id_tanda_type" integer NOT NULL,
	"id_admin" integer NOT NULL,
	"status" "tanda_status" DEFAULT 'PENDIENTE' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"invite_code" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tanda_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "tanda_type" (
	"id_tanda_type" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id_user" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"age" integer,
	"gender" varchar(50),
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"id_role" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_id_user_user_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_tanda_tanda_id_tanda_fk" FOREIGN KEY ("id_tanda") REFERENCES "public"."tanda"("id_tanda") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_reporter_user_id_user_fk" FOREIGN KEY ("id_reporter") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_resolver_user_id_user_fk" FOREIGN KEY ("id_resolver") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_payment_payment_id_payment_fk" FOREIGN KEY ("id_payment") REFERENCES "public"."payment"("id_payment") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_id_payout_payout_id_payout_fk" FOREIGN KEY ("id_payout") REFERENCES "public"."payout"("id_payout") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_id_payment_payment_id_payment_fk" FOREIGN KEY ("id_payment") REFERENCES "public"."payment"("id_payment") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_id_payout_payout_id_payout_fk" FOREIGN KEY ("id_payout") REFERENCES "public"."payout"("id_payout") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_id_user_user_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_id_tanda_tanda_id_tanda_fk" FOREIGN KEY ("id_tanda") REFERENCES "public"."tanda"("id_tanda") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number" ADD CONSTRAINT "number_id_user_user_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number" ADD CONSTRAINT "number_id_tanda_tanda_id_tanda_fk" FOREIGN KEY ("id_tanda") REFERENCES "public"."tanda"("id_tanda") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_number_number_id_number_fk" FOREIGN KEY ("id_number") REFERENCES "public"."number"("id_number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_id_number_number_id_number_fk" FOREIGN KEY ("id_number") REFERENCES "public"."number"("id_number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_id_updated_by_user_id_user_fk" FOREIGN KEY ("id_updated_by") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tanda" ADD CONSTRAINT "tanda_id_tanda_type_tanda_type_id_tanda_type_fk" FOREIGN KEY ("id_tanda_type") REFERENCES "public"."tanda_type"("id_tanda_type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tanda" ADD CONSTRAINT "tanda_id_admin_user_id_user_fk" FOREIGN KEY ("id_admin") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_id_role_role_id_role_fk" FOREIGN KEY ("id_role") REFERENCES "public"."role"("id_role") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_id_user_idx" ON "audit_log" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dispute_id_tanda_idx" ON "dispute" USING btree ("id_tanda");--> statement-breakpoint
CREATE INDEX "dispute_id_reporter_idx" ON "dispute" USING btree ("id_reporter");--> statement-breakpoint
CREATE INDEX "dispute_id_resolver_idx" ON "dispute" USING btree ("id_resolver");--> statement-breakpoint
CREATE INDEX "dispute_id_payment_idx" ON "dispute" USING btree ("id_payment");--> statement-breakpoint
CREATE INDEX "dispute_id_payout_idx" ON "dispute" USING btree ("id_payout");--> statement-breakpoint
CREATE INDEX "dispute_status_idx" ON "dispute" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evidence_id_payment_idx" ON "evidence" USING btree ("id_payment");--> statement-breakpoint
CREATE INDEX "evidence_id_payout_idx" ON "evidence" USING btree ("id_payout");--> statement-breakpoint
CREATE INDEX "notification_user_read_idx" ON "notification" USING btree ("id_user","is_read");--> statement-breakpoint
CREATE INDEX "notification_id_tanda_idx" ON "notification" USING btree ("id_tanda");--> statement-breakpoint
CREATE INDEX "number_id_user_idx" ON "number" USING btree ("id_user");--> statement-breakpoint
CREATE INDEX "payment_id_number_idx" ON "payment" USING btree ("id_number");--> statement-breakpoint
CREATE INDEX "payout_id_number_idx" ON "payout" USING btree ("id_number");--> statement-breakpoint
CREATE INDEX "platform_config_updated_by_idx" ON "platform_config" USING btree ("id_updated_by");--> statement-breakpoint
CREATE INDEX "tanda_id_admin_idx" ON "tanda" USING btree ("id_admin");--> statement-breakpoint
CREATE INDEX "tanda_id_tanda_type_idx" ON "tanda" USING btree ("id_tanda_type");--> statement-breakpoint
CREATE INDEX "user_id_role_idx" ON "user" USING btree ("id_role");