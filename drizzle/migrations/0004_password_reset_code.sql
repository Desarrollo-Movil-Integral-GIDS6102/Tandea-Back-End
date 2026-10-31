CREATE TABLE IF NOT EXISTS "password_reset_code" (
	"id_code" serial PRIMARY KEY NOT NULL,
	"id_user" integer NOT NULL,
	"code_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "password_reset_code" ADD CONSTRAINT "password_reset_code_id_user_user_id_user_fk" FOREIGN KEY ("id_user") REFERENCES "public"."user"("id_user") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "password_reset_code_id_user_idx" ON "password_reset_code" USING btree ("id_user");
