/**
 * `--force` uz `--do-kraja` smije vrijediti samo za PRVI prolaz.
 *
 * Force zanemaruje heš izvornika, pa bi ga svaki naredni prolaz iznova
 * zatekao sve redove i prevodio ih ponovo — do dvadeset puta, uz dvadeset
 * puta veći račun. „Dva prolaza bez upisa" tu ne pomaže, jer svaki prolaz
 * uredno upisuje. Test pokreće pravu skriptu nad pravom bazom, u `--dry`
 * načinu, i gleda koliko poslova zatekne svaki prolaz.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const izvrsi = promisify(execFile);
const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RIJEC = `proba-force-${Date.now()}`;
const DEFINICIJA = "Definicija koja služi samo za provjeru.";
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

let redId: number;

before(async () => {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS content_prijevodi (
      id serial PRIMARY KEY, tabela varchar(60) NOT NULL, red_id integer NOT NULL,
      polje varchar(60) NOT NULL, jezik varchar(5) NOT NULL, prijevod text NOT NULL,
      izvor_hash varchar(64) NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`);
  const r = (await db.execute(sql`
    INSERT INTO rjecnik (rijec, definicija) VALUES (${RIJEC}, ${DEFINICIJA}) RETURNING id
  `)) as unknown as { rows: { id: number }[] };
  redId = r.rows[0]!.id;
  // Prijevod koji je već svjež: heš se poklapa, pa ga inkrementalni prolaz
  // preskače, a force-prolaz ipak uzima.
  await db.execute(sql`
    INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash) VALUES
      ('rjecnik', ${redId}, 'rijec', 'de', 'Probe-Wort', ${sha(RIJEC)}),
      ('rjecnik', ${redId}, 'definicija', 'de', 'Definition nur zur Prüfung.', ${sha(DEFINICIJA)})
  `);
});

after(async () => {
  if (redId) {
    await db.execute(sql`DELETE FROM content_prijevodi WHERE tabela = 'rjecnik' AND red_id = ${redId}`);
    await db.execute(sql`DELETE FROM rjecnik WHERE id = ${redId}`);
  }
});

async function pokreni(dodatno: string[]): Promise<string> {
  const { stdout } = await izvrsi(
    "node",
    [
      "--import", "tsx",
      path.join(KORIJEN, "src/translate-content.ts"),
      "--langs", "de", "--tables", "rjecnik", "--ids", String(redId), "--dry",
      ...dodatno,
    ],
    { cwd: KORIJEN, env: process.env, maxBuffer: 8 * 1024 * 1024 },
  );
  return stdout;
}

/** Koliko je poslova zatekao svaki prolaz, redom. */
function poslovaPoProlazu(ispis: string): number[] {
  return [...ispis.matchAll(/Poslova: tekst=(\d+) \| html=(\d+)/g)]
    .map((m) => Number(m[1]) + Number(m[2]));
}

test("svjež prijevod se bez --force ne dira", async () => {
  assert.deepEqual(poslovaPoProlazu(await pokreni([])), [0]);
});

test("--force uzima red i kad je prijevod svjež", async () => {
  assert.deepEqual(poslovaPoProlazu(await pokreni(["--force"])), [2]);
});

test("uz --do-kraja force vrijedi samo za prvi prolaz", async () => {
  const ispis = await pokreni(["--force", "--do-kraja", "--pauza", "1"]);
  const poslovi = poslovaPoProlazu(ispis);
  assert.equal(poslovi[0], 2, "prvi prolaz mora uzeti oba polja");
  assert.equal(poslovi[1], 0, "drugi prolaz ne smije ponovo uzeti isti posao");
  assert.equal(poslovi.length, 2, `stalo je poslije ${poslovi.length} prolaza`);
  assert.match(ispis, /Gotovo: nema više šta prevesti/);
});
