/**
 * Native push (iOS / Android) preko OneSignal Cordova plugin-a unutar Capacitor
 * shell-a. Web push (browser/PWA) je u `./push.ts` — ovaj modul se učitava
 * dinamički iz `push.ts` samo kad je `Capacitor.isNativePlatform() === true`,
 * tako da plugin nikad ne zagađuje web bundle.
 *
 * Preduvjeti za rad u produkciji:
 *   - APNs .p8 ključ uploadovan u OneSignal dashboard (iOS)
 *   - Firebase Service Account JSON uploadovan u OneSignal dashboard (Android)
 *   - `google-services.json` u `android/app/`
 *   - Push Notifications + Background Modes capabilities u Xcode-u
 *
 * Vidi `MOBILE-BUILD.md` → "Push notifikacije" za korak-po-korak setup.
 */
import OneSignal from "onesignal-cordova-plugin";
import { apiRequest } from "@/lib/api";
import { getStoredAuthToken } from "./push";

const APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined) || "";

let initialized = false;
let initPromise: Promise<void> | null = null;

function getPlatform(): "ios" | "android" | null {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === "ios" || p === "android") return p;
  return null;
}

async function registerToken(playerId: string): Promise<void> {
  const platform = getPlatform();
  if (!platform) return;
  try {
    await apiRequest("POST", "/push/register", {
      playerId,
      platform,
      userAgent: navigator.userAgent,
    }, getStoredAuthToken());
    console.log("[NativePush] Token registered", { platform });
  } catch (err) {
    console.error("[NativePush] register failed:", err);
  }
}

/**
 * Inicijaliziraj OneSignal native SDK. Bezbjedno za višestruko pozivanje.
 * Ne traži permission ovdje — to ide kroz `requestNativePushPermission()`.
 */
export async function initNativePush(): Promise<void> {
  if (!APP_ID) {
    console.warn("[NativePush] VITE_ONESIGNAL_APP_ID nije postavljen");
    return;
  }
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      OneSignal.initialize(APP_ID);

      // Subscription change listener — kad korisnik tek dā permission ili se
      // playerId promijeni, automatski registruj novi token u backend.
      OneSignal.User.pushSubscription.addEventListener("change", (event) => {
        const id = event?.current?.id;
        const opted = event?.current?.optedIn;
        if (opted && id) {
          registerToken(id).catch(() => {});
        }
      });

      initialized = true;
      console.log("[NativePush] OneSignal native SDK initialized");
    } catch (err) {
      console.error("[NativePush] Init failed:", err);
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Poveži OneSignal subscription sa našim user ID-jem (external_id alias) i,
 * ako je permission već dat, registruj playerId u backend-u.
 */
export async function loginNativePushUser(userId: number): Promise<void> {
  if (!initialized) {
    if (initPromise) {
      await initPromise;
    } else {
      return;
    }
  }
  if (!initialized) return;

  try {
    OneSignal.login(String(userId));

    if (OneSignal.User.pushSubscription.optedIn) {
      const playerId = OneSignal.User.pushSubscription.id;
      if (playerId) {
        await registerToken(playerId);
      }
    }
  } catch (err) {
    console.error("[NativePush] login failed:", err);
  }
}

export async function logoutNativePushUser(): Promise<void> {
  if (!initialized) return;
  try {
    const playerId = OneSignal.User.pushSubscription.id;
    if (playerId) {
      try {
        await apiRequest("POST", "/push/unregister", { playerId }, getStoredAuthToken());
      } catch {}
    }
    OneSignal.logout();
  } catch (err) {
    console.error("[NativePush] logout failed:", err);
  }
}

/**
 * Pokreni native OS permission prompt (iOS sistemski popup, Android 13+ POST_NOTIFICATIONS
 * runtime permission). Vraća `true` ako je korisnik dao permission i token je registrovan.
 */
export async function requestNativePushPermission(): Promise<boolean> {
  if (!initialized) return false;
  try {
    const accepted = await OneSignal.Notifications.requestPermission(true);
    if (!accepted) return false;

    // Sačekaj kratko da SDK kreira subscription, pa registruj playerId u backend.
    // Subscription change listener će ovo ionako uhvatiti, ali ovdje radimo i
    // sinhroni pokušaj da prompt UI dobije pravilan rezultat.
    for (let i = 0; i < 10; i++) {
      const playerId = OneSignal.User.pushSubscription.id;
      if (playerId) {
        await registerToken(playerId);
        return true;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return true;
  } catch (err) {
    console.error("[NativePush] permission request failed:", err);
    return false;
  }
}

export async function disableNativePush(): Promise<void> {
  if (!initialized) return;
  try {
    const playerId = OneSignal.User.pushSubscription.id;
    if (playerId) {
      try {
        await apiRequest("POST", "/push/unregister", { playerId }, getStoredAuthToken());
      } catch {}
    }
    OneSignal.User.pushSubscription.optOut();
  } catch (err) {
    console.error("[NativePush] disable failed:", err);
  }
}

export function isNativePushOptedIn(): boolean {
  if (!initialized) return false;
  try {
    return OneSignal.User.pushSubscription.optedIn === true;
  } catch {
    return false;
  }
}

/**
 * Da li je sistemski permission već granted (bez triggeranja prompta).
 * Koristi se da odlučimo da li uopšte prikazati in-app banner za uključivanje.
 */
export async function getNativePermissionState(): Promise<"granted" | "denied" | "default"> {
  if (!initialized) return "default";
  try {
    const enabled = await OneSignal.Notifications.getPermissionAsync();
    return enabled ? "granted" : "default";
  } catch {
    return "default";
  }
}
