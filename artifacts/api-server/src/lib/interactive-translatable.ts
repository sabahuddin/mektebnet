/**
 * Faza 2 (interaktivna pitanja) — overlay prijevoda za INLINE kviz pitanja
 * tipa `dragDrop` i `markWords`.
 *
 * Ta pitanja žive INLINE u `kvizovi.pitanja` (JSONB niz) i NEMAJU red u banci,
 * pa ih obični `pitanja_banka` overlay ne pokriva. Prijevode čuvamo u
 * `content_prijevodi` sa:
 *   - tabela    = "kvizovi_pitanja"
 *   - red_id    = kviz.id
 *   - polje     = sadržajni hash bosanskog pitanja (prvih 40 hex znakova SHA256)
 *   - jezik     = sq | de | en
 *   - prijevod  = JSON.stringify(prevedena polja, u obliku koji klijent očekuje)
 *   - izvor_hash= puni SHA256 (64 hex) bosanskog pitanja
 *
 * Ključ je SADRŽAJNI hash (content-addressed): preživi reorder pitanja unutar
 * kviza; ako se pitanje uredi → hash se promijeni → nema reda → fallback na
 * bosanski (nikad ne prikazujemo prijevod koji ne odgovara trenutnom izvoru).
 *
 * KRITIČNO: `canonicalQuestionHash` mora biti BAJT-ISTOVJETAN i na serve-time
 * (content.ts) i u generacijskoj skripti (scripts/translate-interactive.ts).
 * Obje strane importuju OVU funkciju — ne duplicirati.
 */
import crypto from "node:crypto";

export const INTERACTIVE_TABLE = "kvizovi_pitanja";
const INTERACTIVE_TYPES = new Set(["dragdrop", "markwords"]);

export interface InteractiveQuestion {
  type?: string;
  question?: string;
  explanation?: string;
  // dragDrop
  template?: unknown;
  words?: unknown;
  correct?: unknown;
  // markWords
  text?: unknown;
  incorrect?: unknown;
  [k: string]: unknown;
}

/** `dragDrop` ili `markWords` (case-insensitive). */
export function isInteractiveType(t: unknown): boolean {
  return typeof t === "string" && INTERACTIVE_TYPES.has(t.toLowerCase());
}

/**
 * Deterministička serijalizacija sa rekurzivno sortiranim ključevima. Mora dati
 * isti string za isti objekat bez obzira na redoslijed ključeva.
 */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (
      "{" +
      Object.keys(o)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableStringify(o[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(v);
}

export interface QHash {
  /** Prvih 40 hex znakova (stane u varchar(60)) — koristi se kao `polje`. */
  polje: string;
  /** Puni SHA256 (64 hex) — koristi se kao `izvor_hash`. */
  full: string;
}

export function canonicalQuestionHash(q: unknown): QHash {
  const full = crypto.createHash("sha256").update(stableStringify(q), "utf8").digest("hex");
  return { polje: full.slice(0, 40), full };
}

function isStrArr(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((s) => typeof s === "string");
}

/**
 * Validira prevedeni payload protiv bosanskog originala i vraća OBJEKAT spreman
 * za slanje klijentu (spojen sa originalom), ili `null` ako je nevažeći (→ poziva
 * fallback na bosanski). `payload` je JSON string iz `content_prijevodi.prijevod`
 * (ili već parsiran objekat).
 *
 * Strukturne invarijante koje klijent (kviz.tsx) zahtijeva:
 *  - dragDrop: `template` neprazan sa ISTIM BROJEM "DROP" tokena kao original
 *    (poredak/broj ostalih segmenata smije varirati zbog reda riječi u jeziku);
 *    `words` iste dužine kao original; `correct` iste dužine, svaki element ∈ `words`.
 *  - markWords: `words` (čipovi) neprazno; `incorrect` neprazan niz STRINGOVA
 *    (klijent poredi `incorrect.includes(word)`), svaki ∈ `words`.
 */
export function validateAndMergeInteractive(
  orig: InteractiveQuestion,
  payload: string | Record<string, unknown>,
): InteractiveQuestion | null {
  let tr: Record<string, unknown>;
  try {
    tr = typeof payload === "string" ? (JSON.parse(payload) as Record<string, unknown>) : payload;
  } catch {
    return null;
  }
  if (!tr || typeof tr !== "object") return null;

  const type = typeof orig.type === "string" ? orig.type.toLowerCase() : "";

  if (type === "dragdrop") {
    const oTpl = Array.isArray(orig.template) ? (orig.template as unknown[]) : [];
    const oWords = Array.isArray(orig.words) ? (orig.words as unknown[]) : [];
    const oCorrect = Array.isArray(orig.correct) ? (orig.correct as unknown[]) : [];
    const tpl = tr.template;
    const words = tr.words;
    const correct = tr.correct;
    if (typeof tr.question !== "string" || tr.question.trim() === "") return null;
    // Broj "DROP" tokena mora ostati isti (= broj praznina = correct.length).
    // Ukupan broj/poredak OSTALIH segmenata smije se mijenjati zbog reda riječi
    // u drugim jezicima (npr. broj ide na sredinu u EN, a na kraj u BS).
    if (!isStrArr(tpl) || tpl.length === 0) return null;
    const oDrops = oTpl.filter((s) => s === "DROP").length;
    const tDrops = tpl.filter((s) => s === "DROP").length;
    if (tDrops !== oDrops) return null;
    if (!isStrArr(words) || words.length !== oWords.length) return null;
    if (!isStrArr(correct) || correct.length !== oCorrect.length) return null;
    const wset = new Set(words);
    if (!correct.every((c) => wset.has(c))) return null;
    return {
      ...orig,
      question: tr.question,
      template: tpl,
      words,
      correct,
      ...(typeof tr.explanation === "string" ? { explanation: tr.explanation } : {}),
    };
  }

  if (type === "markwords") {
    const words = tr.words;
    const incorrect = tr.incorrect;
    if (typeof tr.question !== "string" || tr.question.trim() === "") return null;
    if (typeof tr.text !== "string" || tr.text.trim() === "") return null;
    if (!isStrArr(words) || words.length === 0) return null;
    if (!isStrArr(incorrect) || incorrect.length === 0) return null;
    const wset = new Set(words);
    if (!incorrect.every((w) => wset.has(w))) return null;
    return {
      ...orig,
      question: tr.question,
      text: tr.text,
      words,
      incorrect,
      ...(typeof tr.explanation === "string" ? { explanation: tr.explanation } : {}),
    };
  }

  return null;
}
