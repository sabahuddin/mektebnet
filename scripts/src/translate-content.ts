/**
 * Faza 2 — prevodna obrada SADRŽAJA baze (ne UI; UI je scripts/translate-i18n.ts).
 *
 * Izvor je BOSANSKI sadržaj iz produkcijske baze. Skripta:
 *   1) Učita konfiguraciju prevodivih tabela/polja (TABLES).
 *   2) Pročita izvorne redove iz baze (na koju pokazuje DATABASE_URL).
 *   3) Za svako (red, polje, jezik) izračuna SHA-256 hash bosanskog izvora i
 *      uporedi sa već spremljenim u `content_prijevodi`. Prevodi SAMO ono što
 *      nedostaje ILI gdje se hash ne poklapa (izvor je izmijenjen) — inkrementalno.
 *   4) Tekstualna polja batcha (više po zahtjevu), HTML polja prevodi izolovano
 *      (čuva strukturu), pa UPSERT-uje u `content_prijevodi`. Bosanski original
 *      se NIKAD ne mijenja (samo INSERT/UPDATE u zasebnu tabelu).
 *
 * Resumable: svaki chunk/HTML upsert se odmah perzistira; ponovni pokret preskače
 * urađeno (po hashu). Bounded: --max-seconds zaustavi pokretanje novih poslova.
 *
 * Pokretanje (PROD je izvor istine — pokazi DATABASE_URL na prod):
 *   DATABASE_URL="$PROD_DATABASE_URL" pnpm --filter @workspace/scripts exec \
 *     tsx src/translate-content.ts --langs sq,de,en,tr,ar --max-seconds 100
 *   ... --tables rjecnik,pitanja_banka   (ograniči tabele)
 *   ... --tables ilmihal_lekcije --nivo 1 (samo jedan nivo Ilmihala)
 *   ... --tables ilmihal_lekcije --ids 191,192 --force (ponovi samo navedene redove)
 *   ... --types text                      (samo tekst, preskoči HTML)
 *   ... --dry                             (samo prebroji, bez OpenAI poziva)
 */
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const LANG_NAMES: Record<string, string> = {
  sq: "Albanski (shqip)",
  de: "Njemački (Deutsch)",
  en: "Engleski (English)",
  tr: "Turski (Türkçe)",
  ar: "Arapski (العربية)",
};

type FieldType = "text" | "html" | "jsonbArray" | "kvizPitanja";
interface TableCfg {
  tabela: string;
  fields: { col: string; type: FieldType }[];
}

// Prevodiva polja po tabeli (imena kolona u bazi). Ovo mora ostati usklađeno sa
// overlay konfiguracijom u api-server (lib/content-translatable.ts).
const TABLES: TableCfg[] = [
  { tabela: "ilmihal_lekcije", fields: [{ col: "naslov", type: "text" }, { col: "content_html", type: "html" }, { col: "kviz_pitanja", type: "kvizPitanja" }] },
  { tabela: "knjige", fields: [{ col: "naslov", type: "text" }, { col: "content_html", type: "html" }] },
  { tabela: "medaljoni", fields: [{ col: "naziv", type: "text" }, { col: "opis", type: "text" }, { col: "content_html", type: "html" }] },
  { tabela: "rjecnik", fields: [{ col: "rijec", type: "text" }, { col: "definicija", type: "text" }] },
  { tabela: "pitanja_banka", fields: [{ col: "pitanje", type: "text" }, { col: "opcije", type: "jsonbArray" }, { col: "objasnjenje", type: "text" }] },
  { tabela: "igra_pitanja", fields: [{ col: "pitanje", type: "text" }, { col: "opcije", type: "jsonbArray" }, { col: "objasnjenje", type: "text" }] },
  { tabela: "kvizovi", fields: [{ col: "naslov", type: "text" }, { col: "opis", type: "text" }] },
  { tabela: "misija_definicija", fields: [{ col: "naziv", type: "text" }, { col: "opis", type: "text" }] },
];

