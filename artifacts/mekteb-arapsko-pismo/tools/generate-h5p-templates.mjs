#!/usr/bin/env node
// Generiše minimalne .h5p starter šablone (content-only paketi).
// Svaki .h5p je ZIP koji sadrži:
//   - h5p.json   (manifest sa main library + preloadedDependencies)
//   - content/content.json  (parametri)
// Lumi Education desktop app prilikom otvaranja automatski preuzima nedostajuće
// H5P biblioteke iz H5P-Hub-a, pa ovi paketi rade odmah u Lumi-ju.
//
// Pokretanje:
//   node artifacts/mekteb-arapsko-pismo/tools/generate-h5p-templates.mjs

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "..", "public", "h5p-templates");

const COMMON_L10N = {
  checkAnswerButton: "Provjeri",
  showSolutionButton: "Pokaži rješenje",
  tryAgain: "Pokušaj ponovo",
  scoreBarLabel: "Rezultat: :num od :total",
};

const TEMPLATES = [
  // ─────────────────────────────────────────────
  // 1) Drag the Words: harfovi
  // ─────────────────────────────────────────────
  {
    fileName: "harfovi-drag-the-words.h5p",
    h5p: {
      title: "Spoji harf sa imenom",
      mainLibrary: "H5P.DragText",
      language: "bs",
      embedTypes: ["div"],
      defaultLanguage: "bs",
      license: "U",
      preloadedDependencies: [
        { machineName: "H5P.DragText", majorVersion: 1, minorVersion: 10 },
        { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 },
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
        { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
      ],
    },
    content: {
      taskDescription:
        "<p>Povuci ime harfa na pravo mjesto pored arapskog slova.</p>",
      textField:
        "ا — *elif*\nب — *ba*\nت — *ta*\nث — *sa*\nج — *džim*\nح — *ha*",
      checkAnswer: COMMON_L10N.checkAnswerButton,
      tryAgain: COMMON_L10N.tryAgain,
      showSolution: COMMON_L10N.showSolutionButton,
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        instantFeedback: false,
      },
    },
  },

  // ─────────────────────────────────────────────
  // 2) Multiple Choice: ilmihal — šartovi imana
  // ─────────────────────────────────────────────
  {
    fileName: "ilmihal-sartovi-imana.h5p",
    h5p: {
      title: "Ilmihal — šartovi imana",
      mainLibrary: "H5P.MultiChoice",
      language: "bs",
      embedTypes: ["div"],
      defaultLanguage: "bs",
      license: "U",
      preloadedDependencies: [
        { machineName: "H5P.MultiChoice", majorVersion: 1, minorVersion: 16 },
        { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 },
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
        { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
        { machineName: "H5P.Transition", majorVersion: 1, minorVersion: 0 },
        { machineName: "H5P.FontIcons", majorVersion: 1, minorVersion: 0 },
      ],
    },
    content: {
      question: "<p>Koliko ima šartova imana?</p>",
      answers: [
        { text: "<p>5</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno. Pet je broj šartova islama, ne imana.", notChosenFeedback: "" } },
        { text: "<p>6</p>", correct: true, tipsAndFeedback: { tip: "", chosenFeedback: "Tačno! Šest je broj šartova imana.", notChosenFeedback: "" } },
        { text: "<p>7</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno.", notChosenFeedback: "" } },
        { text: "<p>4</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno.", notChosenFeedback: "" } },
      ],
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        type: "auto",
        singlePoint: false,
        randomAnswers: true,
        showSolutionsRequiresInput: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false,
        passPercentage: 100,
        showScorePoints: true,
      },
      UI: {
        checkAnswerButton: COMMON_L10N.checkAnswerButton,
        showSolutionButton: COMMON_L10N.showSolutionButton,
        tryAgainButton: COMMON_L10N.tryAgain,
        tipsLabel: "Pomoć",
        scoreBarLabel: COMMON_L10N.scoreBarLabel,
        tipAvailable: "Pomoć dostupna",
        feedbackAvailable: "Povratna informacija dostupna",
        readFeedback: "Pročitaj povratnu informaciju",
        wrongAnswer: "Pogrešan odgovor",
        correctAnswer: "Tačan odgovor",
        shouldCheck: "Trebao si izabrati",
        shouldNotCheck: "Nije trebalo izabrati",
        noInput: "Molim odgovori prije provjere",
      },
    },
  },

  // ─────────────────────────────────────────────
  // 3) Image Pairs: vakat namaza
  // ─────────────────────────────────────────────
  {
    fileName: "vakat-namaza-pairs.h5p",
    h5p: {
      title: "Vakat namaza",
      mainLibrary: "H5P.MultiChoice",
      language: "bs",
      embedTypes: ["div"],
      defaultLanguage: "bs",
      license: "U",
      preloadedDependencies: [
        { machineName: "H5P.MultiChoice", majorVersion: 1, minorVersion: 16 },
        { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 },
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
        { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
      ],
    },
    content: {
      question:
        "<p><strong>Vakat namaza — primjer pitanja.</strong> Otvori u Lumi-ju i dodaj/zamijeni svojim pitanjima.</p><p>Koji namaz se klanja prije izlaska sunca?</p>",
      answers: [
        { text: "<p>Sabah</p>", correct: true, tipsAndFeedback: { tip: "", chosenFeedback: "Tačno!", notChosenFeedback: "" } },
        { text: "<p>Podne</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno.", notChosenFeedback: "" } },
        { text: "<p>Akšam</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno.", notChosenFeedback: "" } },
        { text: "<p>Jacija</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno.", notChosenFeedback: "" } },
      ],
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        type: "auto",
        singlePoint: false,
        randomAnswers: true,
        showSolutionsRequiresInput: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false,
        passPercentage: 100,
        showScorePoints: true,
      },
      UI: {
        checkAnswerButton: COMMON_L10N.checkAnswerButton,
        showSolutionButton: COMMON_L10N.showSolutionButton,
        tryAgainButton: COMMON_L10N.tryAgain,
        scoreBarLabel: COMMON_L10N.scoreBarLabel,
      },
    },
  },

  // ─────────────────────────────────────────────
  // 4) Find the Hotspot: dijelovi džamije
  //    (placeholder kao Multiple Choice — admin u Lumi-ju mijenja u "Find the Hotspot" dodavanjem slike džamije)
  // ─────────────────────────────────────────────
  {
    fileName: "dijelovi-dzamije-hotspots.h5p",
    h5p: {
      title: "Dijelovi džamije",
      mainLibrary: "H5P.MultiChoice",
      language: "bs",
      embedTypes: ["div"],
      defaultLanguage: "bs",
      license: "U",
      preloadedDependencies: [
        { machineName: "H5P.MultiChoice", majorVersion: 1, minorVersion: 16 },
        { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 },
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
        { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
      ],
    },
    content: {
      question:
        "<p><strong>Dijelovi džamije — primjer pitanja.</strong> Otvori u Lumi-ju i dodaj/zamijeni svojim pitanjima.</p><p>Šta je <strong>mihrab</strong>?</p>",
      answers: [
        { text: "<p>Niša u zidu okrenuta prema Kibli, gdje stoji imam.</p>", correct: true, tipsAndFeedback: { tip: "", chosenFeedback: "Tačno!", notChosenFeedback: "" } },
        { text: "<p>Visoka kula sa koje se uči ezan.</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno — to je munara.", notChosenFeedback: "" } },
        { text: "<p>Stepenice sa kojih hatib drži hutbu.</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno — to je minber.", notChosenFeedback: "" } },
        { text: "<p>Galerija na spratu džamije za žene.</p>", correct: false, tipsAndFeedback: { tip: "", chosenFeedback: "Netačno — to je mahfil.", notChosenFeedback: "" } },
      ],
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        type: "auto",
        singlePoint: false,
        randomAnswers: true,
        showSolutionsRequiresInput: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false,
        passPercentage: 100,
        showScorePoints: true,
      },
      UI: {
        checkAnswerButton: COMMON_L10N.checkAnswerButton,
        showSolutionButton: COMMON_L10N.showSolutionButton,
        tryAgainButton: COMMON_L10N.tryAgain,
        scoreBarLabel: COMMON_L10N.scoreBarLabel,
      },
    },
  },

  // ─────────────────────────────────────────────
  // 5) Memory Game placeholder kao Drag-the-words
  // ─────────────────────────────────────────────
  {
    fileName: "harf-izgovor-memory.h5p",
    h5p: {
      title: "Pamti par — harf i izgovor",
      mainLibrary: "H5P.DragText",
      language: "bs",
      embedTypes: ["div"],
      defaultLanguage: "bs",
      license: "U",
      preloadedDependencies: [
        { machineName: "H5P.DragText", majorVersion: 1, minorVersion: 10 },
        { machineName: "FontAwesome", majorVersion: 4, minorVersion: 5 },
        { machineName: "H5P.JoubelUI", majorVersion: 1, minorVersion: 3 },
        { machineName: "H5P.Question", majorVersion: 1, minorVersion: 5 },
      ],
    },
    content: {
      taskDescription:
        "<p><strong>Harf i izgovor — povuci par.</strong> Učenik povlači izgovor na pravo mjesto pored arapskog harfa. Otvori u Lumi-ju da dodaš još parova.</p>",
      textField:
        "ج — *džim*\nح — *ha*\nخ — *ha (sa tačkom)*\nد — *dal*\nذ — *zal*\nر — *ra*",
      checkAnswer: COMMON_L10N.checkAnswerButton,
      tryAgain: COMMON_L10N.tryAgain,
      showSolution: COMMON_L10N.showSolutionButton,
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        instantFeedback: false,
      },
    },
  },
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const t of TEMPLATES) {
  const zip = new AdmZip();
  zip.addFile(
    "h5p.json",
    Buffer.from(JSON.stringify(t.h5p, null, 2), "utf8"),
  );
  zip.addFile(
    "content/content.json",
    Buffer.from(JSON.stringify(t.content, null, 2), "utf8"),
  );
  // Dodaj README u sam .h5p koji objašnjava šta je ovo i kako se koristi.
  zip.addFile(
    "README.txt",
    Buffer.from(
      [
        `Mekteb.net — H5P starter šablon: ${t.h5p.title}`,
        ``,
        `Ovo je content-only .h5p paket (sadrži samo manifest i parametre,`,
        `bez pripadajućih H5P biblioteka). Otvori ga u Lumi Education desktop`,
        `aplikaciji — Lumi će automatski preuzeti potrebne biblioteke`,
        `(${t.h5p.mainLibrary}) iz H5P-Hub-a.`,
        ``,
        `1. Otvori Lumi → File → Open → izaberi ovaj .h5p fajl.`,
        `2. Lumi će preuzeti biblioteke (samo prvi put, ~5MB po tipu).`,
        `3. Zamijeni primjere svojim sadržajem (pitanja, harfovi, slike).`,
        `4. File → Save as .h5p → uploaduj u Mekteb (Ilmihal lekcija → "Dodaj H5P vježbu").`,
        ``,
        `Napomena: ako Lumi ne može preuzeti biblioteke, zatvori i otvori Lumi`,
        `kao Administrator (Win) / sudo (Linux), ili provjeri internet vezu.`,
      ].join("\n"),
      "utf8",
    ),
  );
  const outPath = path.join(OUTPUT_DIR, t.fileName);
  zip.writeZip(outPath);
  const size = fs.statSync(outPath).size;
  console.log(`✓ ${t.fileName} (${size} B)`);
}

console.log(`\nGenerisano ${TEMPLATES.length} šablona u ${OUTPUT_DIR}`);
