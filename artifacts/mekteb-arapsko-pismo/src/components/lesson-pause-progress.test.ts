import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergePauseProgress,
  normalizePauseProgress,
} from "./lesson-pause-progress";
import type { MultipleChoiceConfig, OrderingConfig, PauseProgress } from "./lesson-pause";

const choiceConfig: MultipleChoiceConfig = {
  id: "choice-1",
  type: "multiple-choice",
  question: "Odaberi",
  options: ["A", "B", "C"],
  correctOption: 1,
};

test("UI state se sprema u mapu i vraća pri ponovnom učitavanju", () => {
  const saved: PauseProgress = { answer: 1, submitted: true, correct: true };
  const map = mergePauseProgress(undefined, choiceConfig.id, saved);
  assert.deepEqual(normalizePauseProgress(choiceConfig, map[choiceConfig.id]), saved);
});

test("izmijenjena konfiguracija odbacuje samo nekompatibilnu pauzu", () => {
  const other: PauseProgress = { answer: true, submitted: true, correct: true };
  const progress = mergePauseProgress(
    { "other-pause": other },
    choiceConfig.id,
    { answer: 2, submitted: true, correct: false },
  );
  const changedChoice: MultipleChoiceConfig = {
    ...choiceConfig,
    options: ["A", "B"],
  };

  assert.equal(normalizePauseProgress(changedChoice, progress[choiceConfig.id]), undefined);
  assert.deepEqual(progress["other-pause"], other);
});

test("redoslijed se vraća samo kada i dalje sadrži iste stavke", () => {
  const config: OrderingConfig = {
    id: "order-1",
    type: "ordering",
    question: "Poredaj",
    items: ["prvo", "drugo", "treće"],
  };
  const saved: PauseProgress = {
    answer: ["drugo", "prvo", "treće"],
    submitted: false,
    correct: null,
  };
  assert.deepEqual(normalizePauseProgress(config, saved), saved);
  assert.equal(normalizePauseProgress(
    { ...config, items: ["prvo", "drugo", "novo"] },
    saved,
  ), undefined);
});