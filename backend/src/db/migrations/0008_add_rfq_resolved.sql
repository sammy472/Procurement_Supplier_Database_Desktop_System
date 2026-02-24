ALTER TABLE "rfqs" ADD COLUMN IF NOT EXISTS "resolved" boolean DEFAULT false NOT NULL;
ALTER TABLE "rfqs_savy" ADD COLUMN IF NOT EXISTS "resolved" boolean DEFAULT false NOT NULL;
