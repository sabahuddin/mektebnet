import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { HelpCircle, ChevronRight, Trophy, BookOpen, LayoutGrid, FolderTree, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Kviz {
  id: number;
  nivo: number | null;
  variant: string;
  modul: string;
  naslov: string;
  slug: string;
  pitanja: unknown[];
  pitanjaCount?: number;
  kategorija?: string | null;
  lekcijaId?: number | null;
  opis?: string;
}

const KATEGORIJE_LABELS: Record<string, string> = {
  vjerovanje: "Vjerovanje",
  namaz: "Namaz",
  ahlak: "Ahlak",
  historija: "Historija",
  bosna: "Bosna",
  sure: "Sure",
  dove: "Dove",
  halal_haram: "Halal/Haram",
  kuran: "Kur'an",
  sufara: "Sufara",
  opce: "Opće",
};

function KvizCard({ k, nivo, locked, onLockedClick }: { k: Kviz; nivo: number | null; locked?: boolean; onLockedClick?: () => void }) {
  const { t } = useLanguage();
  const NIVO_INFO: Record<number, { label: string; color: string; bg: string; border: string }> = {
    1: { label: `${t("ilmihal.nivo1").split(" – ")[0]}`, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    2: { label: `${t("ilmihal.nivo2").split(" – ")[0]}`, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    3: { label: `${t("ilmihal.nivo3").split(" – ")[0]}`, color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  };

  const info = nivo !== null ? NIVO_INFO[nivo] : {
    label: t("nav.citaonica"), color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200"
  };
  const pitanjaCount = typeof k.pitanjaCount === "number"
    ? k.pitanjaCount
    : (Array.isArray(k.pitanja) ? k.pitanja.length : 0);

  const card = (
    <div className={`${locked ? "bg-muted/30 border-border" : `${info?.bg ?? "bg-white"} ${info?.border ?? "border-border"}`} border-2 rounded-2xl p-5 transition-all cursor-pointer hover:shadow-md group hover:-translate-y-0.5 duration-150 relative overflow-hidden ${locked ? "grayscale-[40%]" : ""}`}>
      <div className="absolute inset-0 bg-honeycomb opacity-30 pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className={`font-bold ${locked ? "text-muted-foreground" : info?.color ?? "text-foreground"} leading-snug`}>{k.naslov}</h3>
          {locked
            ? <Lock className="w-5 h-5 text-muted-foreground/70 shrink-0" />
            : <Trophy className={`w-5 h-5 ${info?.color ?? "text-amber-600"} opacity-50 shrink-0`} />
          }
        </div>
        {k.kategorija && KATEGORIJE_LABELS[k.kategorija] && (
          <span className={`inline-block text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 ${locked ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-800"}`}>
            {t(KATEGORIJE_LABELS[k.kategorija])}
          </span>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {pitanjaCount > 0 ? `${pitanjaCount} ${t("kviz.pitanja")}` : t("kviz.uPripremi")}
          </span>
          <div className={`flex items-center gap-1 ${locked ? "text-muted-foreground" : info?.color ?? "text-amber-700"} font-bold text-sm`}>
            {locked ? t("Zaključano") : t("kviz.pokreni")}
            {locked
              ? <Lock className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            }
          </div>
        </div>
      </div>
    </div>
  );

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        aria-label={`${k.naslov} — zaključano, samo za registrirane korisnike`}
        aria-disabled="true"
        className="w-full text-left"
      >
        {card}
      </button>
    );
  }
  return (
    <Link href={`/kvizovi/${k.slug}`}>
      {card}
    </Link>
  );
}

function pluralKviz(n: number): string {
  const abs = Math.abs(Math.floor(n));
  if (abs % 100 >= 11 && abs % 100 <= 19) return "kvizova";
  if (abs % 10 === 1) return "kviz";
  if (abs % 10 >= 2 && abs % 10 <= 4) return "kviza";
  return "kvizova";
}

type GroupMode = "nivo" | "kategorija";

export default function KvizoviPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  // Task #133: roditelj (porodica) = gost → otključan samo prvi ilmihal kviz.
  const isGuestLike = !user || user.role === "roditelj";
  const [kvizovi, setKvizovi] = useState<Kviz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupMode, setGroupMode] = useState<GroupMode>("nivo");
  const [filterKategorija, setFilterKategorija] = useState<string>("");

  const showLockedToast = () => {
    toast({
      title: t("Samo za registrovane korisnike"),
      description: user?.role === "roditelj"
        ? t("Registrujte se kao poseban korisnik da pristupite svim kvizovima.")
        : t("Prijavite se ili registrujte da pristupite svim kvizovima."),
    });
  };

  const NIVO_INFO: Record<number, { label: string; color: string; bg: string; border: string }> = {
    1: { label: t("ilmihal.nivo1").split(" – ")[0], color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    2: { label: t("ilmihal.nivo2").split(" – ")[0], color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    3: { label: t("ilmihal.nivo3").split(" – ")[0], color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  };

  useEffect(() => {
    apiRequest<Kviz[]>("GET", "/content/kvizovi")
      .then(setKvizovi)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Set kategorija koje se zaista koriste — dropdown filter prikazuje samo
  // kategorije koje imaju barem jedan kviz, da admin ne vidi prazne opcije.
  const dostupneKategorije = useMemo(() => {
    const s = new Set<string>();
    kvizovi.forEach(k => k.kategorija && s.add(k.kategorija));
    return Array.from(s);
  }, [kvizovi]);

  const filtrirani = useMemo(
    () => filterKategorija ? kvizovi.filter(k => k.kategorija === filterKategorija) : kvizovi,
    [kvizovi, filterKategorija]
  );

  const ilmihalKvizovi = filtrirani.filter(k => k.modul === "ilmihal" || !k.modul);
  const knjigaKvizovi = filtrirani.filter(k => k.modul === "knjige");

  const groupedByNivo = ilmihalKvizovi.reduce((acc: Record<number, Kviz[]>, k) => {
    const key = k.nivo ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(k);
    return acc;
  }, {});

  const groupedByKategorija = filtrirani.reduce((acc: Record<string, Kviz[]>, k) => {
    const key = k.kategorija || "_nesvrstano";
    if (!acc[key]) acc[key] = [];
    acc[key].push(k);
    return acc;
  }, {});

  // Guest gating: samo prvi kviz (najmanji ID) je otvoren gostima.
  const unlockedSlugs = useMemo(() => {
    const set = new Set<string>();
    if (isGuestLike) {
      const first = kvizovi
        .filter(k => k.modul === "ilmihal" || !k.modul)
        .sort((a, b) => a.id - b.id)[0];
      if (first) set.add(first.slug);
    }
    return set;
  }, [isGuestLike, kvizovi]);

  const isLocked = (k: Kviz) => isGuestLike && !unlockedSlugs.has(k.slug);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("nav.kvizovi")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("kviz.provjeriZnanje")} — {kvizovi.length} {pluralKviz(kvizovi.length)}
            </p>
          </div>
        </div>

        {/* Filter + grouping toggle. Sakriven dok ima 0 kategorija u podacima. */}
        {dostupneKategorije.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="inline-flex bg-muted rounded-xl p-1">
              <button
                onClick={() => setGroupMode("nivo")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${groupMode === "nivo" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> {t("Po nivou")}
              </button>
              <button
                onClick={() => setGroupMode("kategorija")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${groupMode === "kategorija" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                <FolderTree className="w-3.5 h-3.5" /> {t("Po oblasti")}
              </button>
            </div>
            <select
              value={filterKategorija}
              onChange={e => setFilterKategorija(e.target.value)}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t("Sve oblasti")}</option>
              {dostupneKategorije.map(k => <option key={k} value={k}>{t(KATEGORIJE_LABELS[k] || k)}</option>)}
            </select>
            {filterKategorija && (
              <button onClick={() => setFilterKategorija("")} className="text-sm text-muted-foreground hover:text-foreground underline">
                {t("Očisti filter")}
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : groupMode === "kategorija" ? (
          <div className="flex flex-col gap-8">
            {Object.entries(groupedByKategorija)
              .sort(([a], [b]) => a === "_nesvrstano" ? 1 : b === "_nesvrstano" ? -1 : a.localeCompare(b))
              .map(([kat, list]) => (
                <div key={kat}>
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-700 mb-4">
                    {kat === "_nesvrstano" ? t("Nesvrstano") : t(KATEGORIJE_LABELS[kat] || kat)} — {list.length} {pluralKviz(list.length)}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {list.map((k, i) => (
                      <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <KvizCard k={k} nivo={k.nivo} locked={isLocked(k)} onLockedClick={showLockedToast} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {([1, 2, 3] as number[]).filter(n => groupedByNivo[n]?.length > 0).map(nivo => {
              const info = NIVO_INFO[nivo]!;
              const nivoKvizovi = groupedByNivo[nivo]!;
              return (
                <div key={nivo}>
                  <h2 className={`text-sm font-extrabold uppercase tracking-wider ${info.color} mb-4`}>
                    {info.label} — {nivoKvizovi.length} {pluralKviz(nivoKvizovi.length)}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {nivoKvizovi.map((k, i) => (
                      <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <KvizCard k={k} nivo={k.nivo} locked={isLocked(k)} onLockedClick={showLockedToast} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}

            {knjigaKvizovi.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-rose-600" />
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-600">
                    {t("nav.citaonica")} — {knjigaKvizovi.length} {pluralKviz(knjigaKvizovi.length)}
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {knjigaKvizovi.map((k, i) => (
                    <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <KvizCard k={k} nivo={null} locked={isLocked(k)} onLockedClick={showLockedToast} />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
