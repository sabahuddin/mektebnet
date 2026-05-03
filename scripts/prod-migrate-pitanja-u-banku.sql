-- Migracija: pitanja iz JSONB-a kvizovi.pitanja u centralnu banku.
-- IDEMPOTENTNO — može se vrtjeti više puta bez duplikata.
-- Pokreni: psql -U mekteb -d mekteb -f prod-migrate-pitanja-u-banku.sql
-- Ili copy-paste u psql konzolu.

BEGIN;

-- 1. Unnesti sva pitanja iz svih kvizova, normalizovati tekst, izračunati correct_index
WITH unnested AS (
  SELECT
    k.id AS kviz_id,
    (elem.ord - 1)::int AS redoslijed,  -- 0-based
    elem.value AS p
  FROM kvizovi k,
       LATERAL jsonb_array_elements(k.pitanja) WITH ORDINALITY AS elem(value, ord)
  WHERE jsonb_array_length(k.pitanja) > 0
),
prepared AS (
  SELECT
    kviz_id,
    redoslijed,
    regexp_replace(btrim(p->>'question'), '\s+', ' ', 'g') AS pitanje,
    p->'options' AS opcije,
    regexp_replace(btrim(p->>'answer'), '\s+', ' ', 'g') AS answer_norm,
    COALESCE(p->>'explanation', '') AS objasnjenje,
    NULLIF(p->>'image', '') AS slika
  FROM unnested
  WHERE p->>'question' IS NOT NULL
    AND jsonb_typeof(p->'options') = 'array'
    AND jsonb_array_length(p->'options') > 0
),
with_correct AS (
  SELECT
    pp.*,
    (SELECT (o.idx - 1)::int
       FROM jsonb_array_elements_text(pp.opcije) WITH ORDINALITY o(opt, idx)
      WHERE regexp_replace(btrim(o.opt), '\s+', ' ', 'g') = pp.answer_norm
      LIMIT 1) AS correct_index
  FROM prepared pp
),
valid AS (
  SELECT * FROM with_correct
   WHERE correct_index IS NOT NULL
     AND length(pitanje) > 0
),
-- 2. Insert jedinstvena pitanja u banku (ON CONFLICT po normalizovanom tekstu)
to_insert AS (
  SELECT DISTINCT ON (pitanje)
    pitanje, opcije, correct_index, objasnjenje, slika
  FROM valid
  ORDER BY pitanje, kviz_id, redoslijed
)
INSERT INTO pitanja_banka (pitanje, opcije, correct_index, objasnjenje, slika, vrsta)
SELECT pitanje, opcije, correct_index, objasnjenje, slika, 'single'
FROM to_insert
ON CONFLICT (pitanje) DO NOTHING;

-- 3. Insert veze kviz↔pitanje (po već postojećim id-jevima u banci)
WITH unnested AS (
  SELECT
    k.id AS kviz_id,
    (elem.ord - 1)::int AS redoslijed,
    elem.value AS p
  FROM kvizovi k,
       LATERAL jsonb_array_elements(k.pitanja) WITH ORDINALITY AS elem(value, ord)
  WHERE jsonb_array_length(k.pitanja) > 0
),
valid AS (
  SELECT
    kviz_id,
    redoslijed,
    regexp_replace(btrim(p->>'question'), '\s+', ' ', 'g') AS pitanje
  FROM unnested
  WHERE p->>'question' IS NOT NULL
    AND length(btrim(p->>'question')) > 0
)
INSERT INTO kviz_pitanja (kviz_id, pitanje_id, redoslijed)
SELECT v.kviz_id, pb.id, v.redoslijed
FROM valid v
JOIN pitanja_banka pb ON pb.pitanje = v.pitanje
ON CONFLICT (kviz_id, pitanje_id) DO NOTHING;

COMMIT;

-- Verifikacija
SELECT
  (SELECT COUNT(*) FROM pitanja_banka) AS ukupno_u_banci,
  (SELECT COUNT(*) FROM kviz_pitanja) AS ukupno_veza,
  (SELECT COUNT(DISTINCT kviz_id) FROM kviz_pitanja) AS broj_kvizova_sa_vezama;
