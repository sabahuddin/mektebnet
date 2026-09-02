// Automatski e2e test: arhiviranje grupe ne smije izgubiti ocjene/prisustvo/zadaće.
// Pokretanje (api-server workflow mora biti pokrenut):
//   node artifacts/api-server/scripts/test-arhiviranje-grupe.mjs
//
// Test seeda vlastite podatke u dev DB (prefiks __arhtest__), vrti sve provjere
// preko HTTP API-ja sa ručno potpisanim JWT-om, i na kraju počisti za sobom.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "..", "package.json"));
const jwt = require("jsonwebtoken");
const requireDb = createRequire(path.join(__dirname, "..", "..", "..", "lib", "db", "package.json"));
const { Pool } = requireDb("pg");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL nije postavljen"); process.exit(1); }
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET nije postavljen");
  process.exit(1);
}
const API = process.env.API_BASE || "http://localhost:80/api";
const P = "__arhtest__";

const pool = new Pool({ connectionString: DATABASE_URL });
const q = (text, params) => pool.query(text, params);

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${extra !== undefined ? " — " + JSON.stringify(extra) : ""}`); }
}

async function api(method, url, token, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function cleanup() {
  await q(`DELETE FROM grupe_arhiva_clanovi WHERE grupa_id IN (SELECT id FROM grupe WHERE naziv LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM ocjene WHERE ucenik_id IN (SELECT id FROM users WHERE username LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM prisustvo WHERE ucenik_id IN (SELECT id FROM users WHERE username LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM zadace WHERE grupa_id IN (SELECT id FROM grupe WHERE naziv LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM plan_lekcija WHERE grupa_id IN (SELECT id FROM grupe WHERE naziv LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM grupe WHERE naziv LIKE $1`, [P + "%"]);
  await q(`DELETE FROM ucenik_profili WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM muallim_profili WHERE user_id IN (SELECT id FROM users WHERE username LIKE $1)`, [P + "%"]);
  await q(`DELETE FROM users WHERE username LIKE $1`, [P + "%"]);
}

async function main() {
  // Provjeri da API radi
  const health = await fetch(`${API}/healthz`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`API server nije dostupan na ${API} — pokreni workflow pa ponovi.`);
    process.exit(1);
  }

  await cleanup(); // za slučaj ostataka od prošlog neuspjelog runa

  // ---- Seed ----
  const [{ rows: [mu] }] = [await q(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
     VALUES ($1, 'x', 'Arhtest Muallim', 'muallim', true) RETURNING id`, [P + "muallim"])];
  const muallimId = mu.id;
  await q(`INSERT INTO muallim_profili (user_id, licence_count, licences_used) VALUES ($1, 100, 0)`, [muallimId]);

  const { rows: [gr] } = await q(
    `INSERT INTO grupe (muallim_id, naziv, skolska_godina) VALUES ($1, $2, '2025/26') RETURNING id`,
    [muallimId, P + "grupa"]);
  const grupaId = gr.id;

  const ucenici = [];
  for (const suf of ["u1", "u2"]) {
    const { rows: [u] } = await q(
      `INSERT INTO users (username, password_hash, display_name, role, is_active)
       VALUES ($1, 'x', $2, 'ucenik', true) RETURNING id`, [P + suf, "Arhtest " + suf]);
    await q(`INSERT INTO ucenik_profili (user_id, muallim_id, grupa_id) VALUES ($1, $2, $3)`, [u.id, muallimId, grupaId]);
    ucenici.push(u.id);
  }

  await q(`INSERT INTO ocjene (ucenik_id, muallim_id, grupa_id, kategorija, ocjena, datum) VALUES ($1, $2, $3, 'ilmihal', 5, '2026-08-01'), ($4, $2, $3, 'sufara', 4, '2026-08-02')`,
    [ucenici[0], muallimId, grupaId, ucenici[1]]);
  await q(`INSERT INTO prisustvo (ucenik_id, grupa_id, muallim_id, datum, status) VALUES ($1, $2, $3, '2026-08-01', 'prisutan'), ($4, $2, $3, '2026-08-01', 'odsutan')`,
    [ucenici[0], grupaId, muallimId, ucenici[1]]);
  await q(`INSERT INTO zadace (grupa_id, muallim_id, naslov) VALUES ($1, $2, 'Arhtest zadaća')`, [grupaId, muallimId]);
  await q(`INSERT INTO plan_lekcija (grupa_id, muallim_id, datum, lekcija_naslov) VALUES ($1, $2, '2026-08-01', 'Arhtest lekcija')`, [grupaId, muallimId]);

  const counts = async () => {
    const { rows: [r] } = await q(
      `SELECT
        (SELECT COUNT(*) FROM ocjene WHERE grupa_id = $1)::int AS ocjene,
        (SELECT COUNT(*) FROM prisustvo WHERE grupa_id = $1)::int AS prisustvo,
        (SELECT COUNT(*) FROM zadace WHERE grupa_id = $1)::int AS zadace,
        (SELECT COUNT(*) FROM plan_lekcija WHERE grupa_id = $1)::int AS plan`, [grupaId]);
    return r;
  };
  const before = await counts();

  const token = jwt.sign(
    { userId: muallimId, username: P + "muallim", role: "muallim", displayName: "Arhtest Muallim" },
    JWT_SECRET, { expiresIn: "1h" });

  console.log("\n(1+6) Konkurentno arhiviranje — tačno jedan zahtjev uspije:");
  const [r1, r2] = await Promise.all([
    api("POST", `/muallim/grupe/${grupaId}/arhiviraj`, token),
    api("POST", `/muallim/grupe/${grupaId}/arhiviraj`, token),
  ]);
  const oks = [r1, r2].filter(r => r.status === 200 && r.json?.success).length;
  const bads = [r1, r2].filter(r => r.status === 400).length;
  check("tačno jedan 200 i jedan 400", oks === 1 && bads === 1, { r1, r2 });

  console.log("\n(1) Podaci netaknuti nakon arhiviranja:");
  const after = await counts();
  check("ocjene/prisustvo/zadaće/plan isti kao prije", JSON.stringify(before) === JSON.stringify(after), { before, after });

  console.log("\n(2) Učenici oslobođeni (grupa_id = null):");
  const { rows: prof } = await q(`SELECT grupa_id FROM ucenik_profili WHERE user_id = ANY($1)`, [ucenici]);
  check("svi profili imaju grupa_id null", prof.length === 2 && prof.every(p => p.grupa_id === null), prof);

  console.log("\n(3+6) Snapshot kompletan i bez duplikata:");
  const { rows: snap } = await q(`SELECT ucenik_id, display_name, username FROM grupe_arhiva_clanovi WHERE grupa_id = $1 ORDER BY ucenik_id`, [grupaId]);
  check("tačno 2 reda snapshot-a", snap.length === 2, snap);
  check("snapshot sadrži oba učenika sa imenom i username-om",
    snap.length === 2 &&
    JSON.stringify(snap.map(s => s.ucenik_id)) === JSON.stringify([...ucenici].sort((a, b) => a - b)) &&
    snap.every(s => s.display_name && s.username), snap);
  const arhClanovi = await api("GET", `/muallim/grupe/${grupaId}/arhiva-clanovi`, token);
  check("API /arhiva-clanovi vraća 2 člana", arhClanovi.status === 200 && arhClanovi.json?.length === 2, arhClanovi);

  console.log("\n(4) Arhivirana grupa: ne može se obrisati ni primati učenike:");
  const del = await api("DELETE", `/muallim/grupe/${grupaId}`, token);
  check("DELETE vraća 400", del.status === 400, del);
  const { rows: [gexists] } = await q(`SELECT COUNT(*)::int AS c FROM grupe WHERE id = $1`, [grupaId]);
  check("grupa i dalje postoji u bazi", gexists.c === 1);
  const noviUcenik = await api("POST", "/muallim/ucenici", token, { displayName: "Arhtest Novi", grupaId });
  check("dodavanje učenika u arhiviranu grupu vraća 400", noviUcenik.status === 400, noviUcenik);
  const { rows: [novi] } = await q(`SELECT COUNT(*)::int AS c FROM users WHERE display_name = 'Arhtest Novi'`);
  check("novi učenik NIJE kreiran", novi.c === 0);

  console.log("\n(5) Vraćanje iz arhive:");
  const vrati = await api("POST", `/muallim/grupe/${grupaId}/vrati`, token);
  check("vrati vraća 200", vrati.status === 200 && vrati.json?.success, vrati);
  const { rows: [garh] } = await q(`SELECT is_archived, archived_at, is_active FROM grupe WHERE id = $1`, [grupaId]);
  check("grupa više nije arhivirana i aktivna je", garh.is_archived === false && garh.archived_at === null && garh.is_active === true, garh);
  const dodaj = await api("POST", "/muallim/ucenici", token, { displayName: "Arhtest Poslije", grupaId });
  check("nakon vraćanja učenik se opet može dodati", dodaj.status === 201, dodaj);
  // označi kreiranog za cleanup
  if (dodaj.status === 201 && dodaj.json?.username) {
    await q(`UPDATE users SET username = $1 || username WHERE username = $2`, [P, dodaj.json.username]);
  }

  console.log("\n(6) Ponovno arhiviranje ne pravi duplikate u snapshotu:");
  const arh2 = await api("POST", `/muallim/grupe/${grupaId}/arhiviraj`, token);
  check("ponovno arhiviranje uspije", arh2.status === 200, arh2);
  const { rows: snap2 } = await q(`SELECT ucenik_id, COUNT(*)::int AS c FROM grupe_arhiva_clanovi WHERE grupa_id = $1 GROUP BY ucenik_id`, [grupaId]);
  check("nijedan učenik nema duplikat reda", snap2.every(s => s.c === 1), snap2);
  const after2 = await counts();
  check("podaci i dalje netaknuti", JSON.stringify(before) === JSON.stringify(after2), { before, after2 });

  console.log(failures === 0 ? "\nSVE PROVJERE PROŠLE ✓" : `\n${failures} PROVJERA PALO ✗`);
}

main()
  .catch((e) => { failures++; console.error("Test error:", e); })
  .finally(async () => {
    try { await cleanup(); } catch (e) { console.error("Cleanup error:", e); }
    await pool.end();
    process.exit(failures === 0 ? 0 : 1);
  });
