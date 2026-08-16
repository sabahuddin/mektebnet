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

    // zadace.naslov — sada opcionalan (nova UX koristi lekciju kao naziv).
    // Stare baze imaju NOT NULL; drop constraint idempotentno.
    await db.execute(sql`ALTER TABLE zadace ALTER COLUMN naslov DROP NOT NULL;`);

    // zadace_status — status zadaće po učeniku (muallim pregleda iz jednog
    // panela za cijelu grupu). Jedan red po (zadaca, ucenik). Nepostojeći red
    // ili status='na_cekanju' => zadaća na čekanju (nepregledana).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zadace_status (
        id serial PRIMARY KEY,
        zadaca_id integer NOT NULL,
        ucenik_id integer NOT NULL,
        uradjeno boolean NOT NULL DEFAULT false,
        ocjena integer,
        kapi_meda integer NOT NULL DEFAULT 0,
        novi_rok varchar(20),
        prolong_count integer NOT NULL DEFAULT 0,
        status varchar(20) NOT NULL DEFAULT 'na_cekanju',
        reviewed_at timestamp,
        muallim_id integer,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS zadace_status_zadaca_ucenik_uidx ON zadace_status (zadaca_id, ucenik_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS zadace_status_ucenik_idx ON zadace_status (ucenik_id);`);
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'zadace_status_zadaca_id_fkey'
            AND conrelid = 'zadace_status'::regclass
        ) THEN
          ALTER TABLE zadace_status
            ADD CONSTRAINT zadace_status_zadaca_id_fkey
            FOREIGN KEY (zadaca_id) REFERENCES zadace(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // ocjene.zadaca_id — kada muallim da ocjenu iz zadaće, ona se evidentira
    // i u tabeli ocjene. Veza na zadaću omogućava idempotentni upsert (re-ocjena
    // ne duplira red). Partial unique index važi samo za ocjene iz zadaće.
    await db.execute(sql`ALTER TABLE ocjene ADD COLUMN IF NOT EXISTS zadaca_id integer;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ocjene_zadaca_ucenik_uidx ON ocjene (zadaca_id, ucenik_id) WHERE zadaca_id IS NOT NULL;`);

    // grupe.datum_pocetka / datum_kraja — datumi mektebske godine za grupu.
    // Definisani u Drizzle schema/mekteb.ts; idempotentno dodajemo na svaki
    // start da se produkcija auto-update-a bez ručne migracije.
    await db.execute(sql`ALTER TABLE grupe ADD COLUMN IF NOT EXISTS datum_pocetka date;`);
    await db.execute(sql`ALTER TABLE grupe ADD COLUMN IF NOT EXISTS datum_kraja date;`);

    // pitanja_banka.meta — jsonb kolona za interaktivne tipove (dragDrop, markWords).
    // Definisana je u Drizzle schema/content.ts, ali nije generisan novi migration
    // file (banka tabela nije u Drizzle baseline-u — kreirana ranije van Drizzle-a).
    // Stoga ovdje idempotentno dodajemo kolonu da se produkcija auto-update-a.
    await db.execute(sql`ALTER TABLE pitanja_banka ADD COLUMN IF NOT EXISTS meta jsonb;`);

    // ilmihal_lekcije.predmet — kolona za pedagošku oblast (Akaid, Ahlak,
    // Ibadat, ...). Koristi se za dropdown filter na "Sve lekcije". Vrijednosti
    // su prvi put backfill-ovane iz priprema HTML-a (Predmet</div><div>VALUE</div>),
    // a dalje ih admin direktno mijenja kroz UI. Idempotentno na svaki start.
    await db.execute(sql`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS predmet varchar(60);`);
    await db.execute(sql`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS uvjeti_ids JSONB NOT NULL DEFAULT '[]'::jsonb;`);
    // Jednokratni backfill: popuni predmet iz content_html-a samo za redove
    // gdje je predmet NULL (preskače već postavljene). POSIX regex hvata
    // vrijednost između <div>Predmet</div> i sljedećeg <div>...</div>.
    await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET predmet = trim(substring(content_html from 'Predmet</div>[[:space:]]*<div[^>]*>([^<]+)</div>'))
      WHERE predmet IS NULL
        AND content_html ~ 'Predmet</div>'
    `);

    // === NORMALIZACIJA PREDMETA NA NPP STRUKTURU (idempotentno) ===
    // Nastavni plan i program (NPP, 2017) definiše 6 oblasti. Prikazni nazivi:
    // Kiraet, Vjerovanje (Akaid), Ibadet i praksa (Fikh), Ahlak, Historija
    // islama + "Ostali sadržaji". Zatečene zbrkane i
    // kombinovane vrijednosti (Ibadat, Ibadat / Fikh, Kur'an, Vjeronauka...) se
    // sažimaju u te kanonske kategorije da dropdown na "Sve lekcije" ne bude
    // prevelik. Idempotentno: nakon prvog prolaza stare vrijednosti više ne
    // postoje pa su naredni prolazi no-op.
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Ibadet i praksa' WHERE predmet IN ('Ibadat', 'Ibadat / Fikh');`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Kiraet' WHERE predmet IN ('Kur''an', 'Kur’an');`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Vjerovanje' WHERE predmet IN ('Akaid/Ahlak', 'Akaid/Ibadat');`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Historija islama' WHERE predmet = 'Vjeronauka/Historija';`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Ostali sadržaji' WHERE predmet IN ('Vjeronauka', 'Vjeronauka/Kultura', 'Kultura i tradicija');`);
    // Catch-up rename: već normalizovani podaci (raniji redeploy) sa starim
    // nazivima Fikh/Akaid → novi prikazni nazivi. Idempotentno.
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Ibadet i praksa' WHERE predmet='Fikh';`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Vjerovanje' WHERE predmet='Akaid';`);

    // Dodjela predmeta lekcijama bez oblasti (predmet IS NULL), po slug-u.
    // NULL-guard: ne dira lekcije kojima je admin već postavio predmet, pa
    // ručne izmjene ne budu pregažene na sljedećem redeployu. Medaljon-lekcije
    // (slug medaljon-nivo%) NAMJERNO ostaju bez predmeta — nisu nastavni sadržaj.
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Ibadet i praksa' WHERE predmet IS NULL AND slug IN ('abdeski-sarti', 'namaski-sarti', 'dova-poslije-ezana', 'mubarek-dani', 'dzenaza-namaz', 'gusul', 'post-propisi', 'sunneti-namaz');`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Vjerovanje' WHERE predmet IS NULL AND slug = 'dinski-sarti';`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Ahlak' WHERE predmet IS NULL AND slug IN ('cestitost', 'ljubav-poslusnost-roditelji', 'radne-navike', 'alkohol');`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Historija islama' WHERE predmet IS NULL AND slug = 'mevlud';`);
    await db.execute(sql`UPDATE ilmihal_lekcije SET predmet='Ostali sadržaji' WHERE predmet IS NULL AND slug IN ('bajramske-aktivnosti', 'uvodna-rijec', 'uvodna-rijec-nivo-2', 'uvodna-rijec-nivo-3');`);

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
    await db.execute(sql`ALTER TABLE kvizovi ADD COLUMN IF NOT EXISTS tagovi jsonb DEFAULT '[]'::jsonb NOT NULL;`);
    await db.execute(sql`ALTER TABLE pitanja_banka ADD COLUMN IF NOT EXISTS tagovi jsonb DEFAULT '[]'::jsonb NOT NULL;`);

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

    // Presence/screentime — kolone na users tabeli za live indikator + total time.
    // Heartbeat endpoint (POST /api/aktivnost/heartbeat) ažurira ova polja.
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamp;`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_screentime_sec integer NOT NULL DEFAULT 0;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users (last_seen_at);`);

    // Probni period za self-registration. Login dozvoljen ako je
    // `is_active=true` (admin odobrio pretplatu) ILI `trial_until > now`
    // (probnih 7 dana još nije isteklo).
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_until timestamp;`);

    // Prilozi catch-up (idempotent). Tabela prilozi je nastala prije Drizzle
    // baseline-a (0000_*.sql) na nekim okruženjima, pa migration tracker ne
    // dodaje kolone iz baseline-a. Bez ovoga POST /api/admin/prilozi/:id
    // pada sa 500 ("column does not exist") jer schema/INSERT očekuju
    // kind/external_url/approved/uploaded_by_*. Idempotent ALTER pokriva
    // svaki slučaj. Defaults odgovaraju Drizzle schemi.
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS kind varchar(20) NOT NULL DEFAULT 'file';`);
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS external_url text;`);
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;`);
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS uploaded_by_role varchar(20);`);
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS uploaded_by_user_id integer;`);
    // hasanat_reward — kapi meda koje učenik dobija kad klikne "Završio sam"
    // na embed vježbi (LearningApps, Wordwall, Quizizz...). Admin postavlja
    // pri dodavanju/uređivanju. Dozvoljene vrijednosti: 0, 3, 5, 10.
    // Default 0 = bez nagrade (nazad-kompatibilno za stare embedove).
    // Reward se daje SAMO jednom po (student, prilog) — vidi embed_completions.
    await db.execute(sql`ALTER TABLE prilozi ADD COLUMN IF NOT EXISTS hasanat_reward integer NOT NULL DEFAULT 0;`);
    // Stored_name/file_size/mime_type imaju defaults u baseline-u; dodaj
    // defaults i ovdje za svaki slučaj (NOT NULL bez defaulta = INSERT pada).
    await db.execute(sql`ALTER TABLE prilozi ALTER COLUMN stored_name SET DEFAULT '';`);
    await db.execute(sql`ALTER TABLE prilozi ALTER COLUMN file_size SET DEFAULT 0;`);
    await db.execute(sql`ALTER TABLE prilozi ALTER COLUMN mime_type SET DEFAULT 'application/octet-stream';`);

    // embed_completions — audit + anti-double-claim za embed vježbe.
    // Učenik može klikom "Završio sam" zatražiti hasanate SAMO jednom po
    // (student_id, prilozi_id). Unique index garantuje atomski guard.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS embed_completions (
        id serial PRIMARY KEY,
        student_id varchar(120) NOT NULL,
        prilozi_id integer NOT NULL,
        hasanat_gained integer NOT NULL DEFAULT 0,
        completed_at timestamp DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS embed_completions_student_prilozi_uidx ON embed_completions (student_id, prilozi_id);`);

    // Dozvoljeni su max 2 odobrena roditelja po učeniku (razvedeni roditelji).
    // Stari unique indeks (roditelj_ucenik_one_approved_per_ucenik_idx) je
    // uklonjen jer blokira drugi roditeljski profil. Dropujemo ga idempotentno.
    try {
      await db.execute(sql`
        DROP INDEX IF EXISTS roditelj_ucenik_one_approved_per_ucenik_idx;
      `);
    } catch (err) {
      logger.warn("[residual-schema] roditelj_ucenik drop old unique idx failed", err);
    }

        // Ocjene sadržaja (5 pčelica) — jedna aktivna ocjena po (user, tip, id).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ocjene_sadrzaja (
        id serial PRIMARY KEY,
        user_id integer NOT NULL,
        tip_sadrzaja varchar(32) NOT NULL,
        sadrzaj_id integer NOT NULL,
        ocjena integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW(),
        updated_at timestamp NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ocjene_sadrzaja_user_tip_id_uidx ON ocjene_sadrzaja (user_id, tip_sadrzaja, sadrzaj_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS ocjene_sadrzaja_by_content_idx ON ocjene_sadrzaja (tip_sadrzaja, sadrzaj_id);`);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ocjene_sadrzaja_ocjena_check') THEN
          ALTER TABLE ocjene_sadrzaja ADD CONSTRAINT ocjene_sadrzaja_ocjena_check CHECK (ocjena BETWEEN 1 AND 5);
        END IF;
      END $$;
    `);

    // Arhiviranje grupa (muallim) — grupa se ne briše nego arhivira; učenici
    // se oslobode, a snapshot članstva ostaje u grupe_arhiva_clanovi.
    await db.execute(sql`ALTER TABLE grupe ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;`);
    await db.execute(sql`ALTER TABLE grupe ADD COLUMN IF NOT EXISTS archived_at timestamp;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grupe_arhiva_clanovi (
        id serial PRIMARY KEY,
        grupa_id integer NOT NULL,
        ucenik_id integer NOT NULL,
        display_name varchar(255),
        username varchar(100),
        archived_at timestamp NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`ALTER TABLE grupe_arhiva_clanovi ADD COLUMN IF NOT EXISTS display_name varchar(255);`);
    await db.execute(sql`ALTER TABLE grupe_arhiva_clanovi ADD COLUMN IF NOT EXISTS username varchar(100);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS grupe_arhiva_clanovi_grupa_ucenik_uidx ON grupe_arhiva_clanovi (grupa_id, ucenik_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grupe_arhiva_clanovi_grupa_idx ON grupe_arhiva_clanovi (grupa_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grupe_arhiva_clanovi_ucenik_idx ON grupe_arhiva_clanovi (ucenik_id);`);

    // Kviz kategorije (admin-definisane). Tabela + idempotent seed iz
    // KVIZ_KATEGORIJE_META ako je tabela prazna (prvi start nakon migracije).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kviz_kategorije (
        id serial PRIMARY KEY,
        slug varchar(60) NOT NULL UNIQUE,
        naziv varchar(120) NOT NULL,
        ikona varchar(16),
        redoslijed integer NOT NULL DEFAULT 100,
        created_at timestamp DEFAULT NOW()
      );
    `);
    const { KVIZ_KATEGORIJE_META: KK_META } = await import("@workspace/db/schema");
    const seedRows = Object.entries(KK_META).map(([slug, meta], idx) => ({
      slug, naziv: meta.naziv, ikona: meta.ikona, redoslijed: (idx + 1) * 10,
    }));
    for (const r of seedRows) {
      await db.execute(sql`
        INSERT INTO kviz_kategorije (slug, naziv, ikona, redoslijed)
        VALUES (${r.slug}, ${r.naziv}, ${r.ikona}, ${r.redoslijed})
        ON CONFLICT (slug) DO NOTHING;
      `);
    }

    // Kviz tagovi (admin-definisani, vezani za glavnu kategoriju). Tabela +
    // idempotent seed iz KVIZ_TAGOVI/MAP/META ako tag još ne postoji.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kviz_tagovi (
        id serial PRIMARY KEY,
        slug varchar(60) NOT NULL UNIQUE,
        naziv varchar(120) NOT NULL,
        kategorija varchar(60) NOT NULL,
        redoslijed integer NOT NULL DEFAULT 100,
        created_at timestamp DEFAULT NOW()
      );
    `);
    const {
      KVIZ_TAGOVI: KT_SLUGS,
      KVIZ_TAG_KATEGORIJA_MAP: KT_MAP,
      KVIZ_TAGOVI_META: KT_META,
    } = await import("@workspace/db/schema");
    let tagIdx = 0;
    for (const slug of KT_SLUGS) {
      tagIdx++;
      await db.execute(sql`
        INSERT INTO kviz_tagovi (slug, naziv, kategorija, redoslijed)
        VALUES (${slug}, ${KT_META[slug] ?? slug}, ${KT_MAP[slug]}, ${tagIdx * 10})
        ON CONFLICT (slug) DO NOTHING;
      `);
    }

    // === Task #126 — Etape i krunisanje nivoa ==================================
    // Proširenja medaljona (završni ispit etape) + nove tabele za polaganja,
    // krunisanja, krunske lekcije i student passage. Vidi schema/lessons.ts.
    await db.execute(sql`ALTER TABLE medaljoni ADD COLUMN IF NOT EXISTS kviz_pitanja_ids jsonb NOT NULL DEFAULT '[]'::jsonb;`);
    await db.execute(sql`ALTER TABLE medaljoni ADD COLUMN IF NOT EXISTS prag_prolaza_percent integer NOT NULL DEFAULT 70;`);
    await db.execute(sql`ALTER TABLE medaljoni ADD COLUMN IF NOT EXISTS is_gating boolean NOT NULL DEFAULT true;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS etapa_polaganja (
        id serial PRIMARY KEY,
        student_id varchar(100) NOT NULL,
        medaljon_id integer NOT NULL,
        broj_tacnih integer NOT NULL DEFAULT 0,
        broj_pitanja integer NOT NULL DEFAULT 0,
        procenat integer NOT NULL DEFAULT 0,
        polozeno boolean NOT NULL DEFAULT false,
        pokusaj_br integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS etapa_polaganja_student_med_pokusaj_idx ON etapa_polaganja (student_id, medaljon_id, pokusaj_br);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS etapa_polaganja_student_polozeno_idx ON etapa_polaganja (student_id, medaljon_id, polozeno);`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS krunisanja (
        id serial PRIMARY KEY,
        nivo integer NOT NULL UNIQUE,
        naslov text NOT NULL DEFAULT '',
        opis_html text NOT NULL DEFAULT '',
        ikona varchar(32) NOT NULL DEFAULT 'crown',
        boja varchar(16) NOT NULL DEFAULT 'amber',
        kviz_pitanja_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        prag_prolaza_percent integer NOT NULL DEFAULT 70,
        is_gating boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS krunisanje_lekcije (
        id serial PRIMARY KEY,
        krunisanje_id integer NOT NULL,
        slug varchar(100) NOT NULL UNIQUE,
        naslov text NOT NULL,
        content_html text NOT NULL DEFAULT '',
        redoslijed integer NOT NULL DEFAULT 0,
        is_published boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS krunisanje_lekcije_krunisanje_idx ON krunisanje_lekcije (krunisanje_id, redoslijed);`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS student_krunisanja (
        id serial PRIMARY KEY,
        student_id varchar(100) NOT NULL,
        krunisanje_id integer NOT NULL,
        broj_tacnih integer NOT NULL DEFAULT 0,
        broj_pitanja integer NOT NULL DEFAULT 0,
        procenat integer NOT NULL DEFAULT 0,
        polozeno_at timestamp NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS student_krunisanja_unique_idx ON student_krunisanja (student_id, krunisanje_id);`);
    // Seed: po jedan red krunisanja za nivoe 1, 2, 3 ako ne postoje. Admin
    // ih kasnije popunjava (naslov, opis, pitanja). Bez seeda admin UI mora
    // raditi UPSERT što komplikuje frontend.
    await db.execute(sql`
      INSERT INTO krunisanja (nivo, naslov, opis_html)
      VALUES
        (1, 'Krunisanje Male košnice', ''),
        (2, 'Krunisanje Zlatne košnice', ''),
        (3, 'Hatma košnica', '')
      ON CONFLICT (nivo) DO NOTHING;
    `);
    // Preimenuj stari naziv ako postoji u prod bazi (idempotentno).
    await db.execute(sql`
      UPDATE krunisanja SET naslov='Hatma košnica'
       WHERE nivo=3 AND naslov IN ('Krunisanje Košnice mudrosti','Krunisanje Hatma košnice');
    `);
    // Medaljoni za nivo 2 i 3 — 7 etapa po nivou (pos 10..70), bojama uparenim
    // s temom košnice. PNG ikone su već u public/medaljoni/nivo{2,3}-{10..70}-lekcija.png.
    await db.execute(sql`
      INSERT INTO medaljoni (nivo, slug, naziv, opis, pos_after_redoslijed, ikona, boja)
      VALUES
        (2, 'm2-1-sakupljac',  'Sakupljač nektara',     '10 lekcija Nivoa 2 — sakupljaš nektar znanja.', 10, 'medal', 'amber'),
        (2, 'm2-2-graditelj',  'Graditelj saća',        '20 lekcija Nivoa 2 — gradiš saće mudrosti.',    20, 'medal', 'orange'),
        (2, 'm2-3-putnik',     'Cvjetni putnik',        '30 lekcija Nivoa 2 — putuješ kroz cvjetna polja znanja.', 30, 'medal', 'yellow'),
        (2, 'm2-4-strazar',    'Stražar košnice',       '40 lekcija Nivoa 2 — stražariš nad zlatnom košnicom.', 40, 'medal', 'amber'),
        (2, 'm2-5-majstor',    'Majstor zlatnog meda',  '50 lekcija Nivoa 2 — pravi majstor zlatnog meda.', 50, 'medal', 'orange'),
        (2, 'm2-6-radilica',   'Vrijedna radilica',     '60 lekcija Nivoa 2 — vrijedna pčela radilica.', 60, 'medal', 'yellow'),
        (2, 'm2-7-kraljica',   'Kraljica Zlatne košnice','70 lekcija Nivoa 2 — kraljica Zlatne košnice!', 70, 'medal', 'amber'),
        (3, 'm3-1-istrazivac', 'Mudri istraživač',      '10 lekcija Nivoa 3 — istražuješ mudrost.',      10, 'medal', 'violet'),
        (3, 'm3-2-ucitelj',    'Učitelj mladih',        '20 lekcija Nivoa 3 — učiš druge.',              20, 'medal', 'orange'),
        (3, 'm3-3-pjesnik',    'Pjesnik košnice',       '30 lekcija Nivoa 3 — pjesnik zlatnih saća.',    30, 'medal', 'yellow'),
        (3, 'm3-4-astronom',   'Astronom polja',        '40 lekcija Nivoa 3 — poznaješ zvijezde i polja.', 40, 'medal', 'violet'),
        (3, 'm3-5-hafiz',      'Hafiz nektara',         '50 lekcija Nivoa 3 — pamtiš sve riznice znanja.', 50, 'medal', 'orange'),
        (3, 'm3-6-mudrac',     'Mudrac saća',           '60 lekcija Nivoa 3 — mudrac među pčelama.',     60, 'medal', 'yellow'),
        (3, 'm3-7-kralj',      'Kralj Košnice mudrosti','70 lekcija Nivoa 3 — kralj Košnice mudrosti!',  70, 'medal', 'violet')
      ON CONFLICT (slug) DO NOTHING;
    `);
    // Nivo 1 — 6 novih m1-* medaljona (pos 10..60) sa PNG ikonama.
    // Prod baza ima stare slugove (prvi-koraci, putnik, polovina-puta, ustrajni,
    // prva-kosnica) koji nemaju PNG ikone — čistimo ih i ubacujemo nove.
    await db.execute(sql`
      INSERT INTO medaljoni (nivo, slug, naziv, opis, pos_after_redoslijed, ikona, boja)
      VALUES
        (1, 'm1-pocetnik',   'Pčelica početnik',    '10 lekcija Nivoa 1 — prvi let pčelice.',         10, 'medal', 'bronze'),
        (1, 'm2-radilica',   'Marljiva pčela',      '20 lekcija Nivoa 1 — marljivo sakupljaš znanje.', 20, 'medal', 'bronze'),
        (1, 'm3-istrazivac', 'Istraživač cvijeća',  '30 lekcija Nivoa 1 — istražuješ cvjetna polja.',  30, 'medal', 'bronze'),
        (1, 'm4-cuvar',      'Čuvar košnice',       '40 lekcija Nivoa 1 — čuvaš košnicu znanja.',      40, 'medal', 'bronze'),
        (1, 'm5-mudrac',     'Mudra pčela',         '50 lekcija Nivoa 1 — mudrost te vodi naprijed.',  50, 'medal', 'bronze'),
        (1, 'm6-majstor',    'Majstor meda',        '60 lekcija Nivoa 1 — majstor zlatnog meda.',      60, 'medal', 'bronze')
      ON CONFLICT (slug) DO NOTHING;
    `);
    // Očisti stare Nivo 1 medaljone (bez PNG ikona). Najprije ukloni FK reference.
    await db.execute(sql`
      DELETE FROM student_medaljoni WHERE medaljon_id IN (
        SELECT id FROM medaljoni WHERE nivo=1 AND slug NOT IN
          ('m1-pocetnik','m2-radilica','m3-istrazivac','m4-cuvar','m5-mudrac','m6-majstor')
      );
    `);
    await db.execute(sql`
      DELETE FROM etapa_polaganja WHERE medaljon_id IN (
        SELECT id FROM medaljoni WHERE nivo=1 AND slug NOT IN
          ('m1-pocetnik','m2-radilica','m3-istrazivac','m4-cuvar','m5-mudrac','m6-majstor')
      );
    `);
    await db.execute(sql`
      DELETE FROM medaljoni WHERE nivo=1 AND slug NOT IN
        ('m1-pocetnik','m2-radilica','m3-istrazivac','m4-cuvar','m5-mudrac','m6-majstor');
    `);
    // Tematska boja po nivou: Nivo 1 = bronzana, Nivo 2 = srebrena, Nivo 3 = zlatna.
    await db.execute(sql`UPDATE medaljoni SET boja='bronze' WHERE nivo=1 AND boja <> 'bronze';`);
    await db.execute(sql`UPDATE medaljoni SET boja='silver' WHERE nivo=2 AND boja <> 'silver';`);
    await db.execute(sql`UPDATE medaljoni SET boja='gold' WHERE nivo=3 AND boja <> 'gold';`);

    // === Mekteb (škola) iznad muallima ========================================
    // Glavni (admin) muallim, kreiranje muallimskih naloga, limit po paketu,
    // zbirna statistika mekteba. Idempotentne kolone (dosad ručno preko psql).
    await db.execute(sql`ALTER TABLE muallim_profili ADD COLUMN IF NOT EXISTS is_glavni boolean DEFAULT false NOT NULL;`);
    await db.execute(sql`ALTER TABLE mektebi ADD COLUMN IF NOT EXISTS glavni_muallim_id integer;`);
    await db.execute(sql`ALTER TABLE mektebi ADD COLUMN IF NOT EXISTS dozvoljeno_muallima integer DEFAULT 1 NOT NULL;`);
    // Dozvoljeni jezici po muallimu (učenici prate svog muallima). Default su svi
    // jezici uključeni — admin po potrebi ISKLJUČUJE pojedine. Bosanski je uvijek
    // osnovni i ostaje dostupan bez obzira na sadržaj niza.
    await db.execute(sql`ALTER TABLE muallim_profili ADD COLUMN IF NOT EXISTS dozvoljeni_jezici jsonb NOT NULL DEFAULT '["bs","sq","de","en","tr","ar"]'::jsonb;`);

    // Mekteb-nivo PDF dokumenti (pravila, kućni red...) — glavni muallim uploaduje,
    // učenici i roditelji čitaju.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mekteb_dokumenti (
        id serial PRIMARY KEY NOT NULL,
        mekteb_id integer NOT NULL,
        naziv varchar(200) NOT NULL,
        opis text,
        original_name text NOT NULL,
        stored_name varchar(300) NOT NULL,
        file_size integer DEFAULT 0 NOT NULL,
        mime_type varchar(100) DEFAULT 'application/pdf' NOT NULL,
        uploaded_by_user_id integer,
        created_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS mekteb_dokumenti_mekteb_idx ON mekteb_dokumenti (mekteb_id);`);

    // Faza 2 — višejezični SADRŽAJ (ne UI). Additivna tabela: bosanski original
    // se NIKAD ne mijenja, prijevodi žive ovdje. `izvor_hash` = SHA-256 bosanskog
    // izvora u trenutku prijevoda → kad se original izmijeni, hash se ne poklapa
    // i prevodna obrada zna da taj red treba ponovo prevesti (inkrementalno).
    // Overlay na serve-time: GET rute preklope `prijevod` po `X-Lang` headeru sa
    // fallbackom na bosanski. Vidi routes/translations + lib/content-translatable.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS content_prijevodi (
        id serial PRIMARY KEY NOT NULL,
        tabela varchar(60) NOT NULL,
        red_id integer NOT NULL,
        polje varchar(60) NOT NULL,
        jezik varchar(5) NOT NULL,
        prijevod text NOT NULL,
        izvor_hash varchar(64) NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS content_prijevodi_uniq ON content_prijevodi (tabela, red_id, polje, jezik);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS content_prijevodi_lookup_idx ON content_prijevodi (tabela, jezik, red_id);`);

    // ui_prijevodi — runtime override za UI/interfejs prijevode (locales/*.json su
    // bundlani u build pa se ne mogu mijenjati bez rebuilda). Admin ekran upisuje
    // override po (jezik, kljuc=bosanski izvorni tekst) → frontend ga učita preko
    // javnog endpointa i t() ga primijeni PRVO (prije bundlanog locale rječnika).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ui_prijevodi (
        id serial PRIMARY KEY NOT NULL,
        jezik varchar(5) NOT NULL,
        kljuc text NOT NULL,
        prijevod text NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS ui_prijevodi_uniq ON ui_prijevodi (jezik, kljuc);`);

    // Sekundarni muallimi po grupi — jedna grupa može biti dodijeljena više muallima.
    // Primarni muallim ostaje grupe.muallim_id (vlasnik/odgovorni);
    // sekundarni dobijaju read+write pristup ali ne mogu brisati/arhivirati grupu.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grupa_muallimi (
        id serial PRIMARY KEY,
        grupa_id integer NOT NULL,
        muallim_id integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS grupa_muallimi_uidx ON grupa_muallimi (grupa_id, muallim_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grupa_muallimi_muallim_idx ON grupa_muallimi (muallim_id);`);

    // Zvjezdice — classroom management (ponašanje i rad na času).
    // Dvije vrste: 'pozitivna' (žuta) i 'negativna' (crna). Svaki zapis = jedna
    // dodijeljena zvjezdica od muallima. Totali se računaju aggregacijom.
    // Vidljivo: muallim (CRUD), roditelj (čitanje), učenik (čitanje).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zvjezdice_log (
        id serial PRIMARY KEY,
        ucenik_id integer NOT NULL,
        muallim_id integer NOT NULL,
        tip varchar(20) NOT NULL,
        razlog text,
        created_at timestamp NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS zvjezdice_log_ucenik_idx ON zvjezdice_log (ucenik_id, created_at DESC);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS zvjezdice_log_muallim_idx ON zvjezdice_log (muallim_id);`);

    logger.info("Residual schema (game_sessions + h5p indexes + zadace_ucenici constraints + pitanja_banka.meta + partial unique idx + 0006 catch-up: kvizovi cols + obavjestenja + kviz_pitanja + pitanja_banka idx + presence + prilozi catch-up + Task#126 etape/krunisanje + mekteb is_glavni/glavni_muallim_id/dozvoljeno_muallima + muallim dozvoljeni_jezici + mekteb_dokumenti + grupa_muallimi + zvjezdice_log) ready");
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

  // NASLOVI KNJIGA — UJEDNAČAVANJE "a.s." (idempotentno): vjerovjesnici su
  // "Ime, a.s." ali Muhammed koristi arapski simbol ﷺ ("Muhammed ﷺ – ...").
  // User traži da SVE bude "a.s.". Jedinstvena regex hvata sve počasne oblike:
  //   - ﷺ (U+FDFA salawat ligatura),
  //   - pisani salawat "صلى الله عليه وسلم",
  //   - pisani salam "عليه/عليهم/عليها/عليهما السلام",
  // i (uz eventualni vodeći zarez/razmak) zamjenjuje ih s ", a.s." → "Muhammed, a.s.".
  // Postojeći "Ime, a.s." nemaju arapski pa ostaju netaknuti (idempotentno).
  try {
    await db.execute(sql`
      UPDATE knjige
      SET naslov = regexp_replace(
        naslov,
        '[,\\s]*(ﷺ|صلى\\s+الله\\s+عليه\\s+وسلم|عليه(م|ا|ها|هما)?\\s+السلام)',
        ', a.s.',
        'g'
      )
      WHERE naslov ~ 'ﷺ|السلام|وسلم';
    `);
    await db.execute(sql`
      UPDATE knjige
      SET naslov = btrim(regexp_replace(naslov, '\\s{2,}', ' ', 'g'))
      WHERE naslov LIKE '%  %';
    `);
    logger.info("Naslovi knjiga: arapski počasni oblici (ﷺ/salawat/salam) ujednačeni na 'a.s.' (idempotentno)");
  } catch (e) {
    logger.error({ err: e }, "Naslovi knjiga a.s. normalizacija failed (non-fatal)");
  }

  // KATEGORIJE ČITAONICE BOOTSTRAP (idempotentno):
  //   1. CREATE TABLE IF NOT EXISTS — admin-definisane grupe priča.
  //      `knjige.kategorija` referencira `kategorije_knjige.slug` (nema FK constrainta;
  //      konvencija — orphan-i se grupišu pod "Bez kategorije" na frontendu).
  //   2. INSERT default kategorija ('prica' i 'ostalo') ON CONFLICT DO NOTHING —
  //      'prica' je glavna grupa za priče o vjerovjesnicima i defaultno otvorena,
  //      'ostalo' je za sve ostalo (npr. hadis za djecu, ahlak teme...) i defaultno zatvorena.
  //   3. Admin može kroz /admin/citaonica > "Kategorije" dodati nove grupe.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kategorije_knjige (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(50) NOT NULL UNIQUE,
        naziv VARCHAR(120) NOT NULL,
        opis TEXT,
        redoslijed INTEGER NOT NULL DEFAULT 100,
        default_open BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      INSERT INTO kategorije_knjige (slug, naziv, opis, redoslijed, default_open)
      VALUES
        ('prica', 'Priče o vjerovjesnicima', 'Životne priče poslanika u hronološkom redu.', 0, TRUE),
        ('ostalo', 'Ostale knjige', 'Hadis za djecu, ahlak teme, dove i druge islamske teme.', 999, FALSE)
      ON CONFLICT (slug) DO NOTHING;
    `);
    logger.info("Kategorije Čitaonice bootstrap: tabela + default seed (prica, ostalo)");
  } catch (e) {
    logger.error({ err: e }, "Kategorije Čitaonice bootstrap failed (non-fatal)");
  }

  // GRUPA RASPORED BOOTSTRAP (idempotentno): per-grupa redoslijed lekcija.
  //   - Ako grupa nema redove za nivo → koristi se globalni redoslijed (default).
  //   - Ako ima → student te grupe vidi/otključava lekcije po `pozicija`.
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grupa_raspored (
        id SERIAL PRIMARY KEY,
        grupa_id INTEGER NOT NULL,
        nivo INTEGER NOT NULL,
        lekcija_id INTEGER NOT NULL,
        pozicija INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS grupa_raspored_grupa_lekcija_unique_idx
        ON grupa_raspored (grupa_id, lekcija_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS grupa_raspored_grupa_nivo_idx
        ON grupa_raspored (grupa_id, nivo, pozicija);
    `);
    logger.info("Grupa raspored bootstrap: tabela + indeksi");
  } catch (e) {
    logger.error({ err: e }, "Grupa raspored bootstrap failed (non-fatal)");
  }

  // ILMIHAL CLEANUP + UVODNE RIJEČI (idempotentno) — eksplicitno odobreno od strane user-a:
  //   1. Brisanje 4 duplikata/test lekcija koje "su se pojavile odnekud":
  //      Nivo 1: 'lekcija-01' (LEKCIJA 1: IMANSKI ŠARTI), 'tesbih' (sve malim slovima)
  //      Nivo 2: 'amentu-billahi' (CAPS, redoslijed=105 — duplikat 'mentu-billahi'),
  //              've-melaiketihi' (CAPS, redoslijed=155 — duplikat 've-melaikethi')
  //   2. Nivo 1 'uvodna-rijec' — zamjena starog HTML-a (sa PRIPREMA-START akordionom
  //      i btn-wow kvizom) sa kratkim motivacionim tekstom. Idempotentno: UPDATE
  //      se izvršava SAMO ako stari HTML još uvijek sadrži PRIPREMA marker.
  //   3. Nivo 2 'uvodna-rijec-nivo-2' i Nivo 3 'uvodna-rijec-nivo-3' — INSERT ON
  //      CONFLICT (slug) DO NOTHING. Postavljaju se na redoslijed=0. Locked=true
  //      odmah da budu zaštićene od auto-skripti.
  try {
    await db.execute(sql`
      DELETE FROM ilmihal_lekcije
      WHERE (nivo = 1 AND slug IN ('lekcija-01', 'tesbih'))
         OR (nivo = 2 AND slug IN ('amentu-billahi', 've-melaiketihi'));
    `);

    // Note: NE wrap-ovati u <div class="lesson-container"> niti koristiti <h1>!
    // CSS u index.css (.ilmihal-content .lesson-container i h1:first-child)
    // ima `display: none` jer React parsuje strukturu klasično za akordion-bazirane lekcije.
    // Naša jednostavna uvodna riječ koristi RjecnikContent fallback render — pa direktno
    // p/div elementi koji su djeca .ilmihal-content moraju biti na root nivou.
    // Naslov "Uvodna riječ" se već prikazuje kao naslov stranice iznad (lekcija.naslov).
    const uvodnaNivo1Html = `<p class="lesson-text">
  Esselamu alejkum, draga djeco! Dobro došli u mekteb i u svoj prvi <strong>Ilmihal</strong>. Ova knjiga bit će vaš drug i vodič kroz prelijepi svijet naše vjere islama.
</p>
<p class="lesson-text">
  Zajedno ćemo učiti o našem Stvoritelju, Allahu, dž.š., o našem Poslaniku Muhammedu, sallallahu alejhi ve sellem, i o tome kako da postanemo dobri, čestiti i sretni ljudi.
</p>
<div class="info-box">
  Mekteb nije samo mjesto gdje učimo lekcije. To je mjesto gdje sklapamo nova prijateljstva, gdje se smijemo i gdje učimo kako da jedni drugima budemo podrška na putu dobra.
</div>
<p class="lesson-text">
  Roditelji, hvala vam što ste poveli svoju djecu na ovaj lijepi put. Vaša podrška, lijepa riječ i zajedničko ponavljanje naučenog kod kuće znače djeci više nego što mislite.
</p>
<p class="lesson-text">
  Neka nam ovi prvi koraci budu hairli i sretni. Bismillah, krećemo!
</p>
<div class="arabic-card">
  <p style="font-style: italic; color: var(--primary); font-weight: 700;">
    "Traženje znanja je obaveza svakog muslimana i muslimanke."
  </p>
  <p style="font-size: 0.9rem; margin-top: 10px; color: #94a3b8;">(Hadis)</p>
</div>`;

    await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET content_html = ${uvodnaNivo1Html},
          locked = true,
          locked_at = COALESCE(locked_at, NOW()),
          locked_note = COALESCE(locked_note, 'Boot cleanup: cleaned old PRIPREMA accordion + kviz button')
      WHERE nivo = 1
        AND slug = 'uvodna-rijec'
        AND (content_html LIKE '%PRIPREMA-START%'
             OR content_html LIKE '%hero-box%'
             OR content_html LIKE '%lesson-accordion%'
             OR content_html LIKE '%lesson-container%');
    `);

    const uvodnaNivo2Html = `<p class="lesson-text">
  Esselamu alejkum, dragi učenici i poštovani roditelji!
</p>
<p class="lesson-text">
  Pred vama je drugi dio našeg ilmihala. Velika je radost vidjeti vas opet u mektebu — sa malo više godina, malo više iskustva, ali sa istim onim sjajem u očima koji ima svaki musliman kad uči o svojoj vjeri.
</p>
<p class="lesson-text">
  Ako ste prošli prvi nivo, već znate koliko je islam lijep i koliko Allah, dž.š., voli one koji uče. Sada krećemo dalje. U ovoj knjizi upoznat ćete neke od najvećih ljudi koji su ikada hodali Zemljom — Allahove poslanike. Naučit ćete kako su živjeli, šta su govorili i šta nas je Allah preko njih podučio.
</p>
<p class="lesson-text">
  Učit ćete i osnovne stvari naše vjere: u koga vjerujemo i kako svoja vjerovanja čuvamo u srcu. Sve to nije teško — treba samo dobra namjera, malo strpljenja i lijepo druženje sa knjigom.
</p>
<div class="info-box">
  Roditelji, vaša podrška djeci u ovom uzrastu znači više nego što mislite. Pitajte ih šta su naučili, slušajte ih dok prepričavaju kazivanja o poslanicima — to su trenuci koje će pamtiti cijeli život.
</div>
<div class="arabic-card">
  <p style="font-style: italic; color: var(--primary); font-weight: 700;">
    "Ko krene putem na kojem traži znanje, Allah će mu olakšati put u Džennet."
  </p>
  <p style="font-size: 0.9rem; margin-top: 10px; color: #94a3b8;">(Hadis)</p>
</div>
<p class="lesson-text">
  Neka vam Allah, dž.š., podari berićet u učenju. Bismillah, krećemo!
</p>`;

    const uvodnaNivo3Html = `<p class="lesson-text">
  Esselamu alejkum, dragi učenici i cijenjeni roditelji!
</p>
<p class="lesson-text">
  Dobrodošli u treći nivo ilmihala. Ovo je posebna knjiga — knjiga za one koji su ozbiljno krenuli putem znanja i koji svoju vjeru žele bolje razumjeti, ne samo zapamtiti.
</p>
<p class="lesson-text">
  U ovom nivou nećete samo naučiti šta je naša obaveza prema Allahu — naučit ćete i zašto. Upoznat ćete dublje značenje imanskih šartova, naučit ćete kratke sure iz Kur'ana i razumjeti riječi koje nosite u srcu kad klanjate.
</p>
<p class="lesson-text">
  Naš Poslanik, sallallahu alejhi ve sellem, kazao je da su učenjaci nasljednici poslanika. To znači da svaki put kad otvorite ovu knjigu, vi koračate stazom kojom su koračali najbolji ljudi historije. Velika je to čast, ali i odgovornost — sve što naučite, postaje dio onoga što ćete jednog dana prenijeti drugima: svojoj braći, sestrama, prijateljima, a inšaAllah i svojoj djeci.
</p>
<div class="info-box">
  Roditelji, djeca u ovom uzrastu počinju razmišljati svojom glavom i postavljati prava pitanja. Budite im prvi i najljepši odgovor. Razgovarajte sa njima o onome što uče, dijelite primjere iz svog života, neka vide da vjera nije samo lekcija — vjera je način života.
</div>
<div class="arabic-card">
  <p style="font-style: italic; color: var(--primary); font-weight: 700;">
    "Reci: Gospodaru moj, Ti znanje moje proširi!"
  </p>
  <p style="font-size: 0.9rem; margin-top: 10px; color: #94a3b8;">(Sura Ta-Ha, 114)</p>
</div>
<p class="lesson-text">
  Neka Allah, dž.š., učini ovo učenje korisnim, a srca naša ispuni ljubavlju prema znanju i Njemu, dž.š. Bismillah!
</p>`;

    // INSERT sa redoslijed=-10 da uvodne riječi budu GARANTOVANO prve.
    // Frontend (content.ts:38) sortira samo po `asc(redoslijed)` bez tie-break po id —
    // ako više lekcija ima isti redoslijed, poredak je nedefinisan. Negativan
    // broj (-10) garantuje da uvodna riječ uvijek bude prva, bez obzira što
    // postojeća prva lekcija nivoa već ima redoslijed=0.
    await db.execute(sql`
      INSERT INTO ilmihal_lekcije (nivo, slug, naslov, content_html, redoslijed, is_published, locked, locked_at, locked_note)
      VALUES
        (2, 'uvodna-rijec-nivo-2', 'Uvodna riječ', ${uvodnaNivo2Html}, -10, true, true, NOW(), 'Boot insert: motivirajuća uvodna riječ za Nivo 2'),
        (3, 'uvodna-rijec-nivo-3', 'Uvodna riječ', ${uvodnaNivo3Html}, -10, true, true, NOW(), 'Boot insert: motivirajuća uvodna riječ za Nivo 3')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Idempotentni UPDATE redoslijed=-10 za uvodne riječi Nivo 2 i 3.
    // Pokriva slučaj kad su prethodno unijete sa redoslijed=0 (prva verzija boot scripta).
    // WHERE redoslijed != -10 — drugi restart neće raditi UPDATE.
    await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET redoslijed = -10
      WHERE nivo IN (2, 3)
        AND slug IN ('uvodna-rijec-nivo-2', 'uvodna-rijec-nivo-3')
        AND redoslijed != -10;
    `);

    // Idempotentni UPDATE za Nivo 2 i Nivo 3 uvodne riječi — ako su prethodno unijete
    // sa starim wrapped HTML-om (lesson-container/h1 koji bi bili display:none zbog
    // .ilmihal-content CSS pravila), prepisuju se sa čistim flat HTML-om.
    // Match samo ako sadrži stari wrapper — drugi restart neće raditi UPDATE jer marker više neće postojati.
    await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET content_html = ${uvodnaNivo2Html}
      WHERE nivo = 2
        AND slug = 'uvodna-rijec-nivo-2'
        AND content_html LIKE '%lesson-container%';
    `);
    await db.execute(sql`
      UPDATE ilmihal_lekcije
      SET content_html = ${uvodnaNivo3Html}
      WHERE nivo = 3
        AND slug = 'uvodna-rijec-nivo-3'
        AND content_html LIKE '%lesson-container%';
    `);

    logger.info("Ilmihal cleanup: 4 duplicate lessons deleted, Nivo 1 uvodna-rijec replaced (if old), Nivo 2 + Nivo 3 uvodne riječi inserted (redoslijed=-10)");
  } catch (e) {
    logger.error({ err: e }, "Ilmihal cleanup failed (non-fatal)");
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

// DEMO USER BOOTSTRAP (idempotentno) — eksplicitno traženo od korisnika:
//   `demo-uspjeh` / `demo123` — učenik koji je završio sve (sve lekcije, svi
//   bedževi, svi medaljoni, sva krunisanja). Koristi se za demo/screenshot-ove
//   gornjeg dijela mape (krunski medaljon, krunisanje). Lookup-uje lekcije /
//   medaljone / krunisanja iz baze pa radi na bilo kojem env-u bez hard-coded
//   ID-jeva. grupa_id/muallim_id/mekteb_id ostaju NULL — admin dodijeli.
//   Šifra je bcrypt hash od 'demo123' (cost 10).
async function seedDemoUspjeh() {
  try {
    await db.execute(sql`
      INSERT INTO users (username, email, password_hash, display_name, role, is_active, trial_until)
      VALUES (
        'demo-uspjeh',
        'demo-uspjeh@mekteb.local',
        '$2b$10$aNe7X/kMlpgDPX9x1RPVyerMpGw4IwmpugpP1wKQvadaE2AH4V6ZW',
        'Demo Uspjeh',
        'ucenik',
        true,
        NULL
      )
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        is_active = true,
        trial_until = NULL,
        display_name = EXCLUDED.display_name;
    `);

    await db.execute(sql`
      DO $$
      DECLARE
        uid INT;
        today_str TEXT := to_char(now(), 'YYYY-MM-DD');
        all_lesson_ids INT[];
        med RECORD;
        kr RECORD;
      BEGIN
        SELECT id INTO uid FROM users WHERE username = 'demo-uspjeh';

        INSERT INTO ucenik_profili (user_id, muallim_id, grupa_id, mekteb_id, is_archived)
        VALUES (uid, NULL, NULL, NULL, false)
        ON CONFLICT (user_id) DO UPDATE SET
          is_archived = false,
          archived_at = NULL;

        SELECT array_agg(id ORDER BY nivo, redoslijed) INTO all_lesson_ids
          FROM ilmihal_lekcije;

        INSERT INTO student_progress (
          student_id, total_hasanat, total_med, completed_lessons, badges,
          streak_days, last_activity_date
        ) VALUES (
          uid::text, 5000, 2000,
          COALESCE(to_jsonb(all_lesson_ids), '[]'::jsonb),
          jsonb_build_array(
            jsonb_build_object('id','prvi_korak',     'earnedAt', now()),
            jsonb_build_object('id','lekcije_10',     'earnedAt', now()),
            jsonb_build_object('id','lekcije_30',     'earnedAt', now()),
            jsonb_build_object('id','lekcije_50',     'earnedAt', now()),
            jsonb_build_object('id','lekcije_100',    'earnedAt', now()),
            jsonb_build_object('id','streak_3',       'earnedAt', now()),
            jsonb_build_object('id','streak_7',       'earnedAt', now()),
            jsonb_build_object('id','streak_30',      'earnedAt', now()),
            jsonb_build_object('id','hasanati_100',   'earnedAt', now()),
            jsonb_build_object('id','hasanati_250',   'earnedAt', now()),
            jsonb_build_object('id','hasanati_500',   'earnedAt', now()),
            jsonb_build_object('id','hasanati_1000',  'earnedAt', now()),
            jsonb_build_object('id','hasanati_2000',  'earnedAt', now()),
            jsonb_build_object('id','hasanati_5000',  'earnedAt', now()),
            jsonb_build_object('id','prvi_kviz',      'earnedAt', now()),
            jsonb_build_object('id','kvizovi_5',      'earnedAt', now()),
            jsonb_build_object('id','kvizovi_10',     'earnedAt', now()),
            jsonb_build_object('id','kvizovi_25',     'earnedAt', now()),
            jsonb_build_object('id','kvizovi_50',     'earnedAt', now()),
            jsonb_build_object('id','kviz_majstor',   'earnedAt', now()),
            jsonb_build_object('id','bez_greske',     'earnedAt', now()),
            jsonb_build_object('id','sjajni_odgovori','earnedAt', now()),
            jsonb_build_object('id','nivo_1_complete','earnedAt', now()),
            jsonb_build_object('id','nivo_2_complete','earnedAt', now()),
            jsonb_build_object('id','nivo_3_complete','earnedAt', now())
          ),
          30, today_str
        )
        ON CONFLICT (student_id) DO UPDATE SET
          total_hasanat       = EXCLUDED.total_hasanat,
          total_med           = EXCLUDED.total_med,
          completed_lessons   = EXCLUDED.completed_lessons,
          badges              = EXCLUDED.badges,
          streak_days         = EXCLUDED.streak_days,
          last_activity_date  = EXCLUDED.last_activity_date,
          updated_at          = now();

        FOR med IN SELECT id FROM medaljoni LOOP
          INSERT INTO student_medaljoni (student_id, medaljon_id, earned_at)
          VALUES (uid::text, med.id, now())
          ON CONFLICT (student_id, medaljon_id) DO NOTHING;

          INSERT INTO etapa_polaganja (
            student_id, medaljon_id, broj_tacnih, broj_pitanja, procenat, polozeno, pokusaj_br
          ) VALUES (uid::text, med.id, 10, 10, 100, true, 1)
          ON CONFLICT (student_id, medaljon_id, pokusaj_br) DO UPDATE SET
            broj_tacnih = 10, broj_pitanja = 10, procenat = 100, polozeno = true;
        END LOOP;

        FOR kr IN SELECT id FROM krunisanja LOOP
          INSERT INTO student_krunisanja (
            student_id, krunisanje_id, broj_tacnih, broj_pitanja, procenat, polozeno_at
          ) VALUES (uid::text, kr.id, 10, 10, 100, now())
          ON CONFLICT (student_id, krunisanje_id) DO UPDATE SET
            procenat = 100, broj_tacnih = 10, broj_pitanja = 10, polozeno_at = now();
        END LOOP;
      END $$;
    `);

    logger.info("Demo user seed: demo-uspjeh osiguran (idempotentno)");
  } catch (e) {
    logger.error({ err: e }, "Demo user seed failed (non-fatal)");
  }
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
  await seedDemoUspjeh();

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
