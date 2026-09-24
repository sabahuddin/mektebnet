// Kur'an podaci — tekst (Uthmani rasm, kao kod Diyaneta) preko alquran.cloud
// i audio (Husari Mu'allim, "prouči pa ponovi") sa vanjskog servera everyayah.com.
// Sve se učitava direktno sa klijenta (CORS dozvoljen na alquran.cloud).

export interface SurahMeta {
  number: number;
  name: string; // arapski naziv (npr. "سُورَةُ البَقَرَةِ")
  englishName: string; // latinična transliteracija (npr. "Al-Baqara")
  englishNameTranslation: string; // prijevod značenja (npr. "The Cow")
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan" | string;
}

export interface Ayah {
  number: number; // globalni redni broj u Mushafu
  numberInSurah: number;
  text: string; // Uthmani rasm
}

const API = "https://api.alquran.cloud/v1";

// Bismilla (Uthmani) — kako je vraća alquran.cloud. Koristi se za zaglavlje
// sure i za uklanjanje prefiksa iz prvog ajeta.
export const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

// Sure koje NEMAJU bismillu kao zaseban naslov:
//  - sura 1 (El-Fatiha): bismilla JE prvi ajet
//  - sura 9 (Et-Tevba): nema bismille uopće
const NO_HEADER_BISMILLAH = new Set([1, 9]);

export function surahHasBismillahHeader(surah: number): boolean {
  return !NO_HEADER_BISMILLAH.has(surah);
}

// Normalizacija arapskog za pouzdano poređenje: skida sve harakate/znakove
// (uključujući superskript alif i tatweel) i izjednačava varijante alifa.
// Potrebno jer izvor ponekad ima drugačiji redoslijed kombinujućih znakova
// (npr. shadda prije/poslije fethe) pa egzaktno poređenje stringa zakaže.
function normalizeArabic(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670\u0610-\u061A\u06D6-\u06ED\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\s+/g, "");
}

const BISMILLAH_NORM = normalizeArabic(BISMILLAH);

/** Skida BOM i, za sure koje imaju zaseban bismilla-naslov, uklanja
 *  bismillu (prve 4 riječi) koja je u izvoru zalijepljena na početak
 *  prvog ajeta. */
function cleanAyahText(surah: number, numberInSurah: number, raw: string): string {
  let t = raw.replace(/^\uFEFF/, "").trim();
  if (numberInSurah === 1 && surahHasBismillahHeader(surah)) {
    const toks = t.split(/\s+/);
    if (toks.length > 4 && normalizeArabic(toks.slice(0, 4).join("")) === BISMILLAH_NORM) {
      t = toks.slice(4).join(" ").trim();
    }
  }
  // Ova verzija alquran.cloud dodaje U+06ED (mali mim) poslije gotovo svakog
  // tenvina, čak i gdje ne pripada: "عَيْنًۭا" / "مِصْرًۭا".
  // Kanonski Uthmani tekst piše "عَيْنًا" / "مِصْرًا". Ne diraj U+06E2
  // (znak za izgovor) niti znakove stajanja U+06D6–U+06DC.
  t = t.replace(/([\u064B-\u064D])\u06ED/gu, "$1");
  // alquran.cloud odvaja znakove stajanja razmakom (npr. "قَوْلِهِمْ ۘ").
  // To su kombinirajući znakovi: razmak ih odvaja od riječi i pri prijelomu
  // reda mogu završiti na pogrešnom mjestu. Veži ih za prethodnu riječ.
  return t.replace(/\s+(?=[\u06D6-\u06DC])/gu, "");
}

export async function fetchSurahList(): Promise<SurahMeta[]> {
  const r = await fetch(`${API}/surah`);
  if (!r.ok) throw new Error("Neuspješno učitavanje popisa sura.");
  const j = await r.json();
  if (!Array.isArray(j?.data)) throw new Error("Neispravan odgovor servera (popis sura).");
  return j.data as SurahMeta[];
}

export async function fetchSurah(n: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
  const r = await fetch(`${API}/surah/${n}/quran-uthmani`);
  if (!r.ok) throw new Error("Neuspješno učitavanje sure.");
  const j = await r.json();
  const d = j?.data;
  if (!d?.ayahs) throw new Error("Neispravan odgovor servera (sura).");
  const meta: SurahMeta = {
    number: d.number,
    name: d.name,
    englishName: d.englishName,
    englishNameTranslation: d.englishNameTranslation,
    numberOfAyahs: d.numberOfAyahs,
    revelationType: d.revelationType,
  };
  const ayahs: Ayah[] = d.ayahs.map((a: any) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    text: cleanAyahText(d.number, a.numberInSurah, a.text),
  }));
  return { meta, ayahs };
}

const pad3 = (n: number) => String(n).padStart(3, "0");

// Učači (vanjski server everyayah.com). Folder = identifikator izvora.
export interface Reciter {
  id: string;
  label: string;
  folder: string;
}

