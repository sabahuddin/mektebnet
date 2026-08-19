import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  kvizoviTable,
  kvizPitanjaTable,
  pitanjaBankaTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `review-${Date.now()}`;
let server: Server;
let baseUrl: string;
let adminId: number;
let adminToken: string;
let lessonId: number;
let quizId: number;
let questionId: number;
const extraQuestionIds: number[] = [];

function adminRequest(path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  const [admin] = await db.insert(usersTable).values({
    username: `admin.${suffix}`,
    displayName: `Urednik ${suffix}`,
    passwordHash: "x",
    role: "admin",
    isActive: true,
  }).returning({ id: usersTable.id });
  adminId = admin.id;
  adminToken = signToken({
    userId: adminId,
    username: `admin.${suffix}`,
    displayName: `Urednik ${suffix}`,
    role: "admin",
  });

  const [lesson] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug: `test-learning-${suffix}`,
    naslov: `Test learning ${suffix}`,
    contentHtml: "",
  }).returning({ id: ilmihalLekcijeTable.id });
  lessonId = lesson.id;

  const [question] = await db.insert(pitanjaBankaTable).values({
    pitanje: `Koji odgovor pripada testnoj lekciji ${suffix}?`,
    opcije: ["Tačan", "Netačan"],
    correctIndex: 0,
    objasnjenje: "Tačan odgovor je objašnjen u testnoj lekciji.",
    vrsta: "single",
    lekcijaId: lessonId,
    seedKey: `ilmihal-learning:${suffix}`,
    urednickiStatus: "na_cekanju",
    meta: {
      didaktickiTip: "razlikovanje",
      retryMode: "immediate",
      retryPrompt: "Ponovo pročitaj testnu lekciju.",
      sourceQuestion: "Koji je tačan odgovor?",
      pilotKey: suffix,
    },
  }).returning({ id: pitanjaBankaTable.id });
  questionId = question.id;

  const [quiz] = await db.insert(kvizoviTable).values({
    slug: `ucimo-${suffix}`,
    naslov: `Učimo ${suffix}`,
    modul: "ilmihal",
    variant: "learning",
    pitanja: [],
    lekcijaId: lessonId,
    isPublished: false,
  }).returning({ id: kvizoviTable.id });
  quizId = quiz.id;
  await db.insert(kvizPitanjaTable).values({ kvizId: quizId, pitanjeId: questionId, redoslijed: 0 });

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
  if (quizId) await db.delete(kvizPitanjaTable).where(eq(kvizPitanjaTable.kvizId, quizId));
  for (const id of extraQuestionIds) {
    await db.delete(pitanjaBankaTable).where(eq(pitanjaBankaTable.id, id));
  }
  if (questionId) await db.delete(pitanjaBankaTable).where(eq(pitanjaBankaTable.id, questionId));
  if (quizId) await db.delete(kvizoviTable).where(eq(kvizoviTable.id, quizId));
  if (lessonId) await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lessonId));
  if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
});

test("learning kviz se ne može objaviti prije uredničkog odobrenja", async () => {
  const publishPending = await adminRequest(`/api/admin/kvizovi/${quizId}`, "PUT", { isPublished: true });
  assert.equal(publishPending.status, 409);

  const publicDetail = await fetch(`${baseUrl}/api/content/kvizovi/ucimo-${suffix}`);
  assert.equal(publicDetail.status, 404);

  const adminDetail = await adminRequest(`/api/content/kvizovi/ucimo-${suffix}`);
  assert.equal(adminDetail.status, 200);
});

