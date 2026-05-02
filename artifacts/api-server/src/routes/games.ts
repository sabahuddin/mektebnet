import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { pickGradoviQuestions, pickZastaveQuestions, type KvizPitanjeFlag } from "../data/zemlje.js";

const router: IRouter = Router();

// === KONFIGURACIJA EKONOMIJE / ANTI-CHEAT ===
// Svakih 100 hasanata otključa 600 sekundi (10 min) vremena za igre.
const HASANAT_PER_BLOCK = 100;
const SECONDS_PER_BLOCK = 600;
// Maks. trajanje jedne sesije (auto-expire / clamp na ovo).
const MAX_SESSION_DURATION_SEC = 30 * 60;
// Maks. score po igri (anti-cheat).
// quiz score = broj tačnih odgovora; cap od 60 daje slobodu za realan ritam (~1/sek).
// "gradovi" i "zastave" su isti format kao quiz (multiple-choice u 60s rundi).
const MAX_SCORE: Record<string, number> = {
  memory: 1000,
  quiz: 60,
  gradovi: 60,
  zastave: 60,
  // sace: hex Tetris klon (Mektebsko saće). Klijent-scored kao memory.
  // Realna gornja granica je oko 30-50k poena za odlične igrače; cap na 99999.
  sace: 99999,
};
// Maks. trajanje runde po igri (timer): quiz/gradovi/zastave = 60s, memory i sace koliko user ima credita.
const ROUND_DURATION_SEC: Record<string, number | null> = {
  quiz: 60,
  gradovi: 60,
  zastave: 60,
  memory: null,
  sace: null,
};
// Per-game per-second cap (anti-cheat za KLIJENT-SCORED igre).
// Realan ritam za sace na najvišem levelu je oko 200 poena/s (kombinacija
// hard-drop bonusa + line clear bonusa). Cap 350/s daje 1.75× rezervu za
// izuzetne playthrough-e bez otvaranja scripted forgery surface-a sa
// MAX_SCORE.sace = 99999. Memory ima MAX_SCORE = 1000 (jednokratno) pa nije
// vrijedno extra kapiranja. Ako gameId nije ovdje, samo MAX_SCORE i opšti
// minSecForFullScore cheatCap se primjenjuju.
const PER_SEC_CAP: Record<string, number> = {
  sace: 350,
};
// Validni gameId enum.
const VALID_GAMES = new Set(["memory", "quiz", "gradovi", "zastave", "sace"]);
// Igre koje koriste server-side scoring kroz quiz_questions JSONB
// (multiple-choice format; klijent ne dobija `answer`, server validira na /end).
const SERVER_SCORED_GAMES = new Set(["quiz", "gradovi", "zastave"]);
// Broj pitanja koje server generira za svaki quiz round. 60 daje dovoljno
// materijala za 60s timer (≈1 pitanje/sec), ali stvaran broj pitanja je
// limited time-boxed — max poened je MAX_SCORE.quiz neovisno o broju.
const QUIZ_QUESTIONS_PER_SESSION = 60;

// Učitaj sva validna pitanja iz svih objavljenih ilmihal lekcija (pool).
// Svako pitanje mora imati: question (string), options (string[]), answer (string)
// gdje answer mora biti u options. Filter je defenzivan jer su pitanja
// authored u JSONB-u i mogu imati typo.
async function loadQuizPool(): Promise<{ question: string; options: string[]; answer: string }[]> {
  const rows = await exec<{ kviz_pitanja: unknown }>(sql`
    SELECT kviz_pitanja FROM ilmihal_lekcije
    WHERE is_published = true AND kviz_pitanja IS NOT NULL
  `);
  const pool: { question: string; options: string[]; answer: string }[] = [];
  for (const r of rows.rows) {
    const arr = r.kviz_pitanja as { question: string; options: string[]; answer: string }[] | null;
    if (Array.isArray(arr)) {
      for (const q of arr) {
        if (
          q && typeof q.question === "string" &&
          Array.isArray(q.options) && q.options.length >= 2 &&
          q.options.every(o => typeof o === "string") &&
          typeof q.answer === "string" &&
          q.options.includes(q.answer)
        ) {
          pool.push({ question: q.question, options: q.options, answer: q.answer });
        }
      }
    }
  }
  return pool;
}

