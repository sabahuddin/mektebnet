import {
  db,
  ilmihalLekcijeTable,
  kvizoviTable,
  kvizPitanjaTable,
  pitanjaBankaTable,
  type DidaktickiTip,
  type KvizKategorija,
  type LekcijaKvizPitanje,
  type PitanjeMeta,
  type PitanjeVrsta,
} from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";

export interface IlmihalPilotQuestion {
  key: string;
  sourceQuestion: string;
  didaktickiTip: DidaktickiTip;
  vrsta: PitanjeVrsta;
  pitanje: string;
  opcije: string[];
  correctIndex?: number;
  correctIndexes?: number[];
  correctOrder?: number[];
  objasnjenje: string;
  retryPrompt: string;
  tezina: 1 | 2 | 3;
}

export interface IlmihalPilotLesson {
  nivo: 1 | 2 | 3;
  lessonSlug: string;
  quizSlug: string;
  quizTitle: string;
  kategorija: KvizKategorija;
  tagovi: string[];
  questions: IlmihalPilotQuestion[];
}

export const ILMIHAL_LEARNING_PILOTS: IlmihalPilotLesson[] = [
  {
    nivo: 1,
    lessonSlug: "uvodna-rijec",
    quizSlug: "ucimo-uvodna-rijec",
    quizTitle: "Učimo kroz pitanja: Uvodna riječ",
    kategorija: "ahlak",
    tagovi: ["pomaganje"],
    questions: [
      {
        key: "n1-ilmihal-opis",
        sourceQuestion: "Šta je Ilmihal koji ste dobili?",
        didaktickiTip: "prisjecanje",
        vrsta: "single",
        pitanje: "Koja rečenica najbolje opisuje Ilmihal?",
        opcije: [
          "Vodič kroz vjeru i svakodnevni život muslimana",
          "Knjiga samo o historijskim datumima",
          "Zbirka sportskih pravila",
          "Knjiga samo za odrasle",
        ],
        correctIndex: 0,
        objasnjenje: "Ilmihal nas vodi kroz osnovno znanje o vjeri i pokazuje kako to znanje živimo.",
        retryPrompt: "Prisjeti se čemu služi vodič: samo da nabraja podatke ili da pomaže u životu?",
        tezina: 1,
      },
      {
        key: "n1-mekteb-razlikovanje",
        sourceQuestion: "Što je mekteb prema tekstu lekcije?",
        didaktickiTip: "razlikovanje",
        vrsta: "multiple",
        pitanje: "Po čemu prepoznajemo pravi mekteb? Odaberi sve tačne odgovore.",
        opcije: [
          "U njemu učimo",
          "U njemu gradimo prijateljstvo",
          "U njemu pomažemo jedni drugima",
          "U njemu je važno samo prepisati lekciju",
        ],
        correctIndexes: [0, 1, 2],
        objasnjenje: "Mekteb je mjesto učenja, prijateljstva i uzajamne podrške — nije samo prepisivanje.",
        retryPrompt: "Traži tri odgovora koji opisuju zajednicu, a ne samo školski zadatak.",
        tezina: 2,
      },
      {
        key: "n1-mekteb-primjena",
        sourceQuestion: "Što je mekteb prema tekstu lekcije?",
        didaktickiTip: "primjena",
        vrsta: "single",
        pitanje: "Novi učenik ne razumije zadatak i stid ga je pitati. Šta najbolje pokazuje duh mekteba?",
        opcije: [
          "Ponuditi mu pomoć i ohrabriti ga",
          "Reći mu da se sam snađe",
          "Sakriti svoju svesku",
          "Nasmijati se njegovoj grešci",
        ],
        correctIndex: 0,
        objasnjenje: "Uzajamna podrška znači primijetiti kome treba pomoć i pristupiti mu lijepo.",
        retryPrompt: "Zamisli kako bi ti želio/željela da se drugi ponašaju kada nešto ne razumiješ.",
        tezina: 2,
      },
      {
        key: "n1-znanje-redoslijed",
        sourceQuestion: "Prema hadisu, što je obaveza svakog muslimana?",
        didaktickiTip: "redoslijed",
        vrsta: "reorder",
        pitanje: "Poredaj put od učenja do dobrog djela.",
        opcije: ["Primijenim ono što sam naučio/la", "Saslušam i učim", "Razumijem poruku", "Pomognem drugome"],
        correctOrder: [3, 1, 2, 4],
        objasnjenje: "Znanje počinje učenjem, raste razumijevanjem i postaje vrijedno kada ga primijenimo i dijelimo.",
        retryPrompt: "Prvo pronađi početak: možemo li primijeniti nešto prije nego što to naučimo i razumijemo?",
        tezina: 2,
      },
      {
        key: "n1-ucenje-cijeli-zivot",
        sourceQuestion: "Koliko dugo traje učenje o islamu?",
        didaktickiTip: "primjena",
        vrsta: "single",
        pitanje: "Amar je završio mekteb i kaže: „Sada više ne trebam učiti o vjeri.” Koji odgovor je najbolji?",
        opcije: [
          "Učenje o vjeri traje cijeli život",
          "Uči se samo dok dobijamo ocjene",
          "Uči se samo jednu godinu",
          "Uči se samo pred ispit",
        ],
        correctIndex: 0,
        objasnjenje: "Mekteb postavlja temelj, a musliman znanje traži i nadograđuje tokom cijelog života.",
        retryPrompt: "Razmisli završava li potreba za dobrim odlukama kada završi školska godina.",
        tezina: 1,
      },
    ],
  },
  {
    nivo: 2,
    lessonSlug: "namaz",
    quizSlug: "ucimo-namaz",
    quizTitle: "Učimo kroz pitanja: Namaz",
    kategorija: "ibadet",
    tagovi: ["namaz"],
    questions: [
      {
        key: "n2-pet-namaza",
        sourceQuestion: "Koliko namaza je musliman dužan da klanja u toku 24 sata?",
        didaktickiTip: "prisjecanje",
        vrsta: "single",
        pitanje: "Koliko je obaveznih namaza raspoređeno kroz jedan dan i noć?",
        opcije: ["Tri", "Četiri", "Pet", "Šest"],
        correctIndex: 2,
        objasnjenje: "Muslimani tokom dana i noći klanjaju pet obaveznih namaza.",
        retryPrompt: "Prisjeti se niza: Sabah, Podne, Ikindija, Akšam i Jacija.",
        tezina: 1,
      },
      {
        key: "n2-sabah-primjena",
        sourceQuestion: "Koji namaz se klanja od zore do izlaska Sunca?",
        didaktickiTip: "primjena",
        vrsta: "single",
        pitanje: "Zora je nastupila, a Sunce još nije izašlo. Vrijeme je za koji namaz?",
        opcije: ["Sabah", "Podne", "Ikindiju", "Akšam"],
        correctIndex: 0,
        objasnjenje: "Vrijeme Sabah-namaza traje od nastupanja zore do izlaska Sunca.",
        retryPrompt: "Poveži riječ „zora” s namazom kojim počinje dan.",
        tezina: 1,
      },
      {
        key: "n2-obaveza-primjena",
        sourceQuestion: "Od kojeg vremena je musliman dužan obavljati namaz?",
        didaktickiTip: "primjena",
        vrsta: "single",
        pitanje: "Dijete uči klanjati prije punoljetnosti. Zašto je to korisno?",
        opcije: [
          "Da stekne naviku prije nego što namaz postane obaveza",
          "Zato što namaz poslije punoljetnosti prestaje",
          "Da bi moglo preskočiti namaz kad odraste",
          "Zato što je namaz obavezan samo djeci",
        ],
        correctIndex: 0,
        objasnjenje: "Namaz postaje obaveza punoljetnom muslimanu, a ranije vježbanje gradi sigurnost i naviku.",
        retryPrompt: "Razlikuj vrijeme vježbanja od vremena kada nastupa puna obaveza.",
        tezina: 2,
      },
      {
        key: "n2-izlazak-sunca",
        sourceQuestion: "Kada je klanjati pokuđeno (mekruh) za vrijeme izlaska Sunca?",
        didaktickiTip: "razlikovanje",
        vrsta: "truefalse",
        pitanje: "Tačno ili netačno: trenutak izlaska Sunca je redovno vrijeme za klanjanje namaza.",
        opcije: ["Da", "Ne"],
        correctIndex: 1,
        objasnjenje: "Sami trenutak izlaska Sunca spada u vremena kada je klanjanje pokuđeno.",
        retryPrompt: "Ne pitamo za vrijeme prije izlaska Sunca, nego baš za trenutak kada Sunce izlazi.",
        tezina: 2,
      },
      {
        key: "n2-namazi-redoslijed",
        sourceQuestion: "Koliko namaza je musliman dužan da klanja u toku 24 sata?",
        didaktickiTip: "redoslijed",
        vrsta: "reorder",
        pitanje: "Poredaj pet dnevnih namaza od početka dana prema noći.",
        opcije: ["Akšam", "Sabah", "Jacija", "Podne", "Ikindija"],
        correctOrder: [4, 1, 5, 2, 3],
        objasnjenje: "Redoslijed je: Sabah, Podne, Ikindija, Akšam, pa Jacija.",
        retryPrompt: "Prvo pronađi namaz u zoru, zatim podnevni, pa nastavi prema večeri.",
        tezina: 2,
      },
    ],
  },
  {
    nivo: 3,
    lessonSlug: "kelimei-sehadet",
    quizSlug: "ucimo-kelimei-sehadet",
    quizTitle: "Učimo kroz pitanja: Kelimei-šehadet",
    kategorija: "akaid",
    tagovi: ["allah", "poslanici"],
    questions: [
      {
        key: "n3-sehadet-dijelovi",
        sourceQuestion: "Koliko dijelova ima Kelimei-šehadet?",
        didaktickiTip: "prisjecanje",
        vrsta: "single",
        pitanje: "Koliko temeljnih svjedočenja sadrži Kelimei-šehadet?",
        opcije: ["Jedno", "Dva", "Tri", "Četiri"],
        correctIndex: 1,
        objasnjenje: "Kelimei-šehadet sadrži dva svjedočenja: o Allahovoj jednoći i Muhammedovom, a.s., poslanstvu.",
        retryPrompt: "Prisjeti se da šehadet govori o Allahu i o Njegovom Poslaniku.",
        tezina: 1,
      },
      {
        key: "n3-sehadet-razlikovanje",
        sourceQuestion: "Što znači prvi dio šehadeta?",
        didaktickiTip: "razlikovanje",
        vrsta: "multiple",
        pitanje: "Koje dvije tvrdnje zajedno prenose značenje Kelimei-šehadeta?",
        opcije: [
          "Nema drugog boga osim Allaha",
          "Muhammed, a.s., Allahov je poslanik",
          "Svaki poslanik je božanstvo",
          "Vjera se svodi samo na običaj",
        ],
        correctIndexes: [0, 1],
        objasnjenje: "Prvo svjedočimo Allahovu jednoću, a zatim da je Muhammed, a.s., Njegov poslanik.",
        retryPrompt: "Odaberi jednu tvrdnju o Allahu i jednu o Muhammedu, a.s.",
        tezina: 2,
      },
      {
        key: "n3-prvi-dio",
        sourceQuestion: "Što znači prvi dio šehadeta?",
        didaktickiTip: "razlikovanje",
        vrsta: "single",
        pitanje: "Koja tvrdnja pripada prvom dijelu šehadeta?",
        opcije: [
          "Nema drugog boga osim Allaha",
          "Muhammed, a.s., Allahov je poslanik",
          "Namaz ima pet dnevnih vremena",
          "Post je u mjesecu ramazanu",
        ],
        correctIndex: 0,
        objasnjenje: "Prvi dio potvrđuje da samo Allah zaslužuje da bude obožavan.",
        retryPrompt: "Prvi dio govori o Stvoritelju; drugi govori o Poslaniku.",
        tezina: 1,
      },
      {
        key: "n3-poslanik-primjena",
        sourceQuestion: "Koja je naša obaveza prema Muhammadu, alejhis-selam?",
        didaktickiTip: "primjena",
        vrsta: "single",
        pitanje: "Koji postupak najbolje pokazuje da prihvatamo Muhammeda, a.s., kao Allahovog poslanika?",
        opcije: [
          "Učimo njegove upute i trudimo se slijediti ih",
          "Biramo upute samo kada su nam lake",
          "Spominjemo ga, ali zanemarujemo njegove upute",
          "Smatramo da njegov primjer nije važan",
        ],
        correctIndex: 0,
        objasnjenje: "Svjedočenje poslanstva pokazujemo učenjem, poštovanjem i slijeđenjem vjerodostojnih uputa Poslanika, a.s.",
        retryPrompt: "Traži odgovor u kojem se riječi šehadeta pretvaraju u stvarno ponašanje.",
        tezina: 2,
      },
      {
        key: "n3-sehadet-redoslijed",
        sourceQuestion: "Koliko dijelova ima Kelimei-šehadet?",
        didaktickiTip: "redoslijed",
        vrsta: "reorder",
        pitanje: "Poredaj dva svjedočenja onako kako dolaze u Kelimei-šehadetu.",
        opcije: [
          "Svjedočim da je Muhammed, a.s., Allahov poslanik",
          "Svjedočim da nema drugog boga osim Allaha",
        ],
        correctOrder: [2, 1],
        objasnjenje: "Najprije svjedočimo Allahovu jednoću, a zatim Muhammedovo, a.s., poslanstvo.",
        retryPrompt: "Počni svjedočenjem o Allahovoj jednoći.",
        tezina: 2,
      },
    ],
  },
];

