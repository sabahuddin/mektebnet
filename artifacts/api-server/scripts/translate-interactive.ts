/**
 * Generacijska skripta — prevodi INLINE interaktivna kviz pitanja
 * (dragDrop + markWords) iz bosanskog na sq/de/en i upisuje u PROD
 * content_prijevodi (tabela='kvizovi_pitanja').
 *
 * Pokretanje (tsx iz pnpm store, sandbox nema .bin link):
 *   node node_modules/.pnpm/tsx@4.21.0/node_modules/tsx/dist/cli.mjs \
 *        artifacts/api-server/scripts/translate-interactive.ts [opcije]
 *
 * Opcije:
 *   --dry [N]      probni rad na N jedinica (default 3), JEDAN jezik, BEZ upisa
 *   --lang xx      ograniči na jedan jezik (sq|de|en)
 *   --limit N      max work-item po pokretanju (default 150) — bounded/resumable
 *   --conc N       paralelizam AI poziva (default 8)
 *
 * Idempotentno + resumable: preskače (red_id,polje,jezik) koji već postoji sa
 * istim izvor_hash. Pokreći više puta dok "preostalo" ne padne na 0.
 *
 * Hash i validatori se importuju iz src/lib/interactive-translatable.ts (ISTI
 * kod kao serve — nema drift-a).
 */
import { createRequire } from "node:module";
import {
  canonicalQuestionHash,
  validateAndMergeInteractive,
  isInteractiveType,
  INTERACTIVE_TABLE,
  type InteractiveQuestion,
} from "../src/lib/interactive-translatable.ts";

const require = createRequire(import.meta.url);
const { Client } = require("/home/runner/workspace/lib/db/node_modules/pg");

// ---- konfiguracija ---------------------------------------------------------
const ALL_LANGS = ["sq", "de", "en"] as const;
type Lang = (typeof ALL_LANGS)[number];
const LANG_NAME: Record<Lang, string> = {
  sq: "Albanian (Shqip)",
  de: "German (Deutsch)",
  en: "English",
};

const BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const MODEL = "gpt-5-mini";

// ---- CLI -------------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : "";
}
const DRY = argv.includes("--dry");
const DRY_N = DRY ? parseInt(flag("--dry") || "3", 10) : 0;
const ONLY_LANG = flag("--lang") as Lang | undefined;
const LIMIT = parseInt(flag("--limit") || "150", 10);
const CONC = parseInt(flag("--conc") || "8", 10);
// Wall-clock budžet (s): worker prestaje uzimati nove iteme nakon ovoga pa
// proces čisto izađe prije bash 120s cap-a (backoff čini trajanje nepredvidivim).
const BUDGET_MS = parseInt(flag("--budget") || "90", 10) * 1000;
const LANGS: Lang[] = ONLY_LANG ? [ONLY_LANG] : [...ALL_LANGS];

// ---- AI --------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chat(system: string, user: string, attempt = 0): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "minimal",
      max_completion_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  // Backoff na rate-limit (429) i prolazne 5xx greške — poštuj retry-after.
  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    const ra = parseFloat(res.headers.get("retry-after") || "");
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(1500 * 2 ** attempt, 20000);
    await sleep(wait + Math.random() * 400);
    return chat(system, user, attempt + 1);
  }
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = j.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("AI odgovor odsječen (length)");
  const content = choice?.message?.content ?? "";
  return JSON.parse(content) as Record<string, unknown>;
}

const SYSTEM = (lang: Lang) =>
  `You are a professional translator for an Islamic education platform for children (ages ~7-11). ` +
  `Translate from Bosnian into ${LANG_NAME[lang]}. ` +
  `Keep ALL of the following UNCHANGED (do not translate or transliterate): Arabic transliterations ` +
  `(e.g. "Subhaneke", "musteqim", "kesmuke", "Fatiha", "Kunut"), Qur'an/sura/dua names, proper names, ` +
  `and numbers. Translate ordinary words naturally and child-friendly. Preserve meaning precisely. ` +
  `Output ONLY a single valid JSON object, no commentary.`;

