import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { studentProgressTable, exerciseSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { evaluateAndPersistBadges } from "../lib/badges.js";

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

    const hasanatEarned = score >= maxScore * 0.9 ? 20 : 10;
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

export default router;
