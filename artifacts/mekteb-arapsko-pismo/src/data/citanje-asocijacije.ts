// Na šta slovo liči — vizuelna asocijacija za svako slovo programa.
//
// Apstraktan oblik se ne pamti. „Uspravna linija sa vodoravnom crticom pri
// dnu" je opis za odraslog; dijete od pet godina zapamti sliku, ne geometriju.
// Zato svako slovo ovdje ima predmet iz djetetove okoline, kratak opis i
// potez ruke.
//
// SLIKE SU POSLOŽENE U PORODICE, NE IZMIŠLJENE JEDNA PO JEDNA. Slova koja
// dijele kostur dijele i sliku, a razlikuju se samo tačkicama:
//
//   čamac    ب ت ث        zdjela   ن ق        uho     ع غ
//   usta     ح ج خ        zub      د ذ        kukica  ر ز
//   zupci    س ش          patka    ص ض        jarbol  ط ظ
//
// To se slaže s pravilom da se slična slova razdvajaju u vremenu (vidjeti
// citanje-program.ts). Kad drugo slovo porodice dođe — a dođe lekcijama
// kasnije — dijete ne uči nov oblik nego na poznatu sliku dodaje tačkicu.
// Porodica je tada pomoć, a ne zamka, jer među njima stoji dovoljno vremena.
//
// IME SLOVA SE NI OVDJE NE SPOMINJE. Slika zamjenjuje ime: ne „ovo je ba",
// nego „ovo je čamac i zvuči B".

export interface AsocijacijaHarfa {
  /** Predmet na koji slovo liči. Jedna imenica — dijete je mora moći vidjeti. */
  slika: string;
  /** Čime se slovo drži te slike. Muallim ovo izgovara naglas. */
  opis: string;
  /** Kojim redom ruka vuče. Za pisanje po zraku, po pijesku i u plastelinu. */
  potez: string;
  /** Porodica kostura, ako je slovo dijeli s drugima. */
  porodica?: string;
}

