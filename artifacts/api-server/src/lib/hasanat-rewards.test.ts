import test from "node:test";
import assert from "node:assert/strict";
import {
  etapaHasanatReward,
  etapaPassThreshold,
  KRUNISANJE_REWARD,
  BADGE_REWARD,
} from "./hasanat-rewards.js";

test("etapni kviz daje nagradu po procentualnom razredu", () => {
  assert.equal(etapaHasanatReward(79), 0);
  assert.equal(etapaHasanatReward(80), 80);
  assert.equal(etapaHasanatReward(89), 80);
  assert.equal(etapaHasanatReward(90), 90);
  assert.equal(etapaHasanatReward(99), 90);
  assert.equal(etapaHasanatReward(100), 100);
});

test("etapni prag ne može biti manji od 80 posto", () => {
  assert.equal(etapaPassThreshold(null), 80);
  assert.equal(etapaPassThreshold(70), 80);
  assert.equal(etapaPassThreshold(90), 90);
});

test("krunisanje i novi bedž imaju fiksne nagrade", () => {
  assert.equal(KRUNISANJE_REWARD, 1000);
  assert.equal(BADGE_REWARD, 50);
});