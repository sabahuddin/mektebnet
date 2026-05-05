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
//   • korisnik_napredak.last_heartbeat_at + dedupe + unique index
//     (Task #75: column added to schema after baseline 0000_*.sql was generated;
//     unique index needed for ON CONFLICT in /api/content/heartbeat upsert).
//
// When these get added to the Drizzle schema and a new migration file is
// generated, this whole function can disappear and only the data bootstrap
// below (a separate concern) will remain.
async function runResidualSchema() {
  try {
    // 4. uslov anti-cheat gate-a (mini-kviz "Provjeri znanje"): timestamp
    // kada je učenik tačno odgovorio na sva pitanja iz `kvizPitanja` polja
    // lekcije. Kolona je dodata u Drizzle schemu (`korisnikNapredakTable.quizPassedAt`)
    // ali još nije u baseline migraciji (`lib/db/drizzle/0000_*.sql`), pa
    // ovdje stoji idempotentni ALTER da postojeće baze (dev + prod) dobiju
    // kolonu na boot-u. Kad se sljedeća Drizzle migracija generiše s ovom
    // kolonom, ovaj ALTER se može ukloniti.
    await db.execute(sql`ALTER TABLE korisnik_napredak ADD COLUMN IF NOT EXISTS quiz_passed_at TIMESTAMP;`);

    // Task #75 — server-side heartbeat anti-cheat:
    // Razlika NOW() - last_heartbeat_at (cap 15s) inkrementira time_spent_seconds.
    // Klijentski timeSpentSeconds se više ne koristi za ilmihal gate (cheat fix).
    await db.execute(sql`ALTER TABLE korisnik_napredak ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP;`);

    // Dedupe + unique index na (user_id, content_type, content_id):
    // Ranije je read-then-write bez constraint-a teoretski mogao kreirati
    // duplikate u racu. Heartbeat traffic (10s) povećava šanse za rac, pa
    // čistimo postojeće duplikate (zadržavamo red sa najvećim time_spent_seconds,
    // tie-breaker max id) i postavljamo unique index. ON CONFLICT u heartbeat
    // upsertu tada radi atomski insert-or-update.
    await db.execute(sql`
      DELETE FROM korisnik_napredak a
      USING korisnik_napredak b
      WHERE a.user_id = b.user_id
        AND a.content_type = b.content_type
        AND a.content_id = b.content_id
        AND (
          a.time_spent_seconds < b.time_spent_seconds
          OR (a.time_spent_seconds = b.time_spent_seconds AND a.id < b.id)
        );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS korisnik_napredak_user_content_unique_idx
      ON korisnik_napredak (user_id, content_type, content_id);
    `);

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

    // pitanja_banka.meta — jsonb kolona za interaktivne tipove (dragDrop, markWords).
    // Definisana je u Drizzle schema/content.ts, ali nije generisan novi migration
    // file (banka tabela nije u Drizzle baseline-u — kreirana ranije van Drizzle-a).
    // Stoga ovdje idempotentno dodajemo kolonu da se produkcija auto-update-a.
    await db.execute(sql`ALTER TABLE pitanja_banka ADD COLUMN IF NOT EXISTS meta jsonb;`);

    // pitanja_banka — partial UNIQUE indeksi za dedup. Prethodna verzija je
    // imala globalni UNIQUE(pitanje), što je za interaktivne tipove (dragDrop,
    // markWords) gubilo desetine varijanti jer ista generička pitanja kao
    // "Dopuni:" i "Pronađi greške:" imaju 40+ varijanti sa različitim meta.
    // Drizzle ne podržava `WHERE` na uniqueIndex pa se kreira raw SQL-om ovdje.
    await db.execute(sql`DROP INDEX IF EXISTS pitanja_banka_pitanje_unique_idx;`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS pitanja_banka_pitanje_std_unique_idx
        ON pitanja_banka(pitanje)
        WHERE vrsta NOT IN ('dragDrop','markWords');
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS pitanja_banka_pitanje_meta_unique_idx
        ON pitanja_banka(pitanje, md5(meta::text))
        WHERE vrsta IN ('dragDrop','markWords');
    `);

    // === MIGRATION 0006 CATCH-UP (idempotentno) ===
    // Produkcijska baza je u partial state — Drizzle migrate() pada na 0002
    // (push_tokens već postoji), pa migracija 0006 nikad ne stigne primijeniti
    // nove kvizovi kolone i obavještenja tabelu. Ovdje ih osiguravamo idempotentno
    // tako da SELECT iz /api/content/kvizovi (koji referencira sve te kolone)
    // ne puca sa "column does not exist". Bezbjedno za pokretanje na svaki start.
    await db.execute(sql`ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS kategorija varchar(60);`);
    await db.execute(sql`ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS lekcija_id integer;`);
    await db.execute(sql`ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS opis text DEFAULT '' NOT NULL;`);
    await db.execute(sql`ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS pitanja_po_sesiji integer;`);
    await db.execute(sql`ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true NOT NULL;`);

    // obavještenja tabela (muallim → roditelji/grupa). Iz migracije 0006.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS obavjestenja (
        id serial PRIMARY KEY NOT NULL,
        muallim_id integer NOT NULL,
        grupa_id integer,
        naslov varchar(200) NOT NULL,
        sadrzaj text NOT NULL,
        slika_url text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS obavjestenja_muallim_idx ON obavjestenja (muallim_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS obavjestenja_grupa_idx ON obavjestenja (grupa_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS obavjestenja_created_idx ON obavjestenja (created_at);`);

    // kviz_pitanja join tabela (M:N kviz↔banka). Iz migracije 0006. Većina
    // produkcija je već imala — IF NOT EXISTS čuva netaknuto.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kviz_pitanja (
        id serial PRIMARY KEY NOT NULL,
        kviz_id integer NOT NULL,
        pitanje_id integer NOT NULL,
        redoslijed integer DEFAULT 0 NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS kviz_pitanja_kviz_pitanje_unique_idx ON kviz_pitanja (kviz_id, pitanje_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kviz_pitanja_kviz_redoslijed_idx ON kviz_pitanja (kviz_id, redoslijed);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS kviz_pitanja_pitanje_idx ON kviz_pitanja (pitanje_id);`);

    // pitanja_banka indeksi iz migracije 0006 (tabela već postoji od ranije).
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitanja_banka_kategorija_idx ON pitanja_banka (kategorija);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS pitanja_banka_lekcija_idx ON pitanja_banka (lekcija_id);`);

    logger.info("Residual schema (game_sessions + h5p indexes + zadace_ucenici constraints + pitanja_banka.meta + partial unique idx + 0006 catch-up: kvizovi cols + obavjestenja + kviz_pitanja + pitanja_banka idx) ready");
  } catch (e) {
    logger.error({ err: e }, "Residual schema migration failed");
  }
}