// ---- CLI ----
const args = process.argv.slice(2);
function argVal(name: string, def: string) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const LANGS = argVal("--langs", "sq,de,en,tr,ar").split(",").map((s) => s.trim()).filter((l) => l && l !== "bs");
const ONLY_TABLES = argVal("--tables", "").split(",").map((s) => s.trim()).filter(Boolean);
const ONLY_TYPES = argVal("--types", "").split(",").map((s) => s.trim()).filter(Boolean);
const ONLY_NIVO = parseInt(argVal("--nivo", "0"), 10);
const ONLY_IDS = argVal("--ids", "").split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isInteger);
const FORCE = args.includes("--force");
const DRY = args.includes("--dry");
const MODEL = argVal("--model", "gpt-5-mini");
const CHUNK = parseInt(argVal("--chunk", "30"), 10);
const CONCURRENCY = parseInt(argVal("--concurrency", "8"), 10);
const MAX_SECONDS = parseInt(argVal("--max-seconds", "0"), 10); // 0 = bez limita
const LIMIT = parseInt(argVal("--limit", "0"), 10); // max poslova ovog pokreta (0 = bez)

const startMs = Date.now();
function timeUp() {
  return MAX_SECONDS > 0 && (Date.now() - startMs) / 1000 >= MAX_SECONDS;
}
function sha(s: string) {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

const usage = { in: 0, out: 0 };

// ---- OpenAI: batch kratkih tekstova → JSON original->prijevod ----
async function callOpenAI(body: Record<string, unknown>): Promise<any> {
  if (MODEL.startsWith("gpt-5")) body.reasoning_effort = "minimal";
  let res: Response | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 150000);
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch (e) {
      // Na timeout/abort NE retry-aj (inače 6×150s zamrzne chunk); fail-fast,
      // resume (po hashu) pokupi posao u sljedećem pokretu.
      if ((e as Error).name === "AbortError") throw e;
      if (attempt < 5) { await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** attempt, 30000) + Math.random() * 1000)); continue; }
      throw e;
    } finally {
      clearTimeout(to);
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** attempt, 30000) + Math.random() * 1000));
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new Error(`OpenAI ${res?.status}: ${res ? (await res.text()).slice(0, 200) : "no response"}`);
  const data: any = await res.json();
  usage.in += data.usage?.prompt_tokens ?? 0;
  usage.out += data.usage?.completion_tokens ?? 0;
  return data;
}

const TEXT_SYS = (targetName: string) => `Ti si profesionalni prevodilac za islamsku edukativnu platformu za djecu (mekteb).
Prevedi sa BOSANSKOG na ${targetName}.
Pravila:
- Zadrži islamske/arapske termine i vlastita imena prirodno za ciljni jezik (npr. Allah, Kur'an, sura, ajet, ezan, salavat, mekteb, muallim, ilmihal, abdest); nazive sura i dova NE prevodi (npr. El-Fatiha, El-Ihlas ostaju isti).
- Za stručni islamski termin koji ima prirodan njemački ekvivalent, napiši njemački izraz pa bosanski izvorni termin u zagradi, npr. "Voraussetzung oder Bedingung (šart)". Ovo ne primjenjuj na nazive sura/dova, arapske transliteracije i vlastita imena.
- Prevedi svu običnu bosansku formulaciju, i kada je pisana velikim slovima ili je bosanski prijevod dove, ajeta ili citata. Netaknuti ostaju samo arapsko pismo i arapska transliteracija.
- Zadrži arapski tekst (ajeti, dove) NETAKNUT — ne prevodi i ne transliteriraj ga.
- Ne dodaji arapsko pismo, salavat/salam simbole ili počasne izraze koji ne postoje u izvorniku. Svaki postojeći počasni oblik (npr. "a.s.", "alejhis-selam", ﷺ ili arapski tekst) sačuvaj DOSLOVNO, bez proširivanja, zamjene ili pretvaranja u drugi oblik.
- Za njemački odgovor upotrijebi njemački za sav prevedivi tekst; ne vraćaj engleske rečenice niti miješaj engleski u njemački prijevod.
- Zadrži placeholdere u vitičastim zagradama {ovako} i HTML/markup ako postoji.
- Vrati ISKLJUČIVO validan JSON objekt oblika {"prijevodi": [...]} gdje je "prijevodi" niz prijevoda ISTE DUŽINE i ISTOG REDOSLIJEDA kao ulazni niz. Bez objašnjenja.`;

