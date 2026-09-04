type SurahNameRule = {
  pattern: RegExp;
  replacement: string;
};

export const CANONICAL_SURAH_NAMES = [
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
] as const;

function escapedNamePattern(name: string): string {
  return name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/-/g, "[\\s-]*")
    .replace(/['’]/g, "['’]?");
}

const GENERIC_SURAH_NAME_RULES: SurahNameRule[] = CANONICAL_SURAH_NAMES
  .filter((name) => name.includes("-") || name.includes(" "))
  .map((canonical) => ({
    pattern: new RegExp(
      `(?<![\\p{L}\\p{N}])${escapedNamePattern(canonical)}(?![\\p{L}\\p{N}])`,
      "giu",
    ),
    replacement: canonical,
  }));

// Kanonski bosanski oblici naziva kratkih sura koje se pojavljuju u
// mektebskim lekcijama, pitanjima, kvizovima i programu napamet.
const SURAH_NAME_RULES: SurahNameRule[] = [
  { pattern: /(?<![\p{L}\p{N}])(?:el[\s-]*)?f[aā]tiha(?![\p{L}\p{N}])/giu, replacement: "El-Fatiha" },
  { pattern: /(?<![\p{L}\p{N}])el[\s-]*[‘'ʿ]?asr(?![\p{L}\p{N}])/giu, replacement: "El-Asr" },
  { pattern: /(?<![\p{L}\p{N}])el[\s-]*hum(?:a|e)za(?![\p{L}\p{N}])/giu, replacement: "El-Humaza" },
  { pattern: /(?<![\p{L}\p{N}])el[\s-]*f[iī]l(?![\p{L}\p{N}])/giu, replacement: "El-Fil" },
  { pattern: /(?<![\p{L}\p{N}])el[\s-]*kurej[sš](?![\p{L}\p{N}])/giu, replacement: "El-Kurejš" },
  { pattern: /(\bsur(?:a|e|i|u)\s+)kurej[sš](?![\p{L}\p{N}])/giu, replacement: "$1El-Kurejš" },
  { pattern: /(?<![\p{L}\p{N}])kurejs(?![\p{L}\p{N}])/giu, replacement: "El-Kurejš" },
  { pattern: /(?<![\p{L}\p{N}])(?:el[\s-]*)?m[aā]?[uū]n(?![\p{L}\p{N}])/giu, replacement: "El-Maun" },
  { pattern: /(?<![\p{L}\p{N}])(?:el[\s-]*)?kevser(?![\p{L}\p{N}])/giu, replacement: "El-Kevser" },
  { pattern: /(?<![\p{L}\p{N}])(?:el[\s-]*)?k[aā]fir[uū]n(?![\p{L}\p{N}])/giu, replacement: "El-Kafirun" },
  { pattern: /(?<![\p{L}\p{N}])en[\s-]*nasr(?![\p{L}\p{N}])/giu, replacement: "En-Nasr" },
  { pattern: /(?<![\p{L}\p{N}])el[\s-]*(?:leheb|mesed)(?![\p{L}\p{N}])/giu, replacement: "El-Leheb" },
  { pattern: /(?<![\p{L}\p{N}])(?:el[\s-]*)?ihl[aā]s(?![\p{L}\p{N}])/giu, replacement: "El-Ihlas" },
  { pattern: /(?<![\p{L}\p{N}])(?:el[\s-]*)?felek(?![\p{L}\p{N}])/giu, replacement: "El-Felek" },
  // "nas" bez člana je obična riječ u bosanskom, zato ovdje član nije opcionalan.
  { pattern: /(?<![\p{L}\p{N}])en[\s-]*n[aā]s(?![\p{L}\p{N}])/giu, replacement: "En-Nas" },
  ...GENERIC_SURAH_NAME_RULES,
];

export function normalizeSurahNames(text: string): string {
  let normalized = text;
  for (const rule of SURAH_NAME_RULES) {
    normalized = normalized.replace(rule.pattern, rule.replacement);
  }
  const wholeValue = normalized.trim().toLocaleLowerCase("bs");
  for (const canonical of CANONICAL_SURAH_NAMES) {
    if (!canonical.includes("-") && !canonical.includes(" ")
      && wholeValue === canonical.toLocaleLowerCase("bs")) {
      return canonical;
    }
  }
  if (wholeValue === "kurejš" || wholeValue === "kurejs") return "El-Kurejš";
  return normalized;
}

export function normalizeSurahNamesDeep<T>(value: T): T {
  if (typeof value === "string") {
    return normalizeSurahNames(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSurahNamesDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeSurahNamesDeep(item)]),
    ) as T;
  }
  return value;
}