import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable, mektebiTable, muallimProfiliTable, napametGlobalProgramTable,
  napametUcenikOverrideTable, ocjeneTable, roditeljProfiliTable, roditeljUcenikTable,
  ucenikProfiliTable, usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `napamet-visibility-${Date.now()}`;
const itemId = `test-vis-${Date.now()}`;
let server: Server;
let baseUrl: string;
let mektebId: number;
let grupaId: number;
let outsiderGrupaId: number;
let teacherId: number;
let outsiderTeacherId: number;
let studentId: number;
let otherStudentId: number;
let parentId: number;
let teacherToken: string;
let outsiderToken: string;
let studentToken: string;
let parentToken: string;

async function user(role: "muallim" | "ucenik" | "roditelj", label: string) {
  const [row] = await db.insert(usersTable).values({
    username: `${label}.${suffix}`, displayName: `${label} ${suffix}`,
    passwordHash: "x", role, isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
    ...(role === "muallim" ? { administratorDeclarationAcceptedAt: new Date() } : {}),
    ...(role === "roditelj" ? { parentAcknowledgedAt: new Date() } : {}),
  }).returning({ id: usersTable.id });
  return row.id;
}

function token(userId: number, role: "muallim" | "ucenik" | "roditelj", label: string) {
  return signToken({ userId, username: `${label}.${suffix}`, role, displayName: `${label} ${suffix}` });
}

