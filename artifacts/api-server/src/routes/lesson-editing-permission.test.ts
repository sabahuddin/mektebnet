import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import bcrypt from "bcryptjs";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable, usersTable } from "@workspace/db/schema";
import app from "../app.js";
import { signToken, invalidateUserStatusCache } from "../middlewares/auth.js";

const SUFFIX = `lesson-editing-${Date.now()}`;
let server: Server;
let baseUrl: string;
let adminId: number;
let teacherId: number;
let lessonId: number;
const lessonSlug = `${SUFFIX}-prep`;
const teacherPassword = "lesson-editing-test-password";

function tokenFor(userId: number, role: "admin" | "muallim", label: string): string {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

const adminToken = () => tokenFor(adminId, "admin", "admin");
const teacherToken = () => tokenFor(teacherId, "muallim", "teacher");

function request(path: string, token: string | null, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

before(async () => {
  // Keep direct test runs compatible with databases that have not booted the
  // server's residual-schema migration.
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_lessons boolean NOT NULL DEFAULT true;`);
  const acknowledgedAt = new Date();
  const [admin] = await db.insert(usersTable).values({
    username: `admin.${SUFFIX}`,
    displayName: `Admin ${SUFFIX}`,
    passwordHash: "test-only",
    role: "admin",
    isActive: true,
    termsAcceptedAt: acknowledgedAt,
    privacyAcknowledgedAt: acknowledgedAt,
    administratorDeclarationAcceptedAt: acknowledgedAt,
  }).returning({ id: usersTable.id });
  adminId = admin.id;
  const [teacher] = await db.insert(usersTable).values({
    username: `teacher.${SUFFIX}`,
    displayName: `Teacher ${SUFFIX}`,
    passwordHash: await bcrypt.hash(teacherPassword, 4),
    role: "muallim",
    isActive: true,
    termsAcceptedAt: acknowledgedAt,
    privacyAcknowledgedAt: acknowledgedAt,
    administratorDeclarationAcceptedAt: acknowledgedAt,
  }).returning({ id: usersTable.id });
  teacherId = teacher.id;
  const [lesson] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: lessonSlug,
    naslov: "Testna priprema",
    contentHtml: '<div class="lesson-accordion"><button class="lesson-section-btn">PRIPREMA ZA NASTAVU</button><div id="priprema" class="lesson-content"><p>Plan nastavnog sata</p></div></div>',
  }).returning({ id: ilmihalLekcijeTable.id });
  lessonId = lesson.id;

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (lessonId) await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lessonId));
  if (adminId && teacherId) {
    await db.delete(usersTable).where(inArray(usersTable.id, [adminId, teacherId]));
  }
});

test("muallim canEditLessons defaults to enabled", async () => {
  const [teacher] = await db.select({ canEditLessons: usersTable.canEditLessons })
    .from(usersTable)
    .where(eq(usersTable.id, teacherId));
  assert.equal(teacher.canEditLessons, true);
  const login = await request("/api/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ username: `teacher.${SUFFIX}`, password: teacherPassword }),
  });
  assert.equal(login.status, 200);
  const payload = await login.json() as { user: { canEditLessons: boolean } };
  assert.equal(payload.user.canEditLessons, true);
});

test("admin can disable lesson editing; muallim writes are rejected but reads remain available", async () => {
  const updated = await request(`/api/admin/muallimi/${teacherId}/lesson-editing`, adminToken(), {
    method: "PUT",
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), { canEditLessons: false });

  const listed = await request("/api/admin/korisnici", adminToken());
  assert.equal(listed.status, 200);
  const users = await listed.json() as Array<{ id: number; canEditLessons: boolean }>;
  assert.equal(users.find((user) => user.id === teacherId)?.canEditLessons, false);

  const me = await request("/api/auth/me", teacherToken());
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as { canEditLessons: boolean }).canEditLessons, false);

  for (const [method, path] of [
    ["POST", "/api/admin/prilozi/12"],
    ["POST", "/api/admin/prilozi/12/url"],
    ["POST", "/api/admin/prilozi/12/embed"],
    ["PUT", "/api/admin/prilozi/12/redoslijed"],
    ["PUT", "/api/admin/prilozi/12"],
    ["DELETE", "/api/admin/prilozi/12"],
    ["POST", "/api/admin/ilmihal"],
    ["PUT", "/api/admin/ilmihal/12"],
    ["DELETE", "/api/admin/ilmihal/12"],
  ] as const) {
    const response = await request(path, teacherToken(), {
      method,
      body: JSON.stringify({ enabled: true, contentHtml: "<p>test</p>" }),
    });
    assert.equal(response.status, 403, `${method} ${path}`);
  }

  // A GET to the download path must not be rejected by the new edit gate.
  const download = await request("/api/admin/prilozi/download/999999", teacherToken());
  assert.notEqual(download.status, 403);
  const materialRead = await request("/api/admin/prilozi/12", teacherToken());
  assert.notEqual(materialRead.status, 403);

  const lessonRead = await request(`/api/content/ilmihal/${lessonSlug}`, teacherToken());
  assert.equal(lessonRead.status, 200);
  assert.equal(lessonRead.headers.get("cache-control"), "private, no-store");
  const lesson = await lessonRead.json() as { slug: string; contentHtml: string; prilozi: unknown[] };
  assert.equal(lesson.slug, lessonSlug);
  assert.match(lesson.contentHtml, /id="priprema"/);
  assert.ok(Array.isArray(lesson.prilozi), "muallim može čitati nastavne priloge bez prava uređivanja");

  // Standalone image upload is also used by messages to parents. It must
  // remain available; attaching the uploaded image to a lesson is forbidden.
  const messageUpload = await request("/api/admin/upload", teacherToken(), { method: "POST" });
  assert.equal(messageUpload.status, 400); // no file supplied, but authorization succeeded
});

test("admin toggle validates teacher identity and body", async () => {
  const invalidBody = await request(`/api/admin/muallimi/${teacherId}/lesson-editing`, adminToken(), {
    method: "PUT",
    body: JSON.stringify({ enabled: false, extra: true }),
  });
  assert.equal(invalidBody.status, 400);

  const nonTeacher = await request(`/api/admin/muallimi/${adminId}/lesson-editing`, adminToken(), {
    method: "PUT",
    body: JSON.stringify({ enabled: false }),
  });
  assert.equal(nonTeacher.status, 404);
});

test("admin can restore a teacher's editing permission", async () => {
  const updated = await request(`/api/admin/muallimi/${teacherId}/lesson-editing`, adminToken(), {
    method: "PUT",
    body: JSON.stringify({ enabled: true }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), { canEditLessons: true });

  const edit = await request("/api/admin/ilmihal/999999", teacherToken(), {
    method: "PUT",
    body: JSON.stringify({ contentHtml: "<p>test</p>" }),
  });
  assert.notEqual(edit.status, 403);
});

test("a role change revokes the previous token's editing/admin authority", async () => {
  await db.update(usersTable).set({ role: "ucenik" }).where(eq(usersTable.id, teacherId));
  invalidateUserStatusCache(teacherId);
  try {
    const staleTeacherToken = await request("/api/admin/ilmihal/999999", teacherToken(), {
      method: "PUT",
      body: JSON.stringify({ contentHtml: "<p>test</p>" }),
    });
    assert.equal(staleTeacherToken.status, 403);
  } finally {
    await db.update(usersTable).set({ role: "muallim" }).where(eq(usersTable.id, teacherId));
    invalidateUserStatusCache(teacherId);
  }

  await db.update(usersTable).set({ role: "muallim" }).where(eq(usersTable.id, adminId));
  invalidateUserStatusCache(adminId);
  try {
    const staleAdminToken = await request(`/api/admin/muallimi/${teacherId}/lesson-editing`, adminToken(), {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(staleAdminToken.status, 403);
  } finally {
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, adminId));
    invalidateUserStatusCache(adminId);
  }
});