/**
 * RjecnikContent — renders lesson HTML with:
 *   1. Dictionary tooltips (rjecnik-rijec highlights)
 *   2. Custom audio player enhancement
 *   3. Inline interactive pause blocks (data-lesson-pause="1")
 *
 * Pause blocks are direct children: <div data-lesson-pause="1" data-pause-config="ENCODED_JSON"></div>
 * The HTML is split into segments at those boundaries so:
 *   – Plain HTML segments render as before (with rjecnik + audio enhancements)
 *   – Pause blocks render as React components so they can hold full state
 *   – Each pause block gets a ref to the immediately preceding text segment so
 *     the "scroll to relevant text" link can scroll it into view.
 */

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { processRjecnik, fetchRjecnik, getRjecnikSync } from "@/lib/rjecnik";
import { enhanceAllAudioPlayers } from "@/lib/audio-player";
import { X } from "lucide-react";
import { LessonPause, parsePauseConfig, type PauseProgress } from "@/components/lesson-pause";

interface Props {
  html: string;
  className?: string;
  pauseAnswers?: Record<string, PauseProgress>;
  onPauseProgressChange?: (pauseId: string, progress: PauseProgress) => void;
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

// ─────────────────────────────────────────────
// Split HTML into segments at lesson-pause divs
// ─────────────────────────────────────────────

type HtmlSegment = { kind: "html"; html: string };
type PauseSegment = { kind: "pause"; encodedConfig: string; pauseId: string };
type Segment = HtmlSegment | PauseSegment;

/** Parse raw lesson HTML into alternating text/pause segments. */
function splitAtPauseBlocks(raw: string): Segment[] {
  // Use DOMParser so we handle nested markup correctly
  if (typeof document === "undefined") return [{ kind: "html", html: raw }];

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  const body = doc.body;
  // Standardne akordionske lekcije ovoj komponenti šalju innerHTML sekcije,
  // dok plain/DODATAK lekcije mogu poslati cijeli `.lesson-container`.
  // U tom slučaju pauze su jedan nivo dublje; razdvoji sadržaj unutar wrappera
  // umjesto da cijeli container završi kao jedan neinteraktivan HTML segment.
  const onlyElement = body.children.length === 1 ? body.firstElementChild : null;
  const contentRoot =
    onlyElement?.classList.contains("lesson-container")
      ? onlyElement
      : body;

  const segments: Segment[] = [];
  let currentHtmlParts: string[] = [];

  const flushHtml = () => {
    const joined = currentHtmlParts.join("").trim();
    if (joined) segments.push({ kind: "html", html: joined });
    currentHtmlParts = [];
  };

  for (const child of Array.from(contentRoot.childNodes)) {
    // Check if this is a lesson-pause block
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      (child as Element).getAttribute("data-lesson-pause") === "1"
    ) {
      flushHtml();
      const encodedConfig =
        (child as Element).getAttribute("data-pause-config") ?? "";
      const pauseId = parsePauseConfig(encodedConfig)?.id ?? "";
      segments.push({ kind: "pause", encodedConfig, pauseId });
    } else {
      // Serialise child back to HTML
      const div = document.createElement("div");
      div.appendChild(child.cloneNode(true));
      currentHtmlParts.push(div.innerHTML);
    }
  }

  flushHtml();

  // Fallback: if no segments produced, treat everything as one html block
  if (segments.length === 0) {
    return [{ kind: "html", html: raw }];
  }
  return segments;
}

// ─────────────────────────────────────────────
// Individual HTML segment (with rjecnik + audio)
// ─────────────────────────────────────────────

/**
 * A single rendered HTML segment. Exposes a ref for preceding-text scroll
 * and wires click events for the outer tooltip handler.
 */
