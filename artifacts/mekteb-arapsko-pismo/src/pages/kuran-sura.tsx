import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { AyahFlow, type FlowAyah } from "@/components/quran/ayah-flow";
import { AudioBar } from "@/components/quran/audio-bar";
import { useQuranAudio, useReciter, type PlayItem } from "@/hooks/use-quran-audio";
import { ChevronLeft } from "lucide-react";
import {
  fetchSurah,
  revelationLabel,
  surahHasBismillahHeader,
  surahBosnianName,
  surahArabicDisplayName,
  BISMILLAH,
  type Ayah,
  type SurahMeta,
} from "@/lib/quran";

export default function KuranSuraPage() {
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
        setError(e?.message || "Greška pri učitavanju.");
      })
      .finally(() => {
        if (reqIdRef.current !== reqId) return;
        setIsLoading(false);
      });
    window.scrollTo({ top: 0 });
  }, [surahNum]);

  const showBismillah = meta ? surahHasBismillahHeader(meta.number) : false;
  const bosanski = surahBosnianName(surahNum);

  const activeAyahNum = audio.activeKey ? Number(audio.activeKey.split(":")[1]) : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-28">
        {/* Header sure */}
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link
            href="/kuran"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Sve sure
          </Link>
          <Link
            href="/kuran/stranica/1"
            className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            Po stranici (Mushaf)
          </Link>
        </div>

        {isLoading ? (
          <Skeleton className="h-28 rounded-3xl mb-6" />
        ) : meta ? (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground p-6 text-center mb-6">
            <div className="relative z-10">
              <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                Sura {meta.number} · {revelationLabel(meta.revelationType)} · {meta.numberOfAyahs} ajeta
              </div>
              <div
                className="text-4xl sm:text-5xl my-2"
                style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }}
                dir="rtl"
              >
                {surahArabicDisplayName(meta.name)}
              </div>
              <div className="font-black text-lg">{bosanski}</div>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive font-semibold text-sm mb-4">
            {error}
          </div>
        )}

        {/* Bismilla */}
        {!isLoading && showBismillah && (
          <div
            className="text-center text-3xl sm:text-4xl text-primary mb-6 leading-loose"
            style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }}
            dir="rtl"
          >
            {BISMILLAH}
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
                ← Sljedeća sura
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {surahNum > 1 ? (
              <Link
                href={`/kuran/${surahNum - 1}`}
                className="flex-1 text-center py-2.5 rounded-xl bg-white border border-card-border font-bold text-sm hover:border-primary/40 transition-colors"
              >
                Prethodna sura →
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
          repeatOne={audio.repeatOne}
          onToggleRepeat={() => audio.setRepeatOne((r) => !r)}
          title={`${surahNum}. ${bosanski}`}
          subtitle={
            activeAyahNum != null ? `Ajet ${activeAyahNum} / ${meta.numberOfAyahs}` : "Odaberi učača i klikni ajet"
          }
          reciterId={reciterId}
          onReciterChange={setReciterId}
        />
      )}

      <audio {...audio.audioProps} />
    </Layout>
  );
}