// ---- prevod dragDrop -------------------------------------------------------
// Model vraća: question, explanation, template[] (ista dužina, "DROP" netaknut),
// words[] (ista dužina i redoslijed). `correct` rekonstruišemo po INDEKSIMA iz
// originala (garantuje correct ⊆ words bez oslanjanja na model da prepiše string).
async function translateDragDrop(
  q: InteractiveQuestion,
  lang: Lang,
): Promise<Record<string, unknown> | null> {
  const oWords = (q.words as unknown[]).map(String);
  const oTemplate = (q.template as unknown[]).map(String);
  const oCorrect = (q.correct as unknown[]).map(String);
  // indeksi tačnih riječi u originalnom words nizu (po redoslijedu blanko polja)
  const correctIdx = oCorrect.map((c) => oWords.indexOf(c));
  if (correctIdx.some((i) => i < 0)) return null; // ne bi se trebalo desiti

  const user =
    `Translate this fill-in-the-blank ("dragDrop") quiz question.\n\n` +
    `RULES:\n` +
    `- "template" is an array of text segments; the literal token "DROP" marks a blank to fill. ` +
    `Translate the readable segments into natural ${LANG_NAME[lang]} word order. Keep EXACTLY the same ` +
    `number of "DROP" tokens (each its OWN array item, the literal string "DROP"). You MAY change the ` +
    `number/position of the OTHER text segments so the sentence reads naturally (the blank may move).\n` +
    `- "words" is the list of draggable chips. Return the SAME number of items in the SAME order. ` +
    `Translate ordinary words; keep Arabic transliterations, names and numbers unchanged.\n` +
    `- Translate "question" and "explanation" naturally.\n\n` +
    `Return JSON: {"question": string, "explanation": string, "template": string[], "words": string[]}.\n\n` +
    `DATA:\n` +
    JSON.stringify(
      { question: q.question ?? "", explanation: q.explanation ?? "", template: oTemplate, words: oWords },
      null,
      0,
    );

  const out = await chat(SYSTEM(lang), user);
  const outWords = Array.isArray(out.words) ? out.words.map(String) : [];
  const outTemplate = Array.isArray(out.template) ? out.template.map(String) : [];
  if (outWords.length !== oWords.length) return null;
  // Broj "DROP" tokena mora ostati isti; ukupan broj segmenata smije varirati
  // (red riječi se razlikuje po jezicima — blank se može pomjeriti).
  if (outTemplate.length === 0) return null;
  const oDrops = oTemplate.filter((s) => s === "DROP").length;
  const tDrops = outTemplate.filter((s) => s === "DROP").length;
  if (tDrops !== oDrops) return null;
  const correct = correctIdx.map((i) => outWords[i]);
  const payload = {
    question: typeof out.question === "string" ? out.question : "",
    explanation: typeof out.explanation === "string" ? out.explanation : "",
    template: outTemplate,
    words: outWords,
    correct,
  };
  // validacija identičnom serve-logikom
  return validateAndMergeInteractive(q, payload) ? payload : null;
}

// ---- prevod markWords ------------------------------------------------------
// Model vraća prevedenu rečenicu sa POGREŠNIM riječima umotanim u ⟦ ⟧.
// Iz toga deriviramo text/words/incorrect (garantuje incorrect ⊆ words i
// words === text.split). `incorrect` su STRINGOVI (klijentski ugovor).
const L = "\u27E6"; // ⟦
const R = "\u27E7"; // ⟧
async function translateMarkWords(
  q: InteractiveQuestion,
  lang: Lang,
): Promise<Record<string, unknown> | null> {
  const oWords = (q.words as unknown[]).map(String);
  const oIncorrect = (q.incorrect as unknown[]).filter((n) => typeof n === "number") as number[];
  // NB: dio izvornih `incorrect` indeksa je VAN granica (pokvareni podaci) →
  // wrongWords može ostati prazan; tada model sam pronađe grešku iz objašnjenja.
  const wrongWords = oIncorrect
    .map((i) => oWords[i])
    .filter((w): w is string => typeof w === "string");

  const user =
    `Translate this "find the mistake" ("markWords") quiz question into ${LANG_NAME[lang]}. ` +
    `The sentence is a deliberately FLAWED rendering containing a factual error the student must spot.\n\n` +
    `The incorrect word(s) in the Bosnian sentence: ${JSON.stringify(wrongWords)}.\n` +
    `Teacher note about the error: ${q.explanation ?? ""}\n\n` +
    `RULES:\n` +
    `- Translate the ENTIRE "sentence" into ${LANG_NAME[lang]}, INCLUDING the incorrect word: render the ` +
    `incorrect word by its (wrong) meaning so the sentence stays factually wrong in ${LANG_NAME[lang]}. ` +
    `Do NOT fix the error, and do NOT leave any Bosnian word untranslated.\n` +
    `- Wrap the translated incorrect word individually in ${L} ${R}, directly around exactly ONE word with ` +
    `NO spaces inside (e.g. ${L}word${R}). One wrapped word per error.\n` +
    `- Keep proper names (Allah, sura/dua names) and numbers unchanged.\n` +
    `- Also translate "question" and "explanation" (the explanation is the teacher's note — render it fully ` +
    `in ${LANG_NAME[lang]}, including any quoted correct/replacement word; do NOT leave it in Bosnian).\n\n` +
    `Return JSON: {"question": string, "explanation": string, "sentence": string}.\n\n` +
    `DATA:\n` +
    JSON.stringify(
      { question: q.question ?? "", explanation: q.explanation ?? "", sentence: (q.text as string) ?? "" },
      null,
      0,
    );

  const out = await chat(SYSTEM(lang), user);
  const sentence = typeof out.sentence === "string" ? out.sentence : "";
  if (!sentence) return null;
  const tokens = sentence.trim().split(/\s+/);
  const words: string[] = [];
  const incorrect: string[] = [];
  for (const tok of tokens) {
    const marked = tok.includes(L) || tok.includes(R);
    const clean = tok.replace(new RegExp(`[${L}${R}]`, "g"), "");
    if (clean === "") continue;
    if (clean.includes(L) || clean.includes(R)) return null; // ne bi smjelo ostati
    words.push(clean);
    if (marked) incorrect.push(clean);
  }
  if (incorrect.length === 0) return null;
  const payload = {
    question: typeof out.question === "string" ? out.question : "",
    explanation: typeof out.explanation === "string" ? out.explanation : "",
    text: words.join(" "),
    words,
    incorrect,
  };
  return validateAndMergeInteractive(q, payload) ? payload : null;
}

