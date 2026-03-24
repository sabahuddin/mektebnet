import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { studentProgressTable, exerciseSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

    res.json({
      studentId: progress.studentId,
      totalHasanat: progress.totalHasanat,
      completedLessons: progress.completedLessons,
      badges: progress.badges,
      streakDays: progress.streakDays,
      lastActivityDate: progress.lastActivityDate || null,
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

    const accuracy = correctAnswers / totalQuestions;
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

    let newBadges: object[] = [];
    let totalHasanat = hasanatEarned;
    let streakBonus = 0;

    if (progress) {
      const newTotal = progress.totalHasanat + hasanatEarned;
      const badges = progress.badges as Array<{ id: string }>;

      if (newTotal >= 500 && !badges.find((b) => b.id === "gem")) {
        const newBadge = { id: "gem", name: "Dragulj mekteba", emoji: "💎", description: "Skupio/la 500 hasanat bodova", earnedAt: new Date().toISOString() };
        newBadges.push(newBadge);
        badges.push(newBadge);
      }

      await db
        .update(studentProgressTable)
        .set({ totalHasanat: newTotal, badges, updatedAt: new Date() })
        .where(eq(studentProgressTable.studentId, studentId));

      totalHasanat = newTotal;
    }

    res.json({ hasanatEarned, newBadges, totalHasanat, streakBonus });
  } catch (err) {
    req.log.error({ err }, "Failed to save exercise session");
    res.status(500).json({ error: "internal_error", message: "Failed to save exercise session" });
  }
});

export default router;
