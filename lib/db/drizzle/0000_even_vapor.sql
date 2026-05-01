CREATE TYPE "public"."user_role" AS ENUM('admin', 'muallim', 'ucenik', 'roditelj');--> statement-breakpoint
CREATE TABLE "exercise_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" varchar(100) NOT NULL,
	"lesson_id" integer NOT NULL,
	"exercise_type" varchar(50) NOT NULL,
	"correct_answers" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"time_spent_seconds" integer NOT NULL,
	"hasanat_earned" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_num" integer NOT NULL,
	"slug" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"lesson_type" varchar(30) NOT NULL,
	"letters" jsonb NOT NULL,
	"duration_min" integer DEFAULT 20 NOT NULL,
	"story_data" jsonb,
	"letter_data" jsonb,
	"exercise_types" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "lessons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "student_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" varchar(100) NOT NULL,
	"total_hasanat" integer DEFAULT 0 NOT NULL,
	"completed_lessons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_activity_date" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "student_progress_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'ucenik' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "grupe" (
	"id" serial PRIMARY KEY NOT NULL,
	"muallim_id" integer NOT NULL,
	"naziv" varchar(100) NOT NULL,
	"skolska_godina" varchar(20) NOT NULL,
	"dani_nastave" jsonb DEFAULT '[]'::jsonb,
	"vrijeme_nastave" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mektebi" (
	"id" serial PRIMARY KEY NOT NULL,
	"naziv" text NOT NULL,
	"grad" varchar(100),
	"adresa" text,
	"kontakt_email" varchar(255),
	"kontakt_tel" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "muallim_profili" (
	"user_id" integer NOT NULL,
	"mekteb_id" integer,
	"licence_count" integer DEFAULT 30 NOT NULL,
	"licences_used" integer DEFAULT 0 NOT NULL,
	"tekuca_skolska_godina" varchar(30) DEFAULT 'Mektebska 2025/26',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "muallim_profili_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pretplate" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_type" varchar(50) NOT NULL,
	"stripe_session_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"iznos" integer,
	"valuta" varchar(10) DEFAULT 'EUR',
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"licences_purchased" integer DEFAULT 0,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roditelj_profili" (
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "roditelj_profili_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "roditelj_ucenik" (
	"id" serial PRIMARY KEY NOT NULL,
	"roditelj_id" integer NOT NULL,
	"ucenik_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"approved_by" integer
);
--> statement-breakpoint
CREATE TABLE "ucenik_profili" (
	"user_id" integer NOT NULL,
	"muallim_id" integer,
	"grupa_id" integer,
	"mekteb_id" integer,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ucenik_profili_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "certifikati" (
	"id" serial PRIMARY KEY NOT NULL,
	"ucenik_id" integer NOT NULL,
	"modul" varchar(100) NOT NULL,
	"naslov" text NOT NULL,
	"issued_by_id" integer,
	"issued_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mekteb_kalendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"grupa_id" integer NOT NULL,
	"muallim_id" integer NOT NULL,
	"datum" varchar(20) NOT NULL,
	"tip" varchar(20) DEFAULT 'mekteb' NOT NULL,
	"opis" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ocjene" (
	"id" serial PRIMARY KEY NOT NULL,
	"ucenik_id" integer NOT NULL,
	"muallim_id" integer NOT NULL,
	"grupa_id" integer,
	"kategorija" varchar(50) NOT NULL,
	"ocjena" integer NOT NULL,
	"lekcija_naziv" varchar(200),
	"napomena" text,
	"datum" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plan_lekcija" (
	"id" serial PRIMARY KEY NOT NULL,
	"grupa_id" integer NOT NULL,
	"muallim_id" integer NOT NULL,
	"datum" varchar(20) NOT NULL,
	"lekcija_naslov" varchar(300) NOT NULL,
	"lekcija_tip" varchar(50) DEFAULT 'ilmihal' NOT NULL,
	"redoslijed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "poruke" (
	"id" serial PRIMARY KEY NOT NULL,
	"posiljatelj_id" integer NOT NULL,
	"primatelj_id" integer NOT NULL,
	"naslov" varchar(200) NOT NULL,
	"sadrzaj" text NOT NULL,
	"procitano_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prisustvo" (
	"id" serial PRIMARY KEY NOT NULL,
	"ucenik_id" integer NOT NULL,
	"grupa_id" integer NOT NULL,
	"muallim_id" integer NOT NULL,
	"datum" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'prisutan' NOT NULL,
	"napomena" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zadace" (
	"id" serial PRIMARY KEY NOT NULL,
	"grupa_id" integer NOT NULL,
	"muallim_id" integer NOT NULL,
	"naslov" varchar(300) NOT NULL,
	"opis" text,
	"rok_do" varchar(20),
	"lekcija_naslov" varchar(300),
	"lekcija_tip" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zadace_ucenici" (
	"id" serial PRIMARY KEY NOT NULL,
	"zadaca_id" integer NOT NULL,
	"ucenik_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "h5p_pokusaji" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"prilozi_id" integer NOT NULL,
	"attempt_no" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"procenat" integer DEFAULT 0 NOT NULL,
	"hasanat_gained" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ilmihal_lekcije" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivo" integer NOT NULL,
	"slug" varchar(100) NOT NULL,
	"naslov" text NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"audio_src" varchar(500),
	"redoslijed" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"kviz_pitanja" jsonb,
	"locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp,
	"locked_note" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ilmihal_lekcije_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "knjige" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"naslov" text NOT NULL,
	"kategorija" varchar(50) DEFAULT 'prica' NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"cover_image" varchar(500),
	"redoslijed" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "knjige_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "korisnik_napredak" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_type" varchar(30) NOT NULL,
	"content_id" integer NOT NULL,
	"zavrsen" boolean DEFAULT false NOT NULL,
	"bodovi" integer DEFAULT 0 NOT NULL,
	"pokusaji" integer DEFAULT 1 NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kviz_rezultati" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kviz_id" integer NOT NULL,
	"kviz_naslov" text DEFAULT '' NOT NULL,
	"tacni_odgovori" integer DEFAULT 0 NOT NULL,
	"ukupno_pitanja" integer DEFAULT 0 NOT NULL,
	"procenat" integer DEFAULT 0 NOT NULL,
	"bodovi" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kvizovi" (
	"id" serial PRIMARY KEY NOT NULL,
	"nivo" integer,
	"slug" varchar(100) NOT NULL,
	"naslov" text NOT NULL,
	"modul" varchar(50) DEFAULT 'ilmihal' NOT NULL,
	"variant" varchar(20) DEFAULT 'normal',
	"pitanja" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kvizovi_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "posjete" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"path" varchar(500) DEFAULT '/' NOT NULL,
	"ip" varchar(100),
	"country" varchar(100),
	"city" varchar(200),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prilozi" (
	"id" serial PRIMARY KEY NOT NULL,
	"lekcija_id" integer NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" varchar(300) DEFAULT '' NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" varchar(100) DEFAULT 'application/octet-stream' NOT NULL,
	"kind" varchar(20) DEFAULT 'file' NOT NULL,
	"external_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rjecnik" (
	"id" serial PRIMARY KEY NOT NULL,
	"rijec" varchar(200) NOT NULL,
	"definicija" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rjecnik_rijec_unique" UNIQUE("rijec")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "roditelj_ucenik_unique_idx" ON "roditelj_ucenik" USING btree ("roditelj_id","ucenik_id");