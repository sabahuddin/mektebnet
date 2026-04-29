// Katalog bedževa za učenike. Auto-dodjela na osnovu napretka.
// Bedževi se čuvaju u student_progress.badges kao array { id, earnedAt }.
// Evaluacija je idempotentna — može se zvati pri svakom updateu napretka.

import { db } from "@workspace/db";
import {
  studentProgressTable,
  ilmihalLekcijeTable,
  kvizRezultatiTable,
} from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";

export interface BadgeMeta {
  id: string;
  naziv: string;
  opis: string;
  ikona: string; // emoji
  bojaGradient: string; // tailwind from-X to-Y
  uslov: string; // human-readable
}

export const BADGE_CATALOG: Record<string, BadgeMeta> = {
  prvi_korak: {
    id: "prvi_korak",
    naziv: "Prvi koraci",
    opis: "Završio si svoju prvu lekciju",
    ikona: "🌱",
    bojaGradient: "from-emerald-400 to-teal-500",
    uslov: "1 lekcija",
  },
  lekcije_10: {
    id: "lekcije_10",
    naziv: "Marljivi učenik",
    opis: "Završio si 10 lekcija",
    ikona: "📚",
    bojaGradient: "from-blue-400 to-indigo-500",
    uslov: "10 lekcija",
  },
  lekcije_30: {
    id: "lekcije_30",
    naziv: "Vrijedni hafiz znanja",
    opis: "Završio si 30 lekcija",
    ikona: "📖",
    bojaGradient: "from-indigo-400 to-purple-500",
    uslov: "30 lekcija",
  },
  lekcije_50: {
    id: "lekcije_50",
    naziv: "Posvećenik znanja",
    opis: "Završio si 50 lekcija",
    ikona: "🎓",
    bojaGradient: "from-purple-400 to-violet-600",
    uslov: "50 lekcija",
  },
  lekcije_100: {
    id: "lekcije_100",
    naziv: "Mali huffaz",
    opis: "Završio si 100 lekcija",
    ikona: "🏆",
    bojaGradient: "from-yellow-400 to-orange-500",
    uslov: "100 lekcija",
  },
  streak_3: {
    id: "streak_3",
    naziv: "Postojanost",
    opis: "Učio si 3 dana zaredom",
    ikona: "🔥",
    bojaGradient: "from-orange-400 to-red-500",
    uslov: "3 dana zaredom",
  },
  streak_7: {
    id: "streak_7",
    naziv: "Sedmica posvećenosti",
    opis: "Učio si 7 dana zaredom",
    ikona: "🔥",
    bojaGradient: "from-red-500 to-pink-600",
    uslov: "7 dana zaredom",
  },
  streak_30: {
    id: "streak_30",
    naziv: "Mjesec discipline",
    opis: "Učio si 30 dana zaredom",
    ikona: "💎",
    bojaGradient: "from-cyan-400 to-blue-600",
    uslov: "30 dana zaredom",
  },
  hasanati_500: {
    id: "hasanati_500",
    naziv: "500 hasanata",
    opis: "Sakupio si 500 hasanata",
    ikona: "✨",
    bojaGradient: "from-amber-400 to-yellow-600",
    uslov: "500 hasanata",
  },
  hasanati_1000: {
    id: "hasanati_1000",
    naziv: "1000 hasanata",
    opis: "Sakupio si 1000 hasanata",
    ikona: "⭐",
    bojaGradient: "from-yellow-500 to-amber-700",
    uslov: "1000 hasanata",
  },
  prvi_kviz: {
    id: "prvi_kviz",
    naziv: "Prvi kviz",
    opis: "Riješio si svoj prvi kviz",
    ikona: "🧠",
    bojaGradient: "from-sky-400 to-cyan-500",
    uslov: "1 kviz",
  },
  kvizovi_10: {
    id: "kvizovi_10",
    naziv: "10 kvizova",
    opis: "Riješio si 10 kvizova",
    ikona: "🎯",
    bojaGradient: "from-fuchsia-400 to-pink-500",
    uslov: "10 kvizova",
  },
  kviz_majstor: {
    id: "kviz_majstor",
    naziv: "Kviz majstor",
    opis: "10 kvizova sa rezultatom 80% ili više",
    ikona: "🥇",
    bojaGradient: "from-amber-500 to-orange-600",
    uslov: "10 kvizova ≥ 80%",
  },
  nivo_1_complete: {
    id: "nivo_1_complete",
    naziv: "Svršeni početnik",
    opis: "Završio si sve lekcije nivoa 1",
    ikona: "🥉",
    bojaGradient: "from-emerald-500 to-green-700",
    uslov: "Sve lekcije nivoa 1",
  },
  nivo_2_complete: {
    id: "nivo_2_complete",
    naziv: "Napredni učenik",
    opis: "Završio si sve lekcije nivoa 2",
    ikona: "🥈",
    bojaGradient: "from-blue-500 to-indigo-700",
    uslov: "Sve lekcije nivoa 2",
  },
  nivo_3_complete: {
    id: "nivo_3_complete",
    naziv: "Hafiz ilmihala",
    opis: "Završio si sve lekcije nivoa 3",
    ikona: "🥇",
    bojaGradient: "from-violet-500 to-purple-700",
    uslov: "Sve lekcije nivoa 3",
  },
};

export interface EarnedBadge {
  id: string;
  earnedAt: string; // ISO date
}

export interface ProgressSnapshot {
  totalHasanat: number;
  completedCount: number;
  streakDays: number;
  completedByNivo: Record<number, { gotov: number; ukupno: number }>;
  quizCount: number;
  quizPassedCount: number; // procenat >= 80
}

