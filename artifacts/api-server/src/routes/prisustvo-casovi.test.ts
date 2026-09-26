import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  mektebiTable,
  muallimProfiliTable,
  priustvoTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `prisustvo-casovi-${Date.now()}`;
const YEAR_START = new Date().getUTCMonth() >= 7
  ? new Date().getUTCFullYear()
  : new Date().getUTCFullYear() - 1;
const DATUM1 = `${YEAR_START}-08-10`;
const DATUM2 = `${YEAR_START}-08-11`;
const DATUM_LEGACY = `${YEAR_START}-08-12`;

let server: Server;
let baseUrl: string;
let mektebId: number;
let muallimId: number;
let drugiMuallimId: number;
let grupaId: number;
let drugaGrupaId: number;
let ucenikId: number;
let token: string;
let drugiToken: string;

interface PrisustvoOdgovor {
  ucenikId: number;
  datum: string;
  cas: number;
  status: string;
}

function poziv(path: string, init: RequestInit, authToken: string) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });
}

before(async () => {
  const [mekteb] = await db.insert(mektebiTable)
    .values({ naziv: `Mekteb ${SUFFIX}` })
    .returning({ id: mektebiTable.id });
  mektebId = mekteb.id;

  const [muallim] = await db.insert(usersTable).values({
    username: `muallim.${SUFFIX}`,
    displayName: `Muallim ${SUFFIX}`,
    passwordHash: "x",
    role: "muallim",
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  muallimId = muallim.id;

  const [drugiMuallim] = await db.insert(usersTable).values({
    username: `drugi.${SUFFIX}`,
    displayName: `Drugi ${SUFFIX}`,
    passwordHash: "x",
    role: "muallim",
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  drugiMuallimId = drugiMuallim.id;

  await db.insert(muallimProfiliTable).values([
    { userId: muallimId, mektebId, isGlavni: false },
    { userId: drugiMuallimId, mektebId, isGlavni: false },
  ]);

  const [grupa] = await db.insert(grupeTable).values({
    muallimId,
    naziv: `Grupa ${SUFFIX}`,
    skolskaGodina: `${YEAR_START}/${String(YEAR_START + 1).slice(-2)}`,
    isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;

  const [drugaGrupa] = await db.insert(grupeTable).values({
    muallimId: drugiMuallimId,
    naziv: `Druga grupa ${SUFFIX}`,
    skolskaGodina: `${YEAR_START}/${String(YEAR_START + 1).slice(-2)}`,
    isActive: true,
  }).returning({ id: grupeTable.id });
  drugaGrupaId = drugaGrupa.id;

  const [ucenik] = await db.insert(usersTable).values({
    username: `ucenik.${SUFFIX}`,
    displayName: `Ucenik ${SUFFIX}`,
    passwordHash: "x",
    role: "ucenik",
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  ucenikId = ucenik.id;
  await db.insert(ucenikProfiliTable).values({ userId: ucenikId, muallimId, grupaId });

  token = signToken({
    userId: muallimId, username: `muallim.${SUFFIX}`, role: "muallim", displayName: "Muallim",
  });
  drugiToken = signToken({
    userId: drugiMuallimId, username: `drugi.${SUFFIX}`, role: "muallim", displayName: "Drugi",
  });

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

  const groupIds = [grupaId, drugaGrupaId].filter(Boolean);
  const userIds = [ucenikId, muallimId, drugiMuallimId].filter(Boolean);
  if (groupIds.length) {
    await db.delete(priustvoTable).where(inArray(priustvoTable.grupaId, groupIds));
    await db.delete(grupeTable).where(inArray(grupeTable.id, groupIds));
  }
  if (ucenikId) {
    await db.delete(priustvoTable).where(eq(priustvoTable.ucenikId, ucenikId));
    await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
  }
  const muallimIds = [muallimId, drugiMuallimId].filter(Boolean);
  if (muallimIds.length) {
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, muallimIds));
  }
  if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
});

test("prisustvo podržava oba časa, nezavisne izmjene i stariji dnevni unos", async () => {
  const prviDan = await poziv("/api/muallim/prisustvo", {
    method: "POST",
    body: JSON.stringify({
      grupaId,
      datum: DATUM1,
      prisustvo: [
        { ucenikId, cas: 1, status: "prisutan" },
        { ucenikId, cas: 2, status: "odsutan" },
      ],
    }),
  }, token);
  assert.equal(prviDan.status, 200);

  const prviDanGet = await poziv(
    `/api/muallim/prisustvo?grupaId=${grupaId}&datum=${DATUM1}`,
    { method: "GET" },
    token,
  );
  assert.equal(prviDanGet.status, 200);
  const pocetniZapisi = await prviDanGet.json() as PrisustvoOdgovor[];
  assert.deepEqual(
    pocetniZapisi.map(({ cas, status }) => [cas, status]).sort((a, b) => Number(a[0]) - Number(b[0])),
    [[1, "prisutan"], [2, "odsutan"]],
  );

  const drugiDan = await poziv("/api/muallim/prisustvo", {
    method: "POST",
    body: JSON.stringify({
      grupaId,
      datum: DATUM2,
      prisustvo: [
        { ucenikId, cas: 1, status: "odsutan" },
        { ucenikId, cas: 2, status: "prisutan" },
      ],
    }),
  }, token);
  assert.equal(drugiDan.status, 200);

  const izmjena = await poziv("/api/muallim/prisustvo", {
    method: "POST",
    body: JSON.stringify({
      grupaId,
      datum: DATUM1,
      prisustvo: [{ ucenikId, cas: 1, status: "zakasnio" }],
    }),
  }, token);
  assert.equal(izmjena.status, 200);

  const legacy = await poziv("/api/muallim/prisustvo", {
    method: "POST",
    body: JSON.stringify({
      grupaId,
      datum: DATUM_LEGACY,
      prisustvo: [{ ucenikId, status: "opravdan" }],
    }),
  }, token);
  assert.equal(legacy.status, 200);

  const getDan = async (datum: string) => {
    const response = await poziv(
      `/api/muallim/prisustvo?grupaId=${grupaId}&datum=${datum}`,
      { method: "GET" },
      token,
    );
    assert.equal(response.status, 200);
    return await response.json() as PrisustvoOdgovor[];
  };

  const zapisiPrvogDana = await getDan(DATUM1);
  assert.deepEqual(
    zapisiPrvogDana.map(({ cas, status }) => [cas, status]).sort((a, b) => Number(a[0]) - Number(b[0])),
    [[1, "zakasnio"], [2, "odsutan"]],
    "izmjena 1. časa ne smije prepisati 2. čas",
  );
  const zapisiDrugogDana = await getDan(DATUM2);
  assert.deepEqual(
    zapisiDrugogDana.map(({ cas, status }) => [cas, status]).sort((a, b) => Number(a[0]) - Number(b[0])),
    [[1, "odsutan"], [2, "prisutan"]],
  );
  const legacyZapisi = await getDan(DATUM_LEGACY);
  assert.deepEqual(legacyZapisi.map(({ cas, status }) => [cas, status]), [[1, "opravdan"]]);

  const statistikaResponse = await poziv(
    `/api/muallim/grupa/${grupaId}/statistika`,
    { method: "GET" },
    token,
  );
  assert.equal(statistikaResponse.status, 200);
  const statistika = await statistikaResponse.json() as {
    ukupnoCasova: number;
    prisustvoPoDatumu: Array<{
      datum: string;
      cas: number;
      ukupno: number;
      perStudent: Record<number, string>;
    }>;
    ucenici: Array<{ id: number; prisustvoPoDatumu: Record<string, string> }>;
  };
  const entries = statistika.prisustvoPoDatumu.filter(entry =>
    entry.datum === DATUM1 || entry.datum === DATUM2,
  );
  assert.equal(statistika.ukupnoCasova, 5);
  assert.deepEqual(
    entries.map(({ datum, cas, ukupno, perStudent }) => [datum, cas, ukupno, perStudent[ucenikId]])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1])),
    [
      [DATUM1, 1, 1, "zakasnio"],
      [DATUM1, 2, 1, "odsutan"],
      [DATUM2, 1, 1, "odsutan"],
      [DATUM2, 2, 1, "prisutan"],
    ],
  );
  const studentStats = statistika.ucenici.find(student => student.id === ucenikId);
  assert.ok(studentStats);
  assert.equal(studentStats.prisustvoPoDatumu[`${DATUM1}#1`], "zakasnio");
  assert.equal(studentStats.prisustvoPoDatumu[`${DATUM1}#2`], "odsutan");
  assert.equal(studentStats.prisustvoPoDatumu[`${DATUM2}#1`], "odsutan");
  assert.equal(studentStats.prisustvoPoDatumu[`${DATUM2}#2`], "prisutan");
});

test("prisustvo odbija drugog muallima i broj časa van raspona", async () => {
  const tudjaGrupa = await poziv("/api/muallim/prisustvo", {
    method: "POST",
    body: JSON.stringify({
      grupaId,
      datum: DATUM1,
      prisustvo: [{ ucenikId, cas: 1, status: "prisutan" }],
    }),
  }, drugiToken);
  assert.equal(tudjaGrupa.status, 403);

  const neispravanCas = await poziv("/api/muallim/prisustvo", {
    method: "POST",
    body: JSON.stringify({
      grupaId,
      datum: DATUM1,
      prisustvo: [{ ucenikId, cas: 3, status: "prisutan" }],
    }),
  }, token);
  assert.equal(neispravanCas.status, 400);
});