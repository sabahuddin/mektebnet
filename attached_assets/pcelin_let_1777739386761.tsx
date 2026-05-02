import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type GamePhase = "ready" | "running" | "paused" | "gameover";

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
    bee: {
      x: 170,
      y: 260,
      vy: 0,
      r: 24,
    },
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

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
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

  if (blink) {
    ctx.globalAlpha = 0.45;
  }

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
  ctx.roundRect(x, y + h * 0.28, w, h * 0.55, 18);
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
  const [, setLocation] = useLocation();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<FlightState>(createInitialState());
  const animationRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<GamePhase>("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [message, setMessage] = useState("Klikni Start i pomozi pčelici da skuplja med.");

  const resetGame = useCallback(() => {
    stateRef.current = createInitialState();
    setScore(0);
    setLives(MAX_LIVES);
    setTimeLeft(GAME_SECONDS);
    setMessage("Klikni Start i pomozi pčelici da skuplja med.");
    setPhase("ready");
  }, []);

  const flap = useCallback(() => {
    const game = stateRef.current;

    if (phase === "gameover") return;

    game.bee.vy = -430;

    if (phase === "ready" || phase === "paused") {
      setMessage("Leti, skupljaj med i izbjegavaj oblake.");
      setPhase("running");
    }
  }, [phase]);

  const startGame = useCallback(() => {
    if (phase === "gameover") {
      resetGame();
      setTimeout(() => setPhase("running"), 0);
      return;
    }

    setMessage("Leti, skupljaj med i izbjegavaj oblake.");
    setPhase("running");
  }, [phase, resetGame]);

  const pauseGame = useCallback(() => {
    if (phase === "running") {
      setMessage("Igra je pauzirana.");
      setPhase("paused");
    }
  }, [phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        flap();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [flap]);

  useEffect(() => {
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

      const game = stateRef.current;
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

      game.obstacles.push({
        x: game.w + 30,
        y,
        w,
        h,
      });
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

      game.obstacles.forEach((obstacle) => {
        obstacle.x -= speed * dt;
      });

      game.honey.forEach((drop) => {
        drop.x -= speed * dt;
      });

      game.obstacles = game.obstacles.filter((obstacle) => obstacle.x + obstacle.w > -40);
      game.honey = game.honey.filter((drop) => drop.x + drop.r > -40 && !drop.collected);

      for (const obstacle of game.obstacles) {
        if (
          game.invulnerable <= 0 &&
          circleRectCollision(
            game.bee.x,
            game.bee.y,
            game.bee.r * 0.85,
            obstacle.x,
            obstacle.y,
            obstacle.w,
            obstacle.h,
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

      game.honey.forEach((drop) => {
        if (!drop.collected) drawHoney(ctx, drop);
      });

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
          phase === "ready"
            ? "Pčelin let"
            : phase === "paused"
              ? "Pauza"
              : "Kraj igre";

        ctx.fillText(title, game.w / 2, game.h / 2 - 18);

        ctx.font = "500 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText("Klik / Space = pčelica leti gore", game.w / 2, game.h / 2 + 16);
      }
    };

    const loop = (time: number) => {
      const game = stateRef.current;

      if (!game.lastTime) {
        game.lastTime = time;
      }

      const dt = Math.min((time - game.lastTime) / 1000, 0.033);
      game.lastTime = time;

      if (phase === "running") {
        update(game, dt);
      }

      draw(game);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [phase]);

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-5 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Mekteb igre
            </p>
            <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">
              Pčelin let
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Skupi med, izbjegni oblake i završi let prije isteka vremena.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLocation("/igrice")}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100"
          >
            Nazad na igrice
          </button>
        </div>

        <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 sm:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Med</p>
            <p className="text-2xl font-bold text-emerald-950">{score}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Životi</p>
            <p className="text-2xl font-bold text-emerald-950">
              {"♥".repeat(lives)}
              <span className="text-slate-300">{"♥".repeat(MAX_LIVES - lives)}</span>
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Vrijeme</p>
            <p className="text-2xl font-bold text-emerald-950">{timeLeft}s</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Status</p>
            <p className="text-sm font-semibold text-emerald-950">{message}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white p-3 shadow-sm ring-1 ring-emerald-100">
          <div className="h-[520px] min-h-[420px] w-full">
            <canvas
              ref={canvasRef}
              onPointerDown={flap}
              className="block h-full w-full cursor-pointer rounded-2xl bg-emerald-50"
              aria-label="Pčelin let igra"
            />
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-center gap-3">
          {phase !== "running" ? (
            <button
              type="button"
              onClick={startGame}
              className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
            >
              {phase === "gameover" ? "Igraj ponovo" : "Start"}
            </button>
          ) : (
            <button
              type="button"
              onClick={pauseGame}
              className="rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
            >
              Pauza
            </button>
          )}

          <button
            type="button"
            onClick={resetGame}
            className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100"
          >
            Resetuj
          </button>
        </section>
      </div>
    </main>
  );
}