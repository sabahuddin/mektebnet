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

export interface ReplikaPrice {
  ko: "rumejsa" | "bilal" | "narator";
  tekst: string;
  /** Slika uz repliku. Rumejsa ima poze; za Bilala slike još nisu stigle. */
  slika?: "hoda" | "razmislja" | "cita" | "mase" | "palac" | "leti" | "pokazuje" | "pokazujeDesno";
}

/** Naš tekst o harfu — ono što muallim objašnjava, zapisano da se može čitati. */
export interface ObjasnjenjeHarfa {
  naslov: string;
  tekst: string;
  /** Primjer uz objašnjenje, ako ga treba vidjeti. */
  primjer?: string;
}

export interface LekcijaCitanjaSadrzaj {
  broj: number;
  naslov: string;
  /**
   * Postoje li snimci za ovu lekciju. Dok ih nema, vježba koja traži slušanje
   * nema smisla, pa dijete vidi napomenu da muallim izgovara umjesto zvučnika.
   */
  imaZvuk?: boolean;
  /**
   * Razgovor Rumejse i Bilala. Dijete ga vidi i čita; muallim ga čita naglas
   * onima koji još ne čitaju bosanski.
   */
  prica: ReplikaPrice[];
  /** Objašnjenje harfa, našim riječima. Stoji iza priče, prije vježbi. */
  objasnjenje: ObjasnjenjeHarfa[];
  /** Pokret uz glas — multisenzorno usidrenje. */
  pokret: string;
  /** Šta muallim provjerava na kraju. */
  provjera: string[];
}

