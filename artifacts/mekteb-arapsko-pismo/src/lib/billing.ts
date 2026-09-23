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

// Svaki red je jedan Shop proizvod / jedna uplata. Cijene su cijene
// objavljenih proizvoda (varijanta +3 ima zasebnu cijenu, nije 3 × addon).
export const MEKTEB_OFFERS = {
  bih: [
    { paket: "do100", muallims: 1, students: 100, eur: 100, bam: 200, productId: 547350 },
    { paket: "do100", muallims: 2, students: 130, eur: 115, bam: 230, productId: 578827 },
    { paket: "do100", muallims: 3, students: 160, eur: 130, bam: 260, productId: 578828 },
    { paket: "do100", muallims: 4, students: 190, eur: 140, bam: 280, productId: 578830 },
    { paket: "vise100", muallims: 10, students: 500, eur: 150, bam: 300, productId: 547351 },
  ],
  dijaspora: [
    { paket: "do100", muallims: 1, students: 100, eur: 200, productId: 547349 },
    { paket: "do100", muallims: 2, students: 130, eur: 230, productId: 578818 },
    { paket: "do100", muallims: 3, students: 160, eur: 260, productId: 578820 },
    { paket: "do100", muallims: 4, students: 190, eur: 280, productId: 578821 },
    { paket: "vise100", muallims: 10, students: 500, eur: 300, productId: 547352 },
  ],
} as const;

export function mektebOffer(paket: MektebPaket, isBiH: boolean, muallims: number) {
  return MEKTEB_OFFERS[isBiH ? "bih" : "dijaspora"]
    .find(offer => offer.paket === paket && offer.muallims === muallims);
}

export function mektebOfferLink(paket: MektebPaket, isBiH: boolean, muallims: number): string | null {
  const offer = mektebOffer(paket, isBiH, muallims);
  return offer ? `https://buymeacoffee.com/mekteb/e/${offer.productId}` : null;
}

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

export function formatMektebTotalPrice(
  mektebPaket: MektebPaket,
  isBiH: boolean,
  requestedMuallims: number,
): string {
  const offer = mektebOffer(mektebPaket, isBiH, requestedMuallims);
  if (!offer) throw new Error("Nema proizvoda za odabrani broj muallima");
  return "bam" in offer ? `${offer.bam} BAM (${offer.eur} €)` : `${offer.eur} €`;
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
