import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  isPushOptedIn,
  requestPushPermission,
  disablePush,
  isAppIdResolved,
  isCapacitorNative,
  isPushEnabledLocally,
} from "@/lib/push";
import { useLanguage } from "@/context/language";

function isPushSupportedClient(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative()) return true;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isAllowedOrigin(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative()) return true;
  const host = window.location.hostname;
  return host === "mekteb.net" || host.endsWith(".mekteb.net");
}

type PermState = "default" | "granted" | "denied" | "unsupported";

export function PushToggle() {
  const { t } = useLanguage();
  const supported = isPushSupportedClient();
  const allowedOrigin = isAllowedOrigin();
  // configured se provjerava dinamički: čeka da backend vrati App ID
  const [configured, setConfigured] = useState<boolean>(isAppIdResolved());

  const [enabled, setEnabled] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const native = isCapacitorNative();
  const [perm, setPerm] = useState<PermState>(
    !supported
      ? "unsupported"
      : native
        ? "default"
        : (Notification.permission as PermState),
  );
  const intervalRef = useRef<number | null>(null);

  // Ako build-time App ID nije dostupan, dohvati ga s backenda (jedan fetch)
  useEffect(() => {
    if (configured) return;
    fetch("/api/push/config")
      .then(r => r.ok ? r.json() : null)
      .then((data: { appId?: string } | null) => {
        if (data?.appId) setConfigured(true);
      })
      .catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supported) return;
    // OneSignal init je async u main.tsx — sinhroniziraj status periodično
    // dok ne primijetimo promjenu (npr. nakon što init-a završi ili korisnik
    // dozvoli/odbije permission van app-a).
    const sync = () => {
      try {
        setEnabled(isPushOptedIn() || (native && isPushEnabledLocally()));
        if (!native && typeof Notification !== "undefined") {
          setPerm(Notification.permission as PermState);
        }
      } catch {}
    };
    sync();
    intervalRef.current = window.setInterval(sync, 1500);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [native, supported]);

  const disabledReason: string | null = !supported
    ? t("Tvoj preglednik ne podržava push obavijesti.")
    : !configured
      ? t("Push obavijesti trenutno nisu konfigurisane.")
      : !allowedOrigin
        ? t("Push obavijesti su dostupne samo na mekteb.net.")
        : perm === "denied"
          ? t("Obavijesti su blokirane u postavkama preglednika. Otvori ikonu ključa/lokota u adresnoj traci i dozvoli obavijesti za mekteb.net.")
          : null;

  const canToggle = disabledReason === null && !busy;

  const handleToggle = async () => {
    if (!canToggle) return;
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        setAttemptError(null);
        const ok = await requestPushPermission();
        setEnabled(ok);
        if (typeof Notification !== "undefined") {
          setPerm(Notification.permission as PermState);
        }
        if (!ok) {
          const { lastPushError } = await import("@/lib/push");
          setAttemptError(
            t("Uključivanje nije uspjelo.") + (lastPushError ? ` [${lastPushError}]` : ""),
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const isOn = enabled && (native || perm === "granted") && disabledReason === null;

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          isOn
            ? "bg-mekteb-teal/15 text-mekteb-teal"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        {isOn ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="push-toggle"
            className={`font-extrabold text-foreground ${canToggle ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
          >
            {t("Push obavijesti")}
          </label>
          <button
            id="push-toggle"
            role="switch"
            aria-checked={isOn}
            aria-label={t("Push obavijesti")}
            data-testid="toggle-push-notifications"
            onClick={handleToggle}
            disabled={!canToggle}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              isOn ? "bg-mekteb-teal" : "bg-gray-300"
            } ${canToggle ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isOn ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {t("Primaj obavijesti o novim porukama, novim zadaćama i podsjetnicima — i kad mekteb nije otvoren u pregledniku.")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("Obavijesti se uključuju posebno na svakom uređaju: uključi ih jednom u Android PWA-u i jednom u instaliranom desktop PWA-u.")}
        </p>
        {attemptError && !disabledReason && (
          <p className="text-xs text-amber-700 font-medium mt-2" data-testid="text-push-attempt-error">
            {attemptError}
          </p>
        )}
        {disabledReason && (
          <p
            className="text-xs text-amber-700 font-medium mt-2"
            data-testid="text-push-disabled-reason"
          >
            {disabledReason}
          </p>
        )}
      </div>
    </div>
  );
}
