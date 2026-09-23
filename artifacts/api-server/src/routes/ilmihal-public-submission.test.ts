import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable, ucenikProfiliTable, usersTable } from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `public-submission-${Date.now()}`;
let server: Server | undefined;
let baseUrl = "";
let ownerId: number;
let studentId: number;
let outsiderId: number;
let adminToken: string;
let ownerToken: string;
let studentToken: string;
let outsiderToken: string;

function tokenFor(id: number, role: "admin" | "muallim" | "ucenik", username: string) {
  return signToken({ userId: id, username, displayName: username, role });
}

function request(path: string, token?: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function cleanup() {
  await db.execute(sql`DELETE FROM ilmihal_lekcije WHERE slug LIKE ${`muallim-${ownerId || 0}-%`}`);
  await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, studentId || 0));
  await db.delete(usersTable).where(sql`id IN (${ownerId || 0}, ${studentId || 0}, ${outsiderId || 0})`);
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  const [owner] = await db.insert(usersTable).values({
    username: `${suffix}.owner`, displayName: "Owner", passwordHash: "x", role: "muallim", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(), administratorDeclarationAcceptedAt: new Date(),
  }).returning({ id: usersTable.id });
  const [student] = await db.insert(usersTable).values({
    username: `${suffix}.student`, displayName: "Student", passwordHash: "x", role: "ucenik", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  const [outsider] = await db.insert(usersTable).values({
    username: `${suffix}.outsider`, displayName: "Outsider", passwordHash: "x", role: "ucenik", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  ownerId = owner.id;
  studentId = student.id;
  outsiderId = outsider.id;
  await db.insert(ucenikProfiliTable).values({ userId: studentId, muallimId: ownerId });
  const [admin] = await db.insert(usersTable).values({
    username: `${suffix}.admin`, displayName: "Admin", passwordHash: "x", role: "admin", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  adminToken = tokenFor(admin.id, "admin", `${suffix}.admin`);
  ownerToken = tokenFor(ownerId, "muallim", `${suffix}.owner`);
  studentToken = tokenFor(studentId, "ucenik", `${suffix}.student`);
  outsiderToken = tokenFor(outsiderId, "ucenik", `${suffix}.outsider`);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server?.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  await cleanup();
  await db.delete(usersTable).where(sql`username = ${`${suffix}.admin`}`);
});

test("private creation is visible to owner and assigned student, never enters admin queue", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Private ${suffix}`, nivo: 1, contentHtml: "<p>private</p>",
  });
  assert.equal(created.status, 201);
  const lesson = await created.json() as { slug: string };
  assert.equal((await request("/api/content/ilmihal", ownerToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
  const queue = await request("/api/admin/izmjene-lekcija", adminToken);
  assert.equal(queue.status, 200);
  const rows = await queue.json() as Array<{ lekcijaSlug: string }>;
  assert.equal(rows.some((row) => row.lekcijaSlug === lesson.slug), false);
});

test("explicit submission enters queue and admin approval publishes to everyone", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Approve ${suffix}`, nivo: 1, contentHtml: "<p>approve</p>",
    podnesenoZaJavnuObjavu: true,
  });
  const lesson = await created.json() as { slug: string };
  const queue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaSlug: string }>;
  const item = queue.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item!.id}/odluka`, adminToken, "PUT", { visibility: "javno" })).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 200);
});

test("explicit submission rejection removes queue item but retains owner/student access", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Reject ${suffix}`, nivo: 1, contentHtml: "<p>reject</p>",
    podnesenoZaJavnuObjavu: true,
  });
  const lesson = await created.json() as { slug: string };
  const queue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaSlug: string }>;
  const item = queue.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item!.id}/odluka`, adminToken, "PUT", { visibility: "odbijeno" })).status, 200);
  const afterQueue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ lekcijaSlug: string }>;
  assert.equal(afterQueue.some((row) => row.lekcijaSlug === lesson.slug), false);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, ownerToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
});