async function request(path: string, auth: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}`, ...(init?.headers ?? {}) },
  });
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  const [mekteb] = await db.insert(mektebiTable).values({ naziv: `Visibility ${suffix}` }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  teacherId = await user("muallim", "teacher");
  outsiderTeacherId = await user("muallim", "outsider");
  studentId = await user("ucenik", "student");
  otherStudentId = await user("ucenik", "other");
  parentId = await user("roditelj", "parent");
  await db.insert(muallimProfiliTable).values([
    { userId: teacherId, mektebId, isGlavni: true },
    { userId: outsiderTeacherId, mektebId, isGlavni: false },
  ]);
  const [group] = await db.insert(grupeTable).values({ muallimId: teacherId, naziv: `Target ${suffix}`, skolskaGodina: "2025/2026", isActive: true }).returning({ id: grupeTable.id });
  const [outside] = await db.insert(grupeTable).values({ muallimId: outsiderTeacherId, naziv: `Outside ${suffix}`, skolskaGodina: "2025/2026", isActive: true }).returning({ id: grupeTable.id });
  grupaId = group.id;
  outsiderGrupaId = outside.id;
  await db.insert(ucenikProfiliTable).values([
    { userId: studentId, muallimId: teacherId, grupaId, mektebId },
    { userId: otherStudentId, muallimId: teacherId, grupaId, mektebId },
  ]);
  await db.insert(roditeljProfiliTable).values({ userId: parentId });
  await db.insert(roditeljUcenikTable).values({ roditeljId: parentId, ucenikId: studentId, status: "approved", approvedAt: new Date(), approvedBy: teacherId });
  await db.insert(napametGlobalProgramTable).values({
    stavkaId: itemId, nivo: 1, naziv: `Visibility item ${suffix}`, redoslijed: 1,
  });
  await db.insert(ocjeneTable).values({
    ucenikId: studentId, muallimId: teacherId, grupaId, kategorija: "napamet",
    predmet: "Napamet", ocjena: 5, lekcijaNaziv: `Visibility item ${suffix}`,
    napametNivo: 1, napametStavkaId: itemId, datum: "2026-01-01",
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
  teacherToken = token(teacherId, "muallim", "teacher");
  outsiderToken = token(outsiderTeacherId, "muallim", "outsider");
  studentToken = token(studentId, "ucenik", "student");
  parentToken = token(parentId, "roditelj", "parent");
});

after(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await db.delete(napametUcenikOverrideTable).where(sql`stavka_id = ${itemId}`);
  await db.delete(ocjeneTable).where(eq(ocjeneTable.ucenikId, studentId));
  await db.delete(roditeljUcenikTable).where(eq(roditeljUcenikTable.ucenikId, studentId));
  await db.delete(ucenikProfiliTable).where(sql`user_id IN (${studentId}, ${otherStudentId})`);
  await db.delete(roditeljProfiliTable).where(eq(roditeljProfiliTable.userId, parentId));
  await db.delete(grupeTable).where(sql`id IN (${grupaId}, ${outsiderGrupaId})`);
  await db.delete(muallimProfiliTable).where(sql`user_id IN (${teacherId}, ${outsiderTeacherId})`);
  await db.delete(usersTable).where(sql`id IN (${teacherId}, ${outsiderTeacherId}, ${studentId}, ${otherStudentId}, ${parentId})`);
  await db.delete(napametGlobalProgramTable).where(eq(napametGlobalProgramTable.stavkaId, itemId));
  await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
});

test("Napamet per-student visibility is authorized, hidden consistently, and reversible", async () => {
  const [teacherProfile] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, teacherId));
  const [studentProfile] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, studentId));
  assert.equal(teacherProfile.mektebId, mektebId);
  assert.equal(studentProfile.grupaId, grupaId);
  assert.equal(studentProfile.muallimId, teacherId);
  const [targetGroup] = await db.select().from(grupeTable).where(eq(grupeTable.id, grupaId));
  assert.equal(targetGroup.muallimId, teacherId);
  const forbidden = await request(`/api/muallim/napamet/${studentId}/${itemId}/visibility`, outsiderToken, {
    method: "PUT", body: JSON.stringify({ isVisible: false }),
  });
  assert.equal(forbidden.status, 403);

  const disable = await request(`/api/muallim/napamet/${studentId}/${itemId}/visibility`, teacherToken, {
    method: "PUT", body: JSON.stringify({ isVisible: false }),
  });
  assert.equal(disable.status, 200, await disable.text());

  const studentHidden = await (await request("/api/ucenik/napamet", studentToken)).json() as { katalog: { id: string }[]; ocjene: { napametStavkaId: string | null }[] };
  assert.ok(!studentHidden.katalog.some((item) => item.id === itemId));
  assert.ok(!studentHidden.ocjene.some((grade) => grade.napametStavkaId === itemId));
  const parentHidden = await (await request(`/api/roditelj/napamet/${studentId}`, parentToken)).json() as typeof studentHidden;
  assert.ok(!parentHidden.katalog.some((item) => item.id === itemId));
  assert.ok(!parentHidden.ocjene.some((grade) => grade.napametStavkaId === itemId));
  const dashboardResponse = await request(`/api/roditelj/dashboard/${studentId}`, parentToken);
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json() as { posljednjaOcjena: unknown };
  assert.equal(dashboard.posljednjaOcjena, null);
  const otherVisible = await (await request("/api/ucenik/napamet", token(otherStudentId, "ucenik", "other"))).json() as typeof studentHidden;
  assert.ok(otherVisible.katalog.some((item) => item.id === itemId));

  const teacherView = await (await request(`/api/muallim/napamet/${studentId}`, teacherToken)).json() as { katalog: { id: string; isVisible?: boolean }[]; ocjene: { napametStavkaId: string | null }[] };
  assert.equal(teacherView.katalog.find((item) => item.id === itemId)?.isVisible, false);
  assert.ok(teacherView.ocjene.some((grade) => grade.napametStavkaId === itemId));
  const groupDetailResponse = await request(`/api/muallim/napamet-program/${itemId}/detalji?grupaId=${grupaId}`, teacherToken);
  assert.equal(groupDetailResponse.status, 200);
  const groupDetail = await groupDetailResponse.json() as {
    ocijenjeni: { id: number; isVisible: boolean }[];
    nisuOcijenjeni: { id: number; isVisible: boolean }[];
  };
  assert.equal(groupDetail.ocijenjeni.find((entry) => entry.id === studentId)?.isVisible, false);
  assert.equal(groupDetail.nisuOcijenjeni.find((entry) => entry.id === otherStudentId)?.isVisible, true);

  const reenable = await request(`/api/muallim/napamet/${studentId}/${itemId}/visibility`, teacherToken, {
    method: "PUT", body: JSON.stringify({ isVisible: true }),
  });
  assert.equal(reenable.status, 200);
  const restored = await (await request("/api/ucenik/napamet", studentToken)).json() as typeof studentHidden;
  assert.ok(restored.katalog.some((item) => item.id === itemId));
  assert.ok(restored.ocjene.some((grade) => grade.napametStavkaId === itemId));
});