async function translateTexts(items: string[], targetName: string): Promise<Record<string, string>> {
  const data = await callOpenAI({
    model: MODEL,
    max_completion_tokens: 16384,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: TEXT_SYS(targetName) },
      {
        role: "user",
        // Mapiranje po INDEKSU (ne po echo-u originalnog ključa): neki izvorni
        // stringovi sadrže pravopisne greške ili pomiješana pisma (latinica +
        // ćirilica homoglifi), pa model "popravi" ključ i echo-key matching
        // (dict[original]) promaši → cijeli posao bi se preskočio. Tražimo niz
        // prijevoda istog redoslijeda i dužine pa zip-ujemo s našim originalima.
        content:
          `Prevedi svaki string iz ulaznog niza. Vrati JSON objekt oblika {"prijevodi": [...]} ` +
          `gdje je "prijevodi" niz prijevoda ISTE DUŽINE i ISTOG REDOSLIJEDA kao ulazni niz ` +
          `(prijevodi[i] je prijevod od ulaz[i]). Prevedi po značenju i kad izvorni tekst sadrži ` +
          `pravopisne greške ili pomiješana pisma; NE izostavljaj nijedan element.\n` +
          `Ulaz (${items.length} stringova):\n${JSON.stringify(items)}`,
      },
    ],
  });
  const rawContent = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try { parsed = JSON.parse(rawContent); } catch { return {}; }
  const out: Record<string, string> = {};
  const arr: unknown = Array.isArray(parsed) ? parsed : (parsed?.prijevodi ?? parsed?.translations ?? parsed?.prevodi);
  if (Array.isArray(arr) && arr.length === items.length) {
    items.forEach((s, i) => { if (typeof arr[i] === "string") out[s] = arr[i] as string; });
    return out;
  }
  // Fallback: stari oblik {original: prijevod} (ako model ne ispoštuje niz).
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const s of items) if (typeof parsed[s] === "string") out[s] = parsed[s];
  }
  return out;
}

const HTML_SYS = (targetName: string) => `Ti si profesionalni prevodilac za islamsku edukativnu platformu za djecu (mekteb).
Prevedi VIDLJIVI TEKST sa BOSANSKOG na ${targetName} unutar datog HTML fragmenta.
Stroga pravila:
- Vrati ISTI HTML sa istom strukturom: ne mijenjaj, ne dodaji i ne uklanjaj tagove, atribute, klase, id-eve, stilove, niti redoslijed.
- Prevedi SAMO ljudski čitljiv tekst između tagova i tekstualne atribute (alt, title, placeholder). NE diraj vrijednosti src, href, data-*, class, id, style.
- Prevedi SVAKU običnu bosansku rečenicu; ne ostavljaj vidljivi bosanski tekst nepreveden. Prije slanja odgovora provjeri da cijeli rezultat sadrži isti broj i redoslijed HTML tagova kao ulaz.
- Zadrži arapski tekst (ajeti, dove, kaligrafija) NETAKNUT — ne prevodi i ne transliteriraj ga.
- Bosanski prijevod ajeta, dove ili citata MORAŠ prevesti na njemački, čak i kada je cijeli tekst pisan velikim slovima. Netaknuti ostaju samo arapsko pismo i arapska transliteracija.
- Zadrži islamske/arapske termine i nazive sura/dova kako jesu (El-Fatiha itd.).
- Ne dodaji arapsko pismo, salavat/salam simbole ili počasne izraze koji ne postoje u izvorniku. Svaki postojeći počasni oblik (npr. "a.s.", "alejhis-selam", ﷺ ili arapski tekst) sačuvaj DOSLOVNO, bez proširivanja, zamjene ili pretvaranja u drugi oblik.
- Ako je ciljni jezik njemački, sav prevedivi tekst mora biti na njemačkom; ne vraćaj engleske rečenice niti miješaj engleski u njemački prijevod.
- Za stručni islamski termin s prirodnim njemačkim ekvivalentom koristi njemački izraz uz bosanski izvorni termin u zagradi, npr. "Voraussetzung oder Bedingung (šart)". Ne radi to za nazive sura/dova, arapske transliteracije ni vlastita imena.
- NE umotavaj odgovor u markdown (bez \`\`\`). Vrati ČISTO HTML, ništa drugo.`;

