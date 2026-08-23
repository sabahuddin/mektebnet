/**
 * Siguran jednokratni prijenos već provjerenih content_prijevoda između baza.
 *
 * Namjena: razvojna baza s gotovim njemačkim overlayom -> produkcijska baza.
 * Lekcije se uparuju po slug-u, nikad po numeričkom ID-u. Za svaki ciljni red
 * prije upisa provjerava se da je SHA-256 bosanskog izvora isti kao u razvojnoj
 * bazi i kao izvor_hash spremljen uz prijevod.
 *
 * Pokretanje iz mreže koja vidi obje baze:
 *   SOURCE_DATABASE_URL="$DATABASE_URL" DATABASE_URL="$PROD_DATABASE_URL" \
 *     pnpm --filter @workspace/scripts run transfer-content -- --lang de --nivo 1
 *
 * `--dry` samo provjerava parove i broj redova, bez upisa.
 */
import { createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  throw new Error("Potrebni su SOURCE_DATABASE_URL i DATABASE_URL.");
}

const args = process.argv.slice(2);
const value = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const lang = value("--lang", "de");
const nivo = Number(value("--nivo", "1"));
const dry = args.includes("--dry");
const allowedFields = new Set(["naslov", "content_html", "kviz_pitanja"]);

if (!/^[a-z]{2}$/.test(lang) || !Number.isInteger(nivo) || nivo < 1) {
  throw new Error("Neispravni argumenti: očekujem --lang xx i --nivo N.");
}

function hash(value: unknown) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function canonicalSource(field: string, value: unknown) {
  if (field === "kviz_pitanja" && Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (field === "kviz_pitanja" && typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      // Hash the original scalar if it is not a JSON array.
    }
  }
  return String(value ?? "");
}

type Lesson = { id: number; slug: string; naslov: string | null; content_html: string | null; kviz_pitanja: unknown };
type Translation = { red_id: number; polje: string; prijevod: string; izvor_hash: string };

const source = new Pool({ connectionString: sourceUrl });
const target = new Pool({ connectionString: targetUrl });

async function run() {
  const sourceLessons = (await source.query<Lesson>(
    "SELECT id, slug, naslov, content_html, kviz_pitanja FROM ilmihal_lekcije WHERE nivo = $1 ORDER BY id",
    [nivo],
  )).rows;
  const targetLessons = (await target.query<Lesson>(
    "SELECT id, slug, naslov, content_html, kviz_pitanja FROM ilmihal_lekcije WHERE nivo = $1 ORDER BY id",
    [nivo],
  )).rows;
  const targetBySlug = new Map(targetLessons.map((lesson) => [lesson.slug, lesson]));
  const overlays = (await source.query<Translation>(
    `SELECT red_id, polje, prijevod, izvor_hash
       FROM content_prijevodi
      WHERE tabela = 'ilmihal_lekcije' AND jezik = $1
        AND polje = ANY($2::text[])`,
    [lang, [...allowedFields]],
  )).rows;

  const overlayByKey = new Map(overlays.map((row) => [`${row.red_id}|${row.polje}`, row]));
  let checked = 0;
  let copied = 0;
  const failures: string[] = [];
  const client = await target.connect();
  try {
    if (!dry) await client.query("BEGIN");
    for (const sourceLesson of sourceLessons) {
      const targetLesson = targetBySlug.get(sourceLesson.slug);
      if (!targetLesson) {
        failures.push(`${sourceLesson.slug}: nedostaje u ciljnoj bazi`);
        continue;
      }
      for (const field of allowedFields) {
        const overlay = overlayByKey.get(`${sourceLesson.id}|${field}`);
        if (!overlay) {
          failures.push(`${sourceLesson.slug}/${field}: nedostaje prijevod`);
          continue;
        }
        const sourceValue = sourceLesson[field as keyof Lesson];
        const targetValue = targetLesson[field as keyof Lesson];
        const sourceHash = hash(canonicalSource(field, sourceValue));
        const targetHash = hash(canonicalSource(field, targetValue));
        checked++;
        if (sourceHash !== overlay.izvor_hash || sourceHash !== targetHash) {
          failures.push(`${sourceLesson.slug}/${field}: hash izvora se ne podudara`);
          continue;
        }
        if (!dry) {
          await client.query(
            `INSERT INTO content_prijevodi
               (tabela, red_id, polje, jezik, prijevod, izvor_hash, updated_at)
             VALUES ('ilmihal_lekcije', $1, $2, $3, $4, $5, now())
             ON CONFLICT (tabela, red_id, polje, jezik)
             DO UPDATE SET prijevod = EXCLUDED.prijevod,
                           izvor_hash = EXCLUDED.izvor_hash,
                           updated_at = now()`,
            [targetLesson.id, field, lang, overlay.prijevod, overlay.izvor_hash],
          );
        }
        copied++;
      }
    }
    if (failures.length) {
      if (!dry) await client.query("ROLLBACK");
      throw new Error(`Transfer zaustavljen: ${failures.length} provjera nije prošla:\n${failures.slice(0, 20).join("\n")}`);
    }
    if (!dry) await client.query("COMMIT");
    const expected = sourceLessons.length * allowedFields.size;
    if (copied !== expected) {
      throw new Error(`Transfer nije kompletan: ${copied}/${expected} polja.`);
    }
    console.log(`${dry ? "Provjera" : "Prijenos"} uspješan: lekcije=${sourceLessons.length}, provjereno=${checked}, upisano=${copied}, očekivano_polja=${expected}`);
  } catch (error) {
    if (!dry) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([source.end(), target.end()]);
  });