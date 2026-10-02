import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  grupeTable,
  mektebiTable,
  muallimProfiliTable,
  porukeTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  ucenikProfiliTable,
  usersTable,
} from "@workspace/db/schema";
import app from "../app.js";
import { signToken } from "../middlewares/auth.js";

// The API test script sets NODE_ENV=test, which makes sendPushNotification
// return before any provider request is attempted.
assert.equal(process.env.NODE_ENV, "test", "Run this test with NODE_ENV=test");

const suffix = `poruke-parent-${Date.now()}`;
const userIds: number[] = [];
const grupaIds: number[] = [];
let mektebId: number;
let foreignMektebId: number;
let server: Server;
let baseUrl: string;
const personIds: Record<string, number> = {};
const tokens: Record<string, string> = {};

async function createUser(role: "muallim" | "ucenik" | "roditelj", label: string) {
  const [user] = await db.insert(usersTable).values({
    username: `${label}.${suffix}`,
    displayName: `${label} ${suffix}`,
    passwordHash: "test-only",
    role,
    isActive: true,
    termsAcceptedAt: new Date(),
    privacyAcknowledgedAt: new Date(),
    administratorDeclarationAcceptedAt: new Date(),
    parentAcknowledgedAt: new Date(),
  }).returning({ id: usersTable.id });
  userIds.push(user.id);
  personIds[label] = user.id;
  tokens[label] = signToken({
    userId: user.id,
    username: `${label}.${suffix}`,
    role,
    displayName: label,
  });
  return user.id;
}

async function createParentStudentLink(parentId: number, studentId: number, status: "approved" | "pending") {
  await db.insert(roditeljUcenikTable).values({
    roditeljId: parentId,
    ucenikId: studentId,
    status,
    ...(status === "approved" ? { approvedAt: new Date(), approvedBy: personIds.head } : {}),
  });
}

