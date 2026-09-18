import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Naše vježbe — vježbe koje platforma servira sama, bez vanjskih alata
 * (LearningApps, Wordwall, H5P).
 *
 * Svaka vrsta ima jedan statički HTML u `public/vjezbe/<tip>/`, a sadržaj
 * pojedine vježbe je JSON. Sadržaj dolazi iz dva izvora:
 *   1. ugrađene datoteke u `public/vjezbe/<tip>/podaci/*.json` (idu uz kod);
 *   2. tabela `nase_vjezbe` — vježbe koje je admin napravio ili izmijenio
 *      kroz panel (nema deploya; isti ID prepisuje ugrađenu vježbu).
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

/** Odakle dolazi sadržaj vježbe. */
export type IzvorVjezbe = "ugradjena" | "vlastita";

export interface VjezbaSazetak {
  tip: string;
  id: string;
  naslov: string;
  /** Kratak opis sadržaja za admin spisak (broj riječi, praznina…). */
  detalj: string;
  izvor: IzvorVjezbe;
  url: string;
  updatedAt?: string | null;
}

export function isValidTip(tip: unknown): tip is string {
  return typeof tip === "string" && Object.prototype.hasOwnProperty.call(TIPOVI_VJEZBI, tip);
}

/**
 * ID je ime JSON datoteke bez ekstenzije (odnosno ključ u bazi). Uski uzorak
 * (mala slova, cifre i crtica) namjerno isključuje tačku i kosu crtu, pa `..`
 * i apsolutne putanje ne mogu proći do `fs` sloja.
 */
export function isValidVjezbaId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/**
 * URL koji ide u `prilozi.external_url` i u iframe lekcije. Podaci se čitaju
 * kroz API (`/api/nase-vjezbe/podaci/...`) da bi radile i vježbe iz panela,
 * kojih nema na disku. Ranije spremljeni prilozi pokazuju direktno na JSON
 * datoteku i dalje rade.
 */
