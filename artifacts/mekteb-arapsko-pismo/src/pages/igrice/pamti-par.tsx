import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameTimer } from "@/components/game-timer";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Brain, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Harf { id: number; arabic: string; name: string; }

const HARFOVI_POOL: Harf[] = [
  { id: 1,  arabic: "ا", name: "Elif" },  { id: 2,  arabic: "ب", name: "Ba" },
  { id: 3,  arabic: "ت", name: "Te" },    { id: 4,  arabic: "ث", name: "Se" },
  { id: 5,  arabic: "ج", name: "Džim" },  { id: 6,  arabic: "ح", name: "Ha" },
  { id: 7,  arabic: "خ", name: "Hâ" },    { id: 8,  arabic: "د", name: "Dal" },
  { id: 9,  arabic: "ذ", name: "Zel" },   { id: 10, arabic: "ر", name: "Ra" },
  { id: 11, arabic: "ز", name: "Ze" },    { id: 12, arabic: "س", name: "Sin" },
  { id: 13, arabic: "ش", name: "Šin" },   { id: 14, arabic: "ص", name: "Sad" },
  { id: 15, arabic: "ض", name: "Dad" },   { id: 16, arabic: "ط", name: "Tâ" },
  { id: 17, arabic: "ظ", name: "Zâ" },    { id: 18, arabic: "ع", name: "Ajn" },
  { id: 19, arabic: "غ", name: "Gajn" },  { id: 20, arabic: "ف", name: "Fa" },
  { id: 21, arabic: "ق", name: "Kaf" },   { id: 22, arabic: "ك", name: "Kef" },
  { id: 23, arabic: "ل", name: "Lam" },   { id: 24, arabic: "م", name: "Mim" },
  { id: 25, arabic: "ن", name: "Nun" },   { id: 26, arabic: "ه", name: "He" },
  { id: 27, arabic: "و", name: "Waw" },   { id: 28, arabic: "ي", name: "Ja" },
];

// Svaki par = jedna arapska kartica + jedna kartica sa imenom harfa.
// Učenik mora spojiti harf sa njegovim imenom (ne dvije iste arapske kartice).
type CardKind = "arabic" | "name";
interface Card { id: string; harfId: number; kind: CardKind; display: string; flipped: boolean; matched: boolean; }

const PAIRS = 8; // 16 kartica (8 arapskih + 8 imena)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard(): Card[] {
  const picks = shuffle(HARFOVI_POOL).slice(0, PAIRS);
  const cards: Card[] = [];
  picks.forEach((h, idx) => {
    cards.push({ id: `${h.id}-arabic-${idx}`, harfId: h.id, kind: "arabic", display: h.arabic, flipped: false, matched: false });
    cards.push({ id: `${h.id}-name-${idx}`,   harfId: h.id, kind: "name",   display: h.name,   flipped: false, matched: false });
  });
  return shuffle(cards);
}

type GameState = "idle" | "loading" | "playing" | "ended" | "expired" | "no-credit" | "error";

