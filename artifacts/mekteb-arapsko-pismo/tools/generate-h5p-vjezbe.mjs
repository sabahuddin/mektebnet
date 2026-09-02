#!/usr/bin/env node
// Gradi kompletne .h5p pakete spremne za upload u Mekteb.
//
// Za razliku od šablona u public/h5p-templates (content-only, traže prolaz
// kroz Lumi), ovi paketi nose H5P biblioteke u sebi, pa prolaze validaciju
// u admin.ts:validateH5PPackage i odmah rade u h5p-standalone playeru.
//
// Izvori biblioteka — ništa se ne preuzima s interneta pri gradnji:
//   • attached_assets/Jacija-namaz_*.h5p  → MultiChoice, TrueFalse, Blanks,
//     DragText, MarkTheWords, QuestionSet i njihove zajedničke zavisnosti
//   • tools/h5p-lib/                      → SingleChoiceSet, Flashcards,
//     Dialogcards, Components, Audio (klonirane s github.com/h5p, a
//     Components i Dialogcards su i sagrađene jer se dist/ ne commita)
//
// Zavisnosti se računaju TRANZITIVNO iz library.json svake biblioteke.
// Bez toga paket prođe validaciju (ona gleda samo deklarisane zavisnosti)
// ali padne na 404 u playeru — npr. QuestionSet povlači H5P.Video, a
// DragText povlači jQuery.ui.
//
// Pokretanje:  node artifacts/mekteb-arapsko-pismo/tools/generate-h5p-vjezbe.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { VJEZBE } from "./h5p-vjezbe-sadrzaj.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const IZVORNI_PAKET = path.join(REPO, "attached_assets/Jacija-namaz_1779307241332.h5p");
const LIB_DIR = path.join(__dirname, "h5p-lib");
const OUT_DIR = path.join(__dirname, "vjezbe-out");

// ── zajednički tekstovi (bosanski) ───────────────────────────────────────
const A11Y = {
  a11yCheck: "Provjeri odgovore. Odgovor će biti prikazan kao tačan, netačan ili neodgovoren",
  a11yShowSolution: "Prikaži rješenje. Tačan odgovor će biti označen.",
  a11yRetry: "Ponovi zadatak. Odgovori se poništavaju i kreće se ispočetka.",
};
const CONFIRM_CHECK = { header: "Završiti?", body: "Jesi li siguran/na da želiš završiti?", cancelLabel: "Odustani", confirmLabel: "Završi" };
const CONFIRM_RETRY = { header: "Ponoviti?", body: "Jesi li siguran/na da želiš ponoviti?", cancelLabel: "Odustani", confirmLabel: "Ponovi" };
const POVRATNA = [
  { from: 0, to: 40, feedback: "Vrijedi ponoviti lekciju, pa opet pokušati." },
  { from: 41, to: 69, feedback: "Dobar početak — još malo pa odlično." },
  { from: 70, to: 89, feedback: "Vrlo dobro! Skoro sve tačno." },
  { from: 90, to: 100, feedback: "Odlično! Razumiješ ovu lekciju." },
];

// ── pitanja unutar Question Seta ─────────────────────────────────────────
const mc = ({ pitanje, odgovori }) => ({
  library: "H5P.MultiChoice 1.16",
  params: {
    media: { disableImageZooming: false },
    question: `<p>${pitanje}</p>`,
    answers: odgovori.map(([text, correct]) => ({
      correct: !!correct, text: `<div>${text}</div>`,
      tipsAndFeedback: { tip: "", chosenFeedback: "", notChosenFeedback: "" },
    })),
    overallFeedback: [{ from: 0, to: 100 }],
    behaviour: {
      enableRetry: true, enableSolutionsButton: true, enableCheckButton: true,
      type: "auto", singlePoint: false, randomAnswers: true,
      showSolutionsRequiresInput: true, confirmCheckDialog: false,
      confirmRetryDialog: false, autoCheck: false, passPercentage: 100, showScorePoints: true,
    },
    UI: {
      checkAnswerButton: "Provjeri", submitAnswerButton: "Pošalji",
      showSolutionButton: "Prikaži rješenje", tryAgainButton: "Ponovi",
      tipsLabel: "Prikaži savjet", scoreBarLabel: "Osvojio/la si :num od :total bodova",
      tipAvailable: "Savjet dostupan", feedbackAvailable: "Povratna informacija dostupna",
      readFeedback: "Pročitaj povratnu informaciju", wrongAnswer: "Netačan odgovor",
      correctAnswer: "Tačan odgovor", shouldCheck: "Trebalo je označiti",
      shouldNotCheck: "Nije trebalo označiti", noInput: "Odgovori prije nego pogledaš rješenje",
      ...A11Y,
    },
    confirmCheck: CONFIRM_CHECK, confirmRetry: CONFIRM_RETRY,
  },
});

