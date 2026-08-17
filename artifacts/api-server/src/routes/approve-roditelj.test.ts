import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
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

  const userIds = [muallimId, ucenikId, roditelj1Id, roditelj2Id].filter(Boolean);
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
  const res = await muallimPost(`/api/muallim/ucenici/${ucenikId}/roditelj`, {
    displayName: `Novi Roditelj ${SUFFIX}`,
  });
  assert.equal(res.status, 409);
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
