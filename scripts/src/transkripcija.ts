/**
 * Transkripcija i eulogije pri prevođenju sadržaja na njemački i engleski.
 *
 * Dvije stvari se NE prepuštaju prevodiocu jer su zatvoren skup i moraju biti
 * iste svaki put:
 *
 *  1. Transkripcija kur'anskog teksta. Bosanska transkripcija sažima više
 *     arapskih glasova u jedno slovo (ث, س i ص su sve „s“; ذ, ز i ظ su sve
 *     „z“; ق i ك su „k“; ح i ه su „h“; ت i ط su „t“), pa se iz nje ne može
 *     izvesti tačan oblik — svako prepisivanje slova je nagađanje. Zato ovdje
 *     stoji provjerena transkripcija, ZASEBNO za svaki jezik, jer dijete treba
 *     moći pročitati je po pravopisu koji zna:
 *       njemački — sch, ch, dsch, au, ai   (Schaitan, radschim, alaihim)
 *       engleski — sh, kh, j, aw, ay       (shaytan, rajim, alayhim)
 *
 *  2. Eulogije. „a.s.“, „s.a.v.s.“ i „dž.š.“ ne znače ništa njemačkom ni
 *     engleskom djetetu, a arapski znak ﷺ se namjerno ne koristi.
 */

import { CJELINE } from "./transkripcija-podaci.js";

export type CiljniJezik = "de" | "en";

