import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db, ilmihalLekcijeTable, muallimProfiliTable, ucenikProfiliTable, prilozi, usersTable,
  h5pPokusajiTable, embedCompletionsTable, studentProgressTable } from "@workspace/db";
import app from "../app.js";
import { bootstrapDrizzleMigrations, runDrizzleMigrate } from "../lib/drizzle-migrate.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `prilog-rejection-${Date.now()}`;
const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve("uploads");
const storedName = `${suffix}.txt`;
let h5pDir = `h5p/${suffix}`;
let server: Server;
let baseUrl: string;
let lessonId: number;
const userIds: number[] = [];
const ids: number[] = [];
const tokens: Record<string, string> = {};

function request(url: string, role?: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
  for (const [key, role] of [["owner", "muallim"], ["other", "muallim"], ["student", "ucenik"], ["admin", "admin"], ["ownStudent", "ucenik"]] as const) {
    const [user] = await db.insert(usersTable).values({
      username: `${suffix}.${key}`, displayName: key, role, passwordHash: "x", isActive: true,
      termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(), administratorDeclarationAcceptedAt: new Date(),
    }).returning({ id: usersTable.id });
    userIds.push(user.id);
    tokens[key] = signToken({ userId: user.id, username: `${suffix}.${key}`, displayName: key, role });
    if (role === "muallim") await db.insert(muallimProfiliTable).values({ userId: user.id });
    if (key === "ownStudent") await db.insert(ucenikProfiliTable).values({ userId: user.id, muallimId: userIds[0] });
  }
  const [lesson] = await db.insert(ilmihalLekcijeTable).values({
    slug: suffix, naslov: suffix, nivo: 1, redoslijed: 9900,
    contentHtml: "<p>Test</p>", statusOdobrenja: "odobreno", isPublished: true, dostupnost: "svi",
  }).returning({ id: ilmihalLekcijeTable.id });
  lessonId = lesson.id;
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, storedName), "Preserved file");
  for (const kind of ["file", "url", "h5p", "embed"]) {
    const [row] = await db.insert(prilozi).values({
      lekcijaId: lessonId, kind, originalName: `${suffix}.${kind}`, approved: false,
      uploadedByRole: "muallim", uploadedByUserId: userIds[0],
      storedName: kind === "file" ? storedName : kind === "h5p" ? "h5p/pending" : "",
      externalUrl: kind === "url" || kind === "embed" ? "https://learningapps.org/watch?v=test" : null,
    }).returning({ id: prilozi.id });
    ids.push(row.id);
    if (kind === "h5p") {
      h5pDir = `h5p/${row.id}`;
      await db.update(prilozi).set({ storedName: h5pDir }).where(eq(prilozi.id, row.id));
      fs.mkdirSync(path.join(uploadsDir, h5pDir), { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, h5pDir, "h5p.json"), '{"title":"Preserved H5P"}');
    }
  }
  server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (ids.length) {
    await db.delete(h5pPokusajiTable).where(inArray(h5pPokusajiTable.priloziId, ids));
    await db.delete(embedCompletionsTable).where(inArray(embedCompletionsTable.priloziId, ids));
    await db.delete(prilozi).where(inArray(prilozi.id, ids));
  }
  if (lessonId) await db.delete(ilmihalLekcijeTable).where(eq(ilmihalLekcijeTable.id, lessonId));
  if (userIds.length) {
    await db.delete(studentProgressTable).where(inArray(studentProgressTable.studentId, userIds.map(String)));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  fs.rmSync(path.join(uploadsDir, storedName), { force: true });
  fs.rmSync(path.join(uploadsDir, h5pDir), { recursive: true, force: true });
});

test("rejecting every attachment kind preserves the author copy and removes it from the approval queue", async () => {
  assert.equal((await request(`/api/admin/prilozi/${ids[0]}/approve`, "owner", "PUT", { approve: false })).status, 403);
  for (const id of ids) {
    const res = await request(`/api/admin/prilozi/${id}/approve`, "admin", "PUT", { approve: false });
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { rejected: boolean }).rejected, true);
  }
  const stored = await db.select().from(prilozi).where(inArray(prilozi.id, ids));
  assert.equal(stored.length, 4);
  assert.ok(stored.every(row => row.rejected && !row.approved));
  assert.ok(fs.existsSync(path.join(uploadsDir, storedName)));
  assert.ok(fs.existsSync(path.join(uploadsDir, h5pDir, "h5p.json")));
  const queue = await (await request("/api/admin/pending-prilozi", "admin")).json() as Array<{ id: number }>;
  assert.ok(queue.every(row => !ids.includes(row.id)));
  for (const role of ["owner", "admin"]) {
    const res = await request(`/api/admin/prilozi/${lessonId}`, role);
    assert.equal(res.status, 200);
    assert.equal((await res.json() as unknown[]).length, 4);
    const detail = await request(`/api/content/ilmihal/${suffix}`, role);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json() as { prilozi: unknown[] }).prilozi.length, 4);
  }
  const other = await request(`/api/admin/prilozi/${lessonId}`, "other");
  assert.equal(other.status, 200);
  assert.equal((await other.json() as unknown[]).length, 0);
  for (const role of ["other", "student"]) {
    const detail = await request(`/api/content/ilmihal/${suffix}`, role);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json() as { prilozi: unknown[] }).prilozi.length, 0);
  }
});