async function translateHtml(html: string, targetName: string): Promise<string> {
  // HTML ne šaljemo kao cjelinu: kod dugih lekcija model ponekad vrati samo
  // djelimično preveden sadržaj ili promijeni markup. Lokalno ga dijelimo na
  // tagove i tekstualne čvorove, pa prevodimo samo čvorove i ponovo sastavimo
  // potpuno istu strukturu.
  const parts = html.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g);
  const textIndexes: number[] = [];
  let ignoredTag: "script" | "style" | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("<")) {
      const closing = part.match(/^<\s*\/\s*(script|style)\b/i);
      const opening = part.match(/^<\s*(script|style)\b/i);
      if (closing) ignoredTag = null;
      else if (opening && !/\/\s*>$/.test(part)) ignoredTag = opening[1].toLowerCase() as "script" | "style";
      continue;
    }
    if (!ignoredTag && /[\p{L}]/u.test(part)) textIndexes.push(i);
  }

  const unique = Array.from(new Set(textIndexes.map((i) => parts[i])));
  const translations: Record<string, string> = {};
  // Duga Ilmihal lekcija sadrži mnogo odjeljaka. Manji paket sprječava da
  // prevodilac izostavi posljednje tekstualne čvorove iz odgovora.
  const batchSize = 8;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const translated = await translateTexts(batch, targetName);
    if (batch.some((source) => !translated[source]?.trim())) {
      throw new Error("nepotpun prijevod tekstualnih čvorova");
    }
    Object.assign(translations, translated);
  }

  for (const index of textIndexes) {
    const source = parts[index];
    const leading = source.match(/^\s*/)?.[0] ?? "";
    const trailing = source.match(/\s*$/)?.[0] ?? "";
    const translated = translations[source].trim();
    parts[index] = `${leading}${translated}${trailing}`;
  }
  return parts.join("");
}

function htmlTagSequence(html: string) {
  return Array.from(
    html.matchAll(/<\/?([a-zA-Z][\w-]*)\b[^>]*>/g),
    (m) => `${m[0][1] === "/" ? "/" : ""}${m[1].toLowerCase()}`,
  ).join("|");
}

function containsBosnianProse(text: string) {
  return /\b(je|su|se|i|u|na|za|od|do|da|ne|smo|sam|si|ste|ćemo|trebamo|kada|kako|koji|koja|ovo|ova|ovaj|gospodaru|slava|tebi|neka|blagoslov|mir|vjernici|roditeljima)\b/iu.test(text);
}

function hasUntranslatedBosnianNode(source: string, translation: string) {
  const sourceParts = source.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g);
  const translatedParts = translation.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g);
  if (sourceParts.length !== translatedParts.length) return true;
  return sourceParts.some((part, index) =>
    !part.startsWith("<") &&
    part.trim().length > 8 &&
    part.trim() === translatedParts[index].trim() &&
    containsBosnianProse(part),
  );
}

function hasAddedArabicHonorific(source: string, translation: string) {
  const honorifics = [
    "ﷺ",
    "عليه السلام",
    "عليه السّلام",
    "صلى الله عليه وسلم",
    "صلّى الله عليه وسلّم",
    "alejhis-selam",
    "alejhi selam",
    "sallallahu alejhi ve sellem",
  ];
  return honorifics.some((honorific) => translation.includes(honorific) && !source.includes(honorific));
}

function hasLikelyEnglishInGerman(text: string) {
  const visible = text.replace(/<[^>]*>/g, " ").toLowerCase();
  const english = visible.match(/\b(the|and|with|from|that|this|your|you|are|was|were|have|has|will|shall|for|into|about|because|when|where)\b/g)?.length ?? 0;
  const german = visible.match(/\b(der|die|das|und|mit|von|dass|dies|ihr|sie|ist|war|haben|hat|wird|für|in|über|weil|wenn|wo)\b/g)?.length ?? 0;
  return english >= 5 && english > german * 1.5;
}

