import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper za Mekteb mobile app (Android + iOS).
 *
 * Strategija: HYBRID
 *   - `webDir: "dist/public"` — pri svakom buildu, statički web bundle se
 *     kopira u native projekte (`npx cap sync`). App radi 100% offline iz
 *     bundled assets-a, što Apple App Store traži (ne primaju "samo
 *     wrapper za website").
 *   - API pozivi idu na `https://mekteb.net/api` (preko VITE_API_BASE_URL
 *     env var-a u mobile build skripti). Backend CORS je već podešen
 *     da prihvata `capacitor://localhost` (iOS) i `https://localhost` (Android).
 *   - Service Worker (PWA) i dalje radi unutar webview-a — duplo offline
 *     osiguranje (assets su već u native bundle-u, runtime data ide kroz SW).
 *
 * Dev live-reload (samo lokalno na iMac-u kad se programira):
 *   Postavi env var `CAP_SERVER_URL=http://192.168.x.x:5173` prije
 *   `npx cap run`, da app učitava live Vite dev server umjesto bundla.
 */
const isDev = !!process.env["CAP_SERVER_URL"];

const config: CapacitorConfig = {
  appId: "net.mektebnet.app",
  appName: "Mekteb",
  webDir: "dist/public",
  bundledWebRuntime: false,
  // Kad se app pokreće u produkciji, native webview učitava lokalne fajlove
  // iz `dist/public` i komunicira sa `https://mekteb.net/api` preko
  // VITE_API_BASE_URL koji je baked-in pri buildu.
  ...(isDev
    ? {
        server: {
          url: process.env["CAP_SERVER_URL"],
          cleartext: true,
        },
      }
    : {}),
  ios: {
    // Status bar nije transparentan na iOS-u dok ga eksplicitno ne tražimo.
    contentInset: "always",
    // VAŽNO: NE postavljati custom `scheme`. Capacitor default je `capacitor`,
    // što daje webview origin `capacitor://localhost` — upravo to backend CORS
    // allowlist dozvoljava. Ako se ovo promijeni (npr. `scheme: "Mekteb"`),
    // origin postaje `mekteb://localhost` i CORS će blokirati sve API pozive.
    backgroundColor: "#fffaf3",
  },
  android: {
    // Allow http://10.0.2.2 (Android emulator host loopback) tokom dev-a.
    allowMixedContent: false,
    backgroundColor: "#fffaf3",
    captureInput: true,
    webContentsDebuggingEnabled: isDev,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#248F8F",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#248F8F",
      overlaysWebView: false,
    },
  },
};

export default config;
