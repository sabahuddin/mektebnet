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

// Schema bits NOT yet covered by Drizzle baseline (lib/db/drizzle/0000_*.sql).
// Everything previously here that IS in the baseline (prilozi, rjecnik,
// ilmihal_lekcije locks/kviz_pitanja, ocjene.lekcija_naziv,
// korisnik_napredak.time_spent_seconds, kviz_rezultati, posjete,
// mekteb_kalendar, plan_lekcija, zadace, zadace_ucenici, h5p_pokusaji,
// roditelj_ucenik_unique_idx, prilozi.kind/external_url, …) was removed in
// Task #86 — Drizzle migrate() is now the single source of truth for those.
//
// What remains here:
//   • game_sessions table + indexes + TIMESTAMPTZ fix (not in Drizzle schema)
//   • h5p_pokusaji indexes (table is in baseline, indexes are not)
//   • zadace_ucenici_ucenik_idx (table is in baseline, this index is not)
//
// When these get added to the Drizzle schema and a new migration file is
// generated, this whole function can disappear and only the data bootstrap
// below (a separate concern) will remain.
async function runResidualSchema() {
  try {
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
    // — server validira i računa score.
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

    // h5p_pokusaji indexes — tabela je u Drizzle baseline-u, indexi nisu.
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS h5p_pokusaji_unique_attempt_idx ON h5p_pokusaji (user_id, prilozi_id, attempt_no);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS h5p_pokusaji_user_prilog_idx ON h5p_pokusaji (user_id, prilozi_id);`);

    // zadace_ucenici — tabela je u Drizzle baseline-u BEZ unique/FK/index-a.
    // Originalni runMigrations() je imao `UNIQUE (zadaca_id, ucenik_id)` i
    // `REFERENCES zadace(id) ON DELETE CASCADE`. Bez unique-a moguće su
    // duplicirane dodjele zadaće istom učeniku; bez FK-a brisanje zadaće
    // ostavlja orphan redove. Dok ovo ne uđe u Drizzle schema + 0001_*.sql,
    // moramo to čuvati ovdje da spriječimo regresiju na svježim bazama.
    await db.execute(sql`CREATE INDEX IF NOT EXISTS zadace_ucenici_ucenik_idx ON zadace_ucenici (ucenik_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS zadace_ucenici_zadaca_ucenik_unique_idx ON zadace_ucenici (zadaca_id, ucenik_id);`);
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'zadace_ucenici_zadaca_id_fkey'
            AND conrelid = 'zadace_ucenici'::regclass
        ) THEN
          ALTER TABLE zadace_ucenici
            ADD CONSTRAINT zadace_ucenici_zadaca_id_fkey
            FOREIGN KEY (zadaca_id) REFERENCES zadace(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    logger.info("Residual schema (game_sessions + h5p indexes + zadace_ucenici constraints) ready");
  } catch (e) {
    logger.error({ err: e }, "Residual schema migration failed");
  }
}

// Data bootstrap (NOT schema). Idempotent: only inserts when content missing.
async function runDataBootstrap() {
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
  // Drizzle official migration system (Task #84) is now authoritative for the
  // schema. On existing prod DBs the bootstrap step fake-applies the baseline
  // (no SQL executed); a NEW migration file (0001_*.sql, 0002_*.sql, ...)
  // generated by `pnpm --filter @workspace/db generate` will be picked up
  // automatically. New schema changes flow through Drizzle ONLY — do not add
  // ALTER lines below.
  try {
    await bootstrapDrizzleMigrations();
    await runDrizzleMigrate();
  } catch (e) {
    // Drizzle migration failure is logged but does NOT block startup; the
    // residual schema below is best-effort idempotent and will create what
    // it can. A real prod incident here will be visible in logs.
    logger.error({ err: e }, "Drizzle migration system failed — continuing with residual schema");
  }

  await runResidualSchema();
  await runDataBootstrap();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

startup();
