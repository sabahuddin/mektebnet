import { Router, type Request, type Response } from "express";
import { db, staticVjezbaPokusajiTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { multiplierForAttempt, rewardCapForAttempt } from "../lib/h5p-rules.js";
import { getStaticVjezba } from "../lib/static-vjezbe.js";
import { getEffectiveStaticVjezbaSource } from "../lib/static-vjezba-source.js";

const router = Router();

// Javni endpoint namjerno ne koristi requireAuth: statičke vježbe se učitavaju
// u iframe-u, koji ne može dodati Authorization header.  Efektivni HTML i dalje
// prolazi kroz poznati ključ, pa se ne može koristiti za čitanje proizvoljnih
// fajlova sa servera.
router.get("/:key/content", async (req: Request, res: Response): Promise<void> => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  if (!getStaticVjezba(key)) {
    res.status(404).json({ error: "Vježba nije registrovana" });
    return;
  }
  try {
    const source = await getEffectiveStaticVjezbaSource(key);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Admin može mijenjati HTML, ali vježba uvijek ostaje u zasebnom,
    // opaque-origin sandboxu. Tako greška u izvoru ne može pristupiti
    // aplikacijskom tokenu, kolačićima niti DOM-u roditeljske stranice.
    // Jedini legacy bundler (11–20) koristi ugrađeni Babel/deklarativni
    // renderer koji zahtijeva eval. Izuzetak ostaje ograničen na njegov
    // opaque-origin sandbox; ostale vježbe zadržavaju strožiji script-src.
    const scriptSrc = key === "etapa-lekcije-11-20"
      ? "script-src 'unsafe-inline' 'unsafe-eval' 'self' data: blob:"
      : "script-src 'unsafe-inline' 'self' data: blob:";
    res.setHeader(
      "Content-Security-Policy",
      `sandbox allow-scripts; default-src 'self' data: blob:; ${scriptSrc}; style-src 'unsafe-inline' 'self' data:; img-src 'self' data: blob:`,
    );
    res.send(source.sourceHtml);
  } catch (error) {
    req.log.error({ error, key }, "Čitanje statičke vježbe nije uspjelo");
    res.status(500).json({ error: "Greška pri učitavanju vježbe" });
  }
});

router.post("/:key/result", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
    const config = getStaticVjezba(key);
    if (!config) { res.status(404).json({ error: "Vježba nije registrovana" }); return; }

    const score = Number(req.body?.score);
    const maxScore = Number(req.body?.maxScore);
    if (!Number.isInteger(score) || !Number.isInteger(maxScore)
      || maxScore !== config.maxScore || score !== config.maxScore) {
      res.status(400).json({ error: "Vježba još nije završena" });
      return;
    }

    const userId = req.user!.userId;
    const today = new Date().toISOString().slice(0, 10);
    const saved = await db.transaction(async (tx) => {
      // Serijalizira istovremene poruke iste vježbe za istog učenika.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${config.key}`}))`);
      const previous = await tx.select({ attemptNo: staticVjezbaPokusajiTable.attemptNo })
        .from(staticVjezbaPokusajiTable)
        .where(and(
          eq(staticVjezbaPokusajiTable.userId, userId),
          eq(staticVjezbaPokusajiTable.exerciseKey, config.key),
        ))
        .orderBy(desc(staticVjezbaPokusajiTable.attemptNo))
        .limit(1);
      const attemptNo = (previous[0]?.attemptNo ?? 0) + 1;
      const hasanatGained = rewardCapForAttempt(attemptNo);
      const [attempt] = await tx.insert(staticVjezbaPokusajiTable).values({
        userId,
        exerciseKey: config.key,
        attemptNo,
        score,
        maxScore,
        procenat: 100,
        hasanatGained,
      }).returning();

      const progress = await tx.execute<{ total_hasanat: number }>(sql`
        INSERT INTO student_progress (student_id, total_hasanat, completed_lessons, badges, streak_days, last_activity_date)
        VALUES (${String(userId)}, ${hasanatGained}, '[]'::jsonb, '[]'::jsonb, 1, ${today})
        ON CONFLICT (student_id) DO UPDATE SET
          total_hasanat = student_progress.total_hasanat + EXCLUDED.total_hasanat,
          last_activity_date = EXCLUDED.last_activity_date,
          updated_at = NOW()
        RETURNING total_hasanat
      `);
      const rows = (progress as unknown as { rows?: Array<{ total_hasanat: number }> }).rows ?? [];
      return { attempt, totalHasanat: Number(rows[0]?.total_hasanat ?? hasanatGained) };
    });

    res.json({
      exerciseKey: config.key,
      attemptNo: saved.attempt.attemptNo,
      score: saved.attempt.score,
      maxScore: saved.attempt.maxScore,
      procenat: saved.attempt.procenat,
      rewardCap: rewardCapForAttempt(saved.attempt.attemptNo),
      multiplier: multiplierForAttempt(saved.attempt.attemptNo),
      hasanatGained: saved.attempt.hasanatGained,
      totalHasanat: saved.totalHasanat,
    });
  } catch (error) {
    req.log.error({ error }, "Spremanje statičke vježbe nije uspjelo");
    res.status(500).json({ error: "Greška pri spremanju vježbe" });
  }
});

router.get("/:key/attempts", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const config = getStaticVjezba(key);
  if (!config) { res.status(404).json({ error: "Vježba nije registrovana" }); return; }
  const attempts = await db.select().from(staticVjezbaPokusajiTable).where(and(
    eq(staticVjezbaPokusajiTable.userId, req.user!.userId),
    eq(staticVjezbaPokusajiTable.exerciseKey, config.key),
  )).orderBy(desc(staticVjezbaPokusajiTable.attemptNo));
  res.json({ attempts, nextAttemptNo: attempts.length + 1, nextRewardCap: rewardCapForAttempt(attempts.length + 1) });
});

export default router;