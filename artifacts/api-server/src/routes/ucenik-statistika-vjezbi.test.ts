import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  embedCompletionsTable,
  etapaPolaganjaTable,
  grupeTable,
  h5pPokusajiTable,
  ilmihalLekcijeTable,
  medaljoniTable,
  mektebiTable,
  muallimProfiliTable,
  prilozi,
  staticVjezbaPokusajiTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `stat-vjezbi-${Date.now()}`;

let server: Server;
let baseUrl: string;
let mektebId: number;
let muallimId: number;
let straniMuallimId: number;
let ucenikId: number;
let grupaId: number;
let lekcijaId: number;
let h5pPrilogId: number;
let nasaVjezbaPrilogId: number;
let vanjskaVjezbaPrilogId: number;
let medaljonId: number;
let token: string;
let straniToken: string;

interface Statistika {
  h5p: { vjezbe: number; pokusaji: number; prosjekProcenat: number | null; kapiMeda: number; stavke: Array<{ naziv: string; najboljiProcenat: number }> };
  naseVjezbe: { vjezbe: number; zavrseno: number; kapiMeda: number; stavke: Array<{ naziv: string }> };
  etapneVjezbe: { vjezbe: number; pokusaji: number; prosjekProcenat: number | null; stavke: Array<{ id: string; naziv: string; najboljiProcenat: number }> };
  vanjskeVjezbe: { zavrseno: number; kapiMeda: number };
  etapniKvizovi: { etape: number; polozeno: number; pokusaji: number; prosjekProcenat: number | null; najboljiProsjek: number | null; stavke: Array<{ polozeno: boolean; najboljiProcenat: number; pokusaji: number }> };
}

