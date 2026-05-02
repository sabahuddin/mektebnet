// Statička banka zemalja za igre "Glavni gradovi" i "Zastave".
// Pitanja se generišu run-time iz ove liste — distraktori se biraju nasumično
// iz preostalih zemalja (preferirano iz iste regije ako je moguće, fallback global).
//
// Naziv države je TAČAN ODGOVOR u oba kviza, pa mora biti jednoznačan i
// formatiran kako učenik realno vidi (bosanski). Glavni grad je pitanje u
// "Glavni gradovi", emoji je pitanje u "Zastave".

export interface ZemljaEntry {
  /** Naziv države na bosanskom — služi kao tačan odgovor. */
  drzava: string;
  /** ISO 3166-1 alpha-2 (lowercase). Rezerva za eventualnu zamjenu emojija SVG-om. */
  iso2: string;
  /** Unicode regional-indicator zastava (radi out-of-the-box, bez asseta). */
  emoji: string;
  /** Glavni grad (bosanski naziv). */
  glavniGrad: string;
  /** Geo/kulturna regija za kvalitetnije distraktore. */
  region: "balkan" | "muslim_az" | "muslim_af" | "evropa" | "amerike" | "azija" | "afrika" | "okeanija";
}

export const ZEMLJE: ZemljaEntry[] = [
  // === Balkan ===
  { drzava: "Bosna i Hercegovina", iso2: "ba", emoji: "🇧🇦", glavniGrad: "Sarajevo", region: "balkan" },
  { drzava: "Hrvatska", iso2: "hr", emoji: "🇭🇷", glavniGrad: "Zagreb", region: "balkan" },
  { drzava: "Srbija", iso2: "rs", emoji: "🇷🇸", glavniGrad: "Beograd", region: "balkan" },
  { drzava: "Crna Gora", iso2: "me", emoji: "🇲🇪", glavniGrad: "Podgorica", region: "balkan" },
  { drzava: "Sjeverna Makedonija", iso2: "mk", emoji: "🇲🇰", glavniGrad: "Skoplje", region: "balkan" },
  { drzava: "Slovenija", iso2: "si", emoji: "🇸🇮", glavniGrad: "Ljubljana", region: "balkan" },
  { drzava: "Albanija", iso2: "al", emoji: "🇦🇱", glavniGrad: "Tirana", region: "balkan" },
  { drzava: "Kosovo", iso2: "xk", emoji: "🇽🇰", glavniGrad: "Priština", region: "balkan" },

  // === Muslimanske zemlje – Bliski istok / Sjeverna Afrika / Centralna Azija ===
  { drzava: "Turska", iso2: "tr", emoji: "🇹🇷", glavniGrad: "Ankara", region: "muslim_az" },
  { drzava: "Saudijska Arabija", iso2: "sa", emoji: "🇸🇦", glavniGrad: "Rijad", region: "muslim_az" },
  { drzava: "Iran", iso2: "ir", emoji: "🇮🇷", glavniGrad: "Teheran", region: "muslim_az" },
  { drzava: "Irak", iso2: "iq", emoji: "🇮🇶", glavniGrad: "Bagdad", region: "muslim_az" },
  { drzava: "Sirija", iso2: "sy", emoji: "🇸🇾", glavniGrad: "Damask", region: "muslim_az" },
  { drzava: "Jordan", iso2: "jo", emoji: "🇯🇴", glavniGrad: "Aman", region: "muslim_az" },
  { drzava: "Liban", iso2: "lb", emoji: "🇱🇧", glavniGrad: "Bejrut", region: "muslim_az" },
  { drzava: "Palestina", iso2: "ps", emoji: "🇵🇸", glavniGrad: "Kuds", region: "muslim_az" },
  { drzava: "Jemen", iso2: "ye", emoji: "🇾🇪", glavniGrad: "Sana'a", region: "muslim_az" },
  { drzava: "Oman", iso2: "om", emoji: "🇴🇲", glavniGrad: "Maskat", region: "muslim_az" },
  { drzava: "Katar", iso2: "qa", emoji: "🇶🇦", glavniGrad: "Doha", region: "muslim_az" },
  { drzava: "Bahrein", iso2: "bh", emoji: "🇧🇭", glavniGrad: "Manama", region: "muslim_az" },
  { drzava: "Kuvajt", iso2: "kw", emoji: "🇰🇼", glavniGrad: "Kuvajt", region: "muslim_az" },
  { drzava: "Ujedinjeni Arapski Emirati", iso2: "ae", emoji: "🇦🇪", glavniGrad: "Abu Dabi", region: "muslim_az" },
  { drzava: "Pakistan", iso2: "pk", emoji: "🇵🇰", glavniGrad: "Islamabad", region: "muslim_az" },
  { drzava: "Afganistan", iso2: "af", emoji: "🇦🇫", glavniGrad: "Kabul", region: "muslim_az" },
  { drzava: "Bangladeš", iso2: "bd", emoji: "🇧🇩", glavniGrad: "Daka", region: "muslim_az" },
  { drzava: "Indonezija", iso2: "id", emoji: "🇮🇩", glavniGrad: "Džakarta", region: "muslim_az" },
  { drzava: "Malezija", iso2: "my", emoji: "🇲🇾", glavniGrad: "Kuala Lumpur", region: "muslim_az" },
  { drzava: "Azerbejdžan", iso2: "az", emoji: "🇦🇿", glavniGrad: "Baku", region: "muslim_az" },
  { drzava: "Kazahstan", iso2: "kz", emoji: "🇰🇿", glavniGrad: "Astana", region: "muslim_az" },
  { drzava: "Uzbekistan", iso2: "uz", emoji: "🇺🇿", glavniGrad: "Taškent", region: "muslim_az" },
  { drzava: "Kirgistan", iso2: "kg", emoji: "🇰🇬", glavniGrad: "Bišek", region: "muslim_az" },
  { drzava: "Tadžikistan", iso2: "tj", emoji: "🇹🇯", glavniGrad: "Dušanbe", region: "muslim_az" },
  { drzava: "Turkmenistan", iso2: "tm", emoji: "🇹🇲", glavniGrad: "Aškabat", region: "muslim_az" },

  // === Muslimanske zemlje – Afrika ===
  { drzava: "Egipat", iso2: "eg", emoji: "🇪🇬", glavniGrad: "Kairo", region: "muslim_af" },
  { drzava: "Maroko", iso2: "ma", emoji: "🇲🇦", glavniGrad: "Rabat", region: "muslim_af" },
  { drzava: "Alžir", iso2: "dz", emoji: "🇩🇿", glavniGrad: "Alžir", region: "muslim_af" },
  { drzava: "Tunis", iso2: "tn", emoji: "🇹🇳", glavniGrad: "Tunis", region: "muslim_af" },
  { drzava: "Libija", iso2: "ly", emoji: "🇱🇾", glavniGrad: "Tripoli", region: "muslim_af" },
  { drzava: "Sudan", iso2: "sd", emoji: "🇸🇩", glavniGrad: "Hartum", region: "muslim_af" },
  { drzava: "Somalija", iso2: "so", emoji: "🇸🇴", glavniGrad: "Mogadiš", region: "muslim_af" },
  { drzava: "Senegal", iso2: "sn", emoji: "🇸🇳", glavniGrad: "Dakar", region: "muslim_af" },
  { drzava: "Mali", iso2: "ml", emoji: "🇲🇱", glavniGrad: "Bamako", region: "muslim_af" },
  { drzava: "Nigerija", iso2: "ng", emoji: "🇳🇬", glavniGrad: "Abudža", region: "muslim_af" },

  // === Evropa ===
  { drzava: "Njemačka", iso2: "de", emoji: "🇩🇪", glavniGrad: "Berlin", region: "evropa" },
  { drzava: "Francuska", iso2: "fr", emoji: "🇫🇷", glavniGrad: "Pariz", region: "evropa" },
  { drzava: "Italija", iso2: "it", emoji: "🇮🇹", glavniGrad: "Rim", region: "evropa" },
  { drzava: "Španija", iso2: "es", emoji: "🇪🇸", glavniGrad: "Madrid", region: "evropa" },
  { drzava: "Portugal", iso2: "pt", emoji: "🇵🇹", glavniGrad: "Lisabon", region: "evropa" },
  { drzava: "Velika Britanija", iso2: "gb", emoji: "🇬🇧", glavniGrad: "London", region: "evropa" },
  { drzava: "Irska", iso2: "ie", emoji: "🇮🇪", glavniGrad: "Dablin", region: "evropa" },
  { drzava: "Holandija", iso2: "nl", emoji: "🇳🇱", glavniGrad: "Amsterdam", region: "evropa" },
  { drzava: "Belgija", iso2: "be", emoji: "🇧🇪", glavniGrad: "Brisel", region: "evropa" },
  { drzava: "Austrija", iso2: "at", emoji: "🇦🇹", glavniGrad: "Beč", region: "evropa" },
  { drzava: "Švicarska", iso2: "ch", emoji: "🇨🇭", glavniGrad: "Bern", region: "evropa" },
  { drzava: "Mađarska", iso2: "hu", emoji: "🇭🇺", glavniGrad: "Budimpešta", region: "evropa" },
  { drzava: "Češka", iso2: "cz", emoji: "🇨🇿", glavniGrad: "Prag", region: "evropa" },
  { drzava: "Slovačka", iso2: "sk", emoji: "🇸🇰", glavniGrad: "Bratislava", region: "evropa" },
  { drzava: "Poljska", iso2: "pl", emoji: "🇵🇱", glavniGrad: "Varšava", region: "evropa" },
  { drzava: "Rumunija", iso2: "ro", emoji: "🇷🇴", glavniGrad: "Bukurešt", region: "evropa" },
  { drzava: "Bugarska", iso2: "bg", emoji: "🇧🇬", glavniGrad: "Sofija", region: "evropa" },
  { drzava: "Grčka", iso2: "gr", emoji: "🇬🇷", glavniGrad: "Atina", region: "evropa" },
  { drzava: "Švedska", iso2: "se", emoji: "🇸🇪", glavniGrad: "Stockholm", region: "evropa" },
  { drzava: "Norveška", iso2: "no", emoji: "🇳🇴", glavniGrad: "Oslo", region: "evropa" },
  { drzava: "Danska", iso2: "dk", emoji: "🇩🇰", glavniGrad: "Kopenhagen", region: "evropa" },
  { drzava: "Finska", iso2: "fi", emoji: "🇫🇮", glavniGrad: "Helsinki", region: "evropa" },
  { drzava: "Island", iso2: "is", emoji: "🇮🇸", glavniGrad: "Rejkjavik", region: "evropa" },
  { drzava: "Rusija", iso2: "ru", emoji: "🇷🇺", glavniGrad: "Moskva", region: "evropa" },
  { drzava: "Ukrajina", iso2: "ua", emoji: "🇺🇦", glavniGrad: "Kijev", region: "evropa" },

  // === Amerike ===
  { drzava: "Sjedinjene Američke Države", iso2: "us", emoji: "🇺🇸", glavniGrad: "Vašington", region: "amerike" },
  { drzava: "Kanada", iso2: "ca", emoji: "🇨🇦", glavniGrad: "Otava", region: "amerike" },
  { drzava: "Meksiko", iso2: "mx", emoji: "🇲🇽", glavniGrad: "Meksiko Siti", region: "amerike" },
  { drzava: "Brazil", iso2: "br", emoji: "🇧🇷", glavniGrad: "Brazilija", region: "amerike" },
  { drzava: "Argentina", iso2: "ar", emoji: "🇦🇷", glavniGrad: "Buenos Ajres", region: "amerike" },
  { drzava: "Čile", iso2: "cl", emoji: "🇨🇱", glavniGrad: "Santjago", region: "amerike" },
  { drzava: "Peru", iso2: "pe", emoji: "🇵🇪", glavniGrad: "Lima", region: "amerike" },
  { drzava: "Kolumbija", iso2: "co", emoji: "🇨🇴", glavniGrad: "Bogota", region: "amerike" },
  { drzava: "Kuba", iso2: "cu", emoji: "🇨🇺", glavniGrad: "Havana", region: "amerike" },

  // === Azija (ne-muslimanska većina) ===
  { drzava: "Kina", iso2: "cn", emoji: "🇨🇳", glavniGrad: "Peking", region: "azija" },
  { drzava: "Japan", iso2: "jp", emoji: "🇯🇵", glavniGrad: "Tokio", region: "azija" },
  { drzava: "Južna Koreja", iso2: "kr", emoji: "🇰🇷", glavniGrad: "Seul", region: "azija" },
  { drzava: "Indija", iso2: "in", emoji: "🇮🇳", glavniGrad: "Nju Delhi", region: "azija" },
  { drzava: "Vijetnam", iso2: "vn", emoji: "🇻🇳", glavniGrad: "Hanoj", region: "azija" },
  { drzava: "Tajland", iso2: "th", emoji: "🇹🇭", glavniGrad: "Bangkok", region: "azija" },
  { drzava: "Filipini", iso2: "ph", emoji: "🇵🇭", glavniGrad: "Manila", region: "azija" },
  { drzava: "Nepal", iso2: "np", emoji: "🇳🇵", glavniGrad: "Katmandu", region: "azija" },

  // === Afrika (ne-muslimanska većina) ===
  { drzava: "Južnoafrička Republika", iso2: "za", emoji: "🇿🇦", glavniGrad: "Pretorija", region: "afrika" },
  { drzava: "Kenija", iso2: "ke", emoji: "🇰🇪", glavniGrad: "Najrobi", region: "afrika" },
  { drzava: "Etiopija", iso2: "et", emoji: "🇪🇹", glavniGrad: "Adis Abeba", region: "afrika" },
  { drzava: "Gana", iso2: "gh", emoji: "🇬🇭", glavniGrad: "Akra", region: "afrika" },

  // === Okeanija ===
  { drzava: "Australija", iso2: "au", emoji: "🇦🇺", glavniGrad: "Kanbera", region: "okeanija" },
  { drzava: "Novi Zeland", iso2: "nz", emoji: "🇳🇿", glavniGrad: "Velington", region: "okeanija" },
];

