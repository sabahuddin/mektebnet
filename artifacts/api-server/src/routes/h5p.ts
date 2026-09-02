import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { prilozi, h5pPokusajiTable, studentProgressTable } from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  lockUntilForAttempt,
  multiplierForAttempt,
  rewardCapForAttempt,
} from "../lib/h5p-rules.js";

const router = Router();

interface DbExecResult<T = Record<string, unknown>> {
  rows: T[];
}
async function exec<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<DbExecResult<T>> {
  return (await db.execute(query)) as unknown as DbExecResult<T>;
}

// POST /api/h5p/result — "server-side" scoring + reward.
//
// VAŽNA SIGURNOSNA NAPOMENA (svjesno prihvaćen trade-off):
// H5P se izvršava 100% u browseru (h5p-standalone, bez Drupal/Moodle
// runtime-a), pa SERVER NEMA NAČIN VERIFIKOVATI da je score iz xAPI
// poruke stvaran rezultat rješavanja. Svaki autentifikovan korisnik
// može tehnički POST-ati `score=maxScore` bez rješavanja vježbe.
//
// Mitigacije koje primjenjujemo (zato je farming neisplativ, a ne nemoguć):
//   1) Nagrada po pokušaju: 1.=do 5, 2.=do 3, 3+=0 — nakon 2 pokušaja
//      na istom prilogu nikakav score ne donosi hasanate.
//   2) Ako je rezultat 100%, novi pokušaj se zaključava 48 sati.
//   3) Atomski upsert hasanata (lost-update safe).
//
// Pravo server-side ocjenjivanje H5P-a zahtijeva H5P CMS server stack
// koji ovaj projekat svjesno NE uključuje (out of scope za mekteb).
//
// Server VALIDIRA:
//   - prilog postoji i kind='h5p'
//   - maxScore > 0 i score u [0, maxScore]
//   - attempt_no se računa preko DB unique indexa + retry petlje.
// SAMO učenici mogu submitati H5P pokušaj — admin/muallim/roditelj nemaju
// pravo "skupljati" hasanate (i ionako nemaju studentski progress red).
router.post("/result", requireAuth, requireRole("ucenik"), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = (req.body || {}) as {
      priloziId?: number;
      score?: number;
      maxScore?: number;
    };

    const priloziId = Number(body.priloziId);
    const rawScore = Number(body.score);
    const rawMax = Number(body.maxScore);

    if (!Number.isFinite(priloziId) || priloziId <= 0) {
      res.status(400).json({ error: "Nevažeći priloziId" }); return;
    }
    if (!Number.isFinite(rawMax) || rawMax <= 0 || rawMax > 10000) {
      res.status(400).json({ error: "Nevažeći maxScore" }); return;
    }
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > rawMax) {
      res.status(400).json({ error: "Nevažeći score" }); return;
    }

    const score = Math.floor(rawScore);
    const maxScore = Math.floor(rawMax);
    const procenat = Math.round((score / maxScore) * 100);

    // 1. Validacija: prilog mora postojati i biti kind='h5p'
    const [prilog] = await db.select().from(prilozi).where(eq(prilozi.id, priloziId));
    if (!prilog) { res.status(404).json({ error: "Prilog nije pronađen" }); return; }
    if (prilog.kind !== "h5p") { res.status(400).json({ error: "Prilog nije H5P vježba" }); return; }

    // Tačan rezultat zaključava sljedeći pokušaj na 48 sati. Provjera je
    // serverska jer disabled dugme u browseru nije sigurnosna granica.
    const [lastPerfect] = await db.select({
      completedAt: h5pPokusajiTable.completedAt,
      procenat: h5pPokusajiTable.procenat,
    }).from(h5pPokusajiTable).where(and(
      eq(h5pPokusajiTable.userId, userId),
      eq(h5pPokusajiTable.priloziId, priloziId),
      eq(h5pPokusajiTable.procenat, 100),
    )).orderBy(desc(h5pPokusajiTable.completedAt)).limit(1);
    if (lastPerfect) {
      const lockedUntil = lockUntilForAttempt(lastPerfect.completedAt, lastPerfect.procenat);
      if (lockedUntil && lockedUntil.getTime() > Date.now()) {
        res.status(423).json({
          error: "Vježba je zaključana 48 sati nakon tačno riješenog pokušaja",
          lockedUntil: lockedUntil.toISOString(),
        });
        return;
      }
    }

    // 2. Atomski izračunaj attempt_no koristeći DB unique index — pokušavamo
    //    INSERT-e dok god dobivamo conflict (max 5 retry-a, što je više nego
    //    dovoljno za realne race condition scenarije).
    const existing = await exec<{ c: number }>(sql`
      SELECT COUNT(*)::int AS c FROM h5p_pokusaji
      WHERE user_id = ${userId} AND prilozi_id = ${priloziId}
    `);
    let attemptNo = Number(existing.rows[0]?.c ?? 0) + 1;

    // 3. Insert pokušaja sa retry na unique constraint violation (race).
    //    Hasanati se računaju za stvarni attemptNo nakon eventualnog retry-a:
    //    klijent NIKAD ne smije dobiti više hasanata nego što multiplier
    //    za njegov stvarni attemptNo dozvoljava.
    let inserted: typeof h5pPokusajiTable.$inferSelect | null = null;
    for (let retry = 0; retry < 5; retry++) {
      const rewardCap = rewardCapForAttempt(attemptNo);
      // Nagrada je proporcionalna rezultatu, ali nikad ne prelazi kap za
      // pokušaj: 100% = 5 na prvom, odnosno 3 na drugom pokušaju.
      const hasanatGained = Math.round((score / maxScore) * rewardCap);
      try {
        const [row] = await db.insert(h5pPokusajiTable).values({
          userId,
          priloziId,
          attemptNo,
          score,
          maxScore,
          procenat,
          hasanatGained,
        }).returning();
        inserted = row;
        break;
      } catch (e: any) {
        // 23505 = unique_violation — još neko inkrementirao attemptNo prije nas
        if (e?.code !== "23505" && e?.cause?.code !== "23505") throw e;
        attemptNo += 1;
      }
    }
    if (!inserted) { res.status(500).json({ error: "Greška pri spremanju pokušaja" }); return; }

    // 5. Update student_progress.totalHasanat (samo ako gained > 0).
    //    Koristimo atomski UPSERT (INSERT ... ON CONFLICT DO UPDATE) sa
    //    `total_hasanat = total_hasanat + ${gained}` da spriječimo lost-update
    //    pri konkurentnim H5P submitima (koji su realno rijetki ali mogući
    //    npr. iz dva taba). previousHasanat se mjeri PRIJE inkrementa.
    const finalHasanatGained = inserted.hasanatGained;
    const studentIdStr = String(userId);
    const today = new Date().toISOString().split("T")[0];
    let totalHasanat = 0;
    let previousHasanat = 0;
    if (finalHasanatGained > 0) {
      // Pročitaj trenutni total atomski u istoj operaciji preko RETURNING.
      const upsert = await exec<{ total_hasanat: number; previous_hasanat: number }>(sql`
        INSERT INTO student_progress (student_id, total_hasanat, completed_lessons, badges, streak_days, last_activity_date)
        VALUES (${studentIdStr}, ${finalHasanatGained}, '[]'::jsonb, '[]'::jsonb, 1, ${today})
        ON CONFLICT (student_id) DO UPDATE SET
          total_hasanat = student_progress.total_hasanat + EXCLUDED.total_hasanat,
          last_activity_date = EXCLUDED.last_activity_date,
          updated_at = NOW()
        RETURNING
          total_hasanat,
          (total_hasanat - ${finalHasanatGained})::int AS previous_hasanat
      `);
      const row = upsert.rows[0];
      totalHasanat = Number(row?.total_hasanat ?? finalHasanatGained);
      previousHasanat = Number(row?.previous_hasanat ?? 0);
    } else {
      // Pročitaj samo current total da bismo vratili konzistentan response.
      const [existingProg] = await db.select({ t: studentProgressTable.totalHasanat })
        .from(studentProgressTable)
        .where(eq(studentProgressTable.studentId, String(userId)))
        .limit(1);
      totalHasanat = existingProg?.t ?? 0;
      previousHasanat = totalHasanat;
    }

    res.json({
      attemptNo: inserted.attemptNo,
      score: inserted.score,
      maxScore: inserted.maxScore,
      procenat: inserted.procenat,
      multiplier: multiplierForAttempt(inserted.attemptNo),
      rewardCap: rewardCapForAttempt(inserted.attemptNo),
      hasanatGained: inserted.hasanatGained,
      totalHasanat,
      previousHasanat,
    });
  } catch (e: any) {
    console.error("[H5P] /result error:", e);
    res.status(500).json({ error: e?.message || "Greška servera" });
  }
});

