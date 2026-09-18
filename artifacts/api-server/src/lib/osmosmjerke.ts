import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Osmosmjerka — vlastita vježba platforme (bez vanjskih alata).
 *
 * Jedan HTML fajl (`public/vjezbe/osmosmjerka/osmosmjerka.html`) čita sadržaj
 * iz JSON datoteke u `public/vjezbe/osmosmjerka/podaci/`. Nova osmosmjerka =
 * nova JSON datoteka u tom folderu; ovdje nema spiska koji se održava ručno.
 *
 * Vježba se lekciji dodaje kao prilog `kind="embed"` sa relativnim
 * `external_url` (ista domena), pa se dalje koristi postojeći put nagrađivanja
 * (POST /api/content/embed/zavrseno → kapi meda, jednom po učeniku i prilogu).
 */

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

/** Putanja igre unutar javnog foldera (ista domena, bez API prefiksa). */
export const OSMOSMJERKA_HTML_PATH = "/vjezbe/osmosmjerka/osmosmjerka.html";
/** Folder s JSON datotekama, javno dostupan. */
export const OSMOSMJERKA_PODACI_PATH = "/vjezbe/osmosmjerka/podaci";
/** Marker u `prilozi.stored_name` — po njemu frontend prepoznaje vlastitu vježbu. */
export const OSMOSMJERKA_MARKER = "osmosmjerka:";

const MAX_JSON_BYTES = 512 * 1024;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface OsmosmjerkaSazetak {
  id: string;
  naslov: string;
  tezina: string;
  prikaz: string;
  brojRijeci: number;
  url: string;
}

/**
 * ID je ime JSON datoteke bez ekstenzije. Uski uzorak (mala slova, cifre i
 * crtica) namjerno isključuje tačku i kosu crtu, pa `..` i apsolutne putanje
 * ne mogu proći do `fs` sloja.
 */
export function isValidOsmosmjerkaId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** URL koji ide u `prilozi.external_url` i u iframe lekcije. */
export function osmosmjerkaUrl(id: string): string {
  if (!isValidOsmosmjerkaId(id)) throw new Error(`Nevažeći ID osmosmjerke: ${String(id)}`);
  return `${OSMOSMJERKA_HTML_PATH}?podaci=${OSMOSMJERKA_PODACI_PATH}/${id}.json`;
}

/** Marker koji se upisuje u `prilozi.stored_name`. */
export function osmosmjerkaMarker(id: string): string {
  return `${OSMOSMJERKA_MARKER}${id}`;
}

/**
 * Folder s podacima. U produkciji je frontend build (`dist/public`), u razvoju
 * izvorni `public`. Isti redoslijed kandidata koristi i `static-vjezba-source`.
 */
function podaciDirCandidates(): string[] {
  const relative = path.join("vjezbe", "osmosmjerka", "podaci");
  return [
    path.resolve(sourceDir, "../../../mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(sourceDir, "../../../mekteb-arapsko-pismo/public", relative),
    path.resolve(process.cwd(), "artifacts/mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(process.cwd(), "artifacts/mekteb-arapsko-pismo/public", relative),
    path.resolve(process.cwd(), "../mekteb-arapsko-pismo/dist/public", relative),
    path.resolve(process.cwd(), "../mekteb-arapsko-pismo/public", relative),
  ];
}

async function resolvePodaciDir(): Promise<string | null> {
  for (const candidate of podaciDirCandidates()) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

function sazetakIzJsona(id: string, raw: string): OsmosmjerkaSazetak | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const podaci = parsed as Record<string, unknown>;
  const rijeci = Array.isArray(podaci.rijeci) ? podaci.rijeci : [];
  if (rijeci.length < 2) return null;
  const naslov = typeof podaci.naslov === "string" && podaci.naslov.trim()
    ? podaci.naslov.trim()
    : id;
  const tezina = typeof podaci.tezina === "string" ? podaci.tezina : "lako";
  const prikaz = typeof podaci.prikaz === "string" ? podaci.prikaz : "rijeci";
  return {
    id,
    naslov: naslov.slice(0, 200),
    tezina,
    prikaz,
    brojRijeci: rijeci.length,
    url: osmosmjerkaUrl(id),
  };
}

/**
 * Pročitaj folder i vrati sve ispravne osmosmjerke, sortirane po naslovu.
 * Datoteka s neispravnim imenom, neispravnim JSON-om ili s manje od dvije
 * riječi se preskače (admin je neće vidjeti u spisku, ali ostaje na disku).
 */
export async function listOsmosmjerke(): Promise<OsmosmjerkaSazetak[]> {
  const dir = await resolvePodaciDir();
  if (!dir) return [];
  const files = await fs.readdir(dir);
  const sazeci: OsmosmjerkaSazetak[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const id = file.slice(0, -".json".length);
    if (!isValidOsmosmjerkaId(id)) continue;
    const full = path.join(dir, file);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile() || stat.size > MAX_JSON_BYTES) continue;
      const sazetak = sazetakIzJsona(id, await fs.readFile(full, "utf8"));
      if (sazetak) sazeci.push(sazetak);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return sazeci.sort((a, b) => a.naslov.localeCompare(b.naslov, "bs"));
}

/** Jedna osmosmjerka po ID-u, ili null ako datoteka ne postoji ili nije ispravna. */
export async function getOsmosmjerka(id: string): Promise<OsmosmjerkaSazetak | null> {
  if (!isValidOsmosmjerkaId(id)) return null;
  const all = await listOsmosmjerke();
  return all.find(item => item.id === id) ?? null;
}
