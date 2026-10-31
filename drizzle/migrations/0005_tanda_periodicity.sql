ALTER TABLE "tanda" ADD COLUMN IF NOT EXISTS "periodicity" varchar(20) DEFAULT 'quincenal' NOT NULL;
