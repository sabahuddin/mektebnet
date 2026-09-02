#!/usr/bin/env node
// Gradi kompletne .h5p pakete (QuestionSet) spremne za upload u Mekteb.
//
// Za razliku od šablona u public/h5p-templates (koji su content-only i traže
// prolaz kroz Lumi), ovi paketi nose i H5P biblioteke, pa prolaze validaciju
// u admin.ts:validateH5PPackage i odmah se puštaju u h5p-standalone playeru.
//
// Biblioteke se preuzimaju iz postojećeg, provjereno ispravnog paketa
// (LIBRARY_SOURCE) — ne preuzima se ništa s interneta.
//
// Pokretanje:  node artifacts/mekteb-arapsko-pismo/tools/generate-h5p-vjezbe.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { VJEZBE } from "./h5p-vjezbe-sadrzaj.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../..");
const LIBRARY_SOURCE = path.join(REPO, "attached_assets/Jacija-namaz_1779307241332.h5p");
const OUT_DIR = path.join(REPO, "artifacts/mekteb-arapsko-pismo/tools/vjezbe-out");

// ---------- zajednički l10n blokovi (bosanski), izvučeni iz radnog paketa ----------
const L10N_TF = {
  trueText: "Tačno", falseText: "Netačno",
  score: "Osvojio/la si @score od @total bodova",
  checkAnswer: "Provjeri", submitAnswer: "Pošalji",
  showSolutionButton: "Prikaži rješenje", tryAgain: "Ponovi",
  wrongAnswerMessage: "Netačan odgovor", correctAnswerMessage: "Tačan odgovor",
  scoreBarLabel: "Osvojio/la si :num od :total bodova",
  a11yCheck: "Provjeri odgovore. Odgovor će biti prikazan kao tačan, netačan ili neodgovoren",
  a11yShowSolution: "Prikaži rješenje. Tačan odgovor će biti označen.",
  a11yRetry: "Ponovi zadatak. Odgovori se poništavaju i kreće se ispočetka.",
};
const CONFIRM_CHECK = { header: "Završiti?", body: "Jesi li siguran/na da želiš završiti?", cancelLabel: "Odustani", confirmLabel: "Završi" };
const CONFIRM_RETRY = { header: "Ponoviti?", body: "Jesi li siguran/na da želiš ponoviti?", cancelLabel: "Odustani", confirmLabel: "Ponovi" };

function multiChoice({ pitanje, odgovori }) {
  return {
    library: "H5P.MultiChoice 1.16",
    params: {
      media: { disableImageZooming: false },
      question: `<p>${pitanje}</p>`,
      answers: odgovori.map(([text, correct]) => ({
        correct: !!correct,
        text: `<div>${text}</div>`,
        tipsAndFeedback: { tip: "", chosenFeedback: "", notChosenFeedback: "" },
      })),
      overallFeedback: [{ from: 0, to: 100 }],
      behaviour: {
        enableRetry: true, enableSolutionsButton: true, enableCheckButton: true,
        type: "auto", singlePoint: false, randomAnswers: true,
        showSolutionsRequiresInput: true, confirmCheckDialog: false,
        confirmRetryDialog: false, autoCheck: false, passPercentage: 100,
        showScorePoints: true,
      },
      UI: {
        checkAnswerButton: "Provjeri", submitAnswerButton: "Pošalji",
        showSolutionButton: "Prikaži rješenje", tryAgainButton: "Ponovi",
        tipsLabel: "Prikaži savjet", scoreBarLabel: "Osvojio/la si :num od :total bodova",
        tipAvailable: "Savjet dostupan", feedbackAvailable: "Povratna informacija dostupna",
        readFeedback: "Pročitaj povratnu informaciju",
        wrongAnswer: "Netačan odgovor", correctAnswer: "Tačan odgovor",
        shouldCheck: "Trebalo je označiti", shouldNotCheck: "Nije trebalo označiti",
        noInput: "Odgovori prije nego pogledaš rješenje",
        a11yCheck: L10N_TF.a11yCheck, a11yShowSolution: L10N_TF.a11yShowSolution, a11yRetry: L10N_TF.a11yRetry,
      },
      confirmCheck: CONFIRM_CHECK, confirmRetry: CONFIRM_RETRY,
    },
    subContentId: undefined,
  };
}

