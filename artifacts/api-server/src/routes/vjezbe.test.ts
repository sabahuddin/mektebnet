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

function submit(key = "etapa-lekcije-1-10", score = 17, maxScore = 17) {
  return fetch(`${baseUrl}/api/vjezbe/${key}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ score, maxScore }),
  });
}

test("statička vježba daje 5, zatim 3, pa 0 kapi meda", async () => {
  for (const [index, expected] of [5, 3, 0].entries()) {
    const response = await submit();
    assert.equal(response.status, 200);
    const body = await response.json() as { attemptNo: number; hasanatGained: number; totalHasanat: number };
    assert.equal(body.attemptNo, index + 1);
    assert.equal(body.hasanatGained, expected);
    assert.equal(body.totalHasanat, index === 0 ? 5 : 8);
  }
});

test("nepoznata ili nedovršena vježba ne može dodijeliti nagradu", async () => {
  assert.equal((await submit("ne-postoji")).status, 404);
  assert.equal((await submit("etapa-lekcije-1-10", 16, 17)).status, 400);
  assert.equal((await submit("etapa-lekcije-1-10", 17, 18)).status, 400);
});