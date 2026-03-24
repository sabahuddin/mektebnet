import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { lessonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/lessons", async (req, res) => {
  try {
    const lessons = await db.select().from(lessonsTable).orderBy(lessonsTable.orderNum);
    const result = lessons.map((l) => ({
      id: l.id,
      orderNum: l.orderNum,
      slug: l.slug,
      title: l.title,
      lessonType: l.lessonType,
      letters: l.letters,
      durationMin: l.durationMin,
      isUnlocked: true,
      isCompleted: false,
      hasanatEarned: 0,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get lessons");
    res.status(500).json({ error: "internal_error", message: "Failed to get lessons" });
  }
});

router.get("/lessons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid lesson ID" });
      return;
    }
    const [lesson] = await db.select().from(lessonsTable).where(eq(lessonsTable.id, id)).limit(1);
    if (!lesson) {
      res.status(404).json({ error: "not_found", message: "Lesson not found" });
      return;
    }
    res.json({
      id: lesson.id,
      orderNum: lesson.orderNum,
      slug: lesson.slug,
      title: lesson.title,
      lessonType: lesson.lessonType,
      letters: lesson.letters,
      durationMin: lesson.durationMin,
      isUnlocked: true,
      isCompleted: false,
      hasanatEarned: 0,
      story: lesson.storyData || null,
      letterData: lesson.letterData || [],
      exercises: buildExerciseConfigs(lesson.exerciseTypes as string[]),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get lesson");
    res.status(500).json({ error: "internal_error", message: "Failed to get lesson" });
  }
});

function buildExerciseConfigs(types: string[]) {
  const configs: Record<string, { title: string; rounds: number; timeLimit?: number; hasanatReward: number }> = {
    find_letter: { title: "Pronađi slovo", rounds: 1, timeLimit: 90, hasanatReward: 15 },
    count_dots: { title: "Broji tačke", rounds: 12, hasanatReward: 10 },
    which_form: { title: "Koji oblik?", rounds: 8, hasanatReward: 10 },
    yes_no: { title: "Da ili Ne?", rounds: 15, hasanatReward: 12 },
    listen_recognize: { title: "Slušaj i prepoznaj", rounds: 10, hasanatReward: 12 },
    group_difference: { title: "Razlika unutar grupe", rounds: 10, hasanatReward: 12 },
  };
  return types.map((t) => ({ type: t, ...configs[t] }));
}

export default router;
