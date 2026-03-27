import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  ucenikProfiliTable,
  roditeljUcenikTable,
  priustvoTable,
  ocjeneTable,
  korisnikNapredakTable,
  grupeTable,
  muallimProfiliTable,
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

async function getOnlineMektebGroup() {
  let [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.naziv, "Online Mekteb"));
  if (grupa) return grupa;

  let [onlineMuallim] = await db.select().from(usersTable).where(eq(usersTable.username, "online.muallim"));
  if (!onlineMuallim) {
    const randomPw = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPw, 10);
    [onlineMuallim] = await db.insert(usersTable).values({
      username: "online.muallim",
      passwordHash,
      displayName: "Online Muallim",
      role: "muallim",
    }).returning();
    await db.insert(muallimProfiliTable).values({
      userId: onlineMuallim.id,
      licenceCount: 9999,
      licencesUsed: 0,
    });
  }

  [grupa] = await db.insert(grupeTable).values({
    muallimId: onlineMuallim.id,
    naziv: "Online Mekteb",
    skolskaGodina: "2024/2025",
    daniNastave: [],
    vrijemeNastave: "",
  }).returning();

  return grupa;
}

function generateUsername(firstName: string): string {
  const clean = firstName.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${clean}.${rand}`;
}

// POST /api/roditelj/dodaj-dijete — create a child account (max 4)
router.post("/dodaj-dijete", async (req, res) => {
  try {
    const { displayName, password } = req.body;
    if (!displayName?.trim() || !password || password.length < 6) {
      res.status(400).json({ error: "Ime i lozinka (min. 6 znakova) su obavezni" });
      return;
    }

    const roditeljId = req.user!.userId;
    const onlineGrupa = await getOnlineMektebGroup();
    const passwordHash = await bcrypt.hash(password, 10);
    const firstName = displayName.trim().split(/\s+/)[0];

    const result = await db.transaction(async (tx) => {
      const existing = await tx.select().from(roditeljUcenikTable)
        .where(and(eq(roditeljUcenikTable.roditeljId, roditeljId), eq(roditeljUcenikTable.status, "approved")));
      if (existing.length >= 4) {
        throw new Error("MAX_CHILDREN");
      }

      let newUser;
      for (let attempt = 0; attempt < 5; attempt++) {
        const username = generateUsername(firstName);
        try {
          [newUser] = await tx.insert(usersTable).values({
            username,
            passwordHash,
            displayName: displayName.trim(),
            role: "ucenik",
          }).returning();
          break;
        } catch (e: any) {
          if (attempt === 4 || !e?.message?.includes("unique")) throw e;
        }
      }
      if (!newUser) throw new Error("USERNAME_COLLISION");

      await tx.insert(ucenikProfiliTable).values({
        userId: newUser.id,
        muallimId: onlineGrupa.muallimId,
        grupaId: onlineGrupa.id,
      });

      await tx.insert(roditeljUcenikTable).values({
        roditeljId,
        ucenikId: newUser.id,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: roditeljId,
      });

      return newUser;
    });

    res.status(201).json({
      id: result.id,
      displayName: result.displayName,
      username: result.username,
    });
  } catch (err: any) {
    if (err?.message === "MAX_CHILDREN") {
      res.status(400).json({ error: "Možete dodati maksimalno 4 djece" });
    } else {
      res.status(500).json({ error: "Greška servera" });
    }
  }
});

// PUT /api/roditelj/dijete-lozinka — change child's password
router.put("/dijete-lozinka", async (req, res) => {
  try {
    const { ucenikId, newPassword } = req.body;
    if (!ucenikId || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "ID djeteta i nova lozinka (min. 6 znakova) su obavezni" });
      return;
    }

    const [veza] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.ucenikId, parseInt(ucenikId)),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (!veza) { res.status(403).json({ error: "Nemate pristup ovom učeniku" }); return; }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, parseInt(ucenikId)));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
