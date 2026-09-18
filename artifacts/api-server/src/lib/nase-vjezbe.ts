import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Naše vježbe — vježbe koje platforma servira sama, bez vanjskih alata
 * (LearningApps, Wordwall, H5P).
 *
 * Svaka vrsta ima jedan statički HTML u `public/vjezbe/<tip>/` koji sadržaj
 * čita iz JSON datoteke u `podaci/`. Nova vježba = nova JSON datoteka; ovdje
 * nema spiska koji se održava ručno.
 *
 * Vježba se lekciji dodaje kao prilog `kind="embed"` sa relativnim
 * `external_url` (ista domena), pa koristi postojeći put nagrađivanja
 * (POST /api/content/embed/zavrseno → kapi meda, jednom po učeniku i prilogu).
 */

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

export interface TipVjezbe {
  /** Oznaka vrste; ujedno ime foldera u public/vjezbe/. */
  tip: string;
  /** Naziv koji admin vidi u formi. */
  naziv: string;
  /** Kratko objašnjenje vrste za admin formu. */
  opis: string;
  /** Putanja do HTML-a vježbe (javni folder, ista domena). */
  html: string;
}

export const TIPOVI_VJEZBI: Record<string, TipVjezbe> = {
  osmosmjerka: {
    tip: "osmosmjerka",
    naziv: "Osmosmjerka",
    opis: "Dijete traži skrivene riječi u mreži slova.",
    html: "/vjezbe/osmosmjerka/osmosmjerka.html",
  },
  popuni: {
    tip: "popuni",
    naziv: "Popuni prazninu",
    opis: "Dijete prevlači riječi na prazna mjesta u priči.",
    html: "/vjezbe/popuni/popuni.html",
  },
};

/** Prefiksi po kojima stranica lekcije prepoznaje našu vježbu. */
export const NASE_VJEZBE_PREFIKSI = Object.values(TIPOVI_VJEZBI)
  .map(t => `/vjezbe/${t.tip}/`);

const MAX_JSON_BYTES = 512 * 1024;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface VjezbaSazetak {
  tip: string;
  id: string;
  naslov: string;
  /** Kratak opis sadržaja za admin spisak (broj riječi, težina…). */
  detalj: string;
  url: string;
}

export function isValidTip(tip: unknown): tip is string {
  return typeof tip === "string" && Object.prototype.hasOwnProperty.call(TIPOVI_VJEZBI, tip);
}

/**
 * ID je ime JSON datoteke bez ekstenzije. Uski uzorak (mala slova, cifre i
 * crtica) namjerno isključuje tačku i kosu crtu, pa `..` i apsolutne putanje
 * ne mogu proći do `fs` sloja.
 */
export function isValidVjezbaId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** URL koji ide u `prilozi.external_url` i u iframe lekcije. */
export function vjezbaUrl(tip: string, id: string): string {
  if (!isValidTip(tip)) throw new Error(`Nepoznata vrsta vježbe: ${String(tip)}`);
  if (!isValidVjezbaId(id)) throw new Error(`Nevažeći ID vježbe: ${String(id)}`);
  return `${TIPOVI_VJEZBI[tip].html}?podaci=/vjezbe/${tip}/podaci/${id}.json`;
}

/** Marker koji se upisuje u `prilozi.stored_name` (npr. "popuni:abdest"). */
export function vjezbaMarker(tip: string, id: string): string {
  return `${tip}:${id}`;
}

/** Je li `external_url` priloga naša vježba? */
export function jeNasaVjezba(url: string | null | undefined): boolean {
  const u = String(url || "");
  return NASE_VJEZBE_PREFIKSI.some(prefix => u.startsWith(prefix));
}

/**
 * Folder s podacima. U produkciji je frontend build (`dist/public`), u razvoju
 * izvorni `public`. Isti redoslijed kandidata koristi i `static-vjezba-source`.
 */
