import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Cookie, X } from "lucide-react";
import { useLanguage } from "@/context/language";

const CONSENT_KEY = "mekteb-cookie-consent";
const CONSENT_VERSION = "v1";

function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION;
  } catch {
    return false;
  }
}

function saveConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
  } catch {
    /* ignore */
  }
}

/**
 * Informativni banner o kolačićima koji se pojavljuje pri prvom posjetu.
 * Platforma koristi samo neophodne (token prijave) i funkcionalne kolačiće
 * (jezik, veličina fonta, zvuk) — bez oglašavanja ni praćenja — pa je
 * dovoljan informativni pristanak s linkom na politiku kolačića.
 * Izbor se pamti u localStorage (versioniran ključ) i banner se ne ponavlja.
 */
export function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasConsent()) return;
    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const accept = useCallback(() => {
    saveConsent();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      data-testid="cookie-consent"
    >
      <div
        role="region"
        aria-label={t("Obavijest o kolačićima")}
        aria-live="polite"
        className="pointer-events-auto mx-auto max-w-2xl bg-white border-2 border-primary/30 rounded-2xl shadow-2xl shadow-primary/10 p-4 sm:p-5 animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-11 h-11 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <Cookie className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-extrabold text-foreground leading-tight">
                {t("Kolačići na Mekteb platformi")}
              </h3>
              <button
                type="button"
                onClick={accept}
                className="p-1 -mr-1 -mt-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                aria-label={t("Zatvori")}
                data-testid="btn-cookie-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">
              {t("Koristimo neophodne i funkcionalne kolačiće kako bi platforma ispravno radila i pamtila vaše postavke (jezik, font, zvuk). Ne koristimo kolačiće za oglašavanje ni praćenje.")}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                type="button"
                onClick={accept}
                className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl px-5 py-2.5 transition-colors"
                data-testid="btn-cookie-accept"
              >
                {t("Prihvatam")}
              </button>
              <Link
                href="/kolacici"
                className="text-sm font-semibold text-primary hover:underline"
                data-testid="link-cookie-policy"
              >
                {t("Politika kolačića")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
