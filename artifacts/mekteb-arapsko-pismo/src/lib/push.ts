import OneSignal from "react-onesignal";
import { apiRequest } from "@/lib/api";

const BUILD_TIME_APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined) || "";
const SETTINGS_KEY = "mekteb-push-enabled";
const PROMPTED_KEY = "mekteb-push-prompted";
const TOKEN_KEY = "mekteb_token";

// App ID se dohvata pri init-u: prvo build-time vrijednost, pa fallback na
// backend endpoint ako Coolify nije dostavio env var pri kompajliranju.
let resolvedAppId: string = BUILD_TIME_APP_ID;

async function getAppId(): Promise<string> {
  if (resolvedAppId) return resolvedAppId;
  try {
    const res = await fetch("/api/push/config");
    if (res.ok) {
      const data = await res.json() as { appId?: string };
      resolvedAppId = data.appId || "";
    }
  } catch {}
  return resolvedAppId;
}

// Brza sinhronijska provjera (za UI) — tačna tek kad je init završio
export function isAppIdResolved(): boolean {
  return !!resolvedAppId;
}

/**
 * `/push/register` i `/push/unregister` su iza `requireAuth` middleware-a u
 * backend-u, pa apiRequest mora primiti Bearer token. Token držimo u
 * localStorage pod istim ključem kao i `auth.tsx`. Ovaj helper se koristi i iz
 * `native-push.ts` da se izbjegne dupliciranje.
 */
export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let initialized = false;
let initPromise: Promise<void> | null = null;

// Zadnja stvarna greška (init ili permission) — UI je prikaže za dijagnostiku.
export let lastPushError: string = "";

function recordPushError(prefix: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  lastPushError = `${prefix}: ${msg}`;
}

export function isCapacitorNative(): boolean {
  return typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor !== "undefined"
    && !!(window as unknown as { Capacitor: { isNativePlatform?: () => boolean } }).Capacitor.isNativePlatform?.();
}

function isWebPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isCapacitorNative()) return false;
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

/**
 * Lazy-load native push modula samo kad smo zapravo na Capacitor native shell-u.
 * Ovo sprječava da `onesignal-cordova-plugin` (koji očekuje native bridge) uđe
 * u web bundle.
 */
async function getNative() {
  if (!isCapacitorNative()) return null;
  return await import("./native-push");
}

export async function initOneSignal(): Promise<void> {
  // Native (iOS/Android Capacitor): rutiraj na native modul.
  const native = await getNative();
  if (native) {
    return native.initNativePush();
  }

  // Web/PWA tok ispod.
  if (!isWebPushSupported()) return;
  if (!isAllowedOrigin()) {
    console.info("[Push] OneSignal disabled — origin nije mekteb.net (push radi samo na produkciji)");
    return;
  }
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const appId = await getAppId();
      if (!appId) {
        console.warn("[Push] OneSignal App ID nije dostupan (ni build-time ni backend)");
        lastPushError = "App ID nije dostupan";
        initPromise = null;
        return;
      }
      await OneSignal.init({
        appId,
        allowLocalhostAsSecureOrigin: true,
        // App je PWA — VitePWA-in workbox SW drži scope "/". OneSignal worker
        // MORA na poseban scope, inače se dva SW-a pregaze i subscribe pada.
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/push/onesignal/" },
        // OneSignal type expects full notifyButton text dict even when disabled —
        // cast to any since we explicitly set enable:false (button never renders).
        notifyButton: { enable: false } as any,
      });
      initialized = true;
      console.log("[Push] OneSignal initialized");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // SDK je interno već inicijalizovan (npr. prethodni init pao NAKON
      // internog flaga) — tretiraj kao uspjeh i nastavi.
      if (/already initialized/i.test(msg)) {
        initialized = true;
        console.warn("[Push] SDK je već inicijalizovan — nastavljam");
        return;
      }
      console.error("[Push] Init failed:", err);
      recordPushError("Init", err);
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
  const native = await getNative();
  if (native) return native.loginNativePushUser(userId);

  if (!isWebPushSupported()) return;
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
  const native = await getNative();
  if (native) return native.logoutNativePushUser();

  if (!initialized || !isWebPushSupported()) return;
  try {
    const playerId = OneSignal.User.PushSubscription.id;
    if (playerId) {
      try {
        await apiRequest("POST", "/push/unregister", { playerId }, getStoredAuthToken());
      } catch {}
    }
    await OneSignal.logout();
  } catch (err) {
    console.error("[Push] logout failed:", err);
  }
}

