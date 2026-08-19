ALTER TABLE "pitanja_banka"
  ADD COLUMN IF NOT EXISTS "seed_key" varchar(160);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pitanja_banka_seed_key_unique_idx"
  ON "pitanja_banka" ("seed_key");
--> statement-breakpoint
ALTER TABLE "pitanja_banka"
  ADD COLUMN IF NOT EXISTS "urednicki_status" varchar(24) NOT NULL DEFAULT 'odobreno';
--> statement-breakpoint
ALTER TABLE "pitanja_banka"
  ADD COLUMN IF NOT EXISTS "reviewed_by" integer;
--> statement-breakpoint
ALTER TABLE "pitanja_banka"
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "pitanja_banka"
  ADD COLUMN IF NOT EXISTS "review_note" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pitanja_banka_urednicki_status_idx"
  ON "pitanja_banka" ("urednicki_status");
--> statement-breakpoint
UPDATE "pitanja_banka"
SET "urednicki_status" = 'na_cekanju'
WHERE "seed_key" LIKE 'ilmihal-learning:%'
  AND "reviewed_at" IS NULL;