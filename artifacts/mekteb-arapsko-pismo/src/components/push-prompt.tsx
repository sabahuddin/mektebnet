import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { requestPushPermission, hasBeenPrompted, markPrompted, isCapacitorNative } from "@/lib/push";

const DISMISS_KEY = "mekteb-push-dismissed";

function isAllowedOrigin(): boolean {
  if (typeof window === "undefined") return false;
  // Native Capacitor shell uvijek smije tražiti push (origin je
  // capacitor://localhost / https://localhost — origin allowlist se ne primjenjuje).
  if (isCapacitorNative()) return true;
  const host = window.location.hostname;
  return host === "mekteb.net" || host.endsWith(".mekteb.net");
}

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  // Na native shell-u OS-level push uvijek postoji — nema potrebe za web Notification API-jem.
  if (isCapacitorNative()) return true;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Floating banner koji se pojavljuje nakon login-a, na svim stranicama,
 * dok korisnik ne reaguje (Da/Ne) ili dok već nije dao permission.
 *
 * Logika:
 * - Sakriven ako: nije logiran / nije podržano / origin ≠ mekteb.net /
 *   permission je već granted ili denied / korisnik već dismissao / već promptan
 * - Dvije akcije: "Uključi" (poziva native permission prompt) i "Ne sad" (dismiss)
 */
export function PushPrompt() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appIdReady, setAppIdReady] = useState(false);

  // Dohvati App ID s backenda ako build-time vrijednost nije bila dostupna
  useEffect(() => {
    fetch("/api/push/config")
      .then(r => r.ok ? r.json() : null)
      .then((data: { appId?: string } | null) => {
        if (data?.appId) setAppIdReady(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!appIdReady) return;
    if (!isPushSupported()) return;
    if (!isAllowedOrigin()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY) === "true";
    if (dismissed) return;
    if (hasBeenPrompted()) return;

    // Na native shell-u Notification API ne postoji u Cordova webview-u na isti
    // način — preskačemo provjeru i prepuštamo native plugin-u da odbije ako
    // permission već postoji (idempotent na iOS-u i Android 13+).
    if (!isCapacitorNative() && typeof Notification !== "undefined") {
      const perm = Notification.permission;
      if (perm === "granted" || perm === "denied") return;
    }

    // Mali delay da banner ne iskoči odmah na home — daje korisniku vremena
    // da se snađe nakon login-a.
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  const onEnable = async () => {
    setBusy(true);
    try {
      const ok = await requestPushPermission();
      if (ok) {
        setVisible(false);
      } else {
        localStorage.setItem(DISMISS_KEY, "true");
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDismiss = () => {
    markPrompted();
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 rounded-2xl bg-white border border-mekteb-teal/30 shadow-xl p-4 animate-in slide-in-from-bottom-4">
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
        aria-label={t("Zatvori")}
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-mekteb-teal/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-mekteb-teal" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm">
            {t("Uključi obavijesti")}
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            {t("Primaj obavijesti o novim porukama, zadaćama i podsjetnicima — i kad mekteb nije otvoren u browseru.")}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onEnable}
              disabled={busy}
              className="flex-1 px-3 py-1.5 rounded-full bg-mekteb-teal text-white text-xs font-medium hover:bg-mekteb-teal/90 disabled:opacity-50 transition-colors"
            >
              {busy ? t("Učitavanje...") : t("Uključi")}
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 text-xs hover:bg-gray-50 transition-colors"
            >
              {t("Ne sad")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