const tf = ({ pitanje, tacno }) => ({
  library: "H5P.TrueFalse 1.8",
  params: {
    media: { disableImageZooming: false },
    question: `<p>${pitanje}</p>`,
    correct: tacno ? "true" : "false",
    behaviour: { enableRetry: true, enableSolutionsButton: true, enableCheckButton: true, confirmCheckDialog: false, confirmRetryDialog: false, autoCheck: false },
    l10n: {
      trueText: "Tačno", falseText: "Netačno",
      score: "Osvojio/la si @score od @total bodova",
      checkAnswer: "Provjeri", submitAnswer: "Pošalji",
      showSolutionButton: "Prikaži rješenje", tryAgain: "Ponovi",
      wrongAnswerMessage: "Netačan odgovor", correctAnswerMessage: "Tačan odgovor",
      scoreBarLabel: "Osvojio/la si :num od :total bodova", ...A11Y,
    },
    confirmCheck: CONFIRM_CHECK, confirmRetry: CONFIRM_RETRY,
  },
});

const blanks = ({ uputa, tekst }) => ({
  library: "H5P.Blanks 1.14",
  params: {
    media: { disableImageZooming: false },
    text: `<p>${uputa}</p>`, questions: [`<p>${tekst}</p>`],
    overallFeedback: [{ from: 0, to: 100 }],
    showSolutions: "Prikaži rješenje", tryAgain: "Ponovi", checkAnswer: "Provjeri",
    submitAnswer: "Pošalji", notFilledOut: "Popuni sva prazna polja da bi vidio/la rješenje",
    answerIsCorrect: "':ans' je tačno", answerIsWrong: "':ans' je netačno",
    answeredCorrectly: "Tačan odgovor", answeredIncorrectly: "Netačan odgovor",
    solutionLabel: "Tačan odgovor:", inputLabel: "Praznina @num od @total",
    inputHasTipLabel: "Savjet dostupan", tipLabel: "Savjet",
    behaviour: {
      enableRetry: true, enableSolutionsButton: true, enableCheckButton: true,
      autoCheck: false, caseSensitive: false, showSolutionsRequiresInput: true,
      separateLines: false, confirmCheckDialog: false, confirmRetryDialog: false,
      acceptSpellingErrors: true,
    },
    scoreBarLabel: "Osvojio/la si :num od :total bodova", ...A11Y,
    a11yCheckingModeHeader: "Način provjere",
    confirmCheck: CONFIRM_CHECK, confirmRetry: CONFIRM_RETRY,
  },
});

const drag = ({ uputa, tekst, ometaci }) => ({
  library: "H5P.DragText 1.10",
  params: {
    media: { disableImageZooming: false },
    taskDescription: `<p>${uputa}</p>`, textField: tekst, distractors: ometaci || "",
    overallFeedback: [{ from: 0, to: 100 }],
    checkAnswer: "Provjeri", submitAnswer: "Pošalji", tryAgain: "Ponovi",
    showSolution: "Prikaži rješenje", dropZoneIndex: "Polje @index.",
    empty: "Polje @index je prazno.", contains: "Polje @index sadrži @draggable.",
    ariaDraggableIndex: "@index od @count riječi za prevlačenje.",
    tipLabel: "Prikaži savjet", correctText: "Tačno!", incorrectText: "Netačno!",
    resetDropTitle: "Vratiti riječ?", resetDropDescription: "Želiš li vratiti ovu riječ?",
    grabbed: "Riječ je uzeta.", cancelledDragging: "Prevlačenje otkazano.",
    correctAnswer: "Tačan odgovor:", feedbackHeader: "Povratna informacija",
    behaviour: { enableRetry: true, enableSolutionsButton: true, enableCheckButton: true, instantFeedback: false },
    scoreBarLabel: "Osvojio/la si :num od :total bodova", ...A11Y,
  },
});

