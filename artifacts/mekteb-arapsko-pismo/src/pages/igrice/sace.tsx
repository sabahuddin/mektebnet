import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Hexagon, Sparkles, ArrowDown, RotateCw, ArrowLeft as ArrLeft, ArrowRight as ArrRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================================================
// HEX SAĆE — TETRIS-LIKE IGRA
// Flat-top heksagoni, axial koordinate (q, r). q je "stupac" (vertikalan pad
// po fiksnom q), r je "red" (horizontalna zigzag linija za brisanje).
// Susjedne kolone su pomjerene naizmjenično po y zbog flat-top tessellation,
// što daje klasičan honeycomb izgled saća.
// =============================================================================

const COLS = 7;        // q ∈ [0, 6]
const ROWS = 13;       // r ∈ [0, 12]
const HEX_SIZE = 18;   // circumscribed radius u pixelima (flat-top)
const SQRT3 = Math.sqrt(3);

// Konverzija axial → pixel (flat-top, origin gore-lijevo + padding)
const PAD_X = HEX_SIZE + 2;
const PAD_Y = HEX_SIZE + 2;
function hexToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * 1.5 * q + PAD_X;
  const y = HEX_SIZE * SQRT3 * (r + q / 2) + PAD_Y;
  return { x, y };
}

// SVG dimenzije: q=0..COLS-1 i r=0..ROWS-1, plus zigzag y-shift od (COLS-1)/2
const SVG_W = HEX_SIZE * 1.5 * (COLS - 1) + 2 * PAD_X;
const SVG_H = HEX_SIZE * SQRT3 * (ROWS - 1 + (COLS - 1) / 2) + 2 * PAD_Y;

// SVG hex polygon points (flat-top, centered at origin)
const HEX_POINTS = (() => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    // flat-top: prvi vrh desno (angle 0), zatim svakih 60°
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${(HEX_SIZE * Math.cos(angle)).toFixed(2)},${(HEX_SIZE * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
})();

// Rotacija axial 60° CW oko origin: (q, r) → (-r, q+r)
type Cell = { q: number; r: number };
function rotateCW(c: Cell): Cell {
  return { q: -c.r, r: c.q + c.r };
}

// Definicije figura (axial relative cells, anchor je "origin" cell (0,0)).
// Boja je iz Mekteb amber/yellow palete + akcent boje za varijaciju.
type Shape = { id: string; color: string; cells: Cell[]; rotations: number };
const SHAPES: Shape[] = [
  // Single hex — najjednostavnija "rezerva", rijetko se pojavljuje
  { id: "single", color: "#f59e0b", cells: [{ q: 0, r: 0 }], rotations: 1 },
  // Domino (2 hex linija)
  { id: "domino", color: "#fb923c", cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }], rotations: 3 },
  // Trio-I (1+1+1 linija)
  { id: "trio-i", color: "#a855f7", cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 0, r: 2 }], rotations: 3 },
  // Trio-L (2+1, ugao)
  { id: "trio-l", color: "#10b981", cells: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }], rotations: 6 },
  // Tetra (4 hex, "rhombus")
  { id: "tetra", color: "#ef4444", cells: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 1 }], rotations: 3 },
];

// Vraća cells za određenu rotaciju (axial CW oko origin (0,0)).
// Ne normaliziramo — anchor ostaje origin, što daje konzistentan "rotation pivot".
function rotated(shape: Shape, rotIdx: number): Cell[] {
  let cells = shape.cells;
  for (let i = 0; i < rotIdx; i++) cells = cells.map(rotateCW);
  return cells;
}

// Aktivna padajuća figura
type Piece = { shape: Shape; rotIdx: number; anchorQ: number; anchorR: number };

function pieceCells(p: Piece): Cell[] {
  return rotated(p.shape, p.rotIdx).map(c => ({ q: c.q + p.anchorQ, r: c.r + p.anchorR }));
}

// Storage tipa — Map<"q,r", color>. Lock-in je permanentan dok red ne nestane.
type Grid = Map<string, string>;
const cellKey = (q: number, r: number) => `${q},${r}`;

