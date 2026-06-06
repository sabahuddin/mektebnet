import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Search, ChevronLeft } from "lucide-react";
import {
  fetchSurahList,
  revelationLabel,
  surahBosnianName,
  type SurahMeta,
} from "@/lib/quran";

export default function KuranPage() {
  const [sure, setSure] = useState<SurahMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetchSurahList()
      .then(setSure)
      .catch((e) => setError(e?.message || "Greška pri učitavanju."))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sure;
    return sure.filter(
      (x) =>
        surahBosnianName(x.number).toLowerCase().includes(s) ||
        x.englishName.toLowerCase().includes(s) ||
        x.englishNameTranslation.toLowerCase().includes(s) ||
        String(x.number).includes(s) ||
        x.name.includes(q.trim()),
    );
  }, [sure, q]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground p-6 sm:p-8 mb-6">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black leading-tight">Kur'an Časni</h1>
                <p className="text-white/80 text-sm font-semibold">
                  Učenje uz Husari Mu'allim — prouči pa ponovi
                </p>
              </div>
            </div>
            <p className="text-white/85 text-sm mt-3 max-w-xl">
              Odaberi suru, klikni na ajet i slušaj učenje. Aktivni ajet se boji i
              prati se dok se uči.
            </p>
          </div>
          <div
            className="pointer-events-none absolute -bottom-6 -left-2 text-[7rem] leading-none font-black text-white/10 select-none"
            aria-hidden="true"
            style={{ fontFamily: "'Amiri Quran', serif" }}
          >
            ﷽
          </div>
        </div>

        {/* Pretraga + ulaz u Mushaf (po stranici) */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Traži suru (npr. El-Bekara, Ja-Sin, 36...)"
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-border bg-white text-foreground font-semibold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
              data-testid="input-trazi-suru"
            />
          </div>
          <Link
            href="/kuran/stranica/1"
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white border border-card-border font-bold text-sm text-foreground hover:border-primary/40 hover:shadow-md transition-all"
            data-testid="link-mushaf-stranice"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            Po stranici (Mushaf)
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive font-semibold text-sm mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((s, i) => (
              <motion.div
                key={s.number}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.2) }}
              >
                <Link
                  href={`/kuran/${s.number}`}
                  className="group flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-card-border hover:border-primary/40 hover:shadow-md transition-all"
                  data-testid={`link-sura-${s.number}`}
                >
                  {/* Broj sure u saću */}
                  <div className="relative shrink-0 w-12 h-12 flex items-center justify-center">
                    <span className="absolute inset-0 rounded-xl bg-primary/10 rotate-45 group-hover:bg-primary/15 transition-colors" />
                    <span className="relative font-black text-primary">{s.number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-foreground truncate">
                        {surahBosnianName(s.number)}
                      </span>
                      <span
                        className="text-primary text-xl shrink-0"
                        style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }}
                        dir="rtl"
                      >
                        {s.name.replace(/^سُورَةُ\s*/, "")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold mt-0.5">
                      <span>{revelationLabel(s.revelationType)}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span>{s.numberOfAyahs} ajeta</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Početna
          </Link>
        </div>
      </div>
    </Layout>
  );
}
