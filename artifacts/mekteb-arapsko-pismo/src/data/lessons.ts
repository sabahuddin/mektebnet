import { READING_WORDS_BY_LESSON } from "@/data/reading-word-bank";

export interface ExerciseItem {
  show: string;
  answer: string;
  audio?: string;
}

export interface Exercise {
  type: "prepoznaj-hareket" | "koji-harf" | "slušaj" | "napiši" | "koji-znak" | "čitaj-slog" | "pronadi-harf";
  title: string;
  description: string;
  icon: string;
  hasanatReward: number;
  choices: string[];
  items: ExerciseItem[];
  pool?: string[];
  targetCount?: number;
}

export interface HarfData {
  arabic: string;
  name: string;
  transliteration: string;
  forms: { isolated: string; initial: string; medial: string; final: string };
  nonConnecting?: boolean;
  visualAssociation: string;
  soundFile: string;
}

export interface HarekeData {
  arabic: string;
  hareke: string;
  name: string;
  sound: string;
  colour: string;
  description: string;
  napomena: string | null;
  /** Null dok snimak učača nije stručno provjeren i odobren. */
  soundFile: string | null;
  speakText?: string;
}

export interface SukunExplainer {
  sentence: string;
  metaphor: { auto: string; hareketi: string; sukun: string };
}

export interface LessonData {
  id: number;
  orderNum: number;
  slug: string;
  title: string;
  letters: string[];
  isCompleted: boolean;
  isRevision?: boolean;
  /** Napredna lekcija koja je dostupna samo za administratorski pregled. */
  isDraft?: boolean;
  story: { lines: { speaker: "dzana" | "amir" | "narator" | "otac" | "majka" | "muallim"; text: string }[] };
  letterData: HarfData[];
  hareketi?: HarekeData[];
  hareketiTitle?: string;
  sukunExplainer?: SukunExplainer;
  exercises: Exercise[];
}

const HAREKETI_L2: HarekeData[] = [
  {
    arabic: "ـَ", hareke: "ـَـ", name: "Fetha",
    sound: "e", colour: "teal",
    description: "Crtica iznad slova — daje kratki glas \"e\"",
    napomena: "Iznad krupnih (jakih) harfova čita se \"a\"",
    soundFile: "hareke-fatha.mp3",
  },
  {
    arabic: "ـِ", hareke: "ـِـ", name: "Kesra",
    sound: "i", colour: "blue",
    description: "Crtica ispod slova — daje kratki glas \"i\"",
    napomena: null,
    soundFile: "hareke-kasra.mp3",
  },
  {
    arabic: "ـُ", hareke: "ـُـ", name: "Damma",
    sound: "u", colour: "violet",
    description: "Zarez iznad slova — daje kratki glas \"u\"",
    napomena: null,
    soundFile: "hareke-damma.mp3",
  },
];

const ALL_ARABIC_LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص",
  "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];