export function vjezbaUrl(tip: string, id: string): string {
  if (!isValidTip(tip)) throw new Error(`Nepoznata vrsta vježbe: ${String(tip)}`);
  if (!isValidVjezbaId(id)) throw new Error(`Nevažeći ID vježbe: ${String(id)}`);
  return `${TIPOVI_VJEZBI[tip].html}?podaci=/api/nase-vjezbe/podaci/${tip}/${id}.json`;
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
 * Folder s ugrađenim podacima. U produkciji je frontend build (`dist/public`),
 * u razvoju izvorni `public`. Isti redoslijed kandidata koristi i
 * `static-vjezba-source`.
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

type Podaci = Record<string, unknown>;

/**
 * Provjera sadržaja prije upisa i prije prikaza u spisku. Vraća `null` kad je
 * sve u redu, inače poruku koju admin vidi.
 */
export function validirajPodatke(tip: string, podaci: unknown): string | null {
  if (!isValidTip(tip)) return "Nepoznata vrsta vježbe.";
  if (!podaci || typeof podaci !== "object" || Array.isArray(podaci)) return "Sadržaj vježbe nije ispravan.";
  const p = podaci as Podaci;
  if (typeof p.naslov !== "string" || !p.naslov.trim()) return "Upiši naslov vježbe.";
  if (JSON.stringify(p).length > MAX_JSON_BYTES) return "Sadržaj vježbe je prevelik.";

  if (tip === "osmosmjerka") {
    const rijeci = Array.isArray(p.rijeci) ? p.rijeci : null;
    if (!rijeci || rijeci.length < 2) return "Osmosmjerka treba bar dvije riječi.";
    for (const w of rijeci) {
      const rijec = typeof w === "string" ? w : (w as Podaci | null)?.rijec;
      if (typeof rijec !== "string" || rijec.trim().replace(/[^A-Za-zČĆĐŠŽčćđšž]/g, "").length < 2) {
        return "Svaka riječ treba imati bar dva slova.";
      }
    }
    if (p.tezina !== undefined && !["lako", "srednje", "tesko"].includes(String(p.tezina))) {
      return "Težina može biti: lako, srednje ili teško.";
    }
    if (p.prikaz !== undefined && !["rijeci", "opisi"].includes(String(p.prikaz))) {
      return "Na spisku se prikazuju riječi ili opisi.";
    }
    if (String(p.prikaz) === "opisi" && rijeci.some(w => !String((w as Podaci)?.opis ?? "").trim())) {
      return "Kad se na spisku prikazuju opisi, svaka riječ mora imati opis.";
    }
    return null;
  }

  if (tip === "popuni") {
    const tekst = typeof p.tekst === "string" ? p.tekst : "";
    if (!tekst.trim()) return "Upiši priču.";
    if (brojPraznina(tekst) < 1) return "Označi bar jednu riječ kao prazninu (riječ u vitičastim zagradama).";
    if (p.dodatne !== undefined && (!Array.isArray(p.dodatne) || p.dodatne.some(d => typeof d !== "string"))) {
      return "Dodatne riječi moraju biti spisak riječi.";
    }
    return null;
  }

  return "Nepoznata vrsta vježbe.";
}

/** Bosanski množinski oblici: 1 praznina, 2 praznine, 5 praznina. */
function mnozina(broj: number, jednina: string, malo: string, mnogo: string): string {
  const zadnje = broj % 10;
  const zadnjeDvije = broj % 100;
  if (zadnje === 1 && zadnjeDvije !== 11) return `${broj} ${jednina}`;
  if (zadnje >= 2 && zadnje <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return `${broj} ${malo}`;
  return `${broj} ${mnogo}`;
}

function sazetak(tip: string, id: string, podaci: Podaci, izvor: IzvorVjezbe, updatedAt?: string | null): VjezbaSazetak | null {
  if (validirajPodatke(tip, podaci)) return null;
  const naslov = String(podaci.naslov).trim().slice(0, 200);
  let detalj = "";
  if (tip === "osmosmjerka") {
    const rijeci = Array.isArray(podaci.rijeci) ? podaci.rijeci : [];
    const tezina = typeof podaci.tezina === "string" ? podaci.tezina : "lako";
    detalj = `${mnozina(rijeci.length, "riječ", "riječi", "riječi")} · ${tezina}`;
  } else {
    const praznina = brojPraznina(String(podaci.tekst ?? ""));
    const dodatne = Array.isArray(podaci.dodatne) ? podaci.dodatne.length : 0;
    const osnova = mnozina(praznina, "praznina", "praznine", "praznina");
    detalj = dodatne > 0 ? `${osnova} · ${mnozina(dodatne, "dodatna riječ", "dodatne riječi", "dodatnih riječi")}` : osnova;
  }
  return { tip, id, naslov, detalj, izvor, url: vjezbaUrl(tip, id), updatedAt: updatedAt ?? null };
}

/** Ugrađene vježbe jedne vrste, pročitane s diska. */
async function citajUgradjene(tip: string): Promise<Map<string, Podaci>> {
  const izlaz = new Map<string, Podaci>();
  const dir = await resolvePodaciDir(tip);
  if (!dir) return izlaz;
  const files = await fs.readdir(dir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const id = file.slice(0, -".json".length);
    if (!isValidVjezbaId(id)) continue;
    const full = path.join(dir, file);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile() || stat.size > MAX_JSON_BYTES) continue;
      const parsed = JSON.parse(await fs.readFile(full, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) izlaz.set(id, parsed as Podaci);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") continue;
    }
  }
  return izlaz;
}

type RedUBazi = {
  vjezba_id: string;
  podaci: unknown;
  updated_at: string | Date | null;
} & Record<string, unknown>;

/** Vježbe jedne vrste koje je admin napravio kroz panel. */
async function citajIzBaze(tip: string): Promise<Map<string, { podaci: Podaci; updatedAt: string | null }>> {
  const izlaz = new Map<string, { podaci: Podaci; updatedAt: string | null }>();
  const result = await db.execute<RedUBazi>(sql`
    SELECT vjezba_id, podaci, updated_at FROM nase_vjezbe WHERE tip = ${tip}
  `);
  const rows = (result as unknown as { rows?: RedUBazi[] }).rows ?? [];
  for (const row of rows) {
    if (!isValidVjezbaId(row.vjezba_id)) continue;
    const podaci = typeof row.podaci === "string" ? JSON.parse(row.podaci) : row.podaci;
    if (!podaci || typeof podaci !== "object" || Array.isArray(podaci)) continue;
    izlaz.set(row.vjezba_id, {
      podaci: podaci as Podaci,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at ?? null),
    });
  }
  return izlaz;
}

/**
 * Spisak vježbi jedne vrste, sortiran po naslovu. Vježba iz panela prepisuje
 * ugrađenu s istim ID-em. Neispravan sadržaj se preskače.
 */
