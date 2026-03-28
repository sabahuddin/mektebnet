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
  kvizRezultatiTable,
  posjeteTable,
  korisnikNapredakTable,
  grupeTable,
} from "@workspace/db/schema";
import { eq, desc, sql, gte, inArray, and, isNotNull } from "drizzle-orm";
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

// GET /api/admin/muallim-profili - all muallim profiles with licence info
router.get("/muallim-profili", async (req, res) => {
  try {
    const profili = await db.select().from(muallimProfiliTable);
    res.json(profili);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/korisnici/:id - update user
router.put("/korisnici/:id", async (req, res) => {
  try {
    const { displayName, email, isActive, role } = req.body;
    const userId = parseInt(req.params.id);

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!existing) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }

    const updates: Record<string, any> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (email !== undefined) updates.email = email;
    if (isActive !== undefined) updates.isActive = isActive;
    if (role !== undefined) updates.role = role;

    const [updated] = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();

    if (isActive !== undefined && existing.role === "muallim") {
      const ucenikProfili = await db.select({ userId: ucenikProfiliTable.userId })
        .from(ucenikProfiliTable).where(eq(ucenikProfiliTable.muallimId, userId));
      if (ucenikProfili.length > 0) {
        const ucenikIds = ucenikProfili.map(p => p.userId);
        await db.update(usersTable).set({ isActive }).where(inArray(usersTable.id, ucenikIds));
      }
    }

    res.json({ ...updated, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/muallim/:id/licence - set licence count
router.put("/muallim/:id/licence", async (req, res) => {
  try {
    const { licenceCount } = req.body;
    const count = parseInt(licenceCount);
    if (!count || count < 1 || count > 999) {
      res.status(400).json({ error: "Broj licenci mora biti između 1 i 999" });
      return;
    }
    const [profil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, parseInt(req.params.id)));
    if (!profil) { res.status(404).json({ error: "Muallim profil nije pronađen" }); return; }
    if (count < (profil.licencesUsed || 0)) {
      res.status(400).json({ error: `Ne možete staviti manje licenci od iskorištenih (${profil.licencesUsed})` });
      return;
    }
    const [updated] = await db.update(muallimProfiliTable)
      .set({ licenceCount: count })
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

// POST /api/admin/admin - create admin account
router.post("/admin", async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;

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
      role: "admin",
    }).returning();

    res.status(201).json({ ...newUser, passwordHash: undefined });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/admin/ucenik - create student account
router.post("/ucenik", async (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;

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
      role: "ucenik",
    }).returning();

    await db.insert(ucenikProfiliTable).values({
      userId: newUser.id,
    });

    res.status(201).json({ ...newUser, passwordHash: undefined });
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

// GET /api/admin/analytics — comprehensive analytics for admin dashboard
router.get("/analytics", async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const registracijePoMjesecu = await db.select({
      datum: sql<string>`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`,
      broj: sql<number>`count(*)::int`,
    }).from(usersTable)
      .where(gte(usersTable.createdAt, thirtyDaysAgo))
      .groupBy(sql`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${usersTable.createdAt}, 'YYYY-MM-DD')`);

    let posjetePoDrzavi: any[] = [];
    let aktivnostPosmjenama: any[] = [];
    try {
      posjetePoDrzavi = await db.select({
        country: posjeteTable.country,
        broj: sql<number>`count(*)::int`,
      }).from(posjeteTable)
        .where(and(gte(posjeteTable.createdAt, thirtyDaysAgo), isNotNull(posjeteTable.country)))
        .groupBy(posjeteTable.country)
        .orderBy(sql`count(*) desc`)
        .limit(20);

      aktivnostPosmjenama = await db.select({
        datum: sql<string>`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`,
        broj: sql<number>`count(*)::int`,
      }).from(posjeteTable)
        .where(gte(posjeteTable.createdAt, thirtyDaysAgo))
        .groupBy(sql`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${posjeteTable.createdAt}, 'YYYY-MM-DD')`);
    } catch (e) {
      console.warn("posjete table not available:", (e as any).message);
    }

    const kvizRezultati = await db.select({
      kvizNaslov: kvizRezultatiTable.kvizNaslov,
      pokusaji: sql<number>`count(*)::int`,
      prosjecniProcenat: sql<number>`round(avg(${kvizRezultatiTable.procenat}))::int`,
      prosjecniBodovi: sql<number>`round(avg(${kvizRezultatiTable.bodovi}))::int`,
      najvisiBodovi: sql<number>`max(${kvizRezultatiTable.procenat})::int`,
    }).from(kvizRezultatiTable)
      .groupBy(kvizRezultatiTable.kvizNaslov)
      .orderBy(sql`count(*) desc`);

    const korisnikStats = await db.select({
      role: usersTable.role,
      aktivni: sql<number>`count(*) filter (where ${usersTable.isActive} = true)::int`,
      neaktivni: sql<number>`count(*) filter (where ${usersTable.isActive} = false)::int`,
    }).from(usersTable)
      .groupBy(usersTable.role);

    const nedavniRezultati = await db.select({
      id: kvizRezultatiTable.id,
      userId: kvizRezultatiTable.userId,
      kvizNaslov: kvizRezultatiTable.kvizNaslov,
      tacniOdgovori: kvizRezultatiTable.tacniOdgovori,
      ukupnoPitanja: kvizRezultatiTable.ukupnoPitanja,
      procenat: kvizRezultatiTable.procenat,
      bodovi: kvizRezultatiTable.bodovi,
      completedAt: kvizRezultatiTable.completedAt,
      username: usersTable.username,
      displayName: usersTable.displayName,
    }).from(kvizRezultatiTable)
      .leftJoin(usersTable, eq(kvizRezultatiTable.userId, usersTable.id))
      .orderBy(desc(kvizRezultatiTable.completedAt))
      .limit(50);

    res.json({
      registracijePoMjesecu,
      posjetePoDrzavi,
      kvizRezultati,
      aktivnostPosmjenama,
      korisnikStats,
      nedavniRezultati,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/kviz-statistike — quiz-centric stats: all quizzes with attempt counts and accuracy
router.get("/kviz-statistike", async (req, res) => {
  try {
    const sviKvizovi = await db.select({
      id: kvizoviTable.id,
      naslov: kvizoviTable.naslov,
      kategorija: kvizoviTable.kategorija,
    }).from(kvizoviTable).orderBy(kvizoviTable.naslov);

    const rezultatiStats = await db.select({
      kvizId: kvizRezultatiTable.kvizId,
      pokusaji: sql<number>`count(*)::int`,
      prosjecniProcenat: sql<number>`round(avg(${kvizRezultatiTable.procenat}))::int`,
      najvisiBodovi: sql<number>`max(${kvizRezultatiTable.procenat})::int`,
      najniziBodovi: sql<number>`min(${kvizRezultatiTable.procenat})::int`,
    }).from(kvizRezultatiTable)
      .groupBy(kvizRezultatiTable.kvizId);

    const statsMap = Object.fromEntries(rezultatiStats.map(r => [r.kvizId, r]));

    const combined = sviKvizovi.map(k => ({
      id: k.id,
      naslov: k.naslov,
      kategorija: k.kategorija,
      pokusaji: statsMap[k.id]?.pokusaji || 0,
      prosjecniProcenat: statsMap[k.id]?.prosjecniProcenat || 0,
      najvisiBodovi: statsMap[k.id]?.najvisiBodovi || 0,
      najniziBodovi: statsMap[k.id]?.najniziBodovi || 0,
    }));

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/muallim-pregled — muallim overview with groups and student counts
router.get("/muallim-pregled", async (req, res) => {
  try {
    const muallimi = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      email: usersTable.email,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.role, "muallim")).orderBy(usersTable.displayName);

    const grupe = await db.select({
      id: grupeTable.id,
      muallimId: grupeTable.muallimId,
      naziv: grupeTable.naziv,
      skolskaGodina: grupeTable.skolskaGodina,
      isActive: grupeTable.isActive,
    }).from(grupeTable);

    const ucenikProfili = await db.select({
      userId: ucenikProfiliTable.userId,
      muallimId: ucenikProfiliTable.muallimId,
      grupaId: ucenikProfiliTable.grupaId,
    }).from(ucenikProfiliTable).where(eq(ucenikProfiliTable.isArchived, false));

    const ucenikUsers = await db.select({
      id: usersTable.id,
      isActive: usersTable.isActive,
    }).from(usersTable).where(eq(usersTable.role, "ucenik"));

    const ucenikActiveMap = Object.fromEntries(ucenikUsers.map(u => [u.id, u.isActive]));

    const result = muallimi.map(m => {
      const mGrupe = grupe.filter(g => g.muallimId === m.id);
      const mUcenici = ucenikProfili.filter(u => u.muallimId === m.id);
      const aktivniUcenici = mUcenici.filter(u => ucenikActiveMap[u.userId] === true).length;

      return {
        ...m,
        brojGrupa: mGrupe.length,
        brojUcenika: mUcenici.length,
        aktivniUcenici,
        grupe: mGrupe.map(g => {
          const gUcenici = mUcenici.filter(u => u.grupaId === g.id);
          return {
            id: g.id,
            naziv: g.naziv,
            skolskaGodina: g.skolskaGodina,
            isActive: g.isActive,
            brojUcenika: gUcenici.length,
            aktivniUcenika: gUcenici.filter(u => ucenikActiveMap[u.userId] === true).length,
          };
        }),
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Muallim pregled error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// PUT /api/admin/ucenik/:id/rasporedi — reassign student to different muallim/group
router.put("/ucenik/:id/rasporedi", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const { muallimId, grupaId } = req.body;

    if (!muallimId || !grupaId) {
      res.status(400).json({ error: "muallimId i grupaId su obavezni" });
      return;
    }

    const [ucenik] = await db.select().from(usersTable).where(and(eq(usersTable.id, ucenikId), eq(usersTable.role, "ucenik")));
    if (!ucenik) {
      res.status(404).json({ error: "Učenik nije pronađen" });
      return;
    }

    const [grupa] = await db.select().from(grupeTable).where(and(eq(grupeTable.id, grupaId), eq(grupeTable.muallimId, muallimId)));
    if (!grupa) {
      res.status(404).json({ error: "Grupa nije pronađena ili ne pripada odabranom muallimu" });
      return;
    }

    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil) {
      res.status(404).json({ error: "Profil učenika nije pronađen" });
      return;
    }

    const stariMuallimId = profil.muallimId;
    const muallimChanged = stariMuallimId !== null && stariMuallimId !== muallimId;

    if (muallimChanged) {
      const [noviMuallimProfil] = await db.select().from(muallimProfiliTable).where(eq(muallimProfiliTable.userId, muallimId));
      if (noviMuallimProfil && noviMuallimProfil.licencesUsed >= noviMuallimProfil.licenceCount) {
        res.status(400).json({ error: "Novi muallim nema slobodnih licenci" });
        return;
      }
    }

    await db.update(ucenikProfiliTable).set({ muallimId, grupaId }).where(eq(ucenikProfiliTable.userId, ucenikId));

    if (muallimChanged) {
      if (stariMuallimId) {
        await db.update(muallimProfiliTable)
          .set({ licencesUsed: sql`GREATEST(${muallimProfiliTable.licencesUsed} - 1, 0)` })
          .where(eq(muallimProfiliTable.userId, stariMuallimId));
      }
      await db.update(muallimProfiliTable)
        .set({ licencesUsed: sql`${muallimProfiliTable.licencesUsed} + 1` })
        .where(eq(muallimProfiliTable.userId, muallimId));
    }

    res.json({ success: true, message: `Učenik raspoređen u grupu "${grupa.naziv}"` });
  } catch (err) {
    console.error("Rasporedi error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/admin/grupe-all — all groups with muallim names (for reassignment dropdown)
router.get("/grupe-all", async (req, res) => {
  try {
    const grupe = await db.select({
      id: grupeTable.id,
      naziv: grupeTable.naziv,
      muallimId: grupeTable.muallimId,
      muallimName: usersTable.displayName,
      isActive: grupeTable.isActive,
    }).from(grupeTable)
      .leftJoin(usersTable, eq(grupeTable.muallimId, usersTable.id))
      .orderBy(usersTable.displayName, grupeTable.naziv);

    res.json(grupe);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
