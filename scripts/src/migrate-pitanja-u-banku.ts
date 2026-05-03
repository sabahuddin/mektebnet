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
import { sql } from "drizzle-orm";

type LegacyPitanje = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  image?: string;
};

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

async function main() {
  console.log("[migracija] počinje...");

  const kvizovi = await db
    .select({
      id: kvizoviTable.id,
      slug: kvizoviTable.slug,
      naslov: kvizoviTable.naslov,
      pitanja: kvizoviTable.pitanja,
    })
    .from(kvizoviTable);

  console.log(`[migracija] pronađeno ${kvizovi.length} kvizova`);

  let bankaInserted = 0;
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
      if (!p?.question || !Array.isArray(p.options) || p.options.length === 0) {
        console.warn(`  [${kviz.slug}] preskačem nevažeće pitanje #${i}`);
        continue;
      }

      const pitanjeText = normalize(p.question);

      // Multi-select: odgovor ima '|||' separator. Split, traži svaku opciju.
      const answerParts = (p.answer ?? "").includes("|||")
        ? p.answer.split("|||").map(normalize).filter((s) => s.length > 0)
        : [normalize(p.answer ?? "")];

      const correctIndexes: number[] = [];
      for (const part of answerParts) {
        const idx = p.options.findIndex((o) => normalize(o) === part);
        if (idx >= 0 && !correctIndexes.includes(idx)) correctIndexes.push(idx);
      }

      if (correctIndexes.length === 0) {
        console.warn(
          `  [${kviz.slug}] pitanje "${pitanjeText.slice(0, 40)}..." — odgovor "${p.answer}" nije u opcijama, preskačem`
        );
        continue;
      }

      const isMulti = correctIndexes.length > 1;
      const correctIndex = correctIndexes[0]!;

      // 1. UPSERT u banku — ako tekst već postoji, ažuriraj correct_indexes/vrsta
      // (ovo popravlja stare redove koji su bili spremljeni kao 'single' iako su multi).
      const inserted = await db
        .insert(pitanjaBankaTable)
        .values({
          pitanje: pitanjeText,
          opcije: p.options,
          correctIndex,
          correctIndexes: isMulti ? correctIndexes : null,
          objasnjenje: p.explanation ?? "",
          slika: p.image ?? null,
          vrsta: isMulti ? "multiple" : "single",
        })
        .onConflictDoUpdate({
          target: pitanjaBankaTable.pitanje,
          set: {
            opcije: p.options,
            correctIndex,
            correctIndexes: isMulti ? correctIndexes : null,
            vrsta: isMulti ? "multiple" : "single",
            updatedAt: new Date(),
          },
        })
        .returning({ id: pitanjaBankaTable.id });

      // onConflictDoUpdate uvijek vraća red (insert ili update)
      if (inserted.length === 0) {
        console.warn(`  [${kviz.slug}] FAIL — UPSERT nije vratio red?`);
        continue;
      }
      const pitanjeId = inserted[0]!.id;
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

    console.log(
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

  console.log("\n[migracija] gotovo!");
  console.log(`  Kvizovi sa pitanjima: ${kvizoviSaPitanjima}`);
  console.log(`  Kvizovi prazni:       ${kvizoviPrazni}`);
  console.log(`  Banka — novo umetnuto: ${bankaInserted}`);
  console.log(`  Banka — već postojalo (dedup): ${bankaSkipped}`);
  console.log(`  Veza — novo umetnuto: ${vezaInserted}`);
  console.log(`  Veza — već postojalo: ${vezaSkipped}`);
  console.log(`\n  UKUPNO U BANCI: ${ukupnoBanka} jedinstvenih pitanja`);
  console.log(`  UKUPNO VEZA: ${ukupnoVeza} kviz↔pitanje`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[migracija] GREŠKA:", err);
  process.exit(1);
});
