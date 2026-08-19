import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import halalHaramContentHtml from "../data/halal-haram-content.js";

const slug = "halal-haram";
const naslov = "Pojam i smisao halala i harama";

/**
 * Urednička migracija: ovu lekciju uvodi kao zadnju lekciju nivoa 3.
 * Izvršava se ponovo bez dupliranja, a redoslijed uvijek ostaje iza drugih
 * lekcija nivoa 3.
 */
export async function seedHalalHaramLesson(): Promise<void> {
  const nextOrder = sql`
    (
      SELECT COALESCE(MAX(redoslijed), 0) + 1
      FROM ilmihal_lekcije
      WHERE nivo = 3 AND slug <> ${slug}
    )
  `;

  const existing = await db.execute(sql`
    SELECT id
    FROM ilmihal_lekcije
    WHERE slug = ${slug}
    LIMIT 1
  `);

  if (existing.rows.length > 0) {
    await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET
        nivo = 3,
        redoslijed = ${nextOrder},
        naslov = ${naslov},
        content_html = ${halalHaramContentHtml},
        is_published = TRUE,
        locked = FALSE,
        locked_at = NULL,
        locked_note = NULL,
        predmet = 'Ibadet i praksa',
        uvjeti_ids = '[]'::jsonb
      WHERE slug = ${slug}
    `);
    return;
  }

  await db.execute(sql`
    INSERT INTO ilmihal_lekcije (
      nivo, slug, naslov, content_html, redoslijed, is_published, locked,
      predmet, uvjeti_ids
    )
    VALUES (
      3, ${slug}, ${naslov}, ${halalHaramContentHtml}, ${nextOrder}, TRUE, FALSE,
      'Ibadet i praksa', '[]'::jsonb
    )
  `);
}