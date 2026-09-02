/**
 * Jednokratna, strogo provjerena primjena NPP 2018 predmeta na produkcijske
 * Ilmihal lekcije.
 *
 * Pokretanje unutar Coolify API kontejnera:
 *   node artifacts/api-server/scripts/apply-npp2018-lesson-subjects.mjs
 *   node artifacts/api-server/scripts/apply-npp2018-lesson-subjects.mjs --apply --backup-confirmed
 *   node artifacts/api-server/scripts/apply-npp2018-lesson-subjects.mjs --rollback <run-id>
 *
 * Bez --apply skripta je uvijek read-only. Granični slučajevi iz izvornog
 * rasporeda namjerno nisu uključeni.
 */
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requireDb = createRequire(
  path.join(__dirname, "..", "..", "..", "lib", "db", "package.json"),
);
const { Pool } = requireDb("pg");

const TARGET_SLUGS_BY_SUBJECT = {
  Ibadet: [
    "abdeski-sarti", "abdest", "aksam-namaz", "bajram-namaz",
    "cetvrti-namaski-sart", "dova-poslije-ezana", "dova-poslije-jela",
    "dova-za-znanje", "dove", "duznosti-allah", "dzenaza-namaz",
    "dzuma-namaz", "et-tehijatu", "euzubilla-i-bismilla", "ezan",
    "farzovi-namaz", "gusul", "gusulski-sarti", "hadz", "hadz-propisi",
    "hajz-nifas", "halal-haram", "ikamet", "ikindija-namaz",
    "jacija-namaz", "kako-pocinjem-posao", "kunut-dova", "mekruhi-namaz",
    "mesh", "mukellef", "nafila", "naklanjavanje", "namaska-dova",
    "namaski-ruknovi-1", "namaski-ruknovi-2", "namaski-sarti", "namaz",
    "namaz-bolesnika", "namaz-cuva", "namaz-putnika", "namaz-u-dzematu",
    "odredjivanje-kible", "pet-namaza", "peti-namaski-sart", "podne-namaz",
    "post", "post-propisi", "prispijevanje", "prvi-namaski-sart",
    "rabbi-jessir", "sabah-namaz", "sadekatul-fitr", "sahibi-uzur",
    "salavati", "sehvi-sedzda", "sesti-namaski-sart", "sta-kvari-abdest",
    "sta-kvari-namaz", "subhaneke", "sunneti-namaz", "tejemum",
    "tejemumski-sarti", "teravih-namaz", "tesbih", "treci-namaski-sart",
    "vadzibi-namaz", "vaznost-dzemata", "vrste-namaza", "zekat",
    "zekat-bejtul-mal", "zikr",
  ],
  Akaid: [
    "ajetul-kursija", "allah-dz-s", "amentu-billahi", "amentu-billahi3",
    "covjek-najljepse-stvorenje", "dzennet-dzehennem", "dzini-sejtani",
    "el-asr", "el-fil", "el-humeze", "el-kafirun", "el-kariah",
    "el-kevser", "el-kurejs", "el-maun", "elif-lam-mim", "esmaul-husna",
    "et-tekassur", "imanski-sarti", "kader", "kelimei-sehadet", "kitabi",
    "kufr-sirk-nifak", "kuran-objava", "lekad-dzaekum", "lekcija-01",
    "melaike", "mentu-billahi", "nasa-vjera", "poslanici", "prozivljenje",
    "sefaat-mizan-sirat", "sifatus-subutijje", "sifatuz-zatijje",
    "subutijje-1", "subutijje-2", "sudnji-dan", "sura-el-fatiha",
    "sura-el-felek", "sura-el-ihlas", "sura-el-leheb", "sura-en-nas",
    "sura-en-nasr", "tevhid", "ve-bil-kaderi", "ve-kutubihi",
    "ve-melaikethi", "ve-melaiketihi", "ve-rusulihi", "vel-jevmil-ahiri",
    "vjerovanje-gajb", "zatijje-1", "zatijje-2",
  ],
  Ahlak: [
    "alkohol", "bajramske-aktivnosti", "biljke-zivotinje", "braca-sestre",
    "cestitost", "cistoca", "dobrota", "droga", "duhan", "ekologija",
    "internet-ovisnost", "ishrana", "iskrenost", "iskrenost-pravednost",
    "istina", "istinoljubivost", "ja-idem-u-mekteb", "kockanje", "komsije",
    "kurban-bajram", "lijepa-rijec", "mrznja", "mubarek-dani",
    "mubarek-noci", "nemoral", "neprijateljstvo", "nova-hidzretska-godina",
    "odgovornost-zdravlje", "odijevanje-hidzab", "ogovaranje", "oholost",
    "poboznost", "ponasanje-drustvo", "ponasanje-jela", "porodica",
    "pravila-ponasanja", "prednost-desne-strane", "prevara", "prijateljstvo",
    "rad-kultura", "radne-navike", "ramazanski-bajram", "rodbina",
    "rodbinske-veze", "roditelji", "samilost", "selam", "skromnost",
    "skrtost", "srednji-put", "stariji", "stjecanje-znanja", "strpljivost",
    "ulazak-izlazak", "urednost", "voda-izvor-zivota",
    "za-bajram-je-pohvalno", "zdravlje",
  ],
  "Historija islama": [
    "adem-as", "bitka-bedr", "hadiske-zbirke", "halife", "hidzra",
    "ibrahim-as", "isa-as", "muhammed-as-djetinjstvo",
    "muhammed-as-porodica", "muhammed-as-poslanik", "musa-as", "nuh-as",
    "odabrane-zene", "oprostajni-hadz", "poslanici-kuran",
    "preseljenje-ahiret",
  ],
  Bosna: [
    "alimi", "bih", "bosanski-jezik", "bosnjacki-pjesnici", "bosnjak",
    "dan-dzamija", "iz-historija", "iz-ustanove", "kultura",
    "muslimanska-imena", "temelji-odgoja", "vakufi-bih",
  ],
};

