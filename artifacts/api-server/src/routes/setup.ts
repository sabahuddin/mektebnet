import { Router } from "express";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

const router = Router();

const SETUP_SECRET = process.env.SETUP_SECRET || "mekteb-setup-2024";

router.get("/", async (req, res) => {
  const { secret } = req.query;
  if (secret !== SETUP_SECRET) {
    return res.status(403).json({ error: "Invalid secret" });
  }

  const client = await pool.connect();
  const results: string[] = [];

  try {
    await client.query("BEGIN");

    // 1. Enum type
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'muallim', 'ucenik', 'roditelj');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    results.push("✅ user_role enum");

    // 2. users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(60) NOT NULL UNIQUE,
        email VARCHAR(255) UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'ucenik',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login_at TIMESTAMP
      );
    `);
    results.push("✅ users");

    // 3. mektebi
    await client.query(`
      CREATE TABLE IF NOT EXISTS mektebi (
        id SERIAL PRIMARY KEY,
        naziv TEXT NOT NULL,
        grad VARCHAR(100),
        adresa TEXT,
        kontakt_email VARCHAR(255),
        kontakt_tel VARCHAR(50),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ mektebi");

    // 4. muallim_profili
    await client.query(`
      CREATE TABLE IF NOT EXISTS muallim_profili (
        user_id INTEGER NOT NULL UNIQUE,
        mekteb_id INTEGER,
        licence_count INTEGER NOT NULL DEFAULT 30,
        licences_used INTEGER NOT NULL DEFAULT 0,
        tekuca_skolska_godina VARCHAR(20) DEFAULT '2024/2025',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ muallim_profili");

    // 5. grupe
    await client.query(`
      CREATE TABLE IF NOT EXISTS grupe (
        id SERIAL PRIMARY KEY,
        muallim_id INTEGER NOT NULL,
        naziv VARCHAR(100) NOT NULL,
        skolska_godina VARCHAR(20) NOT NULL,
        dani_nastave JSONB DEFAULT '[]',
        vrijeme_nastave VARCHAR(20),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ grupe");

    // 6. ucenik_profili
    await client.query(`
      CREATE TABLE IF NOT EXISTS ucenik_profili (
        user_id INTEGER NOT NULL UNIQUE,
        muallim_id INTEGER,
        grupa_id INTEGER,
        mekteb_id INTEGER,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        archived_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ ucenik_profili");

    // 7. roditelj_profili
    await client.query(`
      CREATE TABLE IF NOT EXISTS roditelj_profili (
        user_id INTEGER NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ roditelj_profili");

    // 8. roditelj_ucenik
    await client.query(`
      CREATE TABLE IF NOT EXISTS roditelj_ucenik (
        id SERIAL PRIMARY KEY,
        roditelj_id INTEGER NOT NULL,
        ucenik_id INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        approved_by INTEGER
      );
    `);
    results.push("✅ roditelj_ucenik");

    // 9. pretplate
    await client.query(`
      CREATE TABLE IF NOT EXISTS pretplate (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        plan_type VARCHAR(50) NOT NULL,
        stripe_session_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        iznos INTEGER,
        valuta VARCHAR(10) DEFAULT 'EUR',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        licences_purchased INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ pretplate");

    // 10. prisustvo
    await client.query(`
      CREATE TABLE IF NOT EXISTS prisustvo (
        id SERIAL PRIMARY KEY,
        ucenik_id INTEGER NOT NULL,
        grupa_id INTEGER NOT NULL,
        muallim_id INTEGER NOT NULL,
        datum VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'prisutan',
        napomena TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ prisustvo");

    // 11. ocjene
    await client.query(`
      CREATE TABLE IF NOT EXISTS ocjene (
        id SERIAL PRIMARY KEY,
        ucenik_id INTEGER NOT NULL,
        muallim_id INTEGER NOT NULL,
        grupa_id INTEGER,
        kategorija VARCHAR(50) NOT NULL,
        ocjena INTEGER NOT NULL,
        napomena TEXT,
        datum VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ ocjene");

    // 12. poruke
    await client.query(`
      CREATE TABLE IF NOT EXISTS poruke (
        id SERIAL PRIMARY KEY,
        posiljatelj_id INTEGER NOT NULL,
        primatelj_id INTEGER NOT NULL,
        naslov VARCHAR(200) NOT NULL,
        sadrzaj TEXT NOT NULL,
        procitano_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ poruke");

    // 13. certifikati
    await client.query(`
      CREATE TABLE IF NOT EXISTS certifikati (
        id SERIAL PRIMARY KEY,
        ucenik_id INTEGER NOT NULL,
        modul VARCHAR(100) NOT NULL,
        naslov TEXT NOT NULL,
        issued_by_id INTEGER,
        issued_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ certifikati");

    // 14. ilmihal_lekcije
    await client.query(`
      CREATE TABLE IF NOT EXISTS ilmihal_lekcije (
        id SERIAL PRIMARY KEY,
        nivo INTEGER NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        naslov TEXT NOT NULL,
        content_html TEXT NOT NULL DEFAULT '',
        audio_src VARCHAR(500),
        redoslijed INTEGER NOT NULL DEFAULT 0,
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ ilmihal_lekcije");

    // 15. kvizovi
    await client.query(`
      CREATE TABLE IF NOT EXISTS kvizovi (
        id SERIAL PRIMARY KEY,
        nivo INTEGER,
        slug VARCHAR(100) NOT NULL UNIQUE,
        naslov TEXT NOT NULL,
        modul VARCHAR(50) NOT NULL DEFAULT 'ilmihal',
        variant VARCHAR(20) DEFAULT 'normal',
        pitanja JSONB NOT NULL DEFAULT '[]',
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ kvizovi");

    // 16. knjige
    await client.query(`
      CREATE TABLE IF NOT EXISTS knjige (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) NOT NULL UNIQUE,
        naslov TEXT NOT NULL,
        kategorija VARCHAR(50) NOT NULL DEFAULT 'prica',
        content_html TEXT NOT NULL DEFAULT '',
        cover_image VARCHAR(500),
        redoslijed INTEGER NOT NULL DEFAULT 0,
        is_published BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ knjige");

    // 17. korisnik_napredak
    await client.query(`
      CREATE TABLE IF NOT EXISTS korisnik_napredak (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        content_type VARCHAR(30) NOT NULL,
        content_id INTEGER NOT NULL,
        zavrsen BOOLEAN NOT NULL DEFAULT false,
        bodovi INTEGER NOT NULL DEFAULT 0,
        pokusaji INTEGER NOT NULL DEFAULT 1,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ korisnik_napredak");

    // 18. lessons (arapsko pismo)
    await client.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        order_num INTEGER NOT NULL,
        slug VARCHAR(50) NOT NULL UNIQUE,
        title TEXT NOT NULL,
        lesson_type VARCHAR(30) NOT NULL,
        letters JSONB NOT NULL,
        duration_min INTEGER NOT NULL DEFAULT 20,
        story_data JSONB,
        letter_data JSONB,
        exercise_types JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ lessons");

    // 19. student_progress
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_progress (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(100) NOT NULL UNIQUE,
        total_hasanat INTEGER NOT NULL DEFAULT 0,
        completed_lessons JSONB NOT NULL DEFAULT '[]',
        badges JSONB NOT NULL DEFAULT '[]',
        streak_days INTEGER NOT NULL DEFAULT 0,
        last_activity_date VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ student_progress");

    // 20. exercise_sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercise_sessions (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(100) NOT NULL,
        lesson_id INTEGER NOT NULL,
        exercise_type VARCHAR(50) NOT NULL,
        correct_answers INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        time_spent_seconds INTEGER NOT NULL,
        hasanat_earned INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    results.push("✅ exercise_sessions");

    await client.query("COMMIT");
    results.push("✅ Sve tabele kreirane");

    // Seed: admin user
    const existingAdmin = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (existingAdmin.rows.length === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO users (username, display_name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)",
        ["admin", "Administrator", "admin@mekteb.net", hash, "admin"]
      );
      results.push("✅ Admin user: admin / admin123");
    } else {
      results.push("⏭ Admin već postoji");
    }

    // Seed: test mekteb
    let mektebId: number;
    const existingMekteb = await client.query("SELECT id FROM mektebi WHERE naziv = 'Mekteb Testni'");
    if (existingMekteb.rows.length === 0) {
      const m = await client.query(
        "INSERT INTO mektebi (naziv, grad, kontakt_email) VALUES ($1,$2,$3) RETURNING id",
        ["Mekteb Testni", "Sarajevo", "test@mekteb.net"]
      );
      mektebId = m.rows[0].id;
      results.push("✅ Test mekteb kreiran");
    } else {
      mektebId = existingMekteb.rows[0].id;
      results.push("⏭ Test mekteb već postoji");
    }

    // Seed: muallim1
    const existingMuallim = await client.query("SELECT id FROM users WHERE username = 'muallim1'");
    if (existingMuallim.rows.length === 0) {
      const hash = await bcrypt.hash("muallim123", 10);
      const mu = await client.query(
        "INSERT INTO users (username, display_name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id",
        ["muallim1", "Muallim Test", "muallim@mekteb.net", hash, "muallim"]
      );
      await client.query(
        "INSERT INTO muallim_profili (user_id, mekteb_id, licence_count, licences_used) VALUES ($1,$2,$3,$4)",
        [mu.rows[0].id, mektebId, 50, 0]
      );
      results.push("✅ Muallim: muallim1 / muallim123");
    } else {
      results.push("⏭ Muallim1 već postoji");
    }

    return res.json({
      success: true,
      message: "Setup završen!",
      results,
    });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ error: err.message, results });
  } finally {
    client.release();
  }
});

export default router;
