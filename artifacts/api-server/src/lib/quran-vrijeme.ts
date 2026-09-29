import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function getQuranVrijeme(userId: number) {
  // Danas i prethodnih šest kalendarskih dana, po vremenu mekteba (Europe/Zurich).
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(seconds), 0) AS ukupno,
      COALESCE(SUM(seconds) FILTER (
        WHERE dan >= (NOW() AT TIME ZONE 'Europe/Zurich')::date - 6
      ), 0) AS zadnjih_sedam_dana
    FROM quran_vrijeme_dnevno
    WHERE user_id = ${userId}
  `);
  const row = result.rows[0] as { ukupno: string; zadnjih_sedam_dana: string } | undefined;
  return {
    totalSeconds: Number(row?.ukupno ?? 0),
    last7DaysSeconds: Number(row?.zadnjih_sedam_dana ?? 0),
  };
}