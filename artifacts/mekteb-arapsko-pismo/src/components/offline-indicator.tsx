import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useLanguage } from "@/context/language";

const I18N = {
  bs: {
    offline: "Niste spojeni — radite offline",
    backOnline: "Ponovo ste online · sinhronizacija…",
    updateReady: "Nova verzija aplikacije je spremna",
    refresh: "Osvježi",
  },
  de: {
    offline: "Offline — Sie arbeiten ohne Verbindung",
    backOnline: "Wieder online · Synchronisation…",
    updateReady: "Neue Version verfügbar",
    refresh: "Aktualisieren",
  },
  en: {
    offline: "You are offline — working without connection",
    backOnline: "Back online · syncing…",
    updateReady: "A new app version is ready",
    refresh: "Refresh",
  },
  tr: {
    offline: "Çevrimdışısınız — bağlantı olmadan çalışıyorsunuz",
    backOnline: "Tekrar çevrimiçi · senkronize ediliyor…",
    updateReady: "Yeni uygulama sürümü hazır",
    refresh: "Yenile",
  },
  ar: {
    offline: "غير متصل — تعمل بدون اتصال",
    backOnline: "عاد الاتصال · جارٍ المزامنة…",
    updateReady: "إصدار جديد من التطبيق جاهز",
    refresh: "تحديث",
  },
} as const;

export function OfflineIndicator() {
  const online = useOnlineStatus();
  const { lang } = useLanguage();
  const t = I18N[lang as keyof typeof I18N] ?? I18N.bs;
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      return;
    }
    if (wasOffline) {
      setShowBackOnline(true);
      const timer = window.setTimeout(() => {
        setShowBackOnline(false);
        setWasOffline(false);
      }, 2500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [online, wasOffline]);

  useEffect(() => {
    const handler = () => setUpdateReady(true);
    window.addEventListener("mekteb:pwa-update-available", handler);
    return () => window.removeEventListener("mekteb:pwa-update-available", handler);
  }, []);

  function applyUpdate() {
    const fn = (window as unknown as { __mektebUpdateSW?: () => Promise<void> })
      .__mektebUpdateSW;
    if (fn) {
      void fn();
    } else {
      window.location.reload();
    }
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-3"
      aria-live="polite"
      role="status"
    >
      <AnimatePresence>
        {!online && (
          <motion.div
            key="offline"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span>{t.offline}</span>
          </motion.div>
        )}
        {online && showBackOnline && (
          <motion.div
            key="back-online"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{t.backOnline}</span>
          </motion.div>
        )}
        {updateReady && (
          <motion.div
            key="update"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>{t.updateReady}</span>
            <button
              type="button"
              onClick={applyUpdate}
              className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-white/30"
            >
              {t.refresh}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
