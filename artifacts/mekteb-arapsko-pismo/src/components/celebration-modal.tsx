import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Maskota } from "@/components/maskota";

export interface CelebrationData {
  isRepeat: boolean;
  hasanatGained: number;
  totalHasanat: number;
  previousHasanat: number;
  streakDays: number;
  streakIncreased: boolean;
}

function useCountUp(target: number, durationMs: number, start: number, active: boolean) {
  const [value, setValue] = useState(start);
  useEffect(() => {
    if (!active) return;
    if (target === start) {
      setValue(target);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= 0) {
      setValue(target);
      return;
    }
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, start, durationMs, active]);
  return value;
}

export function CelebrationModal({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  const animatedHasanat = useCountUp(
    data.totalHasanat,
    1400,
    data.isRepeat ? data.totalHasanat : data.previousHasanat,
    true,
  );

  // Auto-dismiss after ~2.5s
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  // Keyboard: Esc/Enter/Space closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="dialog"
      aria-live="polite"
      aria-label="Završeno"
      data-testid="celebration-modal"
    >
      <motion.div
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-white via-amber-50 to-teal-50 px-6 py-7 shadow-2xl ring-1 ring-amber-200/60 text-center"
        initial={{ scale: 0.6, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        {(() => {
          const reduce =
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          return (
            <motion.div
              className="mx-auto"
              initial={reduce ? false : { scale: 0, rotate: -25, y: -10 }}
              animate={reduce ? undefined : { scale: 1, rotate: 0, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.1 }}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 1.6, repeat: 1, ease: "easeInOut", delay: 0.4 }}
              >
                <Maskota varijanta={data.isRepeat ? "knjiga" : "bravo"} size={120} className="mx-auto drop-shadow-md" />
              </motion.div>
            </motion.div>
          );
        })()}

        {data.isRepeat ? (
          <>
            <h3 className="mt-4 text-xl font-extrabold text-foreground">
              Već si završio/la — bravo što ponavljaš!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ponavljanje je majka znanja. Nastavi tako! 💪
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/70 border border-amber-200 px-4 py-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-foreground">
                Ukupno {data.totalHasanat} hasanata
              </span>
            </div>
          </>
        ) : (
          <>
            <h3 className="mt-4 text-xl font-extrabold text-foreground">
              Bravo! Završeno
            </h3>
            <motion.div
              className="mt-3 flex items-baseline justify-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wide">
                +{data.hasanatGained}
              </span>
              <span className="text-3xl font-extrabold text-foreground tabular-nums">
                {animatedHasanat}
              </span>
              <span className="text-sm font-bold text-muted-foreground">hasanata</span>
            </motion.div>

            <motion.div
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-white/70 border border-orange-200 px-4 py-1.5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 320, damping: 18 }}
            >
              <span className="text-lg" aria-hidden="true">🔥</span>
              <span className="text-sm font-bold text-foreground">
                {data.streakDays} {data.streakDays === 1 ? "dan" : "dana"} zaredom
              </span>
              {data.streakIncreased && (
                <motion.span
                  className="ml-1 text-xs font-extrabold text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  +1 dan!
                </motion.span>
              )}
            </motion.div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          Klikni bilo gdje za dalje
        </button>
      </motion.div>
    </motion.div>
  );
}
