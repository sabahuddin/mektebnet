/**
 * Regresioni test za privatni pedagoški pregled interaktivnih pitanja.
 *
 * Pokriva više pokušaja istog učenika na istom pitanju, razdvajanje učenika
 * i pitanja u grupnom pregledu, kao i provjeru pristupa muallima.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  ucenikProfiliTable,
  grupeTable,
  ilmihalLekcijeTable,
  interaktivniBlokPokusajiTable,
} from "@workspace/db/schema";
import app from "../app.js";
import {
  bootstrapDrizzleMigrations,
  runDrizzleMigrate,
} from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `t${Date.now()}`;
const BLOK_ID = "provjeri-znanje";

let server: Server;
let baseUrl: string;
let grupaId: number;
let lekcijaId: number;
let muallimId: number;
let drugiMuallimId: number;
let ucenikId: number;
let drugiUcenikId: number;
let muallimToken: string;
let drugiMuallimToken: string;
let ucenikToken: string;

async function createUser(role: "muallim" | "ucenik", label: string): Promise<number> {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "x",
    role,
    isActive: true,
  }).returning({ id: usersTable.id });
  return user.id;
}

function tokenFor(userId: number, role: "muallim" | "ucenik", label: string) {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

before(async () => {
  // Route testovi importuju `app` bez pokretanja izvršnog server entry pointa,
  // pa test baza mora proći isti verzionisani migration put kao aplikacija.
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();

  muallimId = await createUser("muallim", "muallim");
  drugiMuallimId = await createUser("muallim", "drugi-muallim");
  ucenikId = await createUser("ucenik", "ucenik");
  drugiUcenikId = await createUser("ucenik", "drugi-ucenik");

  const [grupa] = await db.insert(grupeTable).values({
    muallimId,
    naziv: `Grupa ${SUFFIX}`,
    skolskaGodina: "2025/26",
    isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;

  await db.insert(ucenikProfiliTable).values([
    { userId: ucenikId, muallimId, grupaId },
    { userId: drugiUcenikId, muallimId, grupaId },
  ]);

  const [lekcija] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: `test-interaktivni-pregled-${SUFFIX}`,
    naslov: `Interaktivni pregled ${SUFFIX}`,
    contentHtml: "",
    kvizPitanja: [
      {
        question: "Koji je prvi odgovor?",
        options: ["Tačan odgovor", "Pogrešan odgovor"],
        answer: "Tačan odgovor",
      },
      {
        question: "Koji je drugi odgovor?",
        options: ["Drugi tačan odgovor", "Drugi pogrešan odgovor"],
        answer: "Drugi tačan odgovor",
      },
    ],
  }).returning({ id: ilmihalLekcijeTable.id });
  lekcijaId = lekcija.id;

  muallimToken = tokenFor(muallimId, "muallim", "muallim");
  drugiMuallimToken = tokenFor(drugiMuallimId, "muallim", "drugi-muallim");
  ucenikToken = tokenFor(ucenikId, "ucenik", "ucenik");

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));

  const userIds = [ucenikId, drugiUcenikId].filter(Boolean);
  if (userIds.length > 0) {
    await db.delete(interaktivniBlokPokusajiTable)
      .where(inArray(interaktivniBlokPokusajiTable.userId, userIds));
    await db.delete(ucenikProfiliTable)
      .where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (lekcijaId) {
    await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
  }
  if (grupaId) {
    await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
  }
  const muallimIds = [muallimId, drugiMuallimId].filter(Boolean);
  if (muallimIds.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, muallimIds));
  }
});

function postAttempt(body: {
  pitanjeIndex: number;
  odabraniOdgovor: string;
  vrijemeSekundi: number;
  pomocKoristena?: boolean;
  ponovoProcitao?: boolean;
}) {
  return fetch(`${baseUrl}/api/content/ilmihal-blok-pokusaj`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ucenikToken}`,
    },
    body: JSON.stringify({
      lekcijaId,
      blokId: BLOK_ID,
      ...body,
    }),
  });
}

function muallimGet(token: string, path: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test("pedagoški pregled razdvaja učenike, pitanja i pokušaje", async () => {
  const attempts = [
    {
      pitanjeIndex: 0,
      odabraniOdgovor: "Pogrešan odgovor",
      vrijemeSekundi: 10,
      pomocKoristena: true,
      ponovoProcitao: false,
    },
    {
      pitanjeIndex: 0,
      odabraniOdgovor: "Tačan odgovor",
      vrijemeSekundi: 20,
      pomocKoristena: false,
      ponovoProcitao: true,
    },
    {
      pitanjeIndex: 0,
      odabraniOdgovor: "Tačan odgovor",
      vrijemeSekundi: 30,
      pomocKoristena: true,
      ponovoProcitao: true,
    },
  ];

  for (const attempt of attempts) {
    const response = await postAttempt(attempt);
    assert.equal(response.status, 201);
  }

  // Drugi učenik ima jedan pokušaj na drugom pitanju. Ovo sprečava da
  // grupni pregled slučajno sabere sve redove pod prvim učenikom/pitanjem.
  const drugiUcenikToken = tokenFor(drugiUcenikId, "ucenik", "drugi-ucenik");
  const drugiUcenikResponse = await fetch(`${baseUrl}/api/content/ilmihal-blok-pokusaj`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${drugiUcenikToken}`,
    },
    body: JSON.stringify({
      lekcijaId,
      blokId: BLOK_ID,
      pitanjeIndex: 1,
      odabraniOdgovor: "Drugi tačan odgovor",
      vrijemeSekundi: 40,
    }),
  });
  assert.equal(drugiUcenikResponse.status, 201);

  const storedAttempts = await db.select({
    attemptNo: interaktivniBlokPokusajiTable.attemptNo,
    tacno: interaktivniBlokPokusajiTable.tacno,
  }).from(interaktivniBlokPokusajiTable).where(and(
    eq(interaktivniBlokPokusajiTable.userId, ucenikId),
    eq(interaktivniBlokPokusajiTable.lekcijaId, lekcijaId),
    eq(interaktivniBlokPokusajiTable.pitanjeIndex, 0),
  )).orderBy(asc(interaktivniBlokPokusajiTable.attemptNo));
  assert.deepEqual(storedAttempts, [
    { attemptNo: 1, tacno: false },
    { attemptNo: 2, tacno: true },
    { attemptNo: 3, tacno: true },
  ]);

  const groupResponse = await muallimGet(
    muallimToken,
    `/api/muallim/grupa/${grupaId}/interaktivni-blokovi`,
  );
  assert.equal(groupResponse.status, 200);
  const group = await groupResponse.json() as {
    ukupnoUcenika: number;
    ukupnoPokusaja: number;
    prosjekTacnosti: number;
    pitanja: Array<{
      pitanjeIndex: number;
      brojPokusaja: number;
      netacniPokusaji: number;
      procenatTacnih: number;
      pomocBroj: number;
      tacnoNakonPonovnogCitanja: number;
      prosjekVrijemeSekundi: number;
    }>;
    ucenici: Array<{
      id: number;
      brojPokusaja: number;
      procenatTacnih: number;
      pomocBroj: number;
      tacnoNakonPonovnogCitanja: number;
    }>;
  };

  assert.equal(group.ukupnoUcenika, 2);
  assert.equal(group.ukupnoPokusaja, 4);
  assert.equal(group.prosjekTacnosti, 75);

  const firstQuestion = group.pitanja.find((question) => question.pitanjeIndex === 0);
  assert.ok(firstQuestion);
  assert.equal(firstQuestion.brojPokusaja, 3);
  assert.equal(firstQuestion.netacniPokusaji, 1);
  assert.equal(firstQuestion.procenatTacnih, 67);
  assert.equal(firstQuestion.pomocBroj, 2);
  assert.equal(firstQuestion.tacnoNakonPonovnogCitanja, 2);
  assert.equal(firstQuestion.prosjekVrijemeSekundi, 20);

  const secondQuestion = group.pitanja.find((question) => question.pitanjeIndex === 1);
  assert.ok(secondQuestion);
  assert.equal(secondQuestion.brojPokusaja, 1);
  assert.equal(secondQuestion.netacniPokusaji, 0);
  assert.equal(secondQuestion.procenatTacnih, 100);
  assert.equal(secondQuestion.pomocBroj, 0);
  assert.equal(secondQuestion.tacnoNakonPonovnogCitanja, 0);
  assert.equal(secondQuestion.prosjekVrijemeSekundi, 40);

  const studentSummary = group.ucenici.find((student) => student.id === ucenikId);
  assert.ok(studentSummary);
  assert.equal(studentSummary.brojPokusaja, 3);
  assert.equal(studentSummary.procenatTacnih, 67);
  assert.equal(studentSummary.pomocBroj, 2);
  assert.equal(studentSummary.tacnoNakonPonovnogCitanja, 2);

  const studentResponse = await muallimGet(
    muallimToken,
    `/api/muallim/ucenik/${ucenikId}/interaktivni-blokovi`,
  );
  assert.equal(studentResponse.status, 200);
  const student = await studentResponse.json() as {
    ukupnoPokusaja: number;
    pitanja: Array<{
      pitanjeIndex: number;
      brojPokusaja: number;
      netacniPokusaji: number;
      procenatTacnih: number;
      pomocBroj: number;
      tacnoNakonPonovnogCitanja: number;
      prosjekVrijemeSekundi: number;
    }>;
  };
  assert.equal(student.ukupnoPokusaja, 3);
  assert.deepEqual(student.pitanja, [firstQuestion]);
});

test("pedagoški pregled nije dostupan muallimu iz druge grupe", async () => {
  const groupResponse = await muallimGet(
    drugiMuallimToken,
    `/api/muallim/grupa/${grupaId}/interaktivni-blokovi`,
  );
  assert.equal(groupResponse.status, 403);

  const studentResponse = await muallimGet(
    drugiMuallimToken,
    `/api/muallim/ucenik/${ucenikId}/interaktivni-blokovi`,
  );
  assert.equal(studentResponse.status, 403);
});