function isInBounds(q: number, r: number): boolean {
  return q >= 0 && q < COLS && r >= 0 && r < ROWS;
}

// Kolizija: svi cells moraju biti u bounds-u i ne smiju kolidovati sa lockanim hexima.
function isValidPosition(grid: Grid, p: Piece): boolean {
  for (const c of pieceCells(p)) {
    if (!isInBounds(c.q, c.r)) return false;
    if (grid.has(cellKey(c.q, c.r))) return false;
  }
  return true;
}

// Lock figuru u grid (ne mutira ulaz — vraća novi Map).
function lockPiece(grid: Grid, p: Piece): Grid {
  const ng = new Map(grid);
  for (const c of pieceCells(p)) {
    ng.set(cellKey(c.q, c.r), p.shape.color);
  }
  return ng;
}

// Pronađi sve "potpune" redove i obriši ih. Vraća { newGrid, lines }.
// Red r je potpun ako su svi q ∈ [0, COLS-1] popunjeni za taj r.
function clearLines(grid: Grid): { newGrid: Grid; clearedRows: number[] } {
  const clearedRows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    let full = true;
    for (let q = 0; q < COLS; q++) {
      if (!grid.has(cellKey(q, r))) { full = false; break; }
    }
    if (full) clearedRows.push(r);
  }
  if (clearedRows.length === 0) return { newGrid: grid, clearedRows };

  // Izgradi novi grid: za svaki cell koji preživi, izračunaj koliko obrisanih
  // redova je ispod njega (po višem r) — toliko se "spušta" naniže.
  // OPREZ: u našem koord sistemu r=0 je VRH, r=ROWS-1 je DNO.
  // Hex iznad obrisanog (manji r) treba se pomjeriti DOLJE (povećati r) za broj
  // obrisanih redova ispod njega.
  const ng: Grid = new Map();
  for (const [key, color] of grid) {
    const [qStr, rStr] = key.split(",");
    const q = Number(qStr), r = Number(rStr);
    if (clearedRows.includes(r)) continue; // obrisana ćelija
    const dropBy = clearedRows.filter(cr => cr > r).length;
    ng.set(cellKey(q, r + dropBy), color);
  }
  return { newGrid: ng, clearedRows };
}

// Score per number-of-lines u jednom potezu (klasično Tetris pravilo, skalirano za hex)
const LINE_SCORES = [0, 100, 300, 700, 1500];

// Brzina pada (ms po step-u) ovisno o levelu
function tickInterval(level: number): number {
  return Math.max(80, 800 - (level - 1) * 60);
}

// Random shape (uniformna distribucija — single je rjeđa jer je pre-laka)
const SHAPE_WEIGHTS = [
  { idx: 0, w: 1 },  // single
  { idx: 1, w: 3 },  // domino
  { idx: 2, w: 3 },  // trio-i
  { idx: 3, w: 4 },  // trio-l
  { idx: 4, w: 3 },  // tetra
];
function randomShape(): Shape {
  const total = SHAPE_WEIGHTS.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of SHAPE_WEIGHTS) {
    if (r < x.w) return SHAPES[x.idx];
    r -= x.w;
  }
  return SHAPES[3];
}

// Spawn position za novu figuru: q = 3 (sredina), r = 0 (vrh).
// Ako odmah nakon spawn-a figura nije validna (preklapa se sa lockanim) → game over.
function spawnPiece(): Piece {
  return { shape: randomShape(), rotIdx: 0, anchorQ: 3, anchorR: 0 };
}

type GameState = "idle" | "loading" | "playing" | "ended" | "no-credit" | "error";

