import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  mektebiTable,
  muallimProfiliTable,
  podgrupeTable,
  podgrupeUceniciTable,
  ucenikProfiliTable,
  usersTable,
  zadaceTable,
  zadaceUceniciTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `podgrupe-${Date.now()}`;
let server: Server;
let baseUrl: string;
let mektebId: number;
let grupaId: number;
let muallimId: number;
let firstStudentId: number;
let secondStudentId: number;
const homeworkIds: number[] = [];
const tokens: Record<string, string> = {};
const studentTokens: Record<number, string> = {};
const userIds: number[] = [];

async function createUser(username: string, role: "muallim" | "ucenik") {
  const [user] = await db.insert(usersTable).values({
    username: `${username}.${suffix}`,
    displayName: username,
    passwordHash: "test-hash",
    role,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    ...(role === "muallim" ? { administratorDeclarationAcceptedAt: new Date() } : {}),
  }).returning({ id: usersTable.id });
  userIds.push(user.id);
  return user.id;
}

async function request(path: string, method: string, body?: unknown) {
  return fetch(`${baseUrl}/api/muallim${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokens.teacher}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function studentRequest(path: string, studentId: number) {
  return fetch(`${baseUrl}/api/ucenik${path}`, {
    headers: { Authorization: `Bearer ${studentTokens[studentId]}` },
  });
}

before(async () => {
  // Route tests import the app directly, so apply the same idempotent column
  // needed by the API's residual-schema startup migration.
  await db.execute(sql`ALTER TABLE zadace ADD COLUMN IF NOT EXISTS podgrupa_id integer`);
  await db.execute(sql`ALTER TABLE zadace ADD COLUMN IF NOT EXISTS is_targeted boolean NOT NULL DEFAULT false`);
  await db.execute(sql`
    UPDATE zadace z SET is_targeted = true
    WHERE z.is_targeted = false AND (
      z.podgrupa_id IS NOT NULL
      OR EXISTS (SELECT 1 FROM zadace_ucenici zu WHERE zu.zadaca_id = z.id)
    )
  `);
  const [mekteb] = await db.insert(mektebiTable).values({ naziv: suffix })
    .returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  muallimId = await createUser("teacher", "muallim");
  await db.insert(muallimProfiliTable).values({ userId: muallimId, mektebId });
  const [grupa] = await db.insert(grupeTable).values({
    muallimId,
    naziv: suffix,
    skolskaGodina: "2026/27",
    isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;

  firstStudentId = await createUser("student-one", "ucenik");
  secondStudentId = await createUser("student-two", "ucenik");
  await db.insert(ucenikProfiliTable).values([
    { userId: firstStudentId, muallimId, grupaId, mektebId },
    { userId: secondStudentId, muallimId, grupaId, mektebId },
  ]);
  studentTokens[firstStudentId] = signToken({
    userId: firstStudentId, username: `student-one.${suffix}`, role: "ucenik", displayName: "Student One",
  });
  studentTokens[secondStudentId] = signToken({
    userId: secondStudentId, username: `student-two.${suffix}`, role: "ucenik", displayName: "Student Two",
  });
  tokens.teacher = signToken({
    userId: muallimId, username: `teacher.${suffix}`, role: "muallim", displayName: "Teacher",
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
  if (homeworkIds.length) {
    await db.delete(zadaceUceniciTable).where(inArray(zadaceUceniciTable.zadacaId, homeworkIds));
    await db.delete(zadaceTable).where(inArray(zadaceTable.id, homeworkIds));
  }
  if (grupaId) {
    await db.delete(podgrupeUceniciTable).where(eq(podgrupeUceniciTable.grupaId, grupaId));
    await db.delete(podgrupeTable).where(eq(podgrupeTable.grupaId, grupaId));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, [firstStudentId, secondStudentId]));
    await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
  }
  if (userIds.length) {
    await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
});

test("subgroup pair keeps IDs and snapshots only selected homework recipients", async () => {
  const initiallyEmpty = await request(`/grupe/${grupaId}/podgrupe`, "GET");
  assert.equal(initiallyEmpty.status, 200);
  assert.deepEqual(await initiallyEmpty.json(), []);

  const create = await request(`/grupe/${grupaId}/podgrupe`, "PUT", {
    podgrupe: [
      { naziv: "Prva", ucenikIds: [firstStudentId] },
      { naziv: "Druga", ucenikIds: [secondStudentId] },
    ],
  });
  assert.equal(create.status, 200, await create.clone().text());
  const created = await create.json() as Array<{ id: number; naziv: string; ucenikIds: number[] }>;
  assert.equal(created.length, 2);
  assert.deepEqual(created.map(row => row.ucenikIds), [[firstStudentId], [secondStudentId]]);

  const rejectedIdReplacement = await request(`/grupe/${grupaId}/podgrupe`, "PUT", {
    podgrupe: [
      { naziv: "Promjena 1", ucenikIds: [firstStudentId] },
      { naziv: "Promjena 2", ucenikIds: [secondStudentId] },
    ],
  });
  assert.equal(rejectedIdReplacement.status, 400);

  const update = await request(`/grupe/${grupaId}/podgrupe`, "PUT", {
    podgrupe: [
      { id: created[0].id, naziv: "Prva izmijenjena", ucenikIds: [secondStudentId] },
      { id: created[1].id, naziv: "Druga izmijenjena", ucenikIds: [firstStudentId] },
    ],
  });
  assert.equal(update.status, 200, await update.clone().text());
  const updated = await update.json() as Array<{ id: number; naziv: string; ucenikIds: number[] }>;
  assert.deepEqual(updated.map(row => row.id), created.map(row => row.id));

  const subgroupHomework = await request("/zadace", "POST", {
    grupaId, naslov: "Podgrupna zadaća", tipDodjele: "podgrupa", podgrupaId: created[0].id,
  });
  assert.equal(subgroupHomework.status, 201, await subgroupHomework.clone().text());
  const subgroupAssignment = await subgroupHomework.json() as {
    id: number; ucenikIds: number[]; podgrupaId: number; isTargeted: boolean;
  };
  homeworkIds.push(subgroupAssignment.id);
  assert.equal(subgroupAssignment.podgrupaId, created[0].id);
  assert.equal(subgroupAssignment.isTargeted, true);
  assert.deepEqual(subgroupAssignment.ucenikIds, [secondStudentId]);

  // Change current subgroup membership so the originally assigned subgroup is
  // empty. Editing the same subgroup assignment must preserve its old snapshot.
  const movedMembers = await request(`/grupe/${grupaId}/podgrupe`, "PUT", {
    podgrupe: [
      { id: created[0].id, naziv: "Prva izmijenjena", ucenikIds: [] },
      { id: created[1].id, naziv: "Druga izmijenjena", ucenikIds: [firstStudentId, secondStudentId] },
    ],
  });
  assert.equal(movedMembers.status, 200, await movedMembers.clone().text());
  const editSameSubgroup = await request(`/zadace/${subgroupAssignment.id}`, "PUT", {
    naslov: "Uređena podgrupna zadaća",
    tipDodjele: "podgrupa",
    podgrupaId: created[0].id,
  });
  assert.equal(editSameSubgroup.status, 200, await editSameSubgroup.clone().text());
  const preservedTargets = await db.select({ ucenikId: zadaceUceniciTable.ucenikId })
    .from(zadaceUceniciTable).where(eq(zadaceUceniciTable.zadacaId, subgroupAssignment.id));
  assert.deepEqual(preservedTargets.map(row => row.ucenikId), [secondStudentId]);

  // Simulate deleting the only recipient's target row. No group-wide fallback
  // may expose the targeted assignment to either student or teacher review.
  await db.delete(zadaceUceniciTable).where(eq(zadaceUceniciTable.zadacaId, subgroupAssignment.id));
  for (const studentId of [firstStudentId, secondStudentId]) {
    const visibleHomework = await studentRequest("/zadace", studentId);
    assert.equal(visibleHomework.status, 200, await visibleHomework.clone().text());
    const rows = await visibleHomework.json() as Array<{ id: number }>;
    assert.ok(!rows.some(row => row.id === subgroupAssignment.id));
  }
  const emptyReview = await request(`/zadace/${subgroupAssignment.id}/pregled`, "GET");
  assert.equal(emptyReview.status, 200);
  assert.deepEqual((await emptyReview.json() as { ucenici: unknown[] }).ucenici, []);

  const sviHomework = await request("/zadace", "POST", {
    grupaId, naslov: "Grupna zadaća", tipDodjele: "svi", podgrupaId: null,
  });
  assert.equal(sviHomework.status, 201, await sviHomework.clone().text());
  const sviAssignment = await sviHomework.json() as { id: number; podgrupaId: number | null; isTargeted: boolean };
  homeworkIds.push(sviAssignment.id);
  assert.equal(sviAssignment.podgrupaId, null);
  assert.equal(sviAssignment.isTargeted, false);

  const pojedinacnoUpdate = await request(`/zadace/${sviAssignment.id}`, "PUT", {
    tipDodjele: "pojedinacno",
    podgrupaId: null,
    ucenikIds: [firstStudentId, secondStudentId],
  });
  assert.equal(pojedinacnoUpdate.status, 200, await pojedinacnoUpdate.clone().text());
  const individualAssignment = await pojedinacnoUpdate.json() as {
    podgrupaId: number | null; ucenikIds: number[]; isTargeted: boolean;
  };
  assert.equal(individualAssignment.podgrupaId, null);
  assert.equal(individualAssignment.isTargeted, true);
  assert.deepEqual(new Set(individualAssignment.ucenikIds), new Set([firstStudentId, secondStudentId]));
});