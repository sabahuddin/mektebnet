import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Check, Sparkles, X } from "lucide-react";

interface Lekcija {
  id: number;
  slug: string;
  naslov: string;
  redoslijed: number;
}
interface Medaljon {
  id: number;
  slug: string;
  naziv: string;
  opis: string;
  posAfterRedoslijed: number;
  ikona: string;
  boja: string;
}
interface MapaData {
  lekcije: Lekcija[];
  medaljoni: Medaljon[];
  zavrsene: number[];
  osvojeniMedaljoni: number[];
}

// Layout: 5 kolona × 13 lekcijskih redova snake (bottom-up) + 1 zaseban red za Vrata na vrhu.
//   - logički red 0 = lekcije 1-5 (DONJI red ekrana)
//   - logički red 12 = lekcije 61-64 (jedan slot prazan) — pretposljednji red
//   - displayRow 0 = Vrata, sami u svom redu na samom vrhu
// Učenik kreće odozdo i napreduje prema vrhu (kao penjanje).
const COLS = 5;
const TOTAL_CELLS = 64; // 64 lekcije; Vrata su zaseban element
const LESSON_ROWS = Math.ceil(TOTAL_CELLS / COLS); // 13
const TOTAL_ROWS = LESSON_ROWS; // 13: vrata zauzimaju prazno mjesto u zadnjem redu
const REQUIRED_FOR_DOOR = 64;

