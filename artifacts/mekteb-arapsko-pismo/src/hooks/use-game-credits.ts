import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";

export interface GameCredits {
  totalHasanat: number;
  /** Razdvojena valuta — zarađuje se igrajući igrice (1 score = 1 med). */
  totalMed: number;
  secondsAllowed: number;
  secondsSpent: number;
  secondsRemaining: number;
  hasanatPerBlock: number;
  secondsPerBlock: number;
  activeSession: { id: number; gameId: string; startedAt: string } | null;
}

export function useGameCredits() {
  const { token } = useAuth();
  const [data, setData] = useState<GameCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("not_authenticated");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<GameCredits>("GET", "/games/credits", undefined, token);
      setData(res);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "load_failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}

export function formatSeconds(s: number): string {
  if (s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