const INTRO_SOURCE_QUESTIONS: Record<string, LekcijaKvizPitanje[]> = {
  "uvodna-rijec-nivo-2": [
    {
      question: "Šta učenici upoznaju u drugom nivou Ilmihala?",
      options: ["Allahove poslanike i osnove vjerovanja", "Samo sportska pravila", "Samo historijske datume", "Samo arapsku gramatiku"],
      answer: "Allahove poslanike i osnove vjerovanja",
    },
    {
      question: "Šta je potrebno za uspješno učenje prema uvodnoj riječi?",
      options: ["Dobra namjera, strpljenje i lijepo druženje s knjigom", "Samo brzo čitanje", "Učenje bez pitanja", "Preskakanje teških lekcija"],
      answer: "Dobra namjera, strpljenje i lijepo druženje s knjigom",
    },
    {
      question: "Kako roditelji mogu podržati dijete u učenju?",
      options: ["Pitati ga šta je naučilo i slušati ga", "Nikada ne razgovarati o lekcijama", "Tražiti samo ocjenu", "Učiti umjesto djeteta"],
      answer: "Pitati ga šta je naučilo i slušati ga",
    },
    {
      question: "Šta Allah olakšava onome ko krene putem traženja znanja?",
      options: ["Put u Džennet", "Put bez ikakvog truda", "Samo školski odmor", "Put do imetka"],
      answer: "Put u Džennet",
    },
  ],
  "uvodna-rijec-nivo-3": [
    {
      question: "Po čemu se učenje u trećem nivou razlikuje od samog pamćenja?",
      options: ["Učenici žele vjeru bolje razumjeti", "Učenici više ne čitaju", "Učenici uče samo naslove", "Učenici preskaču pitanja"],
      answer: "Učenici žele vjeru bolje razumjeti",
    },
    {
      question: "Šta učenici dublje upoznaju u trećem nivou?",
      options: ["Značenje imanskih šartova i kratkih sura", "Samo sportske vještine", "Samo geografiju", "Samo kalendar"],
      answer: "Značenje imanskih šartova i kratkih sura",
    },
    {
      question: "Šta postaje dio naše odgovornosti kada nešto naučimo?",
      options: ["Da korisno znanje prenosimo drugima", "Da znanje zadržimo samo za sebe", "Da prestanemo postavljati pitanja", "Da zaboravimo prethodne lekcije"],
      answer: "Da korisno znanje prenosimo drugima",
    },
    {
      question: "Kako roditelji mogu pomoći učeniku da vidi vjeru kao način života?",
      options: ["Razgovorom i primjerima iz vlastitog života", "Izbjegavanjem svih pitanja", "Samo provjerom ocjena", "Učenjem odgovora napamet umjesto djeteta"],
      answer: "Razgovorom i primjerima iz vlastitog života",
    },
  ],
};

