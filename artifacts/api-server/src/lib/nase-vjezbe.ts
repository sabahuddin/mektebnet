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
  poredak: {
    tip: "poredak",
    naziv: "Poredak",
    opis: "Dijete slaže izmiješane stavke u tačan redoslijed.",
    html: "/vjezbe/poredak/poredak.html",
  },
  razvrstaj: {
    tip: "razvrstaj",
    naziv: "Razvrstaj",
    opis: "Dijete razvrstava pojmove u dvije do pet kutija.",
    html: "/vjezbe/razvrstaj/razvrstaj.html",
  },
  spoji: {
    tip: "spoji",
    naziv: "Spoji parove",
    opis: "Dijete spaja pojam s njegovim značenjem.",
    html: "/vjezbe/spoji/spoji.html",
  },
  upisi: {
    tip: "upisi",
    naziv: "Upiši odgovor",
    opis: "Dijete upisuje odgovor na pitanje.",
    html: "/vjezbe/upisi/upisi.html",
  },
};

/** Prefiksi po kojima stranica lekcije prepoznaje našu vježbu. */
export const NASE_VJEZBE_PREFIKSI = Object.values(TIPOVI_VJEZBI)
  .map(t => `/vjezbe/${t.tip}/`);

const MAX_JSON_BYTES = 512 * 1024;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

type Podaci = Record<string, unknown>;

/** Odakle dolazi sadržaj vježbe. */
export type IzvorVjezbe = "ugradjena" | "vlastita";

/** Jezici sučelja koji mogu imati prevedenu vježbu (isti spisak kao X-Lang). */
export const JEZICI_VJEZBI = ["sq", "de", "en", "tr", "ar"] as const;

/**
 * Prijevod sadržaja vježbe stoji U SAMOM sadržaju, pod ključem `prijevodi`:
 *
 *   { "naslov": "Spoji pojam i objašnjenje", "parovi": [...],
 *     "prijevodi": { "de": { "naslov": "…", "parovi": [...] } } }
 *
 * Time isti mehanizam pokriva i ugrađene vježbe (prijevod ide uz JSON
 * datoteku) i vježbe koje admin napravi u panelu (prijevod ide uz `podaci`
 * blob u bazi) — bez zasebne tabele i bez drugog puta kroz kod.
 *
 * Spaja se samo po vrhu: prijevod donosi cijele vrijednosti tekstualnih polja
 * (naslov, uputa, parovi, stavke…), a postavke vježbe (`id`, `tezina`,
 * `poredaj`, `prikaz`) uvijek ostaju iz bosanskog izvornika, da prijevod ne
 * može promijeniti kako vježba radi.
 */
const POSTAVKE_IZ_IZVORNIKA = ["id", "tezina", "prikaz", "poredaj"] as const;

export function primijeniJezik(podaci: Podaci, jezik: string | undefined | null): Podaci {
  const { prijevodi, ...osnova } = podaci as Podaci & { prijevodi?: unknown };
  const trazeni = String(jezik ?? "").toLowerCase().trim();
  if (!trazeni || trazeni === "bs") return osnova;
  if (!prijevodi || typeof prijevodi !== "object" || Array.isArray(prijevodi)) return osnova;
  const prijevod = (prijevodi as Record<string, unknown>)[trazeni];
  if (!prijevod || typeof prijevod !== "object" || Array.isArray(prijevod)) return osnova;
  const spojeno: Podaci = { ...osnova, ...(prijevod as Podaci) };
  for (const kljuc of POSTAVKE_IZ_IZVORNIKA) {
    if (kljuc in osnova) spojeno[kljuc] = osnova[kljuc];
    else delete spojeno[kljuc];
  }
  delete spojeno.prijevodi;
  return spojeno;
}

/** Jezici za koje vježba ima prijevod (za admin spisak i testove). */
export function jeziciPrijevoda(podaci: Podaci): string[] {
  const prijevodi = (podaci as { prijevodi?: unknown }).prijevodi;
  if (!prijevodi || typeof prijevodi !== "object" || Array.isArray(prijevodi)) return [];
  return JEZICI_VJEZBI.filter((j) => {
    const p = (prijevodi as Record<string, unknown>)[j];
    return !!p && typeof p === "object" && !Array.isArray(p);
  });
}

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

/**
 * Provjera sadržaja prije upisa i prije prikaza u spisku. Vraća `null` kad je
 * sve u redu, inače poruku koju admin vidi. Uz bosanski izvornik provjerava i
 * svaki prijevod — prevedena vježba mora biti upotrebljiva isto kao izvornik
 * (npr. razvrstavanje ne smije dobiti istu stavku u dvije kutije).
 */
export function validirajPodatke(tip: string, podaci: unknown): string | null {
  const greska = validirajOsnovu(tip, podaci);
  if (greska) return greska;
  const prijevodi = (podaci as Podaci).prijevodi;
  if (prijevodi === undefined) return null;
  if (!prijevodi || typeof prijevodi !== "object" || Array.isArray(prijevodi)) {
    return "Prijevodi vježbe moraju biti mapa jezik → sadržaj.";
  }
  for (const jezik of Object.keys(prijevodi as Record<string, unknown>)) {
    if (!(JEZICI_VJEZBI as readonly string[]).includes(jezik)) {
      return `Nepoznat jezik prijevoda: ${jezik}.`;
    }
    const spojeno = primijeniJezik(podaci as Podaci, jezik);
    const greskaPrijevoda = validirajOsnovu(tip, spojeno);
    if (greskaPrijevoda) return `Prijevod (${jezik}): ${greskaPrijevoda}`;
  }
  return null;
}

