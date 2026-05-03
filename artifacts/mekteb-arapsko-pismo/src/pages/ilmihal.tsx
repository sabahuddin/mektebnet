import { useState, useEffect, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { BookOpen, ChevronRight, Search, ChevronDown, CheckCircle2, Play, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// Koliko prvih lekcija po nivou je otvoreno za neulogovane posjetioce.
// Ostale lekcije zahtijevaju prijavu — klikom dobiju toast.
const GUEST_FREE_LESSONS_PER_NIVO = 5;

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed: number;
  zavrseno?: boolean;
}

export default function IlmihalPage() {
  const { t } = useLanguage();
  const search_ = useSearch();
  const urlNivo = (() => {
    const p = new URLSearchParams(search_);
    const n = p.get("nivo");
    return n ? parseInt(n) : null;
  })();

  const NIVO_LABELS: Record<number, { label: string; color: string; bg: string; border: string; ring: string; fill: string; track: string }> = {
    1: { label: t("ilmihal.nivo1"), color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-300", fill: "bg-emerald-500", track: "bg-emerald-100" },
    2: { label: t("ilmihal.nivo2"), color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", ring: "ring-blue-300", fill: "bg-blue-500", track: "bg-blue-100" },
    3: { label: t("ilmihal.nivo3"), color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", ring: "ring-violet-300", fill: "bg-violet-500", track: "bg-violet-100" },
  };

  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeNivo, setActiveNivo] = useState<number | null>(urlNivo);
  const [collapsed, setCollapsed] = useState<Set<number>>(
    urlNivo ? new Set([1, 2, 3].filter(n => n !== urlNivo)) : new Set()
  );

  const { token, user } = useAuth();
  const { toast } = useToast();
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  // Toast koji se prikaže kad neulogovan posjetilac klikne zaključanu stavku.
  const showLockedToast = () => {
    toast({
      title: "🔒 Samo za registrirane korisnike",
      description: "Prijavite se ili registrujte da biste pristupili svim lekcijama.",
    });
  };

  useEffect(() => {
    apiRequest<Lekcija[]>("GET", "/content/ilmihal", undefined, token || undefined)
      .then(setLekcije)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  // Učitaj listu završenih lekcija iz progress endpointa (Duolingo-style ✓ marker)
  useEffect(() => {
    if (!user) {
      setCompletedIds(new Set());
      return;
    }
    apiRequest<{ completedLessons?: number[] }>(
      "GET",
      `/progress?studentId=${encodeURIComponent(String(user.id))}`,
      undefined,
      token || undefined,
    )
      .then(p => setCompletedIds(new Set(p.completedLessons ?? [])))
      .catch(() => setCompletedIds(new Set()));
  }, [user, token]);

  const displayNivo = (l: Lekcija) => l.nivo;

  const filtered = lekcije.filter(l => {
    if (activeNivo) {
      const dn = displayNivo(l);
      if (dn !== activeNivo) return false;
    }
    if (search && !l.naslov.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce((acc: Record<number, Lekcija[]>, l) => {
    const dn = displayNivo(l);
    if (!acc[dn]) acc[dn] = [];
    acc[dn].push(l);
    return acc;
  }, {});

  for (const n of Object.keys(grouped)) {
    grouped[Number(n)].sort((a, b) => (a.redoslijed ?? 0) - (b.redoslijed ?? 0));
  }

  // Guest unlocked set: računamo iz PUNE liste lekcija (nezavisno od search/filter),
  // sortirano po redoslijedu unutar nivoa, pa uzimamo prvih GUEST_FREE_LESSONS_PER_NIVO
  // ID-jeva po nivou. Ovo sprječava bypass kroz pretragu (architect F7 nalaz #1).
  const guestUnlockedIds = useMemo(() => {
    if (user) return new Set<number>();
    const set = new Set<number>();
    const byNivo: Record<number, Lekcija[]> = {};
    lekcije.forEach(l => {
      const dn = displayNivo(l);
      if (!byNivo[dn]) byNivo[dn] = [];
      byNivo[dn].push(l);
    });
    Object.values(byNivo).forEach(arr => {
      arr.sort((a, b) => (a.redoslijed ?? 0) - (b.redoslijed ?? 0));
      arr.slice(0, GUEST_FREE_LESSONS_PER_NIVO).forEach(l => set.add(l.id));
    });
    return set;
  }, [user, lekcije]);

  const toggleCollapse = (nivo: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(nivo)) next.delete(nivo);
      else next.add(nivo);
      return next;
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("nav.ilmihal")}</h1>
            <p className="text-muted-foreground text-sm">{t("ilmihal.naslov")} — {lekcije.length} {t("ilmihal.lekcija")}</p>
          </div>
        </div>

        {user && lekcije.length > 0 && (() => {
          // Ukupni napredak kroz cijeli Ilmihal (Nivo 1+2+3). Računato iz već
          // dohvaćenih podataka — bez novog API poziva. completedIds dolazi iz
          // GET /progress, lekcije iz /content/ilmihal. filter() koristimo da
          // ne brojimo zastarjele ID-ove koji više ne postoje u katalogu.
          const totalLekcija = lekcije.length;
          const zavrsenoUkupno = lekcije.filter(l => completedIds.has(l.id)).length;
          const procenat = totalLekcija > 0 ? Math.round((zavrsenoUkupno / totalLekcija) * 100) : 0;
          return (
            <div
              className="mb-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 sm:p-5"
              data-testid="card-ukupni-napredak"
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                <p className="text-sm sm:text-base font-bold text-foreground">
                  Završio si <span className="text-emerald-700" data-testid="text-zavrseno-ukupno">{zavrsenoUkupno}</span>
                  <span className="text-muted-foreground"> / {totalLekcija}</span> lekcija
                </p>
                <span
                  className="text-xl sm:text-2xl font-black text-emerald-600 tabular-nums"
                  data-testid="text-procenat-ukupno"
                >
                  {procenat}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
                  style={{ width: `${procenat}%` }}
                  data-testid="bar-ukupni-napredak"
                />
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("ilmihal.pretrazi")} className="pl-10 rounded-xl h-11" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setActiveNivo(null)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${!activeNivo ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border/70 text-muted-foreground hover:bg-muted"}`}>
              {t("common.svi")}
            </button>
            {[1, 2, 3].map(n => {
              const info = NIVO_LABELS[n];
              return (
                <button key={n} onClick={() => setActiveNivo(n === activeNivo ? null : n)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${activeNivo === n ? `${info.bg} ${info.color} ${info.border}` : "bg-white border-border/70 text-muted-foreground hover:bg-muted"}`}>
                  {info.label.split(" – ")[0]}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {([1, 2, 3] as number[]).filter(n => grouped[n]?.length > 0).map(nivo => {
              const info = NIVO_LABELS[nivo];
              const isCollapsed = collapsed.has(nivo);
              const items = grouped[nivo];
              const zavrsenoCount = items.filter(l => completedIds.has(l.id)).length;
              const nextLessonId = items.find(l => !completedIds.has(l.id))?.id ?? null;
              return (
                <div key={nivo} className={`rounded-2xl border-2 ${info.border} overflow-hidden`}>
                  <button
                    onClick={() => toggleCollapse(nivo)}
                    className={`w-full flex items-center justify-between px-5 py-3 ${info.bg} hover:brightness-95 transition-all`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-extrabold uppercase tracking-wider ${info.color}`}>
                        {info.label}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 ${info.color}`}>
                        {user ? `${zavrsenoCount}/${items.length}` : items.length} {t("ilmihal.lekcija")}
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 ${info.color} transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
                  </button>

                  {user && (
                    <div className={`h-1.5 w-full ${info.track}`} aria-hidden="true">
                      <motion.div
                        initial={false}
                        animate={{ width: `${items.length > 0 ? (zavrsenoCount / items.length) * 100 : 0}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`h-full ${info.fill}`}
                      />
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-border/30 bg-white">
                          {items.map((l, i) => {
                            const isDone = completedIds.has(l.id);
                            const isNext = user != null && l.id === nextLessonId;
                            // Guest gating: računato iz pune liste, ne iz lokalnog
                            // indeksa (pretraga ne smije otključati lekcije).
                            const isLocked = !user && !guestUnlockedIds.has(l.id);
                            const innerRow = (
                              <div className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors group ${
                                isLocked
                                  ? "bg-muted/20 hover:bg-muted/40"
                                  : isDone
                                    ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                                    : isNext
                                      ? `${info.bg} hover:brightness-95`
                                      : "hover:bg-muted/40"
                              }`}>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className={`text-xs font-mono w-6 shrink-0 ${isLocked ? "text-muted-foreground/60" : isDone ? "text-emerald-600/70" : "text-muted-foreground"}`}>{i + 1}.</span>
                                  {isLocked ? (
                                    <Lock className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                                  ) : isDone ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  ) : isNext ? (
                                    <span className={`w-4 h-4 rounded-full ${info.bg} border-2 ${info.border} ${info.ring ? "ring-2 " + info.ring : ""} flex items-center justify-center shrink-0`}>
                                      <Play className={`w-2.5 h-2.5 ${info.color} fill-current`} />
                                    </span>
                                  ) : (
                                    <span className="w-4 h-4 rounded-full border-2 border-border/50 shrink-0" />
                                  )}
                                  <span className={`font-semibold transition-all text-sm truncate ${
                                    isLocked
                                      ? "text-muted-foreground/80"
                                      : isDone
                                        ? "text-emerald-800/70 line-through decoration-emerald-400/40"
                                        : isNext
                                          ? `${info.color} font-bold`
                                          : `text-foreground/80 group-hover:${info.color} group-hover:font-bold`
                                  }`}>{l.naslov}</span>
                                  {isNext && !isLocked && (
                                    <span className={`shrink-0 hidden sm:inline-flex text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${info.bg} ${info.color} border ${info.border}`}>
                                      {t("ilmihal.sljedeca")}
                                    </span>
                                  )}
                                  {isDone && !isLocked && (
                                    <span className="shrink-0 hidden sm:inline-flex text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                      {t("ilmihal.zavrseno")}
                                    </span>
                                  )}
                                </div>
                                {isLocked
                                  ? <Lock className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                                  : <ChevronRight className={`w-4 h-4 ${info.color} opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0`} />
                                }
                              </div>
                            );
                            return (
                              <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                                {isLocked ? (
                                  <button
                                    type="button"
                                    onClick={showLockedToast}
                                    aria-label={`${l.naslov} — zaključano, samo za registrirane korisnike`}
                                    aria-disabled="true"
                                    className="w-full text-left"
                                  >
                                    {innerRow}
                                  </button>
                                ) : (
                                  <Link href={`/ilmihal/${l.slug}`}>{innerRow}</Link>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t("ilmihal.nemaLekcija")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