// Vrati N nasumično odabranih pitanja sa stabilnim per-session ID-em (q0..qN-1).
// ID je samo session-scoped — služi da klijent vrati izbor po istom ključu.
function pickQuizQuestions(pool: { question: string; options: string[]; answer: string }[], n: number): { id: string; question: string; options: string[]; answer: string }[] {
  // Fisher-Yates shuffle (kopija pool-a, da ne mutamo izvor)
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n).map((q, i) => ({ id: `q${i}`, ...q }));
}

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

// Normaliziraj timestamp iz Postgres-a u striktni ISO 8601 sa T i Z.
// Postgres TIMESTAMPTZ stiže kao Date objekt ili kao "2026-04-30 20:02:07+00"
// (zavisno od pg parsera). Safari odbija non-T format pa moramo eksplicitno ISO-irati.
function toIso(v: unknown): string | null {
  if (v == null) return null;
  // Probaj Date direktno (TIMESTAMPTZ kroz pg defaultno stiže kao Date).
  if (v instanceof Date) {
    const ms = v.getTime();
    return isNaN(ms) ? null : v.toISOString();
  }
  // Probaj string format: "2026-04-30 20:02:07.083545+00" → ISO 8601 sa T i Z.
  const s = typeof v === "string" ? v : String(v);
  // new Date(string) prihvata "+00" i prihvata razmak umjesto T u modernim
  // browserima i Node-u, ali Safari je strožiji — eksplicitno zamjenjujemo.
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(normalized);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Fallback: pokušaj sirov string možda ima ms parser razlike.
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2.toISOString();
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

// Auto-expire stare running sesije ovog usera. Sesija je "stara" kad je prošlo
// više od (allowed_duration_sec + LATE_GRACE_SEC) sekundi od started_at — tj.
// timer je sigurno istekao i klijent je imao priliku poslati /end. Server-scored
// igre traju 60s, memory može trajati duže (do MAX_SESSION_DURATION_SEC).
// Bez ovoga, učenik koji napusti 60s igru ne može pokrenuti novu sve do 30min.
// Clamp duration_sec na realno protekao interval — bez toga napušteni 60s quiz
// oduzima cijelih `allowed_duration_sec` credit-a. Pozivamo iz /credits I /start.
const LATE_GRACE_SEC = 5;
async function expireStaleSessions(userId: number): Promise<void> {
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
      AND NOW() - started_at > (allowed_duration_sec + ${LATE_GRACE_SEC}) * INTERVAL '1 second'
  `);
}

// Sace ima allowed_duration_sec = secondsRemaining (do 30min), pa ga normalan
// expireStaleSessions() ne bi diralo prije 30min. Ako učenik napusti igru bez
// /games/end (tab close, network drop, browser crash), sesija ostaje 'running'
// u DB i blokira sve druge igre — što je loš UX. Ovaj helper expirej-uje stale
// sace sesije > STALE_SACE_SEC (60s) sa score=0. Frontend cleanup useEffect
// uvijek šalje /games/end fire-and-forget pri unmount-u; 60s grace daje mreži
// vremena da to dostavi. Ako ne stigne, sesija se oslobađa sa score=0
// (legitiman gubitak je nemoguć — igrač koji aktivno igra šalje /end u <1s).
const STALE_SACE_SEC = 60;
async function expireStaleSaceSessions(userId: number): Promise<void> {
  await db.execute(sql`
    UPDATE game_sessions
    SET status = 'expired',
        ended_at = NOW(),
        duration_sec = LEAST(
          allowed_duration_sec,
          GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
        ),
        score = 0
    WHERE user_id = ${userId}
      AND status = 'running'
      AND game_id = 'sace'
      AND NOW() - started_at > ${STALE_SACE_SEC} * INTERVAL '1 second'
  `);
}

// GET /api/games/credits — koliko vremena ima i koliko je potrošio.
router.get("/credits", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    // Auto-expire stare running sesije i ovdje (ne samo u /start) — UI ne smije
    // pokazati zastari activeSession kao "još uvijek igraš".
    await expireStaleSessions(userId);
    // Sace ima poseban kraći prag (60s) da napuštena sace igra ne blokira
    // pokretanje drugih igrica čekajući puni allowed_duration_sec.
    await expireStaleSaceSessions(userId);
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
        startedAt: toIso(activeSession.started_at),
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

    // Prvo expirej sve stare running sesije ovog usera (auto-expire po allowed_duration_sec).
    await expireStaleSessions(userId);
    // Sace specifično: napuštena sace > 60s se otpušta sa score=0 da ne blokira
    // pokretanje druge igre. (Frontend cleanup ima šansu poslati /end u tom roku.)
    await expireStaleSaceSessions(userId);

    // Dodatno: ako postoji bilo koja running SERVER-SCORED sesija (quiz/gradovi/zastave)
    // koju korisnik nije eksplicitno završio sa /games/end, formaliziraj je kao expired
    // sa score=0. Server-scored igre se boduju isključivo u /games/end pa "running"
    // sesija bez /end-a ima ekvivalentno score=0 (nije izgubljen legitiman rezultat).
    // Ovo eliminira race kad učenik brzo prelazi iz jedne server-scored igre u drugu —
    // bez čekanja punog 60s timeout-a iz expireStaleSessions. Memory NE diramo jer
    // ima dug 30min timer i score se računa client-side tokom igre.
    //
    // ANTI-RACE: prije nego što expirej-uemo, pričekamo 500ms da PRETHODNI /games/end
    // (fire-and-forget iz cleanup useEffect-a prethodne igre) stigne kompletirati i
    // postavi status='completed' sa stvarnim score-om. Bez ovoga moglo bi se desiti da
    // /start expirej-uje sesiju score=0 PRIJE nego što /end stigne sa stvarnim score=N,
    // čime bi se gubili legitimni rezultati. Klijentski cleanup u praksi stigne na
    // server <200ms, pa je 500ms dovoljno generozan grace bez vidljivog UX kašnjenja.
    if (SERVER_SCORED_GAMES.has(gameId)) {
      const existingRunning = await exec<{ id: number }>(sql`
        SELECT id FROM game_sessions
        WHERE user_id = ${userId} AND status = 'running' AND game_id IN ('quiz', 'gradovi', 'zastave')
        LIMIT 1
      `);
      if (existingRunning.rows.length > 0) {
        await new Promise(r => setTimeout(r, 500));
        await db.execute(sql`
          UPDATE game_sessions
          SET status = 'expired',
              ended_at = NOW(),
              duration_sec = LEAST(
                allowed_duration_sec,
                GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int)
              ),
              score = 0
          WHERE user_id = ${userId}
            AND status = 'running'
            AND game_id IN ('quiz', 'gradovi', 'zastave')
        `);
      }
    }

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

    // Server-side question generation za quiz/gradovi/zastave: izaberemo i sačuvamo
    // pitanja PRIJE inserta sesije, da kasnije /games/end može authoritativno
    // provjeriti odgovore. Klijent dobija pitanja BEZ `answer` polja (anti-cheat).
    // Za zastave dodatno prosljeđujemo flagEmoji (vizualni dio pitanja). NAPOMENA:
    // flagIso2 NE šaljemo klijentu — ISO2 je deterministički identifikator države,
    // pa bi njegovo curenje u DOM omogućilo skripti da automatizirano pogađa tačno.
    let serverQuizQuestions: (KvizPitanjeFlag & { id: string })[] | null = null;
    let publicQuestions: { id: string; question: string; options: string[]; flagEmoji?: string }[] = [];
    if (gameId === "quiz") {
      const pool = await loadQuizPool();
      if (pool.length < 5) {
        res.status(503).json({ error: "no_questions", message: "Nema dovoljno pitanja u bazi." });
        return;
      }
      serverQuizQuestions = pickQuizQuestions(pool, QUIZ_QUESTIONS_PER_SESSION).map(q => ({ ...q }));
      publicQuestions = serverQuizQuestions.map(q => ({ id: q.id, question: q.question, options: q.options }));
    } else if (gameId === "gradovi") {
      const picked = pickGradoviQuestions(QUIZ_QUESTIONS_PER_SESSION);
      serverQuizQuestions = picked.map((q, i) => ({ id: `q${i}`, ...q }));
      publicQuestions = serverQuizQuestions.map(q => ({ id: q.id, question: q.question, options: q.options }));
    } else if (gameId === "zastave") {
      const picked = pickZastaveQuestions(QUIZ_QUESTIONS_PER_SESSION);
      serverQuizQuestions = picked.map((q, i) => ({ id: `q${i}`, ...q }));
      publicQuestions = serverQuizQuestions.map(q => ({
        id: q.id, question: q.question, options: q.options,
        ...(q.flagEmoji ? { flagEmoji: q.flagEmoji } : {}),
      }));
    }

    try {
      const inserted = await exec<{ id: number; started_at: string }>(sql`
        INSERT INTO game_sessions (user_id, game_id, status, started_at, allowed_duration_sec, quiz_questions)
        VALUES (
          ${userId}, ${gameId}, 'running', NOW(), ${allowedDurationSec},
          ${serverQuizQuestions ? sql`${JSON.stringify(serverQuizQuestions)}::jsonb` : sql`NULL`}
        )
        RETURNING id, started_at
      `);
      const row = inserted.rows[0];
      res.json({
        sessionId: row.id,
        gameId,
        startedAt: toIso(row.started_at),
        allowedDurationSec,
        ...(SERVER_SCORED_GAMES.has(gameId) ? { questions: publicQuestions } : {}),
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

// POST /api/games/end
//   - quiz:   { sessionId, answers: [{ questionId, optionIndex }] } → server računa score
//   - memory: { sessionId, score }                                  → klijentski score sa cheatCap
router.post("/end", requireAuth, requireRole("ucenik"), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!checkRate(userId)) {
      res.status(429).json({ error: "rate_limited", message: "Previše zahtjeva. Sačekaj malo." });
      return;
    }
    const sessionId = Number(req.body?.sessionId);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      res.status(400).json({ error: "bad_request", message: "sessionId required" });
      return;
    }

    // Najprije fetchamo (ne-atomski) samo da znamo metadata — ali UPDATE niže je atomski.
    // Uključujemo `quiz_questions` (server-side authoritativna lista pitanja sa odgovorima).
    const found = await exec<{ id: number; user_id: number; game_id: string; status: string; started_at: string; allowed_duration_sec: number; quiz_questions: unknown }>(sql`
      SELECT id, user_id, game_id, status, started_at, allowed_duration_sec, quiz_questions
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

    const maxScore = MAX_SCORE[session.game_id] ?? 1000;
    let score = 0;

    if (SERVER_SCORED_GAMES.has(session.game_id)) {
      // === SERVER-SIDE SCORING ===
      // Klijent šalje { answers: [{ questionId, optionIndex }] }.
      // Validiramo svako pitanje protiv `quiz_questions` JSONB iz baze.
      const stored = session.quiz_questions as { id: string; question: string; options: string[]; answer: string }[] | null;

      // Late-submission guard: odbij submit ako je istekao timer + grace (5s).
      // Bez ovoga napadač može pokrenuti sesiju, mirno gledati pitanja u dev tools-u,
      // pretražiti rješenja online i poslati answers nakon 20 minuta.
      // (durationSec će biti clampan na allowed_duration_sec, ali score = svi tačni.)
      const submitWindow = Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC) + LATE_GRACE_SEC;
      if (elapsedSec > submitWindow) {
        // Markiraj kao expired i vrati 0 (sesija je istekla server-side).
        await db.execute(sql`
          UPDATE game_sessions
          SET status = 'expired', ended_at = NOW(),
              duration_sec = ${Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC)},
              score = 0
          WHERE id = ${sessionId} AND user_id = ${userId} AND status = 'running'
        `);
        res.json({ ok: true, sessionId, gameId: session.game_id, score: 0, finalScore: 0, durationSec: Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC), expired: true });
        return;
      }

      if (Array.isArray(stored) && stored.length > 0) {
        // Sesija je pokrenuta sa server-side scoringom — klijentski `score`
        // se NIKAD ne prihvata (anti-cheat). Score = broj validnih tačnih
        // odgovora. Ako klijent zaboravi poslati `answers`, score = 0.
        // DoS guard: limit dužinu answers array-a (max 2× sample size).
        const rawAnswers = Array.isArray(req.body?.answers)
          ? req.body.answers.slice(0, QUIZ_QUESTIONS_PER_SESSION * 2)
          : [];
        const byId = new Map(stored.map(q => [q.id, q]));
        const seen = new Set<string>();
        let correct = 0;
        for (const a of rawAnswers) {
          if (!a || typeof a !== "object") continue;
          const qid = typeof a.questionId === "string" ? a.questionId : null;
          const optIdx = Number(a.optionIndex);
          if (!qid || seen.has(qid)) continue;
          seen.add(qid);
          const q = byId.get(qid);
          if (!q) continue; // nepoznat ID — ignoriraj
          if (!Number.isInteger(optIdx) || optIdx < 0 || optIdx >= q.options.length) continue;
          if (q.options[optIdx] === q.answer) correct++;
        }
        score = Math.max(0, Math.min(correct, maxScore));
      } else {
        // Legacy fallback: SAMO za sesije pokrenute prije migracije
        // (stored = NULL u DB). Stari klijentski score sa cheatCap-om.
        // Nakon par dana u prod-u ovaj branch postaje mrtav kod.
        const rawScore = Number(req.body?.score ?? 0);
        const minSecForFullScore = 15;
        const cheatCap = elapsedSec < minSecForFullScore
          ? Math.floor(maxScore * (elapsedSec / minSecForFullScore))
          : maxScore;
        score = Math.max(0, Math.min(Math.floor(rawScore), cheatCap));
      }
    } else {
      // === KLIJENT-SCORED IGRE (memory, sace) ===
      // Late-submission guard: ako je istekao timer + grace, sesija se markira
      // kao expired (score=0). Inače napadač može startati sesiju, čekati
      // proizvoljno dugo, pa scriptati visok score izvan window-a.
      const submitWindow = Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC) + LATE_GRACE_SEC;
      if (elapsedSec > submitWindow) {
        await db.execute(sql`
          UPDATE game_sessions
          SET status = 'expired', ended_at = NOW(),
              duration_sec = ${Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC)},
              score = 0
          WHERE id = ${sessionId} AND user_id = ${userId} AND status = 'running'
        `);
        res.json({ ok: true, sessionId, gameId: session.game_id, score: 0, finalScore: 0, durationSec: Math.min(session.allowed_duration_sec, MAX_SESSION_DURATION_SEC), expired: true });
        return;
      }

      const rawScore = Number(req.body?.score ?? 0);
      // Bazni cheatCap: skalira score sa elapsedSec za prvih 5s (sprječava
      // instant-1000 nakon /start). Za sace dodajemo per-sec cap (350/s) jer
      // MAX_SCORE.sace=99999 daje veliki forgery prostor.
      const minSecForFullScore = 5;
      const baseCap = elapsedSec < minSecForFullScore
        ? Math.floor(maxScore * (elapsedSec / minSecForFullScore))
        : maxScore;
      const psc = PER_SEC_CAP[session.game_id];
      const perSecCap = typeof psc === "number"
        ? Math.min(maxScore, Math.floor(psc * Math.max(elapsedSec, 1)))
        : maxScore;
      const cheatCap = Math.min(baseCap, perSecCap);
      score = Math.max(0, Math.min(Math.floor(rawScore), cheatCap));
    }

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
type LbGame = "memory" | "quiz" | "gradovi" | "zastave" | "sace" | "all";
const LB_VALID_GAMES = new Set<string>(["memory", "quiz", "gradovi", "zastave", "sace", "all"]);
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
    if (!LB_VALID_GAMES.has(game)) {
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

// Reusable: izračunaj kompletnu game statistiku za jednog usera (po targetId).
// Ekstrahirano da bi /roditelj/djeca-summary mogao u paraleli pozivati ovo
// za sve djece bez N+1 HTTP poziva.
export async function computeGameStats(targetId: number): Promise<{
  userId: number;
  totalHasanat: number;
  secondsAllowed: number;
  secondsSpent: number;
  secondsRemaining: number;
  groupRank: number | null;
  groupTotal: number | null;
  games: { gameId: string; totalGames: number; bestScore: number; lastScore: number; totalSeconds: number }[];
}> {
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

  return {
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
  };
}

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

    const stats = await computeGameStats(targetId);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "games/personal-stats failed");
    res.status(500).json({ error: "internal_error" });
  }
});

// NAPOMENA: stari GET /api/games/quiz-questions endpoint (koji je vraćao
// pitanja sa odgovorima direktno klijentu) je uklonjen u sklopu task-a #44.
// Pitanja sada generira /games/start server-side i čuva ih u game_sessions
// (BEZ izlaganja `answer` polja klijentu). To zatvara cheat surface gdje je
// napadač mogao paralelno zovnuti /quiz-questions i pročitati tačne odgovore.

export default router;
