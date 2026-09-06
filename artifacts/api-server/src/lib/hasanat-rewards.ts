import { db } from "@workspace/db";
import { studentProgressTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

export const ETAPA_MIN_PASS_PERCENT = 80;
export const ETAPA_REWARD_PERCENT_80 = 80;
export const ETAPA_REWARD_PERCENT_90 = 90;
export const ETAPA_REWARD_PERCENT_100 = 100;
export const KRUNISANJE_REWARD = 1000;
export const BADGE_REWARD = 50;

export function etapaHasanatReward(procenat: number): number {
  if (procenat >= 100) return ETAPA_REWARD_PERCENT_100;
  if (procenat >= 90) return ETAPA_REWARD_PERCENT_90;
  if (procenat >= ETAPA_MIN_PASS_PERCENT) return ETAPA_REWARD_PERCENT_80;
  return 0;
}

/**
 * Adds a one-time reward to the student's shared hasanat balance.
 * The update is atomic; the insert path covers students without a progress row.
 */
export async function addHasanatReward(
  studentId: string,
  amount: number,
): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) return 0;

  const [updated] = await db
    .update(studentProgressTable)
    .set({
      totalHasanat: sql`${studentProgressTable.totalHasanat} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(studentProgressTable.studentId, studentId))
    .returning({ totalHasanat: studentProgressTable.totalHasanat });

  if (updated) return updated.totalHasanat;

  const [created] = await db
    .insert(studentProgressTable)
    .values({
      studentId,
      totalHasanat: amount,
      completedLessons: [],
      badges: [],
      streakDays: 0,
    })
    .onConflictDoNothing()
    .returning({ totalHasanat: studentProgressTable.totalHasanat });

  if (created) return created.totalHasanat;

  const [retried] = await db
    .update(studentProgressTable)
    .set({
      totalHasanat: sql`${studentProgressTable.totalHasanat} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(studentProgressTable.studentId, studentId))
    .returning({ totalHasanat: studentProgressTable.totalHasanat });

  return retried?.totalHasanat ?? amount;
}