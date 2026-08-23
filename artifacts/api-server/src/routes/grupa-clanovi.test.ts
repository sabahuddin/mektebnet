import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  mektebiTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `group-members-${Date.now()}`;

let server: Server;
let baseUrl: string;
let mektebId: number;
let drugiMektebId: number;
let glavniId: number;
let muallimId: number;
let drugiMuallimId: number;
let straniGlavniId: number;
let grupaId: number;
let drugaGrupaId: number;
let noviUcenikId: number;
let drugiUcenikId: number;
let arhiviraniUcenikId: number;
let glavniToken: string;
let drugiMuallimToken: string;
let straniGlavniToken: string;

async function createUser(role: "muallim" | "ucenik", label: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "x",
    role,
    isActive: true,
  }).returning({ id: usersTable.id });
  return user.id;
}

function authed(path: string, token: string) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

before(async () => {
  const [mekteb] = await db.insert(mektebiTable)
    .values({ naziv: `Mekteb ${SUFFIX}` })
    .returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  const [drugiMekteb] = await db.insert(mektebiTable)
    .values({ naziv: `Drugi mekteb ${SUFFIX}` })
    .returning({ id: mektebiTable.id });
  drugiMektebId = drugiMekteb.id;

  glavniId = await createUser("muallim", "glavni");
  muallimId = await createUser("muallim", "muallim");
  drugiMuallimId = await createUser("muallim", "drugi-muallim");
  straniGlavniId = await createUser("muallim", "strani-glavni");
  await db.insert(muallimProfiliTable).values([
    { userId: glavniId, mektebId, isGlavni: true },
    { userId: muallimId, mektebId, isGlavni: false },
    { userId: drugiMuallimId, mektebId, isGlavni: false },
    { userId: straniGlavniId, mektebId: drugiMektebId, isGlavni: true },
  ]);

  const [grupa] = await db.insert(grupeTable).values({
    muallimId,
    naziv: `Grupa ${SUFFIX}`,
    skolskaGodina: "2026/27",
    isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;
  const [drugaGrupa] = await db.insert(grupeTable).values({
    muallimId,
    naziv: `Druga grupa ${SUFFIX}`,
    skolskaGodina: "2026/27",
    isActive: true,
  }).returning({ id: grupeTable.id });
  drugaGrupaId = drugaGrupa.id;

  noviUcenikId = await createUser("ucenik", "novi-ucenik");
  drugiUcenikId = await createUser("ucenik", "drugi-ucenik");
  arhiviraniUcenikId = await createUser("ucenik", "arhivirani-ucenik");
  await db.insert(ucenikProfiliTable).values([
    { userId: noviUcenikId, muallimId, grupaId, mektebId },
    { userId: drugiUcenikId, muallimId, grupaId: drugaGrupaId, mektebId },
    { userId: arhiviraniUcenikId, muallimId, grupaId, mektebId, isArchived: true },
  ]);

  glavniToken = signToken({
    userId: glavniId, username: `glavni.${SUFFIX}`, role: "muallim", displayName: "Glavni",
  });
  drugiMuallimToken = signToken({
    userId: drugiMuallimId, username: `drugi-muallim.${SUFFIX}`, role: "muallim", displayName: "Drugi muallim",
  });
  straniGlavniToken = signToken({
    userId: straniGlavniId, username: `strani-glavni.${SUFFIX}`, role: "muallim", displayName: "Strani glavni",
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
  const userIds = [glavniId, muallimId, drugiMuallimId, straniGlavniId, noviUcenikId, drugiUcenikId, arhiviraniUcenikId]
    .filter(Boolean);
  if (userIds.length) {
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    await db.delete(grupeTable).where(inArray(grupeTable.id, [grupaId, drugaGrupaId].filter(Boolean)));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  if (drugiMektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, drugiMektebId));
});

test("glavni muallim vidi svakog aktivnog člana grupe drugog muallima", async () => {
  const response = await authed(`/api/muallim/grupa/${grupaId}/ucenici`, glavniToken);
  assert.equal(response.status, 200);
  const members = await response.json() as Array<{ id: number; grupaId: number; muallimId: number }>;

  assert.deepEqual(members.map((member) => member.id), [noviUcenikId]);
  assert.equal(members[0].grupaId, grupaId);
  assert.equal(members[0].muallimId, muallimId);
});

test("glavni muallim iz drugog mekteba nema pristup članovima grupe", async () => {
  const response = await authed(`/api/muallim/grupa/${grupaId}/ucenici`, straniGlavniToken);
  assert.equal(response.status, 404);
});

test("obični muallim iz istog mekteba ne može otvoriti tuđu grupu", async () => {
  const response = await authed(`/api/muallim/grupa/${grupaId}/ucenici`, drugiMuallimToken);
  assert.equal(response.status, 404);
});

test("sažetak zvjezdica prati isti pristup grupi", async () => {
  const allowed = await authed(`/api/muallim/grupa/${grupaId}/zvjezdice-summary`, glavniToken);
  assert.equal(allowed.status, 200);
  const totals = await allowed.json() as Array<{ ucenik_id: number; pozitivne: number; negativne: number }>;
  assert.deepEqual(totals, [{ ucenik_id: noviUcenikId, pozitivne: 0, negativne: 0 }]);

  const foreignHead = await authed(`/api/muallim/grupa/${grupaId}/zvjezdice-summary`, straniGlavniToken);
  assert.equal(foreignHead.status, 404);

  const unrelatedTeacher = await authed(`/api/muallim/grupa/${grupaId}/zvjezdice-summary`, drugiMuallimToken);
  assert.equal(unrelatedTeacher.status, 404);
});