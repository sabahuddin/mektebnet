// Razlaganje zapisa na grozdove, radi isticanja u boji.
//
// GROZD JE HARF SA SVIM ZNAKOVIMA KOJI NA NJEMU STOJE. To nije proizvoljna
// podjela nego jedina koju preglednik priznaje kad se boji.
//
// Mjereno u pregledniku na zapisu „مَ": span oko samog hareka daje 0 obojenih
// piksela — preglednik ga zanemari; span oko samog harfa oboji i harek uz
// njega. Harek, dakle, uvijek uzima boju svog harfa. Bojenje hareka u jednu, a
// harfa u drugu boju — kako to rade neki arapski bukvari — ovdje nije moguće.
//
// Isto mjerenje pokazalo je i drugu stranu: „مَالَ" ima istu širinu složen u
// jednom komadu i razlomljen na tri spana. Span ne lomi spajanje slova, pa se
// jedan harf smije istaknuti i usred riječi, a da se riječ ne raspadne.

/**
 * Znakovi koji se naslanjaju na harf ispred sebe: harekati, tenvini, sukun,
 * tešdid, medda, hemze iznad i ispod, te mali elif.
 */
const NASLONJENI = /[ً-ْٓ-ٰٕ]/;

/** Tatvil — crta koja stoji umjesto susjednog harfa, ne harf. */
export const TATVIL = "ـ";

/** Zapis razložen na grozdove: svaki harf sa znakovima koji na njemu stoje. */
export function grozdovi(zapis: string): string[] {
  const izl: string[] = [];
  for (const znak of zapis) {
    if (izl.length && NASLONJENI.test(znak)) izl[izl.length - 1] += znak;
    else izl.push(znak);
  }
  return izl;
}

/** Harf grozda, bez znakova na sebi. */
export const osnova = (grozd: string): string => grozd[0] ?? "";

/** Ima li zapis dati harf. */
export const sadrziHarf = (zapis: string, harf: string): boolean =>
  grozdovi(zapis).some((g) => osnova(g) === harf);

const FETHA = "َ", KESRA = "ِ", DAMMA = "ُ";

/** Harf produženja i harek koji mu mora prethoditi da bi to bila dužina. */
const DUZINE: Record<string, string> = { "ا": FETHA, "و": DAMMA, "ي": KESRA };

/**
 * Je li grozd na datom mjestu harf produženja.
 *
 * Nije dovoljno da harf bude elif, vav ili ja — mora biti go, bez ijednog
 * znaka na sebi, i harf prije njega mora nositi odgovarajući harek. Vav sa
 * fethom je suglasnik, vav iza damme je dužina; razlika je cijela lekcija.
 */
export function jeDuzina(grozdoviZapisa: string[], mjesto: number): boolean {
  if (mjesto < 1) return false;
  const g = grozdoviZapisa[mjesto];
  if (!g || g.length !== 1) return false;
  const treba = DUZINE[g];
  if (!treba) return false;
  return grozdoviZapisa[mjesto - 1].includes(treba);
}
