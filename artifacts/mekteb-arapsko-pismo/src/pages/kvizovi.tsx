import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { HelpCircle, ChevronRight, Trophy, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Kviz {
  id: number;
  nivo: number | null;
  variant: string;
  modul: string;
  naslov: string;
  slug: string;
  pitanja: unknown[];
}

function KvizCard({ k, nivo }: { k: Kviz; nivo: number | null }) {
  const { t } = useLanguage();
  const NIVO_INFO: Record<number, { label: string; color: string; bg: string; border: string }> = {
    1: { label: `${t("ilmihal.nivo1").split(" – ")[0]}`, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    2: { label: `${t("ilmihal.nivo2").split(" – ")[0]}`, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
    3: { label: `${t("ilmihal.nivo3").split(" – ")[0]}`, color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  };

  const info = nivo !== null ? NIVO_INFO[nivo] : {
    label: t("nav.citaonica"), color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200"
  };
  const pitanjaCount = Array.isArray(k.pitanja) ? k.pitanja.length : 0;

  const card = (
    <div className={`${info.bg} ${info.border} border-2 rounded-2xl p-5 transition-all cursor-pointer hover:shadow-md group hover:-translate-y-0.5 duration-150`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className={`font-bold ${info.color} leading-snug`}>{k.naslov}</h3>
        <Trophy className={`w-5 h-5 ${info.color} opacity-50 shrink-0`} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {pitanjaCount > 0 ? `${pitanjaCount} ${t("kviz.pitanja")}` : t("kviz.uPripremi")}
          </span>
        </div>
        <div className={`flex items-center gap-1 ${info.color} font-bold text-sm`}>
          {t("kviz.pokreni")} <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );

  return (
    <Link href={`/kvizovi/${k.slug}`}>
      {card}
    </Link>
  );
}

export default function KvizoviPage() {
  const { t } = useLanguage();
  const [kvizovi, setKvizovi] = useState<Kviz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const ilmihalKvizovi = kvizovi.filter(k => k.modul === "ilmihal" || !k.modul);
  const knjigaKvizovi = kvizovi.filter(k => k.modul === "knjige");

  const grouped = ilmihalKvizovi.reduce((acc: Record<number, Kviz[]>, k) => {
    const key = k.nivo ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(k);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("nav.kvizovi")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("kviz.provjeriZnanje")} — {kvizovi.length} {t("home.kviza")}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {([1, 2, 3] as number[]).filter(n => grouped[n]?.length > 0).map(nivo => {
              const info = NIVO_INFO[nivo];
              const nivoKvizovi = grouped[nivo];
              return (
                <div key={nivo}>
                  <h2 className={`text-sm font-extrabold uppercase tracking-wider ${info.color} mb-4`}>
                    {info.label} — {nivoKvizovi.length} {t("home.kviza")}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {nivoKvizovi.map((k, i) => (
                      <motion.div
                        key={k.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <KvizCard k={k} nivo={k.nivo} />
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
                    {t("nav.citaonica")} — {knjigaKvizovi.length} {t("home.kviza")}
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {knjigaKvizovi.map((k, i) => (
                    <motion.div
                      key={k.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <KvizCard k={k} nivo={null} />
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
