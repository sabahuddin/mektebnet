// Fond riječi za učenje čitanja — raspoređen po lekcijama.
//
// Riječ ulazi u lekciju u kojoj dijete prvi put može pročitati sva njena
// slova i sve znakove na njima. Ne biraju se po značenju nego po tome šta
// dijete zna dekodirati: model je bez prevođenja, pa „لَامَ" vrijedi koliko i
// „بَابْ" iako dijete ne zna šta znači.
//
// Kur'anske riječi imaju prednost kad su dobar primjer onoga što se uči, ne
// same po sebi. Označene su poljem „kuran".
//
// Zadnji harf svake riječi nosi znak — vidjeti CLAUDE.md. Bez toga
// sintetizator pogađa kraj i dijete čuje ono što ne piše.

import { duzinaZapisa } from "@/lib/sufara-zapis";

export interface RijecCitanja {
  /** Zapis onako kako ga dijete vidi i kako ide sintetizatoru. */
  zapis: string;
  /** Kako se čita, latinicom — za muallima, nikad za dijete. */
  citanje: string;
  /** Prva lekcija u kojoj se može pročitati. */
  lekcija: number;
  /** Riječ se pojavljuje u Kur'anu i dobar je primjer gradiva ove lekcije. */
  kuran?: boolean;
}

export const RIJECI_CITANJA: RijecCitanja[] = [
  // ── 1. Fetha i prve dužine — ا ل م ────────────────────────────────────
  { zapis: "لَا",    citanje: "la",    lekcija: 1, kuran: true },
  { zapis: "مَا",    citanje: "ma",    lekcija: 1, kuran: true },
  { zapis: "مَالَ",  citanje: "male",  lekcija: 1, kuran: true },
  { zapis: "لَامَ",  citanje: "lame",  lekcija: 1 },

  // ── 2. Kesra — ن و ────────────────────────────────────────────────────
  { zapis: "نَامَ",  citanje: "name",  lekcija: 2, kuran: true },
  { zapis: "نَالَ",  citanje: "nale",  lekcija: 2, kuran: true },
  { zapis: "لَنَا",  citanje: "lena",  lekcija: 2, kuran: true },
  { zapis: "وَلَا",  citanje: "vela",  lekcija: 2, kuran: true },
  { zapis: "لِمَا",  citanje: "lima",  lekcija: 2, kuran: true },

  // ── 3. Damma — ه ر ────────────────────────────────────────────────────
  { zapis: "هُوَ",   citanje: "huve",  lekcija: 3, kuran: true },
  { zapis: "لَهُ",   citanje: "lehu",  lekcija: 3, kuran: true },
  { zapis: "هُنَا",  citanje: "huna",  lekcija: 3 },
  { zapis: "رَمَا",  citanje: "rema",  lekcija: 3, kuran: true },
  { zapis: "هُمَا",  citanje: "huma",  lekcija: 3, kuran: true },
  { zapis: "لَهُمَا", citanje: "lehuma", lekcija: 3, kuran: true },

  // ── 4. Sukun — ي ك ────────────────────────────────────────────────────
  { zapis: "مِنْ",   citanje: "min",   lekcija: 4, kuran: true },
  { zapis: "لَمْ",   citanje: "lem",   lekcija: 4, kuran: true },
  { zapis: "لَنْ",   citanje: "len",   lekcija: 4, kuran: true },
  { zapis: "مَنْ",   citanje: "men",   lekcija: 4, kuran: true },
  { zapis: "كَمْ",   citanje: "kem",   lekcija: 4, kuran: true },
  { zapis: "هُمْ",   citanje: "hum",   lekcija: 4, kuran: true },
  { zapis: "هِيَ",   citanje: "hije",  lekcija: 4, kuran: true },
  { zapis: "لِي",    citanje: "li",    lekcija: 4, kuran: true },
  { zapis: "كَانَ",  citanje: "kane",  lekcija: 4, kuran: true },
  { zapis: "يَوْمْ", citanje: "jevm",  lekcija: 4, kuran: true },

  // ── 5. Grleni glasovi — ع ب ───────────────────────────────────────────
  { zapis: "بَابْ",  citanje: "bab",   lekcija: 5 },
  { zapis: "لَعِبَ", citanje: "lebie", lekcija: 5 },
  { zapis: "عَمَلْ", citanje: "amel",  lekcija: 5, kuran: true },
  { zapis: "بَيْنَ", citanje: "bejne", lekcija: 5, kuran: true },
  { zapis: "عَيْنْ", citanje: "ajn",   lekcija: 5, kuran: true },
  { zapis: "عَالَمْ", citanje: "alem", lekcija: 5, kuran: true },
  { zapis: "عِنَبْ", citanje: "ineb",  lekcija: 5, kuran: true },

  // ── 6. Hemze ──────────────────────────────────────────────────────────
  { zapis: "أَنَا",  citanje: "ene",   lekcija: 6, kuran: true },
  { zapis: "أَبْ",   citanje: "eb",    lekcija: 6, kuran: true },
  { zapis: "مَاءْ",  citanje: "ma'",   lekcija: 6, kuran: true },
  { zapis: "أَيْنَ", citanje: "ejne",  lekcija: 6, kuran: true },
  { zapis: "أَكَلَ", citanje: "ekele", lekcija: 6, kuran: true },
  { zapis: "أَمَلْ", citanje: "emel",  lekcija: 6, kuran: true },

  // ── 7. Tešdid — ف س ───────────────────────────────────────────────────
  { zapis: "فِي",    citanje: "fi",    lekcija: 7, kuran: true },
  { zapis: "فِيلْ",  citanje: "fil",   lekcija: 7, kuran: true },
  { zapis: "فَمْ",   citanje: "fem",   lekcija: 7, kuran: true },
  { zapis: "سَلَامْ", citanje: "selam", lekcija: 7, kuran: true },
  { zapis: "نَفْسْ", citanje: "nefs",  lekcija: 7, kuran: true },
  { zapis: "سَمَاءْ", citanje: "sema'", lekcija: 7, kuran: true },
  { zapis: "كُلّ",   citanje: "kull",  lekcija: 7, kuran: true },
  { zapis: "سِرّ",   citanje: "sirr",  lekcija: 7, kuran: true },
  { zapis: "أُمّ",   citanje: "umm",   lekcija: 7, kuran: true },
];

/** Koliko harfova riječ ima — vježbe idu od kraćih ka dužim. Računa se iz
 * zapisa, da se ne može razići s njim. */
export function duzinaRijeci(r: RijecCitanja): number {
  return duzinaZapisa(r.zapis);
}

/** Sve riječi koje dijete može pročitati zaključno s datom lekcijom. */
export function rijeciDoLekcije(lekcija: number): RijecCitanja[] {
  return RIJECI_CITANJA.filter((r) => r.lekcija <= lekcija);
}

/** Riječi koje ova lekcija donosi kao nove. */
export function noveRijeci(lekcija: number): RijecCitanja[] {
  return RIJECI_CITANJA.filter((r) => r.lekcija === lekcija);
}
