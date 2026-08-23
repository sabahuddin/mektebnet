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
    await db.execute(sql`
      INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash, updated_at)
      VALUES ('ilmihal_lekcije', ${lesson.id}, ${overlay.field}, 'de', ${overlay.translation}, ${overlay.sourceHash}, NOW())
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