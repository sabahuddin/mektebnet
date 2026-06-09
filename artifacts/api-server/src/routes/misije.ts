import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { misijaDefinicijaTable, misijaProgressTable } from "@workspace/db";
import { sql, and, eq, isNotNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { getLang, overlayRows } from "../lib/content-translatable.js";

const router: IRouter = Router();

// === HELPERS — period keys ====================================================

// UTC YYYY-MM-DD za danas (dnevne misije se resetuju na ponoć UTC).
function getDailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// ISO sedmica (YYYY-Www). Sedmica počinje u ponedjeljak po ISO 8601.
// Implementacija je standardna: pomak da ponedjeljak=4, pa razlika dana / 7.
function getWeeklyKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // ISO: pon=1, ned=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Period start/end timestamps (za WHERE filtere u evaluatoru).
function getPeriodBounds(tip: "dnevna" | "sedmicna"): { startIso: string; endIso: string } {
  const now = new Date();
  if (tip === "dnevna") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  } else {
    // ISO sedmica: pon-ned. Pronađi ponedjeljak ove sedmice.
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (dayNum - 1));
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start.getTime() + 7 * 86400000 - 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }
}

// === EVALUATOR — računa trenutni progress za misiju ===========================
// Čita postojeće tabele (korisnik_napredak, kviz_rezultati, h5p_pokusaji,
// pogresni_odgovori). Sve query-je su SELECT — ne pišemo nikad iz evaluatora,
// samo /claim endpoint piše u misija_progress kad učenik klikne preuzmi.

interface MissionDef {
  id: number;
  kod: string;
  uvjetTip: string;
  uvjetParam: Record<string, unknown> | null;
  cilj: number;
  tip: string;
}

async function evaluateMission(userId: number, def: MissionDef): Promise<number> {
  const tip = def.tip === "sedmicna" ? "sedmicna" : "dnevna";
  const { startIso, endIso } = getPeriodBounds(tip);

  switch (def.uvjetTip) {
    case "complete_lesson_count": {
      // Broj completed ilmihal lekcija u periodu (po completed_at).
      const r = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM korisnik_napredak
        WHERE user_id = ${userId}
          AND content_type = 'ilmihal'
          AND zavrsen = TRUE
          AND completed_at >= ${startIso}
          AND completed_at <= ${endIso}
      `);
      return Number((r as unknown as { rows: { c: number }[] }).rows[0]?.c ?? 0);
    }
    case "quiz_high_score_count": {
      const minProcenat = Number((def.uvjetParam as Record<string, unknown>)?.minProcenat ?? 50);
      const r = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM kviz_rezultati
        WHERE user_id = ${userId}
          AND procenat >= ${minProcenat}
          AND completed_at >= ${startIso}
          AND completed_at <= ${endIso}
      `);
      return Number((r as unknown as { rows: { c: number }[] }).rows[0]?.c ?? 0);
    }
    case "fix_mistake_count": {
      const r = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM pogresni_odgovori
        WHERE user_id = ${userId}
          AND resolved_at IS NOT NULL
          AND resolved_at >= ${startIso}
          AND resolved_at <= ${endIso}
      `);
      return Number((r as unknown as { rows: { c: number }[] }).rows[0]?.c ?? 0);
    }
    case "h5p_attempt_count": {
      const r = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM h5p_pokusaji
        WHERE user_id = ${userId}
          AND completed_at >= ${startIso}
          AND completed_at <= ${endIso}
      `);
      return Number((r as unknown as { rows: { c: number }[] }).rows[0]?.c ?? 0);
    }
    default:
      return 0;
  }
}

// === ENDPOINTS =================================================================

