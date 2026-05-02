import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameTimer } from "@/components/game-timer";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Flag, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Pitanja iz /games/start (BEZ `answer` — server čuva tačan odgovor i validira
// pri /games/end). `id` je session-scoped stabilni ključ. Za "zastave" backend
// dodatno šalje samo `flagEmoji` (Unicode regional-indicator). Server NE
// šalje ISO2 jer bi to bilo deterministički identifikator države (anti-cheat).
interface QQ { id: string; question: string; options: string[]; flagEmoji?: string; }
interface AnswerRecord { questionId: string; optionIndex: number; }

type GameState = "idle" | "loading" | "playing" | "ended" | "no-credit" | "error";

const GAME_ID = "zastave";

export default function ZastaveSvijeta() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const [state, setState] = useState<GameState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QQ[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [feedback, setFeedback] = useState<"locked" | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestEver, setBestEver] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [allowedDuration, setAllowedDuration] = useState<number>(60);
  const endingRef = useRef(false);

  // Helper: pokušaj /games/start jednom. Vraća sesiju ili throw-uje grešku.
  const tryStart = useCallback(async () => {
    if (!token) throw new Error("no_token");
    return apiRequest<{ sessionId: number; startedAt: string; allowedDurationSec: number; questions?: QQ[] }>(
      "POST", "/games/start", { gameId: GAME_ID }, token
    );
  }, [token]);

  const applyStartedSession = (res: { sessionId: number; startedAt: string; allowedDurationSec: number; questions?: QQ[] }): boolean => {
    const qs = Array.isArray(res.questions) ? res.questions : [];
    if (qs.length < 5) {
      setErrorMsg("Nema dovoljno pitanja u banci.");
      setState("error");
      return false;
    }
    setSessionId(res.sessionId);
    setStartedAt(res.startedAt);
    setAllowedDuration(res.allowedDurationSec);
    setQuestions(qs);
    setQIndex(0);
    setAnswers([]);
    setFeedback(null);
    setFinalScore(null);
    setBestEver(null);
    setState("playing");
    return true;
  };

  const startGame = useCallback(async () => {
    if (!token) return;
    setErrorMsg("");
    setState("loading");
    endingRef.current = false;
    try {
      try {
        const prev = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const q = prev.games.find(g => g.gameId === GAME_ID);
        setPreviousBest(q?.bestScore ?? 0);
      } catch { setPreviousBest(null); }

      const res = await tryStart();
      applyStartedSession(res);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) setState("no-credit");
      else if (err.status === 409) {
        // Race condition: cleanup useEffect od prethodne igre šalje POST /games/end
        // fire-and-forget pri unmount-u, ali to može stići NA SERVER tek nakon što
        // novi /games/start zatraži session lock. NE smijemo prisilno zatvoriti
        // prethodnu sesiju sa praznim answers — time bismo mogli prebrisati legitimne
        // odgovore koji su u flight-u (race write). Umjesto toga čekamo kratko da
        // prethodni /end stigne kompletirati i pokušamo ponovo. Ako i tada padne,
        // prikažemo poruku i tražimo refresh stranice.
        try {
          await new Promise(r => setTimeout(r, 800));
          const retry = await tryStart();
          applyStartedSession(retry);
        } catch {
          setErrorMsg("Već imaš igru u toku — osvježi stranicu.");
          setState("error");
        }
      }
      else if (err.status === 503) { setErrorMsg("Nema dovoljno pitanja u banci."); setState("error"); }
      else { setErrorMsg(err.message || "Greška pri pokretanju"); setState("error"); }
    }
  }, [token, tryStart]);

  const endGame = useCallback(async (finalAnswers: AnswerRecord[]) => {
    if (!sessionId || !token || endingRef.current) return;
    endingRef.current = true;
    try {
      const r = await apiRequest<{ ok: boolean; finalScore?: number; score?: number }>(
        "POST", "/games/end", { sessionId, answers: finalAnswers }, token
      );
      const accepted = typeof r.finalScore === "number" ? r.finalScore : (r.score ?? 0);
      setFinalScore(accepted);
      setState("ended");
      refetchCredits();
      try {
        const stats = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const q = stats.games.find(g => g.gameId === GAME_ID);
        setBestEver(q?.bestScore ?? accepted);
      } catch { setBestEver(accepted); }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || "Greška pri završetku");
      setState("error");
    }
  }, [sessionId, token, refetchCredits]);

  const handleAnswer = (optionIndex: number) => {
    if (state !== "playing") return;
    if (feedback !== null) return;
    const q = questions[qIndex];
    if (!q) return;
    const option = q.options[optionIndex];
    if (option === undefined) return;
    setFeedback("locked");
    const newAnswer: AnswerRecord = { questionId: q.id, optionIndex };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setTimeout(() => {
      setFeedback(null);
      const nextIdx = qIndex + 1;
      if (nextIdx >= questions.length) {
        void endGame(updatedAnswers);
      } else {
        setQIndex(nextIdx);
      }
    }, 250);
  };

  const handleExpire = useCallback(() => {
    if (state !== "playing") return;
    void endGame(answers);
  }, [state, answers, endGame]);

  const stateRef = useRef(state);
  const answersRef = useRef(answers);
  const tokenRef = useRef(token);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    return () => {
      if (stateRef.current === "playing" && sessionId && tokenRef.current && !endingRef.current) {
        endingRef.current = true;
        apiRequest("POST", "/games/end", { sessionId, answers: answersRef.current }, tokenRef.current).catch(() => {});
      }
    };
  }, [sessionId]);

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
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-zastave">
          <p className="font-bold text-foreground mb-2">Igrice su dostupne samo učeničkim nalozima</p>
          <Link href="/igrice" className="text-primary font-bold underline">Nazad</Link>
        </Card>
      </Layout>
    );
  }

  const currentQ = questions[qIndex];

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/igrice">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Natrag
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Flag className="w-7 h-7 text-sky-600" /> Zastave svijeta
        </h1>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {state === "playing" && startedAt && (
            <GameTimer startedAt={startedAt} allowedDurationSec={allowedDuration} onExpire={handleExpire} />
          )}
        </div>
      </div>

      {state === "idle" && (
        <Card className="p-6 mb-6 bg-sky-50 border-sky-200">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-sky-600 shrink-0" />
            <div>
              <p className="font-bold text-foreground mb-1">60 sekundi — koliko zastava prepoznaješ?</p>
              <p className="text-sm text-muted-foreground">Pojavi se zastava — odaberi državu kojoj pripada. Zastave iz cijelog svijeta, sa naglaskom na muslimanske zemlje.</p>
              <p className="text-xs text-muted-foreground mt-2">
                Preostalo vremena: <strong>{creditsLoading ? "…" : formatSeconds(credits?.secondsRemaining ?? 0)}</strong>
                {!creditsLoading && (credits?.secondsRemaining ?? 0) > 0 && (credits?.secondsRemaining ?? 0) < 60 && (
                  <span className="ml-2 text-amber-600">— igra će trajati samo {credits!.secondsRemaining} s.</span>
                )}
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={creditsLoading || (credits?.secondsRemaining ?? 0) <= 0}
            data-testid="button-start-zastave"
            className="rounded-2xl font-bold bg-sky-600 hover:bg-sky-700"
          >
            {creditsLoading ? "Učitavam…" : "Pokreni igru"}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">Nemaš vremena za igre. Završi neku lekciju za nove Aferime.</p>
          )}
        </Card>
      )}

      {state === "loading" && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Učitavam pitanja…</p></Card>
      )}

      {state === "no-credit" && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="font-bold text-foreground mb-2">Nemaš više vremena za igre.</p>
          <p className="text-sm text-muted-foreground mb-3">Završi lekciju ili kviz da zaradiš nove Aferime.</p>
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

      {state === "playing" && currentQ && (
        <>
          <div className="flex items-center justify-between gap-4 mb-4 text-sm font-bold">
            <span className="text-sky-600">Odgovoreno: <span className="text-foreground" data-testid="text-answered-count">{answers.length}</span></span>
            <span className="text-muted-foreground">Pitanje #{qIndex + 1}</span>
          </div>
          <Card className="p-6 mb-4 relative overflow-hidden">
            {/* Vizualno pitanje: emoji zastava u velikoj formi. Unicode regional-indicator
                emoji se renderuje native-no u svim modernim browserima (Apple, Google,
                Twemoji). Windows desktop možda prikaže ISO kod kao fallback — to je
                rjedak slučaj jer su učenici primarno na mobilnim uređajima. */}
            <div
              className="text-center mb-6 leading-none select-none"
              style={{ fontSize: "9rem" }}
              aria-label="Zastava"
              data-testid="flag-emoji"
            >
              {currentQ.flagEmoji ?? "🏳️"}
            </div>
            <p className="text-base font-bold text-muted-foreground mb-4 text-center" data-testid="text-question">{currentQ.question}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={feedback !== null}
                  data-testid={`button-answer-${i}`}
                  className="text-left p-4 rounded-2xl border-2 font-medium transition-all bg-white border-border hover:border-sky-400 hover:bg-sky-50 disabled:opacity-60"
                >
                  {opt}
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      <AnimatePresence>
        {state === "ended" && finalScore !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-8 mt-6 bg-gradient-to-br from-sky-50 to-blue-50 border-sky-300 text-center">
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-2xl font-black text-foreground mb-1">Vrijeme isteklo!</p>
              <p className="text-lg text-muted-foreground mb-2">
                Rezultat: <span className="font-black text-3xl text-sky-600" data-testid="text-final-score">{finalScore}</span>
              </p>
              <div className="text-sm text-muted-foreground mb-2 space-y-0.5">
                {bestEver !== null && (
                  <p>
                    Najbolji ikad: <span className="font-bold text-foreground" data-testid="text-best-ever">{bestEver}</span>
                    {previousBest !== null && finalScore !== null && finalScore > previousBest && (
                      <span className="ml-2 text-sky-600 font-bold">novi rekord!</span>
                    )}
                  </p>
                )}
                {previousBest !== null && previousBest > 0 && (
                  <p>Tvoj prethodni najbolji: <span className="font-bold text-foreground">{previousBest}</span></p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Tačno: <strong className="text-sky-600" data-testid="text-correct-count">{finalScore}</strong> · Netačno: <strong className="text-red-500" data-testid="text-wrong-count">{Math.max(0, answers.length - finalScore)}</strong>
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => { setState("idle"); refetchCredits(); }} className="rounded-2xl">
                  <RefreshCw className="w-4 h-4 mr-1" /> Igraj opet
                </Button>
                <Button variant="outline" onClick={() => setLocation("/igrice/ljestvica")} className="rounded-2xl">
                  Ljestvica
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
