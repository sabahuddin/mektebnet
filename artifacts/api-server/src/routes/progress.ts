import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { studentProgressTable, exerciseSessionsTable, embedCompletionsTable, prilozi } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { evaluateAndPersistBadges } from "../lib/badges.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/progress", async (req, res) => {
  try {
    const studentId = (req.query.studentId as string) || "anonymous";
    let [progress] = await db
      .select()
      .from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentId))
      .limit(1);

    if (!progress) {
      const [created] = await db
        .insert(studentProgressTable)
        .values({
          studentId,
          totalHasanat: 0,
          completedLessons: [],
          badges: [],
          streakDays: 0,
        })
        .returning();
      progress = created;
    }

    res.json({
      studentId: progress.studentId,
      totalHasanat: progress.totalHasanat,
      totalMed: progress.totalMed,
      completedLessons: progress.completedLessons,
      badges: progress.badges,
      streakDays: progress.streakDays,
      lastActivityDate: progress.lastActivityDate || null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get progress");
    res.status(500).json({ error: "internal_error", message: "Failed to get progress" });
  }
});

router.post("/progress/lesson", async (req, res) => {
  try {
    const { studentId, lessonId, score, maxScore, timeSpentSeconds } = req.body;
    if (!studentId || !lessonId) {
      res.status(400).json({ error: "bad_request", message: "studentId and lessonId required" });
      return;
    }

    let [progress] = await db
      .select()
      .from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentId))
      .limit(1);

    // Med (DB kolona total_hasanat — UI je relabelovao u "Kapi meda") za
    // završenu lekciju: 30 po lekciji. Ranije 10/20 — povećano po zahtjevu
    // korisnika ("med za znanje, više nagrade za učenje nego za igricu").
    const hasanatEarned = 30;
    const today = new Date().toISOString().split("T")[0];

    if (!progress) {
      const [created] = await db
        .insert(studentProgressTable)
        .values({
          studentId,
          totalHasanat: hasanatEarned,
          completedLessons: [lessonId],
          badges: [],
          streakDays: 1,
          lastActivityDate: today,
        })
        .returning();
      progress = created;
    } else {
      const completedLessons = progress.completedLessons as number[];
      if (!completedLessons.includes(lessonId)) {
        completedLessons.push(lessonId);
      }
      const lastActivity = progress.lastActivityDate;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      let streakDays = progress.streakDays;
      if (lastActivity === yesterdayStr) {
        streakDays += 1;
      } else if (lastActivity !== today) {
        streakDays = 1;
      }

      const [updated] = await db
        .update(studentProgressTable)
        .set({
          totalHasanat: progress.totalHasanat + hasanatEarned,
          completedLessons,
          streakDays,
          lastActivityDate: today,
          updatedAt: new Date(),
        })
        .where(eq(studentProgressTable.studentId, studentId))
        .returning();
      progress = updated;
    }

    // Evaluate and persist any newly-earned badges
    let novelyEarned: Awaited<ReturnType<typeof evaluateAndPersistBadges>> = [];
    const userIdNum = Number(progress.studentId);
    if (Number.isFinite(userIdNum)) {
      try {
        novelyEarned = await evaluateAndPersistBadges(userIdNum);
        if (novelyEarned.length > 0) {
          const [reread] = await db
            .select()
            .from(studentProgressTable)
            .where(eq(studentProgressTable.studentId, progress.studentId))
            .limit(1);
          if (reread) progress = reread;
        }
      } catch (badgeErr) {
        req.log.error({ err: badgeErr }, "Failed to evaluate badges after lesson");
      }
    }

    res.json({
      studentId: progress.studentId,
      totalHasanat: progress.totalHasanat,
      completedLessons: progress.completedLessons,
      badges: progress.badges,
      streakDays: progress.streakDays,
      lastActivityDate: progress.lastActivityDate || null,
      newBadges: novelyEarned,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save lesson progress");
    res.status(500).json({ error: "internal_error", message: "Failed to save progress" });
  }
});