function HtmlSegmentBlock({
  html,
  segRef,
  onAudioReady,
  registerContainer,
}: {
  html: string;
  segRef: React.RefObject<HTMLDivElement | null>;
  onAudioReady: (el: HTMLDivElement) => void;
  registerContainer: (el: HTMLDivElement | null) => void;
}) {
  const innerRef = useRef<HTMLDivElement>(null);

  // Merge refs
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      (segRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      registerContainer(el);
    },
    [segRef, registerContainer],
  );

  useEffect(() => {
    if (innerRef.current) {
      onAudioReady(innerRef.current);
    }
  }, [html, onAudioReady]);

  return (
    <div
      ref={setRef}
      className="ilmihal-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function RjecnikContent({ html, className, pauseAnswers, onPauseProgressChange }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [dict, setDict] = useState<Record<string, string>>(getRjecnikSync());

  useEffect(() => {
    fetchRjecnik().then((d) => setDict(d));
  }, []);

  // Process the full raw HTML for rjecnik spans
  const processedHtml = useMemo(() => processRjecnik(html, dict), [html, dict]);

  // Split into segments after rjecnik processing
  const segments = useMemo(
    () => splitAtPauseBlocks(processedHtml),
    [processedHtml],
  );

  // Enhance audio players whenever processed HTML changes
  const handleAudioReady = useCallback((el: HTMLDivElement) => {
    enhanceAllAudioPlayers(el);
  }, []);

  // Keep track of all HTML segment containers for click delegation
  const containerSetRef = useRef<Set<HTMLDivElement>>(new Set());
  const registerContainer = useCallback((el: HTMLDivElement | null) => {
    if (el) containerSetRef.current.add(el);
    // No cleanup needed — the set is not reactive; component lifetime matches
  }, []);

  // ── Tooltip click handler ────────────────────────────────────
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

  // Attach click listener to the outer wrapper which covers all HTML segments
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [handleClick]);

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTooltip(null);
    };
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
        Math.min(
          tooltip.centerX - POPUP_WIDTH / 2,
          window.innerWidth - POPUP_WIDTH - VIEWPORT_PADDING,
        ),
      )
    : 0;

  // Build render list: for each pause segment, carry ref to preceding html segment
  // We need stable refs that survive re-renders, so we create them outside render.
  // We use an array of refs keyed by segment index (stable across same html).
  const segRefsRef = useRef<React.RefObject<HTMLDivElement | null>[]>([]);
  // Ensure we have enough refs
  if (segRefsRef.current.length < segments.length) {
    for (let i = segRefsRef.current.length; i < segments.length; i++) {
      segRefsRef.current.push({ current: null });
    }
  }

  // Find the preceding text ref for a pause at index `pauseIdx` in segments
  const getPrecedingTextRef = (pauseIdx: number): React.RefObject<HTMLDivElement | null> => {
    // Walk backwards to find the last html segment before this pause
    for (let i = pauseIdx - 1; i >= 0; i--) {
      if (segments[i].kind === "html") {
        return segRefsRef.current[i];
      }
    }
    // Fallback: ref to outer container
    return outerRef as React.RefObject<HTMLDivElement | null>;
  };

  return (
    <div ref={outerRef} className={`relative ${className || ""}`}>
      {segments.map((seg, idx) => {
        if (seg.kind === "html") {
          return (
            <HtmlSegmentBlock
              key={idx}
              html={seg.html}
              segRef={segRefsRef.current[idx]}
              onAudioReady={handleAudioReady}
              registerContainer={registerContainer}
            />
          );
        }
        // Pause block
        const precedingTextRef = getPrecedingTextRef(idx);
        const progress = pauseAnswers?.[seg.pauseId];
        return (
          <LessonPause
            key={`${idx}-${seg.encodedConfig}-${progress?.syncKey ?? 0}`}
            encodedConfig={seg.encodedConfig}
            precedingTextRef={precedingTextRef}
            progress={progress}
            onProgressChange={onPauseProgressChange}
          />
        );
      })}

      {/* Rjecnik tooltip portal */}
      {tooltip && typeof document !== "undefined" &&
        createPortal(
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
              <span className="font-extrabold text-teal-700 text-base capitalize">
                {tooltip.word}
              </span>
              <button
                onClick={() => setTooltip(null)}
                className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {tooltip.def}
            </p>
            {tooltip.placeBelow ? (
              <div
                className="absolute w-3 h-3 bg-white border-l-2 border-t-2 border-teal-200 rotate-45"
                style={{
                  left: Math.max(
                    12,
                    Math.min(
                      POPUP_WIDTH - 24,
                      tooltip.centerX - left - 6,
                    ),
                  ),
                  top: -8,
                }}
              />
            ) : (
              <div
                className="absolute w-3 h-3 bg-white border-r-2 border-b-2 border-teal-200 rotate-45"
                style={{
                  left: Math.max(
                    12,
                    Math.min(
                      POPUP_WIDTH - 24,
                      tooltip.centerX - left - 6,
                    ),
                  ),
                  bottom: -8,
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
