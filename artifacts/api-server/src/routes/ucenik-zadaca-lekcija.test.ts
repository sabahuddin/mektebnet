import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  ilmihalLekcijeTable,
  korisnikNapredakTable,
  napametGlobalProgramTable,
  ocjeneTable,
  ucenikProfiliTable,
  usersTable,
  zadaceTable,
  zadacePriloziTable,
  prilozi,
} from "@workspace/db/schema";
import app from "../app.js";
import {
  bootstrapDrizzleMigrations,
  runDrizzleMigrate,
} from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `zadaca-lekcija-${Date.now()}`;
let server: Server | undefined;
let baseUrl: string;
let studentId: number;
let otherStudentId: number;
let teacherId: number;
let groupId: number;
let prerequisiteId: number;
let assignedLessonId: number;
let blockedLessonId: number;
let assignedSlug: string;
let blockedSlug: string;
let freeNivo3LessonId: number;
let freeNivo3Slug: string;
let napametLessonId: number;
let napametSlug: string;
let assignedHomeworkId: number;
let emptyHomeworkId: number;
let napametHomeworkId: number;
let studentToken: string;
let otherStudentToken: string;
let teacherToken: string;
let attachmentHomeworkId: number;
let filePrilogId: number;
let urlPrilogId: number;
let attachmentStoredName: string;