// Data bootstrap (NOT schema). Produkcija je jedini izvor istine za sadržaj.
// NIKAKAV seed, backup, ili auto-restore ne smije dirati content_html lekcija.
async function runDataBootstrap() {
  // BANKA PITANJA: prebaci sva kvizovska pitanja iz `kvizovi.pitanja` JSONB-a
  // u centralnu `pitanja_banka` + napravi `kviz_pitanja` veze. Idempotentno
  // (ON CONFLICT DO NOTHING/UPDATE), pa je sigurno pokretati na svaki start.
  // Na produkciji prvi put — uvozi cca 2400 pitanja uključujući dragDrop i markWords.
  try {
    const { migratePitanjaUBanku } = await import("@workspace/scripts/migrate-pitanja-u-banku");
    const r = await migratePitanjaUBanku({ silent: true });
    logger.info(
      {
        ukupnoBanka: r.ukupnoBanka,
        ukupnoVeza: r.ukupnoVeza,
        novihVeza: r.vezaInserted,
        kvizova: r.kvizoviSaPitanjima,
      },
      "Banka pitanja: migracija iz JSONB-a završena (idempotentno)"
    );
  } catch (bankaErr) {
    logger.error({ err: bankaErr }, "Banka pitanja: migracija iz JSONB-a neuspjela (non-fatal)");
  }

  // ČITAONICA CLEANUP (idempotentno) — eksplicitno odobreno od strane user-a:
  //   1. Brisanje duplikata "Ilmihal za djecu" (postojala su 2 zapisa: id=1 slug
  //      'knjiga-ilmihal' i id=12 slug 'ilmihal'). Čitaonica je samo za priče,
  //      ilmihal sadržaj je već dostupan kroz /ilmihal modul.
  //   2. Adem prvi (redoslijed=0) — kao prvi poslanik u hronologiji priča.
  //   3. Cover-image putanja prebačena u public/ bundle za 6 slika koje su
  //      ranije imale tekst/brojeve/lažnu kaligrafiju. Nove čiste slike su
  //      committed u artifacts/mekteb-arapsko-pismo/public/citaonica/.
  //      Update se dešava SAMO ako cover_image pokazuje na staru /api/uploads/
  //      putanju (ili je null) — ne prepisuje custom uploadanu sliku.
  //
  // SVE TRI operacije su idempotentne (rerun safe).
  try {
    await db.execute(sql`DELETE FROM knjige WHERE slug IN ('knjiga-ilmihal', 'ilmihal');`);
    await db.execute(sql`UPDATE knjige SET redoslijed = 0 WHERE slug = 'adem' AND redoslijed <> 0;`);
    // Egzaktno matchovanje stare seed putanje da NE prepiše custom uploadane slike
    // (admin upload kroz multer pravi jedinstvene nazive fajlova). Sve 12 priča
    // sad imaju cover slike u public/ bundle-u — ne ovisi o /api/uploads/ volume mountu.
    await db.execute(sql`
      UPDATE knjige
      SET cover_image = '/citaonica/' || slug || '.png'
      WHERE slug IN (
              'adem', 'musa', 'nuh', 'sulejman', 'ismail',
              'muhammed-2-poslanstvo-do-hidzre',
              'ibrahim', 'isa', 'davud', 'jusuf',
              'muhammed-1-djetinjstvo', 'muhammed-3-medinski-period'
            )
        AND (
              cover_image IS NULL
              OR cover_image = '/api/uploads/citaonica/' || slug || '.png'
              OR cover_image = '/uploads/citaonica/' || slug || '.png'
            );
    `);
    logger.info("Čitaonica cleanup: Ilmihal duplicates removed, Adem prvi, regenerated covers updated");
  } catch (e) {
    logger.error({ err: e }, "Čitaonica cleanup failed (non-fatal)");
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

  // Misije seed: ubaci default dnevne/sedmične misije ako tabela prazna.
  // Idempotentno preko UNIQUE (kod) — postojeće misije se NE prepisuju.
  try {
    const { seedMisije } = await import("./routes/misije.js");
    await seedMisije();
  } catch (e) {
    logger.error({ err: e }, "Misije seed import failed");
  }

  try {
    const { startMissionReminderCron } = await import("./lib/mission-reminder-cron.js");
    startMissionReminderCron();
  } catch (e) {
    logger.error({ err: e }, "Mission reminder cron start failed");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

startup();
