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
  mektebKalendarTable,
  studentProgressTable,
} from "@workspace/db/schema";
import { eq, and, inArray, asc, desc } from "drizzle-orm";
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

// POST /api/roditelj/link-dijete - request to link to a child (po username ili ucenikId)
router.post("/link-dijete", async (req, res) => {
  try {
    const { ucenikUsername, ucenikId } = req.body;
    if (!ucenikUsername && !ucenikId) {
      res.status(400).json({ error: "Unesite korisničko ime ili odaberite dijete" });
      return;
    }

    let ucenik;
    if (ucenikId) {
      [ucenik] = await db.select().from(usersTable)
        .where(and(eq(usersTable.id, parseInt(String(ucenikId))), eq(usersTable.role, "ucenik")));
    } else {
      [ucenik] = await db.select().from(usersTable)
        .where(and(eq(usersTable.username, String(ucenikUsername).trim().toLowerCase()), eq(usersTable.role, "ucenik")));
    }

    if (!ucenik) {
      res.status(404).json({ error: "Učenik nije pronađen" });
      return;
    }

    // Atomic insert with ON CONFLICT — relies on unique index (roditelj_id, ucenik_id)
    // onConflictDoNothing vraća prazan array ako je duplikat
    const inserted = await db.insert(roditeljUcenikTable).values({
      roditeljId: req.user!.userId,
      ucenikId: ucenik.id,
      status: "pending",
    }).onConflictDoNothing({
      target: [roditeljUcenikTable.roditeljId, roditeljUcenikTable.ucenikId],
    }).returning();

    if (inserted.length === 0) {
      // Duplikat — pročitaj postojeći zapis za ispravan statusMsg
      const [existing] = await db.select().from(roditeljUcenikTable)
        .where(and(eq(roditeljUcenikTable.roditeljId, req.user!.userId), eq(roditeljUcenikTable.ucenikId, ucenik.id)));
      const statusMsg = !existing
        ? "Zahtjev je već poslan"
        : existing.status === "pending"
        ? "Zahtjev za ovo dijete je već poslan i čeka odobrenje muallima"
        : existing.status === "approved"
        ? "Već ste povezani s ovim djetetom"
        : "Vaš zahtjev za ovo dijete je odbijen";
      res.status(409).json({ error: statusMsg, status: existing?.status || "pending" });
      return;
    }

    res.status(201).json({ success: true, request: inserted[0], ucenikName: ucenik.displayName });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/pretrazi-djecu?q=Amina&grupa=Online
// Sigurno: vraća samo id, displayName i naziv grupe/muallima — ne otkriva username/lozinke
router.get("/pretrazi-djecu", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const grupaQuery = String(req.query.grupa || "").trim();

    if (q.length < 3) {
      res.status(400).json({ error: "Unesite najmanje 3 znaka za pretragu" });
      return;
    }

    // Pretraga svih učenika
    const sviUcenici = await db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
    }).from(usersTable).where(eq(usersTable.role, "ucenik"));

    const qLower = q.toLowerCase();
    const matches = sviUcenici.filter(u => u.displayName.toLowerCase().includes(qLower));

    if (matches.length === 0) { res.json([]); return; }

    // Učitaj profile + grupe za matching učenike
    const matchIds = matches.map(m => m.id);
    const profili = await db.select().from(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, matchIds));
    const grupaIds = [...new Set(profili.map(p => p.grupaId).filter(Boolean))] as number[];
    const muallimIds = [...new Set(profili.map(p => p.muallimId).filter(Boolean))] as number[];

    const grupe = grupaIds.length > 0
      ? await db.select({ id: grupeTable.id, naziv: grupeTable.naziv }).from(grupeTable).where(inArray(grupeTable.id, grupaIds))
      : [];
    const grupaMap = Object.fromEntries(grupe.map(g => [g.id, g.naziv]));

    const muallimi = muallimIds.length > 0
      ? await db.select({ id: usersTable.id, displayName: usersTable.displayName }).from(usersTable).where(inArray(usersTable.id, muallimIds))
      : [];
    const muallimMap = Object.fromEntries(muallimi.map(m => [m.id, m.displayName]));

    // Postojeće veze ovog roditelja (da pokažemo status)
    const postoje = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.roditeljId, req.user!.userId), inArray(roditeljUcenikTable.ucenikId, matchIds)));
    const statusMap = Object.fromEntries(postoje.map(p => [p.ucenikId, p.status]));

    let results = matches.map(u => {
      const p = profili.find(pp => pp.userId === u.id);
      return {
        id: u.id,
        displayName: u.displayName,
        grupaNaziv: p?.grupaId ? grupaMap[p.grupaId] || null : null,
        muallimNaziv: p?.muallimId ? muallimMap[p.muallimId] || null : null,
        existingStatus: statusMap[u.id] || null,
      };
    });

    if (grupaQuery) {
      const grpLower = grupaQuery.toLowerCase();
      results = results.filter(r =>
        (r.grupaNaziv || "").toLowerCase().includes(grpLower) ||
        (r.muallimNaziv || "").toLowerCase().includes(grpLower)
      );
    }

    // Limit na 20 rezultata da ne otkrivamo previše
    res.json(results.slice(0, 20));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/dashboard/:ucenikId — sažetak za karticu djeteta
