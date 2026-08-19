import assert from "node:assert/strict";
import test from "node:test";
import { reconcileRetryRemediation } from "./quiz-learning";

test("tačan ponovni pokušaj uklanja pitanje iz Popravi saće", () => {
  const wrong = [
    { questionIndex: 2, questionText: "Pilot pitanje" },
    { questionIndex: 7, questionText: "Drugo pitanje" },
  ];

  const reconciled = reconcileRetryRemediation(wrong, 2, true, "immediate");

  assert.deepEqual(reconciled, [{ questionIndex: 7, questionText: "Drugo pitanje" }]);
});

test("prvi pogrešan odgovor i obični kvizovi ne brišu grešku", () => {
  const wrong = [{ questionIndex: 2 }];
  assert.equal(reconcileRetryRemediation(wrong, 2, false, "immediate"), wrong);
  assert.equal(reconcileRetryRemediation(wrong, 2, true), wrong);
});