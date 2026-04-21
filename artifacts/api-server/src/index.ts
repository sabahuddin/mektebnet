import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS prilozi (
        id SERIAL PRIMARY KEY,
        lekcija_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name VARCHAR(300) NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rjecnik (
        id SERIAL PRIMARY KEY,
        rijec VARCHAR(200) NOT NULL UNIQUE,
        definicija TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Ensure kviz_pitanja column exists on ilmihal_lekcije (idempotent)
    await db.execute(sql`
      ALTER TABLE IF EXISTS ilmihal_lekcije
      ADD COLUMN IF NOT EXISTS kviz_pitanja JSONB
    `);
    logger.info("Auto-migration: prilozi + rjecnik + kviz_pitanja column ready");

    // BOOTSTRAP: if ilmihal_lekcije is completely empty (fresh prod DB),
    // import the full dataset (all nivoa, ~232 lessons) + rjecnik (~314 entries).
    // Idempotent: only runs when count = 0. Safe on already-populated DBs.
    try {
      const cnt: any = await db.execute(sql`SELECT COUNT(*)::int AS c FROM ilmihal_lekcije`);
      const totalLekcije = Number(cnt.rows?.[0]?.c ?? 0);
      if (totalLekcije === 0) {
        logger.info("Empty ilmihal_lekcije detected — running FULL bootstrap import");
        const { FULL_LEKCIJE, FULL_RJECNIK } = await import("./routes/full-data-seed.js");
        let lekImported = 0;
        for (const l of FULL_LEKCIJE) {
          const quizJson = JSON.stringify(l.kviz_pitanja ?? null);
          const r: any = await db.execute(sql`
            INSERT INTO ilmihal_lekcije (nivo, slug, naslov, content_html, audio_src, redoslijed, is_published, kviz_pitanja)
            VALUES (${l.nivo}, ${l.slug}, ${l.naslov}, ${l.content_html}, ${l.audio_src}, ${l.redoslijed}, ${l.is_published}, ${quizJson}::jsonb)
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
          `);
          if (r.rows && r.rows.length > 0) lekImported++;
        }
        let rjImported = 0;
        for (const r of FULL_RJECNIK) {
          const ins: any = await db.execute(sql`
            INSERT INTO rjecnik (rijec, definicija)
            VALUES (${r.rijec}, ${r.definicija})
            ON CONFLICT (rijec) DO NOTHING
            RETURNING id
          `);
          if (ins.rows && ins.rows.length > 0) rjImported++;
        }
        logger.info({ lekImported, rjImported }, "Full bootstrap import complete");
      }
    } catch (bootErr: any) {
      logger.error({ err: bootErr }, "Full bootstrap import failed");
    }

    // Auto-seed missing Nivo 1 lessons (idempotent by slug)
    try {
      const { MISSING_NIVO1_LESSONS } = await import("./routes/lekcije-seed.js");
      let added = 0;
      let quizUpdated = 0;
      for (const l of MISSING_NIVO1_LESSONS) {
        const quizJson = JSON.stringify((l as any).kviz_pitanja ?? null);
        const result: any = await db.execute(sql`
          INSERT INTO ilmihal_lekcije (nivo, slug, naslov, content_html, redoslijed, is_published, kviz_pitanja)
          VALUES (1, ${l.slug}, ${l.naslov}, ${l.content_html}, ${l.redoslijed}, true, ${quizJson}::jsonb)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `);
        if (result.rows && result.rows.length > 0) added++;
        // Backfill kviz_pitanja for previously inserted lessons that lack it
        if ((l as any).kviz_pitanja) {
          const upd: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET kviz_pitanja = ${quizJson}::jsonb
            WHERE slug = ${l.slug} AND kviz_pitanja IS NULL
            RETURNING id
          `);
          if (upd.rows && upd.rows.length > 0) quizUpdated++;
        }
      }
      if (added > 0) logger.info({ added }, "Auto-seeded missing Nivo 1 lessons");
      if (quizUpdated > 0) logger.info({ quizUpdated }, "Backfilled kviz_pitanja for Nivo 1 lessons");
    } catch (seedErr: any) {
      logger.error({ err: seedErr }, "Lesson auto-seed failed");
    }

    // Auto-backfill priprema-za-nastavu sections for Nivo 1 lessons.
    // Strategy: strip any existing priprema (old or new), then insert fresh
    // priprema as the FIRST accordion. Idempotent via marker comments.
    try {
      const { NIVO1_PRIPREME } = await import("./routes/pripreme-seed.js");
      const nivo1Slugs = Object.keys(NIVO1_PRIPREME);

      // Step 1a: strip new-format priprema (marker-wrapped) — scoped to Nivo 1 seed slugs only
      await db.execute(sql`
        UPDATE ilmihal_lekcije
        SET content_html = regexp_replace(
          content_html,
          '<!--PRIPREMA-START-->[\\s\\S]*?<!--PRIPREMA-END-->',
          '',
          'g'
        )
        WHERE nivo = 1
          AND slug IN (${sql.join(nivo1Slugs.map(s => sql`${s}`), sql`, `)})
          AND content_html LIKE '%PRIPREMA-START%'
      `);

      // Step 1b: strip old-format priprema (no markers, identified by toggleSection('priprema'))
      // Scoped to Nivo 1 seed slugs to avoid wiping pripreme in other levels
      await db.execute(sql`
        UPDATE ilmihal_lekcije
        SET content_html = regexp_replace(
          content_html,
          '\\s*<div class="lesson-accordion">\\s*<button[^<]*onclick="toggleSection\\(''priprema''[\\s\\S]*?</div>\\s*</div>\\s*</div>',
          ''
        )
        WHERE nivo = 1
          AND slug IN (${sql.join(nivo1Slugs.map(s => sql`${s}`), sql`, `)})
          AND content_html ~ 'toggleSection\\(''priprema'''
      `);

      // Step 2: insert new priprema BEFORE first existing lesson-accordion
      let pripremaAdded = 0;
      let pripremaAppended = 0;
      for (const [slug, pripremaHtml] of Object.entries(NIVO1_PRIPREME)) {
        // Try to insert before first lesson-accordion
        const replacement = pripremaHtml + '\n        <div class="lesson-accordion">';
        const upd: any = await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '<div class="lesson-accordion">',
            ${replacement}
          )
          WHERE slug = ${slug}
            AND content_html !~ 'PRIPREMA-START'
            AND content_html ~ '<div class="lesson-accordion">'
          RETURNING id
        `);
        if (upd.rows && upd.rows.length > 0) {
          pripremaAdded++;
          continue;
        }
        // Fallback: lesson has no accordion — append before closing lesson-container </div>
        const fallback: any = await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '</div>\\s*$',
            ${'\n' + pripremaHtml + '\n</div>'}
          )
          WHERE slug = ${slug}
            AND content_html !~ 'PRIPREMA-START'
            AND content_html ~ '</div>\\s*$'
          RETURNING id
        `);
        if (fallback.rows && fallback.rows.length > 0) pripremaAppended++;
        else {
          // Last resort: empty/non-conforming content — concat priprema unconditionally
          await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = COALESCE(content_html, '') || ${'\n' + pripremaHtml}
            WHERE slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
          `);
        }
      }
      if (pripremaAdded > 0 || pripremaAppended > 0) {
        logger.info({ pripremaAdded, pripremaAppended }, "Reinjected PRIPREMA ZA NASTAVU for Nivo 1");
      }
    } catch (pripremaErr: any) {
      logger.error({ err: pripremaErr }, "Priprema auto-backfill failed");
    }

    // Auto-backfill priprema-za-nastavu for Nivo 2 (same idempotent strategy)
    try {
      const { NIVO2_PRIPREME } = await import("./routes/pripreme-seed-n2.js");
      const nivo2Slugs = Object.keys(NIVO2_PRIPREME);
      if (nivo2Slugs.length > 0) {
        // Step 1a: strip new-format priprema (marker-wrapped) — scoped to Nivo 2 seed slugs only
        await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '<!--PRIPREMA-START-->[\\s\\S]*?<!--PRIPREMA-END-->',
            '',
            'g'
          )
          WHERE nivo = 2
            AND slug IN (${sql.join(nivo2Slugs.map(s => sql`${s}`), sql`, `)})
            AND content_html LIKE '%PRIPREMA-START%'
        `);

        // Step 1b: strip old-format priprema (no markers) for Nivo 2 seed slugs
        await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '\\s*<div class="lesson-accordion">\\s*<button[^<]*onclick="toggleSection\\(''priprema''[\\s\\S]*?</div>\\s*</div>\\s*</div>',
            ''
          )
          WHERE nivo = 2
            AND slug IN (${sql.join(nivo2Slugs.map(s => sql`${s}`), sql`, `)})
            AND content_html ~ 'toggleSection\\(''priprema'''
        `);

        // Step 2: insert new priprema BEFORE first existing lesson-accordion (with fallback append)
        let n2Added = 0;
        let n2Appended = 0;
        for (const [slug, pripremaHtml] of Object.entries(NIVO2_PRIPREME)) {
          const replacement = pripremaHtml + '\n        <div class="lesson-accordion">';
          const upd: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = regexp_replace(
              content_html,
              '<div class="lesson-accordion">',
              ${replacement}
            )
            WHERE nivo = 2
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
              AND content_html ~ '<div class="lesson-accordion">'
            RETURNING id
          `);
          if (upd.rows && upd.rows.length > 0) {
            n2Added++;
            continue;
          }
          const fallback: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = regexp_replace(
              content_html,
              '</div>\\s*$',
              ${'\n' + pripremaHtml + '\n</div>'}
            )
            WHERE nivo = 2
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
              AND content_html ~ '</div>\\s*$'
            RETURNING id
          `);
          if (fallback.rows && fallback.rows.length > 0) { n2Appended++; continue; }
          await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = COALESCE(content_html, '') || ${'\n' + pripremaHtml}
            WHERE nivo = 2
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
          `);
          n2Appended++;
        }
        if (n2Added > 0 || n2Appended > 0) {
          logger.info({ pripremaAdded: n2Added, pripremaAppended: n2Appended }, "Reinjected PRIPREMA ZA NASTAVU for Nivo 2");
        }
      }
    } catch (pripremaN2Err: any) {
      logger.error({ err: pripremaN2Err }, "Priprema Nivo 2 auto-backfill failed");
    }

    // Auto-backfill priprema-za-nastavu for Nivo 21 (UI-merged with Nivo 2 — "Srednji")
    try {
      const { NIVO21_PRIPREME } = await import("./routes/pripreme-seed-n21.js");
      const nivo21Slugs = Object.keys(NIVO21_PRIPREME);
      if (nivo21Slugs.length > 0) {
        // Step 1a: strip new-format priprema (marker-wrapped) — scoped to Nivo 21 seed slugs only
        await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '<!--PRIPREMA-START-->[\\s\\S]*?<!--PRIPREMA-END-->',
            '',
            'g'
          )
          WHERE nivo = 21
            AND slug IN (${sql.join(nivo21Slugs.map(s => sql`${s}`), sql`, `)})
            AND content_html LIKE '%PRIPREMA-START%'
        `);

        // Step 1b: strip old-format priprema (no markers) for Nivo 21 seed slugs
        await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '\\s*<div class="lesson-accordion">\\s*<button[^<]*onclick="toggleSection\\(''priprema''[\\s\\S]*?</div>\\s*</div>\\s*</div>',
            ''
          )
          WHERE nivo = 21
            AND slug IN (${sql.join(nivo21Slugs.map(s => sql`${s}`), sql`, `)})
            AND content_html ~ 'toggleSection\\(''priprema'''
        `);

        // Step 2: insert new priprema BEFORE first existing lesson-accordion (with fallback append)
        let n21Added = 0;
        let n21Appended = 0;
        for (const [slug, pripremaHtml] of Object.entries(NIVO21_PRIPREME)) {
          const replacement = pripremaHtml + '\n        <div class="lesson-accordion">';
          const upd: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = regexp_replace(
              content_html,
              '<div class="lesson-accordion">',
              ${replacement}
            )
            WHERE nivo = 21
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
              AND content_html ~ '<div class="lesson-accordion">'
            RETURNING id
          `);
          if (upd.rows && upd.rows.length > 0) {
            n21Added++;
            continue;
          }
          const fallback: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = regexp_replace(
              content_html,
              '</div>\\s*$',
              ${'\n' + pripremaHtml + '\n</div>'}
            )
            WHERE nivo = 21
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
              AND content_html ~ '</div>\\s*$'
            RETURNING id
          `);
          if (fallback.rows && fallback.rows.length > 0) { n21Appended++; continue; }
          // Last-resort fallback: just concat for very short / malformed lessons
          const lastResort: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = content_html || ${'\n' + pripremaHtml}
            WHERE nivo = 21
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
            RETURNING id
          `);
          if (lastResort.rows && lastResort.rows.length > 0) n21Appended++;
        }
        if (n21Added > 0 || n21Appended > 0) {
          logger.info({ pripremaAdded: n21Added, pripremaAppended: n21Appended }, "Reinjected PRIPREMA ZA NASTAVU for Nivo 21 (UI Nivo 2)");
        }
      }
    } catch (pripremaN21Err: any) {
      logger.error({ err: pripremaN21Err }, "Priprema Nivo 21 auto-backfill failed");
    }

    // Auto-backfill priprema-za-nastavu for Nivo 3 (100 lessons)
    try {
      const { NIVO3_PRIPREME } = await import("./routes/pripreme-seed-n3.js");
      const nivo3Slugs = Object.keys(NIVO3_PRIPREME);
      if (nivo3Slugs.length > 0) {
        // Step 1a: strip new-format priprema (marker-wrapped) — scoped to Nivo 3 seed slugs only
        await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '<!--PRIPREMA-START-->[\\s\\S]*?<!--PRIPREMA-END-->',
            '',
            'g'
          )
          WHERE nivo = 3
            AND slug IN (${sql.join(nivo3Slugs.map(s => sql`${s}`), sql`, `)})
            AND content_html LIKE '%PRIPREMA-START%'
        `);

        // Step 1b: strip old-format priprema (no markers) for Nivo 3 seed slugs
        await db.execute(sql`
          UPDATE ilmihal_lekcije
          SET content_html = regexp_replace(
            content_html,
            '\\s*<div class="lesson-accordion">\\s*<button[^<]*onclick="toggleSection\\(''priprema''[\\s\\S]*?</div>\\s*</div>\\s*</div>',
            ''
          )
          WHERE nivo = 3
            AND slug IN (${sql.join(nivo3Slugs.map(s => sql`${s}`), sql`, `)})
            AND content_html ~ 'toggleSection\\(''priprema'''
        `);

        // Step 2: insert new priprema BEFORE first existing lesson-accordion (with fallback append)
        let n3Added = 0;
        let n3Appended = 0;
        for (const [slug, pripremaHtml] of Object.entries(NIVO3_PRIPREME)) {
          const replacement = pripremaHtml + '\n        <div class="lesson-accordion">';
          const upd: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = regexp_replace(
              content_html,
              '<div class="lesson-accordion">',
              ${replacement}
            )
            WHERE nivo = 3
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
              AND content_html ~ '<div class="lesson-accordion">'
            RETURNING id
          `);
          if (upd.rows && upd.rows.length > 0) {
            n3Added++;
            continue;
          }
          const fallback: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = regexp_replace(
              content_html,
              '</div>\\s*$',
              ${'\n' + pripremaHtml + '\n</div>'}
            )
            WHERE nivo = 3
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
              AND content_html ~ '</div>\\s*$'
            RETURNING id
          `);
          if (fallback.rows && fallback.rows.length > 0) { n3Appended++; continue; }
          const lastResort: any = await db.execute(sql`
            UPDATE ilmihal_lekcije
            SET content_html = content_html || ${'\n' + pripremaHtml}
            WHERE nivo = 3
              AND slug = ${slug}
              AND content_html !~ 'PRIPREMA-START'
            RETURNING id
          `);
          if (lastResort.rows && lastResort.rows.length > 0) n3Appended++;
        }
        if (n3Added > 0 || n3Appended > 0) {
          logger.info({ pripremaAdded: n3Added, pripremaAppended: n3Appended }, "Reinjected PRIPREMA ZA NASTAVU for Nivo 3");
        }
      }
    } catch (pripremaN3Err: any) {
      logger.error({ err: pripremaN3Err }, "Priprema Nivo 3 auto-backfill failed");
    }
  } catch (e: any) {
    logger.error({ err: e }, "Auto-migration failed");
  }
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
