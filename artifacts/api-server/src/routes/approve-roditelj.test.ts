import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  porukeTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

// E2E test za "1 učenik = 1 roditelj" invarijantu na strani ODOBRAVANJA.
// Pokriva najsuptilniji put (Task #134 je ručno provjerio kreiranje/povezivanje/
// samoprijavu): muallim NE smije odobriti drugog roditelja za učenika koji već
// ima odobrenog, ali odbijanje (reject) drugog zahtjeva mora i dalje proći.
//
// Pattern: potpiši HS256 JWT ručno (signToken koristi isti JWT_SECRET kao app),
// digni in-process server na efemernom portu i gađaj prave rute kroz cijeli
// middleware lanac (requireAuth + requireRole). DB mutacije su na dev bazi i
// čiste se u after().

const SUFFIX = `t${Date.now()}`;

let server: Server;
let baseUrl: string;

let muallimId: number;
let ucenikId: number;
let roditelj1Id: number;
let roditelj2Id: number;
let pendingZahtjevId: number;
let concurrentUcenikId: number;
let concurrentRoditelj1Id: number;
let concurrentRoditelj2Id: number;
let concurrentZahtjev1Id: number;
let concurrentZahtjev2Id: number;
let muallimToken: string;
let roditelj2Token: string;

async function createUser(
  role: "muallim" | "ucenik" | "roditelj",
  label: string,
): Promise<number> {
  const [row] = await db
    .insert(usersTable)
    .values({
      username: `${label}.${SUFFIX}`,
      displayName: `${label} ${SUFFIX}`,
      passwordHash: "x",
      role,
      isActive: true,
    })
    .returning({ id: usersTable.id });
  return row.id;
}

