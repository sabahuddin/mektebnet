import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";

const TICK_MS = 60_000;
const MAX_DELTA_SEC = 90;

export function useHeartbeat() {
  const { token, isAuthenticated } = useAuth();
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const send = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const now = Date.now();
      const last = lastTickRef.current;
      const deltaSec = last === 0 ? 60 : Math.min(MAX_DELTA_SEC, Math.round((now - last) / 1000));
      lastTickRef.current = now;
      try {
        await apiRequest("POST", "/aktivnost/heartbeat", { deltaSec }, token);
      } catch {
        // Tih fail — ne smije ometati UI; sljedeći tick će pokušati ponovo.
      }
    };

    // Pošalji odmah po mount-u (login/refresh) i potom periodično.
    send();
    const interval = window.setInterval(send, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, token]);
}
