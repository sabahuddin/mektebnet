/**
 * Rescrape all quiz questions from mekteb.net and update content-seed.json.gz
 */
import { createReadStream, createWriteStream } from 'fs';
import { createGunzip, createGzip } from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../../scripts/content-seed.json.gz');
const SKIP_TYPES = new Set(['dragDrop', 'reorder', 'markWords', 'fillBlank', 'matching']);

// Read existing seed
function readSeed() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    createReadStream(SEED_PATH)
      .pipe(createGunzip())
      .on('data', c => chunks.push(c))
      .on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))))
      .on('error', reject);
  });
}

function writeSeed(data) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(data);
    const gzip = createGzip();
    const out = createWriteStream(SEED_PATH);
    gzip.pipe(out);
    gzip.write(json);
    gzip.end();
    out.on('finish', resolve).on('error', reject);
  });
}

function extractJsArray(html, varName) {
  const idx = html.indexOf(varName);
  if (idx === -1) return null;
  const bStart = html.indexOf('[', idx);
  if (bStart === -1) return null;
  let depth = 0, end = -1;
  for (let i = bStart; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  return end === -1 ? null : html.substring(bStart, end + 1);
}

function parseQuizHtml(html) {
  const questions = [];

  // Try knjige format (const questions)
  const knjigaArr = extractJsArray(html, 'const questions');
  if (knjigaArr) {
    const re = /\{\s*q\s*:\s*(['"])((?:[^'"\\]|\\.)*)\1\s*,\s*a\s*:\s*\[([^\]]+)\]\s*,\s*c\s*:\s*(\d+)/gs;
    let m;
    while ((m = re.exec(knjigaArr)) !== null) {
      const q = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      const opts = parseOptions(m[3]);
      const idx = parseInt(m[4]);
      if (opts.length >= 2 && idx < opts.length) {
        questions.push({ question: q, options: opts, answer: opts[idx] });
      }
    }
    if (questions.length > 0) return questions;
  }

  const arr = extractJsArray(html, 'allQuestions');
  if (!arr) return [];

  // Try JSON.parse (handles double-quoted format like 1a, 1b, 3a, 3b etc.)
  try {
    const parsed = JSON.parse(arr);
    if (Array.isArray(parsed)) {
      for (const q of parsed) {
        if (!q.question || !Array.isArray(q.options)) continue;
        const type = q.type || 'multiple';
        if (SKIP_TYPES.has(type)) continue;
        const ans = q.answer || (typeof q.correct === 'string' ? q.correct : null);
        if (!ans) continue;
        const entry = { question: q.question, options: q.options, answer: ans };
        if (q.explanation) entry.explanation = q.explanation;
        if (q.image) entry.image = q.image;
        if (q.slika) entry.image = q.slika;
        questions.push(entry);
      }
      if (questions.length > 0) return questions;
    }
  } catch { /* not valid JSON, try other formats */ }

  // Try single-quoted Format 1: {type:'multiple', question:'...', ...}
  const f1re = /\{type\s*:\s*'(\w+)'([\s\S]*?)\},?\s*(?=\{type:|$|\])/g;
  let m;
  while ((m = f1re.exec(arr)) !== null) {
    if (m[1] !== 'multiple') continue;
    const block = m[0];
    const qm = block.match(/question\s*:\s*'((?:[^'\\]|\\.)*)'/);
    const om = block.match(/options\s*:\s*\[([^\]]*)\]/);
    const cm = block.match(/correct\s*:\s*'((?:[^'\\]|\\.)*)'/);
    const em = block.match(/explanation\s*:\s*'((?:[^'\\]|\\.)*)'/);
    const im = block.match(/(?:slika|image)\s*:\s*'((?:[^'\\]|\\.)*)'/);
    if (qm && om && cm) {
      const opts = parseOptions(om[1]);
      if (opts.length >= 2) {
        const entry = { question: parseSQ(qm[1]), options: opts, answer: parseSQ(cm[1]) };
        if (em) entry.explanation = parseSQ(em[1]);
        if (im) entry.image = im[1];
        questions.push(entry);
      }
    }
  }
  if (questions.length > 0) return questions;

  // Try single-quoted Format 2: {question:'...', options:[...], answer:'...'}
  const f2re = /\{\s*(?:\/\/[^\n]*)?\s*question\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*options\s*:\s*\[([^\]]*)\]\s*,\s*answer\s*:\s*'((?:[^'\\]|\\.)*)'/gs;
  while ((m = f2re.exec(arr)) !== null) {
    const opts = parseOptions(m[2]);
    if (opts.length >= 2) {
      const startIdx = m.index;
      const endIdx = arr.indexOf('}', m.index + m[0].length);
      const block = endIdx > -1 ? arr.substring(startIdx, endIdx + 1) : m[0];
      const em = block.match(/explanation\s*:\s*'((?:[^'\\]|\\.)*)'/);
      const im = block.match(/(?:slika|image)\s*:\s*'((?:[^'\\]|\\.)*)'/);
      const entry = { question: parseSQ(m[1]), options: opts, answer: parseSQ(m[3]) };
      if (em) entry.explanation = parseSQ(em[1]);
      if (im) entry.image = im[1];
      questions.push(entry);
    }
  }

  return questions;
}

