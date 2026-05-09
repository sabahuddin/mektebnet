import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Check, Lock, Medal, Sparkles, X, DoorOpen, DoorClosed } from "lucide-react";

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

// Layout: 5 kolona × 13 redova = 65 polja.
// Polja 1-64 su lekcije (snake/zmijoliki put), polje 65 = VRATA u Nivo 2.
// Medaljoni su odvojeni — prikazuju se u traci na vrhu (6 komada, svakih 10 lekcija).
const COLS = 5;
const TOTAL_CELLS = 65; // 64 lekcije + Vrata

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
  // Medaljoni iz baze, sortirani po posAfterRedoslijed (10, 20, 30, 40, 50, 60).
  // UI uvijek prikazuje 6 slotova; ako baza vrati manje, ostatak su placeholder-i.
  const medaljoniSorted = useMemo(
    () => [...(data?.medaljoni ?? [])].sort((a, b) => a.posAfterRedoslijed - b.posAfterRedoslijed),
    [data],
  );

  const zavrseneSet = useMemo(() => new Set(data?.zavrsene ?? []), [data]);
  const osvojeniSet = useMemo(() => new Set(data?.osvojeniMedaljoni ?? []), [data]);

  // Broj završenih lekcija — koristi se za otključavanje medaljona i Vrata.
  const completedCount = useMemo(() => {
    return lekcijeSorted.filter((l) => zavrseneSet.has(l.id)).length;
  }, [lekcijeSorted, zavrseneSet]);

  const allDone = lekcijeSorted.length > 0 && completedCount >= lekcijeSorted.length;

  // Indeks trenutnog polja u snake-u (prva nezavršena lekcija; ako su sve gotove → Vrata).
  const currentCellIndex = useMemo(() => {
    for (let i = 0; i < lekcijeSorted.length; i++) {
      if (!zavrseneSet.has(lekcijeSorted[i].id)) return i;
    }
    return TOTAL_CELLS - 1; // sve završeno → pčela na Vratima
  }, [lekcijeSorted, zavrseneSet]);

  // Pretvori linearni indeks u (row, col) u snake patternu.
  function rowColFor(i: number): { row: number; col: number } {
    const row = Math.floor(i / COLS);
    const within = i % COLS;
    const col = row % 2 === 0 ? within : COLS - 1 - within;
    return { row, col };
  }
  const totalRows = Math.ceil(TOTAL_CELLS / COLS); // 13

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-amber-100 flex items-center justify-center z-50">
        <div className="text-amber-800 font-bold">Učitavam mapu…</div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto"
      style={{
        backgroundImage: "url('/images/mapa/honey-board.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#fde68a",
      }}
      data-testid="mapa-fullscreen"
    >
      {/* X za izlaz */}
      <button
        onClick={() => setLocation("/ilmihal")}
        className="fixed top-3 right-3 z-[60] w-11 h-11 rounded-full bg-white/95 hover:bg-white shadow-lg flex items-center justify-center text-amber-900 active:scale-95 transition"
        data-testid="button-close-mapa"
        aria-label="Zatvori mapu"
      >
        <X className="w-6 h-6" strokeWidth={3} />
      </button>

      {/* Brojač progresa */}
      <div
        className="fixed top-3 left-3 z-[60] px-3 py-2 rounded-full bg-white/95 shadow-lg text-sm font-extrabold text-amber-900"
        data-testid="mapa-progress"
      >
        {completedCount}/{lekcijeSorted.length}
        {osvojeniSet.size > 0 && <span className="ml-2 text-amber-700">· {osvojeniSet.size}🏅</span>}
      </div>

      {/* CENTRALNA KOLONA — uska, ostavlja prostor desno/lijevo za honey pozadinu na PC.
          max-w-sm = 384px; na mobilnom popunjava ekran sa malo padding-a. */}
      <div className="relative mx-auto max-w-sm px-3 pt-16 pb-6">
        {/* Traka medaljona na vrhu (6 slotova). */}
        <MedaljonStrip
          medaljoni={medaljoniSorted}
          osvojeniSet={osvojeniSet}
          completedCount={completedCount}
          onClickMedaljon={(slug) => setLocation(`/medaljon/${slug}`)}
        />

        {/* Snake board: 5 kolona × 13 redova. Visina raste sa brojem redova. */}
        <div className="relative mt-4">
          <PathSvg totalRows={totalRows} rowColFor={rowColFor} />
          <div
            className="relative grid items-center"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${totalRows}, minmax(54px, 1fr))`,
            }}
          >
            {Array.from({ length: TOTAL_CELLS }).map((_, i) => {
              const { row, col } = rowColFor(i);
              const isCurrent = i === currentCellIndex;
              const isLast = i === TOTAL_CELLS - 1;

              if (isLast) {
                // VRATA — zadnje polje
                return (
                  <button
                    key="vrata"
                    onClick={() => allDone && setLocation("/nivo2")}
                    disabled={!allDone}
                    className="relative flex items-center justify-center"
                    style={{ gridRow: row + 1, gridColumn: col + 1 }}
                    data-testid="mapa-polje-vrata"
                    title={allDone ? "Vrata u Nivo 2" : "Završi sve lekcije da otključaš"}
                  >
                    <div className="relative">
                      {isCurrent && allDone && (
                        <span className="absolute inset-0 rounded-2xl bg-amber-300 animate-ping opacity-70" />
                      )}
                      <div
                        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                          allDone
                            ? "bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 ring-4 ring-amber-700/50 animate-pulse"
                            : "bg-gray-300 ring-2 ring-gray-400 opacity-80 cursor-not-allowed"
                        }`}
                      >
                        {allDone ? (
                          <DoorOpen className="w-8 h-8 text-amber-900" strokeWidth={2.5} />
                        ) : (
                          <DoorClosed className="w-8 h-8 text-gray-600" strokeWidth={2} />
                        )}
                      </div>
                    </div>
                  </button>
                );
              }

              // Obična lekcija
              const lekcija = lekcijeSorted[i];
              if (!lekcija) {
                // Manje od 64 lekcija u bazi — prazan slot
                return (
                  <div
                    key={`empty-${i}`}
                    style={{ gridRow: row + 1, gridColumn: col + 1 }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-11 h-11 rounded-full bg-amber-200/40 ring-2 ring-amber-700/20" />
                  </div>
                );
              }
              const isDone = zavrseneSet.has(lekcija.id);
              const lekcijaBroj = i + 1;
              return (
                <button
                  key={`l-${lekcija.id}`}
                  onClick={() => setLocation(`/ilmihal/${lekcija.slug}`)}
                  className="relative flex items-center justify-center"
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  data-testid={`mapa-polje-lekcija-${lekcija.id}`}
                  title={lekcija.naslov}
                >
                  <div className="relative">
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-70" />
                    )}
                    <div
                      className={`relative w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-base shadow-md transition-transform active:scale-95 hover:scale-110 ${
                        isDone
                          ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900 ring-2 ring-amber-700/40"
                          : isCurrent
                            ? "bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-900 ring-4 ring-white"
                            : "bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 ring-2 ring-amber-700/30"
                      }`}
                    >
                      {isDone ? <Check className="w-5 h-5" strokeWidth={3} /> : lekcijaBroj}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pčela */}
          {currentCellIndex >= 0 && (
            <BeeOnGrid currentIndex={currentCellIndex} totalRows={totalRows} rowColFor={rowColFor} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Traka 6 medaljona na vrhu ─────────────────────────────────────────────
function MedaljonStrip({
  medaljoni,
  osvojeniSet,
  completedCount,
  onClickMedaljon,
}: {
  medaljoni: Medaljon[];
  osvojeniSet: Set<number>;
  completedCount: number;
  onClickMedaljon: (slug: string) => void;
}) {
  // Uvijek 6 slotova; fallback nazivi ako baza nije migrirana
  const slots = Array.from({ length: 6 }).map((_, i) => {
    return medaljoni[i] ?? null;
  });
  return (
    <div
      className="flex items-center justify-between gap-1 px-2 py-2 rounded-2xl bg-white/70 backdrop-blur shadow-md"
      data-testid="mapa-medaljon-strip"
    >
      {slots.map((m, i) => {
        const requiredCount = (i + 1) * 10;
        const unlocked = m ? completedCount >= m.posAfterRedoslijed : completedCount >= requiredCount;
        const earned = m ? osvojeniSet.has(m.id) : false;
        return (
          <button
            key={m?.id ?? `slot-${i}`}
            onClick={() => m && unlocked && onClickMedaljon(m.slug)}
            disabled={!m || !unlocked}
            className="relative flex flex-col items-center justify-center"
            data-testid={`mapa-medaljon-top-${i + 1}`}
            title={m ? `${m.naziv} (${m.posAfterRedoslijed} lekcija)` : `Otključava se na ${requiredCount} lekcija`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow transition-transform ${
                earned
                  ? "bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 ring-2 ring-white shadow-amber-500/60 hover:scale-110"
                  : unlocked
                    ? "bg-gradient-to-br from-amber-300 to-orange-400 ring-2 ring-amber-700/40 hover:scale-110 active:scale-95"
                    : "bg-gray-300 ring-2 ring-gray-400 opacity-80"
              }`}
            >
              {earned ? (
                <Sparkles className="w-5 h-5 text-white drop-shadow" strokeWidth={2.5} />
              ) : unlocked ? (
                <Medal className="w-5 h-5 text-white drop-shadow" strokeWidth={2.5} />
              ) : (
                <Lock className="w-4 h-4 text-gray-600" />
              )}
            </div>
            <span className="text-[10px] font-bold text-amber-900 mt-0.5">
              {(i + 1) * 10}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SVG put između polja u snake patternu ─────────────────────────────────
function PathSvg({
  totalRows,
  rowColFor,
}: {
  totalRows: number;
  rowColFor: (i: number) => { row: number; col: number };
}) {
  const points: string[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const { row, col } = rowColFor(i);
    const xPct = ((col + 0.5) / COLS) * 100;
    const yPct = ((row + 0.5) / Math.max(totalRows, 1)) * 100;
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
        stroke="rgba(180, 83, 9, 0.5)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.9 1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Pčela — leti na trenutnu lekciju ──────────────────────────────────────
function BeeOnGrid({
  currentIndex,
  totalRows,
  rowColFor,
}: {
  currentIndex: number;
  totalRows: number;
  rowColFor: (i: number) => { row: number; col: number };
}) {
  const { row, col } = rowColFor(currentIndex);
  const xPct = ((col + 0.5) / COLS) * 100;
  const yPct = ((row + 0.5) / Math.max(totalRows, 1)) * 100;
  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      initial={false}
      animate={{
        left: `${xPct}%`,
        top: `${yPct}%`,
      }}
      transition={{ type: "spring", stiffness: 60, damping: 14 }}
      style={{ transform: "translate(-50%, -130%)" }}
      data-testid="mapa-pcela"
    >
      <motion.div
        animate={{ y: [0, -6, 0, -3, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
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
