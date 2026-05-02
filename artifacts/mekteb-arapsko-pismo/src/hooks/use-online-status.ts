import { useEffect, useState } from "react";

/**
 * Tracks browser online/offline status using the Network Information API.
 * Returns true when the device thinks it has connectivity (note: this does
 * NOT verify the API server is reachable — it only reflects the OS network
 * state). Combine with response failures to detect actual connectivity.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
