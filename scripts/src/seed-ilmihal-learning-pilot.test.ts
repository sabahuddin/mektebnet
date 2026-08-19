import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, pitanjaBankaTable, kvizoviTable } from "@workspace/db";
import {
  ILMIHAL_LEARNING_PILOTS,
  seedIlmihalLearningPilot,
} from "./seed-ilmihal-learning-pilot";

test("pilot pokriva po jednu lekciju iz sva tri nivoa", () => {
  assert.deepEqual(ILMIHAL_LEARNING_PILOTS.map((pilot) => pilot.nivo), [1, 2, 3]);
  assert.equal(new Set(ILMIHAL_LEARNING_PILOTS.map((pilot) => pilot.lessonSlug)).size, 3);
});

test("svaki pilot zadržava izvor i daje objašnjen neposredni pokušaj", () => {
  for (const pilot of ILMIHAL_LEARNING_PILOTS) {
    assert.equal(pilot.questions.length, 5);
    assert.ok(pilot.questions.some((question) => question.didaktickiTip === "prisjecanje"));
    assert.ok(pilot.questions.some((question) => question.didaktickiTip === "razlikovanje"));
    assert.ok(pilot.questions.some((question) => question.didaktickiTip === "primjena"));
    assert.ok(pilot.questions.some((question) => question.didaktickiTip === "redoslijed"));

    for (const question of pilot.questions) {
      assert.ok(question.sourceQuestion.trim().length > 0);
      assert.ok(question.opcije.length >= 2);
      assert.ok(question.objasnjenje.trim().length > 0);
      assert.ok(question.retryPrompt.trim().length > 0);
      if (question.vrsta === "reorder") {
        assert.equal(question.correctOrder?.length, question.opcije.length);
      } else if (question.vrsta === "multiple") {
        assert.ok((question.correctIndexes?.length ?? 0) >= 2);
      } else {
        assert.ok((question.correctIndex ?? -1) >= 0);
      }
    }
  }
});

test("ponovljeni seed čuva administratorske izmjene pilot sadržaja", async () => {
  const first = await seedIlmihalLearningPilot({ silent: true });
  const second = await seedIlmihalLearningPilot({ silent: true });
  assert.deepEqual(first, { lessonsSeeded: 3, questionsUpserted: 15 });
  assert.deepEqual(second, first);

  const questionKey = "ilmihal-learning:n2-pet-namaza";
  const quizKey = "ilmihal-learning-quiz:ucimo-namaz";
  const [questionBefore] = await db
    .select({
      id: pitanjaBankaTable.id,
      explanation: pitanjaBankaTable.objasnjenje,
    })
    .from(pitanjaBankaTable)
    .where(eq(pitanjaBankaTable.seedKey, questionKey))
    .limit(1);
  const [quizBefore] = await db
    .select({
      id: kvizoviTable.id,
      isPublished: kvizoviTable.isPublished,
    })
    .from(kvizoviTable)
    .where(eq(kvizoviTable.seedKey, quizKey))
    .limit(1);
  assert.ok(questionBefore);
  assert.ok(quizBefore);

  const adminExplanation = `${questionBefore.explanation} [admin-test]`;
  try {
    await db.update(pitanjaBankaTable)
      .set({ objasnjenje: adminExplanation })
      .where(eq(pitanjaBankaTable.id, questionBefore.id));
    await db.update(kvizoviTable)
      .set({ isPublished: false })
      .where(eq(kvizoviTable.id, quizBefore.id));

    await seedIlmihalLearningPilot({ silent: true });

    const [questionAfter] = await db
      .select({ explanation: pitanjaBankaTable.objasnjenje })
      .from(pitanjaBankaTable)
      .where(eq(pitanjaBankaTable.id, questionBefore.id));
    const [quizAfter] = await db
      .select({ isPublished: kvizoviTable.isPublished })
      .from(kvizoviTable)
      .where(eq(kvizoviTable.id, quizBefore.id));
    assert.equal(questionAfter.explanation, adminExplanation);
    assert.equal(quizAfter.isPublished, false);
  } finally {
    await db.update(pitanjaBankaTable)
      .set({ objasnjenje: questionBefore.explanation })
      .where(eq(pitanjaBankaTable.id, questionBefore.id));
    await db.update(kvizoviTable)
      .set({ isPublished: quizBefore.isPublished })
      .where(eq(kvizoviTable.id, quizBefore.id));
  }
});