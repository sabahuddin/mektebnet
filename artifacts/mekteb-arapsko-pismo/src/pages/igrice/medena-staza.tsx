import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Trophy, Sparkles, Flower2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Server-side oblik pitanja iz GET /games/medena/pitanja.
// `kategorija` je interni kod (npr. "namaz"), prikazni naziv + ikona dolaze iz mape ispod.
type Question = {
  id: number;
  kategorija: string;
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  objasnjenje: string;
};

type Feedback = {
  type: "correct" | "wrong";
  text: string;
};

// Klijentska kopija MEDENA_KATEGORIJE_META (mora se sinkronizirati sa lib/db/schema/learning.ts).
// Frontend ne smije importati iz @workspace/db (drizzle runtime) pa je ovo duplicirano.
const KATEGORIJE_META: Record<string, { naziv: string; ikona: string }> = {
  sarti: { naziv: "Imanski i islamski šarti", ikona: "⭐" },
  sure: { naziv: "Sure i ajeti", ikona: "📖" },
  dove: { naziv: "Dove i zikrovi", ikona: "🤲" },
  namaz: { naziv: "Namaz i ibadeti", ikona: "🕌" },
  ponasanje: { naziv: "Lijepo ponašanje", ikona: "💝" },
  halal_haram: { naziv: "Halal i haram", ikona: "⚖️" },
  historija: { naziv: "Islamska historija", ikona: "📜" },
  bosna: { naziv: "Bosna i njena baština", ikona: "🇧🇦" },
};
function metaFor(kat: string): { naziv: string; ikona: string } {
  return KATEGORIJE_META[kat] ?? { naziv: kat, ikona: "❓" };
}

const MAX_LIVES = 3;
const HONEY_PER_CORRECT = 10;

type GameState = "idle" | "loading" | "playing" | "ended" | "no-credit" | "error";

