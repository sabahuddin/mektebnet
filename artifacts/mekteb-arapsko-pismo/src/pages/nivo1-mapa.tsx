import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Check, Lock, Medal, Sparkles, X } from "lucide-react";

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

type PathItem =
  | { kind: "lekcija"; lekcija: Lekcija; brojUListi: number }
  | { kind: "medaljon"; medaljon: Medaljon };

// Serpentine layout: ITEMS_PER_ROW po redu, parni redovi lijevo→desno,
// neparni desno→lijevo. Sa 64 lekcije + 5 medaljona = 69 polja, 10 po
// redu daje 7 redova — sve stane na jedan ekran (uz mali scroll na nižim
// telefonima).
const ITEMS_PER_ROW = 10;

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

  // Spojena lista (lekcije + medaljoni inline po posAfterRedoslijed).
  const path: PathItem[] = useMemo(() => {
    if (!data) return [];
    const lekcije = [...data.lekcije].sort((a, b) => a.redoslijed - b.redoslijed);
    const medQueue = [...data.medaljoni].sort((a, b) => a.posAfterRedoslijed - b.posAfterRedoslijed);
    const out: PathItem[] = [];
    let brojUListi = 0;
    for (const l of lekcije) {
      brojUListi++;
      out.push({ kind: "lekcija", lekcija: l, brojUListi });
      while (medQueue.length > 0 && l.redoslijed >= medQueue[0].posAfterRedoslijed) {
        out.push({ kind: "medaljon", medaljon: medQueue.shift()! });
      }
    }
    for (const m of medQueue) out.push({ kind: "medaljon", medaljon: m });
    return out;
  }, [data]);

  const zavrseneSet = useMemo(() => new Set(data?.zavrsene ?? []), [data]);
  const osvojeniSet = useMemo(() => new Set(data?.osvojeniMedaljoni ?? []), [data]);

  // Indeks "trenutnog" polja (prva nezavršena lekcija ili dostupan neosvojen
  // medaljon). Pčela leti tu.
  const currentIndex = useMemo(() => {
    for (let i = 0; i < path.length; i++) {
      const it = path[i];
      if (it.kind === "lekcija" && !zavrseneSet.has(it.lekcija.id)) return i;
      if (it.kind === "medaljon" && !osvojeniSet.has(it.medaljon.id)) {
        if (zavrseneSet.size >= it.medaljon.posAfterRedoslijed) return i;
      }
    }
    return -1;
  }, [path, zavrseneSet, osvojeniSet]);

  // Pretvori linearni indeks u (row, col) sa serpentine smjerom.
  function rowColFor(i: number): { row: number; col: number } {
    const row = Math.floor(i / ITEMS_PER_ROW);
    const within = i % ITEMS_PER_ROW;
    const col = row % 2 === 0 ? within : ITEMS_PER_ROW - 1 - within;
    return { row, col };
  }

  const totalRows = Math.ceil(path.length / ITEMS_PER_ROW);

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
      {/* X za izlaz — sticky u gornjem desnom ćošku */}
      <button
        onClick={() => setLocation("/ilmihal")}
        className="fixed top-3 right-3 z-[60] w-11 h-11 rounded-full bg-white/95 hover:bg-white shadow-lg flex items-center justify-center text-amber-900 active:scale-95 transition"
        data-testid="button-close-mapa"
        aria-label="Zatvori mapu"
      >
        <X className="w-6 h-6" strokeWidth={3} />
      </button>

      {/* Brojač progresa — sticky u gornjem lijevom ćošku */}
      <div
        className="fixed top-3 left-3 z-[60] px-3 py-2 rounded-full bg-white/95 shadow-lg text-sm font-extrabold text-amber-900"
        data-testid="mapa-progress"
      >
        {zavrseneSet.size}/{data?.lekcije.length ?? 0}
        {osvojeniSet.size > 0 && <span className="ml-2 text-amber-700">· {osvojeniSet.size}🏅</span>}
      </div>

      {/* Polje sa svim lekcijama + medaljonima u serpentine gridu.
          Grid se RASTEŽE na cijelu visinu ekrana (minus top bar), kako bi
          polja bila ravnomjerno raspoređena po cijelom ekranu. SVG povezuje
          krugove tankom linijom da ostavi utisak puta. */}
      <div
        className="relative w-full max-w-5xl mx-auto px-3 pt-20 pb-6"
        style={{ minHeight: "100vh" }}
      >
        {/* SVG put između krugova (ispod krugova, iznad pozadine) */}
        <PathSvg path={path} totalRows={totalRows} rowColFor={rowColFor} />

        {/* Grid sa krugovima — visina jednaka kontejneru minus padding */}
        <div
          className="relative grid items-center"
          style={{
            gridTemplateColumns: `repeat(${ITEMS_PER_ROW}, 1fr)`,
            gridTemplateRows: `repeat(${totalRows}, 1fr)`,
            minHeight: "calc(100vh - 7rem)",
          }}
        >
          {path.map((item, i) => {
            const { row, col } = rowColFor(i);
            const isCurrent = i === currentIndex;

            if (item.kind === "lekcija") {
              const l = item.lekcija;
              const isDone = zavrseneSet.has(l.id);
              return (
                <button
                  key={`l-${l.id}`}
                  onClick={() => setLocation(`/ilmihal/${l.slug}`)}
                  className="relative flex items-center justify-center"
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  data-testid={`mapa-polje-lekcija-${l.id}`}
                  title={l.naslov}
                >
                  <div className="relative">
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-70" />
                    )}
                    <div
                      className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-extrabold text-sm sm:text-base shadow-md transition-transform active:scale-95 hover:scale-110 ${
                        isDone
                          ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900 ring-2 ring-amber-700/40"
                          : isCurrent
                            ? "bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-900 ring-2 ring-white"
                            : "bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 ring-2 ring-amber-700/30"
                      }`}
                    >
                      {isDone ? <Check className="w-5 h-5" strokeWidth={3} /> : item.brojUListi}
                    </div>
                  </div>
                </button>
              );
            }

            // MEDALJON — nešto veći, drugačijih boja
            const m = item.medaljon;
            const earned = osvojeniSet.has(m.id);
            const unlocked = zavrseneSet.size >= m.posAfterRedoslijed;
            return (
              <button
                key={`m-${m.id}`}
                onClick={() => setLocation(`/medaljon/${m.slug}`)}
                className="relative flex items-center justify-center"
                style={{ gridRow: row + 1, gridColumn: col + 1 }}
                data-testid={`mapa-polje-medaljon-${m.slug}`}
                title={m.naziv}
              >
                <div className="relative">
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-70" />
                  )}
                  <div
                    className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 hover:scale-110 ${
                      earned
                        ? "bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 ring-2 ring-white shadow-amber-500/60"
                        : unlocked
                          ? "bg-gradient-to-br from-amber-300 to-orange-400 ring-2 ring-amber-700/40"
                          : "bg-gray-300 ring-2 ring-gray-400 opacity-80"
                    }`}
                  >
                    {earned ? (
                      <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow" strokeWidth={2.5} />
                    ) : unlocked ? (
                      <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow" strokeWidth={2.5} />
                    ) : (
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pčela na trenutnom polju */}
        {currentIndex >= 0 && <BeeOnGrid path={path} currentIndex={currentIndex} rowColFor={rowColFor} />}
      </div>
    </div>
  );
}

// SVG put — povezuje centre svih polja jednom linijom (serpentine).
function PathSvg({
  path,
  totalRows,
  rowColFor,
}: {
  path: PathItem[];
  totalRows: number;
  rowColFor: (i: number) => { row: number; col: number };
}) {
  if (path.length < 2) return null;
  // Koristimo procente — grid je responzivan, pa SVG isto.
  const points: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const { row, col } = rowColFor(i);
    const xPct = ((col + 0.5) / ITEMS_PER_ROW) * 100;
    const yPct = ((row + 0.5) / Math.max(totalRows, 1)) * 100;
    points.push(`${xPct},${yPct}`);
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ top: "5rem", height: "calc(100% - 5rem - 1.5rem)" }}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(180, 83, 9, 0.45)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.8 1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Pčela animacija — fixed na poziciji trenutnog polja u gridu.
function BeeOnGrid({
  path,
  currentIndex,
  rowColFor,
}: {
  path: PathItem[];
  currentIndex: number;
  rowColFor: (i: number) => { row: number; col: number };
}) {
  const totalRows = Math.ceil(path.length / ITEMS_PER_ROW);
  const { row, col } = rowColFor(currentIndex);
  const xPct = ((col + 0.5) / ITEMS_PER_ROW) * 100;
  const yFrac = (row + 0.5) / Math.max(totalRows, 1);
  // Pčela ide iznad trenutnog polja u gridu. Grid je raspoređen po visini
  // (5rem top padding + ostatak), pa pomjeramo pčelu po istoj formuli.
  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      initial={false}
      animate={{
        left: `${xPct}%`,
        top: `calc(5rem + (100vh - 7rem) * ${yFrac} - 28px)`,
      }}
      transition={{ type: "spring", stiffness: 60, damping: 14 }}
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
