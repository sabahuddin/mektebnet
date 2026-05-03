/**
 * Import 11 tematskih kvizova iz priloženih HTML fajlova u attached_assets/.
 *
 * Svaki HTML sadrži `const allQuestions = [ {...}, ... ]` blok sa pitanjima.
 * Skripta ekstraktuje JS array, parsira ga kao JSON i:
 *   1) Kreira/UPSERT-uje 11 kvizova (nivo=3, modul='ilmihal', variant='tematski',
 *      pitanjaPoSesiji=30, kategorija mapirana na KVIZ_KATEGORIJE)
 *   2) UPSERT-uje pitanja u centralnu banku (pitanja_banka) — dedup po
 *      normalizovanom tekstu pitanja (postojeći UNIQUE indeks)
 *   3) Veže pitanja za kviz preko kviz_pitanja join tabele
 *   4) Puni jsonb `pitanja` na kvizu (legacy fallback) — server read path
 *      koristi JSONB kao primarni redoslijed pa je nužno da je popunjen
 *
 * IDEMPOTENTNO: ON CONFLICT DO NOTHING na svim insert-ima. Ponovno pokretanje
 * ne pravi duplikate. Da se UPDATE postojećeg kviza forsira, koristi --force
 * (briše sve postojeće veze i jsonb prije ponovnog umetanja).
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts exec tsx ./src/import-tematski-kvizovi.ts
 *   pnpm --filter @workspace/scripts exec tsx ./src/import-tematski-kvizovi.ts --force
 */
