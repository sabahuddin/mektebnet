import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable } from "@workspace/db/schema";
import { isNull, eq } from "drizzle-orm";

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "dummy",
});

interface MCQPitanje {
  question: string;
  options: string[];
  answer: string;
}

function extractIlmihalText(contentHtml: string): string {
  if (!contentHtml) return "";

  // Try to find the "Naučimo iz ilmihala" section
  const btnMatches = [...contentHtml.matchAll(/lesson-section-btn[^>]*>([\s\S]*?)<\/button>/g)];
  for (const btnMatch of btnMatches) {
    const btnText = btnMatch[1].replace(/<[^>]+>/g, "").toUpperCase();
    if (btnText.includes("NAUČIMO") || btnText.includes("NAUCIMO") || btnText.includes("ILMIHAL")) {
      // Find the content div following this button
      const afterBtn = contentHtml.substring(btnMatch.index! + btnMatch[0].length);
      const contentMatch = afterBtn.match(/lesson-content[^>]*>([\s\S]{100,3000})/);
      if (contentMatch) {
        return contentMatch[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z#0-9]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 2500);
      }
    }
  }

  // Fallback: strip all HTML
  return contentHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 2500);
}

async function generateMCQ(naslov: string, tekst: string): Promise<MCQPitanje[]> {
  const prompt = `Ti si nastavnik islamske vjeronauke za djecu od 9-12 godina u Bosni i Hercegovini.

Na osnovu sljedećeg teksta lekcije pod naslovom "${naslov}", napravi TAČNO 5 pitanja višestrukog izbora na bosanskom jeziku.

TEKST LEKCIJE:
${tekst}

PRAVILA:
- Svako pitanje ima TAČNO 4 ponuđena odgovora
- Odgovori moraju biti kratki (max 10 riječi svaki)
- Pitanja pokrivaju najvažnije informacije iz lekcije
- Samo 1 odgovor je tačan, ostala 3 su pogrešna ali uvjerljiva
- Pišeš na bosanskom jeziku, jednostavno za djecu

Vrati SAMO validan JSON array, bez ikakvih objašnjenja, komentara ili markdown:
[
  {
    "question": "Tekst pitanja?",
    "options": ["Odgovor 1", "Odgovor 2", "Odgovor 3", "Odgovor 4"],
    "answer": "Tačan odgovor koji mora biti identičan jednoj od 4 opcije"
  }
]`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON: " + raw.substring(0, 150));

  const parsed: MCQPitanje[] = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Empty array");

  for (const q of parsed) {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || !q.answer) {
      throw new Error("Bad question format");
    }
    if (!q.options.includes(q.answer)) q.answer = q.options[0];
  }

  return parsed;
}

async function main() {
  const lekcije = await db
    .select({
      id: ilmihalLekcijeTable.id,
      nivo: ilmihalLekcijeTable.nivo,
      slug: ilmihalLekcijeTable.slug,
      naslov: ilmihalLekcijeTable.naslov,
      contentHtml: ilmihalLekcijeTable.contentHtml,
    })
    .from(ilmihalLekcijeTable)
    .where(isNull(ilmihalLekcijeTable.kvizPitanja));

  console.log(`\nGenerišem MCQ za ${lekcije.length} lekcija...\n`);

  let success = 0, failed = 0, skipped = 0;

  for (const l of lekcije) {
    const tekst = extractIlmihalText(l.contentHtml);

    if (!tekst || tekst.length < 80) {
      process.stdout.write(`  SKIP [${l.slug}] premalo teksta (${tekst.length} chars)\n`);
      await db.update(ilmihalLekcijeTable).set({ kvizPitanja: [] }).where(eq(ilmihalLekcijeTable.id, l.id));
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`  Nivo${l.nivo} [${l.slug}]...`);
      const pitanja = await generateMCQ(l.naslov, tekst);
      await db.update(ilmihalLekcijeTable).set({ kvizPitanja: pitanja }).where(eq(ilmihalLekcijeTable.id, l.id));
      console.log(` ✓ ${pitanja.length} pitanja`);
      success++;
      await new Promise(r => setTimeout(r, 600));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(` ✗ ${msg.substring(0, 80)}`);
      failed++;
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.log(`\n✅ Gotovo: ${success} uspješno, ${skipped} preskočeno, ${failed} grešaka`);
  process.exit(0);
}

main();
