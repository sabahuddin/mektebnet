import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { Skeleton } from "@/components/ui/skeleton";
import { AyahFlow, type FlowAyah } from "@/components/quran/ayah-flow";
import { AudioBar } from "@/components/quran/audio-bar";
import { useQuranAudio, useReciter, type PlayItem } from "@/hooks/use-quran-audio";
import { ChevronLeft } from "lucide-react";
import {
  fetchSurah,
  revelationLabel,
  surahHasBismillahHeader,
  surahName,
  surahArabicDisplayName,
  BISMILLAH,
  type Ayah,
  type SurahMeta,
} from "@/lib/quran";

export default function KuranSuraPage() {
  const { t, lang } = useLanguage();
  const { n } = useParams<{ n: string }>();
  const surahNum = Math.max(1, Math.min(114, parseInt(n || "1", 10) || 1));

  const [meta, setMeta] = useState<SurahMeta | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const { reciterId, setReciterId } = useReciter();

  const flowAyahs: FlowAyah[] = useMemo(
    () => ayahs.map((a) => ({ surah: surahNum, numberInSurah: a.numberInSurah, text: a.text })),
    [ayahs, surahNum],
  );
  const items: PlayItem[] = useMemo(
    () => ayahs.map((a) => ({ surah: surahNum, numberInSurah: a.numberInSurah })),
    [ayahs, surahNum],
  );

  const audio = useQuranAudio(items, reciterId);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    setIsLoading(true);
    setError(null);
    fetchSurah(surahNum)
      .then(({ meta, ayahs }) => {
        if (reqIdRef.current !== reqId) return;
        setMeta(meta);
        setAyahs(ayahs);
      })
      .catch((e) => {
        if (reqIdRef.current !== reqId) return;
        setError(e?.message || t("Greška pri učitavanju."));
      })
      .finally(() => {
        if (reqIdRef.current !== reqId) return;
        setIsLoading(false);
      });
    window.scrollTo({ top: 0 });
  }, [surahNum]);

  const showBismillah = meta ? surahHasBismillahHeader(meta.number) : false;
  const nazivSure = surahName(surahNum, lang);

  const activeAyahNum = audio.activeKey ? Number(audio.activeKey.split(":")[1]) : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-44 sm:pb-32">
        {/* Header sure */}
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link
            href="/kuran"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("Sve sure")}
          </Link>
          <Link
            href="/kuran/stranica/1"
            className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            {t("Po stranici (Mushaf)")}
          </Link>
        </div>

        {isLoading ? (
          <Skeleton className="h-32 rounded-3xl mb-4" />
        ) : meta ? (
          <div className="rounded-3xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground px-5 py-4 sm:px-6 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <div className="min-w-0">
                <div className="text-[11px] font-bold tracking-wide text-white/75">
                  {t("Sura {broj} · {tip} · {n} ajeta", { broj: String(meta.number), tip: t(revelationLabel(meta.revelationType)), n: String(meta.numberOfAyahs) })}
                </div>
                <h1 className="text-xl sm:text-2xl font-black leading-tight">{nazivSure}</h1>
              </div>
              <div className="text-3xl sm:text-4xl leading-normal text-white"
                style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }} dir="rtl">
                {surahArabicDisplayName(meta.name)}
              </div>
            </div>
            {showBismillah && (
              <div className="mt-2 pt-2 border-t border-white/20 text-center text-2xl sm:text-3xl leading-relaxed text-white"
                style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }} dir="rtl">
                {BISMILLAH}
              </div>
            )}
          </div>
        ) : null}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive font-semibold text-sm mb-4">
            {error}
          </div>
        )}

        {/* Ajeti */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-white border border-card-border p-4 sm:p-6">
            <AyahFlow
              ayahs={flowAyahs}
              activeKey={audio.activeKey}
              onAyahClick={(a) => audio.playItem(a)}
            />
          </div>
        )}

        {/* Navigacija prethodna/sljedeća sura */}
        {!isLoading && meta && (
          <div className="flex items-center justify-between mt-6 gap-3">
            {surahNum < 114 ? (
              <Link
                href={`/kuran/${surahNum + 1}`}
                className="flex-1 text-center py-2.5 rounded-xl bg-white border border-card-border font-bold text-sm hover:border-primary/40 transition-colors"
              >
                {t("← Sljedeća sura")}
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {surahNum > 1 ? (
              <Link
                href={`/kuran/${surahNum - 1}`}
                className="flex-1 text-center py-2.5 rounded-xl bg-white border border-card-border font-bold text-sm hover:border-primary/40 transition-colors"
              >
                {t("Prethodna sura →")}
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        )}
      </div>

      {/* Sticky audio kontrole */}
      {!isLoading && meta && (
        <AudioBar
          isPlaying={audio.isPlaying}
          onToggle={audio.togglePlay}
          onStop={audio.stop}
          canStop={audio.activeKey != null}
          repeatCount={audio.repeatCount}
          onRepeatCountChange={audio.setRepeatCount}
          playbackRate={audio.playbackRate}
          onPlaybackRateChange={audio.setPlaybackRate}
          title={`${surahNum}. ${nazivSure}`}
          subtitle={
            activeAyahNum != null ? t("Ajet {n} / {ukupno}", { n: String(activeAyahNum), ukupno: String(meta.numberOfAyahs) }) : t("Odaberi učača i klikni ajet")
          }
          reciterId={reciterId}
          onReciterChange={setReciterId}
        />
      )}

      <audio {...audio.audioProps} />
    </Layout>
  );
}