const EXPECTED_TARGET_COUNT = 210;
const EXPECTED_MATCHED_COUNT = 206;
const EXPECTED_CHANGE_COUNT = 153;
const EXPECTED_MISSING = [
  "amentu-billahi",
  "lekcija-01",
  "tesbih",
  "ve-melaiketihi",
];
const EXPECTED_BEFORE_SHA256 =
  "3ff44089404384f23a5f695ed7ab601ca4fd8944e07c8bb738cf3b5a5efca53c";
const EXPECTED_AFTER_SHA256 =
  "38429a324babd1ee1e856740882be3e57e1cd6e946a2b670f5a815a1d4ec1e86";

const targets = Object.entries(TARGET_SLUGS_BY_SUBJECT).flatMap(
  ([predmetAfter, slugs]) => slugs.map((slug) => ({ slug, predmetAfter })),
);
const targetBySlug = new Map(targets.map((target) => [target.slug, target]));
const allSlugs = [...targetBySlug.keys()].sort();

function fail(message) {
  throw new Error(message);
}

function assertStaticData() {
  if (targets.length !== EXPECTED_TARGET_COUNT) {
    fail(`Interna greška: očekivano ${EXPECTED_TARGET_COUNT} ciljeva, pronađeno ${targets.length}.`);
  }
  if (targetBySlug.size !== targets.length) {
    fail("Interna greška: isti slug je naveden u više predmeta.");
  }
  for (const missingSlug of EXPECTED_MISSING) {
    if (!targetBySlug.has(missingSlug)) {
      fail(`Interna greška: očekivani nestali slug nije u rasporedu: ${missingSlug}`);
    }
  }
}

function snapshotHash(rows, valueField) {
  const payload = [...rows]
    .sort((a, b) => a.slug.localeCompare(b.slug, "en"))
    .map((row) => `${row.slug}\t${row[valueField] ?? ""}\n`)
    .join("");
  return createHash("sha256").update(payload).digest("hex");
}

