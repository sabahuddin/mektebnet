import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  etapaPolaganjaTable,
  ilmihalLekcijeTable,
  korisnikNapredakTable,
  kvizoviTable,
  kvizRezultatiTable,
  medaljoniTable,
  ocjeneTable,
  studentMedaljoniTable,
  studentProgressTable,
} from "@workspace/db/schema";

export interface GroupStatisticsDetails {
  id: number;
  lekcije: Array<{ id: number; naslov: string; nivo: number; slug: string }>;
  kvizovi: Array<{
    id: number; kvizId: number; naslov: string; nivo: number | null;
    procenat: number; tacniOdgovori: number; ukupnoPitanja: number;
    bodovi: number; datum: string | null;
  }>;
  ocjene: Array<{
    id: number; datum: string; predmet: string | null;
    lekcijaNaslov: string | null; ocjena: number | null;
    ocjenaOpisna: string | null; napomena: string | null;
  }>;
  etape: Array<{
    medaljonId: number; naziv: string; nivo: number; redoslijed: number;
    brojPokusaja: number; polozeno: boolean; najboljiProcenat: number;
  }>;
  medaljoni: Array<{ medaljonId: number; naziv: string; nivo: number; datum: string | null }>;
}

/** Call only with the active members of an already-authorized group.
 * Grades are the same canonical, school-year-filtered records as the summary.
 * Learning achievements are cumulative and do not reset each school year.
 */
