// Učitavanje ilmihal lekcija iz scripts/content-seed.json.gz i pretvaranje
// HTML sadržaja u čisti tekst. Koriste ga i provjeri.mjs i generate.mjs.
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(HERE, "..", "content-seed.json.gz");

/** @typedef {{ id:number, nivo:number, slug:string, naslov:string, contentHtml:string, tekst:string, kvizPitanja:{question:string,options:string[],answer:string}[]|null }} Lekcija */

export function htmlUTekst(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalizacija za poređenje: velika slova, bez dijakritika i bez neslovnih znakova. */
export function normalizuj(s) {
  return String(s)
    .toUpperCase()
    .replace(/Č|Ć/g, "C")
    .replace(/Ž/g, "Z")
    .replace(/Š/g, "S")
    .replace(/Đ/g, "D")
    .replace(/[ĀÂÄÁÀ]/g, "A")
    .replace(/[ĪÎÏÍÌ]/g, "I")
    .replace(/[ŪÛÜÚÙ]/g, "U")
    .replace(/[ĒÊËÉÈ]/g, "E")
    .replace(/[ŌÔÖÓÒ]/g, "O")
    .replace(/[^A-Z0-9]/g, "");
}

/** @returns {Lekcija[]} */
export function ucitajLekcije() {
  const raw = JSON.parse(gunzipSync(readFileSync(SEED)).toString("utf8"));
  return raw.lekcije.map((l) => ({ ...l, tekst: htmlUTekst(l.contentHtml) }));
}

/** Mapa slug -> lekcija. */
export function poSlugu(lekcije) {
  const m = new Map();
  for (const l of lekcije) m.set(l.slug, l);
  return m;
}
