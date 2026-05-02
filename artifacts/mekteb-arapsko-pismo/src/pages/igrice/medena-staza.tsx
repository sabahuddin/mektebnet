import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Flower2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Question = {
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type Feedback = {
  type: "correct" | "wrong";
  text: string;
};

const questions: Question[] = [
  {
    category: "Namaz",
    question: "Koji namaz se klanja prije izlaska sunca?",
    options: ["Sabah", "Podne", "Akšam", "Jacija"],
    correctIndex: 0,
    explanation: "Sabah se klanja prije izlaska sunca.",
  },
  {
    category: "Abdest",
    question: "Šta se uzima prije namaza kada nemamo abdest?",
    options: ["Abdest", "Zekat", "Post", "Hadž"],
    correctIndex: 0,
    explanation: "Abdest je čišćenje prije namaza.",
  },
  {
    category: "Kur'an",
    question: "Kako se zove Allahova Knjiga objavljena Muhammedu, a.s.?",
    options: ["Tevrat", "Zebur", "Indžil", "Kur'an"],
    correctIndex: 3,
    explanation: "Kur'an je posljednja Allahova objava.",
  },
  {
    category: "Dova",
    question: "Šta je dova?",
    options: [
      "Obraćanje Allahu",
      "Ime jednog namaza",
      "Naziv mjeseca",
      "Vrsta hrane",
    ],
    correctIndex: 0,
    explanation: "Dova je obraćanje Allahu i traženje dobra od Njega.",
  },
  {
    category: "Lijepo ponašanje",
    question: "Šta je lijepo reći kada sretnemo muslimana?",
    options: ["Doviđenja", "Esselamu alejkum", "Laku noć", "Izvini"],
    correctIndex: 1,
    explanation: "Selam je lijep islamski pozdrav i dova za mir.",
  },
  {
    category: "Ramazan",
    question: "Kako se zove mjesec u kojem muslimani poste?",
    options: ["Ševval", "Muharrem", "Ramazan", "Redžeb"],
    correctIndex: 2,
    explanation: "Ramazan je mjesec posta, Kur'ana i ibadeta.",
  },
  {
    category: "Dobra djela",
    question: "Koje od ovoga je dobro djelo?",
    options: ["Ruganje", "Laž", "Pomoć roditeljima", "Svađa"],
    correctIndex: 2,
    explanation: "Pomoć roditeljima je veliko i lijepo dobro djelo.",
  },
  {
    category: "Imanski šarti",
    question: "Koliko ima imanskih šarta?",
    options: ["Četiri", "Pet", "Šest", "Sedam"],
    correctIndex: 2,
    explanation: "Imanskih šarta ima šest.",
  },
];

const MAX_LIVES = 3;
const HONEY_PER_CORRECT = 10;

type GameState = "idle" | "loading" | "playing" | "ended" | "no-credit" | "error";

export default function MedenaStaza() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const [state, setState] = useState<GameState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const endingRef = useRef(false);

  // Game logika (originalna iz korisnikovog koda)
  const [step, setStep] = useState(0);
  const [honey, setHoney] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);

  // Server-side rezultat (autoritet) i best-ever statistika
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestEver, setBestEver] = useState<number | null>(null);
  const [previousBest, setPreviousBest] = useState<number | null>(null);

  const currentQuestion = questions[step];
  const progressPercent = Math.round((step / questions.length) * 100);

  // Refs za cleanup (izbjegavamo stale closure pri unmount-u)
  const stateRef = useRef(state);
  const tokenRef = useRef(token);
  const sessionIdRef = useRef(sessionId);
  const honeyRef = useRef(honey);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { honeyRef.current = honey; }, [honey]);

  const clearPendingTimeout = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Server upload finalnog rezultata (autoritet je server)
  const endGame = useCallback(async (finalSc: number) => {
    const sid = sessionIdRef.current;
    const tok = tokenRef.current;
    if (!sid || !tok || endingRef.current) return;
    endingRef.current = true;
    try {
      const r = await apiRequest<{ ok: boolean; finalScore?: number }>(
        "POST", "/games/end", { sessionId: sid, score: finalSc }, tok
      );
      const accepted = typeof r.finalScore === "number" ? r.finalScore : finalSc;
      setFinalScore(accepted);
      setState("ended");
      refetchCredits();
      try {
        const stats = await apiRequest<{ games: { gameId: string; bestScore: number }[] }>(
          "GET", "/games/personal-stats", undefined, tok
        );
        const m = stats.games.find(g => g.gameId === "medena");
        setBestEver(m?.bestScore ?? accepted);
      } catch { setBestEver(accepted); }
    } catch (e) {
      const err = e as { message?: string };
      setErrorMsg(err.message || "Greška pri završetku");
      setState("error");
    }
  }, [refetchCredits]);

  // Triger se kada finished/failed pređu na true (kraj igre)
  useEffect(() => {
    if ((finished || failed) && state === "playing" && !endingRef.current) {
      void endGame(honeyRef.current);
    }
  }, [finished, failed, state, endGame]);

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
        const m = prev.games.find(g => g.gameId === "medena");
        setPreviousBest(m?.bestScore ?? 0);
      } catch { setPreviousBest(null); }

      const res = await apiRequest<{ sessionId: number }>(
        "POST", "/games/start", { gameId: "medena" }, token
      );
      setSessionId(res.sessionId);
      // Reset game state
      clearPendingTimeout();
      setStep(0);
      setHoney(0);
      setLives(MAX_LIVES);
      setSelectedIndex(null);
      setFeedback(null);
      setFinished(false);
      setFailed(false);
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

  const answerQuestion = (optionIndex: number) => {
    if (state !== "playing") return;
    if (selectedIndex !== null || finished || failed) return;

    setSelectedIndex(optionIndex);

    const isCorrect = optionIndex === currentQuestion.correctIndex;

    if (isCorrect) {
      setHoney((prev) => prev + HONEY_PER_CORRECT);
      setFeedback({
        type: "correct",
        text: `Tačno. ${currentQuestion.explanation}`,
      });

      timeoutRef.current = window.setTimeout(() => {
        if (step + 1 >= questions.length) {
          setFinished(true);
          setFeedback(null);
          setSelectedIndex(null);
          return;
        }

        setStep((prev) => prev + 1);
        setSelectedIndex(null);
        setFeedback(null);
      }, 900);

      return;
    }

    const nextLives = lives - 1;
    setLives(nextLives);
    setFeedback({
      type: "wrong",
      text:
        nextLives <= 0
          ? `Netačno. Tačan odgovor je: ${currentQuestion.options[currentQuestion.correctIndex]}.`
          : "Netačno. Pokušaj još jednom.",
    });

    timeoutRef.current = window.setTimeout(() => {
      if (nextLives <= 0) {
        setFailed(true);
        setSelectedIndex(null);
        return;
      }

      setSelectedIndex(null);
      setFeedback(null);
    }, 950);
  };

  // Cleanup: ako user napusti sredinom igre, end session sa partial honey
  useEffect(() => {
    return () => {
      clearPendingTimeout();
      if (stateRef.current === "playing" && sessionIdRef.current && tokenRef.current && !endingRef.current) {
        endingRef.current = true;
        const partial = honeyRef.current;
        apiRequest("POST", "/games/end", { sessionId: sessionIdRef.current, score: partial }, tokenRef.current).catch(() => {});
      }
    };
  }, []);

  // Role guards
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
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-medena-staza">
          <p className="font-bold text-foreground mb-2">Igrice su dostupne samo učeničkim nalozima</p>
          <Link href="/igrice" className="text-primary font-bold underline">Nazad</Link>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/igrice">
          <Button variant="ghost" size="sm" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1" /> Natrag
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Flower2 className="w-7 h-7 text-emerald-600" /> Medena staza
        </h1>
      </div>

      {state === "loading" && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">Pokrećem igru…</p></Card>
      )}

      {state === "idle" && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-200">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-foreground mb-1">Pčelica ide od cvijeta do cvijeta</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Svaki cvijet krije po jedno ilmihal pitanje. Tačan odgovor = <strong>10 meda</strong>.
                Imaš <strong>3 života</strong>. Dođi do kraja staze i osvoji svih 80 meda!
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Preostalo vremena: <strong>{creditsLoading ? "…" : formatSeconds(credits?.secondsRemaining ?? 0)}</strong>
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={creditsLoading || (credits?.secondsRemaining ?? 0) <= 0}
            data-testid="button-start-medena"
            className="rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {creditsLoading ? "Učitavam…" : "Pokreni igru"}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">Nemaš dovoljno vremena. Završi neku lekciju za nove Aferime.</p>
          )}
        </Card>
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

      {state === "playing" && (
        <div className="flex flex-col gap-4">
          {/* HUD */}
          <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 sm:grid-cols-4">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Med</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums" data-testid="text-honey">{honey}</p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Životi</p>
              <p className="text-2xl font-bold text-emerald-950" data-testid="text-lives">
                {"♥".repeat(lives)}
                <span className="text-slate-300">{"♥".repeat(MAX_LIVES - lives)}</span>
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Staza</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums">
                {Math.min(step + 1, questions.length)} / {questions.length}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Napredak</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums">{progressPercent}%</p>
            </div>
          </section>

          {/* Path / cvjetovi */}
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
            <div className="mb-4 h-3 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {questions.map((question, index) => {
                const isDone = index < step;
                const isCurrent = index === step && !finished && !failed;

                return (
                  <div
                    key={`${question.category}-${index}`}
                    className={[
                      "flex min-h-24 flex-col items-center justify-center rounded-3xl p-3 text-center shadow-sm ring-1 transition",
                      isDone
                        ? "bg-amber-100 text-amber-900 ring-amber-200"
                        : isCurrent
                          ? "bg-emerald-600 text-white ring-emerald-700"
                          : "bg-emerald-50 text-emerald-900 ring-emerald-100",
                    ].join(" ")}
                  >
                    <div className="text-2xl">{isDone ? "🍯" : isCurrent ? "🐝" : "🌼"}</div>
                    <p className="mt-1 text-xs font-bold">{question.category}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {!finished && !failed && currentQuestion && (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
              <div className="mb-4">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                  Cvijet {step + 1}: {currentQuestion.category}
                </p>
                <h2 className="mt-2 text-xl font-bold text-emerald-950 sm:text-2xl" data-testid="text-question">
                  {currentQuestion.question}
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedIndex === index;
                  const isCorrect = index === currentQuestion.correctIndex;

                  const resultClass =
                    selectedIndex === null
                      ? "bg-white text-slate-800 ring-emerald-100 hover:bg-emerald-50"
                      : isSelected && isCorrect
                        ? "bg-emerald-600 text-white ring-emerald-700"
                        : isSelected && !isCorrect
                          ? "bg-red-500 text-white ring-red-600"
                          : "bg-slate-50 text-slate-500 ring-slate-100";

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => answerQuestion(index)}
                      disabled={selectedIndex !== null}
                      data-testid={`button-answer-${index}`}
                      className={[
                        "rounded-2xl px-4 py-4 text-left text-sm font-bold shadow-sm ring-1 transition sm:text-base",
                        resultClass,
                      ].join(" ")}
                    >
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <div
                  className={[
                    "mt-4 rounded-2xl p-4 text-sm font-semibold ring-1",
                    feedback.type === "correct"
                      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                      : "bg-red-50 text-red-900 ring-red-200",
                  ].join(" ")}
                  data-testid={`feedback-${feedback.type}`}
                >
                  {feedback.text}
                </div>
              )}
            </section>
          )}

          {(finished || failed) && (
            <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-emerald-100">
              <p className="text-muted-foreground">Šaljem rezultat…</p>
            </section>
          )}
        </div>
      )}

      <AnimatePresence>
        {state === "ended" && finalScore !== null && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-8 mt-6 bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-300 text-center">
              <div className="text-5xl mb-3">{finished ? "🍯" : "🐝"}</div>
              <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-2xl font-black text-foreground mb-1">
                {finished ? "Aferim! Stigao si do kraja staze." : "Pčelica se umorila."}
              </p>
              <p className="text-lg text-muted-foreground mb-2">
                Skupljeno meda: <span className="font-black text-3xl text-emerald-600" data-testid="text-final-score">{finalScore}</span>
              </p>
              <div className="text-sm text-muted-foreground mb-4 space-y-0.5">
                {bestEver !== null && (
                  <p>
                    Najbolji ikad: <span className="font-bold text-foreground" data-testid="text-best-ever">{bestEver}</span>
                    {previousBest !== null && finalScore > previousBest && (
                      <span className="ml-2 text-emerald-600 font-bold">novi rekord!</span>
                    )}
                  </p>
                )}
                {previousBest !== null && previousBest > 0 && (
                  <p>Tvoj prethodni najbolji: <span className="font-bold text-foreground">{previousBest}</span></p>
                )}
              </div>
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
