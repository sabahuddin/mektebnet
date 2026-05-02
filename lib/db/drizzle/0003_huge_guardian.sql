CREATE TABLE "igra_pitanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"kategorija" varchar(40) NOT NULL,
	"pitanje" text NOT NULL,
	"opcije" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"objasnjenje" text DEFAULT '' NOT NULL,
	"tezina" integer DEFAULT 1 NOT NULL,
	"aktivno" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "igra_pitanja_kategorija_aktivno_idx" ON "igra_pitanja" USING btree ("kategorija","aktivno");