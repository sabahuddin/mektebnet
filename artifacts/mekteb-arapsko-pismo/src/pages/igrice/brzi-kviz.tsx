import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GameTimer } from "@/components/game-timer";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Zap, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Pitanja iz /games/start (BEZ `answer` — server čuva tačan odgovor i sam
// validira pri /games/end). `id` je session-scoped stabilni ključ.
interface QQ { id: string; question: string; options: string[]; }
interface AnswerRecord { questionId: string; optionIndex: number; }

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
  // Server-side scoring: klijent ne zna real-time tačnost odgovora (anti-cheat).
  // Tracking-amo samo izbore; pri /games/end server vraća finalScore (broj tačnih).
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  // `feedback !== null` se koristi samo da se buttoni privremeno onemoguće
  // tokom transition delay-a između pitanja (300ms). Više nema vizualnog
  // tačno/netačno indikatora jer to bi tražilo da klijent zna odgovor.
  const [feedback, setFeedback] = useState<"locked" | null>(null);
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

      // Pitanja sada generira server unutar /games/start (anti-cheat: server
      // čuva tačne odgovore, klijent ih ne vidi). Jedan poziv = sesija + pitanja.
      const res = await apiRequest<{ sessionId: number; startedAt: string; allowedDurationSec: number; questions?: QQ[] }>(
        "POST", "/games/start", { gameId: "quiz" }, token
      );
      const qs = Array.isArray(res.questions) ? res.questions : [];
      if (qs.length < 5) {
        setErrorMsg("Nema dovoljno pitanja u bazi.");
        setState("error");
        return;
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
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 403) setState("no-credit");
      else if (err.status === 409) { setErrorMsg("Već imaš igru u toku — osvježi stranicu."); setState("error"); }
      else if (err.status === 503) { setErrorMsg("Nema dovoljno pitanja u bazi."); setState("error"); }
      else { setErrorMsg(err.message || "Greška pri pokretanju"); setState("error"); }
    }
  }, [token]);

  // Klijent NE računa score; šalje samo izbore. Server vraća `finalScore`
  // koji je validiran protiv pohranjene liste pitanja sa odgovorima.
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
        const q = stats.games.find(g => g.gameId === "quiz");
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
    // Optimistično UX računanje (server je autoritet za stvarni score). Mi ne
    // znamo koji je tačan odgovor — UI pokazuje "tačno"/"netačno" tek pri
    // /games/end response-u; ovdje tracking-am izbore ali bez vizualne potvrde
    // koji je tačan. Kompromis: prikaz feedback-a baziran na quick-check protiv
    // pretpostavljenih correct/wrong je nemoguć bez exposure-a odgovora. Stoga
    // ovdje samo registriramo izbor i prelazimo na sljedeće pitanje.
    setFeedback("locked"); // privremeno disable buttone tokom 250ms transition
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

  // Refs prate najsvježije vrijednosti za cleanup (izbjegavamo stale closure
  // u unmount handleru — bez ovoga partial answers bi koristili snapshot
  // od mount-a, pa bi učenik dobio 0 bodova umjesto stvarnog rezultata).
  const stateRef = useRef(state);
  const answersRef = useRef(answers);
  const tokenRef = useRef(token);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Cleanup: ako user napusti stranicu mid-game, end session sa current
  // odgovorima. Server validira i čuva real score (parcijalan ali pošten).
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
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-brzi-kviz">
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
              <p className="text-sm text-muted-foreground">Score = broj tačnih odgovora. Pitanja iz svih ilmihal lekcija. Pokušaj odgovoriti što više za 60 s — rezultat saznaješ na kraju.</p>
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
          {/* Server-side scoring: klijent ne zna real-time da li je odgovor
              tačan (anti-cheat). Tokom igre prikazujemo samo broj odgovorenih
              i indeks pitanja; rezultat (tačno/netačno) saznaje se na kraju. */}
          <div className="flex items-center justify-between gap-4 mb-4 text-sm font-bold">
            <span className="text-orange-600">Odgovoreno: <span className="text-foreground" data-testid="text-answered-count">{answers.length}</span></span>
            <span className="text-muted-foreground">Pitanje #{qIndex + 1}</span>
          </div>
          <Card className="p-6 mb-4 relative overflow-hidden">
            <p className="text-lg font-bold text-foreground mb-5" data-testid="text-question">{currentQ.question}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={feedback !== null}
                  data-testid={`button-answer-${i}`}
                  className="text-left p-4 rounded-2xl border-2 font-medium transition-all bg-white border-border hover:border-orange-400 hover:bg-orange-50 disabled:opacity-60"
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
                Tačno: <strong className="text-emerald-600" data-testid="text-correct-count">{finalScore}</strong> · Netačno: <strong className="text-red-500" data-testid="text-wrong-count">{Math.max(0, answers.length - finalScore)}</strong>
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
