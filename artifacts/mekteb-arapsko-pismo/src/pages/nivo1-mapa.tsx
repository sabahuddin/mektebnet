import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, Check, Lock, Medal, Sparkles } from "lucide-react";
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

// Visina svakog polja (vertikalni razmak između susjednih polja na mapi).
// 130px daje ugodan ritam — ni stiješnjeno ni predugo skrolovanje.
const FIELD_GAP_PX = 130;
// Krugovi se postavljaju centralno (kolona). Pozadinska slika ima vlastitu
// vijugavu stazu koja se ponavlja kao tile — pošto je njena frekvencija
// nezavisna od broja lekcija po tile-u, pokušaji da se krugovi matematički
// poklope sa stazom djeluju neuredno. Stoga je staza puko dekorativni
// ambijent, a krugovi formiraju jasnu, čitljivu vertikalnu putanju.
const SERP_CENTER = 50;

function leftPercentFor(_index: number): number {
  return SERP_CENTER;
}

export default function Nivo1MapaPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<MapaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Backend uzima studentId iz JWT-a (ne iz querya) radi sigurnosti.
    apiRequest<MapaData>("GET", `/mapa/nivo1`, undefined, token || undefined)
      .then(setData)
      .catch(() => setData({ lekcije: [], medaljoni: [], zavrsene: [], osvojeniMedaljoni: [] }))
      .finally(() => setIsLoading(false));
  }, [token]);

  // Sklopi putanju: lekcije po redoslijedu, sa medaljonima ubačenim na svojim
  // pozicijama. Preostali medaljoni (npr. "Prva košnica" sa pos=64) idu na kraj.
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

  // Indeks "trenutnog" polja: prva nezavršena lekcija (ili prvi neosvojeni
  // medaljon koji student već ispunjava uslove). Pčela će letjeti do njega.
  const currentIndex = useMemo(() => {
    for (let i = 0; i < path.length; i++) {
      const it = path[i];
      if (it.kind === "lekcija" && !zavrseneSet.has(it.lekcija.id)) return i;
      if (it.kind === "medaljon" && !osvojeniSet.has(it.medaljon.id)) {
        // Medaljon je "current" samo ako su lekcije do njega završene.
        const sveZavrsene = zavrseneSet.size >= it.medaljon.posAfterRedoslijed;
        if (sveZavrsene) return i;
      }
    }
    return -1; // sve završeno
  }, [path, zavrseneSet, osvojeniSet]);

  // Kontejner je obrnut: indeks 0 (prva lekcija) je na DNU, posljednji na VRHU.
  // Total visina kontejnera = (path.length + 2) * FIELD_GAP_PX.
  const containerHeight = (path.length + 2) * FIELD_GAP_PX;

  // Auto-scroll na trenutno polje pri prvom učitavanju (centriraj u viewportu).
  useEffect(() => {
    if (currentIndex < 0 || !containerRef.current) return;
    const fromBottomPx = (currentIndex + 1) * FIELD_GAP_PX;
    const targetTop = containerHeight - fromBottomPx - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [currentIndex, containerHeight]);

  // Boja medaljona (emerald/sky/amber/orange/yellow) → tailwind klase.
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

  return (
    <Layout>
      {/* Top bar - povratak + naslov + brojač napretka */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-emerald-100 px-4 py-3 -mx-4 mb-2">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/ilmihal">
            <button
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700 shrink-0"
              data-testid="button-nazad-ilmihal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-emerald-900 truncate">Mapa — Nivo 1</h1>
            <p className="text-xs text-emerald-700/70">
              {zavrseneSet.size} / {data?.lekcije.length ?? 0} lekcija
              {osvojeniSet.size > 0 && <span> · {osvojeniSet.size} medaljona</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Mapa kontejner. Pozadina je u dva sloja:
          1) tile-meadow.png — seamless tileable livada sa vijugavom stazom,
             ponavlja se vertikalno kroz cijeli put.
          2) vrh-dzamija.png — apsolutni element zalijepljen na sam vrh
             kontejnera, prikazuje destinaciju (košnicu-džamiju) iznad puta.
          Polja (lekcije + medaljoni) se renderuju preko, sa serpentine layoutom. */}
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl border-2 border-emerald-200 shadow-inner"
        style={{
          height: `${containerHeight}px`,
          backgroundImage: "url('/images/mapa/tile-meadow.png')",
          backgroundSize: "100% auto",
          backgroundRepeat: "repeat-y",
          backgroundPosition: "center top",
        }}
        data-testid="mapa-container"
      >
        {/* Vrh mape — košnica-džamija (cilj puta) iznad svih polja */}
        <img
          src="/images/mapa/vrh-dzamija.png"
          alt="Košnica-džamija — kraj Nivoa 1"
          className="absolute top-0 left-0 w-full pointer-events-none select-none"
          style={{ height: "auto" }}
        />

        {/* Blagi zeleni overlay da se polja bolje vide preko pozadine */}
        <div className="absolute inset-0 bg-emerald-50/15 pointer-events-none" />

        {/* Polja (lekcije + medaljoni) */}
        {path.map((item, i) => {
          const leftPct = leftPercentFor(i);
          const bottomPx = (i + 1) * FIELD_GAP_PX;

          if (item.kind === "lekcija") {
            const l = item.lekcija;
            const isDone = zavrseneSet.has(l.id);
            const isCurrent = i === currentIndex;
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

          // MEDALJON
          const m = item.medaljon;
          const earned = osvojeniSet.has(m.id);
          const unlocked = zavrseneSet.size >= m.posAfterRedoslijed;
          const isCurrent = i === currentIndex;
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

        {/* Pčela animacija — leti do trenutnog polja sa blagim bobblanjem */}
        {currentIndex >= 0 && (
          <BeeOnMap
            leftPct={leftPercentFor(currentIndex)}
            bottomPx={(currentIndex + 1) * FIELD_GAP_PX}
          />
        )}
      </div>

      <div className="max-w-2xl mx-auto py-6 text-center text-xs text-emerald-700/70">
        Skrolaj prema dolje za pregled cijelog puta. Pčela ti pokazuje gdje si stao.
      </div>
    </Layout>
  );
}

// Pčela — SVG sa krilima u floating animaciji.
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
          {/* Krila */}
          <ellipse cx="14" cy="18" rx="9" ry="6" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.2)" />
          <ellipse cx="34" cy="18" rx="9" ry="6" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.2)" />
          {/* Tijelo */}
          <ellipse cx="24" cy="26" rx="11" ry="9" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          <rect x="14" y="22" width="20" height="3" fill="#78350f" />
          <rect x="14" y="28" width="20" height="3" fill="#78350f" />
          {/* Glava + oči */}
          <circle cx="35" cy="24" r="4" fill="#78350f" />
          <circle cx="36" cy="23" r="1" fill="#fff" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
