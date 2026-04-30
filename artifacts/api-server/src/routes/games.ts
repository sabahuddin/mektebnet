import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router: IRouter = Router();

// === KONFIGURACIJA EKONOMIJE / ANTI-CHEAT ===
// Svakih 100 hasanata otključa 600 sekundi (10 min) vremena za igre.
const HASANAT_PER_BLOCK = 100;
const SECONDS_PER_BLOCK = 600;
// Maks. trajanje jedne sesije (auto-expire / clamp na ovo).
const MAX_SESSION_DURATION_SEC = 30 * 60;
// Maks. score po igri (anti-cheat).
// quiz score = broj tačnih odgovora; cap od 60 daje slobodu za realan ritam (~1/sek).
const MAX_SCORE: Record<string, number> = {
  memory: 1000,
  quiz: 60,
};
// Maks. trajanje runde po igri (timer): quiz = 60s, memory koliko user ima credita.
const ROUND_DURATION_SEC: Record<string, number | null> = {
  quiz: 60,
  memory: null,
};
// Validni gameId enum.
const VALID_GAMES = new Set(["memory", "quiz"]);

// === RATE LIMITING ===
// Per-user in-memory limiter za /start i /end (anti-automation guard).
// Učenik realno ne pokreće > ~6 sesija/min, pa je 30/min prostran ali kapuje botove.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_USER = 30;
const rateBuckets = new Map<number, number[]>();
function checkRate(userId: number): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX_PER_USER) {
    rateBuckets.set(userId, arr);
    return false;
  }
  arr.push(now);
  rateBuckets.set(userId, arr);
  // Periodic cleanup za stare ulaze (svakih 100 zahtjeva, lazy).
  if (rateBuckets.size > 500 && Math.random() < 0.01) {
    for (const [uid, ts] of rateBuckets.entries()) {
      const fresh = ts.filter(t => now - t < RATE_WINDOW_MS);
      if (fresh.length === 0) rateBuckets.delete(uid);
      else rateBuckets.set(uid, fresh);
    }
  }
  return true;
}

interface DbExecResult<T = Record<string, unknown>> { rows: T[]; }
async function exec<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<DbExecResult<T>> {
  return (await db.execute(query)) as unknown as DbExecResult<T>;
}

// Vrati spent sekunde (clamped sumom svih sesija) za usera.
async function getSecondsSpent(userId: number): Promise<number> {
  const r = await exec<{ s: number }>(sql`
    SELECT COALESCE(SUM(LEAST(duration_sec, ${MAX_SESSION_DURATION_SEC})), 0)::int AS s
    FROM game_sessions
    WHERE user_id = ${userId} AND status IN ('ended', 'expired')
  `);
  return Number(r.rows[0]?.s ?? 0);
}

async function getTotalHasanat(userId: number): Promise<number> {
  const r = await exec<{ h: number }>(sql`
    SELECT COALESCE(total_hasanat, 0)::int AS h
    FROM student_progress
    WHERE student_id = ${String(userId)}
    LIMIT 1
  `);
  return Number(r.rows[0]?.h ?? 0);
}

function computeAllowedSeconds(totalHasanat: number): number {
  return Math.floor(totalHasanat / HASANAT_PER_BLOCK) * SECONDS_PER_BLOCK;
}

