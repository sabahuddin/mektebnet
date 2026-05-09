import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Lock } from "lucide-react";

interface Lekcija {
  id: number;
  nivo: number;
  zavrseno?: boolean;
}

interface NivoCard {
  broj: 1 | 2 | 3;
  naslov: string;
  opis: string;
  href: string;
  unlocked: boolean;
}

export default function IlmihalPage() {
  const [, setLocation] = useLocation();
  const { token, user } = useAuth();
  const [completedByNivo, setCompletedByNivo] = useState<Record<number, { done: number; total: number }>>({
    1: { done: 0, total: 0 },
    2: { done: 0, total: 0 },
    3: { done: 0, total: 0 },
  });

  useEffect(() => {
    apiRequest<Lekcija[]>("GET", "/content/ilmihal", undefined, token || undefined)
      .then(async (lekcije) => {
        const totals: Record<number, { done: number; total: number }> = {
          1: { done: 0, total: 0 },
          2: { done: 0, total: 0 },
          3: { done: 0, total: 0 },
        };
        lekcije.forEach((l) => {
          if (totals[l.nivo]) totals[l.nivo].total++;
        });

        if (user) {
          try {
            const p = await apiRequest<{ completedLessons?: number[] }>(
              "GET",
              `/progress?studentId=${encodeURIComponent(String(user.id))}`,
              undefined,
              token || undefined,
            );
            const doneSet = new Set(p.completedLessons ?? []);
            lekcije.forEach((l) => {
              if (totals[l.nivo] && doneSet.has(l.id)) totals[l.nivo].done++;
            });
          } catch {}
        }
        setCompletedByNivo(totals);
      })
      .catch(() => {});
  }, [token, user]);

  const nivoi: NivoCard[] = [
    {
      broj: 1,
      naslov: "Prvi koraci",
      opis: "Allah, Poslanik a.s., osnove imana",
      href: "/nivo1-mapa",
      unlocked: true,
    },
    {
      broj: 2,
      naslov: "Učimo dalje",
      opis: "Namaz, abdest, lijepo ponašanje",
      href: "/nivo2",
      unlocked: false,
    },
    {
      broj: 3,
      naslov: "Mali muftija",
      opis: "Ramazan, hadis, kur'anske priče",
      href: "/nivo2",
      unlocked: false,
    },
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-2">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-amber-900 mb-2">
            Lekcije
          </h1>
          <p className="text-amber-800/80 text-sm sm:text-base">
            Izaberi košnicu i kreni u učenje
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {nivoi.map((n, idx) => {
            const stats = completedByNivo[n.broj] ?? { done: 0, total: 0 };
            return (
              <motion.button
                key={n.broj}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.12, duration: 0.4 }}
                onClick={() => setLocation(n.href)}
                disabled={!n.unlocked}
                className="group relative flex flex-col items-center focus:outline-none disabled:cursor-not-allowed"
                data-testid={`button-nivo-${n.broj}`}
                aria-label={`Nivo ${n.broj} — ${n.naslov}${n.unlocked ? "" : " (zaključano)"}`}
              >
                <div className="relative w-full aspect-square max-w-xs mx-auto">
                  <img
                    src="/images/kosnica-vrata.png"
                    alt={`Košnica ${n.broj}`}
                    className={`w-full h-full object-contain drop-shadow-xl transition-transform ${
                      n.unlocked
                        ? "group-hover:scale-105 group-active:scale-95"
                        : "grayscale opacity-70"
                    }`}
                    draggable={false}
                  />
                  {/* Broj na vratima košnice — apsolutno centriran */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-black shadow-lg ring-4 ring-white ${
                        n.unlocked
                          ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900"
                          : "bg-gray-300 text-gray-600"
                      }`}
                      style={{ transform: "translateY(20%)" }}
                    >
                      {n.unlocked ? n.broj : <Lock className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={3} />}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-900">
                    {n.naslov}
                  </div>
                  <div className="text-xs sm:text-sm text-amber-800/70 mt-0.5 max-w-[18rem] mx-auto">
                    {n.opis}
                  </div>
                  {n.unlocked && user && stats.total > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 shadow-sm text-xs font-bold text-amber-900">
                      {stats.done} / {stats.total} lekcija
                    </div>
                  )}
                  {!n.unlocked && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                      <Lock className="w-3 h-3" strokeWidth={3} /> Uskoro
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
