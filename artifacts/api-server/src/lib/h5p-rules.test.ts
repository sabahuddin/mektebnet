import test from "node:test";
import assert from "node:assert/strict";
import {
  H5P_CORRECT_RETRY_LOCK_MS,
  lockUntilForAttempt,
  multiplierForAttempt,
  rewardCapForAttempt,
} from "./h5p-rules.js";

test("H5P nagrada je 5 kapi prvi put, 3 drugi put i 0 nakon toga", () => {
  assert.equal(rewardCapForAttempt(1), 5);
  assert.equal(rewardCapForAttempt(2), 3);
  assert.equal(rewardCapForAttempt(3), 0);
  assert.equal(rewardCapForAttempt(20), 0);
  assert.equal(multiplierForAttempt(1), 1);
  assert.equal(multiplierForAttempt(2), 0.6);
  assert.equal(multiplierForAttempt(3), 0);
});

test("samo 100% rezultat zaključava novi pokušaj tačno 48 sati", () => {
  const completedAt = new Date("2026-09-02T08:00:00.000Z");
  assert.equal(lockUntilForAttempt(completedAt, 99), null);

  const lockedUntil = lockUntilForAttempt(completedAt, 100);
  assert.ok(lockedUntil);
  assert.equal(
    lockedUntil.getTime() - completedAt.getTime(),
    H5P_CORRECT_RETRY_LOCK_MS,
  );
  assert.equal(lockedUntil.toISOString(), "2026-09-04T08:00:00.000Z");
});