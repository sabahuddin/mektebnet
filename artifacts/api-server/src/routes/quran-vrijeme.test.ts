import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable, mektebiTable, muallimProfiliTable, ucenikProfiliTable, usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `quran-time-${Date.now()}`;
const ids: number[] = [];
const people: Record<string, number> = {};
const tokens: Record<string, string> = {};
let mektebId: number;
let foreignMektebId: number;
let grupaId: number;
let server: Server;
let baseUrl: string;

async function request(path: string, as?: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}),
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
  for (const name of ["head", "owner", "second", "foreign", "student"]) {
    const role = name === "student" ? "ucenik" : "muallim";
    const [user] = await db.insert(usersTable).values({
      username: `${name}.${suffix}`, displayName: name, passwordHash: "x",
      role, isActive: true, termsAcceptedAt: new Date(), privacyAcknowledgedAt: new Date(),
      ...(role === "muallim" ? { administratorDeclarationAcceptedAt: new Date() } : {}),
    }).returning({ id: usersTable.id });
    ids.push(user.id);
    people[name] = user.id;
    tokens[name] = signToken({ userId: user.id, username: `${name}.${suffix}`, role, displayName: name });
    if (role === "muallim") {
      await db.insert(muallimProfiliTable).values({
        userId: user.id, mektebId: name === "foreign" ? foreignMektebId : mektebId,
        isGlavni: name === "head" || name === "foreign",
      });
    }
  }
  const [grupa] = await db.insert(grupeTable).values({
    muallimId: people.owner, naziv: suffix, skolskaGodina: "2026/27", isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;
  await db.execute(sql`INSERT INTO grupa_muallimi (grupa_id, muallim_id) VALUES (${grupaId}, ${people.second})`);
  await db.insert(ucenikProfiliTable).values({
    userId: people.student, muallimId: people.owner, grupaId, mektebId,
  });
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
  if (people.student) {
    await db.execute(sql`DELETE FROM quran_vrijeme_dnevno WHERE user_id = ${people.student}`);
    await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, people.student));
  }
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

test("Kur'an broji samo server-side intervale učenika, ne pauzu ili druge uloge", async () => {
  assert.equal((await request("/aktivnost/quran/heartbeat", "owner", "POST")).status, 403);
  assert.equal((await request("/aktivnost/quran/heartbeat", undefined, "POST")).status, 401);
  const first = await request("/aktivnost/quran/heartbeat", "student", "POST");
  assert.equal(first.status, 200, await first.text());
  const initial = await (await request("/aktivnost/quran/me", "student")).json() as { totalSeconds: number };
  assert.equal(initial.totalSeconds, 0);

  await db.execute(sql`
    UPDATE quran_vrijeme_dnevno SET last_heartbeat_at = NOW() - INTERVAL '10 seconds'
    WHERE user_id = ${people.student}
  `);
  assert.equal((await request("/aktivnost/quran/heartbeat", "student", "POST")).status, 200);
  const counted = await (await request("/aktivnost/quran/me", "student")).json() as { totalSeconds: number };
  assert.ok(counted.totalSeconds >= 10 && counted.totalSeconds <= 15);
  assert.equal((await request("/aktivnost/quran/heartbeat", "student", "POST")).status, 200);
  const immediate = await (await request("/aktivnost/quran/me", "student")).json() as { totalSeconds: number };
  assert.ok(immediate.totalSeconds - counted.totalSeconds <= 1);

  await db.execute(sql`
    UPDATE quran_vrijeme_dnevno SET last_heartbeat_at = NOW() - INTERVAL '25 seconds'
    WHERE user_id = ${people.student}
  `);
  assert.equal((await request("/aktivnost/quran/heartbeat", "student", "POST")).status, 200);
  const resumed = await (await request("/aktivnost/quran/me", "student")).json() as { totalSeconds: number };
  assert.equal(resumed.totalSeconds, immediate.totalSeconds);

  await db.execute(sql`
    UPDATE quran_vrijeme_dnevno SET last_heartbeat_at = NOW() - INTERVAL '10 seconds'
    WHERE user_id = ${people.student}
  `);
  assert.equal((await request("/aktivnost/quran/heartbeat", "student", "POST", { reset: true })).status, 200);
  const returnedQuickly = await (await request("/aktivnost/quran/me", "student")).json() as { totalSeconds: number };
  assert.equal(returnedQuickly.totalSeconds, resumed.totalSeconds);
});

test("zadnjih 7 dana i ukupno su odvojeni, samo ovlašteni muallimi vide profil", async () => {
  await db.execute(sql`
    INSERT INTO quran_vrijeme_dnevno (user_id, dan, seconds)
    VALUES
      (${people.student}, (NOW() AT TIME ZONE 'Europe/Zurich')::date - 1, 80),
      (${people.student}, (NOW() AT TIME ZONE 'Europe/Zurich')::date - 7, 120)
  `);
  const own = await (await request("/aktivnost/quran/me", "student")).json() as { last7DaysSeconds: number; totalSeconds: number };
  assert.equal(own.last7DaysSeconds, own.totalSeconds - 120);
  assert.ok(own.last7DaysSeconds >= 80);
  for (const name of ["owner", "head", "second"]) {
    const res = await request(`/muallim/ucenik/${people.student}/quran-vrijeme`, name);
    assert.equal(res.status, 200, `${name}: ${await res.clone().text()}`);
    assert.deepEqual(await res.json(), own);
  }
  assert.equal((await request(`/muallim/ucenik/${people.student}/quran-vrijeme`, "foreign")).status, 403);
  assert.equal((await request("/muallim/ucenik/bad/quran-vrijeme", "owner")).status, 400);
  assert.equal((await request(`/muallim/ucenik/${people.student}/quran-vrijeme`, "student")).status, 403);
});