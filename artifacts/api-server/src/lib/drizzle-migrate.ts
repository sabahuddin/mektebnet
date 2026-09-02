import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { db, pool } from "@workspace/db";
import { logger } from "./logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Postgres advisory lock id for serializing bootstrap across concurrent starts.
// Arbitrary 64-bit-safe int chosen for "drizzle-bootstrap" namespace.
const BOOTSTRAP_LOCK_ID = 4242420001;
const MIGRATE_LOCK_ID = 4242420002;

// "Existing prod DB" heuristic: a meaningful subset of the app's core tables
// must be present. A truly fresh DB has none of these → migrate() runs the
// baseline normally. A partially-bootstrapped DB (some present, some missing)
// is classified as FRESH (returns false) so that migrate() will attempt the
// baseline and fail loudly instead of silently fake-applying — that's the
// safer failure mode for the developer to investigate.
const REQUIRED_EXISTING_TABLES = [
  "users",
  "ilmihal_lekcije",
  "korisnik_napredak",
  "prilozi",
] as const;

function resolveMigrationsFolder(): string {
  const fromEnv = process.env.DRIZZLE_MIGRATIONS_FOLDER;
  const candidates = [
    fromEnv,
    path.resolve(__dirname, "../../../../lib/db/drizzle"),
    path.resolve(process.cwd(), "lib/db/drizzle"),
    path.resolve(process.cwd(), "../../lib/db/drizzle"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "meta", "_journal.json"))) return p;
  }
  return candidates[0]!;
}

interface ExistsRow {
  exists: boolean;
}

interface CountRow {
  c: number;
}

async function tableExists(schemaName: string, tableName: string): Promise<boolean> {
  const r = (await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = ${schemaName} AND table_name = ${tableName}
    ) AS exists
  `)) as unknown as { rows: ExistsRow[] };
  return Boolean(r.rows[0]?.exists);
}

async function detectExistingDb(): Promise<boolean> {
  for (const t of REQUIRED_EXISTING_TABLES) {
    if (!(await tableExists("public", t))) return false;
  }
  return true;
}

export async function bootstrapDrizzleMigrations(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();

  let migrations;
  try {
    migrations = readMigrationFiles({ migrationsFolder });
  } catch (e) {
    logger.warn({ err: e, migrationsFolder }, "Drizzle migrations folder not found — skipping bootstrap");
    return;
  }

  if (migrations.length === 0) {
    logger.info({ migrationsFolder }, "Drizzle migrations folder is empty — nothing to bootstrap");
    return;
  }

  // Detection BEFORE acquiring lock — cheap and lock-free if obviously fresh.
  const isExisting = await detectExistingDb();
  if (!isExisting) {
    logger.info(
      { required: REQUIRED_EXISTING_TABLES },
      "Fresh or partial DB detected — Drizzle migrate() will create from scratch (no fake-apply)",
    );
    return;
  }

  const baseline = migrations[0];
  if (!baseline) return;

  // Serialize bootstrap across concurrent container starts.
  // db.transaction() pins to a single pool connection for the whole callback,
  // so pg_advisory_xact_lock() and the subsequent INSERT run on the same
  // session — and the lock is auto-released on COMMIT/ROLLBACK. This is the
  // only correct way to use advisory locks against a Drizzle pool wrapper.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_ID})`);

    // Ensure schema/table exist (idempotent) under the lock.
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    // Belt-and-suspenders: unique index on hash so even if two processes
    // somehow bypass the lock (different DB host, transaction rollback edge
    // cases), we cannot end up with duplicate rows. CREATE UNIQUE INDEX
    // IF NOT EXISTS is idempotent.
    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS drizzle_migrations_hash_unique_idx
        ON drizzle.__drizzle_migrations (hash)
    `);

    // Re-check inside the lock: another process may have just inserted.
    const cnt = (await tx.execute(sql`
      SELECT COUNT(*)::int AS c FROM drizzle.__drizzle_migrations
    `)) as unknown as { rows: CountRow[] };
    if ((cnt.rows[0]?.c ?? 0) > 0) {
      return;
    }

    // ONLY fake-apply the baseline (entry 0). Any later migrations (0001+)
    // MUST flow through the real migrate() so they actually execute on this
    // existing DB. If someone drops the migrations table after 0001+ has been
    // applied to schema, bootstrap would still only mark baseline; migrate()
    // would then RE-RUN 0001+ and fail loudly on duplicate-table errors —
    // a safer failure mode than silently skipping new migrations.
    await tx.execute(sql`
      INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
      VALUES (${baseline.hash}, ${baseline.folderMillis})
      ON CONFLICT (hash) DO NOTHING
    `);
    logger.info(
      {
        baselineHashPrefix: baseline.hash.slice(0, 12),
        baselineMillis: baseline.folderMillis,
        totalMigrations: migrations.length,
      },
      "Drizzle baseline (0000) marked as applied on existing DB (no SQL executed); 0001+ will run normally",
    );
  });
}

export async function runDrizzleMigrate(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATE_LOCK_ID]);
    await migrate(db, { migrationsFolder });
    logger.info({ migrationsFolder }, "Drizzle migrate() completed");
  } catch (e) {
    logger.error({ err: e, migrationsFolder }, "Drizzle migrate() failed");
    throw e;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK_ID]);
    } finally {
      client.release();
    }
  }
}
