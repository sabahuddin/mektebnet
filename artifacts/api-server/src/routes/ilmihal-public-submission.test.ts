import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { ilmihalLekcijeTable, mektebiTable, muallimProfiliTable, ucenikProfiliTable, usersTable } from "@workspace/db/schema";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `public-submission-${Date.now()}`;
let server: Server | undefined;
let baseUrl = "";
let ownerId: number;
let mektebId: number;
let studentId: number;
let outsiderId: number;
let adminToken: string;
let ownerToken: string;
let studentToken: string;
let outsiderToken: string;

function tokenFor(id: number, role: "admin" | "muallim" | "ucenik", username: string) {
  return signToken({ userId: id, username, displayName: username, role });
}

function request(path: string, token?: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function cleanup() {
  await db.execute(sql`DELETE FROM ilmihal_lekcije WHERE slug LIKE ${`muallim-${ownerId || 0}-%`}`);
  await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, studentId || 0));
  await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, ownerId || 0));
  await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId || 0));
  await db.delete(usersTable).where(sql`id IN (${ownerId || 0}, ${studentId || 0}, ${outsiderId || 0})`);
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  const [owner] = await db.insert(usersTable).values({
    username: `${suffix}.owner`, displayName: "Owner", passwordHash: "x", role: "muallim", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(), administratorDeclarationAcceptedAt: new Date(),
  }).returning({ id: usersTable.id });
  const [student] = await db.insert(usersTable).values({
    username: `${suffix}.student`, displayName: "Student", passwordHash: "x", role: "ucenik", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  const [outsider] = await db.insert(usersTable).values({
    username: `${suffix}.outsider`, displayName: "Outsider", passwordHash: "x", role: "ucenik", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  ownerId = owner.id;
  const [mekteb] = await db.insert(mektebiTable).values({
    naziv: `Testni mekteb ${suffix}`, grad: "Sarajevo",
  }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  await db.insert(muallimProfiliTable).values({ userId: ownerId, mektebId });
  studentId = student.id;
  outsiderId = outsider.id;
  await db.insert(ucenikProfiliTable).values({ userId: studentId, muallimId: ownerId });
  const [admin] = await db.insert(usersTable).values({
    username: `${suffix}.admin`, displayName: "Admin", passwordHash: "x", role: "admin", isActive: true,
    termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  adminToken = tokenFor(admin.id, "admin", `${suffix}.admin`);
  ownerToken = tokenFor(ownerId, "muallim", `${suffix}.owner`);
  studentToken = tokenFor(studentId, "ucenik", `${suffix}.student`);
  outsiderToken = tokenFor(outsiderId, "ucenik", `${suffix}.outsider`);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server?.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
  await cleanup();
  await db.delete(usersTable).where(sql`username = ${`${suffix}.admin`}`);
});

test("private creation stays with author/admin until approved for assigned students", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Private ${suffix}`, nivo: 1, contentHtml: "<p>private</p>",
  });
  assert.equal(created.status, 201);
  const lesson = await created.json() as { id: number; slug: string; pendingApproval: boolean };
  assert.equal(lesson.pendingApproval, true);
  const draft = await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>private draft updated</p>",
  });
  assert.equal(draft.status, 200);
  assert.match((await (await request(`/api/content/ilmihal/${lesson.slug}`, ownerToken)).json() as { contentHtml: string }).contentHtml, /private draft updated/);
  assert.equal((await request("/api/content/ilmihal", ownerToken)).status, 200);
  const ownerList = await (await request("/api/content/ilmihal", ownerToken)).json() as Array<{ slug: string }>;
  const studentList = await (await request("/api/content/ilmihal", studentToken)).json() as Array<{ slug: string }>;
  assert.ok(ownerList.some((item) => item.slug === lesson.slug));
  assert.ok(!studentList.some((item) => item.slug === lesson.slug));
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 403);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
  const queue = await request("/api/admin/izmjene-lekcija", adminToken);
  assert.equal(queue.status, 200);
  const rows = await queue.json() as Array<{ id: number; lekcijaSlug: string; podnesenoZaJavnuObjavu: boolean; predlozioIme: string; mektebNaziv: string; mektebGrad: string }>;
  const item = rows.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal(item.predlozioIme, "Owner");
  assert.equal(item.mektebNaziv, `Testni mekteb ${suffix}`);
  assert.equal(item.mektebGrad, "Sarajevo");
  assert.equal(item.podnesenoZaJavnuObjavu, false);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item.id}/odluka`, adminToken, "PUT", { visibility: "privatno" })).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
  const edit = await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>changed after approval</p>",
  });
  assert.equal(edit.status, 200);
  assert.equal((await edit.json() as { pendingApproval: boolean }).pendingApproval, true);
  assert.match((await (await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).json() as { contentHtml: string }).contentHtml, /private draft updated/);
  const edits = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaId: number }>;
  const proposal = edits.find((entry) => entry.lekcijaId === lesson.id);
  assert.ok(proposal && proposal.id > 0);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${proposal.id}/odluka`, adminToken, "PUT", { approve: true })).status, 200);
  assert.match((await (await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).json() as { contentHtml: string }).contentHtml, /changed after approval/);
});

test("admin can create and edit a DODATAK lesson", async () => {
  const slug = `dodatak-nivo1-${Date.now()}`;
  let id: number | undefined;
  try {
    const created = await request("/api/admin/ilmihal", adminToken, "POST", {
      naslov: "DODATAK", slug, nivo: 1, redoslijed: 9501,
      contentHtml: "<h1>DODATAK</h1><p>Početni sadržaj</p>",
    });
    assert.equal(created.status, 200, await created.text());
    const row = await db.select({ id: ilmihalLekcijeTable.id }).from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.slug, slug));
    id = row[0]?.id;
    assert.ok(id);
    const list = await (await request("/api/content/ilmihal", adminToken)).json() as Array<{ slug: string }>;
    assert.ok(list.some((item) => item.slug === slug));
    const edited = await request(`/api/admin/ilmihal/${id}`, adminToken, "PUT", {
      naslov: "DODATAK — Ažurirano", contentHtml: "<p>Novi sadržaj</p>",
    });
    assert.equal(edited.status, 200, await edited.text());
    const detail = await request(`/api/content/ilmihal/${slug}`, adminToken);
    assert.equal(detail.status, 200);
    const data = await detail.json() as { naslov: string; contentHtml: string };
    assert.equal(data.naslov, "DODATAK – Ažurirano");
    assert.match(data.contentHtml, /Novi sadržaj/);
  } finally {
    if (id) await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, id));
  }
});

test("explicit submission enters queue and admin approval publishes to everyone", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Approve ${suffix}`, nivo: 1, contentHtml: "<p>approve</p>",
    podnesenoZaJavnuObjavu: true,
  });
  const lesson = await created.json() as { slug: string };
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 403);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`)).status, 403);
  const queue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaSlug: string }>;
  const item = queue.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item!.id}/odluka`, adminToken, "PUT", { visibility: "javno" })).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 200);
});

test("rejected new lesson never becomes visible to students", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Reject ${suffix}`, nivo: 1, contentHtml: "<p>reject</p>",
    podnesenoZaJavnuObjavu: true,
  });
  const lesson = await created.json() as { slug: string };
  const queue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaSlug: string }>;
  const item = queue.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item!.id}/odluka`, adminToken, "PUT", { visibility: "odbijeno" })).status, 200);
  const afterQueue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ lekcijaSlug: string }>;
  assert.equal(afterQueue.some((row) => row.lekcijaSlug === lesson.slug), false);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, ownerToken)).status, 403);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 403);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
});