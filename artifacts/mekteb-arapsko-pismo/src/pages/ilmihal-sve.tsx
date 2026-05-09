import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, CheckCircle2, BookOpen } from "lucide-react";

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed?: number;
  zavrseno?: boolean;
}

const NIVO_INFO: Record<number, { naslov: string; podnaslov: string; bg: string; ring: string }> = {
  1: { naslov: "Mala Košnica",     podnaslov: "Nivo 1", bg: "from-yellow-50 to-yellow-100", ring: "ring-yellow-200" },
  2: { naslov: "Zlatna Košnica",   podnaslov: "Nivo 2", bg: "from-amber-50 to-amber-100",   ring: "ring-amber-200" },
  3: { naslov: "Košnica Mudrosti", podnaslov: "Nivo 3", bg: "from-orange-50 to-orange-100", ring: "ring-orange-200" },
};

export default function IlmihalSvePage() {
  const { token } = useAuth();
  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<Lekcija[]>("GET", "/content/ilmihal", undefined, token || undefined)
      .then((data) => setLekcije(Array.isArray(data) ? data : []))
      .catch(() => setLekcije([]))
      .finally(() => setLoading(false));
  }, [token]);

  const groupedByNivo: Record<number, Lekcija[]> = { 1: [], 2: [], 3: [] };
  for (const l of lekcije) {
    if (groupedByNivo[l.nivo]) groupedByNivo[l.nivo].push(l);
  }
  for (const k of Object.keys(groupedByNivo)) {
    const n = Number(k);
    groupedByNivo[n].sort((a, b) => (a.redoslijed ?? a.id) - (b.redoslijed ?? b.id));
  }

  const total = lekcije.length;
  const done = lekcije.filter((l) => l.zavrseno).length;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 pb-12">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/ilmihal"
            className="inline-flex items-center gap-2 text-amber-900 font-bold hover:underline"
            data-testid="link-back-ilmihal"
          >
            <ArrowLeft className="w-5 h-5" />
            Nazad na Lekcije
          </Link>
          {token && total > 0 && (
            <div className="text-sm font-bold text-amber-900 bg-white/80 rounded-full px-3 py-1 shadow-sm">
              {done} / {total} završeno
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-amber-900 mb-2">
            Spisak svih lekcija
          </h1>
          <p className="text-amber-800/80 text-sm sm:text-base">
            Pregledaj sve lekcije po nivoima i otvori bilo koju
          </p>
        </div>

        {loading ? (
          <div className="text-center text-amber-800/70 py-10">Učitavanje…</div>
        ) : total === 0 ? (
          <div className="text-center text-amber-800/70 py-10">
            Trenutno nema dostupnih lekcija.
          </div>
        ) : (
          <div className="space-y-8">
            {[1, 2, 3].map((nivo) => {
              const items = groupedByNivo[nivo];
              if (!items || items.length === 0) return null;
              const info = NIVO_INFO[nivo];
              const nivoDone = items.filter((l) => l.zavrseno).length;
              return (
                <section key={nivo} data-testid={`section-nivo-${nivo}`}>
                  <div className="flex items-end justify-between mb-3 px-1">
                    <div>
                      <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                        {info.podnaslov}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-amber-900">
                        {info.naslov}
                      </h2>
                    </div>
                    {token && (
                      <div className="text-xs sm:text-sm font-bold text-amber-800/80">
                        {nivoDone} / {items.length}
                      </div>
                    )}
                  </div>

                  <div
                    className={`rounded-2xl bg-gradient-to-br ${info.bg} ring-1 ${info.ring} shadow-sm p-2 sm:p-3`}
                  >
                    <ol className="divide-y divide-amber-200/60">
                      {items.map((l, idx) => (
                        <li key={l.id}>
                          <Link
                            href={`/ilmihal/${l.slug}`}
                            className="flex items-center gap-3 px-3 py-3 sm:py-3.5 rounded-xl hover:bg-white/60 active:bg-white/80 transition-colors"
                            data-testid={`link-lekcija-${l.slug}`}
                          >
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white shadow-sm ring-2 ring-amber-200 flex items-center justify-center text-amber-900 font-extrabold text-sm">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-amber-900 text-sm sm:text-base truncate">
                                {l.naslov}
                              </div>
                            </div>
                            {l.zavrseno ? (
                              <CheckCircle2
                                className="w-6 h-6 text-emerald-600 flex-shrink-0"
                                aria-label="Završeno"
                              />
                            ) : (
                              <BookOpen
                                className="w-5 h-5 text-amber-700/60 flex-shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