export const RECITERS: Reciter[] = [
  { id: "husary_muallim", label: "Husari — Mu'allim (prouči pa ponovi)", folder: "Husary_Muallim_128kbps" },
  { id: "husary", label: "Husari — Murettel", folder: "Husary_128kbps" },
  { id: "minshawy", label: "Menšavi — Murettel", folder: "Minshawy_Murattal_128kbps" },
  { id: "aziz_alili", label: "Aziz Alili — Murettel", folder: "aziz_alili_128kbps" },
];

export const DEFAULT_RECITER_ID = "husary_muallim";

export function reciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

/** Audio jednog ajeta sa odabranog učača (vanjski server). */
export function ayahAudioUrl(surah: number, ayahInSurah: number, reciterFolder: string): string {
  return `https://everyayah.com/data/${reciterFolder}/${pad3(surah)}${pad3(ayahInSurah)}.mp3`;
}

// Nazivi sura u latinici, po jeziku sučelja. Ovo NIJE prijevod značenja nego
// transkripcija arapskog naziva, pa svaki jezik koristi svoj pravopis:
//   bs — transliteracija sa islam.ba (El-Bekara, Ja-Sin)
//   de — njemačka fonetika bez dijakritika (sch, ch, dsch, au/ai): Al-Ichlas,
//        Quraisch, Al-Kauthar
//   en — uobičajena engleska transkripcija bez dijakritika: Al-Ikhlas,
//        Quraysh, Al-Kawthar
// Tamo gdje sura ima dva poznata naziva, sva tri jezika drže isti izbor kao
// bosanski spisak (40. Al-Mumin, 94. Al-Inširah, 111. El-Leheb), da dijete i
// roditelj prepoznaju istu suru bez obzira na jezik sučelja.
const SURAH_NAMES: Record<"bs" | "de" | "en", readonly string[]> = {
  bs: [
    "El-Fatiha", "El-Bekara", "Ali Imran", "En-Nisa", "El-Maida", "El-Anam",
    "El-Araf", "El-Enfal", "Et-Tevba", "Junus", "Hud", "Jusuf", "Er-Rad",
    "Ibrahim", "El-Hidžr", "En-Nahl", "El-Isra", "El-Kehf", "Merjem", "Ta-Ha",
    "El-Enbija", "El-Hadždž", "El-Muminun", "En-Nur", "El-Furkan", "Eš-Šuara",
    "En-Neml", "El-Kasas", "El-Ankebut", "Er-Rum", "Lukman", "Es-Sedžda",
    "El-Ahzab", "Saba", "Fatir", "Ja-Sin", "Es-Saffat", "Sad", "Ez-Zumar",
    "El-Mumin", "Fussilat", "Eš-Šura", "Ez-Zuhruf", "Ed-Duhan", "El-Džasija",
    "El-Ahkaf", "Muhammed", "El-Feth", "El-Hudžurat", "Kaf", "Ed-Darijat",
    "Et-Tur", "En-Nedžm", "El-Kamer", "Er-Rahman", "El-Vakia", "El-Hadid",
    "El-Mudžadela", "El-Hašr", "El-Mumtahina", "Es-Saff", "El-Džumua",
    "El-Munafikun", "Et-Tegabun", "Et-Talak", "Et-Tahrim", "El-Mulk", "El-Kalem",
    "El-Hakka", "El-Mearidž", "Nuh", "El-Džinn", "El-Muzemmil", "El-Muddessir",
    "El-Kijama", "El-Insan", "El-Mursalat", "En-Naba", "En-Naziat", "Abasa",
    "Et-Takvir", "El-Infitar", "El-Mutaffifun", "El-Inšikak", "El-Burudž",
    "Et-Tarik", "El-'Ala", "El-Gašija", "El-Fedžr", "El-Beled", "Eš-Šems",
    "El-Lejl", "Ed-Duha", "El-Inširah", "Et-Tin", "El-Alek", "El-Kadr",
    "El-Bejjina", "Ez-Zilzal", "El-Adijat", "El-Karia", "Et-Tekasur", "El-Asr",
    "El-Humaza", "El-Fil", "El-Kurejš", "El-Maun", "El-Kevser", "El-Kafirun",
    "En-Nasr", "El-Leheb", "El-Ihlas", "El-Felek", "En-Nas",
  ],
  de: [
    "Al-Fatiha", "Al-Baqara", "Al-Imran", "An-Nisa", "Al-Maida", "Al-Anam",
    "Al-Araf", "Al-Anfal", "At-Tauba", "Yunus", "Hud", "Yusuf", "Ar-Rad",
    "Ibrahim", "Al-Hidschr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Ta-Ha",
    "Al-Anbiya", "Al-Hadsch", "Al-Muminun", "An-Nur", "Al-Furqan", "Asch-Schuara",
    "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum", "Luqman", "As-Sadschda",
    "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar",
    "Al-Mumin", "Fussilat", "Asch-Schura", "Az-Zuchruf", "Ad-Duchan", "Al-Dschathiya",
    "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hudschurat", "Qaf", "Adh-Dhariyat",
    "At-Tur", "An-Nadschm", "Al-Qamar", "Ar-Rahman", "Al-Waqia", "Al-Hadid",
    "Al-Mudschadala", "Al-Haschr", "Al-Mumtahana", "As-Saff", "Al-Dschumua",
    "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam",
    "Al-Haqqa", "Al-Maaridsch", "Nuh", "Al-Dschinn", "Al-Muzzammil", "Al-Muddaththir",
    "Al-Qiyama", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Naziat", "Abasa",
    "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inschiqaq", "Al-Burudsch",
    "At-Tariq", "Al-Ala", "Al-Ghaschiya", "Al-Fadschr", "Al-Balad", "Asch-Schams",
    "Al-Lail", "Ad-Duha", "Al-Inschirah", "At-Tin", "Al-Alaq", "Al-Qadr",
    "Al-Baiyina", "Az-Zalzala", "Al-Adiyat", "Al-Qaria", "At-Takathur", "Al-Asr",
    "Al-Humaza", "Al-Fil", "Quraisch", "Al-Maun", "Al-Kauthar", "Al-Kafirun",
    "An-Nasr", "Al-Lahab", "Al-Ichlas", "Al-Falaq", "An-Nas",
  ],
  en: [
    "Al-Fatihah", "Al-Baqarah", "Ali Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am",
    "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd",
    "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Ta-Ha",
    "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara",
    "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum", "Luqman", "As-Sajdah",
    "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar",
    "Al-Mu'min", "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah",
    "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Adh-Dhariyat",
    "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid",
    "Al-Mujadilah", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah",
    "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam",
    "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir",
    "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "Abasa",
    "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj",
    "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams",
    "Al-Layl", "Ad-Duha", "Al-Inshirah", "At-Tin", "Al-Alaq", "Al-Qadr",
    "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat", "Al-Qari'ah", "At-Takathur", "Al-Asr",
    "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun",
    "An-Nasr", "Al-Lahab", "Al-Ikhlas", "Al-Falaq", "An-Nas",
  ],
};