async function postAs(label: string, body: unknown) {
  return fetch(`${baseUrl}/api/poruke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens[label]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function inboxAs(label: string) {
  return fetch(`${baseUrl}/api/poruke`, {
    headers: { Authorization: `Bearer ${tokens[label]}` },
  });
}

async function createGroup(ownerId: number, label: string) {
  const [group] = await db.insert(grupeTable).values({
    muallimId: ownerId,
    naziv: `${label}-${suffix}`,
    skolskaGodina: "2026/27",
    isActive: true,
  }).returning({ id: grupeTable.id });
  grupaIds.push(group.id);
  return group.id;
}

before(async () => {
  const [mekteb] = await db.insert(mektebiTable).values({ naziv: suffix }).returning({ id: mektebiTable.id });
  const [foreignMekteb] = await db.insert(mektebiTable).values({ naziv: `${suffix}-foreign` })
    .returning({ id: mektebiTable.id });
  mektebId = mekteb.id;
  foreignMektebId = foreignMekteb.id;

  const headId = await createUser("muallim", "head");
  const teacherId = await createUser("muallim", "teacher");
  const ownerId = await createUser("muallim", "owner");
  const foreignTeacherId = await createUser("muallim", "foreign-teacher");
  for (const [userId, isGlavni, schoolId] of [
    [headId, true, mektebId],
    [teacherId, false, mektebId],
    [ownerId, false, mektebId],
    [foreignTeacherId, false, foreignMektebId],
  ] as const) {
    await db.insert(muallimProfiliTable).values({ userId, isGlavni, mektebId: schoolId });
  }

  const ownedStudentId = await createUser("ucenik", "owned-student");
  const collabStudentId = await createUser("ucenik", "collab-student");
  const headScopeStudentId = await createUser("ucenik", "head-scope-student");
  const unrelatedStudentId = await createUser("ucenik", "unrelated-student");
  await db.insert(ucenikProfiliTable).values([
    { userId: ownedStudentId, muallimId: teacherId },
    { userId: collabStudentId, muallimId: ownerId },
    { userId: headScopeStudentId, muallimId: ownerId },
    { userId: unrelatedStudentId, muallimId: foreignTeacherId },
  ]);

  const collabGroupId = await createGroup(ownerId, "collab");
  const headScopeGroupId = await createGroup(ownerId, "head-scope");
  const foreignGroupId = await createGroup(foreignTeacherId, "foreign");
  await db.update(ucenikProfiliTable).set({ grupaId: collabGroupId }).where(eq(ucenikProfiliTable.userId, collabStudentId));
  await db.update(ucenikProfiliTable).set({ grupaId: headScopeGroupId }).where(eq(ucenikProfiliTable.userId, headScopeStudentId));
  await db.update(ucenikProfiliTable).set({ grupaId: foreignGroupId }).where(eq(ucenikProfiliTable.userId, unrelatedStudentId));
  await db.execute(sql`
    INSERT INTO grupa_muallimi (grupa_id, muallim_id)
    VALUES (${collabGroupId}, ${teacherId})
  `);

  const ownedParentId = await createUser("roditelj", "owned-parent");
  const collabParentId = await createUser("roditelj", "collab-parent");
  const headScopeParentId = await createUser("roditelj", "head-scope-parent");
  const pendingParentId = await createUser("roditelj", "pending-parent");
  const unrelatedParentId = await createUser("roditelj", "unrelated-parent");
  await db.insert(roditeljProfiliTable).values([
    { userId: ownedParentId },
    { userId: collabParentId },
    { userId: headScopeParentId },
    { userId: pendingParentId },
    { userId: unrelatedParentId },
  ]);
  await createParentStudentLink(ownedParentId, ownedStudentId, "approved");
  await createParentStudentLink(collabParentId, collabStudentId, "approved");
  await createParentStudentLink(headScopeParentId, headScopeStudentId, "approved");
  await createParentStudentLink(pendingParentId, ownedStudentId, "pending");
  await createParentStudentLink(unrelatedParentId, unrelatedStudentId, "approved");

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
  if (userIds.length) {
    await db.delete(porukeTable).where(inArray(porukeTable.posiljateljId, userIds));
    await db.delete(porukeTable).where(inArray(porukeTable.primateljId, userIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.roditeljId, userIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, userIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, userIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, userIds));
  }
  if (grupaIds.length) {
    for (const grupaId of grupaIds) {
      await db.execute(sql`DELETE FROM grupa_muallimi WHERE grupa_id = ${grupaId}`);
    }
    await db.delete(grupeTable).where(inArray(grupeTable.id, grupaIds));
  }
  if (userIds.length) {
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  if (mektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, mektebId));
  if (foreignMektebId) await db.delete(mektebiTable).where(eq(mektebiTable.id, foreignMektebId));
});

test("muallim šalje roditeljima samo unutar odobrenog opsega kontakata", async () => {
  const allowedSenders = [
    { sender: "teacher", parent: "owned-parent", content: "Poruka roditelju učenika bez grupe" },
    { sender: "teacher", parent: "collab-parent", content: "Poruka roditelju učenika iz saradničke grupe" },
    { sender: "head", parent: "head-scope-parent", content: "Poruka roditelju učenika iz mekteba" },
  ];

  for (const [index, item] of allowedSenders.entries()) {
    const parentId = personIds[item.parent];
    const senderId = personIds[item.sender];
    const response = await postAs(item.sender, {
      primateljId: String(parentId),
      naslov: `Test ${index}`,
      sadrzaj: item.content,
      posiljateljId: personIds["foreign-teacher"],
    });
    assert.equal(response.status, 201, await response.clone().text());
    const message = await response.json() as {
      posiljateljId: number;
      primateljId: number;
      sadrzaj: string;
    };
    assert.equal(message.posiljateljId, senderId, "sender identity must come from authentication, not request body");
    assert.equal(message.primateljId, parentId);
    assert.equal(message.sadrzaj, item.content);

    const inbox = await inboxAs(item.parent);
    assert.equal(inbox.status, 200, await inbox.clone().text());
    const conversations = await inbox.json() as Array<{
      saKorisnikom: { id: number };
      zadnjaPoruka: { posiljateljId: number; primateljId: number; sadrzaj: string };
    }>;
    assert.ok(conversations.some(conversation =>
      conversation.saKorisnikom.id === senderId
      && conversation.zadnjaPoruka.posiljateljId === senderId
      && conversation.zadnjaPoruka.primateljId === parentId
      && conversation.zadnjaPoruka.sadrzaj === item.content
    ), `${item.parent} inbox should contain the sent message`);
  }

  for (const parent of ["pending-parent", "unrelated-parent"]) {
    const response = await postAs("teacher", {
      primateljId: personIds[parent],
      sadrzaj: "Ne smije biti poslano",
    });
    assert.equal(response.status, 403, `${parent}: ${await response.text()}`);
  }

  const blank = await postAs("teacher", {
    primateljId: personIds["owned-parent"],
    sadrzaj: " \n\t ",
  });
  assert.equal(blank.status, 400);

  for (const invalidId of [0, -1, 1.5, "12abc", ""]) {
    const response = await postAs("teacher", {
      primateljId: invalidId,
      sadrzaj: "Validan tekst",
    });
    assert.equal(response.status, 400, `invalid target ${JSON.stringify(invalidId)}`);
  }

  const nonString = await postAs("teacher", {
    primateljId: personIds["owned-parent"],
    sadrzaj: { text: "not a string" },
  });
  assert.equal(nonString.status, 400);
});