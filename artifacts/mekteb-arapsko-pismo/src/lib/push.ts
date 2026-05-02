import OneSignal from "react-onesignal";
import { apiRequest } from "@/lib/api";

const APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined) || "";
const SETTINGS_KEY = "mekteb-push-enabled";
const PROMPTED_KEY = "mekteb-push-prompted";

let initialized = false;
let initPromise: Promise<void> | null = null;

function isCapacitorNative(): boolean {
  return typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor !== "undefined"
    && !!(window as unknown as { Capacitor: { isNativePlatform?: () => boolean } }).Capacitor.isNativePlatform?.();
}

function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative()) return false; // mobile koristi native plugin (Phase 5)
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * OneSignal Web SDK je konfigurisan za site `https://mekteb.net` u dashboard-u.
 * Init na bilo kojem drugom origin-u (npr. Replit dev preview, localhost) baca
 * grešku "Can only be used on: https://.mekteb.net". Skip-ujemo init lokalno
 * da ne zatrpavamo konzolu greškama. Push se može testirati tek na produkciji.
 *
 * Ako želiš testirati lokalno: idi na OneSignal dashboard → Settings → Web
 * Configuration → "Site URL" i dodaj dev origin u "Additional URLs".
 */
function isAllowedOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "mekteb.net" || host.endsWith(".mekteb.net");
}

export async function initOneSignal(): Promise<void> {
  if (!APP_ID) {
    console.warn("[Push] VITE_ONESIGNAL_APP_ID nije postavljen");
    return;
  }
  if (!isPushSupported()) return;
  if (!isAllowedOrigin()) {
    console.info("[Push] OneSignal disabled — origin nije mekteb.net (push radi samo na produkciji)");
    return;
  }
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await OneSignal.init({
        appId: APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: false },
      });
      initialized = true;
      console.log("[Push] OneSignal initialized");
    } catch (err) {
      console.error("[Push] Init failed:", err);
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Poveži OneSignal subscription sa našim user ID-jem (external_id alias)
 * i registruj playerId u backend-u da možemo slati notifikacije.
 *
 * Pozvati nakon login-a. Ako korisnik još nije dao permission, samo se
 * postavlja alias; permission prompt ide kroz `requestPushPermission()`.
 */
export async function loginPushUser(userId: number): Promise<void> {
  if (!isPushSupported()) return;
  // Sačekaj da init završi (npr. ako je auth restore brži od init-a) — bez ovoga
  // bi pozivi nakon refresh-a često skipovali alias jer initialized=false još.
  if (!initialized) {
    if (initPromise) {
      await initPromise;
    } else {
      // Init nije ni krenuo (origin nije allowed, app id missing) — odustani tiho
      return;
    }
  }
  if (!initialized) return;

  try {
    await OneSignal.login(String(userId));

    if (OneSignal.User.PushSubscription.optedIn) {
      const playerId = OneSignal.User.PushSubscription.id;
      if (playerId) {
        await registerToken(playerId);
      }
    }
  } catch (err) {
    console.error("[Push] login failed:", err);
  }
}

export async function logoutPushUser(): Promise<void> {
  if (!initialized || !isPushSupported()) return;
  try {
    const playerId = OneSignal.User.PushSubscription.id;
    if (playerId) {
      try {
        await apiRequest("POST", "/push/unregister", { playerId });
      } catch {}
    }
    await OneSignal.logout();
  } catch (err) {
    console.error("[Push] logout failed:", err);
  }
}

export function isPushOptedIn(): boolean {
  if (!initialized || !isPushSupported()) return false;
  try {
    return OneSignal.User.PushSubscription.optedIn === true;
  } catch {
    return false;
  }
}

export function isPushEnabledLocally(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SETTINGS_KEY) !== "false"; // default true
}

export function setPushEnabledLocally(value: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, value ? "true" : "false");
}

export function hasBeenPrompted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PROMPTED_KEY) === "true";
}

export function markPrompted(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPTED_KEY, "true");
}

/**
 * Traži permission od korisnika i, ako je dao, registruje token u backend-u.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!initialized || !isPushSupported()) return false;
  try {
    markPrompted();
    await OneSignal.Notifications.requestPermission();
    if (OneSignal.User.PushSubscription.optedIn) {
      const playerId = OneSignal.User.PushSubscription.id;
      if (playerId) {
        await registerToken(playerId);
        setPushEnabledLocally(true);
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("[Push] permission request failed:", err);
    return false;
  }
}

export async function disablePush(): Promise<void> {
  if (!initialized || !isPushSupported()) return;
  try {
    const playerId = OneSignal.User.PushSubscription.id;
    if (playerId) {
      try {
        await apiRequest("POST", "/push/unregister", { playerId });
      } catch {}
    }
    OneSignal.User.PushSubscription.optOut();
    setPushEnabledLocally(false);
  } catch (err) {
    console.error("[Push] disable failed:", err);
  }
}

async function registerToken(playerId: string): Promise<void> {
  try {
    await apiRequest("POST", "/push/register", {
      playerId,
      platform: "web",
      userAgent: navigator.userAgent,
    });
    console.log("[Push] Token registered");
  } catch (err) {
    console.error("[Push] register failed:", err);
  }
}

/**
 * Listener — kad se subscription promijeni (npr. korisnik tek dao permission),
 * automatski registruj novi playerId u backend.
 */
export function setupPushListeners(): void {
  if (!initialized || !isPushSupported()) return;
  try {
    OneSignal.User.PushSubscription.addEventListener("change", (event: { current: { id?: string | null; optedIn?: boolean } }) => {
      const id = event.current?.id;
      const opted = event.current?.optedIn;
      if (opted && id) {
        registerToken(id).catch(() => {});
      }
    });
  } catch (err) {
    console.error("[Push] listener setup failed:", err);
  }
}
