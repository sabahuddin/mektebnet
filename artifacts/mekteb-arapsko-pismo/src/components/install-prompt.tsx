import { useEffect, useState, useCallback } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";
import { useLanguage } from "@/context/language";

const DISMISS_KEY = "mekteb-install-dismissed-at";
const DISMISS_DAYS = 7;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  return false;
}

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  // iPad na iOS 13+ se prijavljuje kao Mac — provjeri i touch.
  const isIPad = /Mac/.test(ua) && "ontouchend" in document;
  return /iPhone|iPad|iPod/i.test(ua) || isIPad;
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(window.navigator.userAgent || "");
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    return ageDays < DISMISS_DAYS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Floating banner koji nudi instalaciju PWA aplikacije:
 * - Android Chrome / Edge: hvata `beforeinstallprompt` i pokazuje native prompt
 *   na klik na "Instaliraj".
 * - iOS Safari: API ne postoji, pokazujemo statičke instrukcije
 *   (Share → "Add to Home Screen").
 * - Sakriven ako: već instaliran (standalone), Capacitor native shell,
 *   nedavno dismissan, ili nismo na mobilnom uređaju.
 */
export function InstallPrompt() {
  const { t } = useLanguage();
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);
  const [iosExpanded, setIosExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || isCapacitorNative()) return;
    if (recentlyDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);

    const installedHandler = () => {
      setVisible(false);
      setDeferred(null);
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", installedHandler);

    // iOS fallback — nema beforeinstallprompt, pokaži uputstvo nakon kratkog
    // odgađanja (da korisnik prvo vidi sadržaj).
    let iosTimer: number | undefined;
    if (isIOS() && !isStandalone()) {
      iosTimer = window.setTimeout(() => {
        setShowIosHelp(true);
        setVisible(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
      window.removeEventListener("appinstalled", installedHandler);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        markDismissed();
        setVisible(false);
      }
    } catch {
      setVisible(false);
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setVisible(false);
  }, []);

  if (!visible) return null;

  // Sakrij i ako je viewport definitivno desktop bez install API-ja —
  // ostavi samo Android (BIP) i iOS (uputstvo) prikazane.
  const onMobile = isAndroid() || isIOS();
  if (!onMobile && !deferred) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      data-testid="install-prompt"
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-white border-2 border-amber-300 rounded-2xl shadow-2xl shadow-amber-500/20 p-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-white shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-extrabold text-foreground leading-tight">
                {t("Instaliraj Mekteb na svoj telefon")}
              </h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 -mr-1 -mt-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                aria-label={t("Sakrij")}
                data-testid="btn-install-dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showIosHelp && !deferred ? (
              <>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  {t("Otvori app jednim dodirom — radi i bez interneta.")}
                </p>
                {iosExpanded ? (
                  <ol className="mt-3 text-xs text-foreground/90 space-y-2 leading-snug">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">1</span>
                      <span>{t("Dodirni dugme")} <Share className="inline w-3.5 h-3.5 mx-0.5 align-text-bottom" /> <strong>{t("Podijeli")}</strong> {t("u dnu Safarija.")}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">2</span>
                      <span>{t("Odaberi")} <Plus className="inline w-3.5 h-3.5 mx-0.5 align-text-bottom" /> <strong>{t("Dodaj na početni ekran")}</strong>.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">3</span>
                      <span>{t("Potvrdi sa")} <strong>{t("Dodaj")}</strong>.</span>
                    </li>
                  </ol>
                ) : null}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setIosExpanded(s => !s)}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl py-2.5 transition-colors"
                    data-testid="btn-install-ios-help"
                  >
                    {iosExpanded ? t("Sakrij upute") : t("Pokaži kako")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {t("Ne sad")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  {t("Brži pristup, radi i bez interneta, otvara se kao prava aplikacija.")}
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={!deferred}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl py-2.5 transition-colors"
                    data-testid="btn-install-accept"
                  >
                    <Download className="w-4 h-4" />
                    {t("Instaliraj")}
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
                    data-testid="btn-install-later"
                  >
                    {t("Ne sad")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
