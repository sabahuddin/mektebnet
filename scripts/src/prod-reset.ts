import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  roditeljProfiliTable,
  roditeljUcenikTable,
  grupeTable,
  mektebiTable,
  priustvoTable,
  ocjeneTable,
  mektebKalendarTable,
  planLekcijaTable,
  zadaceTable,
  kvizRezultatiTable,
  studentProgressTable,
  exerciseSessionsTable,
  korisnikNapredakTable,
  certifikatiTable,
  posjeteTable,
  porukeTable,
  pretplateTable,
} from "@workspace/db";
import { inArray, or, notInArray } from "drizzle-orm";
import { seedDemo } from "./seed-demo.js";

async function prodReset() {
  if (process.env["CONFIRM_PROD_RESET"] !== "YES") {
    console.error("❌ ABORTED: Ova skripta briše SVE non-admin korisnike i sve njihove podatke.");
    console.error("   Da potvrdiš pokretanje, postavi env: CONFIRM_PROD_RESET=YES");
    console.error("   Primjer: CONFIRM_PROD_RESET=YES pnpm --filter @workspace/scripts run prod-reset");
    process.exit(1);
  }

  console.log("⚠️  PROD RESET pokrenut — brišem sve non-admin korisnike i ubacujem demo podatke...\n");

  const adminRows = await db.select({ id: usersTable.id, username: usersTable.username, role: usersTable.role }).from(usersTable);
  const adminIds = adminRows.filter(u => u.role === "admin").map(u => u.id);
  const nonAdminIds = adminRows.filter(u => u.role !== "admin").map(u => u.id);

  console.log(`👤 Admin korisnika sačuvano: ${adminIds.length}`);
  adminRows.filter(u => u.role === "admin").forEach(a => console.log(`   - ${a.username}`));
  console.log(`🗑️  Non-admin korisnika za brisanje: ${nonAdminIds.length}\n`);

  if (nonAdminIds.length > 0) {
    const nonAdminIdStrings = nonAdminIds.map(String);

    console.log("  Brišem zavisne podatke...");
    // Per-user data
    await db.delete(kvizRezultatiTable).where(inArray(kvizRezultatiTable.userId, nonAdminIds));
    await db.delete(korisnikNapredakTable).where(inArray(korisnikNapredakTable.userId, nonAdminIds));
    await db.delete(studentProgressTable).where(inArray(studentProgressTable.studentId, nonAdminIdStrings));
    await db.delete(exerciseSessionsTable).where(inArray(exerciseSessionsTable.studentId, nonAdminIdStrings));
    await db.delete(certifikatiTable).where(inArray(certifikatiTable.ucenikId, nonAdminIds));
    await db.delete(priustvoTable).where(or(inArray(priustvoTable.ucenikId, nonAdminIds), inArray(priustvoTable.muallimId, nonAdminIds)));
    await db.delete(ocjeneTable).where(or(inArray(ocjeneTable.ucenikId, nonAdminIds), inArray(ocjeneTable.muallimId, nonAdminIds)));
    await db.delete(porukeTable).where(or(inArray(porukeTable.posiljateljId, nonAdminIds), inArray(porukeTable.primateljId, nonAdminIds)));
    await db.delete(roditeljUcenikTable).where(or(inArray(roditeljUcenikTable.roditeljId, nonAdminIds), inArray(roditeljUcenikTable.ucenikId, nonAdminIds)));
    await db.delete(mektebKalendarTable).where(inArray(mektebKalendarTable.muallimId, nonAdminIds));
    await db.delete(planLekcijaTable).where(inArray(planLekcijaTable.muallimId, nonAdminIds));
    await db.delete(zadaceTable).where(inArray(zadaceTable.muallimId, nonAdminIds));
    await db.delete(grupeTable).where(inArray(grupeTable.muallimId, nonAdminIds));
    await db.delete(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, nonAdminIds));
    await db.delete(muallimProfiliTable).where(inArray(muallimProfiliTable.userId, nonAdminIds));
    await db.delete(roditeljProfiliTable).where(inArray(roditeljProfiliTable.userId, nonAdminIds));
    await db.delete(pretplateTable).where(inArray(pretplateTable.userId, nonAdminIds));
    try { await db.delete(posjeteTable).where(inArray(posjeteTable.userId, nonAdminIds)); } catch {}

    // Final user delete
    console.log("  Brišem korisnike...");
    await db.delete(usersTable).where(inArray(usersTable.id, nonAdminIds));
  }

  // Orphan cleanup — bilo koja grupa/mekteb/zapis koji se referencira na nepostojećeg user-a
  console.log("\n🧹 Brišem orphan zapise (grupe/mektebi bez korisnika)...");
  const remainingUserIds = (await db.select({ id: usersTable.id }).from(usersTable)).map(u => u.id);
  if (remainingUserIds.length > 0) {
    await db.delete(grupeTable).where(notInArray(grupeTable.muallimId, remainingUserIds));
  } else {
    await db.delete(grupeTable);
  }
  // Mektebi: nema FK na user, ali počistimo "sirote" mektebe bez muallima
  const remainingMektebIds = new Set(
    (await db.select({ mektebId: muallimProfiliTable.mektebId }).from(muallimProfiliTable)).map(m => m.mektebId)
  );
  const allMektebi = await db.select({ id: mektebiTable.id }).from(mektebiTable);
  const orphanMektebIds = allMektebi.map(m => m.id).filter(id => !remainingMektebIds.has(id));
  if (orphanMektebIds.length > 0) {
    await db.delete(mektebiTable).where(inArray(mektebiTable.id, orphanMektebIds));
    console.log(`   Obrisano ${orphanMektebIds.length} orphan mekteba`);
  }

  console.log("\n🌱 Sada pokrećem seed-demo za demonstracijske podatke...\n");
  await seedDemo();

  console.log("\n✅ PROD RESET završen.");
  process.exit(0);
}

prodReset().catch(err => {
  console.error("❌ Greška:", err);
  process.exit(1);
});
