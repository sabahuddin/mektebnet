import { db, ucenikProfiliTable, zadaceStatusTable, zadaceTable, zadaceUceniciTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PROLONG_DAYS = 7;
const MAX_PROLONGATIONS = 3;
const FINAL_AGE_DAYS = 30;
const TICK_MS = 60 * 60 * 1000;

type LifecycleInput = {
  createdAt: Date;
  originalDeadline: string | null;
  currentDeadline: string | null;
  prolongCount: number;
  status: string;
  grade: number | null;
};

export type LifecycleAction =
  | { type: "none" }
  | { type: "prolong"; deadline: string; prolongCount: number }
  | { type: "close-unrealized" };

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function calculateHomeworkLifecycle(input: LifecycleInput, now = new Date()): LifecycleAction {
  if (input.grade !== null || input.status === "zavrseno") return { type: "none" };

  const today = dateKey(now);
  const createdKey = dateKey(input.createdAt);
  const finalDeadline = addDays(createdKey, FINAL_AGE_DAYS);
  if (today >= finalDeadline) return { type: "close-unrealized" };

  let deadline = input.currentDeadline || input.originalDeadline;
  let prolongCount = Math.max(0, input.prolongCount);
  if (!deadline || deadline >= today || prolongCount >= MAX_PROLONGATIONS) return { type: "none" };

  while (deadline < today && prolongCount < MAX_PROLONGATIONS) {
    deadline = addDays(deadline, PROLONG_DAYS);
    if (deadline > finalDeadline) deadline = finalDeadline;
    prolongCount += 1;
  }
  return { type: "prolong", deadline, prolongCount };
}

export async function runHomeworkLifecycleJob(now = new Date()): Promise<{ prolonged: number; closed: number }> {
  const homework = await db.select().from(zadaceTable).where(eq(zadaceTable.isActive, true));
  if (homework.length === 0) return { prolonged: 0, closed: 0 };

  const homeworkIds = homework.map(item => item.id);
  const groupIds = Array.from(new Set(homework.map(item => item.grupaId)));
  const [targets, profiles, statuses] = await Promise.all([
    db.select().from(zadaceUceniciTable).where(inArray(zadaceUceniciTable.zadacaId, homeworkIds)),
    db.select({ userId: ucenikProfiliTable.userId, grupaId: ucenikProfiliTable.grupaId })
      .from(ucenikProfiliTable)
      .where(and(
        inArray(ucenikProfiliTable.grupaId, groupIds),
        eq(ucenikProfiliTable.isArchived, false),
      )),
    db.select().from(zadaceStatusTable).where(inArray(zadaceStatusTable.zadacaId, homeworkIds)),
  ]);

  const targetsByHomework = new Map<number, number[]>();
  for (const target of targets) {
    const list = targetsByHomework.get(target.zadacaId) || [];
    list.push(target.ucenikId);
    targetsByHomework.set(target.zadacaId, list);
  }
  const studentsByGroup = new Map<number, number[]>();
  for (const profile of profiles) {
    if (profile.grupaId == null) continue;
    const list = studentsByGroup.get(profile.grupaId) || [];
    list.push(profile.userId);
    studentsByGroup.set(profile.grupaId, list);
  }
  const statusByRecipient = new Map(statuses.map(status => [`${status.zadacaId}:${status.ucenikId}`, status]));

  let prolonged = 0;
  let closed = 0;
  for (const task of homework) {
    if (!task.createdAt) continue;
    const explicitTargets = targetsByHomework.get(task.id) || [];
    const recipients = explicitTargets.length > 0 ? explicitTargets : (studentsByGroup.get(task.grupaId) || []);
    for (const studentId of recipients) {
      const existing = statusByRecipient.get(`${task.id}:${studentId}`);
      const action = calculateHomeworkLifecycle({
        createdAt: task.createdAt,
        originalDeadline: task.rokDo ?? null,
        currentDeadline: existing?.noviRok ?? null,
        prolongCount: existing?.prolongCount ?? 0,
        status: existing?.status ?? "na_cekanju",
        grade: existing?.ocjena ?? null,
      }, now);
      if (action.type === "none") continue;

      if (existing) {
        await db.update(zadaceStatusTable).set(action.type === "prolong"
          ? { noviRok: action.deadline, prolongCount: action.prolongCount, updatedAt: now }
          : { status: "zavrseno", uradjeno: false, reviewedAt: now, updatedAt: now },
        ).where(eq(zadaceStatusTable.id, existing.id));
      } else {
        await db.insert(zadaceStatusTable).values(action.type === "prolong"
          ? {
              zadacaId: task.id, ucenikId: studentId, muallimId: task.muallimId,
              noviRok: action.deadline, prolongCount: action.prolongCount,
              status: "na_cekanju", uradjeno: false, ocjena: null,
            }
          : {
              zadacaId: task.id, ucenikId: studentId, muallimId: task.muallimId,
              status: "zavrseno", uradjeno: false, ocjena: null, reviewedAt: now,
            });
      }
      if (action.type === "prolong") prolonged += 1;
      else closed += 1;
    }
    // Trideseti dan zadaća prestaje biti aktivna i više ne smije otključavati
    // povezanu lekciju. Pojedinačni statusi iznad ostaju historijski vidljivi.
    if (dateKey(now) >= addDays(dateKey(task.createdAt), FINAL_AGE_DAYS)) {
      await db.update(zadaceTable).set({ isActive: false }).where(eq(zadaceTable.id, task.id));
    }
  }
  return { prolonged, closed };
}

export function startHomeworkLifecycleCron(): void {
  const tick = async () => {
    try {
      const result = await runHomeworkLifecycleJob();
      if (result.prolonged || result.closed) logger.info(result, "[Zadaće] Automatski rokovi obrađeni");
    } catch (err) {
      logger.error({ err }, "[Zadaće] Automatska obrada rokova nije uspjela");
    }
  };
  void tick();
  const handle = setInterval(tick, TICK_MS);
  if (typeof handle.unref === "function") handle.unref();
  logger.info({ tickMs: TICK_MS }, "[Zadaće] Automatska obrada rokova pokrenuta");
}