/**
 * Vrati listu bedževa koje učenik treba imati na osnovu trenutnog napretka.
 * Idempotentno — može se zvati pri svakom updateu.
 */
export function computeEarnedBadgeIds(snap: ProgressSnapshot): string[] {
  const ids: string[] = [];

  if (snap.completedCount >= 1) ids.push("prvi_korak");
  if (snap.completedCount >= 10) ids.push("lekcije_10");
  if (snap.completedCount >= 30) ids.push("lekcije_30");
  if (snap.completedCount >= 50) ids.push("lekcije_50");
  if (snap.completedCount >= 100) ids.push("lekcije_100");

  if (snap.streakDays >= 3) ids.push("streak_3");
  if (snap.streakDays >= 7) ids.push("streak_7");
  if (snap.streakDays >= 30) ids.push("streak_30");

  if (snap.totalHasanat >= 500) ids.push("hasanati_500");
  if (snap.totalHasanat >= 1000) ids.push("hasanati_1000");

  if (snap.quizCount >= 1) ids.push("prvi_kviz");
  if (snap.quizCount >= 10) ids.push("kvizovi_10");
  if (snap.quizPassedCount >= 10) ids.push("kviz_majstor");

  for (const nivo of [1, 2, 3]) {
    const n = snap.completedByNivo[nivo];
    if (n && n.ukupno > 0 && n.gotov >= n.ukupno) {
      ids.push(`nivo_${nivo}_complete`);
    }
  }

  return ids;
}

/**
 * Spoji postojeće zarađene bedževe sa novo zarađenima.
 * Vrati { merged, novelyEarned } gdje su novelyEarned ID-evi koji su tek sad osvojeni.
 */
export function mergeBadges(
  existing: unknown,
  earnedIds: string[],
): { merged: EarnedBadge[]; novelyEarned: string[] } {
  const arr: EarnedBadge[] = Array.isArray(existing)
    ? (existing as any[]).filter(b => b && typeof b.id === "string" && typeof b.earnedAt === "string")
    : [];
  const existingIds = new Set(arr.map(b => b.id));
  const novelyEarned: string[] = [];
  const now = new Date().toISOString();

  for (const id of earnedIds) {
    if (!existingIds.has(id)) {
      arr.push({ id, earnedAt: now });
      novelyEarned.push(id);
    }
  }

  return { merged: arr, novelyEarned };
}

/**
 * Izvuci snapshot napretka za korisnika iz baze i vrati ga u obliku pogodnom za computeEarnedBadgeIds.
 */
export async function buildProgressSnapshot(userId: number, overrides?: { totalHasanatOverride?: number }): Promise<ProgressSnapshot> {
  const studentIdStr = String(userId);
  const [progress] = await db.select().from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);

  const completedLessonIds = (progress?.completedLessons as number[] | undefined) || [];
  const totalHasanat = overrides?.totalHasanatOverride ?? (progress?.totalHasanat || 0);
  const streakDays = progress?.streakDays || 0;

  const allLekcije = await db.select({ id: ilmihalLekcijeTable.id, nivo: ilmihalLekcijeTable.nivo })
    .from(ilmihalLekcijeTable);
  const idToNivo = new Map(allLekcije.map(r => [r.id, r.nivo]));
  const completedByNivo: Record<number, { gotov: number; ukupno: number }> = {};
  for (const r of allLekcije) {
    if (!completedByNivo[r.nivo]) completedByNivo[r.nivo] = { gotov: 0, ukupno: 0 };
    completedByNivo[r.nivo].ukupno++;
  }
  for (const lid of completedLessonIds) {
    const nv = idToNivo.get(lid);
    if (nv != null && completedByNivo[nv]) completedByNivo[nv].gotov++;
  }

  const quizRows = await db.select({ procenat: kvizRezultatiTable.procenat })
    .from(kvizRezultatiTable)
    .where(eq(kvizRezultatiTable.userId, userId));
  const quizCount = quizRows.length;
  const quizPassedCount = quizRows.filter(r => (r.procenat || 0) >= 80).length;

  return {
    totalHasanat,
    completedCount: completedLessonIds.length,
    streakDays,
    completedByNivo,
    quizCount,
    quizPassedCount,
  };
}

export interface NovelyEarnedBadgeInfo extends BadgeMeta {
  earnedAt: string;
}

/**
 * Glavna funkcija: izračunaj nove bedževe i pohrani ih u student_progress.badges.
 * Vrati listu metapodataka za novo zarađene bedževe (za toast notifikaciju u UI).
 * Idempotentno — sigurno za pozivati nakon svake aktivnosti.
 */
export async function evaluateAndPersistBadges(userId: number, overrides?: { totalHasanatOverride?: number }): Promise<NovelyEarnedBadgeInfo[]> {
  const studentIdStr = String(userId);
  const [progress] = await db.select().from(studentProgressTable)
    .where(eq(studentProgressTable.studentId, studentIdStr)).limit(1);
  if (!progress) return [];

  const snap = await buildProgressSnapshot(userId, overrides);
  const earnedIds = computeEarnedBadgeIds(snap);
  const { merged, novelyEarned } = mergeBadges(progress.badges, earnedIds);

  if (novelyEarned.length > 0) {
    await db.update(studentProgressTable)
      .set({ badges: merged, updatedAt: new Date() })
      .where(eq(studentProgressTable.studentId, studentIdStr));
  }

  const now = new Date().toISOString();
  return novelyEarned
    .map(id => {
      const meta = BADGE_CATALOG[id];
      if (!meta) return null;
      return { ...meta, earnedAt: now };
    })
    .filter((b): b is NovelyEarnedBadgeInfo => b !== null);
}
