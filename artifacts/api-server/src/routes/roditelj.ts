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
  zadaceTable,
  zadaceUceniciTable,
  zadaceStatusTable,
  obavjestenjaTable,
  mektebDokumentiTable,
} from "@workspace/db/schema";
import { eq, and, inArray, asc, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { BADGE_CATALOG, evaluateAndPersistBadges, type EarnedBadge } from "../lib/badges.js";
import { computeGameStats } from "./games.js";
import { streamDokument } from "../lib/dokumenti.js";
import { getStudentGodine, razrijesiGodinu } from "../lib/mektebska-godina.js";

const router = Router();
router.use(requireAuth, requireRole("roditelj", "admin"));

// Sažetak za jedno dijete — koristi se i u /dashboard/:ucenikId i u /djeca-summary.
// Pretpostavlja da je pristup već provjeren prije poziva.
async function computeChildDashboard(ucenikId: number): Promise<{
  posljednjaOcjena: { ocjena: number; kategorija: string; datum: string; napomena?: string | null } | null;
  prisustvoOvajMjesec: number;
  ukupnoOvajMjesec: number;
  zavrseneLekcije: number;
  streakDays: number;
  totalHasanat: number;
  bedzevi: Array<{ id: string; naziv: string; opis: string; ikona: string; bojaGradient: string; uslov: string; earned: boolean; earnedAt: string | null }>;
  bedzeviEarnedCount: number;
  bedzeviUkupno: number;
  bedzeviError: boolean;
}> {
  const [posljednja] = await db.select().from(ocjeneTable)
    .where(eq(ocjeneTable.ucenikId, ucenikId))
    .orderBy(desc(ocjeneTable.datum), desc(ocjeneTable.id))
    .limit(1);

  const sviPrisustvo = await db.select().from(priustvoTable)
    .where(eq(priustvoTable.ucenikId, ucenikId));
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ovajMjesec = sviPrisustvo.filter(p => typeof p.datum === "string" && p.datum.startsWith(yearMonth));
  const prisutanOvajMjesec = ovajMjesec.filter(p => p.status === "prisutan").length;

  const [progress] = await db.select().from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, String(ucenikId)))
    .limit(1);
  const completedLessons = (progress?.completedLessons as number[] | undefined) ?? [];
  const streakDays = progress?.streakDays ?? 0;
  const totalHasanat = progress?.totalHasanat ?? 0;

  let zavrseneLekcije = completedLessons.length;
  if (zavrseneLekcije === 0) {
    const napredak = await db.select().from(korisnikNapredakTable)
      .where(and(eq(korisnikNapredakTable.userId, ucenikId), eq(korisnikNapredakTable.zavrsen, true)));
    zavrseneLekcije = napredak.length;
  }

  const bedzeviUkupno = Object.keys(BADGE_CATALOG).length;
  let bedzevi: Array<{ id: string; naziv: string; opis: string; ikona: string; bojaGradient: string; uslov: string; earned: boolean; earnedAt: string | null }> = [];
  let bedzeviEarnedCount = 0;
  let bedzeviError = false;
  try {
    if (progress) {
      try {
        await evaluateAndPersistBadges(ucenikId);
      } catch (e) {
        console.warn("[computeChildDashboard] evaluateAndPersistBadges failed for ucenikId", ucenikId, e);
      }
    }
    const [refreshed] = await db.select().from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, String(ucenikId))).limit(1);

    const rawBadges: unknown = refreshed?.badges;
    const earned: EarnedBadge[] = (Array.isArray(rawBadges) ? rawBadges : [])
      .filter((b): b is EarnedBadge =>
        !!b && typeof b === "object"
        && typeof (b as EarnedBadge).id === "string"
        && typeof (b as EarnedBadge).earnedAt === "string");
    const earnedMap = new Map(earned.map(b => [b.id, b.earnedAt] as const));

    bedzevi = Object.values(BADGE_CATALOG).map(meta => ({
      ...meta,
      earned: earnedMap.has(meta.id),
      earnedAt: earnedMap.get(meta.id) ?? null,
    }));
    bedzeviEarnedCount = bedzevi.filter(b => b.earned).length;
  } catch (e) {
    console.error("[computeChildDashboard] failed to compute badges for ucenikId", ucenikId, e);
    bedzevi = Object.values(BADGE_CATALOG).map(meta => ({ ...meta, earned: false, earnedAt: null }));
    bedzeviEarnedCount = 0;
    bedzeviError = true;
  }

  return {
    posljednjaOcjena: posljednja
      ? { ocjena: posljednja.ocjena, kategorija: posljednja.kategorija, datum: posljednja.datum, napomena: posljednja.napomena }
      : null,
    prisustvoOvajMjesec: prisutanOvajMjesec,
    ukupnoOvajMjesec: ovajMjesec.length,
    zavrseneLekcije,
    streakDays,
    totalHasanat,
    bedzevi,
    bedzeviEarnedCount,
    bedzeviUkupno,
    bedzeviError,
  };
}

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

