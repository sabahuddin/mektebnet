import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { grupeTable, mektebiTable, muallimProfiliTable, usersTable } from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `group-teachers-${Date.now()}`;
let server: Server;
let baseUrl: string;
let mektebId: number;
let foreignMektebId: number;
let grupaId: number;
const ids: number[] = [];
const tokens: Record<string, string> = {};
const people: Record<string, number> = {};

async function request(path: string, as: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api/muallim${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokens[as]}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  const [mekteb] = await db.insert(mektebiTable).values({ naziv: suffix }).returning({ id: mektebiTable.id });
  const [foreign] = await db.insert(mektebiTable).values({ naziv: `${suffix}-foreign` }).returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  foreignMektebId = foreign.id;
  for (const name of ["head", "owner", "second", "third", "fourth", "foreign"]) {
    const [user] = await db.insert(usersTable).values({
      username: `${name}.${suffix}`, displayName: name, passwordHash: "x",
      role: "muallim", isActive: true,
      termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
      administratorDeclarationAcceptedAt: new Date(),
    }).returning({ id: usersTable.id });
    ids.push(user.id);
    people[name] = user.id;
    await db.insert(muallimProfiliTable).values({
      userId: user.id, mektebId: name === "foreign" ? foreignMektebId : mektebId,
      isGlavni: name === "head" || name === "foreign",
    });
    tokens[name] = signToken({ userId: user.id, username: `${name}.${suffix}`, role: "muallim", displayName: name });
  }
  const [grupa] = await db.insert(grupeTable).values({
    muallimId: people.owner, naziv: suffix, skolskaGodina: "2026/27", isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;
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
  if (grupaId) {
    await db.execute(sql`DELETE FROM grupa_muallimi WHERE grupa_id = ${grupaId}`);
    await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
  }
  if (ids.length) {
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  if (foreignMektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, foreignMektebId));
});

test("jedna grupa ima najviše tri muallima, samo iz istog mekteba", async () => {
  const candidates = await request("/mekteb/muallimi-za-grupe", "owner");
  assert.equal(candidates.status, 200, await candidates.clone().text());
  const names = (await candidates.json() as Array<{ userId: number }>).map(m => m.userId);
  assert.ok(names.includes(people.second));
  assert.ok(!names.includes(people.foreign));

  const add = (who: string, id: number) => request(`/grupe/${grupaId}/muallimi`, who, "POST", { muallimId: id });
  assert.equal((await add("foreign", people.second)).status, 403);
  assert.equal((await add("owner", people.foreign)).status, 400);
  assert.equal((await add("owner", people.second)).status, 200);
  assert.equal((await add("owner", people.second)).status, 200); // idempotentno
  assert.equal((await add("head", people.third)).status, 200);
  assert.equal((await add("owner", people.fourth)).status, 409);

  const groups = await request("/grupe", "second");
  assert.equal(groups.status, 200);
  const group = (await groups.json() as Array<{ id: number; sekundarniMuallimi: Array<{ id: number }> }>)
    .find(g => g.id === grupaId);
  assert.deepEqual(group?.sekundarniMuallimi.map(m => m.id).sort((a, b) => a - b),
    [people.second, people.third].sort((a, b) => a - b));
  assert.equal((await request(`/grupa/${grupaId}/ucenici`, "second")).status, 200);
  assert.equal((await request(`/grupe/${grupaId}`, "second", "DELETE")).status, 403);
  assert.equal((await request(`/grupe/${grupaId}/arhiviraj`, "second", "POST")).status, 403);
  assert.equal((await request(`/grupe/${grupaId}/vrati`, "second", "POST")).status, 403);

  assert.equal((await request(`/grupe/${grupaId}/muallimi/${people.second}`, "foreign", "DELETE")).status, 403);
  assert.equal((await request(`/grupe/${grupaId}/muallimi/${people.second}`, "owner", "DELETE")).status, 200);
  assert.equal((await add("owner", people.fourth)).status, 200);

  // Promjena odgovornog muallima ne ostavlja istog čovjeka i na listi dodatnih.
  assert.equal((await request(`/grupe/${grupaId}`, "head", "PUT", { muallimId: people.third })).status, 200);
  const membership = await db.execute(sql`SELECT muallim_id FROM grupa_muallimi WHERE grupa_id = ${grupaId}`);
  assert.deepEqual(membership.rows.map(r => Number(r.muallim_id)), [people.fourth]);
});