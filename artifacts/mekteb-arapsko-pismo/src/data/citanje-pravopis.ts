// Gdje u riječi slovo smije stajati.
//
// Slagalica koja slogove spaja u riječi ne zna arapski. Dok ova pravila nisu
// stajala ovdje, sastavljala je 113 nemogućih zapisa kroz šesnaest lekcija:
// „ئَبَا", „ؤُحَ", „ةُلُ", „ىُظُ". Dijete bi ih čitalo kao riječi, a nijedna od
// njih ne može postojati.
//
// HEMZE NA POČETKU RIJEČI UVIJEK SJEDI NA ELIFU. Nikad na vavu ni na jau:
// „أَخَذَ", „إِنَّ" — da, „ؤَ...", „ئَ..." — nikad. Vav i ja su nosači samo u
// sredini i na kraju riječi, gdje se hemze naslanja na vokal oko sebe.
//
// VEZANO TA I SKRAĆENI ELIF STOJE SAMO NA KRAJU. Vezano ta je nastavak, a
// skraćeni elif je dužina koja se piše na kraju; ni jedno ni drugo ne može
// otvoriti riječ niti stajati u sredini.

/**
 * Slova kojima riječ ne može početi.
 *
 * Goli elif zato što na početku nosi hemze i piše se „أ" ili „إ"; hemze na
 * liniji zato što mu treba vokal ispred; hemze na vavu i na jau zato što su
 * nosači samo iznutra; vezano ta i skraćeni elif zato što su završeci.
 */
export const NE_POCINJE_RIJEC = new Set(["ا", "ء", "ؤ", "ئ", "ة", "ى"]);

/** Slova koja stoje samo na kraju riječi — vezano ta i skraćeni elif. */
export const SAMO_NA_KRAJU = new Set(["ة", "ى"]);

/**
 * Slova koja ne stoje sama kao slog koji dijete čita.
 *
 * Goli elif nema svoj glas — on je dužina ili nosač. Hemze na liniji ne stoji
 * bez vokala oko sebe. Vezano ta postoji samo kao završetak riječi. Skraćeni
 * elif uopće ne nosi harek, pa „ىَ" nije slog nego greška u zapisu.
 *
 * Hemze na vavu i na jau stoje ovdje jer su nosači samo iznutra: „مُؤْمِنْ",
 * „سُئِلَ". Sam slog „ؤَ" dijete bi pročitalo kao početak riječi, a riječ tako
 * ne počinje. Na tim nosačima hemze djetetu dolazi jedino kroz riječi.
 */
export const BEZ_SAMOSTALNOG_SLOGA = new Set(["ا", "ء", "ة", "ى", "ؤ", "ئ"]);

const FETHA = "\u064E", KESRA = "\u0650", DAMMA = "\u064F";

/**
 * Harfovi kojima pravopis ograničava izbor hareka.
 *
 * Hemze na elifu se piše iznad uz fethu i dammu, a ispod uz kesru. „أِ" i
 * „إَ" nisu druga mogućnost nego pogrešno napisan isti glas: hemze s kesrom
 * uvijek ide ispod elifa.
 */
export const DOZVOLJENI_HAREKI: Record<string, string[]> = {
  "أ": [FETHA, DAMMA],
  "إ": [KESRA],
};

/** Smije li harf nositi dati harek. */
export const harekDozvoljen = (harf: string, harek: string): boolean =>
  DOZVOLJENI_HAREKI[harf]?.includes(harek) ?? true;

/** Hemze na jau nema početni oblik, jer riječ njime ne počinje. */
export const BEZ_POCETNOG_OBLIKA = new Set(["ئ"]);

export const smijeOtvoritiRijec = (harf: string): boolean => !NE_POCINJE_RIJEC.has(harf);
export const samoNaKrajuRijeci = (harf: string): boolean => SAMO_NA_KRAJU.has(harf);
export const nosiSamostalanSlog = (harf: string): boolean => !BEZ_SAMOSTALNOG_SLOGA.has(harf);
