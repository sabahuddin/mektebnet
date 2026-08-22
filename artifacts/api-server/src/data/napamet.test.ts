import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  mektebiTable,
  muallimProfiliTable,
  napametProgramTable,
  ocjeneTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";
import { NAPAMET_KATALOG, NAPAMET_KATALOG_MAP } from "./napamet.js";

test("NAPAMET katalog ima četiri sekcije i jedinstvene stabilne stavke", () => {
  assert.deepEqual(
    [...new Set(NAPAMET_KATALOG.map((stavka) => stavka.nivo))],
    [1, 2, 3, 4],
  );
  assert.equal(NAPAMET_KATALOG_MAP.size, NAPAMET_KATALOG.length);
  assert.ok(NAPAMET_KATALOG.every((stavka) => stavka.id && stavka.naziv && stavka.redoslijed > 0));
});

const SUFFIX = `napamet-${Date.now()}`;
const STAVKA_ID = "n1-fatiha";
let server: Server;
let baseUrl: string;
let mektebId: number;
let grupaId: number;
let muallimId: number;
let ucenikId: number;
let roditeljId: number;
let muallimToken: string;
let ucenikToken: string;
let roditeljToken: string;

async function createUser(role: "muallim" | "ucenik" | "roditelj", label: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "x",
    role,
    isActive: true,
  }).returning({ id: usersTable.id });
  return user.id;
}

function tokenFor(userId: number, role: "muallim" | "ucenik" | "roditelj", label: string) {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

function authed(path: string, token: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

before(async () => {
  // NAPAMET schema is part of the API startup residual bootstrap. Tests import
  // app directly, so create the same additive schema pieces explicitly.
  await db.execute(sql`ALTER TABLE ocjene ADD COLUMN IF NOT EXISTS napamet_nivo integer;`);
  await db.execute(sql`ALTER TABLE ocjene ADD COLUMN IF NOT EXISTS napamet_stavka_id varchar(80);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS napamet_program (
      id serial PRIMARY KEY, mekteb_id integer NOT NULL, stavka_id varchar(80) NOT NULL,
      nivo integer NOT NULL, naziv varchar(200) NOT NULL, redoslijed integer NOT NULL,
      is_visible boolean NOT NULL DEFAULT true, created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS napamet_program_mekteb_stavka_unique_idx ON napamet_program (mekteb_id, stavka_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS napamet_program_mekteb_order_idx ON napamet_program (mekteb_id, nivo, redoslijed);`);

  const [mekteb] = await db.insert(mektebiTable).values({
    naziv: `Test NAPAMET ${SUFFIX}`,
  }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;

  muallimId = await createUser("muallim", "muallim");
  ucenikId = await createUser("ucenik", "ucenik");
  roditeljId = await createUser("roditelj", "roditelj");

  await db.insert(muallimProfiliTable).values({
    userId: muallimId,
    mektebId,
    isGlavni: true,
  });
  const [grupa] = await db.insert(grupeTable).values({
    muallimId,
    naziv: `Grupa ${SUFFIX}`,
    skolskaGodina: "2025/2026",
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;
  await db.insert(ucenikProfiliTable).values({
    userId: ucenikId,
    muallimId,
    grupaId,
    mektebId,
  });
  await db.insert(roditeljProfiliTable).values({ userId: roditeljId });
  await db.insert(roditeljUcenikTable).values({
    roditeljId,
    ucenikId,
    status: "approved",
    approvedAt: new Date(),
    approvedBy: muallimId,
  });

  muallimToken = tokenFor(muallimId, "muallim", "muallim");
  ucenikToken = tokenFor(ucenikId, "ucenik", "ucenik");
  roditeljToken = tokenFor(roditeljId, "roditelj", "roditelj");

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
  if (ucenikId) await db.delete(ocjeneTable).where(eq(ocjeneTable.ucenikId, ucenikId));
  if (roditeljId && ucenikId) {
    await db.delete(roditeljUcenikTable).where(and(
      eq(roditeljUcenikTable.roditeljId, roditeljId),
      eq(roditeljUcenikTable.ucenikId, ucenikId),
    ));
  }
  if (mektebId) await db.delete(napametProgramTable).where(eq(napametProgramTable.mektebId, mektebId));
  if (ucenikId) await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
  if (roditeljId) await db.delete(roditeljProfiliTable).where(eq(roditeljProfiliTable.userId, roditeljId));
  if (muallimId) await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
  if (grupaId) await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  const userIds = [muallimId, ucenikId, roditeljId].filter(Boolean);
  if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
});

test("izmjena NAPAMET programa čuva ocjenu po stabilnom ID-u za učenika i roditelja", async () => {
  const gradeResponse = await authed("/api/muallim/ocjene", muallimToken, {
    method: "POST",
    body: JSON.stringify({
      ucenikId,
      grupaId,
      kategorija: "napamet",
      ocjena: 5,
      datum: "2026-08-22",
      napametStavkaId: STAVKA_ID,
    }),
  });
  assert.equal(gradeResponse.status, 201);
  const grade = await gradeResponse.json() as { id: number; napametStavkaId: string; ocjena: number };
  assert.equal(grade.napametStavkaId, STAVKA_ID);
  assert.equal(grade.ocjena, 5);

  const renameResponse = await authed(`/api/muallim/napamet-program/${STAVKA_ID}`, muallimToken, {
    method: "PUT",
    body: JSON.stringify({ naziv: "El-Fatiha (izmijenjeni naziv)" }),
  });
  assert.equal(renameResponse.status, 200);

  const reorderResponse = await authed("/api/muallim/napamet-program-reorder", muallimToken, {
    method: "PUT",
    body: JSON.stringify({
      stavke: [
        { id: STAVKA_ID, nivo: 1, redoslijed: 2 },
        { id: "n1-ihlās", nivo: 1, redoslijed: 1 },
      ],
    }),
  });
  assert.equal(reorderResponse.status, 200);

  for (const [role, token, path] of [
    ["učenik", ucenikToken, "/api/ucenik/napamet"],
    ["roditelj", roditeljToken, `/api/roditelj/napamet/${ucenikId}`],
  ] as const) {
    const response = await authed(path, token);
    assert.equal(response.status, 200, `${role} mora dobiti NAPAMET katalog`);
    const payload = await response.json() as {
      katalog: Array<{ id: string; naziv: string; redoslijed: number }>;
      ocjene: Array<{ napametStavkaId: string; ocjena: number; id: number }>;
    };
    const item = payload.katalog.find((stavka) => stavka.id === STAVKA_ID);
    assert.deepEqual(item, {
      id: STAVKA_ID,
      nivo: 1,
      naziv: "El-Fatiha (izmijenjeni naziv)",
      redoslijed: 2,
      isVisible: true,
    });
    assert.deepEqual(
      payload.ocjene.find((ocjena) => ocjena.napametStavkaId === STAVKA_ID),
      { ...grade, napametStavkaId: STAVKA_ID, ocjena: 5 },
    );
  }
});