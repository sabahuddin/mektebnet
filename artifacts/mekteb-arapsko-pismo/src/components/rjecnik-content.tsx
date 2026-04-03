import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { processRjecnik, fetchRjecnik, getRjecnikSync } from "@/lib/rjecnik";
import { X } from "lucide-react";

interface Props {
  html: string;
  className?: string;
}

interface Tooltip {
  word: string;
  def: string;
  x: number;
  y: number;
}

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
      const containerRect = ref.current?.getBoundingClientRect();
      const x = rect.left - (containerRect?.left || 0) + rect.width / 2;
      const y = rect.top - (containerRect?.top || 0);
      setTooltip({ word, def, x, y });
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
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  return (
    <div ref={ref} className={`relative ${className || ""}`}>
      <div
        className="ilmihal-content"
        dangerouslySetInnerHTML={{ __html: processed }}
      />

      {tooltip && (
        <div
          className="rjecnik-popup absolute z-40 max-w-xs bg-white border-2 border-teal-200 rounded-2xl shadow-xl p-4"
          style={{
            left: Math.max(8, Math.min(tooltip.x - 140, (ref.current?.offsetWidth || 400) - 290)),
            top: tooltip.y - 10,
            transform: "translateY(-100%)",
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
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-8px] w-3 h-3 bg-white border-r-2 border-b-2 border-teal-200 rotate-45" />
        </div>
      )}
    </div>
  );
}
