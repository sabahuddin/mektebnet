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

/**
 * Prijedlog novog programa: opismenjavanje, ne tedžvid.
 *
 * Sadašnji redoslijed je abecedni, pa mim, lam, nun, vav i ja — slova kojima se
 * riječi prave — dolaze u petnaestoj i šesnaestoj lekciji, a sa (ث), jedno od
 * najrjeđih, u trećoj. Dijete zato do kraja programa ne može sastaviti riječ.
 *
 * Ovdje su harfovi poredani po tome koliko riječi otvaraju. Izmjereno na
 * SAMER-ovom rječniku: poslije druge lekcije dijete čita devet pravih riječi,
 * poslije četvrte šezdeset osam, među njima „otac", „vrata", „vatra", „mlijeko".
 *
 * Dugi vokali dolaze rano jer bez njih nema ni „voda" ni „vrata". Tenvin je
 * ostavljen za kraj: u osnovnom čitanju otvara najmanje riječi.
 */
export const PROGRAM_OPISMENJAVANJA: KorakPrograma[] = [
  { lekcija: 1,  naziv: "Elif, hemze i tri hareke", harfovi: HEMZA_I_ELIF, znakovi: ["fetha", "kesra", "damma"] },
  { lekcija: 2,  naziv: "Mim, Ra i Lam",            harfovi: ["م", "ر", "ل"], znakovi: [] },
  { lekcija: 3,  naziv: "Dugi vokali",              harfovi: [], znakovi: ["medd"] },
  { lekcija: 4,  naziv: "Ba, Nun i Ja",             harfovi: ["ب", "ن", "ي"], znakovi: [] },
  { lekcija: 5,  naziv: "Ponavljanje",              harfovi: [], znakovi: [], ponavljanje: true },
  { lekcija: 6,  naziv: "Sukun",                    harfovi: [], znakovi: ["sukun"] },
  { lekcija: 7,  naziv: "Sin, Ta i Dal",            harfovi: ["س", "ت", "د"], znakovi: [] },
  { lekcija: 8,  naziv: "Tešdid",                   harfovi: [], znakovi: ["tesdid"] },
  { lekcija: 9,  naziv: "Ajn, Ha i Kaf",            harfovi: ["ع", "ح", "ق"], znakovi: [] },
  { lekcija: 10, naziv: "Vav, Fa i Kef",            harfovi: ["و", "ف", "ك"], znakovi: [] },
  { lekcija: 11, naziv: "Džim, Ta-marbuta i Šin",   harfovi: ["ج", "ة", "ش"], znakovi: [] },
  { lekcija: 12, naziv: "Tâ, Sad i Hâ",             harfovi: ["ط", "ص", "خ"], znakovi: [] },
  { lekcija: 13, naziv: "Za, He i Dad",             harfovi: ["ز", "ه", "ض"], znakovi: [] },
  { lekcija: 14, naziv: "Tenvin",                   harfovi: [], znakovi: ["tenvin"] },
  { lekcija: 15, naziv: "Gajn, Elif-maksura, Zal, Sa i Zâ", harfovi: ["غ", "ى", "ذ", "ث", "ظ"], znakovi: [] },
  { lekcija: 16, naziv: "Ponavljanje svega",        harfovi: [], znakovi: [], ponavljanje: true },
];
