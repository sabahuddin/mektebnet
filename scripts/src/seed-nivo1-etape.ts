/**
 * Reorganizacija kvizova Nivoa 1 u etapne kvizove (Zlatni medaljoni) i
 * završne kvizove krunisanja.
 *
 * Mapa Nivoa 1 ima 64 lekcije i medaljon nakon svakih 10 lekcija — dakle
 * 6 etapa (lekcije 1-10, 11-20, ... 51-60). Lekcije 61-64 nemaju svoj
 * medaljon i ulaze samo u završni ispit nivoa.
 *
 * Šta skripta radi:
 *   1. Iz `scripts/content-seed.json.gz` čita 10 postojećih kvizova Nivoa 1
 *      (1a…1e + NAPREDNI varijante), deduplicira ih i svako pitanje smješta
 *      u etapu prema `scripts/data/nivo1-mapa-pitanja.json` (ručno urađena
 *      klasifikacija pitanje → blok od 10 lekcija).
 *   2. Dodaje ugrađena pitanja iz samih lekcija (`ilmihal_lekcije.kviz_pitanja`),
 *      uz jezičke ispravke iz `scripts/data/nivo1-lekcijska-ispravke.json`.
 *   3. Dodaje nova pitanja iz `scripts/data/nivo1-nova-pitanja.json`.
 *   4. Za svaku etapu bira do 100 pitanja (prednost imaju `single`/`truefalse`
 *      jer samo njih ispit etape/krunisanja može bodovati) i pravi kviz
 *      `1-etapa-N`, vezan za medaljon nivoa preko `medaljoni.kviz_pitanja_ids`.
 *   5. Od svih pitanja nivoa pravi tri završna kviza `1-krunisanje-a|b|c`
 *      (po 100 pitanja, bez preklapanja) i upisuje svih 300 u `krunisanja`
 *      za Nivo 1 — server na startu ispita servira nasumičnih 100.
 *
 * IDEMPOTENTNO: pitanja se traže u banci po normalizovanom tekstu (i `meta`
 * za dragDrop/markWords) prije nego što se ubace, kvizovi se upsert-uju po
 * slug-u, veze se prave iznova pri svakom pokretanju.
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts exec tsx ./src/seed-nivo1-etape.ts --dry-run
 *   pnpm --filter @workspace/scripts exec tsx ./src/seed-nivo1-etape.ts
 * Opcije:
 *   --dry-run           ništa ne upisuje, samo ispiše plan
 *   --zadrzi-pozicije   ne pomjera `posAfterRedoslijed` postojećih medaljona
 *   --bez-gatinga       medaljoni ne zaključavaju sljedećih 10 lekcija
 */
import {
  db,
  kvizoviTable,
  pitanjaBankaTable,
  kvizPitanjaTable,
  ilmihalLekcijeTable,
  medaljoniTable,
  krunisanjaTable,
} from "@workspace/db";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETAPE,
  IZVORNI_KVIZOVI,
  bankaKljuc,
  buildPool,
  etapaZaRedoslijed,
  odaberiZaEtapu,
  parseLegacy,
  podijeliKrunisanje,
  type LegacyPitanje,
  type ParsedPitanje,
} from "./nivo1-etape-lib.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const ZADRZI_POZICIJE = process.argv.includes("--zadrzi-pozicije");
const BEZ_GATINGA = process.argv.includes("--bez-gatinga");
const NIVO = 1;
/** Koliko pitanja ide u mini-provjeru na samoj medaljon-lekciji. */
const PITANJA_U_MEDALJON_LEKCIJI = 10;

type SeedFile = {
  kvizovi?: { slug: string; pitanja?: LegacyPitanje[] }[];
};

function ucitajJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, relPath), "utf-8")) as T;
}

