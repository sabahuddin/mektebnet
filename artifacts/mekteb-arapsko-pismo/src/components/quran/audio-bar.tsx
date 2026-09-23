import { Play, Pause, Square, Repeat } from "lucide-react";
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
  title: string;
  subtitle: string;
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
  title,
  subtitle,
  reciterId,
  onReciterChange,
}: AudioBarProps) {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-emerald-100 bg-white/95 backdrop-blur-md shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-2.5 sm:py-3 grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(240px,1.4fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        <label className="min-w-0 flex flex-col gap-1 text-[11px] font-bold text-muted-foreground">
          {t("Učač")}
          <select
            value={reciterId}
            onChange={(e) => onReciterChange(e.target.value)}
            className="w-full h-9 rounded-xl bg-emerald-50 text-foreground text-xs font-bold px-2 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            data-testid="select-ucac"
          >
            {RECITERS.map((r) => (
              <option key={r.id} value={r.id}>{t(r.label)}</option>
            ))}
          </select>
        </label>

        <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 flex items-center justify-center gap-2 min-w-0">
          <button onClick={onStop} disabled={!canStop}
            className="shrink-0 w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center disabled:opacity-40"
            data-testid="btn-stop" aria-label={t("Zaustavi")}>
            <Square className="w-4 h-4" />
          </button>
          <button onClick={onToggle}
            className="game-button shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
            data-testid="btn-play-pause" aria-label={isPlaying ? t("Pauziraj") : t("Pusti")}>
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>
          <div className="min-w-0 max-w-40 sm:max-w-48 text-left">
            <div className="text-xs font-extrabold text-foreground truncate">{title}</div>
            <div className="text-[11px] text-muted-foreground font-semibold truncate">{subtitle}</div>
          </div>
          <label className="flex flex-col gap-0.5 text-[10px] font-bold text-muted-foreground shrink-0">
            {t("Brzina")}
            <select value={playbackRate} onChange={(e) => onPlaybackRateChange(Number(e.target.value))}
              aria-label={t("Brzina učenja")} data-testid="select-brzina"
              className="h-8 rounded-lg bg-muted text-foreground font-bold px-1 border-0 focus:ring-2 focus:ring-primary/40">
              {[0.5, 0.75, 1, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
            </select>
          </label>
        </div>

        <label className="min-w-0 flex flex-col gap-1 text-[11px] font-bold text-muted-foreground">
          <span className="flex items-center justify-end gap-1"><Repeat className="h-3 w-3" />{t("Ponavljanje ajeta")}</span>
          <select value={repeatCount} onChange={(e) => onRepeatCountChange(Number(e.target.value))}
            aria-label={t("Ponavljanje ajeta")} data-testid="select-ponavljanje"
            className="w-full h-9 rounded-xl bg-emerald-50 text-foreground text-xs font-bold px-2 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
            {Array.from({ length: 10 }, (_, index) => index + 1).map(count =>
              <option key={count} value={count}>{t("{n} puta", { n: String(count) })}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
