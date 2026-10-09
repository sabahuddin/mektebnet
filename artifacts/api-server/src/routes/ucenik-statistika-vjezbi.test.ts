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
  korisnikNapredakTable,
  kvizoviTable,
  kvizRezultatiTable,
  medaljoniTable,
  mektebiTable,
  muallimProfiliTable,
  prilozi,
  priustvoTable,
  ocjeneTable,
  staticVjezbaPokusajiTable,
  studentMedaljoniTable,
  studentProgressTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";
import type { GroupStatisticsDetails } from "../lib/group-statistics-details.js";
import { sanitizeExcelCell, type ReportSection } from "../lib/group-statistics-report.js";
import * as XLSX from "xlsx";

const SUFFIX = `stat-vjezbi-${Date.now()}`;

let server: Server;
let baseUrl: string;
let mektebId: number;
let muallimId: number;
let straniMuallimId: number;
let ucenikId: number;
let drugiUcenikId: number;
let grupaId: number;
let lekcijaId: number;
let kanonskaLekcijaId: number;
let legacyLekcijaId: number;
let nezavrsenaLekcijaId: number;
let drugiTipLekcijaId: number;
let h5pPrilogId: number;
let nasaVjezbaPrilogId: number;
let vanjskaVjezbaPrilogId: number;
let medaljonId: number;
let kvizId: number;
let token: string;
let straniToken: string;