function trueFalse({ pitanje, tacno }) {
  return {
    library: "H5P.TrueFalse 1.8",
    params: {
      media: { disableImageZooming: false },
      question: `<p>${pitanje}</p>`,
      correct: tacno ? "true" : "false",
      behaviour: {
        enableRetry: true, enableSolutionsButton: true, enableCheckButton: true,
        confirmCheckDialog: false, confirmRetryDialog: false, autoCheck: false,
      },
      l10n: L10N_TF,
      confirmCheck: CONFIRM_CHECK, confirmRetry: CONFIRM_RETRY,
    },
  };
}

function blanks({ uputa, tekst }) {
  return {
    library: "H5P.Blanks 1.14",
    params: {
      media: { disableImageZooming: false },
      text: `<p>${uputa}</p>`,
      questions: [`<p>${tekst}</p>`],
      overallFeedback: [{ from: 0, to: 100 }],
      showSolutions: "Prikaži rješenje", tryAgain: "Ponovi",
      checkAnswer: "Provjeri", submitAnswer: "Pošalji",
      notFilledOut: "Popuni sva prazna polja da bi vidio/la rješenje",
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
      scoreBarLabel: "Osvojio/la si :num od :total bodova",
      a11yCheck: L10N_TF.a11yCheck, a11yShowSolution: L10N_TF.a11yShowSolution, a11yRetry: L10N_TF.a11yRetry,
      a11yCheckingModeHeader: "Način provjere",
      confirmCheck: CONFIRM_CHECK, confirmRetry: CONFIRM_RETRY,
    },
  };
}

function dragText({ uputa, tekst, ometaci }) {
  return {
    library: "H5P.DragText 1.10",
    params: {
      media: { disableImageZooming: false },
      taskDescription: `<p>${uputa}</p>`,
      textField: tekst,
      distractors: ometaci || "",
      overallFeedback: [{ from: 0, to: 100 }],
      checkAnswer: "Provjeri", submitAnswer: "Pošalji", tryAgain: "Ponovi",
      showSolution: "Prikaži rješenje",
      dropZoneIndex: "Polje @index.", empty: "Polje @index je prazno.",
      contains: "Polje @index sadrži @draggable.",
      ariaDraggableIndex: "@index od @count riječi za prevlačenje.",
      tipLabel: "Prikaži savjet", correctText: "Tačno!", incorrectText: "Netačno!",
      resetDropTitle: "Vratiti riječ?", resetDropDescription: "Jesi li siguran/na da želiš vratiti ovu riječ?",
      grabbed: "Riječ je uzeta.", cancelledDragging: "Prevlačenje otkazano.",
      correctAnswer: "Tačan odgovor:", feedbackHeader: "Povratna informacija",
      behaviour: { enableRetry: true, enableSolutionsButton: true, enableCheckButton: true, instantFeedback: false },
      scoreBarLabel: "Osvojio/la si :num od :total bodova",
      a11yCheck: L10N_TF.a11yCheck, a11yShowSolution: L10N_TF.a11yShowSolution, a11yRetry: L10N_TF.a11yRetry,
    },
  };
}

const BUILDERS = { mc: multiChoice, tf: trueFalse, blanks, drag: dragText };