async function main() {
  // ── 1. Pitanja iz 10 postojećih kvizova Nivoa 1 ───────────────────────────
  const seedPath = resolve(__dirname, "../content-seed.json.gz");
  const seed = JSON.parse(gunzipSync(readFileSync(seedPath)).toString("utf-8")) as SeedFile;
  const seedKvizovi = new Map((seed.kvizovi ?? []).map((k) => [k.slug, k.pitanja ?? []]));
  for (const slug of IZVORNI_KVIZOVI) {
    if (!seedKvizovi.has(slug)) throw new Error(`Seed nema kviz "${slug}"`);
  }
  const pool = buildPool(IZVORNI_KVIZOVI.map((slug) => ({ slug, pitanja: seedKvizovi.get(slug)! })));
  const mapaPitanja = ucitajJson<Record<string, number>>("../data/nivo1-mapa-pitanja.json");
  const nemapirana = pool.filter((p) => !mapaPitanja[p.id]);
  if (nemapirana.length > 0) {
    throw new Error(`${nemapirana.length} pitanja nema etapu u nivo1-mapa-pitanja.json (npr. ${nemapirana[0]!.id})`);
  }
  console.log(`[1] iz kvizova: ${pool.length} jedinstvenih pitanja`);

  // ── 2. Ugrađena pitanja iz lekcija Nivoa 1 ────────────────────────────────
  const ispravke = ucitajJson<Record<string, LegacyPitanje>>("../data/nivo1-lekcijska-ispravke.json");
  const lekcije = await db
    .select({
      id: ilmihalLekcijeTable.id,
      slug: ilmihalLekcijeTable.slug,
      redoslijed: ilmihalLekcijeTable.redoslijed,
      kvizPitanja: ilmihalLekcijeTable.kvizPitanja,
    })
    .from(ilmihalLekcijeTable)
    .where(and(eq(ilmihalLekcijeTable.nivo, NIVO), gte(ilmihalLekcijeTable.redoslijed, 0), lte(ilmihalLekcijeTable.redoslijed, 63)))
    .orderBy(asc(ilmihalLekcijeTable.redoslijed));
  console.log(`[2] lekcija Nivoa 1 (redoslijed 0-63): ${lekcije.length}`);

  type Kandidat = ParsedPitanje & { etapa: number; izvor: string; lekcijaId: number | null };
  const kandidati: Kandidat[] = [];

  for (const p of pool) {
    const parsed = parseLegacy(p.pitanje, p.id);
    if (!parsed) continue;
    kandidati.push({ ...parsed, etapa: mapaPitanja[p.id]!, izvor: `kviz:${p.id}`, lekcijaId: null });
  }

  let primijenjenihIspravki = 0;
  for (const l of lekcije) {
    const etapa = etapaZaRedoslijed(l.redoslijed);
    const pitanja = (l.kvizPitanja ?? []) as unknown as LegacyPitanje[];
    pitanja.forEach((raw, idx) => {
      const kljuc = `${l.slug}#${idx}`;
      const ispravka = ispravke[kljuc];
      if (ispravka) primijenjenihIspravki++;
      const parsed = parseLegacy(ispravka ?? raw, kljuc);
      if (!parsed) return;
      kandidati.push({ ...parsed, etapa, izvor: `lekcija:${kljuc}`, lekcijaId: l.id });
    });
  }
  console.log(`[2] primijenjeno ${primijenjenihIspravki}/${Object.keys(ispravke).length - 1} jezičkih ispravki`);

  // ── 3. Nova pitanja ───────────────────────────────────────────────────────
  const nova = ucitajJson<{ pitanja: (LegacyPitanje & { etapa: number; lekcija: string })[] }>(
    "../data/nivo1-nova-pitanja.json",
  );
  const lekcijaPoSlugu = new Map(lekcije.map((l) => [l.slug, l.id]));
  for (const n of nova.pitanja) {
    const parsed = parseLegacy(n, `novo:${n.lekcija}`);
    if (!parsed) continue;
    kandidati.push({
      ...parsed,
      etapa: n.etapa,
      izvor: `novo:${n.lekcija}`,
      lekcijaId: lekcijaPoSlugu.get(n.lekcija) ?? null,
    });
  }
  console.log(`[3] novih pitanja: ${nova.pitanja.length}`);

  // Dedup preko svih izvora (ista pravila kao UNIQUE indeksi u banci).
  const jedinstveni = new Map<string, Kandidat>();
  for (const k of kandidati) {
    const kljuc = bankaKljuc(k);
    if (!jedinstveni.has(kljuc)) jedinstveni.set(kljuc, k);
  }
  const sviKandidati = [...jedinstveni.values()];
  console.log(`[=] ukupno jedinstvenih kandidata: ${sviKandidati.length} (od ${kandidati.length})`);

  // ── 4. Izbor pitanja po etapama ───────────────────────────────────────────
  const izbor = ETAPE.map((e) => ({ etapa: e, pitanja: odaberiZaEtapu(sviKandidati, e.redni) }));
  for (const { etapa, pitanja } of izbor) {
    const st = pitanja.filter((p) => p.vrsta === "single" || p.vrsta === "truefalse").length;
    console.log(`    Etapa ${etapa.redni} (lekcije ${etapa.od + 1}-${etapa.do + 1}): ${pitanja.length} pitanja, od toga ${st} bodivih na ispitu`);
  }

  // ── 5. Krunisanje A/B/C ───────────────────────────────────────────────────
  const varijante = podijeliKrunisanje(sviKandidati);
  console.log(`[5] krunisanje: A=${varijante.a.length} B=${varijante.b.length} C=${varijante.c.length}`);

  // U banku ide samo ono što je stvarno završilo u nekom kvizu — kandidati
  // koji nisu izabrani ne pune banku bez potrebe.
  const koristeni = new Map<string, Kandidat>();
  for (const p of [...izbor.flatMap((i) => i.pitanja), ...varijante.a, ...varijante.b, ...varijante.c]) {
    koristeni.set(bankaKljuc(p), p);
  }
  console.log(`[=] pitanja koja idu u banku: ${koristeni.size}`);

  if (DRY_RUN) {
    console.log("\n[dry-run] ništa nije upisano.");
    return;
  }

  // ── 6. Upis pitanja u banku ───────────────────────────────────────────────
  const postojeca = await db
    .select({
      id: pitanjaBankaTable.id,
      pitanje: pitanjaBankaTable.pitanje,
      vrsta: pitanjaBankaTable.vrsta,
      meta: pitanjaBankaTable.meta,
    })
    .from(pitanjaBankaTable);
  const bankaIndex = new Map<string, number>();
  for (const row of postojeca) {
    bankaIndex.set(bankaKljuc({ pitanje: row.pitanje, vrsta: row.vrsta as ParsedPitanje["vrsta"], meta: row.meta ?? null }), row.id);
  }

  const idZaKljuc = new Map<string, number>();
  let ubaceno = 0;
  for (const [kljuc, k] of koristeni) {
    const postoji = bankaIndex.get(kljuc);
    if (postoji) {
      idZaKljuc.set(kljuc, postoji);
      continue;
    }
    const [red] = await db
      .insert(pitanjaBankaTable)
      .values({
        pitanje: k.pitanje,
        opcije: k.opcije,
        correctIndex: k.correctIndex,
        correctIndexes: k.correctIndexes,
        correctOrder: k.correctOrder,
        meta: k.meta,
        objasnjenje: k.objasnjenje,
        slika: k.slika,
        vrsta: k.vrsta,
        // Etapna pitanja pokrivaju više predmeta, pa kategoriju ostavljamo
        // praznom — admin je dodjeljuje u banci pitanja.
        lekcijaId: k.lekcijaId,
        tezina: k.tezina,
      })
      .returning({ id: pitanjaBankaTable.id });
    if (!red) {
      console.warn(`  ! nije ubačeno: ${k.pitanje.slice(0, 60)}`);
      continue;
    }
    idZaKljuc.set(kljuc, red.id);
    bankaIndex.set(kljuc, red.id);
    ubaceno++;
  }
  console.log(`[6] banka: ${ubaceno} novih pitanja, ${idZaKljuc.size - ubaceno} pronađeno kao postojeće`);

  const idOd = (k: ParsedPitanje) => idZaKljuc.get(bankaKljuc(k));

  // ── 7. Kvizovi etapa + veze ───────────────────────────────────────────────
  async function upsertKviz(opts: {
    slug: string;
    naslov: string;
    opis: string;
    variant: string;
    pitanjaPoSesiji: number | null;
    pitanja: ParsedPitanje[];
  }): Promise<number> {
    const [kviz] = await db
      .insert(kvizoviTable)
      .values({
        nivo: NIVO,
        slug: opts.slug,
        naslov: opts.naslov,
        opis: opts.opis,
        modul: "ilmihal",
        variant: opts.variant,
        pitanjaPoSesiji: opts.pitanjaPoSesiji,
        pitanja: opts.pitanja.map((p) => p.legacy),
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: kvizoviTable.slug,
        set: {
          nivo: NIVO,
          naslov: opts.naslov,
          opis: opts.opis,
          variant: opts.variant,
          pitanjaPoSesiji: opts.pitanjaPoSesiji,
          pitanja: opts.pitanja.map((p) => p.legacy),
        },
      })
      .returning({ id: kvizoviTable.id });
    const kvizId = kviz!.id;
    await db.delete(kvizPitanjaTable).where(eq(kvizPitanjaTable.kvizId, kvizId));
    const veze = opts.pitanja
      .map((p, i) => ({ kvizId, pitanjeId: idOd(p), redoslijed: i }))
      .filter((v): v is { kvizId: number; pitanjeId: number; redoslijed: number } => typeof v.pitanjeId === "number");
    if (veze.length > 0) {
      await db.insert(kvizPitanjaTable).values(veze).onConflictDoNothing();
    }
    return kvizId;
  }

  const postojeciMedaljoni = await db
    .select()
    .from(medaljoniTable)
    .where(eq(medaljoniTable.nivo, NIVO))
    .orderBy(asc(medaljoniTable.posAfterRedoslijed));
  if (postojeciMedaljoni.length > ETAPE.length) {
    console.warn(
      `  ! Nivo ${NIVO} ima ${postojeciMedaljoni.length} medaljona, a etapa je ${ETAPE.length}. ` +
        `Višak (${postojeciMedaljoni.slice(ETAPE.length).map((m) => m.slug).join(", ")}) ostaje netaknut — provjeri ručno.`,
    );
  }

  // Medaljon je "puna lekcija" `medaljon-nivo{N}-{ord}` — završetak te lekcije
  // osvaja medaljon i otključava sljedećih 10 lekcija. Čim medaljon dobije
  // pitanja, mapa ga tretira kao obaveznu etapu (`imaKviz`), pa lekcija mora
  // postojati da napredovanje ne stane.
  const medaljonLekcije = await db
    .select({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug })
    .from(ilmihalLekcijeTable)
    .where(eq(ilmihalLekcijeTable.nivo, NIVO));
  const postojeciSlugovi = new Set(medaljonLekcije.map((l) => l.slug));

  for (const { etapa, pitanja } of izbor) {
    const lekcijaSlug = `medaljon-nivo${NIVO}-${etapa.redni}`;
    if (!postojeciSlugovi.has(lekcijaSlug)) {
      const naslov = `Zlatni medaljon — Nivo ${NIVO} (medaljon ${etapa.redni})`;
      const mini = pitanja
        .filter((p) => p.vrsta === "single" || p.vrsta === "truefalse")
        .slice(0, PITANJA_U_MEDALJON_LEKCIJI)
        .map((p) => ({ question: p.pitanje, options: p.opcije, answer: p.opcije[p.correctIndex] ?? p.opcije[0]! }));
      await db.insert(ilmihalLekcijeTable).values({
        nivo: NIVO,
        slug: lekcijaSlug,
        naslov,
        redoslijed: 9000 + etapa.redni,
        contentHtml:
          `<h1>${naslov}</h1>` +
          `<p>${etapa.opis}</p>` +
          `<p>Prije nego što kreneš dalje, riješi malu provjeru znanja ispod. ` +
          `Cijeli kviz od 100 pitanja iz ovih lekcija čeka te na stranici ` +
          `<a href="/kviz/${etapa.kvizSlug}">${etapa.kvizNaslov}</a>.</p>`,
        kvizPitanja: mini,
        isPublished: true,
      }).onConflictDoNothing();
      console.log(`    kreirana medaljon-lekcija "${lekcijaSlug}" sa ${mini.length} pitanja mini-provjere`);
    }

    await upsertKviz({
      slug: etapa.kvizSlug,
      naslov: etapa.kvizNaslov,
      opis: etapa.opis,
      variant: "etapa",
      pitanjaPoSesiji: 20,
      pitanja,
    });
    const bodiva = pitanja
      .filter((p) => p.vrsta === "single" || p.vrsta === "truefalse")
      .map(idOd)
      .filter((v): v is number => typeof v === "number");

    const postojeci = postojeciMedaljoni[etapa.redni - 1];
    if (postojeci) {
      await db
        .update(medaljoniTable)
        .set({
          kvizPitanjaIds: bodiva,
          ...(ZADRZI_POZICIJE ? {} : { posAfterRedoslijed: etapa.do }),
          ...(BEZ_GATINGA ? { isGating: false } : {}),
        })
        .where(eq(medaljoniTable.id, postojeci.id));
      console.log(`    medaljon "${postojeci.slug}" ← ${bodiva.length} pitanja (pos ${ZADRZI_POZICIJE ? postojeci.posAfterRedoslijed : etapa.do})`);
    } else {
      await db
        .insert(medaljoniTable)
        .values({
          nivo: NIVO,
          slug: etapa.medaljonSlug,
          naziv: etapa.naziv,
          opis: etapa.opis,
          posAfterRedoslijed: etapa.do,
          kvizPitanjaIds: bodiva,
          pragProlazaPercent: 70,
          isGating: !BEZ_GATINGA,
        })
        .onConflictDoUpdate({
          target: medaljoniTable.slug,
          set: { kvizPitanjaIds: bodiva, posAfterRedoslijed: etapa.do },
        });
      console.log(`    medaljon "${etapa.medaljonSlug}" kreiran ← ${bodiva.length} pitanja`);
    }
  }

  // ── 8. Krunisanje ─────────────────────────────────────────────────────────
  const krunskiIds: number[] = [];
  for (const oznaka of ["a", "b", "c"] as const) {
    const pitanja = varijante[oznaka];
    await upsertKviz({
      slug: `1-krunisanje-${oznaka}`,
      naslov: `Krunisanje Nivoa 1 — kviz ${oznaka.toUpperCase()}`,
      opis: `Završni kviz Nivoa 1 (varijanta ${oznaka.toUpperCase()}) — 100 pitanja iz svih 64 lekcije.`,
      variant: "krunisanje",
      pitanjaPoSesiji: null,
      pitanja,
    });
    krunskiIds.push(...pitanja.map(idOd).filter((v): v is number => typeof v === "number"));
  }
  await db
    .insert(krunisanjaTable)
    .values({
      nivo: NIVO,
      naslov: "Krunisanje Nivoa 1",
      opisHtml: "<p>Završni ispit Nivoa 1. Pitanja se nasumično biraju iz tri završna kviza (A, B i C).</p>",
      kvizPitanjaIds: krunskiIds,
      pragProlazaPercent: 70,
      isGating: true,
    })
    .onConflictDoUpdate({
      target: krunisanjaTable.nivo,
      set: { kvizPitanjaIds: krunskiIds },
    });
  console.log(`[8] krunisanje Nivoa ${NIVO}: ${krunskiIds.length} pitanja u banci ispita`);
  if (!BEZ_GATINGA) {
    console.log(
      "\nNAPOMENA: medaljoni sada imaju pitanja, pa ih mapa tretira kao obavezne etape.\n" +
        "Učenici koji su prošli dalje bez osvojenog medaljona vide zaključane lekcije dok\n" +
        "ne završe odgovarajuću medaljon-lekciju. Za meko uvođenje pokreni sa --bez-gatinga.",
    );
  }
  console.log("\nGotovo.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
