ALTER TABLE "payment" ADD COLUMN "id_dead_number" integer;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_id_dead_number_number_id_number_fk" FOREIGN KEY ("id_dead_number") REFERENCES "public"."number"("id_number") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_id_dead_number_idx" ON "payment" USING btree ("id_dead_number");