export default function MedenaStaza() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { data: credits, loading: creditsLoading, refetch: refetchCredits } = useGameCredits();

  const [state, setState] = useState<GameState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

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
      setErrorMsg(err.message || t("Greška pri završetku"));
      setState("error");
    }
  }, [refetchCredits, t]);

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

      // Prvo povuci pitanja sa servera (8 random kategorija). Bitno: ako pitanja
      // ne stignu, NE smijemo pozvati /games/start jer bismo trošili credit bez igre.
      const pitanjaRes = await apiRequest<{ pitanja: Question[] }>(
        "GET", "/games/medena/pitanja", undefined, token
      );
      if (!Array.isArray(pitanjaRes.pitanja) || pitanjaRes.pitanja.length === 0) {
        setErrorMsg(t("Banka pitanja je prazna. Obavijesti učitelja da napuni pitanja."));
        setState("error");
        return;
      }

      const res = await apiRequest<{ sessionId: number }>(
        "POST", "/games/start", { gameId: "medena" }, token
      );
      setSessionId(res.sessionId);
      // Reset game state
      clearPendingTimeout();
      setQuestions(pitanjaRes.pitanja);
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
      else if (err.status === 409) { setErrorMsg(t("Već imaš igru u toku — osvježi stranicu.")); setState("error"); }
      else { setErrorMsg(err.message || t("Greška pri pokretanju")); setState("error"); }
    }
  }, [token, t]);

  const answerQuestion = (optionIndex: number) => {
    if (state !== "playing") return;
    if (selectedIndex !== null || finished || failed) return;

    setSelectedIndex(optionIndex);

    if (!currentQuestion) return;
    const isCorrect = optionIndex === currentQuestion.correctIndex;

    if (isCorrect) {
      setHoney((prev) => prev + HONEY_PER_CORRECT);
      setFeedback({
        type: "correct",
        text: t("Tačno. {obj}", { obj: currentQuestion.objasnjenje }),
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
          ? t("Netačno. Tačan odgovor je: {odgovor}.", { odgovor: currentQuestion.opcije[currentQuestion.correctIndex] })
          : t("Netačno. Pokušaj još jednom."),
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
          <p className="font-bold text-foreground mb-2">{t("Igrice su za prijavljene učenike")}</p>
          <Link href="/login" className="text-primary font-bold underline">{t("Prijavi se")}</Link>
        </Card>
      </Layout>
    );
  }
  if (user.role !== "ucenik") {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-medena-staza">
          <p className="font-bold text-foreground mb-2">{t("Igrice su dostupne samo učeničkim nalozima")}</p>
          <BackLink fallback="/igrice" className="text-primary font-bold underline">{t("Nazad")}</BackLink>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="rounded-xl">
          <BackLink fallback="/igrice">
            <ArrowLeft className="w-4 h-4 mr-1" /> {t("Natrag")}
          </BackLink>
        </Button>
        <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-2">
          <Flower2 className="w-7 h-7 text-emerald-600" /> {t("Medena staza")}
        </h1>
      </div>

      {state === "loading" && (
        <Card className="p-8 text-center"><p className="text-muted-foreground">{t("Pokrećem igru…")}</p></Card>
      )}

      {state === "idle" && (
        <Card className="p-6 mb-6 bg-gradient-to-br from-emerald-50 to-amber-50 border-emerald-200">
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-foreground mb-1">{t("Pčelica ide od cvijeta do cvijeta")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("Svaki cvijet krije po jedno ilmihal pitanje. Tačan odgovor = ")}<strong>{t("10 meda")}</strong>.
                {t(" Imaš ")}<strong>{t("3 života")}</strong>. {t("Dođi do kraja staze i osvoji svih 80 meda!")}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {t("Preostalo vremena: ")}<strong>{creditsLoading ? "…" : formatSeconds(credits?.secondsRemaining ?? 0)}</strong>
              </p>
            </div>
          </div>
          <Button
            onClick={startGame}
            disabled={creditsLoading || (credits?.secondsRemaining ?? 0) <= 0}
            data-testid="button-start-medena"
            className="rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {creditsLoading ? t("Učitavam…") : t("Pokreni igru")}
          </Button>
          {!creditsLoading && (credits?.secondsRemaining ?? 0) <= 0 && (
            <p className="text-sm text-red-600 mt-3 font-medium">{t("Nemaš dovoljno vremena. Završi neku lekciju za nove kapi meda 🍯.")}</p>
          )}
        </Card>
      )}

      {state === "no-credit" && (
        <Card className="p-6 bg-amber-50 border-amber-200">
          <p className="font-bold text-foreground mb-2">{t("Nemaš više vremena za igre.")}</p>
          <p className="text-sm text-muted-foreground mb-3">{t("Završi lekciju ili kviz da zaradiš nove kapi meda 🍯.")}</p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/ilmihal"><Button size="sm" className="rounded-xl">{t("Ilmihal")}</Button></Link>
            <Link href="/kvizovi"><Button size="sm" variant="outline" className="rounded-xl">{t("Kvizovi")}</Button></Link>
          </div>
        </Card>
      )}

      {state === "error" && (
        <Card className="p-6 bg-red-50 border-red-200">
          <p className="font-bold text-red-700 mb-2">{t("Greška")}</p>
          <p className="text-sm text-muted-foreground mb-3">{errorMsg}</p>
          <Button size="sm" onClick={() => setState("idle")} className="rounded-xl">{t("Nazad")}</Button>
        </Card>
      )}

      {state === "playing" && (
        <div className="flex flex-col gap-4">
          {/* HUD */}
          <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 sm:grid-cols-4">
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">{t("Med")}</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums" data-testid="text-honey">{honey}</p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">{t("Životi")}</p>
              <p className="text-2xl font-bold text-emerald-950" data-testid="text-lives">
                {"♥".repeat(lives)}
                <span className="text-slate-300">{"♥".repeat(MAX_LIVES - lives)}</span>
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">{t("Staza")}</p>
              <p className="text-2xl font-bold text-emerald-950 tabular-nums">
                {Math.min(step + 1, questions.length)} / {questions.length}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">{t("Napredak")}</p>
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
                const meta = metaFor(question.kategorija);

                return (
                  <div
                    key={`${question.id}-${index}`}
                    className={[
                      "flex min-h-24 flex-col items-center justify-center rounded-3xl p-3 text-center shadow-sm ring-1 transition",
                      isDone
                        ? "bg-amber-100 text-amber-900 ring-amber-200"
                        : isCurrent
                          ? "bg-emerald-600 text-white ring-emerald-700"
                          : "bg-emerald-50 text-emerald-900 ring-emerald-100",
                    ].join(" ")}
                  >
                    <div className="text-2xl">{isDone ? "🍯" : isCurrent ? "🐝" : meta.ikona}</div>
                    <p className="mt-1 text-[10px] font-bold leading-tight line-clamp-2">{t(meta.naziv)}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {!finished && !failed && currentQuestion && (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
              <div className="mb-4">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                  {metaFor(currentQuestion.kategorija).ikona} {t("Cvijet {broj}: {naziv}", { broj: String(step + 1), naziv: t(metaFor(currentQuestion.kategorija).naziv) })}
                </p>
                <h2 className="mt-2 text-xl font-bold text-emerald-950 sm:text-2xl" data-testid="text-question">
                  {currentQuestion.pitanje}
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentQuestion.opcije.map((option, index) => {
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
              <p className="text-muted-foreground">{t("Šaljem rezultat…")}</p>
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
                {finished ? t("Aferim! Stigao si do kraja staze.") : t("Pčelica se umorila.")}
              </p>
              <p className="text-lg text-muted-foreground mb-2">
                {t("Skupljeno meda: ")}<span className="font-black text-3xl text-emerald-600" data-testid="text-final-score">{finalScore}</span>
              </p>
              <div className="text-sm text-muted-foreground mb-4 space-y-0.5">
                {bestEver !== null && (
                  <p>
                    {t("Najbolji ikad: ")}<span className="font-bold text-foreground" data-testid="text-best-ever">{bestEver}</span>
                    {previousBest !== null && finalScore > previousBest && (
                      <span className="ml-2 text-emerald-600 font-bold">{t("novi rekord!")}</span>
                    )}
                  </p>
                )}
                {previousBest !== null && previousBest > 0 && (
                  <p>{t("Tvoj prethodni najbolji: ")}<span className="font-bold text-foreground">{previousBest}</span></p>
                )}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button onClick={() => { setState("idle"); refetchCredits(); }} className="rounded-2xl">
                  <RefreshCw className="w-4 h-4 mr-1" /> {t("Igraj opet")}
                </Button>
                <Button variant="outline" onClick={() => setLocation("/igrice/ljestvica")} className="rounded-2xl">
                  {t("Tabela")}
                </Button>
                <Button asChild variant="ghost" className="rounded-2xl">
                  <BackLink fallback="/igrice">{t("Natrag na Igrice")}</BackLink>
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
