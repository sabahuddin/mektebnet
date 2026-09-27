import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  h5pPokusajiTable,
  ilmihalLekcijeTable,
  prilozi,
  studentProgressTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `prilog-pending-${Date.now()}`;
const uploadsDir = path.resolve(process.env["UPLOADS_DIR"] || path.join(process.cwd(), "uploads"));
let server: Server;
let baseUrl = "";
let lessonId: number;
let lessonSlug: string;
let pendingLessonId: number;
let privateLessonId: number;
let adminId: number;
let uploaderId: number;
let otherTeacherId: number;
let studentId: number;
let parentId: number;
let filePrilogId: number;
let embedPrilogId: number;
let h5pPrilogId: number;
let pendingLessonH5pId: number;
let privateLessonH5pId: number;

function tokenFor(userId: number, role: "admin" | "muallim" | "ucenik" | "roditelj") {
  return signToken({
    userId,
    username: `${suffix}.${role}.${userId}`,
    displayName: `${suffix} ${role}`,
    role,
  });
}

const adminToken = () => tokenFor(adminId, "admin");
const uploaderToken = () => tokenFor(uploaderId, "muallim");
const otherTeacherToken = () => tokenFor(otherTeacherId, "muallim");
const studentToken = () => tokenFor(studentId, "ucenik");
const parentToken = () => tokenFor(parentId, "roditelj");

function request(url: string, token?: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${url}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

async function addUser(role: "admin" | "muallim" | "ucenik" | "roditelj") {
  const [user] = await db.insert(usersTable).values({
    username: `${suffix}.${role}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`,
    displayName: `${suffix} ${role}`,
    passwordHash: "x",
    role,
    isActive: true,
    canEditLessons: role === "muallim",
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: role === "muallim" ? new Date() : null,
    parentAcknowledgedAt: role === "roditelj" ? new Date() : null,
  }).returning({ id: usersTable.id });
  return user.id;
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();

  adminId = await addUser("admin");
  uploaderId = await addUser("muallim");
  otherTeacherId = await addUser("muallim");
  studentId = await addUser("ucenik");
  parentId = await addUser("roditelj");
  const [lesson] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: `pending-prilozi-${Date.now()}`,
    naslov: "Pending prilog visibility test",
    contentHtml: "<p>Test lekcija</p>",
    redoslijed: 1,
    isPublished: true,
    dostupnost: "svi",
  }).returning({ id: ilmihalLekcijeTable.id, slug: ilmihalLekcijeTable.slug });
  lessonId = lesson.id;
  lessonSlug = lesson.slug;

  const [file] = await db.insert(prilozi).values({
    lekcijaId: lessonId,
    redoslijed: 1,
    originalName: `${suffix}.txt`,
    storedName: `${suffix}.txt`,
    fileSize: 20,
    mimeType: "text/plain",
    kind: "file",
    approved: false,
    uploadedByRole: "muallim",
    uploadedByUserId: uploaderId,
  }).returning({ id: prilozi.id });
  filePrilogId = file.id;

  const [embed] = await db.insert(prilozi).values({
    lekcijaId: lessonId,
    redoslijed: 2,
    originalName: "Pending embed",
    storedName: "",
    fileSize: 0,
    mimeType: "text/embed",
    kind: "embed",
    externalUrl: "https://learningapps.org/view/test",
    approved: false,
    uploadedByRole: "muallim",
    uploadedByUserId: uploaderId,
  }).returning({ id: prilozi.id });
  embedPrilogId = embed.id;

  const [h5p] = await db.insert(prilozi).values({
    lekcijaId: lessonId,
    redoslijed: 3,
    originalName: "Pending H5P",
    storedName: "h5p/pending",
    fileSize: 0,
    mimeType: "application/x-h5p",
    kind: "h5p",
    approved: false,
    uploadedByRole: "muallim",
    uploadedByUserId: uploaderId,
  }).returning({ id: prilozi.id });
  h5pPrilogId = h5p.id;
  await db.update(prilozi).set({ storedName: `h5p/${h5pPrilogId}` }).where(eq(prilozi.id, h5pPrilogId));

  const [pendingLesson] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: `pending-parent-${Date.now()}`,
    naslov: "Pending parent lesson",
    contentHtml: "",
    dostupnost: "autorovi_ucenici",
    autorMuallimId: uploaderId,
    statusOdobrenja: "na_cekanju",
    isPublished: false,
  }).returning({ id: ilmihalLekcijeTable.id });
  pendingLessonId = pendingLesson.id;
  const [pendingLessonH5p] = await db.insert(prilozi).values({
    lekcijaId: pendingLessonId,
    originalName: "Approved H5P on pending lesson",
    storedName: `h5p/pending-parent-${Date.now()}`,
    fileSize: 0,
    mimeType: "application/x-h5p",
    kind: "h5p",
    approved: true,
  }).returning({ id: prilozi.id });
  pendingLessonH5pId = pendingLessonH5p.id;

  const [privateLesson] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: `private-parent-${Date.now()}`,
    naslov: "Private parent lesson",
    contentHtml: "",
    dostupnost: "autorovi_ucenici",
    autorMuallimId: uploaderId,
    statusOdobrenja: "odobreno",
    isPublished: true,
  }).returning({ id: ilmihalLekcijeTable.id });
  privateLessonId = privateLesson.id;
  const [privateLessonH5p] = await db.insert(prilozi).values({
    lekcijaId: privateLessonId,
    originalName: "Approved H5P on unassigned private lesson",
    storedName: `h5p/private-parent-${Date.now()}`,
    fileSize: 0,
    mimeType: "application/x-h5p",
    kind: "h5p",
    approved: true,
  }).returning({ id: prilozi.id });
  privateLessonH5pId = privateLessonH5p.id;

  fs.mkdirSync(path.join(uploadsDir, `h5p/${h5pPrilogId}/content`), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, `${suffix}.txt`), "pending file contents");
  fs.writeFileSync(path.join(uploadsDir, `h5p/${h5pPrilogId}/content/content.json`), "{}");

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
  const ids = [filePrilogId, embedPrilogId, h5pPrilogId, pendingLessonH5pId, privateLessonH5pId].filter(Boolean);
  if (ids.length) {
    await db.delete(h5pPokusajiTable).where(inArray(h5pPokusajiTable.priloziId, ids));
    await db.delete(prilozi).where(inArray(prilozi.id, ids));
  }
  const lessonIds = [lessonId, pendingLessonId, privateLessonId].filter(Boolean);
  if (lessonIds.length) await db.delete(ilmihalLekcijeTable).where(inArray(ilmihalLekcijeTable.id, lessonIds));
  if (studentId) {
    await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(studentId)));
    await db.delete(usersTable).where(inArray(usersTable.id, [adminId, uploaderId, otherTeacherId, studentId, parentId]));
  }
  try { fs.rmSync(path.join(uploadsDir, `${suffix}.txt`), { force: true }); } catch {}
  try { fs.rmSync(path.join(uploadsDir, `h5p/${h5pPrilogId}`), { recursive: true, force: true }); } catch {}
});

