import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { db, ocjeneSadrzajaTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { JWT_SECRET } from "../lib/jwt-secret.js";

const router: IRouter = Router();
const ALLOWED_TIPOVI = new Set(["lekcija", "prilog", "kviz"]);
function parseTip(tip: string | undefined): string | null {
  if (!tip) return null;
  const t = tip.toLowerCase();
  return ALLOWED_TIPOVI.has(t) ? t : null;
}

function tryDecodeUserId(req: any): number | null {
  const h = req.headers.authorization as string | undefined;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET) as any;
    return Number(payload?.userId) || null;
  } catch { return null; }
}

// GET /api/ocjene/:tip/:id — prosjek + broj + (opciono) moja ocjena ako je prijavljen
router.get("/:tip/:id", async (req, res) => {
  try {
    const tip = parseTip(req.params.tip);
    const sadrzajId = Number(req.params.id);
    if (!tip || !Number.isInteger(sadrzajId) || sadrzajId <= 0) {
      res.status(400).json({ error: "Neispravni parametri" });
      return;
    }
    const aggRes: any = await db.execute(sql`
      SELECT COALESCE(AVG(ocjena), 0)::float AS avg, COUNT(*)::int AS count
      FROM ocjene_sadrzaja
      WHERE tip_sadrzaja = ${tip} AND sadrzaj_id = ${sadrzajId};
    `);
    const row = aggRes.rows?.[0] ?? {};

    const userId = tryDecodeUserId(req);
    let myOcjena: number | null = null;
    if (userId) {
      const mine = await db.select({ ocjena: ocjeneSadrzajaTable.ocjena })
        .from(ocjeneSadrzajaTable)
        .where(and(
          eq(ocjeneSadrzajaTable.userId, userId),
          eq(ocjeneSadrzajaTable.tipSadrzaja, tip),
          eq(ocjeneSadrzajaTable.sadrzajId, sadrzajId),
        ));
      myOcjena = mine[0]?.ocjena ?? null;
    }
    res.json({
      avg: Number(row.avg ?? 0),
      count: Number(row.count ?? 0),
      myOcjena,
    });
  } catch (err) {
    console.error("[ocjene] GET greška:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

// POST /api/ocjene — { tip, id, ocjena } — upsert moje ocjene
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: "Niste prijavljeni" }); return; }
    const tip = parseTip(req.body?.tip);
    const sadrzajId = Number(req.body?.id);
    const ocjena = Number(req.body?.ocjena);
    if (!tip || !Number.isInteger(sadrzajId) || sadrzajId <= 0
        || !Number.isInteger(ocjena) || ocjena < 1 || ocjena > 5) {
      res.status(400).json({ error: "Neispravna ocjena (1–5)" });
      return;
    }
    await db.execute(sql`
      INSERT INTO ocjene_sadrzaja (user_id, tip_sadrzaja, sadrzaj_id, ocjena, updated_at)
      VALUES (${userId}, ${tip}, ${sadrzajId}, ${Math.round(ocjena)}, NOW())
      ON CONFLICT (user_id, tip_sadrzaja, sadrzaj_id)
      DO UPDATE SET ocjena = EXCLUDED.ocjena, updated_at = NOW();
    `);
    const aggRes: any = await db.execute(sql`
      SELECT COALESCE(AVG(ocjena), 0)::float AS avg, COUNT(*)::int AS count
      FROM ocjene_sadrzaja WHERE tip_sadrzaja = ${tip} AND sadrzaj_id = ${sadrzajId};
    `);
    const row = aggRes.rows?.[0] ?? {};
    res.json({
      ok: true,
      avg: Number(row.avg ?? 0),
      count: Number(row.count ?? 0),
      myOcjena: Math.round(ocjena),
    });
  } catch (err) {
    console.error("[ocjene] POST greška:", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
