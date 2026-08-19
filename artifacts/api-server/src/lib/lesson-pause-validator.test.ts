/**
 * Unit testovi za lesson-pause-validator.ts
 *
 * Pokreni: pnpm --filter @workspace/api-server test
 * ili:     tsx --test src/lib/lesson-pause-validator.test.ts
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateLessonPauses } from "./lesson-pause-validator.js";

// ── Pomoćne funkcije ─────────────────────────────────────────────────────────

function encodeConfig(cfg: unknown): string {
  return encodeURIComponent(JSON.stringify(cfg));
}

function makePauseDiv(cfg: unknown): string {
  return `<div data-lesson-pause="1" data-pause-config="${encodeConfig(cfg)}"></div>`;
}

function makeHtml(...divs: string[]): string {
  return `<p>Tekst</p>${divs.join("")}<p>Kraj</p>`;
}

// ── Minimalni valjani objekti za svaki tip ────────────────────────────────────

const BASE_YES_NO = {
  id: "q1",
  type: "yes-no",
  question: "Je li Allah jedan?",
  correctAnswer: true,
  correctExplanation: "Tačno, Allah je jedan.",
  wrongExplanation: "Nije tačno.",
};

const BASE_MC = {
  id: "mc1",
  type: "multiple-choice",
  question: "Koji je prvi stub islama?",
  options: ["Šehadet", "Namaz"],
  correctOption: 0,
  correctExplanation: "Tačno!",
  wrongExplanation: "Netačno.",
};

const BASE_FQ = {
  id: "fq1",
  type: "fact-question",
  question: "Koliko je stubova islama?",
  options: ["3", "5"],
  correctOption: 1,
  fact: "Islam ima pet stubova (arkan).",
  correctExplanation: "Tačno!",
  wrongExplanation: "Netačno.",
};

const BASE_MATCHING = {
  id: "m1",
  type: "matching",
  question: "Spoji stub sa opisom:",
  pairs: [
    { left: "Šehadet", right: "Svjedočanstvo vjere" },
    { left: "Namaz", right: "Pet dnevnih molitvi" },
  ],
  correctExplanation: "Odlično!",
  wrongExplanation: "Pokušaj ponovo.",
};

const BASE_ORDERING = {
  id: "o1",
  type: "ordering",
  question: "Poredaj stubove islama redom:",
  items: ["Šehadet", "Namaz"],
  correctExplanation: "Tačan redoslijed!",
  wrongExplanation: "Redoslijed nije tačan.",
};

// ── Osnovno ──────────────────────────────────────────────────────────────────

describe("validateLessonPauses — osnovno", () => {
  test("prazna string vraća ok", () => {
    assert.ok(validateLessonPauses("").ok);
  });

  test("HTML bez pauza vraća ok", () => {
    assert.ok(validateLessonPauses("<p>Tekst</p>").ok);
  });
});

// ── yes-no ───────────────────────────────────────────────────────────────────

describe("validateLessonPauses — yes-no", () => {
  test("validan yes-no prolazi", () => {
    assert.ok(validateLessonPauses(makeHtml(makePauseDiv(BASE_YES_NO))).ok);
  });

  test("nedostaje id — greška", () => {
    const { id: _id, ...cfg } = BASE_YES_NO;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"id"'));
  });

  test("prazan id — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_YES_NO, id: "   " })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"id"'));
  });

  test("correctAnswer nije boolean — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_YES_NO, correctAnswer: "da" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctAnswer"'));
  });

  test("prazan question — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_YES_NO, question: "" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"question"'));
  });

  test("predugačak question — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_YES_NO, question: "x".repeat(501) })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"question"'));
  });

  test("nedostaje correctExplanation — greška", () => {
    const { correctExplanation: _ce, ...cfg } = BASE_YES_NO;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("prazan correctExplanation — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_YES_NO, correctExplanation: "   " })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("nedostaje wrongExplanation — greška", () => {
    const { wrongExplanation: _we, ...cfg } = BASE_YES_NO;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });

  test("prazan wrongExplanation — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_YES_NO, wrongExplanation: "" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });
});

// ── multiple-choice ───────────────────────────────────────────────────────────

describe("validateLessonPauses — multiple-choice", () => {
  test("validan multiple-choice prolazi (2 opcije)", () => {
    assert.ok(validateLessonPauses(makeHtml(makePauseDiv(BASE_MC))).ok);
  });

  test("validan multiple-choice prolazi (4 opcije)", () => {
    const cfg = { ...BASE_MC, options: ["Namaz", "Šehadet", "Post", "Zekat"], correctOption: 1 };
    assert.ok(validateLessonPauses(makeHtml(makePauseDiv(cfg))).ok);
  });

  test("options nije niz — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, options: "nije niz" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"options"'));
  });

  test("samo 1 opcija (ispod minimuma) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, options: ["Samo jedna"], correctOption: 0 })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"options"'));
  });

  test("prazan options niz — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, options: [] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"options"'));
  });

  test("više od 10 opcija — greška", () => {
    const cfg = {
      ...BASE_MC,
      options: Array.from({ length: 11 }, (_, i) => `Opcija ${i}`),
      correctOption: 0,
    };
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"options"'));
  });

  test("prazan string u options — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, options: ["Opcija 1", "   "] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("options[1]"));
  });

  test("duplikat opcije — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, options: ["Ista", "Ista"] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("duplikat opcije (whitespace-trimmed) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, options: ["Ista", " Ista "] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("correctOption van opsega — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, correctOption: 10 })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctOption"'));
  });

  test("correctOption nije broj — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, correctOption: "1" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctOption"'));
  });

  test("nedostaje correctExplanation — greška", () => {
    const { correctExplanation: _ce, ...cfg } = BASE_MC;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("prazan correctExplanation — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, correctExplanation: "" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("nedostaje wrongExplanation — greška", () => {
    const { wrongExplanation: _we, ...cfg } = BASE_MC;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });

  test("prazan wrongExplanation — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MC, wrongExplanation: "   " })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });
});

// ── fact-question ─────────────────────────────────────────────────────────────

describe("validateLessonPauses — fact-question", () => {
  test("validan fact-question prolazi", () => {
    assert.ok(validateLessonPauses(makeHtml(makePauseDiv(BASE_FQ))).ok);
  });

  test("nedostaje fact — greška", () => {
    const { fact: _f, ...cfg } = BASE_FQ;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"fact"'));
  });

  test("prazan fact — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_FQ, fact: "" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"fact"'));
  });

  test("samo 1 opcija (ispod minimuma) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_FQ, options: ["Samo"], correctOption: 0 })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"options"'));
  });

  test("duplikat opcije u fact-question — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_FQ, options: ["Duplo", "Duplo"] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("nedostaje correctExplanation u fact-question — greška", () => {
    const { correctExplanation: _ce, ...cfg } = BASE_FQ;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("nedostaje wrongExplanation u fact-question — greška", () => {
    const { wrongExplanation: _we, ...cfg } = BASE_FQ;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });
});

// ── matching ──────────────────────────────────────────────────────────────────

describe("validateLessonPauses — matching", () => {
  test("validan matching prolazi (2 para)", () => {
    assert.ok(validateLessonPauses(makeHtml(makePauseDiv(BASE_MATCHING))).ok);
  });

  test("pairs nije niz — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MATCHING, pairs: {} })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"pairs"'));
  });

  test("samo 1 par (ispod minimuma) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({
      ...BASE_MATCHING,
      pairs: [{ left: "Samo", right: "Jedan" }],
    })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"pairs"'));
  });

  test("prazan pairs niz — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MATCHING, pairs: [] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"pairs"'));
  });

  test("više od 10 parova — greška", () => {
    const cfg = {
      ...BASE_MATCHING,
      pairs: Array.from({ length: 11 }, (_, i) => ({ left: `L${i}`, right: `R${i}` })),
    };
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"pairs"'));
  });

  test("par bez left — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({
      ...BASE_MATCHING,
      pairs: [{ left: "", right: "R" }, { left: "L2", right: "R2" }],
    })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("pairs[0].left"));
  });

  test("par bez right — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({
      ...BASE_MATCHING,
      pairs: [{ left: "L", right: "   " }, { left: "L2", right: "R2" }],
    })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("pairs[0].right"));
  });

  test("par nije objekat — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({
      ...BASE_MATCHING,
      pairs: ["nije par", { left: "L", right: "R" }],
    })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("pairs[0]"));
  });

  test("duplikat desne vrijednosti — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({
      ...BASE_MATCHING,
      pairs: [
        { left: "Šehadet", right: "Ista vrijednost" },
        { left: "Namaz", right: "Ista vrijednost" },
      ],
    })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("duplikat desne vrijednosti (whitespace-trimmed) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({
      ...BASE_MATCHING,
      pairs: [
        { left: "A", right: "Ista" },
        { left: "B", right: " Ista " },
      ],
    })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("nedostaje correctExplanation — greška", () => {
    const { correctExplanation: _ce, ...cfg } = BASE_MATCHING;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("nedostaje wrongExplanation — greška", () => {
    const { wrongExplanation: _we, ...cfg } = BASE_MATCHING;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });

  test("prazan wrongExplanation — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_MATCHING, wrongExplanation: "" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });
});

// ── ordering ──────────────────────────────────────────────────────────────────

describe("validateLessonPauses — ordering", () => {
  test("validan ordering prolazi (2 stavke)", () => {
    assert.ok(validateLessonPauses(makeHtml(makePauseDiv(BASE_ORDERING))).ok);
  });

  test("items nije niz — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, items: "nije niz" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"items"'));
  });

  test("samo 1 stavka (ispod minimuma) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, items: ["Samo jedna"] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"items"'));
  });

  test("prazan items niz — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, items: [] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"items"'));
  });

  test("više od 10 stavki — greška", () => {
    const cfg = { ...BASE_ORDERING, items: Array.from({ length: 11 }, (_, i) => `Stavka ${i}`) };
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"items"'));
  });

  test("prazan item u nizu — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, items: ["Šehadet", ""] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("items[1]"));
  });

  test("duplikat stavke — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, items: ["Šehadet", "Šehadet"] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("duplikat stavke (whitespace-trimmed) — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, items: ["Šehadet", " Šehadet "] })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("ponavlja"));
  });

  test("nedostaje correctExplanation — greška", () => {
    const { correctExplanation: _ce, ...cfg } = BASE_ORDERING;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });

  test("nedostaje wrongExplanation — greška", () => {
    const { wrongExplanation: _we, ...cfg } = BASE_ORDERING;
    const r = validateLessonPauses(makeHtml(makePauseDiv(cfg)));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"wrongExplanation"'));
  });

  test("prazan correctExplanation — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ ...BASE_ORDERING, correctExplanation: "  " })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"correctExplanation"'));
  });
});

// ── Malformed / greške ────────────────────────────────────────────────────────

describe("validateLessonPauses — malformed i nepoznati tipovi", () => {
  test("data-pause-config nedostaje — greška", () => {
    const r = validateLessonPauses(`<div data-lesson-pause="1"></div>`);
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("Nedostaje"));
  });

  test("data-pause-config nije validan URL encoding — greška", () => {
    const r = validateLessonPauses(`<div data-lesson-pause="1" data-pause-config="%INVALID_ENCODING%"></div>`);
    assert.ok(!r.ok);
  });

  test("data-pause-config nije validan JSON — greška", () => {
    const encoded = encodeURIComponent("{nevalidan json}");
    const r = validateLessonPauses(`<div data-lesson-pause="1" data-pause-config="${encoded}"></div>`);
    assert.ok(!r.ok);
  });

  test("config nije objekat (niz) — greška", () => {
    const encoded = encodeURIComponent(JSON.stringify([1, 2, 3]));
    const r = validateLessonPauses(`<div data-lesson-pause="1" data-pause-config="${encoded}"></div>`);
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("objekat"));
  });

  test("nepoznat tip pauze — greška s korisnom porukom", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ id: "x1", type: "super-quiz", question: "?" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes("super-quiz"));
  });

  test("nedostaje type — greška", () => {
    const r = validateLessonPauses(makeHtml(makePauseDiv({ id: "x1", question: "Pitanje?" })));
    assert.ok(!r.ok);
    assert.ok(r.errors[0].message.includes('"type"'));
  });
});

// ── Jedinstvenost id-a ────────────────────────────────────────────────────────

describe("validateLessonPauses — jedinstvenost id-a", () => {
  test("isti id u dvije pauze — greška na drugoj pauzi", () => {
    const p1 = makePauseDiv({ ...BASE_YES_NO, id: "q1" });
    const p2 = makePauseDiv({ ...BASE_YES_NO, id: "q1" });
    const r = validateLessonPauses(makeHtml(p1, p2));
    assert.ok(!r.ok);
    const dupError = r.errors.find((e) => e.message.includes("ponavlja"));
    assert.ok(dupError, "Mora biti greška o ponavljajućem id-u");
    assert.equal(dupError.pauseIndex, 1);
  });

  test("različiti id-ovi prolaze", () => {
    const p1 = makePauseDiv({ ...BASE_YES_NO, id: "q1" });
    const p2 = makePauseDiv({ ...BASE_YES_NO, id: "q2" });
    assert.ok(validateLessonPauses(makeHtml(p1, p2)).ok);
  });
});

// ── Više pauza, više grešaka ──────────────────────────────────────────────────

describe("validateLessonPauses — više pauza", () => {
  test("dvije valjane pauze različitih tipova — ok", () => {
    const p1 = makePauseDiv({ ...BASE_YES_NO, id: "a1" });
    const p2 = makePauseDiv({ ...BASE_MC, id: "a2" });
    assert.ok(validateLessonPauses(makeHtml(p1, p2)).ok);
  });

  test("greška u prvoj pauzi ne sprečava provjeru druge — skupljaju se obje greške", () => {
    const p1 = makePauseDiv({ id: "b1", type: "yes-no", question: "" });
    const p2 = makePauseDiv({ id: "b2", type: "unknown-type", question: "?" });
    const r = validateLessonPauses(makeHtml(p1, p2));
    assert.ok(!r.ok);
    assert.equal(r.errors.length, 2);
  });
});
