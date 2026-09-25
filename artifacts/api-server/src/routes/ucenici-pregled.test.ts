import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable, muallimProfiliTable, ucenikProfiliTable, roditeljProfiliTable,
  roditeljUcenikTable, grupeTable, mektebiTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `pregled-${Date.now()}`;
const userIds: number[] = [];
let mektebId: number;
let grupaId: number;
let glavniId: number;
let muallimId: number;
let grupisaniId: number;
let bezGrupeId: number;
let arhiviraniId: number;
let roditeljId: number;
let server: Server;
let baseUrl: string;
let token: string;

async function makeUser(role: "muallim" | "ucenik" | "roditelj", label: string) {
  const [row] = await db.insert(usersTable).values({
    username: `${label}.${suffix}`,
    displayName: `${label} ${suffix}`,
    passwordHash: "x",
    role,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  userIds.push(row.id);
  return row.id;
}

before(async () => {
  glavniId = await makeUser("muallim", "glavni");
  muallimId = await makeUser("muallim", "muallim");
  grupisaniId = await makeUser("ucenik", "grupisani");
  bezGrupeId = await makeUser("ucenik", "bez-grupe");
  arhiviraniId = await makeUser("ucenik", "arhivirani");
  roditeljId = await makeUser("roditelj", "roditelj");

  const [mekteb] = await db.insert(mektebiTable).values({
    naziv: `Pregled ${suffix}`,
    glavniMuallimId: glavniId,
  }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  await db.insert(muallimProfiliTable).values([
    { userId: glavniId, mektebId, isGlavni: true },
    { userId: muallimId, mektebId },
  ]);
  const [grupa] = await db.insert(grupeTable).values({
    muallimId, naziv: `Grupa ${suffix}`, skolskaGodina: "2026/27",
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;
  await db.insert(ucenikProfiliTable).values([
    { userId: grupisaniId, muallimId, mektebId, grupaId },
    { userId: bezGrupeId, muallimId, mektebId },
    { userId: arhiviraniId, muallimId, mektebId, isArchived: true },
  ]);
  await db.insert(roditeljProfiliTable).values({ userId: roditeljId });
  await db.insert(roditeljUcenikTable).values({
    roditeljId, ucenikId: arhiviraniId, status: "approved",
    approvedAt: new Date(), approvedBy: muallimId,
  });
  token = signToken({
    userId: glavniId, username: `glavni.${suffix}`,
    role: "muallim", displayName: `glavni ${suffix}`,
  });
  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (userIds.length) {
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, userIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, userIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
  }
  if (grupaId) await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
});

test("Svi učenici prikazuje grupisane, bez grupe, arhivirane i roditelja za poruku", async () => {
  async function get(path: string) {
    const res = await fetch(`${baseUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) assert.fail(`${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
  const aktivni = await get("/muallim/ucenici") as Array<{ id: number }>;
  assert.ok(aktivni.some(u => u.id === grupisaniId));
  assert.ok(aktivni.some(u => u.id === bezGrupeId));
  assert.ok(!aktivni.some(u => u.id === arhiviraniId));

  const svi = await get("/muallim/ucenici?includeArchived=1") as Array<{
    id: number; aktivanStatus: boolean; grupaIme: string | null;
    muallimDisplayName: string | null; roditelj: { id: number; displayName: string } | null;
  }>;
  assert.equal(svi.find(u => u.id === grupisaniId)?.grupaIme, `Grupa ${suffix}`);
  assert.equal(svi.find(u => u.id === bezGrupeId)?.grupaIme, null);
  assert.equal(svi.find(u => u.id === arhiviraniId)?.aktivanStatus, false);
  assert.equal(svi.find(u => u.id === arhiviraniId)?.roditelj?.id, roditeljId);
  assert.equal(svi.find(u => u.id === arhiviraniId)?.muallimDisplayName, `muallim ${suffix}`);

  const kontakti = await get("/poruke/kontakti") as Array<{ id: number }>;
  assert.ok(kontakti.some(k => k.id === roditeljId), "roditelj arhiviranog učenika mora biti dostupan za poruke");
});