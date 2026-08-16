import { createRoot } from "react-dom/client";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import App from "./App";
import "./index.css";
import { initPWA } from "./pwa";
import { initOneSignal, setupPushListeners } from "./lib/push";

// Windows (Chrome/Edge) ne renderira flag emoji nativno — fallback na
// "Twemoji Country Flags" font koji injektira ovaj polyfill. Na ostalim
// platformama (mac, iOS, Android, Linux sa Noto) ostaje native render.
polyfillCountryFlagEmojis();

// Sigurnosna mreža za "bijeli ekran": ako se app sruši pri pokretanju,
// prikaži tekst greške umjesto praznog ekrana da se problem može prijaviti.
function showBootError(msg: string): void {
  const root = document.getElementById("root");
  // Prikaži samo ako je app zaista prazan (crash pri bootu), ne za kasnije greške.
  if (!root || root.childElementCount > 0) return;
  const div = document.createElement("div");
  div.style.cssText = "padding:16px;font-family:sans-serif;color:#7f1d1d;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;margin:16px;word-break:break-word";
  div.innerHTML = "<b>Greška pri pokretanju</b><br><small></small><br><button style='margin-top:8px;padding:6px 12px;border-radius:8px;border:1px solid #7f1d1d;background:#fff'>Osvježi</button>";
  div.querySelector("small")!.textContent = msg;
  div.querySelector("button")!.onclick = () => {
    // Očisti SW + keš pa reload — rješava zaglavljeni stari service worker.
    Promise.allSettled([
      navigator.serviceWorker?.getRegistrations?.().then(rs => Promise.all(rs.map(r => r.unregister()))) ?? Promise.resolve(),
      typeof caches !== "undefined" ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : Promise.resolve(),
    ]).then(() => location.reload());
  };
  document.body.appendChild(div);
}
window.addEventListener("error", (e) => showBootError(String(e.error?.stack || e.message)));
window.addEventListener("unhandledrejection", (e) => showBootError(String((e.reason as Error)?.stack || e.reason)));

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
  showBootError(err instanceof Error ? (err.stack || err.message) : String(err));
  throw err;
}

initPWA();

// OneSignal push notifikacije (Web). Init se radi jednom na app boot;
// permission prompt se zove kasnije iz UI-a (postavke ili auth toast).
initOneSignal()
  .then(() => setupPushListeners())
  .catch(() => {});
