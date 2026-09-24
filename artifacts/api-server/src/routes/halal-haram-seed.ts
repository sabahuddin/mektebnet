import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import halalHaramContentHtml from "../data/halal-haram-content.js";

const slug = "halal-haram";
const naslov = "Pojam i smisao halala i harama";

/**
 * Lekcija je 30. u Nivou 2, neposredno iza "Dužnosti prema rodbini".
 * Postojeći sadržaj i ručne uredničke promjene se nikad ne prepisuju.
 */
export async function seedHalalHaramLesson(): Promise<void> {
  const existing = await db.execute(sql`
    SELECT id, nivo, locked
    FROM ilmihal_lekcije
    WHERE slug = ${slug}
    LIMIT 1
  `);

  // Ako je već na Nivou 2, ne vraćaj ručno promijenjen redoslijed na svakom bootu.
  if (existing.rows.length > 0 && Number(existing.rows[0].nivo) === 2) return;
  if (existing.rows.length > 0 && (Number(existing.rows[0].nivo) !== 3 || existing.rows[0].locked)) {
    throw new Error("Lekcija halal-haram nije slobodna za premještanje iz Nivoa 3");
  }

  const anchor = await db.execute(sql`
    SELECT redoslijed FROM ilmihal_lekcije
    WHERE slug = 'rodbina' AND nivo = 2
    LIMIT 1
  `);
  if (anchor.rows.length !== 1) throw new Error("Nedostaje lekcija 'Dužnosti prema rodbini' u Nivou 2");
  const order = Number(anchor.rows[0].redoslijed) + 1;
  const occupied = await db.execute(sql`
    SELECT id FROM ilmihal_lekcije
    WHERE nivo = 2 AND redoslijed = ${order} AND slug <> ${slug}
    LIMIT 1
  `);
  if (occupied.rows.length > 0) throw new Error("Mjesto iza 'Dužnosti prema rodbini' je već zauzeto");

  if (existing.rows.length > 0) {
    const moved = await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET nivo = 2, redoslijed = ${order}
      WHERE slug = ${slug} AND nivo = 3 AND locked = FALSE
      RETURNING id
    `);
    if (moved.rows.length !== 1) throw new Error("Lekcija halal-haram nije premještena");
    return;
  }

  await db.execute(sql`
    INSERT INTO ilmihal_lekcije (
      nivo, slug, naslov, content_html, redoslijed, is_published, locked,
      predmet, uvjeti_ids
    )
    VALUES (
      2, ${slug}, ${naslov}, ${halalHaramContentHtml}, ${order}, TRUE, FALSE,
      'Ibadet', '[]'::jsonb
    )
  `);
}