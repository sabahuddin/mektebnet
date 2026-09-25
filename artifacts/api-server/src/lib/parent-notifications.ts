export type NotificationLang = "bs" | "en" | "de" | "sq";

export function notificationLang(value: string | null | undefined): NotificationLang {
  return value === "en" || value === "de" || value === "sq" ? value : "bs";
}

type Event =
  | { type: "homework"; child: string; title: string }
  | { type: "grade"; child: string; grade: string; subject: string }
  | { type: "homeworkGrade"; child: string; grade: string; title?: string };

const descriptions: Record<NotificationLang, { done: string; notDone: string; memorized: string; other: string }> = {
  bs: { done: "Urađeno", notDone: "Neurađeno", memorized: "Napamet", other: "Ostali sadržaji" },
  en: { done: "Completed", notDone: "Not completed", memorized: "Memorization", other: "Other topics" },
  de: { done: "Erledigt", notDone: "Nicht erledigt", memorized: "Auswendiglernen", other: "Weitere Inhalte" },
  sq: { done: "E kryer", notDone: "E pakryer", memorized: "Përmendësh", other: "Përmbajtje të tjera" },
};

const subjects: Record<string, Record<NotificationLang, string>> = {
  Kiraet: { bs: "Kiraet", en: "Quran recitation", de: "Koranrezitation", sq: "Leximi i Kuranit" },
  Vjerovanje: { bs: "Vjerovanje", en: "Faith", de: "Glaube", sq: "Besimi" },
  Ibadet: { bs: "Ibadet", en: "Worship", de: "Gottesdienst", sq: "Adhurimi" },
  Ahlak: { bs: "Ahlak", en: "Ethics", de: "Ethik", sq: "Morali" },
  "Historija islama": { bs: "Historija islama", en: "Islamic history", de: "Islamische Geschichte", sq: "Historia islame" },
  "Kur'an": { bs: "Kur'an", en: "Quran", de: "Koran", sq: "Kurani" },
};

function label(value: string, lang: NotificationLang): string {
  if (value === "Urađeno") return descriptions[lang].done;
  if (value === "Neurađeno") return descriptions[lang].notDone;
  if (value === "Napamet") return descriptions[lang].memorized;
  if (value === "Ostali sadržaji") return descriptions[lang].other;
  if (subjects[value]) return subjects[value][lang];
  return value; // Muallimov naslov ili nedefinisana oblast ostaje izvorni tekst.
}

export function parentNotification(event: Event, lang: NotificationLang): { naslov: string; sadrzaj: string } {
  const { child } = event;
  if (event.type === "homework") {
    const title = event.title;
    switch (lang) {
      case "en": return { naslov: `New homework for ${child}`, sadrzaj: `Your child ${child} has received new homework: "${title}".` };
      case "de": return { naslov: `Neue Hausaufgabe für ${child}`, sadrzaj: `Ihr Kind ${child} hat eine neue Hausaufgabe erhalten: „${title}“.` };
      case "sq": return { naslov: `Detyrë e re për ${child}`, sadrzaj: `Fëmija juaj ${child} ka marrë një detyrë të re: "${title}".` };
      default: return { naslov: `Nova zadaća za ${child}`, sadrzaj: `Vaše dijete ${child} je dobilo novu zadaću: "${title}".` };
    }
  }
  const grade = label(event.grade, lang);
  if (event.type === "grade") {
    const subject = label(event.subject, lang);
    switch (lang) {
      case "en": return { naslov: `New grade for ${child}`, sadrzaj: `Your child ${child} received a new grade (${grade}) in ${subject}.` };
      case "de": return { naslov: `Neue Bewertung für ${child}`, sadrzaj: `Ihr Kind ${child} hat im Fach ${subject} eine neue Bewertung (${grade}) erhalten.` };
      case "sq": return { naslov: `Vlerësim i ri për ${child}`, sadrzaj: `Fëmija juaj ${child} ka marrë një vlerësim të ri (${grade}) në lëndën ${subject}.` };
      default: return { naslov: `Nova ocjena za ${child}`, sadrzaj: `Vaše dijete ${child} je dobilo novu ocjenu (${grade}) iz predmeta ${subject}.` };
    }
  }
  const title = event.title;
  switch (lang) {
    case "en": return { naslov: `New grade for ${child}`, sadrzaj: title ? `Your child ${child} received a grade of ${grade} for the homework "${title}".` : `Your child ${child} received a homework grade of ${grade}.` };
    case "de": return { naslov: `Neue Bewertung für ${child}`, sadrzaj: title ? `Ihr Kind ${child} hat für die Hausaufgabe „${title}“ die Bewertung ${grade} erhalten.` : `Ihr Kind ${child} hat für eine Hausaufgabe die Bewertung ${grade} erhalten.` };
    case "sq": return { naslov: `Vlerësim i ri për ${child}`, sadrzaj: title ? `Fëmija juaj ${child} ka marrë vlerësimin ${grade} për detyrën "${title}".` : `Fëmija juaj ${child} ka marrë vlerësimin ${grade} për një detyrë.` };
    default: return { naslov: `Nova ocjena za ${child}`, sadrzaj: title ? `Vaše dijete ${child} je dobilo ocjenu ${grade} iz zadaće "${title}".` : `Vaše dijete ${child} je dobilo ocjenu ${grade} iz zadaće.` };
  }
}