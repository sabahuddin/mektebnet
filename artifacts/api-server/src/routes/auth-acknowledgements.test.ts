import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import type { Server } from "node:http";
import { db } from "@workspace/db";
import { usersTable, muallimProfiliTable, roditeljProfiliTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `ack-${Date.now()}`;
const password = "ack-test-password";

let server: Server;
let baseUrl: string;
let adminId: number;
let muallimId: number;
let roditeljId: number;
let muallimToken: string;
let roditeljToken: string;
let adminToken: string;

async function createUser(
  role: "admin" | "muallim" | "roditelj",
  label: string,
  acknowledged = false,
) {
  const now = acknowledged ? new Date() : null;
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: await bcrypt.hash(password, 4),
    role,
    isActive: true,
    termsAcceptedAt: now,
    privacyAcknowledgedAt: now,
    administratorDeclarationAcceptedAt: role === "muallim" ? now : null,
    parentAcknowledgedAt: role === "roditelj" ? now : null,
  }).returning({ id: usersTable.id });
  return user.id;
}

function tokenFor(userId: number, role: "admin" | "muallim" | "roditelj", label: string) {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

function request(path: string, init: RequestInit = {}, token?: string) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

before(async () => {
  adminId = await createUser("admin", "admin", true);
  muallimId = await createUser("muallim", "muallim");
  roditeljId = await createUser("roditelj", "roditelj");
  await db.insert(muallimProfiliTable).values({ userId: muallimId });
  await db.insert(roditeljProfiliTable).values({ userId: roditeljId });

  adminToken = tokenFor(adminId, "admin", "admin");
  muallimToken = tokenFor(muallimId, "muallim", "muallim");
  roditeljToken = tokenFor(roditeljId, "roditelj", "roditelj");

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
  const userIds = [adminId, muallimId, roditeljId].filter(Boolean);
  if (userIds.length) {
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
});

test("registracija roditelja odbija nedostajuće potvrde", async () => {
  const response = await request("/api/auth/register-roditelj", {
    method: "POST",
    body: JSON.stringify({
      username: `new-parent.${SUFFIX}`,
      password,
      displayName: "New Parent",
      email: `new-parent.${SUFFIX}@example.test`,
    }),
  });
  assert.equal(response.status, 400);
});

test("registracija roditelja v2 odbija nedostajuće potvrde", async () => {
  const response = await request("/api/auth/register-roditelj-v2", {
    method: "POST",
    body: JSON.stringify({
      displayName: "New Parent V2",
      email: `new-parent-v2.${SUFFIX}@example.test`,
      billingRegion: "bih",
    }),
  });
  assert.equal(response.status, 400);
});

test("stari muallim i roditelj login vraćaju pending acknowledgements", async () => {
  const [muallimResponse, roditeljResponse] = await Promise.all([
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: `muallim.${SUFFIX}`, password }),
    }),
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: `roditelj.${SUFFIX}`, password }),
    }),
  ]);
  assert.equal(muallimResponse.status, 200);
  assert.equal(roditeljResponse.status, 200);
  const muallim = await muallimResponse.json() as { user: { pendingAcknowledgements: string[] } };
  const roditelj = await roditeljResponse.json() as { user: { pendingAcknowledgements: string[] } };
  assert.deepEqual(muallim.user.pendingAcknowledgements, ["terms", "privacy", "administratorDeclaration"]);
  assert.deepEqual(roditelj.user.pendingAcknowledgements, ["terms", "privacy", "parent"]);
});

test("zaštićeni API odbija korisnika prije potvrde, a potvrde ga otključavaju", async () => {
  const blocked = await request("/api/auth/subscription", {}, roditeljToken);
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json() as { code?: string }).code, "ACKNOWLEDGEMENTS_REQUIRED");

  const acknowledgement = await request("/api/auth/acknowledgements", {
    method: "POST",
    body: JSON.stringify({
      termsAccepted: true,
      privacyAcknowledged: true,
      parentAcknowledged: true,
    }),
  }, roditeljToken);
  assert.equal(acknowledgement.status, 200);
  const body = await acknowledgement.json() as {
    pendingAcknowledgements: string[];
    user: { pendingAcknowledgements: string[] };
  };
  assert.deepEqual(body.pendingAcknowledgements, []);
  assert.deepEqual(body.user.pendingAcknowledgements, []);

  const [stored] = await db.select().from(usersTable).where(eq(usersTable.id, roditeljId));
  assert.ok(stored.termsAcceptedAt instanceof Date);
  assert.ok(stored.privacyAcknowledgedAt instanceof Date);
  assert.ok(stored.parentAcknowledgedAt instanceof Date);

  const unblocked = await request("/api/auth/subscription", {}, roditeljToken);
  assert.equal(unblocked.status, 200);
});

test("H5P static sadržaj poštuje status potvrda", async () => {
  const pending = await request("/api/uploads/h5p/__ack-test__.json", {}, muallimToken);
  assert.equal(pending.status, 401);

  const acknowledgement = await request("/api/auth/acknowledgements", {
    method: "POST",
    body: JSON.stringify({
      termsAccepted: true,
      privacyAcknowledged: true,
      administratorDeclarationAccepted: true,
    }),
  }, muallimToken);
  assert.equal(acknowledgement.status, 200);

  // This path is intentionally absent; 404 proves auth passed to static
  // serving rather than being rejected by the H5P guard.
  const accepted = await request("/api/uploads/h5p/__ack-test__.json", {}, muallimToken);
  assert.equal(accepted.status, 404);
});

test("admin overview i dalje vidi test korisnika nakon ack toka", async () => {
  const response = await request("/api/admin/korisnici", {}, adminToken);
  assert.equal(response.status, 200);
  const users = await response.json() as Array<{ id: number; username: string }>;
  assert.equal(users.find((user) => user.id === roditeljId)?.username, `roditelj.${SUFFIX}`);
});