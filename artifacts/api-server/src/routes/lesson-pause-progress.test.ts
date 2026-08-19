import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ilmihalLekcijeTable,
  lessonPauseAnswersTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import {
  bootstrapDrizzleMigrations,
  runDrizzleMigrate,
} from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `pause-${Date.now()}`;
const FIRST_ID = `first-${SUFFIX}`;
const SECOND_ID = `second-${SUFFIX}`;
const ORDER_ID = `order-${SUFFIX}`;

let server: Server;
let baseUrl: string;
let lekcijaId: number;
let slug: string;
let prviUcenikId: number;
let drugiUcenikId: number;
let prviToken: string;
let drugiToken: string;

function pauseHtml(configs: Record<string, unknown>[]): string {
  return configs.map((config) =>
    `<div data-lesson-pause="1" data-pause-config="${encodeURIComponent(JSON.stringify(config))}"></div>`,
  ).join("");
}

function firstConfig(question = "Ko je učenik's prvi izbor?") {
  return {
    id: FIRST_ID,
    type: "multiple-choice",
    question,
    options: ["Prvi", "Drugi"],
    correctOption: 1,
    correctExplanation: "Tačno.",
    wrongExplanation: "Pokušaj ponovo.",
  };
}

function orderConfig() {
  return {
    id: ORDER_ID,
    type: "ordering",
    question: "Poredaj",
    items: ["prvo", "drugo", "treće"],
    correctExplanation: "Tačno.",
    wrongExplanation: "Pokušaj ponovo.",
  };
}

function secondConfig() {
  return {
    id: SECOND_ID,
    type: "yes-no",
    question: "Drugo pitanje?",
    correctAnswer: true,
    correctExplanation: "Tačno.",
    wrongExplanation: "Pokušaj ponovo.",
  };
}

function configFingerprint(config: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex");
}

async function createStudent(label: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "x",
    role: "ucenik",
    isActive: true,
  }).returning({ id: usersTable.id });
  return user.id;
}

function studentToken(userId: number, label: string) {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role: "ucenik",
    displayName: `${label} ${SUFFIX}`,
  });
}

function savePause(
  token: string,
  pauseId: string,
  body: Record<string, unknown>,
  expectedRevision: number,
  fingerprint = pauseId === FIRST_ID
    ? configFingerprint(firstConfig())
    : pauseId === SECOND_ID
      ? configFingerprint(secondConfig())
      : configFingerprint(orderConfig()),
) {
  return fetch(`${baseUrl}/api/content/ilmihal/${lekcijaId}/pauze/${encodeURIComponent(pauseId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, expectedRevision, configFingerprint: fingerprint }),
  });
}

function loadLesson(token?: string) {
  return fetch(`${baseUrl}/api/content/ilmihal/${slug}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();

  prviUcenikId = await createStudent("prvi");
  drugiUcenikId = await createStudent("drugi");
  prviToken = studentToken(prviUcenikId, "prvi");
  drugiToken = studentToken(drugiUcenikId, "drugi");
  slug = `lesson-${SUFFIX}`;

  const [lesson] = await db.insert(ilmihalLekcijeTable).values({
    nivo: 1,
    slug,
    naslov: `Pauze ${SUFFIX}`,
    redoslijed: 1,
    contentHtml: pauseHtml([firstConfig(), secondConfig(), orderConfig()]),
  }).returning({ id: ilmihalLekcijeTable.id });
  lekcijaId = lesson.id;

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
  const userIds = [prviUcenikId, drugiUcenikId].filter(Boolean);
  if (userIds.length) {
    await db.delete(lessonPauseAnswersTable).where(inArray(lessonPauseAnswersTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (lekcijaId) {
    await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lekcijaId));
  }
});

test("sprema i ponovno učitava odgovor samo za prijavljenog učenika", async () => {
  const saved = await savePause(prviToken, FIRST_ID, { answer: 1, submitted: true }, 0);
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), {
    pauseId: FIRST_ID,
    answer: 1,
    submitted: true,
    correct: true,
    revision: 1,
  });

  const loaded = await loadLesson(prviToken);
  assert.equal(loaded.status, 200);
  const firstBody = await loaded.json() as { pauseAnswers?: Record<string, unknown> };
  assert.deepEqual(firstBody.pauseAnswers?.[FIRST_ID], {
    answer: 1,
    submitted: true,
    correct: true,
    revision: 1,
  });

  const otherLoaded = await loadLesson(drugiToken);
  const otherBody = await otherLoaded.json() as { pauseAnswers?: Record<string, unknown> };
  assert.deepEqual(otherBody.pauseAnswers, {});

  const guestLoaded = await loadLesson();
  const guestBody = await guestLoaded.json() as { pauseAnswers?: unknown };
  assert.equal(guestBody.pauseAnswers, undefined);
  const guestWrite = await savePause("", FIRST_ID, { answer: 0, submitted: true }, 0);
  assert.equal(guestWrite.status, 401);
});