interface Statistika {
  completedLessonIds: number[];
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
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  muallimId = muallim.id;
  const [strani] = await db.insert(usersTable).values({
    username: `strani.${SUFFIX}`, displayName: `Strani ${SUFFIX}`, passwordHash: "x", role: "muallim", isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  straniMuallimId = strani.id;
  const [ucenik] = await db.insert(usersTable).values({
    username: `ucenik.${SUFFIX}`, displayName: `Učenik ${SUFFIX}`, passwordHash: "x", role: "ucenik", isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  ucenikId = ucenik.id;
  const [drugiUcenik] = await db.insert(usersTable).values({
    username: `drugi-ucenik.${SUFFIX}`, displayName: `Drugi učenik ${SUFFIX}`, passwordHash: "x", role: "ucenik", isActive: true,
  }).returning({ id: usersTable.id });
  drugiUcenikId = drugiUcenik.id;

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
  const dodatneLekcije = await db.insert(ilmihalLekcijeTable).values([
    { nivo: 1, slug: `kanonska-${SUFFIX}`, naslov: "Kanonska", redoslijed: 9001 },
    { nivo: 1, slug: `legacy-${SUFFIX}`, naslov: "Legacy", redoslijed: 9002 },
    { nivo: 1, slug: `nezavrsena-${SUFFIX}`, naslov: "Nezavršena", redoslijed: 9003 },
    { nivo: 1, slug: `drugi-tip-${SUFFIX}`, naslov: "Drugi tip", redoslijed: 9004 },
  ]).returning({ id: ilmihalLekcijeTable.id });
  const [kanonskaLekcija, legacyLekcija, nezavrsenaLekcija, drugiTipLekcija] = dodatneLekcije;
  kanonskaLekcijaId = kanonskaLekcija.id;
  legacyLekcijaId = legacyLekcija.id;
  nezavrsenaLekcijaId = nezavrsenaLekcija.id;
  drugiTipLekcijaId = drugiTipLekcija.id;

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
  await db.insert(studentProgressTable).values({
    studentId: String(ucenikId),
    completedLessons: [lekcijaId, lekcijaId, -1],
  });
  await db.insert(korisnikNapredakTable).values({
    userId: ucenikId, contentType: "ilmihal", contentId: lekcijaId, zavrsen: true,
  });
  await db.insert(studentMedaljoniTable).values({ studentId: String(ucenikId), medaljonId });
  const [kviz] = await db.insert(kvizoviTable).values({
    naslov: `Kviz ${SUFFIX}`, slug: `kviz-${SUFFIX}`, nivo: 1,
  }).returning({ id: kvizoviTable.id });
  kvizId = kviz.id;
  await db.insert(kvizRezultatiTable).values([
    { userId: ucenikId, kvizId, kvizNaslov: `Kviz ${SUFFIX}`, tacniOdgovori: 5, ukupnoPitanja: 10, procenat: 50, bodovi: 5 },
    { userId: ucenikId, kvizId, kvizNaslov: `Kviz ${SUFFIX}`, tacniOdgovori: 9, ukupnoPitanja: 10, procenat: 90, bodovi: 9 },
  ]);
  const datum = new Date().toISOString().slice(0, 10);
  await db.insert(ocjeneTable).values([
    { ucenikId, grupaId, muallimId, kategorija: "Ilmihal", predmet: "Ilmihal", ocjena: 5, datum, lekcijaNaziv: `Lekcija ${SUFFIX}` },
    { ucenikId, grupaId, muallimId, kategorija: "Kur'an", predmet: "Kur'an", ocjena: null, ocjenaOpisna: "uradjeno", datum },
    { ucenikId, grupaId, muallimId, kategorija: "Ilmihal", ocjena: 1, datum: "2020-09-01" },
  ]);
  await db.insert(priustvoTable).values([
    { ucenikId, grupaId, muallimId, datum, cas: 1, status: "prisutan" },
    { ucenikId, grupaId, muallimId, datum, cas: 2, status: "odsutan" },
    { ucenikId, grupaId, muallimId, datum: "2020-09-01", cas: 1, status: "prisutan" },
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
    await db.delete(studentMedaljoniTable).where(eq(studentMedaljoniTable.studentId, String(ucenikId)));
    await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(ucenikId)));
    if (drugiUcenikId) await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(drugiUcenikId)));
    await db.delete(korisnikNapredakTable).where(inArray(korisnikNapredakTable.userId, [ucenikId, drugiUcenikId]));
    await db.delete(kvizRezultatiTable).where(eq(kvizRezultatiTable.userId, ucenikId));
    await db.delete(ocjeneTable).where(eq(ocjeneTable.ucenikId, ucenikId));
    await db.delete(priustvoTable).where(eq(priustvoTable.ucenikId, ucenikId));
  }
  if (kvizId) await db.delete(kvizoviTable).where(eq(kvizoviTable.id, kvizId));
  const prilogIds = [h5pPrilogId, nasaVjezbaPrilogId, vanjskaVjezbaPrilogId].filter(Boolean);
  if (prilogIds.length) await db.delete(prilozi).where(inArray(prilozi.id, prilogIds));
  if (medaljonId) await db.delete(medaljoniTable).where(eq(medaljoniTable.id, medaljonId));
  const lekcijaIds = [lekcijaId, kanonskaLekcijaId, legacyLekcijaId, nezavrsenaLekcijaId, drugiTipLekcijaId].filter(Boolean);
  if (lekcijaIds.length) await db.delete(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lekcijaIds));
  const userIds = [muallimId, straniMuallimId, ucenikId, drugiUcenikId].filter(Boolean);
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

test("statistika vraća spojene, deduplicirane i učeniku scoped završene lekcije", async () => {
  await db.update(studentProgressTable).set({
    completedLessons: [lekcijaId, lekcijaId, -1, kanonskaLekcijaId, "123"] as unknown as number[],
  }).where(eq(studentProgressTable.studentId, String(ucenikId)));
  const temporaryNapredak = await db.insert(korisnikNapredakTable).values([
    { userId: ucenikId, contentType: "ilmihal", contentId: legacyLekcijaId, zavrsen: true },
    { userId: ucenikId, contentType: "ilmihal", contentId: nezavrsenaLekcijaId, zavrsen: false },
    { userId: ucenikId, contentType: "drugi-tip", contentId: drugiTipLekcijaId, zavrsen: true },
    { userId: drugiUcenikId, contentType: "ilmihal", contentId: drugiTipLekcijaId, zavrsen: true },
  ]).returning({ id: korisnikNapredakTable.id });
  await db.insert(studentProgressTable).values({
    studentId: String(drugiUcenikId), completedLessons: [drugiTipLekcijaId],
  });

  try {
    const odgovor = await fetch(`${baseUrl}/api/muallim/ucenik/${ucenikId}/statistika-vjezbi`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(odgovor.status, 200);
    const stat = await odgovor.json() as Statistika;

    assert.deepEqual(
      [...stat.completedLessonIds].sort((a, b) => a - b),
      [-1, lekcijaId, kanonskaLekcijaId, legacyLekcijaId].sort((a, b) => a - b),
    );
    assert.equal(new Set(stat.completedLessonIds).size, stat.completedLessonIds.length);
    assert.ok(!stat.completedLessonIds.includes(nezavrsenaLekcijaId));
    assert.ok(!stat.completedLessonIds.includes(drugiTipLekcijaId));
  } finally {
    await db.delete(korisnikNapredakTable).where(inArray(
      korisnikNapredakTable.id, temporaryNapredak.map(row => row.id),
    ));
    await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(drugiUcenikId)));
    await db.update(studentProgressTable).set({
      completedLessons: [lekcijaId, lekcijaId, -1],
    }).where(eq(studentProgressTable.studentId, String(ucenikId)));
  }
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
  const detalji = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/statistika`, {
    headers: { Authorization: `Bearer ${straniToken}` },
  });
  assert.equal(detalji.status, 403);
});

test("šest sekcija grupe ima stvarne detalje, bez duplih lekcija i etapa", async () => {
  const response = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/statistika`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  const result = await response.json() as {
    detaljiUcenika: GroupStatisticsDetails[];
    ucenici: Array<{
      prisustvoPct: number; ukupnoPrisustvo: number; ukupnaProsjecna: number;
      brojOcjena: number; prosjecneOcjene: Record<string, { prosjek: number }>;
    }>;
  };
  assert.equal(result.detaljiUcenika.length, 1);
  const d = result.detaljiUcenika[0];
  assert.equal(d.id, ucenikId);
  assert.deepEqual(d.lekcije.map(l => l.id), [lekcijaId]);
  assert.equal(d.kvizovi.length, 2);
  assert.equal(new Set(d.kvizovi.map(k => k.kvizId)).size, 1);
  assert.equal(d.kvizovi[0].nivo, 1);
  assert.equal(d.kvizovi[0].naslov, `Kviz ${SUFFIX}`);
  assert.equal(d.ocjene.length, 2);
  assert.equal(d.ocjene.filter(o => o.ocjena !== null).length, 1);
  assert.equal(d.ocjene.filter(o => o.ocjenaOpisna === "uradjeno").length, 1);
  assert.equal(d.etape.length, 1);
  assert.equal(d.etape[0].brojPokusaja, 2);
  assert.equal(d.etape[0].polozeno, true);
  assert.equal(d.etape[0].najboljiProcenat, 90);
  assert.equal(d.medaljoni.length, 1);
  assert.equal(d.medaljoni[0].medaljonId, medaljonId);
  assert.ok(d.medaljoni[0].datum);
  assert.equal(result.ucenici[0].prisustvoPct, 50);
  assert.equal(result.ucenici[0].ukupnoPrisustvo, 2);
  assert.equal(result.ucenici[0].ukupnaProsjecna, 5);
  assert.equal(result.ucenici[0].brojOcjena, 2);
  assert.equal(result.ucenici[0].prosjecneOcjene["Kur'an"], undefined);
});