export default function MektebskoSace() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const [state, setState] = useState<GameState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [grid, setGrid] = useState<Grid>(new Map());
  const [piece, setPiece] = useState<Piece | null>(null);
  const [nextShape, setNextShape] = useState<Shape>(SHAPES[1]);
  const [score, setScore] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [level, setLevel] = useState(1);
  const [flashRows, setFlashRows] = useState<number[]>([]);
  const [comboMsg, setComboMsg] = useState<string>("");
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestEver, setBestEver] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);

  const endingRef = useRef(false);
  const tickRef = useRef<number | null>(null);

  // === REFS — IZVOR ISTINE za game state ===
  // gridRef, pieceRef, scoreRef, levelRef i linesRef su autoritativni; React
  // state služi samo za render. Sve mutacije idu kroz sinhrone funkcije
  // (lockAndAdvance, stepDown, hardDrop) koje upisuju u refs i pozivaju
  // setX(refX.current) za re-render. Time se izbjegava race između gravity
  // tick-a i hardDrop-a (JS je single-threaded — callback-i se nikad ne
  // interleavuju, a refs su uvijek konzistentni unutar jednog tick-a).
  const stateRef = useRef(state);
  const tokenRef = useRef(token);
  const sessionIdRef = useRef(sessionId);
  const scoreRef = useRef(score);
  const levelRef = useRef(level);
  const linesRef = useRef(linesCleared);
  const pieceRef = useRef<Piece | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { linesRef.current = linesCleared; }, [linesCleared]);
  useEffect(() => { pieceRef.current = piece; }, [piece]);

  // === END SESSION (server) ===
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
      setState("ended");
      refetchCredits();
      try {
        const stats = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, tok
        );
        const m = stats.games.find(g => g.gameId === "sace");
        setBestEver(m?.bestScore ?? accepted);
      } catch { setBestEver(accepted); }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || t("Greška pri završetku"));
      setState("error");
    }
  }, [refetchCredits, t]);

  // === START SESSION ===
  const startGame = useCallback(async () => {
    if (!token) return;
    setErrorMsg("");
    setState("loading");
    try {
      // Snimi prethodni best za "novi rekord!" indikator
      try {
        const prev = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const m = prev.games.find(g => g.gameId === "sace");
        setPreviousBest(m?.bestScore ?? 0);
      } catch { setPreviousBest(null); }

      const res = await apiRequest<{ sessionId: number }>(
        "POST", "/games/start", { gameId: "sace" }, token
      );
      setSessionId(res.sessionId);
      // Sinhroni reset refs (autoritativan storage) prije postavljanja state-a.
      const initialPiece = spawnPiece();
      const initialNext = randomShape();
      gridRef.current = new Map();
      pieceRef.current = initialPiece;
      nextShapeRef.current = initialNext;
      scoreRef.current = 0;
      linesRef.current = 0;
      levelRef.current = 1;
      setGrid(new Map());
      setPiece(initialPiece);
      setNextShape(initialNext);
      setScore(0);
      setLinesCleared(0);
      setLevel(1);
      setFlashRows([]);
      setComboMsg("");
      setFinalScore(null);
      setBestEver(null);
      endingRef.current = false;
      setState("playing");
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) { setState("no-credit"); }
      else if (err.status === 409) { setErrorMsg(t("Već imaš igru u toku — osvježi stranicu.")); setState("error"); }
      else { setErrorMsg(err.message || t("Greška pri pokretanju")); setState("error"); }
    }
  }, [token, t]);

  // Refs za grid i nextShape (autoritativan storage)
  const gridRef = useRef<Grid>(new Map());
  const nextShapeRef = useRef<Shape>(SHAPES[1]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { nextShapeRef.current = nextShape; }, [nextShape]);

  // === GAME OVER detekcija ===
  // Game over: spawn nove figure rezultira invalid pozicijom (preklapa se sa
  // lockanim hexima ili je izvan bounds-a). Pošalji /end sa AUTHORITATIVNIM
  // finalSc koji uključuje terminal lock score (line clear bonusi za zadnji lock).
  const triggerGameOver = useCallback((finalSc: number) => {
    if (stateRef.current !== "playing") return;
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    void endGame(finalSc);
  }, [endGame]);

  // === LOCK + ADVANCE (sinhrona, autoritativna preko refs) ===
  // Lock-uje datu figuru u grid, izvodi line clears, ažurira score/level/lines
  // SINHRONO preko refs (i emit-uje state setters za render), spawna sljedeću
  // figuru, detektuje game-over. Pošto je JS single-threaded, race između
  // gravity tick-a (setInterval) i hardDrop-a je nemoguć — callback-i se ne
  // interleavuju. Refs su uvijek konzistentni unutar jednog event loop tick-a.
  const lockAndAdvance = useCallback((p: Piece) => {
    // 1. Lock + clear lines
    const lockedGrid = lockPiece(gridRef.current, p);
    const { newGrid, clearedRows } = clearLines(lockedGrid);
    gridRef.current = newGrid;
    setGrid(newGrid);

    // 2. Score iz line clears (na trenutnom levelu — koristi levelRef)
    if (clearedRows.length > 0) {
      const earned = (LINE_SCORES[clearedRows.length] ?? 0) * levelRef.current;
      const newScore = Math.min(99999, scoreRef.current + earned);
      scoreRef.current = newScore;
      setScore(newScore);

      const newLines = linesRef.current + clearedRows.length;
      linesRef.current = newLines;
      setLinesCleared(newLines);

      const newLevel = 1 + Math.floor(newLines / 10);
      if (newLevel !== levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
      }

      setFlashRows(clearedRows);
      if (clearedRows.length >= 2) {
        setComboMsg(clearedRows.length === 4 ? t("🐝 BZZZ!") : clearedRows.length === 3 ? t("Saća pucaju!") : t("Bravo!"));
        setTimeout(() => setComboMsg(""), 1200);
      }
      setTimeout(() => setFlashRows([]), 350);
    }

    // 3. Spawn next piece
    const next: Piece = { shape: nextShapeRef.current, rotIdx: 0, anchorQ: 3, anchorR: 0 };
    const newNext = randomShape();
    nextShapeRef.current = newNext;
    setNextShape(newNext);

    // 4. Game-over check
    if (!isValidPosition(newGrid, next)) {
      pieceRef.current = null;
      setPiece(null);
      // scoreRef.current je VEĆ ažuriran sa terminal line-clear bonusima iznad,
      // pa game-over submit ima authoritativan finalScore (fix za stale score).
      triggerGameOver(scoreRef.current);
      return;
    }
    pieceRef.current = next;
    setPiece(next);
  }, [triggerGameOver, t]);

  // === KORAK NIŽE (gravity tick + soft-drop) ===
  // Sinhrona — koristi pieceRef/gridRef. Ako figura ne može dalje → lockAndAdvance.
  const stepDown = useCallback((soft: boolean = false) => {
    if (stateRef.current !== "playing") return;
    const curr = pieceRef.current;
    if (!curr) return;
    const moved: Piece = { ...curr, anchorR: curr.anchorR + 1 };
    if (isValidPosition(gridRef.current, moved)) {
      if (soft) {
        // soft drop bonus: +1 po cell-u (sinhroni ref-update + state-emit)
        const newScore = Math.min(99999, scoreRef.current + 1);
        scoreRef.current = newScore;
        setScore(newScore);
      }
      pieceRef.current = moved;
      setPiece(moved);
      return;
    }
    // Lock
    lockAndAdvance(curr);
  }, [lockAndAdvance]);

  // === GAME LOOP (gravity tick) ===
  useEffect(() => {
    if (state !== "playing") return;
    const ms = tickInterval(level);
    tickRef.current = window.setInterval(() => {
      stepDown(false);
    }, ms);
    return () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state, level, stepDown]);

  // === KONTROLE ===
  const moveHoriz = useCallback((dir: -1 | 1) => {
    if (stateRef.current !== "playing") return;
    const curr = pieceRef.current;
    if (!curr) return;
    const moved: Piece = { ...curr, anchorQ: curr.anchorQ + dir };
    if (isValidPosition(gridRef.current, moved)) {
      pieceRef.current = moved;
      setPiece(moved);
    }
  }, []);

  const rotatePiece = useCallback(() => {
    if (stateRef.current !== "playing") return;
    const curr = pieceRef.current;
    if (!curr) return;
    const nextRot = (curr.rotIdx + 1) % curr.shape.rotations;
    const rotated: Piece = { ...curr, rotIdx: nextRot };
    // Probaj rotaciju, ako ne stane — pokušaj wall-kick (offset ±1, ±2)
    if (isValidPosition(gridRef.current, rotated)) {
      pieceRef.current = rotated;
      setPiece(rotated);
      return;
    }
    for (const dq of [-1, 1, -2, 2]) {
      const kicked: Piece = { ...rotated, anchorQ: rotated.anchorQ + dq };
      if (isValidPosition(gridRef.current, kicked)) {
        pieceRef.current = kicked;
        setPiece(kicked);
        return;
      }
    }
  }, []);

  const softDrop = useCallback(() => {
    stepDown(true);
  }, [stepDown]);

  const hardDrop = useCallback(() => {
    if (stateRef.current !== "playing") return;
    const curr = pieceRef.current;
    if (!curr) return;
    let drops = 0;
    let p: Piece = curr;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next: Piece = { ...p, anchorR: p.anchorR + 1 };
      if (!isValidPosition(gridRef.current, next)) break;
      p = next;
      drops++;
    }
    // hard drop bonus: +2 po cell-u (sinhroni ref-update)
    if (drops > 0) {
      const newScore = Math.min(99999, scoreRef.current + drops * 2);
      scoreRef.current = newScore;
      setScore(newScore);
    }
    // SINHRONI lock — bez setTimeout. Race s gravity tick je nemoguć (single-threaded).
    pieceRef.current = p;
    lockAndAdvance(p);
  }, [lockAndAdvance]);

  // === KEYBOARD LISTENER (desktop) ===
  useEffect(() => {
    if (state !== "playing") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") { e.preventDefault(); moveHoriz(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveHoriz(1); }
      else if (e.key === "ArrowUp" || e.key === " ") { e.preventDefault(); rotatePiece(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); softDrop(); }
      else if (e.key === "Enter") { e.preventDefault(); hardDrop(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, moveHoriz, rotatePiece, softDrop, hardDrop]);

  // === CLEANUP: ako user napusti sredinom igre, end session sa partial score ===
  useEffect(() => {
    return () => {
      if (stateRef.current === "playing" && sessionIdRef.current && tokenRef.current && !endingRef.current) {
        endingRef.current = true;
        const partial = scoreRef.current;
        apiRequest("POST", "/games/end", { sessionId: sessionIdRef.current, score: partial }, tokenRef.current).catch(() => {});
      }
    };
  }, []);

  // === RENDER HELPERS ===
  // Lista lockanih ćelija + aktivna figura — za render.
  const renderedCells = useMemo(() => {
    type RC = { q: number; r: number; color: string; active: boolean; flashing: boolean };
    const out: RC[] = [];
    for (const [key, color] of grid) {
      const [qS, rS] = key.split(",");
      const q = Number(qS), r = Number(rS);
      out.push({ q, r, color, active: false, flashing: flashRows.includes(r) });
    }
    if (piece) {
      for (const c of pieceCells(piece)) {
        out.push({ q: c.q, r: c.r, color: piece.shape.color, active: true, flashing: false });
      }
    }
    return out;
  }, [grid, piece, flashRows]);

  // Ghost piece (gdje će figura pasti hard-drop-om) — za UX preview
  const ghostCells = useMemo(() => {
    if (!piece) return [] as Cell[];
    let p = piece;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next: Piece = { ...p, anchorR: p.anchorR + 1 };
      if (!isValidPosition(grid, next)) break;
      p = next;
    }
    if (p.anchorR === piece.anchorR) return []; // nije se pomjerio (već je na dnu)
    return pieceCells(p);
  }, [piece, grid]);

  // === ROLE GUARDS ===
  if (!user) {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <p className="font-bold text-foreground mb-2">{t("Igrice su za prijavljene učenike")}</p>
          <Link href="/login" className="text-primary font-bold underline">{t("Prijavi se")}</Link>
        </Card>
      </Layout>
    );
  }
  if (user.role !== "ucenik") {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-sace">
          <p className="font-bold text-foreground mb-2">{t("Igrice su dostupne samo učeničkim nalozima")}</p>
          <Link href="/igrice" className="text-primary font-bold underline">{t("Nazad")}</Link>
        </Card>
      </Layout>
    );
  }

  // === IDLE / NO-CREDIT / ERROR / LOADING ===
  if (state === "loading") {
    return (
      <Layout>
        <Card className="p-8 text-center"><p className="text-muted-foreground">{t("Pokrećem igru…")}</p></Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/igrice">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> {t("Natrag")}
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Hexagon className="w-7 h-7 text-amber-500 fill-amber-200" /> {t("Mektebsko saće")}
        </h1>
      </div>

      {state === "idle" && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-amber-50 to-yellow-100/60 border-amber-200">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl shrink-0" aria-hidden>🐝</span>
            <div>
              <p className="font-bold text-foreground mb-1">{t("Slaži šestougaone ćelije saća kao u Tetrisu")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("Padajuće figure (1, 2, 3 ili 4 hex) se slažu u saće. Popuni cijeli horizontalni red i nestaje — dobiješ bodove. Igra traje dok ne izgubiš (ne stanu nove figure).")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>{t("Kontrole:")}</strong> {t("← → pomjeri, ↑ rotiraj, ↓ ubrzaj, Enter za hard drop. Na mobilnom: dugmad ispod.")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("Preostalo vremena: ")}<strong>{creditsLoading ? "…" : formatSeconds(credits?.secondsRemaining ?? 0)}</strong>
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={creditsLoading || (credits?.secondsRemaining ?? 0) <= 0}
            data-testid="button-start-sace"
            className="rounded-2xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
          >
            {creditsLoading ? t("Učitavam…") : t("Pokreni igru")}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">{t("Nemaš dovoljno vremena. Završi neku lekciju za nove kapi meda 🍯.")}</p>
          )}
        </Card>
      )}

      {state === "no-credit" && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="font-bold text-foreground mb-2">{t("Nemaš više vremena za igre.")}</p>
          <p className="text-sm text-muted-foreground mb-3">{t("Završi lekciju ili kviz da zaradiš nove kapi meda 🍯.")}</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/ilmihal"><Button size="sm" className="rounded-xl">{t("Ilmihal")}</Button></Link>
            <Link href="/kvizovi"><Button size="sm" variant="outline" className="rounded-xl">{t("Kvizovi")}</Button></Link>
          </div>
        </Card>
      )}

      {state === "error" && (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="font-bold text-red-700 mb-2">{t("Greška")}</p>
          <p className="text-sm text-muted-foreground mb-3">{errorMsg}</p>
          <Button size="sm" onClick={() => setState("idle")} className="rounded-xl">{t("Nazad")}</Button>
        </Card>
      )}

      {state === "playing" && (
        <>
          {/* HUD: score, level, lines, next */}
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <div className="bg-white border border-amber-200 rounded-2xl py-2 px-1">
              <p className="text-[10px] font-bold uppercase text-amber-700/70">{t("Bodovi")}</p>
              <p className="text-lg font-black text-amber-700 tabular-nums" data-testid="text-score">{score}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-2xl py-2 px-1">
              <p className="text-[10px] font-bold uppercase text-amber-700/70">{t("Level")}</p>
              <p className="text-lg font-black text-amber-700 tabular-nums" data-testid="text-level">{level}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-2xl py-2 px-1">
              <p className="text-[10px] font-bold uppercase text-amber-700/70">{t("Linije")}</p>
              <p className="text-lg font-black text-amber-700 tabular-nums" data-testid="text-lines">{linesCleared}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-2xl py-2 px-1 flex flex-col items-center justify-center">
              <p className="text-[10px] font-bold uppercase text-amber-700/70 mb-0.5">{t("Sljedeća")}</p>
              <NextPreview shape={nextShape} />
            </div>
          </div>

          {/* PLAY AREA: lijeva dugmad | grid (rastegnut) | desna dugmad */}
          <div className="flex items-stretch justify-center gap-2 sm:gap-3">
            {/* LIJEVA KOLONA — Lijevo + Rotiraj */}
            <div className="flex flex-col gap-2 sm:gap-3 justify-center shrink-0 w-14 sm:w-20">
              <ControlBtn onClick={() => moveHoriz(-1)} testid="btn-sace-left" label={t("Lijevo")} tall>
                <ArrLeft className="w-7 h-7 sm:w-8 sm:h-8" />
              </ControlBtn>
              <ControlBtn onClick={rotatePiece} testid="btn-sace-rotate" label={t("Rotiraj")} tall>
                <RotateCw className="w-7 h-7 sm:w-8 sm:h-8" />
              </ControlBtn>
            </div>

            {/* GRID + Combo overlay (širi se da popuni prostor između dugmadi) */}
            <div className="relative flex-1 min-w-0 flex items-center justify-center">
              <div className="bg-gradient-to-b from-amber-50/60 to-yellow-100/40 border-2 border-amber-300/70 rounded-2xl p-1 shadow-inner overflow-hidden inline-block">
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  display: "block",
                  height: "min(80vh, calc(100vh - 200px))",
                  width: "auto",
                  maxWidth: "100%",
                }}
                aria-label={t("Saće — igralište")}
                data-testid="svg-sace-grid"
              >
                {/* Background grid (prazne ćelije) */}
                {Array.from({ length: ROWS }).map((_, r) =>
                  Array.from({ length: COLS }).map((_, q) => {
                    const { x, y } = hexToPixel(q, r);
                    return (
                      <polygon
                        key={`bg-${q}-${r}`}
                        points={HEX_POINTS}
                        transform={`translate(${x},${y})`}
                        fill="rgba(254, 243, 199, 0.4)"
                        stroke="rgba(217, 119, 6, 0.18)"
                        strokeWidth="0.8"
                      />
                    );
                  })
                )}

                {/* Ghost piece (poluprovidan preview gdje će pasti) */}
                {ghostCells.map((c, i) => {
                  if (!isInBounds(c.q, c.r)) return null;
                  const { x, y } = hexToPixel(c.q, c.r);
                  return (
                    <polygon
                      key={`ghost-${i}`}
                      points={HEX_POINTS}
                      transform={`translate(${x},${y})`}
                      fill={piece?.shape.color || "#f59e0b"}
                      opacity="0.18"
                      stroke="none"
                    />
                  );
                })}

                {/* Locked + active cells */}
                {renderedCells.map((c, i) => {
                  if (!isInBounds(c.q, c.r)) return null;
                  const { x, y } = hexToPixel(c.q, c.r);
                  return (
                    <g key={`cell-${i}-${c.q}-${c.r}`} transform={`translate(${x},${y})`}>
                      <polygon
                        points={HEX_POINTS}
                        fill={c.flashing ? "#fff" : c.color}
                        stroke={c.flashing ? "#fbbf24" : "rgba(0,0,0,0.15)"}
                        strokeWidth={c.flashing ? "2" : "1"}
                        opacity={c.active ? 0.95 : 1}
                      />
                      {/* Subtle highlight (gornji vrh) */}
                      <polygon
                        points={HEX_POINTS}
                        fill="url(#hexShine)"
                        opacity="0.35"
                      />
                    </g>
                  );
                })}

                <defs>
                  <linearGradient id="hexShine" x1="0" y1="-1" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                  </linearGradient>
                </defs>
              </svg>
              </div>

              {/* Combo poruka */}
              <AnimatePresence>
                {comboMsg && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0, y: 0 }}
                    animate={{ scale: 1.1, opacity: 1, y: -10 }}
                    exit={{ scale: 1, opacity: 0, y: -30 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    data-testid="combo-msg"
                  >
                    <span className="text-3xl font-black text-amber-600 drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)] bg-white/80 px-4 py-1.5 rounded-2xl border-2 border-amber-300">
                      {comboMsg}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* DESNA KOLONA — Desno + Spusti */}
            <div className="flex flex-col gap-2 sm:gap-3 justify-center shrink-0 w-14 sm:w-20">
              <ControlBtn onClick={() => moveHoriz(1)} testid="btn-sace-right" label={t("Desno")} tall>
                <ArrRight className="w-7 h-7 sm:w-8 sm:h-8" />
              </ControlBtn>
              <ControlBtn onClick={hardDrop} testid="btn-sace-drop" label={t("Spusti")} highlight tall>
                <ArrowDown className="w-7 h-7 sm:w-8 sm:h-8" />
              </ControlBtn>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            {t("Tipke: ← → pomjeri · ↑/Space rotiraj · ↓ ubrzaj · Enter spusti odmah")}
          </p>
        </>
      )}

      <AnimatePresence>
        {state === "ended" && finalScore !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-8 mt-6 bg-gradient-to-br from-amber-50 to-yellow-100/80 border-amber-300 text-center">
              <div className="flex justify-center mb-3">
                <span className="text-5xl" aria-hidden>🐝</span>
              </div>
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-black text-foreground mb-1">{t("Mašallah!")}</p>
              <p className="text-lg text-muted-foreground mb-2">
                {t("Rezultat: ")}<span className="font-black text-3xl text-amber-700" data-testid="text-final-score">{finalScore}</span>
              </p>
              <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
                {bestEver !== null && (
                  <p>
                    {t("Najbolji ikad: ")}<span className="font-bold text-foreground" data-testid="text-best-ever">{bestEver}</span>
                    {previousBest !== null && finalScore !== null && finalScore > previousBest && (
                      <span className="ml-2 text-emerald-600 font-bold">{t("novi rekord!")}</span>
                    )}
                  </p>
                )}
                {previousBest !== null && previousBest > 0 && (
                  <p>{t("Tvoj prethodni najbolji: ")}<span className="font-bold text-foreground">{previousBest}</span></p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {t("{linije} linija obrisano · level {level}", { linije: String(linesCleared), level: String(level) })}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => { setState("idle"); refetchCredits(); }} className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-white">
                  <RefreshCw className="w-4 h-4 mr-1" /> {t("Igraj opet")}
                </Button>
                <Button variant="outline" onClick={() => setLocation("/igrice/ljestvica")} className="rounded-2xl">
                  {t("Tabela")}
                </Button>
                <Link href="/igrice">
                  <Button variant="ghost" className="rounded-2xl">{t("Natrag na Igrice")}</Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

// =============================================================================
// HELPER KOMPONENTE
// =============================================================================

function ControlBtn({ onClick, children, testid, label, highlight, tall }: {
  onClick: () => void; children: React.ReactNode; testid: string; label: string; highlight?: boolean; tall?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      // onTouchStart prevent default da izbjegnemo "ghost click" delay na mobilnim
      onTouchStart={(e) => { e.preventDefault(); onClick(); }}
      className={`${tall ? "min-h-[88px] sm:min-h-[120px] flex-1 w-full" : "h-14"} rounded-2xl font-bold flex items-center justify-center transition-all active:scale-95 ${
        highlight
          ? "bg-amber-500 text-white shadow-md hover:bg-amber-600"
          : "bg-white border-2 border-amber-200 text-amber-700 hover:bg-amber-50"
      }`}
      data-testid={testid}
      aria-label={label}
    >
      {children}
    </button>
  );
}

// Mini preview sljedeće figure — nacrta hexove na malom SVG-u sa center-of-mass centriranim.
function NextPreview({ shape }: { shape: Shape }) {
  const cells = shape.cells;
  // Bounding box u pixel space-u
  const positions = cells.map(c => {
    const x = HEX_SIZE * 0.5 * 1.5 * c.q;
    const y = HEX_SIZE * 0.5 * SQRT3 * (c.r + c.q / 2);
    return { x, y };
  });
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX + HEX_SIZE;
  const h = maxY - minY + HEX_SIZE;
  const r = HEX_SIZE * 0.5;
  const miniPoints = (() => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i);
      pts.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(" ");
  })();
  return (
    <svg viewBox={`${minX - r} ${minY - r} ${w} ${h}`} width="36" height="36" data-testid="next-preview">
      {positions.map((p, i) => (
        <polygon
          key={i}
          points={miniPoints}
          transform={`translate(${p.x},${p.y})`}
          fill={shape.color}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}
