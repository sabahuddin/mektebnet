import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "@workspace/db";

/**
 * Sigurnosna kopija sadržaja: sve tabele baze u jednu datoteku.
 *
 * Format je NDJSON (jedan JSON po redu) da kopija može teći kroz gzip bez
 * držanja cijele baze u memoriji:
 *
 *   {"format":"mekteb-sadrzaj","verzija":1,"vrijeme":"...","tabele":[...]}
 *   {"tabela":"users"}
 *   {"red":{...}}
 *   {"kraj":"users","redova":42}
 *
 * Kopiju vraća `scripts/vrati-sadrzaj.mjs`.
 */
export const KOPIJA_FORMAT = "mekteb-sadrzaj";
export const KOPIJA_VERZIJA = 1;

/** Koliko redova povlačimo odjednom — drži memoriju ravnom i na velikim tabelama. */
const KOMAD = 1000;

/** Drizzle vodi svoju evidenciju migracija; ona pripada bazi, ne sadržaju. */
const PRESKOCI = new Set(["__drizzle_migrations"]);

const SIGURNO_IME = /^[a-z_][a-z0-9_]*$/i;

export type BrojRedova = { tabela: string; redova: number };

/** Sve tabele javne sheme, abecedno. */
export async function popisTabela(): Promise<string[]> {
  const { rows } = await pool.query<{ ime: string }>(
    `SELECT table_name AS ime
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  return rows
    .map(red => red.ime)
    .filter(ime => !PRESKOCI.has(ime) && SIGURNO_IME.test(ime));
}

/** Koliko redova ima svaka tabela — za pregled prije preuzimanja. */
export async function prebrojRedove(): Promise<BrojRedova[]> {
  const tabele = await popisTabela();
  const brojevi: BrojRedova[] = [];
  for (const tabela of tabele) {
    const { rows } = await pool.query<{ broj: string }>(
      `SELECT count(*)::text AS broj FROM "${tabela}"`,
    );
    brojevi.push({ tabela, redova: Number(rows[0]?.broj ?? 0) });
  }
  return brojevi;
}

/** Datoteka kopije, komad po komad (svaki komad je cijeli broj redova). */
export async function* kopijaSadrzaja(): AsyncGenerator<string> {
  const tabele = await popisTabela();
  yield `${JSON.stringify({
    format: KOPIJA_FORMAT,
    verzija: KOPIJA_VERZIJA,
    vrijeme: new Date().toISOString(),
    tabele,
  })}\n`;

  for (const tabela of tabele) {
    yield `${JSON.stringify({ tabela })}\n`;
    let preskoci = 0;
    for (;;) {
      // ctid je fizička adresa reda — stabilan poredak i bez primarnog ključa.
      const { rows } = await pool.query<{ red: unknown }>(
        `SELECT row_to_json(t) AS red FROM "${tabela}" t ORDER BY t.ctid LIMIT $1 OFFSET $2`,
        [KOMAD, preskoci],
      );
      if (rows.length === 0) break;
      let komad = "";
      for (const red of rows) komad += `${JSON.stringify({ red: red.red })}\n`;
      yield komad;
      preskoci += rows.length;
      if (rows.length < KOMAD) break;
    }
    yield `${JSON.stringify({ kraj: tabela, redova: preskoci })}\n`;
  }
}

/** Naziv datoteke: mekteb-sadrzaj-2026-09-18-1830.ndjson.gz */
export function imeKopije(sada = new Date()): string {
  const dvije = (broj: number) => String(broj).padStart(2, "0");
  const dan = `${sada.getFullYear()}-${dvije(sada.getMonth() + 1)}-${dvije(sada.getDate())}`;
  const sat = `${dvije(sada.getHours())}${dvije(sada.getMinutes())}`;
  return `mekteb-sadrzaj-${dan}-${sat}.ndjson.gz`;
}

export type StanjeFajlova = { folder: string; fajlova: number; bajtova: number };

/** Folder u koji admin panel sprema priložene fajlove (PDF, slike, audio, H5P). */
export function folderFajlova(): string {
  return process.env["UPLOADS_DIR"]
    ? path.resolve(process.env["UPLOADS_DIR"])
    : path.resolve(process.cwd(), "uploads");
}

/** Koliko je priloženih fajlova (PDF, slike, audio, H5P) i koliko zauzimaju. */
export async function stanjeFajlova(): Promise<StanjeFajlova> {
  const folder = folderFajlova();
  let fajlova = 0;
  let bajtova = 0;
  async function prodji(dir: string): Promise<void> {
    let stavke: import("node:fs").Dirent[];
    try {
      stavke = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const stavka of stavke) {
      const put = path.join(dir, stavka.name);
      if (stavka.isDirectory()) {
        await prodji(put);
      } else if (stavka.isFile()) {
        fajlova += 1;
        try {
          bajtova += (await fs.stat(put)).size;
        } catch {
          /* fajl je u međuvremenu nestao — ne ruši pregled */
        }
      }
    }
  }
  await prodji(folder);
  return { folder, fajlova, bajtova };
}

// ---------------------------------------------------------------------------
// Kopija priloženih fajlova kao .tar.gz
//
// Pišemo tar sami, u komadima, da kopija od par stotina megabajta ne mora
// stati u memoriju i da ne uvodimo novu biblioteku. Format je ustar; naziv
// duži od 100 bajtova ide kroz POSIX pax zapis, koji razumiju i GNU tar i
// bsdtar (macOS), a Windows 11 otvara .tar.gz sam.
// ---------------------------------------------------------------------------

const BLOK = 512;

function oktalno(broj: number, sirina: number): string {
  return broj.toString(8).padStart(sirina - 1, "0") + "\0";
}

function zaglavlje(ime: string, velicina: number, izmijenjen: number, vrsta: "0" | "5" | "x"): Buffer {
  const blok = Buffer.alloc(BLOK);
  blok.write(ime.slice(0, 100), 0, 100, "utf8");
  blok.write(oktalno(vrsta === "5" ? 0o755 : 0o644, 8), 100, 8, "ascii");
  blok.write(oktalno(0, 8), 108, 8, "ascii");   // uid
  blok.write(oktalno(0, 8), 116, 8, "ascii");   // gid
  blok.write(oktalno(velicina, 12), 124, 12, "ascii");
  blok.write(oktalno(Math.floor(izmijenjen / 1000), 12), 136, 12, "ascii");
  blok.write("        ", 148, 8, "ascii");      // mjesto zbira, dok se računa
  blok.write(vrsta, 156, 1, "ascii");
  blok.write("ustar\0", 257, 6, "ascii");
  blok.write("00", 263, 2, "ascii");

  let zbir = 0;
  for (const bajt of blok) zbir += bajt;
  blok.write(`${zbir.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return blok;
}

function dopuna(velicina: number): Buffer | null {
  const ostatak = velicina % BLOK;
  return ostatak === 0 ? null : Buffer.alloc(BLOK - ostatak);
}

/** POSIX pax zapis: "<duzina> kljuc=vrijednost\n", gdje duzina broji i sebe. */
function paxZapis(kljuc: string, vrijednost: string): Buffer {
  const rep = ` ${kljuc}=${vrijednost}\n`;
  let duzina = Buffer.byteLength(rep) + 1;
  for (;;) {
    const puna = Buffer.byteLength(String(duzina)) + Buffer.byteLength(rep);
    if (puna === duzina) break;
    duzina = puna;
  }
  return Buffer.from(String(duzina) + rep, "utf8");
}

async function* stavka(put: string, ime: string, vrsta: "0" | "5"): AsyncGenerator<Buffer> {
  const podaci = await fs.stat(put);
  const velicina = vrsta === "5" ? 0 : podaci.size;
  const imeTar = vrsta === "5" ? `${ime}/` : ime;

  if (Buffer.byteLength(imeTar) > 100) {
    const zapis = paxZapis("path", imeTar);
    yield zaglavlje("PaxHeader", zapis.length, podaci.mtimeMs, "x");
    yield zapis;
    const rep = dopuna(zapis.length);
    if (rep) yield rep;
  }

  yield zaglavlje(imeTar, velicina, podaci.mtimeMs, vrsta);
  if (vrsta === "5") return;

  const { createReadStream } = await import("node:fs");
  let procitano = 0;
  for await (const komad of createReadStream(put)) {
    procitano += (komad as Buffer).length;
    yield komad as Buffer;
  }
  // Fajl koji je u međuvremenu skraćen pokvario bi cijelu kopiju, pa dopunimo
  // do veličine iz zaglavlja.
  if (procitano < velicina) yield Buffer.alloc(velicina - procitano);
  const rep = dopuna(velicina);
  if (rep) yield rep;
}

/** Cijeli folder priloženih fajlova kao tar tok (kroz gzip ide u rutu). */
export async function* kopijaFajlova(korijen = folderFajlova()): AsyncGenerator<Buffer> {
  async function* prodji(dir: string, prefiks: string): AsyncGenerator<Buffer> {
    const stavke = (await fs.readdir(dir, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const red of stavke) {
      const put = path.join(dir, red.name);
      const ime = prefiks ? `${prefiks}/${red.name}` : red.name;
      try {
        if (red.isDirectory()) {
          yield* stavka(put, ime, "5");
          yield* prodji(put, ime);
        } else if (red.isFile()) {
          yield* stavka(put, ime, "0");
        }
      } catch {
        // Fajl je nestao ili se ne da pročitati — preskoči ga, kopija ostalog
        // je vrednija od prekida.
      }
    }
  }
  try {
    await fs.access(korijen);
  } catch {
    yield Buffer.alloc(BLOK * 2);
    return;
  }
  yield* prodji(korijen, "");
  yield Buffer.alloc(BLOK * 2); // kraj arhive: dva prazna bloka
}

/** Naziv datoteke: mekteb-fajlovi-2026-09-18-1830.tar.gz */
export function imeKopijeFajlova(sada = new Date()): string {
  return imeKopije(sada).replace("mekteb-sadrzaj-", "mekteb-fajlovi-").replace(".ndjson.gz", ".tar.gz");
}
