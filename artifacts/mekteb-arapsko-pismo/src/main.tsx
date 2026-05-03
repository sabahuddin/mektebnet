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

createRoot(document.getElementById("root")!).render(<App />);

initPWA();

// OneSignal push notifikacije (Web). Init se radi jednom na app boot;
// permission prompt se zove kasnije iz UI-a (postavke ili auth toast).
initOneSignal()
  .then(() => setupPushListeners())
  .catch(() => {});
