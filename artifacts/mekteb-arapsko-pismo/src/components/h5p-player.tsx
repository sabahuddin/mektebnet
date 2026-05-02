import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import h5pBundleUrl from "h5p-standalone/dist/main.bundle.js?url";

let h5pBundleLoadPromise: Promise<void> | null = null;

class H5PInitError extends Error {
  kind: H5PErrorKind;
  constructor(kind: H5PErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

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
        reject(new H5PInitError("library", "H5P biblioteka se nije mogla učitati")),
      );
      return;
    }
    const s = document.createElement("script");
    s.src = h5pBundleUrl;
    s.async = true;
    s.dataset["h5pStandalone"] = "1";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new H5PInitError("library", "H5P biblioteka se nije mogla učitati"));
    document.head.appendChild(s);
  });
  return h5pBundleLoadPromise;
}

export interface H5PXapiResult {
  score: number;
  maxScore: number;
}

export type H5PErrorKind =
  | "auth"          // 401/403 — sesija istekla ili korisnik nema pristup
  | "not-found"     // 404 — paket obrisan ili nikad ne raspakovan
  | "package"       // h5p.json nedostaje / nevažeći JSON / nedostaju polja
  | "content-type"  // h5p-standalone init pukao u library/preload
  | "library"       // nije se mogla učitati h5p-standalone bundle skripta
  | "unknown";      // sve ostalo (mreža, server greška, neočekivano)

export interface H5PErrorInfo {
  kind: H5PErrorKind;
  message: string;
}

export interface H5PPlayerProps {
  /** Apsolutni URL do otpakirane H5P arhive (root direktorija sa h5p.json). */
  h5pPath: string;
  /** Stabilan ključ — kad se promijeni, player se re-mountuje (npr. "Pokušaj ponovo"). */
  contentKey?: string | number;
  /** Pozove se kad korisnik završi vježbu (xAPI verb completed/answered sa rezultatom). */
  onCompleted?: (result: H5PXapiResult) => void;
  /**
   * True kad je trenutni korisnik muallim/admin koji upravlja prilozima — tada
   * uz prijateljsku poruku pokazujemo i konkretan prijedlog šta provjeriti u
   * Lumi-ju (učenicima ne treba taj tehnički savjet).
   */
  isManager?: boolean;
  className?: string;
}

/**
 * Prevedi sirovu grešku u prijateljsku bosansku poruku sa kategorijom.
 * Razlikujemo tri glavna razloga koja korisnik može razumjeti:
 *   - auth: "prijavite se ponovo"
 *   - package: "uploadujte ponovo iz Lumi-ja"
 *   - content-type: "tip pitanja nije podržan"
 * Sve ostalo padne u "unknown" sa generičkim "pokušajte osvježiti".
 */
function describeError(kind: H5PErrorKind): string {
  switch (kind) {
    case "auth":
      return "Vaša prijava je istekla pa se vježba ne može učitati. Osvježite stranicu i prijavite se ponovo.";
    case "not-found":
      return "Vježba nije pronađena na serveru. Možda je obrisana — obratite se muallimu.";
    case "package":
      return "Ova H5P vježba nije validna i ne može se pokrenuti.";
    case "content-type":
      return "Vježba koristi tip pitanja koji ova verzija ne podržava.";
    case "library":
      return "H5P biblioteka se nije mogla učitati. Provjerite internet vezu i osvježite stranicu.";
    case "unknown":
    default:
      return "Vježba se trenutno ne može učitati. Osvježite stranicu i pokušajte ponovo.";
  }
}

/**
 * Dodatni savjet za muallima koji je vježbu uploadovao. Skriven od učenika
 * (učenik ne može popraviti paket — može samo prijaviti muallimu).
 */
function describeManagerHint(kind: H5PErrorKind): string | null {
  switch (kind) {
    case "package":
      return "Otvorite paket u Lumi-ju, provjerite da se vježba normalno reproducira, izvezite je kao .h5p i ponovo uploadujte.";
    case "content-type":
      return "U Lumi-ju koristite osnovne tipove (Multiple Choice, Drag & Drop, Fill in the Blanks, Question Set, True/False). Egzotični eksperimentalni tipovi ovdje često ne rade.";
    case "not-found":
      return "Provjerite da prilog još uvijek postoji u listi materijala lekcije i da nije obrisan.";
    case "library":
    case "unknown":
      return "Ako se ovo ponavlja, pokušajte uploadovati paket ponovo ili javite tehničkoj podršci.";
    case "auth":
    default:
      return null;
  }
}

/**
 * Pre-flight provjera: skinemo h5p.json iz korijena paketa i odlučimo
 * šta da javimo prije nego pustimo h5p-standalone (čije su native greške
 * neprijateljske, npr. "Cannot read properties of undefined (reading '0')").
 */
