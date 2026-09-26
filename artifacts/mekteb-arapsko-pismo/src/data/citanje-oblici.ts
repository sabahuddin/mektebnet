// Oblici slova — početni, srednji, krajnji.
//
// Ovo je stub foničko-slogovnog modela koji je u prvoj verziji nedostajao:
// dijete koje slovo vidi samo u jednom obliku ne prepoznaje ga u riječi.
//
// Oblici se ne popisuju rukom. Arapsko pismo ih pravi samo, spajanjem, a
// jedino što treba znati jeste spaja li se slovo ulijevo. Šest slova se ne
// spaja, pa imaju samo dva oblika; sva ostala imaju četiri. Prikaz koristi
// tatvil (U+0640), crtu koja stoji umjesto susjednog slova.

const TATVIL = "ـ";

/** Slova koja se ne spajaju s onim što slijedi — imaju samo dva oblika. */
const NE_SPAJA_ULIJEVO = new Set(["ا", "أ", "إ", "آ", "د", "ذ", "ر", "ز", "و", "ؤ", "ة"]);

/** Hemze na liniji stoji samo, bez ijednog spoja. */
const UVIJEK_SAM = new Set(["ء"]);

export type Polozaj = "sam" | "pocetni" | "srednji" | "krajnji";

export interface OblikHarfa {
  polozaj: Polozaj;
  /** Kako se piše, s tatvilom umjesto susjednog slova. */
  prikaz: string;
  naziv: string;
}

/**
 * Ime položaja, onako kako ga muallim izgovara. Izvozi se da ga vježba ne
 * prepisuje: dok se prepisivalo, tabela oblika izgubila je kolonu „na kraju"
 * jer je u njoj stajao izmišljen ključ.
 */
export const NAZIV_POLOZAJA: Record<Polozaj, string> = {
  sam: "sam",
  pocetni: "na početku",
  srednji: "u sredini",
  krajnji: "na kraju",
};

/** Položaji onim redom kojim stoje u tabeli oblika. */
export const REDOSLIJED_POLOZAJA: Polozaj[] = ["sam", "pocetni", "srednji", "krajnji"];

/** Svi oblici jednog slova, onim redom kojim se uče. */
export function obliciHarfa(harf: string): OblikHarfa[] {
  const napravi = (polozaj: Polozaj, prikaz: string): OblikHarfa => ({ polozaj, prikaz, naziv: NAZIV_POLOZAJA[polozaj] });
  if (UVIJEK_SAM.has(harf)) return [napravi("sam", harf)];
  if (NE_SPAJA_ULIJEVO.has(harf)) {
    return [napravi("sam", harf), napravi("krajnji", TATVIL + harf)];
  }
  return [
    napravi("sam", harf),
    napravi("pocetni", harf + TATVIL),
    napravi("srednji", TATVIL + harf + TATVIL),
    napravi("krajnji", TATVIL + harf),
  ];
}

/** Spaja li se slovo s onim što slijedi. */
export function spajaUlijevo(harf: string): boolean {
  return !NE_SPAJA_ULIJEVO.has(harf) && !UVIJEK_SAM.has(harf);
}