import { db, kvizoviTable, pitanjaBankaTable, kvizPitanjaTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

type RawQuestion = {
  source_file?: string;
  lesson_title?: string;
  question: string;
  answers: string[];
  correct_index: number;
  type?: string;
  category?: string;
  correct?: string;
  source?: string;
};

// Mapiranje kategorije iz HTML-a na postojeće KVIZ_KATEGORIJE iz schema/content.ts.
// Uglavnom ahlak/historija/vjerovanje/namaz/halal_haram/opce.
const KATEGORIJA_MAP: Record<string, { kategorija: string; naslov: string; slug: string }> = {
  dobre_osobine:      { kategorija: "ahlak",       naslov: "Dobre osobine",                slug: "3-tematski-dobre-osobine" },
  drustveni_zivot:    { kategorija: "ahlak",       naslov: "Društveni život",              slug: "3-tematski-drustveni-zivot" },
  historija_kultura:  { kategorija: "historija",   naslov: "Historija i kultura",          slug: "3-tematski-historija-kultura" },
  imanski_sarti:      { kategorija: "vjerovanje",  naslov: "Imanski šarti",                slug: "3-tematski-imanski-sarti" },
  islamska_zajednica: { kategorija: "opce",        naslov: "Islamska zajednica",           slug: "3-tematski-islamska-zajednica" },
  islamski_sarti:     { kategorija: "namaz",       naslov: "Islamski šarti",               slug: "3-tematski-islamski-sarti" },
  lose_osobine:       { kategorija: "ahlak",       naslov: "Loše osobine",                 slug: "3-tematski-lose-osobine" },
  muhammed_zivot:     { kategorija: "historija",   naslov: "Muhammed, a.s. — život",       slug: "3-tematski-muhammed-zivot" },
  ostalo:             { kategorija: "opce",        naslov: "Ostala pitanja",               slug: "3-tematski-ostalo" },
  ovisnosti:          { kategorija: "halal_haram", naslov: "Ovisnosti",                    slug: "3-tematski-ovisnosti" },
  poslanici:          { kategorija: "historija",   naslov: "Allahovi poslanici",           slug: "3-tematski-poslanici" },
};

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function extractAllQuestions(html: string): RawQuestion[] {
  // Pronađi `const allQuestions = [ ... ];` blok i parsiraj kao JSON.
  const m = html.match(/const\s+allQuestions\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!m) throw new Error("nije pronađen `const allQuestions = [...]` blok");
  return JSON.parse(m[1]) as RawQuestion[];
}

function fileKey(filename: string): string | null {
  // attached_assets/kviz_<key>_<timestamp>.html
  const m = filename.match(/^kviz_([a-z_]+?)_\d+\.html$/);
  return m ? m[1] : null;
}

interface ImportResult {
  fajl: string;
  slug: string;
  kvizId: number;
  ucitano: number;
  bankaInserted: number;
  bankaSkipped: number;
  vezaInserted: number;
  vezaSkipped: number;
}

async function importJednogKviza(
  filePath: string,
  key: string,
  meta: { kategorija: string; naslov: string; slug: string },
  force: boolean,
): Promise<ImportResult> {
  const html = readFileSync(filePath, "utf-8");
  const raw = extractAllQuestions(html);

  // Filtriraj samo validna multiple-choice (sva su takva po pregledu, ali sigurno).
  const validni = raw.filter(
    (q) =>
      typeof q?.question === "string" &&
      Array.isArray(q.answers) &&
      q.answers.length >= 2 &&
      typeof q.correct_index === "number" &&
      q.correct_index >= 0 &&
      q.correct_index < q.answers.length,
  );

  // Dedup unutar istog kviza (isto pitanje se može pojaviti dva puta u HTML-u).
  const seen = new Set<string>();
  const unique = validni.filter((q) => {
    const k = normalize(q.question).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 1) UPSERT kviz (po slug)
  const [postojeci] = await db
    .select({ id: kvizoviTable.id })
    .from(kvizoviTable)
    .where(eq(kvizoviTable.slug, meta.slug));

  let kvizId: number;
  // jsonb pitanja u shape-u koji frontend (kviz.tsx) očekuje za "radio" tip
  const jsonbPitanja = unique.map((q) => ({
    type: "radio",
    question: q.question,
    options: q.answers,
    answer: q.answers[q.correct_index],
  }));

  if (postojeci) {
    kvizId = postojeci.id;
    if (force) {
      await db.delete(kvizPitanjaTable).where(eq(kvizPitanjaTable.kvizId, kvizId));
    }
    await db
      .update(kvizoviTable)
      .set({
        nivo: 3,
        naslov: meta.naslov,
        modul: "ilmihal",
        variant: "tematski",
        kategorija: meta.kategorija,
        opis: `Tematski kviz nivoa 3 — ${meta.naslov}. Banka pitanja: ${unique.length}, po sesiji se nasumično generira 30.`,
        pitanjaPoSesiji: 30,
        pitanja: jsonbPitanja,
        isPublished: true,
      })
      .where(eq(kvizoviTable.id, kvizId));
  } else {
    const [novi] = await db
      .insert(kvizoviTable)
      .values({
        nivo: 3,
        slug: meta.slug,
        naslov: meta.naslov,
        modul: "ilmihal",
        variant: "tematski",
        kategorija: meta.kategorija,
        opis: `Tematski kviz nivoa 3 — ${meta.naslov}. Banka pitanja: ${unique.length}, po sesiji se nasumično generira 30.`,
        pitanjaPoSesiji: 30,
        pitanja: jsonbPitanja,
        isPublished: true,
      })
      .returning({ id: kvizoviTable.id });
    kvizId = novi.id;
  }

  // 2) UPSERT pitanja u banku (ON CONFLICT DO NOTHING po normalizovanom tekstu)
  let bankaInserted = 0;
  let bankaSkipped = 0;
  let vezaInserted = 0;
  let vezaSkipped = 0;

  for (let i = 0; i < unique.length; i++) {
    const q = unique[i];
    const norm = normalize(q.question);

    // Insert u banku — tekstualno polje `pitanje` je UNIQUE indeks po normalizovanom
    // (skripta migrate-pitanja-u-banku također koristi normalize — ali konkretno DB
    // unique indeks je nad raw `pitanje`. Da održimo idempotentnost, pišemo norm.)
    const inserted = await db
      .insert(pitanjaBankaTable)
      .values({
        pitanje: norm,
        opcije: q.answers,
        correctIndex: q.correct_index,
        correctIndexes: null,
        correctOrder: null,
        meta: null,
        objasnjenje: "",
        slika: null,
        vrsta: "single",
        kategorija: meta.kategorija,
        lekcijaId: null,
        tezina: 1,
        createdBy: null,
      })
      .onConflictDoNothing({ target: pitanjaBankaTable.pitanje })
      .returning({ id: pitanjaBankaTable.id });

    let pitanjeId: number;
    if (inserted.length > 0) {
      pitanjeId = inserted[0].id;
      bankaInserted++;
    } else {
      bankaSkipped++;
      const [postojecePit] = await db
        .select({ id: pitanjaBankaTable.id })
        .from(pitanjaBankaTable)
        .where(eq(pitanjaBankaTable.pitanje, norm));
      if (!postojecePit) continue;
      pitanjeId = postojecePit.id;
    }

    // 3) Veza kviz ↔ pitanje (ON CONFLICT DO NOTHING)
    const veza = await db
      .insert(kvizPitanjaTable)
      .values({ kvizId, pitanjeId, redoslijed: i })
      .onConflictDoNothing({ target: [kvizPitanjaTable.kvizId, kvizPitanjaTable.pitanjeId] })
      .returning({ id: kvizPitanjaTable.id });

    if (veza.length > 0) vezaInserted++;
    else vezaSkipped++;
  }

  return {
    fajl: filePath.split("/").pop()!,
    slug: meta.slug,
    kvizId,
    ucitano: unique.length,
    bankaInserted,
    bankaSkipped,
    vezaInserted,
    vezaSkipped,
  };
}

async function main() {
  const force = process.argv.includes("--force");
  const dir = join(process.cwd(), "..", "attached_assets");
  const fajlovi = readdirSync(dir).filter((f) => /^kviz_[a-z_]+_\d+\.html$/.test(f));
  console.log(`[import] pronađeno ${fajlovi.length} HTML fajlova u ${dir}/`);
  if (force) console.log(`[import] FORCE mode: brišem postojeće kviz_pitanja veze prije insert-a`);

  const rezultati: ImportResult[] = [];
  for (const f of fajlovi) {
    const key = fileKey(f);
    if (!key) {
      console.warn(`  preskačem ${f} — ne mogu izvući kategoriju`);
      continue;
    }
    const meta = KATEGORIJA_MAP[key];
    if (!meta) {
      console.warn(`  preskačem ${f} — kategorija "${key}" nije u KATEGORIJA_MAP`);
      continue;
    }
    try {
      const r = await importJednogKviza(join(dir, f), key, meta, force);
      rezultati.push(r);
      console.log(
        `  ✓ ${r.fajl}  →  kviz #${r.kvizId} (${r.slug})  |  pitanja: ${r.ucitano}  |  banka +${r.bankaInserted}/⊘${r.bankaSkipped}  |  veza +${r.vezaInserted}/⊘${r.vezaSkipped}`,
      );
    } catch (err) {
      console.error(`  ✗ ${f} — GREŠKA:`, err instanceof Error ? err.message : err);
    }
  }

  // Summary
  const totalUcitano = rezultati.reduce((a, b) => a + b.ucitano, 0);
  const totalBanka = rezultati.reduce((a, b) => a + b.bankaInserted, 0);
  const totalVeza = rezultati.reduce((a, b) => a + b.vezaInserted, 0);

  console.log(`\n[import] ZAVRŠENO`);
  console.log(`  obrađeno fajlova:           ${rezultati.length}`);
  console.log(`  ukupno učitanih pitanja:    ${totalUcitano}`);
  console.log(`  novih pitanja u banci:      ${totalBanka}`);
  console.log(`  novih veza kviz↔pitanje:    ${totalVeza}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[import] FATAL:", err);
  process.exit(1);
});
