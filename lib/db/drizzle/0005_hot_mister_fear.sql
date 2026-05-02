CREATE TABLE "medena_vidjena_pitanja" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pitanje_id" integer NOT NULL,
	"kategorija" varchar(40) NOT NULL,
	"vidjeno_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "medena_vidjena_user_kategorija_vidjeno_idx" ON "medena_vidjena_pitanja" USING btree ("user_id","kategorija","vidjeno_at");