function textTranslationIssue(source: string, translation: string, jezik: string) {
  if (!translation?.trim()) return "prazan prijevod";
  if (hasAddedArabicHonorific(source, translation)) return "dodan je počasni oblik koji nije u izvorniku";
  if (jezik === "de" && hasLikelyEnglishInGerman(translation)) return "njemački prijevod sadrži previše engleskog teksta";
  return null;
}

function htmlTranslationIssue(source: string, translation: string, jezik: string) {
  if (!translation || translation.length < Math.min(20, source.length / 4)) return "prekratak odgovor";
  if (htmlTagSequence(source) !== htmlTagSequence(translation)) return "izmijenjena HTML struktura";
  if (textTranslationIssue(source, translation, jezik)) return textTranslationIssue(source, translation, jezik);
  if (hasUntranslatedBosnianNode(source, translation)) return "ostao je nepreveden bosanski tekst";
  return null;
}

// ---- UPSERT ----
async function upsert(tabela: string, redId: number, polje: string, jezik: string, prijevod: string, izvorHash: string) {
  await db.execute(sql`
    INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash, updated_at)
    VALUES (${tabela}, ${redId}, ${polje}, ${jezik}, ${prijevod}, ${izvorHash}, now())
    ON CONFLICT (tabela, red_id, polje, jezik)
    DO UPDATE SET prijevod = EXCLUDED.prijevod, izvor_hash = EXCLUDED.izvor_hash, updated_at = now();
  `);
}

interface TextJob { tabela: string; redId: number; polje: string; jezik: string; type: "text" | "jsonbArray" | "kvizPitanja"; strings: string[]; hash: string; arr?: any[]; }
interface HtmlJob { tabela: string; redId: number; polje: string; jezik: string; html: string; hash: string; }

