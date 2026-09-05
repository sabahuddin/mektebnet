import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

interface UpdateResult {
  rows: { id: number }[];
}

async function backfillNivo(nivo: number, pripreme: Record<string, string>) {
  const slugs = Object.keys(pripreme);
  if (slugs.length === 0) return { added: 0, appended: 0 };

  // Step 1a: strip new-format priprema (marker-wrapped) — only for unlocked seed slugs
  await db.execute(sql`
    UPDATE ilmihal_lekcije
    SET content_html = regexp_replace(
      content_html,
      '<!--PRIPREMA-START-->[\\s\\S]*?<!--PRIPREMA-END-->',
      '',
      'g'
    )
    WHERE nivo = ${nivo}
      AND locked = false
      AND slug IN (${sql.join(slugs.map(s => sql`${s}`), sql`, `)})
      AND content_html LIKE '%PRIPREMA-START%'
  `);

  // Step 1b: strip old-format priprema (toggleSection('priprema'))
  await db.execute(sql`
    UPDATE ilmihal_lekcije
    SET content_html = regexp_replace(
      content_html,
      '\\s*<div class="lesson-accordion">\\s*<button[^<]*onclick="toggleSection\\(''priprema''[\\s\\S]*?</div>\\s*</div>\\s*</div>',
      ''
    )
    WHERE nivo = ${nivo}
      AND locked = false
      AND slug IN (${sql.join(slugs.map(s => sql`${s}`), sql`, `)})
      AND content_html ~ 'toggleSection\\(''priprema'''
  `);

  // Step 2: insert new priprema
  let added = 0;
  let appended = 0;
  for (const [slug, pripremaHtml] of Object.entries(pripreme)) {
    // 2a: insert before first lesson-accordion
    const replacement = pripremaHtml + '\n        <div class="lesson-accordion">';
    const upd = (await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET content_html = regexp_replace(
        content_html,
        '<div class="lesson-accordion">',
        ${replacement}
      )
      WHERE nivo = ${nivo}
        AND locked = false
        AND slug = ${slug}
        AND content_html !~ 'PRIPREMA-START'
        AND content_html ~ '<div class="lesson-accordion">'
      RETURNING id
    `)) as unknown as UpdateResult;
    if (upd.rows.length > 0) { added++; continue; }

    // 2b: fallback append before closing </div>
    const fallback = (await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET content_html = regexp_replace(
        content_html,
        '</div>\\s*$',
        ${'\n' + pripremaHtml + '\n</div>'}
      )
      WHERE nivo = ${nivo}
        AND locked = false
        AND slug = ${slug}
        AND content_html !~ 'PRIPREMA-START'
        AND content_html ~ '</div>\\s*$'
      RETURNING id
    `)) as unknown as UpdateResult;
    if (fallback.rows.length > 0) { appended++; continue; }

    // 2c: last-resort concat
    const lastResort = (await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET content_html = COALESCE(content_html, '') || ${'\n' + pripremaHtml}
      WHERE nivo = ${nivo}
        AND locked = false
        AND slug = ${slug}
        AND content_html !~ 'PRIPREMA-START'
      RETURNING id
    `)) as unknown as UpdateResult;
    if (lastResort.rows.length > 0) appended++;
  }
  return { added, appended };
}

export async function backfillAllPripreme() {
  try {
    const { NIVO1_PRIPREME } = await import("./pripreme-seed.js");
    const r1 = await backfillNivo(1, NIVO1_PRIPREME);
    if (r1.added > 0 || r1.appended > 0) {
      logger.info({ added: r1.added, appended: r1.appended }, "Pripreme N1 reinjected");
    }
  } catch (err) {
    logger.error({ err }, "Pripreme N1 backfill failed");
  }

  // Nivo 2 sadrži oba istorijska segmenta izvornog materijala.
  // Oba se u bazi trajno vode isključivo kao nivo=2.
  try {
    const { NIVO2_PRIPREME } = await import("./pripreme-seed-n2.js");
    const r2 = await backfillNivo(2, NIVO2_PRIPREME);
    if (r2.added > 0 || r2.appended > 0) {
      logger.info({ added: r2.added, appended: r2.appended }, "Pripreme N2 reinjected");
    }
  } catch (err) {
    logger.error({ err }, "Pripreme N2 backfill failed");
  }

  try {
    const { NIVO2_PRIPREME_DIO_A } = await import("./pripreme-seed-n2-dio-a.js");
    // Naziv seed fajla prati stari izvorni direktorij; DB nivo je uvijek 2.
    const total = await backfillNivo(2, NIVO2_PRIPREME_DIO_A);
    if (total.added > 0 || total.appended > 0) {
      logger.info(total, "Drugi segment priprema Nivoa 2 reinjected");
    }
  } catch (err) {
    logger.error({ err }, "Drugi segment priprema Nivoa 2 backfill failed");
  }

  try {
    const { NIVO3_PRIPREME } = await import("./pripreme-seed-n3.js");
    const r3 = await backfillNivo(3, NIVO3_PRIPREME);
    if (r3.added > 0 || r3.appended > 0) {
      logger.info({ added: r3.added, appended: r3.appended }, "Pripreme N3 reinjected");
    }
  } catch (err) {
    logger.error({ err }, "Pripreme N3 backfill failed");
  }
}
