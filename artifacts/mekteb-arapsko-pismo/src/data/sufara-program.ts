// Redoslijed učenja Sufare — jedino mjesto gdje piše šta se kad uvodi.
//
// Iz ovoga se izvodi sve ostalo: u koju lekciju koji zapis spada, šta se u njoj
// vježba i šta se ponavlja. Ako se redoslijed mijenja, mijenja se samo ovdje.
import type { Znak } from "@/lib/sufara-zapis";

export interface KorakPrograma {
  lekcija: number;
  naziv: string;
  /** Harfovi koje ova lekcija uvodi. */
  harfovi: string[];
  /** Znakovi koje ova lekcija uvodi. */
  znakovi: Znak[];
  /** Lekcija bez novog gradiva — samo ponavljanje. */
  ponavljanje?: boolean;
}

/**
 * Hemza u svim oblicima i elif idu zajedno s prvom lekcijom, jer se hareketi
 * vježbaju upravo na njima.
 */
export const HEMZA_I_ELIF = ["ء", "آ", "أ", "ؤ", "إ", "ئ", "ا"];

export const PROGRAM_SUFARE: KorakPrograma[] = [
  { lekcija: 2,  naziv: "Elif, hemze i hareketi", harfovi: HEMZA_I_ELIF, znakovi: ["fetha", "kesra", "damma"] },
  { lekcija: 3,  naziv: "Ba, Ta i Sa",            harfovi: ["ب", "ت", "ث"], znakovi: [] },
  { lekcija: 4,  naziv: "Džim, Ha i Hâ",          harfovi: ["ج", "ح", "خ"], znakovi: [] },
  { lekcija: 5,  naziv: "Ponavljanje sedam harfova", harfovi: [], znakovi: [], ponavljanje: true },
  { lekcija: 6,  naziv: "Dal, Zal, Ra i Za",      harfovi: ["د", "ذ", "ر", "ز"], znakovi: [] },
  { lekcija: 7,  naziv: "Sukun",                  harfovi: [], znakovi: ["sukun"] },
  { lekcija: 8,  naziv: "Tešdid",                 harfovi: [], znakovi: ["tesdid"] },
  { lekcija: 9,  naziv: "Tenvin",                 harfovi: [], znakovi: ["tenvin"] },
  { lekcija: 10, naziv: "Sin i Šin",              harfovi: ["س", "ش"], znakovi: [] },
  { lekcija: 11, naziv: "Sad i Dad",              harfovi: ["ص", "ض"], znakovi: [] },
  { lekcija: 12, naziv: "Tâ i Zâ",                harfovi: ["ط", "ظ"], znakovi: [] },
  { lekcija: 13, naziv: "Ajn i Gajn",             harfovi: ["ع", "غ"], znakovi: [] },
  { lekcija: 14, naziv: "Fa i Kaf",               harfovi: ["ف", "ق"], znakovi: [] },
  { lekcija: 15, naziv: "Kef, Lam i Mim",         harfovi: ["ك", "ل", "م"], znakovi: [] },
  { lekcija: 16, naziv: "Nun, He, Vav i Ja",      harfovi: ["ن", "ه", "و", "ي"], znakovi: [] },
  { lekcija: 17, naziv: "Ponavljanje svih harfova", harfovi: [], znakovi: [], ponavljanje: true },
];

/**
 * Medd, ta-marbuta i elif-maksura se u programu ne pojavljuju, a lekcije 15 i
 * 16 ih već koriste. Raspoređivač će svaki takav zapis prijaviti kao
 * nesmješten, umjesto da ga tiho ubaci djetetu koje to nije učilo. Kad se
 * odluči gdje se uče, dodaje se korak ovdje i sve se samo presloži.
 */
export const JOŠ_SE_NE_UČI: Znak[] = ["medd"];
