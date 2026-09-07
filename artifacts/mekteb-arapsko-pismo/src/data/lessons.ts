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
        type: "čitaj-slog",
        title: "Čitaj nove harfove s hareketima",
        description: "Prvo pročitaj bez pomoći, zatim klikni i provjeri izgovor.",
        icon: "📖", hasanatReward: 30,
        choices: [],
        items: [
          { show: "دَ", answer: "Dal + fetha" }, { show: "دِ", answer: "Dal + kesra" }, { show: "دُ", answer: "Dal + damma" },
          { show: "ذَ", answer: "Zal + fetha" }, { show: "ذِ", answer: "Zal + kesra" }, { show: "ذُ", answer: "Zal + damma" },
          { show: "رَ", answer: "Ra + fetha" },  { show: "رِ", answer: "Ra + kesra" },  { show: "رُ", answer: "Ra + damma" },
          { show: "زَ", answer: "Zejn + fetha" }, { show: "زِ", answer: "Zejn + kesra" }, { show: "زُ", answer: "Zejn + damma" },
          { show: "ذِ", answer: "Zal + kesra" }, { show: "رَ", answer: "Ra + fetha" }, { show: "دُ", answer: "Dal + damma" },
          { show: "زِ", answer: "Zejn + kesra" }, { show: "دَ", answer: "Dal + fetha" }, { show: "رُ", answer: "Ra + damma" },
          { show: "ذُ", answer: "Zal + damma" }, { show: "زَ", answer: "Zejn + fetha" }, { show: "رِ", answer: "Ra + kesra" },
          { show: "دِ", answer: "Dal + kesra" }, { show: "ذَ", answer: "Zal + fetha" }, { show: "زُ", answer: "Zejn + damma" },
        ],
      },
      {
        type: "čitaj-slog",
        title: "Čitaj spojeve i kratke riječi",
        description: "Čitaj povezano; prekid pisane linije poslije د ذ ر ز nije prekid glasa.",
        icon: "📖", hasanatReward: 35,
        choices: [],
        items: [
          { show: "بَدَ", answer: "Ba–Dal" },   { show: "دَبَ", answer: "Dal–Ba" },
          { show: "تَرَ", answer: "Ta–Ra" },    { show: "رَتَ", answer: "Ra–Ta" },
          { show: "بَذَ", answer: "Ba–Zal" },   { show: "ذَبَ", answer: "Zal–Ba" },
          { show: "جَزَ", answer: "Džim–Zejn" }, { show: "زَجَ", answer: "Zejn–Džim" },
          { show: "حَدَ", answer: "Ha–Dal" },   { show: "دَحَ", answer: "Dal–Ha" },
          { show: "خَرَ", answer: "Hâ–Ra" },    { show: "رَخَ", answer: "Ra–Hâ" },
          { show: "بِدُ", answer: "Ba–Dal" },   { show: "دُبِ", answer: "Dal–Ba" },
          { show: "تُرِ", answer: "Ta–Ra" },    { show: "رِتُ", answer: "Ra–Ta" },
          { show: "ثِذُ", answer: "Sa–Zal" },   { show: "ذُثِ", answer: "Zal–Sa" },
          { show: "جُزِ", answer: "Džim–Zejn" }, { show: "زِجُ", answer: "Zejn–Džim" },
          { show: "بَدَرَ", answer: "Ba–Dal–Ra" }, { show: "دَرَجَ", answer: "Dal–Ra–Džim" },
          { show: "ذَبَحَ", answer: "Zal–Ba–Ha" }, { show: "رَجَبَ", answer: "Ra–Džim–Ba" },
          { show: "بَحَرَ", answer: "Ba–Ha–Ra" }, { show: "حَذَرَ", answer: "Ha–Zal–Ra" },
          { show: "خَرَجَ", answer: "Hâ–Ra–Džim" }, { show: "بَرَزَ", answer: "Ba–Ra–Zejn" },
          { show: "جَذَرَ", answer: "Džim–Zal–Ra" }, { show: "حَجَرَ", answer: "Ha–Džim–Ra" },
        ],
      },
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

  // ── LEKCIJA 6: DAL, ZAL, RA I ZEJN ─────────────────────────
  {
    id: 6, orderNum: 6, slug: "dal-zal-ra-zejn",
    title: "Dal, Zal, Ra i Zejn",
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
        { speaker: "amir", text: "A Ra i Zejn također imaju isti osnovni oblik, samo Zejn ima tačku?" },
        { speaker: "muallim", text: "Da. Kod harfa Ra vrh jezika prilazi desnima iza gornjih prednjih zuba. Ne treba ga dugo tresti niti ponavljati. Pravila kada se Ra čita krupnije ili tanje učit ćemo kasnije." },
        { speaker: "muallim", text: "Zejn je zvučan glas sličan našem Z. Zrak prolazi uskim putem između jezika i prednjih zuba, bez dodavanja glasa D ispred njega." },
        { speaker: "dzana", text: "Dakle, tačke razlikuju Dal od Zala i Ra od Zejna, a sva četiri prekidaju pisanu vezu s narednim harfom." },
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
        arabic: "ز", name: "Zejn", transliteration: "Z",
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
        choices: ["Dal", "Zal", "Ra", "Zejn"],
        items: [
          { show: "د", answer: "Dal" }, { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" }, { show: "ز", answer: "Zejn" },
          { show: "ذ", answer: "Zal" }, { show: "د", answer: "Dal" }, { show: "ز", answer: "Zejn" }, { show: "ر", answer: "Ra" },
          { show: "ر", answer: "Ra" }, { show: "ز", answer: "Zejn" }, { show: "د", answer: "Dal" }, { show: "ذ", answer: "Zal" },
          { show: "ز", answer: "Zejn" }, { show: "ر", answer: "Ra" }, { show: "ذ", answer: "Zal" }, { show: "د", answer: "Dal" },
          { show: "د", answer: "Dal" }, { show: "ز", answer: "Zejn" }, { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" },
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
        choices: ["Dal", "Zal", "Ra", "Zejn"],
        items: [
          { show: "ـد", answer: "Dal" }, { show: "ـذ", answer: "Zal" }, { show: "ـر", answer: "Ra" }, { show: "ـز", answer: "Zejn" },
          { show: "ـز", answer: "Zejn" }, { show: "ـد", answer: "Dal" }, { show: "ـذ", answer: "Zal" }, { show: "ـر", answer: "Ra" },
          { show: "ـر", answer: "Ra" }, { show: "ـذ", answer: "Zal" }, { show: "ـد", answer: "Dal" }, { show: "ـز", answer: "Zejn" },
        ],
      },
      {
        type: "napiši",
        title: "Napiši ime harfa", description: "Pogledaj harf i napiši njegovo ime: Dal, Zal, Ra ili Zejn.",
        icon: "✏️", hasanatReward: 15,
        choices: [],
        items: [
          { show: "د", answer: "Dal" }, { show: "ذ", answer: "Zal" }, { show: "ر", answer: "Ra" }, { show: "ز", answer: "Zejn" },
          { show: "ذ", answer: "Zal" }, { show: "ز", answer: "Zejn" }, { show: "د", answer: "Dal" }, { show: "ر", answer: "Ra" },
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
    ]
  },
];

export function getLessonById(id: number): LessonData | undefined {
  return LESSONS.find(l => l.id === id);
}
