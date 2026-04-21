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
    await db.execute(sql`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;`);
    await db.execute(sql`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;`);
    await db.execute(sql`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS locked_note TEXT;`);
    logger.info("Auto-migration: prilozi + rjecnik + lock columns ready");

    // BOOTSTRAP: if ilmihal_lekcije is completely empty (fresh prod DB),
    // import the full dataset (~232 lessons) + rjecnik (~314 entries).
    // Idempotent: only runs when count = 0. ON CONFLICT (slug) DO NOTHING is safe.
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
