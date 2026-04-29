// Katalog bedževa za učenike. Auto-dodjela na osnovu napretka.
// Bedževi se čuvaju u student_progress.badges kao array { id, earnedAt }.

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
    naziv: "Mještar ilmihala",
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
}

/**
 * Vrati listu bedževa koje učenik treba imati na osnovu trenutnog napretka.
 * Idempotentno — može se zvati pri svakom updateu.
 */
export function computeEarnedBadgeIds(snap: ProgressSnapshot): string[] {
  const ids: string[] = [];

  if (snap.completedCount >= 1) ids.push("prvi_korak");
  if (snap.completedCount >= 10) ids.push("lekcije_10");
  if (snap.completedCount >= 50) ids.push("lekcije_50");
  if (snap.completedCount >= 100) ids.push("lekcije_100");

  if (snap.streakDays >= 3) ids.push("streak_3");
  if (snap.streakDays >= 7) ids.push("streak_7");
  if (snap.streakDays >= 30) ids.push("streak_30");

  if (snap.totalHasanat >= 500) ids.push("hasanati_500");
  if (snap.totalHasanat >= 1000) ids.push("hasanati_1000");

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