export default function PamtiPar() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const [state, setState] = useState<GameState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [allowedDuration, setAllowedDuration] = useState<number>(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestEver, setBestEver] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const endingRef = useRef(false);

  const startGame = useCallback(async () => {
    if (!token) return;
    setErrorMsg("");
    setState("loading");
    try {
      // Snimi prethodni best prije nego pokreneš novu igru — koristi se za "tvoj zadnji best" prikaz na kraju.
      try {
        const prev = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const m = prev.games.find(g => g.gameId === "memory");
        setPreviousBest(m?.bestScore ?? 0);
      } catch { setPreviousBest(null); }

      const res = await apiRequest<{ sessionId: number; startedAt: string; allowedDurationSec: number }>(
        "POST", "/games/start", { gameId: "memory" }, token
      );
      setSessionId(res.sessionId);
      setStartedAt(res.startedAt);
      setAllowedDuration(res.allowedDurationSec);
      setCards(buildBoard());
      setSelected([]);
      setMoves(0);
      setMatches(0);
      setFinalScore(null);
      setBestEver(null);
      sessionStartTimeRef.current = Date.now();
      endingRef.current = false;
      setState("playing");
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) { setState("no-credit"); }
      else if (err.status === 409) { setErrorMsg("Već imaš igru u toku — osvježi stranicu."); setState("error"); }
      else { setErrorMsg(err.message || "Greška pri pokretanju"); setState("error"); }
    }
  }, [token]);

  const endGame = useCallback(async (score: number) => {
    if (!sessionId || !token || endingRef.current) return;
    endingRef.current = true;
    try {
      const r = await apiRequest<{ ok: boolean; finalScore?: number }>("POST", "/games/end", { sessionId, score }, token);
      const accepted = typeof r.finalScore === "number" ? r.finalScore : score;
      setFinalScore(accepted);
      setState("ended");
      refetchCredits();
      // Dohvati best-ever nakon snimanja (server ga već zna)
      try {
        const stats = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const m = stats.games.find(g => g.gameId === "memory");
        setBestEver(m?.bestScore ?? accepted);
      } catch { setBestEver(accepted); }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || "Greška pri završetku");
      setState("error");
    }
  }, [sessionId, token, refetchCredits]);

  // Refs koji prate najsvježije vrijednosti za cleanup (izbjegavamo stale closure
  // u unmount handleru — bez ovoga partial score bi bio = početne vrijednosti
  // na mount-u, ne stvarno postignut score u trenutku napuštanja).
  const stateRef = useRef(state);
  const matchesRef = useRef(matches);
  const tokenRef = useRef(token);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { matchesRef.current = matches; }, [matches]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Cleanup: ako user napusti stranicu mid-game, end session sa partial score
  useEffect(() => {
    return () => {
      if (stateRef.current === "playing" && sessionId && tokenRef.current && !endingRef.current) {
        const partial = Math.max(10, matchesRef.current * 60);
        endingRef.current = true;
        apiRequest("POST", "/games/end", { sessionId, score: partial }, tokenRef.current).catch(() => {});
      }
    };
  }, [sessionId]);

  // Auto-end on board complete
  useEffect(() => {
    if (state === "playing" && matches === PAIRS) {
      const elapsedSec = sessionStartTimeRef.current ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000) : 60;
      // Bodovanje: bazno 1000, oduzima se za pokušaje i vrijeme.
      // Min za savršen: 16 poteza (svaki potez 1 par). Bonus za brzinu.
      const movePenalty = Math.max(0, moves - PAIRS) * 25; // svaki "promašaj" -25
      const timePenalty = Math.min(300, elapsedSec * 2); // max -300 za vrijeme
      const score = Math.max(50, Math.min(1000, 1000 - movePenalty - timePenalty));
      void endGame(score);
    }
  }, [state, matches, moves, endGame]);

  const handleExpire = useCallback(() => {
    if (state !== "playing") return;
    // Score = ono što je do sada postignuto, smanjeno
    const partial = Math.max(10, matches * 60);
    void endGame(partial);
  }, [state, matches, endGame]);

  const handleCardClick = (cardId: string) => {
    if (state !== "playing") return;
    if (selected.length >= 2) return;
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx < 0) return;
    const card = cards[idx];
    if (card.flipped || card.matched) return;

    const newCards = [...cards];
    newCards[idx] = { ...card, flipped: true };
    setCards(newCards);
    const newSelected = [...selected, cardId];
    setSelected(newSelected);

    if (newSelected.length === 2) {
      setMoves(m => m + 1);
      const [aId, bId] = newSelected;
      const a = newCards.find(c => c.id === aId)!;
      const b = newCards.find(c => c.id === bId)!;
      if (a.harfId === b.harfId) {
        // match
        setTimeout(() => {
          setCards(curr => curr.map(c => (c.id === aId || c.id === bId) ? { ...c, matched: true } : c));
          setMatches(m => m + 1);
          setSelected([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards(curr => curr.map(c => (c.id === aId || c.id === bId) ? { ...c, flipped: false } : c));
          setSelected([]);
        }, 900);
      }
    }
  };

  if (!user) {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <p className="font-bold text-foreground mb-2">Igrice su za prijavljene učenike</p>
          <Link href="/login" className="text-primary font-bold underline">Prijavi se</Link>
        </Card>
      </Layout>
    );
  }
  if (user.role !== "ucenik") {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-pamti-par">
          <p className="font-bold text-foreground mb-2">Igrice su dostupne samo učeničkim nalozima</p>
          <Link href="/igrice" className="text-primary font-bold underline">Nazad</Link>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/igrice">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Natrag
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Brain className="w-7 h-7 text-purple-600" /> Pamti par
        </h1>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {state === "playing" && startedAt && (
            <GameTimer startedAt={startedAt} allowedDurationSec={allowedDuration} onExpire={handleExpire} />
          )}
        </div>
      </div>

      {state === "idle" && (
        <Card className="p-6 mb-6 bg-purple-50 border-purple-200">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-purple-600 shrink-0" />
            <div>
              <p className="font-bold text-foreground mb-1">Spoji parove arapskih harfova</p>
              <p className="text-sm text-muted-foreground">Klikni dvije kartice — ako su isti harf, ostat će otvorene. Što manje pokušaja i brže — to bolji rezultat.</p>
              <p className="text-xs text-muted-foreground mt-2">
                Preostalo vremena: <strong>{creditsLoading ? "…" : formatSeconds(credits?.secondsRemaining ?? 0)}</strong>
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={creditsLoading || (credits?.secondsRemaining ?? 0) <= 0}
            data-testid="button-start-pamti-par"
            className="rounded-2xl font-bold bg-purple-600 hover:bg-purple-700"
          >
            {creditsLoading ? "Učitavam…" : "Pokreni igru"}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">Nemaš dovoljno vremena. Završi neku lekciju za nove kapi meda 🍯.</p>
          )}
        </Card>
      )}

      {state === "loading" && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Pokrećem igru…</p></Card>
      )}

      {state === "no-credit" && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="font-bold text-foreground mb-2">Nemaš više vremena za igre.</p>
          <p className="text-sm text-muted-foreground mb-3">Završi lekciju ili kviz da zaradiš nove kapi meda 🍯.</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/ilmihal"><Button size="sm" className="rounded-xl">Ilmihal</Button></Link>
            <Link href="/kvizovi"><Button size="sm" variant="outline" className="rounded-xl">Kvizovi</Button></Link>
          </div>
        </Card>
      )}

      {state === "error" && (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="font-bold text-red-700 mb-2">Greška</p>
          <p className="text-sm text-muted-foreground mb-3">{errorMsg}</p>
          <Button size="sm" onClick={() => setState("idle")} className="rounded-xl">Nazad</Button>
        </Card>
      )}

      {state === "playing" && (
        <>
          <div className="flex items-center justify-between gap-4 mb-4 text-sm font-bold">
            <span className="text-muted-foreground">Potezi: <span className="text-foreground">{moves}</span></span>
            <span className="text-muted-foreground">Parovi: <span className="text-foreground">{matches}/{PAIRS}</span></span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-2 sm:gap-3 max-w-2xl mx-auto">
            {cards.map(card => (
              <motion.button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={card.matched || card.flipped || selected.length >= 2}
                data-testid={`card-memory-${card.id}`}
                className={`aspect-square rounded-2xl shadow-sm font-bold text-3xl sm:text-4xl flex items-center justify-center transition-all ${
                  card.matched
                    ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300"
                    : card.flipped
                    ? "bg-purple-100 text-purple-700 ring-2 ring-purple-400"
                    : "bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:scale-105"
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {card.flipped || card.matched ? (
                  <span className={card.kind === "name" ? "text-base sm:text-lg font-bold" : ""}>{card.display}</span>
                ) : "؟"}
              </motion.button>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {state === "ended" && finalScore !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-8 mt-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300 text-center">
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-2xl font-black text-foreground mb-1">Bravo!</p>
              <p className="text-lg text-muted-foreground mb-2">
                Rezultat: <span className="font-black text-3xl text-emerald-600" data-testid="text-final-score">{finalScore}</span>
              </p>
              <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
                {bestEver !== null && (
                  <p>
                    Najbolji ikad: <span className="font-bold text-foreground" data-testid="text-best-ever">{bestEver}</span>
                    {previousBest !== null && finalScore !== null && finalScore > previousBest && (
                      <span className="ml-2 text-emerald-600 font-bold">novi rekord!</span>
                    )}
                  </p>
                )}
                {previousBest !== null && previousBest > 0 && (
                  <p>Tvoj prethodni najbolji: <span className="font-bold text-foreground">{previousBest}</span></p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Riješeno u {moves} poteza · {matches}/{PAIRS} parova
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => { setState("idle"); refetchCredits(); }} className="rounded-2xl">
                  <RefreshCw className="w-4 h-4 mr-1" /> Igraj opet
                </Button>
                <Button variant="outline" onClick={() => setLocation("/igrice/ljestvica")} className="rounded-2xl">
                  Tabela
                </Button>
                <Link href="/igrice">
                  <Button variant="ghost" className="rounded-2xl">Natrag na Igrice</Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
