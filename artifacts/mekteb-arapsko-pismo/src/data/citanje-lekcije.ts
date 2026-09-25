// Sadržaj lekcija programa učenja čitanja.
//
// Jedna lekcija, dva prikaza. Muallim dobije priču, upute i plan časa;
// dijete dobije vježbe — veliko dugme, zvuk, bez teksta koji treba čitati.
// Dijete od pet godina ne može pročitati „Pripremiti štopericu", pa mu se to
// i ne piše.
//
// IMENA SLOVA SE NE SPOMINJU. Nigdje, ni u priči, ni u vježbi, ni u uputi
// muallimu koju će naglas pročitati. Dijete uči kako slovo zvuči, ne kako se
// zove. Zato ovdje nema polja „naziv" — za razliku od stare Sufare, gdje
// postoji i HarfData.name i vježba „Napiši ime harfa".

export type VrstaVjezbe =
  | "slusaj-klikni"    // čuje slog, klikne ga među ponuđenima
  | "kratko-dugo"      // isti harf kratko pa dugo, razlika u zvuku
  | "voz-slogova"      // spajanje dijelova u cjelinu, kao kockice
  | "citaj-rijeci"     // čita riječi, zvuk na dodir
  | "brzina";          // koliko redova bez greške u zadatom vremenu

export interface StavkaVjezbe {
  /** Zapis koji dijete vidi i koji se izgovara. */
  zapis: string;
  /** Dijelovi od kojih se zapis sastavlja — samo za voz slogova. */
  dijelovi?: string[];
  /** Kraći parnjak — samo za kratko-dugo. */
  parnjak?: string;
}

export interface VjezbaCitanja {
  vrsta: VrstaVjezbe;
  naslov: string;
  /** Uputa muallimu. Dijete je ne čita; muallim je izgovara. */
  uputa: string;
  stavke: StavkaVjezbe[];
  /** Koliko sekundi za trening brzine. */
  sekundi?: number;
}

export interface ReplikaPrice {
  ko: "rumejsa" | "bilal" | "narator";
  tekst: string;
}

export interface LekcijaCitanjaSadrzaj {
  broj: number;
  naslov: string;
  /** Priča kojom muallim uvodi glas. Čita se naglas. */
  prica: ReplikaPrice[];
  /** Pokret uz glas — multisenzorno usidrenje. */
  pokret: string;
  vjezbe: VjezbaCitanja[];
  /** Šta muallim provjerava na kraju. */
  provjera: string[];
}

export const LEKCIJE_CITANJA: LekcijaCitanjaSadrzaj[] = [
  {
    broj: 1,
    naslov: "Fetha i prve dužine",
    pokret: "Pljesnuti rukama jednom na svaki kratki glas. Raširiti ruke i držati ih dok traje dugi glas.",
    prica: [
      { ko: "narator", tekst: "Pčela Rumejsa sletjela je na granu. Ispod nje, u travi, radio je mrav Bilal." },
      { ko: "rumejsa", tekst: "Bilale, vidiš li ovu malu crticu iznad? Gledaj, kosa je i stoji na vrhu." },
      { ko: "bilal", tekst: "Vidim je. Šta radi tu gore?" },
      { ko: "rumejsa", tekst: "Ona je fetha. Kad fetha sjedne iznad, slovo kaže E. Slušaj: LE." },
      { ko: "bilal", tekst: "LE! Kratko je, kao kad pljesnem rukama." },
      { ko: "rumejsa", tekst: "Tako je. A sad gledaj šta se desi kad iza dođe uspravna crta. Ona ne pravi svoj glas, nego razvlači onaj prije sebe." },
      { ko: "bilal", tekst: "LEEE? Kao kad se protegnem ujutru?" },
      { ko: "rumejsa", tekst: "Baš tako. LE je kratko, LAA je dugo. Isti glas, samo duži." },
      { ko: "narator", tekst: "Bilal je pljesnuo jednom, pa raširio ruke i držao ih dok je Rumejsa brojala do dva." },
      { ko: "bilal", tekst: "LE — LAA. Sad čujem razliku." },
    ],
    vjezbe: [
      {
        vrsta: "slusaj-klikni",
        naslov: "Šta si čuo",
        uputa: "Pritisnuti zvučnik, pa pokazati prstom šta se čulo. Ne izgovarati unaprijed.",
        stavke: [{ zapis: "لَ" }, { zapis: "مَ" }],
      },
      {
        vrsta: "kratko-dugo",
        naslov: "Kratko i dugo",
        uputa: "Poslušati prvo kratko, pa dugo. Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [
          { zapis: "لَا", parnjak: "لَ" },
          { zapis: "مَا", parnjak: "مَ" },
        ],
      },
      {
        vrsta: "voz-slogova",
        naslov: "Voz slogova",
        uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu.",
        stavke: [
          { zapis: "مَالَ", dijelovi: ["مَا", "لَ"] },
          { zapis: "لَامَ", dijelovi: ["لَا", "مَ"] },
        ],
      },
      {
        vrsta: "citaj-rijeci",
        naslov: "Riječi koje već znaš pročitati",
        uputa: "Dijete čita samo. Zvučnik se pritiska tek poslije, da se provjeri.",
        stavke: [{ zapis: "لَا" }, { zapis: "مَا" }, { zapis: "مَالَ" }, { zapis: "لَامَ" }],
      },
      {
        vrsta: "brzina",
        naslov: "Koliko stigneš",
        uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Ne žuriti preko tačnosti.",
        sekundi: 20,
        stavke: [{ zapis: "لَ" }, { zapis: "مَا" }, { zapis: "مَ" }, { zapis: "لَا" }, { zapis: "مَا" }, { zapis: "لَ" }],
      },
    ],
    provjera: [
      "Pokazati fethu na nepoznatom slovu i pitati kako slovo zvuči.",
      "Izgovoriti LE i LAA nasumično; dijete pokazuje koje je kratko, a koje dugo.",
      "Pročitati \u201eمَالَ\u201c bez zastajkivanja u sredini.",
    ],
  },
];

export const lekcijaPoBroju = (broj: number): LekcijaCitanjaSadrzaj | undefined =>
  LEKCIJE_CITANJA.find((l) => l.broj === broj);
