-- ──────────────────────────────────────────────────────────────────────────────
-- PRODUKCIJSKA SCHEMA MIGRACIJA: banka pitanja + veze + nove kolone na kvizovi
-- ──────────────────────────────────────────────────────────────────────────────
-- Pokrenuti JEDNOM na produkcijskoj bazi (Coolify Postgres).
-- Skript je IDEMPOTENTAN — siguran je za ponovno pokretanje, ne briše podatke.
--
-- Šta radi:
--   1) Dodaje kolone `kategorija`, `lekcija_id`, `opis` na `kvizovi`
--   2) Kreira tabelu `pitanja_banka` (centralna banka pitanja)
--   3) Kreira tabelu `kviz_pitanja` (M:N veza kviz ↔ pitanje)
--   4) Sve potrebne indekse i UNIQUE constrainte
--
-- ŠTA NE RADI:
--   - Ne dira postojeća pitanja u `kvizovi.pitanja` JSONB (ostaju netaknuta)
--   - Ne migrira sadržaj u banku (banka ostaje prazna na startu)
--   - Read path u API-ju je hibridan: ako kviz_pitanja nema veza za neki kviz,
--     padne na JSONB. Tako svi postojeći kvizovi nastavljaju raditi normalno.
--
-- KAKO POKRENUTI:
--   psql "$PROD_DATABASE_URL" -f prod-schema-banka-pitanja.sql
--   ili kroz Coolify Postgres console: copy-paste cijeli sadržaj.
-- ──────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1) Nove kolone na `kvizovi` (kategorija/lekcija/opis/is_published)
ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS kategorija varchar(60);
ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS lekcija_id integer;
ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS opis text NOT NULL DEFAULT '';
-- is_published: API SELECT ovu kolonu uvijek vraća; bez nje cijela
-- /content/kvizovi ruta puca i frontend dobija praznu listu.
ALTER TABLE kvizovi         ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE knjige          ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

-- 2) Banka pitanja
CREATE TABLE IF NOT EXISTS pitanja_banka (
  id            serial PRIMARY KEY,
  pitanje       text NOT NULL,
  opcije        jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  objasnjenje   text NOT NULL DEFAULT '',
  slika         varchar(500),
  vrsta         varchar(20) NOT NULL DEFAULT 'single',
  kategorija    varchar(60),
  lekcija_id    integer,
  tezina        integer NOT NULL DEFAULT 1,
  created_by    integer,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pitanja_banka_pitanje_unique_idx
  ON pitanja_banka (pitanje);
CREATE INDEX IF NOT EXISTS pitanja_banka_kategorija_idx
  ON pitanja_banka (kategorija);
CREATE INDEX IF NOT EXISTS pitanja_banka_lekcija_idx
  ON pitanja_banka (lekcija_id);

-- 3) Veza kviz ↔ pitanje (M:N)
CREATE TABLE IF NOT EXISTS kviz_pitanja (
  id          serial PRIMARY KEY,
  kviz_id     integer NOT NULL,
  pitanje_id  integer NOT NULL,
  redoslijed  integer NOT NULL DEFAULT 0,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- FK constrainti sa CASCADE — brisanje kviza ili pitanja čisti veze
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kviz_pitanja_kviz_id_fkey') THEN
    ALTER TABLE kviz_pitanja
      ADD CONSTRAINT kviz_pitanja_kviz_id_fkey
      FOREIGN KEY (kviz_id) REFERENCES kvizovi(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kviz_pitanja_pitanje_id_fkey') THEN
    ALTER TABLE kviz_pitanja
      ADD CONSTRAINT kviz_pitanja_pitanje_id_fkey
      FOREIGN KEY (pitanje_id) REFERENCES pitanja_banka(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS kviz_pitanja_kviz_pitanje_unique_idx
  ON kviz_pitanja (kviz_id, pitanje_id);
CREATE INDEX IF NOT EXISTS kviz_pitanja_kviz_redoslijed_idx
  ON kviz_pitanja (kviz_id, redoslijed);
CREATE INDEX IF NOT EXISTS kviz_pitanja_pitanje_idx
  ON kviz_pitanja (pitanje_id);

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────────
-- VERIFIKACIJA — pokreni nakon skripta da potvrdiš da je sve OK
-- ──────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM pitanja_banka) AS pitanja_u_banci,
  (SELECT COUNT(*) FROM kviz_pitanja)  AS veza_u_join_tabeli,
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name='kvizovi' AND column_name IN ('kategorija','lekcija_id','opis')
  ) AS nove_kolone_na_kvizovi;
-- Očekivano nakon prvog pokretanja:
--   pitanja_u_banci = 0
--   veza_u_join_tabeli = 0
--   nove_kolone_na_kvizovi = 3