router.get("/dashboard/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    if (!Number.isFinite(ucenikId)) {
      res.status(400).json({ error: "Neispravan ID učenika" });
      return;
    }

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

    // Posljednja ocjena
    const [posljednja] = await db.select().from(ocjeneTable)
      .where(eq(ocjeneTable.ucenikId, ucenikId))
      .orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id))
      .limit(1);

    // Prisustvo ovaj mjesec — datum je text "YYYY-MM-DD", filtriramo lokalno
    const sviPrisustvo = await db.select().from(priustvoTable)
      .where(eq(priustvoTable.ucenikId, ucenikId));
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const ovajMjesec = sviPrisustvo.filter(p => typeof p.datum === "string" && p.datum.startsWith(yearMonth));
    const prisutanOvajMjesec = ovajMjesec.filter(p => p.status === "prisutan").length;

    // Završene lekcije + streak iz studentProgressTable (studentId je text)
    const [progress] = await db.select().from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, String(ucenikId)))
      .limit(1);
    const completedLessons = (progress?.completedLessons as number[] | undefined) ?? [];
    const streakDays = progress?.streakDays ?? 0;
    const totalHasanat = progress?.totalHasanat ?? 0;

    // Fallback: završene lekcije iz korisnik_napredak (ilmihal) ako student_progress nema zapis
    let zavrseneLekcije = completedLessons.length;
    if (zavrseneLekcije === 0) {
      const napredak = await db.select().from(korisnikNapredakTable)
        .where(and(eq(korisnikNapredakTable.userId, ucenikId), eq(korisnikNapredakTable.zavrsen, true)));
      zavrseneLekcije = napredak.length;
    }

    res.json({
      posljednjaOcjena: posljednja
        ? { ocjena: posljednja.ocjena, kategorija: posljednja.kategorija, datum: posljednja.datum, napomena: posljednja.napomena }
        : null,
      prisustvoOvajMjesec: prisutanOvajMjesec,
      ukupnoOvajMjesec: ovajMjesec.length,
      zavrseneLekcije,
      streakDays,
      totalHasanat,
    });
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

// GET /api/roditelj/kalendar — parent sees calendar for their children's groups
router.get("/kalendar", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const veze = await db.select().from(roditeljUcenikTable).where(and(eq(roditeljUcenikTable.roditeljId, userId), eq(roditeljUcenikTable.status, "approved")));
    if (veze.length === 0) { res.json([]); return; }

    const djecaIds = veze.map(v => v.ucenikId);
    const profili = await db.select().from(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, djecaIds));
    const grupaIds = [...new Set(profili.map(p => p.grupaId).filter(Boolean))] as number[];
    if (grupaIds.length === 0) { res.json([]); return; }

    const entries = await db.select().from(mektebKalendarTable)
      .where(inArray(mektebKalendarTable.grupaId, grupaIds))
      .orderBy(asc(mektebKalendarTable.datum));

    const grupe = await db.select().from(grupeTable).where(inArray(grupeTable.id, grupaIds));
    const grupaMap = Object.fromEntries(grupe.map(g => [g.id, g.naziv]));

    res.json(entries.map(e => ({ ...e, grupaNaziv: grupaMap[e.grupaId] || null })));
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
