import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { db, staticVjezbaPokusajiTable, studentProgressTable, usersTable } from "@workspace/db";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `static-vjezba-${Date.now()}`;
let server: Server;
let baseUrl = "";
let studentId = 0;
let token = "";

before(async () => {
  const [student] = await db.insert(usersTable).values({
    username: `${suffix}.student`,
    displayName: `Static vježba ${suffix}`,
    passwordHash: "x",
    role: "ucenik",
    isActive: true,
  }).returning({ id: usersTable.id });
  studentId = student.id;
  token = signToken({
    userId: studentId,
    username: `${suffix}.student`,
    displayName: `Static vježba ${suffix}`,
    role: "ucenik",
  });
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
  if (studentId) {
    await db.delete(staticVjezbaPokusajiTable).where(eq(staticVjezbaPokusajiTable.userId, studentId));
    await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(studentId)));
    await db.delete(usersTable).where(eq(usersTable.id, studentId));
  }
});

function submit(key = "etapa-lekcije-1-10", score = 23, maxScore = 23) {
  return fetch(`${baseUrl}/api/vjezbe/${key}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ score, maxScore }),
  });
}

test("legacy vježba 11–20 dobija ograničeni CSP izuzetak za svoj renderer", async () => {
  const legacy = await fetch(`${baseUrl}/api/vjezbe/etapa-lekcije-11-20/content`);
  assert.equal(legacy.status, 200);
  assert.match(await legacy.text(), /mekteb-reorder-shuffle/);
  assert.match(legacy.headers.get("content-security-policy") ?? "", /script-src[^;]*'unsafe-eval'/);
  assert.match(legacy.headers.get("content-security-policy") ?? "", /sandbox allow-scripts/);

  const standard = await fetch(`${baseUrl}/api/vjezbe/etapa-lekcije-1-10/content`);
  assert.equal(standard.status, 200);
  assert.match(await standard.text(), /mekteb-reorder-shuffle/);
  assert.doesNotMatch(standard.headers.get("content-security-policy") ?? "", /'unsafe-eval'/);
});

test("statička vježba daje 50, zatim 20, pa 0 kapi meda", async () => {
  for (const [index, expected] of [50, 20, 0].entries()) {
    const response = await submit();
    assert.equal(response.status, 200);
    const body = await response.json() as { attemptNo: number; hasanatGained: number; totalHasanat: number };
    assert.equal(body.attemptNo, index + 1);
    assert.equal(body.hasanatGained, expected);
    assert.equal(body.totalHasanat, index === 0 ? 50 : 70);
  }
});

test("nepoznata ili nedovršena vježba ne može dodijeliti nagradu", async () => {
  assert.equal((await submit("ne-postoji")).status, 404);
  assert.equal((await submit("etapa-lekcije-1-10", 22, 23)).status, 400);
  assert.equal((await submit("etapa-lekcije-1-10", 23, 24)).status, 400);
});

test("vježba za lekcije 11–20 koristi isti generički sistem", async () => {
  const response = await submit("etapa-lekcije-11-20", 24, 24);
  assert.equal(response.status, 200);
  const body = await response.json() as { attemptNo: number; hasanatGained: number; maxScore: number };
  assert.equal(body.attemptNo, 1);
  assert.equal(body.hasanatGained, 50);
  assert.equal(body.maxScore, 24);
});

test("vježbe za lekcije 21–63 koriste isti generički sistem", async () => {
  for (const key of [
    "etapa-lekcije-21-30",
    "etapa-lekcije-31-40",
    "etapa-lekcije-41-50",
    "etapa-lekcije-51-63",
  ]) {
    const response = await submit(key, 30, 30);
    assert.equal(response.status, 200);
    const body = await response.json() as { attemptNo: number; hasanatGained: number; maxScore: number };
    assert.equal(body.attemptNo, 1);
    assert.equal(body.hasanatGained, 50);
    assert.equal(body.maxScore, 30);
  }
});

test("vježbe nivoa 2 koriste isti generički sistem sa 28 zadataka", async () => {
  for (const key of [
    "etapa-nivo2-lekcije-1-10",
    "etapa-nivo2-lekcije-11-20",
    "etapa-nivo2-lekcije-21-30",
    "etapa-nivo2-lekcije-31-40",
    "etapa-nivo2-lekcije-41-50",
    "etapa-nivo2-lekcije-51-60",
    "etapa-nivo2-lekcije-61-68",
  ]) {
    const response = await submit(key, 28, 28);
    assert.equal(response.status, 200);
    const body = await response.json() as { attemptNo: number; hasanatGained: number; score: number; maxScore: number };
    assert.equal(body.attemptNo, 1);
    assert.equal(body.hasanatGained, 50);
    assert.equal(body.score, 28);
    assert.equal(body.maxScore, 28);
  }
});

test("vježbe nivoa 3 koriste isti generički sistem sa 28 zadataka", async () => {
  for (const key of [
    "etapa-nivo3-lekcije-1-10",
    "etapa-nivo3-lekcije-11-20",
    "etapa-nivo3-lekcije-21-30",
    "etapa-nivo3-lekcije-31-40",
    "etapa-nivo3-lekcije-41-50",
    "etapa-nivo3-lekcije-51-60",
    "etapa-nivo3-lekcije-61-70",
    "etapa-nivo3-lekcije-71-80",
    "etapa-nivo3-lekcije-81-90",
    "etapa-nivo3-lekcije-91-100",
  ]) {
    const response = await submit(key, 28, 28);
    assert.equal(response.status, 200);
    const body = await response.json() as { attemptNo: number; hasanatGained: number; score: number; maxScore: number };
    assert.equal(body.attemptNo, 1);
    assert.equal(body.hasanatGained, 50);
    assert.equal(body.score, 28);
    assert.equal(body.maxScore, 28);
  }
});