export const LEKCIJE_CITANJA: LekcijaCitanjaSadrzaj[] = [
  {
    broj: 1,
    naslov: "Fetha i prve dužine",
    imaZvuk: true,
    pokret: "Pljesnuti rukama jednom na svaki kratki glas. Raširiti ruke i držati ih dok traje dugi glas.",
    objasnjenje: [
      { naslov: "Fetha", tekst: "Fetha je kosa crtica koja stoji iznad slova. Kad je dijete vidi, slovo se izgovara sa glasom E — kratko, jednim udarcem. Bez nje se slovo ne može pročitati, jer ne zna kako da zvuči.", primjer: "لَ" },
      { naslov: "Dužina", tekst: "Kad iza slova s fethom stoji uspravna crta, ona ne pravi svoj glas nego razvlači onaj prije sebe. Isti glas, samo dvaput duži. To je dužina.", primjer: "لَا" },
      { naslov: "Zašto je ovo prvo", tekst: "Sa tri slova i fethom dijete već može pročitati riječ. Zato se ne čeka da se nauči cijela abeceda — čita se odmah." },
    ],
    prica: [
      { ko: "narator", tekst: "Pčela Rumejsa sletjela je na granu. Ispod nje, u travi, radio je mrav Bilal." },
      { ko: "rumejsa", slika: "mase", tekst: "Bilale, vidiš li ovu malu crticu iznad? Gledaj, kosa je i stoji na vrhu." },
      { ko: "bilal", tekst: "Vidim je. Šta radi tu gore?" },
      { ko: "rumejsa", slika: "razmislja", tekst: "Ona je fetha. Kad fetha sjedne iznad, slovo kaže E. Slušaj: LE." },
      { ko: "bilal", tekst: "LE! Kratko je, kao kad pljesnem rukama." },
      { ko: "rumejsa", tekst: "Tako je. A sad gledaj šta se desi kad iza dođe uspravna crta. Ona ne pravi svoj glas, nego razvlači onaj prije sebe." },
      { ko: "bilal", tekst: "LEEE? Kao kad se protegnem ujutru?" },
      { ko: "rumejsa", slika: "palac", tekst: "Baš tako. LE je kratko, LAA je dugo. Isti glas, samo duži." },
      { ko: "narator", tekst: "Bilal je pljesnuo jednom, pa raširio ruke i držao ih dok je Rumejsa brojala do dva." },
      { ko: "bilal", tekst: "LE — LAA. Sad čujem razliku." },
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
    objasnjenje: [
      { naslov: "Kesra", tekst: "Kesra je ista kosa crtica, ali stoji ispod slova. Kad je dijete vidi, slovo se izgovara sa glasom I. Mjesto znaka je jedina razlika, i zato se uči prstom: gore prst, gore glas; dolje prst, dolje glas.", primjer: "لِ" },
      { naslov: "Dva znaka jedan do drugog", tekst: "Sada dijete prvi put bira između dva znaka. Ne žuriti na riječi dok se fetha i kesra ne razlikuju bez razmišljanja." },
    ],
    prica: [
      { ko: "narator", tekst: "Bilal je sutradan došao ranije. Htio je pokazati Rumejsi da nije zaboravio." },
      { ko: "bilal", tekst: "Crtica gore, pa slovo kaže E. Zapamtio sam!" },
      { ko: "rumejsa", tekst: "Jesi. A sad gledaj ovo. Ista crtica, ali je sišla ispod." },
      { ko: "bilal", tekst: "Ispod? Pa zar to nešto mijenja?" },
      { ko: "rumejsa", slika: "razmislja", tekst: "Mijenja sve. Kad je gore, slovo kaže E. Kad je dolje, slovo kaže I. Slušaj: NE, pa NI." },
      { ko: "bilal", tekst: "NE... NI. Čujem razliku, ali kako da zapamtim koja je koja?" },
      { ko: "rumejsa", tekst: "Pokaži prstom. Gore prst, gore glas. Dolje prst, dolje glas." },
      { ko: "narator", tekst: "Bilal je podigao prst, pa ga spustio, pa opet podigao. Radio je to dok mu ruka nije sama znala." },
      { ko: "bilal", tekst: "Sad mogu i zatvorenih očiju." },
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
    objasnjenje: [
      { naslov: "Damma", tekst: "Damma je mala zavrnuta oznaka iznad slova. Slovo se izgovara sa glasom U. Prepoznaje se po ustima: prije glasa se usne skupe u krug.", primjer: "لُ" },
      { naslov: "Sva tri kratka glasa", tekst: "Fetha, kesra i damma su tri kratka glasa arapskog pisma. Drugih nema. Kad dijete zna ova tri, zna sve kratke glasove." },
    ],
    prica: [
      { ko: "narator", tekst: "Rumejsa je tog jutra donijela tri sličice i poredala ih na kamen." },
      { ko: "rumejsa", slika: "mase", tekst: "Bilale, znaš dvije. Crtica gore, crtica dolje. Ostaje još jedna." },
      { ko: "bilal", tekst: "Ova mala? Liči na zavrnutu vlas." },
      { ko: "rumejsa", slika: "razmislja", tekst: "Ona je damma. Stoji gore, ali ne kaže E nego U. Slušaj: HU." },
      { ko: "bilal", tekst: "HU. Usne mi se same skupile." },
      { ko: "rumejsa", tekst: "Baš po tome ćeš je znati. Kad vidiš dammu, skupi usne u krug prije nego izgovoriš." },
      { ko: "narator", tekst: "Bilal je skupio usne i rekao HU, pa RU, pa MU, i svaki put su mu se usne skupile prije glasa." },
      { ko: "bilal", tekst: "Sad imam sva tri. Gore E, dolje I, i ova zavrnuta U." },
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
    objasnjenje: [
      { naslov: "Sukun", tekst: "Sukun je mali kružić iznad slova i on ne daje nikakav glas. Kazuje da se slovo izgovori i odmah zatvori, bez vokala iza sebe. Zato je kočnica.", primjer: "مِنْ" },
      { naslov: "Slog se zatvara", tekst: "Do sada je svaki slog završavao vokalom i ostajao otvoren. Sa sukunom se slog zatvara. Paziti da se poslije sukuna ne pravi pauza — riječ se čita u jednom dahu." },
    ],
    prica: [
      { ko: "narator", tekst: "Bilal je vukao zrno pšenice uz brdo. Rumejsa ga je gledala odozgo." },
      { ko: "rumejsa", slika: "pokazuje", tekst: "Bilale, stani malo. Imam nešto što ti liči na ono što upravo radiš." },
      { ko: "bilal", tekst: "Na vučenje uzbrdo?" },
      { ko: "rumejsa", tekst: "Na stajanje. Gledaj ovaj mali kružić iznad slova. On ne daje nikakav glas." },
      { ko: "bilal", tekst: "Kako ne daje? Pa svaki znak nešto kaže." },
      { ko: "rumejsa", slika: "razmislja", tekst: "Ovaj kaže: stani. Slovo ispod njega se izgovori i odmah zatvori. Slušaj: MI, pa MIN." },
      { ko: "bilal", tekst: "MIN. Kao da sam zakočio na kraju." },
      { ko: "rumejsa", tekst: "Tako je. Zove se sukun. Kad ga vidiš, pljesni rukama i stani." },
      { ko: "narator", tekst: "Bilal je pljesnuo i stao. Pa opet. Pa je rekao MIN, LEM, MEN, i na svakom kraju pljesnuo." },
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
    objasnjenje: [
      { naslov: "Glas iz grla", tekst: "Ovaj glas ne nastaje u ustima nego dublje, u grlu. Provjerava se rukom: dlan na grlu osjeti treperenje koje kod drugih glasova izostaje.", primjer: "عَ" },
      { naslov: "Zašto tek sada", tekst: "Grleni glasovi su djeci najteži jer ih bosanski nema. Zato dolaze poslije lakših, kad dijete već zna šta se od njega traži." },
    ],
    prica: [
      { ko: "narator", tekst: "Bilal je pokušavao izgovoriti novi glas i svaki put ispalo bi nešto drugo." },
      { ko: "bilal", tekst: "A... e... ne ide mi. Šta radim krivo?" },
      { ko: "rumejsa", slika: "razmislja", tekst: "Ne radiš krivo, nego na krivom mjestu. Ovaj glas ne nastaje u ustima nego dublje, u grlu." },
      { ko: "bilal", tekst: "U grlu?" },
      { ko: "rumejsa", tekst: "Stavi ruku na grlo. Sad reci onaj obični, pa ovaj novi. Osjetit ćeš razliku prstima." },
      { ko: "narator", tekst: "Bilal je stavio šapicu na grlo. Prvi glas jedva se osjetio. Drugi je zatreperio dublje." },
      { ko: "bilal", tekst: "Osjećam! Ovaj drugi dolazi odozdo." },
      { ko: "rumejsa", tekst: "Sad ga možeš prepoznati i kad ga ne vidiš. Ruka zna prije uha." },
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
    objasnjenje: [
      { naslov: "Hemze", tekst: "Hemze nije slovo nego znak, i zato nema svoj oblik. Sjedne na tuđe slovo kao na stolicu, a kad stolice nema, stane na liniju. Zvuči kao kratak prekid u grlu.", primjer: "أَ" },
      { naslov: "Isti znak, različite stolice", tekst: "Hemze se piše na elifu, na vavu i na jau, ili samo. Dijete treba zapamtiti da je to jedan te isti znak, bez obzira na šta je sjeo." },
    ],
    prica: [
      { ko: "narator", tekst: "Na travi je ležao mali znak. Nije imao svoje slovo." },
      { ko: "bilal", tekst: "Rumejsa, ovaj ovdje je sam. Nema na čemu da stoji." },
      { ko: "rumejsa", slika: "razmislja", tekst: "To je hemze. On i jeste takav — sjedne na tuđe slovo kao na stolicu, a kad nema stolice, stane na liniju." },
      { ko: "bilal", tekst: "A kako zvuči?" },
      { ko: "rumejsa", tekst: "Kao kratak prekid u grlu. Reci A, pa stani naglo, pa opet A. Taj prekid između — to je hemze." },
      { ko: "narator", tekst: "Bilal je pokušao. Prvi put je ispalo dugo, drugi put prekratko, treći put baš kako treba." },
      { ko: "bilal", tekst: "Znači on nije glas nego zastoj?" },
      { ko: "rumejsa", tekst: "Zastoj koji se čuje. Bez njega bi mnoge riječi zvučale rastegnuto i pogrešno." },
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
    objasnjenje: [
      { naslov: "Tešdid", tekst: "Tešdid je znak koji kazuje da se slovo ne izgovara jednom nego se na njemu zadrži, kao da su dva. Piše se jedno slovo sa znakom iznad, a čuju se dva.", primjer: "كُلّ" },
      { naslov: "Zadržati, ne razvući", tekst: "Tešdid nije isto što i dužina. Kod dužine se razvlači vokal, kod tešdida se zadržava na suglasniku. Razlika se čuje, i na nju treba paziti od prvog dana." },
    ],
    prica: [
      { ko: "narator", tekst: "Rumejsa je sletjela na list koji se povio pod njom." },
      { ko: "rumejsa", slika: "pokazuje", tekst: "Vidiš kako se list povio? Jer sam se naslonila. Ima znak koji radi isto to sa slovom." },
      { ko: "bilal", tekst: "Naslanja se na slovo?" },
      { ko: "rumejsa", slika: "razmislja", tekst: "Tako je. Zove se tešdid. Kad ga vidiš, slovo se ne izgovara jednom nego se na njemu zadrži, kao da su dva." },
      { ko: "bilal", tekst: "Dva ista slova jedno do drugog?" },
      { ko: "rumejsa", tekst: "Čuju se kao dva, a piše se jedno sa znakom iznad. Slušaj: KU, pa KULL." },
      { ko: "bilal", tekst: "KULL. Zadržao si se na kraju." },
      { ko: "rumejsa", tekst: "I to je sve. Osloniti se, pa pustiti." },
      { ko: "narator", tekst: "Bilal je vježbao naslanjanje na list dok se list nije povio isto onoliko koliko i pod Rumejsom." },
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
