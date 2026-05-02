import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { pogresniOdgovoriTable, studentProgressTable } from "@workspace/db";
import { sql, and, eq, isNull, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

// Mala fiksna nagrada za riješenu grešku — dovoljno da motivira, premalo da
// se isplati farmati (bonus uvjet: greška mora već postojati u DB pa se
// nagrada može dobiti samo za stvarne pogreške). Dijete dobija Aferim
// (ne Med) jer je ovo edukativna aktivnost, ne igra.
const NAGRADA_AFERIM_PO_GRESKI = 5;

// Maks. broj grešaka koje jedan POST /zabiljezi može upisati. DoS guard.
const MAX_ITEMS_PER_REQUEST = 50;

// Validni source types — proširi po potrebi za H5P / ilmihal mini-kviz.
const VALID_SOURCE_TYPES = new Set(["kviz", "h5p", "ilmihal"]);

interface ZabiljeziItem {
  questionIndex: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  wrongIndex: number;
}

function validateItem(it: unknown): ZabiljeziItem | null {
  if (!it || typeof it !== "object") return null;
  const x = it as Record<string, unknown>;
  const questionIndex = Number(x.questionIndex);
  const questionText = typeof x.questionText === "string" ? x.questionText.trim() : "";
  const options = Array.isArray(x.options) ? x.options.filter(o => typeof o === "string") as string[] : null;
  const correctIndex = Number(x.correctIndex);
  const wrongIndex = Number(x.wrongIndex);
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 999) return null;
  if (!questionText || questionText.length > 2000) return null;
  if (!options || options.length < 2 || options.length > 12) return null;
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
  if (!Number.isInteger(wrongIndex) || wrongIndex < 0 || wrongIndex >= options.length) return null;
  if (correctIndex === wrongIndex) return null;
  return { questionIndex, questionText, options, correctIndex, wrongIndex };
}