function parseSQ(s) {
  return s.replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\\t/g, ' ');
}

function parseOptions(raw) {
  const sq = raw.match(/'((?:[^'\\]|\\.)*)'/g);
  if (sq && sq.length >= 2) return sq.map(s => parseSQ(s.slice(1, -1)));
  const dq = raw.match(/"((?:[^"\\]|\\.)*)"/g);
  if (dq && dq.length >= 2) return dq.map(s => s.slice(1, -1).replace(/\\"/g, '"'));
  return [];
}

function nivoPath(kviz) {
  if (kviz.nivo === 1) return 'nivo1';
  if (kviz.nivo === 2 || kviz.nivo === 21) return 'nivo2';
  if (kviz.nivo === 3) return 'nivo3';
  return 'nivo1';
}

async function main() {
  console.log('📚 Re-scraping quiz questions from mekteb.net...\n');
  const seed = await readSeed();

  let updated = 0, skipped = 0, withImages = 0;

  for (const kviz of seed.kvizovi) {
    if (!kviz.nivo) {
      // knjige quizzes
      const url = `https://mekteb.net/edu/kvizovi1/${kviz.slug}.html`;
      try {
        const html = await fetch(url).then(r => r.text());
        const parsed = parseQuizHtml(html);
        if (parsed.length > 0) {
          kviz.pitanja = parsed;
          updated++;
          console.log(`✅ ${kviz.slug}: ${parsed.length} pitanja`);
        }
      } catch (e) { console.log(`⚠️ ${kviz.slug}: ${e.message}`); }
      continue;
    }

    const url = `https://mekteb.net/edu/kvizovi1/${nivoPath(kviz)}/${kviz.slug}.html`;
    try {
      const html = await fetch(url).then(r => r.text());
      const parsed = parseQuizHtml(html);
      if (parsed.length > 0) {
        const oldCount = kviz.pitanja?.length || 0;
        kviz.pitanja = parsed;
        const imgs = parsed.filter(p => p.image).length;
        if (imgs > 0) withImages++;
        updated++;
        console.log(`✅ ${kviz.slug}: ${oldCount} → ${parsed.length} pitanja (${imgs > 0 ? imgs + ' slike' : 'bez slika'})`);
      } else {
        const oldCount = kviz.pitanja?.length || 0;
        skipped++;
        if (oldCount > 0) {
          console.log(`ℹ️ ${kviz.slug}: zadržano ${oldCount} (checkbox/dragdrop format)`);
        } else {
          console.log(`⚠️ ${kviz.slug}: 0 pitanja (checkbox/dragdrop only)`);
        }
      }
    } catch (e) {
      console.log(`❌ ${kviz.slug}: ${e.message}`);
      skipped++;
    }
  }

  console.log(`\n📊 Rezultat: ${updated} ažurirano, ${skipped} preskočeno, ${withImages} s slikama`);

  await writeSeed(seed);

  // Print summary of what's now in seed
  const total = seed.kvizovi.length;
  const withQ = seed.kvizovi.filter(k => k.pitanja?.length > 0).length;
  const totalQ = seed.kvizovi.reduce((s, k) => s + (k.pitanja?.length || 0), 0);
  console.log(`\n✅ Seed ažuriran! ${withQ}/${total} kvizova ima pitanja, ukupno ${totalQ} pitanja`);
}

main().catch(e => { console.error(e); process.exit(1); });
