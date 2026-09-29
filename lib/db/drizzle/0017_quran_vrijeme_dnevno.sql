-- Drizzle generate je vidio i stare ručne/residualne tabele koje već postoje
-- na produkciji; ova migracija namjerno dodaje samo novu evidenciju Kur'ana.
CREATE TABLE IF NOT EXISTS "quran_vrijeme_dnevno" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dan" date NOT NULL,
  "seconds" integer NOT NULL DEFAULT 0,
  "last_heartbeat_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "quran_vrijeme_dnevno_user_id_dan_pk" PRIMARY KEY ("user_id", "dan")
);