interface SourceLesson {
  nivo: number;
  slug: string;
  naslov: string;
  predmet: string | null;
  kvizPitanja: unknown;
}

function normalizeSourceQuestions(value: unknown): LekcijaKvizPitanje[] {
  if (!Array.isArray(value)) return [];
  const normalized: LekcijaKvizPitanje[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Record<string, unknown>;
    if (typeof source["question"] === "string"
      && Array.isArray(source["options"])
      && source["options"].every((option) => typeof option === "string")
      && typeof source["answer"] === "string") {
      normalized.push({
        question: source["question"],
        options: source["options"] as string[],
        answer: source["answer"],
      });
      continue;
    }
    if (typeof source["pitanje"] === "string"
      && Array.isArray(source["odgovori"])
      && source["odgovori"].every((option) => typeof option === "string")
      && Number.isInteger(source["tacanOdgovor"])) {
      const options = source["odgovori"] as string[];
      const answer = options[source["tacanOdgovor"] as number];
      if (answer !== undefined) {
        normalized.push({ question: source["pitanje"], options, answer });
      }
    }
  }
  return normalized;
}

function categoryForLesson(predmet: string | null): { kategorija: KvizKategorija; tagovi: string[] } {
  if (predmet === "Vjerovanje") return { kategorija: "akaid", tagovi: ["allah"] };
  if (predmet === "Kiraet") return { kategorija: "akaid", tagovi: ["kuran"] };
  if (predmet === "Ibadet i praksa") return { kategorija: "ibadet", tagovi: [] };
  if (predmet === "Historija islama") return { kategorija: "historija", tagovi: [] };
  return { kategorija: "ahlak", tagovi: ["ponasanje"] };
}

