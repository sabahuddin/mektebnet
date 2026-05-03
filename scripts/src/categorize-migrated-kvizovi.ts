/**
 * Task #110 — Popuni `kategorija` i `lekcija_id` za migrirane kvizove.
 *
 * Pozadina: Migracija kvizova ka centralnoj banci pitanja je gotova
 * (1034 unique pitanja, 27 migriranih kvizova), ali polje `kategorija`
 * je ostalo NULL na svim postojećim kvizovima. Zbog toga je novi
 * "Po oblasti" toggle/filter na /kvizovi stranici ostao sakriven —
 * nije bilo šta da se filtrira.
 *
 * Ovaj skript je idempotentan: postavlja `kategorija` na sve postojeće
 * kvizove (KVIZ_KATEGORIJE iz @workspace/db/schema/content) i dodjeljuje
 * `lekcija_id` cross-link za poslaničke kvizove gdje postoji jasna
 * odgovarajuća lekcija u `ilmihal_lekcije`.
 *
 * Mapiranje:
 *   - `modul = 'knjige'` (kvizovi o poslanicima) → 'historija'
 *   - `modul = 'ilmihal'` (1A..3E i hard varijante) → 'opce'
 *     (mješoviti review-style kvizovi cijelog nivoa: vjerovanje, namaz,
 *      sure, ahlak — pa je 'opce' najtačnije)
 *
 * Pokretanje:
 *   pnpm --filter @workspace/scripts exec tsx ./src/categorize-migrated-kvizovi.ts
 */
import { db } from "@workspace/db";
import { kvizoviTable, ilmihalLekcijeTable } from "@workspace/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

type LekcijaMatch = { kvizSlug: string; lekcijaSlug: string; nivo: number };

const POSLANIK_LEKCIJA_MAPPING: LekcijaMatch[] = [
  { kvizSlug: "kviz-adem", lekcijaSlug: "adem-as", nivo: 2 },
  { kvizSlug: "kviz-nuh", lekcijaSlug: "nuh-as", nivo: 3 },
  { kvizSlug: "kviz-ibrahim", lekcijaSlug: "ibrahim-as", nivo: 3 },
  { kvizSlug: "kviz-musa", lekcijaSlug: "musa-as", nivo: 3 },
  { kvizSlug: "kviz-isa", lekcijaSlug: "isa-as", nivo: 3 },
  { kvizSlug: "kviz-muhammed-1-djetinjstvo", lekcijaSlug: "muhammed-as-djetinjstvo", nivo: 3 },
  { kvizSlug: "kviz-muhammed-2-poslanstvo-do-hidzre", lekcijaSlug: "hidzra", nivo: 3 },
  { kvizSlug: "kviz-muhammed-3-medinski-period", lekcijaSlug: "bitka-bedr", nivo: 3 },
];

async function run() {
  console.log("📋 Categorizing migrated kvizovi...\n");

  const knjigeRes = await db
    .update(kvizoviTable)
    .set({ kategorija: "historija" })
    .where(and(eq(kvizoviTable.modul, "knjige"), isNull(kvizoviTable.kategorija)))
    .returning({ id: kvizoviTable.id });
  console.log(`✅ knjige → 'historija': ${knjigeRes.length} kvizova`);

  const ilmihalRes = await db
    .update(kvizoviTable)
    .set({ kategorija: "opce" })
    .where(and(eq(kvizoviTable.modul, "ilmihal"), isNull(kvizoviTable.kategorija)))
    .returning({ id: kvizoviTable.id });
  console.log(`✅ ilmihal → 'opce':      ${ilmihalRes.length} kvizova\n`);

  let linked = 0;
  let skipped = 0;
  for (const m of POSLANIK_LEKCIJA_MAPPING) {
    const lek = await db
      .select({ id: ilmihalLekcijeTable.id })
      .from(ilmihalLekcijeTable)
      .where(and(eq(ilmihalLekcijeTable.slug, m.lekcijaSlug), eq(ilmihalLekcijeTable.nivo, m.nivo)))
      .limit(1);
    if (lek.length === 0) {
      console.log(`  ⚠️  Lekcija nije nađena: nivo${m.nivo}/${m.lekcijaSlug} (preskačem ${m.kvizSlug})`);
      skipped++;
      continue;
    }
    const upd = await db
      .update(kvizoviTable)
      .set({ lekcijaId: lek[0].id })
      .where(eq(kvizoviTable.slug, m.kvizSlug))
      .returning({ id: kvizoviTable.id });
    if (upd.length > 0) {
      console.log(`  🔗 ${m.kvizSlug} → lekcija_id=${lek[0].id} (${m.lekcijaSlug})`);
      linked++;
    } else {
      console.log(`  ⚠️  Kviz nije nađen: ${m.kvizSlug}`);
      skipped++;
    }
  }
  console.log(`\n✅ Cross-linkovano: ${linked} | preskočeno: ${skipped}`);

  const remainingNull = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(kvizoviTable)
    .where(isNull(kvizoviTable.kategorija));
  console.log(`\n🔎 Verifikacija: kvizovi sa kategorija IS NULL = ${remainingNull[0].count}`);
  if (remainingNull[0].count !== 0) {
    throw new Error("Postoje kvizovi bez kategorije nakon migracije");
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => process.exit(0));
