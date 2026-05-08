const pg = require("pg");
const { Client } = pg;

const PROD_URL = process.env.PROD_RO_URL;
const DEV_URL = process.env.DATABASE_URL;
if (!PROD_URL || !DEV_URL) {
  console.error("Missing PROD_RO_URL or DATABASE_URL");
  process.exit(1);
}

(async () => {
  const prod = new Client({ connectionString: PROD_URL, connectionTimeoutMillis: 10000 });
  const dev = new Client({ connectionString: DEV_URL, connectionTimeoutMillis: 10000 });
  await prod.connect();
  await dev.connect();

  const { rows: prodRows } = await prod.query(`
    SELECT id, nivo, slug, naslov, content_html, audio_src, redoslijed, is_published, kviz_pitanja, locked, locked_at, locked_note
    FROM ilmihal_lekcije
    WHERE nivo = 1
    ORDER BY redoslijed ASC, id ASC
  `);
  console.log(`PROD: ${prodRows.length} Nivo 1 lessons`);

  const { rows: devRows } = await dev.query(`SELECT id, slug, naslov, redoslijed FROM ilmihal_lekcije WHERE nivo = 1`);
  const devBySlug = new Map(devRows.map(r => [r.slug, r]));
  console.log(`DEV : ${devRows.length} Nivo 1 lessons`);

  let inserted = 0, updated = 0;
  const insertedTitles = [];

  for (const p of prodRows) {
    const kvizJson = p.kviz_pitanja == null ? null : JSON.stringify(p.kviz_pitanja);
    const existing = devBySlug.get(p.slug);
    if (existing) {
      await dev.query(
        `UPDATE ilmihal_lekcije
         SET naslov=$1, content_html=$2, audio_src=$3, redoslijed=$4, is_published=$5, kviz_pitanja=$6,
             locked=$7, locked_at=$8, locked_note=$9
         WHERE id=$10`,
        [p.naslov, p.content_html, p.audio_src, p.redoslijed, p.is_published, kvizJson,
         p.locked, p.locked_at, p.locked_note, existing.id]
      );
      updated++;
    } else {
      const ins = await dev.query(
        `INSERT INTO ilmihal_lekcije (nivo, slug, naslov, content_html, audio_src, redoslijed, is_published, kviz_pitanja, locked, locked_at, locked_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [p.nivo, p.slug, p.naslov, p.content_html, p.audio_src, p.redoslijed, p.is_published, kvizJson,
         p.locked, p.locked_at, p.locked_note]
      );
      inserted++;
      insertedTitles.push(`  + redoslijed=${p.redoslijed} | "${p.naslov}" (slug=${p.slug}, new dev id=${ins.rows[0].id})`);
    }
  }

  console.log(`\nResult: updated=${updated}, inserted=${inserted}`);
  if (insertedTitles.length) {
    console.log("\nNewly added to DEV:");
    for (const t of insertedTitles) console.log(t);
  }

  const { rows: finalDev } = await dev.query(`
    SELECT redoslijed, naslov, slug FROM ilmihal_lekcije WHERE nivo=1 ORDER BY redoslijed ASC, id ASC
  `);
  console.log(`\nDEV now has ${finalDev.length} Nivo 1 lessons:`);
  for (const r of finalDev) {
    console.log(`  ${String(r.redoslijed).padStart(3)} | ${r.naslov}`);
  }

  await prod.end();
  await dev.end();
  console.log("\nDone.");
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
