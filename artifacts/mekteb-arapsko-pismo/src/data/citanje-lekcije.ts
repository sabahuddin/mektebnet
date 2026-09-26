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
  /**
   * Postoje li snimci za ovu lekciju. Dok ih nema, vježba koja traži slušanje
   * nema smisla, pa dijete vidi napomenu da muallim izgovara umjesto zvučnika.
   */
  imaZvuk?: boolean;
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
    imaZvuk: true,
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
  {
    broj: 2,
    naslov: "Kesra",
    pokret: "Za fethu pokazati prstom gore, za kesru prstom dolje. Znak stoji tamo gdje pokazuje prst.",
    prica: [
      { ko: "narator", tekst: "Bilal je sutradan došao ranije. Htio je pokazati Rumejsi da nije zaboravio." },
      { ko: "bilal", tekst: "Crtica gore, pa slovo kaže E. Zapamtio sam!" },
      { ko: "rumejsa", tekst: "Jesi. A sad gledaj ovo. Ista crtica, ali je sišla ispod." },
      { ko: "bilal", tekst: "Ispod? Pa zar to nešto mijenja?" },
      { ko: "rumejsa", tekst: "Mijenja sve. Kad je gore, slovo kaže E. Kad je dolje, slovo kaže I. Slušaj: NE, pa NI." },
      { ko: "bilal", tekst: "NE... NI. Čujem razliku, ali kako da zapamtim koja je koja?" },
      { ko: "rumejsa", tekst: "Pokaži prstom. Gore prst, gore glas. Dolje prst, dolje glas." },
      { ko: "narator", tekst: "Bilal je podigao prst, pa ga spustio, pa opet podigao. Radio je to dok mu ruka nije sama znala." },
      { ko: "bilal", tekst: "Sad mogu i zatvorenih očiju." },
    ],
    vjezbe: [
      { vrsta: "slusaj-klikni", naslov: "Gore ili dolje", uputa: "Pritisnuti zvučnik, pa pokazati šta se čulo. Ne kazivati unaprijed.",
        stavke: [{ zapis: "نَ" }, { zapis: "نِ" }, { zapis: "مَ" }, { zapis: "مِ" }] },
      { vrsta: "kratko-dugo", naslov: "Kratko i dugo", uputa: "Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [{ zapis: "نَا", parnjak: "نَ" }, { zapis: "وَا", parnjak: "وَ" }] },
      { vrsta: "voz-slogova", naslov: "Voz slogova", uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu.",
        stavke: [{ zapis: "نَامَ", dijelovi: ["نَا", "مَ"] }, { zapis: "لَنَا", dijelovi: ["لَ", "نَا"] },
                 { zapis: "لِمَا", dijelovi: ["لِ", "مَا"] }] },
      { vrsta: "citaj-rijeci", naslov: "Riječi koje već znaš pročitati", uputa: "Dijete čita samo. Zvučnik se pritiska tek poslije, radi provjere.",
        stavke: [{ zapis: "نَامَ" }, { zapis: "نَالَ" }, { zapis: "لَنَا" }, { zapis: "وَلَا" }, { zapis: "لِمَا" }] },
      { vrsta: "brzina", naslov: "Koliko stigneš", uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Tačnost je ispred brzine.", sekundi: 25,
        stavke: [{ zapis: "نِ" }, { zapis: "مَا" }, { zapis: "لِ" }, { zapis: "نَا" }, { zapis: "مِ" }, { zapis: "وَ" }, { zapis: "لَا" }, { zapis: "نَ" }] },
    ],
    provjera: [
      "Pokazati kesru na nepoznatom slovu i pitati kako slovo zvuči.",
      "Izgovoriti NE i NI nasumično; dijete pokazuje je li znak gore ili dolje.",
      "Pročitati \u201eلَنَا\u201c bez zastajkivanja u sredini.",
    ],
  },
  {
    broj: 3,
    naslov: "Damma",
    pokret: "Za dammu skupiti usne u krug, kao kad se puše u vruću čorbu.",
    prica: [
      { ko: "narator", tekst: "Rumejsa je tog jutra donijela tri sličice i poredala ih na kamen." },
      { ko: "rumejsa", tekst: "Bilale, znaš dvije. Crtica gore, crtica dolje. Ostaje još jedna." },
      { ko: "bilal", tekst: "Ova mala? Liči na zavrnutu vlas." },
      { ko: "rumejsa", tekst: "Ona je damma. Stoji gore, ali ne kaže E nego U. Slušaj: HU." },
      { ko: "bilal", tekst: "HU. Usne mi se same skupile." },
      { ko: "rumejsa", tekst: "Baš po tome ćeš je znati. Kad vidiš dammu, skupi usne u krug prije nego izgovoriš." },
      { ko: "narator", tekst: "Bilal je skupio usne i rekao HU, pa RU, pa MU, i svaki put su mu se usne skupile prije glasa." },
      { ko: "bilal", tekst: "Sad imam sva tri. Gore E, dolje I, i ova zavrnuta U." },
    ],
    vjezbe: [
      { vrsta: "slusaj-klikni", naslov: "Koji od tri", uputa: "Pritisnuti zvučnik, pa pokazati šta se čulo. Sva tri znaka su u igri.",
        stavke: [{ zapis: "مَ" }, { zapis: "مِ" }, { zapis: "مُ" }, { zapis: "هُ" }, { zapis: "رُ" }] },
      { vrsta: "kratko-dugo", naslov: "Kratko i dugo", uputa: "Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [{ zapis: "رَا", parnjak: "رَ" }, { zapis: "مُو", parnjak: "مُ" }, { zapis: "هَا", parnjak: "هَ" }] },
      { vrsta: "voz-slogova", naslov: "Voz slogova", uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu.",
        stavke: [{ zapis: "هُمَا", dijelovi: ["هُ", "مَا"] }, { zapis: "رَمَا", dijelovi: ["رَ", "مَا"] },
                 { zapis: "هُنَا", dijelovi: ["هُ", "نَا"] }] },
      { vrsta: "citaj-rijeci", naslov: "Riječi koje već znaš pročitati", uputa: "Dijete čita samo. Zvučnik se pritiska tek poslije, radi provjere.",
        stavke: [{ zapis: "هُوَ" }, { zapis: "لَهُ" }, { zapis: "هُنَا" }, { zapis: "رَمَا" }, { zapis: "هُمَا" }, { zapis: "لَهُمَا" }] },
      { vrsta: "brzina", naslov: "Koliko stigneš", uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Tačnost je ispred brzine.", sekundi: 25,
        stavke: [{ zapis: "رُ" }, { zapis: "هَا" }, { zapis: "مُ" }, { zapis: "رَا" }, { zapis: "هُ" }, { zapis: "نُ" }, { zapis: "مُو" }, { zapis: "لُ" }] },
    ],
    provjera: [
      "Pokazati sva tri znaka na istom slovu i tražiti da ih dijete pročita redom.",
      "Izgovoriti HE, HI, HU nasumično; dijete pokazuje koji je znak čulo.",
      "Pročitati \u201eلَهُمَا\u201c u jednom dahu.",
    ],
  },
  {
    broj: 4,
    naslov: "Sukun \u2014 kočnica",
    pokret: "Na svaki sukun pljesnuti rukama jednom i stati. Pljesak je kočnica.",
    prica: [
      { ko: "narator", tekst: "Bilal je vukao zrno pšenice uz brdo. Rumejsa ga je gledala odozgo." },
      { ko: "rumejsa", tekst: "Bilale, stani malo. Imam nešto što ti liči na ono što upravo radiš." },
      { ko: "bilal", tekst: "Na vučenje uzbrdo?" },
      { ko: "rumejsa", tekst: "Na stajanje. Gledaj ovaj mali kružić iznad slova. On ne daje nikakav glas." },
      { ko: "bilal", tekst: "Kako ne daje? Pa svaki znak nešto kaže." },
      { ko: "rumejsa", tekst: "Ovaj kaže: stani. Slovo ispod njega se izgovori i odmah zatvori. Slušaj: MI, pa MIN." },
      { ko: "bilal", tekst: "MIN. Kao da sam zakočio na kraju." },
      { ko: "rumejsa", tekst: "Tako je. Zove se sukun. Kad ga vidiš, pljesni rukama i stani." },
      { ko: "narator", tekst: "Bilal je pljesnuo i stao. Pa opet. Pa je rekao MIN, LEM, MEN, i na svakom kraju pljesnuo." },
    ],
    vjezbe: [
      { vrsta: "slusaj-klikni", naslov: "Stoji li na kraju", uputa: "Pritisnuti zvučnik. Ako se na kraju stalo, pokazati onaj sa kružićem.",
        stavke: [{ zapis: "مِ" }, { zapis: "مِنْ" }, { zapis: "كَ" }, { zapis: "كَمْ" }] },
      { vrsta: "kratko-dugo", naslov: "Kratko i dugo", uputa: "Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [{ zapis: "كَا", parnjak: "كَ" }, { zapis: "لِي", parnjak: "لِ" }, { zapis: "يَا", parnjak: "يَ" }] },
      { vrsta: "voz-slogova", naslov: "Voz slogova", uputa: "Pročitati vagon po vagon, pa sve zajedno. Na zadnjem vagonu stati.",
        stavke: [{ zapis: "مِنْ", dijelovi: ["مِ", "نْ"] }, { zapis: "كَمْ", dijelovi: ["كَ", "مْ"] },
                 { zapis: "كَانَ", dijelovi: ["كَا", "نَ"] }] },
      { vrsta: "citaj-rijeci", naslov: "Riječi koje već znaš pročitati", uputa: "Dijete čita samo. Na sukunu se staje, ne zastaje.",
        stavke: [{ zapis: "مِنْ" }, { zapis: "لَمْ" }, { zapis: "مَنْ" }, { zapis: "كَمْ" }, { zapis: "هُمْ" }, { zapis: "هِيَ" }, { zapis: "لِي" }, { zapis: "كَانَ" }] },
      { vrsta: "brzina", naslov: "Koliko stigneš", uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Ne praviti pauzu poslije sukuna.", sekundi: 30,
        stavke: [{ zapis: "مِنْ" }, { zapis: "كَا" }, { zapis: "لَمْ" }, { zapis: "يَ" }, { zapis: "هُمْ" }, { zapis: "كِي" }, { zapis: "مَنْ" }, { zapis: "لِي" }] },
    ],
    provjera: [
      "Pokazati sukun i pitati kakav glas daje. Tačan odgovor je: nikakav, na njemu se staje.",
      "Izgovoriti MI i MIN nasumično; dijete pokazuje koje je zatvoreno.",
      "Pročitati \u201eكَانَ\u201c i \u201eكَمْ\u201c jedno za drugim, bez zamjene.",
    ],
  },
  {
    broj: 5,
    naslov: "Grleni glasovi",
    pokret: "Staviti ruku na grlo pri izgovoru. Kod ovog glasa se osjeti da dolazi dublje nego ostali.",
    prica: [
      { ko: "narator", tekst: "Bilal je pokušavao izgovoriti novi glas i svaki put ispalo bi nešto drugo." },
      { ko: "bilal", tekst: "A... e... ne ide mi. Šta radim krivo?" },
      { ko: "rumejsa", tekst: "Ne radiš krivo, nego na krivom mjestu. Ovaj glas ne nastaje u ustima nego dublje, u grlu." },
      { ko: "bilal", tekst: "U grlu?" },
      { ko: "rumejsa", tekst: "Stavi ruku na grlo. Sad reci onaj obični, pa ovaj novi. Osjetit ćeš razliku prstima." },
      { ko: "narator", tekst: "Bilal je stavio šapicu na grlo. Prvi glas jedva se osjetio. Drugi je zatreperio dublje." },
      { ko: "bilal", tekst: "Osjećam! Ovaj drugi dolazi odozdo." },
      { ko: "rumejsa", tekst: "Sad ga možeš prepoznati i kad ga ne vidiš. Ruka zna prije uha." },
    ],
    vjezbe: [
      { vrsta: "slusaj-klikni", naslov: "Odakle dolazi", uputa: "Ruku staviti na grlo. Pritisnuti zvučnik, pa pokazati šta se čulo.",
        stavke: [{ zapis: "عَ" }, { zapis: "بَ" }, { zapis: "عِ" }, { zapis: "بِ" }] },
      { vrsta: "kratko-dugo", naslov: "Kratko i dugo", uputa: "Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [{ zapis: "بَا", parnjak: "بَ" }, { zapis: "عَا", parnjak: "عَ" }, { zapis: "بِي", parnjak: "بِ" }] },
      { vrsta: "voz-slogova", naslov: "Voz slogova", uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu.",
        stavke: [{ zapis: "بَابْ", dijelovi: ["بَا", "بْ"] }, { zapis: "عِنَبْ", dijelovi: ["عِ", "نَ", "بْ"] },
                 { zapis: "عَمَلْ", dijelovi: ["عَ", "مَ", "لْ"] }] },
      { vrsta: "citaj-rijeci", naslov: "Riječi koje već znaš pročitati", uputa: "Dijete čita samo. Zvučnik se pritiska tek poslije, radi provjere.",
        stavke: [{ zapis: "بَابْ" }, { zapis: "لَعِبَ" }, { zapis: "عَمَلْ" }, { zapis: "بَيْنَ" }, { zapis: "عَيْنْ" }, { zapis: "عَالَمْ" }, { zapis: "عِنَبْ" }] },
      { vrsta: "brzina", naslov: "Koliko stigneš", uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Tačnost je ispred brzine.", sekundi: 30,
        stavke: [{ zapis: "عَ" }, { zapis: "بَا" }, { zapis: "عِ" }, { zapis: "بِي" }, { zapis: "عَا" }, { zapis: "بُ" }, { zapis: "عُ" }, { zapis: "بَ" }] },
    ],
    provjera: [
      "Ruka na grlu; dijete izgovara dva glasa i kazuje koji dolazi dublje.",
      "Pročitati \u201eعِنَبْ\u201c bez zastajkivanja između slogova.",
      "Razlikovati \u201eبَيْنَ\u201c i \u201eعَيْنْ\u201c u izgovoru.",
    ],
  },
  {
    broj: 6,
    naslov: "Hemze",
    pokret: "Hemze je kratak prekid u grlu, kao mali trzaj prije glasa. Napraviti ga glasno, pa tiho.",
    prica: [
      { ko: "narator", tekst: "Na travi je ležao mali znak. Nije imao svoje slovo." },
      { ko: "bilal", tekst: "Rumejsa, ovaj ovdje je sam. Nema na čemu da stoji." },
      { ko: "rumejsa", tekst: "To je hemze. On i jeste takav — sjedne na tuđe slovo kao na stolicu, a kad nema stolice, stane na liniju." },
      { ko: "bilal", tekst: "A kako zvuči?" },
      { ko: "rumejsa", tekst: "Kao kratak prekid u grlu. Reci A, pa stani naglo, pa opet A. Taj prekid između — to je hemze." },
      { ko: "narator", tekst: "Bilal je pokušao. Prvi put je ispalo dugo, drugi put prekratko, treći put baš kako treba." },
      { ko: "bilal", tekst: "Znači on nije glas nego zastoj?" },
      { ko: "rumejsa", tekst: "Zastoj koji se čuje. Bez njega bi mnoge riječi zvučale rastegnuto i pogrešno." },
    ],
    vjezbe: [
      { vrsta: "slusaj-klikni", naslov: "Sa zastojem ili bez", uputa: "Pritisnuti zvučnik, pa pokazati šta se čulo.",
        stavke: [{ zapis: "أَ" }, { zapis: "إِ" }, { zapis: "أُ" }, { zapis: "عَ" }] },
      { vrsta: "kratko-dugo", naslov: "Kratko i dugo", uputa: "Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [{ zapis: "بَا", parnjak: "بَ" }, { zapis: "مَا", parnjak: "مَ" }] },
      { vrsta: "voz-slogova", naslov: "Voz slogova", uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu.",
        stavke: [{ zapis: "أَنَا", dijelovi: ["أَ", "نَا"] }, { zapis: "أَكَلَ", dijelovi: ["أَ", "كَ", "لَ"] },
                 { zapis: "أَمَلْ", dijelovi: ["أَ", "مَ", "لْ"] }] },
      { vrsta: "citaj-rijeci", naslov: "Riječi koje već znaš pročitati", uputa: "Dijete čita samo. Paziti da se hemze čuje, ali da se ne razvlači.",
        stavke: [{ zapis: "أَنَا" }, { zapis: "أَبْ" }, { zapis: "مَاءْ" }, { zapis: "أَيْنَ" }, { zapis: "أَكَلَ" }, { zapis: "أَمَلْ" }] },
      { vrsta: "brzina", naslov: "Koliko stigneš", uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Tačnost je ispred brzine.", sekundi: 30,
        stavke: [{ zapis: "أَ" }, { zapis: "إِ" }, { zapis: "أَبْ" }, { zapis: "أُ" }, { zapis: "أَنَا" }, { zapis: "مَاءْ" }, { zapis: "أَمَلْ" }] },
    ],
    provjera: [
      "Pokazati hemze na tri različita nosača i pitati je li to isti znak.",
      "Izgovoriti riječ sa hemzetom i bez njega; dijete kazuje koja je koja.",
      "Pročitati \u201eمَاءْ\u201c bez dodavanja nastavka na kraju.",
    ],
  },
  {
    broj: 7,
    naslov: "Tešdid \u2014 udvojeno",
    pokret: "Na tešdidu se osloniti na slovo — reći ga jače i duže, kao da se na njega naslanja.",
    prica: [
      { ko: "narator", tekst: "Rumejsa je sletjela na list koji se povio pod njom." },
      { ko: "rumejsa", tekst: "Vidiš kako se list povio? Jer sam se naslonila. Ima znak koji radi isto to sa slovom." },
      { ko: "bilal", tekst: "Naslanja se na slovo?" },
      { ko: "rumejsa", tekst: "Tako je. Zove se tešdid. Kad ga vidiš, slovo se ne izgovara jednom nego se na njemu zadrži, kao da su dva." },
      { ko: "bilal", tekst: "Dva ista slova jedno do drugog?" },
      { ko: "rumejsa", tekst: "Čuju se kao dva, a piše se jedno sa znakom iznad. Slušaj: KU, pa KULL." },
      { ko: "bilal", tekst: "KULL. Zadržao si se na kraju." },
      { ko: "rumejsa", tekst: "I to je sve. Osloniti se, pa pustiti." },
      { ko: "narator", tekst: "Bilal je vježbao naslanjanje na list dok se list nije povio isto onoliko koliko i pod Rumejsom." },
    ],
    vjezbe: [
      { vrsta: "slusaj-klikni", naslov: "Jedno ili dvostruko", uputa: "Pritisnuti zvučnik, pa pokazati šta se čulo.",
        stavke: [{ zapis: "فَ" }, { zapis: "سَ" }, { zapis: "فِ" }, { zapis: "سُ" }] },
      { vrsta: "kratko-dugo", naslov: "Kratko i dugo", uputa: "Uz kratko pljesnuti, uz dugo raširiti ruke.",
        stavke: [{ zapis: "فَا", parnjak: "فَ" }, { zapis: "سَا", parnjak: "سَ" }, { zapis: "فِي", parnjak: "فِ" }] },
      { vrsta: "voz-slogova", naslov: "Voz slogova", uputa: "Pročitati vagon po vagon, pa sve zajedno u jednom dahu.",
        stavke: [{ zapis: "فِيلْ", dijelovi: ["فِي", "لْ"] }, { zapis: "سَلَامْ", dijelovi: ["سَ", "لَا", "مْ"] },
                 { zapis: "نَفْسْ", dijelovi: ["نَفْ", "سْ"] }] },
      { vrsta: "citaj-rijeci", naslov: "Riječi koje već znaš pročitati", uputa: "Na tešdidu se zadržati, ne razvlačiti vokal.",
        stavke: [{ zapis: "فِي" }, { zapis: "فِيلْ" }, { zapis: "فَمْ" }, { zapis: "سَلَامْ" }, { zapis: "نَفْسْ" }, { zapis: "كُلّ" }, { zapis: "سِرّ" }, { zapis: "أُمّ" }] },
      { vrsta: "brzina", naslov: "Koliko stigneš", uputa: "Pročitati cijeli red bez greške dok traje vrijeme. Tačnost je ispred brzine.", sekundi: 30,
        stavke: [{ zapis: "فِي" }, { zapis: "كُلّ" }, { zapis: "سَا" }, { zapis: "سِرّ" }, { zapis: "فَمْ" }, { zapis: "أُمّ" }, { zapis: "فَا" }, { zapis: "سُو" }] },
    ],
    provjera: [
      "Pokazati tešdid i pitati koliko se puta slovo čuje.",
      "Izgovoriti \u201eكُلْ\u201c i \u201eكُلّ\u201c; dijete kazuje koje ima tešdid.",
      "Pročitati \u201eسَلَامْ\u201c u jednom dahu, bez pauze na dužini.",
    ],
  },
];

export const lekcijaPoBroju = (broj: number): LekcijaCitanjaSadrzaj | undefined =>
  LEKCIJE_CITANJA.find((l) => l.broj === broj);
