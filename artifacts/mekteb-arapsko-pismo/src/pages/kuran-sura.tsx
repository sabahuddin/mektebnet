import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { Skeleton } from "@/components/ui/skeleton";
import { AyahFlow, type FlowAyah } from "@/components/quran/ayah-flow";
import { AudioBar } from "@/components/quran/audio-bar";
import { useQuranAudio, useReciter, type PlayItem } from "@/hooks/use-quran-audio";
import { useFatihaVoice } from "@/hooks/use-fatiha-voice";
import { Mic, Square, Loader2 } from "lucide-react";
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
  const voice = useFatihaVoice();

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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-36 sm:pb-28">
        {isLoading ? (
          <Skeleton className="h-[104px] sm:h-[88px] rounded-2xl mb-3" />
        ) : meta ? (
          <div className="h-[104px] sm:h-[88px] rounded-2xl bg-gradient-to-br from-primary to-teal-700 text-primary-foreground px-3 py-3 sm:px-5 mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold tracking-wide text-white/75 truncate">
                  {t("Sura {broj} · {tip} · {n} ajeta", { broj: String(meta.number), tip: t(revelationLabel(meta.revelationType)), n: String(meta.numberOfAyahs) })}
                </div>
                <h1 className="text-xl sm:text-2xl font-black leading-tight truncate">{nazivSure}</h1>
              </div>
              <div className="max-w-[42%] shrink-0 truncate text-2xl sm:text-3xl leading-normal text-white"
                style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }} dir="rtl">
                {surahArabicDisplayName(meta.name)}
              </div>
          </div>
        ) : null}

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-destructive font-semibold text-sm mb-4">
            {error}
          </div>
        )}

        {surahNum === 1 && !isLoading && meta && (
          <section className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-4" aria-label="Probno praćenje učenja">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-foreground">Uči uz mikrofon <span className="text-xs font-semibold text-muted-foreground">(probno)</span></h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Uči El-Fatihu redom. Prepoznati ajet će se označiti, bez snimanja i slanja glasa.
                </p>
              </div>
              <button
                type="button"
                data-testid="fatiha-voice-toggle"
                disabled={voice.state === "stopping"}
                onClick={() => {
                  if (voice.isActive) voice.stop();
                  else {
                    audio.stop();
                    voice.start();
                  }
                }}
                className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
                aria-pressed={voice.isActive}
              >
                {voice.state === "loading" || voice.state === "stopping"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : voice.isActive ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {voice.isActive ? "Zaustavi" : voice.state === "ready" || voice.state === "done" ? "Pokreni mikrofon" : "Pripremi model"}
              </button>
            </div>
            <p className="mt-2 text-xs font-semibold text-primary" role="status" aria-live="polite">
              {voice.state === "loading" && "Preuzimam model za prepoznavanje (oko 88 MB pri prvom pokretanju)…"}
              {voice.state === "ready" && "Model je spreman. Pritisni „Pokreni mikrofon“ kada si spreman/spremna."}
              {voice.state === "permission" && "Čekam dozvolu za mikrofon…"}
              {voice.state === "listening" && (voice.activeKey
                ? `Slušam – prepoznat ajet ${voice.activeKey.split(":")[1]}.`
                : "Slušam – započni učiti El-Fatihu.")}
              {voice.state === "stopping" && "Završavam prepoznavanje…"}
              {voice.state === "done" && "Učenje je zaustavljeno. Rezultat je probni i nije ocjena učenja."}
            </p>
            {voice.error && <p className="text-xs text-destructive font-semibold mt-2" role="alert">{voice.error}</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Glas se obrađuje na uređaju. Model se preuzima s interneta; ovo nije provjera tedžvida.
              {" "}<a href="https://huggingface.co/muhdur/tilawi-fastconformer-quran" target="_blank" rel="noopener noreferrer" className="underline">O modelu i licenci</a>
            </p>
          </section>
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
            {showBismillah && (
              <div className="text-center text-2xl sm:text-3xl leading-relaxed text-primary mb-5"
                style={{ fontFamily: "'UthmanicHafs', 'Amiri Quran', serif" }} dir="rtl">
                {BISMILLAH}
              </div>
            )}
            <AyahFlow
              ayahs={flowAyahs}
              activeKey={voice.isActive || (voice.state === "done" && !audio.activeKey) ? voice.activeKey : audio.activeKey}
              onAyahClick={(a) => { if (voice.isActive) voice.stop(); audio.playItem(a); }}
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
      {!isLoading && meta && !voice.isActive && (
        <AudioBar
          isPlaying={audio.isPlaying}
          onToggle={audio.togglePlay}
          onStop={audio.stop}
          canStop={audio.activeKey != null}
          repeatCount={audio.repeatCount}
          onRepeatCountChange={audio.setRepeatCount}
          playbackRate={audio.playbackRate}
          onPlaybackRateChange={audio.setPlaybackRate}
          reciterId={reciterId}
          onReciterChange={setReciterId}
        />
      )}

      <audio {...audio.audioProps} />
    </Layout>
  );
}
