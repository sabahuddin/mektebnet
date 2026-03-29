import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  muallimProfiliTable,
  ucenikProfiliTable,
  grupeTable,
  roditeljUcenikTable,
  priustvoTable,
  ocjeneTable,
  kvizRezultatiTable,
  korisnikNapredakTable,
  mektebKalendarTable,
  planLekcijaTable,
  ilmihalLekcijeTable,
  zadaceTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc, asc, sql, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth, requireRole("muallim", "admin"));

// GET /api/muallim/info
router.get("/info", async (req, res) => {
  try {
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
    res.json({ ...user, profil: profil || null });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/grupe
router.get("/grupe", async (req, res) => {
  try {
    const grupe = await db.select().from(grupeTable).where(eq(grupeTable.muallimId, req.user!.userId));
    res.json(grupe);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/grupe
router.post("/grupe", async (req, res) => {
  try {
    const { naziv, skolskaGodina, daniNastave, vrijemeNastave } = req.body;
    const [nova] = await db.insert(grupeTable).values({
      muallimId: req.user!.userId,
      naziv,
      skolskaGodina,
      daniNastave: daniNastave || [],
      vrijemeNastave,
    }).returning();
    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/grupe/:id
router.put("/grupe/:id", async (req, res) => {
  try {
    const { naziv, skolskaGodina, daniNastave, vrijemeNastave, isActive } = req.body;
    const [updated] = await db.update(grupeTable)
      .set({ naziv, skolskaGodina, daniNastave, vrijemeNastave, isActive })
      .where(and(eq(grupeTable.id, parseInt(req.params.id)), eq(grupeTable.muallimId, req.user!.userId)))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/grupe/:id
router.delete("/grupe/:id", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "admin";

    const grupaWhere = isAdmin
      ? eq(grupeTable.id, grupaId)
      : and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, userId));
    const [grupa] = await db.select().from(grupeTable).where(grupaWhere);
    if (!grupa) { res.status(404).json({ error: "Grupa nije pronađena" }); return; }

    await db.transaction(async (tx) => {
      await tx.update(ucenikProfiliTable)
        .set({ grupaId: null })
        .where(eq(ucenikProfiliTable.grupaId, grupaId));

      await tx.update(ocjeneTable)
        .set({ grupaId: null })
        .where(eq(ocjeneTable.grupaId, grupaId));

      await tx.delete(zadaceTable).where(eq(zadaceTable.grupaId, grupaId));
      await tx.delete(planLekcijaTable).where(eq(planLekcijaTable.grupaId, grupaId));
      await tx.delete(mektebKalendarTable).where(eq(mektebKalendarTable.grupaId, grupaId));
      await tx.delete(priustvoTable).where(eq(priustvoTable.grupaId, grupaId));
      await tx.delete(grupeTable).where(eq(grupeTable.id, grupaId));
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Delete grupa error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenici
router.get("/ucenici", async (req, res) => {
  try {
    const profili = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    if (profili.length === 0) { res.json([]); return; }

    const userIds = profili.map(p => p.userId);
    const korisnici = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
    const grupe = await db.select().from(grupeTable).where(eq(grupeTable.muallimId, req.user!.userId));
    const grupaMap = Object.fromEntries(grupe.map(g => [g.id, g.naziv]));

    const result = korisnici.map(u => {
      const profil = profili.find(p => p.userId === u.id);
      return {
        ...u,
        passwordHash: undefined,
        profil,
        grupaId: profil?.grupaId || null,
        grupaIme: profil?.grupaId ? grupaMap[profil.grupaId] || null : null,
        aktivanStatus: profil ? !profil.isArchived : true,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenici - create a new student
router.post("/ucenici", async (req, res) => {
  try {
    const { displayName, grupaId, password } = req.body;

    // Check licence limit
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    if (profil && profil.licencesUsed >= profil.licenceCount) {
      res.status(403).json({ error: "Dostigli ste maksimalan broj učenika (limit licenci)" });
      return;
    }

    const firstName = displayName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const username = `${firstName}.${rand}`;

    const pass = password || `Mekteb${rand}`;
    const passwordHash = await bcrypt.hash(pass, 10);

    const [newUser] = await db.insert(usersTable).values({
      username,
      passwordHash,
      displayName: displayName.trim(),
      role: "ucenik",
    }).returning();

    await db.insert(ucenikProfiliTable).values({
      userId: newUser.id,
      muallimId: req.user!.userId,
      grupaId: grupaId || null,
    });

    // Increment licences used
    if (profil) {
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: profil.licencesUsed + 1 })
        .where(eq(muallimProfiliTable.userId, req.user!.userId));
    }

    res.status(201).json({ ...newUser, passwordHash: undefined, generatedPassword: pass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ucenici/bulk - create multiple students at once
router.post("/ucenici/bulk", async (req, res) => {
  try {
    const { imena, grupaId } = req.body as { imena: string[]; grupaId?: number };
    if (!imena || !Array.isArray(imena) || imena.length === 0) {
      res.status(400).json({ error: "Listu imena je obavezno poslati" });
      return;
    }

    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    const remaining = profil ? profil.licenceCount - profil.licencesUsed : 999;
    if (imena.length > remaining) {
      res.status(403).json({ error: `Možete dodati još ${remaining} učenika (limit licenci)` });
      return;
    }

    const results = [];
    for (const ime of imena) {
      const trimmed = ime.trim();
      if (!trimmed) continue;
      const firstName = trimmed.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const rand = Math.floor(1000 + Math.random() * 9000);
      const username = `${firstName}.${rand}`;
      const pass = `Mekteb${rand}`;
      const passwordHash = await bcrypt.hash(pass, 10);

      const [newUser] = await db.insert(usersTable).values({
        username, passwordHash, displayName: trimmed, role: "ucenik",
      }).returning();

      await db.insert(ucenikProfiliTable).values({
        userId: newUser.id, muallimId: req.user!.userId, grupaId: grupaId || null,
      });

      results.push({ id: newUser.id, displayName: trimmed, username, generatedPassword: pass });
    }

    if (profil && results.length > 0) {
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: profil.licencesUsed + results.length })
        .where(eq(muallimProfiliTable.userId, req.user!.userId));
    }

    res.status(201).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/ucenici/:id/grupa - move student to different group
router.put("/ucenici/:id/grupa", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const { grupaId } = req.body;
    const [updated] = await db.update(ucenikProfiliTable)
      .set({ grupaId: grupaId || null })
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Učenik nije pronađen" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/ucenici/:id - archive (free licence slot)
router.delete("/ucenici/:id", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    await db.update(ucenikProfiliTable)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(and(eq(ucenikProfiliTable.userId, ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)));

    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, req.user!.userId));
    if (profil && profil.licencesUsed > 0) {
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: profil.licencesUsed - 1 })
        .where(eq(muallimProfiliTable.userId, req.user!.userId));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/prisustvo - save attendance for a date
router.post("/prisustvo", async (req, res) => {
  try {
    const { grupaId, datum, prisustvo } = req.body;
    // prisustvo: [{ ucenikId, status, napomena }]

    for (const p of prisustvo) {
      // Upsert
      const existing = await db.select().from(priustvoTable)
        .where(and(eq(priustvoTable.ucenikId, p.ucenikId), eq(priustvoTable.datum, datum)));

      if (existing.length > 0) {
        await db.update(priustvoTable)
          .set({ status: p.status, napomena: p.napomena })
          .where(eq(priustvoTable.id, existing[0].id));
      } else {
        await db.insert(priustvoTable).values({
          ucenikId: p.ucenikId,
          grupaId,
          muallimId: req.user!.userId,
          datum,
          status: p.status || "prisutan",
          napomena: p.napomena || null,
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/prisustvo?grupaId=X&datum=YYYY-MM-DD
router.get("/prisustvo", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    const datum = req.query.datum as string;
    const where = datum
      ? and(eq(priustvoTable.grupaId, grupaId), eq(priustvoTable.datum, datum))
      : eq(priustvoTable.grupaId, grupaId);
    const records = await db.select().from(priustvoTable).where(where);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/ocjene - add grade
router.post("/ocjene", async (req, res) => {
  try {
    const { ucenikId, grupaId, kategorija, ocjena, lekcijaNaziv, napomena, datum } = req.body;
    const [nova] = await db.insert(ocjeneTable).values({
      ucenikId,
      muallimId: req.user!.userId,
      grupaId,
      kategorija,
      ocjena,
      lekcijaNaziv: lekcijaNaziv || null,
      napomena,
      datum,
    }).returning();
    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ocjene/:ucenikId
router.get("/ocjene/:ucenikId", async (req, res) => {
  try {
    const ocjene = await db.select().from(ocjeneTable)
      .where(and(eq(ocjeneTable.ucenikId, parseInt(req.params.ucenikId)), eq(ocjeneTable.muallimId, req.user!.userId)));
    res.json(ocjene);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/prisustvo-ucenik/:ucenikId - all attendance for one student
router.get("/prisustvo-ucenik/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const records = await db.select().from(priustvoTable)
      .where(and(eq(priustvoTable.ucenikId, ucenikId), eq(priustvoTable.muallimId, req.user!.userId)));
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/approve-roditelj - approve parent-child link
router.post("/approve-roditelj", async (req, res) => {
  try {
    const { roditeljUcenikId, approved } = req.body;

    const [request] = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.id, roditeljUcenikId), eq(roditeljUcenikTable.status, "pending")));
    if (!request) { res.status(404).json({ error: "Zahtjev nije pronađen" }); return; }

    const profili = await db.select().from(ucenikProfiliTable)
      .where(and(eq(ucenikProfiliTable.userId, request.ucenikId), eq(ucenikProfiliTable.muallimId, req.user!.userId)));
    if (profili.length === 0) { res.status(403).json({ error: "Učenik nije vaš" }); return; }

    await db.update(roditeljUcenikTable)
      .set({
        status: approved ? "approved" : "rejected",
        approvedAt: new Date(),
        approvedBy: req.user!.userId,
      })
      .where(eq(roditeljUcenikTable.id, roditeljUcenikId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/pending-roditelji - pending parent link requests with names
router.get("/pending-roditelji", async (req, res) => {
  try {
    const profili = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, req.user!.userId));
    if (profili.length === 0) { res.json([]); return; }
    const ucenikIds = profili.map(p => p.userId);
    const pending = await db.select().from(roditeljUcenikTable)
      .where(and(inArray(roditeljUcenikTable.ucenikId, ucenikIds), eq(roditeljUcenikTable.status, "pending")));

    if (pending.length === 0) { res.json([]); return; }

    const allUserIds = [...new Set(pending.flatMap(p => [p.roditeljId, p.ucenikId]))];
    const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username })
      .from(usersTable).where(inArray(usersTable.id, allUserIds));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = pending.map(p => ({
      ...p,
      roditelj: userMap[p.roditeljId] || { displayName: "Nepoznat", username: "" },
      ucenik: userMap[p.ucenikId] || { displayName: "Nepoznat", username: "" },
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/ucenik-rezultati/:id - quiz results for specific student
router.get("/ucenik-rezultati/:id", async (req, res) => {
  try {
    const muallimId = req.user!.userId;
    const ucenikId = parseInt(req.params.id);

    if (req.user!.role !== "admin") {
      const profili = await db.select().from(ucenikProfiliTable)
        .where(and(
          eq(ucenikProfiliTable.userId, ucenikId),
          eq(ucenikProfiliTable.muallimId, muallimId),
        ));
      if (profili.length === 0) {
        res.status(403).json({ error: "Učenik nije vaš" });
        return;
      }
    }

    const rezultati = await db.select().from(kvizRezultatiTable)
      .where(eq(kvizRezultatiTable.userId, ucenikId))
      .orderBy(desc(kvizRezultatiTable.completedAt));

    const napredak = await db.select().from(korisnikNapredakTable)
      .where(eq(korisnikNapredakTable.userId, ucenikId));

    res.json({ rezultati, napredak });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/svi-rezultati - all students' quiz results
router.get("/svi-rezultati", async (req, res) => {
  try {
    const muallimId = req.user!.userId;

    const profili = await db.select({ userId: ucenikProfiliTable.userId })
      .from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.muallimId, muallimId));

    if (profili.length === 0) { res.json([]); return; }
    const ucenikIds = profili.map(p => p.userId);

    const rezultati = await db.select({
      id: kvizRezultatiTable.id,
      userId: kvizRezultatiTable.userId,
      kvizNaslov: kvizRezultatiTable.kvizNaslov,
      tacniOdgovori: kvizRezultatiTable.tacniOdgovori,
      ukupnoPitanja: kvizRezultatiTable.ukupnoPitanja,
      procenat: kvizRezultatiTable.procenat,
      bodovi: kvizRezultatiTable.bodovi,
      completedAt: kvizRezultatiTable.completedAt,
      displayName: usersTable.displayName,
      username: usersTable.username,
    }).from(kvizRezultatiTable)
      .leftJoin(usersTable, eq(kvizRezultatiTable.userId, usersTable.id))
      .where(inArray(kvizRezultatiTable.userId, ucenikIds))
      .orderBy(desc(kvizRezultatiTable.completedAt))
      .limit(100);

    res.json(rezultati);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── KALENDAR ───────────────────────────────────────────────────────────────────

// Helper: verify group ownership (muallim owns the group, or user is admin)
async function verifyGrupaAccess(grupaId: number, userId: number, userRole: string) {
  if (userRole === "admin") {
    const [grupa] = await db.select().from(grupeTable).where(eq(grupeTable.id, grupaId));
    return grupa || null;
  }
  const [grupa] = await db.select().from(grupeTable).where(and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, userId)));
  return grupa || null;
}

// GET /api/muallim/kalendar?grupaId=X&mjesec=YYYY-MM
router.get("/kalendar", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const entries = await db.select().from(mektebKalendarTable)
      .where(eq(mektebKalendarTable.grupaId, grupaId))
      .orderBy(asc(mektebKalendarTable.datum));

    res.json(entries);
  } catch (err) {
    console.error("Kalendar GET error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/kalendar — add/update calendar entry
router.post("/kalendar", async (req, res) => {
  try {
    const { grupaId, datum, tip, opis } = req.body;
    if (!grupaId || !datum || !tip) { res.status(400).json({ error: "grupaId, datum i tip su obavezni" }); return; }
    if (!["mekteb", "ferije", "vazan_datum"].includes(tip)) { res.status(400).json({ error: "tip mora biti: mekteb, ferije, vazan_datum" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const existing = await db.select().from(mektebKalendarTable)
      .where(and(eq(mektebKalendarTable.grupaId, grupaId), eq(mektebKalendarTable.datum, datum)));

    if (existing.length > 0) {
      const [updated] = await db.update(mektebKalendarTable)
        .set({ tip, opis: opis || null })
        .where(eq(mektebKalendarTable.id, existing[0].id))
        .returning();
      res.json(updated);
    } else {
      const [nova] = await db.insert(mektebKalendarTable).values({
        grupaId, muallimId: req.user!.userId, datum, tip, opis: opis || null,
      }).returning();
      res.status(201).json(nova);
    }
  } catch (err) {
    console.error("Kalendar POST error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/kalendar/batch — mark multiple dates at once
router.post("/kalendar/batch", async (req, res) => {
  try {
    const { grupaId, datumi, tip, opis } = req.body;
    if (!grupaId || !datumi || !Array.isArray(datumi) || datumi.length === 0 || !tip) {
      res.status(400).json({ error: "grupaId, datumi (niz) i tip su obavezni" }); return;
    }
    if (!["mekteb", "ferije", "vazan_datum"].includes(tip)) {
      res.status(400).json({ error: "tip mora biti: mekteb, ferije, vazan_datum" }); return;
    }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const results: any[] = [];
    for (const datum of datumi) {
      const existing = await db.select().from(mektebKalendarTable)
        .where(and(eq(mektebKalendarTable.grupaId, grupaId), eq(mektebKalendarTable.datum, datum)));

      if (existing.length > 0) {
        const [updated] = await db.update(mektebKalendarTable)
          .set({ tip, opis: opis || null })
          .where(eq(mektebKalendarTable.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [nova] = await db.insert(mektebKalendarTable).values({
          grupaId, muallimId: req.user!.userId, datum, tip, opis: opis || null,
        }).returning();
        results.push(nova);
      }
    }
    res.json(results);
  } catch (err) {
    console.error("Kalendar batch error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/kalendar/:id
router.delete("/kalendar/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(mektebKalendarTable).where(eq(mektebKalendarTable.id, id));
    if (!entry || entry.muallimId !== req.user!.userId) { res.status(403).json({ error: "Nemaš pristup" }); return; }
    await db.delete(mektebKalendarTable).where(eq(mektebKalendarTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── PLAN LEKCIJA ────────────────────────────────────────────────────────────────

// GET /api/muallim/plan-lekcija?grupaId=X&datum=YYYY-MM-DD
router.get("/plan-lekcija", async (req, res) => {
  try {
    const grupaId = parseInt(req.query.grupaId as string);
    if (!grupaId) { res.status(400).json({ error: "grupaId obavezan" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const datum = req.query.datum as string;
    const where = datum
      ? and(eq(planLekcijaTable.grupaId, grupaId), eq(planLekcijaTable.datum, datum))
      : eq(planLekcijaTable.grupaId, grupaId);

    const lekcije = await db.select().from(planLekcijaTable)
      .where(where)
      .orderBy(asc(planLekcijaTable.datum), asc(planLekcijaTable.redoslijed));

    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/plan-lekcija — add lesson to day plan
router.post("/plan-lekcija", async (req, res) => {
  try {
    const { grupaId, datum, lekcijaNaslov, lekcijaTip, redoslijed } = req.body;
    if (!grupaId || !datum || !lekcijaNaslov) { res.status(400).json({ error: "grupaId, datum i lekcijaNaslov su obavezni" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const [nova] = await db.insert(planLekcijaTable).values({
      grupaId, muallimId: req.user!.userId, datum, lekcijaNaslov,
      lekcijaTip: lekcijaTip || "ilmihal",
      redoslijed: redoslijed || 0,
    }).returning();

    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// DELETE /api/muallim/plan-lekcija/:id
router.delete("/plan-lekcija/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(planLekcijaTable).where(eq(planLekcijaTable.id, id));
    if (!entry || entry.muallimId !== req.user!.userId) { res.status(403).json({ error: "Nemaš pristup" }); return; }
    await db.delete(planLekcijaTable).where(eq(planLekcijaTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/muallim/lekcije-za-plan — list available lessons for plan assignment
router.get("/lekcije-za-plan", async (req, res) => {
  try {
    const lekcije = await db.select({
      id: ilmihalLekcijeTable.id,
      naslov: ilmihalLekcijeTable.naslov,
      nivo: ilmihalLekcijeTable.nivo,
    }).from(ilmihalLekcijeTable).orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed));

    res.json(lekcije);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/muallim/print-kartice — reset passwords for students and return plaintext for printing
router.post("/print-kartice", async (req, res) => {
  try {
    const { ucenikIds } = req.body as { ucenikIds: number[] };
    if (!ucenikIds || !Array.isArray(ucenikIds) || ucenikIds.length === 0) {
      res.status(400).json({ error: "ucenikIds je obavezan" });
      return;
    }

    const profili = await db.select().from(ucenikProfiliTable)
      .where(and(
        inArray(ucenikProfiliTable.userId, ucenikIds),
        eq(ucenikProfiliTable.muallimId, req.user!.userId)
      ));

    if (profili.length === 0) {
      res.status(403).json({ error: "Nemate pristup ovim učenicima" });
      return;
    }
    const allowedIds = profili.map(p => p.userId);

    const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName, username: usersTable.username })
      .from(usersTable).where(inArray(usersTable.id, allowedIds));

    const results = [];
    for (const u of users) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const newPass = `Mekteb${rand}`;
      const hash = await bcrypt.hash(newPass, 10);
      await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, u.id));
      results.push({ id: u.id, displayName: u.displayName, username: u.username, generatedPassword: newPass });
    }

    res.json(results);
  } catch (err) {
    console.error("Print kartice error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/muallim/profil — update muallim profile (displayName)
router.put("/profil", async (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName || displayName.trim().length < 2) { res.status(400).json({ error: "Ime mora imati minimalno 2 karaktera" }); return; }

    const [updated] = await db.update(usersTable)
      .set({ displayName: displayName.trim() })
      .where(eq(usersTable.id, req.user!.userId))
      .returning();

    res.json({ displayName: updated.displayName });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── STATISTIKA GRUPE ─────────────────────────────────────────────────────────

async function getGrupaFullStats(grupaId: number) {
  const profili = await db.select().from(ucenikProfiliTable)
    .where(and(eq(ucenikProfiliTable.grupaId, grupaId), eq(ucenikProfiliTable.isArchived, false)));
  if (profili.length === 0) return { ucenici: [], ukupnoCasova: 0, svaDatumi: [], mjesecniPregled: [], grupaPrisustvoPct: null, grupaProsjekOcjena: null, aktivnihProslejSedmice: 0, ukupnoKvizova: 0, ukupnoBodovaGrupa: 0, prosjekBodovaGrupa: 0, prisustvoPoDatumu: [] as any[] };

  const ucenikIds = profili.map(p => p.userId);
  const users = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
    .from(usersTable).where(inArray(usersTable.id, ucenikIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u.displayName]));

  const svoPrisustvoRaw = await db.select().from(priustvoTable)
    .where(eq(priustvoTable.grupaId, grupaId));
  const svoPrisustvo = svoPrisustvoRaw.filter(p => ucenikIds.includes(p.ucenikId));
  const sveOcjeneRaw = await db.select().from(ocjeneTable)
    .where(eq(ocjeneTable.grupaId, grupaId));
  const sveOcjene = sveOcjeneRaw.filter(o => ucenikIds.includes(o.ucenikId));
  const kvizRezultati = ucenikIds.length > 0
    ? await db.select().from(kvizRezultatiTable)
        .where(inArray(kvizRezultatiTable.userId, ucenikIds))
    : [];

  const svaDatumi = [...new Set(svoPrisustvo.map(p => p.datum))].sort();
  const ukupnoCasova = svaDatumi.length;

  const mjesecSet = new Set<string>();
  svoPrisustvo.forEach(p => { if (p.datum) mjesecSet.add(p.datum.substring(0, 7)); });
  const mjeseci = [...mjesecSet].sort();

  const ucenici = ucenikIds.map(uid => {
    const prisutvoRec = svoPrisustvo.filter(p => p.ucenikId === uid);
    const prisutanCount = prisutvoRec.filter(p => p.status === "prisutan").length;
    const odsutanCount = prisutvoRec.filter(p => p.status === "odsutan").length;
    const zakasnioCount = prisutvoRec.filter(p => p.status === "zakasnio").length;
    const opravdanCount = prisutvoRec.filter(p => p.status === "opravdan").length;
    const ukupnoPrisustvo = prisutvoRec.length;
    const prisustvoPct = ukupnoPrisustvo > 0 ? Math.round((prisutanCount / ukupnoPrisustvo) * 100) : null;

    const prisustvoPoDatumu: Record<string, string> = {};
    prisutvoRec.forEach(p => { prisustvoPoDatumu[p.datum] = p.status; });

    const mjesecnoStats = mjeseci.map(m => {
      const mRec = prisutvoRec.filter(p => p.datum.startsWith(m));
      const mPrisutan = mRec.filter(p => p.status === "prisutan").length;
      return { mjesec: m, prisutan: mPrisutan, ukupno: mRec.length, pct: mRec.length > 0 ? Math.round((mPrisutan / mRec.length) * 100) : null };
    });

    const ocjeneRec = sveOcjene.filter(o => o.ucenikId === uid);
    const kategorije: Record<string, number[]> = {};
    for (const o of ocjeneRec) {
      if (!kategorije[o.kategorija]) kategorije[o.kategorija] = [];
      kategorije[o.kategorija].push(o.ocjena);
    }
    const prosjecneOcjene: Record<string, number> = {};
    for (const [kat, vals] of Object.entries(kategorije)) {
      prosjecneOcjene[kat] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
    const ukupnaProsjecna = ocjeneRec.length > 0
      ? Math.round((ocjeneRec.reduce((a, o) => a + o.ocjena, 0) / ocjeneRec.length) * 10) / 10
      : null;

    const kvizovi = kvizRezultati.filter(k => k.userId === uid);
    const kvizCount = kvizovi.length;
    const kvizProsjecniProcenat = kvizCount > 0
      ? Math.round(kvizovi.reduce((a, k) => a + k.procenat, 0) / kvizCount)
      : null;
    const ukupnoBodova = kvizovi.reduce((a, k) => a + (k.bodovi || 0), 0);

    const sedmicaDatum = new Date();
    sedmicaDatum.setDate(sedmicaDatum.getDate() - 7);
    const sedmicaStr = sedmicaDatum.toISOString().split("T")[0];
    const kvizovaProslejSedmice = kvizovi.filter(k => k.completedAt && new Date(k.completedAt).toISOString().split("T")[0] >= sedmicaStr).length;

    return {
      id: uid,
      ime: userMap[uid] || "Nepoznat",
      prisustvoPct,
      prisutanCount,
      odsutanCount,
      zakasnioCount,
      opravdanCount,
      ukupnoPrisustvo,
      prisustvoPoDatumu,
      mjesecnoStats,
      prosjecneOcjene,
      ukupnaProsjecna,
      brojOcjena: ocjeneRec.length,
      kvizCount,
      kvizProsjecniProcenat,
      ukupnoBodova,
      kvizovaProslejSedmice,
    };
  });

  const sedmicaDatum = new Date();
  sedmicaDatum.setDate(sedmicaDatum.getDate() - 7);
  const sedmicaStr = sedmicaDatum.toISOString().split("T")[0];
  const aktivnihProslejSedmice = ucenici.filter(u => u.kvizovaProslejSedmice > 0).length;

  const ukupnoKvizova = ucenici.reduce((a, u) => a + u.kvizCount, 0);
  const ukupnoBodovaGrupa = ucenici.reduce((a, u) => a + u.ukupnoBodova, 0);
  const prosjekBodovaGrupa = ucenici.length > 0 ? Math.round(ukupnoBodovaGrupa / ucenici.length) : 0;

  const totalPrisustva = ucenici.reduce((a, u) => a + (u.prisutanCount || 0), 0);
  const totalRecords = ucenici.reduce((a, u) => a + (u.ukupnoPrisustvo || 0), 0);
  const grupaPrisustvoPct = totalRecords > 0 ? Math.round((totalPrisustva / totalRecords) * 100) : null;

  const ocjeneWithVals = ucenici.filter(u => u.ukupnaProsjecna !== null);
  const grupaProsjekOcjena = ocjeneWithVals.length > 0
    ? Math.round((ocjeneWithVals.reduce((a, u) => a + (u.ukupnaProsjecna || 0), 0) / ocjeneWithVals.length) * 10) / 10
    : null;

  const mjesecniPregled = mjeseci.map(m => {
    const mRecs = svoPrisustvo.filter(p => p.datum.startsWith(m));
    const mPrisutan = mRecs.filter(p => p.status === "prisutan").length;
    const mOdsutan = mRecs.filter(p => p.status === "odsutan").length;
    const mZakasnio = mRecs.filter(p => p.status === "zakasnio").length;
    const mOpravdan = mRecs.filter(p => p.status === "opravdan").length;
    return { mjesec: m, prisutan: mPrisutan, odsutan: mOdsutan, zakasnio: mZakasnio, opravdan: mOpravdan, ukupno: mRecs.length, pct: mRecs.length > 0 ? Math.round((mPrisutan / mRecs.length) * 100) : null };
  });

  const prisustvoPoDatumu = svaDatumi.map(d => {
    const recs = svoPrisustvo.filter(p => p.datum === d);
    const perStudent: Record<number, string> = {};
    recs.forEach(r => { perStudent[r.ucenikId] = r.status; });
    const prisutanCount = recs.filter(r => r.status === "prisutan").length;
    return { datum: d, prisutan: prisutanCount, ukupno: recs.length, pct: recs.length > 0 ? Math.round((prisutanCount / recs.length) * 100) : null, perStudent };
  });

  return { ucenici, ukupnoCasova, svaDatumi, mjesecniPregled, grupaPrisustvoPct, grupaProsjekOcjena, aktivnihProslejSedmice, ukupnoKvizova, ukupnoBodovaGrupa, prosjekBodovaGrupa, prisustvoPoDatumu };
}

router.get("/grupa/:id/statistika", async (req, res) => {
  try {
    const grupaId = parseInt(req.params.id);
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }
    const stats = await getGrupaFullStats(grupaId);
    res.json(stats);
  } catch (err) {
    console.error("Statistika error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

function sanitizeExcelCell(val: any): any {
  if (typeof val !== "string") return val;
  if (/^[=+\-@\t\r]/.test(val)) return "'" + val;
  return val;
}

router.get("/grupa/:id/izvjestaj-excel", async (req, res) => {
  try {
    const XLSX = await import("xlsx");
    const grupaId = parseInt(req.params.id);
    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const stats = await getGrupaFullStats(grupaId);
    const wb = XLSX.utils.book_new();

    const prisustvoRows: any[] = [];
    const headerRow: string[] = ["Učenik", ...stats.svaDatumi, "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Ukupno", "%"];
    prisustvoRows.push(headerRow);
    for (const u of stats.ucenici) {
      const row: any[] = [sanitizeExcelCell(u.ime)];
      for (const d of stats.svaDatumi) {
        const st = u.prisustvoPoDatumu[d];
        row.push(st === "prisutan" ? "P" : st === "odsutan" ? "O" : st === "zakasnio" ? "Z" : st === "opravdan" ? "OP" : "");
      }
      row.push(u.prisutanCount, u.odsutanCount, u.zakasnioCount, u.opravdanCount, u.ukupnoPrisustvo, u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—");
      prisustvoRows.push(row);
    }
    if (stats.prisustvoPoDatumu.length > 0) {
      const totalRow: any[] = ["UKUPNO GRUPA"];
      for (const d of stats.prisustvoPoDatumu) {
        totalRow.push(`${d.prisutan}/${d.ukupno}`);
      }
      const tp = stats.ucenici.reduce((a, u) => a + u.prisutanCount, 0);
      const to = stats.ucenici.reduce((a, u) => a + u.odsutanCount, 0);
      const tz = stats.ucenici.reduce((a, u) => a + u.zakasnioCount, 0);
      const top = stats.ucenici.reduce((a, u) => a + u.opravdanCount, 0);
      const tt = stats.ucenici.reduce((a, u) => a + u.ukupnoPrisustvo, 0);
      totalRow.push(tp, to, tz, top, tt, stats.grupaPrisustvoPct !== null ? `${stats.grupaPrisustvoPct}%` : "—");
      prisustvoRows.push(totalRow);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(prisustvoRows);
    ws1["!cols"] = [{ wch: 20 }, ...stats.svaDatumi.map(() => ({ wch: 12 })), { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Prisustvo");

    const mjesecniRows: any[] = [["Mjesec", "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Ukupno", "%"]];
    const MJESEC_NAZIVI: Record<string, string> = { "01": "Januar", "02": "Februar", "03": "Mart", "04": "April", "05": "Maj", "06": "Juni", "07": "Juli", "08": "August", "09": "Septembar", "10": "Oktobar", "11": "Novembar", "12": "Decembar" };
    for (const m of stats.mjesecniPregled) {
      const parts = m.mjesec.split("-");
      const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
      mjesecniRows.push([naziv, m.prisutan, m.odsutan, m.zakasnio, m.opravdan, m.ukupno, m.pct !== null ? `${m.pct}%` : "—"]);
    }
    const ws1b = XLSX.utils.aoa_to_sheet(mjesecniRows);
    ws1b["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 6 }];
    XLSX.utils.book_append_sheet(wb, ws1b, "Prisustvo po mjesecu");

    const sveOcjeneExcel = await db.select().from(ocjeneTable).where(eq(ocjeneTable.grupaId, grupaId));
    const activeIds = new Set(stats.ucenici.map(u => u.id));
    const ocjeneRows: any[] = [["Učenik", "Datum", "Kategorija", "Ocjena", "Lekcija", "Napomena"]];
    for (const u of stats.ucenici) {
      const uocjene = sveOcjeneExcel.filter(o => o.ucenikId === u.id && activeIds.has(o.ucenikId)).sort((a, b) => b.datum.localeCompare(a.datum));
      for (const o of uocjene) {
        ocjeneRows.push([sanitizeExcelCell(u.ime), o.datum, sanitizeExcelCell(o.kategorija), o.ocjena, sanitizeExcelCell(o.lekcijaNaziv || ""), sanitizeExcelCell(o.napomena || "")]);
      }
    }
    const ws2 = XLSX.utils.aoa_to_sheet(ocjeneRows);
    ws2["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Ocjene");

    const summaryRows: any[] = [
      ["IZVJEŠTAJ GRUPE", sanitizeExcelCell((grupa as any).naziv || "")],
      [],
      ["Ukupno učenika", stats.ucenici.length],
      ["Ukupno časova", stats.ukupnoCasova],
      ["Prisustvo grupe (%)", stats.grupaPrisustvoPct !== null ? `${stats.grupaPrisustvoPct}%` : "—"],
      ["Prosječna ocjena grupe", stats.grupaProsjekOcjena || "—"],
      ["Ukupno kvizova", stats.ukupnoKvizova],
      ["Ukupno bodova", stats.ukupnoBodovaGrupa],
      [],
      ["Učenik", "Prisustvo %", "Prisutan", "Odsutan", "Zakasnio", "Opravdan", "Prosj. ocjena", "Br. ocjena", "Kvizova", "Bodova"],
    ];
    for (const u of stats.ucenici) {
      summaryRows.push([
        sanitizeExcelCell(u.ime),
        u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—",
        u.prisutanCount,
        u.odsutanCount,
        u.zakasnioCount,
        u.opravdanCount,
        u.ukupnaProsjecna || "—",
        u.brojOcjena,
        u.kvizCount,
        u.ukupnoBodova,
      ]);
    }
    const ws3 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws3["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Zbirni izvještaj");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const safeNaziv = ((grupa as any).naziv || "grupa").replace(/[^a-zA-Z0-9\u00C0-\u024F\u0100-\u017F_\- ]/g, "").trim().substring(0, 50);
    const filename = `izvjestaj_${safeNaziv}_${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// ── ZADAĆE ───────────────────────────────────────────────────────────────────

router.get("/zadace", async (req, res) => {
  try {
    const grupaId = req.query.grupaId ? parseInt(req.query.grupaId as string) : undefined;
    const where = grupaId
      ? and(eq(zadaceTable.muallimId, req.user!.userId), eq(zadaceTable.grupaId, grupaId))
      : eq(zadaceTable.muallimId, req.user!.userId);
    const zadace = await db.select().from(zadaceTable).where(where).orderBy(desc(zadaceTable.createdAt));
    res.json(zadace);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/zadace", async (req, res) => {
  try {
    const { grupaId, naslov, opis, rokDo, lekcijaNaslov, lekcijaTip } = req.body;
    if (!grupaId || !naslov) { res.status(400).json({ error: "grupaId i naslov su obavezni" }); return; }

    const grupa = await verifyGrupaAccess(grupaId, req.user!.userId, req.user!.role);
    if (!grupa) { res.status(403).json({ error: "Nije vaša grupa" }); return; }

    const [nova] = await db.insert(zadaceTable).values({
      grupaId,
      muallimId: req.user!.userId,
      naslov,
      opis: opis || null,
      rokDo: rokDo || null,
      lekcijaNaslov: lekcijaNaslov || null,
      lekcijaTip: lekcijaTip || null,
    }).returning();
    res.status(201).json(nova);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.put("/zadace/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { naslov, opis, rokDo, lekcijaNaslov, lekcijaTip, isActive } = req.body;
    const [updated] = await db.update(zadaceTable)
      .set({ naslov, opis, rokDo, lekcijaNaslov, lekcijaTip, isActive })
      .where(and(eq(zadaceTable.id, id), eq(zadaceTable.muallimId, req.user!.userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Zadaća nije pronađena" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.delete("/zadace/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [entry] = await db.select().from(zadaceTable).where(eq(zadaceTable.id, id));
    if (!entry || entry.muallimId !== req.user!.userId) { res.status(403).json({ error: "Nemaš pristup" }); return; }
    await db.delete(zadaceTable).where(eq(zadaceTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
