import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  exerciseSessionsTable,
  studentProgressTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import {
  bootstrapDrizzleMigrations,
  runDrizzleMigrate,
} from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `progress-access-${Date.now()}`;
const LESSON_ID = 900_000_000 + (Date.now() % 1_000_000);

let server: Server;
let baseUrl: string;
let prviUcenikId: number;
let drugiUcenikId: number;
let muallimId: number;
let adminId: number;
let prviToken: string;
let drugiToken: string;
let muallimToken: string;
let adminToken: string;

async function createUser(role: "ucenik" | "muallim" | "admin", label: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${SUFFIX}`,
    displayName: `${label} ${SUFFIX}`,
    passwordHash: "x",
    role,
    isActive: true,
  }).returning({ id: usersTable.id });
  return user.id;
}

function tokenFor(userId: number, role: "ucenik" | "muallim" | "admin", label: string) {
  return signToken({
    userId,
    username: `${label}.${SUFFIX}`,
    role,
    displayName: `${label} ${SUFFIX}`,
  });
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();

  prviUcenikId = await createUser("ucenik", "prvi-ucenik");
  drugiUcenikId = await createUser("ucenik", "drugi-ucenik");
  muallimId = await createUser("muallim", "muallim");
  adminId = await createUser("admin", "admin");
  prviToken = tokenFor(prviUcenikId, "ucenik", "prvi-ucenik");
  drugiToken = tokenFor(drugiUcenikId, "ucenik", "drugi-ucenik");
  muallimToken = tokenFor(muallimId, "muallim", "muallim");
  adminToken = tokenFor(adminId, "admin", "admin");

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
  const userIds = [prviUcenikId, drugiUcenikId, muallimId, adminId].filter(Boolean);
  if (userIds.length) {
    const studentIds = userIds.map(String);
    await db.delete(exerciseSessionsTable).where(inArray(exerciseSessionsTable.studentId, studentIds));
    await db.delete(studentProgressTable).where(inArray(studentProgressTable.studentId, studentIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
});

test("progress routes require an authenticated student", async () => {
  assert.equal((await fetch(`${baseUrl}/api/progress`)).status, 401);
  assert.equal(
    (await fetch(`${baseUrl}/api/progress`, { headers: auth(muallimToken) })).status,
    403,
  );
});

test("student progress guard does not block admin or muallim routes", async () => {
  assert.equal(
    (await fetch(`${baseUrl}/api/admin/korisnici`, { headers: auth(adminToken) })).status,
    200,
  );
  assert.notEqual(
    (await fetch(`${baseUrl}/api/muallim/grupe`, { headers: auth(muallimToken) })).status,
    403,
  );
});

test("query and body studentId cannot read or write another student's progress", async () => {
  const read = await fetch(
    `${baseUrl}/api/progress?studentId=${encodeURIComponent(String(drugiUcenikId))}`,
    { headers: auth(prviToken) },
  );
  assert.equal(read.status, 200);
  const ownProgress = await read.json() as { studentId: string; totalHasanat: number };
  assert.equal(ownProgress.studentId, String(prviUcenikId));
  assert.equal(ownProgress.totalHasanat, 0);

  const saved = await fetch(`${baseUrl}/api/progress/lesson`, {
    method: "POST",
    headers: auth(prviToken),
    body: JSON.stringify({ studentId: String(drugiUcenikId), lessonId: LESSON_ID }),
  });
  assert.equal(saved.status, 200);
  const savedBody = await saved.json() as { studentId: string; totalHasanat: number };
  assert.equal(savedBody.studentId, String(prviUcenikId));
  // 30 za prvu lekciju + 50 za prvi osvojeni bedž.
  assert.equal(savedBody.totalHasanat, 80);

  const otherProgress = await db
    .select()
    .from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, String(drugiUcenikId)));
  assert.equal(otherProgress.length, 0);
});

test("parallel repeats of one lesson award hasanat only once", async () => {
  const [first, repeat] = await Promise.all([
    fetch(`${baseUrl}/api/progress/lesson`, {
      method: "POST",
      headers: auth(prviToken),
      body: JSON.stringify({ lessonId: LESSON_ID + 1 }),
    }),
    fetch(`${baseUrl}/api/progress/lesson`, {
      method: "POST",
      headers: auth(prviToken),
      body: JSON.stringify({ lessonId: LESSON_ID + 1 }),
    }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(repeat.status, 200);

  const progress = await db
    .select()
    .from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, String(prviUcenikId)))
    .limit(1);
  // Prva lekcija: 30 + prvi bedž 50. Druga lekcija: 30 + bedž za 100 kapi 50.
  // Paralelni ponovljeni pozivi druge lekcije ne smiju dodati ništa više.
  assert.equal(progress[0]?.totalHasanat, 160);
  assert.equal(
    (progress[0]?.completedLessons as number[]).filter((id) => id === LESSON_ID + 1).length,
    1,
  );
});

test("exercise sessions ignore a spoofed studentId", async () => {
  const response = await fetch(`${baseUrl}/api/exercises/session`, {
    method: "POST",
    headers: auth(drugiToken),
    body: JSON.stringify({
      studentId: String(prviUcenikId),
      lessonId: LESSON_ID,
      exerciseType: "memory",
      correctAnswers: 3,
      totalQuestions: 3,
      timeSpentSeconds: 15,
    }),
  });
  assert.equal(response.status, 200);

  const sessions = await db
    .select()
    .from(exerciseSessionsTable)
    .where(eq(exerciseSessionsTable.lessonId, LESSON_ID));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.studentId, String(drugiUcenikId));
});