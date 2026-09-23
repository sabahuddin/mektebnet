ALTER TABLE "ilmihal_lekcije"
ADD COLUMN IF NOT EXISTS "podneseno_za_javnu_objavu" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "napamet_ucenik_override" (
  "id" serial PRIMARY KEY,
  "ucenik_id" integer NOT NULL,
  "stavka_id" varchar(80) NOT NULL,
  "is_visible" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "napamet_ucenik_override_student_item_unique_idx"
ON "napamet_ucenik_override" ("ucenik_id", "stavka_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "napamet_ucenik_override_student_idx"
ON "napamet_ucenik_override" ("ucenik_id");