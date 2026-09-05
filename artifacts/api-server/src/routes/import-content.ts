import { Router } from "express";
import { pool } from "@workspace/db";
import { createReadStream, existsSync } from "fs";
import { createGunzip } from "zlib";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETUP_SECRET = process.env.SETUP_SECRET || "mekteb-setup-2024";

router.get("/", async (req, res) => {
  const { secret } = req.query;
  if (secret !== SETUP_SECRET) {
    return res.status(403).json({ error: "Invalid secret" });
  }

  const seedPath = path.resolve(__dirname, "../../../scripts/content-seed.json.gz");
  if (!existsSync(seedPath)) {
    return res.status(404).json({ error: `Seed file not found at: ${seedPath}` });
  }

  try {
    // Read and decompress the JSON
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      createReadStream(seedPath)
        .pipe(createGunzip())
        .on("data", (chunk: Buffer) => chunks.push(chunk))
        .on("end", resolve)
        .on("error", reject);
    });

    const raw = Buffer.concat(chunks).toString("utf8");
    const { lekcije, kvizovi, knjige } = JSON.parse(raw);
    const invalidLessons = !Array.isArray(lekcije)
      ? ["lekcije nije niz"]
      : lekcije.filter((lesson) => ![1, 2, 3].includes(Number(lesson?.nivo)));
    if (invalidLessons.length > 0) {
      throw new Error(`Seed sadrži ${invalidLessons.length} lekcija sa nevažećim nivoom`);
    }
    const duplicateSlugs = Array.isArray(lekcije)
      ? lekcije.filter((lesson, index, rows) => rows.findIndex((row) => row.slug === lesson.slug) !== index)
      : [];
    if (duplicateSlugs.length > 0) {
      throw new Error(`Seed sadrži ${duplicateSlugs.length} duplih slugova lekcija`);
    }

    const client = await pool.connect();
    const results: string[] = [];

    try {
      // Ensure schema columns exist (safe migrations)
      await client.query(`ALTER TABLE ilmihal_lekcije ADD COLUMN IF NOT EXISTS kviz_pitanja jsonb`);

      // Import ilmihal lekcije
      let lekcijeCount = 0;
      for (const l of lekcije) {
        const nivo = Number(l.nivo);
        await client.query(
          `INSERT INTO ilmihal_lekcije (id, nivo, slug, naslov, content_html, audio_src, redoslijed, is_published, created_at, kviz_pitanja)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (slug) DO UPDATE SET
             naslov = EXCLUDED.naslov,
             content_html = EXCLUDED.content_html,
             redoslijed = EXCLUDED.redoslijed,
             nivo = EXCLUDED.nivo,
             kviz_pitanja = EXCLUDED.kviz_pitanja`,
          [l.id, nivo, l.slug, l.naslov, l.contentHtml, l.audioSrc, l.redoslijed, l.isPublished, l.createdAt,
           l.kvizPitanja ? JSON.stringify(l.kvizPitanja) : null]
        );
        lekcijeCount++;
      }
      // Reset sequence
      await client.query(`SELECT setval('ilmihal_lekcije_id_seq', (SELECT MAX(id) FROM ilmihal_lekcije))`);
      results.push(`✅ Ilmihal lekcije: ${lekcijeCount}`);

      // Import kvizovi
      let kvizoviCount = 0;
      for (const k of kvizovi) {
        await client.query(
          `INSERT INTO kvizovi (id, nivo, slug, naslov, modul, variant, pitanja, is_published, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (slug) DO UPDATE SET
             naslov = EXCLUDED.naslov,
             pitanja = EXCLUDED.pitanja,
             modul = EXCLUDED.modul`,
          [k.id, k.nivo, k.slug, k.naslov, k.modul, k.variant, JSON.stringify(k.pitanja), k.isPublished, k.createdAt]
        );
        kvizoviCount++;
      }
      await client.query(`SELECT setval('kvizovi_id_seq', (SELECT MAX(id) FROM kvizovi))`);
      results.push(`✅ Kvizovi: ${kvizoviCount}`);

      // Import knjige
      let knjigeCount = 0;
      for (const b of knjige) {
        await client.query(
          `INSERT INTO knjige (id, slug, naslov, kategorija, content_html, cover_image, redoslijed, is_published, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (slug) DO UPDATE SET
             naslov = EXCLUDED.naslov,
             content_html = EXCLUDED.content_html,
             redoslijed = EXCLUDED.redoslijed`,
          [b.id, b.slug, b.naslov, b.kategorija, b.contentHtml, b.coverImage, b.redoslijed, b.isPublished, b.createdAt]
        );
        knjigeCount++;
      }
      await client.query(`SELECT setval('knjige_id_seq', (SELECT MAX(id) FROM knjige))`);
      results.push(`✅ Knjige: ${knjigeCount}`);

      return res.json({ success: true, message: "Sadržaj uvezen!", results });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
