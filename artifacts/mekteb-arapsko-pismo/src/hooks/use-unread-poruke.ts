import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";

const POLL_INTERVAL_MS = 30_000;

export const PORUKE_READ_EVENT = "mekteb:poruke-read";

export function useUnreadPoruke(): number {
  const { user, token } = useAuth();
  const [location] = useLocation();
  const [count, setCount] = useState(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!user || !token) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      const t = tokenRef.current;
      if (!t) return;
      try {
        const data = await apiRequest<{ count: number }>(
          "GET",
          "/poruke/unread-count",
          undefined,
          t,
        );
        if (!cancelled) setCount(data.count ?? 0);
      } catch {}
    };

    fetchCount();
    const id = window.setInterval(fetchCount, POLL_INTERVAL_MS);
    const onRead = () => fetchCount();
    window.addEventListener(PORUKE_READ_EVENT, onRead);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(PORUKE_READ_EVENT, onRead);
    };
  }, [user?.id, token, location]);

  return count;
}
