import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Bird } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "ready" | "running" | "paused" | "gameover";
type SessionState = "idle" | "loading" | "playing" | "ended" | "no-credit" | "error";

type Bee = {
  x: number;
  y: number;
  vy: number;
  r: number;
};

type Obstacle = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type HoneyDrop = {
  x: number;
  y: number;
  r: number;
  collected: boolean;
};

type FlightState = {
  w: number;
  h: number;
  dpr: number;
  bee: Bee;
  obstacles: Obstacle[];
  honey: HoneyDrop[];
  score: number;
  lives: number;
  timeLeft: number;
  lastTime: number;
  obstacleTimer: number;
  honeyTimer: number;
  uiTimer: number;
  invulnerable: number;
};

const GAME_SECONDS = 90;
const MAX_LIVES = 3;

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function circleRectCollision(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

function circleCollision(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

function createInitialState(): FlightState {
  return {
    w: 900,
    h: 520,
    dpr: 1,
    bee: { x: 170, y: 260, vy: 0, r: 24 },
    obstacles: [],
    honey: [],
    score: 0,
    lives: MAX_LIVES,
    timeLeft: GAME_SECONDS,
    lastTime: 0,
    obstacleTimer: 0,
    honeyTimer: 0,
    uiTimer: 0,
    invulnerable: 0,
  };
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 6 + (Math.PI * 2 * i) / 6;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBee(ctx: CanvasRenderingContext2D, bee: Bee, blink: boolean) {
  ctx.save();
  ctx.translate(bee.x, bee.y);

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = blink ? 0.35 : 0.7;
  ctx.beginPath();
  ctx.ellipse(-8, -22, 15, 10, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(10, -24, 15, 10, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = blink ? 0.45 : 1;

  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2937";
  ctx.fillRect(-10, -19, 5, 38);
  ctx.fillRect(5, -18, 5, 36);

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(23, -5, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26, -15);
  ctx.quadraticCurveTo(37, -27, 44, -17);
  ctx.stroke();

  ctx.restore();
}

function drawCloudObstacle(ctx: CanvasRenderingContext2D, obstacle: Obstacle) {
  const { x, y, w, h } = obstacle;

  ctx.fillStyle = "#dbeafe";
  ctx.beginPath();
  // Round-rect kompatibilno; padamo na običan rect ako runtime nema roundRect
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function") {
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y + h * 0.28, w, h * 0.55, 18);
  } else {
    ctx.rect(x, y + h * 0.28, w, h * 0.55);
  }
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + w * 0.25, y + h * 0.38, h * 0.32, 0, Math.PI * 2);
  ctx.arc(x + w * 0.5, y + h * 0.26, h * 0.4, 0, Math.PI * 2);
  ctx.arc(x + w * 0.75, y + h * 0.4, h * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 6, y + h * 0.36, w - 12, h * 0.36);
}

function drawHoney(ctx: CanvasRenderingContext2D, drop: HoneyDrop) {
  ctx.save();
  drawHexagon(ctx, drop.x, drop.y, drop.r);
  ctx.fillStyle = "#f59e0b";
  ctx.fill();
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff7ed";
  ctx.beginPath();
  ctx.arc(drop.x - drop.r * 0.25, drop.y - drop.r * 0.25, drop.r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#ecfdf5";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#d1fae5";
  for (let x = -50; x < w + 80; x += 90) {
    drawHexagon(ctx, x, h - 35, 26);
    ctx.fill();
  }

  ctx.fillStyle = "#a7f3d0";
  ctx.beginPath();
  ctx.arc(w * 0.12, h - 30, 90, Math.PI, 0);
  ctx.arc(w * 0.34, h - 35, 115, Math.PI, 0);
  ctx.arc(w * 0.58, h - 28, 95, Math.PI, 0);
  ctx.arc(w * 0.82, h - 35, 120, Math.PI, 0);
  ctx.fill();
}

export default function PcelinLet() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef_canvas = useRef<FlightState>(createInitialState());
  const animationRef = useRef<number | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [message, setMessage] = useState("Klikni Start i pomozi pčelici da skuplja med.");

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestEver, setBestEver] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);

  const endingRef = useRef(false);

  // Refs za cleanup
  const sessionStateRef = useRef(sessionState);
  const tokenRef = useRef(token);
  const sessionIdRef = useRef(sessionId);
  const scoreRef = useRef(score);
  useEffect(() => { sessionStateRef.current = sessionState; }, [sessionState]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const resetCanvasState = useCallback(() => {
    stateRef_canvas.current = createInitialState();
    setScore(0);
    setLives(MAX_LIVES);
    setTimeLeft(GAME_SECONDS);
    setMessage("Klikni Start i pomozi pčelici da skuplja med.");
    setPhase("ready");
  }, []);

  // Server upload finalnog rezultata
  const endGame = useCallback(async (finalSc: number) => {
    const sid = sessionIdRef.current;
    const tok = tokenRef.current;
    if (!sid || !tok || endingRef.current) return;
    endingRef.current = true;
    try {
      const r = await apiRequest<{ ok: boolean; finalScore?: number }>(
        "POST", "/games/end", { sessionId: sid, score: finalSc }, tok
      );
      const accepted = typeof r.finalScore === "number" ? r.finalScore : finalSc;
      setFinalScore(accepted);
      setSessionState("ended");
      refetchCredits();
      try {
        const stats = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, tok
        );
        const m = stats.games.find(g => g.gameId === "pcelin");
        setBestEver(m?.bestScore ?? accepted);
      } catch { setBestEver(accepted); }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || "Greška pri završetku");
      setSessionState("error");
    }
  }, [refetchCredits]);

  // Watcher: kada game logika postavi phase="gameover", automatski submit
  useEffect(() => {
    if (phase === "gameover" && sessionState === "playing" && !endingRef.current) {
      void endGame(scoreRef.current);
    }
  }, [phase, sessionState, endGame]);

  const startGame = useCallback(async () => {
    if (!token) return;
    setErrorMsg("");
    setSessionState("loading");
    endingRef.current = false;
    try {
      try {
        const prev = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const m = prev.games.find(g => g.gameId === "pcelin");
        setPreviousBest(m?.bestScore ?? 0);
      } catch { setPreviousBest(null); }

      const res = await apiRequest<{ sessionId: number }>(
        "POST", "/games/start", { gameId: "pcelin" }, token
      );
      setSessionId(res.sessionId);
      resetCanvasState();
      setFinalScore(null);
      setBestEver(null);
      setSessionState("playing");
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) setSessionState("no-credit");
      else if (err.status === 409) { setErrorMsg("Već imaš igru u toku — osvježi stranicu."); setSessionState("error"); }
      else { setErrorMsg(err.message || "Greška pri pokretanju"); setSessionState("error"); }
    }
  }, [token, resetCanvasState]);

  const flap = useCallback(() => {
    const game = stateRef_canvas.current;
    if (phase === "gameover") return;
    game.bee.vy = -430;
    if (phase === "ready" || phase === "paused") {
      setMessage("Leti, skupljaj med i izbjegavaj oblake.");
      setPhase("running");
    }
  }, [phase]);

  const startInternal = useCallback(() => {
    if (phase === "gameover") {
      // Restart cijele sesije (nova /games/start)
      void startGame();
      return;
    }
    setMessage("Leti, skupljaj med i izbjegavaj oblake.");
    setPhase("running");
  }, [phase, startGame]);

  const pauseGame = useCallback(() => {
    if (phase === "running") {
      setMessage("Igra je pauzirana.");
      setPhase("paused");
    }
  }, [phase]);

  // Keyboard listener (samo kad je sesija aktivna)
  useEffect(() => {
    if (sessionState !== "playing") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flap, sessionState]);

  // Canvas render loop (samo kad je sesija aktivna)
  useEffect(() => {
    if (sessionState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, rect.width);
      const height = Math.max(420, rect.height);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const game = stateRef_canvas.current;
      game.w = width;
      game.h = height;
      game.dpr = dpr;
      game.bee.x = Math.max(120, width * 0.18);
      game.bee.y = clamp(game.bee.y, 80, height - 90);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();

    const spawnObstacle = (game: FlightState) => {
      const h = random(52, 95);
      const w = random(78, 130);
      const y = random(70, Math.max(120, game.h - 160));
      game.obstacles.push({ x: game.w + 30, y, w, h });
    };

    const spawnHoney = (game: FlightState) => {
      game.honey.push({
        x: game.w + 40,
        y: random(75, Math.max(120, game.h - 130)),
        r: 18,
        collected: false,
      });
    };

    const update = (game: FlightState, dt: number) => {
      const speed = 190 + Math.min(game.score * 0.4, 110);

      game.timeLeft -= dt;
      game.obstacleTimer += dt;
      game.honeyTimer += dt;
      game.uiTimer += dt;
      game.invulnerable = Math.max(0, game.invulnerable - dt);

      if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        setMessage("Vrijeme je isteklo. Aferim za let!");
        setPhase("gameover");
      }

      if (game.obstacleTimer > 1.25) {
        spawnObstacle(game);
        game.obstacleTimer = 0;
      }

      if (game.honeyTimer > 1.05) {
        spawnHoney(game);
        game.honeyTimer = 0;
      }

      game.bee.vy += 880 * dt;
      game.bee.y += game.bee.vy * dt;
      game.bee.y = clamp(game.bee.y, 45, game.h - 65);

      if (game.bee.y <= 48 || game.bee.y >= game.h - 68) {
        if (game.invulnerable <= 0) {
          game.lives -= 1;
          game.invulnerable = 1.2;
          game.bee.vy = -260;
        }
      }

      game.obstacles.forEach((obstacle) => { obstacle.x -= speed * dt; });
      game.honey.forEach((drop) => { drop.x -= speed * dt; });

      game.obstacles = game.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -40);
      game.honey = game.honey.filter((drop) => drop.x + drop.r > -40 && !drop.collected);

      for (const obstacle of game.obstacles) {
        if (
          game.invulnerable <= 0 &&
          circleRectCollision(
            game.bee.x, game.bee.y, game.bee.r * 0.85,
            obstacle.x, obstacle.y, obstacle.w, obstacle.h,
          )
        ) {
          game.lives -= 1;
          game.invulnerable = 1.35;
          game.bee.vy = -320;
        }
      }

      for (const drop of game.honey) {
        if (
          !drop.collected &&
          circleCollision(game.bee.x, game.bee.y, game.bee.r, drop.x, drop.y, drop.r)
        ) {
          drop.collected = true;
          game.score += 10;
        }
      }

      if (game.lives <= 0) {
        game.lives = 0;
        setMessage("Pčelica se umorila. Pokušaj ponovo.");
        setPhase("gameover");
      }

      if (game.uiTimer > 0.12) {
        setScore(game.score);
        setLives(game.lives);
        setTimeLeft(Math.ceil(game.timeLeft));
        game.uiTimer = 0;
      }
    };

    const draw = (game: FlightState) => {
      drawBackground(ctx, game.w, game.h);

      game.honey.forEach((drop) => { if (!drop.collected) drawHoney(ctx, drop); });
      game.obstacles.forEach((obstacle) => drawCloudObstacle(ctx, obstacle));

      const blink = game.invulnerable > 0 && Math.floor(game.invulnerable * 10) % 2 === 0;
      drawBee(ctx, game.bee, blink);

      if (phase === "ready" || phase === "paused" || phase === "gameover") {
        ctx.fillStyle = "rgba(6, 95, 70, 0.08)";
        ctx.fillRect(0, 0, game.w, game.h);

        ctx.fillStyle = "#064e3b";
        ctx.textAlign = "center";
        ctx.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

        const title =
          phase === "ready" ? "Pčelin let"
          : phase === "paused" ? "Pauza"
          : "Kraj igre";

        ctx.fillText(title, game.w / 2, game.h / 2 - 18);

        ctx.font = "500 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("Klik / Space = pčelica leti gore", game.w / 2, game.h / 2 + 16);
      }
    };

    const loop = (time: number) => {
      const game = stateRef_canvas.current;

      if (!game.lastTime) game.lastTime = time;

      const dt = Math.min((time - game.lastTime) / 1000, 0.033);
      game.lastTime = time;

      if (phase === "running") update(game, dt);

      draw(game);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [phase, sessionState]);

  // Cleanup pri unmount-u (učenik napušta stranicu mid-game)
  useEffect(() => {
    return () => {
      if (sessionStateRef.current === "playing" && sessionIdRef.current && tokenRef.current && !endingRef.current) {
        endingRef.current = true;
        const partial = scoreRef.current;
        apiRequest("POST", "/games/end", { sessionId: sessionIdRef.current, score: partial }, tokenRef.current).catch(() => {});
      }
    };
  }, []);

  // Role guards
  if (!user) {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <p className="font-bold text-foreground mb-2">Igrice su za prijavljene učenike</p>
          <Link href="/login" className="text-primary font-bold underline">Prijavi se</Link>
        </Card>
      </Layout>
    );
  }
  if (user.role !== "ucenik") {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-pcelin-let">
          <p className="font-bold text-foreground mb-2">Igrice su dostupne samo učeničkim nalozima</p>
          <Link href="/igrice" className="text-primary font-bold underline">Nazad</Link>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/igrice">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Natrag
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Bird className="w-7 h-7 text-amber-500" /> Pčelin let
        </h1>
      </div>

      {sessionState === "loading" && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Pokrećem igru…</p></Card>
      )}

      {sessionState === "idle" && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-200">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-foreground mb-1">90 sekundi leta — koliko meda skupiš?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pčelica leti, skuplja medene heksagone i izbjegava oblake. Imaš <strong>3 života</strong> i <strong>90 sekundi</strong>.
                Svaki med = 10 poena.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Kontrole:</strong> Klik / Space / ↑ = pčelica leti gore.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Preostalo vremena: <strong>{creditsLoading ? "…" : formatSeconds(credits?.secondsRemaining ?? 0)}</strong>
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={creditsLoading || (credits?.secondsRemaining ?? 0) <= 0}
            data-testid="button-start-pcelin"
            className="rounded-2xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
          >
            {creditsLoading ? "Učitavam…" : "Pokreni igru"}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">Nemaš dovoljno vremena. Završi neku lekciju za nove kapi meda 🍯.</p>
          )}
        </Card>
      )}

      {sessionState === "no-credit" && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="font-bold text-foreground mb-2">Nemaš više vremena za igre.</p>
          <p className="text-sm text-muted-foreground mb-3">Završi lekciju ili kviz da zaradiš nove kapi meda 🍯.</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/ilmihal"><Button size="sm" className="rounded-xl">Ilmihal</Button></Link>
            <Link href="/kvizovi"><Button size="sm" variant="outline" className="rounded-xl">Kvizovi</Button></Link>
          </div>
        </Card>
      )}

      {sessionState === "error" && (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="font-bold text-red-700 mb-2">Greška</p>
          <p className="text-sm text-muted-foreground mb-3">{errorMsg}</p>
          <Button size="sm" onClick={() => setSessionState("idle")} className="rounded-xl">Nazad</Button>
        </Card>
      )}

      {sessionState === "playing" && (
        <div className="flex flex-col gap-4">
          {/* HUD */}
          <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 sm:grid-cols-4">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Med</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums" data-testid="text-score">{score}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Životi</p>
              <p className="text-2xl font-bold text-emerald-950" data-testid="text-lives">
                {"♥".repeat(lives)}
                <span className="text-slate-300">{"♥".repeat(MAX_LIVES - lives)}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Vrijeme</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums" data-testid="text-time">{timeLeft}s</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Status</p>
              <p className="text-sm font-semibold text-emerald-950">{message}</p>
            </div>
          </section>

          {/* Canvas */}
          <section className="overflow-hidden rounded-3xl bg-white p-3 shadow-sm ring-1 ring-emerald-100">
            <div className="h-[520px] min-h-[420px] w-full">
              <canvas
                ref={canvasRef}
                onPointerDown={flap}
                className="block h-full w-full cursor-pointer rounded-2xl bg-emerald-50"
                aria-label="Pčelin let igra"
                data-testid="canvas-pcelin"
              />
            </div>
          </section>

          {/* Controls */}
          <section className="flex flex-wrap items-center justify-center gap-3">
            {phase !== "running" && phase !== "gameover" ? (
              <Button
                onClick={startInternal}
                className="rounded-2xl font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                data-testid="button-pcelin-go"
              >
                Start
              </Button>
            ) : phase === "running" ? (
              <Button
                onClick={pauseGame}
                className="rounded-2xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="button-pcelin-pause"
              >
                Pauza
              </Button>
            ) : null}
          </section>
        </div>
      )}

      <AnimatePresence>
        {sessionState === "ended" && finalScore !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-8 mt-6 bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-300 text-center">
              <div className="text-5xl mb-3">🐝</div>
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-2xl font-black text-foreground mb-1">Kraj leta!</p>
              <p className="text-lg text-muted-foreground mb-2">
                Skupljeno meda: <span className="font-black text-3xl text-amber-600" data-testid="text-final-score">{finalScore}</span>
              </p>
              <div className="text-sm text-muted-foreground mb-4 space-y-0.5">
                {bestEver !== null && (
                  <p>
                    Najbolji ikad: <span className="font-bold text-foreground" data-testid="text-best-ever">{bestEver}</span>
                    {previousBest !== null && finalScore > previousBest && (
                      <span className="ml-2 text-emerald-600 font-bold">novi rekord!</span>
                    )}
                  </p>
                )}
                {previousBest !== null && previousBest > 0 && (
                  <p>Tvoj prethodni najbolji: <span className="font-bold text-foreground">{previousBest}</span></p>
                )}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => { setSessionState("idle"); refetchCredits(); }} className="rounded-2xl">
                  <RefreshCw className="w-4 h-4 mr-1" /> Igraj opet
                </Button>
                <Button variant="outline" onClick={() => setLocation("/igrice/ljestvica")} className="rounded-2xl">
                  Ljestvica
                </Button>
                <Link href="/igrice">
                  <Button variant="ghost" className="rounded-2xl">Natrag na Igrice</Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
