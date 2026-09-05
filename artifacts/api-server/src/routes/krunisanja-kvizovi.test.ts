import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { inArray, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  kvizoviTable,
  kvizPitanjaTable,
  pitanjaBankaTable,
} from "@workspace/db/schema";
import {
  bootstrapDrizzleMigrations,
  runDrizzleMigrate,
} from "../lib/drizzle-migrate.js";
import { resolveKrunisanjePitanjaIds } from "./krunisanja.js";

const suffix = `krunisanje-kvizovi-${Date.now()}`;
const quizIds: number[] = [];
const questionIds: number[] = [];

before(async () => {
  await bootstrapDrizzleMigrations();
  await runDrizzleMigrate();
});

after(async () => {
  if (quizIds.length > 0 || questionIds.length > 0) {
    await db.delete(kvizPitanjaTable).where(or(
      inArray(kvizPitanjaTable.kvizId, quizIds),
      inArray(kvizPitanjaTable.pitanjeId, questionIds),
    ));
  }
  if (quizIds.length > 0) await db.delete(kvizoviTable).where(inArray(kvizoviTable.id, quizIds));
  if (questionIds.length > 0) await db.delete(pitanjaBankaTable).where(inArray(pitanjaBankaTable.id, questionIds));
});

test("Krunisanje sastavlja cijele kvizove bez duplih pitanja", async () => {
  const questions = await db.insert(pitanjaBankaTable).values([
    { pitanje: `${suffix}-A`, opcije: ["Da", "Ne"], correctIndex: 0 },
    { pitanje: `${suffix}-B`, opcije: ["Da", "Ne"], correctIndex: 0 },
    { pitanje: `${suffix}-C`, opcije: ["Da", "Ne"], correctIndex: 0 },
    { pitanje: `${suffix}-ručno`, opcije: ["Da", "Ne"], correctIndex: 0 },
  ]).returning({ id: pitanjaBankaTable.id });
  questionIds.push(...questions.map((question) => question.id));

  const quizzes = await db.insert(kvizoviTable).values([
    { slug: `${suffix}-1`, naslov: "Etapni kviz 1", nivo: 1, etapa: 1, modul: "ilmihal", isPublished: false },
    { slug: `${suffix}-2`, naslov: "Etapni kviz 2", nivo: 1, etapa: 2, modul: "ilmihal", isPublished: false },
  ]).returning({ id: kvizoviTable.id });
  quizIds.push(...quizzes.map((quiz) => quiz.id));

  await db.insert(kvizPitanjaTable).values([
    { kvizId: quizzes[0].id, pitanjeId: questions[1].id, redoslijed: 1 },
    { kvizId: quizzes[0].id, pitanjeId: questions[0].id, redoslijed: 2 },
    { kvizId: quizzes[1].id, pitanjeId: questions[0].id, redoslijed: 1 },
    { kvizId: quizzes[1].id, pitanjeId: questions[2].id, redoslijed: 2 },
  ]);

  const result = await resolveKrunisanjePitanjaIds({
    kvizIds: [quizzes[0].id, quizzes[1].id],
    kvizPitanjaIds: [questions[3].id],
  });

  assert.deepEqual(result, [
    questions[3].id,
    questions[1].id,
    questions[0].id,
    questions[2].id,
  ]);
});