CREATE TABLE "obavjestenja" (
	"id" serial PRIMARY KEY NOT NULL,
	"muallim_id" integer NOT NULL,
	"grupa_id" integer,
	"naslov" varchar(200) NOT NULL,
	"sadrzaj" text NOT NULL,
	"slika_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kviz_pitanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"kviz_id" integer NOT NULL,
	"pitanje_id" integer NOT NULL,
	"redoslijed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pitanja_banka" (
	"id" serial PRIMARY KEY NOT NULL,
	"pitanje" text NOT NULL,
	"opcije" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_index" integer DEFAULT 0 NOT NULL,
	"correct_indexes" jsonb,
	"correct_order" jsonb,
	"meta" jsonb,
	"objasnjenje" text DEFAULT '' NOT NULL,
	"slika" varchar(500),
	"vrsta" varchar(20) DEFAULT 'single' NOT NULL,
	"kategorija" varchar(60),
	"lekcija_id" integer,
	"tezina" integer DEFAULT 1 NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kvizovi" ADD COLUMN "kategorija" varchar(60);--> statement-breakpoint
ALTER TABLE "kvizovi" ADD COLUMN "lekcija_id" integer;--> statement-breakpoint
ALTER TABLE "kvizovi" ADD COLUMN "opis" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "kvizovi" ADD COLUMN "pitanja_po_sesiji" integer;--> statement-breakpoint
CREATE INDEX "obavjestenja_muallim_idx" ON "obavjestenja" USING btree ("muallim_id");--> statement-breakpoint
CREATE INDEX "obavjestenja_grupa_idx" ON "obavjestenja" USING btree ("grupa_id");--> statement-breakpoint
CREATE INDEX "obavjestenja_created_idx" ON "obavjestenja" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kviz_pitanja_kviz_pitanje_unique_idx" ON "kviz_pitanja" USING btree ("kviz_id","pitanje_id");--> statement-breakpoint
CREATE INDEX "kviz_pitanja_kviz_redoslijed_idx" ON "kviz_pitanja" USING btree ("kviz_id","redoslijed");--> statement-breakpoint
CREATE INDEX "kviz_pitanja_pitanje_idx" ON "kviz_pitanja" USING btree ("pitanje_id");--> statement-breakpoint
CREATE INDEX "pitanja_banka_kategorija_idx" ON "pitanja_banka" USING btree ("kategorija");--> statement-breakpoint
CREATE INDEX "pitanja_banka_lekcija_idx" ON "pitanja_banka" USING btree ("lekcija_id");