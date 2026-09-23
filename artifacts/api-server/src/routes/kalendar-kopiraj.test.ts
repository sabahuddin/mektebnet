import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { grupeTable, mektebKalendarTable, planLekcijaTable, usersTable } from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `kal-copy-${Date.now()}`;
let server: Server | undefined;
let baseUrl: string;
let teacherId = 0;
let otherTeacherId = 0;
let token: string;
let sourceId = 0;
let firstId = 0;
let secondId = 0;
let foreignId = 0;
let emptyId = 0;
const sourceDates = ["2098-03-01", "2098-03-02"];
const oldDate = "2098-04-20";

const groupIds = () => [sourceId, firstId, secondId, foreignId, emptyId].filter(Boolean);

async function entries(grupaId: number) {
  return db.select().from(mektebKalendarTable).where(eq(mektebKalendarTable.grupaId, grupaId));
}

async function copy(body: unknown) {
  return fetch(`${baseUrl}/api/muallim/kalendar/kopiraj`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  const acceptedAt = new Date();
  const teachers = await db.insert(usersTable).values([
    { username: `owner.${suffix}`, displayName: "Owner", passwordHash: "x", role: "muallim", isActive: true,
      termsAcceptedAt: acceptedAt, privacyAcknowledgedAt: acceptedAt, administratorDeclarationAcceptedAt: acceptedAt },
    { username: `foreign.${suffix}`, displayName: "Other", passwordHash: "x", role: "muallim", isActive: true,
      termsAcceptedAt: acceptedAt, privacyAcknowledgedAt: acceptedAt, administratorDeclarationAcceptedAt: acceptedAt },
  ]).returning({ id: usersTable.id });
  teacherId = teachers[0].id;
  otherTeacherId = teachers[1].id;
  const groups = await db.insert(grupeTable).values([
    { muallimId: teacherId, naziv: `Izvor ${suffix}`, skolskaGodina: "2098/99", isActive: true },
    { muallimId: teacherId, naziv: `Prva ${suffix}`, skolskaGodina: "2098/99", isActive: true },
    { muallimId: teacherId, naziv: `Druga ${suffix}`, skolskaGodina: "2098/99", isActive: true },
    { muallimId: otherTeacherId, naziv: `Tuđa ${suffix}`, skolskaGodina: "2098/99", isActive: true },
    { muallimId: teacherId, naziv: `Prazna ${suffix}`, skolskaGodina: "2098/99", isActive: true },
  ]).returning({ id: grupeTable.id });
  [sourceId, firstId, secondId, foreignId, emptyId] = groups.map(g => g.id);

  await db.insert(mektebKalendarTable).values([
    { grupaId: sourceId, muallimId: teacherId, datum: sourceDates[0], tip: "mekteb", opis: "Izvorni prvi" },
    { grupaId: sourceId, muallimId: teacherId, datum: sourceDates[1], tip: "ferije", opis: "Izvorni drugi" },
    { grupaId: firstId, muallimId: teacherId, datum: sourceDates[0], tip: "ramazan", opis: "Stari prvi" },
    { grupaId: firstId, muallimId: teacherId, datum: oldDate, tip: "vazan_datum", opis: "Stari višak" },
    { grupaId: secondId, muallimId: teacherId, datum: oldDate, tip: "mekteb", opis: "Drugi višak" },
    { grupaId: foreignId, muallimId: otherTeacherId, datum: oldDate, tip: "mekteb", opis: "Tuđa grupa" },
  ]);
  await db.insert(planLekcijaTable).values({
    grupaId: firstId, muallimId: teacherId, datum: oldDate, lekcijaNaslov: "Plan ostaje",
  });

  token = signToken({
    userId: teacherId, username: `owner.${suffix}`, displayName: "Owner", role: "muallim",
  });
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const address = server?.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>(resolve => server?.close(() => resolve()));
  if (groupIds().length) {
    await db.delete(planLekcijaTable).where(inArray(planLekcijaTable.grupaId, groupIds()));
    await db.delete(mektebKalendarTable).where(inArray(mektebKalendarTable.grupaId, groupIds()));
    await db.delete(grupeTable).where(inArray(grupeTable.id, groupIds()));
  }
  const teacherIds = [teacherId, otherTeacherId].filter(Boolean);
  if (teacherIds.length) await db.delete(usersTable).where(inArray(usersTable.id, teacherIds));
});

test("bez prepisivanja preskače postojeće datume, zadržava ostale", async () => {
  const response = await copy({ sourceGrupaId: sourceId, targetGrupaIds: [firstId, secondId], override: false });
  assert.equal(response.status, 200, response.ok ? undefined : await response.text());
  const first = await entries(firstId);
  const second = await entries(secondId);
  assert.equal(first.find(e => e.datum === sourceDates[0])?.opis, "Stari prvi");
  assert.equal(first.find(e => e.datum === oldDate)?.opis, "Stari višak");
  assert.equal(first.find(e => e.datum === sourceDates[1])?.opis, "Izvorni drugi");
  assert.equal(second.find(e => e.datum === oldDate)?.opis, "Drugi višak");
  assert.equal(second.length, 3);
});

test("neovlaštena grupa sprečava bilo kakvo brisanje drugih odredišta", async () => {
  const beforeEntries = await entries(firstId);
  const response = await copy({ sourceGrupaId: sourceId, targetGrupaIds: [firstId, foreignId], override: true });
  assert.equal(response.status, 403);
  assert.deepEqual(await entries(firstId), beforeEntries);
  assert.equal((await entries(foreignId))[0].opis, "Tuđa grupa");
});

test("prepisivanje briše i datume kojih nema u izvoru, ali ne dira plan lekcija", async () => {
  const response = await copy({ sourceGrupaId: sourceId, targetGrupaIds: [firstId, secondId], override: true });
  assert.equal(response.status, 200, response.ok ? undefined : await response.text());
  const result = await response.json() as { kopirano: number; preskoceno: number; grupaBroj: number };
  assert.equal(result.kopirano, 4);
  assert.equal(result.preskoceno, 0);
  assert.equal(result.grupaBroj, 2);
  for (const id of [firstId, secondId]) {
    const rows = await entries(id);
    assert.deepEqual(rows.map(e => e.datum).sort(), sourceDates);
    assert.equal(rows.find(e => e.datum === sourceDates[0])?.opis, "Izvorni prvi");
  }
  assert.deepEqual((await entries(sourceId)).map(e => e.datum).sort(), sourceDates);
  assert.deepEqual(await entries(emptyId), []);
  assert.equal((await entries(foreignId))[0].opis, "Tuđa grupa");
  const plans = await db.select().from(planLekcijaTable).where(eq(planLekcijaTable.grupaId, firstId));
  assert.equal(plans.length, 1);
  assert.equal(plans[0].lekcijaNaslov, "Plan ostaje");
});

test("prazan izvor ne može obrisati kalendar ciljne grupe", async () => {
  const beforeEntries = await entries(secondId);
  const response = await copy({ sourceGrupaId: emptyId, targetGrupaIds: [secondId], override: true });
  assert.equal(response.status, 400);
  assert.deepEqual(await entries(secondId), beforeEntries);
});