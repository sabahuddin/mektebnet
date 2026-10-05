import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db, usersTable, grupeTable, muallimProfiliTable, ucenikProfiliTable, mektebiTable, zadaceTable } from "@workspace/db";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `multi-homework-${Date.now()}`;
let server: Server;
let base: string;
let token: string;
let schoolId: number;
const teacherIds: number[] = [];
const studentIds: number[] = [];
const groupIds: number[] = [];
interface HomeworkResponse {
  id: number;
  grupaId: number;
  muallimId: number;
  opis: string;
  rokDo: string;
  isTargeted: boolean;
}
interface CreatedHomeworkResponse extends HomeworkResponse {
  dodatneZadace: HomeworkResponse[];
}

before(async () => {
  const [school] = await db.insert(mektebiTable).values({ naziv: suffix }).returning();
  schoolId = school.id;
  for (const role of ["muallim", "muallim", "ucenik", "ucenik", "ucenik"] as const) {
    const [user] = await db.insert(usersTable).values({
      username: `${suffix}-${teacherIds.length + studentIds.length}`,
      displayName: suffix, passwordHash: "test-hash", role, isActive: true,
      termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
      ...(role === "muallim" ? { administratorDeclarationAcceptedAt: new Date() } : {}),
    }).returning();
    (role === "muallim" ? teacherIds : studentIds).push(user.id);
  }
  await db.insert(muallimProfiliTable).values(teacherIds.map(userId => ({ userId, mektebId: schoolId })));
  for (let index = 0; index < 3; index++) {
    const [group] = await db.insert(grupeTable).values({
      muallimId: teacherIds[index === 2 ? 1 : 0], naziv: `${suffix}-${index}`, skolskaGodina: "2026/27", isActive: true,
    }).returning();
    groupIds.push(group.id);
    await db.insert(ucenikProfiliTable).values({
      userId: studentIds[index], grupaId: group.id, muallimId: group.muallimId, mektebId: schoolId,
    });
  }
  token = signToken({ userId: teacherIds[0], username: suffix, displayName: suffix, role: "muallim" });
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const address = server.address();
      base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/api`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>(resolve => server?.close(() => resolve()));
  if (groupIds.length) {
    await db.delete(zadaceTable).where(inArray(zadaceTable.grupaId, groupIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, studentIds));
    await db.execute(sql`DELETE FROM grupa_muallimi WHERE grupa_id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`, `)})`);
    await db.delete(grupeTable).where(inArray(grupeTable.id, groupIds));
  }
  if (teacherIds.length) await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, teacherIds));
  if (teacherIds.length || studentIds.length) await db.delete(usersTable).where(inArray(usersTable.id, [...teacherIds, ...studentIds]));
  if (schoolId) await db.delete(mektebiTable).where(eq(mektebiTable.id, schoolId));
});

function post(extra: Record<string, unknown> = {}) {
  return fetch(`${base}/muallim/zadace`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grupaId: groupIds[0], tipDodjele: "svi", naslov: suffix, opis: "Isti opis https://example.com", rokDo: "2026-12-01", ...extra }),
  });
}

async function studentHomework(index: number) {
  const studentToken = signToken({ userId: studentIds[index], username: suffix, displayName: suffix, role: "ucenik" });
  const response = await fetch(`${base}/ucenik/zadace`, { headers: { Authorization: `Bearer ${studentToken}` } });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json() as Promise<{ id: number }[]>;
}

test("multiple groups get independent homework and each pupil only sees their own group", async () => {
  const response = await post({ dodatneGrupeIds: [groupIds[0], groupIds[1], groupIds[1]] });
  assert.equal(response.status, 201, await response.clone().text());
  const created = await response.json() as CreatedHomeworkResponse;
  assert.equal(created.grupaId, groupIds[0]);
  assert.equal(created.dodatneZadace.length, 1);
  assert.notEqual(created.id, created.dodatneZadace[0].id);
  for (const row of [created, ...created.dodatneZadace]) {
    assert.equal(row.opis, "Isti opis https://example.com");
    assert.equal(row.rokDo.slice(0, 10), "2026-12-01");
    assert.equal(row.isTargeted, false);
    assert.equal(row.muallimId, teacherIds[0]);
  }
  const first = await studentHomework(0);
  const second = await studentHomework(1);
  const foreign = await studentHomework(2);
  assert.ok(first.some((z: { id: number }) => z.id === created.id));
  assert.ok(!first.some((z: { id: number }) => z.id === created.dodatneZadace[0].id));
  assert.ok(second.some((z: { id: number }) => z.id === created.dodatneZadace[0].id));
  assert.ok(!second.some((z: { id: number }) => z.id === created.id));
  assert.ok(!foreign.some((z: { id: number }) => [created.id, created.dodatneZadace[0].id].includes(z.id)));
});

test("unauthorized group rejects the whole request without a partial assignment", async () => {
  const beforeRows = await db.select().from(zadaceTable).where(inArray(zadaceTable.grupaId, groupIds));
  const response = await post({ dodatneGrupeIds: [groupIds[1], groupIds[2]] });
  assert.equal(response.status, 403);
  const afterRows = await db.select().from(zadaceTable).where(inArray(zadaceTable.grupaId, groupIds));
  assert.equal(afterRows.length, beforeRows.length);
});

test("targeted assignments and malformed group IDs cannot be distributed to extra groups", async () => {
  for (const extra of [
    { dodatneGrupeIds: "all" },
    { dodatneGrupeIds: ["1"] },
    { dodatneGrupeIds: [-1] },
    { dodatneGrupeIds: [groupIds[1]], tipDodjele: "podgrupa", podgrupaId: 1 },
    { dodatneGrupeIds: [groupIds[1]], tipDodjele: "pojedinacno", ucenikIds: [studentIds[0]] },
    { dodatneGrupeIds: [groupIds[1]], ucenikIds: [studentIds[0]] },
  ]) assert.equal((await post(extra)).status, 400);
});

test("shared teacher groups work while inactive groups are rejected", async () => {
  await db.execute(sql`INSERT INTO grupa_muallimi (grupa_id, muallim_id) VALUES (${groupIds[2]}, ${teacherIds[0]})`);
  const shared = await post({ dodatneGrupeIds: [groupIds[2]] });
  assert.equal(shared.status, 201, await shared.clone().text());
  await db.update(grupeTable).set({ isActive: false }).where(eq(grupeTable.id, groupIds[2]));
  const inactive = await post({ dodatneGrupeIds: [groupIds[2]] });
  assert.equal(inactive.status, 403);
});

test("existing single-group callers keep the original response contract", async () => {
  const response = await post();
  assert.equal(response.status, 201, await response.clone().text());
  const created = await response.json() as CreatedHomeworkResponse;
  assert.equal(created.grupaId, groupIds[0]);
  assert.deepEqual(created.dodatneZadace, []);
});
