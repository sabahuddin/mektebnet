/**
 * Izvoz etapnih kvizova Nivoa 1 i završnih kvizova krunisanja u JSON fajlove,
 * u formatu šablona za uvoz kviza (naslov / slug / kategorija / tagovi / opis /
 * pitanja[]).
 *
 * Radi potpuno offline — čita `scripts/content-seed.json.gz`, mapu pitanja i
 * ručne dopune iz `scripts/data/`, bez ikakvog dodira sa bazom. Namijenjeno
 * ručnom uvozu (Replit / Coolify), kao alternativa `seed-nivo1-etape.ts`.
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts export-nivo1-etape
 *   pnpm --filter @workspace/scripts export-nivo1-etape -- --out ./neki/folder
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETAPE,
  IZVORNI_KVIZOVI,
  bankaKljuc,
  buildPool,
  etapaZaRedoslijed,
  jeBodivo,
  odaberiZaEtapu,
  parseLegacy,
  podijeliKrunisanje,
  type LegacyPitanje,
  type ParsedPitanje,
} from "./nivo1-etape-lib.js";
import { odrediKategoriju } from "./nivo1-kategorije.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = resolve(outIdx >= 0 ? process.argv[outIdx + 1]! : resolve(__dirname, "../../.local/nivo1-kvizovi"));

type SeedLekcija = { nivo: number; slug: string; naslov: string; redoslijed: number; kvizPitanja?: LegacyPitanje[] };
type Kandidat = ParsedPitanje & { etapa: number; lekcijaSlug: string | null; lekcijaNaslov: string | null };

/** Jedno pitanje u izvoznom formatu (isti oblik kao šablon kviza). */
type IzvoznoPitanje = {
  pitanje: string;
  opcije: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  correctOrder?: number[];
  vrsta: string;
  kategorija: string;
  tagovi: string[];
  tezina: number;
  objasnjenje: string;
  meta?: Record<string, unknown>;
  /** Lekcija iz koje pitanje potiče — pomoć uredniku, nije dio šablona. */
  lekcija?: string;
};

function ucitaj<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(__dirname, rel), "utf-8")) as T;
}

function izvozno(k: Kandidat): IzvoznoPitanje {
  const { kategorija, tagovi } = odrediKategoriju(k);
  const osnova: IzvoznoPitanje = {
    pitanje: k.pitanje,
    opcije: k.opcije,
    vrsta: k.vrsta,
    kategorija,
    tagovi,
    tezina: k.tezina,
    objasnjenje: k.objasnjenje,
    ...(k.lekcijaSlug ? { lekcija: k.lekcijaSlug } : {}),
  };
  if (k.vrsta === "multiple") return { ...osnova, correctIndexes: k.correctIndexes ?? [k.correctIndex] };
  if (k.vrsta === "reorder") return { ...osnova, correctOrder: k.correctOrder ?? [] };
  if (k.vrsta === "dragDrop" || k.vrsta === "markWords") {
    return { ...osnova, opcije: [], meta: (k.meta ?? {}) as Record<string, unknown> };
  }
  return { ...osnova, correctIndex: k.correctIndex };
}

