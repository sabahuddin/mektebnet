/**
 * Faza 2 — overlay prijevoda SADRŽAJA na serve-time.
 *
 * GET rute vraćaju bosanski original iz baze; ako klijent pošalje `X-Lang` header
 * (sq/de/en/tr/ar), ovdje preklopimo prevedena polja iz `content_prijevodi`.
 * Ako prijevod ne postoji za neki red/polje → ostaje bosanski (fallback). Bosanski
 * (`bs`) ili nepoznat jezik → no-op (vrati original netaknut).
 *
 * `polje` u bazi je IME KOLONE (snake_case) — mora ostati usklađeno sa prevodnom
 * obradom u scripts/src/translate-content.ts. `resKey` je ime svojstva u JSON
 * odgovoru (camelCase kako Drizzle mapira), na koje upisujemo prijevod.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type CTFieldType = "text" | "html" | "jsonbArray";
export interface CTField { col: string; resKey: string; type: CTFieldType; }
export interface CTTable { tabela: string; fields: CTField[]; }

export const CT_TABLES: Record<string, CTTable> = {
  ilmihal_lekcije: { tabela: "ilmihal_lekcije", fields: [
    { col: "naslov", resKey: "naslov", type: "text" },
    { col: "content_html", resKey: "contentHtml", type: "html" },
    // "Provjeri znanje" mini-kviz (niz objekata {question, options[], answer}).
    // Generator (scripts/translate-content.ts, tip "kvizPitanja") sprema cijeli
    // prevedeni niz kao JSON; ovdje ga samo JSON.parse-amo nazad u kvizPitanja.
    { col: "kviz_pitanja", resKey: "kvizPitanja", type: "jsonbArray" },
  ] },
  knjige: { tabela: "knjige", fields: [
    { col: "naslov", resKey: "naslov", type: "text" },
    { col: "content_html", resKey: "contentHtml", type: "html" },
  ] },
  medaljoni: { tabela: "medaljoni", fields: [
    { col: "naziv", resKey: "naziv", type: "text" },
    { col: "opis", resKey: "opis", type: "text" },
    { col: "content_html", resKey: "contentHtml", type: "html" },
  ] },
  rjecnik: { tabela: "rjecnik", fields: [
    { col: "rijec", resKey: "rijec", type: "text" },
    { col: "definicija", resKey: "definicija", type: "text" },
  ] },
  pitanja_banka: { tabela: "pitanja_banka", fields: [
    { col: "pitanje", resKey: "pitanje", type: "text" },
    { col: "opcije", resKey: "opcije", type: "jsonbArray" },
    { col: "objasnjenje", resKey: "objasnjenje", type: "text" },
  ] },
  igra_pitanja: { tabela: "igra_pitanja", fields: [
    { col: "pitanje", resKey: "pitanje", type: "text" },
    { col: "opcije", resKey: "opcije", type: "jsonbArray" },
    { col: "objasnjenje", resKey: "objasnjenje", type: "text" },
  ] },
  kvizovi: { tabela: "kvizovi", fields: [
    { col: "naslov", resKey: "naslov", type: "text" },
    { col: "opis", resKey: "opis", type: "text" },
  ] },
  misija_definicija: { tabela: "misija_definicija", fields: [
    { col: "naziv", resKey: "naziv", type: "text" },
    { col: "opis", resKey: "opis", type: "text" },
  ] },
};

const SUPPORTED = new Set(["sq", "de", "en", "tr", "ar"]);

/** Pročitaj ciljni jezik iz X-Lang headera. Vrati "bs" za bosanski/nepoznato. */
export function getLang(req: { get(name: string): string | undefined }): string {
  const l = (req.get("x-lang") || "").toLowerCase().trim();
  return SUPPORTED.has(l) ? l : "bs";
}

/**
 * Preklopi prijevode na niz redova (mutira in-place i vraća isti niz).
 * @param idKey svojstvo u redu koje odgovara content_prijevodi.red_id (default "id")
 * @param tableKey ključ u CT_TABLES; ako se razlikuje od resKey-eva, prosto nazovi.
 */
export async function overlayRows<T extends Record<string, any>>(
  rows: T[],
  tableKey: string,
  lang: string,
  idKey: string = "id",
): Promise<T[]> {
  if (lang === "bs" || rows.length === 0) return rows;
  const cfg = CT_TABLES[tableKey];
  if (!cfg) return rows;
  const ids = rows.map((r) => r[idKey]).filter((x) => x != null);
  if (ids.length === 0) return rows;

  const idList = sql.join(ids.map((i) => sql`${i}`), sql`, `);
  const result = (await db.execute(
    sql`SELECT red_id, polje, prijevod FROM content_prijevodi
        WHERE tabela = ${cfg.tabela} AND jezik = ${lang} AND red_id IN (${idList})`,
  )) as unknown as { rows: { red_id: number; polje: string; prijevod: string }[] };

  const byId = new Map<number, Record<string, string>>();
  for (const row of result.rows) {
    let m = byId.get(row.red_id);
    if (!m) { m = {}; byId.set(row.red_id, m); }
    m[row.polje] = row.prijevod;
  }

  for (const row of rows) {
    const target = row as Record<string, unknown>;
    const m = byId.get(target[idKey] as number);
    if (!m) continue;
    for (const f of cfg.fields) {
      const tr = m[f.col];
      if (tr == null || tr === "") continue;
      if (f.type === "jsonbArray") {
        try { target[f.resKey] = JSON.parse(tr); } catch { /* zadrži original */ }
      } else {
        target[f.resKey] = tr;
      }
    }
  }
  return rows;
}

/** Preklopi prijevode na jedan red. */
export async function overlayOne<T extends Record<string, any>>(
  row: T,
  tableKey: string,
  lang: string,
  idKey: string = "id",
): Promise<T> {
  await overlayRows([row], tableKey, lang, idKey);
  return row;
}