async function prefetchAndValidate(h5pPath: string): Promise<void> {
  const base = h5pPath.replace(/\/+$/, "");
  const url = `${base}/h5p.json`;
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include" });
  } catch {
    throw new H5PInitError("unknown", "Nema veze sa serverom");
  }
  if (res.status === 401 || res.status === 403) {
    throw new H5PInitError("auth", `HTTP ${res.status}`);
  }
  if (res.status === 404) {
    throw new H5PInitError("not-found", "h5p.json nije pronađen");
  }
  if (!res.ok) {
    throw new H5PInitError("unknown", `HTTP ${res.status}`);
  }
  let parsed: any;
  try {
    parsed = await res.json();
  } catch {
    throw new H5PInitError("package", "h5p.json nije validan JSON");
  }
  // Minimalne provjere koje hvatuju većinu pokvarenih paketa:
  // mainLibrary i preloadedDependencies su obavezni za init.
  if (!parsed || typeof parsed !== "object") {
    throw new H5PInitError("package", "h5p.json je prazan");
  }
  if (!parsed.mainLibrary || !Array.isArray(parsed.preloadedDependencies)) {
    throw new H5PInitError(
      "package",
      "h5p.json nema obavezna polja (mainLibrary / preloadedDependencies)",
    );
  }
}

/**
 * Klasifikuj sirovu grešku iz h5p-standalone init-a. Gleda message string i
 * heuristički ga svrstava u jednu od poznatih kategorija. h5p-standalone ne
 * baca tipizirane greške pa drugog izbora nema.
 */
function classifyInitError(e: any): H5PErrorKind {
  if (e instanceof H5PInitError) return e.kind;
  const msg = String(e?.message || e || "").toLowerCase();
  if (
    msg.includes("library") ||
    msg.includes("machinename") ||
    msg.includes("preload") ||
    msg.includes("dependency") ||
    msg.includes("semantics")
  ) {
    return "content-type";
  }
  if (
    msg.includes("h5p.json") ||
    msg.includes("content.json") ||
    msg.includes("json") ||
    msg.includes("unexpected token")
  ) {
    return "package";
  }
  if (
    msg.includes("cannot read") ||
    msg.includes("undefined") ||
    msg.includes("null")
  ) {
    // Tipično "Cannot read properties of undefined (reading '0')" iz
    // h5p-standalone — dolazi kad mu nedostaje library JSON ili je content
    // truncated. Tretiraj kao paket greška jer rješenje je re-upload.
    return "package";
  }
  return "unknown";
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
  isManager,
  className,
}: H5PPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorInfo, setErrorInfo] = useState<H5PErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const completedFiredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let xapiHandler: ((event: any) => void) | null = null;
    completedFiredRef.current = false;
    setErrorInfo(null);
    setLoading(true);

    const init = async () => {
      try {
        // 1) Pre-flight — uhvati auth/404/JSON probleme prije nego h5p-standalone
        // baci nečitljivu native grešku.
        await prefetchAndValidate(h5pPath);
        if (cancelled) return;

        await loadH5PBundle();
        if (cancelled || !containerRef.current) return;
        // Očisti prethodni sadržaj (re-mount na contentKey change).
        containerRef.current.innerHTML = "";
        const w = window as any;
        const H5PCtor = w.H5PStandalone?.H5P;
        if (!H5PCtor) {
          throw new H5PInitError("library", "H5P biblioteka nije dostupna nakon učitavanja");
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
        const kind = classifyInitError(e);
        // Sirovu grešku držimo u console-u za debug, ali korisniku NIKAD ne
        // pokazujemo (zadatak #67 — bez "Cannot read properties of undefined").
        console.error("[H5PPlayer] init error:", e, "→ kind:", kind);
        setErrorInfo({ kind, message: describeError(kind) });
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

  const managerHint = errorInfo && isManager ? describeManagerHint(errorInfo.kind) : null;

  return (
    <div className={className}>
      {loading && !errorInfo && (
        <div className="flex items-center gap-2 text-blue-500 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Učitavam vježbu...
        </div>
      )}
      {errorInfo && (
        <div
          role="alert"
          data-testid="h5p-error"
          data-h5p-error-kind={errorInfo.kind}
          className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3 flex gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">Vježba se ne može pokrenuti</p>
            <p>{errorInfo.message}</p>
            {managerHint && (
              <p className="mt-1 pt-2 border-t border-amber-200/70 text-amber-800">
                <span className="font-semibold">Savjet za muallima:</span>{" "}
                {managerHint}
              </p>
            )}
          </div>
        </div>
      )}
      <div ref={containerRef} className="h5p-container" />
    </div>
  );
}
