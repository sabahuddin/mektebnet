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
  return t;
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
];

export const DEFAULT_RECITER_ID = "husary_muallim";

export function reciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

/** Audio jednog ajeta sa odabranog učača (vanjski server). */
export function ayahAudioUrl(surah: number, ayahInSurah: number, reciterFolder: string): string {
  return `https://everyayah.com/data/${reciterFolder}/${pad3(surah)}${pad3(ayahInSurah)}.mp3`;
}

// Bosanski (latinični) nazivi sura — preuzeto sa islam.ba radi ujednačene
// transliteracije (npr. "El-Bekara", "Ali Imran", "Ja-Sin").
const BOSNIAN_NAMES: string[] = [
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
];

/** Bosanski naziv sure (1-114). Fallback na prazan string van opsega. */
export function surahBosnianName(surahNumber: number): string {
  return BOSNIAN_NAMES[surahNumber - 1] ?? "";
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
  if (type === "Meccan") return "Mekkanska";
  if (type === "Medinan") return "Medinska";
  return type;
}
