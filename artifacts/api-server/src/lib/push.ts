import { db } from "@workspace/db";
import { pushTokensTable } from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

const isConfigured = () => {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("[Push] OneSignal not configured (missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)");
    return false;
  }
  return true;
};

export interface PushOptions {
  userIds: number[];
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Pošalji push notifikaciju listi korisnika. Greška se ne propagira (best-effort).
 *
 * Koristi OneSignal `include_aliases` sa external_id (što je naš `userId.toString()`).
 * Da bi ovo radilo, frontend mora pozvati `OneSignal.login(userId.toString())` nakon
 * uspješnog auth-a — vidi `src/lib/push.ts` na frontu.
 *
 * Fallback: ako out-of-sync alias ne postoji, šaljemo direktno na sve aktivne
 * `playerId`-ove iz `push_tokens` tabele.
 */
export async function sendPushNotification(opts: PushOptions): Promise<boolean> {
  if (!isConfigured()) return false;
  if (opts.userIds.length === 0) return false;

  // Prvo pokušaj sa external_id (alias) — ovo radi za sve uređaje datog korisnika
  // automatski, bez da moramo držati svaki playerId.
  const aliases = opts.userIds.map(String);

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: "push",
    include_aliases: { external_id: aliases },
    contents: { en: opts.body, bs: opts.body },
    headings: { en: opts.title, bs: opts.title },
    url: opts.url,
    data: opts.data,
  };

  try {
    const res = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Push] OneSignal API error ${res.status}:`, errText);

      // Fallback: ako alias nije pronađen, probaj sa direktnim playerId-jevima
      if (res.status === 400 || res.status === 404) {
        return await sendByPlayerIds(opts);
      }
      return false;
    }

    const json = await res.json() as { id?: string; recipients?: number; errors?: unknown };
    if (json.errors) {
      console.warn(`[Push] OneSignal partial error:`, json.errors);
    }
    console.log(`[Push] Sent to ${opts.userIds.length} user(s) — recipients=${json.recipients ?? "?"} id=${json.id}`);
    return true;
  } catch (err) {
    console.error("[Push] Failed to send notification:", err);
    return false;
  }
}

async function sendByPlayerIds(opts: PushOptions): Promise<boolean> {
  try {
    const tokens = await db
      .select({ playerId: pushTokensTable.playerId })
      .from(pushTokensTable)
      .where(inArray(pushTokensTable.userId, opts.userIds));

    if (tokens.length === 0) {
      console.log(`[Push] No registered tokens for users: ${opts.userIds.join(",")}`);
      return false;
    }

    const playerIds = tokens.map(t => t.playerId);

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_subscription_ids: playerIds,
      contents: { en: opts.body, bs: opts.body },
      headings: { en: opts.title, bs: opts.title },
      url: opts.url,
      data: opts.data,
    };

    const res = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[Push] Fallback playerId send failed ${res.status}:`, await res.text());
      return false;
    }
    console.log(`[Push] Fallback sent to ${playerIds.length} playerId(s)`);
    return true;
  } catch (err) {
    console.error("[Push] Fallback failed:", err);
    return false;
  }
}

/**
 * Upiši ili ažuriraj playerId za korisnika. Ako se isti playerId već nalazi
 * pod drugim userom (npr. logout/login na istom uređaju), prepiše userId.
 */
export async function upsertPushToken(params: {
  userId: number;
  playerId: string;
  platform: string;
  userAgent: string;
}): Promise<void> {
  const { userId, playerId, platform, userAgent } = params;

  // Najprije obriši postojeće zapise za isti playerId pod bilo kojim userom
  await db.delete(pushTokensTable).where(eq(pushTokensTable.playerId, playerId));

  await db.insert(pushTokensTable).values({
    userId,
    playerId,
    platform,
    userAgent: userAgent.slice(0, 500),
  });
}

/**
 * Obriši playerId, ali samo ako pripada datom korisniku. Ovo sprječava da
 * authentificirani korisnik A obriše token korisnika B ako mu je playerId
 * poznat ili pogođen.
 */
export async function deletePushToken(playerId: string, userId: number): Promise<void> {
  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.playerId, playerId), eq(pushTokensTable.userId, userId)));
}
