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
  studentProgressTable,
  ilmihalLekcijeTable,
  zadaceTable,
  zadaceUceniciTable,
  etapaPolaganjaTable,
  medaljoniTable,
  studentKrunisanjaTable,
  krunisanjaTable,
} from "@workspace/db/schema";
import { eq, and, asc, desc, count, inArray, sql, or, notInArray, exists } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { BADGE_CATALOG, type EarnedBadge, evaluateAndPersistBadges, buildProgressSnapshot, computeBadgeProgress } from "../lib/badges.js";

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

    // Napredak učenja: streak, hasanati, završene lekcije po nivou
    const studentIdStr = String(userId);
    const [progress] = await db.select().from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);

    const lekcijePoNivou = await db.select({
      nivo: ilmihalLekcijeTable.nivo,
      ukupno: count(),
    }).from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.isPublished, true))
      .groupBy(ilmihalLekcijeTable.nivo);

    const completedLessonIds = (progress?.completedLessons as number[]) || [];
    const completedByNivo: Record<number, { ukupno: number; gotov: number }> = {};
    for (const r of lekcijePoNivou) {
      completedByNivo[r.nivo] = { ukupno: r.ukupno, gotov: 0 };
    }
    if (completedLessonIds.length > 0) {
      const completedRows = await db.select({ id: ilmihalLekcijeTable.id, nivo: ilmihalLekcijeTable.nivo })
        .from(ilmihalLekcijeTable);
      const idToNivo = new Map(completedRows.map(r => [r.id, r.nivo]));
      for (const lid of completedLessonIds) {
        const nv = idToNivo.get(lid);
        if (nv != null && completedByNivo[nv]) completedByNivo[nv].gotov++;
      }
    }

    // Bedževi: backfill ako fale (idempotentno) + vrati cijeli katalog sa earned statusom
    if (progress) {
      try { await evaluateAndPersistBadges(userId); } catch {}
    }
    const [refreshed] = await db.select().from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);
    const earned = (Array.isArray(refreshed?.badges) ? refreshed!.badges as EarnedBadge[] : [])
      .filter(b => b && typeof b.id === "string" && typeof b.earnedAt === "string");
    const earnedMap = new Map(earned.map(b => [b.id, b.earnedAt]));

    // Napredak po bedžu (current/target) za "Još za osvojiti" prikaz.
    let badgeProgress: Record<string, { current: number; target: number }> = {};
    try {
      const snap = await buildProgressSnapshot(userId);
      badgeProgress = computeBadgeProgress(snap);
    } catch (err) {
      console.warn("[ucenik/profil] computeBadgeProgress failed for userId", userId, err);
    }

    const bedzevi = Object.values(BADGE_CATALOG).map(meta => ({
      ...meta,
      earned: earnedMap.has(meta.id),
      earnedAt: earnedMap.get(meta.id) ?? null,
      progress: badgeProgress[meta.id] ?? null,
    }));

    // Task #126: položene etape (medaljoni s ispitom) + krunisanja sa datumom.
    // Za etape uzimamo NAJRANIJI uspješan pokušaj po medaljonu (DISTINCT ON
    // ekvivalent na strani Node-a — broj zapisa je mali).
    let polozeneEtape: { medaljonId: number; nivo: number; naziv: string; slug: string; polozenoAt: string; procenat: number }[] = [];
    let polozenaKrunisanjaList: { krunisanjeId: number; nivo: number; naslov: string | null; polozenoAt: string; procenat: number }[] = [];
    try {
      const etapeRows = await db
        .select({
          medaljonId: etapaPolaganjaTable.medaljonId,
          procenat: etapaPolaganjaTable.procenat,
          createdAt: etapaPolaganjaTable.createdAt,
          nivo: medaljoniTable.nivo,
          naziv: medaljoniTable.naziv,
          slug: medaljoniTable.slug,
        })
        .from(etapaPolaganjaTable)
        .innerJoin(medaljoniTable, eq(etapaPolaganjaTable.medaljonId, medaljoniTable.id))
        .where(
          and(
            eq(etapaPolaganjaTable.studentId, studentIdStr),
            eq(etapaPolaganjaTable.polozeno, true),
          ),
        )
        .orderBy(asc(etapaPolaganjaTable.createdAt));
      const seen = new Set<number>();
      for (const r of etapeRows) {
        if (seen.has(r.medaljonId)) continue;
        seen.add(r.medaljonId);
        polozeneEtape.push({
          medaljonId: r.medaljonId,
          nivo: r.nivo,
          naziv: r.naziv,
          slug: r.slug,
          polozenoAt: r.createdAt.toISOString(),
          procenat: r.procenat,
        });
      }

      const krunRows = await db
        .select({
          krunisanjeId: studentKrunisanjaTable.krunisanjeId,
          procenat: studentKrunisanjaTable.procenat,
          polozenoAt: studentKrunisanjaTable.polozenoAt,
          nivo: krunisanjaTable.nivo,
          naslov: krunisanjaTable.naslov,
        })
        .from(studentKrunisanjaTable)
        .innerJoin(krunisanjaTable, eq(studentKrunisanjaTable.krunisanjeId, krunisanjaTable.id))
        .where(eq(studentKrunisanjaTable.studentId, studentIdStr))
        .orderBy(asc(krunisanjaTable.nivo));
      polozenaKrunisanjaList = krunRows.map((r) => ({
        krunisanjeId: r.krunisanjeId,
        nivo: r.nivo,
        naslov: r.naslov,
        polozenoAt: r.polozenoAt.toISOString(),
        procenat: r.procenat,
      }));
    } catch (err) {
      console.warn("[ucenik/profil] polozeneEtape/krunisanja failed", err);
    }

    const napredak = {
      streakDays: refreshed?.streakDays ?? progress?.streakDays ?? 0,
      totalHasanat: refreshed?.totalHasanat ?? progress?.totalHasanat ?? 0,
      completedCount: completedLessonIds.length,
      lastActivityDate: refreshed?.lastActivityDate ?? progress?.lastActivityDate ?? null,
      poNivou: completedByNivo,
      bedzevi,
      polozeneEtape,
      polozenaKrunisanja: polozenaKrunisanjaList,
    };

    res.json({ user, profil, grupa, muallim, ocjene, prisustvo, kvizovi, napredak });
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

// GET /api/ucenik/zadace — student sees active homework for their group.
// Supports per-student targeting: if a zadaca has rows in zadace_ucenici,
// it is visible only to the listed students. If no rows — visible to whole group.
router.get("/zadace", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [profil] = await db.select().from(ucenikProfiliTable).where(eq(ucenikProfiliTable.userId, userId));
    if (!profil?.grupaId) { res.json([]); return; }

    const allGroupZadace = await db.select().from(zadaceTable)
      .where(and(eq(zadaceTable.grupaId, profil.grupaId), eq(zadaceTable.isActive, true)))
      .orderBy(desc(zadaceTable.createdAt));

    if (allGroupZadace.length === 0) { res.json([]); return; }

    const targets = await db.select().from(zadaceUceniciTable)
      .where(inArray(zadaceUceniciTable.zadacaId, allGroupZadace.map(z => z.id)));

    const targetMap = new Map<number, Set<number>>();
    for (const t of targets) {
      if (!targetMap.has(t.zadacaId)) targetMap.set(t.zadacaId, new Set());
      targetMap.get(t.zadacaId)!.add(t.ucenikId);
    }

    const visible = allGroupZadace.filter(z => {
      const targeted = targetMap.get(z.id);
      if (!targeted) return true; // bez targeta = cijela grupa
      return targeted.has(userId);
    });

    res.json(visible);
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