async function run() {
  if (!DRY && (!BASE_URL || !API_KEY)) {
    console.error("Nedostaju AI_INTEGRATIONS_OPENAI_BASE_URL / _API_KEY u okruženju.");
    process.exit(1);
  }
  const tables = TABLES.filter((t) => ONLY_TABLES.length === 0 || ONLY_TABLES.includes(t.tabela));
  console.log(`Model: ${MODEL} | jezici: ${LANGS.join(",")} | tabele: ${tables.map((t) => t.tabela).join(",")} | chunk: ${CHUNK} | concurrency: ${CONCURRENCY}${MAX_SECONDS ? ` | max ${MAX_SECONDS}s` : ""}${DRY ? " | DRY" : ""}`);

  // Postojeći prijevodi: ključ "tabela|red|polje|jezik" -> izvor_hash
  const existing = new Map<string, string>();
  {
    // Skupi samo prijevode za tabele iz --tables (kad je filter zadat) — inače
    // bi se na svakom pokretu učitavalo desetine hiljada redova preko mreže.
    const where = ONLY_TABLES.length
      ? ` WHERE tabela IN (${ONLY_TABLES.map((t) => `'${t.replace(/'/g, "''")}'`).join(", ")})`
      : "";
    const r = (await db.execute(sql.raw(`SELECT tabela, red_id, polje, jezik, izvor_hash FROM content_prijevodi${where}`))) as unknown as { rows: any[] };
    for (const row of r.rows) existing.set(`${row.tabela}|${row.red_id}|${row.polje}|${row.jezik}`, row.izvor_hash);
  }

  const textJobs: TextJob[] = [];
  const htmlJobs: HtmlJob[] = [];

  for (const t of tables) {
    const cols = t.fields.map((f) => f.col);
    const filters: string[] = [];
    if (t.tabela === "ilmihal_lekcije" && ONLY_NIVO > 0) filters.push(`nivo = ${ONLY_NIVO}`);
    if (ONLY_IDS.length) filters.push(`id IN (${ONLY_IDS.join(", ")})`);
    const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
    const r = (await db.execute(sql.raw(`SELECT id, ${cols.join(", ")} FROM ${t.tabela}${where}`))) as unknown as { rows: any[] };
    for (const row of r.rows) {
      const redId = row.id as number;
      for (const f of t.fields) {
        if (ONLY_TYPES.length && !ONLY_TYPES.includes(f.type)) continue;
        const raw = row[f.col];
        let srcStr: string;
        let strings: string[] = [];
        let objArr: any[] | undefined;
        if (f.type === "kvizPitanja") {
          // Niz objekata {question, options[], answer}. Skupi sve prevodive
          // stringove (pitanje + opcije + tačan odgovor). Tačan odgovor je
          // jednak jednoj od opcija pa kroz isti dict ostaje usklađen → FE
          // poredi `selected === answer` po tekstu (opcije su izmiješane).
          // Neki redovi imaju kviz_pitanja kao dvostruko-enkodiran JSON string
          // (jsonb scalar). Ovdje čitamo preko raw SQL (db.execute) koji NE
          // provlači vrijednost kroz drizzle jsonb mapiranje (serving putanja to
          // radi automatski), pa takvi redovi stignu kao string — JSON.parse-amo.
          let arr: any[] = [];
          if (Array.isArray(raw)) arr = raw;
          else if (typeof raw === "string" && raw.trim()) {
            try { const p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } catch { /* nije validan niz — preskoči */ }
          }
          const collected: string[] = [];
          for (const item of arr) {
            if (item && typeof item.question === "string" && item.question.trim()) collected.push(item.question);
            if (Array.isArray(item?.options)) for (const o of item.options) if (typeof o === "string" && o.trim()) collected.push(o);
            if (typeof item?.answer === "string" && item.answer.trim()) collected.push(item.answer);
          }
          strings = Array.from(new Set(collected));
          if (strings.length === 0) continue;
          objArr = arr;
          srcStr = JSON.stringify(arr);
        } else if (f.type === "jsonbArray") {
          const arr: unknown[] = Array.isArray(raw) ? raw : [];
          strings = arr.filter((x): x is string => typeof x === "string" && x.trim() !== "");
          if (strings.length === 0) continue;
          srcStr = JSON.stringify(arr);
        } else {
          if (raw == null || String(raw).trim() === "") continue;
          srcStr = String(raw);
          strings = [srcStr];
        }
        const hash = sha(srcStr);
        for (const jezik of LANGS) {
          const key = `${t.tabela}|${redId}|${f.col}|${jezik}`;
          if (!FORCE && existing.get(key) === hash) continue; // već prevedeno, izvor nepromijenjen
          if (f.type === "html") htmlJobs.push({ tabela: t.tabela, redId, polje: f.col, jezik, html: srcStr, hash });
          else textJobs.push({ tabela: t.tabela, redId, polje: f.col, jezik, type: f.type, strings, hash, arr: objArr });
        }
      }
    }
  }

  console.log(`Poslova: tekst=${textJobs.length} | html=${htmlJobs.length}`);
  if (DRY) {
    const totalChars = [...textJobs.flatMap((j) => j.strings), ...htmlJobs.map((j) => j.html)].reduce((a, s) => a + s.length, 0);
    console.log(`Procjena znakova za prijevod ovog pokreta: ~${totalChars.toLocaleString()} (≈${Math.round(totalChars / 4).toLocaleString()} tokena ulaza)`);
    return;
  }

  let failed = 0;
  let doneJobs = 0;
  const limited = <T,>(arr: T[]) => (LIMIT > 0 ? arr.slice(0, LIMIT) : arr);

  // ---- TEKST: grupiši po jeziku pa chunkaj poslove ----
  const byLang = new Map<string, TextJob[]>();
  for (const j of limited(textJobs)) (byLang.get(j.jezik) ?? byLang.set(j.jezik, []).get(j.jezik)!).push(j);

  for (const [jezik, jobs] of byLang) {
    if (timeUp()) break;
    const chunks: TextJob[][] = [];
    for (let i = 0; i < jobs.length; i += CHUNK) chunks.push(jobs.slice(i, i + CHUNK));
    let ci = 0;
    async function worker() {
      while (ci < chunks.length && !timeUp()) {
        const chunk = chunks[ci++];
        const uniq = Array.from(new Set(chunk.flatMap((j) => j.strings)));
        try {
          const dict = await translateTexts(uniq, LANG_NAMES[jezik]);
          for (const j of chunk) {
            if (j.type === "kvizPitanja") {
              // Svi stringovi moraju biti prevedeni, inače preskoči (retry idući
              // pokret) — pola-prevedeni kviz bi razbio poklapanje odgovora.
              if (j.strings.some((s) => typeof dict[s] !== "string" || textTranslationIssue(s, dict[s], jezik))) {
                failed++;
                console.error(`  [${jezik}] ${j.tabela}#${j.redId}/${j.polje}: neispravan tekstualni prijevod — preskačem`);
                continue;
              }
              const rebuilt = (j.arr ?? []).map((item: any) => ({
                ...item,
                question: typeof item?.question === "string" ? (dict[item.question] ?? item.question) : item?.question,
                options: Array.isArray(item?.options) ? item.options.map((o: string) => (typeof o === "string" ? (dict[o] ?? o) : o)) : item?.options,
                answer: typeof item?.answer === "string" ? (dict[item.answer] ?? item.answer) : item?.answer,
              }));
              await upsert(j.tabela, j.redId, j.polje, j.jezik, JSON.stringify(rebuilt), j.hash);
              doneJobs++;
              continue;
            }
            const parts = j.strings.map((s) => dict[s]);
            if (parts.some((p, index) => typeof p !== "string" || textTranslationIssue(j.strings[index], p, jezik))) {
              failed++;
              console.error(`  [${jezik}] ${j.tabela}#${j.redId}/${j.polje}: neispravan tekstualni prijevod — preskačem`);
              continue;
            }
            const prijevod = j.type === "jsonbArray" ? JSON.stringify(parts) : (parts[0] as string);
            await upsert(j.tabela, j.redId, j.polje, j.jezik, prijevod, j.hash);
            doneJobs++;
          }
        } catch (e) {
          failed += chunk.length;
          console.error(`  [${jezik}] tekst chunk greška: ${(e as Error).message.slice(0, 140)}`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker()));
    console.log(`  [${jezik}] tekst gotovo (ukupno upsertano ovog pokreta: ${doneJobs})`);
  }

  // ---- HTML: izolovano po poslu ----
  if (!timeUp() && (ONLY_TYPES.length === 0 || ONLY_TYPES.includes("html"))) {
    const hjobs = limited(htmlJobs);
    let hi = 0;
    async function htmlWorker() {
      while (hi < hjobs.length && !timeUp()) {
        const j = hjobs[hi++];
        try {
          let tr = await translateHtml(j.html, LANG_NAMES[j.jezik]);
          let issue = htmlTranslationIssue(j.html, tr, j.jezik);
          if (issue) {
            tr = await translateHtml(j.html, LANG_NAMES[j.jezik]);
            issue = htmlTranslationIssue(j.html, tr, j.jezik);
          }
          if (issue) { failed++; console.error(`  [${j.jezik}] html ${j.tabela}#${j.redId} nije prošao provjeru: ${issue} — preskačem`); continue; }
          await upsert(j.tabela, j.redId, j.polje, j.jezik, tr, j.hash);
          doneJobs++;
          if (doneJobs % 10 === 0) console.log(`  napredak (html): ${doneJobs} upsertano | ${hi}/${hjobs.length}`);
        } catch (e) {
          failed++;
          console.error(`  [${j.jezik}] html ${j.tabela}#${j.redId} greška: ${(e as Error).message.slice(0, 140)}`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hjobs.length) }, () => htmlWorker()));
  }

  const cost = (usage.in / 1e6) * 0.25 + (usage.out / 1e6) * 2;
  console.log(`\nUpsertano: ${doneJobs} | neuspjelo: ${failed}${timeUp() ? " | (zaustavljeno na vremenskom limitu)" : ""}`);
  console.log(`Tokeni: ulaz=${usage.in} izlaz=${usage.out} | ~$${cost.toFixed(4)} (gruba procjena)`);
  if (failed > 0 || timeUp()) {
    console.error(`Pokreni skriptu ponovo (idempotentna je) da popuni ostatak.`);
    process.exitCode = 2;
  }
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => { console.error(e); process.exit(1); });
