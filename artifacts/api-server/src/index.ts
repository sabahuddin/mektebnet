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
