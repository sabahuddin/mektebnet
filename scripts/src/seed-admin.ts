/**
 * Seed: creates the initial admin user + first muallim for testing
 */
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, muallimProfiliTable, mektebiTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  console.log("🌱 Seeding admin user...");

  // Create admin
  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash("admin123", 10);
    await db.insert(usersTable).values({
      username: "admin",
      displayName: "Administrator",
      email: "admin@mekteb.net",
      passwordHash: hash,
      role: "admin",
    });
    console.log("✅ Admin user created: admin / admin123");
  } else {
    console.log("⏭ Admin already exists");
  }

  // Create test mekteb
  let mektebId: number;
  const existingMekteb = await db.select().from(mektebiTable).where(eq(mektebiTable.naziv, "Mekteb Testni"));
  if (existingMekteb.length === 0) {
    const [mekteb] = await db.insert(mektebiTable).values({
      naziv: "Mekteb Testni",
      grad: "Sarajevo",
      kontaktEmail: "test@mekteb.net",
    }).returning();
    mektebId = mekteb.id;
    console.log("✅ Test mekteb created");
  } else {
    mektebId = existingMekteb[0].id;
    console.log("⏭ Test mekteb already exists");
  }

  // Create test muallim
  const existingMuallim = await db.select().from(usersTable).where(eq(usersTable.username, "muallim1"));
  if (existingMuallim.length === 0) {
    const hash = await bcrypt.hash("muallim123", 10);
    const [muallim] = await db.insert(usersTable).values({
      username: "muallim1",
      displayName: "Muallim Test",
      email: "muallim@mekteb.net",
      passwordHash: hash,
      role: "muallim",
    }).returning();

    await db.insert(muallimProfiliTable).values({
      userId: muallim.id,
      mektebId,
      licenceCount: 50,
      licencesUsed: 0,
      tekucaSkolskaGodina: "2024/2025",
    });
    console.log("✅ Test muallim created: muallim1 / muallim123");
  } else {
    console.log("⏭ Test muallim already exists");
  }

  console.log("\n🎉 Done!");
  process.exit(0);
}

seedAdmin().catch(err => { console.error(err); process.exit(1); });
