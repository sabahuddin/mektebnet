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

interface Zapis {
  /** Bosanski zapis kako stoji u lekciji (poređenje ide normalizirano). */
  bs: string;
  de: string;
  en: string;
}

/**
 * Bosanska transkripcija → njemačka i engleska. Nove sure se dodaju ovdje;
 * poređenje ide kroz `normalizirajTranskripciju`, pa sitne razlike u
 * crticama, apostrofima i velikim slovima ne smetaju.
 */
const TRANSKRIPCIJA: Zapis[] = [
  // Zaštita i bismilla — javljaju se u gotovo svakoj lekciji.
  {
    bs: "Euzu billahi mineš-šejtanir-radžim",
    de: "A'udhu billahi minasch-schaitanir-radschim",
    en: "A'udhu billahi minash-shaytanir-rajim",
  },
  {
    bs: "Bismillahir-rahmanir-rahim",
    de: "Bismillahir-Rahmanir-Rahim",
    en: "Bismillahir-Rahmanir-Rahim",
  },

  // El-Fatiha, ajet po ajet.
  {
    bs: "Elhamdu lillahi rabbil-alemin",
    de: "Alhamdu lillahi Rabbil-alamin",
    en: "Alhamdu lillahi Rabbil-alamin",
  },
  { bs: "Er-rahmanir-rahim", de: "Ar-Rahmanir-Rahim", en: "Ar-Rahmanir-Rahim" },
  { bs: "Maliki jevmid-din", de: "Maliki yaumid-din", en: "Maliki yawmid-din" },
  {
    bs: "Ijjake na'budu ve ijjake neste'in",
    de: "Iyyaka na'budu wa iyyaka nasta'in",
    en: "Iyyaka na'budu wa iyyaka nasta'in",
  },
  {
    bs: "Ihdines-siratal-mustekim",
    de: "Ihdinas-siratal-mustaqim",
    en: "Ihdinas-siratal-mustaqim",
  },
  {
    bs: "Siratallezine en'amte alejhim gajril-magdubi alejhim ve led-dallin",
    de: "Siratal-ladhina an'amta alaihim, ghairil-maghdubi alaihim wa lad-dallin",
    en: "Siratal-ladhina an'amta alayhim, ghayril-maghdubi alayhim wa lad-dallin",
  },
];

const TRANSKRIPCIJA_MAPA = new Map(
  TRANSKRIPCIJA.map((z) => [normalizirajTranskripciju(z.bs), z]),
);

/**
 * Ako je cijeli čvor poznata transkripcija, vrati oblik za taj jezik. Inače
 * `null` — pozivatelj tada zadržava dosadašnje ponašanje.
 */
export function transkripcija(tekst: string, jezik: CiljniJezik): string | null {
  const jezgro = tekst.trim().replace(/^[„"'‘“]+/, "").replace(/[”"'’“]+$/, "");
  const zavrsnaTacka = /[.!?]$/.test(jezgro);
  const kljuc = normalizirajTranskripciju(jezgro);
  if (!kljuc) return null;
  const zapis = TRANSKRIPCIJA_MAPA.get(kljuc);
  if (!zapis) return null;
  const oblik = zapis[jezik];
  return zavrsnaTacka && !/[.!?]$/.test(oblik) ? `${oblik}.` : oblik;
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
