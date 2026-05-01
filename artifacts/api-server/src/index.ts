import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "./lib/drizzle-migrate";

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
    // Anti-cheat gate (300s + scroll + sve sekcije): ukupno aktivno vrijeme
    // koje je učenik proveo na lekciji. Server radi MAX(stored, incoming) na
    // svakom POST /content/napredak. Bez ove kolone produkcija pada na 500
    // svaki put kad učenik klikne "Označi kao završeno".
    await db.execute(sql`ALTER TABLE korisnik_napredak ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0;`);

    // Unique index potreban za ON CONFLICT u /api/roditelj/link-dijete
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS roditelj_ucenik_unique_idx ON roditelj_ucenik (roditelj_id, ucenik_id);`);

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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zadace_ucenici (
        id SERIAL PRIMARY KEY,
        zadaca_id INTEGER NOT NULL REFERENCES zadace(id) ON DELETE CASCADE,
        ucenik_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (zadaca_id, ucenik_id)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS zadace_ucenici_ucenik_idx ON zadace_ucenici (ucenik_id);`);

    // GAMIFIKACIJA: sesije igara (Pamti par, Brzi kviz, ...)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_id VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        score INTEGER NOT NULL DEFAULT 0,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        allowed_duration_sec INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP
      );
    `);
    // FIX: started_at/ended_at su izvorno bili TIMESTAMP (without time zone),
    // pa ih je node-postgres vraćao bez TZ suffiksa ("2026-04-30 19:59:21.372402").
    // Klijentski `new Date(...)` to parsira kao LOKALNO vrijeme, što je u svakom
    // ne-UTC browseru pomicalo timer u prošlost (elapsed = TZ offset u sekundama)
    // i odmah okidalo onExpire. Migriramo na TIMESTAMPTZ — postojeće naive
    // vrijednosti tretiramo kao UTC (Postgres session TZ je GMT i u dev i u prod).
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='game_sessions' AND column_name='started_at'
            AND data_type='timestamp without time zone'
        ) THEN
          ALTER TABLE game_sessions
            ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC',
            ALTER COLUMN ended_at TYPE TIMESTAMPTZ USING ended_at AT TIME ZONE 'UTC';
        END IF;
      END $$;
    `);
    // Server-side scoring za quiz: spremamo cjelokupna pitanja sesije
    // (sa odgovorima) na strani servera. Klijent vraća samo izbor po questionId
    // — server validira i računa score. Bez ovoga klijent može poslati bilo
    // koji broj kao "score" i jedini guard je vremenski cheatCap.
    // JSONB sadrži [{ id, question, options, answer }] generirano u /games/start
    // (id je stabilan unutar sesije: q0, q1, ..., qN).
    await db.execute(sql`
      ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS quiz_questions JSONB
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS game_sessions_user_idx ON game_sessions (user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS game_sessions_user_status_idx ON game_sessions (user_id, status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS game_sessions_game_score_idx ON game_sessions (game_id, score);`);
    // Anti-cheat: jedna running sesija po korisniku — DB garancija (atomska).
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_one_running_idx ON game_sessions (user_id) WHERE status = 'running';`);
    // Optimizacija leaderboard query-ja (filter status='ended' + group by user, sort by score).
    await db.execute(sql`CREATE INDEX IF NOT EXISTS game_sessions_ended_user_score_idx ON game_sessions (game_id, user_id, score DESC) WHERE status = 'ended';`);

    // H5P pokušaji — interaktivne vježbe (Drag&Drop, Quiz, Fill-in-blanks, ...).
    // Server-side scoring: klijent šalje SAMO xAPI score+maxScore iz iframe-a,
    // server validira i računa hasanate sa multiplier-om (1.=100%, 2.=50%, 3+.=0%).
    // Unique (user_id, prilozi_id, attempt_no) sprječava double-submit istog
    // pokušaja kroz race conditions.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS h5p_pokusaji (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        prilozi_id INTEGER NOT NULL,
        attempt_no INTEGER NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        max_score INTEGER NOT NULL DEFAULT 0,
        procenat INTEGER NOT NULL DEFAULT 0,
        hasanat_gained INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS h5p_pokusaji_unique_attempt_idx ON h5p_pokusaji (user_id, prilozi_id, attempt_no);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS h5p_pokusaji_user_prilog_idx ON h5p_pokusaji (user_id, prilozi_id);`);

    logger.info("Auto-migration: prilozi + rjecnik + ilmihal_lekcije lock + kviz_rezultati/posjete/mekteb_kalendar/plan_lekcija/zadace + zadace_ucenici + game_sessions + h5p_pokusaji ready");

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

async function startup() {
  // Drizzle official migration system (Task #84): runs in PARALLEL with the
  // legacy runMigrations() ALTER list below. On existing prod DBs the
  // bootstrap step fake-applies the baseline (no SQL executed), so migrate()
  // becomes a no-op until a NEW migration file (0001_*.sql, 0002_*.sql, ...)
  // is generated by `pnpm --filter @workspace/db generate`. Going forward
  // schema changes only need a `generate` + commit + push; no need to add
  // ALTER lines to runMigrations() manually.
  try {
    await bootstrapDrizzleMigrations();
    await runDrizzleMigrate();
  } catch (e) {
    // Never block server startup on Drizzle migration system — legacy
    // runMigrations() below is still authoritative for existing schema.
    logger.error({ err: e }, "Drizzle migration system failed — continuing with legacy runMigrations()");
  }

  await runMigrations();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

startup();