/** Ključ za poređenje: mala slova, bez naših kvačica, bez interpunkcije. */
export function normalizirajTranskripciju(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/dž/g, "dz")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/[čć]/g, "c")
    .replace(/đ/g, "d")
    .replace(/[’‘`´]/g, "'")
    .replace(/[-–—]/g, " ")
    .replace(/[.,;:!?()]/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Engleski zapis → njemački. Engleska transkripcija čuva sve razlike koje
 * njemački pravopis traži, pa je pretvorba jednoznačna i nema nagađanja:
 *   sh → sch, kh → ch, j → dsch, aw → au, ay → ai
 * Ostalo (th, dh, gh, q, apostrof za ajn) njemački zadržava.
 *
 * Napomena za buduće unose: ako se u engleskom zapisu „sh“ ili „kh“ nađu kao
 * dva odvojena glasa (npr. Is-haq), razdvoji ih crticom u engleskom zapisu,
 * inače bi ih ova pretvorba spojila u jedan njemački digraf.
 */
const EN_DE: Record<string, string> = { sh: "sch", kh: "ch", j: "dsch", aw: "au", ay: "ai" };

/**
 * „aw“ i „ay“ postaju „au“ i „ai“ samo kad zaista zatvaraju slog. Ako iza njih
 * dolazi samoglasnik, „w“ i „y“ su obični suglasnici i ostaju kakvi jesu:
 * salawatu → salawatu (ne „salauatu“), tawasaw → tawasau.
 */
const EN_DE_UZORAK = /[Ss]h|[Kk]h|[Jj]|[Aa][wy](?![aeiouAEIOU])/g;

export function njemackiIzEngleskog(engleski: string): string {
  return engleski.replace(EN_DE_UZORAK, (m) => {
    const zamjena = EN_DE[m.toLowerCase()];
    const veliko = m[0] !== m[0].toLowerCase();
    return veliko ? zamjena[0].toUpperCase() + zamjena.slice(1) : zamjena;
  });
}

/**
 * Ključ pod kojim se traži transkripcija — normalizirano i BEZ razmaka.
 *
 * Bosanska transkripcija nema ustaljenu podjelu na riječi: ista rečenica u
 * lekciji stoji kao „El-hamdu lillahi", u katalogu kao „Elhamdu lillahi", a
 * euzu-dova čas kao „Euzu billahi", čas kao „E'uzubillahi". Razmak, crtica i
 * apostrof su ukras, a ne glas, pa ne smiju odlučivati hoće li dijete dobiti
 * transkripciju ili prevedeno značenje.
 */
export function kljucTranskripcije(tekst: string): string {
  return normalizirajTranskripciju(tekst).replace(/\s+/g, "");
}

const TRANSKRIPCIJA_MAPA = new Map(
  CJELINE.flatMap((cjelina) => cjelina.redovi).map((red) => [
    kljucTranskripcije(red.bs),
    { de: njemackiIzEngleskog(red.en), en: red.en },
  ]),
);

/** Redni broj ajeta na početku reda („1. "). Ne ulazi u ključ, ali se vraća u izlaz. */
const REDNI_BROJ = /^(\d{1,3})\s*[.)]\s+/;

/**
 * Ako je cijeli čvor poznata transkripcija, vrati oblik za taj jezik. Inače
 * `null` — pozivatelj tada zadržava dosadašnje ponašanje.
 */
export function transkripcija(tekst: string, jezik: CiljniJezik): string | null {
  const jezgro = tekst.trim().replace(/^[„"'‘“]+/, "").replace(/[”"'’“]+$/, "");
  const broj = REDNI_BROJ.exec(jezgro);
  const prefiks = broj ? `${broj[1]}. ` : "";
  const jezgroBezBroja = broj ? jezgro.slice(broj[0].length) : jezgro;
  const zavrsnaTacka = /[.!?]$/.test(jezgroBezBroja);
  const kljuc = kljucTranskripcije(jezgroBezBroja);
  if (!kljuc) return null;
  const zapis = TRANSKRIPCIJA_MAPA.get(kljuc);
  if (!zapis) return null;
  const oblik = zapis[jezik];
  return prefiks + (zavrsnaTacka && !/[.!?]$/.test(oblik) ? `${oblik}.` : oblik);
}

const POSLANIK: Record<CiljniJezik, string> = {
  en: "peace be upon him",
  de: "Friede sei mit ihm",
};

/** „dž.š.“ (dželle šanuhu) uz Allahovo ime — puni izraz, bez zagrada, jer u
 *  rečenici stoji kao apozicija: „Allah, der Erhabene, hat uns gelehrt“. */
const ALLAH: Record<CiljniJezik, string> = {
  en: "the Almighty",
  de: "der Erhabene",
};

/** „r.a.“ (radijallahu anhu/anha/anhum) uz ashabe. Bosanska skraćenica je ista
 *  za muškarca, ženu i množinu, pa oba jezika koriste rodno neutralan oblik —
 *  inače bi uz žensko ime stajao muški rod. */
const ASHAB: Record<CiljniJezik, string> = {
  en: "may Allah be pleased with them",
  de: "möge Allah mit ihnen zufrieden sein",
};

// Eulogija za Poslanika i vjerovjesnike, zajedno sa zarezom ili razmakom koji
// stoji ispred nje. Ide u zagradu odmah uz ime.
const RAZDJELNIK = "((?:\\s*,\\s*)|\\s+)?";
const EULOGIJE_POSLANIK: RegExp[] = [
  new RegExp(`${RAZDJELNIK}\\bs\\.\\s*a\\.\\s*[vw]\\.\\s*s\\.`, "gi"),
  new RegExp(`${RAZDJELNIK}\\bsallallahu\\s+alejhi\\s+ve\\s+sellem\\b\\.?`, "gi"),
  new RegExp(`${RAZDJELNIK}\\balejhis-?selam\\b\\.?`, "gi"),
  new RegExp(`${RAZDJELNIK}\\ba\\.\\s*s\\.`, "gi"),
  new RegExp(`${RAZDJELNIK}ﷺ`, "g"),
];

// Eulogija za Allaha. Za razliku od one za Poslanika, zamjenjuje se samo sama
// skraćenica — zarezi oko nje ostaju, pa rečenica ostaje ispravna.
const EULOGIJE_ALLAH: RegExp[] = [
  /\bdž\.\s*š\./gi,
  /\bdz\.\s*s\./gi,
  /\bdželle\s+šanuhu\b/gi,
];

// Eulogija za ashabe — ide u zagradu uz ime, kao i ona za Poslanika.
const EULOGIJE_ASHAB: RegExp[] = [
  new RegExp(`${RAZDJELNIK}\\br\\.\\s*a\\.`, "gi"),
  new RegExp(`${RAZDJELNIK}\\bradijallahu\\s+anh[ua]?m?\\b\\.?`, "gi"),
];

/**
 * Zamijeni eulogije punim izrazom ciljnog jezika i ukloni arapski znak.
 * Dira SAMO pogođeni dio teksta: razmak ispred se zadržava jednom, a ako
 * eulogija stoji na samom početku, ne dodaje se nikakav razmak.
 */
export function primijeniEulogije(tekst: string, jezik: CiljniJezik): string {
  let out = tekst;
  const zamjena = `(${POSLANIK[jezik]})`;
  for (const uzorak of EULOGIJE_POSLANIK) {
    out = out.replace(uzorak, (_pogodak, razdjelnik: string | undefined) =>
      (razdjelnik ? " " : "") + zamjena);
  }
  for (const uzorak of EULOGIJE_ASHAB) {
    out = out.replace(uzorak, (_pogodak, razdjelnik: string | undefined) =>
      (razdjelnik ? " " : "") + `(${ASHAB[jezik]})`);
  }
  for (const uzorak of EULOGIJE_ALLAH) {
    out = out.replace(uzorak, ALLAH[jezik]);
  }
  return out;
}

/** Cijela obrada jednog prevedenog čvora. */
export function dotjeraj(izvor: string, prijevod: string, jezik: CiljniJezik): string {
  const poznata = transkripcija(izvor, jezik);
  if (poznata) return poznata;
  return primijeniEulogije(prijevod, jezik);
}
