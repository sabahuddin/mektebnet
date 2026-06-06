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

/** Audio jednog ajeta — Husari Mu'allim ("prouči pa ponovi"), vanjski server. */
export function ayahAudioUrl(surah: number, ayahInSurah: number): string {
  return `https://everyayah.com/data/Husary_Muallim_128kbps/${pad3(surah)}${pad3(ayahInSurah)}.mp3`;
}

/** Latinični naziv sure bez "Al-/At-/..." varijacija — koristimo englishName
 *  kakav daje API (ustaljena transliteracija). */
export function surahLatinName(meta: SurahMeta): string {
  return meta.englishName;
}

export function revelationLabel(type: string): string {
  if (type === "Meccan") return "Mekkanska";
  if (type === "Medinan") return "Medinska";
  return type;
}