// Mark the Words: markirani tekst ide u `textField` (semantics.json), NE u
// `taskDescription` — jedini primjer u attached_assets ima ga na pogrešnom
// mjestu, pa se tamo ne prikazuje ništa za označavanje.
const mark = ({ uputa, tekst }) => ({
  library: "H5P.MarkTheWords 1.11",
  params: {
    media: { disableImageZooming: false },
    taskDescription: `<p>${uputa}</p>`, textField: `<p>${tekst}</p>`,
    overallFeedback: [{ from: 0, to: 100 }],
    checkAnswerButton: "Provjeri", submitAnswerButton: "Pošalji",
    tryAgainButton: "Ponovi", showSolutionButton: "Prikaži rješenje",
    behaviour: { enableRetry: true, enableSolutionsButton: true, enableCheckButton: true, showScorePoints: true },
    correctAnswer: "Tačno!", incorrectAnswer: "Netačno!", missedAnswer: "Ovo je trebalo označiti!",
    displaySolutionDescription: "Zadatak je dopunjen rješenjem.",
    scoreBarLabel: "Osvojio/la si :num od :total bodova",
    a11yFullTextLabel: "Cijeli tekst za čitanje",
    a11yClickableTextLabel: "Tekst u kojem se riječi mogu označiti.",
    a11ySolutionModeHeader: "Prikaz rješenja", a11yCheckingHeader: "Način provjere", ...A11Y,
  },
});

const GRADITELJI = { mc, tf, blanks, drag, mark };

// ── omotači po tipu vježbe ───────────────────────────────────────────────
function questionSet(v) {
  return {
    introPage: { showIntroPage: true, startButtonText: "Počni", title: v.naslov, introduction: `<p>${v.uvod}</p>` },
    progressType: "dots", passPercentage: 70,
    questions: v.pitanja.map((p) => GRADITELJI[p.tip](p)),
    disableBackwardsNavigation: false, randomQuestions: !!v.nasumicno, poolSize: 0,
    endGame: {
      showResultPage: true, showSolutionButton: true, showRetryButton: true,
      noResultMessage: "Završeno", message: "Tvoj rezultat:",
      scoreBarLabel: "Osvojio/la si @finals od @totals bodova",
      overallFeedback: POVRATNA, solutionButtonText: "Prikaži rješenje",
      retryButtonText: "Pokušaj ponovo", finishButtonText: "Završi",
      submitButtonText: "Pošalji", showAnimations: false, skippable: false, skipButtonText: "Preskoči",
    },
    override: { checkButton: true },
    texts: {
      prevButton: "Nazad", nextButton: "Dalje", finishButton: "Kraj", submitButton: "Pošalji",
      textualProgress: "Pitanje @current od @total", jumpToQuestion: "Pitanje %d od %total",
      questionLabel: "Pitanje", readSpeakerProgress: "Pitanje @current od @total",
      unansweredText: "Neodgovoreno", answeredText: "Odgovoreno",
      currentQuestionText: "Trenutno pitanje", navigationLabel: "Pitanja",
      questionSetInstruction: "Odaberi pitanje",
    },
  };
}

// Single Choice Set: prvi odgovor u nizu je tačan (H5P konvencija).
function singleChoiceSet(v) {
  return {
    choices: v.pitanja.map((p) => ({ question: `<p>${p.pitanje}</p>`, answers: p.odgovori.map((a) => `<p>${a}</p>`) })),
    behaviour: { timeoutCorrect: 2000, timeoutWrong: 3000, soundEffectsEnabled: false, enableRetry: true, enableSolutionsButton: true, passPercentage: 70, autoContinue: true },
    overallFeedback: POVRATNA,
    l10n: {
      nextButtonLabel: "Sljedeće pitanje", showSolutionButtonLabel: "Prikaži rješenje",
      retryButtonLabel: "Pokušaj ponovo", solutionViewTitle: "Rješenja",
      correctText: "Tačno!", incorrectText: "Netačno!",
      muteButtonLabel: "Isključi zvuk", closeButtonLabel: "Zatvori",
      slideOfTotal: "Pitanje :num od :total", scoreBarLabel: "Osvojio/la si :num od :total bodova",
      solutionListQuestionNumber: "Pitanje :num", resultSlideTitle: "Tvoj rezultat:",
      shouldSelect: "Trebalo je odabrati", shouldNotSelect: "Nije trebalo odabrati", ...A11Y,
    },
  };
}