function inferDidaktickiTip(question: string): DidaktickiTip {
  const normalized = question.toLocaleLowerCase("bs");
  if (/(poredaj|redoslijed|šta dolazi prvo|sta dolazi prvo)/.test(normalized)) return "redoslijed";
  if (/(kako|zašto|zasto|u kojoj situaciji|kada trebamo|šta treba|sta treba)/.test(normalized)) return "primjena";
  if (/(koji|koja|koje|prepoznaj|razlik)/.test(normalized)) return "razlikovanje";
  return "prisjecanje";
}

function buildQuestionVersion(
  lesson: SourceLesson,
  source: LekcijaKvizPitanje,
  index: number,
): IlmihalPilotQuestion {
  // Prvo pitanje u svakoj lekciji namjerno je sidro za prisjećanje; ostala
  // dobijaju precizniji tip prema formulaciji izvornog pitanja.
  const didaktickiTip = index === 0 ? "prisjecanje" : inferDidaktickiTip(source.question);
  const prefix: Record<DidaktickiTip, string> = {
    prisjecanje: `Prisjeti se lekcije „${lesson.naslov}”`,
    razlikovanje: `Prepoznaj tačan odgovor iz lekcije „${lesson.naslov}”`,
    primjena: `Primijeni ono što si naučio/la u lekciji „${lesson.naslov}”`,
    redoslijed: `Prisjeti se pravilnog redoslijeda iz lekcije „${lesson.naslov}”`,
  };
  return {
    key: `${lesson.slug}-q${index + 1}`,
    sourceQuestion: source.question.trim(),
    didaktickiTip,
    vrsta: "single",
    pitanje: `${prefix[didaktickiTip]}: ${source.question.trim()}`,
    opcije: source.options.map((option) => option.trim()),
    correctIndex: source.options.findIndex((option) => option.trim() === source.answer.trim()),
    objasnjenje: `Tačan odgovor je „${source.answer.trim()}”. Obrazloženje i kontekst nalaze se u lekciji „${lesson.naslov}”.`,
    retryPrompt: `Ponovo se prisjeti sadržaja lekcije „${lesson.naslov}” i potraži odgovor koji direktno odgovara na izvorno pitanje.`,
    tezina: didaktickiTip === "prisjecanje" ? 1 : 2,
  };
}

