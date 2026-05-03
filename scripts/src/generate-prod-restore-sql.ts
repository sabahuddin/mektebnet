/**
 * Generiše prod-restore-pitanja.sql iz content-seed.json.gz
 * koji se može copy-paste u psql konzolu na produkciji.
 *
 * Output: scripts/prod-restore-pitanja.sql sa:
 *   - DELETE iz kviz_pitanja za 22 pogođena kviza
 *   - UPDATE kvizovi SET pitanja = '...'::jsonb WHERE slug='...' (22x)
 *   - Migracioni SQL za pitanja_banka i kviz_pitanja
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SeedKviz = { slug: string; pitanja?: unknown[]; questions?: unknown[] };

const seedPath = resolve(__dirname, "../content-seed.json.gz");
const outPath = resolve(__dirname, "../prod-restore-pitanja.sql");

const raw = gunzipSync(readFileSync(seedPath)).toString("utf-8");
const seedData = JSON.parse(raw) as { kvizovi?: SeedKviz[]; quizzes?: SeedKviz[] };
const seedKvizovi = seedData.kvizovi ?? seedData.quizzes ?? [];

const lines: string[] = [];
lines.push("-- AUTO-GENERIRANO iz scripts/content-seed.json.gz");
lines.push("-- Restore JSONB pitanja u kvizove + ponovo populiše banku");
lines.push("-- IDEMPOTENTNO — može se vrtjeti više puta");
lines.push("--");
lines.push("-- POKRENI: psql -U mekteb -d mekteb -f prod-restore-pitanja.sql");
lines.push("");
lines.push("BEGIN;");
lines.push("");
lines.push("-- 1. Obriši stare veze za kvizove čije pitanje overwriteamo");
lines.push("--    (regenerišu se na kraju kroz migraciju)");

// We will restore for ALL slugs in seed (not only those where seed > db),
// because on prod we don't know current counts. But only kvizovi with seed pitanja > 0.
const kvizoviSaPitanjima = seedKvizovi.filter((k) => {
  const pit = (k.pitanja ?? k.questions ?? []) as unknown[];
  return pit.length > 0;
});

const slugsToRestore = kvizoviSaPitanjima.map((k) => k.slug);

lines.push(`DELETE FROM kviz_pitanja WHERE kviz_id IN (`);
lines.push(`  SELECT id FROM kvizovi WHERE slug IN (${slugsToRestore.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ")})`);
lines.push(`);`);
lines.push("");
lines.push("-- 2. UPDATE JSONB pitanja iz seed-a (samo ako je seed verzija veća)");

for (const k of kvizoviSaPitanjima) {
  const pit = (k.pitanja ?? k.questions ?? []) as unknown[];
  const json = JSON.stringify(pit).replace(/'/g, "''");
  const slugEscaped = k.slug.replace(/'/g, "''");
  lines.push(
    `UPDATE kvizovi SET pitanja = '${json}'::jsonb WHERE slug = '${slugEscaped}' AND jsonb_array_length(pitanja) < ${pit.length};`
  );
}

lines.push("");
lines.push("-- 3. Populiši pitanja_banka (ON CONFLICT — idempotent)");
lines.push(`WITH unnested AS (
  SELECT
    k.id AS kviz_id,
    (elem.ord - 1)::int AS redoslijed,
    elem.value AS p
  FROM kvizovi k,
       LATERAL jsonb_array_elements(k.pitanja) WITH ORDINALITY AS elem(value, ord)
  WHERE jsonb_array_length(k.pitanja) > 0
),
prepared AS (
  SELECT
    kviz_id, redoslijed,
    regexp_replace(btrim(p->>'question'), '\\s+', ' ', 'g') AS pitanje,
    p->'options' AS opcije,
    regexp_replace(btrim(p->>'answer'), '\\s+', ' ', 'g') AS answer_norm,
    COALESCE(p->>'explanation', '') AS objasnjenje,
    NULLIF(p->>'image', '') AS slika
  FROM unnested
  WHERE p->>'question' IS NOT NULL
    AND jsonb_typeof(p->'options') = 'array'
    AND jsonb_array_length(p->'options') > 0
),
with_correct AS (
  SELECT pp.*,
    (SELECT (o.idx - 1)::int
       FROM jsonb_array_elements_text(pp.opcije) WITH ORDINALITY o(opt, idx)
      WHERE regexp_replace(btrim(o.opt), '\\s+', ' ', 'g') = pp.answer_norm
      LIMIT 1) AS correct_index
  FROM prepared pp
),
valid AS (
  SELECT * FROM with_correct WHERE correct_index IS NOT NULL AND length(pitanje) > 0
),
to_insert AS (
  SELECT DISTINCT ON (pitanje) pitanje, opcije, correct_index, objasnjenje, slika
  FROM valid
  ORDER BY pitanje, kviz_id, redoslijed
)
INSERT INTO pitanja_banka (pitanje, opcije, correct_index, objasnjenje, slika, vrsta)
SELECT pitanje, opcije, correct_index, objasnjenje, slika, 'single'
FROM to_insert
ON CONFLICT (pitanje) DO NOTHING;`);

lines.push("");
lines.push("-- 4. Generiši veze kviz↔pitanje");
lines.push(`WITH unnested AS (
  SELECT
    k.id AS kviz_id,
    (elem.ord - 1)::int AS redoslijed,
    elem.value AS p
  FROM kvizovi k,
       LATERAL jsonb_array_elements(k.pitanja) WITH ORDINALITY AS elem(value, ord)
  WHERE jsonb_array_length(k.pitanja) > 0
),
valid AS (
  SELECT kviz_id, redoslijed,
    regexp_replace(btrim(p->>'question'), '\\s+', ' ', 'g') AS pitanje
  FROM unnested
  WHERE p->>'question' IS NOT NULL AND length(btrim(p->>'question')) > 0
)
INSERT INTO kviz_pitanja (kviz_id, pitanje_id, redoslijed)
SELECT v.kviz_id, pb.id, v.redoslijed
FROM valid v
JOIN pitanja_banka pb ON pb.pitanje = v.pitanje
ON CONFLICT (kviz_id, pitanje_id) DO NOTHING;`);

lines.push("");
lines.push("COMMIT;");
lines.push("");
lines.push("-- Verifikacija");
lines.push(`SELECT
  (SELECT COUNT(*) FROM pitanja_banka) AS ukupno_u_banci,
  (SELECT COUNT(*) FROM kviz_pitanja) AS ukupno_veza,
  (SELECT COUNT(DISTINCT kviz_id) FROM kviz_pitanja) AS broj_kvizova_sa_vezama,
  (SELECT SUM(jsonb_array_length(pitanja)) FROM kvizovi) AS suma_pitanja_u_jsonb;`);

writeFileSync(outPath, lines.join("\n"));
console.log(`Generirano: ${outPath}`);
console.log(`Veličina: ${(readFileSync(outPath).length / 1024).toFixed(1)} KB`);
console.log(`Kvizova za restore: ${slugsToRestore.length}`);