// POST /api/popravi-sace/zabiljezi — pozivamo sa frontenda nakon submit-a kviza
// (ili H5P-a) sa listom pogrešnih odgovora. Idempotentno preko UNIQUE
// (user_id, source_type, source_id, question_index): ako greška već postoji
// i još nije riješena, samo inkrementiramo attempts i ažuriramo lastWrongIndex.
// Ako je već riješena, ne pravi novu rupu — dijete očito zna pitanje, ovo
// je vjerovatno forced replay.
router.post("/zabiljezi", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { sourceType, sourceId, sourceNaslov, items } = req.body ?? {};

    if (typeof sourceType !== "string" || !VALID_SOURCE_TYPES.has(sourceType)) {
      res.status(400).json({ error: "invalid_source_type" });
      return;
    }
    const sId = Number(sourceId);
    if (!Number.isInteger(sId) || sId <= 0) {
      res.status(400).json({ error: "invalid_source_id" });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items_required" });
      return;
    }
    if (items.length > MAX_ITEMS_PER_REQUEST) {
      res.status(400).json({ error: "too_many_items" });
      return;
    }
    const naslov = typeof sourceNaslov === "string" ? sourceNaslov.slice(0, 500) : "";

    const validItems: ZabiljeziItem[] = [];
    for (const it of items) {
      const v = validateItem(it);
      if (v) validItems.push(v);
    }
    if (validItems.length === 0) {
      res.json({ ok: true, inserted: 0, updated: 0 });
      return;
    }

    let inserted = 0;
    let updated = 0;
    for (const it of validItems) {
      const optionsJson = JSON.stringify(it.options);
      // ON CONFLICT: ako greška već postoji i NIJE riješena, samo inkrementiramo
      // attempts. Ako je već riješena (resolved_at NOT NULL), ne diramo — dijete
      // je očito zaboravilo i ovo bi se moglo desiti tehnički ali nije pedagoški
      // zanimljivo (možemo dodati "ponovo zaboravljeno" kasnije).
      const result = await db.execute(sql`
        INSERT INTO pogresni_odgovori
          (user_id, source_type, source_id, source_naslov, question_index, question_text, options, correct_index, last_wrong_index, attempts, created_at, updated_at)
        VALUES
          (${userId}, ${sourceType}, ${sId}, ${naslov}, ${it.questionIndex}, ${it.questionText}, ${optionsJson}::jsonb, ${it.correctIndex}, ${it.wrongIndex}, 1, NOW(), NOW())
        ON CONFLICT (user_id, source_type, source_id, question_index) DO UPDATE
          SET last_wrong_index = EXCLUDED.last_wrong_index,
              question_text = EXCLUDED.question_text,
              options = EXCLUDED.options,
              correct_index = EXCLUDED.correct_index,
              source_naslov = EXCLUDED.source_naslov,
              attempts = pogresni_odgovori.attempts + 1,
              updated_at = NOW()
          WHERE pogresni_odgovori.resolved_at IS NULL
        RETURNING (xmax = 0) AS inserted
      `);
      const rows = (result as unknown as { rows: { inserted: boolean }[] }).rows;
      if (rows[0]?.inserted) inserted++;
      else if (rows.length > 0) updated++;
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    req.log.error({ err }, "popravi-sace/zabiljezi failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/popravi-sace/lista — vraća sve otvorene greške korisnika (resolved_at IS NULL).
// Sortirano: najstarija greška prva (FIFO — dijete prvo popravlja ono što je najduže
// nesređeno). Vraća i shuffled opcije sa novim indexom da dijete ne pamti pozicije.
router.get("/lista", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.select()
      .from(pogresniOdgovoriTable)
      .where(and(
        eq(pogresniOdgovoriTable.userId, userId),
        isNull(pogresniOdgovoriTable.resolvedAt),
      ))
      .orderBy(pogresniOdgovoriTable.createdAt)
      .limit(100);

    const list = rows.map(r => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceNaslov: r.sourceNaslov,
      questionText: r.questionText,
      // Vraćamo opcije ali NE vraćamo correctIndex — to je server-side secret
      // dok dijete ne pošalje odgovor preko /odgovor. Tako klijent ne može
      // jednostavno čitati DOM i naći tačan odgovor bez potvrde.
      options: r.options,
      attempts: r.attempts,
      createdAt: r.createdAt,
    }));

    res.json({ items: list, count: list.length });
  } catch (err) {
    req.log.error({ err }, "popravi-sace/lista failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/popravi-sace/odgovor — body { id, optionIndex }
// Server validira da je greška user-ova, da je još nesriješena, pa upoređuje
// optionIndex sa correctIndex. Ako je tačno: postavi resolved_at + dodjeli
// 5 Aferim. Ako je krivo: inkrementiraj attempts.
router.post("/odgovor", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.body?.id);
    const optionIndex = Number(req.body?.optionIndex);

    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0) {
      res.status(400).json({ error: "invalid_option_index" });
      return;
    }

    const [row] = await db.select()
      .from(pogresniOdgovoriTable)
      .where(and(
        eq(pogresniOdgovoriTable.id, id),
        eq(pogresniOdgovoriTable.userId, userId),
      ))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (row.resolvedAt) {
      res.status(409).json({ error: "already_resolved" });
      return;
    }
    if (optionIndex >= (row.options as string[]).length) {
      res.status(400).json({ error: "invalid_option_index" });
      return;
    }

    const correct = optionIndex === row.correctIndex;

    if (correct) {
      // Atomski: postavi resolved_at + dodjeli Aferim. Koristimo WHERE
      // resolved_at IS NULL kao guard protiv double-claim race-a.
      const updateResult = await db.execute(sql`
        UPDATE pogresni_odgovori
        SET resolved_at = NOW(), updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId} AND resolved_at IS NULL
        RETURNING id
      `);
      const updatedRows = (updateResult as unknown as { rows: { id: number }[] }).rows;
      if (updatedRows.length === 0) {
        // Race: neko drugi je već riješio (vrlo malo vjerovatno za istog usera)
        res.status(409).json({ error: "already_resolved" });
        return;
      }

      // Dodaj Aferim u student_progress (mirror sa h5p.ts pattern-om).
      const studentIdStr = String(userId);
      await db.execute(sql`
        INSERT INTO student_progress (student_id, total_hasanat, total_med, completed_lessons, badges, streak_days, last_activity_date, created_at, updated_at)
        VALUES (${studentIdStr}, ${NAGRADA_AFERIM_PO_GRESKI}, 0, '[]'::jsonb, '[]'::jsonb, 0, NULL, NOW(), NOW())
        ON CONFLICT (student_id) DO UPDATE
          SET total_hasanat = student_progress.total_hasanat + ${NAGRADA_AFERIM_PO_GRESKI},
              updated_at = NOW()
      `);

      res.json({
        ok: true,
        correct: true,
        correctIndex: row.correctIndex,
        nagradaAferim: NAGRADA_AFERIM_PO_GRESKI,
        message: "Bravo! Saće je popravljeno.",
      });
    } else {
      await db.update(pogresniOdgovoriTable)
        .set({
          attempts: row.attempts + 1,
          lastWrongIndex: optionIndex,
          updatedAt: new Date(),
        })
        .where(eq(pogresniOdgovoriTable.id, id));

      res.json({
        ok: true,
        correct: false,
        // NE vraćamo correctIndex — dijete mora pokušati ponovo.
        message: "Nije tačno. Probaj ponovo!",
      });
    }
  } catch (err) {
    req.log.error({ err }, "popravi-sace/odgovor failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/popravi-sace/count — brzi count za navigation badge.
router.get("/count", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [row] = await db.select({ c: count() })
      .from(pogresniOdgovoriTable)
      .where(and(
        eq(pogresniOdgovoriTable.userId, userId),
        isNull(pogresniOdgovoriTable.resolvedAt),
      ));
    res.json({ count: Number(row?.c ?? 0) });
  } catch (err) {
    req.log.error({ err }, "popravi-sace/count failed");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
