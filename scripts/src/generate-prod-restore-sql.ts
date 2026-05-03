/**
 * Generiše prod-restore-pitanja.sql iz content-seed.json.gz.
 * Output: scripts/prod-restore-pitanja.sql
 *
 * Šta radi (idempotent):
 *   1. ALTER TABLE pitanja_banka ADD COLUMN IF NOT EXISTS correct_indexes/correct_order
 *   2. DELETE iz kviz_pitanja za sve kvizove iz seed-a (regenerišu se)
 *   3. UPDATE kvizovi SET pitanja = '...'::jsonb (samo ako je seed bogatiji)
 *   4. UPSERT u pitanja_banka za 4 tipa: single, multiple, truefalse, reorder
 *      (markWords i dragDrop ostaju samo u JSONB-u — banka ih ne podržava)
 *   5. INSERT u kviz_pitanja sa redoslijedom
 *   6. SELECT verifikacija
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SeedPitanje = {
  question?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  image?: string;
  type?: string;
  items?: { text: string; order: number }[];
};
type SeedKviz = { slug: string; pitanja?: SeedPitanje[]; questions?: SeedPitanje[] };

const seedPath = resolve(__dirname, "../content-seed.json.gz");
const outPath = resolve(__dirname, "../prod-restore-pitanja.sql");

const raw = gunzipSync(readFileSync(seedPath)).toString("utf-8");
const seedData = JSON.parse(raw) as { kvizovi?: SeedKviz[]; quizzes?: SeedKviz[] };
const seedKvizovi = seedData.kvizovi ?? seedData.quizzes ?? [];

const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const sqlEsc = (s: string) => s.replace(/'/g, "''");

// Klasifikacija pitanja u 4 banka tipa.
// Vraća null za pitanja koja banka ne podržava (markWords, dragDrop, nevalidna).
type Klasifikovano = {
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  correctIndexes: number[] | null;
  correctOrder: number[] | null;
  vrsta: "single" | "multiple" | "truefalse" | "reorder";
  objasnjenje: string;
  slika: string | null;
};

function klasifikuj(p: SeedPitanje): Klasifikovano | null {
  if (!p?.question) return null;
  const pitanje = norm(p.question);
  if (pitanje.length === 0) return null;
  const t = (p.type ?? "").toLowerCase();

  if (t === "markwords" || t === "dragdrop") return null;

  if (t === "reorder") {
    if (!Array.isArray(p.items) || p.items.length < 2) return null;
    const opcije = p.items.map((it) => norm(it?.text ?? ""));
    const correctOrder = p.items.map((it) => Number(it?.order) || 0);
    if (opcije.some((o) => o === "") || correctOrder.some((o) => o <= 0)) return null;
    return {
      pitanje, opcije, correctIndex: 0, correctIndexes: null, correctOrder,
      vrsta: "reorder",
      objasnjenje: p.explanation ?? "",
      slika: p.image ?? null,
    };
  }

  if (t === "truefalse") {
    const a = norm(p.answer ?? "").toLowerCase();
    const yesVariants = ["da", "tačno", "tacno", "true", "yes", "ispravno"];
    return {
      pitanje, opcije: ["Da", "Ne"],
      correctIndex: yesVariants.includes(a) ? 0 : 1,
      correctIndexes: null, correctOrder: null,
      vrsta: "truefalse",
      objasnjenje: p.explanation ?? "",
      slika: p.image ?? null,
    };
  }

  // single / multiple / radio / checkbox / nothing
  if (!Array.isArray(p.options) || p.options.length === 0) return null;
  const answerParts = (p.answer ?? "").includes("|||")
    ? p.answer!.split("|||").map(norm).filter((s) => s.length > 0)
    : [norm(p.answer ?? "")];
  const idxs: number[] = [];
  for (const part of answerParts) {
    const idx = p.options.findIndex((o) => norm(o) === part);
    if (idx >= 0 && !idxs.includes(idx)) idxs.push(idx);
  }
  if (idxs.length === 0) return null;
  const isMulti = idxs.length > 1;
  return {
    pitanje, opcije: p.options,
    correctIndex: idxs[0]!,
    correctIndexes: isMulti ? idxs : null,
    correctOrder: null,
    vrsta: isMulti ? "multiple" : "single",
    objasnjenje: p.explanation ?? "",
    slika: p.image ?? null,
  };
}

const lines: string[] = [];
lines.push("-- AUTO-GENERIRANO iz scripts/content-seed.json.gz");
lines.push("-- Restore JSONB + populiše banku za 4 tipa (single, multiple, truefalse, reorder)");
lines.push("-- IDEMPOTENT — može se vrtjeti više puta");
lines.push("--");
lines.push("-- POKRENI: psql -U mekteb -d mekteb -f prod-restore-pitanja.sql");
lines.push("");
lines.push("BEGIN;");
lines.push("");
lines.push("-- 0. Schema migracije (idempotent)");
lines.push("ALTER TABLE pitanja_banka ADD COLUMN IF NOT EXISTS correct_indexes jsonb;");
lines.push("ALTER TABLE pitanja_banka ADD COLUMN IF NOT EXISTS correct_order jsonb;");
lines.push("");

const kvizoviSaPitanjima = seedKvizovi.filter((k) => {
  const pit = (k.pitanja ?? k.questions ?? []) as SeedPitanje[];
  return pit.length > 0;
});

const slugsToRestore = kvizoviSaPitanjima.map((k) => k.slug);

lines.push("-- 1. Obriši stare veze za sve kvizove iz seed-a (regenerišu se ispod)");
lines.push(`DELETE FROM kviz_pitanja WHERE kviz_id IN (`);
lines.push(`  SELECT id FROM kvizovi WHERE slug IN (${slugsToRestore.map((s) => `'${sqlEsc(s)}'`).join(", ")})`);
lines.push(`);`);
lines.push("");

lines.push("-- 2. UPDATE JSONB pitanja iz seed-a (samo ako je seed verzija bogatija)");
const TAG = "$jsonpit$";
for (const k of kvizoviSaPitanjima) {
  const pit = (k.pitanja ?? k.questions ?? []) as SeedPitanje[];
  const json = JSON.stringify(pit);
  if (json.includes(TAG)) throw new Error(`Tag konflikt u kvizu ${k.slug}`);
  lines.push(
    `UPDATE kvizovi SET pitanja = ${TAG}${json}${TAG}::jsonb WHERE slug = '${sqlEsc(k.slug)}' AND (CASE WHEN pitanja IS NULL THEN TRUE WHEN jsonb_typeof(pitanja) <> 'array' THEN TRUE ELSE jsonb_array_length(pitanja) < ${pit.length} END);`
  );
}
lines.push("");

// Sakupi sva validna klasifikovana pitanja iz seed-a, dedup po normalizovanom tekstu.
// Za dedup zadržavamo PRVO pojavljivanje (po redoslijedu kvizova u seed-u).
const banka = new Map<string, Klasifikovano>();
const kvizPitanjaLinks: { kvizSlug: string; pitanje: string; redoslijed: number }[] = [];

for (const k of kvizoviSaPitanjima) {
  const pit = (k.pitanja ?? k.questions ?? []) as SeedPitanje[];
  for (let i = 0; i < pit.length; i++) {
    const klas = klasifikuj(pit[i]!);
    if (!klas) continue;
    if (!banka.has(klas.pitanje)) banka.set(klas.pitanje, klas);
    kvizPitanjaLinks.push({ kvizSlug: k.slug, pitanje: klas.pitanje, redoslijed: i });
  }
}

lines.push(`-- 3. UPSERT u pitanja_banka (${banka.size} jedinstvenih pitanja, 4 tipa)`);
lines.push("--    Generiše se kroz INSERT...VALUES batch zbog jasnoće i preglednosti.");
const batches: string[] = [];
const all = Array.from(banka.values());
const BATCH = 200;
for (let i = 0; i < all.length; i += BATCH) {
  const slice = all.slice(i, i + BATCH);
  const values = slice.map((k) => {
    const opcijeJson = JSON.stringify(k.opcije).replace(/'/g, "''");
    const idxsJson = k.correctIndexes ? `'${JSON.stringify(k.correctIndexes)}'::jsonb` : "NULL";
    const ordJson = k.correctOrder ? `'${JSON.stringify(k.correctOrder)}'::jsonb` : "NULL";
    return `('${sqlEsc(k.pitanje)}', '${opcijeJson}'::jsonb, ${k.correctIndex}, ${idxsJson}, ${ordJson}, '${sqlEsc(k.objasnjenje)}', ${k.slika ? `'${sqlEsc(k.slika)}'` : "NULL"}, '${k.vrsta}')`;
  }).join(",\n  ");
  batches.push(`INSERT INTO pitanja_banka (pitanje, opcije, correct_index, correct_indexes, correct_order, objasnjenje, slika, vrsta) VALUES
  ${values}
ON CONFLICT (pitanje) DO UPDATE SET
  opcije = EXCLUDED.opcije,
  correct_index = EXCLUDED.correct_index,
  correct_indexes = EXCLUDED.correct_indexes,
  correct_order = EXCLUDED.correct_order,
  objasnjenje = EXCLUDED.objasnjenje,
  slika = EXCLUDED.slika,
  vrsta = EXCLUDED.vrsta,
  updated_at = now();`);
}
lines.push(batches.join("\n"));
lines.push("");

lines.push(`-- 4. Veze kviz↔pitanje (${kvizPitanjaLinks.length} veza)`);
const linkBatches: string[] = [];
for (let i = 0; i < kvizPitanjaLinks.length; i += BATCH) {
  const slice = kvizPitanjaLinks.slice(i, i + BATCH);
  const values = slice.map((l) =>
    `((SELECT id FROM kvizovi WHERE slug = '${sqlEsc(l.kvizSlug)}'), (SELECT id FROM pitanja_banka WHERE pitanje = '${sqlEsc(l.pitanje)}'), ${l.redoslijed})`
  ).join(",\n  ");
  linkBatches.push(`INSERT INTO kviz_pitanja (kviz_id, pitanje_id, redoslijed)
SELECT * FROM (VALUES
  ${values}
) AS v(kviz_id, pitanje_id, redoslijed)
WHERE kviz_id IS NOT NULL AND pitanje_id IS NOT NULL
ON CONFLICT (kviz_id, pitanje_id) DO NOTHING;`);
}
lines.push(linkBatches.join("\n"));
lines.push("");

lines.push("COMMIT;");
lines.push("");
lines.push("-- Verifikacija");
lines.push(`SELECT
  (SELECT COUNT(*) FROM pitanja_banka) AS ukupno_u_banci,
  (SELECT COUNT(*) FROM kviz_pitanja) AS ukupno_veza,
  (SELECT COUNT(DISTINCT kviz_id) FROM kviz_pitanja) AS broj_kvizova_sa_vezama,
  (SELECT SUM(jsonb_array_length(pitanja)) FROM kvizovi WHERE jsonb_typeof(pitanja) = 'array') AS suma_pitanja_u_jsonb;
SELECT vrsta, COUNT(*) AS broj FROM pitanja_banka GROUP BY 1 ORDER BY 2 DESC;`);

writeFileSync(outPath, lines.join("\n"));
console.log(`Generirano: ${outPath}`);
console.log(`Veličina: ${(readFileSync(outPath).length / 1024).toFixed(1)} KB`);
console.log(`Kvizova za restore: ${slugsToRestore.length}`);
console.log(`Jedinstvenih pitanja u banci: ${banka.size}`);
console.log(`Veza kviz↔pitanje: ${kvizPitanjaLinks.length}`);
