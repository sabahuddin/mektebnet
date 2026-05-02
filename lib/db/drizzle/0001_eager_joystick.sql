CREATE TABLE IF NOT EXISTS "misija_definicija" (
"id" serial PRIMARY KEY NOT NULL,
"kod" varchar(60) NOT NULL,
"naziv" text NOT NULL,
"opis" text DEFAULT '' NOT NULL,
"tip" varchar(20) NOT NULL,
"uvjet_tip" varchar(40) NOT NULL,
"uvjet_param" jsonb DEFAULT '{}'::jsonb,
"cilj" integer DEFAULT 1 NOT NULL,
"nagrada_aferim" integer DEFAULT 0 NOT NULL,
"nagrada_med" integer DEFAULT 0 NOT NULL,
"ikona" varchar(30) DEFAULT '🎯' NOT NULL,
"aktivna" boolean DEFAULT true NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "misija_definicija_kod_unique" UNIQUE("kod")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "misija_progress" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"misija_id" integer NOT NULL,
"period_key" varchar(20) NOT NULL,
"trenutno" integer DEFAULT 0 NOT NULL,
"completed_at" timestamp,
"claimed_at" timestamp,
"created_at" timestamp DEFAULT now() NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pogresni_odgovori" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"source_type" varchar(20) NOT NULL,
"source_id" integer NOT NULL,
"source_naslov" text DEFAULT '' NOT NULL,
"question_index" integer NOT NULL,
"question_text" text NOT NULL,
"options" jsonb NOT NULL,
"correct_index" integer NOT NULL,
"last_wrong_index" integer NOT NULL,
"attempts" integer DEFAULT 1 NOT NULL,
"resolved_at" timestamp,
"created_at" timestamp DEFAULT now() NOT NULL,
"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_progress" ADD COLUMN IF NOT EXISTS "total_med" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "korisnik_napredak" ADD COLUMN IF NOT EXISTS "quiz_passed_at" timestamp;--> statement-breakpoint
ALTER TABLE "korisnik_napredak" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "misija_progress_user_misija_period_unique_idx" ON "misija_progress" USING btree ("user_id","misija_id","period_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "misija_progress_user_period_idx" ON "misija_progress" USING btree ("user_id","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pogresni_odgovori_user_question_unique_idx" ON "pogresni_odgovori" USING btree ("user_id","source_type","source_id","question_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pogresni_odgovori_user_open_idx" ON "pogresni_odgovori" USING btree ("user_id","resolved_at");
