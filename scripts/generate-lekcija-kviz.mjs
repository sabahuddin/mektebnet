import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { JSDOM } from 'jsdom';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || 'dummy',
});

// Extract plain text from "Naučimo iz ilmihala" section in the HTML
function extractIlmihalText(contentHtml) {
  if (!contentHtml) return '';
  const dom = new JSDOM(contentHtml);
  const doc = dom.window.document;
  
  // Find the lesson-accordion that contains ilmihal content
  const accordions = doc.querySelectorAll('.lesson-accordion');
  let text = '';
  
  for (const acc of accordions) {
    const btn = acc.querySelector('.lesson-section-btn');
    if (!btn) continue;
    const title = btn.textContent?.toUpperCase() || '';
    // Find the ilmihal content section
    if (title.includes('NAUČIMO') || title.includes('ILMIHAL') || title.includes('NAUCIMO')) {
      const content = acc.querySelector('.lesson-content');
      if (content) {
        text = content.textContent?.replace(/\s+/g, ' ').trim() || '';
        break;
      }
    }
  }
  
  // Fallback: if no specific section found, use all text but skip hero/story
  if (!text) {
    // Remove hero box
    doc.querySelectorAll('.hero-box').forEach(el => el.remove());
    // Get all text
    text = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }
  
  // Limit to 3000 chars to stay within token budget
  return text.substring(0, 3000);
}

async function generateMCQ(naslov, tekst) {
  const prompt = `Si nastavnik islamske vjeronauke za djecu od 9-12 godina u Bosni i Hercegovini.

Na osnovu sljedećeg teksta lekcije pod naslovom "${naslov}", napravi TAČNO 5 pitanja višestrukog izbora.

TEKST LEKCIJE:
${tekst}

PRAVILA:
- Svako pitanje ima TAČNO 4 ponuđena odgovora (A, B, C, D)
- Odgovori moraju biti kratki (max 10 riječi)
- Pitanja moraju biti jasna za djecu od 9-12 godina
- Samo 1 odgovor je tačan
- Pitanja pokrivaju najvažnije informacije iz lekcije
- Pišeš na bosanskom jeziku

Vrati SAMO validan JSON array bez ikakvih dodatnih komentara ili objašnjenja:
[
  {
    "question": "Tekst pitanja?",
    "options": ["Odgovor A", "Odgovor B", "Odgovor C", "Odgovor D"],
    "answer": "Tačan odgovor (mora biti identičan jednoj od opcija)"
  }
]`;

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : '';
  
  // Extract JSON from response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON in response: ' + raw.substring(0, 200));
  
  const parsed = JSON.parse(jsonMatch[0]);
  // Validate
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid MCQ array');
  for (const q of parsed) {
    if (!q.question || !Array.isArray(q.options) || !q.answer) throw new Error('Invalid question format');
    // Ensure answer matches one of the options
    if (!q.options.includes(q.answer)) {
      // Try to find the closest match
      q.answer = q.options[0];
    }
  }
  
  return parsed;
}

async function main() {
  // Get all lekcije that don't have kviz_pitanja yet
  const { rows: lekcije } = await pool.query(
    `SELECT id, nivo, slug, naslov, content_html FROM ilmihal_lekcije WHERE kviz_pitanja IS NULL ORDER BY redoslijed`
  );
  
  console.log(`Found ${lekcije.length} lekcija without kviz_pitanja`);
  
  let success = 0, failed = 0;
  
  for (const l of lekcije) {
    const tekst = extractIlmihalText(l.content_html);
    if (!tekst || tekst.length < 100) {
      console.log(`  SKIP [${l.slug}] - too little text (${tekst.length} chars)`);
      // Store empty array so we don't retry
      await pool.query('UPDATE ilmihal_lekcije SET kviz_pitanja = $1 WHERE id = $2', [JSON.stringify([]), l.id]);
      continue;
    }
    
    try {
      process.stdout.write(`  [${l.slug}] Generating...`);
      const pitanja = await generateMCQ(l.naslov, tekst);
      await pool.query('UPDATE ilmihal_lekcije SET kviz_pitanja = $1 WHERE id = $2', [JSON.stringify(pitanja), l.id]);
      console.log(` ✓ (${pitanja.length} pitanja)`);
      success++;
      // Rate limit: wait 500ms between requests
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(` ✗ ERROR: ${err.message?.substring(0, 100)}`);
      failed++;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`\nDone: ${success} uspješno, ${failed} grešaka`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