before(async () => {
  muallimId = await createUser("muallim", "muallim");
  ucenikId = await createUser("ucenik", "ucenik");
  roditelj1Id = await createUser("roditelj", "roditelj1");
  roditelj2Id = await createUser("roditelj", "roditelj2");

  await db.insert(muallimProfiliTable).values({ userId: muallimId });
  await db.insert(ucenikProfiliTable).values({ userId: ucenikId, muallimId });
  await db.insert(roditeljProfiliTable).values({ userId: roditelj1Id });
  await db.insert(roditeljProfiliTable).values({ userId: roditelj2Id });

  // Roditelj 1 je već odobren za ovog učenika.
  await db.insert(roditeljUcenikTable).values({
    roditeljId: roditelj1Id,
    ucenikId,
    status: "approved",
    approvedAt: new Date(),
    approvedBy: muallimId,
  });

  // Roditelj 2 ima zahtjev na čekanju (pending) za istog učenika.
  const [pending] = await db
    .insert(roditeljUcenikTable)
    .values({ roditeljId: roditelj2Id, ucenikId, status: "pending" })
    .returning({ id: roditeljUcenikTable.id });
  pendingZahtjevId = pending.id;

  // Dva različita zahtjeva za drugog učenika služe za provjeru da parcijalni
  // unique indeks zatvara race kada oba odobrenja krenu istovremeno.
  concurrentUcenikId = await createUser("ucenik", "ucenik-concurrent");
  concurrentRoditelj1Id = await createUser("roditelj", "roditelj-concurrent-1");
  concurrentRoditelj2Id = await createUser("roditelj", "roditelj-concurrent-2");
  await db.insert(ucenikProfiliTable).values({ userId: concurrentUcenikId, muallimId });
  await db.insert(roditeljProfiliTable).values([
    { userId: concurrentRoditelj1Id },
    { userId: concurrentRoditelj2Id },
  ]);
  const [concurrentZahtjev1, concurrentZahtjev2] = await db
    .insert(roditeljUcenikTable)
    .values([
      { roditeljId: concurrentRoditelj1Id, ucenikId: concurrentUcenikId, status: "pending" },
      { roditeljId: concurrentRoditelj2Id, ucenikId: concurrentUcenikId, status: "pending" },
    ])
    .returning({ id: roditeljUcenikTable.id });
  concurrentZahtjev1Id = concurrentZahtjev1.id;
  concurrentZahtjev2Id = concurrentZahtjev2.id;

  muallimToken = signToken({
    userId: muallimId,
    username: `muallim.${SUFFIX}`,
    role: "muallim",
    displayName: `muallim ${SUFFIX}`,
  });
  roditelj2Token = signToken({
    userId: roditelj2Id,
    username: `roditelj2.${SUFFIX}`,
    role: "roditelj",
    displayName: `roditelj2 ${SUFFIX}`,
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));

  const userIds = [
    muallimId,
    ucenikId,
    roditelj1Id,
    roditelj2Id,
    concurrentUcenikId,
    concurrentRoditelj1Id,
    concurrentRoditelj2Id,
  ].filter(Boolean);
  if (userIds.length) {
    await db.delete(porukeTable).where(inArray(porukeTable.posiljateljId, userIds));
    await db.delete(porukeTable).where(inArray(porukeTable.primateljId, userIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, userIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.roditeljId, userIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
});

function muallimPost(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${muallimToken}`,
    },
    body: JSON.stringify(body),
  });
}

test("approve drugog roditelja za zauzetog učenika vraća 409", async () => {
  const res = await muallimPost("/api/muallim/approve-roditelj", {
    roditeljUcenikId: pendingZahtjevId,
    approved: true,
  });
  assert.equal(res.status, 409);

  // Zahtjev mora ostati pending — nije ni odobren ni odbijen.
  const [zahtjev] = await db
    .select()
    .from(roditeljUcenikTable)
    .where(eq(roditeljUcenikTable.id, pendingZahtjevId));
  assert.equal(zahtjev.status, "pending");
});

test("dva istovremena odobrenja ostavljaju samo jednog odobrenog roditelja", async () => {
  const odgovori = await Promise.all([
    muallimPost("/api/muallim/approve-roditelj", {
      roditeljUcenikId: concurrentZahtjev1Id,
      approved: true,
    }),
    muallimPost("/api/muallim/approve-roditelj", {
      roditeljUcenikId: concurrentZahtjev2Id,
      approved: true,
    }),
  ]);

  assert.deepEqual(odgovori.map((res) => res.status).sort(), [200, 409]);

  const odobreneVeze = await db
    .select({ id: roditeljUcenikTable.id })
    .from(roditeljUcenikTable)
    .where(and(
      eq(roditeljUcenikTable.ucenikId, concurrentUcenikId),
      eq(roditeljUcenikTable.status, "approved"),
    ));
  assert.equal(odobreneVeze.length, 1);
});

test("reject (odbijanje) drugog zahtjeva i dalje prolazi (200)", async () => {
  const res = await muallimPost("/api/muallim/approve-roditelj", {
    roditeljUcenikId: pendingZahtjevId,
    approved: false,
  });
  assert.equal(res.status, 200);

  const [zahtjev] = await db
    .select()
    .from(roditeljUcenikTable)
    .where(eq(roditeljUcenikTable.id, pendingZahtjevId));
  assert.equal(zahtjev.status, "rejected");
});

test("muallim kreiranje novog roditelja za zauzetog učenika vraća 409", async () => {
  const displayName = `Novi Roditelj ${SUFFIX}`;
  const res = await muallimPost(`/api/muallim/ucenici/${ucenikId}/roditelj`, {
    displayName,
  });
  assert.equal(res.status, 409);

  // Provjera mora biti prije transakcije: 409 ne smije kreirati ni nalog ni profil.
  const [noviKorisnici, noviProfili] = await Promise.all([
    db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.displayName, displayName), eq(usersTable.role, "roditelj"))),
    db
      .select({ userId: roditeljProfiliTable.userId })
      .from(roditeljProfiliTable)
      .innerJoin(usersTable, eq(usersTable.id, roditeljProfiliTable.userId))
      .where(and(eq(usersTable.displayName, displayName), eq(usersTable.role, "roditelj"))),
  ]);
  assert.equal(noviKorisnici.length, 0);
  assert.equal(noviProfili.length, 0);
});

test("muallim povezivanje drugog roditelja za zauzetog učenika vraća 409", async () => {
  const res = await muallimPost(`/api/muallim/ucenici/${ucenikId}/povezi-roditelja`, {
    roditeljUsername: `roditelj2.${SUFFIX}`,
  });
  assert.equal(res.status, 409);
});

test("roditelj samoprijava (link-dijete) za zauzetog učenika vraća 409", async () => {
  const res = await fetch(`${baseUrl}/api/roditelj/link-dijete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${roditelj2Token}`,
    },
    body: JSON.stringify({ ucenikUsername: `ucenik.${SUFFIX}` }),
  });
  assert.equal(res.status, 409);
});
