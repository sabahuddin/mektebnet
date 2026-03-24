/**
 * Import content from HTML files in edu.zip
 * Parses lekcije (ilmihal), kvizovi, and knjige (čitaonica)
 */
import AdmZip from "adm-zip";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable, kvizoviTable, knjige, QuizQuestion } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_PATH = path.join(__dirname, "../../attached_assets/edu_1774348311515.zip");

function extractTitle(html: string): string {
  const m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  return m ? m[1].trim() : "";
}

function fixImagePaths(html: string): string {
  // Normalize all relative image paths to absolute /edu/assets/images/
  // Handles: ../../assets/images/, ../assets/images/, /edu/assets/images/ (keep)
  return html.replace(/src="(?:\.\.\/)*assets\/images\//g, 'src="/edu/assets/images/');
}

function extractBodyContent(html: string): string {
  // Extract everything inside <body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;

  let body = bodyMatch[1];

  // Remove script tags
  body = body.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove style tags
  body = body.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove GA4 and other tracking
  body = body.replace(/<!-- Google tag[\s\S]*?-->/gi, "");
  // Fix image paths to absolute URLs
  body = fixImagePaths(body);

  return body.trim();
}

/** Extract the JS array for a variable name. Returns the raw array string or null. */
function extractJsArray(html: string, varName: string): string | null {
  const idx = html.indexOf(varName);
  if (idx === -1) return null;
  const bracketStart = html.indexOf("[", idx);
  if (bracketStart === -1) return null;
  let depth = 0, bracketEnd = -1;
  for (let i = bracketStart; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") { depth--; if (depth === 0) { bracketEnd = i; break; } }
  }
  return bracketEnd === -1 ? null : html.substring(bracketStart, bracketEnd + 1);
}

/** Parse a single-quoted string, handling \\' escapes. */
function parseSingleQuoted(s: string): string {
  return s.replace(/\\'/g, "'").replace(/\\n/g, " ").replace(/\\t/g, " ");
}

/** Extract options array from either ['a','b'] or ["a","b"] string. */
function parseOptions(raw: string): string[] {
  const singleOpts = raw.match(/'((?:[^'\\]|\\.)*)'/g);
  if (singleOpts && singleOpts.length >= 2) return singleOpts.map(s => parseSingleQuoted(s.slice(1, -1)));
  const dblOpts = raw.match(/"((?:[^"\\]|\\.)*)"/g);
  if (dblOpts && dblOpts.length >= 2) return dblOpts.map(s => s.slice(1, -1).replace(/\\"/g, '"'));
  return [];
}

function extractQuizData(html: string): QuizQuestion[] | null {
  const SKIP_TYPES = new Set(["dragDrop", "reorder", "markWords", "checkbox", "fillBlank", "matching"]);
  const questions: QuizQuestion[] = [];

  // === FORMAT 3: knjige quizzes with {q:"...", a:[...], c: index} ===
  // Variable name is "questions" (not allQuestions). Supports both single and double quotes.
  const knjigaArr = extractJsArray(html, "const questions");
  if (knjigaArr) {
    // Matches: { q: "..." or 'q', a: [...], c: index }
    const knjigaRegex = /\{\s*q\s*:\s*(['"])((?:[^'"\\]|\\.)*)\1\s*,\s*a\s*:\s*\[([^\]]+)\]\s*,\s*c\s*:\s*(\d+)/gs;
    let km;
    while ((km = knjigaRegex.exec(knjigaArr)) !== null) {
      const question = km[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
      const opts = parseOptions(km[3]);
      const correctIdx = parseInt(km[4], 10);
      if (opts.length >= 2 && correctIdx < opts.length) {
        questions.push({ question, options: opts, answer: opts[correctIdx] });
      }
    }
    if (questions.length > 0) return questions;
  }

  // === FORMAT 1 & 2a: allQuestions array ===
  const jsArray = extractJsArray(html, "allQuestions");
  if (!jsArray) return null;

  // Format 1: {type:'multiple', question:'...', options:[...], correct:'...', explanation:'...'}
  // Use a broad match then parse fields individually (handles escaped apostrophes)
  const objBoundaryRegex = /\{type\s*:\s*'(\w+)'([\s\S]*?)\},?\s*(?=\{type:|$|\])/g;
  let m1;
  while ((m1 = objBoundaryRegex.exec(jsArray)) !== null) {
    const type = m1[1];
    if (!["multiple"].includes(type)) continue;
    const block = m1[0];
    const qMatch = block.match(/question\s*:\s*'((?:[^'\\]|\\.)*)'/);
    const optMatch = block.match(/options\s*:\s*\[([^\]]*)\]/);
    const corrMatch = block.match(/correct\s*:\s*'((?:[^'\\]|\\.)*)'/);
    const explMatch = block.match(/explanation\s*:\s*'((?:[^'\\]|\\.)*)'/);
    if (qMatch && optMatch && corrMatch) {
      const opts = parseOptions(optMatch[1]);
      if (opts.length >= 2) {
        questions.push({
          question: parseSingleQuoted(qMatch[1]),
          options: opts,
          answer: parseSingleQuoted(corrMatch[1]),
          explanation: explMatch ? parseSingleQuoted(explMatch[1]) : undefined,
        });
      }
    }
  }
  if (questions.length > 0) return questions;

  // Format 2a: {question: '...', options: [...], answer: '...', explanation: '...'}
  // (single-quoted, no type field, may have escaped apostrophes)
  const fmt2aRegex = /\{(?!\s*(?:type|"type"))\s*(?:\/\/[^\n]*)?\s*question\s*:\s*'((?:[^'\\]|\\.)*)'\s*,\s*options\s*:\s*\[([^\]]*)\]\s*,\s*answer\s*:\s*'((?:[^'\\]|\\.)*)'\s*(?:,\s*explanation\s*:\s*'((?:[^'\\]|\\.)*)')?/gs;
  let m2;
  while ((m2 = fmt2aRegex.exec(jsArray)) !== null) {
    const opts = parseOptions(m2[2]);
    if (opts.length >= 2) {
      questions.push({
        question: parseSingleQuoted(m2[1]),
        options: opts,
        answer: parseSingleQuoted(m2[3]),
        explanation: m2[4] ? parseSingleQuoted(m2[4]) : undefined,
      });
    }
  }
  if (questions.length > 0) return questions;

  // Format 2b: double-quoted JSON with type:"multiple" or no type
  try {
    const cleaned = jsArray
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Array<{
      question: string; options: string[]; answer?: string; correct?: string | string[];
      explanation?: string; type?: string;
    }>;
    for (const q of parsed) {
      if (q.question && Array.isArray(q.options) && (q.answer || typeof q.correct === "string")) {
        if (SKIP_TYPES.has(q.type || "")) continue;
        const ans = q.answer ?? (typeof q.correct === "string" ? q.correct : undefined);
        if (!ans) continue;
        questions.push({ question: q.question, options: q.options, answer: ans, explanation: q.explanation });
      }
    }
  } catch { /* not valid JSON */ }

  return questions.length > 0 ? questions : null;
}

