// Centralizirana billing konfiguracija (Buy Me a Coffee Shop) i pomoćne
// funkcije za probni period. Korisnik bira odgovarajući paket u BMAC Shopu;
// admin nakon provjere uplate ručno aktivira nalog u admin panelu.

export const BMAC_SHOP_LINK = "https://buymeacoffee.com/mekteb/extras";

const BMAC_PRODUCT_IDS = {
  ucenik: {
    bih: 517833,
    dijaspora: 537901,
  },
  porodica: {
    bih: 547250,
    dijaspora: 517837,
  },
  mektebStandard: {
    bih: 547350,
    dijaspora: 547349,
  },
  mektebPro: {
    bih: 547351,
    dijaspora: 547352,
  },
} as const;

type RegistrationType = "ucenik" | "roditelj" | "mekteb";
type MektebPaket = "do100" | "vise100";

/**
 * Direktan BMAC proizvod za odabranu registraciju. BMAC koristi `B` proizvode
 * za BiH i `D` proizvode za dijasporu.
 */
export function bmacRegistrationProductLink(
  registrationType: RegistrationType,
  isBiH: boolean,
  mektebPaket: MektebPaket = "do100",
): string {
  const region = isBiH ? "bih" : "dijaspora";
  const productId =
    registrationType === "ucenik"
      ? BMAC_PRODUCT_IDS.ucenik[region]
      : registrationType === "roditelj"
        ? BMAC_PRODUCT_IDS.porodica[region]
        : mektebPaket === "do100"
          ? BMAC_PRODUCT_IDS.mektebStandard[region]
          : BMAC_PRODUCT_IDS.mektebPro[region];

  return `https://buymeacoffee.com/mekteb/e/${productId}`;
}

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
