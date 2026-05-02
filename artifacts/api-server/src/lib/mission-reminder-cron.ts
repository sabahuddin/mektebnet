import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendPushNotification } from "./push.js";
import { logger } from "./logger.js";

// Task #101 — Podsjetnik za misiju: svako jutro/popodne (17:00 lokalno
// Sarajevo vrijeme) skenira sve aktivne učenike koji još nisu završili
// nijednu od današnjih daily misija i šalje im push notifikaciju.
//
// Anti-spam pravila:
//   - samo aktivni korisnici (users.is_active = TRUE)
//   - profil nije arhiviran (ucenik_profili.is_archived = FALSE)
//   - korisnik se logirao u zadnjih 30 dana (users.last_login_at)
//   - korisnik ima barem 1 push token registrovan (push_tokens) — bez tokena
//     se push efektivno smatra "isključenim"
//   - nije završio nijednu aktivnu daily misiju za današnji period_key

const REMINDER_HOUR_LOCAL = 17; // 17:00 Europe/Sarajevo
const REMINDER_TZ = "Europe/Sarajevo";
const TICK_MS = 60 * 1000; // provjera svakih 60s

// Dnevni period key u DB-u (misija_progress.period_key) je UTC YYYY-MM-DD —
// vidi `getDailyKey` u routes/misije.ts. U 17:00 Sarajevo (UTC+1/+2) UTC je
// 15:00 ili 16:00, dakle isti datum, pa direktno koristimo UTC slice.
function getUtcDailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// Lokalni datum u Sarajevu (svedo na YYYY-MM-DD u sv-SE locale-u koji daje
// ISO format) — koristi se SAMO za dedupe (last-run guard) tako da ne
// fire-amo dva puta u istom lokalnom danu.
function getSarajevoDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: REMINDER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getSarajevoHour(date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: REMINDER_TZ,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return parseInt(h, 10);
}

let lastRunLocalDate: string | null = null;

interface JobResult {
  targeted: number;
  dailyMissionCount: number;
  periodKey: string;
}

export async function runMissionReminderJob(): Promise<JobResult> {
  const periodKey = getUtcDailyKey();

  // Aktivni učenici sa push tokenima koji u zadnjih 30 dana nisu završili
  // nijednu aktivnu daily misiju za današnji period.
  //
  // NOT EXISTS klauzula: ako postoji misija_progress red sa completed_at
  // != NULL za bilo koju aktivnu daily misiju u današnjem period_key, učenik
  // je "uradio danas" i preskačemo ga.
  const result = await db.execute(sql`
    SELECT u.id
    FROM users u
    JOIN ucenik_profili up ON up.user_id = u.id
    WHERE u.role = 'ucenik'
      AND u.is_active = TRUE
      AND up.is_archived = FALSE
      AND u.last_login_at IS NOT NULL
      AND u.last_login_at >= NOW() - INTERVAL '30 days'
      AND EXISTS (
        SELECT 1 FROM push_tokens pt WHERE pt.user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM misija_progress mp
        JOIN misija_definicija md
          ON md.id = mp.misija_id
         AND md.tip = 'dnevna'
         AND md.aktivna = TRUE
        WHERE mp.user_id = u.id
          AND mp.period_key = ${periodKey}
          AND mp.completed_at IS NOT NULL
      )
  `);

  const rows = (result as unknown as { rows: { id: number }[] }).rows;
  const userIds = rows.map((r) => r.id);

  // Broj aktivnih daily misija — ako ih nema uopšte, nema smisla slati podsjetnik.
  const cntRes = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM misija_definicija
    WHERE aktivna = TRUE AND tip = 'dnevna'
  `);
  const dailyMissionCount = Number(
    (cntRes as unknown as { rows: { c: number }[] }).rows[0]?.c ?? 0,
  );

  if (dailyMissionCount === 0) {
    logger.info("[Mission reminder] Nema aktivnih daily misija — preskačem");
    return { targeted: 0, dailyMissionCount: 0, periodKey };
  }

  if (userIds.length === 0) {
    logger.info({ periodKey }, "[Mission reminder] Nema učenika za podsjetnik");
    return { targeted: 0, dailyMissionCount, periodKey };
  }

  await sendPushNotification({
    userIds,
    title: "🎯 Tvoja misija te čeka",
    body: "Tvoja današnja misija te čeka — uradi za samo 5 minuta!",
    url: "/ucenik",
    data: { type: "misija_reminder", periodKey },
  });

  logger.info(
    { targeted: userIds.length, dailyMissionCount, periodKey },
    "[Mission reminder] Podsjetnik poslan",
  );
  return { targeted: userIds.length, dailyMissionCount, periodKey };
}

// Tick svake minute. Kad lokalni sat (Sarajevo) postane 17 i još nismo
// pokrenuli za današnji lokalni datum, fire-amo posao. Korištenje lokalnog
// datuma kao guard-a osigurava da restart servera u 17:30 ne pokreće posao
// drugi put istog dana.
export function startMissionReminderCron(): void {
  const tick = async (): Promise<void> => {
    try {
      const now = new Date();
      const localHour = getSarajevoHour(now);
      const localDate = getSarajevoDateKey(now);
      if (localHour !== REMINDER_HOUR_LOCAL) return;
      if (lastRunLocalDate === localDate) return;
      lastRunLocalDate = localDate;
      await runMissionReminderJob();
    } catch (err) {
      logger.error({ err }, "[Mission reminder] Tick greška");
    }
  };

  // .unref() — timer ne drži event loop živim (graceful shutdown radi normalno).
  const handle = setInterval(tick, TICK_MS);
  if (typeof handle.unref === "function") handle.unref();
  logger.info(
    { reminderHourLocal: REMINDER_HOUR_LOCAL, tz: REMINDER_TZ, tickMs: TICK_MS },
    "[Mission reminder] Cron pokrenut",
  );
}
