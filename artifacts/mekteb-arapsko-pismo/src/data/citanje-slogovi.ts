// Slogovi — harf s harekom, bez dužine.
//
// Ovo je jezgro foničko-slogovnog modela. Dijete ne uči „ovo je slovo lam",
// nego „ovo zvuči le". Zato slog ima čitanje, a nema ime.
//
// Slogovi se ne pišu sa završnim znakom kao riječi: „لَ" jeste otvoren slog i
// završava vokalom, pa je kraj već označen. Vidjeti CLAUDE.md.

export interface SlogCitanja {
  zapis: string;
  /** Kako zvuči — za muallima i za provjeru, nikad se ne pokazuje djetetu. */
  citanje: string;
  /** Slovo na kojem slog stoji, radi grupisanja u vježbama. */
  harf: string;
  lekcija: number;
}

export const SLOGOVI_CITANJA: SlogCitanja[] = [
  { zapis: "لَ", citanje: "le", harf: "ل", lekcija: 1 },
  { zapis: "مَ", citanje: "me", harf: "م", lekcija: 1 },

  { zapis: "نَ", citanje: "ne", harf: "ن", lekcija: 2 },
  { zapis: "وَ", citanje: "ve", harf: "و", lekcija: 2 },
  { zapis: "لِ", citanje: "li", harf: "ل", lekcija: 2 },
  { zapis: "مِ", citanje: "mi", harf: "م", lekcija: 2 },
  { zapis: "نِ", citanje: "ni", harf: "ن", lekcija: 2 },
  { zapis: "وِ", citanje: "vi", harf: "و", lekcija: 2 },

  { zapis: "هَ", citanje: "he", harf: "ه", lekcija: 3 },
  { zapis: "رَ", citanje: "re", harf: "ر", lekcija: 3 },
  { zapis: "هِ", citanje: "hi", harf: "ه", lekcija: 3 },
  { zapis: "رِ", citanje: "ri", harf: "ر", lekcija: 3 },
  { zapis: "لُ", citanje: "lu", harf: "ل", lekcija: 3 },
  { zapis: "مُ", citanje: "mu", harf: "م", lekcija: 3 },
  { zapis: "نُ", citanje: "nu", harf: "ن", lekcija: 3 },
  { zapis: "وُ", citanje: "vu", harf: "و", lekcija: 3 },
  { zapis: "هُ", citanje: "hu", harf: "ه", lekcija: 3 },
  { zapis: "رُ", citanje: "ru", harf: "ر", lekcija: 3 },

  { zapis: "يَ", citanje: "je", harf: "ي", lekcija: 4 },
  { zapis: "يِ", citanje: "ji", harf: "ي", lekcija: 4 },
  { zapis: "يُ", citanje: "ju", harf: "ي", lekcija: 4 },
  { zapis: "كَ", citanje: "ke", harf: "ك", lekcija: 4 },
  { zapis: "كِ", citanje: "ki", harf: "ك", lekcija: 4 },
  { zapis: "كُ", citanje: "ku", harf: "ك", lekcija: 4 },

  { zapis: "عَ", citanje: "a",  harf: "ع", lekcija: 5 },
  { zapis: "عِ", citanje: "i",  harf: "ع", lekcija: 5 },
  { zapis: "عُ", citanje: "u",  harf: "ع", lekcija: 5 },
  { zapis: "بَ", citanje: "be", harf: "ب", lekcija: 5 },
  { zapis: "بِ", citanje: "bi", harf: "ب", lekcija: 5 },
  { zapis: "بُ", citanje: "bu", harf: "ب", lekcija: 5 },

  { zapis: "فَ", citanje: "fe", harf: "ف", lekcija: 7 },
  { zapis: "فِ", citanje: "fi", harf: "ف", lekcija: 7 },
  { zapis: "فُ", citanje: "fu", harf: "ف", lekcija: 7 },
  { zapis: "سَ", citanje: "se", harf: "س", lekcija: 7 },
  { zapis: "سِ", citanje: "si", harf: "س", lekcija: 7 },
  { zapis: "سُ", citanje: "su", harf: "س", lekcija: 7 },
];

/** Slogovi koje dijete zna zaključno s datom lekcijom. */
export function slogoviDoLekcije(lekcija: number): SlogCitanja[] {
  return SLOGOVI_CITANJA.filter((s) => s.lekcija <= lekcija);
}

/** Slogovi koje ova lekcija donosi kao nove. */
export function noviSlogovi(lekcija: number): SlogCitanja[] {
  return SLOGOVI_CITANJA.filter((s) => s.lekcija === lekcija);
}
