/**
 * Migracija: prebaci sva pitanja iz JSONB-a `kvizovi.pitanja` u centralnu
 * banku `pitanja_banka` + napravi veze u `kviz_pitanja`.
 *
 * IDEMPOTENTNO — može se vrtjeti više puta:
 *   - INSERT u `pitanja_banka` koristi ON CONFLICT (pitanje) DO NOTHING
 *     pa se isti tekst pitanja deduplicira na nivou cijele banke.
 *   - INSERT u `kviz_pitanja` koristi ON CONFLICT (kviz_id, pitanje_id) DO NOTHING.
 *
 * NE BRIŠE `kvizovi.pitanja` JSONB — ostaje kao backup. Read path već koristi
 * banku ako postoje `kviz_pitanja` redovi za taj kviz.
 *
 * Pokreni LOKALNO (na dev DB):
 *   pnpm --filter @workspace/scripts exec tsx ./src/migrate-pitanja-u-banku.ts
 *
 * Za PRODUKCIJU (Coolify) — pokreni isti komand, ali sa DATABASE_URL koji
 * pokazuje na produkcijsku bazu (kroz docker exec ili lokalno sa env varom).
 */
import { db, kvizoviTable, pitanjaBankaTable, kvizPitanjaTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

type LegacyPitanje = {
  question: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  image?: string;
  type?: string;
  // reorder
  items?: { text: string; order: number }[];
  // dragDrop
  template?: string[];
  words?: string[];
  correct?: string[];
  // markWords
  text?: string;
  incorrect?: string[];
};

type Meta = {
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
} | null;

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export interface MigracijaResult {
  kvizoviSaPitanjima: number;
  kvizoviPrazni: number;
  bankaInserted: number;
  vezaInserted: number;
  vezaSkipped: number;
  ukupnoBanka: number;
  ukupnoVeza: number;
}

export async function migratePitanjaUBanku(opts?: { silent?: boolean }): Promise<MigracijaResult> {
  const log = opts?.silent ? () => {} : (...a: any[]) => console.log(...a);
  const warn = opts?.silent ? () => {} : (...a: any[]) => console.warn(...a);
  log("[migracija] počinje...");

  const kvizovi = await db
    .select({
      id: kvizoviTable.id,
      slug: kvizoviTable.slug,
      naslov: kvizoviTable.naslov,
      pitanja: kvizoviTable.pitanja,
    })
    .from(kvizoviTable);

  log(`[migracija] pronađeno ${kvizovi.length} kvizova`);

  let bankaInserted = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let bankaSkipped = 0;
  let vezaInserted = 0;
  let vezaSkipped = 0;
  let kvizoviSaPitanjima = 0;
  let kvizoviPrazni = 0;

  for (const kviz of kvizovi) {
    const pitanja = (kviz.pitanja ?? []) as LegacyPitanje[];
    if (pitanja.length === 0) {
      kvizoviPrazni++;
      continue;
    }
    kvizoviSaPitanjima++;

    for (let i = 0; i < pitanja.length; i++) {
      const p = pitanja[i];
      if (!p?.question) {
        warn(`  [${kviz.slug}] preskačem nevažeće pitanje #${i}`);
        continue;
      }

      const pitanjeText = normalize(p.question);
      const tipRaw = (p.type ?? "").toLowerCase();

      // Pripremi vrijednosti za insert — različito po tipu
      let vrsta: "single" | "multiple" | "truefalse" | "reorder" | "dragDrop" | "markWords";
      let opcije: string[];
      let correctIndex = 0;
      let correctIndexes: number[] | null = null;
      let correctOrder: number[] | null = null;
      let meta: Meta = null;

      if (tipRaw === "reorder") {
        // reorder: items=[{text, order}]. Spremi opcije u redoslijedu kako su u
        // seedu (može biti tačan redoslijed već), a correctOrder = order vrijednosti.
        if (!Array.isArray(p.items) || p.items.length < 2) {
          warn(`  [${kviz.slug}] reorder #${i} bez items, preskačem`);
          continue;
        }
        vrsta = "reorder";
        opcije = p.items.map((it) => normalize(it.text ?? ""));
        correctOrder = p.items.map((it) => Number(it.order) || 0);
        if (opcije.some((o) => o === "") || correctOrder.some((o) => o <= 0)) {
          warn(`  [${kviz.slug}] reorder #${i} ima prazne stavke ili invalidne order vrijednosti, preskačem`);
          continue;
        }
      } else if (tipRaw === "truefalse") {
        // truefalse: opcije=["Da","Ne"]. answer = "Da"/"Ne" (ili "Tačno"/"Netačno").
        const a = normalize(p.answer ?? "").toLowerCase();
        const yesVariants = ["da", "tačno", "tacno", "true", "yes", "ispravno"];
        const idx = yesVariants.includes(a) ? 0 : 1;
        vrsta = "truefalse";
        opcije = ["Da", "Ne"];
        correctIndex = idx;
      } else if (tipRaw === "dragdrop") {
        // dragDrop: template (sa "DROP"), words, correct (slijed za DROP slotove)
        const template = Array.isArray(p.template) ? p.template.map(String) : [];
        const words = Array.isArray(p.words) ? p.words.map(String) : [];
        const correct = Array.isArray(p.correct) ? p.correct.map(String) : [];
        const dropCount = template.filter((t) => t === "DROP").length;
        if (template.length === 0 || words.length === 0 || dropCount === 0) {
          warn(`  [${kviz.slug}] dragDrop #${i} ima prazan template/words/DROP, preskačem`);
          continue;
        }
        if (correct.length !== dropCount) {
          warn(`  [${kviz.slug}] dragDrop #${i} correct.length=${correct.length} ≠ DROP count=${dropCount}, preskačem`);
          continue;
        }
        vrsta = "dragDrop";
        opcije = []; // ne koristi se za dragDrop
        meta = { template, words, correct };
      } else if (tipRaw === "markwords") {
        // markWords: text (fallback), words (klikabilne riječi), incorrect (riječi koje treba kliknuti)
        const words = Array.isArray(p.words) ? p.words.map(String) : [];
        const incorrect = Array.isArray(p.incorrect) ? p.incorrect.map(String) : [];
        const text = typeof p.text === "string" ? p.text : "";
        if (words.length === 0 || incorrect.length === 0) {
          warn(`  [${kviz.slug}] markWords #${i} bez words/incorrect, preskačem`);
          continue;
        }
        vrsta = "markWords";
        opcije = [];
        meta = { text, words, incorrect };
      } else {
        // single / multiple / radio / checkbox / nothing → klasično
        if (!Array.isArray(p.options) || p.options.length === 0) {
          warn(`  [${kviz.slug}] preskačem nevažeće pitanje #${i}`);
          continue;
        }
        const answerParts = (p.answer ?? "").includes("|||")
          ? p.answer!.split("|||").map(normalize).filter((s) => s.length > 0)
          : [normalize(p.answer ?? "")];
        const idxs: number[] = [];
        for (const part of answerParts) {
          const idx = p.options.findIndex((o) => normalize(o) === part);
          if (idx >= 0 && !idxs.includes(idx)) idxs.push(idx);
        }
        if (idxs.length === 0) {
          warn(`  [${kviz.slug}] "${pitanjeText.slice(0, 40)}…" — odgovor "${p.answer}" nije u opcijama, preskačem`);
          continue;
        }
        const isMulti = idxs.length > 1;
        vrsta = isMulti ? "multiple" : "single";
        opcije = p.options;
        correctIndex = idxs[0]!;
        correctIndexes = isMulti ? idxs : null;
      }

      // 1. UPSERT u banku — različita strategija po tipu:
      //
      // Standardni tipovi (single/multiple/truefalse/reorder):
      //   onConflictDoUpdate po `pitanje` (partial UNIQUE
      //   `pitanja_banka_pitanje_std_unique_idx WHERE vrsta NOT IN (...)`).
      //
      // Interaktivni tipovi (dragDrop/markWords):
      //   Ručni SELECT-then-INSERT na (pitanje, vrsta, md5(meta::text)).
      //   Razlog: drizzle-ov onConflict ne podržava partial UNIQUE indexe sa
      //   WHERE klauzulom, a partial UNIQUE
      //   `pitanja_banka_pitanje_meta_unique_idx WHERE vrsta IN (...)` je
      //   neophodan jer ista generička pitanja kao "Dopuni:" / "Pronađi greške:"
      //   imaju 40+ varijanti sa različitim meta. Bez ovog dedup-a sve varijante
      //   bi se prepisale jedna preko druge i banka bi izgubila ~180 pitanja.
      let pitanjeId: number;
      if (vrsta === "dragDrop" || vrsta === "markWords") {
        const metaJson = JSON.stringify(meta);
        const existing = await db
          .select({ id: pitanjaBankaTable.id })
          .from(pitanjaBankaTable)
          .where(
            and(
              eq(pitanjaBankaTable.pitanje, pitanjeText),
              eq(pitanjaBankaTable.vrsta, vrsta),
              // Dvostruki cast `::jsonb::text` forsira da JS-strigfikovani JSON
              // prođe kroz Postgres jsonb canonicalization (sorted keys,
              // normalizovan whitespace) — inače md5 hash-ovi se ne poklapaju
              // sa stored vrijednostima i SELECT promaši duplikat.
              sql`md5(${pitanjaBankaTable.meta}::text) = md5(${metaJson}::jsonb::text)`,
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          pitanjeId = existing[0]!.id;
        } else {
          const ins = await db
            .insert(pitanjaBankaTable)
            .values({
              pitanje: pitanjeText,
              opcije,
              correctIndex,
              correctIndexes,
              correctOrder,
              meta,
              objasnjenje: p.explanation ?? "",
              slika: p.image ?? null,
              vrsta,
            })
            .returning({ id: pitanjaBankaTable.id });
          if (ins.length === 0) {
            warn(`  [${kviz.slug}] FAIL — INSERT interaktivnog pitanja vratio prazno`);
            continue;
          }
          pitanjeId = ins[0]!.id;
        }
      } else {
        const inserted = await db
          .insert(pitanjaBankaTable)
          .values({
            pitanje: pitanjeText,
            opcije,
            correctIndex,
            correctIndexes,
            correctOrder,
            meta,
            objasnjenje: p.explanation ?? "",
            slika: p.image ?? null,
            vrsta,
          })
          .onConflictDoUpdate({
            target: pitanjaBankaTable.pitanje,
            targetWhere: sql`vrsta NOT IN ('dragDrop','markWords')`,
            set: {
              opcije,
              correctIndex,
              correctIndexes,
              correctOrder,
              meta,
              vrsta,
              updatedAt: new Date(),
            },
          })
          .returning({ id: pitanjaBankaTable.id });
        if (inserted.length === 0) {
          warn(`  [${kviz.slug}] FAIL — UPSERT nije vratio red?`);
          continue;
        }
        pitanjeId = inserted[0]!.id;
      }
      bankaInserted++; // brojimo sve obrađene (insert+update zajedno)

      // 2. INSERT veza kviz↔pitanje
      const linked = await db
        .insert(kvizPitanjaTable)
        .values({
          kvizId: kviz.id,
          pitanjeId,
          redoslijed: i,
        })
        .onConflictDoNothing()
        .returning({ id: kvizPitanjaTable.id });

      if (linked.length > 0) vezaInserted++;
      else vezaSkipped++;
    }

    log(
      `  [${kviz.slug}] "${kviz.naslov}" — ${pitanja.length} pitanja obrađeno`
    );
  }

  // Statistika
  const [{ ukupnoBanka }] = await db
    .select({ ukupnoBanka: sql<number>`COUNT(*)::int` })
    .from(pitanjaBankaTable);
  const [{ ukupnoVeza }] = await db
    .select({ ukupnoVeza: sql<number>`COUNT(*)::int` })
    .from(kvizPitanjaTable);

  log("\n[migracija] gotovo!");
  log(`  Kvizovi sa pitanjima: ${kvizoviSaPitanjima}`);
  log(`  Kvizovi prazni:       ${kvizoviPrazni}`);
  log(`  Banka — novo umetnuto: ${bankaInserted}`);
  log(`  Veza — novo umetnuto: ${vezaInserted}`);
  log(`  Veza — već postojalo: ${vezaSkipped}`);
  log(`\n  UKUPNO U BANCI: ${ukupnoBanka} jedinstvenih pitanja`);
  log(`  UKUPNO VEZA: ${ukupnoVeza} kviz↔pitanje`);

  return {
    kvizoviSaPitanjima,
    kvizoviPrazni,
    bankaInserted,
    vezaInserted,
    vezaSkipped,
    ukupnoBanka: Number(ukupnoBanka),
    ukupnoVeza: Number(ukupnoVeza),
  };
}

// CLI entry point — pokreni samo kad je fajl direktno izvršen (tsx ./src/migrate-pitanja-u-banku.ts)
const isCli = typeof process !== "undefined"
  && Array.isArray(process.argv)
  && process.argv[1]?.includes("migrate-pitanja-u-banku");
if (isCli) {
  migratePitanjaUBanku()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[migracija] GREŠKA:", err);
      process.exit(1);
    });
}