test("ponovni upis ažurira isti red umjesto stvaranja duplikata", async () => {
  const response = await savePause(prviToken, FIRST_ID, { answer: 0, submitted: true }, 1);
  assert.equal(response.status, 200);
  const rows = await db.select({ value: count() }).from(lessonPauseAnswersTable).where(and(
    eq(lessonPauseAnswersTable.userId, prviUcenikId),
    eq(lessonPauseAnswersTable.lekcijaId, lekcijaId),
    eq(lessonPauseAnswersTable.pauseId, FIRST_ID),
  ));
  assert.equal(Number(rows[0]?.value), 1);
});

test("odbija nevažeće odgovore i zastarjele konkurentne upise", async () => {
  assert.equal(
    (await savePause(prviToken, FIRST_ID, { answer: 99, submitted: true }, 2)).status,
    400,
  );
  assert.equal(
    (await savePause(prviToken, ORDER_ID, { answer: ["prvo", "nepostojeće"], submitted: false }, 0)).status,
    400,
  );

  const concurrent = await Promise.all([
    savePause(prviToken, SECOND_ID, { answer: true, submitted: true }, 0),
    savePause(prviToken, SECOND_ID, { answer: false, submitted: true }, 0),
  ]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);

  const winningResponse = concurrent.find((response) => response.status === 200)!;
  const winner = await winningResponse.json() as { answer: boolean; revision: number };
  assert.equal(winner.revision, 1);

  const loaded = await loadLesson(prviToken);
  const body = await loaded.json() as {
    pauseAnswers: Record<string, { answer: boolean; revision: number }>;
  };
  assert.equal(body.pauseAnswers[SECOND_ID].answer, winner.answer);
  assert.equal(body.pauseAnswers[SECOND_ID].revision, 1);
});

test("izmjena ili brisanje jedne pauze ne kvari napredak druge", async () => {
  assert.equal((await savePause(prviToken, FIRST_ID, { answer: 1, submitted: true }, 2)).status, 200);
  assert.equal((await savePause(prviToken, SECOND_ID, { answer: true, submitted: true }, 1)).status, 200);

  await db.update(ilmihalLekcijeTable).set({
    contentHtml: pauseHtml([firstConfig("Izmijenjeno prvo pitanje?"), secondConfig()]),
  }).where(eq(ilmihalLekcijeTable.id, lekcijaId));

  const staleWrite = await savePause(
    prviToken,
    FIRST_ID,
    { answer: 1, submitted: true },
    3,
    configFingerprint(firstConfig()),
  );
  assert.equal(staleWrite.status, 409);
  const staleBody = await staleWrite.json() as { configurationChanged?: boolean };
  assert.equal(staleBody.configurationChanged, true);

  const changed = await loadLesson(prviToken);
  const changedBody = await changed.json() as { pauseAnswers: Record<string, unknown> };
  assert.equal(changedBody.pauseAnswers[FIRST_ID], undefined);
  assert.deepEqual(changedBody.pauseAnswers[SECOND_ID], {
    answer: true,
    submitted: true,
    correct: true,
    revision: 2,
  });

  await db.update(ilmihalLekcijeTable).set({
    contentHtml: pauseHtml([secondConfig()]),
  }).where(eq(ilmihalLekcijeTable.id, lekcijaId));
  assert.equal((await savePause(prviToken, FIRST_ID, { answer: 1, submitted: true }, 3)).status, 400);

  const afterDelete = await loadLesson(prviToken);
  const afterDeleteBody = await afterDelete.json() as { pauseAnswers: Record<string, unknown> };
  assert.equal(afterDeleteBody.pauseAnswers[FIRST_ID], undefined);
  assert.deepEqual(afterDeleteBody.pauseAnswers[SECOND_ID], {
    answer: true,
    submitted: true,
    correct: true,
    revision: 2,
  });
});