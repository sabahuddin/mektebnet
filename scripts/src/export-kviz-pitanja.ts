import { createReadStream, createWriteStream } from "fs";
import { createGunzip, createGzip } from "zlib";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable } from "@workspace/db/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, "../content-seed.json.gz");

async function main() {
  // Read existing seed
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    createReadStream(SEED_PATH).pipe(createGunzip())
      .on("data", (c: Buffer) => chunks.push(c)).on("end", resolve).on("error", reject);
  });
  const seed = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  // Fetch all kviz_pitanja from local DB
  const rows = await db.select({
    id: ilmihalLekcijeTable.id,
    slug: ilmihalLekcijeTable.slug,
    kvizPitanja: ilmihalLekcijeTable.kvizPitanja,
  }).from(ilmihalLekcijeTable);

  const kvizMap = new Map(rows.map(r => [r.slug, r.kvizPitanja]));

  // Merge into seed lekcije
  let updated = 0;
  for (const l of seed.lekcije) {
    const kp = kvizMap.get(l.slug);
    if (kp && Array.isArray(kp) && kp.length > 0) {
      l.kvizPitanja = kp;
      updated++;
    }
  }

  console.log(`Updated ${updated} lekcija with kvizPitanja`);

  // Write compressed seed back
  await new Promise<void>((resolve, reject) => {
    const gzip = createGzip();
    const out = createWriteStream(SEED_PATH);
    gzip.pipe(out);
    gzip.write(JSON.stringify(seed));
    gzip.end();
    out.on("finish", resolve).on("error", reject);
  });

  console.log("Seed updated successfully!");
  process.exit(0);
}

main();
