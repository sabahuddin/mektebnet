import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { inArray, sql, and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  grupeTable,
  obavjestenjaTable,
  porukeTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

// E2E za dvije nove garancije:
//  1. Obavještenje može ciljati VIŠE grupa odjednom, a roditelj vidi samo ono
//     što pogađa grupu njegovog djeteta.
//  2. POST /poruke/bulk poštuje opseg pošiljaoca — muallim ne može poslati
//     poruku roditelju izvan svojih grupa, čak ni slanjem njegovog ID-a —
//     i deduplicira roditelja koji upada kroz više grupa odjednom.

const SUFFIX = `og${Date.now()}`;

type ObavjestenjeDto = {
  id: number;
  naslov: string;
  sadrzaj: string;
  grupaIds?: number[];
};

type BulkPorukeDto = { sent: number };

let server: Server;
let baseUrl: string;

let muallimId: number;
let tudjiMuallimId: number;
let grupaAId: number;
let grupaBId: number;
let ucenikAId: number;
let ucenikBId: number;
let ucenikCId: number;
let tudjiUcenikId: number;
// Roditelj sa dvoje djece (po jedno u svakoj grupi) — provjera deduplikacije.
let roditeljDvojeId: number;
let roditeljBId: number;
let tudjiRoditeljId: number;
let muallimToken: string;
let roditeljDvojeToken: string;
const obavjestenjaIds: number[] = [];

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
  muallimId = await createUser("muallim", "m");
  tudjiMuallimId = await createUser("muallim", "mtudji");
  ucenikAId = await createUser("ucenik", "ua");
  ucenikBId = await createUser("ucenik", "ub");
  ucenikCId = await createUser("ucenik", "uc");
  tudjiUcenikId = await createUser("ucenik", "utudji");
  roditeljDvojeId = await createUser("roditelj", "rdvoje");
  roditeljBId = await createUser("roditelj", "rb");
  tudjiRoditeljId = await createUser("roditelj", "rtudji");

  await db.insert(muallimProfiliTable).values({ userId: muallimId });
  await db.insert(muallimProfiliTable).values({ userId: tudjiMuallimId });

  const [gA] = await db.insert(grupeTable)
    .values({ naziv: `Grupa A ${SUFFIX}`, muallimId, skolskaGodina: "2025/2026" })
    .returning({ id: grupeTable.id });
  const [gB] = await db.insert(grupeTable)
    .values({ naziv: `Grupa B ${SUFFIX}`, muallimId, skolskaGodina: "2025/2026" })
    .returning({ id: grupeTable.id });
  grupaAId = gA.id;
  grupaBId = gB.id;

  await db.insert(ucenikProfiliTable).values({ userId: ucenikAId, muallimId, grupaId: grupaAId });
  await db.insert(ucenikProfiliTable).values({ userId: ucenikBId, muallimId, grupaId: grupaBId });
  await db.insert(ucenikProfiliTable).values({ userId: ucenikCId, muallimId, grupaId: grupaBId });
  await db.insert(ucenikProfiliTable).values({ userId: tudjiUcenikId, muallimId: tudjiMuallimId });

  await db.insert(roditeljProfiliTable).values({ userId: roditeljDvojeId });
  await db.insert(roditeljProfiliTable).values({ userId: roditeljBId });
  await db.insert(roditeljProfiliTable).values({ userId: tudjiRoditeljId });

  // roditeljDvoje ima dijete u obje grupe → mora se pojaviti tačno jednom.
  await db.insert(roditeljUcenikTable).values({
    roditeljId: roditeljDvojeId, ucenikId: ucenikAId,
    status: "approved", approvedAt: new Date(), approvedBy: muallimId,
  });
  await db.insert(roditeljUcenikTable).values({
    roditeljId: roditeljDvojeId, ucenikId: ucenikBId,
    status: "approved", approvedAt: new Date(), approvedBy: muallimId,
  });
  await db.insert(roditeljUcenikTable).values({
    roditeljId: roditeljBId, ucenikId: ucenikCId,
    status: "approved", approvedAt: new Date(), approvedBy: muallimId,
  });
  await db.insert(roditeljUcenikTable).values({
    roditeljId: tudjiRoditeljId, ucenikId: tudjiUcenikId,
    status: "approved", approvedAt: new Date(), approvedBy: tudjiMuallimId,
  });

  muallimToken = signToken({
    userId: muallimId, username: `m.${SUFFIX}`, role: "muallim", displayName: `m ${SUFFIX}`,
  });
  roditeljDvojeToken = signToken({
    userId: roditeljDvojeId, username: `rdvoje.${SUFFIX}`, role: "roditelj", displayName: `rdvoje ${SUFFIX}`,
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

  if (obavjestenjaIds.length) {
    await db.execute(sql`DELETE FROM obavjestenja_grupe WHERE obavjestenje_id IN (${sql.join(obavjestenjaIds.map(id => sql`${id}`), sql`, `)})`);
    await db.delete(obavjestenjaTable).where(inArray(obavjestenjaTable.id, obavjestenjaIds));
  }

  const userIds = [
    muallimId, tudjiMuallimId, ucenikAId, ucenikBId, ucenikCId, tudjiUcenikId,
    roditeljDvojeId, roditeljBId, tudjiRoditeljId,
  ].filter(Boolean);
  if (userIds.length) {
    await db.delete(porukeTable).where(inArray(porukeTable.posiljateljId, userIds));
    await db.delete(porukeTable).where(inArray(porukeTable.primateljId, userIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, userIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.roditeljId, userIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, userIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    await db.delete(grupeTable).where(inArray(grupeTable.id, [grupaAId, grupaBId].filter(Boolean)));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
});

function authed(path: string, token: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

test("obavještenje se može objaviti za više grupa odjednom", async () => {
  const res = await authed("/api/muallim/obavjestenja", muallimToken, {
    method: "POST",
    body: JSON.stringify({
      naslov: `Dvije grupe ${SUFFIX}`,
      sadrzaj: "Test sadržaj",
      grupaIds: [grupaAId, grupaBId],
    }),
  });
  assert.equal(res.status, 200);
  const created = await res.json() as ObavjestenjeDto;
  obavjestenjaIds.push(created.id);

  const lista = await (await authed("/api/muallim/obavjestenja", muallimToken)).json() as ObavjestenjeDto[];
  const nasa = lista.find(o => o.id === created.id);
  assert.ok(nasa, "obavještenje mora biti u listi");
  assert.deepEqual([...(nasa.grupaIds ?? [])].sort((a, b) => a - b),
    [grupaAId, grupaBId].sort((a, b) => a - b));
});

test("obavještenje ne prihvata tuđu grupu", async () => {
  const [tudja] = await db.insert(grupeTable)
    .values({ naziv: `Tudja ${SUFFIX}`, muallimId: tudjiMuallimId, skolskaGodina: "2025/2026" })
    .returning({ id: grupeTable.id });
  const res = await authed("/api/muallim/obavjestenja", muallimToken, {
    method: "POST",
    body: JSON.stringify({
      naslov: `Tudja grupa ${SUFFIX}`,
      sadrzaj: "Ne smije proći",
      grupaIds: [grupaAId, tudja.id],
    }),
  });
  assert.equal(res.status, 400);
  await db.delete(grupeTable).where(inArray(grupeTable.id, [tudja.id]));
});

test("roditelj vidi obavještenje koje cilja grupu njegovog djeteta", async () => {
  const res = await authed("/api/roditelj/obavjestenja", roditeljDvojeToken);
  assert.equal(res.status, 200);
  const lista = await res.json() as ObavjestenjeDto[];
  assert.ok(
    lista.some(o => o.naslov === `Dvije grupe ${SUFFIX}`),
    "višegrupno obavještenje mora biti vidljivo roditelju",
  );
});

test("bulk poruka po grupama deduplicira roditelja s više djece", async () => {
  const res = await authed("/api/poruke/bulk", muallimToken, {
    method: "POST",
    body: JSON.stringify({
      grupeNazivi: [`Grupa A ${SUFFIX}`, `Grupa B ${SUFFIX}`],
      naslov: "Test",
      sadrzaj: "Poruka svim roditeljima obje grupe",
    }),
  });
  assert.equal(res.status, 201);
  const out = await res.json() as BulkPorukeDto;
  // Brojimo samo poruke iz ovog bulk slanja — raniji test obavještenja takođe
  // šalje poruku istom roditelju.
  const primljene = await db.select().from(porukeTable)
    .where(and(
      inArray(porukeTable.primateljId, [roditeljDvojeId]),
      eq(porukeTable.sadrzaj, "Poruka svim roditeljima obje grupe"),
    ));
  assert.equal(primljene.length, 1, "roditelj s dvoje djece smije primiti tačno jednu poruku");
  assert.ok(out.sent >= 2);
});

test("bulk poruka ignoriše primatelja izvan opsega muallima", async () => {
  const res = await authed("/api/poruke/bulk", muallimToken, {
    method: "POST",
    body: JSON.stringify({
      primateljIds: [tudjiRoditeljId],
      naslov: "Test",
      sadrzaj: "Ne smije stići",
    }),
  });
  assert.equal(res.status, 400, "nema validnih primatelja izvan opsega");

  const primljene = await db.select().from(porukeTable)
    .where(inArray(porukeTable.primateljId, [tudjiRoditeljId]));
  assert.equal(primljene.length, 0);
});
