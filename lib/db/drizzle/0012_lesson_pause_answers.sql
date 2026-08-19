CREATE TABLE IF NOT EXISTS "lesson_pause_answers" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "lekcija_id" integer NOT NULL,
  "pause_id" varchar(100) NOT NULL,
  "config_fingerprint" varchar(64) NOT NULL,
  "answer" jsonb NOT NULL,
  "submitted" boolean DEFAULT false NOT NULL,
  "correct" boolean,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_pause_answers_user_lesson_pause_unique_idx"
  ON "lesson_pause_answers" ("user_id", "lekcija_id", "pause_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_pause_answers_user_lesson_idx"
  ON "lesson_pause_answers" ("user_id", "lekcija_id");