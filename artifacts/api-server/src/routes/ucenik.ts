import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  ucenikProfiliTable,
  grupeTable,
  ocjeneTable,
  priustvoTable,
  mektebKalendarTable,
  planLekcijaTable,
  kvizRezultatiTable,
} from "@workspace/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth, requireRole("ucenik"));

// GET /api/ucenik/profil — student's own profile + stats
router.get("/profil", async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [user] = await db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      username: usersTable.username,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, userId));

    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));

    let grupa = null;
    let muallim = null;
    if (profil?.grupaId) {
      const [g] = await db.select().from(grupeTable).where(eq(grupeTable.id, profil.grupaId));
      grupa = g || null;
    }
    if (profil?.muallimId) {
      const [m] = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
        .from(usersTable).where(eq(usersTable.id, profil.muallimId));
      muallim = m || null;
    }

    const ocjene = await db.select().from(ocjeneTable)
      .where(eq(ocjeneTable.ucenikId, userId))
      .orderBy(desc(ocjeneTable.createdAt));

    const prisustvo = await db.select().from(priustvoTable)
      .where(eq(priustvoTable.ucenikId, userId))
      .orderBy(desc(priustvoTable.createdAt));

    const kvizovi = await db.select().from(kvizRezultatiTable)
      .where(eq(kvizRezultatiTable.userId, userId))
      .orderBy(desc(kvizRezultatiTable.completedAt))
      .limit(50);

    res.json({ user, profil, grupa, muallim, ocjene, prisustvo, kvizovi });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/kalendar — student sees their group calendar
router.get("/kalendar", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
    if (!profil?.grupaId) { res.json([]); return; }

    const entries = await db.select().from(mektebKalendarTable)
      .where(eq(mektebKalendarTable.grupaId, profil.grupaId))
      .orderBy(asc(mektebKalendarTable.datum));

    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/ucenik/plan-lekcija — student sees lesson plan for their group
router.get("/plan-lekcija", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
    if (!profil?.grupaId) { res.json([]); return; }

    const datum = req.query.datum as string;
    const where = datum
      ? and(eq(planLekcijaTable.grupaId, profil.grupaId), eq(planLekcijaTable.datum, datum))
      : eq(planLekcijaTable.grupaId, profil.grupaId);

    const lekcije = await db.select().from(planLekcijaTable)
      .where(where)
      .orderBy(asc(planLekcijaTable.datum), asc(planLekcijaTable.redoslijed));

    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
