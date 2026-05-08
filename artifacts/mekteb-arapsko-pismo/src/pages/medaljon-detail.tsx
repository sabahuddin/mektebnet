import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Lock, Medal, Sparkles, Trophy } from "lucide-react";

interface Medaljon {
  id: number;
  slug: string;
  naziv: string;
  opis: string;
  posAfterRedoslijed: number;
  ikona: string;
  boja: string;
  contentHtml: string;
}

interface MapaData {
  medaljoni: Medaljon[];
  zavrsene: number[];
  osvojeniMedaljoni: number[];
}

const BOJE: Record<string, { from: string; to: string; ring: string; text: string }> = {
  emerald: { from: "from-emerald-300", to: "to-emerald-600", ring: "ring-emerald-200", text: "text-emerald-900" },
  sky:     { from: "from-sky-300",     to: "to-sky-600",     ring: "ring-sky-200",     text: "text-sky-900" },
  amber:   { from: "from-amber-300",   to: "to-amber-600",   ring: "ring-amber-200",   text: "text-amber-900" },
  orange:  { from: "from-orange-300",  to: "to-orange-600",  ring: "ring-orange-200",  text: "text-orange-900" },
  yellow:  { from: "from-yellow-300",  to: "to-yellow-500",  ring: "ring-yellow-200",  text: "text-yellow-900" },
};

