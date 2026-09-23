import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  mektebiTable,
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

async function createUser(role: "admin" | "ucenik", label: string): Promise<number> {
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
  const [mekteb] = await db.insert(mektebiTable).values({
    naziv: `Billing override mekteb ${SUFFIX}`,
    billingPaket: "do100",
    billingRegion: "bih",
  }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  await db.insert(ucenikProfiliTable).values([
    { userId: paidStudentId, mektebId },
    { userId: pendingStudentId, mektebId },
    { userId: raceStudentId, mektebId },
    { userId: mixedStudentId },
  ]);
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
  const userIds = [adminId, paidStudentId, pendingStudentId, raceStudentId, mixedStudentId].filter(Boolean);
  await db.delete(pretplateTable).where(inArray(pretplateTable.userId, userIds));
  await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
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

  const movedAgain = await request(`/api/admin/korisnik/${paidStudentId}/billing-override`, adminToken, {
    method: "POST",
    body: JSON.stringify({ mode: "self" }),
  });
  assert.equal(movedAgain.status, 200);
  assert.equal((await db.select().from(pretplateTable).where(eq(pretplateTable.userId, paidStudentId))).length, 1);
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