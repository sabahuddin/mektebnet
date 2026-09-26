import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  biltenMuallimiCitanjaTable,
  biltenMuallimiTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `bilten-${Date.now()}`;
const previousNodeEnv = process.env.NODE_ENV;
let server: Server;
let baseUrl: string;
let adminId: number;
let firstTeacherId: number;
let secondTeacherId: number;
let parentId: number;
let draftId: number;
const userIds: number[] = [];
const bulletinIds: number[] = [];

async function createUser(role: "admin" | "muallim" | "roditelj", name: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${name}.${suffix}`,
    displayName: `${name} ${suffix}`,
    passwordHash: "test-only",
    role,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  userIds.push(user.id);
  return user.id;
}

function token(id: number, role: "admin" | "muallim" | "roditelj") {
  return signToken({ userId: id, username: `${role}.${suffix}`, role, displayName: role });
}

function call(path: string, jwt: string, method = "GET", body?: object) {
  return fetch(`${baseUrl}/api/bilten-muallimi${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  process.env.NODE_ENV = "test";
  adminId = await createUser("admin", "admin");
  firstTeacherId = await createUser("muallim", "prvi");
  secondTeacherId = await createUser("muallim", "drugi");
  parentId = await createUser("roditelj", "roditelj");
  await new Promise<void>(resolve => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (bulletinIds.length) {
    await db.delete(biltenMuallimiCitanjaTable).where(inArray(biltenMuallimiCitanjaTable.biltenId, bulletinIds));
    await db.delete(biltenMuallimiTable).where(inArray(biltenMuallimiTable.id, bulletinIds));
  }
  if (userIds.length) await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test("nacrt je samo za admina; objavu vide muallimi, s odvojenim stanjem čitanja", async () => {
  const admin = token(adminId, "admin");
  const prvi = token(firstTeacherId, "muallim");
  const drugi = token(secondTeacherId, "muallim");
  const roditelj = token(parentId, "roditelj");

  assert.equal((await call("/", roditelj)).status, 403);
  assert.equal((await call("/", prvi, "POST", { naslov: "Neovlašteno", sadrzaj: "Tekst" })).status, 403);

  const created = await call("/", admin, "POST", { naslov: "Nova obavijest", sadrzaj: "Radimo na tekstu" });
  assert.equal(created.status, 201, await created.clone().text());
  const draft = await created.json() as { id: number; status: string };
  draftId = draft.id;
  bulletinIds.push(draft.id);
  assert.equal(draft.status, "nacrt");

  const edited = await call(`/${draftId}`, admin, "PUT", { naslov: "Izmjene u Mektebu", sadrzaj: "Objavljen tekst" });
  assert.equal(edited.status, 200, await edited.clone().text());
  assert.equal((await call(`/${draftId}`, prvi)).status, 404);
  assert.deepEqual(await (await call("/", prvi)).json(), []);
  assert.equal((await (await call("/neprocitano", prvi)).json() as { count: number }).count, 0);

  const published = await call(`/${draftId}/objavi`, admin, "POST", {});
  assert.equal(published.status, 200, await published.clone().text());
  assert.equal((await published.json() as { status: string }).status, "objavljeno");
  assert.equal((await call(`/${draftId}/objavi`, admin, "POST", {})).status, 409);
  assert.equal((await call(`/${draftId}`, admin, "PUT", { naslov: "Naknadno", sadrzaj: "Ne može" })).status, 409);

  const firstList = await (await call("/", prvi)).json() as { id: number; naslov: string; procitanoAt: string | null }[];
  assert.equal(firstList.length, 1);
  assert.equal(firstList[0].naslov, "Izmjene u Mektebu");
  assert.equal(firstList[0].procitanoAt, null);
  assert.equal((await (await call("/neprocitano", prvi)).json() as { count: number }).count, 1);
  assert.equal((await (await call("/neprocitano", drugi)).json() as { count: number }).count, 1);

  assert.equal((await call(`/${draftId}/procitano`, prvi, "POST", {})).status, 200);
  assert.equal((await call(`/${draftId}/procitano`, prvi, "POST", {})).status, 200);
  assert.equal((await (await call("/neprocitano", prvi)).json() as { count: number }).count, 0);
  assert.equal((await (await call("/neprocitano", drugi)).json() as { count: number }).count, 1);
  assert.equal((await call(`/${draftId}/procitano`, admin, "POST", {})).status, 403);
});