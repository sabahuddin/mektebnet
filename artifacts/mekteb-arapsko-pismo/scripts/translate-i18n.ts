/**
 * Prevodni pipeline za interfejs (i18n).
 *
 * Izvor je BOSANSKI. Skripta:
 *   1) Spljošti `translations.bs` u dotted ključeve (npr. "nav.pocetna" -> "Početna").
 *   2) Skenira src/ za t("...") / t('...') pozive i skupi IZVORNE tekstove
 *      (one koji nisu dotted ključevi).
 *   3) Za svaki ciljni jezik prevede SAMO ono što nedostaje (idempotentno)
 *      preko OpenAI proxyja i upiše u src/locales/<lang>.json.
 *
 * Pokretanje:
 *   pnpm --filter @workspace/mekteb-arapsko-pismo exec tsx scripts/translate-i18n.ts --langs sq,de,en
 *   ... --only-structured   (samo dotted ključevi, npr. za prvi sq)
 *   ... --dry               (samo prebroji, bez OpenAI poziva)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { translations, LANG_NAMES, type Lang } from "../src/lib/i18n.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const LOCALES = join(SRC, "locales");

const BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

// ---- CLI ----
const args = process.argv.slice(2);
function argVal(name: string, def: string) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const LANGS = argVal("--langs", "sq,de,en").split(",").map((s) => s.trim()) as Lang[];
const ONLY_STRUCTURED = args.includes("--only-structured");
const DRY = args.includes("--dry");
const MODEL = argVal("--model", "gpt-5-nano");
const CHUNK = parseInt(argVal("--chunk", "40"), 10);
const CONCURRENCY = parseInt(argVal("--concurrency", "10"), 10);

// ---- 1) spljošti bs strukturu ----
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}
const bsStructured = flatten(translations.bs as Record<string, unknown>);

// ---- 2) skeniraj src za t("...") izvorne tekstove ----
function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "locales") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(p);
  }
  return acc;
}
const DOTTED = /^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/;
const T_CALL = /\bt\(\s*(["'`])((?:\\.|(?!\1).)*?)\1/g;
const sourceStrings = new Set<string>();
if (!ONLY_STRUCTURED) {
  for (const file of walk(SRC)) {
    const code = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    while ((m = T_CALL.exec(code))) {
      const raw = m[2].replace(/\\(["'`])/g, "$1");
      if (!raw || DOTTED.test(raw)) continue; // dotted ključevi se rješavaju kroz strukturu
      sourceStrings.add(raw);
    }
  }
}

// ---- helper: OpenAI batch prijevod ----
async function translateBatch(items: string[], targetName: string): Promise<Record<string, string>> {
  const sys = `Ti si profesionalni prevodilac za islamsku edukativnu platformu za djecu (mekteb).
Prevedi sa BOSANSKOG na ${targetName}.
Pravila:
- Zadrži tačno sve placeholdere u vitičastim zagradama, npr. {name}, {broj} — NE prevodi ih.
- Zadrži islamske/arapske termine i vlastita imena (npr. Allah, Kur'an, ezan, salavat, mekteb, muallim, ilmihal, sura, ajet) prirodno za ciljni jezik; ne izmišljaj.
- Zadrži interpunkciju, velika/mala slova i HTML/markup ako postoji.
- Vrati ISKLJUČIVO validan JSON objekt: ključ = originalni bosanski tekst, vrijednost = prijevod. Bez objašnjenja.`;
  const user = JSON.stringify(items);
  const body: Record<string, unknown> = {
    model: MODEL,
    max_completion_tokens: 16384,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `Prevedi svaki string iz ovog JSON niza i vrati JSON objekt original->prijevod:\n${user}` },
    ],
  };
  if (MODEL.startsWith("gpt-5")) body.reasoning_effort = "minimal";
  let res: Response | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      // mrežna greška (socket/DNS/reset) — retry s backoffom kao i za 429/5xx
      if (attempt < 5) {
        const wait = Math.min(2000 * 2 ** attempt, 30000) + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = Math.min(2000 * 2 ** attempt, 30000) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new Error(`OpenAI ${res?.status}: ${res ? await res.text() : "no response"}`);
  const data = await res.json();
  usage.in += data.usage?.prompt_tokens ?? 0;
  usage.out += data.usage?.completion_tokens ?? 0;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

const usage = { in: 0, out: 0 };

type Job = { lang: Lang; keys: string[]; srcTexts: string[] };

async function run() {
  console.log(`Model: ${MODEL} | jezici: ${LANGS.join(",")} | konkurentnost: ${CONCURRENCY} | chunk: ${CHUNK} | structured: ${Object.keys(bsStructured).length} | source: ${sourceStrings.size}${DRY ? " | DRY" : ""}`);

  const dicts: Record<string, Record<string, string>> = {};
  const paths: Record<string, string> = {};
  const jobs: Job[] = [];

  for (const lang of LANGS) {
    if (lang === "bs") continue;
    const path = join(LOCALES, `${lang}.json`);
    const existing: Record<string, string> = existsSync(path) ? JSON.parse(readFileSync(path, "utf8") || "{}") : {};
    dicts[lang] = existing;
    paths[lang] = path;

    // sq: i strukturni dotted ključevi (de/en/tr/ar ih već imaju u i18n.ts).
    const needStructured = lang === "sq";
    const wanted: Record<string, string> = {};
    if (needStructured) for (const [k, v] of Object.entries(bsStructured)) wanted[k] = v;
    for (const s of sourceStrings) wanted[s] = s;

    const missing = Object.entries(wanted).filter(([k]) => !existing[k]);
    console.log(`[${lang}] već: ${Object.keys(existing).length} | nedostaje: ${missing.length}`);
    if (DRY || missing.length === 0) continue;

    for (let i = 0; i < missing.length; i += CHUNK) {
      const slice = missing.slice(i, i + CHUNK);
      jobs.push({ lang, keys: slice.map(([k]) => k), srcTexts: slice.map(([, v]) => v) });
    }
  }

  if (DRY || jobs.length === 0) {
    const cost0 = (usage.in / 1e6) * 0.25 + (usage.out / 1e6) * 2;
    console.log(`\nTokeni: ulaz=${usage.in} izlaz=${usage.out} | ~$${cost0.toFixed(4)} (gruba procjena)`);
    return;
  }

  // pool konkurentnih radnika; piši na disk nakon svakog završenog chunka (resumable)
  let done = 0;
  let next = 0;
  let failed = 0;
  const total = jobs.length;
  const dirty = new Set<Lang>();
  let writeTimer: NodeJS.Timeout | null = null;
  function scheduleWrite() {
    if (writeTimer) return;
    writeTimer = setTimeout(() => {
      for (const lang of dirty) writeFileSync(paths[lang], JSON.stringify(dicts[lang], null, 2) + "\n");
      dirty.clear();
      writeTimer = null;
    }, 500);
  }

  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        const translated = await translateBatch(job.srcTexts, LANG_NAMES[job.lang]);
        const byNorm: Record<string, string> = {};
        for (const [rk, rv] of Object.entries(translated)) {
          if (typeof rv === "string") byNorm[rk.trim().replace(/\s+/g, " ")] = rv;
        }
        let filled = 0;
        job.keys.forEach((k, idx) => {
          const src = job.srcTexts[idx];
          let tr: string | undefined = translated[src];
          if (tr === undefined) {
            const norm = byNorm[src.trim().replace(/\s+/g, " ")];
            if (norm !== undefined) {
              const lead = src.match(/^\s*/)?.[0] ?? "";
              const trail = src.match(/\s*$/)?.[0] ?? "";
              tr = lead + norm.trim() + trail;
            }
          }
          if (tr) { dicts[job.lang][k] = tr; filled++; }
        });
        dirty.add(job.lang);
        scheduleWrite();
        // parcijalan odgovor (model nije vratio sve ključeve) — označi kao neuspjeh
        if (filled < job.keys.length) {
          failed++;
          console.error(`  [${job.lang}] parcijalno: ${filled}/${job.keys.length} ključeva — re-run će popuniti ostatak`);
        }
      } catch (e) {
        failed++;
        console.error(`  [${job.lang}] chunk greška: ${(e as Error).message.slice(0, 120)}`);
      }
      done++;
      if (done % 5 === 0 || done === total) console.log(`  napredak: ${done}/${total} chunkova`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker()));
  // finalni flush
  if (writeTimer) clearTimeout(writeTimer);
  for (const lang of LANGS) if (lang !== "bs" && dicts[lang]) writeFileSync(paths[lang], JSON.stringify(dicts[lang], null, 2) + "\n");

  const inK = usage.in / 1000, outK = usage.out / 1000;
  // gruba procjena (gpt-5 red veličine): $0.25/1M in, $2/1M out
  const cost = (usage.in / 1e6) * 0.25 + (usage.out / 1e6) * 2;
  console.log(`\nTokeni: ulaz=${usage.in} izlaz=${usage.out} (${inK.toFixed(1)}k/${outK.toFixed(1)}k) | ~$${cost.toFixed(4)} (gruba procjena)`);
  if (failed > 0) {
    console.error(`\nUPOZORENJE: ${failed} chunkova nije uspjelo — pokreni skriptu ponovo (idempotentna je) da popuni ostatak.`);
    process.exitCode = 2;
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