function validirajOsnovu(tip: string, podaci: unknown): string | null {
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

  if (tip === "upisi") {
    const pitanja = Array.isArray(p.pitanja) ? p.pitanja : null;
    if (!pitanja || pitanja.length < 1) return "Upiši bar jedno pitanje.";
    if (pitanja.length > 20) return "Vježba može imati najviše dvadeset pitanja.";
    for (const red of pitanja) {
      const stavka = (red ?? {}) as Podaci;
      if (typeof stavka.pitanje !== "string" || !stavka.pitanje.trim()) return "Svako pitanje treba tekst pitanja.";
      if (typeof stavka.odgovor !== "string" || !stavka.odgovor.trim()) {
        return `Pitanje „${String(stavka.pitanje).trim().slice(0, 40)}" nema odgovor.`;
      }
      if (stavka.prihvati !== undefined
        && (!Array.isArray(stavka.prihvati) || stavka.prihvati.some(d => typeof d !== "string"))) {
        return "Drugi prihvaćeni odgovori moraju biti spisak riječi.";
      }
      if (stavka.pomoc !== undefined && typeof stavka.pomoc !== "string") return "Pomoć uz pitanje mora biti tekst.";
    }
    return null;
  }

  if (tip === "spoji") {
    const parovi = Array.isArray(p.parovi) ? p.parovi : null;
    if (!parovi || parovi.length < 2) return "Spajanje treba bar dva para.";
    if (parovi.length > 12) return "Spajanje može imati najviše dvanaest parova.";
    const lijeve = new Set<string>();
    const desne = new Set<string>();
    for (const par of parovi) {
      const red = (par ?? {}) as Podaci;
      const lijevo = typeof red.lijevo === "string" ? red.lijevo.trim() : "";
      const desno = typeof red.desno === "string" ? red.desno.trim() : "";
      if (!lijevo || !desno) return "Svaki par treba i lijevu i desnu stranu.";
      const kljucL = lijevo.toLocaleLowerCase("bs");
      const kljucD = desno.toLocaleLowerCase("bs");
      if (lijeve.has(kljucL)) return `Pojam „${lijevo}" se ponavlja — dijete ne bi znalo na koji red misliš.`;
      if (desne.has(kljucD)) return `Odgovor „${desno}" se ponavlja — dijete ne bi znalo uz koji pojam ide.`;
      lijeve.add(kljucL);
      desne.add(kljucD);
    }
    return null;
  }

  if (tip === "razvrstaj") {
    const kategorije = Array.isArray(p.kategorije) ? p.kategorije : null;
    if (!kategorije || kategorije.length < 2) return "Razvrstavanje treba bar dvije kutije.";
    if (kategorije.length > 5) return "Razvrstavanje može imati najviše pet kutija.";
    const sveStavke = new Set<string>();
    let ukupno = 0;
    for (const k of kategorije) {
      const kat = (k ?? {}) as Podaci;
      if (typeof kat.naziv !== "string" || !kat.naziv.trim()) return "Svaka kutija treba naziv.";
      const stavke = Array.isArray(kat.stavke) ? kat.stavke : null;
      if (!stavke || stavke.length < 1) return `Kutija „${String(kat.naziv).trim()}" nema nijednu stavku.`;
      for (const s of stavke) {
        if (typeof s !== "string" || !s.trim()) return "Nijedna stavka ne smije biti prazna.";
        const kljuc = s.trim().toLocaleLowerCase("bs");
        if (sveStavke.has(kljuc)) return `Stavka „${s.trim()}" stoji u dvije kutije — dijete ne bi znalo gdje ide.`;
        sveStavke.add(kljuc);
        ukupno += 1;
      }
    }
    if (ukupno > 40) return "Razvrstavanje može imati najviše četrdeset stavki.";
    return null;
  }

  if (tip === "poredak") {
    const stavke = Array.isArray(p.stavke) ? p.stavke : null;
    if (!stavke || stavke.length < 2) return "Poredak treba bar dvije stavke.";
    if (stavke.length > 20) return "Poredak može imati najviše dvadeset stavki.";
    if (stavke.some(s => typeof s !== "string" || !String(s).trim())) return "Nijedna stavka ne smije biti prazna.";
    const vidjene = new Set<string>();
    for (const s of stavke) {
      const kljuc = String(s).trim().toLocaleLowerCase("bs");
      if (vidjene.has(kljuc)) return "Dvije stavke ne smiju biti iste — dijete ih ne bi moglo razlikovati.";
      vidjene.add(kljuc);
    }
    if (p.poredaj !== undefined && !["mijesaj", "redom"].includes(String(p.poredaj))) {
      return "Redoslijed može biti: mijesaj ili redom.";
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
  } else if (tip === "poredak") {
    const stavke = Array.isArray(podaci.stavke) ? podaci.stavke : [];
    detalj = mnozina(stavke.length, "stavka", "stavke", "stavki");
  } else if (tip === "upisi") {
    const pitanja = Array.isArray(podaci.pitanja) ? podaci.pitanja : [];
    detalj = mnozina(pitanja.length, "pitanje", "pitanja", "pitanja");
  } else if (tip === "spoji") {
    const parovi = Array.isArray(podaci.parovi) ? podaci.parovi : [];
    detalj = mnozina(parovi.length, "par", "para", "parova");
  } else if (tip === "razvrstaj") {
    const kategorije = Array.isArray(podaci.kategorije) ? podaci.kategorije : [];
    const stavki = kategorije.reduce((zbir, k) => {
      const stavke = (k as Podaci)?.stavke;
      return zbir + (Array.isArray(stavke) ? stavke.length : 0);
    }, 0);
    detalj = `${mnozina(kategorije.length, "kutija", "kutije", "kutija")} · ${mnozina(stavki, "stavka", "stavke", "stavki")}`;
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