test("nakon stručnog odobrenja kviz se može objaviti i javno čitati", async () => {
  const review = await adminRequest(
    `/api/admin/banka-pitanja/${questionId}/urednicki-pregled`,
    "POST",
    { status: "odobreno" },
  );
  assert.equal(review.status, 200);
  const [reviewed] = await db.select({
    reviewedBy: pitanjaBankaTable.reviewedBy,
    reviewedAt: pitanjaBankaTable.reviewedAt,
  }).from(pitanjaBankaTable).where(eq(pitanjaBankaTable.id, questionId));
  assert.equal(reviewed.reviewedBy, adminId);
  assert.ok(reviewed.reviewedAt instanceof Date);

  const publish = await adminRequest(`/api/admin/kvizovi/${quizId}`, "PUT", { isPublished: true });
  assert.equal(publish.status, 200);

  const publicDetail = await fetch(`${baseUrl}/api/content/kvizovi/ucimo-${suffix}`);
  assert.equal(publicDetail.status, 200);
  const detail = await publicDetail.json() as { pitanja: Array<{ sourceQuestion?: string; retryPrompt?: string }> };
  assert.equal(detail.pitanja.length, 1);
  assert.equal(detail.pitanja[0]?.sourceQuestion, "Koji je tačan odgovor?");
  assert.equal(detail.pitanja[0]?.retryPrompt, "Ponovo pročitaj testnu lekciju.");

  const publicList = await fetch(`${baseUrl}/api/content/kvizovi`);
  assert.equal(publicList.status, 200);
  const list = await publicList.json() as Array<{ id: number }>;
  assert.ok(list.some((quiz) => quiz.id === quizId));
});

test("naknadna administratorska izmjena vraća pitanje na čekanje", async () => {
  const update = await adminRequest(`/api/admin/banka-pitanja/${questionId}`, "PUT", {
    pitanje: `Koji odgovor pripada uređenoj testnoj lekciji ${suffix}?`,
    opcije: ["Tačan", "Netačan"],
    correctIndex: 0,
    objasnjenje: "Urednički izmijenjeno objašnjenje.",
    vrsta: "single",
    lekcijaId: lessonId,
    meta: {
      didaktickiTip: "razlikovanje",
      retryMode: "immediate",
      retryPrompt: "Ponovo pročitaj testnu lekciju.",
      sourceQuestion: "Koji je tačan odgovor?",
      pilotKey: suffix,
    },
  });
  assert.equal(update.status, 200);

  const [question] = await db.select({
    status: pitanjaBankaTable.urednickiStatus,
    reviewedAt: pitanjaBankaTable.reviewedAt,
  }).from(pitanjaBankaTable).where(eq(pitanjaBankaTable.id, questionId));
  assert.equal(question.status, "na_cekanju");
  assert.equal(question.reviewedAt, null);

  const hiddenAgain = await fetch(`${baseUrl}/api/content/kvizovi/ucimo-${suffix}`);
  assert.equal(hiddenAgain.status, 404);

  const changeVariant = await adminRequest(`/api/admin/kvizovi/${quizId}`, "PUT", {
    variant: "normal",
    isPublished: false,
  });
  assert.equal(changeVariant.status, 200);
  const bypassPublish = await adminRequest(`/api/admin/kvizovi/${quizId}`, "PUT", { isPublished: true });
  assert.equal(bypassPublish.status, 409);
});

test("ručno kreirano pilot pitanje uvijek počinje na uredničkom čekanju", async () => {
  const response = await adminRequest("/api/admin/banka-pitanja", "POST", {
    pitanje: `Ručno pilot pitanje ${suffix}?`,
    opcije: ["Tačan", "Netačan"],
    correctIndex: 0,
    objasnjenje: "Objašnjenje ručno kreiranog pilot pitanja.",
    vrsta: "single",
    lekcijaId: lessonId,
    meta: {
      didaktickiTip: "prisjecanje",
      retryMode: "immediate",
      retryPrompt: "Prisjeti se lekcije i pokušaj ponovo.",
      sourceQuestion: "Izvorno ručno pitanje?",
      pilotKey: `manual-${suffix}`,
    },
  });
  assert.equal(response.status, 201);
  const created = await response.json() as {
    id: number;
    urednickiStatus: string;
    reviewedBy: number | null;
    reviewedAt: string | null;
  };
  extraQuestionIds.push(created.id);
  assert.equal(created.urednickiStatus, "na_cekanju");
  assert.equal(created.reviewedBy, null);
  assert.equal(created.reviewedAt, null);
});