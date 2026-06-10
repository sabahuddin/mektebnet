import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { BMAC_MEMBERSHIP_LINK, trialDaysLeft } from "@/lib/billing";
import { Clock, ExternalLink } from "lucide-react";

/**
 * Globalni baner probnog perioda. Prikazuje se SAMO prijavljenom korisniku koji
 * još nije aktiviran (isActive=false) a ima trial info. Odbrojava preostale dane
 * i nudi crveno dugme "Plati pretplatu" koje vodi direktno na Buy Me a Coffee.
 * Aktivni korisnici (isActive=true, trialUntil očišćen nakon admin aktivacije)
 * ne vide ništa.
 */
export function TrialBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  // Periodični re-render da odbrojavanje preostalih dana ostane tačno i kada
  // korisnik dugo stoji na istoj stranici (npr. trial pređe u istekao).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!user || user.isActive) return null;

  const days = trialDaysLeft(user.trialUntil);
  if (days === null) return null;

  const expired = days <= 0;
  const unit = days === 1 ? t("dan") : t("dana");
  const message = expired
    ? t("Vaš probni period je istekao. Obavite uplatu da nastavite koristiti platformu.")
    : t("Probni period — ostalo još {n} {unit} do uplate.", {
        n: String(days),
        unit,
      });

  return (
    <div
      className={`border-b ${expired ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}
      data-testid="trial-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
        <span
          className={`flex items-center gap-2 text-sm font-bold ${expired ? "text-red-800" : "text-amber-900"}`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          {message}
        </span>
        <a
          href={BMAC_MEMBERSHIP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="trial-pay-btn"
          className="inline-flex items-center gap-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-1.5 shadow-sm transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> {t("Plati pretplatu")}
        </a>
      </div>
    </div>
  );
}
