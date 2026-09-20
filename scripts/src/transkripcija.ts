/**
 * Transkripcija i eulogije pri prevođenju sadržaja na njemački i engleski.
 *
 * Dvije stvari se NE prepuštaju prevodiocu jer su zatvoren skup i moraju biti
 * iste svaki put:
 *
 *  1. Transkripcija kur'anskog teksta. Bosanska transkripcija sažima više
 *     arapskih glasova u jedno slovo (ث, س i ص su sve „s“; ذ, ز i ظ su sve
 *     „z“; ق i ك su „k“; ح i ه su „h“; ت i ط su „t“), pa se iz nje ne može
 *     izvesti tačan međunarodni oblik — svako prepisivanje slova je nagađanje.
 *     Zato ovdje stoji provjerena međunarodna transkripcija, onakva kakva je u
 *     dječijim knjigama i udžbenicima, ista za njemački i engleski.
 *
 *  2. Eulogije. „a.s.“ i „s.a.v.s.“ ne znače ništa engleskom ni njemačkom
 *     čitaocu, a arapski znak ﷺ se namjerno ne koristi.
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

/**
 * Bosanska transkripcija → međunarodna. Ključevi su ovdje pisani onako kako
 * stoje u lekciji; poređenje ide kroz `normalizirajTranskripciju`, pa sitne
 * razlike u crticama, apostrofima i velikim slovima ne smetaju.
 */
const MEDJUNARODNA_TRANSKRIPCIJA: Array<[string, string]> = [
  // Zaštita i bismilla — javljaju se u gotovo svakoj lekciji.
  ["Euzu billahi mineš-šejtanir-radžim", "A'udhu billahi minash-shaytanir-rajim"],
  ["Bismillahir-rahmanir-rahim", "Bismillahir-Rahmanir-Rahim"],

  // El-Fatiha, ajet po ajet.
  ["Elhamdu lillahi rabbil-alemin", "Alhamdu lillahi Rabbil-alamin"],
  ["Er-rahmanir-rahim", "Ar-Rahmanir-Rahim"],
  ["Maliki jevmid-din", "Maliki yawmid-din"],
  ["Ijjake na'budu ve ijjake neste'in", "Iyyaka na'budu wa iyyaka nasta'in"],
  ["Ihdines-siratal-mustekim", "Ihdinas-siratal-mustaqim"],
  [
    "Siratallezine en'amte alejhim gajril-magdubi alejhim ve led-dallin",
    "Siratal-ladhina an'amta alayhim, ghayril-maghdubi alayhim wa lad-dallin",
  ],
];

const TRANSKRIPCIJA_MAPA = new Map(
  MEDJUNARODNA_TRANSKRIPCIJA.map(([bs, medj]) => [normalizirajTranskripciju(bs), medj]),
);

/**
 * Ako je cijeli čvor poznata transkripcija, vrati međunarodni oblik. Inače
 * `null` — pozivatelj tada zadržava dosadašnje ponašanje.
 */
export function medjunarodnaTranskripcija(tekst: string): string | null {
  const jezgro = tekst.trim().replace(/^[„"'‘“]+/, "").replace(/[”"'’“]+$/, "");
  const zavrsnaTacka = /[.!?]$/.test(jezgro);
  const kljuc = normalizirajTranskripciju(jezgro);
  if (!kljuc) return null;
  const pogodak = TRANSKRIPCIJA_MAPA.get(kljuc);
  if (!pogodak) return null;
  return zavrsnaTacka && !/[.!?]$/.test(pogodak) ? `${pogodak}.` : pogodak;
}

const EULOGIJA_TEKST: Record<CiljniJezik, string> = {
  en: "peace be upon him",
  de: "Friede sei mit ihm",
};

// Skraćenice za Poslanika i vjerovjesnike. Namjerno NE diramo „dž.š.“ (za
// Allaha) ni „r.a.“ (za ashabe) — to su druge formule i traže svoj tekst.
// Skraćenice za Poslanika i vjerovjesnike, zajedno sa zarezom ili razmakom
// koji stoji ispred njih („Poslanika, s.a.v.s.“ → „the Prophet (peace be upon
// him)“). Namjerno NE diramo „dž.š.“ (za Allaha) ni „r.a.“ (za ashabe) — to su
// druge formule i traže svoj tekst.
// Skraćenice za Poslanika i vjerovjesnike. Prva grupa hvata zarez ili razmak
// ispred njih, pa „Poslanika, s.a.v.s.“ daje „the Prophet (peace be upon him)“.
// Namjerno NE diramo „dž.š.“ (za Allaha) ni „r.a.“ (za ashabe) — to su druge
// formule i traže svoj tekst.
const RAZDJELNIK = "((?:\\s*,\\s*)|\\s+)?";
const EULOGIJE: RegExp[] = [
  new RegExp(`${RAZDJELNIK}\\bs\\.\\s*a\\.\\s*[vw]\\.\\s*s\\.`, "gi"),
  new RegExp(`${RAZDJELNIK}\\bsallallahu\\s+alejhi\\s+ve\\s+sellem\\b\\.?`, "gi"),
  new RegExp(`${RAZDJELNIK}\\balejhis-?selam\\b\\.?`, "gi"),
  new RegExp(`${RAZDJELNIK}\\ba\\.\\s*s\\.`, "gi"),
  new RegExp(`${RAZDJELNIK}ﷺ`, "g"),
];

/**
 * Zamijeni eulogiju punim izrazom ciljnog jezika i ukloni arapski znak.
 * Dira SAMO pogođeni dio teksta: razmak ispred se zadržava jednom, a ako
 * eulogija stoji na samom početku, ne dodaje se nikakav razmak.
 */
export function primijeniEulogije(tekst: string, jezik: CiljniJezik): string {
  const zamjena = `(${EULOGIJA_TEKST[jezik]})`;
  let out = tekst;
  for (const uzorak of EULOGIJE) {
    out = out.replace(uzorak, (_pogodak, razdjelnik: string | undefined) =>
      (razdjelnik ? " " : "") + zamjena);
  }
  return out;
}

/** Cijela obrada jednog prevedenog čvora. */
export function dotjeraj(izvor: string, prijevod: string, jezik: CiljniJezik): string {
  const transkripcija = medjunarodnaTranskripcija(izvor);
  if (transkripcija) return transkripcija;
  return primijeniEulogije(prijevod, jezik);
}
