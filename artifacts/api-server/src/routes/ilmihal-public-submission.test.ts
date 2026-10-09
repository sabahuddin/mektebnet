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
  await db.execute(sql`DELETE FROM content_prijevodi WHERE tabela = 'ilmihal_lekcije'
    AND red_id IN (SELECT id FROM ilmihal_lekcije WHERE autor_muallim_id = ${ownerId || 0})`);
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

test("private draft survives reopening; author publishes only to assigned students", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Private ${suffix}`, nivo: 1, contentHtml: "<p>private</p>",
  });
  assert.equal(created.status, 201);
  const lesson = await created.json() as { id: number; slug: string; pendingApproval: boolean };
  assert.equal(lesson.pendingApproval, false);
  const draft = await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>private draft updated</p>", privateAction: "draft",
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
  assert.equal(item, undefined, "unfinished draft must not enter the public approval queue");
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>private draft updated</p>", privateAction: "publish",
  })).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
  const edit = await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>changed after approval</p>", privateAction: "draft",
  });
  assert.equal(edit.status, 200);
  assert.equal((await edit.json() as { draft: boolean }).draft, true);
  assert.match((await (await request(`/api/content/ilmihal/${lesson.slug}`, ownerToken)).json() as { contentHtml: string }).contentHtml, /changed after approval/);
  assert.match((await (await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).json() as { contentHtml: string }).contentHtml, /private draft updated/);
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>changed after approval</p>", privateAction: "publish",
  })).status, 200);
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

test("translated private drafts stay with their language and preserve the Bosnian original", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Language ${suffix}`, nivo: 1, contentHtml: "<p>Bosanski izvor</p>",
  });
  const lesson = await created.json() as { id: number; slug: string };
  await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>Bosanski izvor</p>", privateAction: "publish",
  });
  await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>English private draft</p>", privateAction: "draft", language: "en",
  });
  const readEnglish = async (token: string) => {
    const response = await fetch(`${baseUrl}/api/content/ilmihal/${lesson.slug}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Lang": "en" },
    });
    assert.equal(response.status, 200);
    return response.json() as Promise<{ contentHtml: string }>;
  };
  assert.match((await readEnglish(ownerToken)).contentHtml, /English private draft/);
  assert.doesNotMatch((await readEnglish(studentToken)).contentHtml, /English private draft/);
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>English private draft</p>", privateAction: "publish", language: "en",
  })).status, 200);
  assert.match((await readEnglish(studentToken)).contentHtml, /English private draft/);
  const original = await (await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).json() as { contentHtml: string };
  assert.match(original.contentHtml, /Bosanski izvor/);
});

test("legacy private proposals remain recoverable and can be privately published", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Legacy ${suffix}`, nivo: 1, contentHtml: "<p>Previous published content</p>",
  });
  const lesson = await created.json() as { id: number; slug: string };
  await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>Previous published content</p>", privateAction: "publish",
  });
  await db.execute(sql`INSERT INTO izmjene_lekcija (lekcija_id, predlozeni_html, predlozio_id, jezik)
    VALUES (${lesson.id}, '<p>Legacy saved work</p>', ${ownerId}, 'bs')`);
  const recovered = await (await request(`/api/content/ilmihal/${lesson.slug}`, ownerToken)).json() as { contentHtml: string };
  assert.match(recovered.contentHtml, /Legacy saved work/);
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: recovered.contentHtml, privateAction: "publish",
  })).status, 200);
  const visible = await (await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).json() as { contentHtml: string };
  assert.match(visible.contentHtml, /Legacy saved work/);
});

test("explicit submission enters queue and admin approval publishes to everyone", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Approve ${suffix}`, nivo: 1, contentHtml: "<p>approve</p>",
    podnesenoZaJavnuObjavu: true,
  });
  const lesson = await created.json() as { id: number; slug: string };
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 403);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`)).status, 403);
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>approve</p>", privateAction: "publish",
  })).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 200);
  const queue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaSlug: string }>;
  const item = queue.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item!.id}/odluka`, adminToken, "PUT", { visibility: "javno" })).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 200);
  const sharedEdit = await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>public change needs approval</p>",
  });
  assert.equal(sharedEdit.status, 200);
  assert.equal((await sharedEdit.json() as { pendingApproval: boolean }).pendingApproval, true);
  const sharedRead = await (await request(`/api/content/ilmihal/${lesson.slug}`)).json() as { contentHtml: string };
  assert.match(sharedRead.contentHtml, /approve/);
  assert.doesNotMatch(sharedRead.contentHtml, /public change needs approval/);
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>must not bypass approval</p>", privateAction: "publish",
  })).status, 403);
});

test("rejecting public sharing preserves an author's private lesson", async () => {
  const created = await request("/api/admin/ilmihal", ownerToken, "POST", {
    naslov: `Reject ${suffix}`, nivo: 1, contentHtml: "<p>reject</p>",
    podnesenoZaJavnuObjavu: true,
  });
  const lesson = await created.json() as { id: number; slug: string };
  assert.equal((await request(`/api/admin/ilmihal/${lesson.id}`, ownerToken, "PUT", {
    contentHtml: "<p>reject</p>", privateAction: "publish",
  })).status, 200);
  const queue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ id: number; lekcijaSlug: string }>;
  const item = queue.find((row) => row.lekcijaSlug === lesson.slug);
  assert.ok(item);
  assert.equal((await request(`/api/admin/izmjene-lekcija/${item!.id}/odluka`, adminToken, "PUT", { visibility: "odbijeno" })).status, 200);
  const afterQueue = await (await request("/api/admin/izmjene-lekcija", adminToken)).json() as Array<{ lekcijaSlug: string }>;
  assert.equal(afterQueue.some((row) => row.lekcijaSlug === lesson.slug), false);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, ownerToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, studentToken)).status, 200);
  assert.equal((await request(`/api/content/ilmihal/${lesson.slug}`, outsiderToken)).status, 403);
});