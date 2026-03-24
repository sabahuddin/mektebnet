import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Pitanje {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

interface Kviz {
  id: number;
  naslov: string;
  nivo: number;
  pitanja: Pitanje[];
}

export default function KvizPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const [kviz, setKviz] = useState<Kviz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    if (!slug) return;
    apiRequest<Kviz>("GET", `/content/kvizovi/${slug}`)
      .then(setKviz)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) return <Layout><div className="max-w-2xl mx-auto"><Skeleton className="h-96 rounded-3xl" /></div></Layout>;
  if (!kviz) return <Layout><div className="text-center py-20 text-muted-foreground">Kviz nije pronađen</div></Layout>;

  const pitanja = kviz.pitanja;
  const pitanje = pitanja[current];
  const isLast = current === pitanja.length - 1;

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setAnswered(true);
    if (opt === pitanje.answer) setScore(s => s + 1);
  };

  const next = () => {
    if (isLast) {
      const bodovi = Math.round((score / pitanja.length) * 100);
      if (user && token) {
        apiRequest("POST", "/content/napredak", {
          contentType: "kviz",
          contentId: kviz.id,
          zavrsen: true,
          bodovi,
          tacniOdgovori: score,
          ukupnoPitanja: pitanja.length,
        }, token).catch(() => {});
      }
      setFinished(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setAnswered(false);
      setShowExplanation(false);
    }
  };

  if (finished) {
    const pct = Math.round((score / pitanja.length) * 100);
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl border-2 border-yellow-200 shadow-xl p-10 text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-2">Kviz završen!</h2>
            <p className="text-muted-foreground mb-6">Tačnih odgovora: {score} od {pitanja.length}</p>
            <div className="text-5xl font-extrabold text-primary mb-6">{pct}%</div>
            {pct >= 80 && (
              <div className="flex items-center gap-2 justify-center bg-yellow-50 text-yellow-700 rounded-2xl p-4 mb-6 border border-yellow-200">
                <Star className="w-5 h-5 fill-yellow-500" />
                <span className="font-bold">Odlično! Zaradio/la si hasanate</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setLocation("/kvizovi")} className="rounded-2xl">Nazad</Button>
              <Button onClick={() => { setCurrent(0); setScore(0); setSelected(null); setAnswered(false); setFinished(false); }} className="rounded-2xl">
                Ponovi
              </Button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setLocation("/kvizovi")} className="flex items-center gap-2 text-muted-foreground hover:text-primary font-medium mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad
        </button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold text-foreground">{kviz.naslov}</h1>
          <span className="text-sm font-bold text-muted-foreground">{current + 1} / {pitanja.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full mb-8 overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((current + 1) / pitanja.length) * 100}%` }} transition={{ type: "spring", stiffness: 300 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-3xl border border-border/50 shadow-sm p-6 md:p-8">
            <p className="text-lg font-bold text-foreground mb-6 leading-relaxed">{pitanje.question}</p>

            <div className="flex flex-col gap-3 mb-6">
              {pitanje.options.map((opt) => {
                const isCorrect = opt === pitanje.answer;
                const isSelected = opt === selected;
                let cls = "border-2 rounded-2xl px-5 py-4 text-left font-medium transition-all cursor-pointer ";
                if (!answered) {
                  cls += "border-border/50 hover:border-primary/50 hover:bg-primary/5";
                } else if (isCorrect) {
                  cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                } else if (isSelected) {
                  cls += "border-red-400 bg-red-50 text-red-800";
                } else {
                  cls += "border-border/30 text-muted-foreground opacity-60";
                }

                return (
                  <button key={opt} onClick={() => handleSelect(opt)} className={cls} disabled={answered}>
                    <div className="flex items-center gap-3">
                      {answered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                      {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                      <span>{opt}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {answered && pitanje.explanation && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <p className="text-sm font-medium text-blue-800">{pitanje.explanation}</p>
              </motion.div>
            )}

            {answered && (
              <div className="flex justify-end">
                <Button onClick={next} className="rounded-2xl px-8 font-bold">
                  {isLast ? "Završi" : "Sljedeće pitanje"}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Layout>
  );
}
