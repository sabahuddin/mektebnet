import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";

interface Lekcija {
  id: number;
  nivo: number;
  zavrseno?: boolean;
}

interface NivoCard {
  broj: 1 | 2 | 3;
  naslov: string;
  href: string;
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
    { broj: 1, naslov: "Mala Košnica",     href: "/nivo1-mapa" },
    { broj: 2, naslov: "Zlatna Košnica",   href: "/nivo2-mapa" },
    { broj: 3, naslov: "Košnica Mudrosti", href: "/nivo3-mapa" },
  ];

  return (
    <Layout>
      {/* Minimalisticka scena u pozadini: topli nebeski gradient,
          siluete dalje sume i obrisi brda na dnu, par pcelica.
          Sve fiksno iza sadrzaja i bez interakcije. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, #fff8ec 0%, #fdf3df 55%, #f7e9c8 100%)",
        }}
      />
      <svg
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 -z-10 pointer-events-none w-full h-[55vh] sm:h-[60vh]"
        viewBox="0 0 1440 600"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,360 C180,300 320,330 500,310 C700,288 860,335 1040,315 C1220,295 1340,320 1440,305 L1440,600 L0,600 Z"
          fill="#f0dca8"
          opacity="0.55"
        />
        <g fill="#d9b86a" opacity="0.35">
          {Array.from({ length: 36 }).map((_, i) => {
            const x = i * 42 + 10;
            const h = 18 + ((i * 7) % 14);
            return (
              <polygon
                key={`tree-far-${i}`}
                points={`${x},${360 - h} ${x - 9},370 ${x + 9},370`}
              />
            );
          })}
        </g>
        <path
          d="M0,420 C160,370 300,395 480,380 C680,360 880,410 1080,390 C1260,372 1360,400 1440,388 L1440,600 L0,600 Z"
          fill="#e6c885"
          opacity="0.7"
        />
        <path
          d="M0,490 C200,440 400,470 620,460 C840,450 1060,490 1260,475 C1340,470 1400,478 1440,472 L1440,600 L0,600 Z"
          fill="#d4a85a"
          opacity="0.85"
        />
        <g transform="translate(180, 110)" opacity="0.7">
          <ellipse cx="0" cy="0" rx="9" ry="6" fill="#f4c430" />
          <rect x="-5" y="-6" width="3" height="12" fill="#3a2a14" rx="1" />
          <rect x="2" y="-6" width="3" height="12" fill="#3a2a14" rx="1" />
          <ellipse cx="-4" cy="-5" rx="6" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(-25 -4 -5)" />
          <ellipse cx="4" cy="-5" rx="6" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(25 4 -5)" />
        </g>
        <g transform="translate(1180, 180) scale(0.75)" opacity="0.6">
          <ellipse cx="0" cy="0" rx="9" ry="6" fill="#f4c430" />
          <rect x="-5" y="-6" width="3" height="12" fill="#3a2a14" rx="1" />
          <rect x="2" y="-6" width="3" height="12" fill="#3a2a14" rx="1" />
          <ellipse cx="-4" cy="-5" rx="6" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(-25 -4 -5)" />
          <ellipse cx="4" cy="-5" rx="6" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(25 4 -5)" />
        </g>
        <g transform="translate(820, 70) scale(0.55)" opacity="0.5">
          <ellipse cx="0" cy="0" rx="9" ry="6" fill="#f4c430" />
          <rect x="-5" y="-6" width="3" height="12" fill="#3a2a14" rx="1" />
          <rect x="2" y="-6" width="3" height="12" fill="#3a2a14" rx="1" />
          <ellipse cx="-4" cy="-5" rx="6" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(-25 -4 -5)" />
          <ellipse cx="4" cy="-5" rx="6" ry="3" fill="#ffffff" opacity="0.7" transform="rotate(25 4 -5)" />
        </g>
      </svg>
      <div className="max-w-6xl mx-auto px-2 relative">
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
                className="group relative flex flex-col items-center focus:outline-none"
                data-testid={`button-nivo-${n.broj}`}
                aria-label={`${n.naslov} — Nivo ${n.broj}`}
              >
                <div className="relative w-full aspect-square max-w-xs mx-auto">
                  <img
                    src="/images/kosnica-vrata.png"
                    alt={n.naslov}
                    className="w-full h-full object-contain drop-shadow-xl transition-transform group-hover:scale-105 group-active:scale-95"
                    draggable={false}
                  />
                  {/* Broj na vratima košnice — apsolutno centriran */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-2xl sm:text-3xl font-black shadow-lg ring-4 ring-white bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-900"
                      style={{ transform: "translateY(20%)" }}
                    >
                      {n.broj}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center">
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-900">
                    {n.naslov}
                  </div>
                  {user && stats.total > 0 && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 shadow-sm text-xs font-bold text-amber-900">
                      {stats.done} / {stats.total} lekcija
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
