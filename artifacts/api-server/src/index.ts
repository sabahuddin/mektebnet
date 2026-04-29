import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface DbExecResult<T = Record<string, unknown>> {
  rows: T[];
}
async function exec<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<DbExecResult<T>> {
  return (await db.execute(query)) as unknown as DbExecResult<T>;
}

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
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'file';`);
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS external_url TEXT;`);
    await db.execute(sql`ALTER TABLE prilozi ALTER COLUMN stored_name DROP NOT NULL;`);
    await db.execute(sql`ALTER TABLE prilozi ALTER COLUMN stored_name SET DEFAULT '';`);

    // Kolone koje su dodane u shemu, ali nisu u setup.ts CREATE statementu
    await db.execute(sql`ALTER TABLE ocjene ADD COLUMN IF NOT EXISTS lekcija_naziv VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS kviz_pitanja JSONB;`);

    // Tabele koje su dodane u shemu, ali nisu u setup.ts — kreiraj ih idempotentno
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kviz_rezultati (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        kviz_id INTEGER NOT NULL,
        kviz_naslov TEXT NOT NULL DEFAULT '',
        tacni_odgovori INTEGER NOT NULL DEFAULT 0,
        ukupno_pitanja INTEGER NOT NULL DEFAULT 0,
        procenat INTEGER NOT NULL DEFAULT 0,
        bodovi INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS posjete (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        path VARCHAR(500) NOT NULL DEFAULT '/',
        ip VARCHAR(100),
        country VARCHAR(100),
        city VARCHAR(200),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mekteb_kalendar (
        id SERIAL PRIMARY KEY,
        grupa_id INTEGER NOT NULL,
        muallim_id INTEGER NOT NULL,
        datum VARCHAR(20) NOT NULL,
        tip VARCHAR(20) NOT NULL DEFAULT 'mekteb',
        opis TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS plan_lekcija (
        id SERIAL PRIMARY KEY,
        grupa_id INTEGER NOT NULL,
        muallim_id INTEGER NOT NULL,
        datum VARCHAR(20) NOT NULL,
        lekcija_naslov VARCHAR(300) NOT NULL,
        lekcija_tip VARCHAR(50) NOT NULL DEFAULT 'ilmihal',
        redoslijed INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zadace (
        id SERIAL PRIMARY KEY,
        grupa_id INTEGER NOT NULL,
        muallim_id INTEGER NOT NULL,
        naslov VARCHAR(300) NOT NULL,
        opis TEXT,
        rok_do VARCHAR(20),
        lekcija_naslov VARCHAR(300),
        lekcija_tip VARCHAR(50),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    logger.info("Auto-migration: prilozi + rjecnik + ilmihal_lekcije lock + kviz_rezultati/posjete/mekteb_kalendar/plan_lekcija/zadace ready");

    // BOOTSTRAP: if ilmihal_lekcije is completely empty (fresh prod DB),
    // import the full dataset (~232 lessons) + rjecnik (~314 entries).
    // Idempotent: only runs when count = 0. ON CONFLICT (slug) DO NOTHING is safe.
    try {
      const cnt = await exec<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM ilmihal_lekcije`);
      const totalLekcije = Number(cnt.rows[0]?.c ?? 0);
      if (totalLekcije === 0) {
        logger.info("Empty ilmihal_lekcije detected — running FULL bootstrap import");
        const { FULL_LEKCIJE, FULL_RJECNIK } = await import("./routes/full-data-seed.js");
        let lekImported = 0;
        for (const l of FULL_LEKCIJE) {
          const quizJson = JSON.stringify(l.kviz_pitanja ?? null);
          const r = await exec<{ id: number }>(sql`
            INSERT INTO ilmihal_lekcije (nivo, slug, naslov, content_html, audio_src, redoslijed, is_published, kviz_pitanja)
            VALUES (${l.nivo}, ${l.slug}, ${l.naslov}, ${l.content_html}, ${l.audio_src}, ${l.redoslijed}, ${l.is_published}, ${quizJson}::jsonb)
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
          `);
          if (r.rows.length > 0) lekImported++;
        }
        let rjImported = 0;
        for (const r of FULL_RJECNIK) {
          const ins = await exec<{ id: number }>(sql`
            INSERT INTO rjecnik (rijec, definicija)
            VALUES (${r.rijec}, ${r.definicija})
            ON CONFLICT (rijec) DO NOTHING
            RETURNING id
          `);
          if (ins.rows.length > 0) rjImported++;
        }
        logger.info({ lekImported, rjImported }, "Full bootstrap import complete");
      }
    } catch (bootErr) {
      logger.error({ err: bootErr }, "Full bootstrap import failed");
    }

    // FILL-GAPS: even on non-empty DBs, INSERT any seed lessons whose slug doesn't exist.
    // Never updates or deletes anything. Safe to run on every start. Idempotent.
    try {
      const { FULL_LEKCIJE } = await import("./routes/full-data-seed.js");
      const existingSlugs = await exec<{ slug: string }>(sql`SELECT slug FROM ilmihal_lekcije`);
      const haveSet = new Set(existingSlugs.rows.map(r => r.slug));
      let gapInserted = 0;
      const insertedByNivo: Record<number, number> = {};
      for (const l of FULL_LEKCIJE) {
        if (haveSet.has(l.slug)) continue;
        const quizJson = JSON.stringify(l.kviz_pitanja ?? null);
        const r = await exec<{ id: number }>(sql`
          INSERT INTO ilmihal_lekcije (nivo, slug, naslov, content_html, audio_src, redoslijed, is_published, kviz_pitanja)
          VALUES (${l.nivo}, ${l.slug}, ${l.naslov}, ${l.content_html}, ${l.audio_src}, ${l.redoslijed}, ${l.is_published}, ${quizJson}::jsonb)
          ON CONFLICT (slug) DO NOTHING
          RETURNING id
        `);
        if (r.rows.length > 0) {
          gapInserted++;
          insertedByNivo[l.nivo] = (insertedByNivo[l.nivo] || 0) + 1;
        }
      }
      if (gapInserted > 0) {
        logger.info({ gapInserted, insertedByNivo }, "Fill-gaps: inserted missing lessons");
      }
    } catch (gapErr) {
      logger.error({ err: gapErr }, "Fill-gaps insert failed");
    }
  } catch (e) {
    logger.error({ err: e }, "Auto-migration failed");
  }

  // DISABLED 2026-04-21: backfillAllPripreme() je STRIPED novi dizajn pripreme
  // (gradient kartica + obojeni ciljevi) na nezaključanim lekcijama i prepisivao
  // ga sa starim dizajnom (table layout) iz pripreme-seed*.ts fajlova.
  // Korisnik je novi dizajn pravio direktno na produ ručno; nikad nije bio u seedu.
  // Re-enable TEK kad seedovi budu regenerirani sa novim dizajn HTML-om.
  //
  // try {
  //   const { backfillAllPripreme } = await import("./routes/pripreme-backfill.js");
  //   await backfillAllPripreme();
  // } catch (pripErr) {
  //   logger.error({ err: pripErr }, "Pripreme auto-backfill module load failed");
  // }
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