test("arhivirani učenik nije u detaljima, aktivan bez aktivnosti ima prazne sekcije", async () => {
  const ids: number[] = [];
  try {
    for (const isArchived of [false, true]) {
      const [user] = await db.insert(usersTable).values({
        username: `prazni-${isArchived}-${SUFFIX}`, displayName: "Prazni učenik",
        passwordHash: "x", role: "ucenik", isActive: true,
      }).returning({ id: usersTable.id });
      ids.push(user.id);
      await db.insert(ucenikProfiliTable).values({ userId: user.id, muallimId, mektebId, grupaId, isArchived });
      if (isArchived) await db.insert(studentProgressTable).values({
        studentId: String(user.id), completedLessons: [lekcijaId],
      });
    }
    const response = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/statistika`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { detaljiUcenika: GroupStatisticsDetails[] };
    assert.deepEqual(result.detaljiUcenika.map(d => d.id).sort((a, b) => a - b), [ucenikId, ids[0]].sort((a, b) => a - b));
    assert.deepEqual(result.detaljiUcenika.find(d => d.id === ids[0]), {
      id: ids[0], lekcije: [], kvizovi: [], ocjene: [], etape: [], medaljoni: [],
    });
    const reportRes = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-statistika`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(reportRes.status, 200);
    const report = await reportRes.json() as { ucenici: Array<{ id: number }>; sections: ReportSection[] };
    assert.deepEqual(report.ucenici.map(u => u.id).sort((a, b) => a - b), [ucenikId, ids[0]].sort((a, b) => a - b));
    const archiveOnly = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-statistika?ucenici=${ids[1]}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.deepEqual(((await archiveOnly.json()) as { ucenici: unknown[] }).ucenici, []);
  } finally {
    if (ids.length) {
      await db.delete(studentProgressTable).where(inArray(studentProgressTable.studentId, ids.map(String)));
      await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, ids));
      await db.delete(usersTable).where(inArray(usersTable.id, ids));
    }
  }
});