// Dialog Cards u načinu „repetition" — kartice koje dijete ne zna vraćaju se
// češće. To je H5P-ov ugrađeni oblik ponavljanja u razmacima.
function dialogCards(v) {
  return {
    title: v.naslov, mode: "repetition", description: `<p>${v.uvod}</p>`,
    dialogs: v.kartice.map((k) => ({ text: `<p>${k.lice}</p>`, answer: `<p>${k.nalicje}</p>`, tips: { front: "", back: "" } })),
    behaviour: { enableRetry: true, disableBackwardsNavigation: false, scaleTextNotCard: false, randomCards: false, maxProficiency: 5, quickProgression: false },
    answer: "Okreni karticu", next: "Sljedeća", prev: "Prethodna", retry: "Počni ispočetka",
    correctAnswer: "Znao/la sam", incorrectAnswer: "Nisam znao/la",
    round: "Krug @round", cardsLeft: "Preostalo kartica: @number",
    cardFrontLabel: "Prednja strana kartice", cardBackLabel: "Zadnja strana kartice",
    tipButtonLabel: "Prikaži savjet",
    audioNotSupported: "Tvoj preglednik ne podržava ovaj zvuk",
    confirmStartOver: { header: "Početi ispočetka?", body: "Sav napredak će biti izgubljen. Želiš li početi ispočetka?", cancelLabel: "Odustani", confirmLabel: "Počni ispočetka" },
    nextRound: "Nastavi na krug @round", startOver: "Počni ispočetka",
    showSummary: "Sljedeće", summary: "Sažetak", summaryCardsRight: "Kartice koje si znao/la:",
    summaryCardsWrong: "Kartice koje nisi znao/la:", summaryCardsNotShown: "Kartice koje nisu prikazane:",
    summaryOverallScore: "Ukupan rezultat", summaryCardsCompleted: "Završene kartice:",
    summaryCompletedRounds: "Završeni krugovi:", summaryAllDone: "Bravo! Savladao/la si svih @cards kartica, svaku po @max puta!",
    progressText: "Kartica @card od @total",
  };
}

// Flashcards: dijete upisuje odgovor, pa su odgovori namjerno jedna riječ.
// NAPOMENA: H5P.Flashcards 1.7.23 ignoriše vlastitu opciju `progressText` i
// tvrdo upisuje engleski "Card X / Y" (js/flashcards.js, red 550). U našoj
// kopiji biblioteke u tools/h5p-lib ta linija je zakrpljena da poštuje
// `progressText`. Zakrpa se gubi ako se biblioteka ponovo klonira.
function flashcards(v) {
  return {
    description: `<p>${v.uvod}</p>`,
    cards: v.kartice.map((k) => ({ text: k.opis, answer: k.odgovor, tip: { tip: "" } })),
    progressText: "Kartica @card od @total", next: "Sljedeća", previous: "Prethodna",
    checkAnswerText: "Provjeri", showSolutionsRequiresInput: true,
    defaultAnswerText: "Upiši odgovor", correctAnswerText: "Tačno",
    incorrectAnswerText: "Netačno", showSolutionText: "Tačan odgovor:",
    results: "Rezultat", ofCorrect: "@score od @total tačno",
    showResults: "Prikaži rezultat", answerShortText: "Odgovor:",
    retry: "Pokušaj ponovo", caseSensitive: false,
    cardAnnouncement: "Netačan odgovor. Tačan odgovor je @answer",
    pageAnnouncement: "Kartica @current od @total", cardsHeader: "Kartice",
  };
}