function slugFromPath(filePath: string): string {
  return path.basename(filePath, ".html").replace(/_/g, "-");
}

function nivoFromPath(filePath: string): number {
  if (filePath.includes("nivo1")) return 1;
  if (filePath.includes("nivo21")) return 21;
  if (filePath.includes("nivo2")) return 2;
  if (filePath.includes("nivo3")) return 3;
  return 1;
}

async function importContent() {
  console.log("📚 Starting content import...\n");

  const zip = new AdmZip(ZIP_PATH);
  const entries = zip.getEntries().filter(e => !e.entryName.includes("__MACOSX"));

  let lekcijeCount = 0;
  let kvizoviCount = 0;
  let knjige_count = 0;

  for (const entry of entries) {
    const name = entry.entryName;
    const html = entry.getData().toString("utf8");

    // ── ILMIHAL LEKCIJE ──────────────────────────────────────────────────────
    if (name.match(/edu\/lekcije\/(nivo\d+)\/[^/]+\.html$/) && !name.includes("index") && !name.includes("kviz")) {
      const slug = slugFromPath(name);
      const nivo = nivoFromPath(name);
      const naslov = extractTitle(html) || slug.replace(/-/g, " ");
      const contentHtml = extractBodyContent(html);

      // Check for audio src
      const audioMatch = html.match(/src="([^"]*\.mp3)"/);
      const audioSrc = audioMatch ? audioMatch[1] : undefined;

      const existing = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.slug, slug));

      if (existing.length === 0) {
        await db.insert(ilmihalLekcijeTable).values({
          nivo,
          slug,
          naslov,
          contentHtml,
          audioSrc,
          redoslijed: lekcijeCount,
        });
        lekcijeCount++;
      }
    }

    // ── KVIZOVI (nivo-based) ─────────────────────────────────────────────────
    else if (name.match(/edu\/kvizovi1\/(nivo\d+)\/[^/]+\.html$/)) {
      const slug = slugFromPath(name);
      const nivo = nivoFromPath(name);
      const naslov = extractTitle(html) || `Kviz ${slug}`;
      const variant = name.includes("-hard") ? "hard" : "normal";
      const pitanja = extractQuizData(html) || [];

      const existing = await db.select({ id: kvizoviTable.id }).from(kvizoviTable).where(eq(kvizoviTable.slug, slug));
      if (existing.length === 0) {
        await db.insert(kvizoviTable).values({ nivo, slug, naslov, modul: "ilmihal", variant, pitanja });
        kvizoviCount++;
      } else {
        await db.update(kvizoviTable).set({ pitanja }).where(eq(kvizoviTable.id, existing[0].id));
        kvizoviCount++;
      }
    }

    // ── KNJIGE - PRIČE O POSLANICIMA ─────────────────────────────────────────
    else if (name.match(/edu\/knjige\d*\/price\/[^/]+\.html$/) && !name.includes("kviz")) {
      const slug = slugFromPath(name);
      const naslov = extractTitle(html) || slug.replace(/-/g, " ");
      const contentHtml = extractBodyContent(html);

      const existing = await db.select({ id: knjige.id }).from(knjige).where(eq(knjige.slug, slug));
      if (existing.length === 0) {
        await db.insert(knjige).values({ slug, naslov, kategorija: "prica", contentHtml, redoslijed: knjige_count });
        knjige_count++;
      }
    }

    // ── KVIZOVI ZA KNJIGE ────────────────────────────────────────────────────
    else if (name.match(/edu\/knjige\d*\/kvizovi\/kviz-[^/]+\.html$/)) {
      const slug = slugFromPath(name);
      const naslov = extractTitle(html) || `Kviz ${slug}`;
      const pitanja = extractQuizData(html) || [];

      const existing = await db.select({ id: kvizoviTable.id }).from(kvizoviTable).where(eq(kvizoviTable.slug, slug));
      if (existing.length === 0) {
        await db.insert(kvizoviTable).values({ slug, naslov, modul: "knjige", pitanja });
        kvizoviCount++;
      } else {
        await db.update(kvizoviTable).set({ pitanja }).where(eq(kvizoviTable.id, existing[0].id));
        kvizoviCount++;
      }
    }
  }

  console.log(`✅ Lekcije uvezene: ${lekcijeCount}`);
  console.log(`✅ Kvizovi uvezeni: ${kvizoviCount}`);
  console.log(`✅ Knjige uvezene: ${knjige_count}`);
  console.log("\n🎉 Import završen!");
  process.exit(0);
}

importContent().catch(err => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
