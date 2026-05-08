-- Medaljoni (Nivo 1 mapa) + osvojeni medaljoni po učeniku
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
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "medaljoni_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "student_medaljoni" (
  "id" serial PRIMARY KEY NOT NULL,
  "student_id" varchar(100) NOT NULL,
  "medaljon_id" integer NOT NULL,
  "earned_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_medaljoni_unique_idx"
  ON "student_medaljoni" ("student_id", "medaljon_id");

-- Seed 5 medaljona (idempotentno)
INSERT INTO "medaljoni" ("slug", "naziv", "opis", "pos_after_redoslijed", "ikona", "boja") VALUES
  ('prvi-koraci', 'Prvi koraci', 'Završio si prvih 5 lekcija — pravi početak puta!', 5, 'footprints', 'emerald'),
  ('putnik', 'Putnik', 'Deset lekcija iza tebe — postao si pravi putnik znanja.', 10, 'compass', 'sky'),
  ('polovina-puta', 'Polovina puta', 'Trideset lekcija — već si na pola puta do košnice!', 30, 'mountain', 'amber'),
  ('ustrajni', 'Ustrajni', 'Četrdeset i pet lekcija — tvoja ustrajnost je primjer drugima.', 45, 'flame', 'orange'),
  ('prva-kosnica', 'Prva košnica', 'Završio si Nivo 1 — stigao si do svoje prve košnice znanja!', 64, 'beehive', 'yellow')
ON CONFLICT ("slug") DO NOTHING;
