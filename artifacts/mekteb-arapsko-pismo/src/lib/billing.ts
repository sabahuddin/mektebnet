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
export type MektebPaket = "do100" | "vise100";

const MEKTEB_PRICING = {
  do100: {
    includedMuallims: 1,
    bih: { baseBam: 200, baseEur: 100 },
    dijaspora: { baseEur: 200 },
  },
  vise100: {
    includedMuallims: 5,
    bih: { baseBam: 300, baseEur: 150 },
    dijaspora: { baseEur: 300 },
  },
} as const;

const ADDON_PRICING = {
  bih: { bam: 30, eur: 15, productId: 547355 },
  dijaspora: { eur: 30, productId: 547356 },
} as const;

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

export function bmacMektebAddonDetails(
  mektebPaket: MektebPaket,
  isBiH: boolean,
  requestedMuallims: number,
) {
  const includedMuallims = MEKTEB_PRICING[mektebPaket].includedMuallims;
  const addonCount = Math.max(0, requestedMuallims - includedMuallims);
  const addon = isBiH ? ADDON_PRICING.bih : ADDON_PRICING.dijaspora;

  return {
    includedMuallims,
    addonCount,
    addonLink: `https://buymeacoffee.com/mekteb/e/${addon.productId}`,
    addonPriceLabel: isBiH
      ? `${ADDON_PRICING.bih.bam} BAM (${ADDON_PRICING.bih.eur} €)`
      : `${ADDON_PRICING.dijaspora.eur} €`,
  };
}

export function formatMektebTotalPrice(
  mektebPaket: MektebPaket,
  isBiH: boolean,
  requestedMuallims: number,
): string {
  const { addonCount } = bmacMektebAddonDetails(
    mektebPaket,
    isBiH,
    requestedMuallims,
  );

  if (isBiH) {
    const packagePrice = MEKTEB_PRICING[mektebPaket].bih;
    const addon = ADDON_PRICING.bih;
    return `${packagePrice.baseBam + addonCount * addon.bam} BAM (${packagePrice.baseEur + addonCount * addon.eur} €)`;
  }

  const packagePrice = MEKTEB_PRICING[mektebPaket].dijaspora;
  return `${packagePrice.baseEur + addonCount * ADDON_PRICING.dijaspora.eur} €`;
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
