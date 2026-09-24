// Šta jedan arapski zapis traži od djeteta da bi ga moglo pročitati.
//
// Ovo je temelj novog okvira Sufare. Dosad je za svaku lekciju neko ručno
// pisao spisak riječi, pa se dešavalo da zadnja lekcija bude lakša od šeste.
// Umjesto toga: svaki zapis se izmjeri — koje harfove traži i koje znakove —
// pa se sam smjesti u prvu lekciju u kojoj dijete sve to već zna.
//
// Zbog toga fond riječi može doći odakle god (snimci, sufara, muallim), a
// raspored po lekcijama ostaje tačan bez ičije pažnje.

/** Znak koji dijete mora znati da bi zapis pročitalo. */
export type Znak = "fetha" | "kesra" | "damma" | "sukun" | "tesdid" | "tenvin" | "medd";

const FETHA = "َ";
const KESRA = "ِ";
const DAMMA = "ُ";
const SUKUN = "ْ";
const TESDID = "ّ";
const TENVIN = ["ً", "ٌ", "ٍ"];
const ELIF = "ا";
const VAV = "و";
const JA = "ي";
const ELIF_MEDDA = "آ";
const ELIF_HANDŽER = "ٰ";

const HARF = /[ء-يٱ]/;
const OZNAKA = /[ً-ْٰ]/;

/**
 * Sufara piše tešdid prije samoglasnika (0651 pa 064E). Isti zapis unesen
 * obrnutim redom izgleda identično, a druga je niska — i traženje snimka po
 * ključu ga ne nađe. Zato svaki zapis prolazi kroz ovo prije upotrebe.
 */
export function normalizirajZapis(zapis: string): string {
  return zapis
    .normalize("NFC")
    .replace(/([ً-ُِ])(ّ)/g, "$2$1")
    .trim();
}

/** Harfovi koje zapis koristi, bez ponavljanja i bez oznaka. */
export function harfoviZapisa(zapis: string): string[] {
  return [...new Set(Array.from(normalizirajZapis(zapis)).filter((z) => HARF.test(z)))];
}

/** Koliko harfova zapis ima (oznake se ne broje). */
export function duzinaZapisa(zapis: string): number {
  return Array.from(normalizirajZapis(zapis)).filter((z) => HARF.test(z)).length;
}

/**
 * Harf produženja nosi medd samo ako iza sebe nema nijednu oznaku: u „كِتَاب"
 * elif produžava, a u „وَلِيٌّ" ja nosi tešdid pa je suglasnik, ne dužina.
 */
function imaMedd(zapis: string): boolean {
  const z = Array.from(zapis);
  if (z.includes(ELIF_MEDDA) || z.includes(ELIF_HANDŽER)) return true;
  for (let i = 0; i < z.length - 1; i += 1) {
    const par: [string, string][] = [[FETHA, ELIF], [KESRA, JA], [DAMMA, VAV]];
    for (const [samoglasnik, produzenje] of par) {
      if (z[i] === samoglasnik && z[i + 1] === produzenje && !OZNAKA.test(z[i + 2] ?? "")) return true;
    }
  }
  return false;
}

/** Svi znakovi koje zapis traži. */
export function znakoviZapisa(zapis: string): Znak[] {
  const z = normalizirajZapis(zapis);
  const znakovi: Znak[] = [];
  if (z.includes(FETHA)) znakovi.push("fetha");
  if (z.includes(KESRA)) znakovi.push("kesra");
  if (z.includes(DAMMA)) znakovi.push("damma");
  if (z.includes(SUKUN)) znakovi.push("sukun");
  if (z.includes(TESDID)) znakovi.push("tesdid");
  if (TENVIN.some((t) => z.includes(t))) znakovi.push("tenvin");
  if (imaMedd(z)) znakovi.push("medd");
  return znakovi;
}

export interface ZahtjevZapisa {
  zapis: string;
  harfovi: string[];
  znakovi: Znak[];
  duzina: number;
}

/** Sve što jedan zapis traži, na jednom mjestu. */
export function zahtjevZapisa(zapis: string): ZahtjevZapisa {
  const z = normalizirajZapis(zapis);
  return { zapis: z, harfovi: harfoviZapisa(z), znakovi: znakoviZapisa(z), duzina: duzinaZapisa(z) };
}
