/**
 * Stroga AI klasifikacija pitanja bez lekcija.
 *
 * Pitanje dobija lekcija_id samo kada model vrati visoku sigurnost (>= 0.92)
 * i izabrana lekcija pripada istom predmetu kao kategorija pitanja. Sve
 * nejasno ostaje lekcija_id=NULL za ručnu raspodjelu u adminu.
 *
 * Pokretanje:
 *   pnpm --filter @workspace/scripts exec tsx src/rasporedi-pitanja-po-lekcijama.ts
 * Opcije:
 *   MAX=100       ograniči broj pitanja u ovom prolazu
 *   AFTER_ID=123  obrađuj samo ID-jeve veće od 123
 *   DRY_RUN=1     ne upisuj rezultate
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, ilmihalLekcijeTable, pitanjaBankaTable } from "@workspace/db";

const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
if (!baseURL || !apiKey) throw new Error("Nedostaju AI_INTEGRATIONS_ANTHROPIC_* env vars.");

const anthropic = new Anthropic({ baseURL, apiKey, timeout: 120_000, maxRetries: 1 });
const MODEL = "claude-sonnet-4-6";
const BATCH = Number(process.env["BATCH"] || 20);
const CONCURRENCY = Number(process.env["CONCURRENCY"] || 5);
const MAX = process.env["MAX"] ? Number(process.env["MAX"]) : undefined;
const AFTER_ID = Number(process.env["AFTER_ID"] || 0);
const DRY_RUN = process.env["DRY_RUN"] === "1";
const MIN_CONFIDENCE = 0.92;

const CATEGORY_TO_PREDMET: Record<string, string> = {
  kiraet: "Kiraet",
  akaid: "Vjerovanje",
  ibadet: "Ibadet",
  ahlak: "Ahlak",
  historija: "Historija islama",
  bosna: "Ostali sadržaji",
};

type Question = {
  id: number;
  pitanje: string;
  opcije: string[];
  objasnjenje: string;
  kategorija: string | null;
};

type Lesson = { id: number; naslov: string; predmet: string | null; nivo: number };
type Decision = { id: number; lekcijaId: number | null; confidence: number };

function extractJson(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("Odgovor nema JSON niz.");
  return text.slice(start, end + 1);
}

function questionText(q: Question): string {
  return [
    `ID ${q.id}: ${q.pitanje}`,
    q.opcije?.length ? `Opcije: ${q.opcije.join(" | ")}` : "",
    q.objasnjenje ? `Objašnjenje: ${q.objasnjenje}` : "",
  ].filter(Boolean).join("\n").slice(0, 1400);
}

async function classifyBatch(rows: Question[], lessonsByCategory: Map<string, Lesson[]>): Promise<Decision[]> {
  const sections = [...new Set(rows.map(r => r.kategorija).filter(Boolean))]
    .map(category => {
      const lessons = lessonsByCategory.get(category!) ?? [];
      return `${category} (${CATEGORY_TO_PREDMET[category!] ?? category}):\n`
        + lessons.map(l => `- ${l.id}: Nivo ${l.nivo} — ${l.naslov}`).join("\n");
    }).join("\n\n");

  const prompt = `Ti si stručni urednik mektebskih pitanja. Svako pitanje već ima predmet.
Odredi TAČNO JEDNU konkretnu lekciju samo ako sadržaj pitanja jasno i specifično pripada toj lekciji.
Ako pitanje može pripadati više lekcija, ako je preopćenito, ili nisi siguran, vrati lekcijaId=null.
Ne biraj lekciju samo zato što je slična tema. Ne mijenjaj predmet.

Dozvoljene lekcije po predmetu:
${sections}

Pitanja:
${rows.map(questionText).join("\n\n")}

Vrati isključivo JSON niz, po jedan objekat za svaki ID:
{"id":broj,"lekcijaId":broj_ili_null,"confidence":0_do_1}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 5000,
    system: "Budi konzervativan. Bolje je vratiti null nego pogrešnu lekciju.",
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";
  return JSON.parse(extractJson(text)) as Decision[];
}

async function main() {
  const lessons = await db.select({
    id: ilmihalLekcijeTable.id,
    naslov: ilmihalLekcijeTable.naslov,
    predmet: ilmihalLekcijeTable.predmet,
    nivo: ilmihalLekcijeTable.nivo,
  }).from(ilmihalLekcijeTable)
    .orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed));

  const lessonsByCategory = new Map<string, Lesson[]>();
  for (const lesson of lessons) {
    const category = Object.entries(CATEGORY_TO_PREDMET).find(([, predmet]) => predmet === lesson.predmet)?.[0];
    if (category) lessonsByCategory.set(category, [...(lessonsByCategory.get(category) ?? []), lesson]);
  }
  const lessonById = new Map(lessons.map(l => [l.id, l]));

  const where = and(isNull(pitanjaBankaTable.lekcijaId), gt(pitanjaBankaTable.id, AFTER_ID));
  let questions = await db.select({
    id: pitanjaBankaTable.id,
    pitanje: pitanjaBankaTable.pitanje,
    opcije: pitanjaBankaTable.opcije,
    objasnjenje: pitanjaBankaTable.objasnjenje,
    kategorija: pitanjaBankaTable.kategorija,
  }).from(pitanjaBankaTable)
    .where(where)
    .orderBy(asc(pitanjaBankaTable.id));
  if (MAX) questions = questions.slice(0, MAX);

  const batches: Question[][] = [];
  for (let i = 0; i < questions.length; i += BATCH) batches.push(questions.slice(i, i + BATCH));

  let assigned = 0;
  let unclear = 0;
  let processed = 0;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map(async batch => ({ batch, decisions: await classifyBatch(batch, lessonsByCategory) })));
    for (const { batch, decisions } of results) {
      const decisionById = new Map(decisions.map(d => [Number(d.id), d]));
      for (const question of batch) {
        const decision = decisionById.get(question.id);
        const lessonId = decision?.lekcijaId == null ? null : Number(decision.lekcijaId);
        const lesson = lessonId == null ? undefined : lessonById.get(lessonId);
        const expectedPredmet = question.kategorija ? CATEGORY_TO_PREDMET[question.kategorija] : undefined;
        const valid = Boolean(
          lesson
          && expectedPredmet
          && lesson.predmet === expectedPredmet
          && Number(decision?.confidence) >= MIN_CONFIDENCE,
        );
        if (!valid) {
          unclear++;
          continue;
        }
        if (!DRY_RUN) {
          await db.update(pitanjaBankaTable)
            .set({ lekcijaId: lesson!.id, updatedAt: new Date() })
            .where(and(eq(pitanjaBankaTable.id, question.id), isNull(pitanjaBankaTable.lekcijaId)));
        }
        assigned++;
      }
      processed += batch.length;
    }
    console.log(JSON.stringify({ processed, total: questions.length, assigned, unclear, lastId: slice.at(-1)?.at(-1)?.id }));
  }

  const [summary] = await db.select({
    ukupno: sql<number>`count(*)::int`,
    saLekcijom: sql<number>`count(*) FILTER (WHERE ${pitanjaBankaTable.lekcijaId} IS NOT NULL)::int`,
    nejasna: sql<number>`count(*) FILTER (WHERE ${pitanjaBankaTable.lekcijaId} IS NULL)::int`,
  }).from(pitanjaBankaTable);
  console.log(JSON.stringify({ done: true, assigned, unclear, summary }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});