async function translateUnit(q: InteractiveQuestion, lang: Lang) {
  const type = typeof q.type === "string" ? q.type.toLowerCase() : "";
  if (type === "dragdrop") return translateDragDrop(q, lang);
  if (type === "markwords") return translateMarkWords(q, lang);
  return null;
}

// ---- main ------------------------------------------------------------------
interface Unit {
  redId: number;
  q: InteractiveQuestion;
  polje: string;
  full: string;
}

async function main() {
  if (!BASE || !KEY) throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL/API_KEY nisu postavljeni");
  const c = new Client({ connectionString: process.env.PROD_DATABASE_URL, ssl: false });
  await c.connect();

  // 1) skupi sve INLINE interaktivne jedinice iz ARRAY redova
  const { rows } = await c.query("SELECT id, pitanja FROM kvizovi ORDER BY id");
  const units: Unit[] = [];
  for (const r of rows) {
    const p = r.pitanja;
    if (!Array.isArray(p)) continue; // string-redovi (banka) su VAN scope-a
    for (const q of p) {
      if (q && typeof q === "object" && isInteractiveType(q.type)) {
        const { polje, full } = canonicalQuestionHash(q);
        units.push({ redId: r.id, q: q as InteractiveQuestion, polje, full });
      }
    }
  }
  console.log(`Jedinica (inline interaktivnih): ${units.length}`);

  // 2) postojeći prijevodi (za skip)
  const ex = await c.query(
    "SELECT red_id, polje, jezik, izvor_hash FROM content_prijevodi WHERE tabela=$1",
    [INTERACTIVE_TABLE],
  );
  const have = new Set(ex.rows.map((r: any) => `${r.red_id}|${r.polje}|${r.jezik}|${r.izvor_hash}`));

  // 3) work-items koji nedostaju
  type Work = { u: Unit; lang: Lang };
  const todo: Work[] = [];
  for (const lang of LANGS) {
    for (const u of units) {
      if (!have.has(`${u.redId}|${u.polje}|${lang}|${u.full}`)) todo.push({ u, lang });
    }
  }
  console.log(`Preostalo (svi jezici ${LANGS.join(",")}): ${todo.length}`);

  if (DRY) {
    const sample = todo.slice(0, DRY_N);
    for (const w of sample) {
      const payload = await translateUnit(w.u.q, w.lang);
      console.log(`\n--- DRY ${w.lang} red_id=${w.u.redId} type=${w.u.q.type} valid=${!!payload} ---`);
      console.log("BS :", JSON.stringify({ q: w.u.q.question, ...(w.u.q.text ? { text: w.u.q.text } : {}) }));
      console.log("OUT:", JSON.stringify(payload));
    }
    await c.end();
    return;
  }

  // 4) ograniči po LIMIT, dedup po (full|lang) za AI poziv (cache)
  const batch = todo.slice(0, LIMIT);
  const cache = new Map<string, Record<string, unknown> | null>();
  let ok = 0;
  let fail = 0;
  let idx = 0;
  const deadline = Date.now() + BUDGET_MS;

  async function worker() {
    while (idx < batch.length && Date.now() < deadline) {
      const w = batch[idx++];
      const ckey = `${w.u.full}|${w.lang}`;
      try {
        let payload = cache.get(ckey);
        if (payload === undefined) {
          payload = await translateUnit(w.u.q, w.lang);
          cache.set(ckey, payload);
        }
        if (!payload) {
          // jedan retry
          payload = await translateUnit(w.u.q, w.lang);
          cache.set(ckey, payload);
        }
        if (!payload) {
          fail++;
          console.warn(`FAIL ${w.lang} red_id=${w.u.redId} polje=${w.u.polje} type=${w.u.q.type}`);
          continue;
        }
        await c.query(
          `INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6, now())
           ON CONFLICT (tabela, red_id, polje, jezik)
           DO UPDATE SET prijevod=excluded.prijevod, izvor_hash=excluded.izvor_hash, updated_at=now()`,
          [INTERACTIVE_TABLE, w.u.redId, w.u.polje, w.lang, JSON.stringify(payload), w.u.full],
        );
        ok++;
      } catch (e) {
        fail++;
        console.warn(`ERR ${w.lang} red_id=${w.u.redId}: ${(e as Error).message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONC, batch.length) }, () => worker()));
  console.log(`\nGotovo ovog pokretanja: ok=${ok} fail=${fail} (obrađeno ${batch.length}/${todo.length})`);
  console.log(`Preostalo nakon ovog pokretanja: ~${todo.length - ok}`);
  await c.end();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
