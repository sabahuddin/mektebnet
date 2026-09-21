// Centralizirana billing konfiguracija (Buy Me a Coffee Shop) i pomoćne
// funkcije za probni period. Korisnik bira odgovarajući paket u BMAC Shopu;
// admin nakon provjere uplate ručno aktivira nalog u admin panelu.

export const BMAC_SHOP_LINK = "https://buymeacoffee.com/mekteb/extras";

/**
 * Broj preostalih dana probnog perioda (zaokruženo naviše). Vraća `null` ako
 * korisnik nema postavljen `trialUntil` (npr. već aktivirana pretplata).
 * Negativna/0 vrijednost znači da je probni period istekao.
 */
export function trialDaysLeft(trialUntil?: string | null): number | null {
  if (!trialUntil) return null;
  const end = new Date(trialUntil).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
