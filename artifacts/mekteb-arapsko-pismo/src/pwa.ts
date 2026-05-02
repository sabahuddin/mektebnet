/**
 * Briše SVE Cache Storage cache-ove (Workbox + custom). Pozivati na logout
 * da se naredni korisnik na shared device-u ne susretne sa stale podacima
 * prethodnog korisnika. Bezbjedno za pozvati i kad SW nije aktivan.
 */
export async function purgePwaCaches(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[PWA] Cache purge failed:", err);
  }
}

export function initPWA(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Logout cache purge — uvijek registrovano, čak i u dev-u (gdje SW ne
  // postoji ali Cache Storage može imati ostatke).
  window.addEventListener("mekteb:logout", () => {
    void purgePwaCaches();
  });

  if (import.meta.env.DEV) return;

  void import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent("mekteb:pwa-update-available"));
      },
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent("mekteb:pwa-offline-ready"));
      },
      onRegisteredSW(swScriptUrl: string) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info("[PWA] Service worker registered:", swScriptUrl);
        }
      },
      onRegisterError(error: unknown) {
        // eslint-disable-next-line no-console
        console.warn("[PWA] Service worker registration failed:", error);
      },
    });

    (window as unknown as { __mektebUpdateSW?: () => Promise<void> }).__mektebUpdateSW =
      () => updateSW(true);
  });
}
