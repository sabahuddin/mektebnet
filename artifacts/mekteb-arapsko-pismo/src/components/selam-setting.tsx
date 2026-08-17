import { useEffect, useState } from "react";
import { useLanguage } from "@/context/language";
import { isSelamEnabled, setSelamEnabled, SELAM_PREFERENCE_EVENT } from "@/components/maskota";

export function SelamSetting() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isSelamEnabled());
    sync();
    window.addEventListener(SELAM_PREFERENCE_EVENT, sync);
    return () => window.removeEventListener(SELAM_PREFERENCE_EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setSelamEnabled(next);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/40">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("Pozdrav pri ulasku")}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 ${enabled ? "bg-primary" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
        <div>
          <div className="text-sm font-bold text-foreground">
            {t("Prikaži pozdrav pri ulasku na platformu")}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Pčela sa selamom pri otvaranju platforme")}
          </p>
        </div>
      </div>
    </div>
  );
}