// POST /api/roditelj/link-dijete - request to link to a child by username only.
// Privatnost: roditelj MORA znati korisničko ime djeteta (dobio od muallima).
// Ne podržava se povezivanje po numeričkom ID-u kako bismo spriječili enumeraciju računa.
router.post("/link-dijete", async (req, res) => {
  try {
    const { ucenikUsername } = req.body;
    const usernameRaw = typeof ucenikUsername === "string" ? ucenikUsername.trim() : "";
    if (!usernameRaw) {
      res.status(400).json({ error: "Unesite korisničko ime djeteta" });
      return;
    }

    const [ucenik] = await db.select().from(usersTable)
      .where(and(eq(usersTable.username, usernameRaw.toLowerCase()), eq(usersTable.role, "ucenik")));

    if (!ucenik) {
      res.status(404).json({ error: "Učenik nije pronađen" });
      return;
    }

    // Model 1 učenik = 1 roditelj (licence): odbij zahtjev ako učenik već ima
    // DRUGOG odobrenog roditelja. (Ako je odobreni roditelj baš ovaj, ispod
    // ON CONFLICT grana javlja precizniju poruku "već ste povezani".)
    const [vecImaDrugog] = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.ucenikId, ucenik.id), eq(roditeljUcenikTable.status, "approved")));
    if (vecImaDrugog && vecImaDrugog.roditeljId !== req.user!.userId) {
      res.status(409).json({ error: "Ovaj učenik već ima povezanog roditelja." });
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

// GET /api/roditelj/dashboard/:ucenikId — sažetak za karticu djeteta (zadržano za
// backwards compat; nova kombinirana ruta je /djeca-summary).
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

    const dashboard = await computeChildDashboard(ucenikId);
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/djeca-summary — kombinirani endpoint:
// vraća svu djecu + njihov dashboard sažetak + game stats u jednom JSON-u.
// Eliminira N+1 mrežne pozive (prije: 1 + 2N HTTP poziva za N djece).
// Per-child compute pada gracefully — neuspjeh dashboard-a ili gameStats-a
// jednog djeteta ne ruši cijelu listu (vraća null + error flag).
router.get("/djeca-summary", async (req, res) => {
  try {
    const roditeljId = req.user!.userId;
    const veze = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.roditeljId, roditeljId), eq(roditeljUcenikTable.status, "approved")));

    if (veze.length === 0) { res.json([]); return; }

    const ucenikIds = veze.map(v => v.ucenikId);
    const [djeca, profili] = await Promise.all([
      db.select().from(usersTable).where(inArray(usersTable.id, ucenikIds)),
      db.select().from(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, ucenikIds)),
    ]);

    // Per-child compute u paraleli. Ako padne, ne rušimo cijelu listu.
    const results = await Promise.all(djeca.map(async (d) => {
      const profil = profili.find(p => p.userId === d.id);
      const [summary, gameStats] = await Promise.all([
        computeChildDashboard(d.id).catch((e) => {
          console.error("[djeca-summary] dashboard failed for", d.id, e);
          return null;
        }),
        computeGameStats(d.id).catch((e) => {
          console.error("[djeca-summary] gameStats failed for", d.id, e);
          return null;
        }),
      ]);
      return {
        dijete: {
          id: d.id,
          username: d.username,
          displayName: d.displayName,
          role: d.role,
          createdAt: d.createdAt,
          lastSeenAt: d.lastSeenAt,
          totalScreentimeSec: d.totalScreentimeSec,
          profil,
        },
        summary,
        summaryError: summary === null,
        gameStats,
        gameStatsError: gameStats === null,
      };
    }));

    res.json(results);
  } catch (err) {
    console.error("[djeca-summary] failed", err);
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

    let prisustvo = await db.select().from(priustvoTable).where(eq(priustvoTable.ucenikId, ucenikId));

    const godineInfo = await getStudentGodine(ucenikId);
    const odabir = razrijesiGodinu(godineInfo, req.query.mektebskaGodina as string | undefined);
    if (odabir.grupaIds) {
      const grupeSet = new Set(odabir.grupaIds);
      prisustvo = prisustvo.filter(p => p.grupaId != null && grupeSet.has(p.grupaId));
    }
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

    let ocjene = await db.select().from(ocjeneTable).where(eq(ocjeneTable.ucenikId, ucenikId));

    const godineInfo = await getStudentGodine(ucenikId);
    const odabir = razrijesiGodinu(godineInfo, req.query.mektebskaGodina as string | undefined);
    if (odabir.grupaIds) {
      const grupeSet = new Set(odabir.grupaIds);
      ocjene = ocjene.filter(o =>
        (o.grupaId != null && grupeSet.has(o.grupaId)) ||
        (o.grupaId == null && odabir.jeTekuca),
      );
    }
    res.json(ocjene);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/zadace/:ucenikId — zadaće jednog djeteta, filtrirano po
// mektebskoj godini (default = tekuća). Vraća isti oblik kao /roditelj/zadace
// (sa djecaIds/djecaImena radi kompatibilnosti frontenda).
router.get("/zadace/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const [veza] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (!veza) { res.status(403).json({ error: "Nemate pristup" }); return; }

    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, ucenikId));

    const godineInfo = await getStudentGodine(ucenikId);
    const odabir = razrijesiGodinu(godineInfo, req.query.mektebskaGodina as string | undefined);
    // grupaIds === null → nema filtera (tekuća grupa); [] → tražena godina nema grupa → prazno.
    const grupeZaZadace = odabir.grupaIds === null
      ? (profil?.grupaId ? [profil.grupaId] : [])
      : odabir.grupaIds;
    if (grupeZaZadace.length === 0) { res.json([]); return; }

    const [dijete] = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
      .from(usersTable).where(eq(usersTable.id, ucenikId));
    const djetetovoIme = dijete?.displayName || `#${ucenikId}`;

    const grupe = await db.select().from(grupeTable).where(inArray(grupeTable.id, grupeZaZadace));
    const grupaMap = new Map(grupe.map(g => [g.id, g.naziv]));

    const allGroupZadace = await db.select().from(zadaceTable)
      .where(and(inArray(zadaceTable.grupaId, grupeZaZadace), eq(zadaceTable.isActive, true)))
      .orderBy(desc(zadaceTable.createdAt));
    if (allGroupZadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, allGroupZadace.map(z => z.id)));
    const targetMap = new Map<number, Set<number>>();
    for (const t of targets) {
      if (!targetMap.has(t.zadacaId)) targetMap.set(t.zadacaId, new Set());
      targetMap.get(t.zadacaId)!.add(t.ucenikId);
    }

    // Vidljive ovom djetetu: bez targeta = cijela grupa; sa targetom = mora biti adresat.
    const visible = allGroupZadace.filter(z => {
      const targeted = targetMap.get(z.id);
      if (!targeted) return true;
      return targeted.has(ucenikId);
    });
    if (visible.length === 0) { res.json([]); return; }

    const statusi = await db.select().from(zadaceStatusTable)
      .where(and(
        inArray(zadaceStatusTable.zadacaId, visible.map(z => z.id)),
        eq(zadaceStatusTable.ucenikId, ucenikId),
      ));
    const prolongMap = new Map(statusi.map(s => [s.zadacaId, s.prolongCount ?? 0]));

    const result = visible.map(z => ({
      ...z,
      grupaNaziv: grupaMap.get(z.grupaId) || null,
      djecaIds: [ucenikId],
      djecaImena: [djetetovoIme],
      prolongCount: prolongMap.get(z.id) ?? 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/godine/:ucenikId — mektebske godine za dijete + tekuća
router.get("/godine/:ucenikId", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.ucenikId);
    const [veza] = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (!veza) { res.status(403).json({ error: "Nemate pristup" }); return; }

    const info = await getStudentGodine(ucenikId);
    res.json({ godine: info.godine, tekuca: info.tekuca });
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
    skolskaGodina: "Mektebska 2025/26",
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

// GET /api/roditelj/zadace — vraća sve aktivne zadaće za grupe djece, sa indikacijom
// kojem djetetu pripada svaka zadaća (poštuje per-student targeting).
router.get("/zadace", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const veze = await db.select().from(roditeljUcenikTable)
      .where(and(eq(roditeljUcenikTable.roditeljId, userId), eq(roditeljUcenikTable.status, "approved")));
    if (veze.length === 0) { res.json([]); return; }

    const djecaIds = veze.map(v => v.ucenikId);
    const profili = await db.select().from(ucenikProfiliTable).where(inArray(ucenikProfiliTable.userId, djecaIds));
    const grupaIds = [...new Set(profili.map(p => p.grupaId).filter(Boolean))] as number[];
    if (grupaIds.length === 0) { res.json([]); return; }

    const djeca = await db.select({ id: usersTable.id, displayName: usersTable.displayName })
      .from(usersTable).where(inArray(usersTable.id, djecaIds));
    const djecaMap = new Map(djeca.map(d => [d.id, d.displayName]));

    const grupe = await db.select().from(grupeTable).where(inArray(grupeTable.id, grupaIds));
    const grupaMap = new Map(grupe.map(g => [g.id, g.naziv]));

    const grupaToDjeca = new Map<number, number[]>();
    for (const p of profili) {
      if (!p.grupaId) continue;
      const arr = grupaToDjeca.get(p.grupaId) || [];
      arr.push(p.userId);
      grupaToDjeca.set(p.grupaId, arr);
    }

    const zadace = await db.select().from(zadaceTable)
      .where(and(inArray(zadaceTable.grupaId, grupaIds), eq(zadaceTable.isActive, true)))
      .orderBy(desc(zadaceTable.createdAt));
    if (zadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, zadace.map(z => z.id)));
    const targetMap = new Map<number, Set<number>>();
    for (const t of targets) {
      if (!targetMap.has(t.zadacaId)) targetMap.set(t.zadacaId, new Set());
      targetMap.get(t.zadacaId)!.add(t.ucenikId);
    }

    const statusi = await db.select().from(zadaceStatusTable)
      .where(and(
        inArray(zadaceStatusTable.zadacaId, zadace.map(z => z.id)),
        inArray(zadaceStatusTable.ucenikId, djecaIds),
      ));
    const prolongMap = new Map<string, number>();
    for (const s of statusi) {
      prolongMap.set(`${s.zadacaId}:${s.ucenikId}`, s.prolongCount ?? 0);
    }

    const result = zadace.flatMap(z => {
      const grupaDjeca = grupaToDjeca.get(z.grupaId) || [];
      const targeted = targetMap.get(z.id);
      const adresati = targeted
        ? grupaDjeca.filter(uid => targeted.has(uid))
        : grupaDjeca;
      if (adresati.length === 0) return [];
      const prolongCount = Math.max(0, ...adresati.map(uid => prolongMap.get(`${z.id}:${uid}`) ?? 0));
      return [{
        ...z,
        grupaNaziv: grupaMap.get(z.grupaId) || null,
        djecaIds: adresati,
        djecaImena: adresati.map(uid => djecaMap.get(uid) || `#${uid}`),
        prolongCount,
      }];
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/obavjestenja — all announcements visible to this parent
router.get("/obavjestenja", async (req, res) => {
  try {
    const links = await db.select().from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, req.user!.userId),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (links.length === 0) { res.json([]); return; }

    const ucenikIds = links.map(l => l.ucenikId);
    const profili = await db.select().from(ucenikProfiliTable)
      .where(inArray(ucenikProfiliTable.userId, ucenikIds));
    const muallimIds = [...new Set(profili.map(p => p.muallimId).filter(Boolean))] as number[];
    const grupaIds = [...new Set(profili.map(p => p.grupaId).filter(Boolean))] as number[];
    if (muallimIds.length === 0) { res.json([]); return; }

    const allObavjestenja = await db.select().from(obavjestenjaTable)
      .where(inArray(obavjestenjaTable.muallimId, muallimIds))
      .orderBy(desc(obavjestenjaTable.createdAt));

    const visible = allObavjestenja.filter(o =>
      !o.grupaId || grupaIds.includes(o.grupaId)
    );

    const muallimUsers = muallimIds.length > 0
      ? await db.select().from(usersTable).where(inArray(usersTable.id, muallimIds))
      : [];
    const muallimMap = Object.fromEntries(muallimUsers.map(u => [u.id, u.displayName]));

    const grupeAll = grupaIds.length > 0
      ? await db.select().from(grupeTable).where(inArray(grupeTable.id, grupaIds))
      : [];
    const grupaMap = Object.fromEntries(grupeAll.map(g => [g.id, g.naziv]));

    res.json(visible.map(o => ({
      ...o,
      muallimIme: muallimMap[o.muallimId] || null,
      grupaNaziv: o.grupaId ? grupaMap[o.grupaId] || null : null,
    })));
  } catch (err) {
    console.error("roditelj obavjestenja error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/dijete/:ucenikId/dokumenti — mekteb-nivo PDF dokumenti
// vidljivi roditelju za odabrano dijete. Provjerava odobrenu vezu i razrješava
// mektebId iz profila djeteta.
router.get("/dijete/:ucenikId/dokumenti", async (req, res) => {
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
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil?.mektebId) {
      res.json([]);
      return;
    }
    const docs = await db.select().from(mektebDokumentiTable)
      .where(eq(mektebDokumentiTable.mektebId, profil.mektebId))
      .orderBy(desc(mektebDokumentiTable.createdAt));
    res.json(docs.map(d => ({
      id: d.id,
      naziv: d.naziv,
      opis: d.opis,
      originalName: d.originalName,
      storedName: d.storedName,
      fileSize: d.fileSize,
      createdAt: d.createdAt,
    })));
  } catch (err) {
    console.error("roditelj dokumenti error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/dijete/:ucenikId/dokumenti/:id/file — autorizovani download.
// Provjerava odobrenu vezu roditelj-dijete i pripadnost dokumenta mektebu djeteta.
router.get("/dijete/:ucenikId/dokumenti/:id/file", async (req, res) => {
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
    const [profil] = await db.select().from(ucenikProfiliTable)
      .where(eq(ucenikProfiliTable.userId, ucenikId));
    if (!profil?.mektebId) {
      res.status(404).json({ error: "Dokument nije pronađen" });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const [doc] = await db.select().from(mektebDokumentiTable).where(eq(mektebDokumentiTable.id, id));
    if (!doc || doc.mektebId !== profil.mektebId) {
      res.status(404).json({ error: "Dokument nije pronađen" });
      return;
    }
    streamDokument(res, doc);
  } catch (err) {
    console.error("roditelj dokument file error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// GET /api/roditelj/dijete/:id/zvjezdice — roditelj čita zvjezdice svog djeteta
router.get("/dijete/:id/zvjezdice", async (req, res) => {
  try {
    const ucenikId = parseInt(req.params.id);
    const roditeljId = req.user!.userId;
    const veze = await db
      .select({ id: roditeljUcenikTable.id })
      .from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.roditeljId, roditeljId),
        eq(roditeljUcenikTable.ucenikId, ucenikId),
        eq(roditeljUcenikTable.status, "approved")
      ));
    if (veze.length === 0) { res.status(403).json({ error: "Nemate pristup" }); return; }
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE tip = 'pozitivna') AS pozitivne,
        COUNT(*) FILTER (WHERE tip = 'negativna') AS negativne
      FROM zvjezdice_log WHERE ucenik_id = ${ucenikId}
    `);
    const r = (rows as any[])[0] || {};
    res.json({ pozitivne: parseInt(String(r.pozitivne ?? 0)) || 0, negativne: parseInt(String(r.negativne ?? 0)) || 0 });
  } catch (err) {
    console.error("zvjezdice roditelj error:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
