import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  mektebiTable,
  muallimProfiliTable,
  pretplateTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `billing-override-${Date.now()}`;
let server: Server;
let baseUrl: string;
let adminId: number;
let paidStudentId: number;
let pendingStudentId: number;
let raceStudentId: number;
let mixedStudentId: number;
let mektebId: number;
let onlineStudentId: number;
let onlineTeacherId: number;
let onlineMektebId: number;

async function createUser(role: "admin" | "ucenik" | "muallim", label: string): Promise<number> {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "test-only",
    role,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  return user.id;
}

function tokenFor(userId: number, role: "admin" | "ucenik", label: string): string {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

function request(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

before(async () => {
  // The integration database may be provisioned without the boot-time
  // residual migration when this file is run directly.
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_override varchar(20);`);
  await db.execute(sql`ALTER TABLE mektebi ADD COLUMN IF NOT EXISTS drzava varchar(100);`);
  adminId = await createUser("admin", "admin");
  paidStudentId = await createUser("ucenik", "paid-student");
  pendingStudentId = await createUser("ucenik", "pending-student");
  raceStudentId = await createUser("ucenik", "race-student");
  mixedStudentId = await createUser("ucenik", "mixed-student");
  onlineStudentId = await createUser("ucenik", "online-student");
  onlineTeacherId = await createUser("muallim", "online-teacher");
  const [mekteb] = await db.insert(mektebiTable).values({
    naziv: `Billing override mekteb ${SUFFIX}`,
    billingPaket: "do100",
    billingRegion: "bih",
  }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  const [onlineMekteb] = await db.insert(mektebiTable).values({
    naziv: "Online džemat",
    billingPaket: "do100",
    billingRegion: "bih",
  }).returning({ id: mektebiTable.id });
  onlineMektebId = onlineMekteb.id;
  await db.insert(muallimProfiliTable).values({ userId: onlineTeacherId, mektebId: onlineMektebId });
  await db.insert(ucenikProfiliTable).values([
    { userId: paidStudentId, mektebId },
    { userId: pendingStudentId, mektebId },
    { userId: raceStudentId, mektebId },
    { userId: mixedStudentId },
    { userId: onlineStudentId, muallimId: onlineTeacherId },
  ]);
  await db.update(usersTable)
    .set({ trialUntil: new Date("2027-12-01T00:00:00Z") })
    .where(eq(usersTable.id, onlineStudentId));
  await db.insert(pretplateTable).values({
    userId: onlineStudentId,
    planType: "individual",
    status: "pending",
    licencesPurchased: 1,
  });
  await db.insert(pretplateTable).values({
    userId: paidStudentId,
    planType: "individual",
    status: "active",
    licencesPurchased: 1,
    iznos: 20,
    valuta: "EUR",
    paidAt: new Date("2025-01-01T00:00:00Z"),
    activatedAt: new Date("2025-01-01T00:00:00Z"),
    expiresAt: new Date("2026-01-01T00:00:00Z"),
  });
  await db.insert(pretplateTable).values([
    {
      userId: mixedStudentId,
      planType: "individual",
      status: "active",
      licencesPurchased: 1,
      iznos: 20,
      valuta: "EUR",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      paidAt: new Date("2024-01-01T00:00:00Z"),
      activatedAt: new Date("2024-01-01T00:00:00Z"),
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      userId: mixedStudentId,
      planType: "family",
      status: "active",
      licencesPurchased: 4,
      iznos: 30,
      valuta: "EUR",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    },
  ]);
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
  const userIds = [adminId, paidStudentId, pendingStudentId, raceStudentId, mixedStudentId, onlineStudentId, onlineTeacherId].filter(Boolean);
  await db.delete(pretplateTable).where(inArray(pretplateTable.userId, userIds));
  await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
  if (onlineTeacherId) await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, onlineTeacherId));
  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  if (onlineMektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, onlineMektebId));
});

test("admin move keeps an active own subscription and makes auth coverage self", async () => {
  const adminToken = tokenFor(adminId, "admin", "admin");
  const studentToken = tokenFor(paidStudentId, "ucenik", "paid-student");
  const before = await request("/api/admin/korisnici", adminToken);
  assert.equal(before.status, 200);
  const beforeUser = (await before.json() as Array<{ id: number; billingCoverage: string; pretplata: { id: number } | null }>)
    .find((user) => user.id === paidStudentId);
  assert.equal(beforeUser?.billingCoverage, "mekteb");
  assert.equal(beforeUser?.pretplata, null);

  const moved = await request(`/api/admin/korisnik/${paidStudentId}/billing-override`, adminToken, {
    method: "POST",
    body: JSON.stringify({ mode: "self" }),
  });
  assert.equal(moved.status, 200);
  const records = await db.select().from(pretplateTable).where(eq(pretplateTable.userId, paidStudentId));
  assert.equal(records.length, 1);
  const originalId = records[0].id;
  assert.equal((await moved.json() as { pretplata: { id: number } }).pretplata.id, originalId);

  const subscription = await request("/api/auth/subscription", studentToken);
  assert.equal(subscription.status, 200);
  assert.equal((await subscription.json() as { coverage: string; planType: string }).coverage, "self");
  const schoolList = await request("/api/admin/korisnici", adminToken);
  const schoolUser = (await schoolList.json() as Array<{ id: number; billingCoverage: string; mektebNaziv: string | null; pretplata: { id: number } | null }>)
    .find((user) => user.id === paidStudentId);
  assert.equal(schoolUser?.billingCoverage, "self");
  assert.equal(schoolUser?.pretplata?.id, originalId);
  assert.match(schoolUser?.mektebNaziv ?? "", /Billing override mekteb/);

  const movedAgain = await request(`/api/admin/korisnik/${paidStudentId}/billing-override`, adminToken, {
    method: "POST",
    body: JSON.stringify({ mode: "self" }),
  });
  assert.equal(movedAgain.status, 200);
  assert.equal((await db.select().from(pretplateTable).where(eq(pretplateTable.userId, paidStudentId))).length, 1);
});

test("online džemat nije mektebska naplata samostalno registrovanog učenika", async () => {
  const response = await request("/api/admin/korisnici", tokenFor(adminId, "admin", "admin"));
  assert.equal(response.status, 200);
  const student = (await response.json() as Array<{
    id: number; role: string; billingCoverage: string; billingPlan: string;
    mektebNaziv: string | null; pretplata: { status: string } | null;
  }>).find((user) => user.id === onlineStudentId);
  assert.equal(student?.role, "ucenik");
  assert.equal(student?.billingCoverage, "self");
  assert.equal(student?.billingPlan, "individual");
  assert.equal(student?.pretplata?.status, "pending");
  assert.equal(student?.mektebNaziv, "Online džemat");
  const ownProfile = await request("/api/auth/subscription", tokenFor(onlineStudentId, "ucenik", "online-student"));
  assert.equal(ownProfile.status, 200);
  const subscription = await ownProfile.json() as { coverage: string; planType: string; canRenew: boolean };
  assert.equal(subscription.coverage, "self");
  assert.equal(subscription.planType, "individual");
  assert.equal(subscription.canRenew, true);
});

test("admin move creates one pending subscription and is idempotent", async () => {
  const adminToken = tokenFor(adminId, "admin", "admin");
  const path = `/api/admin/korisnik/${pendingStudentId}/billing-override`;
  for (let i = 0; i < 2; i++) {
    const response = await request(path, adminToken, {
      method: "POST",
      body: JSON.stringify({ mode: "self" }),
    });
    assert.equal(response.status, 200);
  }
  const records = await db.select().from(pretplateTable).where(and(
    eq(pretplateTable.userId, pendingStudentId),
    eq(pretplateTable.planType, "individual"),
  ));
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "pending");
});

test("simultaneous self moves create only one pending subscription", async () => {
  const adminToken = tokenFor(adminId, "admin", "admin");
  const path = `/api/admin/korisnik/${raceStudentId}/billing-override`;
  const responses = await Promise.all([1, 2].map(() => request(path, adminToken, {
    method: "POST",
    body: JSON.stringify({ mode: "self" }),
  })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 200]);
  const records = await db.select().from(pretplateTable).where(eq(pretplateTable.userId, raceStudentId));
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "pending");
});

test("role-matching own subscription wins over a newer incompatible history entry", async () => {
  const adminToken = tokenFor(adminId, "admin", "admin");
  const studentToken = tokenFor(mixedStudentId, "ucenik", "mixed-student");
  const listed = await request("/api/admin/korisnici", adminToken);
  assert.equal(listed.status, 200);
  const listedUser = (await listed.json() as Array<{
    id: number;
    billingCoverage: string | null;
    billingPlan: string | null;
    pretplata: { planType: string } | null;
  }>).find((user) => user.id === mixedStudentId);
  assert.equal(listedUser?.billingCoverage, "self");
  assert.equal(listedUser?.billingPlan, "individual");
  assert.equal(listedUser?.pretplata?.planType, "individual");

  const subscription = await request("/api/auth/subscription", studentToken);
  assert.equal(subscription.status, 200);
  assert.equal((await subscription.json() as { coverage: string; planType: string }).coverage, "self");

  const edited = await request(`/api/admin/korisnik/${mixedStudentId}/pretplata`, adminToken, {
    method: "PUT",
    body: JSON.stringify({ paid: false, metadataOnly: true, iznos: 20, valuta: "EUR" }),
  });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json() as { planType: string }).planType, "individual");
});

test("raniji plaćeni samostalni pretplatnik ostaje vidljiv bez historijskih potvrda pravila", async () => {
  await db.update(usersTable).set({ termsAcceptedAt: null, privacyAcknowledgedAt: null })
    .where(eq(usersTable.id, mixedStudentId));
  const response = await request("/api/admin/korisnici", tokenFor(adminId, "admin", "admin"));
  assert.equal(response.status, 200);
  const user = (await response.json() as Array<{ id: number; billingCoverage: string | null }>)
    .find((row) => row.id === mixedStudentId);
  assert.equal(user?.billingCoverage, "self");
});