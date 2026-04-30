import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { prilozi, h5pPokusajiTable, studentProgressTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

interface DbExecResult<T = Record<string, unknown>> {
  rows: T[];
}
async function exec<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<DbExecResult<T>> {
  return (await db.execute(query)) as unknown as DbExecResult<T>;
}

// Maksimum hasanata po H5P vježbi pri 100% score-u na PRVOM pokušaju.
const MAX_HASANATA_PER_H5P = 50;

// Multiplier po broju pokušaja (anti-cheat: ne nagrađuj ponavljanje da bi
// "farm-ao" hasanate). Treći+ pokušaj služi vježbi/učenju ali ne donosi nove
// hasanate.
function multiplierForAttempt(attemptNo: number): number {
  if (attemptNo <= 1) return 1.0;
  if (attemptNo === 2) return 0.5;
  return 0.0;
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
//   1) Multiplier po pokušaju: 1.=100%, 2.=50%, 3+=0% — nakon 2 pokušaja
//      na istom prilogu nikakav score ne donosi hasanate.
//   2) MAX 50 hasanata po vježbi (kapa upside) — proporcionalno score-u.
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
      const multiplier = multiplierForAttempt(attemptNo);
      // Hasanati = round(score/maxScore × MAX × multiplier).
      // Proporcionalno score-u (0/10 → 0, 5/10 → 12-13, 10/10 → 50 na 1. pokušaju).
      const hasanatGained = Math.round((score / maxScore) * MAX_HASANATA_PER_H5P * multiplier);
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
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Greška servera" });
  }
});

export default router;
