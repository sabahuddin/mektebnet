import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      strategies: "generateSW",
      includeAssets: [
        "favicon.svg",
        "icons/favicon-16.png",
        "icons/favicon-32.png",
        "icons/apple-touch-icon.png",
        "icons/apple-touch-icon-120.png",
        "icons/apple-touch-icon-152.png",
        "icons/apple-touch-icon-167.png",
        "OneSignalSDKWorker.js",
      ],
      manifest: {
        id: `${basePath}?source=pwa`,
        name: "Mekteb — Islamska edukacija",
        short_name: "Mekteb",
        description:
          "Mekteb.net — interaktivna islamska edukacija: ilmihal, kvizovi, čitaonica i igrice za djecu i porodicu.",
        lang: "bs",
        dir: "ltr",
        start_url: basePath,
        scope: basePath,
        display: "standalone",
        orientation: "any",
        background_color: "#fffaf3",
        theme_color: "#248F8F",
        categories: ["education", "books", "kids"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,woff,ttf,json}"],
        // OneSignalSDKWorker.js mora ostati zaseban SW koji OneSignal sam
        // registruje — ne smije ga Workbox uvući u svoj precache niti rute.
        globIgnores: ["**/OneSignalSDKWorker.js"],
        // SPA shell — F5/refresh na bilo koji client-side route mora vratiti
        // index.html iz precache-a (ne offline.html!), inače Workbox prikaže
        // offline stranicu i kad korisnik IMA internet. offline.html ostaje
        // dostupan kao public asset za stvarnu offline situaciju.
        navigateFallback: `${basePath.replace(/\/$/, "")}/index.html`,
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/vaktija\//, /^\/edu\//, /OneSignalSDKWorker\.js$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Aktiviraj novi SW odmah da popravke (npr. F5 fallback bug, flag
        // emoji polyfill) stignu do korisnika čim otvore app, bez čekanja
        // da zatvore sve tabove.
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "mekteb-google-fonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Public Ilmihal lekcije, kvizovi, knjige, rječnik — javan sadržaj,
            // sigurno za cross-user cache. Mountan na /api/content/* prefiks.
            urlPattern: /\/api\/content\/(ilmihal|kvizovi|knjige|rjecnik)(\/.*)?$/,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "mekteb-content",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
              cacheableResponse: { statuses: [200] },
              matchOptions: { ignoreSearch: false },
            },
          },
          {
            // Arapsko pismo lekcije (mountane na rootu, /api/lessons*).
            urlPattern: /\/api\/lessons(\/.*)?$/,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "mekteb-content",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Statički media assets (slike, audio, sounds, h5p templates).
            // Uploads (user-uploadovani fajlovi) NISU ovdje jer mogu biti privatni.
            urlPattern: /\/(images|audio|sounds|h5p-templates)\//,
            handler: "CacheFirst",
            method: "GET",
            options: {
              cacheName: "mekteb-media",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
            },
          },
          // NAPOMENA: Auth-gated endpoint-i (/api/progress, /api/content/napredak,
          // /api/popravi-sace, /api/misije, /api/games/credits, /api/ucenik,
          // /api/poruke, /api/h5p) NAMJERNO se NE cache-uju runtime-om — privatni
          // su, a child A na shared device-u ne smije vidjeti child B podatke
          // offline. Frontend ih uvijek hita sa servera; ako nema mreže, koriste
          // se TanStack Query stale cache-evi (in-memory, per-session, briše se
          // na logout).
        ],
      },
      devOptions: {
        enabled: false,
        type: "module",
        navigateFallback: `${basePath.replace(/\/$/, "")}/index.html`,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  // Mobilni build može eksplicitno proslijediti VITE_ varijablu; produkcijski
  // web build i dalje koristi postojeći backend secret kao fallback. Vite ne
  // izlaže ONESIGNAL_APP_ID automatski bez ovog eksplicitnog mapiranja.
  define: {
    "import.meta.env.VITE_ONESIGNAL_APP_ID": JSON.stringify(
      process.env.VITE_ONESIGNAL_APP_ID ?? process.env.ONESIGNAL_APP_ID ?? ""
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Vite 7 po defaultu cilja novije Safari verzije. Transpiliraj i za
    // starije iPad uređaje koji su ostali na iPadOS 13.
    target: ["es2018", "safari13"],
    cssTarget: "safari13",
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    watch: {
      // Capacitor sync kopira dist/public u native projekte (ios/, android/) —
      // Vite ne smije triggerati hot-reload na te kopije, inače dev server
      // se zaduši reload-ovima svaki put kad se uradi `cap sync`.
      ignored: [
        "**/ios/**",
        "**/android/**",
        "**/dist/**",
      ],
    },
  },
});
