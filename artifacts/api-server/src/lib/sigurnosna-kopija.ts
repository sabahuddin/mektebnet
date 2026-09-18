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

/** Koliko je priloženih fajlova (PDF, slike, audio, H5P) i koliko zauzimaju. */
export async function stanjeFajlova(): Promise<StanjeFajlova> {
  const folder = process.env["UPLOADS_DIR"]
    ? path.resolve(process.env["UPLOADS_DIR"])
    : path.resolve(process.cwd(), "uploads");
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