// Prosti Fisher–Yates shuffle (vraća novu kopiju, ne mutira ulaz).
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generička funkcija: za dati zemlja-entry vrati 4 opcije (1 tačna + 3 distraktora).
// Distraktori se biraju primarno iz iste regije, fallback iz cijelog seta.
// Vraća { options, answer } — answer je `drzava` iz entry-ja, options sadrži answer.
function pickOptions(entry: ZemljaEntry, allowed: ZemljaEntry[]): { options: string[]; answer: string } {
  const correct = entry.drzava;
  const candidates = allowed.filter(z => z.drzava !== correct);

  // Prvi pokušaj: 3 distraktora iz iste regije
  const sameRegion = shuffle(candidates.filter(z => z.region === entry.region)).slice(0, 3);

  // Dopuna iz cijelog pool-a ako u istoj regiji nema dovoljno
  const need = 3 - sameRegion.length;
  const filler = need > 0
    ? shuffle(candidates.filter(z => !sameRegion.some(s => s.drzava === z.drzava))).slice(0, need)
    : [];

  const distractors = [...sameRegion, ...filler].map(z => z.drzava);
  const options = shuffle([correct, ...distractors]);
  return { options, answer: correct };
}

// === Glavni gradovi: pitanje = naziv grada, opcije = 4 države ===
export interface KvizPitanjeBase {
  question: string;
  options: string[];
  answer: string;
}
export interface KvizPitanjeFlag extends KvizPitanjeBase {
  flagEmoji?: string;
  flagIso2?: string;
}

export function pickGradoviQuestions(n: number): KvizPitanjeBase[] {
  const order = shuffle(ZEMLJE).slice(0, n);
  return order.map(z => {
    const { options, answer } = pickOptions(z, ZEMLJE);
    return { question: z.glavniGrad, options, answer };
  });
}

// === Zastave: pitanje = "Koja je ovo zastava?" + emoji, opcije = 4 države ===
export function pickZastaveQuestions(n: number): KvizPitanjeFlag[] {
  const order = shuffle(ZEMLJE).slice(0, n);
  return order.map(z => {
    const { options, answer } = pickOptions(z, ZEMLJE);
    return {
      question: "Koja je ovo zastava?",
      options,
      answer,
      flagEmoji: z.emoji,
      flagIso2: z.iso2,
    };
  });
}