// GET /api/misije/aktivne — vraća sve aktivne misije za current period sa
// per-user progress-om (evaluiran on-the-fly + cached u misija_progress
// tabeli za historijski uvid).
router.get("/aktivne", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const defs = await db.select()
      .from(misijaDefinicijaTable)
      .where(eq(misijaDefinicijaTable.aktivna, true));

    const result: Array<Record<string, unknown>> = [];
    for (const def of defs) {
      const tip = def.tip === "sedmicna" ? "sedmicna" : "dnevna";
      const periodKey = tip === "sedmicna" ? getWeeklyKey() : getDailyKey();

      const trenutno = await evaluateMission(userId, {
        id: def.id,
        kod: def.kod,
        uvjetTip: def.uvjetTip,
        uvjetParam: def.uvjetParam as Record<string, unknown> | null,
        cilj: def.cilj,
        tip: def.tip,
      });

      const completed = trenutno >= def.cilj;

      // Upsert progress cache (za historijske misije / claim status).
      // ON CONFLICT: ako postoji red, ažuriraj trenutno + completedAt
      // (samo postavi completedAt prvi put; jednom postavljen ne mijenjaj).
      await db.execute(sql`
        INSERT INTO misija_progress (user_id, misija_id, period_key, trenutno, completed_at, created_at, updated_at)
        VALUES (${userId}, ${def.id}, ${periodKey}, ${trenutno}, ${completed ? sql`NOW()` : sql`NULL`}, NOW(), NOW())
        ON CONFLICT (user_id, misija_id, period_key) DO UPDATE
          SET trenutno = EXCLUDED.trenutno,
              completed_at = COALESCE(misija_progress.completed_at, EXCLUDED.completed_at),
              updated_at = NOW()
      `);

      // Provjeri da li je već claim-ovano za ovaj period.
      const [progRow] = await db.select()
        .from(misijaProgressTable)
        .where(and(
          eq(misijaProgressTable.userId, userId),
          eq(misijaProgressTable.misijaId, def.id),
          eq(misijaProgressTable.periodKey, periodKey),
        ))
        .limit(1);

      result.push({
        id: def.id,
        kod: def.kod,
        naziv: def.naziv,
        opis: def.opis,
        tip: def.tip,
        ikona: def.ikona,
        cilj: def.cilj,
        trenutno,
        completed,
        claimedAt: progRow?.claimedAt ?? null,
        nagradaAferim: def.nagradaAferim,
        nagradaMed: def.nagradaMed,
        periodKey,
      });
    }

    // Sortiraj: dnevne prvo, onda sedmične; unutar grupe — nezavršene prvo.
    result.sort((a, b) => {
      if (a.tip !== b.tip) return a.tip === "dnevna" ? -1 : 1;
      const aDone = a.claimedAt ? 2 : a.completed ? 1 : 0;
      const bDone = b.claimedAt ? 2 : b.completed ? 1 : 0;
      return aDone - bDone;
    });

    await overlayRows(result, "misija_definicija", getLang(req));
    res.json({ misije: result });
  } catch (err) {
    req.log.error({ err }, "misije/aktivne failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/misije/:id/claim — preuzmi nagradu za završenu misiju.
router.post("/:id/claim", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const misijaId = Number(req.params.id);
    if (!Number.isInteger(misijaId) || misijaId <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }

    const [def] = await db.select()
      .from(misijaDefinicijaTable)
      .where(eq(misijaDefinicijaTable.id, misijaId))
      .limit(1);
    if (!def || !def.aktivna) {
      res.status(404).json({ error: "misija_not_found" });
      return;
    }

    const tip = def.tip === "sedmicna" ? "sedmicna" : "dnevna";
    const periodKey = tip === "sedmicna" ? getWeeklyKey() : getDailyKey();

    // Re-evaluiraj odmah (anti-cheat: progress se uvijek računa server-side
    // iz autoritativnih tabela, ne iz cache reda u misija_progress).
    const trenutno = await evaluateMission(userId, {
      id: def.id,
      kod: def.kod,
      uvjetTip: def.uvjetTip,
      uvjetParam: def.uvjetParam as Record<string, unknown> | null,
      cilj: def.cilj,
      tip: def.tip,
    });

    if (trenutno < def.cilj) {
      res.status(422).json({
        error: "not_completed",
        message: "Misija još nije završena.",
        trenutno,
        cilj: def.cilj,
      });
      return;
    }

    // Atomski claim u dva koraka — POTPUNO race-safe:
    //
    // 1) Osiguraj da red postoji (INSERT ... ON CONFLICT DO NOTHING). Ovo
    //    NE postavlja claimed_at; samo garantuje da postoji red prije UPDATE.
    // 2) UPDATE ... WHERE claimed_at IS NULL RETURNING. Tačno jedan poziv
    //    može preokrenuti claimed_at iz NULL u NOW(); svi sljedeći (čak i
    //    paralelni) ne pogode WHERE pa RETURNING je prazan i NE awarda.
    await db.execute(sql`
      INSERT INTO misija_progress (user_id, misija_id, period_key, trenutno, completed_at, created_at, updated_at)
      VALUES (${userId}, ${def.id}, ${periodKey}, ${trenutno}, NOW(), NOW(), NOW())
      ON CONFLICT (user_id, misija_id, period_key) DO UPDATE
        SET trenutno = EXCLUDED.trenutno,
            completed_at = COALESCE(misija_progress.completed_at, EXCLUDED.completed_at),
            updated_at = NOW()
    `);
    const claimResult = await db.execute(sql`
      UPDATE misija_progress
         SET claimed_at = NOW(),
             updated_at = NOW()
       WHERE user_id = ${userId}
         AND misija_id = ${def.id}
         AND period_key = ${periodKey}
         AND claimed_at IS NULL
       RETURNING id
    `);
    const isFirstClaim = (claimResult as unknown as { rows: unknown[] }).rows.length > 0;

    if (!isFirstClaim) {
      res.json({
        ok: true,
        alreadyClaimed: true,
        message: "Nagrada je već preuzeta.",
        nagradaAferim: 0,
        nagradaMed: 0,
      });
      return;
    }

    // Tek sad (kad smo sigurni da smo MI postavili claimed_at) — dodjeli
    // nagrade u student_progress. Ovo je sad strogo idempotentno preko
    // misija_progress.claimed_at = ON/OFF preklopka.
    const studentIdStr = String(userId);
    if (def.nagradaAferim > 0 || def.nagradaMed > 0) {
      await db.execute(sql`
        INSERT INTO student_progress (student_id, total_hasanat, total_med, completed_lessons, badges, streak_days, last_activity_date, created_at, updated_at)
        VALUES (${studentIdStr}, ${def.nagradaAferim}, ${def.nagradaMed}, '[]'::jsonb, '[]'::jsonb, 0, NULL, NOW(), NOW())
        ON CONFLICT (student_id) DO UPDATE
          SET total_hasanat = student_progress.total_hasanat + ${def.nagradaAferim},
              total_med = student_progress.total_med + ${def.nagradaMed},
              updated_at = NOW()
      `);
    }

    res.json({
      ok: true,
      claimed: true,
      nagradaAferim: def.nagradaAferim,
      nagradaMed: def.nagradaMed,
      message: `Bravo! Misija "${def.naziv}" završena.`,
    });
  } catch (err) {
    req.log.error({ err }, "misije/claim failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// === SEED — ubaci default misije na startup-u ako tabela prazna ================
// Pozvano iz src/index.ts. Idempotentno preko UNIQUE (kod). Postojeće misije
// se NE prepisuju (ostavlja prostor admin-u da kasnije edituje nazive/nagrade).

const DEFAULT_MISIJE: Array<{
  kod: string;
  naziv: string;
  opis: string;
  tip: "dnevna" | "sedmicna";
  uvjetTip: string;
  uvjetParam: Record<string, unknown>;
  cilj: number;
  nagradaAferim: number;
  nagradaMed: number;
  ikona: string;
}> = [
  { kod: "daily_lesson_1", naziv: "Završi 1 lekciju", opis: "Pročitaj jednu ilmihal lekciju do kraja.", tip: "dnevna", uvjetTip: "complete_lesson_count", uvjetParam: {}, cilj: 1, nagradaAferim: 20, nagradaMed: 0, ikona: "📖" },
  { kod: "daily_quiz_1", naziv: "Položi 1 kviz", opis: "Završi jedan kviz s najmanje 50% tačnih odgovora.", tip: "dnevna", uvjetTip: "quiz_high_score_count", uvjetParam: { minProcenat: 50 }, cilj: 1, nagradaAferim: 15, nagradaMed: 0, ikona: "❓" },
  { kod: "daily_fix_3", naziv: "Popravi 3 greške", opis: "Riješi 3 greške u Popravi saću.", tip: "dnevna", uvjetTip: "fix_mistake_count", uvjetParam: {}, cilj: 3, nagradaAferim: 25, nagradaMed: 1, ikona: "🛠️" },
  { kod: "daily_h5p_1", naziv: "Riješi 1 vježbu", opis: "Završi jednu interaktivnu vježbu.", tip: "dnevna", uvjetTip: "h5p_attempt_count", uvjetParam: {}, cilj: 1, nagradaAferim: 10, nagradaMed: 0, ikona: "🎮" },

  { kod: "weekly_lessons_5", naziv: "Završi 5 lekcija", opis: "Ove sedmice završi 5 ilmihal lekcija.", tip: "sedmicna", uvjetTip: "complete_lesson_count", uvjetParam: {}, cilj: 5, nagradaAferim: 100, nagradaMed: 3, ikona: "📚" },
  { kod: "weekly_quizzes_3", naziv: "Polozi 3 kviza s 80%+", opis: "Tri kviza s rezultatom 80% ili više.", tip: "sedmicna", uvjetTip: "quiz_high_score_count", uvjetParam: { minProcenat: 80 }, cilj: 3, nagradaAferim: 75, nagradaMed: 5, ikona: "🏆" },
  { kod: "weekly_fix_10", naziv: "Popravi 10 grešaka", opis: "Sedmični izazov: popravi 10 rupa u saću.", tip: "sedmicna", uvjetTip: "fix_mistake_count", uvjetParam: {}, cilj: 10, nagradaAferim: 100, nagradaMed: 5, ikona: "🍯" },
];

export async function seedMisije(): Promise<void> {
  try {
    let inserted = 0;
    for (const m of DEFAULT_MISIJE) {
      const r = await db.execute(sql`
        INSERT INTO misija_definicija (kod, naziv, opis, tip, uvjet_tip, uvjet_param, cilj, nagrada_aferim, nagrada_med, ikona, aktivna, created_at)
        VALUES (${m.kod}, ${m.naziv}, ${m.opis}, ${m.tip}, ${m.uvjetTip}, ${JSON.stringify(m.uvjetParam)}::jsonb, ${m.cilj}, ${m.nagradaAferim}, ${m.nagradaMed}, ${m.ikona}, TRUE, NOW())
        ON CONFLICT (kod) DO NOTHING
        RETURNING id
      `);
      if ((r as unknown as { rows: unknown[] }).rows.length > 0) inserted++;
    }
    if (inserted > 0) {
      logger.info({ inserted }, "Misije seed: inserted default missions");
    }
  } catch (e) {
    logger.error({ err: e }, "Misije seed failed");
  }
}

export default router;
