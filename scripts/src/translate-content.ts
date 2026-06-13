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
const DRY = args.includes("--dry");
const MODEL = argVal("--model", "gpt-5-nano");
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
  const data = await res.json();
  usage.in += data.usage?.prompt_tokens ?? 0;
  usage.out += data.usage?.completion_tokens ?? 0;
  return data;
}

const TEXT_SYS = (targetName: string) => `Ti si profesionalni prevodilac za islamsku edukativnu platformu za djecu (mekteb).
Prevedi sa BOSANSKOG na ${targetName}.
Pravila:
- Zadrži islamske/arapske termine i vlastita imena prirodno za ciljni jezik (npr. Allah, Kur'an, sura, ajet, ezan, salavat, mekteb, muallim, ilmihal, abdest); nazive sura i dova NE prevodi (npr. El-Fatiha, El-Ihlas ostaju isti).
- Zadrži arapski tekst (ajeti, dove) NETAKNUT — ne prevodi i ne transliteriraj ga.
- Zadrži placeholdere u vitičastim zagradama {ovako} i HTML/markup ako postoji.
- Vrati ISKLJUČIVO validan JSON objekt: ključ = originalni bosanski tekst, vrijednost = prijevod. Bez objašnjenja.`;

async function translateTexts(items: string[], targetName: string): Promise<Record<string, string>> {
  const data = await callOpenAI({
    model: MODEL,
    max_completion_tokens: 16384,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: TEXT_SYS(targetName) },
      { role: "user", content: `Prevedi svaki string iz ovog JSON niza i vrati JSON objekt original->prijevod:\n${JSON.stringify(items)}` },
    ],
  });
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

const HTML_SYS = (targetName: string) => `Ti si profesionalni prevodilac za islamsku edukativnu platformu za djecu (mekteb).
Prevedi VIDLJIVI TEKST sa BOSANSKOG na ${targetName} unutar datog HTML fragmenta.
Stroga pravila:
- Vrati ISTI HTML sa istom strukturom: ne mijenjaj, ne dodaji i ne uklanjaj tagove, atribute, klase, id-eve, stilove, niti redoslijed.
- Prevedi SAMO ljudski čitljiv tekst između tagova i tekstualne atribute (alt, title, placeholder). NE diraj vrijednosti src, href, data-*, class, id, style.
- Zadrži arapski tekst (ajeti, dove, kaligrafija) NETAKNUT — ne prevodi i ne transliteriraj ga.
- Zadrži islamske/arapske termine i nazive sura/dova kako jesu (El-Fatiha itd.).
- NE umotavaj odgovor u markdown (bez \`\`\`). Vrati ČISTO HTML, ništa drugo.`;

async function translateHtml(html: string, targetName: string): Promise<string> {
  const data = await callOpenAI({
    model: MODEL,
    max_completion_tokens: 32768,
    messages: [
      { role: "system", content: HTML_SYS(targetName) },
      { role: "user", content: html },
    ],
  });
  let out: string = data.choices?.[0]?.message?.content ?? "";
  out = out.trim().replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return out;
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
    const r = (await db.execute(sql`SELECT tabela, red_id, polje, jezik, izvor_hash FROM content_prijevodi`)) as unknown as { rows: any[] };
    for (const row of r.rows) existing.set(`${row.tabela}|${row.red_id}|${row.polje}|${row.jezik}`, row.izvor_hash);
  }

  const textJobs: TextJob[] = [];
  const htmlJobs: HtmlJob[] = [];

  for (const t of tables) {
    const cols = t.fields.map((f) => f.col);
    const r = (await db.execute(sql.raw(`SELECT id, ${cols.join(", ")} FROM ${t.tabela}`))) as unknown as { rows: any[] };
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
          const arr: any[] = Array.isArray(raw) ? raw : [];
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
          if (existing.get(key) === hash) continue; // već prevedeno, izvor nepromijenjen
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
              if (j.strings.some((s) => typeof dict[s] !== "string" || dict[s] === "")) { failed++; continue; }
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
            if (parts.some((p) => typeof p !== "string" || p === "")) { failed++; continue; }
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
          const tr = await translateHtml(j.html, LANG_NAMES[j.jezik]);
          if (!tr || tr.length < Math.min(20, j.html.length / 4)) { failed++; console.error(`  [${j.jezik}] html ${j.tabela}#${j.redId} sumnjivo kratko — preskačem`); continue; }
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