test("rejected files and H5P assets remain downloadable by author but not other users or anonymous visitors", async () => {
  for (const url of [`/api/admin/prilozi/download/${ids[0]}`, `/uploads/${storedName}`, `/uploads/${h5pDir}/h5p.json`]) {
    assert.equal((await request(url, "owner")).status, 200, url);
    assert.equal((await request(url, "admin")).status, 200, url);
    for (const role of ["other", "student", undefined]) {
      const res = await request(url, role);
      assert.ok([401, 403, 404].includes(res.status), `${url}: ${role} received ${res.status}`);
    }
  }
});

test("a later admin approval clears rejection and restores the approved visibility", async () => {
  assert.equal((await request(`/api/admin/prilozi/${ids[3]}/approve`, "admin", "PUT", { approve: true })).status, 200);
  const [row] = await db.select().from(prilozi).where(eq(prilozi.id, ids[3]));
  assert.equal(row.approved, true);
  assert.equal(row.rejected, false);
  const detail = await (await request(`/api/content/ilmihal/${suffix}`, "student")).json() as { prilozi: { id: number }[] };
  assert.deepEqual(detail.prilozi.map((p: { id: number }) => p.id), [ids[3]]);
});

test("a published lesson includes the author's private exercises, assets and rewards for their students only", async () => {
  await db.update(prilozi).set({ approved: false, rejected: false }).where(inArray(prilozi.id, ids));
  await db.update(prilozi).set({ hasanatReward: 3 }).where(eq(prilozi.id, ids[3]));
  await db.update(ilmihalLekcijeTable).set({
    dostupnost: "autorovi_ucenici", autorMuallimId: userIds[0], isPublished: false, statusOdobrenja: "nacrt",
  }).where(eq(ilmihalLekcijeTable.id, lessonId));
  const assetUrl = `/api/uploads/${h5pDir}/h5p.json`;
  assert.equal((await request(`/api/content/ilmihal/${suffix}`, "ownStudent")).status, 403);
  assert.equal((await request(assetUrl, "ownStudent")).status, 404);
  assert.equal((await request(`/api/h5p/attempts/${ids[2]}`, "ownStudent")).status, 404);
  assert.equal((await request("/api/h5p/result", "ownStudent", "POST", { priloziId: ids[2], score: 1, maxScore: 2 })).status, 404);
  assert.equal((await request("/api/content/embed/zavrseno", "ownStudent", "POST", { priloziId: ids[3] })).status, 403);

  await db.update(ilmihalLekcijeTable).set({ isPublished: true, statusOdobrenja: "odobreno" }).where(eq(ilmihalLekcijeTable.id, lessonId));
  const detailResponse = await request(`/api/content/ilmihal/${suffix}`, "ownStudent");
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json() as { prilozi: { id: number; approved: boolean }[] };
  assert.deepEqual(detail.prilozi.map(p => p.id).sort(), [ids[2], ids[3]].sort());
  assert.ok(detail.prilozi.every(p => !p.approved));
  assert.equal((await request(assetUrl, "ownStudent")).status, 200);
  assert.equal((await request(`/api/h5p/attempts/${ids[2]}`, "ownStudent")).status, 200);
  const result = await request("/api/h5p/result", "ownStudent", "POST", { priloziId: ids[2], score: 1, maxScore: 2 });
  assert.equal(result.status, 200);
  assert.ok((await result.json() as { hasanatGained: number }).hasanatGained > 0);
  const embed = await request("/api/content/embed/zavrseno", "ownStudent", "POST", { priloziId: ids[3] });
  assert.equal(embed.status, 200);
  assert.equal((await embed.json() as { hasanatGained: number }).hasanatGained, 3);
  const duplicate = await (await request("/api/content/embed/zavrseno", "ownStudent", "POST", { priloziId: ids[3] })).json() as { alreadyClaimed: boolean; hasanatGained: number };
  assert.equal(duplicate.alreadyClaimed, true);
  assert.equal(duplicate.hasanatGained, 0);
  for (const role of ["student", "other"]) {
    assert.equal((await request(assetUrl, role)).status, 404);
    assert.equal((await request(`/api/h5p/attempts/${ids[2]}`, role)).status, 404);
  }
  assert.equal((await request("/api/h5p/result", "student", "POST", { priloziId: ids[2], score: 1, maxScore: 2 })).status, 404);
  assert.equal((await request("/api/content/embed/zavrseno", "student", "POST", { priloziId: ids[3] })).status, 403);
  for (const id of [ids[2], ids[3]]) {
    assert.equal((await request(`/api/admin/prilozi/${id}/approve`, "admin", "PUT", { approve: false })).status, 200);
  }
  assert.equal((await request(assetUrl, "ownStudent")).status, 200, "rejecting global sharing must not revoke private student access");
  for (const id of [ids[2], ids[3]]) {
    assert.equal((await request(`/api/admin/prilozi/${id}/approve`, "admin", "PUT", { approve: true })).status, 200);
  }
  assert.equal((await request(assetUrl, "student")).status, 404, "approval of an exercise must not bypass the private lesson");
  await db.update(ilmihalLekcijeTable).set({ dostupnost: "svi" }).where(eq(ilmihalLekcijeTable.id, lessonId));
  assert.equal((await request(assetUrl, "student")).status, 200);
});
