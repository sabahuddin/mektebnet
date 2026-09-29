import { useEffect } from "react";
import { apiRequest } from "@/lib/api";

const INTERVAL_MS = 10_000;
const IDLE_MS = 5 * 60_000;

/** Mjeri samo prijavljenog učenika dok je Kur'an otvoren i kartica aktivna. */
export function useQuranTimeHeartbeat(enabled: boolean, token: string | null) {
  useEffect(() => {
    if (!enabled || !token) return;

    let lastActivity = Date.now();
    let inFlight = false;
    let needsReset = true;
    const send = () => {
      if (inFlight || document.visibilityState !== "visible" || Date.now() - lastActivity >= IDLE_MS) return;
      inFlight = true;
      const reset = needsReset;
      needsReset = false;
      apiRequest("POST", "/aktivnost/quran/heartbeat", { reset }, token)
        .catch(() => {
          // Ne računaj nepoznat interval ako je server bio nedostupan.
          needsReset = true;
        })
        .finally(() => { inFlight = false; });
    };
    const onActivity = () => {
      const wasIdle = Date.now() - lastActivity >= IDLE_MS;
      lastActivity = Date.now();
      if (wasIdle) {
        needsReset = true;
        send();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastActivity = Date.now();
        send();
      } else {
        needsReset = true;
      }
    };

    send(); // prvi puls otvara interval; server mu dodjeljuje 0 sekundi
    const interval = window.setInterval(send, INTERVAL_MS);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, token]);
}