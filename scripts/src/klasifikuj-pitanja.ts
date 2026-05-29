/**
 * Klasifikacija SVIH pitanja u banci po NPP 2018 hijerarhiji:
 *   - 5 glavnih kategorija: akaid, ibadet, ahlak, historija, bosna
 *   - 32 taga (pod-teme) — svaki tag pripada tačno jednoj kategoriji
 *
 * Koristi Anthropic (preko Replit AI Integrations proxy-ja, env vars
 * AI_INTEGRATIONS_ANTHROPIC_BASE_URL/_API_KEY). Obrađuje pitanja u
 * batch-evima i za svako vraća { kategorija, tagovi[] }.
 *
 * Idempotentno i resumable: može se pokrenuti više puta.
 *   - Po defaultu obrađuje SAMO pitanja koja još nemaju tagove
 *     (jsonb_array_length(tagovi)=0) — pokriva i NULL-kategoriju i pitanja
 *     s kategorijom ali bez tagova. Tako se posao može nastaviti u navratima.
 *   - ONLY_NULL=1 → samo pitanja bez kategorije.
 *   - ALL=1       → re-klasifikuje SVA pitanja od nule.
 *   - MAX=N       → ograniči na N redova (korisno za chunk/test).
 *
 * Pokretanje:
 *   pnpm --filter @workspace/scripts exec tsx ./src/klasifikuj-pitanja.ts
 */
import { appendFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { pitanjaBankaTable, KVIZ_KATEGORIJE, KVIZ_TAGOVI, KVIZ_TAG_KATEGORIJA_MAP } from "@workspace/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

const LOGFILE = process.env["LOGFILE"] || "/tmp/klasifikuj.log";
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { appendFileSync(LOGFILE, line + "\n"); } catch { /* ignore */ }
  console.log(line);
}

const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
if (!baseURL || !apiKey) {
  throw new Error("Nedostaju AI_INTEGRATIONS_ANTHROPIC_* env vars. Pokreni setup integracije.");
}

const anthropic = new Anthropic({ baseURL, apiKey, timeout: 90000, maxRetries: 0 });
const MODEL = "claude-sonnet-4-6";
const BATCH = 20;
const CONCURRENCY = 3;
const ONLY_NULL = process.env["ONLY_NULL"] === "1";

const VALID_KAT = new Set<string>(KVIZ_KATEGORIJE as readonly string[]);
const VALID_TAG = new Set<string>(KVIZ_TAGOVI as readonly string[]);

// Tagovi grupisani po kategoriji — za prompt i validaciju.
const TAGOVI_PO_KAT: Record<string, string[]> = {};
for (const t of KVIZ_TAGOVI) {
  const k = KVIZ_TAG_KATEGORIJA_MAP[t];
  (TAGOVI_PO_KAT[k] ||= []).push(t);
}

type Row = {
  id: number;
  pitanje: string;
  opcije: string[] | null;
  meta: any;
  objasnjenje: string | null;
};

function pitanjeTekst(r: Row): string {
  const parts: string[] = [`PITANJE: ${r.pitanje}`];
  if (r.opcije && r.opcije.length) parts.push(`OPCIJE: ${r.opcije.join(" | ")}`);
  if (r.meta) {
    if (Array.isArray(r.meta.words) && r.meta.words.length) parts.push(`RIJEČI: ${r.meta.words.join(" | ")}`);
    if (Array.isArray(r.meta.correct) && r.meta.correct.length) parts.push(`TAČNO: ${r.meta.correct.join(" | ")}`);
    if (typeof r.meta.text === "string" && r.meta.text) parts.push(`TEKST: ${r.meta.text}`);
  }
  if (r.objasnjenje) parts.push(`OBJAŠNJENJE: ${r.objasnjenje}`);
  return parts.join("\n").slice(0, 1200);
}

const KAT_OPIS = `
- akaid    = vjerovanje/iman: Allah, meleki, kitabi (knjige), pejgamberi (poslanici/vjerovanje u njih), ahiret/Sudnji dan, kader, Kur'an kao knjiga, sure i ajeti.
- ibadet   = praksa/obredi: namaz, abdest/gusul/tejemmum, post/ramazan, zekat/sadekatul-fitr, hadž/umra, dove, zikr/tesbih, halal-haram propisi.
- ahlak    = lijepo ponašanje i moral: bonton, navike, ljubaznost, poštenje/iskrenost, srdačnost, pomaganje, odnos prema roditeljima/komšijama, mahane (zavist, laž).
- historija = historija islama: život Poslanika ﷺ (sira), ashabi, halife, osvajanja, islamska civilizacija/kultura/nauka kroz historiju (van Bosne).
- bosna    = Bosna i naša baština: bosanski učenjaci, džamije u BiH (Gazi Husrev-beg...), bh. tradicije/običaji, ilahije/kaside, mektebi/medrese u BiH, dijaspora.
`.trim();

