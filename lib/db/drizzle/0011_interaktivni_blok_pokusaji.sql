CREATE TABLE IF NOT EXISTS "interaktivni_blok_pokusaji" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "lekcija_id" integer NOT NULL,
  "blok_id" varchar(100) NOT NULL,
  "pitanje_index" integer NOT NULL,
  "pitanje_tekst" text NOT NULL,
  "attempt_no" integer NOT NULL,
  "tacno" boolean NOT NULL,
  "vrijeme_sekundi" integer DEFAULT 0 NOT NULL,
  "pomoc_koristena" boolean DEFAULT false NOT NULL,
  "ponovo_procitao" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interaktivni_blok_user_lesson_idx"
  ON "interaktivni_blok_pokusaji" ("user_id", "lekcija_id", "blok_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interaktivni_blok_lesson_question_idx"
  ON "interaktivni_blok_pokusaji" ("lekcija_id", "blok_id", "pitanje_index", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interaktivni_blok_user_question_attempt_unique_idx"
  ON "interaktivni_blok_pokusaji" ("user_id", "lekcija_id", "blok_id", "pitanje_index", "attempt_no");