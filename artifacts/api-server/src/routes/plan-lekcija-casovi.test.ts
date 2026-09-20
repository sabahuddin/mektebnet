import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  mektebiTable,
  muallimProfiliTable,
  planLekcijaTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const SUFFIX = `plan-casovi-${Date.now()}`;
const DATUM = "2026-10-07";

let server: Server;
let baseUrl: string;
let mektebId: number;
let muallimId: number;
let drugiMuallimId: number;
let grupaId: number;
let token: string;
let drugiToken: string;

interface PlanOdgovor {
  id: number;
  datum: string;
  lekcijaNaslov: string;
  lekcijaTip: string;
  redoslijed: number;
  cas: number;
}

function poziv(path: string, init: RequestInit, authToken: string) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
  });
}

before(async () => {
  const [mekteb] = await db.insert(mektebiTable)
    .values({ naziv: `Mekteb ${SUFFIX}` })
    .returning({ id: mektebiTable.id });
  mektebId = mekteb.id;

  const [muallim] = await db.insert(usersTable).values({
    username: `muallim.${SUFFIX}`, displayName: `Muallim ${SUFFIX}`, passwordHash: "x", role: "muallim", isActive: true,
  }).returning({ id: usersTable.id });
  muallimId = muallim.id;
  const [drugi] = await db.insert(usersTable).values({
    username: `drugi.${SUFFIX}`, displayName: `Drugi ${SUFFIX}`, passwordHash: "x", role: "muallim", isActive: true,
  }).returning({ id: usersTable.id });
  drugiMuallimId = drugi.id;

  await db.insert(muallimProfiliTable).values([
    { userId: muallimId, mektebId, isGlavni: false },
    { userId: drugiMuallimId, mektebId, isGlavni: false },
  ]);

  const [grupa] = await db.insert(grupeTable).values({
    muallimId, naziv: `Grupa ${SUFFIX}`, skolskaGodina: "2026/27", isActive: true,
  }).returning({ id: grupeTable.id });
  grupaId = grupa.id;

  token = signToken({ userId: muallimId, username: `muallim.${SUFFIX}`, role: "muallim", displayName: "Muallim" });
  drugiToken = signToken({ userId: drugiMuallimId, username: `drugi.${SUFFIX}`, role: "muallim", displayName: "Drugi" });

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (grupaId) await db.delete(planLekcijaTable).where(eq(planLekcijaTable.grupaId, grupaId));
  const userIds = [muallimId, drugiMuallimId].filter(Boolean);
  if (userIds.length) {
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    if (grupaId) await db.delete(grupeTable).where(eq(grupeTable.id, grupaId));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
});

test("isti dan nosi obradu na prvom i provjeru na drugom času", async () => {
  const prvi = await poziv("/api/muallim/plan-lekcija", {
    method: "POST",
    body: JSON.stringify({ grupaId, datum: DATUM, cas: 1, lekcijaNaslov: "Abdest", lekcijaTip: "obrada" }),
  }, token);
  assert.equal(prvi.status, 201);
  const prviPlan = await prvi.json() as PlanOdgovor;
  assert.equal(prviPlan.cas, 1);
  assert.equal(prviPlan.redoslijed, 0);

  const drugi = await poziv("/api/muallim/plan-lekcija", {
    method: "POST",
    body: JSON.stringify({ grupaId, datum: DATUM, cas: 2, lekcijaNaslov: "Abdest", lekcijaTip: "provjera" }),
  }, token);
  assert.equal(drugi.status, 201);
  const drugiPlan = await drugi.json() as PlanOdgovor;
  assert.equal(drugiPlan.cas, 2);
  assert.equal(drugiPlan.redoslijed, 1);

  const spisak = await poziv(`/api/muallim/plan-lekcija?grupaId=${grupaId}`, { method: "GET" }, token);
  const plan = await spisak.json() as PlanOdgovor[];
  assert.deepEqual(plan.map(p => [p.cas, p.lekcijaTip]), [[1, "obrada"], [2, "provjera"]]);
});

test("ponovni upis istog časa mijenja postojeći unos umjesto da doda novi", async () => {
  const odgovor = await poziv("/api/muallim/plan-lekcija", {
    method: "POST",
    body: JSON.stringify({ grupaId, datum: DATUM, cas: 1, lekcijaNaslov: "Namaz", lekcijaTip: "ponavljanje" }),
  }, token);
  assert.equal(odgovor.status, 200);

  const spisak = await poziv(`/api/muallim/plan-lekcija?grupaId=${grupaId}`, { method: "GET" }, token);
  const plan = await spisak.json() as PlanOdgovor[];
  assert.equal(plan.length, 2);
  assert.equal(plan[0].lekcijaNaslov, "Namaz");
  assert.equal(plan[0].lekcijaTip, "ponavljanje");
});

test("izmjena vrste časa ide kroz PATCH", async () => {
  const spisak = await poziv(`/api/muallim/plan-lekcija?grupaId=${grupaId}`, { method: "GET" }, token);
  const plan = await spisak.json() as PlanOdgovor[];
  const drugiCas = plan.find(p => p.cas === 2)!;

  const odgovor = await poziv(`/api/muallim/plan-lekcija/${drugiCas.id}`, {
    method: "PATCH",
    body: JSON.stringify({ lekcijaTip: "test" }),
  }, token);
  assert.equal(odgovor.status, 200);
  const azuriran = await odgovor.json() as PlanOdgovor;
  assert.equal(azuriran.lekcijaTip, "test");
  assert.equal(azuriran.cas, 2);
});

test("broj časa van dozvoljenog raspona se odbija", async () => {
  const odgovor = await poziv("/api/muallim/plan-lekcija", {
    method: "POST",
    body: JSON.stringify({ grupaId, datum: DATUM, cas: 99, lekcijaNaslov: "Abdest" }),
  }, token);
  assert.equal(odgovor.status, 400);
});

test("muallim bez pristupa grupi ne može mijenjati njen plan", async () => {
  const spisak = await poziv(`/api/muallim/plan-lekcija?grupaId=${grupaId}`, { method: "GET" }, token);
  const plan = await spisak.json() as PlanOdgovor[];

  const patch = await poziv(`/api/muallim/plan-lekcija/${plan[0].id}`, {
    method: "PATCH",
    body: JSON.stringify({ lekcijaTip: "obrada" }),
  }, drugiToken);
  assert.equal(patch.status, 403);

  const brisanje = await poziv(`/api/muallim/plan-lekcija/${plan[0].id}`, { method: "DELETE" }, drugiToken);
  assert.equal(brisanje.status, 403);
});

test("bez broja časa unos i dalje pamti redoslijed kao prije", async () => {
  const odgovor = await poziv("/api/muallim/plan-lekcija", {
    method: "POST",
    body: JSON.stringify({ grupaId, datum: "2026-10-14", lekcijaNaslov: "Post", redoslijed: 2 }),
  }, token);
  assert.equal(odgovor.status, 201);
  const upisan = await odgovor.json() as PlanOdgovor;
  assert.equal(upisan.redoslijed, 2);
  assert.equal(upisan.cas, 3);
});
