import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatSeconds } from "@/hooks/use-game-credits";

interface Props {
  startedAt: string | null;
  allowedDurationSec: number;
  onExpire: () => void;
  paused?: boolean;
}

export function GameTimer({ startedAt, allowedDurationSec, onExpire, paused = false }: Props) {
  const [remaining, setRemaining] = useState<number>(allowedDurationSec);

  useEffect(() => {
    if (!startedAt || paused) return;
    const startMs = new Date(startedAt).getTime();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const r = Math.max(0, allowedDurationSec - elapsed);
      setRemaining(r);
      if (r <= 0) onExpire();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAt, allowedDurationSec, paused, onExpire]);

  const lowSeconds = remaining <= 10 && remaining > 0;
  const isCritical = remaining <= 5 && remaining > 0;

  return (
    <div
      data-testid="game-timer"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-extrabold text-lg shadow-sm transition-colors ${
        isCritical ? "bg-red-100 text-red-600 animate-pulse" : lowSeconds ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
      }`}
    >
      <Clock className="w-5 h-5" />
      <span className="tabular-nums">{formatSeconds(remaining)}</span>
    </div>
  );
}
