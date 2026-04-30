import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import h5pBundleUrl from "h5p-standalone/dist/main.bundle.js?url";

let h5pBundleLoadPromise: Promise<void> | null = null;

function loadH5PBundle(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).H5PStandalone?.H5P) return Promise.resolve();
  if (h5pBundleLoadPromise) return h5pBundleLoadPromise;
  h5pBundleLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-h5p-standalone="1"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).H5PStandalone?.H5P) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Greška pri učitavanju H5P biblioteke")),
      );
      return;
    }
    const s = document.createElement("script");
    s.src = h5pBundleUrl;
    s.async = true;
    s.dataset["h5pStandalone"] = "1";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Greška pri učitavanju H5P biblioteke"));
    document.head.appendChild(s);
  });
  return h5pBundleLoadPromise;
}

export interface H5PXapiResult {
  score: number;
  maxScore: number;
}

export interface H5PPlayerProps {
  /** Apsolutni URL do otpakirane H5P arhive (root direktorija sa h5p.json). */
  h5pPath: string;
  /** Stabilan ključ — kad se promijeni, player se re-mountuje (npr. "Pokušaj ponovo"). */
  contentKey?: string | number;
  /** Pozove se kad korisnik završi vježbu (xAPI verb completed/answered sa rezultatom). */
  onCompleted?: (result: H5PXapiResult) => void;
  className?: string;
}

/**
 * Klijentski wrapper oko h5p-standalone (UMD bundle iz npm).
 * Pristup:
 *   - lazy load bundle.js skripte preko Vite ?url importa (samo jednom)
 *   - po mount-u: new H5PStandalone.H5P(el, { h5pJsonPath, frameJs, frameCss })
 *   - xAPI listener: window.H5P.externalDispatcher.on("xAPI", evt => ...)
 *
 * Bezbjednost: SVI score-ovi koje player javi su NEPOVJERLJIVI (klijent ih može
 * trivijalno krivotvoriti). Backend (POST /api/h5p/result) je jedini izvor istine
 * za hasanate i primjenjuje multiplier po pokušaju.
 */
export function H5PPlayer({
  h5pPath,
  contentKey,
  onCompleted,
  className,
}: H5PPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const completedFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let xapiHandler: ((event: any) => void) | null = null;
    completedFiredRef.current = false;
    setError(null);
    setLoading(true);

    const init = async () => {
      try {
        await loadH5PBundle();
        if (cancelled || !containerRef.current) return;
        // Očisti prethodni sadržaj (re-mount na contentKey change).
        containerRef.current.innerHTML = "";
        const w = window as any;
        const H5PCtor = w.H5PStandalone?.H5P;
        if (!H5PCtor) {
          throw new Error("H5P biblioteka nije dostupna nakon učitavanja");
        }
        const frameJsBase = h5pBundleUrl.replace(/\/main\.bundle\.js.*$/, "");
        await new H5PCtor(containerRef.current, {
          h5pJsonPath: h5pPath,
          frameJs: `${frameJsBase}/frame.bundle.js`,
          frameCss: `${frameJsBase}/styles/h5p.css`,
        });
        if (cancelled) return;

        // xAPI listener — registriraj tek nakon što je player inicijaliziran
        // jer h5p-standalone postavlja window.H5P globalno tek tada.
        const dispatcher = w.H5P?.externalDispatcher;
        if (dispatcher && typeof dispatcher.on === "function") {
          xapiHandler = (event: any) => {
            try {
              const stmt = event?.data?.statement;
              if (!stmt) return;
              const verbId: string | undefined = stmt.verb?.id;
              const isCompleted =
                verbId === "http://adlnet.gov/expapi/verbs/completed" ||
                verbId === "http://adlnet.gov/expapi/verbs/answered";
              if (!isCompleted) return;
              // Samo top-level statement (bez context.contextActivities.parent)
              // — sub-questions šalju zasebne "answered" eventove koje ignorišemo.
              const hasParent = !!stmt.context?.contextActivities?.parent?.length;
              if (hasParent) return;
              const raw = stmt.result?.score;
              if (!raw) return;
              const score = Number(raw.raw);
              const maxScore = Number(raw.max);
              if (!Number.isFinite(score) || !Number.isFinite(maxScore)) return;
              if (maxScore <= 0) return;
              if (completedFiredRef.current) return;
              completedFiredRef.current = true;
              onCompleted?.({ score, maxScore });
            } catch (e) {
              console.warn("[H5PPlayer] xAPI handler greška:", e);
            }
          };
          dispatcher.on("xAPI", xapiHandler);
        }
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[H5PPlayer] init error:", e);
        setError(e?.message || "Greška pri inicijalizaciji vježbe");
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      const w = window as any;
      const dispatcher = w.H5P?.externalDispatcher;
      if (xapiHandler && dispatcher && typeof dispatcher.off === "function") {
        try { dispatcher.off("xAPI", xapiHandler); } catch {}
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [h5pPath, contentKey, onCompleted]);

  return (
    <div className={className}>
      {loading && !error && (
        <div className="flex items-center gap-2 text-blue-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Učitavam vježbu...
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          Greška: {error}
        </div>
      )}
      <div ref={containerRef} className="h5p-container" />
    </div>
  );
}