export function buildExpandedIlmihalPilots(lessons: SourceLesson[]): IlmihalPilotLesson[] {
  const manuallyAuthoredSlugs = new Set(ILMIHAL_LEARNING_PILOTS.map((pilot) => pilot.lessonSlug));
  const expanded = lessons
    .filter((lesson) => !manuallyAuthoredSlugs.has(lesson.slug))
    .map((lesson) => {
      const normalizedSources = normalizeSourceQuestions(lesson.kvizPitanja);
      const sources = normalizedSources.length > 0
        ? normalizedSources
        : INTRO_SOURCE_QUESTIONS[lesson.slug] ?? [];
      const { kategorija, tagovi } = categoryForLesson(lesson.predmet);
      return {
        nivo: lesson.nivo as 1 | 2 | 3,
        lessonSlug: lesson.slug,
        quizSlug: `ucimo-${lesson.slug}`.slice(0, 100),
        quizTitle: `Učimo kroz pitanja: ${lesson.naslov}`,
        kategorija,
        tagovi,
        questions: sources.map((source, index) => buildQuestionVersion(lesson, source, index)),
      };
    })
    .filter((pilot) => pilot.questions.length > 0);
  const coveredSlugs = new Set([...manuallyAuthoredSlugs, ...expanded.map((pilot) => pilot.lessonSlug)]);
  const missing = lessons.filter((lesson) => !coveredSlugs.has(lesson.slug)).map((lesson) => lesson.slug);
  if (missing.length > 0) {
    throw new Error(`Objavljene Ilmihal lekcije bez valjanih izvornih pitanja: ${missing.join(", ")}`);
  }
  return expanded;
}

