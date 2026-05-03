/**
 * Restore JSONB pitanja u kvizove iz scripts/content-seed.json.gz
 * gdje je broj pitanja u DB MANJI od broja u seedu.
 *
 * Strategija (Opcija A — OVERWRITE):
 *   1. Za svaki kviz u seedu, ako kviz u DB ima MANJE pitanja od seed verzije,
 *      OVERWRITE-uje JSONB pitanja sa seed verzijom.
 *   2. Briše sve `kviz_pitanja` redove za pogođene kvizove (resetuje veze).
 *   3. Korisnik nakon ovoga treba pokrenuti `migrate-pitanja-u-banku` da
 *      ponovo napravi veze (i dopuni banku novim pitanjima).
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts exec tsx ./src/restore-pitanja-iz-seed.ts
 */
import { db, kvizoviTable, kvizPitanjaTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type SeedKviz = {
  slug: string;
  pitanja?: unknown[];
  questions?: unknown[];
};

async function main() {
  const seedPath = resolve(__dirname, "../content-seed.json.gz");
  console.log(`[restore] čitam ${seedPath}`);
  const raw = gunzipSync(readFileSync(seedPath)).toString("utf-8");
  const seedData = JSON.parse(raw) as { kvizovi?: SeedKviz[]; quizzes?: SeedKviz[] };
  const seedKvizovi = seedData.kvizovi ?? seedData.quizzes ?? [];
  console.log(`[restore] u seed fajlu: ${seedKvizovi.length} kvizova`);

  const dbKvizovi = await db
    .select({
      id: kvizoviTable.id,
      slug: kvizoviTable.slug,
      pitanja: kvizoviTable.pitanja,
    })
    .from(kvizoviTable);
  const dbMap = new Map(dbKvizovi.map((k) => [k.slug, k]));

  const toOverwrite: Array<{ id: number; slug: string; novaPitanja: unknown[]; staroN: number; novoN: number }> = [];

  for (const sk of seedKvizovi) {
    const dbk = dbMap.get(sk.slug);
    if (!dbk) {
      console.warn(`  [seed] ${sk.slug} — nema u DB, preskačem`);
      continue;
    }
    const seedPit = (sk.pitanja ?? sk.questions ?? []) as unknown[];
    const dbPit = (dbk.pitanja ?? []) as unknown[];
    if (seedPit.length > dbPit.length) {
      toOverwrite.push({
        id: dbk.id,
        slug: sk.slug,
        novaPitanja: seedPit,
        staroN: dbPit.length,
        novoN: seedPit.length,
      });
    }
  }

  console.log(`\n[restore] kvizova za overwrite: ${toOverwrite.length}`);
  for (const x of toOverwrite) {
    console.log(`  ${x.slug.padEnd(40)} ${x.staroN} → ${x.novoN}`);
  }

  if (toOverwrite.length === 0) {
    console.log("[restore] ništa za vratiti, izlazim.");
    process.exit(0);
  }

  const ids = toOverwrite.map((x) => x.id);

  // 1. Obriši stare veze (njih ćemo ponovo napraviti migracijom)
  const obrisaneVeze = await db
    .delete(kvizPitanjaTable)
    .where(inArray(kvizPitanjaTable.kvizId, ids))
    .returning({ id: kvizPitanjaTable.id });
  console.log(`\n[restore] obrisano ${obrisaneVeze.length} starih veza u kviz_pitanja`);

  // 2. Overwrite JSONB pitanja
  let totalUbačeno = 0;
  for (const x of toOverwrite) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.update(kvizoviTable).set({ pitanja: x.novaPitanja as any }).where(eq(kvizoviTable.id, x.id));
    totalUbačeno += x.novoN;
  }
  console.log(`[restore] OVERWRITE završen — ${totalUbačeno} pitanja vraćeno u ${toOverwrite.length} kvizova`);
  console.log(`\n[restore] sljedeći korak: pokreni migrate-pitanja-u-banku da napuni banku + napravi nove veze`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[restore] GREŠKA:", err);
  process.exit(1);
});
