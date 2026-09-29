import { Router } from "express";
import { sql, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { getQuranVrijeme } from "../lib/quran-vrijeme.js";

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

// Samo učenikov prijavljen, vidljiv Kur'an prikaz šalje puls svakih ~10s.
// Ne vjerujemo klijentskom satu ni poslanoj delti. Poslije duže pauze prvi
// puls ponovo samo inicijalizuje sat; pozadinski tab ne dobija vrijeme.
router.post("/quran/heartbeat", async (req, res) => {
  if (req.user!.role !== "ucenik") {
    res.status(403).json({ error: "Samo učenik može bilježiti vrijeme Kur'ana" });
    return;
  }
  try {
    // Prvi puls nakon otvaranja, promjene kartice ili pauze samo resetuje sat.
    const reset = req.body?.reset === true;
    await db.execute(sql`
      INSERT INTO quran_vrijeme_dnevno (user_id, dan, seconds, last_heartbeat_at)
      VALUES (${req.user!.userId}, (NOW() AT TIME ZONE 'Europe/Zurich')::date, 0, NOW())
      ON CONFLICT (user_id, dan) DO UPDATE SET
        seconds = quran_vrijeme_dnevno.seconds + CASE
          WHEN ${reset} OR NOW() - quran_vrijeme_dnevno.last_heartbeat_at > INTERVAL '20 seconds' THEN 0
          ELSE LEAST(15, GREATEST(0,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - quran_vrijeme_dnevno.last_heartbeat_at)))::int
          ))
        END,
        last_heartbeat_at = NOW()
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Quran heartbeat failed");
    res.status(500).json({ error: "Greška servera" });
  }
});

router.get("/quran/me", async (req, res) => {
  try {
    res.json(await getQuranVrijeme(req.user!.userId));
  } catch (err) {
    req.log.error({ err }, "Quran time lookup failed");
    res.status(500).json({ error: "Greška servera" });
  }
});

export default router;
