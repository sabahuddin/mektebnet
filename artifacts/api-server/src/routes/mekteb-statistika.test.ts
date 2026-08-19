/**
 * Task #167 — Spriječi da zbirna statistika mekteba tiho pokaže pogrešne brojeve
 *
 * Provjerava dva invarijanta:
 *   1. Suma po muallimima mora odgovarati globalnom broju u /mekteb/statistika:
 *      sum(muallimi[].ukupnoUcenika)  == global.ukupnoUcenika
 *      sum(muallimi[].ukupnoBodova)   == global.ukupnoBodova
 *      sum(muallimi[].zvjezdicePozitivne) == global.zvjezdicePozitivne
 *      sum(muallimi[].zvjezdiceNegativne) == global.zvjezdiceNegativne
 *   2. Učenik bez ijedne zvjezdice mora dobiti eksplicitne nule (ne izostati
 *      iz odgovora) u /grupa/:id/statistika.
 *
 * Pattern: signToken (HS256, isti secret kao app), in-process server na
 * efemernom portu, seed i cleanup dev baze. Demo grupe imaju is_active=false
 * pa test sije vlastite aktivne grupe.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  grupeTable,
  mektebiTable,
  kvizRezultatiTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

// ── Seed identifikatori ──────────────────────────────────────────────────────

const SUFFIX = `t${Date.now()}`;

let server: Server;
let baseUrl: string;

let mektebId: number;
let muallimId: number;
let grupaId: number;
let ucenik1Id: number; // dobit će 2 pozitivne + 1 negativna zvjezdica, 50 bodova
let ucenik2Id: number; // bez ijedne zvjezdice, 30 bodova
let muallimToken: string;

// ── Zvjezdice — raw SQL (tabela nije u drizzle shemi) ───────────────────────

async function insertZvjezdica(ucenikId: number, muallimIdArg: number, tip: "pozitivna" | "negativna") {
  await db.execute(sql`
    INSERT INTO zvjezdice_log (ucenik_id, muallim_id, tip, created_at)
    VALUES (${ucenikId}, ${muallimIdArg}, ${tip}, NOW())
  `);
}

async function deleteZvjezdiceZaUcenike(ucenikIds: number[]) {
  if (ucenikIds.length === 0) return;
  await db.execute(sql`
    DELETE FROM zvjezdice_log
    WHERE ucenik_id IN (${sql.join(ucenikIds.map((id) => sql`${id}`), sql`, `)})
  `);
}

// ── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  // Pre-cleanup: izbriši eventualne ostatke prekinutih prethodnih pokretanja
  // istog testa (SUFFIX se mijenja po milisekundi, ali crash može ostaviti
  // podatke bez da after() prođe).
  const existingMuallim = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, `muallim.${SUFFIX}`));
  if (existingMuallim.length > 0) {
    const existingMuallimId = existingMuallim[0].id;
    const existingGrupe = await db
      .select({ id: grupeTable.id })
      .from(grupeTable)
      .where(eq(grupeTable.muallimId, existingMuallimId));
    for (const g of existingGrupe) {
      const existingUcenici = await db
        .select({ userId: ucenikProfiliTable.userId })
        .from(ucenikProfiliTable)
        .where(eq(ucenikProfiliTable.grupaId, g.id));
      const uIds = existingUcenici.map((u) => u.userId);
      if (uIds.length > 0) {
        await deleteZvjezdiceZaUcenike(uIds);
        await db.delete(kvizRezultatiTable).where(inArray(kvizRezultatiTable.userId, uIds));
        await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, uIds));
        await db.delete(usersTable).where(inArray(usersTable.id, uIds));
      }
      await db.delete(grupeTable).where(eq(grupeTable.id, g.id));
    }
    await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, existingMuallimId));
    const existingMektebProfil = await db
      .select({ mektebId: muallimProfiliTable.mektebId })
      .from(muallimProfiliTable)
      .where(eq(muallimProfiliTable.userId, existingMuallimId));
    await db.delete(usersTable).where(eq(usersTable.id, existingMuallimId));
    if (existingMektebProfil[0]?.mektebId) {
      await db.delete(mektebiTable).where(eq(mektebiTable.id, existingMektebProfil[0].mektebId));
    }
  }

  // Mekteb
  const [mekteb] = await db
    .insert(mektebiTable)
    .values({ naziv: `Test Mekteb ${SUFFIX}`, dozvoljenoMuallima: 5 })
    .returning({ id: mektebiTable.id });
  mektebId = mekteb.id;

  // Muallim (glavni)
  const [muallimUser] = await db
    .insert(usersTable)
    .values({
      username: `muallim.${SUFFIX}`,
      displayName: `Muallim ${SUFFIX}`,
      passwordHash: "x",
      role: "muallim",
      isActive: true,
    })
    .returning({ id: usersTable.id });
  muallimId = muallimUser.id;

  await db.insert(muallimProfiliTable).values({
    userId: muallimId,
    mektebId,
    isGlavni: true,
    licenceCount: 30,
    licencesUsed: 0,
  });

  // Aktivna grupa (is_active=true, nema is_archived u shemi pa je default false)
  const [grupa] = await db
    .insert(grupeTable)
    .values({
      muallimId,
      naziv: `Grupa ${SUFFIX}`,
      skolskaGodina: "2025/26",
      isActive: true,
    })
    .returning({ id: grupeTable.id });
  grupaId = grupa.id;

  // Učenici
  const [u1] = await db
    .insert(usersTable)
    .values({
      username: `ucenik1.${SUFFIX}`,
      displayName: `Ucenik1 ${SUFFIX}`,
      passwordHash: "x",
      role: "ucenik",
      isActive: true,
    })
    .returning({ id: usersTable.id });
  ucenik1Id = u1.id;

  const [u2] = await db
    .insert(usersTable)
    .values({
      username: `ucenik2.${SUFFIX}`,
      displayName: `Ucenik2 ${SUFFIX}`,
      passwordHash: "x",
      role: "ucenik",
      isActive: true,
    })
    .returning({ id: usersTable.id });
  ucenik2Id = u2.id;

  await db.insert(ucenikProfiliTable).values([
    { userId: ucenik1Id, muallimId, grupaId },
    { userId: ucenik2Id, muallimId, grupaId },
  ]);

  // Kviz bodovi: ucenik1=50, ucenik2=30  →  ukupno 80 za grupu/mekteb
  await db.insert(kvizRezultatiTable).values([
    {
      userId: ucenik1Id,
      kvizId: 9999,
      kvizNaslov: "Test kviz",
      tacniOdgovori: 5,
      ukupnoPitanja: 10,
      procenat: 50,
      bodovi: 50,
    },
    {
      userId: ucenik2Id,
      kvizId: 9999,
      kvizNaslov: "Test kviz",
      tacniOdgovori: 3,
      ukupnoPitanja: 10,
      procenat: 30,
      bodovi: 30,
    },
  ]);

  // Zvjezdice: ucenik1 — 2 pozitivne, 1 negativna; ucenik2 — nijedno
  await insertZvjezdica(ucenik1Id, muallimId, "pozitivna");
  await insertZvjezdica(ucenik1Id, muallimId, "pozitivna");
  await insertZvjezdica(ucenik1Id, muallimId, "negativna");

  muallimToken = signToken({
    userId: muallimId,
    username: `muallim.${SUFFIX}`,
    role: "muallim",
    displayName: `Muallim ${SUFFIX}`,
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

// ── Teardown ─────────────────────────────────────────────────────────────────

after(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));

  const ucenikIds = [ucenik1Id, ucenik2Id].filter(Boolean);
  if (ucenikIds.length > 0) {
    await deleteZvjezdiceZaUcenike(ucenikIds);
    await db.delete(kvizRezultatiTable).where(inArray(kvizRezultatiTable.userId, ucenikIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, ucenikIds));
    await db.delete(usersTable).where(inArray(usersTable.id, ucenikIds));
  }
  if (grupaId) {
    await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
  }
  if (muallimId) {
    await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
    await db.delete(usersTable).where(eq(usersTable.id, muallimId));
  }
  if (mektebId) {
    await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function glavniGet(path: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${muallimToken}` },
  });
}

function glavniPost(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${muallimToken}`,
    },
    body: JSON.stringify(body),
  });
}

// ── Testovi ───────────────────────────────────────────────────────────────────

test("mekteb/statistika — suma muallimi[] odgovara global vrijednostima", async () => {
  const res = await glavniGet("/api/muallim/mekteb/statistika");
  assert.equal(res.status, 200, "Endpoint mora vratiti 200");

  const body = (await res.json()) as {
    global: {
      ukupnoUcenika: number;
      ukupnoBodova: number;
      zvjezdicePozitivne: number;
      zvjezdiceNegativne: number;
    };
    muallimi: Array<{
      muallimId: number;
      ukupnoUcenika: number;
      ukupnoBodova: number;
      zvjezdicePozitivne: number;
      zvjezdiceNegativne: number;
    }>;
  };

  // Filtriraj samo muallima iz ovog testa (drugi muallimi u dev bazi se ignorišu)
  const testMuallimi = body.muallimi.filter((m) => m.muallimId === muallimId);

  const sumaUcenika = testMuallimi.reduce((a, m) => a + m.ukupnoUcenika, 0);
  const sumaBodova = testMuallimi.reduce((a, m) => a + m.ukupnoBodova, 0);
  const sumaPozitivnih = testMuallimi.reduce((a, m) => a + m.zvjezdicePozitivne, 0);
  const sumaNegativnih = testMuallimi.reduce((a, m) => a + m.zvjezdiceNegativne, 0);

  // Provjeri da test-muallim uopšte ima podatke (seed je uspio)
  assert.ok(testMuallimi.length > 0, "Test muallim mora biti u odgovoru");
  assert.equal(sumaUcenika, 2, "Test muallim treba imati tačno 2 učenika");
  assert.equal(sumaBodova, 80, "Ukupno bodova (50+30) mora biti 80");
  assert.equal(sumaPozitivnih, 2, "Pozitivne zvjezdice test muallima moraju biti 2");
  assert.equal(sumaNegativnih, 1, "Negativne zvjezdice test muallima moraju biti 1");

  // Ključni invarijant: global mora biti suma muallima.
  // Budući da dev baza može imati i druge aktivne grupe, pronađemo sve
  // muallime u odgovoru i provjerimo da je global zaista suma:
  const sviUcenici = body.muallimi.reduce((a, m) => a + m.ukupnoUcenika, 0);
  const sviBodovi = body.muallimi.reduce((a, m) => a + m.ukupnoBodova, 0);
  const sviPozitivni = body.muallimi.reduce((a, m) => a + m.zvjezdicePozitivne, 0);
  const sviNegativni = body.muallimi.reduce((a, m) => a + m.zvjezdiceNegativne, 0);

  assert.equal(
    body.global.ukupnoUcenika,
    sviUcenici,
    `global.ukupnoUcenika (${body.global.ukupnoUcenika}) mora biti suma muallimi[].ukupnoUcenika (${sviUcenici})`,
  );
  assert.equal(
    body.global.ukupnoBodova,
    sviBodovi,
    `global.ukupnoBodova (${body.global.ukupnoBodova}) mora biti suma muallimi[].ukupnoBodova (${sviBodovi})`,
  );
  assert.equal(
    body.global.zvjezdicePozitivne,
    sviPozitivni,
    `global.zvjezdicePozitivne (${body.global.zvjezdicePozitivne}) mora biti suma muallimi[].zvjezdicePozitivne (${sviPozitivni})`,
  );
  assert.equal(
    body.global.zvjezdiceNegativne,
    sviNegativni,
    `global.zvjezdiceNegativne (${body.global.zvjezdiceNegativne}) mora biti suma muallimi[].zvjezdiceNegativne (${sviNegativni})`,
  );
});

test("grupa/statistika — učenik bez zvjezdica dobija eksplicitne nule (ne izostaje)", async () => {
  const res = await glavniGet(`/api/muallim/grupa/${grupaId}/statistika`);
  assert.equal(res.status, 200, "Endpoint mora vratiti 200");

  const body = (await res.json()) as {
    ucenici: Array<{
      id: number;
      zvjezdicePozitivne: number;
      zvjezdiceNegativne: number;
    }>;
  };

  // Ucenik2 nema nijednu zvjezdicu — mora biti u odgovoru sa nulama
  const u2 = body.ucenici.find((u) => u.id === ucenik2Id);
  assert.ok(u2 !== undefined, `Ucenik ${ucenik2Id} (bez zvjezdica) mora biti u odgovoru`);
  assert.equal(u2!.zvjezdicePozitivne, 0, "Učenik bez zvjezdica mora imati 0 pozitivnih");
  assert.equal(u2!.zvjezdiceNegativne, 0, "Učenik bez zvjezdica mora imati 0 negativnih");

  // Ucenik1 mora imati tačan broj
  const u1 = body.ucenici.find((u) => u.id === ucenik1Id);
  assert.ok(u1 !== undefined, `Ucenik ${ucenik1Id} mora biti u odgovoru`);
  assert.equal(u1!.zvjezdicePozitivne, 2, "Ucenik1 mora imati 2 pozitivne zvjezdice");
  assert.equal(u1!.zvjezdiceNegativne, 1, "Ucenik1 mora imati 1 negativnu zvjezdicu");
});

test("profil učenika prikazuje kategoriju zvjezdice ponašanja", async () => {
  const nazivKategorije = `Odgovornost ${SUFFIX}`;
  const categoryResult = await db.execute(sql`
    INSERT INTO zvjezdice_kategorije (tip, naziv)
    VALUES ('pozitivna', ${nazivKategorije})
    RETURNING id
  `);
  const kategorijaId = Number((categoryResult.rows[0] as { id: number }).id);

  try {
    const addResponse = await glavniPost(`/api/muallim/ucenik/${ucenik2Id}/zvjezdice`, {
      tip: "pozitivna",
      razlog: "Samostalno je završio zadatak",
      kategorija_id: kategorijaId,
    });
    assert.equal(addResponse.status, 201);

    const profileResponse = await glavniGet(`/api/muallim/ucenik/${ucenik2Id}/zvjezdice`);
    assert.equal(profileResponse.status, 200);
    const body = (await profileResponse.json()) as {
      entries: Array<{ kategorija_naziv?: string | null; razlog?: string | null }>;
    };
    assert.equal(body.entries[0]?.kategorija_naziv, nazivKategorije);
    assert.equal(body.entries[0]?.razlog, "Samostalno je završio zadatak");
  } finally {
    await deleteZvjezdiceZaUcenike([ucenik2Id]);
    await db.execute(sql`DELETE FROM zvjezdice_kategorije WHERE id = ${kategorijaId}`);
  }
});
