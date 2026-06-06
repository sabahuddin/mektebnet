import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { AyahFlow, type FlowAyah } from "@/components/quran/ayah-flow";
import { AudioBar } from "@/components/quran/audio-bar";
import { useQuranAudio, useReciter, type PlayItem } from "@/hooks/use-quran-audio";
import { ChevronLeft } from "lucide-react";
import {
  fetchPage,
  surahBosnianName,
  QURAN_PAGES,
  type PageAyah,
} from "@/lib/quran";

export default function KuranStranicaPage() {
  const { p } = useParams<{ p: string }>();
  const pageNum = Math.max(1, Math.min(QURAN_PAGES, parseInt(p || "1", 10) || 1));
  const [, navigate] = useLocation();

  const [ayahs, setAyahs] = useState<PageAyah[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState(String(pageNum));

  const reqIdRef = useRef(0);
  const { reciterId, setReciterId } = useReciter();

  const flowAyahs: FlowAyah[] = useMemo(
    () =>
      ayahs.map((a) => ({
        surah: a.surah,
        numberInSurah: a.numberInSurah,
        text: a.text,
        surahArabicName: a.surahArabicName,
      })),
    [ayahs],
  );
  const items: PlayItem[] = useMemo(
    () => ayahs.map((a) => ({ surah: a.surah, numberInSurah: a.numberInSurah })),
    [ayahs],
  );

  const audio = useQuranAudio(items, reciterId);

  useEffect(() => {
    setPageInput(String(pageNum));
    const reqId = ++reqIdRef.current;
    setIsLoading(true);
    setError(null);
    fetchPage(pageNum)
      .then((list) => {
        if (reqIdRef.current !== reqId) return;
        setAyahs(list);
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
  }, [pageNum]);

  const goToPage = (target: number) => {
    const t = Math.max(1, Math.min(QURAN_PAGES, target || 1));
    navigate(`/kuran/stranica/${t}`);
  };

  const active = audio.activeKey
    ? { surah: Number(audio.activeKey.split(":")[0]), ayah: Number(audio.activeKey.split(":")[1]) }
    : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-28">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link
            href="/kuran"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Sve sure
          </Link>
        </div>

        {/* Odabir stranice */}
        <div className="rounded-3xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground p-5 mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-white/70 text-center mb-3">
            Mushaf · stranica {pageNum} / {QURAN_PAGES}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => goToPage(pageNum - 1)}
              disabled={pageNum <= 1}
              className="px-3 h-10 rounded-xl bg-white/15 hover:bg-white/25 font-bold text-sm disabled:opacity-40 transition-colors"
              data-testid="btn-prethodna-stranica"
            >
              ← Prethodna
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                goToPage(parseInt(pageInput, 10));
              }}
              className="flex items-center gap-1.5"
            >
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className="w-16 h-10 rounded-xl bg-white text-foreground text-center font-extrabold focus:outline-none focus:ring-2 focus:ring-gold"
                data-testid="input-stranica"
                aria-label="Broj stranice"
              />
              <button
                type="submit"
                className="px-3 h-10 rounded-xl bg-gold text-gold-foreground font-bold text-sm"
                data-testid="btn-idi-stranica"
              >
                Idi
              </button>
            </form>
            <button
              onClick={() => goToPage(pageNum + 1)}
              disabled={pageNum >= QURAN_PAGES}
              className="px-3 h-10 rounded-xl bg-white/15 hover:bg-white/25 font-bold text-sm disabled:opacity-40 transition-colors"
              data-testid="btn-sljedeca-stranica"
            >
              Sljedeća →
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive font-semibold text-sm mb-4">
            {error}
          </div>
        )}

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
              showSurahDividers
            />
          </div>
        )}
      </div>

      {!isLoading && ayahs.length > 0 && (
        <AudioBar
          isPlaying={audio.isPlaying}
          onToggle={audio.togglePlay}
          onStop={audio.stop}
          canStop={audio.activeKey != null}
          repeatOne={audio.repeatOne}
          onToggleRepeat={() => audio.setRepeatOne((r) => !r)}
          title={`Stranica ${pageNum}`}
          subtitle={
            active != null
              ? `${surahBosnianName(active.surah)} · ajet ${active.ayah}`
              : "Odaberi učača i klikni ajet"
          }
          reciterId={reciterId}
          onReciterChange={setReciterId}
        />
      )}

      <audio {...audio.audioProps} />
    </Layout>
  );
}
