import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  h5pPokusajiTable,
  prilozi,
  studentProgressTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { H5P_CORRECT_RETRY_LOCK_MS } from "../lib/h5p-rules.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `h5p-${Date.now()}`;
const fixturePath = fileURLToPath(new URL(
  "../../../../attached_assets/Jacija-namaz_1779307241332.h5p",
  import.meta.url,
));

let server: Server;
let baseUrl: string;
let studentId: number;
let priloziId: number;
let token: string;

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();

  const fixture = new AdmZip(await readFile(fixturePath));
  const manifest = JSON.parse(fixture.readAsText(fixture.getEntry("h5p.json")!)) as {
    mainLibrary: string;
    preloadedDependencies: { machineName: string }[];
  };
  assert.equal(manifest.mainLibrary, "H5P.QuestionSet");
  assert.ok(
    manifest.preloadedDependencies.some((dependency) => dependency.machineName === "H5P.MultiChoice"),
    "fixture mora sadržati podržani Multiple Choice dependency",
  );
  assert.ok(fixture.getEntry("content/content.json"), "fixture mora sadržati content.json");

  const [student] = await db.insert(usersTable).values({
    username: `${SUFFIX}.student`,
    displayName: `H5P student ${SUFFIX}`,
    passwordHash: "x",
    role: "ucenik",
    isActive: true,
  }).returning({ id: usersTable.id });
  studentId = student.id;
  token = signToken({
    userId: studentId,
    username: `${SUFFIX}.student`,
    role: "ucenik",
    displayName: `H5P student ${SUFFIX}`,
  });

  const [attachment] = await db.insert(prilozi).values({
    lekcijaId: 1,
    originalName: "Jacija-namaz.h5p",
    storedName: `fixtures/${SUFFIX}`,
    fileSize: (await readFile(fixturePath)).byteLength,
    mimeType: "application/zip",
    kind: "h5p",
    approved: true,
  }).returning({ id: prilozi.id });
  priloziId = attachment.id;

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
    await db.delete(h5pPokusajiTable).where(eq(h5pPokusajiTable.userId, studentId));
    await db.delete(studentProgressTable).where(eq(studentProgressTable.studentId, String(studentId)));
    await db.delete(usersTable).where(eq(usersTable.id, studentId));
  }
  if (priloziId) {
    await db.delete(prilozi).where(eq(prilozi.id, priloziId));
  }
});

function result(score = 1, maxScore = 1) {
  return fetch(`${baseUrl}/api/h5p/result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ priloziId, score, maxScore }),
  });
}

function attempts() {
  return fetch(`${baseUrl}/api/h5p/attempts/${priloziId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test("isti stvarni H5P paket radi prije, tokom i nakon 48-satne blokade", async () => {
  const first = await result();
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { attemptNo: number; hasanatGained: number };
  assert.equal(firstBody.attemptNo, 1);
  assert.equal(firstBody.hasanatGained, 5);

  const [savedFirst] = await db.select({ completedAt: h5pPokusajiTable.completedAt })
    .from(h5pPokusajiTable)
    .where(and(
      eq(h5pPokusajiTable.userId, studentId),
      eq(h5pPokusajiTable.priloziId, priloziId),
      eq(h5pPokusajiTable.attemptNo, 1),
    ));
  assert.ok(savedFirst);
  const expectedLockedUntil = new Date(
    savedFirst.completedAt.getTime() + H5P_CORRECT_RETRY_LOCK_MS,
  ).toISOString();

  const immediateRetry = await result();
  assert.equal(immediateRetry.status, 423);
  assert.deepEqual(await immediateRetry.json(), {
    error: "Vježba je zaključana 48 sati nakon tačno riješenog pokušaja",
    lockedUntil: expectedLockedUntil,
  });

  const lockedState = await attempts();
  assert.equal(lockedState.status, 200);
  const lockedBody = await lockedState.json() as {
    attempts: { attemptNo: number }[];
    lockedUntil: string | null;
    isLocked: boolean;
  };
  assert.equal(lockedBody.attempts.length, 1);
  assert.equal(lockedBody.lockedUntil, expectedLockedUntil);
  assert.equal(lockedBody.isLocked, true);

  await db.update(h5pPokusajiTable).set({
    completedAt: new Date(Date.now() - H5P_CORRECT_RETRY_LOCK_MS - 1),
  }).where(and(
    eq(h5pPokusajiTable.userId, studentId),
    eq(h5pPokusajiTable.priloziId, priloziId),
    eq(h5pPokusajiTable.attemptNo, 1),
  ));

  const afterExpiry = await attempts();
  assert.equal(afterExpiry.status, 200);
  const availableBody = await afterExpiry.json() as {
    nextAttemptNo: number;
    lockedUntil: string | null;
    isLocked: boolean;
  };
  assert.equal(availableBody.nextAttemptNo, 2);
  assert.equal(availableBody.lockedUntil, null);
  assert.equal(availableBody.isLocked, false);

  const reopened = await result();
  assert.equal(reopened.status, 200);
  const reopenedBody = await reopened.json() as { attemptNo: number; hasanatGained: number };
  assert.equal(reopenedBody.attemptNo, 2);
  assert.equal(reopenedBody.hasanatGained, 3);
});