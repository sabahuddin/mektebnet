import { Router } from "express";
import { sql, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// Maksimalni delta po heartbeat-u (cap protiv tab-replay/manipulacije).
// Klijent puls-a svakih ~60s pa je 90s siguran gornji limit.
const MAX_DELTA_SEC = 90;

// GET /api/aktivnost/me — vlastito vrijeme na platformi (svako vidi svoje).
router.get("/me", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [u] = await db.select({
      totalScreentimeSec: usersTable.totalScreentimeSec,
      lastSeenAt: usersTable.lastSeenAt,
    }).from(usersTable).where(eq(usersTable.id, userId));
    res.json({
      totalScreentimeSec: u?.totalScreentimeSec ?? 0,
      lastSeenAt: u?.lastSeenAt ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: "Greška servera" });
  }
});

router.post("/heartbeat", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawDelta = typeof body.deltaSec === "number" ? body.deltaSec : 0;
    const deltaSec = Math.max(0, Math.min(MAX_DELTA_SEC, Math.floor(rawDelta)));

    await db.update(usersTable)
      .set({
        lastSeenAt: new Date(),
        totalScreentimeSec: sql`${usersTable.totalScreentimeSec} + ${deltaSec}`,
      })
      .where(eq(usersTable.id, userId));

    res.json({ ok: true });
  } catch (err) {
    console.error("[Heartbeat]", err);
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
