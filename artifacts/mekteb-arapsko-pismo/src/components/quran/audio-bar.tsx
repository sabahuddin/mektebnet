import { Play, Pause, Square } from "lucide-react";
import { Link } from "wouter";
import { RECITERS } from "@/lib/quran";
import { useLanguage } from "@/context/language";

interface AudioBarProps {
  isPlaying: boolean;
  onToggle: () => void;
  onStop: () => void;
  canStop: boolean;
  repeatCount: number;
  onRepeatCountChange: (count: number) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  reciterId: string;
  onReciterChange: (id: string) => void;
}

export function AudioBar({
  isPlaying,
  onToggle,
  onStop,
  canStop,
  repeatCount,
  onRepeatCountChange,
  playbackRate,
  onPlaybackRateChange,
  reciterId,
  onReciterChange,
}: AudioBarProps) {
  const { t } = useLanguage();
  const speeds = [0.5, 0.75, 1, 1.25, 1.5];
  const nextSpeed = () => {
    const index = speeds.indexOf(playbackRate);
    onPlaybackRateChange(speeds[(index + 1) % speeds.length]);
  };
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur-md shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        <div className="col-start-1 row-start-2 md:row-start-1 min-w-0 w-full max-w-[160px] justify-self-end">
          <select
            id="quran-reciter"
            value={reciterId}
            onChange={(e) => onReciterChange(e.target.value)}
            aria-label={t("Učač")}
            className="w-full h-10 rounded-full bg-emerald-50 text-foreground text-xs font-bold px-3 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            data-testid="select-ucac"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>{t(r.label)}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2 row-start-1 md:col-span-1 md:col-start-2 flex items-center justify-center gap-1 sm:gap-2 min-w-0">
          <Link href="/kuran" className="shrink-0 w-[68px] sm:w-[86px] h-10 sm:h-12 rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] sm:text-xs font-extrabold hover:bg-primary/10 flex items-center justify-center text-center whitespace-nowrap" data-testid="link-sure-player">
            {t("Sura")}
          </Link>
          <button onClick={onStop} disabled={!canStop}
            className="game-button shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md hover:bg-red-700 disabled:opacity-90"
            data-testid="btn-stop" aria-label={t("Zaustavi")}>
            <Square className="w-5 h-5" />
          </button>
          <button onClick={onToggle}
            className="game-button shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
            data-testid="btn-play-pause" aria-label={isPlaying ? t("Pauziraj") : t("Pusti")}>
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <button type="button" onClick={nextSpeed}
            aria-label={`${t("Brzina učenja")}: ${playbackRate}X`}
            title={t("Brzina učenja")}
            data-testid="select-brzina"
            className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted text-foreground text-[11px] sm:text-xs font-extrabold tabular-nums flex items-center justify-center hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            {playbackRate}X
          </button>
          <Link href="/kuran/stranica/1" className="shrink-0 w-[68px] sm:w-[86px] h-10 sm:h-12 rounded-full border border-primary/20 bg-primary/5 text-primary text-[11px] sm:text-xs font-extrabold hover:bg-primary/10 flex items-center justify-center text-center whitespace-nowrap" data-testid="link-stranice-player">
            {t("Stranica")}
          </Link>
        </div>

        <div className="col-start-2 row-start-2 md:col-start-3 md:row-start-1 min-w-0 w-full max-w-[160px] justify-self-start">
          <select id="quran-repeat" value={repeatCount} onChange={(e) => onRepeatCountChange(Number(e.target.value))}
            aria-label={t("Ponavljanje ajeta")} data-testid="select-ponavljanje"
            className="w-full h-10 rounded-full bg-emerald-50 text-foreground text-xs font-bold px-3 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
            {Array.from({ length: 10 }, (_, index) => index + 1).map(count =>
              <option key={count} value={count}>{t("{n} puta", { n: String(count) })}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
