import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { processRjecnik, fetchRjecnik, getRjecnikSync } from "@/lib/rjecnik";
import { X } from "lucide-react";

interface Props {
  html: string;
  className?: string;
}

interface Tooltip {
  word: string;
  def: string;
  // Viewport coordinates (for position:fixed in portal)
  centerX: number;
  wordTop: number;
  wordHeight: number;
  placeBelow: boolean;
}

const POPUP_WIDTH = 280;
const APPROX_POPUP_HEIGHT = 140;
const VIEWPORT_PADDING = 8;

export function RjecnikContent({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [dict, setDict] = useState<Record<string, string>>(getRjecnikSync());

  useEffect(() => {
    fetchRjecnik().then(d => setDict(d));
  }, []);

  const processed = useMemo(() => processRjecnik(html, dict), [html, dict]);

  const handleClick = useCallback((e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.classList.contains("rjecnik-rijec")) {
      e.stopPropagation();
      const def = el.getAttribute("data-def") || "";
      const word = el.textContent || "";
      const rect = el.getBoundingClientRect();
      const placeBelow = rect.top < APPROX_POPUP_HEIGHT + 16;
      setTooltip({
        word,
        def,
        centerX: rect.left + rect.width / 2,
        wordTop: rect.top,
        wordHeight: rect.height,
        placeBelow,
      });
    } else if (!el.closest(".rjecnik-popup")) {
      setTooltip(null);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [handleClick]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setTooltip(null); };
    const onScroll = () => setTooltip(null);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Clamp tooltip horizontally inside viewport
  const left = tooltip
    ? Math.max(
        VIEWPORT_PADDING,
        Math.min(tooltip.centerX - POPUP_WIDTH / 2, window.innerWidth - POPUP_WIDTH - VIEWPORT_PADDING)
      )
    : 0;

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <div
        className="ilmihal-content"
        dangerouslySetInnerHTML={{ __html: processed }}
      />

      {tooltip && typeof document !== "undefined" && createPortal(
        <div
          className="rjecnik-popup fixed bg-white border-2 border-teal-200 rounded-2xl shadow-xl p-4"
          style={{
            zIndex: 9999,
            width: POPUP_WIDTH,
            left,
            top: tooltip.placeBelow
              ? tooltip.wordTop + tooltip.wordHeight + 10
              : tooltip.wordTop - 10,
            transform: tooltip.placeBelow ? "none" : "translateY(-100%)",
          }}
          role="tooltip"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-extrabold text-teal-700 text-base capitalize">{tooltip.word}</span>
            <button
              onClick={() => setTooltip(null)}
              className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{tooltip.def}</p>
          {tooltip.placeBelow ? (
            <div
              className="absolute w-3 h-3 bg-white border-l-2 border-t-2 border-teal-200 rotate-45"
              style={{ left: Math.max(12, Math.min(POPUP_WIDTH - 24, tooltip.centerX - left - 6)), top: -8 }}
            />
          ) : (
            <div
              className="absolute w-3 h-3 bg-white border-r-2 border-b-2 border-teal-200 rotate-45"
              style={{ left: Math.max(12, Math.min(POPUP_WIDTH - 24, tooltip.centerX - left - 6)), bottom: -8 }}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