before(async () => {
  const [mekteb] = await db.insert(mektebiTable).values({ naziv: `Mekteb ${SUFFIX}` }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;

  const [muallim] = await db.insert(usersTable).values({
    username: `muallim.${SUFFIX}`, displayName: `Muallim ${SUFFIX}`, passwordHash: "x", role: "muallim", isActive: true,
  }).returning({ id: usersTable.id });
  muallimId = muallim.id;
  const [strani] = await db.insert(usersTable).values({
    username: `strani.${SUFFIX}`, displayName: `Strani ${SUFFIX}`, passwordHash: "x", role: "muallim", isActive: true,
  }).returning({ id: usersTable.id });
  straniMuallimId = strani.id;
  const [ucenik] = await db.insert(usersTable).values({
    username: `ucenik.${SUFFIX}`, displayName: `Učenik ${SUFFIX}`, passwordHash: "x", role: "ucenik", isActive: true,
  }).returning({ id: usersTable.id });
  ucenikId = ucenik.id;

  await db.insert(muallimProfiliTable).values([
    { userId: muallimId, mektebId, isGlavni: false },
    { userId: straniMuallimId, mektebId, isGlavni: false },
  ]);
  const [grupa] = await db.insert(grupeTable).values({
    muallimId, naziv: `Grupa ${SUFFIX}`, skolskaGodina: "2026/27", isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;
  await db.insert(ucenikProfiliTable).values({ userId: ucenikId, muallimId, grupaId, mektebId });

  const [lekcija] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1, slug: `lekcija-${SUFFIX}`, naslov: `Lekcija ${SUFFIX}`, redoslijed: 9000,
  }).returning({ id: ilmihalLekcijeTable.id });
  lekcijaId = lekcija.id;

  const [h5pPrilog] = await db.insert(prilozi).values({
    lekcijaId, originalName: "vjezba.h5p", kind: "h5p", approved: true,
  }).returning({ id: prilozi.id });
  h5pPrilogId = h5pPrilog.id;
  const [nasa] = await db.insert(prilozi).values({
    lekcijaId, originalName: "Osmosmjerka: abdest", kind: "embed", approved: true,
    externalUrl: "/vjezbe/osmosmjerka/osmosmjerka.html?podaci=/api/nase-vjezbe/podaci/osmosmjerka/abdest.json",
  }).returning({ id: prilozi.id });
  nasaVjezbaPrilogId = nasa.id;
  const [vanjska] = await db.insert(prilozi).values({
    lekcijaId, originalName: "LearningApps vježba", kind: "embed", approved: true,
    externalUrl: "https://learningapps.org/watch?v=abc",
  }).returning({ id: prilozi.id });
  vanjskaVjezbaPrilogId = vanjska.id;

  await db.insert(h5pPokusajiTable).values([
    { userId: ucenikId, priloziId: h5pPrilogId, attemptNo: 1, score: 6, maxScore: 10, procenat: 60, hasanatGained: 3 },
    { userId: ucenikId, priloziId: h5pPrilogId, attemptNo: 2, score: 9, maxScore: 10, procenat: 90, hasanatGained: 1 },
  ]);
  await db.insert(staticVjezbaPokusajiTable).values([
    { userId: ucenikId, exerciseKey: "etapa-lekcije-1-10", attemptNo: 1, score: 23, maxScore: 23, procenat: 100, hasanatGained: 10 },
  ]);
  await db.insert(embedCompletionsTable).values([
    { studentId: String(ucenikId), priloziId: nasaVjezbaPrilogId, hasanatGained: 5 },
    { studentId: String(ucenikId), priloziId: vanjskaVjezbaPrilogId, hasanatGained: 2 },
  ]);

  const [medaljon] = await db.insert(medaljoniTable).values({
    nivo: 1, slug: `medaljon-${SUFFIX}`, naziv: `Etapa ${SUFFIX}`, posAfterRedoslijed: 10,
  }).returning({ id: medaljoniTable.id });
  medaljonId = medaljon.id;
  await db.insert(etapaPolaganjaTable).values([
    { studentId: String(ucenikId), medaljonId, brojTacnih: 5, brojPitanja: 10, procenat: 50, polozeno: false, pokusajBr: 1 },
    { studentId: String(ucenikId), medaljonId, brojTacnih: 9, brojPitanja: 10, procenat: 90, polozeno: true, pokusajBr: 2 },
  ]);

  token = signToken({ userId: muallimId, username: `muallim.${SUFFIX}`, role: "muallim", displayName: "Muallim" });
  straniToken = signToken({ userId: straniMuallimId, username: `strani.${SUFFIX}`, role: "muallim", displayName: "Strani" });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (ucenikId) {
    await db.delete(h5pPokusajiTable).where(eq(h5pPokusajiTable.userId, ucenikId));
    await db.delete(staticVjezbaPokusajiTable).where(eq(staticVjezbaPokusajiTable.userId, ucenikId));
    await db.delete(embedCompletionsTable).where(eq(embedCompletionsTable.studentId, String(ucenikId)));
    await db.delete(etapaPolaganjaTable).where(eq(etapaPolaganjaTable.studentId, String(ucenikId)));
  }
  const prilogIds = [h5pPrilogId, nasaVjezbaPrilogId, vanjskaVjezbaPrilogId].filter(Boolean);
  if (prilogIds.length) await db.delete(prilozi).where(inArray(prilozi.id, prilogIds));
  if (medaljonId) await db.delete(medaljoniTable).where(eq(medaljoniTable.id, medaljonId));
  if (lekcijaId) await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
  const userIds = [muallimId, straniMuallimId, ucenikId].filter(Boolean);
  if (userIds.length) {
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    if (grupaId) await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
});

test("statistika broji vježbe po vrsti i računa uspjeh", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/ucenik/${ucenikId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(odgovor.status, 200);
  const stat = await odgovor.json() as Statistika;

  assert.equal(stat.h5p.vjezbe, 1);
  assert.equal(stat.h5p.pokusaji, 2);
  assert.equal(stat.h5p.prosjekProcenat, 75);
  assert.equal(stat.h5p.kapiMeda, 4);
  assert.equal(stat.h5p.stavke[0].najboljiProcenat, 90);

  assert.equal(stat.etapneVjezbe.vjezbe, 1);
  assert.equal(stat.etapneVjezbe.pokusaji, 1);
  assert.equal(stat.etapneVjezbe.prosjekProcenat, 100);
  assert.equal(stat.etapneVjezbe.stavke[0].naziv, "Ponavljanje lekcija 1–10");
});

test("naše vježbe se razdvajaju od vanjskih alata", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/ucenik/${ucenikId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const stat = await odgovor.json() as Statistika;

  assert.equal(stat.naseVjezbe.zavrseno, 1);
  assert.equal(stat.naseVjezbe.kapiMeda, 5);
  assert.equal(stat.naseVjezbe.stavke[0].naziv, "Osmosmjerka: abdest");
  assert.equal(stat.vanjskeVjezbe.zavrseno, 1);
  assert.equal(stat.vanjskeVjezbe.kapiMeda, 2);
});

test("etapni kviz se broji jednom, sa najboljim rezultatom i ishodom", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/ucenik/${ucenikId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const stat = await odgovor.json() as Statistika;

  assert.equal(stat.etapniKvizovi.etape, 1);
  assert.equal(stat.etapniKvizovi.polozeno, 1);
  assert.equal(stat.etapniKvizovi.pokusaji, 2);
  assert.equal(stat.etapniKvizovi.prosjekProcenat, 70);
  assert.equal(stat.etapniKvizovi.najboljiProsjek, 90);
  assert.equal(stat.etapniKvizovi.stavke[0].pokusaji, 2);
  assert.equal(stat.etapniKvizovi.stavke[0].polozeno, true);
});

interface StatistikaGrupe {
  ucenici: Array<{
    id: number;
    ime: string;
    naseVjezbe: number;
    h5pVjezbe: number;
    h5pPokusaji: number;
    h5pProsjek: number | null;
    etapneVjezbe: number;
    etapnePokusaji: number;
    etapeUkupno: number;
    etapePolozeno: number;
    etapePokusaji: number;
    etapeProsjek: number | null;
  }>;
  ukupno: {
    naseVjezbe: number;
    h5pPokusaji: number;
    h5pProsjek: number | null;
    etapnePokusaji: number;
    etapePolozeno: number;
    etapeUkupno: number;
    etapeProsjek: number | null;
  };
}

test("statistika grupe sabira vježbe svih učenika", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(odgovor.status, 200);
  const stat = await odgovor.json() as StatistikaGrupe;

  assert.equal(stat.ucenici.length, 1);
  const red = stat.ucenici[0];
  assert.equal(red.id, ucenikId);
  assert.equal(red.naseVjezbe, 1);
  assert.equal(red.h5pVjezbe, 1);
  assert.equal(red.h5pPokusaji, 2);
  assert.equal(red.h5pProsjek, 75);
  assert.equal(red.etapneVjezbe, 1);
  assert.equal(red.etapnePokusaji, 1);
  assert.equal(red.etapeUkupno, 1);
  assert.equal(red.etapePolozeno, 1);
  assert.equal(red.etapePokusaji, 2);
  // Za etapu je mjerodavan najbolji pokušaj, ne prosjek svih.
  assert.equal(red.etapeProsjek, 90);

  assert.equal(stat.ukupno.naseVjezbe, 1);
  assert.equal(stat.ukupno.h5pPokusaji, 2);
  assert.equal(stat.ukupno.etapnePokusaji, 1);
  assert.equal(stat.ukupno.etapePolozeno, 1);
  assert.equal(stat.ukupno.etapeUkupno, 1);
  assert.equal(stat.ukupno.etapeProsjek, 90);
});

test("statistika tuđe grupe nije dostupna", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${straniToken}` },
  });
  assert.equal(odgovor.status, 403);
});

test("tuđi učenik nije dostupan", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/ucenik/${ucenikId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${straniToken}` },
  });
  assert.equal(odgovor.status, 403);
});
