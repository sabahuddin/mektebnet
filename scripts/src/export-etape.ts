/**
 * Izvoz etapnih kvizova i završnih kvizova krunisanja u JSON fajlove, u formatu
 * šablona za uvoz kviza (naslov / slug / etapa / kategorija / tagovi / opis /
 * pitanja[]).
 *
 * Radi potpuno offline — čita `scripts/content-seed.json.gz`, mape pitanja i
 * ručne dopune iz `scripts/data/`, bez ikakvog dodira sa bazom. Namijenjeno
 * ručnom uvozu (Replit / Coolify).
 *
 * Svaki nivo ima sedam etapa (1 = lekcije 1–10, ... 7 = 61 i dalje), u skladu
 * sa `kvizovi.etapa`. Etapni kviz prikazuje sva svoja pitanja, pa se
 * `pitanjaPoSesiji` ne postavlja, a prag prolaza je 80%.
 *
 * Pokreni:
 *   pnpm --filter @workspace/scripts export-etape
 *   pnpm --filter @workspace/scripts export-etape -- --nivo 2 --out ./folder
 */
import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IZVORNI_KVIZOVI_PO_NIVOU,
  PRAG_PROLAZA_PERCENT,
  bankaKljuc,
  buildPool,
  etapeZaNivo,
  lekcijskaPitanja,
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
function arg(ime: string): string | undefined {
  const i = process.argv.indexOf(`--${ime}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const NIVO = Number(arg("nivo") ?? 1);
const OUT_DIR = resolve(arg("out") ?? resolve(__dirname, `../../.local/nivo${NIVO}-kvizovi`));

type SeedLekcija = { nivo: number; slug: string; naslov: string; redoslijed: number; kvizPitanja?: unknown };
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

/** Isto kao `ucitaj`, ali vraća `null` ako fajl ne postoji (dopune su opcione). */
function ucitajAko<T>(rel: string): T | null {
  try {
    return ucitaj<T>(rel);
  } catch {
    return null;
  }
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
  return [
    `# Nivo ${NIVO} — etapni kvizovi i krunisanje`,
    "",
    "Deset kvizova u formatu šablona za uvoz (`naslov` / `slug` / `nivo` / `etapa` / `kategorija` /",
    `\`tagovi\` / \`opis\` / \`pitanja[]\`), plus \`medaljoni-nivo${NIVO}.json\` sa podacima o tome koji kviz`,
    "ide na koji Zlatni medaljon.",
    "",
    "## Kvizovi",
    "",
    "| slug | etapa | pitanja | naslov |",
    "|------|-------|---------|--------|",
    ...zapisi.map((z, i) => `| \`${z.slug}\` | ${i < medaljoni.length ? String(i + 1) : "—"} | ${z.ukupno} | ${z.naslov} |`),
    "",
    "## Zlatni medaljoni",
    "",
    "| medaljon | lekcije | `posAfterRedoslijed` | kviz | medaljon-lekcija |",
    "|----------|---------|----------------------|------|------------------|",
    ...medaljoni.map((m) =>
      `| \`${m.slug}\` — ${m.naziv} | ${m.lekcije} | ${m.posAfterRedoslijed} | \`${m.kviz}\` | \`${m.medaljonLekcija}\` |`),
    "",
    "Svaki nivo ima sedam etapa — po jednu na svakih deset lekcija. Etapni kviz se veže za",
    "medaljon-lekciju preko `kvizovi.lekcija_id`, a `kvizovi.etapa` nosi redni broj etape.",
    "",
    "## Postavke etapnog kviza",
    "",
    `- Prikazuje **sva** svoja pitanja — \`pitanjaPoSesiji\` se ne postavlja.`,
    `- Prag prolaza je **${PRAG_PROLAZA_PERCENT}%**; nakon neuspjelog pokušaja novi je zaključan 48 sati.`,
    "- Medaljon-lekcija se ne može završiti dok etapni kviz nije položen (server to provjerava).",
    "",
    "## Vrste pitanja",
    "",
    "Etapni kviz ide kroz redovni kviz UI i podržava svih šest vrsta (`single`, `multiple`,",
    "`truefalse`, `reorder`, `dragDrop`, `markWords`). Ispit krunisanja prikazuje samo radio-dugmad,",
    "pa se kvizovi krunisanja sastoje isključivo od `single` i `truefalse` pitanja.",
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
    "koriste vrijednosti iz `KVIZ_KATEGORIJE` i `KVIZ_TAGOVI`. Sve se može promijeniti u banci pitanja.",
    "",
  ].join("\n");
}

