import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Play, Pause, Square, Repeat } from "lucide-react";
import {
  fetchSurah,
  ayahAudioUrl,
  revelationLabel,
  surahHasBismillahHeader,
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

  const { toast } = useToast();

  // Reprodukcija
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeAyah, setActiveAyah] = useState<number | null>(null); // numberInSurah
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const repeatOneRef = useRef(false);
  repeatOneRef.current = repeatOne;

  // Monotoni brojač za zaštitu od zastarjelih async odgovora (fetch i play()).
  // Svaka promjena sure ili novi play() podiže token; handleri koji se razriješe
  // kasnije provjere da li je njihov token i dalje aktuelan prije setState-a.
  const reqIdRef = useRef(0);
  const playTokenRef = useRef(0);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    playTokenRef.current++; // poništi sve pending play() iz prethodne sure
    setIsLoading(true);
    setError(null);
    setActiveAyah(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    fetchSurah(surahNum)
      .then(({ meta, ayahs }) => {
        if (reqIdRef.current !== reqId) return; // zastario odgovor
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

  const playAyah = useCallback(
    (numberInSurah: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const token = ++playTokenRef.current;
      audio.src = ayahAudioUrl(surahNum, numberInSurah);
      setActiveAyah(numberInSurah);
      // isPlaying se vodi preko onPlay/onPause eventova audio elementa; ovdje
      // hvatamo samo odbijanje play() (npr. blokiran autoplay), uz token-čuvar.
      audio.play().catch(() => {
        if (playTokenRef.current === token) setIsPlaying(false);
      });
      // Skrolaj aktivni ajet u vidno polje
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-ayah="${numberInSurah}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [surahNum],
  );

  const handleEnded = useCallback(() => {
    if (repeatOneRef.current && activeAyah != null) {
      playAyah(activeAyah);
      return;
    }
    if (activeAyah != null && activeAyah < ayahs.length) {
      playAyah(activeAyah + 1);
    } else {
      setIsPlaying(false);
      setActiveAyah(null);
    }
  }, [activeAyah, ayahs.length, playAyah]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else if (activeAyah != null) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      playAyah(1);
    }
  };

  const stop = () => {
    playTokenRef.current++; // poništi pending play()
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setActiveAyah(null);
  };

  const handleAudioError = () => {
    // Greška na učitavanju MP3-a (mreža/404). Resetuj stanje i obavijesti.
    if (activeAyah == null) return;
    setIsPlaying(false);
    toast({
      title: "Audio nije dostupan",
      description: `Učenje za ajet ${activeAyah} se trenutno ne može učitati.`,
      variant: "destructive",
    });
  };

  const showBismillah = meta ? surahHasBismillahHeader(meta.number) : false;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-28">
        {/* Header sure */}
        <div className="mb-5">
          <Link
            href="/kuran"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            Sve sure
          </Link>

          {isLoading ? (
            <Skeleton className="h-28 rounded-3xl" />
          ) : meta ? (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground p-6 text-center">
              <div className="relative z-10">
                <div className="text-xs font-bold uppercase tracking-wider text-white/70">
                  Sura {meta.number} · {revelationLabel(meta.revelationType)} · {meta.numberOfAyahs} ajeta
                </div>
                <div
                  className="text-4xl sm:text-5xl my-2"
                  style={{ fontFamily: "'Amiri Quran', serif" }}
                  dir="rtl"
                >
                  {meta.name.replace(/^سُورَةُ\s*/, "")}
                </div>
                <div className="font-black text-lg">{meta.englishName}</div>
                <div className="text-white/75 text-sm font-semibold">
                  {meta.englishNameTranslation}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive font-semibold text-sm mb-4">
            {error}
          </div>
        )}

        {/* Bismilla */}
        {!isLoading && showBismillah && (
          <div
            className="text-center text-3xl sm:text-4xl text-primary mb-6 leading-loose"
            style={{ fontFamily: "'Amiri Quran', serif" }}
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
            <div dir="rtl" className="text-right leading-[2.4]">
              {ayahs.map((a) => {
                const isActive = activeAyah === a.numberInSurah;
                return (
                  <span
                    key={a.numberInSurah}
                    data-ayah={a.numberInSurah}
                    data-testid={`ajet-${a.numberInSurah}`}
                    onClick={() => playAyah(a.numberInSurah)}
                    className={`cursor-pointer rounded-lg px-1.5 py-0.5 transition-colors ${
                      isActive
                        ? "bg-gold/30 ring-1 ring-gold/50"
                        : "hover:bg-primary/5"
                    }`}
                    style={{
                      fontFamily: "'Amiri Quran', serif",
                      fontSize: "1.9rem",
                      lineHeight: 2.4,
                    }}
                  >
                    {a.text}{" "}
                    <span
                      className={`inline-flex items-center justify-center align-middle mx-1 text-base font-sans font-black rounded-full w-7 h-7 ${
                        isActive
                          ? "bg-gold text-gold-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                      style={{ fontFamily: "'Nunito', sans-serif", fontSize: "0.8rem" }}
                    >
                      {a.numberInSurah}
                    </span>{" "}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigacija prethodna/sljedeća sura */}
        {!isLoading && meta && (
          <div className="flex items-center justify-between mt-6 gap-3">
            {surahNum > 1 ? (
              <Link
                href={`/kuran/${surahNum - 1}`}
                className="flex-1 text-center py-2.5 rounded-xl bg-white border border-card-border font-bold text-sm hover:border-primary/40 transition-colors"
              >
                ← Prethodna sura
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {surahNum < 114 ? (
              <Link
                href={`/kuran/${surahNum + 1}`}
                className="flex-1 text-center py-2.5 rounded-xl bg-white border border-card-border font-bold text-sm hover:border-primary/40 transition-colors"
              >
                Sljedeća sura →
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        )}
      </div>

      {/* Sticky audio kontrole */}
      {!isLoading && meta && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-white/95 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="game-button shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
              data-testid="btn-play-pause"
              aria-label={isPlaying ? "Pauziraj" : "Pusti"}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button
              onClick={stop}
              disabled={activeAyah == null}
              className="shrink-0 w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
              data-testid="btn-stop"
              aria-label="Zaustavi"
            >
              <Square className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-foreground truncate">
                {meta.englishName}
              </div>
              <div className="text-xs text-muted-foreground font-semibold">
                {activeAyah != null ? `Ajet ${activeAyah} / ${meta.numberOfAyahs}` : "Husari Mu'allim"}
              </div>
            </div>
            <button
              onClick={() => setRepeatOne((r) => !r)}
              className={`shrink-0 flex items-center gap-1.5 px-3 h-10 rounded-full font-bold text-xs transition-colors ${
                repeatOne ? "bg-gold/20 text-gold-foreground ring-1 ring-gold/50" : "bg-muted text-muted-foreground"
              }`}
              data-testid="btn-repeat"
              aria-pressed={repeatOne}
              title="Ponavljaj jedan ajet"
            >
              <Repeat className="w-4 h-4" />
              <span className="hidden sm:inline">Ponavljaj</span>
            </button>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={handleAudioError}
        preload="none"
      />
    </Layout>
  );
}
