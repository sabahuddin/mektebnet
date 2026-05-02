import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPWA } from "./pwa";

createRoot(document.getElementById("root")!).render(<App />);

initPWA();
