import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, muallimProfiliTable, porukeTable } from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

const suffix = `pitanja-${Date.now()}`;
let server: Server;
let baseUrl: string;
const ids: number[] = [];
let adminId: number;
let teacherId: number;
let otherTeacherId: number;

async function createUser(role: "muallim" | "admin", label: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${suffix}`,
    displayName: `${label} ${suffix}`,
    passwordHash: "test-only",
    role,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
  }).returning({ id: usersTable.id });
  ids.push(user.id);
  if (role === "muallim") {
    await db.insert(muallimProfiliTable).values({ userId: user.id, isGlavni: false });
  }
  return user.id;
}

function tokenFor(id: number, role: "muallim" | "admin", label: string) {
  return signToken({ userId: id, username: `${label}.${suffix}`, displayName: label, role });
}

async function request(path: string, token: string, method = "GET", body?: object) {
  return fetch(`${baseUrl}/api/poruke${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  teacherId = await createUser("muallim", "teacher");
  otherTeacherId = await createUser("muallim", "other");
  adminId = await createUser("admin", "admin");
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
  if (ids.length) {
    await db.delete(porukeTable).where(inArray(porukeTable.posiljateljId, ids));
    await db.delete(porukeTable).where(inArray(porukeTable.primateljId, ids));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));
  }
});

test("obični muallim piše adminu privatno, admin odgovara; drugi muallim ne vidi razgovor", async () => {
  const teacher = tokenFor(teacherId, "muallim", "teacher");
  const other = tokenFor(otherTeacherId, "muallim", "other");
  const admin = tokenFor(adminId, "admin", "admin");

  const contactsResponse = await request("/kontakti", teacher);
  assert.equal(contactsResponse.status, 200);
  const contacts = await contactsResponse.json() as { id: number; role: string }[];
  assert.ok(contacts.some(c => c.id === adminId && c.role === "admin"));
  assert.ok(!contacts.some(c => c.id === otherTeacherId));

  const sent = await request("/", teacher, "POST", { primateljId: adminId, naslov: "Prijedlog", sadrzaj: "Moj prijedlog" });
  assert.equal(sent.status, 201, await sent.clone().text());
  assert.equal((await sent.json() as { naslov: string }).naslov, "Prijedlog");

  const forbidden = await request("/", teacher, "POST", { primateljId: otherTeacherId, naslov: "Poruka", sadrzaj: "Test" });
  assert.equal(forbidden.status, 403);

  const inbox = await request("/", admin);
  assert.equal(inbox.status, 200);
  assert.ok((await inbox.json() as { saKorisnikom: { id: number } }[])
    .some(conversation => conversation.saKorisnikom.id === teacherId));

  const reply = await request("/", admin, "POST", { primateljId: teacherId, naslov: "Poruka", sadrzaj: "Odgovor admina" });
  assert.equal(reply.status, 201, await reply.clone().text());

  const conversation = await request(`/razgovor/${adminId}`, teacher);
  assert.equal(conversation.status, 200);
  assert.deepEqual((await conversation.json() as { poruke: { sadrzaj: string }[] }).poruke.map(p => p.sadrzaj),
    ["Moj prijedlog", "Odgovor admina"]);

  const outsider = await request(`/razgovor/${adminId}`, other);
  assert.equal(outsider.status, 200);
  assert.deepEqual((await outsider.json() as { poruke: unknown[] }).poruke, []);
});