function readme(
  zapisi: { fajl: string; slug: string; naslov: string; ukupno: number; bodivih: number }[],
  medaljoni: { slug: string; naziv: string; lekcije: string; posAfterRedoslijed: number; kviz: string; medaljonLekcija: string; brojBodivihNaIspitu: number }[],
): string {
  const red = (z: (typeof zapisi)[number]) => `| \`${z.slug}\` | ${z.ukupno} | ${z.bodivih} | ${z.naslov} |`;
  return [
    "# Nivo 1 — etapni kvizovi i krunisanje",
    "",
    "Devet kvizova u formatu šablona za uvoz (`naslov` / `slug` / `kategorija` / `tagovi` / `opis` / `pitanja[]`),",
    "plus `medaljoni-nivo1.json` sa podacima o tome koji kviz ide na koji Zlatni medaljon.",
    "",
    "## Kvizovi",
    "",
    "| slug | pitanja | bodivih na ispitu | naslov |",
    "|------|---------|-------------------|--------|",
    ...zapisi.map(red),
    "",
    "## Zlatni medaljoni",
    "",
    "| medaljon | lekcije | `posAfterRedoslijed` | kviz | medaljon-lekcija | bodivih |",
    "|----------|---------|----------------------|------|------------------|---------|",
    ...medaljoni.map((m) =>
      `| \`${m.slug}\` — ${m.naziv} | ${m.lekcije} | ${m.posAfterRedoslijed} | \`${m.kviz}\` | \`${m.medaljonLekcija}\` | ${m.brojBodivihNaIspitu} |`),
    "",
    "Nivo 1 ima 64 lekcije, a mapa puta postavlja medaljon nakon svakih deset — zato je šest etapa.",
    "Lekcije 61–64 (Zikr, Sura En-Nasr, Bajramske aktivnosti, Sport) nemaju svoj medaljon i njihova",
    "pitanja ulaze samo u kvizove krunisanja.",
    "",
    "## Vrste pitanja",
    "",
    "Redovni kviz podržava svih šest vrsta (`single`, `multiple`, `truefalse`, `reorder`, `dragDrop`,",
    "`markWords`). Ispit etape i ispit krunisanja serviraju samo radio-dugmad i boduju jedan izabrani",
    "indeks, pa mogu bodovati samo `single` i `truefalse`. Zato je u koloni „bodivih na ispitu” manje",
    "od ukupnog broja: u `medaljoni.kviz_pitanja_ids` treba staviti samo taj podskup. Sva tri kviza",
    "krunisanja sastoje se isključivo od bodivih pitanja.",
    "",
    "## Polje `lekcija`",
    "",
    "Pitanja koja potiču iz ugrađenog kviza neke lekcije nose i polje `lekcija` sa slug-om te lekcije.",
    "To nije dio šablona — služi uredniku da vidi porijeklo pitanja i može se slobodno ignorisati",
    "ili obrisati pri uvozu.",
    "",
    "## Kategorije i tagovi",
    "",
    "`kategorija` i `tagovi` na nivou pitanja dodijeljeni su automatski, po ključnim riječima, i",
    "koriste vrijednosti iz `KVIZ_KATEGORIJE` i `KVIZ_TAGOVI`. Trinaest pitanja koja se nisu dala",
    "svrstati nose `bosna` / `ostalo`. Sve se može promijeniti u banci pitanja.",
    "",
    "## Napomena o izvoru",
    "",
    "Sadržaj je izveden iz `scripts/content-seed.json.gz`, koji ima 62 od 64 lekcije Nivoa 1 —",
    "nedostaju lekcije na pozicijama 11, 23, 24 i 56. Pitanja iz tih lekcija nisu mogla ući",
    "u raspodjelu.",
    "",
  ].join("\n");
}

