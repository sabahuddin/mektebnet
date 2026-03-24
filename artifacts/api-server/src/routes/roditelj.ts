import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  ucenikProfiliTable,
  roditeljUcenikTable,
  priustvoTable,
  ocjeneTable,
  korisnikNapredakTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth, requireRole("roditelj", "admin"));

// GET /api/roditelj/djeca - list children
router.get("/djeca", async (req, res) => {
  try {
    const veze = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.roditeljId, req.user!.userId), eq(roditeljUcenikTable.status, "approved")));

    if (veze.length === 0) { res.json([]); return; }

    const ucenikIds = veze.map(v => v.ucenikId);
    const djeca = await db.select().from(usersTable).where(inArray(usersTable.id, ucenikIds));
    const profili = await db.select().from(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, ucenikIds));

    res.json(djeca.map(d => ({
      ...d,
      passwordHash: undefined,
      profil: profili.find(p => p.userId === d.id),
    })));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/roditelj/link-dijete - request to link to a child
router.post("/link-dijete", async (req, res) => {
  try {
    const { ucenikUsername } = req.body;
    if (!ucenikUsername) {
      res.status(400).json({ error: "Unesite korisničko ime djeteta" });
      return;
    }

    const [ucenik] = await db.select().from(usersTable)
      .where(and(eq(usersTable.username, ucenikUsername.trim().toLowerCase()), eq(usersTable.role, "ucenik")));

    if (!ucenik) {
      res.status(404).json({ error: "Učenik s tim korisničkim imenom nije pronađen" });
      return;
    }

    // Check if already linked
    const existing = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.roditeljId, req.user!.userId), eq(roditeljUcenikTable.ucenikId, ucenik.id)));

    if (existing.length > 0) {
      res.status(409).json({ error: "Zahtjev već postoji", status: existing[0].status });
      return;
    }

    const [nova] = await db.insert(roditeljUcenikTable).values({
      roditeljId: req.user!.userId,
      ucenikId: ucenik.id,
      status: "pending",
    }).returning();

    res.status(201).json({ success: true, request: nova, ucenikName: ucenik.displayName });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/napredak/:ucenikId
router.get("/napredak/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);

    // Check that roditelj is approved for this child
    const [veza] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved"),
      ));

    if (!veza) {
      res.status(403).json({ error: "Nemate pristup ovom učeniku" });
      return;
    }

    const napredak = await db.select().from(korisnikNapredakTable).where(eq(korisnikNapredakTable.userId, ucenikId));
    res.json(napredak);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/prisustvo/:ucenikId
router.get("/prisustvo/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const [veza] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (!veza) { res.status(403).json({ error: "Nemate pristup" }); return; }

    const prisustvo = await db.select().from(priustvoTable).where(eq(priustvoTable.ucenikId, ucenikId));
    res.json(prisustvo);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/ocjene/:ucenikId
router.get("/ocjene/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const [veza] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (!veza) { res.status(403).json({ error: "Nemate pristup" }); return; }

    const ocjene = await db.select().from(ocjeneTable).where(eq(ocjeneTable.ucenikId, ucenikId));
    res.json(ocjene);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