export const ASOCIJACIJE: Record<string, AsocijacijaHarfa> = {
  // ── Lekcija 1 ─────────────────────────────────────────────────────────
  "ا": {
    slika: "štap",
    opis: "Uspravan štap, bez ijednog zavoja. Najjednostavnije slovo od svih — ničega nema osim crte.",
    potez: "Povući prstom odozgo prema dolje, jednim potezom, bez dizanja ruke.",
  },
  "ل": {
    slika: "pastirski štap",
    opis: "Isti uspravan štap, ali mu se dno savilo u zavoj, kao štap kojim pastir hvata ovcu.",
    potez: "Odozgo prema dolje, pa na dnu skrenuti udesno u široku kuku.",
  },
  "م": {
    slika: "balončić na koncu",
    opis: "Mali okrugli balončić, a ispod njega visi konac.",
    potez: "Napraviti kružić, pa iz njega povući konac ravno prema dolje.",
  },

  // ── Lekcija 2 ─────────────────────────────────────────────────────────
  "ن": {
    slika: "zdjelica",
    opis: "Plitka zdjelica koja sjedi na redu, a u njoj je jedna tačkica.",
    potez: "Povući luk kao dno zdjele, pa spustiti tačkicu u sredinu.",
    porodica: "zdjela",
  },
  "و": {
    slika: "kašika",
    opis: "Okrugla glava kao dno kašike, a drška joj visi ispod reda.",
    potez: "Napraviti kružić, pa iz njega povući dršku koso prema dolje.",
  },

  // ── Lekcija 3 ─────────────────────────────────────────────────────────
  "ه": {
    slika: "čvorić",
    opis: "Petlja zavezana u čvorić, okrugla i zatvorena sa svih strana.",
    potez: "Zaokružiti jednom pa zatvoriti tamo gdje se počelo.",
  },
  "ر": {
    slika: "kukica",
    opis: "Kratka kukica koja se spušta ispod reda, kao rep koji visi.",
    potez: "Krenuti na redu i skliznuti koso prema dolje, u kratak zavoj.",
    porodica: "kukica",
  },

  // ── Lekcija 4 ─────────────────────────────────────────────────────────
  "ي": {
    slika: "ljuljaška",
    opis: "Duboka ljuljaška koja visi ispod reda, a pod njom su dvije tačkice.",
    potez: "Povući dubok luk ispod reda, pa ispod njega staviti dvije tačkice.",
    porodica: "ljuljaška",
  },
  "ك": {
    slika: "otvoren kljun",
    opis: "Kljun koji se otvorio, a unutra mu je zapala jedna crtica.",
    potez: "Povući gornju stranu kljuna, pa donju, i na kraju crticu unutra.",
  },

  // ── Lekcija 5 ─────────────────────────────────────────────────────────
  "ع": {
    slika: "uho",
    opis: "Uho. Gornji dio je školjka, a donji se zavija kao resica.",
    potez: "Napraviti gornju školjku, pa je produžiti u zavoj prema dolje.",
    porodica: "uho",
  },
  "ب": {
    slika: "čamac",
    opis: "Čamac na vodi, a ispod njega je pala jedna tačkica.",
    potez: "Povući plitak luk kao dno čamca, pa spustiti tačkicu ispod.",
    porodica: "čamac",
  },

  // ── Lekcija 6 ─────────────────────────────────────────────────────────
  "ء": {
    slika: "glavica",
    opis: "Mala glavica bez tijela. To je gornji dio uha, otkinut i ostavljen sam.",
    potez: "Napraviti sitnu kvačicu, kao vrh uha, i tu stati.",
    porodica: "hemze",
  },
  "أ": {
    slika: "glavica na štapu",
    opis: "Ista glavica, ali je sjela na štap kao na stolicu.",
    potez: "Povući štap odozgo prema dolje, pa mu na vrh staviti glavicu.",
    porodica: "hemze",
  },
  "إ": {
    slika: "glavica pod štapom",
    opis: "Ista glavica, ali se podvukla ispod štapa.",
    potez: "Povući štap, pa glavicu staviti ispod njega.",
    porodica: "hemze",
  },
  "ؤ": {
    slika: "glavica na kašici",
    opis: "Glavica je sjela na kašiku kao na stolicu.",
    potez: "Napraviti kašiku, pa joj na glavu staviti glavicu.",
    porodica: "hemze",
  },
  "ئ": {
    slika: "glavica na ljuljašci",
    opis: "Glavica je sjela na ljuljašku, a ljuljaška je zbog nje izgubila tačkice.",
    potez: "Napraviti ljuljašku bez tačkica, pa joj na vrh staviti glavicu.",
    porodica: "hemze",
  },

  // ── Lekcija 7 ─────────────────────────────────────────────────────────
  "ف": {
    slika: "kvaka",
    opis: "Kvaka na vratima: okrugla glava, dug vrat i kuka na kraju. Na glavi joj stoji jedna tačkica.",
    potez: "Napraviti kružić, povući vrat ulijevo, pa kuku prema dolje, i tačkicu gore.",
  },
  "س": {
    slika: "tri zupca",
    opis: "Tri zupca češlja jedan do drugog, a iza njih zdjelica.",
    potez: "Napraviti tri zupca odozgo prema dolje, pa iza njih povući zdjelicu.",
    porodica: "zupci",
  },

  // ── Lekcija 8 ─────────────────────────────────────────────────────────
  "د": {
    slika: "zub",
    opis: "Jedan zub, šiljast gore i tup dolje. Ne silazi ispod reda.",
    potez: "Povući kratku crtu koso prema dolje, pa je na dnu presaviti ulijevo.",
    porodica: "zub",
  },
  "ح": {
    slika: "otvorena usta",
    opis: "Usta otvorena sa strane, a donja usna se zavija ispod reda.",
    potez: "Napraviti gornju usnu, pa donju povući u dubok zavoj ispod reda.",
    porodica: "usta",
  },

  // ── Lekcija 9 ─────────────────────────────────────────────────────────
  "ص": {
    slika: "patka",
    opis: "Patka na vodi: okruglo tijelo naprijed, a iza njega rep u zavoju.",
    potez: "Napraviti okruglo tijelo, pa iz njega izvući rep u široku kuku.",
    porodica: "patka",
  },
  "ز": {
    slika: "kukica sa tačkicom",
    opis: "Ista ona kukica koja visi ispod reda, samo joj je jedna tačkica pala na leđa.",
    potez: "Skliznuti u kratak zavoj kao kod kukice, pa staviti tačkicu iznad.",
    porodica: "kukica",
  },

  // ── Lekcija 10 ────────────────────────────────────────────────────────
  "ت": {
    slika: "čamac sa dva oka",
    opis: "Isti onaj čamac, ali su mu gore dvije tačkice, kao dva nasmijana oka.",
    potez: "Povući dno čamca, pa iznad njega staviti dvije tačkice jednu do druge.",
    porodica: "čamac",
  },
  "ق": {
    slika: "duboka zdjela",
    opis: "Zdjela dublja od one prve i visi ispod reda, a gore joj stoje dvije tačkice.",
    potez: "Povući dubok luk ispod reda, pa iznad njega dvije tačkice.",
    porodica: "zdjela",
  },

  // ── Lekcija 11 ────────────────────────────────────────────────────────
  "ة": {
    slika: "čvorić sa dvije tačkice",
    opis: "Onaj isti čvorić, ali su mu gore dodane dvije tačkice. Stoji samo na kraju riječi.",
    potez: "Zaokružiti čvorić, pa iznad njega dvije tačkice.",
  },
  "ى": {
    slika: "ljuljaška bez tačkica",
    opis: "Ista ljuljaška, ali su joj tačkice otišle. Stoji na kraju riječi i tu se razvuče kao dužina.",
    potez: "Povući dubok luk ispod reda i ne stavljati ništa ispod.",
    porodica: "ljuljaška",
  },

  // ── Lekcija 12 ────────────────────────────────────────────────────────
  "ذ": {
    slika: "zub sa tačkicom",
    opis: "Isti zub, samo mu je jedna tačkica sjela na vrh.",
    potez: "Napraviti zub, pa iznad njega staviti tačkicu.",
    porodica: "zub",
  },
  "ش": {
    slika: "zupci sa pahuljicama",
    opis: "Ista tri zupca, a iznad njih su pale tri pahuljice snijega.",
    potez: "Napraviti tri zupca i zdjelicu, pa iznad tri tačkice u trokut.",
    porodica: "zupci",
  },

  // ── Lekcija 13 ────────────────────────────────────────────────────────
  "ج": {
    slika: "usta sa tačkicom unutra",
    opis: "Ista otvorena usta, ali im je jedna tačkica upala unutra.",
    potez: "Napraviti usta, pa tačkicu spustiti u njihovu šupljinu.",
    porodica: "usta",
  },
  "ط": {
    slika: "čamac sa jarbolom",
    opis: "Trup čamca leži na redu, a iz njega se diže uspravan jarbol.",
    potez: "Napraviti ležeću petlju kao trup, pa iz nje povući jarbol uvis.",
    porodica: "jarbol",
  },

  // ── Lekcija 14 ────────────────────────────────────────────────────────
  "ض": {
    slika: "patka sa tačkicom",
    opis: "Ista patka, samo joj je jedna tačkica sjela na leđa.",
    potez: "Napraviti patku, pa iznad tijela staviti tačkicu.",
    porodica: "patka",
  },
  "خ": {
    slika: "usta sa tačkicom iznad",
    opis: "Ista otvorena usta, ali tačkica stoji iznad njih, a ne unutra.",
    potez: "Napraviti usta, pa tačkicu staviti iznad, izvan šupljine.",
    porodica: "usta",
  },

  // ── Lekcija 15 ────────────────────────────────────────────────────────
  "ث": {
    slika: "čamac sa pahuljicama",
    opis: "Onaj isti čamac, a na njega su pale tri pahuljice snijega.",
    potez: "Povući dno čamca, pa iznad tri tačkice složene u trokut.",
    porodica: "čamac",
  },
  "غ": {
    slika: "uho sa tačkicom",
    opis: "Isto uho, samo mu je jedna tačkica sjela iznad školjke.",
    potez: "Napraviti uho, pa iznad njega staviti tačkicu.",
    porodica: "uho",
  },

  // ── Lekcija 16 ────────────────────────────────────────────────────────
  "ظ": {
    slika: "jarbol sa tačkicom",
    opis: "Isti čamac sa jarbolom, a na trup mu je pala jedna tačkica.",
    potez: "Napraviti trup i jarbol, pa tačkicu staviti iznad trupa.",
    porodica: "jarbol",
  },
};

/** Slika slova, ako je ima. */
export const asocijacija = (harf: string): AsocijacijaHarfa | undefined => ASOCIJACIJE[harf];

/**
 * Slova koja dijele isti kostur sa datim slovom, među onima koja su već
 * naučena. Služi da muallim zna na šta da uporedi kad uvodi drugo slovo
 * porodice: „isti čamac, samo sada ima dvije tačkice".
 */
export function porodicaHarfa(harf: string, medju: Iterable<string>): string[] {
  const p = ASOCIJACIJE[harf]?.porodica;
  if (!p) return [];
  return [...medju].filter((h) => h !== harf && ASOCIJACIJE[h]?.porodica === p);
}