function questionSet(vjezba) {
  return {
    introPage: {
      showIntroPage: true,
      startButtonText: "Počni",
      title: vjezba.naslov,
      introduction: `<p>${vjezba.uvod}</p>`,
    },
    progressType: "dots",
    passPercentage: 70,
    questions: vjezba.pitanja.map((p) => BUILDERS[p.tip](p)),
    disableBackwardsNavigation: false,
    randomQuestions: !!vjezba.nasumicno,
    poolSize: 0,
    endGame: {
      showResultPage: true, showSolutionButton: true, showRetryButton: true,
      noResultMessage: "Završeno", message: "Tvoj rezultat:",
      scoreBarLabel: "Osvojio/la si @finals od @totals bodova",
      overallFeedback: [
        { from: 0, to: 40, feedback: "Vrijedi ponoviti lekciju, pa opet pokušati." },
        { from: 41, to: 69, feedback: "Dobar početak — još malo pa odlično." },
        { from: 70, to: 89, feedback: "Vrlo dobro! Skoro sve tačno." },
        { from: 90, to: 100, feedback: "Odlično! Znaš ovu lekciju." },
      ],
      solutionButtonText: "Prikaži rješenje", retryButtonText: "Pokušaj ponovo",
      finishButtonText: "Završi", submitButtonText: "Pošalji",
      showAnimations: false, skippable: false, skipButtonText: "Preskoči",
    },
    override: { checkButton: true },
    texts: {
      prevButton: "Nazad", nextButton: "Dalje", finishButton: "Kraj", submitButton: "Pošalji",
      textualProgress: "Pitanje @current od @total",
      jumpToQuestion: "Pitanje %d od %total", questionLabel: "Pitanje",
      readSpeakerProgress: "Pitanje @current od @total",
      unansweredText: "Neodgovoreno", answeredText: "Odgovoreno",
      currentQuestionText: "Trenutno pitanje", navigationLabel: "Pitanja",
      questionSetInstruction: "Odaberi pitanje",
    },
  };
}

// ---------- gradnja ----------
const srcZip = new AdmZip(LIBRARY_SOURCE);
const srcManifest = JSON.parse(srcZip.readAsText("h5p.json"));
// Biblioteke koje vježbe direktno koriste. Zavisnosti se dalje računaju
// tranzitivno iz library.json svake biblioteke — H5P.QuestionSet npr. povlači
// H5P.Video, a H5P.DragText povlači jQuery.ui. Ako se ijedna izostavi,
// h5p-standalone padne na 404 pri učitavanju i vježba se ne prikaže.
const DIREKTNE = ["H5P.QuestionSet", "H5P.MultiChoice", "H5P.TrueFalse", "H5P.Blanks", "H5P.DragText"];

const svePoImenu = new Map(
  srcManifest.preloadedDependencies.map((d) => [d.machineName, d]),
);
function citajLibraryJson(dep) {
  const folder = `${dep.machineName}-${dep.majorVersion}.${dep.minorVersion}`;
  const raw = srcZip.readAsText(`${folder}/library.json`);
  return raw ? JSON.parse(raw) : null;
}
const potrebne = new Map();
const red = [...DIREKTNE];
while (red.length) {
  const ime = red.shift();
  if (potrebne.has(ime)) continue;
  const dep = svePoImenu.get(ime);
  if (!dep) throw new Error(`Biblioteka ${ime} ne postoji u izvornom paketu`);
  potrebne.set(ime, dep);
  const lib = citajLibraryJson(dep);
  for (const d of lib?.preloadedDependencies ?? []) red.push(d.machineName);
}
const deps = [...potrebne.values()];
const depFolders = new Set(deps.map((d) => `${d.machineName}-${d.majorVersion}.${d.minorVersion}`));
console.log(`Biblioteke u paketu (${deps.length}): ${[...potrebne.keys()].join(", ")}\n`);

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const vjezba of VJEZBE) {
  const zip = new AdmZip();
  for (const entry of srcZip.getEntries()) {
    if (entry.isDirectory) continue;
    const top = entry.entryName.split("/")[0];
    if (!depFolders.has(top)) continue;
    zip.addFile(entry.entryName, entry.getData());
  }
  zip.addFile("h5p.json", Buffer.from(JSON.stringify({
    title: vjezba.naslov,
    language: "bs",
    defaultLanguage: "bs",
    mainLibrary: "H5P.QuestionSet",
    embedTypes: ["div"],
    license: "U",
    authors: [{ name: "Mekteb.net", role: "Author" }],
    preloadedDependencies: deps,
  }, null, 2), "utf8"));
  zip.addFile("content/content.json", Buffer.from(JSON.stringify(questionSet(vjezba), null, 2), "utf8"));

  const out = path.join(OUT_DIR, `${vjezba.slug}.h5p`);
  zip.writeZip(out);
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`✓ ${vjezba.slug}.h5p — ${vjezba.pitanja.length} pitanja, ${kb} KB`);
}
console.log(`\nGotovo. Fajlovi su u ${OUT_DIR}`);
