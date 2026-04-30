import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Trophy, ArrowLeft, Brain, Zap, Medal, Users, School, Globe, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Scope = "group" | "mekteb" | "global";
type GameFilter = "all" | "memory" | "quiz";

interface Entry {
  rank: number;
  userId: number;
  displayName: string;
  mektebName: string | null;
  bestScore: number;
  totalGames: number;
}
interface LBResp {
  scope: Scope;
  game: GameFilter;
  entries: Entry[];
  note?: string;
  cached?: boolean;
}

const SCOPE_TABS: { id: Scope; label: string; icon: typeof Users }[] = [
  { id: "group", label: "Grupa", icon: Users },
  { id: "mekteb", label: "Mekteb", icon: School },
  { id: "global", label: "Globalno", icon: Globe },
];
const GAME_TABS: { id: GameFilter; label: string; icon: typeof Brain }[] = [
  { id: "all", label: "Sve igre", icon: Trophy },
  { id: "memory", label: "Pamti par", icon: Brain },
  { id: "quiz", label: "Brzi kviz", icon: Zap },
];

export default function Ljestvica() {
  const { user, token } = useAuth();
  const [scope, setScope] = useState<Scope>("global");
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [data, setData] = useState<LBResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchLB = useCallback(async (silent: boolean) => {
    if (!token) { setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    setErrorMsg("");
    try {
      const res = await apiRequest<LBResp>("GET", `/games/leaderboard?scope=${scope}&game=${gameFilter}`, undefined, token);
      setData(res);
    } catch (e) {
      setErrorMsg((e as Error).message || "Greška");
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, [scope, gameFilter, token]);

  useEffect(() => {
    void fetchLB(false);
  }, [fetchLB]);

  // Mobile parity: pull-to-refresh + auto-refresh kad se tab vrati u fokus.
  // (Native browser pull-to-refresh ne radi unutar SPA-a, pa koristimo touch handler.)
  const touchStartY = useRef<number | null>(null);
  const pullDistance = useRef<number>(0);
  const PULL_THRESHOLD = 70;

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") void fetchLB(true);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchLB]);

  function onTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches[0].clientY;
      pullDistance.current = 0;
    } else {
      touchStartY.current = null;
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStartY.current == null) return;
    pullDistance.current = e.touches[0].clientY - touchStartY.current;
  }
  function onTouchEnd() {
    if (touchStartY.current != null && pullDistance.current > PULL_THRESHOLD && !loading && !refreshing) {
      void fetchLB(true);
    }
    touchStartY.current = null;
    pullDistance.current = 0;
  }

  if (!user) {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <p className="font-bold text-foreground mb-2">Ljestvica je dostupna prijavljenim učenicima</p>
          <Link href="/login" className="text-primary font-bold underline">Prijavi se</Link>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/igrice">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Natrag
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-500" /> Ljestvica
        </h1>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl ml-auto"
          onClick={() => void fetchLB(true)}
          disabled={loading || refreshing}
          data-testid="btn-refresh-leaderboard"
          aria-label="Osvježi ljestvicu"
          title="Osvježi"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="ml-1.5 hidden sm:inline">Osvježi</span>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 sm:hidden">Povuci nadolje za osvježavanje</p>

      {/* Scope tabovi */}
      <div className="flex gap-2 mb-3 flex-wrap" role="tablist" aria-label="Opseg ljestvice">
        {SCOPE_TABS.map(tab => {
          const active = scope === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-scope-${tab.id}`}
              onClick={() => setScope(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-sm transition-all ${
                active ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Game filter */}
      <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="Filter igre">
        {GAME_TABS.map(tab => {
          const active = gameFilter === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-game-${tab.id}`}
              onClick={() => setGameFilter(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                active ? "bg-secondary text-secondary-foreground shadow-sm" : "bg-white border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
        </div>
      )}

      {!loading && errorMsg && (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="font-bold text-red-700">Greška: {errorMsg}</p>
        </Card>
      )}

      {!loading && !errorMsg && data && data.entries.length === 0 && (
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <Trophy className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-bold text-foreground mb-1">Još nema rezultata</p>
          <p className="text-sm text-muted-foreground">{data.note || "Pokreni igru i budi prvi na listi!"}</p>
        </Card>
      )}

      {!loading && !errorMsg && data && data.entries.length > 0 && (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {data.entries.map(e => {
              const isMe = e.userId === user.id;
              const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : null;
              return (
                <div
                  key={e.userId}
                  data-testid={`row-rank-${e.rank}`}
                  className={`flex items-center gap-3 p-4 transition-colors ${
                    isMe ? "bg-primary/5 border-l-4 border-primary" : "hover:bg-muted/30"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                    e.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                    e.rank === 2 ? "bg-gray-100 text-gray-700" :
                    e.rank === 3 ? "bg-amber-100 text-amber-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {medal || e.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">
                      {e.displayName}
                      {isMe && <span className="ml-2 text-xs font-bold text-primary">(ja)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.mektebName ? (
                        <>
                          <span className="inline-flex items-center gap-1" data-testid={`mekteb-${e.userId}`}>
                            <School className="w-3 h-3" /> {e.mektebName}
                          </span>
                          <span className="mx-1.5">·</span>
                        </>
                      ) : null}
                      {e.totalGames} {e.totalGames === 1 ? "igra" : "igara"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <Medal className="w-4 h-4 text-amber-500" />
                      <span className="font-black text-lg text-foreground tabular-nums">{e.bestScore}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">najbolji</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      </div>
    </Layout>
  );
}
