CREATE TABLE IF NOT EXISTS "etapa_polaganja" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" varchar(100) NOT NULL,
	"medaljon_id" integer NOT NULL,
	"broj_tacnih" integer DEFAULT 0 NOT NULL,
	"broj_pitanja" integer DEFAULT 0 NOT NULL,
	"procenat" integer DEFAULT 0 NOT NULL,
	"polozeno" boolean DEFAULT false NOT NULL,
	"pokusaj_br" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "krunisanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivo" integer NOT NULL,
	"naslov" text DEFAULT '' NOT NULL,
	"opis_html" text DEFAULT '' NOT NULL,
	"ikona" varchar(32) DEFAULT 'crown' NOT NULL,
	"boja" varchar(16) DEFAULT 'amber' NOT NULL,
	"kviz_pitanja_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prag_prolaza_percent" integer DEFAULT 70 NOT NULL,
	"is_gating" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "krunisanja_nivo_unique" UNIQUE("nivo")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "krunisanje_lekcije" (
	"id" serial PRIMARY KEY NOT NULL,
	"krunisanje_id" integer NOT NULL,
	"slug" varchar(100) NOT NULL,
	"naslov" text NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"redoslijed" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "krunisanje_lekcije_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medaljoni" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivo" integer DEFAULT 1 NOT NULL,
	"slug" varchar(64) NOT NULL,
	"naziv" text NOT NULL,
	"opis" text DEFAULT '' NOT NULL,
	"pos_after_redoslijed" integer NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"ikona" varchar(32) DEFAULT 'medal' NOT NULL,
	"boja" varchar(16) DEFAULT 'amber' NOT NULL,
	"kviz_pitanja_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prag_prolaza_percent" integer DEFAULT 70 NOT NULL,
	"is_gating" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "medaljoni_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_krunisanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" varchar(100) NOT NULL,
	"krunisanje_id" integer NOT NULL,
	"broj_tacnih" integer DEFAULT 0 NOT NULL,
	"broj_pitanja" integer DEFAULT 0 NOT NULL,
	"procenat" integer DEFAULT 0 NOT NULL,
	"polozeno_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_medaljoni" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" varchar(100) NOT NULL,
	"medaljon_id" integer NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grupa_raspored" (
	"id" serial PRIMARY KEY NOT NULL,
	"grupa_id" integer NOT NULL,
	"nivo" integer NOT NULL,
	"lekcija_id" integer NOT NULL,
	"pozicija" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mekteb_dokumenti" (
	"id" serial PRIMARY KEY NOT NULL,
	"mekteb_id" integer NOT NULL,
	"naziv" varchar(200) NOT NULL,
	"opis" text,
	"original_name" text NOT NULL,
	"stored_name" varchar(300) NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" varchar(100) DEFAULT 'application/pdf' NOT NULL,
	"uploaded_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "napamet_global_program" (
	"id" serial PRIMARY KEY NOT NULL,
	"stavka_id" varchar(80) NOT NULL,
	"nivo" integer NOT NULL,
	"naziv" varchar(200) NOT NULL,
	"redoslijed" integer NOT NULL,
	"source_lesson_slug" varchar(100),
	"is_visible" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "napamet_muallim_program" (
	"id" serial PRIMARY KEY NOT NULL,
	"stavka_id" varchar(80) NOT NULL,
	"muallim_id" integer NOT NULL,
	"grupa_id" integer NOT NULL,
	"nivo" integer NOT NULL,
	"naziv" varchar(200) NOT NULL,
	"redoslijed" integer NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "napamet_program" (
	"id" serial PRIMARY KEY NOT NULL,
	"mekteb_id" integer NOT NULL,
	"stavka_id" varchar(80) NOT NULL,
	"nivo" integer NOT NULL,
	"naziv" varchar(200) NOT NULL,
	"redoslijed" integer NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zadace_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"zadaca_id" integer NOT NULL,
	"ucenik_id" integer NOT NULL,
	"uradjeno" boolean DEFAULT false NOT NULL,
	"ocjena" integer,
	"kapi_meda" integer DEFAULT 0 NOT NULL,
	"novi_rok" varchar(20),
	"prolong_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'na_cekanju' NOT NULL,
	"reviewed_at" timestamp,
	"muallim_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embed_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" varchar(120) NOT NULL,
	"prilozi_id" integer NOT NULL,
	"hasanat_gained" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kategorije_knjige" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"naziv" varchar(120) NOT NULL,
	"opis" text,
	"redoslijed" integer DEFAULT 100 NOT NULL,
	"default_open" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kategorije_knjige_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kviz_kategorije" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"naziv" varchar(120) NOT NULL,
	"ikona" varchar(16),
	"redoslijed" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kviz_kategorije_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kviz_tagovi" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"naziv" varchar(120) NOT NULL,
	"kategorija" varchar(60) NOT NULL,
	"redoslijed" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kviz_tagovi_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ocjene_sadrzaja" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"tip_sadrzaja" varchar(32) NOT NULL,
	"sadrzaj_id" integer NOT NULL,
	"ocjena" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "zadace" ALTER COLUMN "naslov" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trial_until" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_screentime_sec" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "grupe" ADD COLUMN IF NOT EXISTS "datum_pocetka" date;--> statement-breakpoint
ALTER TABLE "grupe" ADD COLUMN IF NOT EXISTS "datum_kraja" date;--> statement-breakpoint
ALTER TABLE "mektebi" ADD COLUMN IF NOT EXISTS "glavni_muallim_id" integer;--> statement-breakpoint
ALTER TABLE "mektebi" ADD COLUMN IF NOT EXISTS "dozvoljeno_muallima" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "muallim_profili" ADD COLUMN IF NOT EXISTS "is_glavni" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ocjene" ADD COLUMN IF NOT EXISTS "napamet_nivo" integer;--> statement-breakpoint
ALTER TABLE "ocjene" ADD COLUMN IF NOT EXISTS "napamet_stavka_id" varchar(80);--> statement-breakpoint
ALTER TABLE "ocjene" ADD COLUMN IF NOT EXISTS "zadaca_id" integer;--> statement-breakpoint
ALTER TABLE "zadace" ADD COLUMN IF NOT EXISTS "lekcija_slug" varchar(300);--> statement-breakpoint
ALTER TABLE "ilmihal_lekcije" ADD COLUMN IF NOT EXISTS "predmet" varchar(60);--> statement-breakpoint
ALTER TABLE "ilmihal_lekcije" ADD COLUMN IF NOT EXISTS "uvjeti_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "kvizovi" ADD COLUMN IF NOT EXISTS "seed_key" varchar(160);--> statement-breakpoint
ALTER TABLE "kvizovi" ADD COLUMN IF NOT EXISTS "tagovi" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pitanja_banka" ADD COLUMN IF NOT EXISTS "tagovi" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pitanja_banka" ADD COLUMN IF NOT EXISTS "seed_key" varchar(160);--> statement-breakpoint
ALTER TABLE "pitanja_banka" ADD COLUMN IF NOT EXISTS "urednicki_status" varchar(24) DEFAULT 'odobreno' NOT NULL;--> statement-breakpoint
ALTER TABLE "pitanja_banka" ADD COLUMN IF NOT EXISTS "reviewed_by" integer;--> statement-breakpoint
ALTER TABLE "pitanja_banka" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "pitanja_banka" ADD COLUMN IF NOT EXISTS "review_note" text;--> statement-breakpoint
ALTER TABLE "prilozi" ADD COLUMN IF NOT EXISTS "approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prilozi" ADD COLUMN IF NOT EXISTS "uploaded_by_role" varchar(20);--> statement-breakpoint
ALTER TABLE "prilozi" ADD COLUMN IF NOT EXISTS "uploaded_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "prilozi" ADD COLUMN IF NOT EXISTS "hasanat_reward" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'password_reset_tokens_user_id_users_id_fk'
		  AND conrelid = 'password_reset_tokens'::regclass
	) THEN
		ALTER TABLE "password_reset_tokens"
			ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "etapa_polaganja_student_med_pokusaj_idx" ON "etapa_polaganja" USING btree ("student_id","medaljon_id","pokusaj_br");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_krunisanja_unique_idx" ON "student_krunisanja" USING btree ("student_id","krunisanje_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_medaljoni_unique_idx" ON "student_medaljoni" USING btree ("student_id","medaljon_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "grupa_raspored_grupa_lekcija_unique_idx" ON "grupa_raspored" USING btree ("grupa_id","lekcija_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "grupa_raspored_grupa_nivo_idx" ON "grupa_raspored" USING btree ("grupa_id","nivo","pozicija");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mekteb_dokumenti_mekteb_idx" ON "mekteb_dokumenti" USING btree ("mekteb_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "napamet_global_program_stavka_unique_idx" ON "napamet_global_program" USING btree ("stavka_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "napamet_global_program_order_idx" ON "napamet_global_program" USING btree ("nivo","redoslijed");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "napamet_muallim_program_stavka_unique_idx" ON "napamet_muallim_program" USING btree ("stavka_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "napamet_muallim_program_owner_order_idx" ON "napamet_muallim_program" USING btree ("muallim_id","grupa_id","nivo","redoslijed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "napamet_muallim_program_grupa_order_idx" ON "napamet_muallim_program" USING btree ("grupa_id","nivo","redoslijed");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "napamet_program_mekteb_stavka_unique_idx" ON "napamet_program" USING btree ("mekteb_id","stavka_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "napamet_program_mekteb_order_idx" ON "napamet_program" USING btree ("mekteb_id","nivo","redoslijed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interaktivni_blok_user_lesson_idx" ON "interaktivni_blok_pokusaji" USING btree ("user_id","lekcija_id","blok_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interaktivni_blok_lesson_question_idx" ON "interaktivni_blok_pokusaji" USING btree ("lekcija_id","blok_id","pitanje_index","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interaktivni_blok_user_question_attempt_unique_idx" ON "interaktivni_blok_pokusaji" USING btree ("user_id","lekcija_id","blok_id","pitanje_index","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_pause_answers_user_lesson_pause_unique_idx" ON "lesson_pause_answers" USING btree ("user_id","lekcija_id","pause_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_pause_answers_user_lesson_idx" ON "lesson_pause_answers" USING btree ("user_id","lekcija_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kvizovi_seed_key_unique_idx" ON "kvizovi" USING btree ("seed_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pitanja_banka_seed_key_unique_idx" ON "pitanja_banka" USING btree ("seed_key");--> statement-breakpoint
INSERT INTO "medaljoni" ("nivo", "slug", "naziv", "opis", "pos_after_redoslijed", "ikona", "boja") VALUES
	(1, 'm1-pocetnik', 'Pčelica početnik', 'Završio si prvih 10 lekcija — postao si pčelica početnik!', 10, 'medal', 'amber'),
	(1, 'm2-radilica', 'Marljiva pčela', '20 lekcija iza tebe — sad si marljiva pčela radilica.', 20, 'medal', 'orange'),
	(1, 'm3-istrazivac', 'Istraživač cvijeća', '30 lekcija — istraživač cvjetnih polja!', 30, 'medal', 'yellow'),
	(1, 'm4-cuvar', 'Čuvar košnice', '40 lekcija — postao si čuvar košnice znanja.', 40, 'medal', 'amber'),
	(1, 'm5-mudrac', 'Mudra pčela', '50 lekcija — mudra pčela koja sve zna.', 50, 'medal', 'orange'),
	(1, 'm6-majstor', 'Majstor meda', '60 lekcija — pravi majstor meda i znanja!', 60, 'medal', 'yellow')
ON CONFLICT ("slug") DO NOTHING;