const OMOTACI = {
  set: { fn: questionSet, main: "H5P.QuestionSet", direktne: ["H5P.QuestionSet", "H5P.MultiChoice", "H5P.TrueFalse", "H5P.Blanks", "H5P.DragText", "H5P.MarkTheWords"] },
  scs: { fn: singleChoiceSet, main: "H5P.SingleChoiceSet", direktne: ["H5P.SingleChoiceSet"] },
  kartice: { fn: dialogCards, main: "H5P.Dialogcards", direktne: ["H5P.Dialogcards"] },
  flash: { fn: flashcards, main: "H5P.Flashcards", direktne: ["H5P.Flashcards"] },
};

// ── skupljanje biblioteka ────────────────────────────────────────────────
const srcZip = new AdmZip(IZVORNI_PAKET);
const izvori = new Map(); // machineName -> { dep, citaj(relPath), listaj() }

for (const e of srcZip.getEntries()) {
  const m = e.entryName.match(/^([^/]+)-(\d+)\.(\d+)\/library\.json$/);
  if (!m) continue;
  const [, ime, maj, min] = m;
  const folder = `${ime}-${maj}.${min}`;
  izvori.set(ime, {
    dep: { machineName: ime, majorVersion: +maj, minorVersion: +min },
    citaj: (rel) => srcZip.readAsText(`${folder}/${rel}`),
    fajlovi: () => srcZip.getEntries().filter((x) => !x.isDirectory && x.entryName.startsWith(folder + "/"))
      .map((x) => ({ name: x.entryName, data: x.getData() })),
  });
}
if (fs.existsSync(LIB_DIR)) {
  for (const folder of fs.readdirSync(LIB_DIR)) {
    const m = folder.match(/^([^/]+)-(\d+)\.(\d+)$/);
    if (!m) continue;
    const [, ime, maj, min] = m;
    const baza = path.join(LIB_DIR, folder);
    izvori.set(ime, {
      dep: { machineName: ime, majorVersion: +maj, minorVersion: +min },
      citaj: (rel) => (fs.existsSync(path.join(baza, rel)) ? fs.readFileSync(path.join(baza, rel), "utf8") : null),
      fajlovi: () => {
        const out = [];
        (function hodaj(d) {
          for (const n of fs.readdirSync(d)) {
            const p = path.join(d, n);
            if (fs.statSync(p).isDirectory()) hodaj(p);
            else out.push({ name: `${folder}/${path.relative(baza, p).split(path.sep).join("/")}`, data: fs.readFileSync(p) });
          }
        })(baza);
        return out;
      },
    });
  }
}

function zatvorenje(direktne) {
  const potrebne = new Map(); const red = [...direktne];
  while (red.length) {
    const ime = red.shift();
    if (potrebne.has(ime)) continue;
    const izvor = izvori.get(ime);
    if (!izvor) throw new Error(`Biblioteka ${ime} nije dostupna ni u izvornom paketu ni u tools/h5p-lib`);
    potrebne.set(ime, izvor);
    const raw = izvor.citaj("library.json");
    for (const d of (raw ? JSON.parse(raw).preloadedDependencies ?? [] : [])) red.push(d.machineName);
  }
  return potrebne;
}

// ── gradnja ──────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const v of VJEZBE) {
  const omot = OMOTACI[v.tip];
  if (!omot) throw new Error(`Nepoznat tip vježbe: ${v.tip}`);
  const potrebne = zatvorenje(omot.direktne);
  const zip = new AdmZip();
  for (const izvor of potrebne.values()) for (const f of izvor.fajlovi()) zip.addFile(f.name, Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data));
  zip.addFile("h5p.json", Buffer.from(JSON.stringify({
    title: v.naslov, language: "bs", defaultLanguage: "bs",
    mainLibrary: omot.main, embedTypes: ["div"], license: "U",
    authors: [{ name: "Mekteb.net", role: "Author" }],
    preloadedDependencies: [...potrebne.values()].map((x) => x.dep),
  }, null, 2), "utf8"));
  zip.addFile("content/content.json", Buffer.from(JSON.stringify(omot.fn(v), null, 2), "utf8"));
  const out = path.join(OUT_DIR, `${v.slug}.h5p`);
  zip.writeZip(out);
  const broj = v.pitanja?.length ?? v.kartice?.length ?? 0;
  console.log(`✓ ${v.slug}.h5p — ${omot.main.replace("H5P.", "")}, ${broj} stavki, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
console.log(`\nGotovo. Fajlovi su u ${OUT_DIR}`);
