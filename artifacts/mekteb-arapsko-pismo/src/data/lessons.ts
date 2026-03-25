export interface ExerciseItem {
  show: string;
  answer: string;
  audio?: string;
}

export interface Exercise {
  type: "prepoznaj-hareket" | "koji-harf" | "slušaj" | "napiši" | "koji-znak" | "čitaj-slog";
  title: string;
  description: string;
  icon: string;
  hasanatReward: number;
  choices: string[];
  items: ExerciseItem[];
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
  soundFile: string;
}

export interface LessonData {
  id: number;
  orderNum: number;
  slug: string;
  title: string;
  letters: string[];
  isCompleted: boolean;
  isRevision?: boolean;
  story: { lines: { speaker: "dzana" | "amir"; text: string }[] };
  letterData: HarfData[];
  hareketi?: HarekeData[];
  exercises: Exercise[];
}

const HAREKETI_L2: HarekeData[] = [
  {
    arabic: "أَ", hareke: "ـَـ", name: "Fetha",
    sound: "e", colour: "teal",
    description: "Crtica iznad slova — daje kratki zvuk \"e\"",
    napomena: "Iznad krupnih (jakih) harfova čita se \"a\"",
    soundFile: "hareke-fatha.mp3",
  },
  {
    arabic: "إِ", hareke: "ـِـ", name: "Kesra",
    sound: "i", colour: "blue",
    description: "Crtica ispod slova — daje kratki zvuk \"i\"",
    napomena: null,
    soundFile: "hareke-kasra.mp3",
  },
  {
    arabic: "أُ", hareke: "ـُـ", name: "Damma",
    sound: "u", colour: "violet",
    description: "Zarez iznad slova — daje kratki zvuk \"u\"",
    napomena: null,
    soundFile: "hareke-damma.mp3",
  },
];

