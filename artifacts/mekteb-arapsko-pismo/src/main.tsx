import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPWA } from "./pwa";
import { initOneSignal, setupPushListeners } from "./lib/push";

createRoot(document.getElementById("root")!).render(<App />);

initPWA();

// OneSignal push notifikacije (Web). Init se radi jednom na app boot;
// permission prompt se zove kasnije iz UI-a (postavke ili auth toast).
initOneSignal()
  .then(() => setupPushListeners())
  .catch(() => {});
