import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { mektebiTable, muallimProfiliTable, pretplateTable, ucenikProfiliTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { assertStudentCapacity, LicenceLimitError } from "./district-licences.js";

test("district seats are shared across teachers and archived students free a seat", async () => {
  const name = `shared-seats-${Date.now()}`;
  const [main, colleague, student] = await Promise.all(
    ["main", "colleague", "student"].map(async (part) => {
      const [row] = await db.insert(usersTable).values({
        username: `${name}-${part}`, displayName: part, passwordHash: "x",
        role: part === "student" ? "ucenik" : "muallim", isActive: true,
      }).returning({ id: usersTable.id });
      return row;
    }),
  );
  let districtId: number | undefined;
  let subscriptionId: number | undefined;
  try {
    const [district] = await db.insert(mektebiTable).values({
      naziv: name, glavniMuallimId: main.id,
    }).returning({ id: mektebiTable.id });
    districtId = district.id;
    await db.insert(muallimProfiliTable).values([
      { userId: main.id, mektebId: district.id, isGlavni: true, licenceCount: 1 },
      { userId: colleague.id, mektebId: district.id, licenceCount: 1 },
    ]);
    const [subscription] = await db.insert(pretplateTable).values({
      userId: main.id, planType: "standard", status: "active", licencesPurchased: 1,
    }).returning({ id: pretplateTable.id });
    subscriptionId = subscription.id;
    await db.transaction(async (tx) => {
      assert.equal(await assertStudentCapacity(tx, colleague.id), district.id);
    });
    await db.insert(ucenikProfiliTable).values({
      userId: student.id, muallimId: main.id, mektebId: district.id,
    });
    await assert.rejects(
      db.transaction(async (tx) => assertStudentCapacity(tx, colleague.id)),
      LicenceLimitError,
    );
    await db.update(ucenikProfiliTable).set({ isArchived: true })
      .where(eq(ucenikProfiliTable.userId, student.id));
    await db.transaction(async (tx) => {
      assert.equal(await assertStudentCapacity(tx, colleague.id), district.id);
    });
  } finally {
    await db.delete(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, student.id));
    if (subscriptionId) await db.delete(pretplateTable).where(eq(pretplateTable.id, subscriptionId));
    await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, main.id));
    await db.delete(muallimProfiliTable).where(eq(muallimProfiliTable.userId, colleague.id));
    if (districtId) await db.delete(mektebiTable).where(eq(mektebiTable.id, districtId));
    for (const id of [main.id, colleague.id, student.id]) {
      await db.delete(usersTable).where(eq(usersTable.id, id));
    }
  }
});