function main() {
  const seed = JSON.parse(
    gunzipSync(readFileSync(resolve(__dirname, "../content-seed.json.gz"))).toString("utf-8"),
  ) as { kvizovi: { slug: string; pitanja?: LegacyPitanje[] }[]; lekcije: SeedLekcija[] };

  const poSlugu = new Map(seed.kvizovi.map((k) => [k.slug, k.pitanja ?? []]));
  const pool = buildPool(IZVORNI_KVIZOVI.map((slug) => ({ slug, pitanja: poSlugu.get(slug) ?? [] })));
  const mapa = ucitaj<Record<string, number>>("../data/nivo1-mapa-pitanja.json");
  const ispravke = ucitaj<Record<string, LegacyPitanje>>("../data/nivo1-lekcijska-ispravke.json");
  const nova = ucitaj<{ pitanja: (LegacyPitanje & { etapa: number; lekcija: string })[] }>("../data/nivo1-nova-pitanja.json");

  const lekcije = seed.lekcije
    .filter((l) => l.nivo === 1 && l.redoslijed >= 0 && l.redoslijed <= 63)
    .sort((a, b) => a.redoslijed - b.redoslijed);
  const naslovPoSlugu = new Map(lekcije.map((l) => [l.slug, l.naslov]));

  const kandidati: Kandidat[] = [];
  for (const p of pool) {
    const parsed = parseLegacy(p.pitanje, p.id);
    if (!parsed) continue;
    kandidati.push({ ...parsed, etapa: mapa[p.id]!, lekcijaSlug: null, lekcijaNaslov: null });
  }
  for (const l of lekcije) {
    (l.kvizPitanja ?? []).forEach((raw, idx) => {
      const parsed = parseLegacy(ispravke[`${l.slug}#${idx}`] ?? raw, `${l.slug}#${idx}`);
      if (!parsed) return;
      kandidati.push({ ...parsed, etapa: etapaZaRedoslijed(l.redoslijed), lekcijaSlug: l.slug, lekcijaNaslov: l.naslov });
    });
  }
  for (const n of nova.pitanja) {
    const parsed = parseLegacy(n, `novo:${n.lekcija}`);
    if (!parsed) continue;
    kandidati.push({ ...parsed, etapa: n.etapa, lekcijaSlug: n.lekcija, lekcijaNaslov: naslovPoSlugu.get(n.lekcija) ?? null });
  }

  const jedinstveni = new Map<string, Kandidat>();
  for (const k of kandidati) if (!jedinstveni.has(bankaKljuc(k))) jedinstveni.set(bankaKljuc(k), k);
  const svi = [...jedinstveni.values()];

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const zapisi: { fajl: string; slug: string; naslov: string; ukupno: number; bodivih: number }[] = [];

  function zapisi1(slug: string, naslov: string, opis: string, pitanja: Kandidat[], tagovi: string[]) {
    const kviz = {
      naslov,
      slug,
      nivo: 1,
      kategorija: "ibadet",
      tagovi,
      opis,
      pitanja: pitanja.map(izvozno),
    };
    const fajl = `${slug}.json`;
    writeFileSync(join(OUT_DIR, fajl), JSON.stringify(kviz, null, 2) + "\n", "utf-8");
    zapisi.push({ fajl, slug, naslov, ukupno: pitanja.length, bodivih: pitanja.filter(jeBodivo).length });
  }

  const izbor = ETAPE.map((e) => ({ etapa: e, pitanja: odaberiZaEtapu(svi, e.redni) }));
  for (const { etapa, pitanja } of izbor) {
    zapisi1(etapa.kvizSlug, etapa.kvizNaslov, etapa.opis, pitanja, ["nivo1", "etapa", `etapa-${etapa.redni}`]);
  }

  const varijante = podijeliKrunisanje(svi);
  for (const oznaka of ["a", "b", "c"] as const) {
    zapisi1(
      `1-krunisanje-${oznaka}`,
      `Krunisanje Nivoa 1 — kviz ${oznaka.toUpperCase()}`,
      `Završni kviz Nivoa 1 (varijanta ${oznaka.toUpperCase()}) — 100 pitanja iz svih 64 lekcije nivoa.`,
      varijante[oznaka],
      ["nivo1", "krunisanje", `varijanta-${oznaka}`],
    );
  }

  // Pratnja: koji kviz ide na koji medaljon i nakon koje lekcije.
  const medaljoni = izbor.map(({ etapa, pitanja }) => ({
    slug: etapa.medaljonSlug,
    naziv: etapa.naziv,
    opis: etapa.opis,
    nivo: 1,
    posAfterRedoslijed: etapa.do,
    lekcije: `${etapa.od + 1}-${etapa.do + 1}`,
    kviz: etapa.kvizSlug,
    medaljonLekcija: `medaljon-nivo1-${etapa.redni}`,
    pragProlazaPercent: 70,
    brojPitanjaUKvizu: pitanja.length,
    brojBodivihNaIspitu: pitanja.filter(jeBodivo).length,
  }));
  writeFileSync(join(OUT_DIR, "medaljoni-nivo1.json"), JSON.stringify({ medaljoni }, null, 2) + "\n", "utf-8");

  writeFileSync(join(OUT_DIR, "PROCITAJ-ME.md"), readme(zapisi, medaljoni), "utf-8");

  console.log(`Zapisano u ${OUT_DIR}:`);
  for (const z of zapisi) console.log(`  ${z.fajl.padEnd(22)} ${String(z.ukupno).padStart(3)} pitanja (${z.bodivih} bodivih na ispitu) — ${z.naslov}`);
  console.log(`  medaljoni-nivo1.json    ${medaljoni.length} medaljona`);
}

main();
