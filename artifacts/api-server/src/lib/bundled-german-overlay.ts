import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { bundledGermanNivo1Overlays } from "../data/german-nivo1-overlay";
import { logger } from "./logger";

type Lesson = {
  id: number;
  slug: string;
  naslov: string | null;
  content_html: string | null;
  kviz_pitanja: unknown;
};

function sourceForField(lesson: Lesson, field: "naslov" | "content_html" | "kviz_pitanja") {
  const value = lesson[field];
  return field === "kviz_pitanja" && typeof value !== "string"
    ? JSON.stringify(value ?? "")
    : String(value ?? "");
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isAllCapsText(value: string) {
  const letters = value.match(/\p{L}/gu) ?? [];
  const hasCasedLetter = letters.some((letter) => letter.toLowerCase() !== letter.toUpperCase());
  return hasCasedLetter && letters.every((letter) => letter.toUpperCase() === letter);
}

function preserveSourceCasing(source: string, translation: string, field: BundledGermanOverlay["field"]) {
  if (field !== "content_html") {
    return isAllCapsText(source) ? translation.toLocaleUpperCase("de-DE") : translation;
  }

  // The bundle preserves identical HTML structure. Reapply uppercase styling
  // node-by-node so Arabic passages remain untouched while surrounding German
  // lesson text follows the source typography.
  const sourceParts = source.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g);
  const translationParts = translation.split(/(<(?:"[^"]*"|'[^']*'|[^'">])*>)/g);
  if (sourceParts.length !== translationParts.length) return translation;

  return translationParts.map((part, index) => (
    !part.startsWith("<") && isAllCapsText(sourceParts[index])
      ? part.toLocaleUpperCase("de-DE")
      : part
  )).join("");
}

/**
 * Applies the reviewed German content packaged with this release. Every write is
 * guarded by the Bosnian source hash, so changed lessons are skipped rather than
 * accidentally receiving a translation for a different source.
 */
export async function applyBundledGermanOverlays() {
  if (bundledGermanNivo1Overlays.length === 0) return;

  const slugs = [...new Set(bundledGermanNivo1Overlays.map((overlay) => overlay.slug))];
  const result = await db.execute(sql`
    SELECT id, slug, naslov, content_html, kviz_pitanja
    FROM ilmihal_lekcije
    WHERE slug IN ${sql`(${sql.join(slugs.map((slug) => sql`${slug}`), sql`, `)})`}
  `);
  const lessons = new Map(
    (result.rows as Lesson[]).map((lesson) => [lesson.slug, lesson]),
  );

  let applied = 0;
  const skipped: string[] = [];
  for (const overlay of bundledGermanNivo1Overlays) {
    const lesson = lessons.get(overlay.slug);
    if (!lesson || sha256(sourceForField(lesson, overlay.field)) !== overlay.sourceHash) {
      skipped.push(`${overlay.slug}/${overlay.field}`);
      continue;
    }
    const translation = preserveSourceCasing(
      sourceForField(lesson, overlay.field),
      overlay.translation,
      overlay.field,
    );
    await db.execute(sql`
      INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash, updated_at)
      VALUES ('ilmihal_lekcije', ${lesson.id}, ${overlay.field}, 'de', ${translation}, ${overlay.sourceHash}, NOW())
      ON CONFLICT (tabela, red_id, polje, jezik)
      DO UPDATE SET prijevod = EXCLUDED.prijevod, izvor_hash = EXCLUDED.izvor_hash, updated_at = NOW()
    `);
    applied++;
  }

  logger.info(
    { applied, skipped },
    "Bundled German lesson overlays processed",
  );
}