export const LESSONS: LessonData[] = [

  // ── LEKCIJA 2 ───────────────────────────────────────────────
  {
    id: 2, orderNum: 2, slug: "elif-hareketi",
    title: "Elif i hareketi",
    letters: ["ا"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, jesi li znao da arapska slova sama po sebi uglavnom nemaju samoglasnik?" },
        { speaker: "amir",  text: "Nisam! Kako onda znamo kako se čitaju?" },
        { speaker: "dzana", text: "Zato postoje hareketi! To su mali znakovi koji se stavljaju iznad ili ispod slova." },
        { speaker: "amir",  text: "A, kao tačkice — samo za samoglasnike?" },
        { speaker: "dzana", text: "Tačno! Fetha iznad elife daje zvuk 'e', a kesra ispod daje zvuk 'i'." },
        { speaker: "amir",  text: "A šta je damma? Kako izgleda?" },
        { speaker: "dzana", text: "Damma izgleda kao mali zarez iznad slova i daje zvuk 'u'. Elif s dammom čita se 'u'." },
        { speaker: "amir",  text: "Super! Znači samo elif može se čitati kao 'e', 'i' ili 'u' — ovisno o hareketu!" },
      ]
    },
    letterData: [
      {
        arabic: "ا", name: "Elif", transliteration: "E / I / U",
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
        title: "Prepoznaj hareket", description: "Pogledaj elif s harekom — koji je to hareket?",
        icon: "👁️", hasanatReward: 15,
        choices: ["Fetha", "Kesra", "Damma"],
        items: [
          { show: "أَ", answer: "Fetha" }, { show: "إِ", answer: "Kesra" }, { show: "أُ", answer: "Damma" },
          { show: "أُ", answer: "Damma" }, { show: "أَ", answer: "Fetha" }, { show: "إِ", answer: "Kesra" },
          { show: "أَ", answer: "Fetha" }, { show: "أُ", answer: "Damma" }, { show: "إِ", answer: "Kesra" },
          { show: "أَ", answer: "Fetha" }, { show: "إِ", answer: "Kesra" }, { show: "أُ", answer: "Damma" },
          { show: "أَ", answer: "Fetha" }, { show: "إِ", answer: "Kesra" }, { show: "أُ", answer: "Damma" },
          { show: "أَ", answer: "Fetha" }, { show: "أُ", answer: "Damma" }, { show: "إِ", answer: "Kesra" },
          { show: "أَ", answer: "Fetha" }, { show: "أُ", answer: "Damma" },
        ]
      },
      {
        type: "koji-znak",
        title: "Koji zvuk?", description: "Pogledaj hareket simbol — koji zvuk daje?",
        icon: "🔤", hasanatReward: 15,
        choices: ["e", "i", "u"],
        items: [
          { show: "ـَـ", answer: "e" }, { show: "ـِـ", answer: "i" }, { show: "ـُـ", answer: "u" },
          { show: "ـِـ", answer: "i" }, { show: "ـَـ", answer: "e" }, { show: "ـُـ", answer: "u" },
          { show: "ـَـ", answer: "e" }, { show: "ـِـ", answer: "i" }, { show: "ـُـ", answer: "u" },
          { show: "ـِـ", answer: "i" }, { show: "ـَـ", answer: "e" }, { show: "ـُـ", answer: "u" },
          { show: "ـَـ", answer: "e" }, { show: "ـُـ", answer: "u" }, { show: "ـِـ", answer: "i" },
          { show: "ـَـ", answer: "e" }, { show: "ـُـ", answer: "u" }, { show: "ـِـ", answer: "i" },
          { show: "ـَـ", answer: "e" }, { show: "ـِـ", answer: "i" },
        ]
      },
      {
        type: "slušaj",
        title: "Slušaj i odaberi", description: "Pritisni dugme — koji elif odgovara zvuku?",
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
        title: "Napiši zvuk", description: "Pogledaj elif — napiši latinično koji zvuk ima",
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
        { speaker: "dzana", text: "Amir, pogledaj ova tri harfa — ba, ta i sa. Primijetaš li nešto posebno?" },
        { speaker: "amir",  text: "Hmm... svi izgledaju slično! Kao mali brod ili čamac." },
        { speaker: "dzana", text: "Bravo! Razlikuju se samo po tačkicama. Ba ima jednu tačku ispod." },
        { speaker: "amir",  text: "A ta ima dvije tačkice iznad, a sa čak tri tačkice iznad!" },
        { speaker: "dzana", text: "Tačno! I sva tri harfa mogu nositi harekete — fethu, kesru i dammu." },
        { speaker: "amir",  text: "Pa — ba s fethom daje 'be', ba s kesrom 'bi', a ba s dammom 'bu'?" },
        { speaker: "dzana", text: "Odlično! Isto vrijedi za ta i sa. Hareketi su uvijek isti!" },
        { speaker: "amir",  text: "Super, samo trebam upamtiti tačkice — a hareketi su isti kao kod elifa!" },
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
        arabic: "ث", name: "Sa", transliteration: "S (meko)",
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
          { show: "بَ", answer: "Ba"  }, { show: "تِ", answer: "Ta"  }, { show: "ثُ", answer: "Sa"  },
          { show: "تَ", answer: "Ta"  }, { show: "ثَ", answer: "Sa"  }, { show: "بِ", answer: "Ba"  },
          { show: "بُ", answer: "Ba"  }, { show: "ثِ", answer: "Sa"  }, { show: "تُ", answer: "Ta"  },
          { show: "ثَ", answer: "Sa"  }, { show: "بَ", answer: "Ba"  }, { show: "تِ", answer: "Ta"  },
        ]
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
        { speaker: "dzana", text: "Amir, ovi harfovi su malo posebni — zovu se 'duboka' slova. Pogledaj džim, ha i hâ." },
        { speaker: "amir",  text: "Izgledaju slično kao plića posuda ili udubina. Zanima me razlika." },
        { speaker: "dzana", text: "Džim ima jednu tačku ispod. Izgovara se kao naše 'dž' — kao u 'džep'." },
        { speaker: "amir",  text: "A ha — bez tačke? Kako se izgovara?" },
        { speaker: "dzana", text: "Ha bez tačke je tihi, topli glas iz grudi. Puhni blago rukom — osjetit ćeš toplinu." },
        { speaker: "amir",  text: "A hâ s tačkom iznad?" },
        { speaker: "dzana", text: "Hâ s tačkom dolazi iz grla, malo kao zvuk 'h' kad kašlješ." },
        { speaker: "amir",  text: "Tri slova, tri zvuka — ali sva tri nose iste harekete!" },
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
        visualAssociation: "Ista udubina bez tačke — prazan, tih i mekan zvuk",
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
          { show: "جَ", answer: "Džim" }, { show: "حِ", answer: "Ha"   }, { show: "خُ", answer: "Hâ"   },
          { show: "حَ", answer: "Ha"   }, { show: "جِ", answer: "Džim" }, { show: "خَ", answer: "Hâ"   },
          { show: "خِ", answer: "Hâ"   }, { show: "حُ", answer: "Ha"   }, { show: "جُ", answer: "Džim" },
          { show: "خَ", answer: "Hâ"   }, { show: "جِ", answer: "Džim" }, { show: "حَ", answer: "Ha"   },
        ]
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
        choices: ["dže-be", "he-be", "hâ-be", "be-dže", "te-dže", "se-dže", "he-dže", "dže-he", "hâ-dže", "dži-be", "hi-te", "dže-te", "bu-he", "hâ-se", "bi-dže"],
        items: [
          { show: "جَبَ", answer: "dže-be"  },
          { show: "حَبَ", answer: "he-be"   },
          { show: "خَبَ", answer: "hâ-be"   },
          { show: "بَجَ", answer: "be-dže"  },
          { show: "تَجَ", answer: "te-dže"  },
          { show: "ثَجَ", answer: "se-dže"  },
          { show: "حَجَ", answer: "he-dže"  },
          { show: "جَحَ", answer: "dže-he"  },
          { show: "خَجَ", answer: "hâ-dže"  },
          { show: "جِبَ", answer: "dži-be"  },
          { show: "حِتَ", answer: "hi-te"   },
          { show: "جَتَ", answer: "dže-te"  },
          { show: "بُحَ", answer: "bu-he"   },
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
          { show: "حَ",     answer: "he"        },
          { show: "حِ",     answer: "hi"        },
          { show: "حُ",     answer: "hu"        },
          { show: "خَ",     answer: "hâ"        },
          { show: "خِ",     answer: "hâ-i"      },
          { show: "خُ",     answer: "hâ-u"      },
          { show: "جَبَ",   answer: "dže-be"    },
          { show: "حَبَ",   answer: "he-be"     },
          { show: "خَبَ",   answer: "hâ-be"     },
          { show: "بَجَ",   answer: "be-dže"    },
          { show: "تَجَ",   answer: "te-dže"    },
          { show: "ثَجَ",   answer: "se-dže"    },
          { show: "حَجَ",   answer: "he-dže"    },
          { show: "جَحَ",   answer: "dže-he"    },
          { show: "خَجَ",   answer: "hâ-dže"    },
          { show: "جِبَ",   answer: "dži-be"    },
          { show: "حِتَ",   answer: "hi-te"     },
          { show: "خُبَ",   answer: "hâ-u-be"   },
          { show: "بَحَثَ", answer: "be-he-se"  },
          { show: "حَجَبَ", answer: "he-dže-be" },
          { show: "خَبَثَ", answer: "hâ-be-se"  },
          { show: "جَبَتَ", answer: "dže-be-te" },
          { show: "حَبَثَ", answer: "he-be-se"  },
          { show: "تَجَحَ", answer: "te-dže-he" },
          { show: "خَجَبَ", answer: "hâ-dže-be" },
          { show: "جِبَثَ", answer: "dži-be-se" },
          { show: "بُجُحَ", answer: "bu-džu-he" },
        ]
      },
    ]
  },

  // ── LEKCIJA 5 ───────────────────────────────────────────────
  {
    id: 5, orderNum: 5, slug: "ponavljanje-sedam-harfova",
    title: "Ponavljanje — svih 7 harfova",
    letters: ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
    isCompleted: false,
    isRevision: true,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, znaš li da svaki harf koji si naučio postoji i u Kur'anu? Ba, ta, sa, džim, ha i hâ — svi su tu!" },
        { speaker: "amir",  text: "Ozbiljno? Kao, u pravim ajetima?" },
        { speaker: "dzana", text: "Tačno! Na primjer, هَذَا počinje harfom ha — a znači 'ovo'. Ili خَيْرٌ s harfom hâ — znači 'dobro'." },
        { speaker: "amir",  text: "Wow. Znači kada naučim čitati ove harfove, mogu prepoznati prave riječi!" },
        { speaker: "dzana", text: "Upravo tako. Zato danas ne učimo nova slova — nego spajamo ono što znaš. Spreman?" },
        { speaker: "amir",  text: "Spreman! Daj mi kombinacije, pa ću čitati!" },
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
          { show: "حَ",     answer: "he"         },
          { show: "خِ",     answer: "hâ-i"       },
          { show: "ثُ",     answer: "su"         },
          { show: "أَ",     answer: "a"          },
          { show: "بَتَ",   answer: "be-te"      },
          { show: "تَجَ",   answer: "te-dže"     },
          { show: "جَحَ",   answer: "dže-he"     },
          { show: "حَبَ",   answer: "he-be"      },
          { show: "خَثَ",   answer: "hâ-se"      },
          { show: "ثَجَ",   answer: "se-dže"     },
          { show: "بِحَ",   answer: "bi-he"      },
          { show: "تُخَ",   answer: "tu-hâ"      },
          { show: "جِبَ",   answer: "dži-be"     },
          { show: "حِتَ",   answer: "hi-te"      },
          { show: "خُبَ",   answer: "hâ-u-be"    },
          { show: "بُجَ",   answer: "bu-dže"     },
          { show: "بَحَثَ", answer: "be-he-se"   },
          { show: "حَجَبَ", answer: "he-dže-be"  },
          { show: "خَبَثَ", answer: "hâ-be-se"   },
          { show: "جَبَتَ", answer: "dže-be-te"  },
          { show: "تَجَحَ", answer: "te-dže-he"  },
          { show: "حَبَثَ", answer: "he-be-se"   },
          { show: "بُجُحَ", answer: "bu-džu-he"  },
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
        choices: ["be-te", "te-dže", "he-dže", "hâ-be", "dže-he", "se-dže", "bi-he", "tu-hâ", "dži-be", "hi-te", "bu-dže", "he-be", "hâ-se", "te-he", "dže-be"],
        items: [
          { show: "بَتَ", answer: "be-te"   },
          { show: "تَجَ", answer: "te-dže"  },
          { show: "حَجَ", answer: "he-dže"  },
          { show: "خَبَ", answer: "hâ-be"   },
          { show: "جَحَ", answer: "dže-he"  },
          { show: "ثَجَ", answer: "se-dže"  },
          { show: "بِحَ", answer: "bi-he"   },
          { show: "تُخَ", answer: "tu-hâ"   },
          { show: "جِبَ", answer: "dži-be"  },
          { show: "حِتَ", answer: "hi-te"   },
          { show: "بُجَ", answer: "bu-dže"  },
          { show: "حَبَ", answer: "he-be"   },
          { show: "خَثَ", answer: "hâ-se"   },
          { show: "تَحَ", answer: "te-he"   },
          { show: "جَبَ", answer: "dže-be"  },
        ]
      },
      {
        type: "koji-harf",
        title: "Riječ s tri slova",
        description: "Tri harfa spojena — polako pročitaj i odaberi tačan izgovor",
        icon: "🔗🔗", hasanatReward: 30,
        choices: ["be-he-se", "he-dže-be", "hâ-be-se", "dže-be-te", "te-dže-he", "bu-džu-he", "hâ-dže-be", "dži-be-se", "se-be-te", "te-be-se", "he-be-se", "dže-he-be", "bi-te-se", "a-be-te", "hâ-u-be-dže"],
        items: [
          { show: "بَحَثَ", answer: "be-he-se"   },
          { show: "حَجَبَ", answer: "he-dže-be"  },
          { show: "خَبَثَ", answer: "hâ-be-se"   },
          { show: "جَبَتَ", answer: "dže-be-te"  },
          { show: "تَجَحَ", answer: "te-dže-he"  },
          { show: "بُجُحَ", answer: "bu-džu-he"  },
          { show: "خَجَبَ", answer: "hâ-dže-be"  },
          { show: "جِبَثَ", answer: "dži-be-se"  },
          { show: "ثَبَتَ", answer: "se-be-te"   },
          { show: "تَبَثَ", answer: "te-be-se"   },
          { show: "حَبَثَ", answer: "he-be-se"   },
          { show: "جَحَبَ", answer: "dže-he-be"  },
        ]
      },
    ]
  },

  // ── LEKCIJA 6: SUKUN ────────────────────────────────────────
  {
    id: 6, orderNum: 6, slug: "sukun",
    title: "Sukun — slovo bez glasa",
    letters: ["ْ"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, zamisli da slovo može šutjeti. Kad nosi sukun — ne izgovara samoglasnik." },
        { speaker: "amir",  text: "Kao kad zatvoriš usta? Pa kako onda uopće znaš da je tu?" },
        { speaker: "dzana", text: "Suglasnik se izgovori, ali odmah stati. Ba s ferethom je 'be', a ba sa sukunom je samo 'b'." },
        { speaker: "amir",  text: "Ah, kao u 'kitab' — posljednje ba je tiho, samo 'b' bez samoglasnika?" },
        { speaker: "dzana", text: "Tačno! Sukun izgleda kao mali krug ili nula iznad slova." },
        { speaker: "amir",  text: "Mali krug — kao balon bez zraka! Hm, lako za upamtiti." },
        { speaker: "dzana", text: "Pametan si! Pamti: krug iznad slova = nema samoglasnika, slovo šuti." },
        { speaker: "amir",  text: "Dakle: بَ = 'be', بِ = 'bi', بُ = 'bu', a بْ = samo 'b'. Kapiraoo!" },
      ]
    },
    letterData: [
      {
        arabic: "بْ", name: "Sukun na Ba", transliteration: "b (bez samoglasnika)",
        forms: { isolated: "بْ", initial: "بْ", medial: "ـبْ", final: "ـبْ" },
        visualAssociation: "Mali krug iznad slova — kao balon bez zraka, slovo šuti",
        soundFile: "hareke-sukun.mp3",
      },
    ],
    hareketi: [
      {
        arabic: "بْ", hareke: "ْ", name: "Sukun",
        sound: "—", colour: "teal",
        description: "Mali krug iznad slova — slovo nema samoglasnika",
        napomena: "Izgovori suglasnik ali odmah stani — nema vokala",
        soundFile: "hareke-sukun.mp3",
      },
    ],
    exercises: [
      {
        type: "koji-znak",
        title: "Sukun ili hareket?", description: "Pogledaj slovo — nosi li sukun ili hareket?",
        icon: "👁️", hasanatReward: 15,
        choices: ["Sukun", "Fetha", "Kesra", "Damma"],
        items: [
          { show: "بْ", answer: "Sukun" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra" },
          { show: "حُ", answer: "Damma" }, { show: "خْ", answer: "Sukun" }, { show: "ثَ", answer: "Fetha" },
          { show: "بِ", answer: "Kesra" }, { show: "تُ", answer: "Damma" }, { show: "جْ", answer: "Sukun" },
          { show: "حَ", answer: "Fetha" }, { show: "خِ", answer: "Kesra" }, { show: "ثُ", answer: "Damma" },
          { show: "بْ", answer: "Sukun" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra" },
          { show: "حْ", answer: "Sukun" }, { show: "خَ", answer: "Fetha" }, { show: "ثِ", answer: "Kesra" },
          { show: "بُ", answer: "Damma" }, { show: "جْ", answer: "Sukun" },
        ]
      },
      {
        type: "prepoznaj-hareket",
        title: "Prepoznaj hareket ili sukun", description: "Pogledaj slovo s harekom — koji je to znak?",
        icon: "🔍", hasanatReward: 15,
        choices: ["Fetha", "Kesra", "Damma", "Sukun"],
        items: [
          { show: "بَ", answer: "Fetha" }, { show: "تِ", answer: "Kesra" }, { show: "جُ", answer: "Damma" },
          { show: "خْ", answer: "Sukun" }, { show: "حَ", answer: "Fetha" }, { show: "بْ", answer: "Sukun" },
          { show: "ثِ", answer: "Kesra" }, { show: "تُ", answer: "Damma" }, { show: "جْ", answer: "Sukun" },
          { show: "خَ", answer: "Fetha" }, { show: "حِ", answer: "Kesra" }, { show: "بُ", answer: "Damma" },
          { show: "ثْ", answer: "Sukun" }, { show: "تَ", answer: "Fetha" }, { show: "جِ", answer: "Kesra" },
          { show: "حُ", answer: "Damma" }, { show: "خْ", answer: "Sukun" }, { show: "بَ", answer: "Fetha" },
          { show: "تْ", answer: "Sukun" }, { show: "ثُ", answer: "Damma" },
        ]
      },
      {
        type: "slušaj",
        title: "Slušaj i odaberi", description: "Pritisni dugme 🔊 — čuješ li hareket ili sukun?",
        icon: "🎧", hasanatReward: 20,
        choices: ["Fetha", "Kesra", "Damma", "Sukun"],
        items: [
          { show: "🔊", answer: "Fetha", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Kesra", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Damma", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
          { show: "🔊", answer: "Fetha", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
          { show: "🔊", answer: "Kesra", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Damma", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
          { show: "🔊", answer: "Fetha", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Damma", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
          { show: "🔊", answer: "Kesra", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Fetha", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
          { show: "🔊", answer: "Damma", audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Fetha", audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
          { show: "🔊", answer: "Kesra", audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Sukun", audio: "hareke-sukun.mp3" },
        ]
      },
      {
        type: "napiši",
        title: "Napiši zvuk ili —", description: "Napiši zvuk slova (e/i/u) ili crtu (—) ako nema glasa",
        icon: "✏️", hasanatReward: 10,
        choices: [],
        items: [
          { show: "بَ", answer: "e" }, { show: "تِ", answer: "i" }, { show: "جُ", answer: "u" },
          { show: "خْ", answer: "—" }, { show: "حَ", answer: "e" }, { show: "بْ", answer: "—" },
          { show: "ثِ", answer: "i" }, { show: "تُ", answer: "u" }, { show: "جْ", answer: "—" },
          { show: "خَ", answer: "e" }, { show: "حِ", answer: "i" }, { show: "بُ", answer: "u" },
          { show: "ثْ", answer: "—" }, { show: "تَ", answer: "e" }, { show: "جِ", answer: "i" },
          { show: "حُ", answer: "u" }, { show: "خْ", answer: "—" }, { show: "بَ", answer: "e" },
          { show: "تْ", answer: "—" }, { show: "ثُ", answer: "u" },
        ]
      },
    ]
  },

  // ── LEKCIJA 7: TEŠDID ───────────────────────────────────────
  {
    id: 7, orderNum: 7, slug: "tesdid",
    title: "Tešdid — slovo koje se udvoji",
    letters: ["ّ"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, zamisli da jedno slovo mora reći svoje ime dva puta. To je tešdid!" },
        { speaker: "amir",  text: "Dva puta? Pa zašto ne napišu slovo dva puta?" },
        { speaker: "dzana", text: "Zato što u arapskom postoji poseban znak koji to označava — tešdid. Izgleda kao mali 'w' iznad slova." },
        { speaker: "amir",  text: "Mali 'w'? Gdje se stavlja — iznad slova?" },
        { speaker: "dzana", text: "Da, iznad. I slovo se tada izgovara duže, kao da ga kažeš dvaput bez pauze." },
        { speaker: "amir",  text: "Pa — ba s tešdidom je... 'bb'? Kao u 'sabbah'?" },
        { speaker: "dzana", text: "Upravo! A uz hareket: bba, bbi, bbu. Tešdid i hareket idu zajedno." },
        { speaker: "amir",  text: "Dakle tešdid = udvojenost, a hareket kaže koji samoglasnik ide uz to. Jasno!" },
      ]
    },
    letterData: [
      {
        arabic: "بَّ", name: "Tešdid na Ba (s fethom)", transliteration: "bba",
        forms: { isolated: "بَّ", initial: "بَّ", medial: "ـبَّـ", final: "ـبَّ" },
        visualAssociation: "Mali 'w' iznad slova — slovo se kaže dvaput, kao eho",
        soundFile: "hareke-sedda.mp3",
      },
    ],
    hareketi: [
      {
        arabic: "بَّ", hareke: "ّ", name: "Tešdid",
        sound: "×2", colour: "teal",
        description: "Mali 'w' znak iznad slova — slovo se izgovara udvostručeno",
        napomena: "Uvijek dolazi uz hareket koji kaže koji samoglasnik ide uz udvostručenje",
        soundFile: "hareke-sedda.mp3",
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
        type: "slušaj",
        title: "Slušaj i odaberi", description: "Čuješ li tešdid ili obični hareket?",
        icon: "🎧", hasanatReward: 20,
        choices: ["Tešdid", "Fetha", "Kesra", "Damma"],
        items: [
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Fetha",  audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Kesra",  audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Damma",  audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Kesra",  audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Damma",  audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Fetha",  audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Damma",  audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Fetha",  audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Kesra",  audio: "hareke-kasra.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Damma",  audio: "hareke-damma.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
          { show: "🔊", answer: "Fetha",  audio: "hareke-fatha.mp3" },
          { show: "🔊", answer: "Tešdid", audio: "hareke-sedda.mp3" },
        ]
      },
      {
        type: "napiši",
        title: "Napiši zvuk", description: "Napiši zvuk hareka koji je uz tešdid (e/i/u)",
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

  // ── LEKCIJA 8: TENVIN ───────────────────────────────────────
  {
    id: 8, orderNum: 8, slug: "tenvin",
    title: "Tenvin — zvuk N na kraju",
    letters: ["ً", "ٍ", "ٌ"],
    isCompleted: false,
    story: {
      lines: [
        { speaker: "dzana", text: "Amir, tenvin je poseban znak koji dodaje zvuk 'n' na kraj riječi." },
        { speaker: "amir",  text: "Znači kao da kažeš fetha ali dodaš 'n' na kraj — 'en'?" },
        { speaker: "dzana", text: "Tačno! Tenvin fetha daje '-en', tenvin kesra daje '-in', a tenvin damma '-un'." },
        { speaker: "amir",  text: "A kako izgledaju? Kao dupli hareketi?" },
        { speaker: "dzana", text: "Upravo! Tenvin fetha su dvije crtice iznad, tenvin kesra dvije ispod, a tenvin damma dva zareza iznad." },
        { speaker: "amir",  text: "Ima li nešto posebno kod tenvin fethe?" },
        { speaker: "dzana", text: "Da — tenvin fetha uvijek dolazi zajedno s elifom! Piše se بًا, a ne samo بً. Elif je tu uvijek." },
        { speaker: "amir",  text: "Znači HARAM se piše حَرَامًا — sa elifom na kraju! A izgovara se HARAM — bez 'n'?" },
        { speaker: "dzana", text: "Odlično! U pisanju pišemo 'un', 'in', 'an' — ali u govoru tenvin na kraju ne izgovaramo. HARAMUN izgovaramo kao HARAM." },
        { speaker: "amir",  text: "Super! Pišem sa 'n', čitam bez 'n'. Onda nema zabune — ako vidim duple harekete, znam da je tenvin." },
      ]
    },
    letterData: [
      {
        arabic: "بًا", name: "Tenvin fetha", transliteration: "-en",
        forms: { isolated: "بًا", initial: "—", medial: "—", final: "ـبًا" },
        visualAssociation: "Dvije crtice iznad slova + elif — tenvin fetha UVIJEK dolazi s elifom na kraju",
        soundFile: "hareke-fatha.mp3",
      },
      {
        arabic: "بٍ", name: "Tenvin kesra", transliteration: "-in",
        forms: { isolated: "بٍ", initial: "بٍ", medial: "ـبٍ", final: "ـبٍ" },
        visualAssociation: "Dvije crtice ispod slova — kao kesra, ali duplirana → dodaje 'n'",
        soundFile: "hareke-kasra.mp3",
      },
      {
        arabic: "بٌ", name: "Tenvin damma", transliteration: "-un",
        forms: { isolated: "بٌ", initial: "بٌ", medial: "ـبٌ", final: "ـبٌ" },
        visualAssociation: "Dva zareza iznad slova — kao damma, ali duplirano → dodaje 'n'",
        soundFile: "hareke-damma.mp3",
      },
    ],
    hareketi: [
      {
        arabic: "بًا", hareke: "ً", name: "Tenvin fetha",
        sound: "-en", colour: "teal",
        description: "Dvije crtice iznad + UVIJEK dolazi s elifom (ا) — zvuk '-en' na kraju",
        napomena: "⚠️ Tenvin fetha uvijek piše s elifom: بًا, ne بً — u govoru se 'en' izostavlja",
        soundFile: "hareke-fatha.mp3",
      },
      {
        arabic: "بٍ", hareke: "ٍ", name: "Tenvin kesra",
        sound: "-in", colour: "blue",
        description: "Dvije crtice ispod — hareket kesra + zvuk 'n' na kraju",
        napomena: null,
        soundFile: "hareke-kasra.mp3",
      },
      {
        arabic: "بٌ", hareke: "ٌ", name: "Tenvin damma",
        sound: "-un", colour: "violet",
        description: "Dva zareza iznad — hareket damma + zvuk 'n' na kraju",
        napomena: null,
        soundFile: "hareke-damma.mp3",
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
        title: "Koji zvuk tenvin?", description: "Pogledaj tenvin — koji zvuk daje na kraju?",
        icon: "🔤", hasanatReward: 15,
        choices: ["-en", "-in", "-un"],
        items: [
          { show: "بًا", answer: "-en" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-en" }, { show: "خٍ", answer: "-in" }, { show: "ثٌ", answer: "-un" },
          { show: "بًا", answer: "-en" }, { show: "جٍ", answer: "-in" }, { show: "تٌ", answer: "-un" },
          { show: "خًا", answer: "-en" }, { show: "حٍ", answer: "-in" }, { show: "بٌ", answer: "-un" },
          { show: "ثًا", answer: "-en" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-en" }, { show: "خٌ", answer: "-un" }, { show: "بٍ", answer: "-in" },
          { show: "ثًا", answer: "-en" }, { show: "جٍ", answer: "-in" },
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
        title: "Napiši zvuk tenvin", description: "Napiši zvuk tenvin (-en, -in ili -un)",
        icon: "✏️", hasanatReward: 10,
        choices: [],
        items: [
          { show: "بًا", answer: "-en" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-en" }, { show: "خٍ", answer: "-in" }, { show: "ثٌ", answer: "-un" },
          { show: "بًا", answer: "-en" }, { show: "جٍ", answer: "-in" }, { show: "تٌ", answer: "-un" },
          { show: "خًا", answer: "-en" }, { show: "حٍ", answer: "-in" }, { show: "بٌ", answer: "-un" },
          { show: "ثًا", answer: "-en" }, { show: "تٍ", answer: "-in" }, { show: "جٌ", answer: "-un" },
          { show: "حًا", answer: "-en" }, { show: "خٌ", answer: "-un" }, { show: "بٍ", answer: "-in" },
          { show: "ثًا", answer: "-en" }, { show: "جٍ", answer: "-in" },
        ]
      },
    ]
  },
];

export function getLessonById(id: number): LessonData | undefined {
  return LESSONS.find(l => l.id === id);
}