function equalStringArrays(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function printUsage() {
  console.log(`
NPP 2018 raspored predmeta (granični slučajevi su isključeni)

Dry-run:
  node artifacts/api-server/scripts/apply-npp2018-lesson-subjects.mjs

Primjena (tek nakon Coolify backup/snapshot-a):
  node artifacts/api-server/scripts/apply-npp2018-lesson-subjects.mjs --apply --backup-confirmed

Rollback:
  node artifacts/api-server/scripts/apply-npp2018-lesson-subjects.mjs --rollback <run-id>
`);
}

async function rollback(client, runId) {
  if (!runId) fail("Za rollback je obavezan run-id.");

  await client.query("BEGIN");
  try {
    const result = await client.query(
      `SELECT
         b.lesson_id,
         b.slug,
         b.predmet_before AS "predmetBefore",
         b.predmet_after AS "predmetAfter",
         l.predmet AS "predmetCurrent"
       FROM ilmihal_predmet_npp2018_backup b
       JOIN ilmihal_lekcije l ON l.id = b.lesson_id
       WHERE b.run_id = $1
       ORDER BY b.slug
       FOR UPDATE OF l`,
      [runId],
    );
    if (result.rows.length === 0) fail(`Backup run nije pronađen: ${runId}`);

    const changedSinceApply = result.rows.filter(
      (row) => (row.predmetCurrent ?? "") !== (row.predmetAfter ?? ""),
    );
    if (changedSinceApply.length > 0) {
      fail(
        `Rollback odbijen: ${changedSinceApply.length} lekcija je naknadno mijenjano. ` +
        `Prvi slug: ${changedSinceApply[0].slug}`,
      );
    }

    const restored = await client.query(
      `UPDATE ilmihal_lekcije l
       SET predmet = b.predmet_before
       FROM ilmihal_predmet_npp2018_backup b
       WHERE b.run_id = $1
         AND l.id = b.lesson_id
         AND l.predmet IS NOT DISTINCT FROM b.predmet_after`,
      [runId],
    );
    if (restored.rowCount !== result.rows.length) {
      fail(`Rollback nije vratio sve redove (${restored.rowCount}/${result.rows.length}).`);
    }

    await client.query("COMMIT");
    console.log(`Rollback završen: vraćeno ${restored.rowCount} lekcija iz run-a ${runId}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function inspectAndMaybeApply(client, apply) {
  await client.query("BEGIN");
  try {
    const result = await client.query(
      `SELECT id, slug, predmet
       FROM ilmihal_lekcije
       WHERE slug = ANY($1::text[])
       ORDER BY slug
       FOR UPDATE`,
      [allSlugs],
    );

    const found = new Set(result.rows.map((row) => row.slug));
    const missing = allSlugs.filter((slug) => !found.has(slug));
    if (!equalStringArrays(missing, EXPECTED_MISSING)) {
      fail(
        `Produkcijski skup lekcija se promijenio. Očekivano nedostaju ` +
        `${EXPECTED_MISSING.join(", ")}, a sada nedostaju ${missing.join(", ") || "(nijedna)"}.`,
      );
    }
    if (result.rows.length !== EXPECTED_MATCHED_COUNT) {
      fail(`Očekivano ${EXPECTED_MATCHED_COUNT} pronađenih lekcija, pronađeno ${result.rows.length}.`);
    }

    const beforeHash = snapshotHash(result.rows, "predmet");
    const rowsWithTarget = result.rows.map((row) => ({
      ...row,
      predmetAfter: targetBySlug.get(row.slug).predmetAfter,
    }));
    const changes = rowsWithTarget.filter(
      (row) => (row.predmet ?? "") !== row.predmetAfter,
    );

    if (beforeHash === EXPECTED_AFTER_SHA256 && changes.length === 0) {
      await client.query("ROLLBACK");
      console.log("Raspored je već u potpunosti primijenjen; nema izmjena.");
      return;
    }
    if (beforeHash !== EXPECTED_BEFORE_SHA256) {
      fail(
        "Produkcijski predmeti se ne podudaraju sa provjerenim stanjem od 02.09.2026. " +
        "Nijedan red nije izmijenjen.",
      );
    }
    if (changes.length !== EXPECTED_CHANGE_COUNT) {
      fail(`Očekivano ${EXPECTED_CHANGE_COUNT} izmjena, pronađeno ${changes.length}.`);
    }

    const counts = changes.reduce((acc, row) => {
      acc[row.predmetAfter] = (acc[row.predmetAfter] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`Provjera prošla: ${result.rows.length} lekcija, ${changes.length} izmjena.`);
    console.table(counts);

    if (!apply) {
      await client.query("ROLLBACK");
      console.log("DRY-RUN završen. Baza nije izmijenjena.");
      return;
    }

    const runId = `npp2018-${new Date().toISOString()}-${randomUUID().slice(0, 8)}`;
    await client.query(`
      CREATE TABLE IF NOT EXISTS ilmihal_predmet_npp2018_backup (
        run_id text NOT NULL,
        lesson_id integer NOT NULL,
        slug text NOT NULL,
        predmet_before varchar(60),
        predmet_after varchar(60) NOT NULL,
        backed_up_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (run_id, lesson_id)
      )
    `);

    const changePayload = JSON.stringify(
      changes.map((row) => ({
        id: row.id,
        slug: row.slug,
        predmetBefore: row.predmet,
        predmetAfter: row.predmetAfter,
      })),
    );
    const backup = await client.query(
      `WITH x AS (
         SELECT *
         FROM jsonb_to_recordset($2::jsonb)
           AS r(id integer, slug text, "predmetBefore" text, "predmetAfter" text)
       )
       INSERT INTO ilmihal_predmet_npp2018_backup
         (run_id, lesson_id, slug, predmet_before, predmet_after)
       SELECT $1, id, slug, "predmetBefore", "predmetAfter"
       FROM x`,
      [runId, changePayload],
    );
    if (backup.rowCount !== EXPECTED_CHANGE_COUNT) {
      fail(`Backup nije sačuvao sve redove (${backup.rowCount}/${EXPECTED_CHANGE_COUNT}).`);
    }

    const updated = await client.query(
      `WITH x AS (
         SELECT *
         FROM jsonb_to_recordset($1::jsonb)
           AS r(id integer, slug text, "predmetBefore" text, "predmetAfter" text)
       )
       UPDATE ilmihal_lekcije l
       SET predmet = x."predmetAfter"
       FROM x
       WHERE l.id = x.id
         AND l.slug = x.slug
         AND l.predmet IS NOT DISTINCT FROM x."predmetBefore"`,
      [changePayload],
    );
    if (updated.rowCount !== EXPECTED_CHANGE_COUNT) {
      fail(`Upis nije pogodio sve redove (${updated.rowCount}/${EXPECTED_CHANGE_COUNT}).`);
    }

    const verification = await client.query(
      `SELECT slug, predmet AS "predmetAfter"
       FROM ilmihal_lekcije
       WHERE slug = ANY($1::text[])
       ORDER BY slug`,
      [allSlugs],
    );
    const afterHash = snapshotHash(verification.rows, "predmetAfter");
    if (afterHash !== EXPECTED_AFTER_SHA256) {
      fail("Završna hash provjera nije prošla; transakcija se poništava.");
    }

    await client.query("COMMIT");
    console.log(`USPJEH: promijenjeno ${updated.rowCount} lekcija.`);
    console.log(`Backup run-id za rollback: ${runId}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  assertStaticData();
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printUsage();
    return;
  }
  if (args.includes("--self-test")) {
    console.log(`Self-test prošao: ${targets.length} jedinstvenih negraničnih slugova.`);
    return;
  }

  const rollbackIndex = args.indexOf("--rollback");
  const apply = args.includes("--apply");
  if (apply && !args.includes("--backup-confirmed")) {
    fail("Primjena odbijena: prvo napravi Coolify backup, zatim dodaj --backup-confirmed.");
  }
  if (apply && rollbackIndex >= 0) {
    fail("--apply i --rollback se ne mogu koristiti zajedno.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL nije postavljen unutar API kontejnera.");

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    if (rollbackIndex >= 0) {
      await rollback(client, args[rollbackIndex + 1]);
    } else {
      await inspectAndMaybeApply(client, apply);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`GREŠKA: ${error.message}`);
  process.exit(1);
});