test("pending attachments are visible only to uploader/admin until approved", async () => {
  const pendingIds = [filePrilogId, embedPrilogId, h5pPrilogId];
  const ownerList = await request(`/api/admin/prilozi/${lessonId}`, uploaderToken());
  assert.equal(ownerList.status, 200);
  const ownerRows = await ownerList.json() as Array<{ id: number; approved: boolean }>;
  assert.ok(pendingIds.every((id) => ownerRows.some((row) => row.id === id && !row.approved)));

  const otherTeacherList = await request(`/api/admin/prilozi/${lessonId}`, otherTeacherToken());
  assert.equal(otherTeacherList.status, 200);
  const otherRows = await otherTeacherList.json() as Array<{ id: number }>;
  assert.equal(pendingIds.some((id) => otherRows.some((row) => row.id === id)), false);

  const adminList = await request(`/api/admin/prilozi/${lessonId}`, adminToken());
  assert.equal(adminList.status, 200);
  const adminRows = await adminList.json() as Array<{ id: number; approved: boolean }>;
  assert.ok(pendingIds.every((id) => adminRows.some((row) => row.id === id && !row.approved)));

  for (const token of [studentToken(), parentToken()]) {
    assert.equal((await request(`/api/admin/prilozi/${lessonId}`, token)).status, 403);
  }

  const ownerDetail = await request(`/api/content/ilmihal/${lessonSlug}`, uploaderToken());
  assert.equal(ownerDetail.status, 200);
  const ownerLesson = await ownerDetail.json() as { prilozi?: Array<{ id: number; approved: boolean }> };
  assert.ok(pendingIds.every((id) => ownerLesson.prilozi?.some((item) => item.id === id && !item.approved)));

  for (const token of [otherTeacherToken(), studentToken(), parentToken()]) {
    const detail = await request(`/api/content/ilmihal/${lessonSlug}`, token);
    assert.equal(detail.status, 200);
    const lesson = await detail.json() as { prilozi?: Array<{ id: number }> };
    assert.equal(pendingIds.some((id) => lesson.prilozi?.some((item) => item.id === id)), false);
  }

  const downloadPath = `/api/admin/prilozi/download/${filePrilogId}`;
  assert.equal((await request(downloadPath, uploaderToken())).status, 200);
  assert.equal((await request(downloadPath, otherTeacherToken())).status, 404);
  assert.equal((await request(downloadPath, studentToken())).status, 403);
  assert.equal((await request(`/api/uploads/${suffix}.txt`)).status, 401);
  assert.equal((await request(`/api/uploads/${suffix}.txt`, otherTeacherToken())).status, 404);
  assert.equal((await request(`/api/uploads/${suffix}.txt`, uploaderToken())).status, 200);

  const h5pPath = `/api/uploads/h5p/${h5pPrilogId}/content/content.json`;
  assert.equal((await request(h5pPath)).status, 401);
  assert.equal((await request(h5pPath, studentToken())).status, 404);
  assert.equal((await request(h5pPath, otherTeacherToken())).status, 404);
  assert.equal((await request(h5pPath, uploaderToken())).status, 200);

  const h5pResult = await request("/api/h5p/result", studentToken(), {
    method: "POST",
    body: JSON.stringify({ priloziId: h5pPrilogId, score: 1, maxScore: 1 }),
  });
  assert.equal(h5pResult.status, 404);
  assert.equal((await request(`/api/h5p/attempts/${h5pPrilogId}`, studentToken())).status, 404);

  for (const id of pendingIds) {
    const response = await request(`/api/admin/prilozi/${id}/approve`, adminToken(), {
      method: "PUT",
      body: JSON.stringify({ approve: true }),
    });
    assert.equal(response.status, 200);
  }

  const approvedTeacherList = await request(`/api/admin/prilozi/${lessonId}`, otherTeacherToken());
  const approvedTeacherRows = await approvedTeacherList.json() as Array<{ id: number; approved: boolean }>;
  assert.ok(pendingIds.every((id) => approvedTeacherRows.some((row) => row.id === id && row.approved)));
  const approvedStudentDetail = await request(`/api/content/ilmihal/${lessonSlug}`, studentToken());
  const approvedLesson = await approvedStudentDetail.json() as { prilozi?: Array<{ id: number; approved: boolean }> };
  assert.ok(approvedLesson.prilozi?.some((item) => item.id === embedPrilogId && item.approved));
  assert.ok(approvedLesson.prilozi?.some((item) => item.id === h5pPrilogId && item.approved));
  assert.equal((await request(downloadPath, otherTeacherToken())).status, 200);
  assert.equal((await request(`/api/uploads/${suffix}.txt`, otherTeacherToken())).status, 200);
  assert.equal((await request(h5pPath, studentToken())).status, 200);

  const approvedResult = await request("/api/h5p/result", studentToken(), {
    method: "POST",
    body: JSON.stringify({ priloziId: h5pPrilogId, score: 1, maxScore: 1 }),
  });
  assert.equal(approvedResult.status, 200);
  const approvedAttempts = await request(`/api/h5p/attempts/${h5pPrilogId}`, studentToken());
  assert.equal(approvedAttempts.status, 200);
});

test("H5P results and attempts require access to the parent lesson", async () => {
  for (const attachmentId of [pendingLessonH5pId, privateLessonH5pId]) {
    const result = await request("/api/h5p/result", studentToken(), {
      method: "POST",
      body: JSON.stringify({ priloziId: attachmentId, score: 1, maxScore: 1 }),
    });
    assert.equal(result.status, 404);
    assert.equal((await request(`/api/h5p/attempts/${attachmentId}`, studentToken())).status, 404);
  }
});