import assert from "node:assert/strict";
import test from "node:test";
import { asc, eq } from "drizzle-orm";
import { db, ilmihalLekcijeTable, pitanjaBankaTable, kvizoviTable } from "@workspace/db";
import {
  buildExpandedIlmihalPilots,
  ILMIHAL_LEARNING_PILOTS,
  seedIlmihalLearningPilot,
  validateIlmihalPilots,
} from "./seed-ilmihal-learning-pilot";

async function loadAllPilots() {
  const lessons = await db.select({
    nivo: ilmihalLekcijeTable.nivo,
    slug: ilmihalLekcijeTable.slug,
    naslov: ilmihalLekcijeTable.naslov,
    predmet: ilmihalLekcijeTable.predmet,
    kvizPitanja: ilmihalLekcijeTable.kvizPitanja,
  }).from(ilmihalLekcijeTable)
    .where(eq(ilmihalLekcijeTable.isPublished, true))
    .orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed));
  return {
    lessons,
    pilots: [...ILMIHAL_LEARNING_PILOTS, ...buildExpandedIlmihalPilots(lessons)],
  };
}

test("proširenje pokriva svaku objavljenu Ilmihal lekciju iz sva tri nivoa", async () => {
  const { lessons, pilots } = await loadAllPilots();
  validateIlmihalPilots(pilots);
  assert.deepEqual([...new Set(pilots.map((pilot) => pilot.nivo))].sort(), [1, 2, 3]);
  assert.equal(pilots.length, lessons.length);
  assert.deepEqual(
    new Set(pilots.map((pilot) => pilot.lessonSlug)),
    new Set(lessons.map((lesson) => lesson.slug)),
  );
});

test("proširenje prekida seed ako objavljena lekcija nema valjana izvorna pitanja", () => {
  assert.throws(
    () => buildExpandedIlmihalPilots([{
      nivo: 2,
      slug: "nova-lekcija-bez-pitanja",
      naslov: "Nova lekcija bez pitanja",
      predmet: "Ahlak",
      kvizPitanja: null,
    }]),
    /nova-lekcija-bez-pitanja/,
  );
});

test("svako prošireno pitanje zadržava izvor, odgovor i objašnjen neposredni pokušaj", async () => {
  const { pilots } = await loadAllPilots();
  for (const pilot of pilots) {
    assert.ok(pilot.questions.length >= 1);
    assert.ok(pilot.questions.some((question) => question.didaktickiTip === "prisjecanje"));

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
        assert.ok((question.correctIndex ?? -1) < question.opcije.length);
      }
    }
  }
});

test("ponovljeni seed čuva administratorske izmjene pilot sadržaja", async () => {
  const first = await seedIlmihalLearningPilot({ silent: true });
  const second = await seedIlmihalLearningPilot({ silent: true });
  const { pilots } = await loadAllPilots();
  assert.deepEqual(first, {
    lessonsSeeded: pilots.length,
    questionsUpserted: pilots.reduce((sum, pilot) => sum + pilot.questions.length, 0),
  });
  assert.deepEqual(second, first);

  const questionKey = "ilmihal-learning:n2-pet-namaza";
  const quizKey = "ilmihal-learning-quiz:ucimo-namaz";
  const [questionBefore] = await db
    .select({
      id: pitanjaBankaTable.id,
      explanation: pitanjaBankaTable.objasnjenje,
      meta: pitanjaBankaTable.meta,
      urednickiStatus: pitanjaBankaTable.urednickiStatus,
      reviewedAt: pitanjaBankaTable.reviewedAt,
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
  assert.equal(questionBefore.meta?.pilotKey, "n2-pet-namaza");

  const adminExplanation = `${questionBefore.explanation} [admin-test]`;
  const adminReviewedAt = new Date("2026-08-19T00:00:00.000Z");
  try {
    await db.update(pitanjaBankaTable)
      .set({
        objasnjenje: adminExplanation,
        urednickiStatus: "odobreno",
        reviewedAt: adminReviewedAt,
      })
      .where(eq(pitanjaBankaTable.id, questionBefore.id));
    await db.update(kvizoviTable)
      .set({ isPublished: false })
      .where(eq(kvizoviTable.id, quizBefore.id));

    await seedIlmihalLearningPilot({ silent: true });

    const [questionAfter] = await db
      .select({
        explanation: pitanjaBankaTable.objasnjenje,
        urednickiStatus: pitanjaBankaTable.urednickiStatus,
        reviewedAt: pitanjaBankaTable.reviewedAt,
      })
      .from(pitanjaBankaTable)
      .where(eq(pitanjaBankaTable.id, questionBefore.id));
    const [quizAfter] = await db
      .select({ isPublished: kvizoviTable.isPublished })
      .from(kvizoviTable)
      .where(eq(kvizoviTable.id, quizBefore.id));
    assert.equal(questionAfter.explanation, adminExplanation);
    assert.equal(questionAfter.urednickiStatus, "odobreno");
    assert.equal(questionAfter.reviewedAt?.toISOString(), adminReviewedAt.toISOString());
    assert.equal(quizAfter.isPublished, false);
  } finally {
    await db.update(pitanjaBankaTable)
      .set({
        objasnjenje: questionBefore.explanation,
        urednickiStatus: questionBefore.urednickiStatus,
        reviewedAt: questionBefore.reviewedAt,
      })
      .where(eq(pitanjaBankaTable.id, questionBefore.id));
    await db.update(kvizoviTable)
      .set({ isPublished: quizBefore.isPublished })
      .where(eq(kvizoviTable.id, quizBefore.id));
  }
});