export async function listVjezbe(tip: string): Promise<VjezbaSazetak[]> {
  if (!isValidTip(tip)) return [];
  const [ugradjene, izBaze] = await Promise.all([citajUgradjene(tip), citajIzBaze(tip)]);
  const sazeci: VjezbaSazetak[] = [];
  for (const [id, podaci] of ugradjene) {
    if (izBaze.has(id)) continue;
    const s = sazetak(tip, id, podaci, "ugradjena");
    if (s) sazeci.push(s);
  }
  for (const [id, red] of izBaze) {
    const s = sazetak(tip, id, red.podaci, "vlastita", red.updatedAt);
    if (s) sazeci.push(s);
  }
  return sazeci.sort((a, b) => a.naslov.localeCompare(b.naslov, "bs"));
}

/** Sve vrste sa svojim vježbama — jedan odgovor za admin formu. */
export async function listSveVjezbe(): Promise<Array<TipVjezbe & { vjezbe: VjezbaSazetak[] }>> {
  const tipovi = Object.values(TIPOVI_VJEZBI);
  return Promise.all(tipovi.map(async t => ({ ...t, vjezbe: await listVjezbe(t.tip) })));
}

/** Jedna vježba po vrsti i ID-u, ili null ako ne postoji ili nije ispravna. */
export async function getVjezba(tip: string, id: string): Promise<VjezbaSazetak | null> {
  if (!isValidTip(tip) || !isValidVjezbaId(id)) return null;
  const sve = await listVjezbe(tip);
  return sve.find(item => item.id === id) ?? null;
}

/** Sadržaj vježbe (JSON) — prvo iz baze, pa s diska. */
export async function citajPodatke(tip: string, id: string): Promise<{ podaci: Podaci; izvor: IzvorVjezbe } | null> {
  if (!isValidTip(tip) || !isValidVjezbaId(id)) return null;
  const izBaze = await citajIzBaze(tip);
  const red = izBaze.get(id);
  if (red) return { podaci: red.podaci, izvor: "vlastita" };
  const ugradjene = await citajUgradjene(tip);
  const podaci = ugradjene.get(id);
  return podaci ? { podaci, izvor: "ugradjena" } : null;
}

/** Upis vježbe iz panela. Isti (tip, id) se prepisuje. */
export async function spremiVjezbu(
  tip: string,
  id: string,
  podaci: Podaci,
  korisnikId: number | null,
): Promise<VjezbaSazetak> {
  const greska = validirajPodatke(tip, podaci);
  if (greska) throw new Error(greska);
  if (!isValidVjezbaId(id)) throw new Error("Nevažeći ID vježbe.");
  // `id` u sadržaju prati ključ vježbe, da događaji na kraju nose tačnu oznaku.
  const zaUpis: Podaci = { ...podaci, id: typeof podaci.id === "string" && podaci.id.trim() ? podaci.id.trim() : id };
  const naslov = String(zaUpis.naslov ?? "").trim().slice(0, 200);
  await db.execute(sql`
    INSERT INTO nase_vjezbe (tip, vjezba_id, naslov, podaci, updated_by)
    VALUES (${tip}, ${id}, ${naslov}, ${JSON.stringify(zaUpis)}::jsonb, ${korisnikId})
    ON CONFLICT (tip, vjezba_id) DO UPDATE
      SET naslov = EXCLUDED.naslov,
          podaci = EXCLUDED.podaci,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
  `);
  const s = sazetak(tip, id, zaUpis, "vlastita", new Date().toISOString());
  if (!s) throw new Error("Sadržaj vježbe nije ispravan.");
  return s;
}

/**
 * Brisanje vježbe iz panela. Ugrađena datoteka ostaje netaknuta — ako je
 * postojala, vježba se vraća na ugrađenu verziju.
 */
export async function obrisiVjezbu(tip: string, id: string): Promise<void> {
  if (!isValidTip(tip) || !isValidVjezbaId(id)) throw new Error("Nevažeća vježba.");
  await db.execute(sql`DELETE FROM nase_vjezbe WHERE tip = ${tip} AND vjezba_id = ${id}`);
}

/** Je li ID slobodan za novu vježbu? */
export async function slobodanId(tip: string, id: string): Promise<boolean> {
  if (!isValidTip(tip) || !isValidVjezbaId(id)) return false;
  return (await citajPodatke(tip, id)) === null;
}
