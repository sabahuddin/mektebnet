import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  mektebiTable,
  pretplateTable,
  kvizoviTable,
  ilmihalLekcijeTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/korisnici
router.get("/korisnici", async (req, res) => {
  try {
    const korisnici = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      lastLoginAt: usersTable.lastLoginAt,
    }).from(usersTable);
    res.json(korisnici);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/statistike
router.get("/statistike", async (req, res) => {
  try {
    const sviKorisnici = await db.select({ role: usersTable.role }).from(usersTable);
    const counts = sviKorisnici.reduce((acc: Record<string, number>, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    const mektebi = await db.select().from(mektebiTable);
    const pretplate = await db.select().from(pretplateTable);

    res.json({
      korisnici: counts,
      ukupnoKorisnika: sviKorisnici.length,
      ukupnoMekteba: mektebi.length,
      aktivnePretplate: pretplate.filter(p => p.status === "active").length,
    });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/muallim - create muallim account
router.post("/muallim", async (req, res) => {
  try {
    const { username, password, displayName, email, licenceCount, mektebId } = req.body;

    const exists = await db.select().from(usersTable).where(eq(usersTable.username, username.trim().toLowerCase()));
    if (exists.length > 0) {
      res.status(409).json({ error: "Korisničko ime zauzeto" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(usersTable).values({
      username: username.trim().toLowerCase(),
      email: email || null,
      passwordHash,
      displayName: displayName.trim(),
      role: "muallim",
    }).returning();

    await db.insert(muallimProfiliTable).values({
      userId: newUser.id,
      mektebId: mektebId || null,
      licenceCount: licenceCount || 30,
      licencesUsed: 0,
    });

    res.status(201).json({ ...newUser, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/korisnici/:id - update user
router.put("/korisnici/:id", async (req, res) => {
  try {
    const { displayName, email, isActive, role } = req.body;
    const [updated] = await db.update(usersTable)
      .set({ displayName, email, isActive, role })
      .where(eq(usersTable.id, parseInt(req.params.id)))
      .returning();
    res.json({ ...updated, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/muallim/:id/licence - set licence count
router.put("/muallim/:id/licence", async (req, res) => {
  try {
    const { licenceCount } = req.body;
    const [updated] = await db.update(muallimProfiliTable)
      .set({ licenceCount })
      .where(eq(muallimProfiliTable.userId, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET/POST /api/admin/mektebi
router.get("/mektebi", async (req, res) => {
  const lista = await db.select().from(mektebiTable);
  res.json(lista);
});

router.post("/mektebi", async (req, res) => {
  try {
    const [novi] = await db.insert(mektebiTable).values(req.body).returning();
    res.status(201).json(novi);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/ilmihal/:id — Update lesson content
router.put("/ilmihal/:id", async (req, res) => {
  try {
    const { contentHtml, naslov, kvizPitanja } = req.body;
    const updates: Record<string, any> = {};
    if (contentHtml !== undefined) updates.contentHtml = contentHtml;
    if (naslov !== undefined) updates.naslov = naslov;
    if (kvizPitanja !== undefined) {
      updates.kvizPitanja = typeof kvizPitanja === "string" ? kvizPitanja : JSON.stringify(kvizPitanja);
    }
    await db.update(ilmihalLekcijeTable).set(updates).where(eq(ilmihalLekcijeTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/kvizovi/:id — Update quiz questions/title
router.put("/kvizovi/:id", async (req, res) => {
  try {
    const { pitanja, naslov, isPublished } = req.body;
    const updates: Record<string, any> = {};
    if (pitanja !== undefined) {
      updates.pitanja = typeof pitanja === "string" ? pitanja : JSON.stringify(pitanja);
    }
    if (naslov !== undefined) updates.naslov = naslov;
    if (isPublished !== undefined) updates.isPublished = isPublished;
    await db.update(kvizoviTable).set(updates).where(eq(kvizoviTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