// Provjera da li korisnik ima uključen prefers-reduced-motion (accessibility).
// Konfete se ne pucaju ako je tako — poštujemo želju korisnika.
function reducedMotionAktivan(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Šaljemo niz konfeta sa različitih pozicija — efekat "pljuska" sreće.
function pucajKonfete() {
  if (reducedMotionAktivan()) return;
  const defaults = { spread: 70, ticks: 90, gravity: 1, decay: 0.92, startVelocity: 35, scalar: 1.1 };
  const fire = (x: number, particleRatio: number, opts: confetti.Options) => {
    confetti({
      ...defaults,
      ...opts,
      origin: { x, y: 0.6 },
      particleCount: Math.floor(140 * particleRatio),
      colors: ["#fbbf24", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7"],
    });
  };
  fire(0.25, 0.25, { spread: 26, startVelocity: 55 });
  fire(0.5, 0.35, { spread: 100 });
  fire(0.75, 0.25, { spread: 26, startVelocity: 55 });
  fire(0.5, 0.15, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.4 });
}

export default function MedaljonDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/medaljon/:slug");
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<MapaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const slug = params?.slug ?? "";
  // Čuvamo id-eve odgođenih konfeta da ih možemo otkazati pri unmount-u
  // (npr. korisnik klikne nazad odmah nakon claim-a).
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (confettiTimerRef.current !== null) {
        clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    apiRequest<MapaData>("GET", "/mapa/nivo1", undefined, token || undefined)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, [token]);

  const medaljon = data?.medaljoni.find((m) => m.slug === slug);
  const earned = medaljon ? data!.osvojeniMedaljoni.includes(medaljon.id) : false;
  const zavrseneCount = data?.zavrsene.length ?? 0;
  const unlocked = medaljon ? zavrseneCount >= medaljon.posAfterRedoslijed : false;

  // Ako je tek osvojen u ovoj sesiji — prikaži konfete (samo jednom po mountu).
  const [justEarned, setJustEarned] = useState(false);

  const claim = async () => {
    if (!medaljon || !token || isClaiming) return;
    setIsClaiming(true);
    try {
      const r = await apiRequest<{ ok: boolean; vecOsvojen: boolean }>(
        "POST",
        `/mapa/medaljon/${medaljon.slug}/claim`,
        undefined,
        token,
      );
      if (r.ok) {
        if (!r.vecOsvojen) {
          setJustEarned(true);
          // pucajKonfete sam interno preskače efekat ako je reduced-motion.
          pucajKonfete();
          // Dodatni "puff" konfeta pola sekunde kasnije — efekat eksplozije.
          // Čuvamo timer da ga otkažemo ako se komponenta unmount-uje.
          if (!reducedMotionAktivan()) {
            confettiTimerRef.current = setTimeout(() => {
              pucajKonfete();
              confettiTimerRef.current = null;
            }, 600);
          }
        }
        // Ažuriraj lokalno stanje da dugme pređe u "osvojen" mod
        setData((prev) =>
          prev
            ? { ...prev, osvojeniMedaljoni: [...new Set([...prev.osvojeniMedaljoni, medaljon.id])] }
            : prev,
        );
        toast({
          title: r.vecOsvojen ? "Već si osvojio ovaj medaljon" : `Bravo! Osvojen: ${medaljon.naziv}`,
          description: medaljon.opis,
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Greška";
      toast({ title: "Ne mogu osvojiti medaljon", description: msg, variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4">
          <Skeleton className="h-12 mb-4 rounded-xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (!medaljon) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4 text-center">
          <p className="text-muted-foreground">Medaljon nije pronađen.</p>
          <button
            onClick={() => setLocation("/nivo1-mapa")}
            className="mt-4 text-emerald-700 font-bold underline"
          >
            Nazad na mapu
          </button>
        </div>
      </Layout>
    );
  }

  const boje = BOJE[medaljon.boja] ?? BOJE.amber;
  const isUcenik = user?.role === "ucenik";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button
            onClick={() => setLocation("/nivo1-mapa")}
            className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700"
            data-testid="button-nazad-mapa"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-emerald-900 truncate">Medaljon</h1>
        </div>

        {/* Hero kartica sa medaljonom */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className={`relative rounded-3xl bg-gradient-to-br from-white via-amber-50 to-orange-50 border-2 ${boje.ring} ring-4 ring-white p-6 shadow-2xl text-center overflow-hidden`}
        >
          {/* Sjaj iza medaljona */}
          {(earned || justEarned) && (
            <motion.div
              className="absolute inset-0 -z-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{
                background: "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 60%)",
              }}
            />
          )}

          <motion.div
            initial={{ scale: 0.6, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.1 }}
            className="relative inline-block"
          >
            <motion.div
              animate={earned || justEarned ? { y: [0, -6, 0] } : {}}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className={`mx-auto w-32 h-32 rounded-full bg-gradient-to-br ${boje.from} ${boje.to} ring-8 ring-white shadow-2xl flex items-center justify-center ${
                !unlocked ? "opacity-50 grayscale" : ""
              }`}
            >
              {!unlocked ? (
                <Lock className="w-16 h-16 text-white/80" strokeWidth={2} />
              ) : earned || justEarned ? (
                <Sparkles className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={2.5} />
              ) : (
                <Medal className="w-16 h-16 text-white drop-shadow-lg" strokeWidth={2.5} />
              )}
            </motion.div>
          </motion.div>

          <h2 className={`mt-5 text-2xl font-extrabold ${boje.text}`} data-testid="text-medaljon-naziv">
            {medaljon.naziv}
          </h2>
          <p className="mt-2 text-sm text-amber-800/80 px-2">{medaljon.opis}</p>

          {/* Status */}
          <div className="mt-5">
            {earned || justEarned ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500 text-white px-4 py-2 font-bold text-sm shadow">
                <Trophy className="w-4 h-4" /> Osvojen
              </div>
            ) : !unlocked ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-200 text-gray-700 px-4 py-2 font-bold text-sm">
                <Lock className="w-4 h-4" />
                Završi {medaljon.posAfterRedoslijed - zavrseneCount} {medaljon.posAfterRedoslijed - zavrseneCount === 1 ? "lekciju" : "lekcija"} više
              </div>
            ) : isUcenik ? (
              <button
                onClick={claim}
                disabled={isClaiming}
                className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-br ${boje.from} ${boje.to} text-white px-6 py-3 font-extrabold shadow-lg hover:scale-105 transition-transform disabled:opacity-60`}
                data-testid="button-osvoji-medaljon"
              >
                <Sparkles className="w-5 h-5" />
                {isClaiming ? "Osvajam..." : "Osvoji medaljon"}
              </button>
            ) : (
              <p className="text-sm text-amber-800/70">Prijavi se kao učenik da osvojiš medaljon.</p>
            )}
          </div>
        </motion.div>

        {/* Sadržaj aktivnosti (ako postoji). Trenutno je prazan placeholder
            dok admin ne unese sadržaj kroz editor (dolazi u sljedećoj iteraciji). */}
        {medaljon.contentHtml ? (
          <div
            className="mt-6 rounded-2xl bg-white border-2 border-emerald-100 p-5 prose prose-sm max-w-none prose-headings:text-emerald-900"
            dangerouslySetInnerHTML={{ __html: medaljon.contentHtml }}
          />
        ) : (
          <div className="mt-6 rounded-2xl bg-emerald-50/60 border-2 border-dashed border-emerald-200 p-5 text-center text-sm text-emerald-800/70">
            Sadržaj aktivnosti za ovaj medaljon će uskoro biti dodan.
            {isUcenik && unlocked && !earned && (
              <p className="mt-2 text-xs">
                U međuvremenu — pošto si završio sve potrebne lekcije, klikni
                gore da osvojiš bedž.
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