export const LESSONS: LessonData[] = [

  // ── LEKCIJA 2 ───────────────────────────────────────────────
  {
    id: 2, orderNum: 2, slug: "elif-hareketi",
    title: "Elif, hemze i hareketi",
    letters: ["ا"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "narator", text: "Džana i Amir su ušli u očevu sobu. Babo je radio za računarom — po stolu su bili rašireni planovi, bilježnice i olovke. Ali pored tastature, na svom posebnom mjestu, stajao je Mushaf." },
        { speaker: "narator", text: "Džana ga je uzela u ruke." },
        { speaker: "dzana",   text: "Babo, kako ti čitaš ovo? Slova idu naopako." },
        { speaker: "narator", text: "Otac je odmaknuo pogled od ekrana i nasmijao se." },
        { speaker: "otac",    text: "Nisu naopako, dušo. Idu s desna na lijevo. Kao što svaka rijeka teče na svoju stranu. A vi biste mogli naučiti ovu rijeku čitati, a jednog dana možda je i napamet znati." },
        { speaker: "narator", text: "Otac je otvorio Mushaf. Prstom je pokazao jedno tanko, uspravno slovo." },
        { speaker: "otac",    text: "Ovo je elif. Stoji ravno, kao uspravan štap. Danas ćemo uz njega upoznati i hemzu — poseban harf koji se na početku riječi može pisati iznad ili ispod elifa." },
        { speaker: "narator", text: "Amir se napravio važan i ispravio leđa." },
        { speaker: "amir",    text: "I šta on govori, taj Elif? Nećemo valjda svaki put kazati elif kada ga vidimo — to su četiri slova: E – L – I – F." },
        { speaker: "otac",    text: "Ime harfa je elif. Sam elif najčešće služi za produžavanje glasa, a kratki početni glas u oblicima أَ، إِ، أُ nosi hemza." },
        { speaker: "amir",    text: "Čekaj, kako može slovo biti tiho?" },
        { speaker: "otac",    text: "U arapskom razlikujemo elif, hemzu i kratki glas koji daje hareket. Zato pažljivo gledamo šta je napisano i slušamo pravilan izgovor." },
        { speaker: "narator", text: "Djeca su gledala iznenađeno." },
        { speaker: "otac",    text: "Crticu iznad zovemo fetha, crticu ispod kesra, a mali zarez iznad damma. To su kratki glasovi. Latinica je samo pomoć; izgovor uvijek učimo slušanjem učača." },
        { speaker: "amir",    text: "A imaju li te crtice zajednički naziv?" },
        { speaker: "otac",    text: "Naravno. Zajedno se zovu HAREKETI — znaci koji harfovima daju glas!" },
      ]
    },
    letterData: [
      {
        arabic: "ا", name: "Elif", transliteration: "dugo a / nosač hemze",
        forms: { isolated: "ا", initial: "ا", medial: "ـا", final: "ـا" },
        nonConnecting: true,
        visualAssociation: "Kao uspravan štap — jednostavan i snažan",
        soundFile: "elif.mp3",
      }
    ],
    hareketi: HAREKETI_L2,
    exercises: [
      {
        type: "prepoznaj-hareket",
        title: "Prepoznaj hareket", description: "Pogledaj hareket — koji je to hareket?",
        icon: "👁️", hasanatReward: 15,
        choices: ["Fetha", "Kesra", "Damma"],
        items: [
          { show: "ـَ", answer: "Fetha" }, { show: "ـِ", answer: "Kesra" }, { show: "ـُ", answer: "Damma" },
          { show: "ـُ", answer: "Damma" }, { show: "ـَ", answer: "Fetha" }, { show: "ـِ", answer: "Kesra" },
          { show: "ـَ", answer: "Fetha" }, { show: "ـُ", answer: "Damma" }, { show: "ـِ", answer: "Kesra" },
          { show: "ـَ", answer: "Fetha" }, { show: "ـِ", answer: "Kesra" }, { show: "ـُ", answer: "Damma" },
          { show: "ـَ", answer: "Fetha" }, { show: "ـِ", answer: "Kesra" }, { show: "ـُ", answer: "Damma" },
          { show: "ـَ", answer: "Fetha" }, { show: "ـُ", answer: "Damma" }, { show: "ـِ", answer: "Kesra" },
          { show: "ـَ", answer: "Fetha" }, { show: "ـُ", answer: "Damma" },
        ]
      },
      {
        type: "koji-znak",
        title: "Koji glas?", description: "Pogledaj hemzu na ili ispod elifa — koji kratki glas čuješ?",
        icon: "🔤", hasanatReward: 15,
        choices: ["e", "i", "u"],
        items: [
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" }, { show: "أُ", answer: "u" },
          { show: "إِ", answer: "i" }, { show: "أَ", answer: "e" }, { show: "أُ", answer: "u" },
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" }, { show: "أُ", answer: "u" },
          { show: "إِ", answer: "i" }, { show: "أَ", answer: "e" }, { show: "أُ", answer: "u" },
          { show: "أَ", answer: "e" }, { show: "أُ", answer: "u" }, { show: "إِ", answer: "i" },
          { show: "أَ", answer: "e" }, { show: "أُ", answer: "u" }, { show: "إِ", answer: "i" },
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" },
        ]
      },
      {
        type: "slušaj",
        title: "Slušaj i odaberi", description: "Pritisni dugme — koji elif odgovara glasu koji čuješ?",
        icon: "🎧", hasanatReward: 20,
        choices: ["أَ", "إِ", "أُ"],
        items: [
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "إِ", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "إِ", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "إِ", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "إِ", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "إِ", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "إِ", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "أَ", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "أُ", audio: "hareke-damma.mp3" },
        ]
      },
      {
        type: "napiši",
        title: "Napiši glas", description: "Pogledaj hemzu s hareketom — napiši pomoćni latinični glas (e, i ili u)",
        icon: "✏️", hasanatReward: 10,
        choices: [],
        items: [
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" }, { show: "أُ", answer: "u" },
          { show: "أَ", answer: "e" }, { show: "أُ", answer: "u" }, { show: "إِ", answer: "i" },
          { show: "أُ", answer: "u" }, { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" },
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" }, { show: "أُ", answer: "u" },
          { show: "أَ", answer: "e" }, { show: "أُ", answer: "u" }, { show: "إِ", answer: "i" },
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" }, { show: "أُ", answer: "u" },
          { show: "أَ", answer: "e" }, { show: "إِ", answer: "i" },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Čitaj hemzu s hareketima",
        description: "Prepoznaj položaj hemze i pročitaj kratki glas.",
        icon: "📖", hasanatReward: 25, choices: [],
        items: [
          { show: "أَ", answer: "Hemza + fetha" }, { show: "إِ", answer: "Hemza + kesra" }, { show: "أُ", answer: "Hemza + damma" },
          { show: "أَ", answer: "Hemza + fetha" }, { show: "أُ", answer: "Hemza + damma" }, { show: "إِ", answer: "Hemza + kesra" },
          { show: "إِ", answer: "Hemza + kesra" }, { show: "أَ", answer: "Hemza + fetha" }, { show: "أُ", answer: "Hemza + damma" },
          { show: "أُ", answer: "Hemza + damma" }, { show: "إِ", answer: "Hemza + kesra" }, { show: "أَ", answer: "Hemza + fetha" },
          { show: "أَ", answer: "Hemza + fetha" }, { show: "إِ", answer: "Hemza + kesra" }, { show: "أُ", answer: "Hemza + damma" },
          { show: "إِ", answer: "Hemza + kesra" }, { show: "أُ", answer: "Hemza + damma" }, { show: "أَ", answer: "Hemza + fetha" },
        ],
      },
    ]
  },

  // ── LEKCIJA 3 ───────────────────────────────────────────────
  {
    id: 3, orderNum: 3, slug: "ba-ta-sa",
    title: "Ba, Ta i Sa",
    letters: ["ب", "ت", "ث"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "narator", text: "Sljedeće jutro Amir je prvi sjeo za sto. Otvorio je bilježnicu na čistoj stranici i nacrtao nešto — malu zdjelu s tačkicom ispod." },
        { speaker: "narator", text: "Kad je Džana ušla, pokazao joj je crtež." },
        { speaker: "dzana",   text: "Šta je ovo?" },
        { speaker: "amir",    text: "Čamac. Ili zdjela. Ne znam još." },
        { speaker: "narator", text: "Babo je prolazio hodnikom i bacio pogled kroz otvorena vrata." },
        { speaker: "otac",    text: "Amire, to što si nacrtao — to je harf BA." },
        { speaker: "narator", text: "Djeca su se okrenula." },
        { speaker: "amir",    text: "Ozbiljno? Ja sam ga nacrtao, a nisam ni znao?" },
        { speaker: "narator", text: "Babo je ušao i sjeo na rub kreveta." },
        { speaker: "otac",    text: "Ovaj harf liči na malu zdjelu — vidite, ovaj luk ispod? A tačkica ispod je njegov znak. Samo jedna tačkica, i ona je ispod. Ovaj harf se zove BA i ima glas — isti kao naše slovo B. Kad mu staviš fethu — BE. Kesru — BI. Dammu — BU." },
        { speaker: "dzana",   text: "Be-bi-bu..." },
        { speaker: "amir",    text: "Ko iz čitanke!" },
        { speaker: "otac",    text: "Upravo tako. Dok budete učili ostale harfove, vidjet ćete da su tačkice veoma, veoma važne — iako su veoma, veoma male." },
        { speaker: "amir",    text: "Znači, ima još slova s tačkicama?" },
        { speaker: "otac",    text: "Naravno. Ako ovaj tvoj čamac, Amire, ima dvije tačkice iznad — onda je to harf TA, glas kao naše T. A ako ima tri tačkice iznad — onda je harf SA. Taj glas ne postoji u bosanskom. Vrh jezika lagano stavimo između zuba i izgovorimo bez glasa, slično engleskom 'th' u riječi 'three'. Poslušajte snimak i ponovite." },
      ]
    },
    letterData: [
      {
        arabic: "ب", name: "Ba", transliteration: "B",
        forms: { isolated: "ب", initial: "بـ", medial: "ـبـ", final: "ـب" },
        visualAssociation: "Čamac s jednom tačkom ispod — jedina tačka drži brod na dnu",
        soundFile: "ba.mp3",
      },
      {
        arabic: "ت", name: "Ta", transliteration: "T",
        forms: { isolated: "ت", initial: "تـ", medial: "ـتـ", final: "ـت" },
        visualAssociation: "Isti čamac, ali dvije tačkice iznad — kao dva oka koja gledaju gore",
        soundFile: "ta.mp3",
      },
      {
        arabic: "ث", name: "Sa", transliteration: "TH / θ",
        forms: { isolated: "ث", initial: "ثـ", medial: "ـثـ", final: "ـث" },
        visualAssociation: "Isti čamac s tri tačkice iznad — kao mali krovčić od zvjezdica",
        soundFile: "sa.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf",
        title: "Ba, Ta ili Sa?",
        description: "Sva tri izgledaju slično — razlikuju se samo po tačkicama! Koji je harf?",
        icon: "🔡", hasanatReward: 15,
        choices: ["Ba", "Ta", "Sa"],
        items: [
          { show: "ب", answer: "Ba"  }, { show: "ت", answer: "Ta"  }, { show: "ث", answer: "Sa"  },
          { show: "ت", answer: "Ta"  }, { show: "ث", answer: "Sa"  }, { show: "ب", answer: "Ba"  },
          { show: "ب", answer: "Ba"  }, { show: "ث", answer: "Sa"  }, { show: "ت", answer: "Ta"  },
          { show: "ث", answer: "Sa"  }, { show: "ب", answer: "Ba"  }, { show: "ت", answer: "Ta"  },
        ]
      },
      {
        type: "pronadi-harf",
        title: "Pronađi Ba!",
        description: "Pronađi sva slova ب u gridu — pazi na tačkice!",
        icon: "🔍", hasanatReward: 20,
        choices: [], items: [{ show: "ب", answer: "Ba" }],
        pool: ["ت", "ث", "ا", "ت", "ث"],
        targetCount: 6,
      },
      {
        type: "pronadi-harf",
        title: "Pronađi Sa!",
        description: "Pronađi sva slova ث u gridu — tri tačkice iznad!",
        icon: "🔍", hasanatReward: 20,
        choices: [], items: [{ show: "ث", answer: "Sa" }],
        pool: ["ب", "ت", "ا", "ب", "ت"],
        targetCount: 6,
      },
      {
        type: "koji-harf",
        title: "Riječ s dva slova",
        description: "Dva harfa spojena zajedno — polako pročitaj i odaberi ispravan izgovor",
        icon: "🔗", hasanatReward: 20,
        choices: ["be-te", "te-be", "se-be", "bi-te", "tu-be", "be-se", "se-te", "ti-be", "bu-se", "a-be", "a-te", "te-se", "si-be"],
        items: [
          { show: "بَتَ", answer: "be-te" },
          { show: "تَبَ", answer: "te-be" },
          { show: "ثَبَ", answer: "se-be" },
          { show: "بِتَ", answer: "bi-te" },
          { show: "تُبَ", answer: "tu-be" },
          { show: "بَثَ", answer: "be-se" },
          { show: "ثَتَ", answer: "se-te" },
          { show: "تِبَ", answer: "ti-be" },
          { show: "بُثَ", answer: "bu-se" },
          { show: "أَبَ", answer: "a-be"  },
          { show: "أَتَ", answer: "a-te"  },
          { show: "تَثَ", answer: "te-se" },
          { show: "ثِبَ", answer: "si-be" },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Čitaj slogove",
        description: "Pročitaj svaki slog naglas — klikni da čuješ ispravan izgovor",
        icon: "📖", hasanatReward: 25,
        choices: [],
        items: [
          { show: "بَ",     answer: "be"      },
          { show: "بِ",     answer: "bi"      },
          { show: "بُ",     answer: "bu"      },
          { show: "تَ",     answer: "te"      },
          { show: "تِ",     answer: "ti"      },
          { show: "تُ",     answer: "tu"      },
          { show: "ثَ",     answer: "se"      },
          { show: "ثِ",     answer: "si"      },
          { show: "ثُ",     answer: "su"      },
          { show: "بَتَ",   answer: "be-te"   },
          { show: "تَبَ",   answer: "te-be"   },
          { show: "بِتَ",   answer: "bi-te"   },
          { show: "تِبَ",   answer: "ti-be"   },
          { show: "بُتَ",   answer: "bu-te"   },
          { show: "تُبَ",   answer: "tu-be"   },
          { show: "بَثَ",   answer: "be-se"   },
          { show: "ثَبَ",   answer: "se-be"   },
          { show: "بِثَ",   answer: "bi-se"   },
          { show: "ثِبَ",   answer: "si-be"   },
          { show: "تَثَ",   answer: "te-se"   },
          { show: "ثَتَ",   answer: "se-te"   },
          { show: "أَبَ",   answer: "a-be"    },
          { show: "أَتَ",   answer: "a-te"    },
          { show: "أَثَ",   answer: "a-se"    },
          { show: "بَتَثَ", answer: "be-te-se" },
          { show: "تَبَثَ", answer: "te-be-se" },
          { show: "أَبَتَ", answer: "a-be-te"  },
          { show: "ثَبَتَ", answer: "se-be-te" },
          { show: "بِتَثَ", answer: "bi-te-se" },
          { show: "أَتَثَ", answer: "a-te-se"  },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Vježba čitanja",
        description: "Pročitaj svaku riječ naglas — harfovi بَ تَ ثَ / بُ تُ ثُ",
        icon: "📖", hasanatReward: 30,
        choices: [],
        items: [
          { show: "أَبَتَ", answer: "a-be-te"  },
          { show: "أَتَبَ", answer: "a-te-be"  },
          { show: "أَثَبَ", answer: "a-se-be"  },
          { show: "بَأَتَ", answer: "be-a-te"  },
          { show: "بَتَأَ", answer: "be-te-a"  },
          { show: "بَتَثَ", answer: "be-te-se" },
          { show: "بَثَتَ", answer: "be-se-te" },
          { show: "تَأَبَ", answer: "te-a-be"  },
          { show: "تَبَأَ", answer: "te-be-a"  },
          { show: "تَبَثَ", answer: "te-be-se" },
          { show: "تَثَبَ", answer: "te-se-be" },
          { show: "ثَأَبَ", answer: "se-a-be"  },
          { show: "ثَبَأَ", answer: "se-be-a"  },
          { show: "ثَبَتَ", answer: "se-be-te" },
          { show: "ثَتَبَ", answer: "se-te-be" },
          { show: "أَبُتُ", answer: "a-bu-tu"  },
          { show: "أَتُبُ", answer: "a-tu-bu"  },
          { show: "أَثُبُ", answer: "a-su-bu"  },
          { show: "بُأَتُ", answer: "bu-a-tu"  },
          { show: "بُتَأُ", answer: "bu-te-u"  },
          { show: "بُتُثُ", answer: "bu-tu-su" },
          { show: "بُثَتُ", answer: "bu-se-tu" },
          { show: "تُأَبُ", answer: "tu-a-bu"  },
          { show: "تُبَأُ", answer: "tu-be-u"  },
          { show: "تُبُثُ", answer: "tu-bu-su" },
          { show: "تُثَبُ", answer: "tu-se-bu" },
          { show: "ثُأَبُ", answer: "su-a-bu"  },
          { show: "ثُبَأُ", answer: "su-be-u"  },
          { show: "ثُبُتُ", answer: "su-bu-tu" },
          { show: "ثُتَبُ", answer: "su-te-bu" },
        ]
      },
    ]
  },

  // ── LEKCIJA 4 ───────────────────────────────────────────────
  {
    id: 4, orderNum: 4, slug: "dzim-ha-ha",
    title: "Džim, Ha i Hâ",
    letters: ["ج", "ح", "خ"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "narator", text: "Bila je nedjelja. Babo je čistio auto, a Džana i Amir su se vratili iz mekteba i sjeli za sto ispred ulaznih vrata. Amir je bio neobično miran — listao je bilježnicu i nešto tiho mumljao." },
        { speaker: "narator", text: "Tada je babo izišao iz auta s krpom u ruci, prišao im i sagnuo se nad bilježnicu. Bila su nacrtana tri ista zakrivljena oblika — kao kuka koja je sjela da se odmori. Ali svaki je imao nešto svoje. Jedan je imao tačkicu ispod. Drugi nije imao ništa. Treći je imao tačkicu iznad." },
        { speaker: "otac",   text: "Šta je to? Novi harfovi?" },
        { speaker: "amir",   text: "Da. Muallim nam je jutros pokazao novu porodicu harfova. Rekao je da su si toliko slični da ih djeca uvijek miješaju. A ja neću da ih pomiješam i hoću odmah sada da ponovim ono što nam je objasnio u mektebu." },
        { speaker: "dzana",  text: "Muallim je rekao — gledajte oblik, pa gledajte tačkice. Ko ne gleda tačkice, čita pogrešno." },
        { speaker: "otac",   text: "I koji je koji?" },
        { speaker: "amir",   text: "Ovaj s tačkicom ispod je DŽIM. DŽ — ko naše slovo. Džamija, džep, džezva." },
        { speaker: "dzana",  text: "I moje ime! 😊" },
        { speaker: "amir",   text: "Ovaj bez tačkice je HA. I tu sam zapeo. Muallim ga je izgovarao, a ja nisam mogao ponoviti. Svi su mogli osim mene. Pa i Džana." },
        { speaker: "otac",   text: "Da čujem, Džana." },
        { speaker: "dzana",  text: "Muallim nam je rekao — kao kada neko bude jako žedan ljeti, pa se napije vode i kaže — hhhh." },
        { speaker: "otac",   text: "Vaš muallim zna kako se objašnjava djeci. A ovaj treći harf, Amire, možeš li njega izgovoriti?" },
        { speaker: "amir",   text: "Treći je opet HA, ali drugačiji. To ja mislim da mogu. Tačkica iznad. Muallim kaže — zamislite da vam nešto zapne u grlu i htjednete iskašljati. Ali kulturno." },
        { speaker: "amir",   text: "I rekao nam je da mi taj glas već koristimo, samo ne znamo. Kad slatko spavamo i hrčemo. Onda si mi ti naumpao, Babo — kad na sećiji zaspeš poslijepodne i zahrčeš!" },
        { speaker: "narator", text: "Amir je počeo imitirati oca kako hrče, trudeći se izgovoriti hrapavo slovo H. Sve troje su se nasmijali i ušli u kuću." },
      ]
    },
    letterData: [
      {
        arabic: "ج", name: "Džim", transliteration: "Dž",
        forms: { isolated: "ج", initial: "جـ", medial: "ـجـ", final: "ـج" },
        visualAssociation: "Udubina s jednom tačkom ispod — tačka sjedi na dnu posude",
        soundFile: "dzim.mp3",
      },
      {
        arabic: "ح", name: "Ha", transliteration: "H (toplo)",
        forms: { isolated: "ح", initial: "حـ", medial: "ـحـ", final: "ـح" },
        visualAssociation: "Ista udubina bez tačke — prazan, tih i mekan glas",
        soundFile: "ha.mp3",
      },
      {
        arabic: "خ", name: "Hâ", transliteration: "H (grlo)",
        forms: { isolated: "خ", initial: "خـ", medial: "ـخـ", final: "ـخ" },
        visualAssociation: "Ista udubina s tačkom iznad — tačka 'greba' iz grla",
        soundFile: "ha2.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf",
        title: "Džim, Ha ili Hâ?",
        description: "Sva tri imaju isti oblik — razlika je samo u tački! Koji je harf?",
        icon: "🔡", hasanatReward: 15,
        choices: ["Džim", "Ha", "Hâ"],
        items: [
          { show: "ج", answer: "Džim" }, { show: "ح", answer: "Ha" }, { show: "خ", answer: "Hâ" },
          { show: "ح", answer: "Ha"   }, { show: "ج", answer: "Džim" }, { show: "خ", answer: "Hâ" },
          { show: "خ", answer: "Hâ"   }, { show: "ح", answer: "Ha" }, { show: "ج", answer: "Džim" },
          { show: "خ", answer: "Hâ"   }, { show: "ج", answer: "Džim" }, { show: "ح", answer: "Ha" },
        ]
      },
      {
        type: "pronadi-harf",
        title: "Pronađi Ha!",
        description: "Pronađi sva slova ح u gridu — bez tačke, ne pobrkaj s Džim i Hâ!",
        icon: "🔍", hasanatReward: 20,
        choices: [], items: [{ show: "ح", answer: "Ha" }],
        pool: ["ج", "خ", "ب", "ت", "ث", "ج", "خ"],
        targetCount: 6,
      },
      {
        type: "pronadi-harf",
        title: "Pronađi Hâ!",
        description: "Pronađi sva slova خ u gridu — tačka iznad razlikuje Hâ od Ha!",
        icon: "🔍", hasanatReward: 20,
        choices: [], items: [{ show: "خ", answer: "Hâ" }],
        pool: ["ج", "ح", "ب", "ت", "ث", "ج", "ح"],
        targetCount: 6,
      },
      {
        type: "slušaj",
        title: "Džim, Ha ili Hâ — slušaj!",
        description: "Tri harfa koja izgledaju isto, ali zvuče različito. Pritisni 🔊 — koji si čuo?",
        icon: "🎧", hasanatReward: 20,
        choices: ["ج", "ح", "خ"],
        items: [
          { show: "🔊", answer: "ج", audio: "dzim.mp3" },
          { show: "🔊", answer: "ح", audio: "ha.mp3"   },
          { show: "🔊", answer: "خ", audio: "ha2.mp3"  },
          { show: "🔊", answer: "ح", audio: "ha.mp3"   },
          { show: "🔊", answer: "خ", audio: "ha2.mp3"  },
          { show: "🔊", answer: "ج", audio: "dzim.mp3" },
          { show: "🔊", answer: "خ", audio: "ha2.mp3"  },
          { show: "🔊", answer: "ج", audio: "dzim.mp3" },
          { show: "🔊", answer: "ح", audio: "ha.mp3"   },
          { show: "🔊", answer: "ج", audio: "dzim.mp3" },
          { show: "🔊", answer: "ح", audio: "ha.mp3"   },
          { show: "🔊", answer: "خ", audio: "ha2.mp3"  },
        ]
      },
      {
        type: "koji-harf",
        title: "Riječ s dva slova",
        description: "Svih 7 harfova spojeno — pročitaj naglas i odaberi ispravan izgovor",
        icon: "🔗", hasanatReward: 25,
        choices: ["dže-be", "ha-be", "hâ-be", "be-dže", "te-dže", "se-dže", "ha-dže", "dže-ha", "hâ-dže", "dži-be", "hi-te", "dže-te", "bu-ha", "hâ-se", "bi-dže"],
        items: [
          { show: "جَبَ", answer: "dže-be"  },
          { show: "حَبَ", answer: "ha-be"   },
          { show: "خَبَ", answer: "hâ-be"   },
          { show: "بَجَ", answer: "be-dže"  },
          { show: "تَجَ", answer: "te-dže"  },
          { show: "ثَجَ", answer: "se-dže"  },
          { show: "حَجَ", answer: "ha-dže"  },
          { show: "جَحَ", answer: "dže-ha"  },
          { show: "خَجَ", answer: "hâ-dže"  },
          { show: "جِبَ", answer: "dži-be"  },
          { show: "حِتَ", answer: "hi-te"   },
          { show: "جَتَ", answer: "dže-te"  },
          { show: "بُحَ", answer: "bu-ha"   },
          { show: "خَثَ", answer: "hâ-se"   },
          { show: "بِجَ", answer: "bi-dže"  },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Čitaj slogove — svih 7 harfova",
        description: "Pročitaj svaki slog naglas — klikni da čuješ ispravan izgovor",
        icon: "📖", hasanatReward: 25,
        choices: [],
        items: [
          { show: "جَ",     answer: "dže"       },
          { show: "جِ",     answer: "dži"       },
          { show: "جُ",     answer: "džu"       },
          { show: "حَ",     answer: "ha"        },
          { show: "حِ",     answer: "hi"        },
          { show: "حُ",     answer: "hu"        },
          { show: "خَ",     answer: "hâ"        },
          { show: "خِ",     answer: "hâ-i"      },
          { show: "خُ",     answer: "hâ-u"      },
          { show: "جَبَ",   answer: "dže-be"    },
          { show: "حَبَ",   answer: "ha-be"     },
          { show: "خَبَ",   answer: "hâ-be"     },
          { show: "بَجَ",   answer: "be-dže"    },
          { show: "تَجَ",   answer: "te-dže"    },
          { show: "ثَجَ",   answer: "se-dže"    },
          { show: "حَجَ",   answer: "ha-dže"    },
          { show: "جَحَ",   answer: "dže-ha"    },
          { show: "خَجَ",   answer: "hâ-dže"    },
          { show: "جِبَ",   answer: "dži-be"    },
          { show: "حِتَ",   answer: "hi-te"     },
          { show: "خُبَ",   answer: "hâ-u-be"   },
          { show: "بَحَثَ", answer: "be-ha-se"  },
          { show: "حَجَبَ", answer: "ha-dže-be" },
          { show: "خَبَثَ", answer: "hâ-be-se"  },
          { show: "جَبَتَ", answer: "dže-be-te" },
          { show: "حَبَثَ", answer: "ha-be-se"  },
          { show: "تَجَحَ", answer: "te-dže-ha" },
          { show: "خَجَبَ", answer: "hâ-dže-be" },
          { show: "جِبَثَ", answer: "dži-be-se" },
          { show: "بُجُحَ", answer: "bu-džu-ha" },
        ]
      },
    ]
  },

  // ── LEKCIJA 5 ───────────────────────────────────────────────
  {
    id: 5, orderNum: 5, slug: "ponavljanje-sedam-harfova",
    title: "Ponavljanje",
    letters: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
    isCompleted: false,
    isRevision: true,
    story: {
      lines: [
        { speaker: "narator", text: "Amir je sjedio sam za stolom. Sufara je bila otvorena pred njim. Prstom je išao od harfa do harfa i poluglasno izgovarao harfove sa hareketima. Muallim im je u mektebu kazao da je veoma važno sebe slušati dok ih izgovaramo. Harfovi se ne mogu čitati očima. Oni se moraju izgovarati. Što ih više čitamo i izgovaramo, to se bolje privikavamo na njihove oblike i bolje ih pamtimo." },
        { speaker: "amir",    text: "اَلِف... بَ... تَ... ثَ... جِيم... حَ... خَ..." },
        { speaker: "narator", text: "Onda je uzeo tablet, pronašao aplikaciju za učenje harfova i krenuo redom — slušao je izgovor svakog harfa po nekoliko puta, pa onda ponavljao glasno. Sam sebi. Zastao je kod حَ bez tačkice. Pritisnuo play još jednom. I još jednom." },
        { speaker: "amir",    text: "Sedam harfova. A tek sam počeo." },
        { speaker: "narator", text: "Džana mu je prišla i bacila pogled na otvorenu sufaru i upaljeni tablet." },
        { speaker: "dzana",   text: "Hajde da i ja poslušam kako se ispravno izgovaraju harfovi kojih nema u bosanskom jeziku. To je ثَ..." },
        { speaker: "amir",    text: "Čekaj... Znam i ja. حَ je duboki, blagi glas iz sredine grla, a خَ je hrapaviji glas iz gornjeg dijela grla. Poslušaj!" },
        { speaker: "narator", text: "Amir je nekoliko puta pokušavao izgovoriti harf حَ." },
        { speaker: "dzana",   text: "Super. Nije loše, Amire." },
        { speaker: "narator", text: "U međuvremenu majka je zastala na vratima i ponosno gledala djecu kako uče svoje prve harfove. Prišla im je, zagrlila ih i kazala:" },
        { speaker: "majka",   text: "Eh, da vas sad dedo Husein vidi. Bio bi ponosan." },
      ]
    },
    letterData: [
      {
        arabic: "ا", name: "Elif", transliteration: "E / I / U",
        forms: { isolated: "ا", initial: "ا", medial: "ـا", final: "ـا" },
        nonConnecting: true,
        visualAssociation: "Uspravan štap",
        soundFile: "elif.mp3",
      },
      {
        arabic: "ب", name: "Ba", transliteration: "B",
        forms: { isolated: "ب", initial: "بـ", medial: "ـبـ", final: "ـب" },
        visualAssociation: "Čamac s jednom tačkom ispod",
        soundFile: "ba.mp3",
      },
      {
        arabic: "ت", name: "Ta", transliteration: "T",
        forms: { isolated: "ت", initial: "تـ", medial: "ـتـ", final: "ـت" },
        visualAssociation: "Čamac s dvije tačke iznad",
        soundFile: "ta.mp3",
      },
      {
        arabic: "ث", name: "Sa", transliteration: "S (meko)",
        forms: { isolated: "ث", initial: "ثـ", medial: "ـثـ", final: "ـث" },
        visualAssociation: "Čamac s tri tačke iznad",
        soundFile: "sa.mp3",
      },
      {
        arabic: "ج", name: "Džim", transliteration: "Dž",
        forms: { isolated: "ج", initial: "جـ", medial: "ـجـ", final: "ـج" },
        visualAssociation: "Udubina s tačkom ispod",
        soundFile: "dzim.mp3",
      },
      {
        arabic: "ح", name: "Ha", transliteration: "H (toplo)",
        forms: { isolated: "ح", initial: "حـ", medial: "ـحـ", final: "ـح" },
        visualAssociation: "Udubina bez tačke",
        soundFile: "ha.mp3",
      },
      {
        arabic: "خ", name: "Hâ", transliteration: "H (grlo)",
        forms: { isolated: "خ", initial: "خـ", medial: "ـخـ", final: "ـخ" },
        visualAssociation: "Udubina s tačkom iznad",
        soundFile: "ha2.mp3",
      },
    ],
    exercises: [
      {
        type: "čitaj-slog",
        title: "Ponovi sve slogove",
        description: "Pročitaj svaki slog naglas — kreni od jednog, pa dva, pa tri harfa",
        icon: "📖", hasanatReward: 30,
        choices: [],
        items: [
          { show: "بَ",     answer: "be"         },
          { show: "تِ",     answer: "ti"         },
          { show: "جُ",     answer: "džu"        },
          { show: "حَ",     answer: "ha"         },
          { show: "خِ",     answer: "hâ-i"       },
          { show: "ثُ",     answer: "su"         },
          { show: "أَ",     answer: "a"          },
          { show: "بَتَ",   answer: "be-te"      },
          { show: "تَجَ",   answer: "te-dže"     },
          { show: "جَحَ",   answer: "dže-ha"     },
          { show: "حَبَ",   answer: "ha-be"      },
          { show: "خَثَ",   answer: "hâ-se"      },
          { show: "ثَجَ",   answer: "se-dže"     },
          { show: "بِحَ",   answer: "bi-ha"      },
          { show: "تُخَ",   answer: "tu-hâ"      },
          { show: "جِبَ",   answer: "dži-be"     },
          { show: "حِتَ",   answer: "hi-te"      },
          { show: "خُبَ",   answer: "hâ-u-be"    },
          { show: "بُجَ",   answer: "bu-dže"     },
          { show: "بَحَثَ", answer: "be-ha-se"   },
          { show: "حَجَبَ", answer: "ha-dže-be"  },
          { show: "خَبَثَ", answer: "hâ-be-se"   },
          { show: "جَبَتَ", answer: "dže-be-te"  },
          { show: "تَجَحَ", answer: "te-dže-ha"  },
          { show: "حَبَثَ", answer: "ha-be-se"   },
          { show: "بُجُحَ", answer: "bu-džu-ha"  },
          { show: "خَجَبَ", answer: "hâ-dže-be"  },
          { show: "جِبَثَ", answer: "dži-be-se"  },
          { show: "ثَبَتَ", answer: "se-be-te"   },
          { show: "تَبَثَ", answer: "te-be-se"   },
        ]
      },
      {
        type: "koji-harf",
        title: "Riječ s dva slova",
        description: "Pogledaj dva harfa spojena zajedno — odaberi ispravan izgovor",
        icon: "🔗", hasanatReward: 25,
        choices: ["be-te", "te-dže", "ha-dže", "hâ-be", "dže-ha", "se-dže", "bi-ha", "tu-hâ", "dži-be", "hi-te", "bu-dže", "ha-be", "hâ-se", "te-ha", "dže-be"],
        items: [
          { show: "بَتَ", answer: "be-te"   },
          { show: "تَجَ", answer: "te-dže"  },
          { show: "حَجَ", answer: "ha-dže"  },
          { show: "خَبَ", answer: "hâ-be"   },
          { show: "جَحَ", answer: "dže-ha"  },
          { show: "ثَجَ", answer: "se-dže"  },
          { show: "بِحَ", answer: "bi-ha"   },
          { show: "تُخَ", answer: "tu-hâ"   },
          { show: "جِبَ", answer: "dži-be"  },
          { show: "حِتَ", answer: "hi-te"   },
          { show: "بُجَ", answer: "bu-dže"  },
          { show: "حَبَ", answer: "ha-be"   },
          { show: "خَثَ", answer: "hâ-se"   },
          { show: "تَحَ", answer: "te-ha"   },
          { show: "جَبَ", answer: "dže-be"  },
        ]
      },
      {
        type: "koji-harf",
        title: "Riječ s tri slova",
        description: "Tri harfa spojena — polako pročitaj i odaberi tačan izgovor",
        icon: "🔗🔗", hasanatReward: 30,
        choices: ["be-ha-se", "ha-dže-be", "hâ-be-se", "dže-be-te", "te-dže-ha", "bu-džu-ha", "hâ-dže-be", "dži-be-se", "se-be-te", "te-be-se", "ha-be-se", "dže-ha-be", "bi-te-se", "a-be-te", "hâ-u-be-dže"],
        items: [
          { show: "بَحَثَ", answer: "be-ha-se"   },
          { show: "حَجَبَ", answer: "ha-dže-be"  },
          { show: "خَبَثَ", answer: "hâ-be-se"   },
          { show: "جَبَتَ", answer: "dže-be-te"  },
          { show: "تَجَحَ", answer: "te-dže-ha"  },
          { show: "بُجُحَ", answer: "bu-džu-ha"  },
          { show: "خَجَبَ", answer: "hâ-dže-be"  },
          { show: "جِبَثَ", answer: "dži-be-se"  },
          { show: "ثَبَتَ", answer: "se-be-te"   },
          { show: "تَبَثَ", answer: "te-be-se"   },
          { show: "حَبَثَ", answer: "ha-be-se"   },
          { show: "جَحَبَ", answer: "dže-ha-be"  },
        ]
      },
    ]
  },

  // ── LEKCIJA 6: DAL, ZAL, RA I ZA ───────────────────────────
  {
    id: 6, orderNum: 6, slug: "dal-zal-ra-za",
    title: "Dal, Zal, Ra i Za",
    letters: ["د", "ذ", "ر", "ز"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "narator", text: "Muallim je na tabli napisao četiri nova harfa: د ذ ر ز. Zatim je između njih dodao kratke linije da pokaže gdje se prekida spajanje." },
        { speaker: "muallim", text: "Ova četiri harfa imaju važno zajedničko pravilo: ne spajaju se s harfom koji dolazi poslije njih. Mogu se spojiti s harfom prije sebe, ali poslije njih počinje novi potez." },
        { speaker: "amir", text: "Znači li to da riječ prekidamo dok je čitamo?" },
        { speaker: "muallim", text: "Ne. Prekida se samo pisana linija, a čitanje ostaje povezano. Zato razlikujemo spajanje u pisanju od tečnog čitanja." },
        { speaker: "dzana", text: "Dal i Zal izgledaju isto, ali Zal ima tačku iznad." },
        { speaker: "muallim", text: "Tačno. Kod harfa Dal vrh jezika dodiruje područje iza gornjih prednjih zuba. Glas je sličan našem D, ali ga učimo slušanjem i ponavljanjem." },
        { speaker: "muallim", text: "Kod harfa Zal vrh jezika lagano dodiruje rub gornjih prednjih zuba i malo se vidi između zuba. Glas je zvučan, sličan engleskom 'th' u riječi 'this'. Nemojte ga pretvoriti u obično Z." },
        { speaker: "amir", text: "A Ra i Za također imaju isti osnovni oblik, samo Za ima tačku?" },
        { speaker: "muallim", text: "Da. Kod harfa Ra vrh jezika prilazi desnima iza gornjih prednjih zuba. Ne treba ga dugo tresti niti ponavljati. Pravila kada se Ra čita krupnije ili tanje učit ćemo kasnije." },
        { speaker: "muallim", text: "Za je zvučan glas sličan našem Z. Zrak prolazi uskim putem između jezika i prednjih zuba, bez dodavanja glasa D ispred njega." },
        { speaker: "dzana", text: "Dakle, tačke razlikuju Dal od Zala i Ra od Za, a sva četiri prekidaju pisanu vezu s narednim harfom." },
        { speaker: "muallim", text: "Odlično. Sada ih prvo prepoznajemo po obliku, zatim po tački, a pravilan izgovor potvrđujemo snimkom učača." },
      ],
    },
    letterData: [
      {
        arabic: "د", name: "Dal", transliteration: "D",
        forms: { isolated: "د", initial: "د", medial: "ـد", final: "ـد" },
        nonConnecting: true,
        visualAssociation: "Savijena linija bez tačke; ne spaja se s harfom poslije sebe",
        soundFile: "dal.mp3",
      },
      {
        arabic: "ذ", name: "Zal", transliteration: "DH / ð",
        forms: { isolated: "ذ", initial: "ذ", medial: "ـذ", final: "ـذ" },
        nonConnecting: true,
        visualAssociation: "Isti oblik kao Dal, ali s jednom tačkom iznad",
        soundFile: "zal.mp3",
      },
      {
        arabic: "ر", name: "Ra", transliteration: "R",
        forms: { isolated: "ر", initial: "ر", medial: "ـر", final: "ـر" },
        nonConnecting: true,
        visualAssociation: "Kratka savijena linija bez tačke; ne spaja se s narednim harfom",
        soundFile: "ra.mp3",
      },
      {
        arabic: "ز", name: "Za", transliteration: "Z",
        forms: { isolated: "ز", initial: "ز", medial: "ـز", final: "ـز" },
        nonConnecting: true,
        visualAssociation: "Isti oblik kao Ra, ali s jednom tačkom iznad",
        soundFile: "zejn.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf",
        title: "Prepoznaj harf", description: "Pogledaj oblik i tačku — koji je ovo harf?",
        icon: "🔡", hasanatReward: 15,
        choices: ["Dal", "Zal", "Ra", "Za"],
        items: [
          { show: "د", answer: "Dal" }, { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" }, { show: "ز", answer: "Za" },
          { show: "ذ", answer: "Zal" }, { show: "د", answer: "Dal" }, { show: "ز", answer: "Za" }, { show: "ر", answer: "Ra" },
          { show: "ر", answer: "Ra" }, { show: "ز", answer: "Za" }, { show: "د", answer: "Dal" }, { show: "ذ", answer: "Zal" },
          { show: "ز", answer: "Za" }, { show: "ر", answer: "Ra" }, { show: "ذ", answer: "Zal" }, { show: "د", answer: "Dal" },
          { show: "د", answer: "Dal" }, { show: "ز", answer: "Za" }, { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" },
        ],
      },
      {
        type: "pronadi-harf",
        title: "Pronađi Dal", description: "Pronađi sva slova د — Dal nema tačku.",
        icon: "🔍", hasanatReward: 20,
        choices: [], items: [{ show: "د", answer: "Dal" }],
        pool: ["ذ", "ر", "ز", "ب", "ت"],
        targetCount: 6,
      },
      {
        type: "pronadi-harf",
        title: "Pronađi Zal", description: "Pronađi sva slova ذ — Zal ima jednu tačku iznad.",
        icon: "🔍", hasanatReward: 20,
        choices: [], items: [{ show: "ذ", answer: "Zal" }],
        pool: ["د", "ر", "ز", "ج", "خ"],
        targetCount: 6,
      },
      {
        type: "koji-harf",
        title: "Harf u spojenom obliku", description: "Harf je spojen s prethodnim harfom. Prepoznaj njegov oblik.",
        icon: "🔗", hasanatReward: 20,
        choices: ["Dal", "Zal", "Ra", "Za"],
        items: [
          { show: "ـد", answer: "Dal" }, { show: "ـذ", answer: "Zal" }, { show: "ـر", answer: "Ra" }, { show: "ـز", answer: "Za" },
          { show: "ـز", answer: "Za" }, { show: "ـد", answer: "Dal" }, { show: "ـذ", answer: "Zal" }, { show: "ـر", answer: "Ra" },
          { show: "ـر", answer: "Ra" }, { show: "ـذ", answer: "Zal" }, { show: "ـد", answer: "Dal" }, { show: "ـز", answer: "Za" },
        ],
      },
      {
        type: "napiši",
        title: "Napiši ime harfa", description: "Pogledaj harf i napiši njegovo ime: Dal, Zal, Ra ili Za.",
        icon: "✏️", hasanatReward: 15,
        choices: [],
        items: [
          { show: "د", answer: "Dal" }, { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" }, { show: "ز", answer: "Za" },
          { show: "ذ", answer: "Zal" }, { show: "ز", answer: "Za" }, { show: "د", answer: "Dal" }, { show: "ر", answer: "Ra" },
        ],
      },
      {
        type: "čitaj-slog",
        title: "Čitaj harfove s hareketima",
        description: "Pročitaj bez pomoći, zatim klikni i provjeri izgovor.",
        icon: "📖", hasanatReward: 30, choices: [],
        items: [
          { show: "دَ", answer: "Dal + fetha" }, { show: "دِ", answer: "Dal + kesra" }, { show: "دُ", answer: "Dal + damma" },
          { show: "ذَ", answer: "Zal + fetha" }, { show: "ذِ", answer: "Zal + kesra" }, { show: "ذُ", answer: "Zal + damma" },
          { show: "رَ", answer: "Ra + fetha" }, { show: "رِ", answer: "Ra + kesra" }, { show: "رُ", answer: "Ra + damma" },
          { show: "زَ", answer: "Za + fetha" }, { show: "زِ", answer: "Za + kesra" }, { show: "زُ", answer: "Za + damma" },
          { show: "ذِ", answer: "Zal + kesra" }, { show: "رَ", answer: "Ra + fetha" }, { show: "دُ", answer: "Dal + damma" },
          { show: "زِ", answer: "Za + kesra" }, { show: "دَ", answer: "Dal + fetha" }, { show: "رُ", answer: "Ra + damma" },
          { show: "ذُ", answer: "Zal + damma" }, { show: "زَ", answer: "Za + fetha" }, { show: "رِ", answer: "Ra + kesra" },
          { show: "دِ", answer: "Dal + kesra" }, { show: "ذَ", answer: "Zal + fetha" }, { show: "زُ", answer: "Za + damma" },
        ],
      },
      {
        type: "čitaj-slog",
        title: "Čitaj spojeve i kratke riječi",
        description: "Čitaj povezano; prekid pisane linije poslije د ذ ر ز nije prekid glasa.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "بَدَ", answer: "Ba–Dal" }, { show: "دَبَ", answer: "Dal–Ba" },
          { show: "تَرَ", answer: "Ta–Ra" }, { show: "رَتَ", answer: "Ra–Ta" },
          { show: "بَذَ", answer: "Ba–Zal" }, { show: "ذَبَ", answer: "Zal–Ba" },
          { show: "جَزَ", answer: "Džim–Za" }, { show: "زَجَ", answer: "Za–Džim" },
          { show: "حَدَ", answer: "Ha–Dal" }, { show: "دَحَ", answer: "Dal–Ha" },
          { show: "خَرَ", answer: "Hâ–Ra" }, { show: "رَخَ", answer: "Ra–Hâ" },
          { show: "بِدُ", answer: "Ba–Dal" }, { show: "دُبِ", answer: "Dal–Ba" },
          { show: "تُرِ", answer: "Ta–Ra" }, { show: "رِتُ", answer: "Ra–Ta" },
          { show: "ثِذُ", answer: "Sa–Zal" }, { show: "ذُثِ", answer: "Zal–Sa" },
          { show: "جُزِ", answer: "Džim–Za" }, { show: "زِجُ", answer: "Za–Džim" },
          { show: "بَدَرَ", answer: "Ba–Dal–Ra" }, { show: "دَرَجَ", answer: "Dal–Ra–Džim" },
          { show: "ذَبَحَ", answer: "Zal–Ba–Ha" }, { show: "رَجَبَ", answer: "Ra–Džim–Ba" },
          { show: "بَحَرَ", answer: "Ba–Ha–Ra" }, { show: "حَذَرَ", answer: "Ha–Zal–Ra" },
          { show: "خَرَجَ", answer: "Hâ–Ra–Džim" }, { show: "بَرَزَ", answer: "Ba–Ra–Za" },
          { show: "جَذَرَ", answer: "Džim–Zal–Ra" }, { show: "حَجَرَ", answer: "Ha–Džim–Ra" },
        ],
      },
    ],
  },

  // ── LEKCIJA 7: SUKUN — RAZVOJNI NACRT ──────────────────────
  {
    id: 7, orderNum: 7, slug: "sukun",
    title: "Sukun",
    letters: ["\u0640\u0640\u0652"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "narator", text: "Muallim ulazi u učionicu s pitanjem za razred." },
        { speaker: "muallim", text: "Djeco, danas učimo o sukunu. Ali prvo — sukun NIJE harf. Sukun je znak koji stoji na harfu kad taj harf nema hareketa." },
        { speaker: "amir",    text: "A šta znači da nema hareketa?" },
        { speaker: "muallim", text: "Zamislite: harf je auto. Hareketi — fetha, kesra, damma — su motor i točkovi. Kad ih stavimo na harf, auto se pokrene i čujemo glas: 'be', 'bi', 'bu'." },
        { speaker: "muallim", text: "Harf sa sukunom nema svoj samoglasnik. Vežemo ga za glas koji dolazi prije njega i njime zatvaramo slog: أَبْ čitamo 'eb', a بَتْ čitamo 'bet'." },
        { speaker: "dzana",   text: "Oo! I zato sukun izgleda kao krug — kao nula! Nula hareketa!" },
        { speaker: "muallim", text: "Odlično, Džana! Sukun ne čitamo samostalno. Uvijek ga vježbamo u slogu, zajedno s glasom koji mu prethodi." },
        { speaker: "amir",    text: "Dakle: بَ je otvoren slog, a u أَبْ harf بْ zatvara slog. Sad razumijem!" },
      ]
    },
    letterData: [],
    hareketi: [],
    sukunExplainer: {
      sentence: "Sukun pokazuje da harf nema vlastiti samoglasnik. Takav harf ne čitamo samostalno, nego ga vežemo za prethodni glas i njime zatvaramo slog: أَبْ = eb, بَتْ = bet.",
      metaphor: {
        auto:     "🚗  Harf je auto",
        hareketi: "⚙️  Hareketi (fetha, kesra, damma) su motor i točkovi — pokreću harf, čujemo glas",
        sukun:    "🔇  Sukun = nema samoglasnika — harf se veže za prethodni glas i zatvara slog",
      },
    },
    exercises: [
      {
        type: "prepoznaj-hareket",
        title: "Prepoznaj znak", description: "Pogledaj znak na pomoćnoj crti — koji je hareket ili sukun?",
        icon: "🔍", hasanatReward: 15,
        choices: ["Fetha", "Kesra", "Damma", "Sukun"],
        items: [
          { show: "ـَ", answer: "Fetha"  }, { show: "ـِ", answer: "Kesra"  }, { show: "ـُ", answer: "Damma"  }, { show: "ـْ", answer: "Sukun"  },
          { show: "ـْ", answer: "Sukun"  }, { show: "ـَ", answer: "Fetha"  }, { show: "ـُ", answer: "Damma"  }, { show: "ـِ", answer: "Kesra"  },
          { show: "ـِ", answer: "Kesra"  }, { show: "ـْ", answer: "Sukun"  }, { show: "ـَ", answer: "Fetha"  }, { show: "ـُ", answer: "Damma"  },
          { show: "ـُ", answer: "Damma"  }, { show: "ـِ", answer: "Kesra"  }, { show: "ـْ", answer: "Sukun"  }, { show: "ـَ", answer: "Fetha"  },
          { show: "ـْ", answer: "Sukun"  }, { show: "ـُ", answer: "Damma"  }, { show: "ـِ", answer: "Kesra"  }, { show: "ـْ", answer: "Sukun"  },
        ]
      },
      {
        type: "koji-znak",
        title: "Sukun ili hareket?", description: "Pogledaj harf — nosi li sukun ili hareket?",
        icon: "👁️", hasanatReward: 15,
        choices: ["Sukun", "Fetha", "Kesra", "Damma"],
        items: [
          { show: "بْ", answer: "Sukun" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra"  },
          { show: "حُ", answer: "Damma" }, { show: "خْ", answer: "Sukun" }, { show: "ثَ", answer: "Fetha"  },
          { show: "بِ", answer: "Kesra" }, { show: "تُ", answer: "Damma" }, { show: "جْ", answer: "Sukun"  },
          { show: "حَ", answer: "Fetha" }, { show: "خِ", answer: "Kesra" }, { show: "ثُ", answer: "Damma"  },
          { show: "بْ", answer: "Sukun" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra"  },
          { show: "حْ", answer: "Sukun" }, { show: "خَ", answer: "Fetha" }, { show: "ثِ", answer: "Kesra"  },
          { show: "بُ", answer: "Damma" }, { show: "جْ", answer: "Sukun" },
        ]
      },
      {
        type: "slušaj",
        title: "Ponovi harekete slušanjem", description: "Pritisni 🔊 — čuješ li fethu, kesru ili dammu?",
        icon: "🎧", hasanatReward: 20,
        choices: ["Fetha", "Kesra", "Damma"],
        items: [
          { show: "🔊", answer: "Fetha", audio: "بَ" },
          { show: "🔊", answer: "Damma", audio: "جُ" },
          { show: "🔊", answer: "Kesra", audio: "تِ" },
          { show: "🔊", answer: "Fetha", audio: "حَ" },
          { show: "🔊", answer: "Kesra", audio: "خِ" },
          { show: "🔊", answer: "Damma", audio: "بُ" },
          { show: "🔊", answer: "Fetha", audio: "ثَ" },
          { show: "🔊", answer: "Kesra", audio: "جِ" },
          { show: "🔊", answer: "Damma", audio: "حُ" },
          { show: "🔊", answer: "Fetha", audio: "تَ" },
          { show: "🔊", answer: "Damma", audio: "خُ" },
          { show: "🔊", answer: "Kesra", audio: "ثِ" },
          { show: "🔊", answer: "Fetha", audio: "خَ" },
          { show: "🔊", answer: "Kesra", audio: "بِ" },
          { show: "🔊", answer: "Damma", audio: "تُ" },
          { show: "🔊", answer: "Fetha", audio: "جَ" },
          { show: "🔊", answer: "Damma", audio: "ثُ" },
          { show: "🔊", answer: "Kesra", audio: "حِ" },
        ]
      },
      {
        type: "slušaj",
        title: "Slušaj kratki slog", description: "Čuješ slog — odaberi ispravan harf s hareketom",
        icon: "🎯", hasanatReward: 20,
        choices: ["بَ", "بِ", "بُ"],
        items: [
          { show: "🔊", answer: "بَ", audio: "بَ" },
          { show: "🔊", answer: "بِ", audio: "بِ" },
          { show: "🔊", answer: "بُ", audio: "بُ" },
          { show: "🔊", answer: "بَ", audio: "بَ" },
          { show: "🔊", answer: "بِ", audio: "بِ" },
          { show: "🔊", answer: "بُ", audio: "بُ" },
          { show: "🔊", answer: "بَ", audio: "بَ" },
          { show: "🔊", answer: "بُ", audio: "بُ" },
          { show: "🔊", answer: "بِ", audio: "بِ" },
          { show: "🔊", answer: "بَ", audio: "بَ" },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Čitaj slogove — harfovi + sukun",
        description: "Pročitaj svaki slog naglas — harfovi s hareketima i sukunom",
        icon: "📖", hasanatReward: 25,
        choices: [],
        items: [
          { show: "بَ",   answer: "be"      }, { show: "بِ",   answer: "bi"      }, { show: "بُ",   answer: "bu"      },
          { show: "تَ",   answer: "te"      }, { show: "تِ",   answer: "ti"      }, { show: "تُ",   answer: "tu"      },
          { show: "ثَ",   answer: "se"      }, { show: "ثِ",   answer: "si"      }, { show: "ثُ",   answer: "su"      },
          { show: "جَ",   answer: "dže"     }, { show: "جِ",   answer: "dži"     }, { show: "جُ",   answer: "džu"     },
          { show: "حَ",   answer: "ha"      }, { show: "حِ",   answer: "hi"      }, { show: "حُ",   answer: "hu"      },
          { show: "خَ",   answer: "hâ"      }, { show: "خِ",   answer: "hâ-i"    }, { show: "خُ",   answer: "hâ-u"    },
          { show: "بَتَ", answer: "be-te"   }, { show: "تَجَ", answer: "te-dže"  },
          { show: "جَحَ", answer: "dže-ha"  }, { show: "حَبَ", answer: "ha-be"   },
          { show: "بَتْ", answer: "be-t"    }, { show: "تَجْ", answer: "te-dž"   },
          { show: "جَحْ", answer: "dže-h"   }, { show: "حَبْ", answer: "ha-b"    },
        ]
      },
    ]
  },

  // ── LEKCIJA 8: TEŠDID — RAZVOJNI NACRT ─────────────────────
  {
    id: 8, orderNum: 8, slug: "tesdid",
    title: "Tešdid",
    letters: ["\u0640\u0640\u0651"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, tešdid pokazuje da isti suglasnik izgovaramo udvojeno, bez pauze." },
        { speaker: "amir",  text: "Dva puta? Pa zašto ne napišu slovo dva puta?" },
        { speaker: "dzana", text: "Zato što u arapskom postoji poseban znak koji to označava — tešdid. Izgleda kao mali 'w' iznad slova." },
        { speaker: "amir",  text: "Mali 'w'? Gdje se stavlja — iznad slova?" },
        { speaker: "dzana", text: "Da, iznad. Prvi od ta dva ista harfa zamišljamo sa sukunom, a drugi nosi hareket. Zato أَبَّ čitamo povezano: eb-be." },
        { speaker: "amir",  text: "Znači, ne produžavam samoglasnik, nego jasno udvostručim suglasnik?" },
        { speaker: "dzana", text: "Upravo! U riječima إِنَّ i ثُمَّ jasno čujemo udvojene glasove n i m. Tešdid i hareket rade zajedno." },
        { speaker: "amir",  text: "Dakle tešdid = udvojenost, a hareket kaže koji samoglasnik ide uz to. Jasno!" },
      ]
    },
    letterData: [],
    hareketiTitle: "Tešdid — udvojeni suglasnik",
    hareketi: [
      {
        arabic: "أَبَّ", hareke: "ّ", name: "Tešdid",
        sound: "eb-be", colour: "teal",
        description: "Tešdid udvostručuje suglasnik: prvi je bez samoglasnika, drugi nosi hareket",
        napomena: "Ne produžavaj samoglasnik. Jasno izgovori udvojeni suglasnik bez pauze.",
        soundFile: null,
      },
    ],
    exercises: [
      {
        type: "koji-znak",
        title: "Prepoznaj tešdid", description: "Pogledaj slovo — nosi li tešdid ili hareket?",
        icon: "👁️", hasanatReward: 15,
        choices: ["Tešdid", "Fetha", "Kesra", "Damma"],
        items: [
          { show: "بَّ", answer: "Tešdid" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra" },
          { show: "حُ", answer: "Damma" }, { show: "خَّ", answer: "Tešdid" }, { show: "ثَ", answer: "Fetha" },
          { show: "بِّ", answer: "Tešdid" }, { show: "تُ", answer: "Damma" }, { show: "جَّ", answer: "Tešdid" },
          { show: "حَ", answer: "Fetha" }, { show: "خِ", answer: "Kesra" }, { show: "ثُ", answer: "Damma" },
          { show: "بُّ", answer: "Tešdid" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra" },
          { show: "حَّ", answer: "Tešdid" }, { show: "خَ", answer: "Fetha" }, { show: "ثِّ", answer: "Tešdid" },
          { show: "بُ", answer: "Damma" }, { show: "جِّ", answer: "Tešdid" },
        ]
      },
      {
        type: "prepoznaj-hareket",
        title: "Koji hareket uz tešdid?", description: "Pogledaj slovo s tešdidom — koji hareket nosi?",
        icon: "🔍", hasanatReward: 15,
        choices: ["Fetha", "Kesra", "Damma"],
        items: [
          { show: "بَّ", answer: "Fetha" }, { show: "تِّ", answer: "Kesra" }, { show: "جُّ", answer: "Damma" },
          { show: "حَّ", answer: "Fetha" }, { show: "خِّ", answer: "Kesra" }, { show: "ثُّ", answer: "Damma" },
          { show: "بَّ", answer: "Fetha" }, { show: "جِّ", answer: "Kesra" }, { show: "تُّ", answer: "Damma" },
          { show: "خَّ", answer: "Fetha" }, { show: "حِّ", answer: "Kesra" }, { show: "بُّ", answer: "Damma" },
          { show: "ثَّ", answer: "Fetha" }, { show: "تِّ", answer: "Kesra" }, { show: "جُّ", answer: "Damma" },
          { show: "حَّ", answer: "Fetha" }, { show: "خُّ", answer: "Damma" }, { show: "بِّ", answer: "Kesra" },
          { show: "ثَّ", answer: "Fetha" }, { show: "جِّ", answer: "Kesra" },
        ]
      },
      {
        type: "napiši",
        title: "Koji je hareket?", description: "Napiši pomoćni glas hareketa koji stoji uz tešdid (e/i/u)",
        icon: "✏️", hasanatReward: 10,
        choices: [],
        items: [
          { show: "بَّ", answer: "e" }, { show: "تِّ", answer: "i" }, { show: "جُّ", answer: "u" },
          { show: "حَّ", answer: "e" }, { show: "خِّ", answer: "i" }, { show: "ثُّ", answer: "u" },
          { show: "بَّ", answer: "e" }, { show: "جِّ", answer: "i" }, { show: "تُّ", answer: "u" },
          { show: "خَّ", answer: "e" }, { show: "حُّ", answer: "u" }, { show: "بِّ", answer: "i" },
          { show: "ثَّ", answer: "e" }, { show: "تِّ", answer: "i" }, { show: "جُّ", answer: "u" },
          { show: "حَّ", answer: "e" }, { show: "خُّ", answer: "u" }, { show: "بِّ", answer: "i" },
          { show: "ثَّ", answer: "e" }, { show: "جِّ", answer: "i" },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Čitaj s tešdidom",
        description: "Jasno udvostruči suglasnik; ne produžavaj samoglasnik.",
        icon: "📖", hasanatReward: 30, choices: [],
        items: [
          { show: "أَبَّ", answer: "Tešdid na Ba" }, { show: "أَبِّ", answer: "Tešdid na Ba" }, { show: "أَبُّ", answer: "Tešdid na Ba" },
          { show: "أَتَّ", answer: "Tešdid na Ta" }, { show: "أَتِّ", answer: "Tešdid na Ta" }, { show: "أَتُّ", answer: "Tešdid na Ta" },
          { show: "أَثَّ", answer: "Tešdid na Sa" }, { show: "أَثِّ", answer: "Tešdid na Sa" }, { show: "أَثُّ", answer: "Tešdid na Sa" },
          { show: "أَجَّ", answer: "Tešdid na Džim" }, { show: "أَجِّ", answer: "Tešdid na Džim" }, { show: "أَجُّ", answer: "Tešdid na Džim" },
          { show: "أَحَّ", answer: "Tešdid na Ha" }, { show: "أَحِّ", answer: "Tešdid na Ha" }, { show: "أَحُّ", answer: "Tešdid na Ha" },
          { show: "أَخَّ", answer: "Tešdid na Hâ" }, { show: "أَخِّ", answer: "Tešdid na Hâ" }, { show: "أَخُّ", answer: "Tešdid na Hâ" },
          { show: "رَبَّ", answer: "Ra–Ba s tešdidom" }, { show: "حَبَّ", answer: "Ha–Ba s tešdidom" },
          { show: "رَدَّ", answer: "Ra–Dal s tešdidom" }, { show: "بَثَّ", answer: "Ba–Sa s tešdidom" },
          { show: "حَجَّ", answer: "Ha–Džim s tešdidom" }, { show: "خَرَّ", answer: "Hâ–Ra s tešdidom" },
        ],
      },
    ]
  },

  // ── LEKCIJA 9: TENVIN — RAZVOJNI NACRT ─────────────────────
  {
    id: 9, orderNum: 9, slug: "tenvin",
    title: "Tenvin",
    letters: ["ـًـٍـٌ"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, tenvin je poseban znak koji dodaje glas 'n' na kraj riječi." },
        { speaker: "amir",  text: "Znači kao da izgovorim kratki glas i na kraju dodam 'n'?" },
        { speaker: "dzana", text: "Tačno! U povezanim riječima tenvin fetha daje '-an', tenvin kesra '-in', a tenvin damma '-un'." },
        { speaker: "amir",  text: "A kako izgledaju? Kao dupli hareketi?" },
        { speaker: "dzana", text: "Upravo! Tenvin fetha su dvije crtice iznad, tenvin kesra dvije ispod, a tenvin damma dva zareza iznad." },
        { speaker: "amir",  text: "Ima li nešto posebno kod tenvin fethe?" },
        { speaker: "dzana", text: "Tenvin fetha se najčešće piše uz dodatni elif, kao u بًا. Postoje i izuzeci koje ćemo kasnije učiti, zato ne kažemo 'uvijek'." },
        { speaker: "amir",  text: "A izgovaramo li glas n?" },
        { speaker: "dzana", text: "Kada nastavljamo čitanje, izgovaramo ga. Kada se zaustavimo na kraju riječi, primjenjujemo pravila stajanja. Tenvin fetha tada se najčešće zaustavlja dugim glasom a, dok se kod tenvin kesre i damme završni n ne izgovara." },
        { speaker: "amir",  text: "Dakle, povezano čitanje i stajanje nisu isto. Pratim snimak učača i ne pogađam samo po latinici." },
      ]
    },
    letterData: [],
    hareketiTitle: "Tenvin — dupli znakovi za glas N",
    hareketi: [
      {
        arabic: "بًا", hareke: "ً", name: "Tenvin fetha",
        sound: "-an", colour: "teal",
        description: "Dvije crtice iznad — u povezanom čitanju daju glas '-an'",
        napomena: "Najčešće se piše uz dodatni elif. Pri stajanju se '-an' najčešće mijenja u dugo 'a'; izuzeci se uče zasebno.",
        soundFile: null,
      },
      {
        arabic: "بٍ", hareke: "ٍ", name: "Tenvin kesra",
        sound: "-in", colour: "blue",
        description: "Dvije crtice ispod — hareket kesra + glas 'n' na kraju",
        napomena: null,
        soundFile: null,
      },
      {
        arabic: "بٌ", hareke: "ٌ", name: "Tenvin damma",
        sound: "-un", colour: "violet",
        description: "Dva zareza iznad — hareket damma + glas 'n' na kraju",
        napomena: null,
        soundFile: null,
      },
    ],
    exercises: [
      {
        type: "koji-znak",
        title: "Koji tenvin?", description: "Pogledaj slovo — koji je to tenvin?",
        icon: "👁️", hasanatReward: 15,
        choices: ["Tenvin fetha", "Tenvin kesra", "Tenvin damma"],
        items: [
          { show: "بًا", answer: "Tenvin fetha" }, { show: "تٍ", answer: "Tenvin kesra" }, { show: "جٌ", answer: "Tenvin damma" },
          { show: "حًا", answer: "Tenvin fetha" }, { show: "خٍ", answer: "Tenvin kesra" }, { show: "ثٌ", answer: "Tenvin damma" },
          { show: "بًا", answer: "Tenvin fetha" }, { show: "جٍ", answer: "Tenvin kesra" }, { show: "تٌ", answer: "Tenvin damma" },
          { show: "خًا", answer: "Tenvin fetha" }, { show: "حٍ", answer: "Tenvin kesra" }, { show: "بٌ", answer: "Tenvin damma" },
          { show: "ثًا", answer: "Tenvin fetha" }, { show: "تٍ", answer: "Tenvin kesra" }, { show: "جٌ", answer: "Tenvin damma" },
          { show: "حًا", answer: "Tenvin fetha" }, { show: "خٌ", answer: "Tenvin damma" }, { show: "بٍ", answer: "Tenvin kesra" },
          { show: "ثًا", answer: "Tenvin fetha" }, { show: "جٍ", answer: "Tenvin kesra" },
        ]
      },
      {
        type: "prepoznaj-hareket",
        title: "Koji glas daje tenvin?", description: "Pogledaj tenvin — koji glas daje u povezanom čitanju?",
        icon: "🔤", hasanatReward: 15,
        choices: ["-an", "-in", "-un"],
        items: [
          { show: "بًا", answer: "-an" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-an" }, { show: "خٍ", answer: "-in" }, { show: "ثٌ", answer: "-un" },
          { show: "بًا", answer: "-an" }, { show: "جٍ", answer: "-in" }, { show: "تٌ", answer: "-un" },
          { show: "خًا", answer: "-an" }, { show: "حٍ", answer: "-in" }, { show: "بٌ", answer: "-un" },
          { show: "ثًا", answer: "-an" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-an" }, { show: "خٌ", answer: "-un" }, { show: "بٍ", answer: "-in" },
          { show: "ثًا", answer: "-an" }, { show: "جٍ", answer: "-in" },
        ]
      },
      {
        type: "koji-harf",
        title: "Hareket ili tenvin?", description: "Je li ovo hareket ili tenvin?",
        icon: "🔍", hasanatReward: 20,
        choices: ["Hareket", "Tenvin"],
        items: [
          { show: "بَ", answer: "Hareket" }, { show: "تٍ", answer: "Tenvin" }, { show: "جُ", answer: "Hareket" },
          { show: "حًا", answer: "Tenvin" }, { show: "خِ", answer: "Hareket" }, { show: "ثٌ", answer: "Tenvin" },
          { show: "بَ", answer: "Hareket" }, { show: "جٌ", answer: "Tenvin" }, { show: "تِ", answer: "Hareket" },
          { show: "خًا", answer: "Tenvin" }, { show: "حُ", answer: "Hareket" }, { show: "بٍ", answer: "Tenvin" },
          { show: "ثَ", answer: "Hareket" }, { show: "تٍ", answer: "Tenvin" }, { show: "جِ", answer: "Hareket" },
          { show: "حٌ", answer: "Tenvin" }, { show: "خَ", answer: "Hareket" }, { show: "ثًا", answer: "Tenvin" },
          { show: "بُ", answer: "Hareket" }, { show: "جٍ", answer: "Tenvin" },
        ]
      },
      {
        type: "napiši",
        title: "Napiši glas tenvina", description: "Napiši glas tenvina u povezanom čitanju (-an, -in ili -un)",
        icon: "✏️", hasanatReward: 10,
        choices: [],
        items: [
          { show: "بًا", answer: "-an" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-an" }, { show: "خٍ", answer: "-in" }, { show: "ثٌ", answer: "-un" },
          { show: "بًا", answer: "-an" }, { show: "جٍ", answer: "-in" }, { show: "تٌ", answer: "-un" },
          { show: "خًا", answer: "-an" }, { show: "حٍ", answer: "-in" }, { show: "بٌ", answer: "-un" },
          { show: "ثًا", answer: "-an" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-an" }, { show: "خٌ", answer: "-un" }, { show: "بٍ", answer: "-in" },
          { show: "ثًا", answer: "-an" }, { show: "جٍ", answer: "-in" },
        ]
      },
      {
        type: "čitaj-slog",
        title: "Čitaj s tenvinom",
        description: "Čitaj povezano: tenvin fetha -an, kesra -in, damma -un.",
        icon: "📖", hasanatReward: 30, choices: [],
        items: [
          { show: "بًا", answer: "Tenvin fetha" }, { show: "بٍ", answer: "Tenvin kesra" }, { show: "بٌ", answer: "Tenvin damma" },
          { show: "تًا", answer: "Tenvin fetha" }, { show: "تٍ", answer: "Tenvin kesra" }, { show: "تٌ", answer: "Tenvin damma" },
          { show: "ثًا", answer: "Tenvin fetha" }, { show: "ثٍ", answer: "Tenvin kesra" }, { show: "ثٌ", answer: "Tenvin damma" },
          { show: "جًا", answer: "Tenvin fetha" }, { show: "جٍ", answer: "Tenvin kesra" }, { show: "جٌ", answer: "Tenvin damma" },
          { show: "حًا", answer: "Tenvin fetha" }, { show: "حٍ", answer: "Tenvin kesra" }, { show: "حٌ", answer: "Tenvin damma" },
          { show: "خًا", answer: "Tenvin fetha" }, { show: "خٍ", answer: "Tenvin kesra" }, { show: "خٌ", answer: "Tenvin damma" },
          { show: "دًا", answer: "Tenvin fetha" }, { show: "دٍ", answer: "Tenvin kesra" }, { show: "دٌ", answer: "Tenvin damma" },
          { show: "رًا", answer: "Tenvin fetha" }, { show: "رٍ", answer: "Tenvin kesra" }, { show: "رٌ", answer: "Tenvin damma" },
          { show: "زًا", answer: "Tenvin fetha" }, { show: "زٍ", answer: "Tenvin kesra" }, { show: "زٌ", answer: "Tenvin damma" },
        ],
      },
    ]
  },

  // ── LEKCIJA 10: SIN I ŠIN ──────────────────────────────────
  {
    id: 10, orderNum: 10, slug: "sin-shin",
    title: "Sin i Šin",
    letters: ["س", "ش"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Sin i Šin imaju isti osnovni oblik. Sin nema tačke, a Šin ima tri tačke iznad." },
        { speaker: "dzana", text: "Kod oba harfa mogu pratiti tri mala zupca, a tačke mi kažu koji harf čitam." },
        { speaker: "muallim", text: "Kod Sina vrh jezika je blizu unutrašnje strane donjih prednjih zuba. Zrak prolazi uskim putem i čuje se čisto S, bez krupnog tona." },
        { speaker: "muallim", text: "Kod Šina sredina jezika približava se srednjem dijelu nepca, a zrak se širi. Glas je sličan našem Š, ali izgovor potvrđujemo slušanjem." },
        { speaker: "amir", text: "Prvo gledam tačke, zatim hareket, pa harf čitam u spoju s onim prije i poslije njega." },
      ],
    },
    letterData: [
      {
        arabic: "س", name: "Sin", transliteration: "S",
        forms: { isolated: "س", initial: "سـ", medial: "ـسـ", final: "ـس" },
        visualAssociation: "Tri zupca bez tačaka; tanak glas S uz strujanje zraka",
        soundFile: "sin.mp3",
      },
      {
        arabic: "ش", name: "Šin", transliteration: "Š",
        forms: { isolated: "ش", initial: "شـ", medial: "ـشـ", final: "ـش" },
        visualAssociation: "Isti oblik kao Sin, s tri tačke iznad; glas Š",
        soundFile: "sin2.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Sin ili Šin?", description: "Prepoznaj harf po tačkama.",
        icon: "🔡", hasanatReward: 15, choices: ["Sin", "Šin"],
        items: [
          { show: "س", answer: "Sin" }, { show: "ش", answer: "Šin" },
          { show: "ش", answer: "Šin" }, { show: "س", answer: "Sin" },
          { show: "س", answer: "Sin" }, { show: "ش", answer: "Šin" },
          { show: "ش", answer: "Šin" }, { show: "س", answer: "Sin" },
        ],
      },
      {
        type: "koji-harf", title: "Prepoznaj spojeni oblik", description: "Harf može biti na početku, u sredini ili na kraju spoja.",
        icon: "🔗", hasanatReward: 20, choices: ["Sin", "Šin"],
        items: [
          { show: "سـ", answer: "Sin" }, { show: "ـشـ", answer: "Šin" },
          { show: "ـس", answer: "Sin" }, { show: "شـ", answer: "Šin" },
          { show: "ـش", answer: "Šin" }, { show: "ـسـ", answer: "Sin" },
          { show: "ـشـ", answer: "Šin" }, { show: "سـ", answer: "Sin" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Sin i Šin s hareketima", description: "Čitaj redom, zatim izmiješaj kartice i ponovi.",
        icon: "📖", hasanatReward: 25, choices: [],
        items: [
          { show: "سَ", answer: "Sin + fetha" }, { show: "سِ", answer: "Sin + kesra" }, { show: "سُ", answer: "Sin + damma" },
          { show: "شَ", answer: "Šin + fetha" }, { show: "شِ", answer: "Šin + kesra" }, { show: "شُ", answer: "Šin + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Primijeni sukun, tešdid i tenvin, zatim pročitaj kratke riječi.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "أَسْ", answer: "Hemza–Sin sa sukunom" }, { show: "أَشْ", answer: "Hemza–Šin sa sukunom" },
          { show: "أَسَّ", answer: "Sin s tešdidom" }, { show: "أَشَّ", answer: "Šin s tešdidom" },
          { show: "سٌ", answer: "Sin + tenvin damma" }, { show: "شٍ", answer: "Šin + tenvin kesra" },
          { show: "سَبَ", answer: "Sin–Ba" }, { show: "شَرَ", answer: "Šin–Ra" },
          { show: "سَجَدَ", answer: "Sin–Džim–Dal" }, { show: "بَشَرَ", answer: "Ba–Šin–Ra" },
          { show: "حَسَدَ", answer: "Ha–Sin–Dal" }, { show: "شَجَرَ", answer: "Šin–Džim–Ra" },
        ],
      },
    ],
  },

  // ── LEKCIJA 11: SAD I DAD ──────────────────────────────────
  {
    id: 11, orderNum: 11, slug: "sad-dad",
    title: "Sad i Dad",
    letters: ["ص", "ض"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Sad i Dad imaju isti osnovni oblik. Sad nema tačku, a Dad ima jednu tačku iznad." },
        { speaker: "muallim", text: "Sad je krupan harf. Prednji dio jezika oblikuje prolaz sličan Sinu, ali se zadnji dio jezika podiže pa glas ispuni usta. Ne čitamo ga kao obično S." },
        { speaker: "muallim", text: "Dad je krupan harf koji izlazi uz jednu bočnu stranu jezika i gornje kutnjake. To nije obično D; pravilan glas zahtijeva slušanje i vježbu s muallimom." },
        { speaker: "dzana", text: "Tačka razlikuje Dad od Sada, ali položaj jezika razlikuje oba od tankih harfova Sin i Dal." },
        { speaker: "amir", text: "Neću pokušavati pogoditi glas samo po latinici. Slušam snimak, ponavljam i tražim ispravku." },
      ],
    },
    letterData: [
      {
        arabic: "ص", name: "Sad", transliteration: "krupno S",
        forms: { isolated: "ص", initial: "صـ", medial: "ـصـ", final: "ـص" },
        visualAssociation: "Zatvoren prednji oblik bez tačke; krupan glas S",
        soundFile: "sad.mp3",
      },
      {
        arabic: "ض", name: "Dad", transliteration: "krupno D",
        forms: { isolated: "ض", initial: "ضـ", medial: "ـضـ", final: "ـض" },
        visualAssociation: "Isti oblik kao Sad, s jednom tačkom iznad",
        soundFile: "dad.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Sad ili Dad?", description: "Pogledaj tačku i prepoznaj harf.",
        icon: "🔡", hasanatReward: 15, choices: ["Sad", "Dad"],
        items: [
          { show: "ص", answer: "Sad" }, { show: "ض", answer: "Dad" },
          { show: "ض", answer: "Dad" }, { show: "ص", answer: "Sad" },
          { show: "ص", answer: "Sad" }, { show: "ض", answer: "Dad" },
          { show: "ض", answer: "Dad" }, { show: "ص", answer: "Sad" },
        ],
      },
      {
        type: "koji-harf", title: "Razlikuj slične glasove", description: "Razlikuj tanke Sin i Dal od krupnih Sad i Dad.",
        icon: "🔍", hasanatReward: 20, choices: ["Sin", "Dal", "Sad", "Dad"],
        items: [
          { show: "س", answer: "Sin" }, { show: "ص", answer: "Sad" },
          { show: "د", answer: "Dal" }, { show: "ض", answer: "Dad" },
          { show: "ـسـ", answer: "Sin" }, { show: "ـصـ", answer: "Sad" },
          { show: "د", answer: "Dal" }, { show: "ـض", answer: "Dad" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Sad i Dad s hareketima", description: "Sačuvaj krupan izgovor uz sva tri kratka glasa.",
        icon: "📖", hasanatReward: 25, choices: [],
        items: [
          { show: "صَ", answer: "Sad + fetha" }, { show: "صِ", answer: "Sad + kesra" }, { show: "صُ", answer: "Sad + damma" },
          { show: "ضَ", answer: "Dad + fetha" }, { show: "ضِ", answer: "Dad + kesra" }, { show: "ضُ", answer: "Dad + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Vježbaj krupne glasove sa sukunom, tešdidom, tenvinom i u riječima.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "أَصْ", answer: "Hemza–Sad sa sukunom" }, { show: "أَضْ", answer: "Hemza–Dad sa sukunom" },
          { show: "أَصَّ", answer: "Sad s tešdidom" }, { show: "أَضَّ", answer: "Dad s tešdidom" },
          { show: "صٌ", answer: "Sad + tenvin damma" }, { show: "ضٍ", answer: "Dad + tenvin kesra" },
          { show: "صَبَرَ", answer: "Sad–Ba–Ra" }, { show: "ضَرَبَ", answer: "Dad–Ra–Ba" },
          { show: "حَضَرَ", answer: "Ha–Dad–Ra" }, { show: "بَصَرَ", answer: "Ba–Sad–Ra" },
          { show: "صَدَرَ", answer: "Sad–Dal–Ra" }, { show: "حَرَصَ", answer: "Ha–Ra–Sad" },
        ],
      },
    ],
  },

  // ── LEKCIJA 12: TÂ I ZÂ ────────────────────────────────────
  {
    id: 12, orderNum: 12, slug: "ta-za-krupni",
    title: "Tâ i Zâ",
    letters: ["ط", "ظ"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Tâ i Zâ imaju isti osnovni oblik. Tâ nema tačku, a Zâ ima jednu tačku iznad." },
        { speaker: "muallim", text: "Kod Tâ vrh jezika dodiruje područje iza gornjih prednjih zuba, kao kod Ta, ali se zadnji dio jezika podiže. Zato je Tâ krupan i snažan glas, a kada nosi sukun čuje se odskok glasa." },
        { speaker: "muallim", text: "Kod Zâ vrh jezika lagano izlazi između prednjih zuba, kao kod Zala, ali se zadnji dio jezika podiže. Glas je zvučan i krupan; nije obično Z niti obično D." },
        { speaker: "dzana", text: "Tačka razlikuje Tâ od Zâ, a krupan izgovor ih razlikuje od tankih Ta i Zal." },
        { speaker: "amir", text: "Pazit ću i na mjesto jezika i na krupnoću, a kod Tâ sa sukunom neću dodavati novi hareket." },
      ],
    },
    letterData: [
      {
        arabic: "ط", name: "Tâ", transliteration: "krupno T",
        forms: { isolated: "ط", initial: "طـ", medial: "ـطـ", final: "ـط" },
        visualAssociation: "Uspravan potez u zatvorenom obliku, bez tačke; krupan T",
        soundFile: "ta2.mp3",
      },
      {
        arabic: "ظ", name: "Zâ", transliteration: "krupno Zâ",
        forms: { isolated: "ظ", initial: "ظـ", medial: "ـظـ", final: "ـظ" },
        visualAssociation: "Isti oblik kao Tâ, s jednom tačkom iznad",
        soundFile: "za.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Tâ ili Zâ?", description: "Prepoznaj harf po tački.",
        icon: "🔡", hasanatReward: 15, choices: ["Tâ", "Zâ"],
        items: [
          { show: "ط", answer: "Tâ" }, { show: "ظ", answer: "Zâ" },
          { show: "ظ", answer: "Zâ" }, { show: "ط", answer: "Tâ" },
          { show: "ط", answer: "Tâ" }, { show: "ظ", answer: "Zâ" },
          { show: "ظ", answer: "Zâ" }, { show: "ط", answer: "Tâ" },
        ],
      },
      {
        type: "koji-harf", title: "Tanko ili krupno?", description: "Razlikuj Ta i Zal od krupnih Tâ i Zâ.",
        icon: "🔍", hasanatReward: 20, choices: ["Ta", "Zal", "Tâ", "Zâ"],
        items: [
          { show: "ت", answer: "Ta" }, { show: "ط", answer: "Tâ" },
          { show: "ذ", answer: "Zal" }, { show: "ظ", answer: "Zâ" },
          { show: "ـتـ", answer: "Ta" }, { show: "ـطـ", answer: "Tâ" },
          { show: "ذ", answer: "Zal" }, { show: "ـظ", answer: "Zâ" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Tâ i Zâ s hareketima", description: "Sačuvaj krupan izgovor uz fethu, kesru i dammu.",
        icon: "📖", hasanatReward: 25, choices: [],
        items: [
          { show: "طَ", answer: "Tâ + fetha" }, { show: "طِ", answer: "Tâ + kesra" }, { show: "طُ", answer: "Tâ + damma" },
          { show: "ظَ", answer: "Zâ + fetha" }, { show: "ظِ", answer: "Zâ + kesra" }, { show: "ظُ", answer: "Zâ + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Čitaj polako, bez dodavanja glasa uz sukun, pa prijeđi na riječi.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "أَطْ", answer: "Hemza–Tâ sa sukunom" }, { show: "أَظْ", answer: "Hemza–Zâ sa sukunom" },
          { show: "أَطَّ", answer: "Tâ s tešdidom" }, { show: "أَظَّ", answer: "Zâ s tešdidom" },
          { show: "طٌ", answer: "Tâ + tenvin damma" }, { show: "ظٍ", answer: "Zâ + tenvin kesra" },
          { show: "طَرَدَ", answer: "Tâ–Ra–Dal" }, { show: "بَطَشَ", answer: "Ba–Tâ–Šin" },
          { show: "ضَبَطَ", answer: "Dad–Ba–Tâ" }, { show: "حَظَرَ", answer: "Ha–Zâ–Ra" },
          { show: "طَبَخَ", answer: "Tâ–Ba–Hâ" }, { show: "ظَبَ", answer: "Zâ–Ba" },
        ],
      },
    ],
  },

  // ── LEKCIJA 13: AJN I GAJN ─────────────────────────────────
  {
    id: 13, orderNum: 13, slug: "ajn-gajn",
    title: "Ajn i Gajn",
    letters: ["ع", "غ"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Ajn i Gajn imaju isti osnovni oblik. Ajn nema tačku, a Gajn ima jednu tačku iznad." },
        { speaker: "muallim", text: "Ajn izlazi iz srednjeg dijela grla. Grlo se umjereno stegne i glas prolazi bez pretvaranja u hemzu, A ili H. U našem jeziku nema potpuno jednakog glasa." },
        { speaker: "muallim", text: "Gajn izlazi iz gornjeg dijela grla, blizu mekog nepca. To je zvučan, krupan glas sa strujanjem; ne čitamo ga kao naše G." },
        { speaker: "dzana", text: "Kod ovih harfova oblik mogu naučiti očima, ali mahredž moram naučiti slušanjem i ponavljanjem." },
        { speaker: "amir", text: "Najprije ću vježbati kratak čist glas, a zatim ga spajati s poznatim harfovima." },
      ],
    },
    letterData: [
      {
        arabic: "ع", name: "Ajn", transliteration: "grleni glas",
        forms: { isolated: "ع", initial: "عـ", medial: "ـعـ", final: "ـع" },
        visualAssociation: "Oblik bez tačke; poseban zvučni glas iz sredine grla",
        soundFile: "ajn.mp3",
      },
      {
        arabic: "غ", name: "Gajn", transliteration: "krupni grleni glas",
        forms: { isolated: "غ", initial: "غـ", medial: "ـغـ", final: "ـغ" },
        visualAssociation: "Isti oblik kao Ajn, s jednom tačkom iznad",
        soundFile: "gajn.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Ajn ili Gajn?", description: "Prepoznaj harf po tački.",
        icon: "🔡", hasanatReward: 15, choices: ["Ajn", "Gajn"],
        items: [
          { show: "ع", answer: "Ajn" }, { show: "غ", answer: "Gajn" },
          { show: "غ", answer: "Gajn" }, { show: "ع", answer: "Ajn" },
          { show: "ع", answer: "Ajn" }, { show: "غ", answer: "Gajn" },
          { show: "غ", answer: "Gajn" }, { show: "ع", answer: "Ajn" },
        ],
      },
      {
        type: "koji-harf", title: "Prepoznaj spojeni oblik", description: "Ajn i Gajn mijenjaju oblik u spoju.",
        icon: "🔗", hasanatReward: 20, choices: ["Ajn", "Gajn"],
        items: [
          { show: "عـ", answer: "Ajn" }, { show: "ـغـ", answer: "Gajn" },
          { show: "ـع", answer: "Ajn" }, { show: "غـ", answer: "Gajn" },
          { show: "ـغ", answer: "Gajn" }, { show: "ـعـ", answer: "Ajn" },
          { show: "ـغـ", answer: "Gajn" }, { show: "عـ", answer: "Ajn" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Ajn i Gajn s hareketima", description: "Ne zamjenjuj Ajn hemzom niti Gajn našim glasom G.",
        icon: "📖", hasanatReward: 25, choices: [],
        items: [
          { show: "عَ", answer: "Ajn + fetha" }, { show: "عِ", answer: "Ajn + kesra" }, { show: "عُ", answer: "Ajn + damma" },
          { show: "غَ", answer: "Gajn + fetha" }, { show: "غِ", answer: "Gajn + kesra" }, { show: "غُ", answer: "Gajn + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Vježbaj grleni mahredž u kratkim spojevima, zatim u riječima.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "أَعْ", answer: "Hemza–Ajn sa sukunom" }, { show: "أَغْ", answer: "Hemza–Gajn sa sukunom" },
          { show: "أَعَّ", answer: "Ajn s tešdidom" }, { show: "أَغَّ", answer: "Gajn s tešdidom" },
          { show: "عٌ", answer: "Ajn + tenvin damma" }, { show: "غٍ", answer: "Gajn + tenvin kesra" },
          { show: "عَبَدَ", answer: "Ajn–Ba–Dal" }, { show: "بَعَثَ", answer: "Ba–Ajn–Sa" },
          { show: "رَجَعَ", answer: "Ra–Džim–Ajn" }, { show: "غَرَسَ", answer: "Gajn–Ra–Sin" },
          { show: "دَبَغَ", answer: "Dal–Ba–Gajn" }, { show: "بَغَضَ", answer: "Ba–Gajn–Dad" },
        ],
      },
    ],
  },

  // ── LEKCIJA 14: FA I KAF ───────────────────────────────────
  {
    id: 14, orderNum: 14, slug: "fa-kaf",
    title: "Fa i Kaf",
    letters: ["ف", "ق"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Fa i Kaf imaju sličan zaobljen oblik. Fa ima jednu tačku iznad, a Kaf dvije." },
        { speaker: "muallim", text: "Kod Fa unutrašnja strana donje usne lagano dodiruje rub gornjih prednjih zuba. Zrak prolazi bez glasa, kao čisto F." },
        { speaker: "muallim", text: "Kod Kafa zadnji dio jezika dodiruje područje mekog nepca. Kaf je krupan i snažan glas; nije isto što i Kef, koji ćemo učiti poslije." },
        { speaker: "muallim", text: "Kada Kaf nosi sukun, čuje se jasan odskok glasa, ali mu ne dodajemo novi hareket." },
        { speaker: "dzana", text: "Dakle, tačke razlikuju oblik, a usna i zadnji dio jezika pokazuju potpuno različita mjesta izgovora." },
      ],
    },
    letterData: [
      {
        arabic: "ف", name: "Fa", transliteration: "F",
        forms: { isolated: "ف", initial: "فـ", medial: "ـفـ", final: "ـف" },
        visualAssociation: "Jedna tačka iznad; donja usna i gornji prednji zubi daju F",
        soundFile: "fa.mp3",
      },
      {
        arabic: "ق", name: "Kaf", transliteration: "krupno K",
        forms: { isolated: "ق", initial: "قـ", medial: "ـقـ", final: "ـق" },
        visualAssociation: "Dvije tačke iznad; snažan glas iz zadnjeg dijela jezika",
        soundFile: "kaf.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Fa ili Kaf?", description: "Jedna tačka označava Fa, a dvije Kaf.",
        icon: "🔡", hasanatReward: 15, choices: ["Fa", "Kaf"],
        items: [
          { show: "ف", answer: "Fa" }, { show: "ق", answer: "Kaf" },
          { show: "ق", answer: "Kaf" }, { show: "ف", answer: "Fa" },
          { show: "ف", answer: "Fa" }, { show: "ق", answer: "Kaf" },
          { show: "ق", answer: "Kaf" }, { show: "ف", answer: "Fa" },
        ],
      },
      {
        type: "koji-harf", title: "Prepoznaj spojeni oblik", description: "Pazi na broj tačaka u svim položajima.",
        icon: "🔗", hasanatReward: 20, choices: ["Fa", "Kaf"],
        items: [
          { show: "فـ", answer: "Fa" }, { show: "ـقـ", answer: "Kaf" },
          { show: "ـف", answer: "Fa" }, { show: "قـ", answer: "Kaf" },
          { show: "ـق", answer: "Kaf" }, { show: "ـفـ", answer: "Fa" },
          { show: "ـقـ", answer: "Kaf" }, { show: "فـ", answer: "Fa" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Fa i Kaf s hareketima", description: "Razlikuj lagani Fa od krupnog Kafa.",
        icon: "📖", hasanatReward: 25, choices: [],
        items: [
          { show: "فَ", answer: "Fa + fetha" }, { show: "فِ", answer: "Fa + kesra" }, { show: "فُ", answer: "Fa + damma" },
          { show: "قَ", answer: "Kaf + fetha" }, { show: "قِ", answer: "Kaf + kesra" }, { show: "قُ", answer: "Kaf + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Čitaj Fa i Kaf sa sukunom, tešdidom i tenvinom, zatim u riječima.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "أَفْ", answer: "Hemza–Fa sa sukunom" }, { show: "أَقْ", answer: "Hemza–Kaf sa sukunom" },
          { show: "أَفَّ", answer: "Fa s tešdidom" }, { show: "أَقَّ", answer: "Kaf s tešdidom" },
          { show: "فٌ", answer: "Fa + tenvin damma" }, { show: "قٍ", answer: "Kaf + tenvin kesra" },
          { show: "فَتَحَ", answer: "Fa–Ta–Ha" }, { show: "قَرَأَ", answer: "Kaf–Ra–Hemza" },
          { show: "رَزَقَ", answer: "Ra–Za–Kaf" }, { show: "غَفَرَ", answer: "Gajn–Fa–Ra" },
          { show: "فَرَضَ", answer: "Fa–Ra–Dad" }, { show: "بَقَرَ", answer: "Ba–Kaf–Ra" },
        ],
      },
    ],
  },

  // ── LEKCIJA 15: KEF, LAM I MIM ─────────────────────────────
  {
    id: 15, orderNum: 15, slug: "kef-lam-mim",
    title: "Kef, Lam i Mim",
    letters: ["ك", "ل", "م"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Danas učimo Kef, Lam i Mim. Sva tri harfa spajaju se i s prethodnim i s narednim harfom." },
        { speaker: "muallim", text: "Kod Kefa zadnji dio jezika dodiruje nepce malo ispred mjesta izgovora Kafa. Kef je tanak glas sličan našem K; ne smijemo ga čitati krupno kao Kaf." },
        { speaker: "muallim", text: "Kod Lama vrh i prednje bočne strane jezika dodiruju područje desni iza gornjih prednjih zuba. Osnovni glas je jasan L; posebna pravila za Lam u Allahovom imenu učit ćemo kasnije." },
        { speaker: "muallim", text: "Mim nastaje potpunim spajanjem usana. Glas prolazi uz prirodnu nosnu rezonancu, a naročito je čuvamo kada Mim nosi tešdid." },
        { speaker: "dzana", text: "Kef razlikujem od Kafa po obliku i tankom glasu, a Lam i Mim pratim kroz njihove različite oblike u spoju." },
      ],
    },
    letterData: [
      {
        arabic: "ك", name: "Kef", transliteration: "K (tanko)",
        forms: { isolated: "ك", initial: "كـ", medial: "ـكـ", final: "ـك" },
        visualAssociation: "Tanak glas K; mjesto jezika je ispred mjesta krupnog Kafa",
        soundFile: "kef.mp3",
      },
      {
        arabic: "ل", name: "Lam", transliteration: "L",
        forms: { isolated: "ل", initial: "لـ", medial: "ـلـ", final: "ـل" },
        visualAssociation: "Visoka uspravna linija sa zaobljenim završetkom",
        soundFile: "lam.mp3",
      },
      {
        arabic: "م", name: "Mim", transliteration: "M",
        forms: { isolated: "م", initial: "مـ", medial: "ـمـ", final: "ـم" },
        visualAssociation: "Usne se potpuno sastave i daju glas M",
        soundFile: "mim.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Kef, Lam ili Mim?", description: "Prepoznaj novi harf u samostalnom i spojenom obliku.",
        icon: "🔡", hasanatReward: 15, choices: ["Kef", "Lam", "Mim"],
        items: [
          { show: "ك", answer: "Kef" }, { show: "ل", answer: "Lam" }, { show: "م", answer: "Mim" },
          { show: "ـكـ", answer: "Kef" }, { show: "ـل", answer: "Lam" }, { show: "مـ", answer: "Mim" },
          { show: "ـمـ", answer: "Mim" }, { show: "كـ", answer: "Kef" }, { show: "ـلـ", answer: "Lam" },
          { show: "ـك", answer: "Kef" }, { show: "لـ", answer: "Lam" }, { show: "ـم", answer: "Mim" },
        ],
      },
      {
        type: "koji-harf", title: "Kaf ili Kef?", description: "Razlikuj krupni Kaf od tankog Kefa po obliku i broju tačaka.",
        icon: "🔍", hasanatReward: 20, choices: ["Kaf", "Kef"],
        items: [
          { show: "ق", answer: "Kaf" }, { show: "ك", answer: "Kef" },
          { show: "ـقـ", answer: "Kaf" }, { show: "ـكـ", answer: "Kef" },
          { show: "كـ", answer: "Kef" }, { show: "قـ", answer: "Kaf" },
          { show: "ـك", answer: "Kef" }, { show: "ـق", answer: "Kaf" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Kef, Lam i Mim s hareketima", description: "Čitaj svaki harf s fethom, kesrom i dammom.",
        icon: "📖", hasanatReward: 30, choices: [],
        items: [
          { show: "كَ", answer: "Kef + fetha" }, { show: "كِ", answer: "Kef + kesra" }, { show: "كُ", answer: "Kef + damma" },
          { show: "لَ", answer: "Lam + fetha" }, { show: "لِ", answer: "Lam + kesra" }, { show: "لُ", answer: "Lam + damma" },
          { show: "مَ", answer: "Mim + fetha" }, { show: "مِ", answer: "Mim + kesra" }, { show: "مُ", answer: "Mim + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Primijeni sukun, tešdid i tenvin, zatim pročitaj riječi s poznatim harfovima.",
        icon: "📖", hasanatReward: 40, choices: [],
        items: [
          { show: "أَكْ", answer: "Hemza–Kef sa sukunom" }, { show: "أَلْ", answer: "Hemza–Lam sa sukunom" }, { show: "أَمْ", answer: "Hemza–Mim sa sukunom" },
          { show: "أَكَّ", answer: "Kef s tešdidom" }, { show: "أَلَّ", answer: "Lam s tešdidom" }, { show: "أَمَّ", answer: "Mim s tešdidom" },
          { show: "كٌ", answer: "Kef + tenvin damma" }, { show: "لٍ", answer: "Lam + tenvin kesra" }, { show: "مٌ", answer: "Mim + tenvin damma" },
          { show: "كَتَبَ", answer: "Kef–Ta–Ba" }, { show: "لَبِسَ", answer: "Lam–Ba–Sin" }, { show: "مَلَكَ", answer: "Mim–Lam–Kef" },
          { show: "سَلِمَ", answer: "Sin–Lam–Mim" }, { show: "عَلِمَ", answer: "Ajn–Lam–Mim" }, { show: "خَلَقَ", answer: "Hâ–Lam–Kaf" },
          { show: "كَلَّمَ", answer: "Kef–Lam s tešdidom–Mim" }, { show: "مَسَكَ", answer: "Mim–Sin–Kef" }, { show: "حَمَلَ", answer: "Ha–Mim–Lam" },
        ],
      },
    ],
  },

  // ── LEKCIJA 16: NUN, HE, VAV I JA ──────────────────────────
  {
    id: 16, orderNum: 16, slug: "nun-he-vav-ja",
    title: "Nun, He, Vav i Ja",
    letters: ["ن", "ه", "و", "ي"],
    isCompleted: false,
    isDraft: true,
    story: {
      lines: [
        { speaker: "muallim", text: "Ovo su posljednja četiri osnovna harfa: Nun, He, Vav i Ja." },
        { speaker: "muallim", text: "Kod Nuna vrh jezika dodiruje desni iza gornjih prednjih zuba, a dio glasa odzvanja kroz nos. Kod Nuna s tešdidom nosnu rezonancu jasno zadržavamo." },
        { speaker: "muallim", text: "He je blag dah iz najdubljeg dijela grla. Ne stežemo grlo kao kod Ha i ne stvaramo hrapavost kao kod Hâ." },
        { speaker: "muallim", text: "Kod Vava usne se zaokruže bez potpunog zatvaranja i daju suglasnički glas sličan W. Kasnije ćemo naučiti kada Vav produžava glas u." },
        { speaker: "muallim", text: "Kod Ja sredina jezika približava se srednjem dijelu nepca i daje glas sličan J. Kasnije ćemo naučiti kada Ja produžava glas i." },
        { speaker: "amir", text: "Sada poznajemo sve osnovne harfove, ali prije dugih glasova moramo ih sigurno čitati s kratkim hareketima." },
      ],
    },
    letterData: [
      {
        arabic: "ن", name: "Nun", transliteration: "N",
        forms: { isolated: "ن", initial: "نـ", medial: "ـنـ", final: "ـن" },
        visualAssociation: "Jedna tačka iznad; glas N uz prirodnu nosnu rezonancu",
        soundFile: "nun.mp3",
      },
      {
        arabic: "ه", name: "He", transliteration: "blago H",
        forms: { isolated: "ه", initial: "هـ", medial: "ـهـ", final: "ـه" },
        visualAssociation: "Blag dah iz najdubljeg dijela grla",
        soundFile: "he.mp3",
      },
      {
        arabic: "و", name: "Vav", transliteration: "W / dugo U",
        forms: { isolated: "و", initial: "و", medial: "ـو", final: "ـو" },
        nonConnecting: true,
        visualAssociation: "Zaokružene usne; ne spaja se s harfom poslije sebe",
        soundFile: "waw.mp3",
      },
      {
        arabic: "ي", name: "Ja", transliteration: "J / dugo I",
        forms: { isolated: "ي", initial: "يـ", medial: "ـيـ", final: "ـي" },
        visualAssociation: "Dvije tačke ispod; sredina jezika približava se nepcu",
        soundFile: "ja.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-harf", title: "Nun, He, Vav ili Ja?", description: "Prepoznaj posljednja četiri harfa u različitim oblicima.",
        icon: "🔡", hasanatReward: 20, choices: ["Nun", "He", "Vav", "Ja"],
        items: [
          { show: "ن", answer: "Nun" }, { show: "ه", answer: "He" }, { show: "و", answer: "Vav" }, { show: "ي", answer: "Ja" },
          { show: "ـنـ", answer: "Nun" }, { show: "هـ", answer: "He" }, { show: "ـو", answer: "Vav" }, { show: "يـ", answer: "Ja" },
          { show: "ـه", answer: "He" }, { show: "ـيـ", answer: "Ja" }, { show: "نـ", answer: "Nun" }, { show: "و", answer: "Vav" },
        ],
      },
      {
        type: "koji-harf", title: "Razlikuj slične oblike", description: "Pazi na tačke i promjenu oblika u spoju.",
        icon: "🔍", hasanatReward: 20, choices: ["Ba", "Ta", "Sa", "Nun", "Ja"],
        items: [
          { show: "بـ", answer: "Ba" }, { show: "تـ", answer: "Ta" }, { show: "ثـ", answer: "Sa" },
          { show: "نـ", answer: "Nun" }, { show: "يـ", answer: "Ja" },
          { show: "ـبـ", answer: "Ba" }, { show: "ـنـ", answer: "Nun" }, { show: "ـيـ", answer: "Ja" },
          { show: "ـتـ", answer: "Ta" }, { show: "ـثـ", answer: "Sa" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj Nun, He, Vav i Ja s hareketima", description: "Čitaj svaki novi harf s fethom, kesrom i dammom.",
        icon: "📖", hasanatReward: 35, choices: [],
        items: [
          { show: "نَ", answer: "Nun + fetha" }, { show: "نِ", answer: "Nun + kesra" }, { show: "نُ", answer: "Nun + damma" },
          { show: "هَ", answer: "He + fetha" }, { show: "هِ", answer: "He + kesra" }, { show: "هُ", answer: "He + damma" },
          { show: "وَ", answer: "Vav + fetha" }, { show: "وِ", answer: "Vav + kesra" }, { show: "وُ", answer: "Vav + damma" },
          { show: "يَ", answer: "Ja + fetha" }, { show: "يِ", answer: "Ja + kesra" }, { show: "يُ", answer: "Ja + damma" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj spojeve i riječi", description: "Primijeni ranija pravila i čitaj nove harfove u kratkim riječima.",
        icon: "📖", hasanatReward: 45, choices: [],
        items: [
          { show: "أَنْ", answer: "Hemza–Nun sa sukunom" }, { show: "أَهْ", answer: "Hemza–He sa sukunom" },
          { show: "أَنَّ", answer: "Nun s tešdidom" }, { show: "أَهَّ", answer: "He s tešdidom" },
          { show: "أَوَّ", answer: "Vav s tešdidom" }, { show: "أَيَّ", answer: "Ja s tešdidom" },
          { show: "نٌ", answer: "Nun + tenvin damma" }, { show: "هٍ", answer: "He + tenvin kesra" },
          { show: "وٌ", answer: "Vav + tenvin damma" }, { show: "يٍ", answer: "Ja + tenvin kesra" },
          { show: "نَصَرَ", answer: "Nun–Sad–Ra" }, { show: "وَجَدَ", answer: "Vav–Džim–Dal" },
          { show: "وَلَدَ", answer: "Vav–Lam–Dal" }, { show: "نَعَمْ", answer: "Nun–Ajn–Mim sa sukunom" },
          { show: "مَنَعَ", answer: "Mim–Nun–Ajn" }, { show: "يَدٌ", answer: "Ja–Dal s tenvinom" },
          { show: "هُوَ", answer: "He–Vav" }, { show: "يَعْمَلُ", answer: "Ja–Ajn–Mim–Lam" },
        ],
      },
    ],
  },

  // ── LEKCIJA 17: PONAVLJANJE SVIH HARFOVA ──────────────────
  {
    id: 17, orderNum: 17, slug: "ponavljanje-svih-harfova",
    title: "Ponavljanje svih harfova",
    letters: ALL_ARABIC_LETTERS,
    isCompleted: false,
    isRevision: true,
    isDraft: true,
    story: {
      lines: [
        { speaker: "narator", text: "Džana i Amir su otvorili Mushaf i polako prešli prstom preko redova. Sada su mogli prepoznati svaki osnovni harf, ali pravi posao tek je počinjao." },
        { speaker: "muallim", text: "Poznavanje imena harfa nije isto što i čitanje. Harf morate prepoznati u svakom obliku, spojiti ga s hareketom i sačuvati njegov mahredž." },
        { speaker: "dzana", text: "Zato ćemo ponoviti sve harfove, zatim sukun, tešdid i tenvin, pa čitati kratke riječi iz kur'anskog jezika." },
        { speaker: "muallim", text: "Čitajte prvo bez pomoći. Zatim poslušajte snimak, uporedite svoj izgovor i ponovite ono što nije bilo tačno." },
        { speaker: "amir", text: "Kada sigurno savladamo ovo ponavljanje, spremni smo za duge glasove i sve ozbiljnije kur'anske riječi." },
      ],
    },
    letterData: [],
    exercises: [
      {
        type: "koji-harf", title: "Prepoznaj svih 28 harfova", description: "Pogledaj harf i odaberi njegovo ime.",
        icon: "🔡", hasanatReward: 40,
        choices: ["Elif", "Ba", "Ta", "Sa", "Džim", "Ha", "Hâ", "Dal", "Zal", "Ra", "Za", "Sin", "Šin", "Sad", "Dad", "Tâ", "Zâ", "Ajn", "Gajn", "Fa", "Kaf", "Kef", "Lam", "Mim", "Nun", "He", "Vav", "Ja"],
        items: [
          { show: "ا", answer: "Elif" }, { show: "ب", answer: "Ba" }, { show: "ت", answer: "Ta" }, { show: "ث", answer: "Sa" },
          { show: "ج", answer: "Džim" }, { show: "ح", answer: "Ha" }, { show: "خ", answer: "Hâ" }, { show: "د", answer: "Dal" },
          { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" }, { show: "ز", answer: "Za" }, { show: "س", answer: "Sin" },
          { show: "ش", answer: "Šin" }, { show: "ص", answer: "Sad" }, { show: "ض", answer: "Dad" }, { show: "ط", answer: "Tâ" },
          { show: "ظ", answer: "Zâ" }, { show: "ع", answer: "Ajn" }, { show: "غ", answer: "Gajn" }, { show: "ف", answer: "Fa" },
          { show: "ق", answer: "Kaf" }, { show: "ك", answer: "Kef" }, { show: "ل", answer: "Lam" }, { show: "م", answer: "Mim" },
          { show: "ن", answer: "Nun" }, { show: "ه", answer: "He" }, { show: "و", answer: "Vav" }, { show: "ي", answer: "Ja" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj sve harfove s hareketima", description: "Svaki naučeni harf pojavljuje se najmanje jednom.",
        icon: "📖", hasanatReward: 50, choices: [],
        items: [
          { show: "أَ", answer: "Hemza + fetha" }, { show: "بِ", answer: "Ba + kesra" }, { show: "تُ", answer: "Ta + damma" }, { show: "ثَ", answer: "Sa + fetha" },
          { show: "جِ", answer: "Džim + kesra" }, { show: "حُ", answer: "Ha + damma" }, { show: "خَ", answer: "Hâ + fetha" }, { show: "دِ", answer: "Dal + kesra" },
          { show: "ذُ", answer: "Zal + damma" }, { show: "رَ", answer: "Ra + fetha" }, { show: "زِ", answer: "Za + kesra" }, { show: "سُ", answer: "Sin + damma" },
          { show: "شَ", answer: "Šin + fetha" }, { show: "صِ", answer: "Sad + kesra" }, { show: "ضُ", answer: "Dad + damma" }, { show: "طَ", answer: "Tâ + fetha" },
          { show: "ظِ", answer: "Zâ + kesra" }, { show: "عُ", answer: "Ajn + damma" }, { show: "غَ", answer: "Gajn + fetha" }, { show: "فِ", answer: "Fa + kesra" },
          { show: "قُ", answer: "Kaf + damma" }, { show: "كَ", answer: "Kef + fetha" }, { show: "لِ", answer: "Lam + kesra" }, { show: "مُ", answer: "Mim + damma" },
          { show: "نَ", answer: "Nun + fetha" }, { show: "هِ", answer: "He + kesra" }, { show: "وُ", answer: "Vav + damma" }, { show: "يَ", answer: "Ja + fetha" },
        ],
      },
      {
        type: "čitaj-slog", title: "Ponovi sukun, tešdid i tenvin", description: "Čitaj znak tačno: bez dodanog glasa uz sukun, s udvajanjem uz tešdid i s glasom n uz tenvin.",
        icon: "📖", hasanatReward: 55, choices: [],
        items: [
          { show: "أَبْ", answer: "Ba sa sukunom" }, { show: "مِنْ", answer: "Nun sa sukunom" }, { show: "قُلْ", answer: "Lam sa sukunom" }, { show: "هَلْ", answer: "Lam sa sukunom" },
          { show: "لَمْ", answer: "Mim sa sukunom" }, { show: "كُنْ", answer: "Nun sa sukunom" }, { show: "عَنْ", answer: "Nun sa sukunom" }, { show: "هُمْ", answer: "Mim sa sukunom" },
          { show: "رَبَّ", answer: "Ba s tešdidom" }, { show: "إِنَّ", answer: "Nun s tešdidom" }, { show: "ثُمَّ", answer: "Mim s tešdidom" }, { show: "حَقٌّ", answer: "Kaf s tešdidom i tenvinom" },
          { show: "شَرٍّ", answer: "Ra s tešdidom i tenvinom" }, { show: "حَجٌّ", answer: "Džim s tešdidom i tenvinom" }, { show: "كَذَّبَ", answer: "Zal s tešdidom" }, { show: "عَلَّمَ", answer: "Lam s tešdidom" },
          { show: "قَمَرٌ", answer: "Tenvin damma" }, { show: "بَشَرٌ", answer: "Tenvin damma" }, { show: "وَلَدٌ", answer: "Tenvin damma" }, { show: "جَبَلٌ", answer: "Tenvin damma" },
          { show: "نَهَرٌ", answer: "Tenvin damma" }, { show: "عِلْمٌ", answer: "Lam sa sukunom, Mim s tenvinom" }, { show: "خَبَرٍ", answer: "Tenvin kesra" }, { show: "أَجْرًا", answer: "Tenvin fetha" },
        ],
      },
      {
        type: "čitaj-slog", title: "Čitaj kratke kur'anske riječi", description: "Čitaj povezano i oslanjaj se na arapski zapis i audio, ne na latiničnu pomoć.",
        icon: "📖", hasanatReward: 60, choices: [],
        items: [
          { show: "خَلَقَ", answer: "Hâ–Lam–Kaf" }, { show: "عَبَدَ", answer: "Ajn–Ba–Dal" }, { show: "سَجَدَ", answer: "Sin–Džim–Dal" }, { show: "ذَكَرَ", answer: "Zal–Kef–Ra" },
          { show: "غَفَرَ", answer: "Gajn–Fa–Ra" }, { show: "رَزَقَ", answer: "Ra–Za–Kaf" }, { show: "كَتَبَ", answer: "Kef–Ta–Ba" }, { show: "نَصَرَ", answer: "Nun–Sad–Ra" },
          { show: "حَمِدَ", answer: "Ha–Mim–Dal" }, { show: "عَلِمَ", answer: "Ajn–Lam–Mim" }, { show: "مَلَكَ", answer: "Mim–Lam–Kef" }, { show: "جَعَلَ", answer: "Džim–Ajn–Lam" },
          { show: "فَتَحَ", answer: "Fa–Ta–Ha" }, { show: "صَبَرَ", answer: "Sad–Ba–Ra" }, { show: "شَكَرَ", answer: "Šin–Kef–Ra" }, { show: "وَجَدَ", answer: "Vav–Džim–Dal" },
          { show: "دَخَلَ", answer: "Dal–Hâ–Lam" }, { show: "خَرَجَ", answer: "Hâ–Ra–Džim" }, { show: "بَلَغَ", answer: "Ba–Lam–Gajn" }, { show: "سَمِعَ", answer: "Sin–Mim–Ajn" },
        ],
      },
    ],
  },
];

// Završno ponavljanje automatski koristi po jedan podatak za svaki harf iz
// prethodnih lekcija. Tako se naziv, oblik i audio ne mogu razići između
// pojedinačnih lekcija i kumulativnog pregleda.
const allLettersRevision = LESSONS.find((lesson) => lesson.id === 17);
if (allLettersRevision) {
  allLettersRevision.letterData = Array.from(
    new Map(
      LESSONS
        .filter((lesson) => lesson.id < 17)
        .flatMap((lesson) => lesson.letterData)
        .map((letter) => [letter.arabic, letter]),
    ).values(),
  );
}

for (const lesson of LESSONS) {
  const words = READING_WORDS_BY_LESSON[lesson.id];
  if (!words) continue;
  lesson.exercises.push({
    type: "čitaj-slog",
    title: lesson.id < 6 ? "Čitaj 20 slogova i spojeva" : "Čitaj 20 riječi i spojeva",
    description: "Čitaj prvo samostalno, zatim klikni svaku karticu i provjeri izgovor slušanjem.",
    icon: "📖", hasanatReward: 60, choices: [],
    items: words.map((show) => ({ show, answer: "" })),
  });
}

export function getLessonById(id: number): LessonData | undefined {
  return LESSONS.find(l => l.id === id);
}
