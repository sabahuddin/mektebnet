import { Play, Pause, Square, Repeat } from "lucide-react";
import { RECITERS } from "@/lib/quran";
import { useLanguage } from "@/context/language";

interface AudioBarProps {
  isPlaying: boolean;
  onToggle: () => void;
  onStop: () => void;
  canStop: boolean;
  repeatOne: boolean;
  onToggleRepeat: () => void;
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
  repeatOne,
  onToggleRepeat,
  title,
  subtitle,
  reciterId,
  onReciterChange,
}: AudioBarProps) {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-white/95 backdrop-blur-md shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <button
          onClick={onToggle}
          className="game-button shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
          data-testid="btn-play-pause"
          aria-label={isPlaying ? t("Pauziraj") : t("Pusti")}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </button>
        <button
          onClick={onStop}
          disabled={!canStop}
          className="shrink-0 w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          data-testid="btn-stop"
          aria-label={t("Zaustavi")}
        >
          <Square className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-foreground truncate">{title}</div>
          <div className="text-xs text-muted-foreground font-semibold truncate">{subtitle}</div>
        </div>

        {/* Odabir učača */}
        <select
          value={reciterId}
          onChange={(e) => onReciterChange(e.target.value)}
          className="shrink-0 max-w-[8.5rem] sm:max-w-none h-10 rounded-full bg-muted text-foreground text-xs font-bold px-3 pr-7 border-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          data-testid="select-ucac"
          aria-label={t("Učač")}
          title={t("Odaberi učača")}
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {t(r.label)}
            </option>
          ))}
        </select>

        <button
          onClick={onToggleRepeat}
          className={`shrink-0 flex items-center gap-1.5 px-3 h-10 rounded-full font-bold text-xs transition-colors ${
            repeatOne ? "bg-gold/20 text-gold-foreground ring-1 ring-gold/50" : "bg-muted text-muted-foreground"
          }`}
          data-testid="btn-repeat"
          aria-pressed={repeatOne}
          title={t("Ponavljaj jedan ajet")}
        >
          <Repeat className="w-4 h-4" />
          <span className="hidden sm:inline">{t("Ponavljaj")}</span>
        </button>
      </div>
    </div>
  );
}
