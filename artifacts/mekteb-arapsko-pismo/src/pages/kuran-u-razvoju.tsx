import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { BookOpen, ChevronLeft, Wrench } from "lucide-react";

// Task #133: Kur'an je privremeno zatvoren za SVE korisnike dok se modul ne
// dovrši. Sve rute (/kuran, /kuran/:n, /kuran/stranica/:p) vode ovdje. Stranice
// kuran.tsx / kuran-sura.tsx / kuran-stranica.tsx ostaju u kodu za kasnije.
export default function KuranURazvojuPage() {
  const { t } = useLanguage();
  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground p-8 sm:p-10 text-center">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-3">{t("Kur'an Časni")}</h1>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold backdrop-blur-sm mb-4">
              <Wrench className="w-4 h-4" />
              {t("U razvoju")}
            </div>
            <p className="text-white/90 font-medium max-w-md">
              {t("Kur'an je u razvoju jer još nije sve podešeno.")}
            </p>
          </div>
          <div
            className="pointer-events-none absolute -bottom-6 -left-2 text-[7rem] leading-none font-black text-white/10 select-none"
            aria-hidden="true"
            style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }}
          >
            ﷽
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("Početna")}
          </Link>
        </div>
      </div>
    </Layout>
  );
}
