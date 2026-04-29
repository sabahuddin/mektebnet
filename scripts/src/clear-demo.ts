import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  grupeTable,
  mektebiTable,
  priustvoTable,
  ocjeneTable,
  mektebKalendarTable,
  planLekcijaTable,
  zadaceTable,
  kvizRezultatiTable,
  studentProgressTable,
  korisnikNapredakTable,
  posjeteTable,
  exerciseSessionsTable,
  roditeljUcenikTable,
} from "@workspace/db";
import { eq, like, inArray } from "drizzle-orm";

export async function clearDemoData(verbose = true) {
  const log = (msg: string) => verbose && console.log(msg);

  const demoUsers = await db.select({ id: usersTable.id }).from(usersTable).where(like(usersTable.username, "demo.%"));
  const demoUserIds = demoUsers.map(u => u.id);
  log(`  Pronađeno demo korisnika: ${demoUserIds.length}`);

  const demoGrupe = await db.select({ id: grupeTable.id }).from(grupeTable).where(like(grupeTable.naziv, "Demo - %"));
  const demoGrupaIds = demoGrupe.map(g => g.id);
  log(`  Pronađeno demo grupa: ${demoGrupaIds.length}`);

  const demoMektebi = await db.select({ id: mektebiTable.id }).from(mektebiTable).where(eq(mektebiTable.naziv, "Demo Mekteb"));
  const demoMektebIds = demoMektebi.map(m => m.id);

  if (demoUserIds.length > 0) {
    const demoUserIdStrings = demoUserIds.map(String);

    await db.delete(priustvoTable).where(inArray(priustvoTable.ucenikId, demoUserIds));
    await db.delete(ocjeneTable).where(inArray(ocjeneTable.ucenikId, demoUserIds));
    await db.delete(kvizRezultatiTable).where(inArray(kvizRezultatiTable.userId, demoUserIds));
    await db.delete(studentProgressTable).where(inArray(studentProgressTable.studentId, demoUserIdStrings));
    await db.delete(korisnikNapredakTable).where(inArray(korisnikNapredakTable.userId, demoUserIds));
    await db.delete(exerciseSessionsTable).where(inArray(exerciseSessionsTable.studentId, demoUserIdStrings));
    await db.delete(posjeteTable).where(inArray(posjeteTable.userId, demoUserIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.ucenikId, demoUserIds));
    await db.delete(roditeljUcenikTable).where(inArray(roditeljUcenikTable.roditeljId, demoUserIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, demoUserIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, demoUserIds));

    await db.delete(priustvoTable).where(inArray(priustvoTable.muallimId, demoUserIds));
    await db.delete(ocjeneTable).where(inArray(ocjeneTable.muallimId, demoUserIds));
    await db.delete(mektebKalendarTable).where(inArray(mektebKalendarTable.muallimId, demoUserIds));
    await db.delete(planLekcijaTable).where(inArray(planLekcijaTable.muallimId, demoUserIds));
    await db.delete(zadaceTable).where(inArray(zadaceTable.muallimId, demoUserIds));
  }

  if (demoGrupaIds.length > 0) {
    await db.delete(priustvoTable).where(inArray(priustvoTable.grupaId, demoGrupaIds));
    await db.delete(mektebKalendarTable).where(inArray(mektebKalendarTable.grupaId, demoGrupaIds));
    await db.delete(planLekcijaTable).where(inArray(planLekcijaTable.grupaId, demoGrupaIds));
    await db.delete(zadaceTable).where(inArray(zadaceTable.grupaId, demoGrupaIds));
    await db.delete(grupeTable).where(inArray(grupeTable.id, demoGrupaIds));
  }

  if (demoUserIds.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, demoUserIds));
  }

  if (demoMektebIds.length > 0) {
    await db.delete(mektebiTable).where(inArray(mektebiTable.id, demoMektebIds));
  }

  log("✅ Demo podaci obrisani.");
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  console.log("🧹 Brišem demo podatke...");
  clearDemoData()
    .then(() => process.exit(0))
    .catch(err => { console.error("❌ Greška:", err); process.exit(1); });
}