function main() {
  const seed = JSON.parse(
    gunzipSync(readFileSync(resolve(__dirname, "../content-seed.json.gz"))).toString("utf-8"),
  ) as { kvizovi: { slug: string; pitanja?: LegacyPitanje[] }[]; lekcije: SeedLekcija[] };

  const poSlugu = new Map(seed.kvizovi.map((k) => [k.slug, k.pitanja ?? []]));
  const izvorni = IZVORNI_KVIZOVI_PO_NIVOU[NIVO];
  if (!izvorni) throw new Error(`Nema definisanih izvornih kvizova za nivo ${NIVO}`);
  const pool = buildPool(izvorni.map((slug) => ({ slug, pitanja: poSlugu.get(slug) ?? [] })));
  const mapa = ucitaj<Record<string, number>>(`../data/nivo${NIVO}-mapa-pitanja.json`);
  const ispravke = ucitajAko<Record<string, LegacyPitanje>>(`../data/nivo${NIVO}-lekcijska-ispravke.json`) ?? {};
  const kvizIspravke = ucitajAko<Record<string, LegacyPitanje>>(`../data/nivo${NIVO}-kviz-ispravke.json`) ?? {};
  const nova = ucitajAko<{ pitanja: (LegacyPitanje & { etapa: number; lekcija: string })[] }>(
    `../data/nivo${NIVO}-nova-pitanja.json`,
  ) ?? { pitanja: [] };

  const lekcije = seed.lekcije
    .filter((l) => l.nivo === NIVO)
    .sort((a, b) => a.redoslijed - b.redoslijed);
  const naslovPoSlugu = new Map(lekcije.map((l) => [l.slug, l.naslov]));

  const kandidati: Kandidat[] = [];
  for (const p of pool) {
    const parsed = parseLegacy(kvizIspravke[p.id] ?? p.pitanje, p.id);
    if (!parsed) continue;
    kandidati.push({ ...parsed, etapa: mapa[p.id]!, lekcijaSlug: null, lekcijaNaslov: null });
  }
  for (const l of lekcije) {
    lekcijskaPitanja(l.kvizPitanja).forEach((raw, idx) => {
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

  function zapisi1(slug: string, naslov: string, opis: string, pitanja: Kandidat[], tagovi: string[], etapa: number | null) {
    const kviz = {
      naslov,
      slug,
      nivo: NIVO,
      etapa,
      kategorija: "ibadet",
      tagovi,
      opis,
      pitanja: pitanja.map(izvozno),
    };
    const fajl = `${slug}.json`;
    writeFileSync(join(OUT_DIR, fajl), JSON.stringify(kviz, null, 2) + "\n", "utf-8");
    zapisi.push({ fajl, slug, naslov, ukupno: pitanja.length, bodivih: pitanja.filter(jeBodivo).length });
  }

  const ETAPE = etapeZaNivo(NIVO);
  const izbor = ETAPE.map((e) => ({ etapa: e, pitanja: odaberiZaEtapu(svi, e.redni) }));
  for (const { etapa, pitanja } of izbor) {
    zapisi1(etapa.kvizSlug, etapa.kvizNaslov, etapa.opis, pitanja,
      [`nivo${NIVO}`, "etapa", `etapa-${etapa.redni}`], etapa.redni);
  }

  const varijante = podijeliKrunisanje(svi);
  for (const oznaka of ["a", "b", "c"] as const) {
    zapisi1(
      `${NIVO}-krunisanje-${oznaka}`,
      `Krunisanje Nivoa ${NIVO} — kviz ${oznaka.toUpperCase()}`,
      `Završni kviz Nivoa ${NIVO} (varijanta ${oznaka.toUpperCase()}) — 100 pitanja iz svih lekcija nivoa.`,
      varijante[oznaka],
      [`nivo${NIVO}`, "krunisanje", `varijanta-${oznaka}`],
      null,
    );
  }

  // Pratnja: koji kviz ide na koji medaljon i nakon koje lekcije.
  const medaljoni = izbor.map(({ etapa, pitanja }) => ({
    slug: etapa.medaljonSlug,
    naziv: etapa.naziv,
    opis: etapa.opis,
    nivo: NIVO,
    posAfterRedoslijed: etapa.do,
    lekcije: `${etapa.od + 1}-${etapa.do + 1}`,
    kviz: etapa.kvizSlug,
    medaljonLekcija: `medaljon-nivo${NIVO}-${etapa.redni}`,
    pragProlazaPercent: PRAG_PROLAZA_PERCENT,
    brojPitanjaUKvizu: pitanja.length,
    brojBodivihNaIspitu: pitanja.filter(jeBodivo).length,
  }));
  writeFileSync(join(OUT_DIR, `medaljoni-nivo${NIVO}.json`), JSON.stringify({ medaljoni }, null, 2) + "\n", "utf-8");

  writeFileSync(join(OUT_DIR, "PROCITAJ-ME.md"), readme(zapisi, medaljoni), "utf-8");

  console.log(`Zapisano u ${OUT_DIR}:`);
  for (const z of zapisi) console.log(`  ${z.fajl.padEnd(22)} ${String(z.ukupno).padStart(3)} pitanja (${z.bodivih} bodivih na ispitu) — ${z.naslov}`);
  console.log(`  medaljoni-nivo${NIVO}.json    ${medaljoni.length} medaljona`);
}

main();
