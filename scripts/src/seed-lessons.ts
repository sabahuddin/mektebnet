import { db } from "@workspace/db";
import { lessonsTable } from "@workspace/db";

const lessons = [
  {
    orderNum: 1,
    slug: "pisma-svijeta",
    title: "Pisma svijeta",
    lessonType: "intro",
    letters: [] as string[],
    durationMin: 20,
    storyData: {
      character: "both",
      lines: [
        { speaker: "Džana", text: "Amir, da li znaš koliko pisama postoji na svijetu?", emotion: "curious" },
        { speaker: "Amir", text: "Hmm... samo latinica i ćirilica?", emotion: "thinking" },
        { speaker: "Džana", text: "Ne! Ima ih mnogo! A mi ćemo naučiti arapsko pismo — pismo Kur'ana!", emotion: "excited" },
        { speaker: "Amir", text: "Waw, to zvuči kul! Počnimo!", emotion: "happy" },
      ],
    },
    letterData: [] as object[],
    exerciseTypes: [] as string[],
  },
  {
    orderNum: 2,
    slug: "elif-hareket",
    title: "Elif i hareketi",
    lessonType: "new_content",
    letters: ["ا"],
    durationMin: 25,
    storyData: {
      character: "dzana",
      lines: [
        { speaker: "Džana", text: "Pogledaj ovo slovo! Izgleda kao stub koji stoji uspravno.", emotion: "happy" },
        { speaker: "Amir", text: "Pa to je kao slovo I na latinici!", emotion: "excited" },
        { speaker: "Džana", text: "Skoro, ali ovo je Elif — prvo slovo arapske abecede. I ima posebno pravilo!", emotion: "curious" },
        { speaker: "Amir", text: "Koje pravilo?", emotion: "thinking" },
        { speaker: "Džana", text: "Elif se nikad ne spaja s lijevom stranom. Ono je 'slobodnjak' 😄", emotion: "happy" },
      ],
    },
    letterData: [
      {
        arabic: "ا",
        name: "Elif",
        transliteration: "a / ā",
        forms: {
          isolated: "ا",
          initial: "ا",
          medial: "ـا",
          final: "ـا",
        },
        dotCount: 0,
        nonConnecting: true,
        visualAssociation: "Uspravni stub — stoji sam i ponosan",
        soundFile: "/sounds/elif.mp3",
      },
    ] as object[],
    exerciseTypes: ["find_letter", "which_form", "yes_no", "listen_recognize"],
  },
  {
    orderNum: 3,
    slug: "ba-ta-tha",
    title: "Tri brata s tačkama",
    lessonType: "new_content",
    letters: ["ب", "ت", "ث"],
    durationMin: 30,
    storyData: {
      character: "both",
      lines: [
        { speaker: "Amir", text: "Džana, ova tri slova izgledaju iste! Kako ih razlikujemo?", emotion: "confused" },
        { speaker: "Džana", text: "Gledaj tačke! Ba ima jednu tačku ispod, Ta dvije gore, a Tha tri gore!", emotion: "teaching" },
        { speaker: "Amir", text: "Kao tri brata koji izgledaju isto, ali imaju različit broj tačkica!", emotion: "happy" },
        { speaker: "Džana", text: "Odlično! Tačno tako! Sad ih nećeš zaboraviti 😊", emotion: "proud" },
      ],
    },
    letterData: [
      {
        arabic: "ب",
        name: "Ba",
        transliteration: "b",
        forms: {
          isolated: "ب",
          initial: "بـ",
          medial: "ـبـ",
          final: "ـب",
        },
        dotCount: 1,
        nonConnecting: false,
        visualAssociation: "Lađica s jednom tačkom ispod — jedna jedina jedrica",
        soundFile: "/sounds/ba.mp3",
      },
      {
        arabic: "ت",
        name: "Ta",
        transliteration: "t",
        forms: {
          isolated: "ت",
          initial: "تـ",
          medial: "ـتـ",
          final: "ـت",
        },
        dotCount: 2,
        nonConnecting: false,
        visualAssociation: "Lađica s dvije tačke gore — dvije oči gledaju gore",
        soundFile: "/sounds/ta.mp3",
      },
      {
        arabic: "ث",
        name: "Tha",
        transliteration: "th",
        forms: {
          isolated: "ث",
          initial: "ثـ",
          medial: "ـثـ",
          final: "ـث",
        },
        dotCount: 3,
        nonConnecting: false,
        visualAssociation: "Lađica s tri tačke gore — trofejni čamac",
        soundFile: "/sounds/tha.mp3",
      },
    ] as object[],
    exerciseTypes: ["find_letter", "count_dots", "which_form", "yes_no", "group_difference", "listen_recognize"],
  },
  {
    orderNum: 4,
    slug: "jim-ha-hha",
    title: "Jim, Ha i Hha",
    lessonType: "new_content",
    letters: ["ج", "ح", "خ"],
    durationMin: 30,
    storyData: {
      character: "both",
      lines: [
        { speaker: "Džana", text: "Ova tri slova su jako slična! Gledaj — svi imaju isti oblik.", emotion: "teaching" },
        { speaker: "Amir", text: "Aha! A razliku prave tačke, zar ne?", emotion: "excited" },
        { speaker: "Džana", text: "Tačno! Jim ima jednu tačku ispod, Ha nema ni jednu, a Hha ima jednu gore!", emotion: "happy" },
        { speaker: "Amir", text: "Jim-Ha-Hha... To je kao porodica!", emotion: "happy" },
      ],
    },
    letterData: [
      {
        arabic: "ج",
        name: "Jim",
        transliteration: "dž / j",
        forms: {
          isolated: "ج",
          initial: "جـ",
          medial: "ـجـ",
          final: "ـج",
        },
        dotCount: 1,
        nonConnecting: false,
        visualAssociation: "Kuka s tačkom ispod — kao udica za ribolov",
        soundFile: "/sounds/jim.mp3",
      },
      {
        arabic: "ح",
        name: "Ha",
        transliteration: "h (grleno)",
        forms: {
          isolated: "ح",
          initial: "حـ",
          medial: "ـحـ",
          final: "ـح",
        },
        dotCount: 0,
        nonConnecting: false,
        visualAssociation: "Kuka bez tačke — prazna udica",
        soundFile: "/sounds/ha.mp3",
      },
      {
        arabic: "خ",
        name: "Hha",
        transliteration: "h (duboko)",
        forms: {
          isolated: "خ",
          initial: "خـ",
          medial: "ـخـ",
          final: "ـخ",
        },
        dotCount: 1,
        nonConnecting: false,
        visualAssociation: "Kuka s tačkom gore — udica s mamcem",
        soundFile: "/sounds/hha.mp3",
      },
    ] as object[],
    exerciseTypes: ["find_letter", "count_dots", "which_form", "yes_no", "group_difference", "listen_recognize"],
  },
  {
    orderNum: 5,
    slug: "dal-zal",
    title: "Dal i Zal",
    lessonType: "new_content",
    letters: ["د", "ذ"],
    durationMin: 25,
    storyData: {
      character: "amir",
      lines: [
        { speaker: "Amir", text: "Džana, ovo slovo izgleda kao gljiva ili šešir!", emotion: "amused" },
        { speaker: "Džana", text: "Haha, da! To je Dal. Nema tačke. A Zal je isti, samo s tačkom gore.", emotion: "happy" },
        { speaker: "Amir", text: "I oba su posebna — ne spajaju se s lijevom stranom!", emotion: "excited" },
        { speaker: "Džana", text: "Bravo! Zapamtio si pravilo!", emotion: "proud" },
      ],
    },
    letterData: [
      {
        arabic: "د",
        name: "Dal",
        transliteration: "d",
        forms: {
          isolated: "د",
          initial: "د",
          medial: "ـد",
          final: "ـد",
        },
        dotCount: 0,
        nonConnecting: true,
        visualAssociation: "Šešir bez tačke — gljiva",
        soundFile: "/sounds/dal.mp3",
      },
      {
        arabic: "ذ",
        name: "Zal",
        transliteration: "z (meko)",
        forms: {
          isolated: "ذ",
          initial: "ذ",
          medial: "ـذ",
          final: "ـذ",
        },
        dotCount: 1,
        nonConnecting: true,
        visualAssociation: "Šešir s tačkom — gljiva s kapljom kiše",
        soundFile: "/sounds/zal.mp3",
      },
    ] as object[],
    exerciseTypes: ["find_letter", "count_dots", "which_form", "yes_no", "group_difference", "listen_recognize"],
  },
  {
    orderNum: 6,
    slug: "ba-ponavljanje",
    title: "Ponavljanje: Ba",
    lessonType: "repeat",
    letters: ["ب"],
    durationMin: 20,
    storyData: {
      character: "dzana",
      lines: [
        { speaker: "Džana", text: "Sjećaš se Ba? Lađica s jednom tačkom ispod! Danas ga ponavljamo.", emotion: "encouraging" },
        { speaker: "Amir", text: "Znam, znam! Ba se spaja s lijevom stranom — to sam naučio!", emotion: "confident" },
      ],
    },
    letterData: [
      {
        arabic: "ب",
        name: "Ba",
        transliteration: "b",
        forms: {
          isolated: "ب",
          initial: "بـ",
          medial: "ـبـ",
          final: "ـب",
        },
        dotCount: 1,
        nonConnecting: false,
        visualAssociation: "Lađica s jednom tačkom ispod",
        soundFile: "/sounds/ba.mp3",
      },
    ] as object[],
    exerciseTypes: ["find_letter", "count_dots", "which_form", "yes_no", "listen_recognize"],
  },
];

async function seed() {
  console.log("Seeding lessons...");
  for (const lesson of lessons) {
    await db
      .insert(lessonsTable)
      .values(lesson)
      .onConflictDoUpdate({
        target: lessonsTable.slug,
        set: {
          title: lesson.title,
          lessonType: lesson.lessonType,
          letters: lesson.letters,
          durationMin: lesson.durationMin,
          storyData: lesson.storyData as object,
          letterData: lesson.letterData,
          exerciseTypes: lesson.exerciseTypes,
        },
      });
    console.log(`  ✓ ${lesson.title}`);
  }
  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
