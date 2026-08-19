import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  kvizoviTable,
  kvizPitanjaTable,
  pitanjaBankaTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import {
  bootstrapDrizzleMigrations,
  runDrizzleMigrate,
} from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `review-${Date.now()}`;
let server: Server | undefined;
let baseUrl: string;
let adminId: number;
let adminToken: string;
let lessonId: number;
let quizId: number;
let questionId: number;

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

async function cleanupTestData(): Promise<void> {
  const errors: Error[] = [];
  const cleanupStep = async (label: string, operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      errors.push(new Error(`Cleanup nije uspio za ${label}`, { cause: error }));
    }
  };

  // Stabilne testne oznake pokrivaju i redove koje je prekinuto pokretanje
  // upisalo prije nego što je test stigao sačuvati njihove ID-jeve.
  await cleanupStep("veze kviz-pitanje", () => db.execute(sql`
    DELETE FROM kviz_pitanja
    WHERE kviz_id IN (
      SELECT id FROM kvizovi WHERE slug LIKE 'ucimo-review-%'
    )
    OR pitanje_id IN (
      SELECT id
      FROM pitanja_banka
      WHERE seed_key LIKE 'ilmihal-learning:review-%'
        OR meta ->> 'pilotKey' LIKE 'review-%'
        OR meta ->> 'pilotKey' LIKE 'manual-review-%'
    )
  `));
  await cleanupStep("testna pitanja", () => db.execute(sql`
    DELETE FROM pitanja_banka
    WHERE seed_key LIKE 'ilmihal-learning:review-%'
      OR meta ->> 'pilotKey' LIKE 'review-%'
      OR meta ->> 'pilotKey' LIKE 'manual-review-%'
  `));
  await cleanupStep("testne kvizove", () => db.execute(sql`
    DELETE FROM kvizovi WHERE slug LIKE 'ucimo-review-%'
  `));
  await cleanupStep("testne lekcije", () => db.execute(sql`
    DELETE FROM ilmihal_lekcije WHERE slug LIKE 'test-learning-review-%'
  `));
  await cleanupStep("testne administratore", () => db.execute(sql`
    DELETE FROM users WHERE username LIKE 'admin.review-%'
  `));

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      "Čišćenje Ilmihal learning review testnih podataka nije uspjelo",
    );
  }
}

before(async () => {
  // Route testovi ne pokreću executable index.ts, pa migracija mora završiti
  // prije prvog fixture upisa. Neuspjeh tako prekida setup bez testne lekcije.
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  await cleanupTestData();

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
      const address = server?.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  let closeError: Error | undefined;
  if (server) {
    try {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => error ? reject(error) : resolve());
      });
    } catch (error) {
      closeError = new Error(
        "Gašenje testnog API servera nije uspjelo",
        { cause: error },
      );
    }
  }

  // Čišćenje baze mora se izvršiti čak i ako gašenje servera prijavi grešku.
  await cleanupTestData();
  if (closeError) throw closeError;
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
  assert.equal(created.urednickiStatus, "na_cekanju");
  assert.equal(created.reviewedBy, null);
  assert.equal(created.reviewedAt, null);
});