export function isPushOptedIn(): boolean {
  if (isCapacitorNative()) {
    // Native check je sinhroni getter na pluginu, ali da ne držimo top-level
    // import, čitamo iz globala koji native-push održava preko event listener-a.
    // Za jednostavnost: vraćamo false ovdje i prepuštamo native-specific UI da
    // koristi `getNativePushOptedIn()` direktno ako treba.
    return false;
  }
  if (!initialized || !isWebPushSupported()) return false;
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
  markPrompted();

  const native = await getNative();
  if (native) {
    const ok = await native.requestNativePushPermission();
    if (ok) setPushEnabledLocally(true);
    return ok;
  }

  if (!isWebPushSupported()) return false;
  // Ako init nije završio (ili je ranije pao — npr. mreža, spor fetch App ID-a),
  // pokušaj ponovo sada. Bez ovoga klik na toggle tiho ne uradi ništa.
  if (!initialized) {
    try {
      await initOneSignal();
    } catch {}
  }
  if (!initialized) {
    if (!lastPushError) lastPushError = "OneSignal init nije uspio";
    return false;
  }
  try {
    lastPushError = "";
    await OneSignal.Notifications.requestPermission();
    // v16: dozvola ≠ subscription. Ako je subscription ranije opt-out-ovan
    // (ili nikad kreiran), mora se eksplicitno optIn() — bez ovoga optedIn
    // ostaje false iako je permission granted.
    try {
      if (!OneSignal.User.PushSubscription.optedIn) {
        await OneSignal.User.PushSubscription.optIn();
      }
    } catch (err) {
      console.warn("[Push] optIn failed:", err);
    }
    // OneSignal upisuje subscription asinhrono — pričekaj do ~5s da se pojavi
    // playerId (bez ovoga toggle zna vratiti false iako je korisnik dozvolio).
    for (let i = 0; i < 10; i++) {
      if (OneSignal.User.PushSubscription.optedIn) {
        const playerId = OneSignal.User.PushSubscription.id;
        if (playerId) {
          await registerToken(playerId);
          setPushEnabledLocally(true);
          return true;
        }
      }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!lastPushError) {
      const perm = typeof Notification !== "undefined" ? Notification.permission : "?";
      const opted = (() => { try { return String(OneSignal.User.PushSubscription.optedIn); } catch { return "?"; } })();
      const pid = (() => { try { return OneSignal.User.PushSubscription.id ? "ima" : "nema"; } catch { return "?"; } })();
      lastPushError = `Subscription nije kreiran (permission=${perm}, optedIn=${opted}, playerId=${pid})`;
    }
    return false;
  } catch (err) {
    console.error("[Push] permission request failed:", err);
    recordPushError("Permission", err);
    return false;
  }
}

export async function disablePush(): Promise<void> {
  const native = await getNative();
  if (native) {
    await native.disableNativePush();
    setPushEnabledLocally(false);
    return;
  }

  if (!initialized || !isWebPushSupported()) return;
  try {
    const playerId = OneSignal.User.PushSubscription.id;
    if (playerId) {
      try {
        await apiRequest("POST", "/push/unregister", { playerId }, getStoredAuthToken());
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
    }, getStoredAuthToken());
    console.log("[Push] Token registered");
  } catch (err) {
    console.error("[Push] register failed:", err);
  }
}

/**
 * Listener — kad se subscription promijeni (npr. korisnik tek dao permission),
 * automatski registruj novi playerId u backend.
 *
 * Na native shell-u listener postavlja `native-push.ts` u `initNativePush()`,
 * pa se ovdje samo no-op.
 */
export function setupPushListeners(): void {
  if (isCapacitorNative()) return;
  if (!initialized || !isWebPushSupported()) return;
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