// GET /api/h5p/attempts/:priloziId — historija pokušaja prijavljenog korisnika
// za jedan H5P prilog (za UI: "Pokušao si 2 puta — sljedeći ne donosi hasanate").
router.get("/attempts/:priloziId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const priloziId = parseInt(String(req.params.priloziId));
    if (!Number.isFinite(priloziId)) { res.status(400).json({ error: "Nevažeći priloziId" }); return; }
    const rows = await db.select().from(h5pPokusajiTable)
      .where(and(
        eq(h5pPokusajiTable.userId, userId),
        eq(h5pPokusajiTable.priloziId, priloziId),
      ))
      .orderBy(h5pPokusajiTable.attemptNo);
    const lastPerfect = [...rows].reverse().find(r => r.procenat >= 100);
    const lockedUntil = lastPerfect
      ? lockUntilForAttempt(lastPerfect.completedAt, lastPerfect.procenat)
      : null;
    const activeLock = lockedUntil && lockedUntil.getTime() > Date.now() ? lockedUntil : null;

    res.json({
      attempts: rows.map(r => ({
        attemptNo: r.attemptNo,
        score: r.score,
        maxScore: r.maxScore,
        procenat: r.procenat,
        hasanatGained: r.hasanatGained,
        completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
      })),
      nextAttemptNo: rows.length + 1,
      nextMultiplier: multiplierForAttempt(rows.length + 1),
      nextReward: rewardCapForAttempt(rows.length + 1),
      lockedUntil: activeLock?.toISOString() ?? null,
      isLocked: !!activeLock,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Greška servera" });
  }
});

export default router;
