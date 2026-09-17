import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEtapaAttemptPolicy } from "./etape.js";

const now = new Date("2026-09-17T12:00:00.000Z");

test("prvi pokušaj je odmah dostupan", () => {
  const access = evaluateEtapaAttemptPolicy([], false, now);
  assert.equal(access.allowed, true);
  assert.equal(access.nextAttemptNo, 1);
});

test("drugi pokušaj se otvara tačno sedam dana nakon prvog neuspjeha", () => {
  const first = [{ pokusajBr: 1, polozeno: false, createdAt: new Date("2026-09-11T12:00:01.000Z") }];
  const blocked = evaluateEtapaAttemptPolicy(first, false, now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.availableAt, "2026-09-18T12:00:01.000Z");

  const oldEnough = [{ pokusajBr: 1, polozeno: false, createdAt: new Date("2026-09-10T12:00:00.000Z") }];
  assert.equal(evaluateEtapaAttemptPolicy(oldEnough, false, now).allowed, true);
});

test("treći i svaki naredni pokušaj traže konkretno muallimsko odobrenje", () => {
  const attempts = [
    { pokusajBr: 2, polozeno: false, createdAt: new Date("2026-09-17T11:00:00.000Z") },
    { pokusajBr: 1, polozeno: false, createdAt: new Date("2026-09-01T11:00:00.000Z") },
  ];
  const blocked = evaluateEtapaAttemptPolicy(attempts, false, now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.nextAttemptNo, 3);
  assert.equal(blocked.requiresApproval, true);

  const approved = evaluateEtapaAttemptPolicy(attempts, true, now);
  assert.equal(approved.allowed, true);
  assert.equal(approved.requiresApproval, false);
});

test("položena etapa ostaje dostupna za dobrovoljno ponavljanje", () => {
  const attempts = [
    { pokusajBr: 2, polozeno: true, createdAt: new Date("2026-09-17T11:00:00.000Z") },
    { pokusajBr: 1, polozeno: false, createdAt: new Date("2026-09-01T11:00:00.000Z") },
  ];
  assert.equal(evaluateEtapaAttemptPolicy(attempts, false, now).allowed, true);
});