function podaciDirCandidates(tip: string): string[] {
  const relative = path.join("vjezbe", tip, "podaci");
  return [
    path.resolve(sourceDir, "../../../mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(sourceDir, "../../../mekteb-arapsko-pismo/public", relative),
    path.resolve(process.cwd(), "artifacts/mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(process.cwd(), "artifacts/mekteb-arapsko-pismo/public", relative),
    path.resolve(process.cwd(), "../mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(process.cwd(), "../mekteb-arapsko-pismo/public", relative),
  ];
}

async function resolvePodaciDir(tip: string): Promise<string | null> {
  for (const candidate of podaciDirCandidates(tip)) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

/** Broj praznina u tekstu vježbe „Popuni prazninu" — riječi u vitičastim zagradama. */
function brojPraznina(tekst: string): number {
  return (tekst.match(/\{[^{}]+\}/g) ?? []).length;
}

function sazetakIzJsona(tip: string, id: string, raw: string): VjezbaSazetak | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const podaci = parsed as Record<string, unknown>;
  const naslov = typeof podaci.naslov === "string" && podaci.naslov.trim()
    ? podaci.naslov.trim().slice(0, 200)
    : id;

  if (tip === "osmosmjerka") {
    const rijeci = Array.isArray(podaci.rijeci) ? podaci.rijeci : [];
    if (rijeci.length < 2) return null;
    const tezina = typeof podaci.tezina === "string" ? podaci.tezina : "lako";
    return { tip, id, naslov, detalj: `${rijeci.length} riječi · ${tezina}`, url: vjezbaUrl(tip, id) };
  }

  if (tip === "popuni") {
    const tekst = typeof podaci.tekst === "string" ? podaci.tekst : "";
    const praznina = brojPraznina(tekst);
    if (praznina < 1) return null;
    const dodatne = Array.isArray(podaci.dodatne) ? podaci.dodatne.length : 0;
    return {
      tip,
      id,
      naslov,
      detalj: dodatne > 0 ? `${praznina} praznina · ${dodatne} dodatnih riječi` : `${praznina} praznina`,
      url: vjezbaUrl(tip, id),
    };
  }

  return null;
}

/**
 * Pročitaj folder jedne vrste i vrati sve ispravne vježbe, sortirane po naslovu.
 * Datoteka s neispravnim imenom ili neispravnim sadržajem se preskače (admin je
 * neće vidjeti u spisku, ali ostaje na disku).
 */
export async function listVjezbe(tip: string): Promise<VjezbaSazetak[]> {
  if (!isValidTip(tip)) return [];
  const dir = await resolvePodaciDir(tip);
  if (!dir) return [];
  const files = await fs.readdir(dir);
  const sazeci: VjezbaSazetak[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const id = file.slice(0, -".json".length);
    if (!isValidVjezbaId(id)) continue;
    const full = path.join(dir, file);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile() || stat.size > MAX_JSON_BYTES) continue;
      const sazetak = sazetakIzJsona(tip, id, await fs.readFile(full, "utf8"));
      if (sazetak) sazeci.push(sazetak);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return sazeci.sort((a, b) => a.naslov.localeCompare(b.naslov, "bs"));
}

/** Sve vrste sa svojim vježbama — jedan odgovor za admin formu. */
export async function listSveVjezbe(): Promise<Array<TipVjezbe & { vjezbe: VjezbaSazetak[] }>> {
  const tipovi = Object.values(TIPOVI_VJEZBI);
  const svi = await Promise.all(tipovi.map(async t => ({ ...t, vjezbe: await listVjezbe(t.tip) })));
  return svi;
}

/** Jedna vježba po vrsti i ID-u, ili null ako ne postoji ili nije ispravna. */
export async function getVjezba(tip: string, id: string): Promise<VjezbaSazetak | null> {
  if (!isValidTip(tip) || !isValidVjezbaId(id)) return null;
  const sve = await listVjezbe(tip);
  return sve.find(item => item.id === id) ?? null;
}
