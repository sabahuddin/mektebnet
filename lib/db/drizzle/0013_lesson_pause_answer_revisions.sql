ALTER TABLE "lesson_pause_answers"
  ADD COLUMN IF NOT EXISTS "config_fingerprint" varchar(64) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "lesson_pause_answers"
  ADD COLUMN IF NOT EXISTS "revision" integer NOT NULL DEFAULT 1;