export async function getGroupStatisticsDetails(
  studentIds: number[],
  quizResults: Array<typeof kvizRezultatiTable.$inferSelect>,
  grades: Array<typeof ocjeneTable.$inferSelect>,
): Promise<GroupStatisticsDetails[]> {
  if (!studentIds.length) return [];
  const stringIds = studentIds.map(String);
  const quizIds = [...new Set(quizResults.map(row => row.kvizId))];
  const [progress, completed, lessons, stages, earnedMedals, quizzes] = await Promise.all([
    db.select({ studentId: studentProgressTable.studentId, completedLessons: studentProgressTable.completedLessons })
      .from(studentProgressTable).where(inArray(studentProgressTable.studentId, stringIds)),
    db.select({ userId: korisnikNapredakTable.userId, contentId: korisnikNapredakTable.contentId })
      .from(korisnikNapredakTable).where(and(
        inArray(korisnikNapredakTable.userId, studentIds),
        eq(korisnikNapredakTable.contentType, "ilmihal"),
        eq(korisnikNapredakTable.zavrsen, true),
      )),
    db.select({
      id: ilmihalLekcijeTable.id, naslov: ilmihalLekcijeTable.naslov,
      nivo: ilmihalLekcijeTable.nivo, slug: ilmihalLekcijeTable.slug,
      redoslijed: ilmihalLekcijeTable.redoslijed,
    }).from(ilmihalLekcijeTable)
      .where(eq(ilmihalLekcijeTable.isPublished, true))
      .orderBy(asc(ilmihalLekcijeTable.nivo), asc(ilmihalLekcijeTable.redoslijed), asc(ilmihalLekcijeTable.id)),
    db.select({
      studentId: etapaPolaganjaTable.studentId, medaljonId: etapaPolaganjaTable.medaljonId,
      naziv: medaljoniTable.naziv, nivo: medaljoniTable.nivo,
      redoslijed: medaljoniTable.posAfterRedoslijed,
      polozeno: etapaPolaganjaTable.polozeno, procenat: etapaPolaganjaTable.procenat,
    }).from(etapaPolaganjaTable)
      .innerJoin(medaljoniTable, eq(medaljoniTable.id, etapaPolaganjaTable.medaljonId))
      .where(inArray(etapaPolaganjaTable.studentId, stringIds))
      .orderBy(asc(medaljoniTable.nivo), asc(medaljoniTable.posAfterRedoslijed)),
    db.select({
      studentId: studentMedaljoniTable.studentId, medaljonId: studentMedaljoniTable.medaljonId,
      naziv: medaljoniTable.naziv, nivo: medaljoniTable.nivo, earnedAt: studentMedaljoniTable.earnedAt,
    }).from(studentMedaljoniTable)
      .innerJoin(medaljoniTable, eq(medaljoniTable.id, studentMedaljoniTable.medaljonId))
      .where(inArray(studentMedaljoniTable.studentId, stringIds))
      .orderBy(asc(medaljoniTable.nivo), asc(medaljoniTable.posAfterRedoslijed)),
    quizIds.length
      ? db.select({ id: kvizoviTable.id, nivo: kvizoviTable.nivo })
          .from(kvizoviTable).where(inArray(kvizoviTable.id, quizIds))
      : Promise.resolve([]),
  ]);
  const details = new Map<number, GroupStatisticsDetails>(studentIds.map(id => [
    id, { id, lekcije: [], kvizovi: [], ocjene: [], etape: [], medaljoni: [] },
  ]));
  const completedByStudent = new Map<number, Set<number>>(studentIds.map(id => [id, new Set()]));
  for (const row of progress) {
    const ids = completedByStudent.get(Number(row.studentId));
    if (Array.isArray(row.completedLessons)) {
      for (const id of row.completedLessons) if (Number.isInteger(id)) ids?.add(id);
    }
  }
  // Both stores are written by lesson completion; legacy rows can exist in only
  // one of them. Union the IDs so a repeat or duplicate never adds a lesson.
  for (const row of completed) completedByStudent.get(row.userId)?.add(row.contentId);
  for (const [id, result] of details) {
    result.lekcije = lessons
      .filter(lesson => lesson.redoslijed > 0 && completedByStudent.get(id)?.has(lesson.id))
      .map(({ id: lessonId, naslov, nivo, slug }) => ({ id: lessonId, naslov, nivo, slug }));
  }
  const quizLevels = new Map(quizzes.map(quiz => [quiz.id, quiz.nivo]));
  for (const row of quizResults) {
    details.get(row.userId)?.kvizovi.push({
      id: row.id, kvizId: row.kvizId, naslov: row.kvizNaslov,
      nivo: quizLevels.get(row.kvizId) ?? null, procenat: row.procenat,
      tacniOdgovori: row.tacniOdgovori, ukupnoPitanja: row.ukupnoPitanja,
      bodovi: row.bodovi, datum: row.completedAt?.toISOString() ?? null,
    });
  }
  for (const row of grades) {
    details.get(row.ucenikId)?.ocjene.push({
      id: row.id, datum: row.datum, predmet: row.predmet ?? row.kategorija,
      lekcijaNaslov: row.lekcijaNaziv, ocjena: row.ocjena,
      ocjenaOpisna: row.ocjenaOpisna, napomena: row.napomena,
    });
  }
  const stageMaps = new Map<number, Map<number, GroupStatisticsDetails["etape"][number]>>();
  for (const row of stages) {
    const studentId = Number(row.studentId);
    if (!details.has(studentId)) continue;
    let studentStages = stageMaps.get(studentId);
    if (!studentStages) { studentStages = new Map(); stageMaps.set(studentId, studentStages); }
    const previous = studentStages.get(row.medaljonId);
    if (previous) {
      previous.brojPokusaja += 1;
      previous.polozeno ||= row.polozeno;
      previous.najboljiProcenat = Math.max(previous.najboljiProcenat, row.procenat);
    } else {
      studentStages.set(row.medaljonId, {
        medaljonId: row.medaljonId, naziv: row.naziv, nivo: row.nivo, redoslijed: row.redoslijed,
        brojPokusaja: 1, polozeno: row.polozeno, najboljiProcenat: row.procenat,
      });
    }
  }
  for (const [id, stagesByMedal] of stageMaps) details.get(id)!.etape = [...stagesByMedal.values()];
  for (const row of earnedMedals) {
    details.get(Number(row.studentId))?.medaljoni.push({
      medaljonId: row.medaljonId, naziv: row.naziv, nivo: row.nivo, datum: row.earnedAt.toISOString(),
    });
  }
  for (const row of details.values()) {
    row.kvizovi.sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "") || b.id - a.id);
    row.ocjene.sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
  }
  return [...details.values()];
}