function teacherGet(path: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${teacherToken}` },
  });
}

function studentGet(path: string, headers: Record<string, string> = {}, token = studentToken) {
  return fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });
}

function teacherPut(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function teacherPost(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${teacherToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function cleanup(): Promise<void> {
  if (assignedHomeworkId || emptyHomeworkId || napametHomeworkId || attachmentHomeworkId) {
    await db.execute(sql`
      DELETE FROM zadace_status
       WHERE zadaca_id IN (${assignedHomeworkId || -1}, ${emptyHomeworkId || -1}, ${napametHomeworkId || -1}, ${attachmentHomeworkId || -1})
    `);
    await db.execute(sql`
      DELETE FROM zadace_ucenici
       WHERE zadaca_id IN (${assignedHomeworkId || -1}, ${emptyHomeworkId || -1}, ${napametHomeworkId || -1}, ${attachmentHomeworkId || -1})
    `);
    await db.delete(ocjeneTable).where(inArray(
      ocjeneTable.zadacaId,
      [assignedHomeworkId, emptyHomeworkId, napametHomeworkId, attachmentHomeworkId].filter(Boolean),
    ));
    await db.delete(zadaceTable).where(inArray(
      zadaceTable.id,
      [assignedHomeworkId, emptyHomeworkId, napametHomeworkId, attachmentHomeworkId].filter(Boolean),
    ));
  }
  if (filePrilogId || urlPrilogId) {
    await db.delete(zadacePriloziTable).where(inArray(
      zadacePriloziTable.prilogId,
      [filePrilogId, urlPrilogId].filter(Boolean),
    ));
    await db.delete(prilozi).where(inArray(prilozi.id, [filePrilogId, urlPrilogId].filter(Boolean)));
  }
  if (attachmentStoredName) {
    fs.rmSync(path.resolve(process.env["UPLOADS_DIR"] || path.join(process.cwd(), "uploads"), attachmentStoredName), { force: true });
  }
  if (studentId || otherStudentId) {
    await db.delete(korisnikNapredakTable).where(inArray(
      korisnikNapredakTable.userId,
      [studentId, otherStudentId].filter(Boolean),
    ));
    await db.delete(ocjeneTable).where(inArray(
      ocjeneTable.ucenikId,
      [studentId, otherStudentId].filter(Boolean),
    ));
  }
  if (napametSlug) {
    await db.delete(napametGlobalProgramTable)
      .where(eq(napametGlobalProgramTable.sourceLessonSlug, napametSlug));
  }
  if (assignedLessonId || blockedLessonId || prerequisiteId || freeNivo3LessonId || napametLessonId) {
    await db.execute(sql`
      DELETE FROM content_prijevodi
      WHERE tabela = 'ilmihal_lekcije'
        AND red_id IN (${assignedLessonId || -1}, ${blockedLessonId || -1}, ${prerequisiteId || -1}, ${freeNivo3LessonId || -1}, ${napametLessonId || -1})
    `);
    await db.delete(ilmihalLekcijeTable).where(inArray(
      ilmihalLekcijeTable.id,
      [assignedLessonId, blockedLessonId, prerequisiteId, freeNivo3LessonId, napametLessonId].filter(Boolean),
    ));
  }
  if (studentId) {
    await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, studentId));
    await db.delete(usersTable).where(eq(usersTable.id, studentId));
  }
  if (otherStudentId) {
    await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, otherStudentId));
    await db.delete(usersTable).where(eq(usersTable.id, otherStudentId));
  }
  if (groupId) await db.delete(grupeTable).where(eq(grupeTable.id, groupId));
  if (teacherId) await db.delete(usersTable).where(eq(usersTable.id, teacherId));
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS content_prijevodi (
      id serial PRIMARY KEY,
      tabela varchar(60) NOT NULL,
      red_id integer NOT NULL,
      polje varchar(60) NOT NULL,
      jezik varchar(5) NOT NULL,
      prijevod text NOT NULL,
      izvor_hash varchar(64) NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  // API route testovi importuju app direktno (bez index.ts startupa), zato
  // pripremi idempotentnu kolonu koju produkcijski residual-schema već dodaje.
  await db.execute(sql`
    ALTER TABLE zadace
    ADD COLUMN IF NOT EXISTS lekcija_slug varchar(300)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS zadace_prilozi (
      id serial PRIMARY KEY, zadaca_id integer NOT NULL, prilog_id integer NOT NULL,
      created_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS zadace_prilozi_zadaca_prilog_unique_idx ON zadace_prilozi (zadaca_id, prilog_id)`);
  // Očisti samo pomoćne redove iz ranije prekinutog pokretanja ovog istog
  // testa; produkcijski sadržaj nikada ne koristi ovaj rezervisani slug prefiks.
  await db.execute(sql`
    DELETE FROM content_prijevodi
    WHERE tabela = 'ilmihal_lekcije'
      AND red_id IN (
        SELECT id FROM ilmihal_lekcije
        WHERE slug LIKE 'test-%-zadaca-lekcija-%'
      )
  `);
  await db.execute(sql`
    DELETE FROM ilmihal_lekcije
    WHERE slug LIKE 'test-%-zadaca-lekcija-%'
  `);

  const [teacher] = await db.insert(usersTable).values({
    username: `muallim.${suffix}`,
    displayName: "Muallim testa",
    passwordHash: "x",
    role: "muallim",
    isActive: true,
  }).returning({ id: usersTable.id });
  teacherId = teacher.id;

  const [group] = await db.insert(grupeTable).values({
    muallimId: teacherId,
    naziv: `Grupa ${suffix}`,
    skolskaGodina: "2026/27",
    isActive: true,
  }).returning({ id: grupeTable.id });
  groupId = group.id;

  const [student] = await db.insert(usersTable).values({
    username: `ucenik.${suffix}`,
    displayName: "Učenik testa",
    passwordHash: "x",
    role: "ucenik",
    isActive: true,
  }).returning({ id: usersTable.id });
  studentId = student.id;
  await db.insert(ucenikProfiliTable).values({
    userId: studentId,
    muallimId: teacherId,
    grupaId: groupId,
  });
  const [otherStudent] = await db.insert(usersTable).values({
    username: `ucenik-drugi.${suffix}`,
    displayName: "Drugi učenik testa",
    passwordHash: "x",
    role: "ucenik",
    isActive: true,
  }).returning({ id: usersTable.id });
  otherStudentId = otherStudent.id;
  await db.insert(ucenikProfiliTable).values({
    userId: otherStudentId,
    muallimId: teacherId,
    grupaId: groupId,
  });

  const [prerequisite] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: `test-preduvjet-${suffix}`,
    naslov: `Preduvjet ${suffix}`,
    contentHtml: "<p>Preduvjet</p>",
    redoslijed: 1,
  }).returning({ id: ilmihalLekcijeTable.id });
  prerequisiteId = prerequisite.id;

  assignedSlug = `test-zadana-${suffix}`;
  blockedSlug = `test-zakljucana-${suffix}`;
  freeNivo3Slug = `test-slobodna-nivo3-${suffix}`;
  napametSlug = `sura-test-napamet-${suffix}`;
  const createdLessons = await db.insert(ilmihalLekcijeTable).values([
    {
      nivo: 1,
      slug: assignedSlug,
      naslov: `Zadata lekcija ${suffix}`,
      contentHtml: "<p>Bosanski uvodni sadržaj</p>",
      redoslijed: 2,
      uvjetiIds: [prerequisiteId],
    },
    {
      nivo: 1,
      slug: blockedSlug,
      naslov: `Zaključana lekcija ${suffix}`,
      contentHtml: "<p>Zaključano</p>",
      redoslijed: 3,
      uvjetiIds: [prerequisiteId],
    },
    {
      nivo: 3,
      slug: freeNivo3Slug,
      naslov: `Slobodna Nivo 3 lekcija ${suffix}`,
      contentHtml: "<p>Dostupno bez uvjeta</p>",
      redoslijed: 999,
      uvjetiIds: [],
    },
    {
      nivo: 1,
      slug: napametSlug,
      naslov: `NAPAMET lekcija ${suffix}`,
      contentHtml: "<p>Učenje napamet</p>",
      redoslijed: 4,
      isPublished: true,
    },
  ]).returning({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug });
  assignedLessonId = createdLessons.find((lesson) => lesson.slug === assignedSlug)!.id;
  blockedLessonId = createdLessons.find((lesson) => lesson.slug === blockedSlug)!.id;
  freeNivo3LessonId = createdLessons.find((lesson) => lesson.slug === freeNivo3Slug)!.id;
  napametLessonId = createdLessons.find((lesson) => lesson.slug === napametSlug)!.id;

  const homework = await db.insert(zadaceTable).values([
    {
      grupaId: groupId,
      muallimId: teacherId,
      naslov: "Vježba zadate lekcije",
      lekcijaNaslov: `Zadata lekcija ${suffix}`,
      lekcijaSlug: assignedSlug,
      lekcijaTip: "ilmihal",
      isActive: true,
    },
    {
      grupaId: groupId,
      muallimId: teacherId,
      naslov: "Zadaća bez povezane lekcije",
      lekcijaNaslov: null,
      isActive: true,
    },
    {
      grupaId: groupId,
      muallimId: teacherId,
      naslov: "NAPAMET zadaća",
      lekcijaNaslov: `NAPAMET lekcija ${suffix}`,
      // Simulira staru zadaću nastalu prije čuvanja slug-a. Veza sa Napamet
      // stavkom mora se moći pronaći po kanonskom naslovu.
      lekcijaSlug: null,
      lekcijaTip: "ilmihal",
      isActive: true,
    },
  ]).returning({ id: zadaceTable.id, lekcijaNaslov: zadaceTable.lekcijaNaslov });
  assignedHomeworkId = homework.find((item) => item.lekcijaNaslov)?.id!;
  emptyHomeworkId = homework.find((item) => !item.lekcijaNaslov)?.id!;
  napametHomeworkId = homework.find((item) => item.lekcijaNaslov === `NAPAMET lekcija ${suffix}`)?.id!;

  await db.execute(sql`
    INSERT INTO content_prijevodi (tabela, red_id, polje, jezik, prijevod, izvor_hash)
    VALUES
      ('ilmihal_lekcije', ${assignedLessonId}, 'naslov', 'en', 'Assigned lesson', 'test'),
      ('ilmihal_lekcije', ${assignedLessonId}, 'content_html', 'en', '<p>Translated introduction and content</p>', 'test')
  `);

  await db.insert(korisnikNapredakTable).values({
    userId: studentId,
    contentType: "ilmihal",
    contentId: assignedLessonId,
    zavrsen: true,
    completedAt: new Date("2026-08-28T10:15:00.000Z"),
  });

  studentToken = signToken({
    userId: studentId,
    username: `ucenik.${suffix}`,
    displayName: "Učenik testa",
    role: "ucenik",
  });
  otherStudentToken = signToken({
    userId: otherStudentId,
    username: `ucenik-drugi.${suffix}`,
    displayName: "Drugi učenik testa",
    role: "ucenik",
  });
  teacherToken = signToken({
    userId: teacherId,
    username: `muallim.${suffix}`,
    displayName: "Muallim testa",
    role: "muallim",
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server?.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  await cleanup();
});

test("aktivna zadaća otključava samo svoju lekciju i vraća njen slug učeniku", async () => {
  const [homeworkResponse, assignedResponse, blockedResponse] = await Promise.all([
    studentGet("/api/ucenik/zadace"),
    studentGet(`/api/content/ilmihal/${assignedSlug}`),
    studentGet(`/api/content/ilmihal/${blockedSlug}`),
  ]);

  assert.equal(homeworkResponse.status, 200);
  const homework = await homeworkResponse.json() as Array<{
    id: number;
    lekcijaSlug: string | null;
  }>;
  assert.equal(
    homework.find((item) => item.id === assignedHomeworkId)?.lekcijaSlug,
    assignedSlug,
  );
  assert.equal(
    homework.find((item) => item.id === emptyHomeworkId)?.lekcijaSlug,
    null,
  );

  assert.equal(assignedResponse.status, 200);
  const assigned = await assignedResponse.json() as { assignedThroughHomework?: boolean };
  assert.equal(assigned.assignedThroughHomework, true);

  assert.equal(blockedResponse.status, 403);
  const blocked = await blockedResponse.json() as { locked?: boolean };
  assert.equal(blocked.locked, true);
});

test("prijavljeni učenik može otvoriti slobodnu lekciju i mapu Nivoa 3", async () => {
  const [lessonResponse, mapResponse] = await Promise.all([
    studentGet(`/api/content/ilmihal/${freeNivo3Slug}`),
    studentGet("/api/mapa/nivo/3"),
  ]);

  assert.equal(lessonResponse.status, 200);
  assert.equal(mapResponse.status, 200);
});

test("završena zadaća se učeniku prebaci među završene i bez ocjene", async () => {
  const markResponse = await teacherPut(
    `/api/muallim/zadace/${assignedHomeworkId}/status/${studentId}`,
    { uradjeno: false, ocjena: null, kapiMeda: 0, noviRok: null, oznaciZavrseno: true },
  );
  assert.equal(markResponse.status, 200);
  const saved = await markResponse.json() as { status: string; uradjeno: boolean; ocjena: number | null };
  assert.equal(saved.status, "zavrseno");
  assert.equal(saved.uradjeno, true);
  assert.equal(saved.ocjena, null);

  const studentResponse = await studentGet("/api/ucenik/zadace");
  assert.equal(studentResponse.status, 200);
  const homework = await studentResponse.json() as Array<{ id: number; kategorija: string; ocjena: number | null }>;
  const assigned = homework.find((item) => item.id === assignedHomeworkId);
  assert.equal(assigned?.kategorija, "zavrsene");
  assert.equal(assigned?.ocjena, null);
});

test("pregled zadaće razlikuje završenu povezanu lekciju od ručnog pregleda", async () => {
  const listResponse = await teacherGet(`/api/muallim/zadace?grupaId=${groupId}`);
  assert.equal(listResponse.status, 200);
  const list = await listResponse.json() as Array<{
    id: number;
    lekcijaZavrsenih: number;
    lekcijaUkupno: number | null;
    zavrsenih: number;
    ukupno: number;
  }>;
  const assigned = list.find((item) => item.id === assignedHomeworkId);
  assert.equal(assigned?.lekcijaZavrsenih, 1);
  assert.equal(assigned?.lekcijaUkupno, 2);
  // Prethodni test je ručno završio ovu zadaću; automatski broj lekcija je
  // nezavisan od tog ručnog statusa i ostaje 1/2.
  assert.equal(assigned?.zavrsenih, 1);
  assert.equal(assigned?.ukupno, 2);

  const pregledResponse = await teacherGet(`/api/muallim/zadace/${assignedHomeworkId}/pregled`);
  assert.equal(pregledResponse.status, 200);
  const pregled = await pregledResponse.json() as {
    lekcija: { id: number; slug: string } | null;
    lekcijaZavrsenih: number;
    lekcijaUkupno: number | null;
    ucenici: Array<{
      ucenikId: number;
      status: string;
      lekcijaZavrsena: boolean;
      lekcijaZavrsenaAt: string | null;
    }>;
  };
  assert.equal(pregled.lekcija?.slug, assignedSlug);
  assert.equal(pregled.lekcijaZavrsenih, 1);
  assert.equal(pregled.lekcijaUkupno, 2);
  assert.equal(pregled.ucenici.find((u) => u.ucenikId === studentId)?.lekcijaZavrsena, true);
  assert.equal(pregled.ucenici.find((u) => u.ucenikId === studentId)?.status, "zavrseno");
  assert.equal(pregled.ucenici.find((u) => u.ucenikId === otherStudentId)?.lekcijaZavrsena, false);

  const emptyResponse = await teacherGet(`/api/muallim/zadace/${emptyHomeworkId}/pregled`);
  assert.equal(emptyResponse.status, 200);
  const empty = await emptyResponse.json() as {
    lekcija: unknown;
    lekcijaZavrsenih: number;
    lekcijaUkupno: number | null;
    ucenici: Array<{ lekcijaZavrsena: boolean }>;
  };
  assert.equal(empty.lekcija, null);
  assert.equal(empty.lekcijaZavrsenih, 0);
  assert.equal(empty.lekcijaUkupno, null);
  assert.equal(empty.ucenici.every((u) => !u.lekcijaZavrsena), true);
});

test("ocjena završava grupnu zadaću samo ocijenjenom učeniku", async () => {
  const gradeResponse = await teacherPut(
    `/api/muallim/zadace/${emptyHomeworkId}/status/${studentId}`,
    { uradjeno: false, ocjena: 5, kapiMeda: 0, noviRok: null },
  );
  assert.equal(gradeResponse.status, 200);
  const saved = await gradeResponse.json() as { status: string; uradjeno: boolean; ocjena: number | null };
  assert.equal(saved.status, "zavrseno");
  assert.equal(saved.uradjeno, true);
  assert.equal(saved.ocjena, 5);

  const [gradedResponse, ungradedResponse] = await Promise.all([
    studentGet("/api/ucenik/zadace"),
    studentGet("/api/ucenik/zadace", {}, otherStudentToken),
  ]);
  assert.equal(gradedResponse.status, 200);
  assert.equal(ungradedResponse.status, 200);

  const gradedHomework = await gradedResponse.json() as Array<{ id: number; kategorija: string; ocjena: number | null }>;
  const ungradedHomework = await ungradedResponse.json() as Array<{ id: number; kategorija: string; ocjena: number | null }>;
  const graded = gradedHomework.find((item) => item.id === emptyHomeworkId);
  const ungraded = ungradedHomework.find((item) => item.id === emptyHomeworkId);

  assert.equal(graded?.kategorija, "zavrsene");
  assert.equal(graded?.ocjena, 5);
  assert.equal(ungraded?.kategorija, "aktivne");
  assert.equal(ungraded?.ocjena, null);
});

test("arhivirana grupna zadaća je završena realizovanom, a neurađena ostalim učenicima", async () => {
  const archiveResponse = await teacherPut(`/api/muallim/zadace/${emptyHomeworkId}/arhiviraj`, {});
  assert.equal(archiveResponse.status, 200);
  const archived = await archiveResponse.json() as { isActive: boolean };
  assert.equal(archived.isActive, false);

  const [gradedResponse, ungradedResponse] = await Promise.all([
    studentGet("/api/ucenik/zadace"),
    studentGet("/api/ucenik/zadace", {}, otherStudentToken),
  ]);
  assert.equal(gradedResponse.status, 200);
  assert.equal(ungradedResponse.status, 200);

  const gradedHomework = await gradedResponse.json() as Array<{ id: number; kategorija: string }>;
  const ungradedHomework = await ungradedResponse.json() as Array<{ id: number; kategorija: string }>;
  assert.equal(gradedHomework.find(item => item.id === emptyHomeworkId)?.kategorija, "zavrsene");
  assert.equal(ungradedHomework.find(item => item.id === emptyHomeworkId)?.kategorija, "neuradjene");
});

test("NAPAMET pamti direktne ocjene i samo ocjene 5/6 iz zadaće", async () => {
  const directResponse = await teacherPost("/api/muallim/ocjene", {
    ucenikId: studentId,
    grupaId: groupId,
    kategorija: "ilmihal",
    ocjena: 5,
    lekcijaNaziv: `NAPAMET lekcija ${suffix}`,
    lekcijaSlug: napametSlug,
    datum: "2026-08-23",
  });
  assert.equal(directResponse.status, 201);

  const studentNapametResponse = await studentGet("/api/ucenik/napamet");
  assert.equal(studentNapametResponse.status, 200);
  const studentNapamet = await studentNapametResponse.json() as {
    katalog: Array<{ id: string; sourceLessonSlug?: string | null }>;
    ocjene: Array<{ napametStavkaId: string | null; ocjena: number }>;
  };
  const stavka = studentNapamet.katalog.find((item) => item.sourceLessonSlug === napametSlug);
  assert.ok(stavka, "NAPAMET katalog mora biti vidljiv i bez mekteb_id na profilu");
  const directNapametOcjena = studentNapamet.ocjene
    .find((ocjena) => ocjena.napametStavkaId === stavka.id);
  assert.equal(directNapametOcjena?.napametStavkaId, stavka.id);
  assert.equal(directNapametOcjena?.ocjena, 5);

  const sixResponse = await teacherPut(
    `/api/muallim/zadace/${napametHomeworkId}/status/${otherStudentId}`,
    { uradjeno: false, ocjena: 6, kapiMeda: 0, noviRok: null },
  );
  assert.equal(sixResponse.status, 200);

  const otherNapametResponse = await studentGet("/api/ucenik/napamet", {}, otherStudentToken);
  assert.equal(otherNapametResponse.status, 200);
  const otherNapamet = await otherNapametResponse.json() as {
    katalog: Array<{ id: string; sourceLessonSlug?: string | null }>;
    ocjene: Array<{ napametStavkaId: string | null; ocjena: number }>;
  };
  const otherStavka = otherNapamet.katalog.find((item) => item.sourceLessonSlug === napametSlug);
  assert.ok(otherStavka);
  assert.equal(
    otherNapamet.ocjene.find((ocjena) => ocjena.napametStavkaId === otherStavka.id)?.ocjena,
    6,
  );

  const fourResponse = await teacherPut(
    `/api/muallim/zadace/${napametHomeworkId}/status/${otherStudentId}`,
    { uradjeno: false, ocjena: 4, kapiMeda: 0, noviRok: null },
  );
  assert.equal(fourResponse.status, 200);
  const [homeworkGrade] = await db.select({
    napametStavkaId: ocjeneTable.napametStavkaId,
  }).from(ocjeneTable).where(and(
    eq(ocjeneTable.zadacaId, napametHomeworkId),
    eq(ocjeneTable.ucenikId, otherStudentId),
  ));
  assert.equal(homeworkGrade?.napametStavkaId, null);

  const afterFourResponse = await studentGet("/api/ucenik/napamet", {}, otherStudentToken);
  const afterFour = await afterFourResponse.json() as {
    katalog: Array<{ sourceLessonSlug?: string | null }>;
    ocjene: Array<{ napametStavkaId: string | null }>;
  };
  assert.ok(afterFour.katalog.some((item) => item.sourceLessonSlug === napametSlug));
  assert.equal(afterFour.ocjene.some((ocjena) => ocjena.napametStavkaId === otherStavka.id), false);
});

test("detail lekcije preklapa naslov i HTML istim prijevodnim overlayem", async () => {
  const response = await studentGet(`/api/content/ilmihal/${assignedSlug}`, { "X-Lang": "en" });
  assert.equal(response.status, 200);
  const lesson = await response.json() as { naslov: string; contentHtml: string };
  assert.equal(lesson.naslov, "Assigned lesson");
  assert.match(lesson.contentHtml, /Translated introduction and content/);
  assert.doesNotMatch(lesson.contentHtml, /Bosanski uvodni sadržaj/);
});

test("privatni file/url prilozi zadaće su scoped na adresata i ne cure kroz lekciju", async () => {
  attachmentStoredName = `test-zadaca-prilog-${suffix}.pdf`;
  const uploadsDir = process.env["UPLOADS_DIR"] || path.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, attachmentStoredName), "private homework bytes");
  const inserted = await db.insert(prilozi).values([
    {
      lekcijaId: assignedLessonId, originalName: "Privatni radni list.pdf",
      storedName: attachmentStoredName, fileSize: 22, mimeType: "application/pdf",
      kind: "file", approved: true, uploadedByRole: "muallim", uploadedByUserId: teacherId,
    },
    {
      lekcijaId: assignedLessonId, originalName: "Privatni video",
      storedName: "", fileSize: 0, mimeType: "text/uri-list", kind: "url",
      externalUrl: "https://example.test/private-video", approved: true,
      uploadedByRole: "muallim", uploadedByUserId: teacherId,
    },
  ]).returning({ id: prilozi.id, kind: prilozi.kind });
  filePrilogId = inserted.find(p => p.kind === "file")!.id;
  urlPrilogId = inserted.find(p => p.kind === "url")!.id;

  const create = await teacherPost("/api/muallim/zadace", {
    grupaId: groupId, naslov: "Zadaća s privatnim materijalima",
    lekcijaNaslov: `Zadata lekcija ${suffix}`, lekcijaSlug: assignedSlug,
    ucenikIds: [studentId], priloziIds: [filePrilogId, urlPrilogId],
  });
  assert.equal(create.status, 201);
  const created = await create.json() as { id: number; prilozi: Array<{ id: number; storedName?: unknown }> };
  attachmentHomeworkId = created.id;
  assert.deepEqual(created.prilozi.map(p => p.id).sort(), [filePrilogId, urlPrilogId].sort());
  assert.equal(created.prilozi.every(p => !("storedName" in p)), true);
  const targetedArchive = await teacherPut(`/api/muallim/zadace/${attachmentHomeworkId}/arhiviraj`, {});
  assert.equal(targetedArchive.status, 400);

  const [content, targetList, download, outsiderDownload] = await Promise.all([
    studentGet(`/api/content/ilmihal/${assignedSlug}`),
    studentGet("/api/ucenik/zadace"),
    studentGet(`/api/ucenik/zadace/${attachmentHomeworkId}/prilozi/${filePrilogId}/download`),
    studentGet(`/api/ucenik/zadace/${attachmentHomeworkId}/prilozi/${filePrilogId}/download`, {}, otherStudentToken),
  ]);
  assert.equal(content.status, 200);
  const lesson = await content.json() as { prilozi?: Array<{ id: number }> };
  assert.equal(lesson.prilozi?.some(p => p.id === filePrilogId || p.id === urlPrilogId), false);
  assert.equal(targetList.status, 200);
  const homework = await targetList.json() as Array<{ id: number; prilozi: Array<{ id: number; externalUrl: string | null; storedName?: unknown }> }>;
  const assigned = homework.find(h => h.id === attachmentHomeworkId)!;
  assert.deepEqual(assigned.prilozi.map(p => p.id).sort(), [filePrilogId, urlPrilogId].sort());
  assert.equal(assigned.prilozi.every(p => !("storedName" in p)), true);
  assert.equal(assigned.prilozi.find(p => p.id === urlPrilogId)?.externalUrl, "https://example.test/private-video");
  assert.equal(download.status, 200);
  assert.equal(await download.text(), "private homework bytes");
  assert.equal(outsiderDownload.status, 403);
});