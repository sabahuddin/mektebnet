import assert from "node:assert/strict";
import test from "node:test";
import { canReadLesson } from "./lesson-visibility.js";

const privateLesson = {
  dostupnost: "autorovi_ucenici",
  isPublished: true,
  autorMuallimId: 12,
  statusOdobrenja: "odobreno",
};

test("privatnu lekciju vide autor i njegovi učenici", () => {
  assert.equal(canReadLesson({ userId: 12, role: "muallim" }, privateLesson), true);
  assert.equal(canReadLesson({ userId: 31, role: "ucenik" }, privateLesson, 12), true);
  assert.equal(canReadLesson({ userId: 32, role: "ucenik" }, privateLesson, 99), false);
  assert.equal(canReadLesson({ userId: 13, role: "muallim" }, privateLesson), false);
  assert.equal(canReadLesson({ userId: 40, role: "roditelj" }, privateLesson), false);
});

test("nacrt prije odluke vidi samo autor i admin", () => {
  const pending = { ...privateLesson, isPublished: false, statusOdobrenja: "na_cekanju" };
  assert.equal(canReadLesson({ userId: 12, role: "muallim" }, pending), true);
  assert.equal(canReadLesson({ userId: 13, role: "muallim" }, pending), false);
  assert.equal(canReadLesson({ userId: 31, role: "ucenik" }, pending, 12), false);
  assert.equal(canReadLesson({ userId: 1, role: "admin" }, pending), true);
});

test("javnu odobrenu lekciju vide svi", () => {
  const publicLesson = { ...privateLesson, dostupnost: "svi" };
  assert.equal(canReadLesson(undefined, publicLesson), true);
  assert.equal(canReadLesson({ userId: 31, role: "ucenik" }, publicLesson, 99), true);
});