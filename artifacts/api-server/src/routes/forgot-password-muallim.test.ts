import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { mektebiTable, muallimProfiliTable, passwordResetTokensTable, usersTable } from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `recover-muallim-${Date.now()}`;
const headEmail = `head.${suffix}@example.test`;
const teacherEmail = `teacher.${suffix}@example.test`;
let server: Server;
let baseUrl: string;
let mektebId: number;
let headId: number;
let teacherId: number;
let headToken: string;

before(async () => {
  // Nikad ne šalji testni reset link stvarnom SMTP serveru.
  if (process.env.SMTP_HOST || process.env.SMTP_USER || process.env.SMTP_PASS) {
    throw new Error("Pokrenite test s isključenim SMTP varijablama");
  }
  const [mekteb] = await db.insert(mektebiTable).values({ naziv: suffix }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  for (const [name, email, isGlavni] of [["head", headEmail, true], ["teacher", null, false]] as const) {
    const [user] = await db.insert(usersTable).values({
      username: `${name}.${suffix}`,
      displayName: name,
      email,
      passwordHash: "unchanged-hash",
      role: "muallim",
      isActive: true,
      termsAcceptedAt: new Date(),
      privacyAcknowledgedAt: new Date(),
      administratorDeclarationAcceptedAt: new Date(),
    }).returning({ id: usersTable.id });
    await db.insert(muallimProfiliTable).values({ userId: user.id, mektebId, isGlavni });
    if (isGlavni) {
      headId = user.id;
      headToken = signToken({ userId: user.id, username: `${name}.${suffix}`, role: "muallim", displayName: name });
    } else {
      teacherId = user.id;
    }
  }
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>(resolve => server?.close(() => resolve()));
  if (teacherId) await db.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, teacherId));
  const ids = [headId, teacherId].filter(Boolean);
  if (ids.length) {
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
});

test("muallim može dobiti email za oporavak, a neuspjelo slanje se ne prikazuje kao uspjeh", async () => {
  const change = (email: string) => fetch(`${baseUrl}/api/muallim/mekteb/muallimi/${teacherId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${headToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal((await change(headEmail)).status, 409);
  const updated = await change(teacherEmail.toUpperCase());
  assert.equal(updated.status, 200, await updated.clone().text());
  const [teacher] = await db.select({ email: usersTable.email, passwordHash: usersTable.passwordHash })
    .from(usersTable).where(eq(usersTable.id, teacherId));
  assert.equal(teacher.email, teacherEmail);
  assert.equal(teacher.passwordHash, "unchanged-hash");

  const recover = (email: string) => fetch(`${baseUrl}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  assert.equal((await recover(`unknown.${suffix}@example.test`)).status, 200);
  const failed = await recover(teacherEmail);
  assert.equal(failed.status, 503, await failed.clone().text());
  assert.match((await failed.json() as { error: string }).error, /Nije moguće poslati email/);
  assert.deepEqual(await db.select({ id: passwordResetTokensTable.id }).from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.userId, teacherId)), []);
});