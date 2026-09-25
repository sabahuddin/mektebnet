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
 *
 * Kratka hareka ispred dužine se u vokaliziranom pismu često i ne piše — „ماء"
 * i „مال" stoje bez fethe na mimu. Zato se dužinom broji i goli harf
 * produženja koji slijedi harf bez ikakve oznake. Bez toga bi „voda" i „vrata"
 * ispali kao riječi koje dijete može pročitati prije nego je dužinu učilo.
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
  for (let i = 1; i < z.length; i += 1) {
    const jeProduzenje = z[i] === ELIF || z[i] === VAV || z[i] === JA;
    const prethodniJeHarf = HARF.test(z[i - 1]);
    if (jeProduzenje && prethodniJeHarf && !OZNAKA.test(z[i + 1] ?? "")) return true;
  }
  return false;
}

function bezZavrsnogSukuna(zapis: string): string {
  return zapis.endsWith(SUKUN) ? zapis.slice(0, -1) : zapis;
}

export interface OpcijeZnakova {
  /**
   * Da li završni sukun traži da je dijete sukun već učilo.
   *
   * Dvije su istine i obje su tačne, samo za različite programe.
   *
   * Linguistički, završni sukun jeste sukun: dijete koje ga nije učilo ne zna
   * da zadnji harf nema vokal, pa „لَمْ" ne može pročitati. Zato je zadano
   * ponašanje da se broji, i zato program čitanja sukun uvodi u četvrtoj
   * lekciji, a do tada sve riječi završavaju vokalom ili dužinom.
   *
   * Stari program opismenjavanja sukun uvodi tek u šestoj lekciji, a njegove
   * riječi su završni sukun dobile naknadno, kad je uvedeno pravilo da svaki
   * zapis mora označiti kraj. Da se tamo broji, četvrta lekcija bi ostala bez
   * ijedne riječi preko noći. Tamo se, dakle, zanemaruje — ali svjesno i
   * imenovano, ne prećutno.
   */
  zanemariZavrsniSukun?: boolean;
}

/**
 * Zadnji harf mora nositi vokal, tenvin, sukun ili tešdid — inače Google ne
 * zna šta da izgovori, pa pogađa: imenici doda padežni nastavak („مال" čita
 * kao „malun"), glagolu odsiječe zadnji vokal („كان" čita kao „kan"). Harf
 * produženja na kraju („مَا") znak ne nosi, nego ga nosi harf ispred njega.
 */
export function zavrsetakOznacen(zapis: string): boolean {
  const z = Array.from(normalizirajZapis(zapis));
  const zadnji = z[z.length - 1];
  if (zadnji === undefined) return false;
  if (OZNAKA.test(zadnji) || zadnji === TESDID) return true;
  if (zadnji !== ELIF && zadnji !== VAV && zadnji !== JA && zadnji !== ELIF_MEDDA) return false;
  if (zadnji === ELIF_MEDDA) return true;
  // Harf produženja: vokal stoji na harfu ispred, preskačući tešdid.
  let i = z.length - 2;
  while (i >= 0 && (z[i] === TESDID || z[i] === ELIF_HANDŽER)) i -= 1;
  const prethodni = z[i];
  return prethodni !== undefined && (OZNAKA.test(prethodni) && prethodni !== SUKUN);
}

/** Svi znakovi koje zapis traži. */
export function znakoviZapisa(zapis: string, opcije: OpcijeZnakova = {}): Znak[] {
  const puni = normalizirajZapis(zapis);
  const z = opcije.zanemariZavrsniSukun ? bezZavrsnogSukuna(puni) : puni;
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
export function zahtjevZapisa(zapis: string, opcije: OpcijeZnakova = {}): ZahtjevZapisa {
  const z = normalizirajZapis(zapis);
  return { zapis: z, harfovi: harfoviZapisa(z), znakovi: znakoviZapisa(z, opcije), duzina: duzinaZapisa(z) };
}