export default function Nivo1MapaPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<MapaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<MapaData>("GET", `/mapa/nivo1`, undefined, token || undefined)
      .then(setData)
      .catch(() => setData({ lekcije: [], medaljoni: [], zavrsene: [], osvojeniMedaljoni: [] }))
      .finally(() => setIsLoading(false));
  }, [token]);

  const lekcijeSorted = useMemo(
    () => [...(data?.lekcije ?? [])].sort((a, b) => a.redoslijed - b.redoslijed),
    [data],
  );
  const medaljoniSorted = useMemo(
    () => [...(data?.medaljoni ?? [])].sort((a, b) => a.posAfterRedoslijed - b.posAfterRedoslijed),
    [data],
  );
  const zavrseneSet = useMemo(() => new Set(data?.zavrsene ?? []), [data]);
  const osvojeniSet = useMemo(() => new Set(data?.osvojeniMedaljoni ?? []), [data]);

  const completedCount = useMemo(
    () => lekcijeSorted.filter((l) => zavrseneSet.has(l.id)).length,
    [lekcijeSorted, zavrseneSet],
  );
  const allDone = completedCount >= REQUIRED_FOR_DOOR;

  // Trenutni cell (linearni indeks 0..63, gdje je 0 = lekcija 1).
  // Ako su sve lekcije završene, vraća -1 (pčela je "izašla kroz vrata").
  const currentCellIndex = useMemo(() => {
    for (let i = 0; i < lekcijeSorted.length; i++) {
      if (!zavrseneSet.has(lekcijeSorted[i].id)) return i;
    }
    return -1;
  }, [lekcijeSorted, zavrseneSet]);

  const currentLogicalRow = currentCellIndex < 0
    ? LESSON_ROWS - 1
    : Math.floor(currentCellIndex / COLS);
  // Otključavanje po MEDALJONIMA (blokovi po 10 lekcija):
  //   - Start: 1-10 otključano (žuto), čeka se 1. medaljon (na 10 lekcija).
  //   - Kad se osvoji 1. medaljon (completed=10): otključa se 11-20.
  //   - Kad se osvoji 2. medaljon (completed=20): otključa se 21-30.
  //   - ... i tako dalje, do 61-64 nakon 6. medaljona.
  // Sve preko ove granice je zaključano (sivo), ali vidljivo skrolovanjem.
  const unlockedCellCount = Math.min(
    TOTAL_CELLS,
    Math.floor(completedCount / 10) * 10 + 10,
  );

  // Snake mapping: logički indeks → (logicalRow, col).
  function rowColFor(i: number): { logicalRow: number; col: number } {
    const logicalRow = Math.floor(i / COLS);
    const within = i % COLS;
    const col = logicalRow % 2 === 0 ? within : COLS - 1 - within;
    return { logicalRow, col };
  }
  // Bottom-up render: logički red 0 (lekcija 1) ide na DNO grida.
  // Lekcije popunjavaju displayRows 1..13; displayRow 0 (vrh) je rezervisan za Vrata.
  function displayRowFor(logicalRow: number): number {
    return TOTAL_ROWS - 1 - logicalRow;
  }

  // Auto-scroll do trenutne lekcije (kad se data učita)
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector(
        `[data-cell-index="${currentCellIndex}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [data, currentCellIndex]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-amber-100 flex items-center justify-center z-50">
        <div className="text-amber-800 font-bold">Učitavam mapu…</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-auto mapa-honey-bg"
      style={{ backgroundColor: "#FDE68A" }}
      data-testid="mapa-fullscreen"
    >
      {/* TOP BAR — counter (lijevo), 6 medaljona (sredina), X (desno) — sve sticky */}
      <div className="sticky top-0 z-[60] flex items-center gap-2 px-2 sm:px-4 py-2 bg-gradient-to-b from-amber-100/95 via-amber-50/85 to-transparent backdrop-blur-sm">
        <div
          className="flex-shrink-0 px-2.5 py-1.5 rounded-full bg-white shadow text-xs sm:text-base font-extrabold text-amber-900 whitespace-nowrap"
          data-testid="mapa-progress"
        >
          {completedCount}/{lekcijeSorted.length || 64}
        </div>

        <div className="flex-1 flex items-center justify-center gap-0.5 sm:gap-2">
          {Array.from({ length: 6 }).map((_, i) => {
            const m = medaljoniSorted[i] ?? null;
            const required = (i + 1) * 10;
            const unlocked = m
              ? completedCount >= m.posAfterRedoslijed
              : completedCount >= required;
            const earned = m ? osvojeniSet.has(m.id) : false;
            return (
              <MedaljonHex
                key={m?.id ?? `slot-${i}`}
                broj={required}
                state={earned ? "earned" : unlocked ? "unlocked" : "locked"}
                onClick={() => m && unlocked && setLocation(`/medaljon/${m.slug}`)}
                title={
                  m
                    ? `${m.naziv} — ${required} lekcija`
                    : `Otključava se na ${required} lekcija`
                }
                testId={`mapa-medaljon-top-${i + 1}`}
              />
            );
          })}
        </div>

        <button
          onClick={() => setLocation("/ilmihal")}
          className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white hover:bg-amber-50 shadow flex items-center justify-center text-amber-900 active:scale-95 transition"
          data-testid="button-close-mapa"
          aria-label="Zatvori mapu"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
        </button>
      </div>

      {/* BOARD: centralna kolona — uska na mobilnom, šira na desktopu.
          Visina se rasteže da popuni cijeli ekran kad ima mjesta (desktop),
          ili raste sa redovima kad ih ima više nego ekran može da prikaže. */}
      <div
        className="relative mx-auto max-w-sm sm:max-w-md md:max-w-xl px-3 pt-2 pb-4 flex flex-col"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        <div className="relative flex-1 flex flex-col">
          <PathSvg
            rowColFor={rowColFor}
            displayRowFor={displayRowFor}
          />
          <div
            className="relative grid items-center flex-1"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${TOTAL_ROWS}, minmax(96px, 1fr))`,
              minHeight: `${TOTAL_ROWS * 100}px`,
            }}
          >
            {/* Vrata: zauzimaju prazno 5. mjesto u zadnjem redu, odmah desno od lekcije 64.
                Iste veličine kao i krugovi lekcija. */}
            <button
              key="vrata"
              data-cell-index="door"
              onClick={() => allDone && setLocation("/nivo2")}
              disabled={!allDone}
              className="relative flex items-center justify-center disabled:cursor-not-allowed"
              style={{ gridRow: 1, gridColumn: COLS }}
              data-testid="mapa-polje-vrata"
              title={allDone ? "Vrata u Nivo 2" : "Završi sve lekcije da otključaš"}
            >
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 transition-transform active:scale-95 hover:scale-105">
                {allDone && (
                  <span className="absolute inset-0 rounded-full bg-amber-300/50 animate-ping" />
                )}
                <img
                  src={
                    allDone
                      ? "/images/mapa/vrata-otvorena.png"
                      : "/images/mapa/vrata-zatvorena.png"
                  }
                  alt={allDone ? "Vrata u Nivo 2 — otvorena" : "Vrata u Nivo 2 — zaključana"}
                  className={`relative w-full h-full object-contain drop-shadow-md ${
                    allDone ? "animate-pulse" : "opacity-80 grayscale-[40%]"
                  }`}
                />
              </div>
            </button>

            {Array.from({ length: TOTAL_CELLS }).map((_, i) => {
              const { logicalRow, col } = rowColFor(i);
              const displayRow = displayRowFor(logicalRow);
              const isCurrent = i === currentCellIndex;
              const isLocked = i >= unlockedCellCount;

              const lekcija = lekcijeSorted[i];
              if (!lekcija) {
                return (
                  <div
                    key={`empty-${i}`}
                    data-cell-index={i}
                    style={{ gridRow: displayRow + 1, gridColumn: col + 1 }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-300 ring-2 ring-gray-600" />
                  </div>
                );
              }
              const isDone = zavrseneSet.has(lekcija.id);
              return (
                <button
                  key={`l-${lekcija.id}`}
                  data-cell-index={i}
                  onClick={() => !isLocked && setLocation(`/ilmihal/${lekcija.slug}`)}
                  disabled={isLocked && !isDone}
                  className="relative flex items-center justify-center disabled:cursor-not-allowed"
                  style={{ gridRow: displayRow + 1, gridColumn: col + 1 }}
                  data-testid={`mapa-polje-lekcija-${lekcija.id}`}
                  title={isLocked ? `Zaključano — završi prethodne lekcije` : lekcija.naslov}
                >
                  <div className="relative">
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-70" />
                    )}
                    <div
                      className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-extrabold text-base sm:text-xl shadow-md transition-transform ${
                        isDone
                          ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900 ring-2 ring-amber-700/40 active:scale-95 hover:scale-110"
                          : isCurrent
                            ? "bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-900 ring-4 ring-white active:scale-95 hover:scale-110"
                            : isLocked
                              ? "bg-gray-300 text-gray-700 ring-2 ring-gray-600"
                              : "bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 ring-2 ring-amber-700/30 active:scale-95 hover:scale-110"
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-5 h-5 sm:w-7 sm:h-7" strokeWidth={3} />
                      ) : (
                        i + 1
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {currentCellIndex >= 0 && (
            <BeeOnGrid
              currentIndex={currentCellIndex}
              rowColFor={rowColFor}
              displayRowFor={displayRowFor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Heksagonalni medaljon (bee/honey tema) ──────────────────────────────
function MedaljonHex({
  broj,
  state,
  onClick,
  title,
  testId,
}: {
  broj: number;
  state: "locked" | "unlocked" | "earned";
  onClick: () => void;
  title: string;
  testId: string;
}) {
  const gradId = `hex-grad-${broj}-${state}`;
  return (
    <button
      onClick={onClick}
      disabled={state === "locked"}
      title={title}
      className="relative flex items-center justify-center group disabled:cursor-not-allowed"
      data-testid={testId}
    >
      <svg
        viewBox="0 0 100 110"
        className={`w-9 h-10 sm:w-12 sm:h-14 transition-transform drop-shadow ${
          state !== "locked" ? "group-hover:scale-110 group-active:scale-95" : ""
        }`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            {state === "earned" ? (
              <>
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="40%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#a16207" />
              </>
            ) : state === "unlocked" ? (
              <>
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#e5e7eb" />
                <stop offset="100%" stopColor="#6b7280" />
              </>
            )}
          </linearGradient>
        </defs>
        {/* Vanjski heksagon (zlatni ram) */}
        <polygon
          points="50,4 92,28 92,77 50,101 8,77 8,28"
          fill={`url(#${gradId})`}
          stroke={state === "locked" ? "#374151" : "#78350f"}
          strokeWidth="3"
        />
        {/* Unutrašnji heksagon (medeno polje) */}
        <polygon
          points="50,18 80,33 80,72 50,87 20,72 20,33"
          fill={
            state === "earned"
              ? "#fef3c7"
              : state === "unlocked"
                ? "#fde68a"
                : "#9ca3af"
          }
          stroke={state === "locked" ? "#4b5563" : "#b45309"}
          strokeWidth="1.5"
        />
        {/* Broj ili upitnik */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontWeight="900"
          fontSize="32"
          fill={state === "locked" ? "#374151" : "#78350f"}
          fontFamily="system-ui, sans-serif"
        >
          {state === "locked" ? "?" : broj}
        </text>
      </svg>
      {state === "earned" && (
        <Sparkles className="absolute -top-1 -right-0 w-3 h-3 sm:w-4 sm:h-4 text-yellow-200 drop-shadow animate-pulse" />
      )}
    </button>
  );
}

// ─── Snake path (bottom-up) ──────────────────────────────────────────────
function PathSvg({
  rowColFor,
  displayRowFor,
}: {
  rowColFor: (i: number) => { logicalRow: number; col: number };
  displayRowFor: (lr: number) => number;
}) {
  const points: string[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const { logicalRow, col } = rowColFor(i);
    const displayRow = displayRowFor(logicalRow);
    const xPct = ((col + 0.5) / COLS) * 100;
    const yPct = ((displayRow + 0.5) / TOTAL_ROWS) * 100;
    points.push(`${xPct},${yPct}`);
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(255, 255, 255, 0.55)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.9 1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Pčela ───────────────────────────────────────────────────────────────
function BeeOnGrid({
  currentIndex,
  rowColFor,
  displayRowFor,
}: {
  currentIndex: number;
  rowColFor: (i: number) => { logicalRow: number; col: number };
  displayRowFor: (lr: number) => number;
}) {
  const { logicalRow, col } = rowColFor(currentIndex);
  const displayRow = displayRowFor(logicalRow);
  const xPct = ((col + 0.5) / COLS) * 100;
  const yPct = ((displayRow + 0.5) / TOTAL_ROWS) * 100;
  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      initial={false}
      animate={{ left: `${xPct}%`, top: `${yPct}%` }}
      transition={{ type: "spring", stiffness: 60, damping: 14 }}
      style={{ transform: "translate(-50%, -130%)" }}
      data-testid="mapa-pcela"
    >
      <motion.div
        animate={{ y: [0, -6, 0, -3, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
          <ellipse cx="14" cy="18" rx="9" ry="6" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.2)" />
          <ellipse cx="34" cy="18" rx="9" ry="6" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.2)" />
          <ellipse cx="24" cy="26" rx="11" ry="9" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          <rect x="14" y="22" width="20" height="3" fill="#78350f" />
          <rect x="14" y="28" width="20" height="3" fill="#78350f" />
          <circle cx="35" cy="24" r="4" fill="#78350f" />
          <circle cx="36" cy="23" r="1" fill="#fff" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
