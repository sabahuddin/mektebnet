import { db } from "@workspace/db";
import { ilmihalLekcijeTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ExtractedLesson {
  slug: string;
  ilmihal_html: string;
  ilmihal_chars: number;
  pitanja_html: string;
  pitanja_chars: number;
}

function findAndReplaceSectionContent(
  html: string,
  sectionId: string,
  newContent: string
): { html: string; changed: boolean } {
  const variants = [sectionId, sectionId.toUpperCase(), sectionId.toLowerCase()];

  for (const id of variants) {
    const pat = `id="${id}"`;
    const idx = html.indexOf(pat);
    if (idx < 0) continue;

    const contentStart = html.indexOf(">", idx) + 1;

    let depth = 1;
    let pos = contentStart;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf("<div", pos);
      const nextClose = html.indexOf("</div>", pos);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        pos = nextClose + 6;
      }
    }
    const contentEnd = pos - 6;

    const before = html.substring(0, contentStart);
    const after = html.substring(contentEnd);
    return { html: before + "\n" + newContent + "\n" + after, changed: true };
  }

  return { html, changed: false };
}

export async function migrateIlmihalContent(): Promise<void> {
  const jsonPath = path.resolve(__dirname, "routes/extracted-content.json");
  if (!fs.existsSync(jsonPath)) {
    logger.info("migrate-ilmihal-content: extracted-content.json not found, skipping");
    return;
  }

  const flagRows = await db.execute(
    sql`SELECT 1 FROM ilmihal_lekcije WHERE slug = 'cistoca' AND content_html LIKE '%data-migrated-v1%' LIMIT 1`
  );
  if ((flagRows as any).rows?.length > 0 || (Array.isArray(flagRows) && flagRows.length > 0)) {
    logger.info("migrate-ilmihal-content: already applied (v1 flag found), skipping");
    return;
  }

  logger.info("migrate-ilmihal-content: starting one-time content migration...");

  const extracted: Record<string, ExtractedLesson> = JSON.parse(
    fs.readFileSync(jsonPath, "utf8")
  );

  const allLessons = await db
    .select({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug, contentHtml: ilmihalLekcijeTable.contentHtml })
    .from(ilmihalLekcijeTable)
    .where(eq(ilmihalLekcijeTable.nivo, 2));

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const lesson of allLessons) {
    const ext = extracted[lesson.slug];
    if (!ext) {
      skipped++;
      continue;
    }

    let html = lesson.contentHtml || "";
    if (!html || html.length < 50) {
      skipped++;
      continue;
    }

    let ilmihalChanged = false;
    let pitanjaChanged = false;

    if (ext.ilmihal_html && ext.ilmihal_chars > 50) {
      for (const id of ["ilmihal", "ILMIHAL"]) {
        const result = findAndReplaceSectionContent(html, id, ext.ilmihal_html);
        if (result.changed) {
          html = result.html;
          ilmihalChanged = true;
          break;
        }
      }
    }

    if (ext.pitanja_html && ext.pitanja_chars > 10) {
      for (const id of ["pitanja", "PITANJA", "ponovi"]) {
        const result = findAndReplaceSectionContent(html, id, ext.pitanja_html);
        if (result.changed) {
          html = result.html;
          pitanjaChanged = true;
          break;
        }
      }
    }

    if (!ilmihalChanged && !pitanjaChanged) {
      skipped++;
      continue;
    }

    if (lesson.slug === "cistoca") {
      html = html.replace(
        'class="lesson-container"',
        'class="lesson-container" data-migrated-v1="1"'
      );
    }

    try {
      await db
        .update(ilmihalLekcijeTable)
        .set({ contentHtml: html })
        .where(eq(ilmihalLekcijeTable.id, lesson.id));
      updated++;
      const changes = [ilmihalChanged && "ilmihal", pitanjaChanged && "pitanja"].filter(Boolean).join("+");
      logger.info({ slug: lesson.slug, changes }, "migrate-ilmihal-content: updated");
    } catch (err: any) {
      errors++;
      logger.error({ slug: lesson.slug, err: err?.message }, "migrate-ilmihal-content: update failed");
    }
  }

  logger.info(
    { updated, skipped, errors },
    "migrate-ilmihal-content: migration complete"
  );
}