test("štampa i stvarni XLSX imaju istih šest sekcija, sažetke i sve detalje", async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-statistika`, { headers });
  assert.equal(response.status, 200);
  const report = await response.json() as { naslov: string; period: string; sections: ReportSection[] };
  assert.deepEqual(report.sections.map(s => s.id), ["prisustvo", "lekcije", "vjezbe", "kvizovi", "ocjene", "etape"]);
  const section = (id: string) => report.sections.find(s => s.id === id)!;
  assert.equal(section("prisustvo").summary.find(m => m.label === "Prisustvo grupe")!.value, "50%");
  assert.deepEqual(section("kvizovi").tables[0].rows[0].slice(1), [2, 1, "70%", 14]);
  assert.deepEqual(section("ocjene").tables[0].rows[0].slice(1), [5, 1, 1]);
  assert.equal(section("ocjene").tables[2].rows.length, 1);
  assert.equal(section("ocjene").tables[3].rows[0][3], "Urađeno");
  assert.deepEqual(section("etape").tables[0].rows[0].slice(1), [1, 1, 1]);
  assert.equal(section("etape").tables[1].rows[0][4], 2);
  assert.equal(section("etape").tables[2].rows.length, 1);
  assert.ok(!JSON.stringify(report).includes("2020-09-01"));
  assert.deepEqual(section("vjezbe").tables[0].rows[0].slice(1), [1, 1, 2, "75%", 1, 1, "100%"]);

  const excel = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-excel`, { headers });
  assert.equal(excel.status, 200);
  assert.match(excel.headers.get("content-type")!, /spreadsheetml/);
  assert.match(excel.headers.get("content-disposition")!, /filename\*=UTF-8''/);
  const workbook = XLSX.read(Buffer.from(await excel.arrayBuffer()), { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Zbirni izvještaj", ...report.sections.map(s => s.title)]);
  for (const s of report.sections) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[s.title], { header: 1, blankrows: true, defval: null }) as Array<Array<string | number | null>>;
    const expected = [[report.period], [s.title], ...s.summary.map(m => [m.label, m.value]), [],
      ...s.tables.flatMap(t => [[t.title], t.headers, ...t.rows, []])];
    // XLSX omits trailing null cells and empty trailing rows.
    const normalize = (data: Array<Array<string | number | null>>) => data.map(row => {
      const r = row.map(v => sanitizeExcelCell(v));
      while (r.length && r[r.length - 1] == null) r.pop();
      return r;
    }).filter(row => row.length);
    assert.deepEqual(normalize(rows), normalize(expected), s.title);
  }
});

test("izbor učenika/sekcija i period ostaju isti u štampi i Excelu, učenje se ne resetuje", async () => {
  const headers = { Authorization: `Bearer ${token}` };
  const year = new Date().getUTCMonth() >= 7 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const query = `ucenici=${ucenikId}&od=${year}-08-01&do=${year}-08-01`;
  const response = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-statistika?${query}`, { headers });
  assert.equal(response.status, 200);
  const report = await response.json() as { sections: ReportSection[] };
  const sections = new Map(report.sections.map(s => [s.id, s]));
  assert.equal(sections.get("ocjene")!.tables[2].rows.length, 0);
  assert.equal(sections.get("prisustvo")!.tables[1].rows.length, 0);
  assert.equal(sections.get("kvizovi")!.tables[1].rows.length, 2);
  assert.equal(sections.get("lekcije")!.tables[1].rows.length, 1);
  assert.equal(sections.get("etape")!.tables[2].rows.length, 1);
  const selectedExcel = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-excel?${query}&sekcije=lekcije,etape`, { headers });
  assert.equal(selectedExcel.status, 200);
  const wb = XLSX.read(Buffer.from(await selectedExcel.arrayBuffer()), { type: "buffer" });
  assert.deepEqual(wb.SheetNames, ["Zbirni izvještaj", "Lekcije", "Etape i medaljoni"]);
  for (const filter of ["ucenici=", `ucenici=${straniMuallimId}`]) {
    const empty = await fetch(`${baseUrl}/api/muallim/grupa/${grupaId}/izvjestaj-statistika?${filter}`, { headers });
    assert.equal(empty.status, 200);
    assert.deepEqual(((await empty.json()) as { ucenici: unknown[] }).ucenici, []);
  }
});

test("oba izvještaja štite pristup i odbijaju neispravne filtere", async () => {
  for (const route of ["izvjestaj-statistika", "izvjestaj-excel"]) {
    const base = `${baseUrl}/api/muallim/grupa/${grupaId}/${route}`;
    assert.equal((await fetch(base, { headers: { Authorization: `Bearer ${straniToken}` } })).status, 403);
    assert.equal((await fetch(base)).status, 401);
    for (const filter of ["ucenici=abc", "sekcije=zvjezdice", "od=2026-02-30", "od=2026-10-01&do=2026-09-01"]) {
      assert.equal((await fetch(`${base}?${filter}`, { headers: { Authorization: `Bearer ${token}` } })).status, 400);
    }
  }
});

test("Excel štiti svaki tekstualni podatak od formula, a brojevi ostaju brojevi", () => {
  for (const value of ["=1+1", "+123", "-1+1", "@SUM(A1)", "\tformula", "\rformula"]) {
    assert.equal(sanitizeExcelCell(value), "'" + value);
  }
  assert.equal(sanitizeExcelCell("Normalan naziv"), "Normalan naziv");
  assert.equal(sanitizeExcelCell(50), 50);
  assert.equal(sanitizeExcelCell(null), null);
});

test("tuđi učenik nije dostupan", async () => {
  const odgovor = await fetch(`${baseUrl}/api/muallim/ucenik/${ucenikId}/statistika-vjezbi`, {
    headers: { Authorization: `Bearer ${straniToken}` },
  });
  assert.equal(odgovor.status, 403);
});