// GET /api/games/credits — koliko vremena ima i koliko je potrošio.
router.get("/credits", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [totalHasanat, secondsSpent] = await Promise.all([
      getTotalHasanat(userId),
      getSecondsSpent(userId),
    ]);
    const secondsAllowed = computeAllowedSeconds(totalHasanat);
    const secondsRemaining = Math.max(0, secondsAllowed - secondsSpent);

    // Provjera ima li running sesija
    const active = await exec<{ id: number; game_id: string; started_at: string }>(sql`
      SELECT id, game_id, started_at
      FROM game_sessions
      WHERE user_id = ${userId} AND status = 'running'
      ORDER BY started_at DESC
      LIMIT 1
    `);
    const activeSession = active.rows[0] || null;

    res.json({
      totalHasanat,
      secondsAllowed,
      secondsSpent,
      secondsRemaining,
      hasanatPerBlock: HASANAT_PER_BLOCK,
      secondsPerBlock: SECONDS_PER_BLOCK,
      activeSession: activeSession ? {
        id: activeSession.id,
        gameId: activeSession.game_id,
        startedAt: activeSession.started_at,
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "games/credits failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/games/start { gameId } — kreira sesiju.
router.post("/start", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!checkRate(userId)) {
      res.status(429).json({ error: "rate_limited", message: "Previše zahtjeva. Sačekaj malo." });
      return;
    }
    const gameId = String(req.body?.gameId || "");
    if (!VALID_GAMES.has(gameId)) {
      res.status(400).json({ error: "bad_request", message: "Nepoznata igra" });
      return;
    }

    // Prvo expirej sve stare running sesije ovog usera (auto-expire >30min).
    // VAŽNO: duration_sec mora biti realno protekao tijek (clamped na allowed_duration_sec),
    // ne fiksno MAX_SESSION_DURATION_SEC. Inače napušteni 60s quiz oduzima 30 min credit-a.
    await db.execute(sql`
      UPDATE game_sessions
      SET status = 'expired',
          ended_at = NOW(),
          duration_sec = LEAST(
            allowed_duration_sec,
            GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
          )
      WHERE user_id = ${userId}
        AND status = 'running'
        AND started_at < NOW() - INTERVAL '${sql.raw(String(MAX_SESSION_DURATION_SEC))} seconds'
    `);

    // Provjeri ima li credit
    const [totalHasanat, secondsSpent] = await Promise.all([
      getTotalHasanat(userId),
      getSecondsSpent(userId),
    ]);
    const secondsAllowed = computeAllowedSeconds(totalHasanat);
    const secondsRemaining = Math.max(0, secondsAllowed - secondsSpent);
    if (secondsRemaining <= 0) {
      res.status(403).json({
        error: "no_credit",
        message: "Nemaš dovoljno hasanata za novu igru. Završi neku lekciju ili kviz.",
        totalHasanat, secondsAllowed, secondsSpent, secondsRemaining,
      });
      return;
    }

    // Provjeri da nema druga running sesija (best-effort, atomski guard je partial unique index niže)
    const existing = await exec<{ id: number; game_id: string }>(sql`
      SELECT id, game_id FROM game_sessions
      WHERE user_id = ${userId} AND status = 'running'
      LIMIT 1
    `);
    if (existing.rows.length > 0) {
      res.status(409).json({
        error: "session_in_progress",
        message: "Već imaš jednu igru u toku.",
        sessionId: existing.rows[0].id,
        gameId: existing.rows[0].game_id,
      });
      return;
    }

    // Per-game cap na trajanje runde (npr. quiz = 60s); ako učenik ima manje credita,
    // koristi credit. Memory nema fiksni cap pa koristi puni credit do MAX_SESSION_DURATION_SEC.
    const roundCap = ROUND_DURATION_SEC[gameId] ?? MAX_SESSION_DURATION_SEC;
    const allowedDurationSec = Math.min(secondsRemaining, roundCap, MAX_SESSION_DURATION_SEC);
    try {
      const inserted = await exec<{ id: number; started_at: string }>(sql`
        INSERT INTO game_sessions (user_id, game_id, status, started_at, allowed_duration_sec)
        VALUES (${userId}, ${gameId}, 'running', NOW(), ${allowedDurationSec})
        RETURNING id, started_at
      `);
      const row = inserted.rows[0];
      res.json({
        sessionId: row.id,
        gameId,
        startedAt: row.started_at,
        allowedDurationSec,
      });
    } catch (insertErr) {
      // Partial unique index `game_sessions_one_running_idx` (user_id WHERE status='running')
      // hvata race conditions: dva paralelna start requesta — drugi će dobiti 23505.
      const code = (insertErr as { code?: string })?.code;
      if (code === "23505") {
        const conflict = await exec<{ id: number; game_id: string }>(sql`
          SELECT id, game_id FROM game_sessions
          WHERE user_id = ${userId} AND status = 'running'
          LIMIT 1
        `);
        const c = conflict.rows[0];
        res.status(409).json({
          error: "session_in_progress",
          message: "Već imaš jednu igru u toku.",
          sessionId: c?.id,
          gameId: c?.game_id,
        });
        return;
      }
      throw insertErr;
    }
  } catch (err) {
    req.log.error({ err }, "games/start failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// POST /api/games/end { sessionId, score } — zatvara sesiju.
router.post("/end", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!checkRate(userId)) {
      res.status(429).json({ error: "rate_limited", message: "Previše zahtjeva. Sačekaj malo." });
      return;
    }
    const sessionId = Number(req.body?.sessionId);
    const rawScore = Number(req.body?.score ?? 0);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      res.status(400).json({ error: "bad_request", message: "sessionId required" });
      return;
    }

    // Najprije fetchamo (ne-atomski) samo da znamo metadata — ali UPDATE niže je atomski.
    const found = await exec<{ id: number; user_id: number; game_id: string; status: string; started_at: string; allowed_duration_sec: number }>(sql`
      SELECT id, user_id, game_id, status, started_at, allowed_duration_sec
      FROM game_sessions
      WHERE id = ${sessionId}
      LIMIT 1
    `);
    const session = found.rows[0];
    if (!session) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (session.user_id !== userId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    if (session.status !== "running") {
      res.json({ ok: true, alreadyClosed: true, score: 0, durationSec: 0 });
      return;
    }

    // Server-side trajanje
    const startMs = new Date(session.started_at).getTime();
    const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
    const allowedCap = Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC);
    const durationSec = Math.max(0, Math.min(elapsedSec, allowedCap));

    // Score clamp + sanity (anti-cheat za score forgery: realan high-score traje neko vrijeme).
    // Bez server-side scoringa, ovo je best-effort: ako je sesija završila prebrzo, smanji max score.
    const maxScore = MAX_SCORE[session.game_id] ?? 1000;
    const minSecForFullScore = session.game_id === "quiz" ? 15 : 5;
    const cheatCap = elapsedSec < minSecForFullScore
      ? Math.floor(maxScore * (elapsedSec / minSecForFullScore))
      : maxScore;
    const score = Math.max(0, Math.min(Math.floor(rawScore), cheatCap));

    // Atomski UPDATE: status='running' u WHERE sprječava lost update i double-end race.
    const updated = await exec<{ id: number }>(sql`
      UPDATE game_sessions
      SET status = 'ended',
          ended_at = NOW(),
          duration_sec = ${durationSec},
          score = ${score}
      WHERE id = ${sessionId}
        AND user_id = ${userId}
        AND status = 'running'
      RETURNING id
    `);
    if (updated.rows.length === 0) {
      // Neko drugi je već zatvorio sesiju (race) — vraćamo idempotentni odgovor.
      res.json({ ok: true, alreadyClosed: true, score: 0, durationSec: 0 });
      return;
    }

    res.json({ ok: true, sessionId, gameId: session.game_id, score, finalScore: score, durationSec });
  } catch (err) {
    req.log.error({ err }, "games/end failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// === LEADERBOARD (60s in-memory cache) ===
type LbScope = "group" | "mekteb" | "global";
type LbGame = "memory" | "quiz" | "all";
interface LbEntry { rank: number; userId: number; displayName: string; mektebName: string | null; bestScore: number; totalGames: number; }
const lbCache = new Map<string, { ts: number; data: LbEntry[] }>();
const LB_TTL_MS = 60 * 1000;

async function getUserScopeIds(userId: number): Promise<{ grupaId: number | null; mektebId: number | null }> {
  const r = await exec<{ grupa_id: number | null; mekteb_id: number | null }>(sql`
    SELECT grupa_id, mekteb_id FROM ucenik_profili WHERE user_id = ${userId} LIMIT 1
  `);
  return {
    grupaId: r.rows[0]?.grupa_id ?? null,
    mektebId: r.rows[0]?.mekteb_id ?? null,
  };
}

router.get("/leaderboard", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const scope = (String(req.query.scope || "global") as LbScope);
    const game = (String(req.query.game || "all") as LbGame);
    if (!["group", "mekteb", "global"].includes(scope)) {
      res.status(400).json({ error: "bad_scope" });
      return;
    }
    if (!["memory", "quiz", "all"].includes(game)) {
      res.status(400).json({ error: "bad_game" });
      return;
    }

    let scopeKey = "global";
    let gameFilter = sql``;
    if (game !== "all") gameFilter = sql`AND gs.game_id = ${game}`;

    let scopeJoin = sql``;
    let scopeWhere = sql``;
    if (scope === "group") {
      const { grupaId } = await getUserScopeIds(userId);
      if (!grupaId) {
        res.json({ scope, game, entries: [], note: "Nisi član nijedne grupe." });
        return;
      }
      scopeJoin = sql`JOIN ucenik_profili up ON up.user_id = u.id`;
      scopeWhere = sql`AND up.grupa_id = ${grupaId}`;
      scopeKey = `g:${grupaId}`;
    } else if (scope === "mekteb") {
      const { mektebId } = await getUserScopeIds(userId);
      if (!mektebId) {
        res.json({ scope, game, entries: [], note: "Nisi povezan ni s jednim mektebom." });
        return;
      }
      scopeJoin = sql`JOIN ucenik_profili up ON up.user_id = u.id`;
      scopeWhere = sql`AND up.mekteb_id = ${mektebId}`;
      scopeKey = `m:${mektebId}`;
    }

    const cacheKey = `${scope}|${scopeKey}|${game}`;
    const cached = lbCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < LB_TTL_MS) {
      res.json({ scope, game, entries: cached.data, cached: true });
      return;
    }

    // Za game="all": rank po SUMI najboljih per-game scoreova (sumiramo MAX(score) po game_id po useru).
    // Za jednu igru: rank po MAX(score). Limit 50 (top 50).
    // LEFT JOIN ucenik_profili → mektebi za prikaz naziva mekteba (LbEntry.mektebName).
    const rows = game === "all"
      ? await exec<{ user_id: number; display_name: string; mekteb_name: string | null; best_score: number; total_games: number }>(sql`
        WITH best_per_game AS (
          SELECT gs.user_id, gs.game_id, MAX(gs.score)::int AS best_in_game, COUNT(*)::int AS games_in_game
          FROM game_sessions gs
          WHERE gs.status = 'ended'
          GROUP BY gs.user_id, gs.game_id
        )
        SELECT bpg.user_id,
               u.display_name,
               m.naziv AS mekteb_name,
               COALESCE(SUM(bpg.best_in_game), 0)::int AS best_score,
               COALESCE(SUM(bpg.games_in_game), 0)::int AS total_games
        FROM best_per_game bpg
        JOIN users u ON u.id = bpg.user_id
        ${scopeJoin}
        LEFT JOIN ucenik_profili up_m ON up_m.user_id = u.id
        LEFT JOIN mektebi m ON m.id = up_m.mekteb_id
        WHERE u.role = 'ucenik'
          ${scopeWhere}
        GROUP BY bpg.user_id, u.display_name, m.naziv
        HAVING COALESCE(SUM(bpg.best_in_game), 0) > 0
        ORDER BY best_score DESC, total_games DESC
        LIMIT 50
      `)
      : await exec<{ user_id: number; display_name: string; mekteb_name: string | null; best_score: number; total_games: number }>(sql`
        SELECT gs.user_id,
               u.display_name,
               m.naziv AS mekteb_name,
               MAX(gs.score)::int AS best_score,
               COUNT(*)::int AS total_games
        FROM game_sessions gs
        JOIN users u ON u.id = gs.user_id
        ${scopeJoin}
        LEFT JOIN ucenik_profili up_m ON up_m.user_id = u.id
        LEFT JOIN mektebi m ON m.id = up_m.mekteb_id
        WHERE gs.status = 'ended'
          AND u.role = 'ucenik'
          ${gameFilter}
          ${scopeWhere}
        GROUP BY gs.user_id, u.display_name, m.naziv
        HAVING MAX(gs.score) > 0
        ORDER BY best_score DESC, total_games DESC
        LIMIT 50
      `);

    const entries: LbEntry[] = rows.rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.user_id,
      displayName: r.display_name,
      mektebName: r.mekteb_name,
      bestScore: r.best_score,
      totalGames: r.total_games,
    }));
    lbCache.set(cacheKey, { ts: Date.now(), data: entries });
    res.json({ scope, game, entries });
  } catch (err) {
    req.log.error({ err }, "games/leaderboard failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/games/personal-stats — moja statistika (ili statistika djeteta za roditelja).
// Optional ?ucenikId= — roditelj smije samo za svoju djecu, muallim za svoju grupu, admin sve, učenik samo sebe.
router.get("/personal-stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = req.user!;
    let targetId = me.userId;
    const queriedId = Number(req.query.ucenikId);
    if (Number.isFinite(queriedId) && queriedId > 0 && queriedId !== me.userId) {
      // Provjera ovlaštenja
      if (me.role === "admin") {
        targetId = queriedId;
      } else if (me.role === "roditelj") {
        const r = await exec<{ id: number }>(sql`
          SELECT id FROM roditelj_ucenik
          WHERE roditelj_id = ${me.userId} AND ucenik_id = ${queriedId} AND status = 'approved'
          LIMIT 1
        `);
        if (r.rows.length === 0) { res.status(403).json({ error: "forbidden" }); return; }
        targetId = queriedId;
      } else if (me.role === "muallim") {
        const r = await exec<{ user_id: number }>(sql`
          SELECT user_id FROM ucenik_profili
          WHERE user_id = ${queriedId} AND muallim_id = ${me.userId}
          LIMIT 1
        `);
        if (r.rows.length === 0) { res.status(403).json({ error: "forbidden" }); return; }
        targetId = queriedId;
      } else {
        res.status(403).json({ error: "forbidden" }); return;
      }
    }

    const [totalHasanat, secondsSpent] = await Promise.all([
      getTotalHasanat(targetId),
      getSecondsSpent(targetId),
    ]);
    const secondsAllowed = computeAllowedSeconds(totalHasanat);
    const secondsRemaining = Math.max(0, secondsAllowed - secondsSpent);

    const perGame = await exec<{ game_id: string; total_games: number; best_score: number; last_score: number; total_seconds: number }>(sql`
      WITH ended AS (
        SELECT game_id, score, duration_sec, ended_at,
               ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY ended_at DESC) AS rn
        FROM game_sessions
        WHERE user_id = ${targetId} AND status = 'ended'
      )
      SELECT game_id,
             COUNT(*)::int AS total_games,
             COALESCE(MAX(score), 0)::int AS best_score,
             COALESCE(MAX(score) FILTER (WHERE rn = 1), 0)::int AS last_score,
             COALESCE(SUM(LEAST(duration_sec, ${MAX_SESSION_DURATION_SEC})), 0)::int AS total_seconds
      FROM ended
      GROUP BY game_id
    `);

    // Grupni rank: ako učenik pripada grupi, izračunaj njegovo mjesto po sumi best-per-game
    // u odnosu na druge učenike u istoj grupi (ne otkrivamo tuđa imena, samo poziciju).
    let groupRank: number | null = null;
    let groupTotal: number | null = null;
    const targetScope = await getUserScopeIds(targetId);
    if (targetScope.grupaId) {
      const myTotalRow = await exec<{ s: number }>(sql`
        SELECT COALESCE(SUM(best_in_game), 0)::int AS s
        FROM (
          SELECT MAX(score)::int AS best_in_game
          FROM game_sessions
          WHERE user_id = ${targetId} AND status = 'ended'
          GROUP BY game_id
        ) x
      `);
      const myTotal = myTotalRow.rows[0]?.s ?? 0;

      const totalRow = await exec<{ c: number }>(sql`
        SELECT COUNT(DISTINCT up.user_id)::int AS c
        FROM ucenik_profili up
        JOIN users u ON u.id = up.user_id
        WHERE up.grupa_id = ${targetScope.grupaId} AND u.role = 'ucenik'
      `);
      groupTotal = totalRow.rows[0]?.c ?? 0;

      if (myTotal > 0) {
        const rankRow = await exec<{ c: number }>(sql`
          WITH best_per_game AS (
            SELECT gs.user_id, MAX(gs.score)::int AS best_in_game
            FROM game_sessions gs
            JOIN ucenik_profili up ON up.user_id = gs.user_id
            JOIN users u ON u.id = gs.user_id
            WHERE up.grupa_id = ${targetScope.grupaId}
              AND u.role = 'ucenik'
              AND gs.status = 'ended'
            GROUP BY gs.user_id, gs.game_id
          ),
          totals AS (
            SELECT user_id, COALESCE(SUM(best_in_game), 0)::int AS total
            FROM best_per_game
            GROUP BY user_id
          )
          SELECT COUNT(*)::int AS c FROM totals WHERE total > ${myTotal}
        `);
        groupRank = (rankRow.rows[0]?.c ?? 0) + 1;
      } else {
        groupRank = null;
      }
    }

    res.json({
      userId: targetId,
      totalHasanat,
      secondsAllowed,
      secondsSpent,
      secondsRemaining,
      groupRank,
      groupTotal,
      games: perGame.rows.map(r => ({
        gameId: r.game_id,
        totalGames: r.total_games,
        bestScore: r.best_score,
        lastScore: r.last_score,
        totalSeconds: r.total_seconds,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "games/personal-stats failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// GET /api/games/quiz-questions?count=15 — random pitanja iz svih ilmihal lekcija.
router.get("/quiz-questions", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const count = Math.max(5, Math.min(50, Number(req.query.count || 20)));
    const rows = await exec<{ kviz_pitanja: unknown }>(sql`
      SELECT kviz_pitanja FROM ilmihal_lekcije
      WHERE is_published = true AND kviz_pitanja IS NOT NULL
    `);
    const pool: { question: string; options: string[]; answer: string }[] = [];
    for (const r of rows.rows) {
      const arr = r.kviz_pitanja as { question: string; options: string[]; answer: string }[] | null;
      if (Array.isArray(arr)) {
        for (const q of arr) {
          if (q && typeof q.question === "string" && Array.isArray(q.options) && typeof q.answer === "string") {
            pool.push(q);
          }
        }
      }
    }
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    res.json({ questions: pool.slice(0, count) });
  } catch (err) {
    req.log.error({ err }, "games/quiz-questions failed");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