export function validateIlmihalPilots(pilots: IlmihalPilotLesson[]): void {
  const lessonSlugs = new Set<string>();
  const quizSlugs = new Set<string>();
  const questionKeys = new Set<string>();
  for (const pilot of pilots) {
    if (lessonSlugs.has(pilot.lessonSlug)) throw new Error(`Dupla lekcija: ${pilot.lessonSlug}`);
    if (quizSlugs.has(pilot.quizSlug)) throw new Error(`Dupli kviz: ${pilot.quizSlug}`);
    lessonSlugs.add(pilot.lessonSlug);
    quizSlugs.add(pilot.quizSlug);
    if (pilot.questions.length === 0) throw new Error(`Lekcija bez pitanja: ${pilot.lessonSlug}`);
    for (const question of pilot.questions) {
      if (questionKeys.has(question.key)) throw new Error(`Dupli ključ pitanja: ${question.key}`);
      questionKeys.add(question.key);
      if (!question.sourceQuestion.trim() || !question.objasnjenje.trim() || !question.retryPrompt.trim()) {
        throw new Error(`Nepotpuni pedagoški podaci: ${question.key}`);
      }
      if (question.opcije.length < 2 || question.opcije.some((option) => !option.trim())) {
        throw new Error(`Neispravne opcije: ${question.key}`);
      }
      if (question.vrsta === "multiple") {
        if (!question.correctIndexes || question.correctIndexes.length < 2
          || question.correctIndexes.some((index) => index < 0 || index >= question.opcije.length)) {
          throw new Error(`Neispravni višestruki odgovori: ${question.key}`);
        }
      } else if (question.vrsta === "reorder") {
        const order = question.correctOrder ?? [];
        const sorted = [...order].sort((a, b) => a - b);
        if (order.length !== question.opcije.length || sorted.some((value, index) => value !== index + 1)) {
          throw new Error(`Neispravan redoslijed: ${question.key}`);
        }
      } else if (question.correctIndex == null
        || question.correctIndex < 0
        || question.correctIndex >= question.opcije.length) {
        throw new Error(`Neispravan tačan odgovor: ${question.key}`);
      }
    }
  }
}

