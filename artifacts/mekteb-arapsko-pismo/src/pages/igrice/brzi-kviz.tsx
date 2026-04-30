import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameTimer } from "@/components/game-timer";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Zap, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QQ { question: string; options: string[]; answer: string; }

// Klijent ne forsira fiksni timer — server vraća allowedDurationSec
// (po pravilu 60s za kviz, ili manje ako učenik ima manje credita).
type GameState = "idle" | "loading" | "playing" | "ended" | "no-credit" | "error";

export default function BrziKviz() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const [state, setState] = useState<GameState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QQ[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestEver, setBestEver] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);
  const [allowedDuration, setAllowedDuration] = useState<number>(60);
  const endingRef = useRef(false);

  const startGame = useCallback(async () => {
    if (!token) return;
    setErrorMsg("");
    setState("loading");
    endingRef.current = false;
    try {
      // Snimi prethodni best prije nove sesije (za prikaz na kraju)
      try {
        const prev = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const q = prev.games.find(g => g.gameId === "quiz");
        setPreviousBest(q?.bestScore ?? 0);
      } catch { setPreviousBest(null); }

      // Učitaj pitanja
      const qRes = await apiRequest<{ questions: QQ[] }>("GET", "/games/quiz-questions?count=60", undefined, token);
      if (!Array.isArray(qRes.questions) || qRes.questions.length < 5) {
        setErrorMsg("Nema dovoljno pitanja u bazi.");
        setState("error");
        return;
      }
      // Pokreni sesiju TEK NAKON što imamo pitanja (timer počinje server-side)
      const res = await apiRequest<{ sessionId: number; startedAt: string; allowedDurationSec: number }>(
        "POST", "/games/start", { gameId: "quiz" }, token
      );
      setSessionId(res.sessionId);
      setStartedAt(res.startedAt);
      setAllowedDuration(res.allowedDurationSec);
      setQuestions(qRes.questions);
      setQIndex(0);
      setCorrect(0);
      setWrong(0);
      setFeedback(null);
      setFinalScore(null);
      setBestEver(null);
      setState("playing");
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) setState("no-credit");
      else if (err.status === 409) { setErrorMsg("Već imaš igru u toku — osvježi stranicu."); setState("error"); }
      else { setErrorMsg(err.message || "Greška pri pokretanju"); setState("error"); }
    }
  }, [token]);

  const endGame = useCallback(async (finalCorrect: number, finalWrong: number) => {
    if (!sessionId || !token || endingRef.current) return;
    endingRef.current = true;
    // Bodovanje: score = broj tačnih, sa malim penalty-em na netačne (1 oduzima score po 3 promašaja).
    const score = Math.max(0, finalCorrect - Math.floor(finalWrong / 3));
    try {
      const r = await apiRequest<{ ok: boolean; finalScore?: number }>(
        "POST", "/games/end", { sessionId, score }, token
      );
      const accepted = typeof r.finalScore === "number" ? r.finalScore : score;
      setFinalScore(accepted);
      setState("ended");
      refetchCredits();
      try {
        const stats = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, token
        );
        const q = stats.games.find(g => g.gameId === "quiz");
        setBestEver(q?.bestScore ?? accepted);
      } catch { setBestEver(accepted); }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || "Greška pri završetku");
      setState("error");
    }
  }, [sessionId, token, refetchCredits]);

  const handleAnswer = (option: string) => {
    if (state !== "playing") return;
    if (feedback !== null) return;
    const q = questions[qIndex];
    if (!q) return;
    const isCorrect = option === q.answer;
    if (isCorrect) {
      setCorrect(c => c + 1);
      setFeedback("correct");
    } else {
      setWrong(w => w + 1);
      setFeedback("wrong");
    }
    setTimeout(() => {
      setFeedback(null);
      const nextIdx = qIndex + 1;
      if (nextIdx >= questions.length) {
        // Nestalo pitanja
        const fc = isCorrect ? correct + 1 : correct;
        const fw = isCorrect ? wrong : wrong + 1;
        void endGame(fc, fw);
      } else {
        setQIndex(nextIdx);
      }
    }, 600);
  };

  const handleExpire = useCallback(() => {
    if (state !== "playing") return;
    void endGame(correct, wrong);
  }, [state, correct, wrong, endGame]);

  // Cleanup: ako user napusti stranicu mid-game, end session sa current score
  useEffect(() => {
    return () => {
      if (state === "playing" && sessionId && token && !endingRef.current) {
        const score = Math.max(0, correct - Math.floor(wrong / 3));
        endingRef.current = true;
        // Best-effort, no await
        apiRequest("POST", "/games/end", { sessionId, score }, token).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Zap className="w-7 h-7 text-orange-500" /> Brzi kviz
        </h1>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {state === "playing" && startedAt && (
            <GameTimer startedAt={startedAt} allowedDurationSec={allowedDuration} onExpire={handleExpire} />
          )}
        </div>
      </div>

      {state === "idle" && (
        <Card className="p-6 mb-6 bg-orange-50 border-orange-200">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-orange-600 shrink-0" />
            <div>
              <p className="font-bold text-foreground mb-1">60 sekundi — koliko tačnih?</p>
              <p className="text-sm text-muted-foreground">Score = broj tačnih odgovora. Pitanja iz svih ilmihal lekcija. Pokušaj pogoditi što više za 60 s.</p>
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
            data-testid="button-start-brzi-kviz"
            className="rounded-2xl font-bold bg-orange-500 hover:bg-orange-600"
          >
            {creditsLoading ? "Učitavam…" : "Pokreni igru"}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">Nemaš vremena za igre. Završi neku lekciju za nove hasanate.</p>
          )}
        </Card>
      )}

      {state === "loading" && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Učitavam pitanja…</p></Card>
      )}

      {state === "no-credit" && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="font-bold text-foreground mb-2">Nemaš više vremena za igre.</p>
          <p className="text-sm text-muted-foreground mb-3">Završi lekciju ili kviz da zaradiš nove hasanate.</p>
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
            <span className="text-emerald-600">Tačno: <span className="text-foreground">{correct}</span></span>
            <span className="text-red-500">Netačno: <span className="text-foreground">{wrong}</span></span>
            <span className="text-muted-foreground">Pitanje #{qIndex + 1}</span>
          </div>
          <Card className="p-6 mb-4 relative overflow-hidden">
            <p className="text-lg font-bold text-foreground mb-5" data-testid="text-question">{currentQ.question}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQ.options.map((opt, i) => {
                const isCorrectOpt = feedback !== null && opt === currentQ.answer;
                const isWrongPick = feedback === "wrong" && opt !== currentQ.answer;
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt)}
                    disabled={feedback !== null}
                    data-testid={`button-answer-${i}`}
                    className={`text-left p-4 rounded-2xl border-2 font-medium transition-all ${
                      isCorrectOpt
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : isWrongPick
                        ? "bg-muted border-border text-muted-foreground"
                        : "bg-white border-border hover:border-orange-400 hover:bg-orange-50"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {feedback === "correct" && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute top-3 right-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>
              )}
              {feedback === "wrong" && (
                <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="absolute top-3 right-3">
                  <XCircle className="w-10 h-10 text-red-500" />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </>
      )}

      <AnimatePresence>
        {state === "ended" && finalScore !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-8 mt-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300 text-center">
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-2xl font-black text-foreground mb-1">Vrijeme isteklo!</p>
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
                Tačno: <strong className="text-emerald-600">{correct}</strong> · Netačno: <strong className="text-red-500">{wrong}</strong>
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
