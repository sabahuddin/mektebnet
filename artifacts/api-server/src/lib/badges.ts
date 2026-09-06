// Katalog bedževa za učenike. Auto-dodjela na osnovu napretka.
// Bedževi se čuvaju u student_progress.badges kao array { id, earnedAt }.
// Evaluacija je idempotentna — može se zvati pri svakom updateu napretka.
//
// NAPOMENA O NAZIVIMA: nazivi/opisi su usklađeni sa korisničkim prijedlogom
// (pčelarska tematika — košnice, saće, pčele). ID-jevi ostaju isti zbog
// historijskih podataka u student_progress.badges. Pragovi se nisu mijenjali
// osim novih dodatih nivoa (hasanati 100/250/2000/5000, kvizovi 5/25/50,
// bez_greske i sjajni_odgovori za 100% rezultate).

import { db } from "@workspace/db";
import {
  studentProgressTable,
  ilmihalLekcijeTable,
  kvizRezultatiTable,
  roditeljUcenikTable,
  porukeTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { BADGE_REWARD } from "./hasanat-rewards.js";

export interface BadgeMeta {
  id: string;
  naziv: string;
  opis: string;
  ikona: string; // emoji
  bojaGradient: string; // tailwind from-X to-Y
  uslov: string; // human-readable
}

export const BADGE_CATALOG: Record<string, BadgeMeta> = {
  // === PRVI KORACI ===
  prvi_korak: {
    id: "prvi_korak",
    naziv: "Prva kap meda",
    opis: "Završio si svoju prvu lekciju",
    ikona: "🍯",
    bojaGradient: "from-emerald-400 to-teal-500",
    uslov: "1 lekcija",
  },

  // === LEKCIJE (Ilmihal) ===
  lekcije_10: {
    id: "lekcije_10",
    naziv: "Prvačić",
    opis: "Završio si 10 lekcija",
    ikona: "📚",
    bojaGradient: "from-blue-400 to-indigo-500",
    uslov: "10 lekcija",
  },
  lekcije_30: {
    id: "lekcije_30",
    naziv: "Marljivi učenik",
    opis: "Završio si 30 lekcija",
    ikona: "📖",
    bojaGradient: "from-indigo-400 to-purple-500",
    uslov: "30 lekcija",
  },
  lekcije_50: {
    id: "lekcije_50",
    naziv: "Putnik znanja",
    opis: "Završio si 50 lekcija",
    ikona: "🎓",
    bojaGradient: "from-purple-400 to-violet-600",
    uslov: "50 lekcija",
  },
  lekcije_100: {
    id: "lekcije_100",
    naziv: "Mali hafiz",
    opis: "Završio si 100 lekcija",
    ikona: "🏆",
    bojaGradient: "from-yellow-400 to-orange-500",
    uslov: "100 lekcija",
  },

  // === STREAK (učenje uzastopno) ===
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

  // === AFERIMI / MED (hasanati) ===
  hasanati_100: {
    id: "hasanati_100",
    naziv: "100 kapi meda",
    opis: "Sakupio si 100 kapi meda",
    ikona: "🍯",
    bojaGradient: "from-amber-300 to-yellow-400",
    uslov: "100 kapi meda",
  },
  hasanati_250: {
    id: "hasanati_250",
    naziv: "Mala košnica",
    opis: "Sakupio si 250 kapi meda",
    ikona: "🐝",
    bojaGradient: "from-amber-400 to-yellow-500",
    uslov: "250 kapi meda",
  },
  hasanati_500: {
    id: "hasanati_500",
    naziv: "Pola košnice",
    opis: "Sakupio si 500 kapi meda",
    ikona: "🍯",
    bojaGradient: "from-amber-400 to-yellow-600",
    uslov: "500 kapi meda",
  },
  hasanati_1000: {
    id: "hasanati_1000",
    naziv: "Puna košnica",
    opis: "Sakupio si 1000 kapi meda",
    ikona: "🍯",
    bojaGradient: "from-yellow-500 to-amber-700",
    uslov: "1000 kapi meda",
  },
  hasanati_2000: {
    id: "hasanati_2000",
    naziv: "Saće na vidiku",
    opis: "Sakupio si 2000 kapi meda",
    ikona: "🟨",
    bojaGradient: "from-amber-500 to-orange-600",
    uslov: "2000 kapi meda",
  },
  hasanati_5000: {
    id: "hasanati_5000",
    naziv: "Zlatno saće",
    opis: "Sakupio si 5000 kapi meda",
    ikona: "🏵️",
    bojaGradient: "from-yellow-400 to-amber-600",
    uslov: "5000 kapi meda",
  },

  // === KVIZOVI (broj riješenih) ===
  prvi_kviz: {
    id: "prvi_kviz",
    naziv: "Prvi kviz riješen",
    opis: "Riješio si svoj prvi kviz",
    ikona: "🧠",
    bojaGradient: "from-sky-400 to-cyan-500",
    uslov: "1 kviz",
  },
  kvizovi_5: {
    id: "kvizovi_5",
    naziv: "Pet kvizova iza mene",
    opis: "Riješio si 5 kvizova",
    ikona: "🎯",
    bojaGradient: "from-cyan-400 to-sky-500",
    uslov: "5 kvizova",
  },
  kvizovi_10: {
    id: "kvizovi_10",
    naziv: "10 kvizova iza mene",
    opis: "Riješio si 10 kvizova",
    ikona: "🎯",
    bojaGradient: "from-fuchsia-400 to-pink-500",
    uslov: "10 kvizova",
  },
  kvizovi_25: {
    id: "kvizovi_25",
    naziv: "Kviz znalac",
    opis: "Riješio si 25 kvizova",
    ikona: "🧩",
    bojaGradient: "from-pink-500 to-rose-600",
    uslov: "25 kvizova",
  },
  kvizovi_50: {
    id: "kvizovi_50",
    naziv: "Kviz majstor",
    opis: "Riješio si 50 kvizova",
    ikona: "🥇",
    bojaGradient: "from-amber-500 to-orange-600",
    uslov: "50 kvizova",
  },

  // === KVIZOVI (kvalitet rezultata) ===
  // Historijski "kviz_majstor" — 10 kvizova ≥ 80%. Preimenovan u "Sjajni rezultati"
  // (sheet koristi "Kviz majstor" za 50 riješenih kvizova, novi `kvizovi_50`).
  kviz_majstor: {
    id: "kviz_majstor",
    naziv: "Sjajni rezultati",
    opis: "10 kvizova sa rezultatom 80% ili više",
    ikona: "🌟",
    bojaGradient: "from-amber-500 to-yellow-600",
    uslov: "10 kvizova ≥ 80%",
  },
  bez_greske: {
    id: "bez_greske",
    naziv: "Bez greške",
    opis: "Riješio si kviz sa 100% tačnih odgovora",
    ikona: "✨",
    bojaGradient: "from-emerald-400 to-green-600",
    uslov: "1 kviz sa 100%",
  },
  sjajni_odgovori: {
    id: "sjajni_odgovori",
    naziv: "Sjajni odgovori",
    opis: "5 kvizova sa 100% tačnih odgovora",
    ikona: "💫",
    bojaGradient: "from-teal-400 to-emerald-600",
    uslov: "5 kvizova sa 100%",
  },

  // === NIVOI ILMIHALA (pčelarska metafora) ===
  nivo_1_complete: {
    id: "nivo_1_complete",
    naziv: "Pčela radilica",
    opis: "Završio si sve lekcije nivoa 1",
    ikona: "🐝",
    bojaGradient: "from-emerald-500 to-green-700",
    uslov: "Sve lekcije nivoa 1",
  },
  nivo_2_complete: {
    id: "nivo_2_complete",
    naziv: "Vlasnik košnice",
    opis: "Završio si sve lekcije nivoa 2",
    ikona: "🍯",
    bojaGradient: "from-blue-500 to-indigo-700",
    uslov: "Sve lekcije nivoa 2",
  },
  nivo_3_complete: {
    id: "nivo_3_complete",
    naziv: "Matica",
    opis: "Završio si sve lekcije nivoa 3",
    ikona: "👑",
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
  quizPerfectCount: number; // procenat == 100
}

/**
 * Vrati listu bedževa koje učenik treba imati na osnovu trenutnog napretka.
 * Idempotentno — može se zvati pri svakom updateu.
 */
export interface BadgeProgress {
  current: number;
  target: number;
}

/**
 * Vrati napredak (current/target) za svaki bedž koji ima mjerljiv prag.
 * Bedževi bez mjerljivog praga se ne pojavljuju u rezultatu.
 * Korisno za prikaz "7 / 10" ispod uslova zaključanih bedževa.
 */
export function computeBadgeProgress(snap: ProgressSnapshot): Record<string, BadgeProgress> {
  const out: Record<string, BadgeProgress> = {};

  out.prvi_korak = { current: Math.min(snap.completedCount, 1), target: 1 };
  out.lekcije_10 = { current: Math.min(snap.completedCount, 10), target: 10 };
  out.lekcije_30 = { current: Math.min(snap.completedCount, 30), target: 30 };
  out.lekcije_50 = { current: Math.min(snap.completedCount, 50), target: 50 };
  out.lekcije_100 = { current: Math.min(snap.completedCount, 100), target: 100 };

  out.streak_3 = { current: Math.min(snap.streakDays, 3), target: 3 };
  out.streak_7 = { current: Math.min(snap.streakDays, 7), target: 7 };
  out.streak_30 = { current: Math.min(snap.streakDays, 30), target: 30 };

  out.hasanati_100 = { current: Math.min(snap.totalHasanat, 100), target: 100 };
  out.hasanati_250 = { current: Math.min(snap.totalHasanat, 250), target: 250 };
  out.hasanati_500 = { current: Math.min(snap.totalHasanat, 500), target: 500 };
  out.hasanati_1000 = { current: Math.min(snap.totalHasanat, 1000), target: 1000 };
  out.hasanati_2000 = { current: Math.min(snap.totalHasanat, 2000), target: 2000 };
  out.hasanati_5000 = { current: Math.min(snap.totalHasanat, 5000), target: 5000 };

  out.prvi_kviz = { current: Math.min(snap.quizCount, 1), target: 1 };
  out.kvizovi_5 = { current: Math.min(snap.quizCount, 5), target: 5 };
  out.kvizovi_10 = { current: Math.min(snap.quizCount, 10), target: 10 };
  out.kvizovi_25 = { current: Math.min(snap.quizCount, 25), target: 25 };
  out.kvizovi_50 = { current: Math.min(snap.quizCount, 50), target: 50 };
  out.kviz_majstor = { current: Math.min(snap.quizPassedCount, 10), target: 10 };
  out.bez_greske = { current: Math.min(snap.quizPerfectCount, 1), target: 1 };
  out.sjajni_odgovori = { current: Math.min(snap.quizPerfectCount, 5), target: 5 };

  for (const nivo of [1, 2, 3]) {
    const n = snap.completedByNivo[nivo];
    if (n && n.ukupno > 0) {
      out[`nivo_${nivo}_complete`] = { current: Math.min(n.gotov, n.ukupno), target: n.ukupno };
    }
  }

  return out;
}

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

  if (snap.totalHasanat >= 100) ids.push("hasanati_100");
  if (snap.totalHasanat >= 250) ids.push("hasanati_250");
  if (snap.totalHasanat >= 500) ids.push("hasanati_500");
  if (snap.totalHasanat >= 1000) ids.push("hasanati_1000");
  if (snap.totalHasanat >= 2000) ids.push("hasanati_2000");
  if (snap.totalHasanat >= 5000) ids.push("hasanati_5000");

  if (snap.quizCount >= 1) ids.push("prvi_kviz");
  if (snap.quizCount >= 5) ids.push("kvizovi_5");
  if (snap.quizCount >= 10) ids.push("kvizovi_10");
  if (snap.quizCount >= 25) ids.push("kvizovi_25");
  if (snap.quizCount >= 50) ids.push("kvizovi_50");
  if (snap.quizPassedCount >= 10) ids.push("kviz_majstor");
  if (snap.quizPerfectCount >= 1) ids.push("bez_greske");
  if (snap.quizPerfectCount >= 5) ids.push("sjajni_odgovori");

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
  const quizPerfectCount = quizRows.filter(r => (r.procenat || 0) >= 100).length;

  return {
    totalHasanat,
    completedCount: completedLessonIds.length,
    streakDays,
    completedByNivo,
    quizCount,
    quizPassedCount,
    quizPerfectCount,
  };
}

export interface NovelyEarnedBadgeInfo extends BadgeMeta {
  earnedAt: string;
  hasanatReward: number;
}

/**
 * Pošalji in-app obavijest (poruku) svim odobrenim roditeljima učenika kad
 * dijete osvoji nove bedževe. Best-effort: greške se logiraju, ne propagiraju.
 * Posiljatelj poruke je sam učenik (jedini "user" s prirodnim semantičkim
 * smislom za ovakvu obavijest — roditelj u inboxu vidi razgovor sa djetetom).
 */
async function notifyParentsOfNewBadges(
  studentId: number,
  novelyEarned: NovelyEarnedBadgeInfo[],
): Promise<void> {
  if (novelyEarned.length === 0) return;

  try {
    const veze = await db.select({ roditeljId: roditeljUcenikTable.roditeljId })
      .from(roditeljUcenikTable)
      .where(and(
        eq(roditeljUcenikTable.ucenikId, studentId),
        eq(roditeljUcenikTable.status, "approved"),
      ));
    if (veze.length === 0) return;

    const [ucenik] = await db.select({ displayName: usersTable.displayName })
      .from(usersTable).where(eq(usersTable.id, studentId)).limit(1);
    const ucenikIme = ucenik?.displayName || "Vaše dijete";

    const naslov = novelyEarned.length === 1
      ? `Novi bedž: ${novelyEarned[0].naziv}`
      : `Novi bedževi (${novelyEarned.length})`;

    const lista = novelyEarned
      .map(b => `${b.ikona} ${b.naziv} — ${b.opis}`)
      .join("\n");
    const sadrzaj = novelyEarned.length === 1
      ? `${ucenikIme} je osvojio/la novi bedž!\n\n${lista}`
      : `${ucenikIme} je osvojio/la nove bedževe!\n\n${lista}`;

    const values = veze.map(v => ({
      posiljateljId: studentId,
      primateljId: v.roditeljId,
      naslov,
      sadrzaj,
    }));

    await db.insert(porukeTable).values(values);
  } catch (err) {
    console.warn("[badges] notifyParentsOfNewBadges failed for studentId", studentId, err);
  }
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
      .set({
        badges: merged,
        totalHasanat: sql`${studentProgressTable.totalHasanat} + ${novelyEarned.length * BADGE_REWARD}`,
        updatedAt: new Date(),
      })
      .where(eq(studentProgressTable.studentId, studentIdStr));
  }

  const now = new Date().toISOString();
  const novelyEarnedInfo = novelyEarned
    .map(id => {
      const meta = BADGE_CATALOG[id];
      if (!meta) return null;
      return { ...meta, earnedAt: now, hasanatReward: BADGE_REWARD };
    })
    .filter((b): b is NovelyEarnedBadgeInfo => b !== null);

  if (novelyEarnedInfo.length > 0) {
    await notifyParentsOfNewBadges(userId, novelyEarnedInfo);
  }

  return novelyEarnedInfo;
}
