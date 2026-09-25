// Program učenja čitanja arapskog pisma — foničko-slogovni model.
//
// Zaseban dio platforme. Ne traži ništa iz Sufare ni iz lekcija mekteba;
// kreće od nule.
//
// REDOSLIJED SLOVA JE IZRAČUNAT, NE PREUZET IZ ABECEDE. Dva mjerila:
//
// 1. Česta slova prva. Kur'anski korpus (77.429 pojava, 14.873 različite
//    riječi) kaže koja se slova stvarno pojavljuju. Abecedni red daje poslije
//    druge lekcije riječi „tebe", „hubben", „tahte" — ukupno 61 pojavu u
//    cijelom Kur'anu. Ovaj red daje „min", „Allah", „ma", „la" — 14.536 pojava.
//
// 2. Slična slova se razdvajaju u vremenu. „ب ت ث ن ي" u sredini riječi imaju
//    isti kostur i razlikuju se samo tačkicama; isto vrijedi za „ج ح خ",
//    „د ذ", „ر ز", „س ش", „ص ض", „ط ظ", „ع غ", „ف ق". Kad takva dva slova dođu
//    u istu ili susjednu lekciju, dijete ne uči oblike nego broji tačkice.
//    Zato nijedna lekcija ne uvodi dva slova iz iste skupine, niti slovo čiji
//    je par bio u prethodnoj lekciji.
//
// DUŽINA DOLAZI ODMAH. Arapskih riječi od dva-tri slova sa samim kratkim
// vokalima gotovo da nema. Prve riječi koje dijete uopće može pročitati —
// „مَا", „لَا" — sve traže elif kao dužinu. Bez dužine prva lekcija nema
// nijedne riječi, a program koji prvu riječ daje tek u sedmoj lekciji nije
// foničko-slogovni nego abecedni s drugim imenom.

/** Znak koji dijete mora znati da bi zapis pročitalo. */
export type Znak = "fetha" | "kesra" | "damma" | "sukun" | "tesdid" | "tenvin" | "medd";

export interface LekcijaCitanja {
  broj: number;
  naziv: string;
  /** Slova koja ova lekcija uvodi. */
  harfovi: string[];
  /** Znakovi koje ova lekcija uvodi. */
  znakovi: Znak[];
}

export const PROGRAM_CITANJA: LekcijaCitanja[] = [
  { broj: 1,  naziv: "Fetha i prve dužine",   harfovi: ["ا", "ل", "م"], znakovi: ["fetha", "medd"] },
  { broj: 2,  naziv: "Kesra",                 harfovi: ["ن", "و"],      znakovi: ["kesra"] },
  { broj: 3,  naziv: "Damma",                 harfovi: ["ه", "ر"],      znakovi: ["damma"] },
  { broj: 4,  naziv: "Sukun — kočnica",       harfovi: ["ي", "ك"],      znakovi: ["sukun"] },
  { broj: 5,  naziv: "Grleni glasovi",        harfovi: ["ع", "ب"],      znakovi: [] },
  // Hemze nije slovo nego znak koji stoji na nosaču („أ", „إ", „ؤ", „ئ") ili
  // sam na liniji („ء"). Uvodi se kao cjelina, jer dijete ga i vidi kao jedno.
  { broj: 6,  naziv: "Hemze",                 harfovi: ["ء", "أ", "إ", "ؤ", "ئ"], znakovi: [] },
  { broj: 7,  naziv: "Tešdid — udvojeno",     harfovi: ["ف", "س"],      znakovi: ["tesdid"] },
  { broj: 8,  naziv: "Zub i zavoj",           harfovi: ["د", "ح"],      znakovi: [] },
  { broj: 9,  naziv: "Krupni parovi",         harfovi: ["ص", "ز"],      znakovi: [] },
  { broj: 10, naziv: "Tenvin",                harfovi: ["ت", "ق"],      znakovi: ["tenvin"] },
  { broj: 11, naziv: "Vezano ta i skraćeni elif", harfovi: ["ة", "ى"],  znakovi: [] },
  { broj: 12, naziv: "Tačka gore, tačka dolje", harfovi: ["ذ", "ش"],    znakovi: [] },
  { broj: 13, naziv: "Slova koja ne spajaju", harfovi: ["ج", "ط"],      znakovi: [] },
  { broj: 14, naziv: "Rijetki parovi",        harfovi: ["ض", "خ"],      znakovi: [] },
  { broj: 15, naziv: "Posljednja skupina",    harfovi: ["ث", "غ"],      znakovi: [] },
  { broj: 16, naziv: "Sve na broju",          harfovi: ["ظ"],           znakovi: [] },
];

/** Sva slova i znakovi koje dijete zna zaključno s datom lekcijom. */
export function znanjeDoLekcije(lekcija: number): { harfovi: Set<string>; znakovi: Set<Znak> } {
  const harfovi = new Set<string>();
  const znakovi = new Set<Znak>();
  for (const l of PROGRAM_CITANJA) {
    if (l.broj > lekcija) break;
    for (const h of l.harfovi) harfovi.add(h);
    for (const z of l.znakovi) znakovi.add(z);
  }
  return { harfovi, znakovi };
}