function questionMeta(question: IlmihalPilotQuestion): PitanjeMeta {
  return {
    didaktickiTip: question.didaktickiTip,
    retryMode: "immediate",
    retryPrompt: question.retryPrompt,
    sourceQuestion: question.sourceQuestion,
    pilotKey: question.key,
  };
}

export async function seedIlmihalLearningPilot(opts: { silent?: boolean } = {}) {
  const log = opts.silent ? () => {} : (...args: unknown[]) => console.log(...args);
  let lessonsSeeded = 0;
  let questionsUpserted = 0;

  const sourceLessons = await db.select({
    nivo: ilmihalLekcijeTable.nivo,
    slug: ilmihalLekcijeTable.slug,
    naslov: ilmihalLekcijeTable.naslov,
    predmet: ilmihalLekcijeTable.predmet,
    kvizPitanja: ilmihalLekcijeTable.kvizPitanja,
  }).from(ilmihalLekcijeTable)
    .where(eq(ilmihalLekcijeTable.isPublished, true))
    .orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed), asc(ilmihalLekcijeTable.id));
  const pilots = [...ILMIHAL_LEARNING_PILOTS, ...buildExpandedIlmihalPilots(sourceLessons)];
  validateIlmihalPilots(pilots);

  for (const pilot of pilots) {
    const [lesson] = await db
      .select({ id: ilmihalLekcijeTable.id, nivo: ilmihalLekcijeTable.nivo })
      .from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.slug, pilot.lessonSlug))
      .limit(1);
    if (!lesson) {
      log(`[ilmihal-pilot] Lekcija "${pilot.lessonSlug}" nije pronađena; preskačem.`);
      continue;
    }

    const questionsInPilot = await db.transaction(async (tx) => {
      const quizSeedKey = `ilmihal-learning-quiz:${pilot.quizSlug}`;
      const [existingQuiz] = await tx
        .select({ id: kvizoviTable.id, seedKey: kvizoviTable.seedKey })
        .from(kvizoviTable)
        .where(sql`
          ${kvizoviTable.seedKey} = ${quizSeedKey}
          OR (
            ${kvizoviTable.seedKey} IS NULL
            AND ${kvizoviTable.slug} = ${pilot.quizSlug}
            AND ${kvizoviTable.variant} = 'learning'
            AND ${kvizoviTable.naslov} = ${pilot.quizTitle}
          )
        `)
        .limit(1);
      let quiz = existingQuiz;
      if (!quiz) {
        [quiz] = await tx.insert(kvizoviTable).values({
          seedKey: quizSeedKey,
          nivo: pilot.nivo,
          slug: pilot.quizSlug,
          naslov: pilot.quizTitle,
          modul: "ilmihal",
          variant: "learning",
          pitanja: [],
          kategorija: pilot.kategorija,
          tagovi: pilot.tagovi,
          lekcijaId: lesson.id,
          opis: "Pitanja za prisjećanje, razlikovanje, primjenu i redoslijed, uz objašnjen ponovni pokušaj.",
          pitanjaPoSesiji: pilot.questions.length,
          // Objavljivanje je zasebna urednička odluka. Sva nova pitanja prvo
          // moraju biti odobrena, a zatim admin može objaviti kviz.
          isPublished: false,
        })
        .returning({ id: kvizoviTable.id, seedKey: kvizoviTable.seedKey });
      } else if (!quiz.seedKey) {
        await tx.update(kvizoviTable)
          .set({ seedKey: quizSeedKey })
          .where(eq(kvizoviTable.id, quiz.id));
      }
      if (!quiz) throw new Error(`Nije moguće kreirati pilot kviz "${pilot.quizSlug}".`);

      const questionIds: number[] = [];
      for (const question of pilot.questions) {
        const meta = questionMeta(question);
        const seedKey = `ilmihal-learning:${question.key}`;
        const [existing] = await tx
        .select({ id: pitanjaBankaTable.id, seedKey: pitanjaBankaTable.seedKey, meta: pitanjaBankaTable.meta })
        .from(pitanjaBankaTable)
        .where(sql`
          ${pitanjaBankaTable.seedKey} = ${seedKey}
          OR (
            ${pitanjaBankaTable.seedKey} IS NULL
            AND ${pitanjaBankaTable.meta}->>'pilotKey' = ${question.key}
          )
        `)
        .limit(1);

        const values = {
          seedKey,
          pitanje: question.pitanje,
          opcije: question.opcije,
          correctIndex: question.correctIndex ?? question.correctIndexes?.[0] ?? 0,
          correctIndexes: question.correctIndexes ?? null,
          correctOrder: question.correctOrder ?? null,
          meta,
          objasnjenje: question.objasnjenje,
          slika: null,
          vrsta: question.vrsta,
          kategorija: pilot.kategorija,
          tagovi: pilot.tagovi,
          lekcijaId: lesson.id,
          urednickiStatus: "na_cekanju" as const,
          tezina: question.tezina,
          updatedAt: new Date(),
        };

        if (existing) {
          // Jednokratni prijelaz sa prve verzije pilota (ključ je bio u meta
          // JSON-u) na seed_key. Ostala polja ostaju pod kontrolom admina.
          const existingMeta = (existing.meta ?? {}) as PitanjeMeta;
          if (!existing.seedKey || !existingMeta.pilotKey) {
            await tx.update(pitanjaBankaTable)
              .set({
                ...(!existing.seedKey ? { seedKey } : {}),
                ...(!existingMeta.pilotKey ? { meta: { ...existingMeta, pilotKey: question.key } } : {}),
              })
              .where(eq(pitanjaBankaTable.id, existing.id));
          }
          questionIds.push(existing.id);
        } else {
          const [created] = await tx
            .insert(pitanjaBankaTable)
            .values(values)
            .returning({ id: pitanjaBankaTable.id });
          questionIds.push(created.id);
        }
      }

      await tx.insert(kvizPitanjaTable).values(
        questionIds.map((pitanjeId, redoslijed) => ({ kvizId: quiz.id, pitanjeId, redoslijed })),
      ).onConflictDoNothing();
      return questionIds.length;
    });
    questionsUpserted += questionsInPilot;
    lessonsSeeded++;
  }

  log(`[ilmihal-pilot] ${lessonsSeeded} lekcije, ${questionsUpserted} pitanja.`);
  return { lessonsSeeded, questionsUpserted };
}

const isCli = typeof process !== "undefined"
  && Array.isArray(process.argv)
  && process.argv[1]?.endsWith("/seed-ilmihal-learning-pilot.ts");
if (isCli) {
  seedIlmihalLearningPilot()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("[ilmihal-pilot] GREŠKA:", error);
      process.exit(1);
    });
}