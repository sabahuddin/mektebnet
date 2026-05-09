import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Lock, Medal, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

interface Segment {
  index: number;
  items: PathItem[];
  medaljon: Medaljon;
  background: string;
}

const FIELD_GAP_PX = 130;
const SERP_CENTER = 50;

// Mapiranje segmenata na pozadinske slike. Slike su placeholder dok ne
// generišemo 5 različitih scena — koristimo postojeću tile-meadow za sve.
// Ključ je slug medaljona kojim segment završava.
const SEGMENT_BACKGROUNDS: Record<string, string> = {
  "prvi-koraci": "/images/mapa/tile-meadow.png",
  "putnik": "/images/mapa/tile-meadow.png",
  "polovina-puta": "/images/mapa/tile-meadow.png",
  "ustrajni": "/images/mapa/tile-meadow.png",
  "prva-kosnica": "/images/mapa/tile-meadow.png",
};

function leftPercentFor(_index: number): number {
  return SERP_CENTER;
}

export default function Nivo1MapaPage() {
  const { token } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ segment?: string }>("/nivo1-mapa/:segment?");
  const [data, setData] = useState<MapaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiRequest<MapaData>("GET", `/mapa/nivo1`, undefined, token || undefined)
      .then(setData)
      .catch(() => setData({ lekcije: [], medaljoni: [], zavrsene: [], osvojeniMedaljoni: [] }))
      .finally(() => setIsLoading(false));
  }, [token]);

  // Cijela putanja (svi segmenti zajedno) — koristi se za "trenutni" izračun.
  const fullPath: PathItem[] = useMemo(() => {
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

  // Podijeli putanju u segmente — svaki segment završava medaljonom.
  // Lekcije nakon zadnjeg medaljona (ako postoje) idu u "rep" zadnjeg segmenta.
  const segments: Segment[] = useMemo(() => {
    if (fullPath.length === 0) return [];
    const segs: Segment[] = [];
    let buf: PathItem[] = [];
    for (const it of fullPath) {
      buf.push(it);
      if (it.kind === "medaljon") {
        segs.push({
          index: segs.length,
          items: buf,
          medaljon: it.medaljon,
          background: SEGMENT_BACKGROUNDS[it.medaljon.slug] ?? "/images/mapa/tile-meadow.png",
        });
        buf = [];
      }
    }
    // Ako su ostale lekcije bez medaljona na kraju, prikači ih posljednjem segmentu.
    if (buf.length > 0 && segs.length > 0) {
      segs[segs.length - 1].items.push(...buf);
    }
    return segs;
  }, [fullPath]);

  const zavrseneSet = useMemo(() => new Set(data?.zavrsene ?? []), [data]);
  const osvojeniSet = useMemo(() => new Set(data?.osvojeniMedaljoni ?? []), [data]);

  // Indeks segmenta u kojem je trenutni napredak (prva nezavršena lekcija
  // ili prvi neosvojeni dostupni medaljon). Default: 0.
  const currentSegmentIndex = useMemo(() => {
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      // Segment je "trenutni" ako medaljon na kraju nije osvojen.
      if (!osvojeniSet.has(seg.medaljon.id)) return s;
    }
    return Math.max(0, segments.length - 1);
  }, [segments, osvojeniSet]);

  // Aktivni segment iz URL-a, fallback na trenutni.
  const activeSegmentIndex = useMemo(() => {
    if (!params?.segment) return currentSegmentIndex;
    const n = parseInt(params.segment, 10) - 1;
    if (Number.isNaN(n) || n < 0 || n >= segments.length) return currentSegmentIndex;
    return n;
  }, [params, segments.length, currentSegmentIndex]);

  const activeSegment = segments[activeSegmentIndex];

  // Otključan segment = svi prethodni medaljoni osvojeni (ili je to prvi).
  function isSegmentUnlocked(segIdx: number): boolean {
    if (segIdx === 0) return true;
    for (let s = 0; s < segIdx; s++) {
      if (!osvojeniSet.has(segments[s].medaljon.id)) return false;
    }
    return true;
  }

  // "Trenutni" indeks UNUTAR aktivnog segmenta (za pčelu i pulse).
  const currentItemIndexInSegment = useMemo(() => {
    if (!activeSegment) return -1;
    for (let i = 0; i < activeSegment.items.length; i++) {
      const it = activeSegment.items[i];
      if (it.kind === "lekcija" && !zavrseneSet.has(it.lekcija.id)) return i;
      if (it.kind === "medaljon" && !osvojeniSet.has(it.medaljon.id)) {
        const sveZavrsene = zavrseneSet.size >= it.medaljon.posAfterRedoslijed;
        if (sveZavrsene) return i;
      }
    }
    return -1;
  }, [activeSegment, zavrseneSet, osvojeniSet]);

  const containerHeight = activeSegment
    ? (activeSegment.items.length + 2) * FIELD_GAP_PX
    : 400;

  // Auto-scroll na trenutno polje kad se aktivni segment učita.
  useEffect(() => {
    if (currentItemIndexInSegment < 0 || !containerRef.current) return;
    const fromBottomPx = (currentItemIndexInSegment + 1) * FIELD_GAP_PX;
    const targetTop = containerHeight - fromBottomPx - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [currentItemIndexInSegment, containerHeight, activeSegmentIndex]);

  const medaljonBoje: Record<string, { bg: string; ring: string; glow: string }> = {
    emerald: { bg: "from-emerald-300 to-emerald-500", ring: "ring-emerald-200", glow: "shadow-emerald-400/50" },
    sky:     { bg: "from-sky-300 to-sky-500",         ring: "ring-sky-200",     glow: "shadow-sky-400/50" },
    amber:   { bg: "from-amber-300 to-amber-500",     ring: "ring-amber-200",   glow: "shadow-amber-400/50" },
    orange:  { bg: "from-orange-300 to-orange-500",   ring: "ring-orange-200",  glow: "shadow-orange-400/50" },
    yellow:  { bg: "from-yellow-300 to-yellow-500",   ring: "ring-yellow-200",  glow: "shadow-yellow-400/50" },
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4">
          <Skeleton className="h-12 mb-4 rounded-xl" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!activeSegment) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-emerald-700">Mapa nije dostupna.</p>
          <Link href="/ilmihal">
            <button className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg">Nazad</button>
          </Link>
        </div>
      </Layout>
    );
  }

  const prevUnlocked = activeSegmentIndex > 0;
  const nextUnlocked = activeSegmentIndex < segments.length - 1 && isSegmentUnlocked(activeSegmentIndex + 1);

  return (
    <Layout>
      {/* Top bar - povratak + naslov segmenta + brojač + navigacija */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-emerald-100 px-4 py-3 -mx-4 mb-2">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Link href="/ilmihal">
            <button
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700 shrink-0"
              data-testid="button-nazad-ilmihal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>

          <button
            disabled={!prevUnlocked}
            onClick={() => setLocation(`/nivo1-mapa/${activeSegmentIndex}`)}
            className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            data-testid="button-segment-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-extrabold text-emerald-900 truncate">
              Etapa {activeSegmentIndex + 1} / {segments.length} — {activeSegment.medaljon.naziv}
            </h1>
            <p className="text-xs text-emerald-700/70">
              {zavrseneSet.size} / {data?.lekcije.length ?? 0} lekcija
              {osvojeniSet.size > 0 && <span> · {osvojeniSet.size} medaljona</span>}
            </p>
          </div>

          <button
            disabled={!nextUnlocked}
            onClick={() => setLocation(`/nivo1-mapa/${activeSegmentIndex + 2}`)}
            className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            data-testid="button-segment-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mapa kontejner — pozadinska slika trenutnog segmenta + ravna staza
          (krugovi centralno). Svaki segment je samostalna scena. */}
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl border-2 border-emerald-200 shadow-inner"
        style={{
          height: `${containerHeight}px`,
          backgroundImage: `url('${activeSegment.background}')`,
          backgroundSize: "100% auto",
          backgroundRepeat: "repeat-y",
          backgroundPosition: "center top",
        }}
        data-testid="mapa-container"
      >
        <div className="absolute inset-0 bg-emerald-50/15 pointer-events-none" />

        {/* Polja (lekcije + medaljon na vrhu) */}
        {activeSegment.items.map((item, i) => {
          const leftPct = leftPercentFor(i);
          const bottomPx = (i + 1) * FIELD_GAP_PX;

          if (item.kind === "lekcija") {
            const l = item.lekcija;
            const isDone = zavrseneSet.has(l.id);
            const isCurrent = i === currentItemIndexInSegment;
            return (
              <button
                key={`l-${l.id}`}
                onClick={() => setLocation(`/ilmihal/${l.slug}`)}
                className="absolute group"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${bottomPx}px`,
                  transform: "translate(-50%, 50%)",
                }}
                data-testid={`mapa-polje-lekcija-${l.id}`}
              >
                <div className="relative">
                  {isCurrent && (
                    <span className="absolute inset-0 rounded-full bg-emerald-300 animate-ping opacity-60" />
                  )}
                  <div
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-lg shadow-lg transition-transform group-hover:scale-110 ${
                      isDone
                        ? "bg-white text-amber-700 ring-4 ring-amber-400 shadow-amber-300/50"
                        : isCurrent
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ring-4 ring-white"
                          : "bg-white text-emerald-700 ring-2 ring-emerald-300"
                    }`}
                  >
                    {isDone ? <Check className="w-7 h-7" strokeWidth={3} /> : item.brojUListi}
                  </div>
                </div>
                <div className="mt-1 px-2 py-0.5 bg-white/95 rounded-md shadow text-[10px] font-semibold text-emerald-900 max-w-[110px] truncate text-center">
                  {l.naslov}
                </div>
              </button>
            );
          }

          // MEDALJON — kraj segmenta. Klik na otključan vodi na medaljon detail
          // gdje se osvaja, a onda se vraća na sljedeći segment.
          const m = item.medaljon;
          const earned = osvojeniSet.has(m.id);
          const unlocked = zavrseneSet.size >= m.posAfterRedoslijed;
          const isCurrent = i === currentItemIndexInSegment;
          const boje = medaljonBoje[m.boja] ?? medaljonBoje.amber;
          return (
            <button
              key={`m-${m.id}`}
              onClick={() => setLocation(`/medaljon/${m.slug}`)}
              className="absolute group"
              style={{
                left: `${leftPct}%`,
                bottom: `${bottomPx}px`,
                transform: "translate(-50%, 50%)",
              }}
              data-testid={`mapa-polje-medaljon-${m.slug}`}
            >
              <div className="relative">
                {isCurrent && (
                  <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-70" />
                )}
                <div
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform group-hover:scale-110 ${
                    earned
                      ? `bg-gradient-to-br ${boje.bg} ring-4 ring-white ${boje.glow} shadow-2xl`
                      : unlocked
                        ? `bg-gradient-to-br ${boje.bg} ring-4 ${boje.ring} opacity-95`
                        : "bg-gray-300 ring-4 ring-gray-200 opacity-70"
                  }`}
                >
                  {earned ? (
                    <Sparkles className="w-7 h-7 text-white drop-shadow" strokeWidth={2.5} />
                  ) : unlocked ? (
                    <Medal className="w-7 h-7 text-white drop-shadow" strokeWidth={2.5} />
                  ) : (
                    <Lock className="w-6 h-6 text-gray-500" />
                  )}
                </div>
              </div>
              <div className={`mt-1.5 px-2 py-0.5 rounded-md shadow text-[11px] font-extrabold max-w-[120px] truncate text-center ${
                earned ? "bg-amber-500 text-white" : "bg-white/95 text-amber-900"
              }`}>
                {m.naziv}
              </div>
            </button>
          );
        })}

        {currentItemIndexInSegment >= 0 && (
          <BeeOnMap
            leftPct={leftPercentFor(currentItemIndexInSegment)}
            bottomPx={(currentItemIndexInSegment + 1) * FIELD_GAP_PX}
          />
        )}
      </div>

      {/* Footer sa CTA na sljedeći segment ako je otključan */}
      <div className="max-w-2xl mx-auto py-6 text-center">
        {nextUnlocked ? (
          <button
            onClick={() => setLocation(`/nivo1-mapa/${activeSegmentIndex + 2}`)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow"
            data-testid="button-sljedeci-segment"
          >
            Sljedeća etapa →
          </button>
        ) : (
          <p className="text-xs text-emerald-700/70">
            Završi lekcije i osvoji medaljon da otključaš sljedeću etapu.
          </p>
        )}
      </div>
    </Layout>
  );
}

function BeeOnMap({ leftPct, bottomPx }: { leftPct: number; bottomPx: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      initial={false}
      animate={{
        left: `${leftPct}%`,
        bottom: `${bottomPx + 60}px`,
      }}
      transition={{ type: "spring", stiffness: 60, damping: 14 }}
      style={{ transform: "translate(-50%, 0)" }}
      data-testid="mapa-pcela"
    >
      <motion.div
        animate={{ y: [0, -8, 0, -4, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
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
