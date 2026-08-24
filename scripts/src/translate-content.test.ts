import assert from "node:assert/strict";
import test from "node:test";
import {
  existingQuizNeedsRepair,
  existingTextNeedsRepair,
} from "./translate-content";

test("ne šalje ponovo bankovno pitanje koje prevodi termin i čuva ga u zagradi", () => {
  const source = "Šta je šart u namazu?";
  const translation = "Was ist eine Bedingung (šart) im Gebet?";

  assert.equal(existingTextNeedsRepair(source, translation, "de"), false);
});

test("označava potpuno nepromijenjeno bankovno pitanje za popravku", () => {
  const source = "Šta je šart u namazu?";

  assert.equal(existingTextNeedsRepair(source, source, "de"), true);
});

test("ne šalje ponovo kviz_pitanja kada prijevod čuva termin dova u zagradi", () => {
  const source = [
    {
      question: "Šta je dova?",
      options: ["Molitva", "Igra"],
      answer: "Molitva",
    },
  ];
  const translation = JSON.stringify([
    {
      question: "Was ist ein Bittgebet (dova)?",
      options: ["Gebet", "Spiel"],
      answer: "Gebet",
    },
  ]);

  assert.equal(existingQuizNeedsRepair(source, translation, "de"), false);
});

test("označava potpuno nepromijenjeno kviz_pitanje za popravku", () => {
  const source = [
    {
      question: "Šta je dova?",
      options: ["Molitva", "Igra"],
      answer: "Molitva",
    },
  ];

  assert.equal(existingQuizNeedsRepair(source, JSON.stringify(source), "de"), true);
});