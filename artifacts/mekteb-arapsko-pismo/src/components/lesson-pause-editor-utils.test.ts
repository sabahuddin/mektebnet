import assert from "node:assert/strict";
import test from "node:test";
import { correctOptionAfterRemoval } from "./lesson-pause-editor-utils.js";

test("brisanje opcije prije tačne pomjera tačan indeks ulijevo", () => {
  assert.equal(correctOptionAfterRemoval(2, 0, 3), 1);
});

test("brisanje tačne opcije bira stavku koja je došla na njeno mjesto", () => {
  assert.equal(correctOptionAfterRemoval(1, 1, 3), 1);
});

test("brisanje zadnje tačne opcije bira novu zadnju stavku", () => {
  assert.equal(correctOptionAfterRemoval(3, 3, 3), 2);
});

test("brisanje opcije poslije tačne ne mijenja tačan indeks", () => {
  assert.equal(correctOptionAfterRemoval(1, 3, 3), 1);
});