/**
 * Osmosmjerka je od uvođenja vježbe „Popuni prazninu" samo jedna od naših
 * vrsta vježbi, pa zajednička logika živi u `nase-vjezbe.ts`. Ovaj modul
 * ostaje kao tanak sloj za postojeće pozive (ruta /api/osmosmjerke i admin
 * ruta /prilozi/:lekcijaId/osmosmjerka).
 */
import {
  type VjezbaSazetak,
  getVjezba,
  isValidVjezbaId,
  listVjezbe,
  vjezbaMarker,
  vjezbaUrl,
} from "./nase-vjezbe.js";

const TIP = "osmosmjerka";

/** Putanja igre unutar javnog foldera (ista domena, bez API prefiksa). */
export const OSMOSMJERKA_HTML_PATH = "/vjezbe/osmosmjerka/osmosmjerka.html";
/** Folder s JSON datotekama, javno dostupan. */
export const OSMOSMJERKA_PODACI_PATH = "/vjezbe/osmosmjerka/podaci";
/** Marker u `prilozi.stored_name` — po njemu se prepoznaje vlastita vježba. */
export const OSMOSMJERKA_MARKER = `${TIP}:`;

export type OsmosmjerkaSazetak = VjezbaSazetak;

export function isValidOsmosmjerkaId(id: unknown): id is string {
  return isValidVjezbaId(id);
}

export function osmosmjerkaUrl(id: string): string {
  return vjezbaUrl(TIP, id);
}

export function osmosmjerkaMarker(id: string): string {
  return vjezbaMarker(TIP, id);
}

export function listOsmosmjerke(): Promise<VjezbaSazetak[]> {
  return listVjezbe(TIP);
}

export function getOsmosmjerka(id: string): Promise<VjezbaSazetak | null> {
  return getVjezba(TIP, id);
}
