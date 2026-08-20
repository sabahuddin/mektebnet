import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { studentProgressTable, exerciseSessionsTable, embedCompletionsTable, prilozi } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { evaluateAndPersistBadges } from "../lib/badges.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

// Sav napredak pripada isključivo prijavljenom učeniku. Nikada ne prihvatamo
// studentId iz query-ja ili body-ja: to bi svakom prijavljenom korisniku dalo
// mogućnost da čita ili mijenja tuđi napredak.
//
// Ovaj router je montiran na API korijenu jer čuva i /progress i /exercises
// rute. Zato guard mora biti vezan za ta dva prefiksa — globalni router.use()
// bi presreo i /admin, /muallim i svaku narednu API rutu.
router.use("/progress", requireAuth, requireRole("ucenik"));
router.use("/exercises", requireAuth, requireRole("ucenik"));

router.get("/progress", async (req, res) => {
  try {
    const studentId = String(req.user!.userId);
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
    const lessonId = Number(req.body?.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      res.status(400).json({ error: "bad_request", message: "lessonId required" });
      return;
    }

    // Med (DB kolona total_hasanat — UI je relabelovao u "Kapi meda") za
    // završenu lekciju: 30 po lekciji. Ranije 10/20 — povećano po zahtjevu
    // korisnika ("med za znanje, više nagrade za učenje nego za igricu").
    const hasanatEarned = 30;
    const today = new Date().toISOString().split("T")[0];
    const studentId = String(req.user!.userId);

    // Prvi INSERT je atomski. Ako je red već kreirao paralelni zahtjev,
    // ON CONFLICT čeka da se taj zahtjev završi; zatim FOR UPDATE serijalizira
    // provjeru i promjenu completedLessons. Time jedna lekcija može nagraditi
    // učenika samo jednom, čak i kada klik ili mreža pošalju više zahtjeva.
    let { progress, newCompletion } = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(studentProgressTable)
        .values({
          studentId,
          totalHasanat: hasanatEarned,
          completedLessons: [lessonId],
          badges: [],
          streakDays: 1,
          lastActivityDate: today,
        })
        .onConflictDoNothing()
        .returning();

      if (created) return { progress: created, newCompletion: true };

      await tx.execute(sql`
        SELECT id
        FROM student_progress
        WHERE student_id = ${studentId}
        FOR UPDATE
      `);

      const [current] = await tx
        .select()
        .from(studentProgressTable)
        .where(eq(studentProgressTable.studentId, studentId))
        .limit(1);
      if (!current) throw new Error("Student progress row was not found after conflict");

      const completedLessons = Array.isArray(current.completedLessons)
        ? [...current.completedLessons]
        : [];
      if (completedLessons.includes(lessonId)) {
        return { progress: current, newCompletion: false };
      }

      completedLessons.push(lessonId);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const streakDays = current.lastActivityDate === yesterdayStr
        ? current.streakDays + 1
        : current.lastActivityDate === today
          ? current.streakDays
          : 1;

      const [updated] = await tx
        .update(studentProgressTable)
        .set({
          totalHasanat: current.totalHasanat + hasanatEarned,
          completedLessons,
          streakDays,
          lastActivityDate: today,
          updatedAt: new Date(),
        })
        .where(eq(studentProgressTable.id, current.id))
        .returning();
      if (!updated) throw new Error("Student progress row was not updated");

      return { progress: updated, newCompletion: true };
    });

    // Evaluate and persist any newly-earned badges
    let novelyEarned: Awaited<ReturnType<typeof evaluateAndPersistBadges>> = [];
    const userIdNum = Number(progress.studentId);
    if (newCompletion && Number.isFinite(userIdNum)) {
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
      newCompletion,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save lesson progress");
    res.status(500).json({ error: "internal_error", message: "Failed to save progress" });
  }
});

router.post("/exercises/session", async (req, res) => {
  try {
    const studentId = String(req.user!.userId);
    const { lessonId, exerciseType, correctAnswers, totalQuestions, timeSpentSeconds } = req.body ?? {};
    if (!Number.isInteger(Number(lessonId)) || Number(lessonId) <= 0 || typeof exerciseType !== "string" || !exerciseType) {
      res.status(400).json({ error: "bad_request", message: "lessonId and exerciseType required" });
      return;
    }

    const safeCorrectAnswers = Number(correctAnswers);
    const safeTotalQuestions = Number(totalQuestions);
    const safeTimeSpentSeconds = Number(timeSpentSeconds);
    if (
      !Number.isInteger(safeCorrectAnswers) ||
      !Number.isInteger(safeTotalQuestions) ||
      !Number.isFinite(safeTimeSpentSeconds) ||
      safeCorrectAnswers < 0 ||
      safeTotalQuestions <= 0 ||
      safeCorrectAnswers > safeTotalQuestions ||
      safeTimeSpentSeconds < 0
    ) {
      res.status(400).json({ error: "bad_request", message: "Invalid exercise result" });
      return;
    }

    const accuracy = safeCorrectAnswers / safeTotalQuestions;
    let hasanatEarned = Math.round(accuracy * 10);
    if (accuracy === 1) hasanatEarned += 5;

    await db.insert(exerciseSessionsTable).values({
      studentId,
      lessonId: Number(lessonId),
      exerciseType,
      correctAnswers: safeCorrectAnswers,
      totalQuestions: safeTotalQuestions,
      timeSpentSeconds: safeTimeSpentSeconds,
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
      return res.json({
        hasanatGained: reward,
        totalHasanat: result.totalHasanat,
        previousHasanat: result.previousHasanat,
        alreadyClaimed: false,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to claim embed completion");
      return res.status(500).json({ error: "internal_error", message: "Failed to claim" });
    }
  },
);

export default router;