function tagListPrompt(): string {
  return KVIZ_KATEGORIJE.map(k => `  ${k}: ${TAGOVI_PO_KAT[k].join(", ")}`).join("\n");
}

const SYSTEM = `Ti si stručnjak za islamsku edukaciju (NPP 2018, Islamska zajednica BiH). Klasifikuješ kviz pitanja za mekteb.

Svako pitanje svrstaj u TAČNO JEDNU od 5 glavnih kategorija:
${KAT_OPIS}

Zatim dodijeli 1-3 TAGA (pod-teme) koji MORAJU pripadati izabranoj kategoriji. Validni tagovi po kategoriji:
${tagListPrompt()}

Pravila:
- "kategorija" mora biti jedna od: ${KVIZ_KATEGORIJE.join(", ")}.
- "tagovi" je niz od 1 do 3 stringa, SAMO iz liste tagova izabrane kategorije.
- Ako pitanje spominje Bosnu/bh. ustanove/učenjake/tradicije → kategorija "bosna".
- Pitanja o surama/ajetima/Kur'anu kao tekstu → akaid (tagovi: kuran/sure).
- Generička pitanja ("Dopuni:", "Pronađi greške:") klasifikuj po SADRŽAJU opcija/riječi.
- Vrati ISKLJUČIVO validan JSON, bez markdown ograda.`;

