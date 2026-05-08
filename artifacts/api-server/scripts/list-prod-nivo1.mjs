import pg from "pg";
const { Client } = pg;

const c = new Client({ connectionString: process.env.PROD_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  SELECT id, redoslijed, naslov, slug, is_published,
         (audio_src IS NOT NULL AND audio_src <> '') AS has_audio,
         length(content_html) AS html_len,
         (kviz_pitanja IS NOT NULL) AS has_kviz
  FROM ilmihal_lekcije
  WHERE nivo = 1
  ORDER BY redoslijed ASC, id ASC
`);
console.log("Total:", r.rows.length);
for (const row of r.rows) {
  console.log(
    String(row.redoslijed).padStart(3),
    "| id=" + String(row.id).padStart(4),
    "|", String(row.naslov).padEnd(45).slice(0, 45),
    "| html=" + String(row.html_len ?? 0).padStart(5),
    "| audio=" + (row.has_audio ? "Y" : "n"),
    "| kviz=" + (row.has_kviz ? "Y" : "n"),
    "| pub=" + (row.is_published ? "Y" : "n")
  );
}
await c.end();