/** Jezici koji imaju vlastitu transkripciju; ostali padaju na bosansku. */
type SurahNameLang = keyof typeof SURAH_NAMES;

function surahNameLang(lang: string): SurahNameLang {
  return lang === "de" || lang === "en" ? lang : "bs";
}

/**
 * Naziv sure (1-114) u transkripciji zadanog jezika sučelja. Za jezike bez
 * vlastite liste (sq, tr, ar) vraća bosansku transkripciju.
 */
export function surahName(surahNumber: number, lang: string): string {
  return SURAH_NAMES[surahNameLang(lang)][surahNumber - 1] ?? "";
}

/** Bosanski naziv sure (1-114). Fallback na prazan string van opsega. */
export function surahBosnianName(surahNumber: number): string {
  return SURAH_NAMES.bs[surahNumber - 1] ?? "";
}

/**
 * Svi latinični nazivi jedne sure — za pretragu, da dijete nađe suru i kad
 * kuca bosanski naziv u njemačkom sučelju (i obrnuto).
 */
export function surahSearchNames(surahNumber: number): string[] {
  return (Object.keys(SURAH_NAMES) as SurahNameLang[])
    .map((l) => SURAH_NAMES[l][surahNumber - 1] ?? "")
    .filter(Boolean);
}

/**
 * Naziv sure za prikaz: skida "سُورَةُ " prefiks i završne harakate (genitivnu
 * kasru i sl.) da ostane kanonski oblik (npr. "الْمَائِدَةِ" -> "الْمَائِدَة").
 */
export function surahArabicDisplayName(rawName: string): string {
  return rawName
    .replace(/^سُورَةُ\s*/, "")
    .replace(/[\u064B-\u0652\u0670]+$/u, "");
}

export interface PageAyah extends Ayah {
  surah: number; // broj sure kojoj ajet pripada
  surahArabicName: string; // arapski naziv sure (za zaglavlje na stranici)
}

export const QURAN_PAGES = 604;

/** Učitava jednu Mushaf stranicu (1-604). Ajeti mogu pripadati više sura. */
export async function fetchPage(p: number): Promise<PageAyah[]> {
  const r = await fetch(`${API}/page/${p}/quran-uthmani`);
  if (!r.ok) throw new Error("Neuspješno učitavanje stranice.");
  const j = await r.json();
  const ayahs = j?.data?.ayahs;
  if (!Array.isArray(ayahs)) throw new Error("Neispravan odgovor servera (stranica).");
  return ayahs.map((a: any) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    surah: a.surah?.number,
    surahArabicName: surahArabicDisplayName(a.surah?.name ?? ""),
    text: cleanAyahText(a.surah?.number, a.numberInSurah, a.text),
  }));
}

export function revelationLabel(type: string): string {
  if (type === "Meccan") return "Mekka";
  if (type === "Medinan") return "Medina";
  return type;
}
