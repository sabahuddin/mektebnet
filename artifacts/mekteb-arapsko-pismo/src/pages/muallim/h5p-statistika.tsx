import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Sparkles, Users, BarChart3, Loader2,
  ChevronRight, BookOpen, AlertTriangle, TrendingUp,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Grupa {
  id: number;
  naziv: string;
}

interface NajslabijiUcenik {
  id: number;
  displayName: string;
  prosjekProcenat: number;
  brojPokusaja: number;
}

interface VjezbaStat {
  priloziId: number;
  priloziName: string;
  lekcijaId: number;
  lekcijaNaslov: string | null;
  lekcijaSlug: string | null;
  lekcijaNivo: number | null;
  brojUcenika: number;
  ukupnoPokusaja: number;
  prosjekProcenat: number;
  najslabijiUcenik: NajslabijiUcenik | null;
}

interface StatsResponse {
  ukupnoUcenika: number;
  vjezbe: VjezbaStat[];
}

interface TrendBucket {
  weekStart: string;
  brojPokusaja: number;
  prosjekProcenat: number;
}

interface TrendsResponse {
  weeks: number;
  rangeStart: string;
  buckets: TrendBucket[];
}

const WEEK_OPTIONS = [4, 8, 12] as const;
type WeeksOption = (typeof WEEK_OPTIONS)[number];

function formatWeekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month}.`;
}

type SortKey = "popularnost" | "tacnost-najveca" | "tacnost-najmanja" | "pokusaja";

const SORT_LABELS: Record<SortKey, string> = {
  popularnost: "Najviše učenika",
  pokusaja: "Najviše pokušaja",
  "tacnost-najveca": "Najveća tačnost",
  "tacnost-najmanja": "Najmanja tačnost",
};

function sortVjezbe(vjezbe: VjezbaStat[], key: SortKey): VjezbaStat[] {
  const arr = [...vjezbe];
  switch (key) {
    case "popularnost":
      arr.sort((a, b) =>
        b.brojUcenika - a.brojUcenika ||
        b.ukupnoPokusaja - a.ukupnoPokusaja ||
        a.priloziName.localeCompare(b.priloziName)
      );
      break;
    case "pokusaja":
      arr.sort((a, b) => b.ukupnoPokusaja - a.ukupnoPokusaja || b.brojUcenika - a.brojUcenika);
      break;
    case "tacnost-najveca":
      arr.sort((a, b) => b.prosjekProcenat - a.prosjekProcenat || b.brojUcenika - a.brojUcenika);
      break;
    case "tacnost-najmanja":
      arr.sort((a, b) => a.prosjekProcenat - b.prosjekProcenat || b.brojUcenika - a.brojUcenika);
      break;
  }
  return arr;
}

function procenatBoja(p: number): string {
  if (p >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (p >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

export default function MuallimH5pStatistikaPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [grupaId, setGrupaId] = useState<number | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loadingGrupe, setLoadingGrupe] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("popularnost");
  const [weeks, setWeeks] = useState<WeeksOption>(8);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token)
      .then(g => {
        setGrupe(g);
        if (g.length > 0) setGrupaId(g[0].id);
      })
      .catch(() => toast({ title: "Greška pri učitavanju grupa", variant: "destructive" }))
      .finally(() => setLoadingGrupe(false));
  }, [token]);

  useEffect(() => {
    if (!token || !grupaId) return;
    setLoadingStats(true);
    setData(null);
    apiRequest<StatsResponse>("GET", `/muallim/h5p-stats?grupaId=${grupaId}`, undefined, token)
      .then(setData)
      .catch(() => toast({ title: "Greška pri učitavanju statistike", variant: "destructive" }))
      .finally(() => setLoadingStats(false));
  }, [token, grupaId]);

  useEffect(() => {
    if (!token || !grupaId) return;
    setLoadingTrends(true);
    setTrends(null);
    apiRequest<TrendsResponse>(
      "GET",
      `/muallim/h5p-stats/trends?grupaId=${grupaId}&weeks=${weeks}`,
      undefined,
      token,
    )
      .then(setTrends)
      .catch(() => toast({ title: "Greška pri učitavanju trendova", variant: "destructive" }))
      .finally(() => setLoadingTrends(false));
  }, [token, grupaId, weeks]);

  const trendChartData = useMemo(() => {
    if (!trends) return [];
    return trends.buckets.map(b => ({
      label: formatWeekLabel(b.weekStart),
      weekStart: b.weekStart,
      pokusaji: b.brojPokusaja,
      prosjek: b.brojPokusaja > 0 ? b.prosjekProcenat : null,
    }));
  }, [trends]);

  const trendUkupnoPokusaja = useMemo(
    () => trends?.buckets.reduce((a, b) => a + b.brojPokusaja, 0) ?? 0,
    [trends],
  );

  const sorted = useMemo(() => (data ? sortVjezbe(data.vjezbe, sortKey) : []), [data, sortKey]);

  const ukupnoVjezbi = data?.vjezbe.length || 0;
  const ukupnoPokusaja = data?.vjezbe.reduce((a, v) => a + v.ukupnoPokusaja, 0) || 0;
  const prosjekTacnosti = data && data.vjezbe.length > 0
    ? Math.round(data.vjezbe.reduce((a, v) => a + v.prosjekProcenat * v.ukupnoPokusaja, 0) / Math.max(1, ukupnoPokusaja))
    : null;

  if (!user || (user.role !== "muallim" && user.role !== "admin")) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo muallimima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/muallim">
            <button className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Nazad
            </button>
          </Link>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-foreground">H5P statistika</h1>
            <p className="text-muted-foreground text-sm">
              Koje interaktivne vježbe učenici najviše rade i kako im ide.
            </p>
          </div>
        </div>

        {/* Group selector */}
        <div className="bg-white border border-border/50 rounded-2xl p-4 mb-6">
          {loadingGrupe ? (
            <Skeleton className="h-10 rounded-xl" />
          ) : grupe.length === 0 ? (
            <p className="text-muted-foreground text-sm font-medium py-2">
              Još nemate nijednu grupu. Napravite grupu u muallim panelu.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground mr-1">Grupa:</span>
              {grupe.map(g => (
                <button
                  key={g.id}
                  data-testid={`button-grupa-${g.id}`}
                  onClick={() => setGrupaId(g.id)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-bold border transition-all ${
                    grupaId === g.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-white text-muted-foreground border-border/60 hover:bg-muted"
                  }`}
                >
                  {g.naziv}
                </button>
              ))}
            </div>
          )}
        </div>

        {grupaId && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <Sparkles className="w-5 h-5 text-purple-600 mb-2" />
                <div className="text-2xl font-extrabold text-purple-900" data-testid="stat-broj-vjezbi">
                  {loadingStats ? "—" : ukupnoVjezbi}
                </div>
                <div className="text-xs font-bold text-purple-700/80">Vježbi sa pokušajima</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <BarChart3 className="w-5 h-5 text-blue-600 mb-2" />
                <div className="text-2xl font-extrabold text-blue-900" data-testid="stat-broj-pokusaja">
                  {loadingStats ? "—" : ukupnoPokusaja}
                </div>
                <div className="text-xs font-bold text-blue-700/80">Ukupno pokušaja</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <Users className="w-5 h-5 text-emerald-600 mb-2" />
                <div className="text-2xl font-extrabold text-emerald-900" data-testid="stat-ucenika">
                  {loadingStats ? "—" : data?.ukupnoUcenika ?? 0}
                </div>
                <div className="text-xs font-bold text-emerald-700/80">Učenika u grupi</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <BookOpen className="w-5 h-5 text-amber-600 mb-2" />
                <div className="text-2xl font-extrabold text-amber-900" data-testid="stat-prosjek">
                  {loadingStats || prosjekTacnosti === null ? "—" : `${prosjekTacnosti}%`}
                </div>
                <div className="text-xs font-bold text-amber-700/80">Prosječna tačnost</div>
              </div>
            </div>

            {/* Trends chart */}
            <div className="bg-white border border-border/50 rounded-2xl p-4 md:p-5 mb-6" data-testid="card-trendovi">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-foreground">Trend kroz vrijeme</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Pokušaji po sedmici i prosječna tačnost.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Period:</span>
                  {WEEK_OPTIONS.map(w => (
                    <button
                      key={w}
                      data-testid={`button-weeks-${w}`}
                      onClick={() => setWeeks(w)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                        weeks === w
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-white text-muted-foreground border-border/60 hover:bg-muted"
                      }`}
                    >
                      {w} sedmica
                    </button>
                  ))}
                </div>
              </div>

              {loadingTrends ? (
                <Skeleton className="h-56 rounded-xl" />
              ) : trendUkupnoPokusaja === 0 ? (
                <div
                  className="text-center py-8 text-sm text-muted-foreground font-medium"
                  data-testid="text-trendovi-prazno"
                >
                  Nema H5P pokušaja u zadnjih {weeks} sedmica.
                </div>
              ) : (
                <div className="h-56 sm:h-64" data-testid="chart-trendovi">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                        width={32}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={{ stroke: "#e5e7eb" }}
                        tickLine={false}
                        width={36}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          fontSize: 12,
                        }}
                        formatter={(value, name) => {
                          if (value === null || value === undefined) return ["—", name as string];
                          if (name === "Prosječna tačnost") return [`${value}%`, name as string];
                          return [value as number, name as string];
                        }}
                        labelFormatter={(label, items) => {
                          const ws = (items?.[0]?.payload as { weekStart?: string } | undefined)?.weekStart;
                          return ws ? `Sedmica od ${formatWeekLabel(ws)}` : label;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                        iconType="circle"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="pokusaji"
                        name="Pokušaji"
                        fill="#a78bfa"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="prosjek"
                        name="Prosječna tačnost"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#0ea5e9" }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Sort */}
            {!loadingStats && data && data.vjezbe.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-bold text-muted-foreground mr-1">Sortiraj:</span>
                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                  <button
                    key={k}
                    data-testid={`button-sort-${k}`}
                    onClick={() => setSortKey(k)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                      sortKey === k
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-white text-muted-foreground border-border/60 hover:bg-muted"
                    }`}
                  >
                    {SORT_LABELS[k]}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            {loadingStats ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : !data || data.vjezbe.length === 0 ? (
              <div className="bg-white border border-border/50 rounded-2xl p-10 text-center">
                <Sparkles className="w-10 h-10 text-purple-300 mx-auto mb-3" />
                <h3 className="font-extrabold text-foreground mb-1">Još nema H5P pokušaja</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Kad učenici iz ove grupe počnu rješavati H5P interaktivne vježbe,
                  ovdje ćete vidjeti koje su najpopularnije, prosječnu tačnost i kome treba pomoć.
                </p>
                <Link href="/muallim/h5p-uputstvo">
                  <Button variant="outline" className="mt-4 rounded-xl">
                    <Sparkles className="w-4 h-4 mr-1" /> Kako napraviti H5P vježbu
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3" data-testid="list-vjezbe">
                {sorted.map((v, idx) => (
                  <motion.div
                    key={v.priloziId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 8) * 0.03 }}
                    className="bg-white border border-border/50 rounded-2xl p-4 md:p-5"
                    data-testid={`row-vjezba-${v.priloziId}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          {v.lekcijaNivo !== null && (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md">
                              Nivo {v.lekcijaNivo}
                            </span>
                          )}
                          <span className="truncate">
                            {v.lekcijaNaslov || `Lekcija #${v.lekcijaId}`}
                          </span>
                        </div>
                        <h3 className="text-base md:text-lg font-extrabold text-foreground break-words">
                          {v.priloziName}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                        <div className="text-center">
                          <div className="text-xs font-bold text-muted-foreground">Učenika</div>
                          <div className="text-lg font-extrabold text-foreground">
                            {v.brojUcenika}
                            {data && (
                              <span className="text-xs font-bold text-muted-foreground">
                                /{data.ukupnoUcenika}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-muted-foreground">Pokušaja</div>
                          <div className="text-lg font-extrabold text-foreground">
                            {v.ukupnoPokusaja}
                          </div>
                        </div>
                        <div className={`text-center px-3 py-1.5 rounded-xl border font-extrabold text-base ${procenatBoja(v.prosjekProcenat)}`}>
                          {v.prosjekProcenat}%
                        </div>
                      </div>
                    </div>

                    {v.najslabijiUcenik && (
                      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span className="text-muted-foreground font-medium truncate">
                            Najslabiji rezultat:
                          </span>
                          <Link href={`/muallim/ucenik/${v.najslabijiUcenik.id}?h5pPrilogId=${v.priloziId}`}>
                            <button
                              data-testid={`link-najslabiji-${v.priloziId}`}
                              className="font-extrabold text-primary hover:underline truncate"
                            >
                              {v.najslabijiUcenik.displayName}
                            </button>
                          </Link>
                          <span className="font-bold text-amber-700">
                            {v.najslabijiUcenik.prosjekProcenat}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({v.najslabijiUcenik.brojPokusaja} pokušaj{v.najslabijiUcenik.brojPokusaja === 1 ? "" : "a"})
                          </span>
                        </div>
                        <Link href={`/muallim/ucenik/${v.najslabijiUcenik.id}?h5pPrilogId=${v.priloziId}`}>
                          <button
                            data-testid={`link-najslabiji-profil-${v.priloziId}`}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            Profil <ChevronRight className="w-3 h-3" />
                          </button>
                        </Link>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {loadingStats && (
          <div className="flex items-center justify-center text-muted-foreground text-sm gap-2 mt-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Učitavam statistiku…
          </div>
        )}
      </div>
    </Layout>
  );
}
