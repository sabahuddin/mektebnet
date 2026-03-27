import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { BookOpen, ChevronRight, Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed: number;
}

export default function IlmihalPage() {
  const { t } = useLanguage();
  const search_ = useSearch();
  const urlNivo = (() => {
    const p = new URLSearchParams(search_);
    const n = p.get("nivo");
    return n ? parseInt(n) : null;
  })();

  const NIVO_LABELS: Record<number, { label: string; color: string; bg: string; border: string; ring: string }> = {
    1: { label: t("ilmihal.nivo1"), color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-300" },
    2: { label: t("ilmihal.nivo2"), color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", ring: "ring-blue-300" },
    3: { label: t("ilmihal.nivo3"), color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", ring: "ring-violet-300" },
  };

  const [lekcije, setLekcije] = useState<Lekcija[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeNivo, setActiveNivo] = useState<number | null>(urlNivo);
  const [collapsed, setCollapsed] = useState<Set<number>>(
    urlNivo ? new Set([1, 2, 3].filter(n => n !== urlNivo)) : new Set()
  );

  useEffect(() => {
    apiRequest<Lekcija[]>("GET", "/content/ilmihal")
      .then(setLekcije)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const displayNivo = (l: Lekcija) => (l.nivo === 21 ? 2 : l.nivo);

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
                        {items.length} {t("ilmihal.lekcija")}
                      </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 ${info.color} transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
                  </button>

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
                          {items.map((l, i) => (
                            <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                              <Link href={`/ilmihal/${l.slug}`}>
                                <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors group">
                                  <div className="flex items-center gap-3">
                                    <span className="text-muted-foreground text-xs font-mono w-6 shrink-0">{l.redoslijed + 1}.</span>
                                    <span className={`font-semibold text-foreground/80 group-hover:${info.color} group-hover:font-bold transition-all text-sm`}>{l.naslov}</span>
                                  </div>
                                  <ChevronRight className={`w-4 h-4 ${info.color} opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0`} />
                                </div>
                              </Link>
                            </motion.div>
                          ))}
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
