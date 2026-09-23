import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  mektebiTable,
  pretplateTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `billing-${Date.now()}`;

let server: Server;
let baseUrl: string;
let adminId: number;
let ucenikId: number;
let mektebParentId: number;
let selfParentId: number;
let selfStudentId: number;
let familyChildId: number;
let mektebId: number;
let adminToken: string;
let mektebParentToken: string;
let selfParentToken: string;

async function createUser(
  role: "admin" | "ucenik" | "roditelj",
  label: string,
  email?: string,
): Promise<number> {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "test-only",
    role,
    email,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    ...(role === "roditelj" ? { parentAcknowledgedAt: new Date() } : {}),
  }).returning({ id: usersTable.id });
  return user.id;
}

function tokenFor(userId: number, role: "admin" | "roditelj", label: string) {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

function request(path: string, token: string, init?: RequestInit) {
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
  adminId = await createUser("admin", "admin");
  ucenikId = await createUser("ucenik", "ucenik");
  mektebParentId = await createUser("roditelj", "roditelj-mekteb", `mekteb-${SUFFIX}@example.test`);
  selfParentId = await createUser(
    "roditelj",
    "roditelj-self",
    `${SUFFIX}@example.test`,
  );
  selfStudentId = await createUser("ucenik", "ucenik-self");
  familyChildId = await createUser("ucenik", "ucenik-family");

  const [mekteb] = await db.insert(mektebiTable).values({
    naziv: `Test mekteb ${SUFFIX}`,
    billingPaket: "do100",
    billingRegion: "bih",
  }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;

  await db.insert(ucenikProfiliTable).values([
    { userId: ucenikId, mektebId },
    { userId: selfStudentId },
    { userId: familyChildId },
  ]);
  await db.insert(roditeljProfiliTable).values([
    { userId: mektebParentId },
    { userId: selfParentId },
  ]);
  await db.insert(roditeljUcenikTable).values({
    roditeljId: mektebParentId,
    ucenikId,
    status: "approved",
    approvedAt: new Date(),
  });
  await db.insert(roditeljUcenikTable).values({
    roditeljId: selfParentId,
    ucenikId: familyChildId,
    status: "approved",
    approvedAt: new Date(),
  });
  await db.insert(pretplateTable).values([
    { userId: selfParentId, planType: "family", status: "pending", licencesPurchased: 4, iznos: 30, valuta: "EUR" },
    { userId: selfStudentId, planType: "individual", status: "pending", licencesPurchased: 1, iznos: 20, valuta: "EUR" },
  ]);

  adminToken = tokenFor(adminId, "admin", "admin");
  mektebParentToken = tokenFor(mektebParentId, "roditelj", "roditelj-mekteb");
  selfParentToken = tokenFor(selfParentId, "roditelj", "roditelj-self");

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

  const userIds = [adminId, ucenikId, mektebParentId, selfParentId, selfStudentId, familyChildId].filter(Boolean);
  if (userIds.length) {
    await db.delete(pretplateTable).where(inArray(pretplateTable.userId, userIds));
    await db.delete(roditeljUcenikTable)
      .where(inArray(roditeljUcenikTable.roditeljId, userIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (mektebId) {
    await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  }
});

test("roditeljski profil razlikuje mektebsko pokriće od samostalne porodične licence", async () => {
  const [mektebResponse, selfResponse] = await Promise.all([
    request("/api/auth/subscription", mektebParentToken),
    request("/api/auth/subscription", selfParentToken),
  ]);
  assert.equal(mektebResponse.status, 200);
  assert.equal(selfResponse.status, 200);

  const mektebProfile = await mektebResponse.json() as {
    coverage: string;
    expectedAmount: number | null;
    canRenew: boolean;
  };
  const selfProfile = await selfResponse.json() as {
    coverage: string;
    planType: string | null;
    expectedAmount: number | null;
    canRenew: boolean;
  };

  assert.equal(mektebProfile.coverage, "mekteb");
  assert.equal(mektebProfile.expectedAmount, null);
  assert.equal(mektebProfile.canRenew, false);
  assert.equal(selfProfile.coverage, "self");
  assert.equal(selfProfile.planType, "family");
  assert.equal(selfProfile.expectedAmount, 30);
  assert.equal(selfProfile.canRenew, true);
});

test("admin popis vraća istu klasifikaciju roditelja kao roditeljski profil", async () => {
  const response = await request("/api/admin/korisnici", adminToken);
  assert.equal(response.status, 200);
  const users = await response.json() as Array<{
    id: number;
    billingCoverage: string | null;
    billingPlan: string | null;
    porodicnaDjeca: Array<{ id: number; billingCoverage: string | null }>;
  }>;

  const mektebParent = users.find((user) => user.id === mektebParentId);
  const selfParent = users.find((user) => user.id === selfParentId);
  const selfStudent = users.find((user) => user.id === selfStudentId);
  const familyChild = users.find((user) => user.id === familyChildId);
  assert.equal(mektebParent?.billingCoverage, "mekteb");
  assert.equal(mektebParent?.billingPlan, null);
  assert.equal(selfParent?.billingCoverage, "self");
  assert.equal(selfParent?.billingPlan, "family");
  assert.deepEqual(selfParent?.porodicnaDjeca, [{
    id: familyChildId,
    username: `ucenik-family.${SUFFIX}`,
    displayName: `ucenik-family ${SUFFIX}`,
    billingCoverage: "family",
  }]);
  assert.deepEqual(mektebParent?.porodicnaDjeca, []);
  assert.equal(selfStudent?.billingCoverage, "self");
  assert.equal(selfStudent?.billingPlan, "individual");
  assert.equal(familyChild?.billingCoverage, "family");
});

test("admin ne može evidentirati samostalnu uplatu roditelju džematskog učenika čak ni s emailom", async () => {
  const response = await request(
    `/api/admin/korisnik/${mektebParentId}/pretplata`,
    adminToken,
    {
      method: "PUT",
      body: JSON.stringify({ paid: true, iznos: 30, valuta: "EUR" }),
    },
  );
  assert.equal(response.status, 409);

  const subscriptions = await db.select({ id: pretplateTable.id })
    .from(pretplateTable)
    .where(eq(pretplateTable.userId, mektebParentId));
  assert.equal(subscriptions.length, 0);
});

test("admin evidentira uplatu i zasebno koriguje datum bez ponovne naplate", async () => {
  const pay = await request(`/api/admin/korisnik/${selfStudentId}/pretplata`, adminToken, {
    method: "PUT",
    body: JSON.stringify({ paid: true, iznos: 20, valuta: "EUR" }),
  });
  assert.equal(pay.status, 200);
  const paid = await pay.json() as { status: string; expiresAt: string };
  assert.equal(paid.status, "active");
  assert.ok(paid.expiresAt);

  const edit = await request(`/api/admin/korisnik/${selfStudentId}/pretplata`, adminToken, {
    method: "PUT",
    body: JSON.stringify({
      paid: false, metadataOnly: true, iznos: 20, valuta: "EUR",
      licenceStart: "2030-01-01", licenceEnd: "2031-04-01", paidAt: "2030-01-01",
    }),
  });
  assert.equal(edit.status, 200);
  const updated = await edit.json() as { status: string; expiresAt: string };
  assert.equal(updated.status, "active");
  assert.equal(updated.expiresAt.slice(0, 10), "2031-04-01");

  const records = await db.select().from(pretplateTable).where(eq(pretplateTable.userId, selfStudentId));
  assert.equal(records.length, 1);
  const listed = await request("/api/admin/korisnici", adminToken);
  const users = await listed.json() as Array<{ id: number; pretplata?: { expiresAt: string } }>;
  assert.equal(users.find(u => u.id === selfStudentId)?.pretplata?.expiresAt.slice(0, 10), "2031-04-01");
});