router.post("/exercises/session", async (req, res) => {
  try {
    const { studentId, lessonId, exerciseType, correctAnswers, totalQuestions, timeSpentSeconds } = req.body;
    if (!studentId || !lessonId || !exerciseType) {
      res.status(400).json({ error: "bad_request", message: "studentId, lessonId, exerciseType required" });
      return;
    }

    const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
    let hasanatEarned = Math.round(accuracy * 10);
    if (accuracy === 1) hasanatEarned += 5;

    await db.insert(exerciseSessionsTable).values({
      studentId,
      lessonId,
      exerciseType,
      correctAnswers,
      totalQuestions,
      timeSpentSeconds,
      hasanatEarned,
    });

    let [progress] = await db
      .select()
      .from(studentProgressTable)
      .where(eq(studentProgressTable.studentId, studentId))
      .limit(1);

    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newBadges: object[] = [];
    let previousHasanat = 0;
    let totalHasanat = hasanatEarned;
    let previousStreakDays = 0;
    let streakDays = 1;

    if (!progress) {
      const [created] = await db
        .insert(studentProgressTable)
        .values({
          studentId,
          totalHasanat: hasanatEarned,
          completedLessons: [],
          badges: [],
          streakDays: 1,
          lastActivityDate: today,
        })
        .returning();
      progress = created;
    } else {
      previousHasanat = progress.totalHasanat;
      previousStreakDays = progress.streakDays;
      const newTotal = progress.totalHasanat + hasanatEarned;
      const badges = progress.badges as Array<{ id: string }>;

      if (newTotal >= 500 && !badges.find((b) => b.id === "gem")) {
        const newBadge = { id: "gem", name: "Dragulj mekteba", emoji: "💎", description: "Skupio/la 500 hasanat bodova", earnedAt: new Date().toISOString() };
        newBadges.push(newBadge);
        badges.push(newBadge);
      }

      streakDays = progress.streakDays;
      if (progress.lastActivityDate !== today) {
        if (progress.lastActivityDate === yesterdayStr) streakDays += 1;
        else streakDays = 1;
      }

      await db
        .update(studentProgressTable)
        .set({
          totalHasanat: newTotal,
          badges,
          streakDays,
          lastActivityDate: today,
          updatedAt: new Date(),
        })
        .where(eq(studentProgressTable.studentId, studentId));

      totalHasanat = newTotal;
    }

    const streakIncreased = streakDays > previousStreakDays;
    const streakBonus = 0;

    res.json({
      hasanatEarned,
      newBadges,
      totalHasanat,
      streakBonus,
      previousHasanat,
      hasanatGained: hasanatEarned,
      streakDays,
      streakIncreased,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save exercise session");
    res.status(500).json({ error: "internal_error", message: "Failed to save exercise session" });
  }
});

// POST /content/embed/zavrseno — učenik kaže "Završio sam embed vježbu".
//
// SIGURNOST: requireAuth + requireRole("ucenik"). studentId se čita ISKLJUČIVO
// iz JWT-a (req.user.userId), NE iz body-ja — inače bi bilo koji prijavljeni
// korisnik mogao claim-ovati hasanate za tuđi račun (IDOR).
//
// Server NE može verifikovati tačnost (eksterni iframe), pa samo provjerava:
//   1) prilog postoji, kind='embed', approved=true
//   2) (student_id, prilozi_id) još nije u embed_completions (anti-double-claim)
//   3) hasanat_reward > 0
//
// Insert u embed_completions + upsert u student_progress idu u JEDNU
// transakciju — ako upsert padne, insert se rollback-a, pa učenik može
// pokušati ponovo (umjesto da ostane "već claim-ovan" bez nagrade).
router.post(
  "/content/embed/zavrseno",
  requireAuth,
  requireRole("ucenik"),
  async (req: Request, res: Response) => {
    try {
      const studentId = String(req.user!.userId);
      const { priloziId } = (req.body || {}) as { priloziId?: number };
      const pid = Number(priloziId);
      if (!Number.isFinite(pid) || pid <= 0) {
        return res.status(400).json({ error: "bad_request", message: "priloziId required" });
      }

      const [prilog] = await db.select().from(prilozi).where(eq(prilozi.id, pid));
      if (!prilog) return res.status(404).json({ error: "not_found", message: "Prilog nije pronađen" });
      if (prilog.kind !== "embed") {
        return res.status(400).json({ error: "bad_request", message: "Samo embed vježbe" });
      }
      if (!prilog.approved) {
        return res.status(403).json({ error: "not_approved", message: "Vježba nije odobrena" });
      }
      const reward = Number(prilog.hasanatReward) || 0;
      if (reward <= 0) {
        return res.json({ hasanatGained: 0, alreadyClaimed: false, reason: "no_reward" });
      }

      const today = new Date().toISOString().split("T")[0];

      // TRANSACT: insert audit + upsert hasanata atomski. Ako bilo koji
      // korak padne, oba se rollback-aju (tx throw → drizzle rollback).
      const result = await db.transaction(async (tx) => {
        // Anti-double-claim — atomski INSERT sa ON CONFLICT DO NOTHING.
        // RETURNING je prazan ako conflict (već claim-ovano), ima red ako insert prošao.
        const insertRes = await tx.execute<{ id: number }>(sql`
          INSERT INTO embed_completions (student_id, prilozi_id, hasanat_gained)
          VALUES (${studentId}, ${pid}, ${reward})
          ON CONFLICT (student_id, prilozi_id) DO NOTHING
          RETURNING id
        `);
        const insertRows = (insertRes as unknown as { rows?: unknown[] }).rows
          ?? (Array.isArray(insertRes) ? (insertRes as unknown as unknown[]) : []);
        if (!insertRows || insertRows.length === 0) {
          return { alreadyClaimed: true as const };
        }

        // Atomski upsert hasanata u student_progress (lost-update safe).
        const upsert = await tx.execute<{ total_hasanat: number; previous_hasanat: number }>(sql`
          INSERT INTO student_progress (student_id, total_hasanat, completed_lessons, badges, streak_days, last_activity_date)
          VALUES (${studentId}, ${reward}, '[]'::jsonb, '[]'::jsonb, 1, ${today})
          ON CONFLICT (student_id) DO UPDATE SET
            total_hasanat = student_progress.total_hasanat + ${reward},
            last_activity_date = ${today},
            updated_at = NOW()
          RETURNING
            total_hasanat,
            (total_hasanat - ${reward})::int AS previous_hasanat
        `);
        const upsertRows = (upsert as unknown as { rows?: Array<{ total_hasanat: number; previous_hasanat: number }> }).rows
          ?? (Array.isArray(upsert) ? (upsert as unknown as Array<{ total_hasanat: number; previous_hasanat: number }>) : []);
        const row = upsertRows[0];
        return {
          alreadyClaimed: false as const,
          totalHasanat: Number(row?.total_hasanat ?? reward),
          previousHasanat: Number(row?.previous_hasanat ?? 0),
        };
      });

      if (result.alreadyClaimed) {
        return res.json({ hasanatGained: 0, alreadyClaimed: true });
      }
      res.json({
        hasanatGained: reward,
        totalHasanat: result.totalHasanat,
        previousHasanat: result.previousHasanat,
        alreadyClaimed: false,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to claim embed completion");
      res.status(500).json({ error: "internal_error", message: "Failed to claim" });
    }
  },
);

export default router;
