import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  muallimProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `delete-parent-${Date.now()}`;

let server: Server;
let baseUrl: string;
let ownerId: number;
let otherMuallimId: number;
let studentId: number;
let secondStudentId: number;
let deletableParentId: number;
let foreignParentId: number;
let sharedParentId: number;
let ownerToken: string;

async function createUser(role: "muallim" | "ucenik" | "roditelj", label: string) {
  const [user] = await db
    .insert(usersTable)
    .values({
      username: `${label}.${SUFFIX}`,
      displayName: `${label} ${SUFFIX}`,
      passwordHash: "x",
      role,
      isActive: true,
    })
    .returning({ id: usersTable.id });
  return user.id;
}

function ownerDelete(path: string) {
  return fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
}

before(async () => {
  ownerId = await createUser("muallim", "owner");
  otherMuallimId = await createUser("muallim", "other");
  studentId = await createUser("ucenik", "student");
  secondStudentId = await createUser("ucenik", "student-two");
  deletableParentId = await createUser("roditelj", "deletable");
  foreignParentId = await createUser("roditelj", "foreign");
  sharedParentId = await createUser("roditelj", "shared");

  await db.insert(muallimProfiliTable).values([
    { userId: ownerId },
    { userId: otherMuallimId },
  ]);
  await db.insert(ucenikProfiliTable).values([
    { userId: studentId, muallimId: ownerId },
    { userId: secondStudentId, muallimId: ownerId },
  ]);
  await db.insert(roditeljProfiliTable).values([
    { userId: deletableParentId },
    { userId: foreignParentId },
    { userId: sharedParentId },
  ]);
  await db.insert(roditeljUcenikTable).values([
    {
      roditeljId: deletableParentId,
      ucenikId: studentId,
      status: "approved",
      approvedAt: new Date(),
      approvedBy: ownerId,
    },
    {
      roditeljId: foreignParentId,
      ucenikId: studentId,
      status: "rejected",
      approvedAt: new Date(),
      approvedBy: otherMuallimId,
    },
    {
      roditeljId: sharedParentId,
      ucenikId: studentId,
      status: "rejected",
      approvedAt: new Date(),
      approvedBy: ownerId,
    },
    {
      roditeljId: sharedParentId,
      ucenikId: secondStudentId,
      status: "approved",
      approvedAt: new Date(),
      approvedBy: ownerId,
    },
  ]);

  ownerToken = signToken({
    userId: ownerId,
    username: `owner.${SUFFIX}`,
    role: "muallim",
    displayName: `owner ${SUFFIX}`,
  });

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
  const ids = [
    ownerId,
    otherMuallimId,
    studentId,
    secondStudentId,
    deletableParentId,
    foreignParentId,
    sharedParentId,
  ].filter(Boolean);
  await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.roditeljId, ids));
  await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, ids));
  await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, ids));
  await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, ids));
  await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, ids));
  await db.delete(usersTable).where(inArray(usersTable.id, ids));
});

test("lista označava samo račun koji muallim smije trajno izbrisati", async () => {
  const response = await fetch(`${baseUrl}/api/muallim/ucenici/${studentId}/roditelji`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(response.status, 200);
  const parents = await response.json() as Array<{ id: number; canDeleteAccount: boolean }>;

  assert.equal(parents.find((parent) => parent.id === deletableParentId)?.canDeleteAccount, true);
  assert.equal(parents.find((parent) => parent.id === foreignParentId)?.canDeleteAccount, false);
  assert.equal(parents.find((parent) => parent.id === sharedParentId)?.canDeleteAccount, false);
});

test("ne može izbrisati račun koji je dodao drugi muallim", async () => {
  const response = await ownerDelete(
    `/api/muallim/ucenici/${studentId}/roditelji/${foreignParentId}/nalog`,
  );
  assert.equal(response.status, 403);

  const [parent] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, foreignParentId));
  assert.equal(parent.id, foreignParentId);
});

test("ne može izbrisati račun povezan s drugim djetetom", async () => {
  const response = await ownerDelete(
    `/api/muallim/ucenici/${studentId}/roditelji/${sharedParentId}/nalog`,
  );
  assert.equal(response.status, 409);

  const [parent] = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, sharedParentId));
  assert.equal(parent.id, sharedParentId);
});

test("briše račun koji je muallim dodao samo ovom učeniku", async () => {
  const response = await ownerDelete(
    `/api/muallim/ucenici/${studentId}/roditelji/${deletableParentId}/nalog`,
  );
  assert.equal(response.status, 200);

  const [users, profiles, links] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, deletableParentId)),
    db.select({ id: roditeljProfiliTable.userId })
      .from(roditeljProfiliTable)
      .where(eq(roditeljProfiliTable.userId, deletableParentId)),
    db.select({ id: roditeljUcenikTable.id })
      .from(roditeljUcenikTable)
      .where(eq(roditeljUcenikTable.roditeljId, deletableParentId)),
  ]);
  assert.equal(users.length, 0);
  assert.equal(profiles.length, 0);
  assert.equal(links.length, 0);
});