async function klasifikujBatch(rows: Row[]): Promise<Map<number, { kategorija: string; tagovi: string[] }>> {
  const lines = rows.map(r => `### ID ${r.id}\n${pitanjeTekst(r)}`).join("\n\n");
  const userMsg = `Klasifikuj sljedeća pitanja. Vrati JSON niz objekata oblika {"id": number, "kategorija": string, "tagovi": string[]} — po jedan za svaki ID.\n\n${lines}`;

  let lastErr: any;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      });
      const block = msg.content[0];
      const text = block && block.type === "text" ? block.text : "";
      const jsonStr = extractJson(text);
      const parsed = JSON.parse(jsonStr) as Array<{ id: number; kategorija: string; tagovi: string[] }>;
      const out = new Map<number, { kategorija: string; tagovi: string[] }>();
      for (const p of parsed) {
        const kat = String(p.kategorija || "").trim();
        if (!VALID_KAT.has(kat)) continue;
        const allowed = new Set(TAGOVI_PO_KAT[kat]);
        const tagovi = Array.isArray(p.tagovi)
          ? [...new Set(p.tagovi.map(t => String(t).trim()).filter(t => VALID_TAG.has(t) && allowed.has(t)))].slice(0, 3)
          : [];
        // Zahtjev: svako pitanje mora dobiti 1–3 valjana taga. Ako model nije
        // vratio nijedan valjan tag, ne upisujemo — ostavljamo ID za retry.
        if (tagovi.length < 1) continue;
        out.set(Number(p.id), { kategorija: kat, tagovi });
      }
      return out;
    } catch (err: any) {
      lastErr = err;
      const wait = Math.min(2000 * 2 ** attempt, 20000);
      log(`  ⚠️  batch greška (pokušaj ${attempt + 1}): ${err?.message || err}. Čekam ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function extractJson(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) return t.slice(start, end + 1);
  return t;
}

async function run() {
  log(`📋 Klasifikacija pitanja (model=${MODEL}, batch=${BATCH}, concurrency=${CONCURRENCY}, ONLY_NULL=${ONLY_NULL})`);

  // Default: obrađuj samo pitanja koja JOŠ NEMAJU tagove — tako je skripta
  // resumable (može se zvati u više navrata) i pokriva i NULL-kategoriju i
  // pitanja koja imaju kategoriju ali nemaju tagove.
  // ONLY_NULL=1 → samo pitanja bez kategorije.
  // ALL=1       → sva pitanja (re-klasifikacija od nule).
  const where = process.env["ALL"] === "1"
    ? undefined
    : ONLY_NULL
      ? isNull(pitanjaBankaTable.kategorija)
      : sql`jsonb_array_length(${pitanjaBankaTable.tagovi}) = 0`;
  const maxRows = process.env["MAX"] ? parseInt(process.env["MAX"]) : undefined;
  let rows = (await db
    .select({
      id: pitanjaBankaTable.id,
      pitanje: pitanjaBankaTable.pitanje,
      opcije: pitanjaBankaTable.opcije,
      meta: pitanjaBankaTable.meta,
      objasnjenje: pitanjaBankaTable.objasnjenje,
    })
    .from(pitanjaBankaTable)
    .where(where as any)) as Row[];
  if (maxRows) rows = rows.slice(0, maxRows);

  log(`🔎 Za klasifikaciju: ${rows.length} pitanja`);
  if (rows.length === 0) return true;

  const batches: Row[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));

  let done = 0;
  let updated = 0;
  let failedIds: number[] = [];

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async b => {
        try {
          return { b, res: await klasifikujBatch(b) };
        } catch (err: any) {
          log(`  ❌ batch trajno pao: ${err?.message || err}`);
          return { b, res: new Map<number, { kategorija: string; tagovi: string[] }>() };
        }
      })
    );

    for (const { b, res } of results) {
      for (const r of b) {
        const got = res.get(r.id);
        if (!got) { failedIds.push(r.id); continue; }
        await db
          .update(pitanjaBankaTable)
          .set({ kategorija: got.kategorija, tagovi: got.tagovi, updatedAt: new Date() })
          .where(eq(pitanjaBankaTable.id, r.id));
        updated++;
      }
      done += b.length;
    }
    log(`  … obrađeno ${done}/${rows.length} (ažurirano ${updated}, neuspjeli ${failedIds.length})`);
  }

  // Retry neuspjelih pojedinačno (manji batch).
  if (failedIds.length) {
    log(`🔁 Retry ${failedIds.length} neuspjelih pitanja...`);
    const retryRows = rows.filter(r => failedIds.includes(r.id));
    failedIds = [];
    for (let i = 0; i < retryRows.length; i += 10) {
      const b = retryRows.slice(i, i + 10);
      const res = await klasifikujBatch(b).catch(() => new Map());
      for (const r of b) {
        const got = res.get(r.id);
        if (!got) { failedIds.push(r.id); continue; }
        await db
          .update(pitanjaBankaTable)
          .set({ kategorija: got.kategorija, tagovi: got.tagovi, updatedAt: new Date() })
          .where(eq(pitanjaBankaTable.id, r.id));
        updated++;
      }
    }
  }

  log(`✅ Ažurirano: ${updated} | Neuspjelo: ${failedIds.length}`);
  if (failedIds.length) log(`   Neuspjeli ID-jevi: ${failedIds.join(", ")}`);

  // Verifikacija.
  const dist = await db
    .select({ kategorija: pitanjaBankaTable.kategorija, broj: sql<number>`count(*)::int` })
    .from(pitanjaBankaTable)
    .groupBy(pitanjaBankaTable.kategorija);
  log(`📊 Distribucija po kategorijama:`);
  for (const d of dist) log(`   ${d.kategorija ?? "(NULL)"}: ${d.broj}`);

  const [{ bezTagova, bezKat }] = await db
    .select({
      bezTagova: sql<number>`count(*) FILTER (WHERE jsonb_array_length(${pitanjaBankaTable.tagovi}) = 0)::int`,
      bezKat: sql<number>`count(*) FILTER (WHERE ${pitanjaBankaTable.kategorija} IS NULL)::int`,
    })
    .from(pitanjaBankaTable);
  log(`🏷️  Pitanja bez ijednog taga: ${bezTagova} | bez kategorije: ${bezKat}`);

  // Fail-fast za automatizaciju: ako je išta ostalo neklasifikovano (a nismo
  // namjerno radili djelomični chunk preko MAX), izađi sa greškom.
  if (!maxRows && (bezTagova > 0 || bezKat > 0)) {
    log(`❌ NEPOTPUNO: ostalo ${bezTagova} bez taga, ${bezKat} bez kategorije.`);
    return false;
  }
  log(`🏁 GOTOVO`);
  return true;
}

run()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(err => { log(`FATAL: ${err?.stack || err}`); process.exit(1); });
