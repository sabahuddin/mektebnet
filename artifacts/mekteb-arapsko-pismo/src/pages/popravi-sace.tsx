import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, CheckCircle2, XCircle, Sparkles, BookOpen, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

interface Greska {
  id: number;
  sourceType: string;
  sourceId: number;
  sourceNaslov: string;
  questionText: string;
  options: string[];
  attempts: number;
  createdAt: string;
}

interface OdgovorResp {
  ok: boolean;
  correct: boolean;
  correctIndex?: number;
  nagradaAferim?: number;
  message?: string;
}

// Mali Fisher-Yates da redoslijed opcija varira između pokušaja — dijete
// ne pamti poziciju nego sadržaj. Vraćamo i index map nazad u original.
function shuffleWithMap<T>(arr: T[]): { items: T[]; map: number[] } {
  const idx = arr.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { items: idx.map(i => arr[i]), map: idx };
}

export default function PopraviSacePage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Greska[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [shuffled, setShuffled] = useState<{ items: string[]; map: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [resolved, setResolved] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    if (!token) return;
    setItems(null);
    apiRequest<{ items: Greska[] }>("GET", "/popravi-sace/lista", undefined, token)
      .then(r => {
        setItems(r.items);
        if (r.items.length > 0 && activeId === null) {
          const first = r.items[0];
          setActiveId(first.id);
          setShuffled(shuffleWithMap(first.options));
        }
      })
      .catch(() => setItems([]));
  }, [token, activeId]);

  useEffect(() => { load(); }, [load]);

  const active = items?.find(i => i.id === activeId) ?? null;

  const pickAnswer = async (shuffledIdx: number) => {
    if (!active || !shuffled || !token || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const realIdx = shuffled.map[shuffledIdx];
      const resp = await apiRequest<OdgovorResp>(
        "POST", "/popravi-sace/odgovor",
        { id: active.id, optionIndex: realIdx },
        token,
      );
      if (resp.correct) {
        setFeedback("correct");
        setResolved(prev => {
          const next = new Set(prev);
          next.add(active.id);
          return next;
        });
        toast({
          title: `+${resp.nagradaAferim ?? 5} kapi meda 🍯`,
          description: "Saće je popravljeno!",
        });
        // Sačekaj malo da feedback bude vidljiv, pa pređi na sljedeću grešku.
        setTimeout(() => {
          const remaining = (items ?? []).filter(i => i.id !== active.id && !resolved.has(i.id));
          if (remaining.length > 0) {
            setActiveId(remaining[0].id);
            setShuffled(shuffleWithMap(remaining[0].options));
            setFeedback(null);
          } else {
            // Sve riješene — reload da provjerimo da li ima novih.
            setActiveId(null);
            setShuffled(null);
            setFeedback(null);
            load();
          }
        }, 1100);
      } else {
        setFeedback("wrong");
        setTimeout(() => setFeedback(null), 1200);
      }
    } catch {
      toast({ title: "Greška pri slanju odgovora", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-muted-foreground">Prijavi se da koristiš Popravi saće.</p>
          <Link href="/login" className="text-primary font-bold underline">Prijava</Link>
        </div>
      </Layout>
    );
  }

  if (items === null) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-16 rounded-2xl mb-4" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </Layout>
    );
  }

  const openCount = items.filter(i => !resolved.has(i.id)).length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/ucenik" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary text-sm font-medium mb-3">
            <ArrowLeft className="w-4 h-4" /> Nazad na profil
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-md">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Popravi saće</h1>
              <p className="text-sm text-muted-foreground">
                Riješi pitanja na kojima si ranije pogriješio/la i zaradi po <strong>5 kapi meda 🍯</strong>.
              </p>
            </div>
          </div>
        </div>

        {openCount === 0 && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-10 text-center"
          >
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-emerald-900 mb-2">Saće je čisto!</h2>
            <p className="text-sm text-emerald-800 mb-6">
              Nemaš nepopravljenih grešaka. Riješi neki kviz pa vidi ima li novih rupa za popraviti.
            </p>
            <Link href="/kvizovi">
              <Button className="rounded-2xl">
                <BookOpen className="w-4 h-4 mr-2" /> Idi na kvizove
              </Button>
            </Link>
          </motion.div>
        )}

        {active && shuffled && (
          <motion.div
            key={active.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-3xl border-2 border-amber-200 shadow-lg p-6"
          >
            <div className="flex items-center justify-between mb-4 text-xs">
              <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
                {active.sourceNaslov || `${active.sourceType} #${active.sourceId}`}
              </span>
              <span className="text-muted-foreground">
                Pokušaj #{active.attempts} · {openCount} {openCount === 1 ? "rupa" : "rupa"} preostalo
              </span>
            </div>

            <h2 className="text-lg font-extrabold text-foreground mb-5 leading-snug">
              {active.questionText}
            </h2>

            <div className="flex flex-col gap-3 mb-4">
              {shuffled.items.map((opt, idx) => {
                const isWrongFeedback = feedback === "wrong" && busy === false;
                const isCorrectFeedback = feedback === "correct" && busy === false;
                let cls = "border-2 rounded-2xl px-5 py-4 text-left font-medium transition-all cursor-pointer ";
                if (feedback === null) {
                  cls += busy
                    ? "border-border/30 opacity-60 cursor-not-allowed"
                    : "border-border/50 hover:border-primary/50 hover:bg-primary/5";
                } else if (isCorrectFeedback) {
                  cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                } else if (isWrongFeedback) {
                  cls += "border-red-300 bg-red-50/40 text-foreground/60";
                } else {
                  cls += "border-border/30 opacity-60";
                }
                return (
                  <button
                    key={`${active.id}-${idx}-${opt}`}
                    onClick={() => pickAnswer(idx)}
                    className={cls}
                    disabled={busy || feedback !== null}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {feedback === "correct" && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 bg-emerald-50 text-emerald-800 rounded-2xl p-3 border border-emerald-200"
                >
                  <Sparkles className="w-5 h-5" /> <strong>Bravo! +5 kapi meda 🍯.</strong> Saće je popravljeno.
                </motion.div>
              )}
              {feedback === "wrong" && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 bg-red-50 text-red-800 rounded-2xl p-3 border border-red-200"
                >
                  <XCircle className="w-5 h-5" /> Nije tačno — pokušaj ponovo.
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {!active && openCount > 0 && (
          <Button
            onClick={() => {
              const first = items.find(i => !resolved.has(i.id));
              if (first) {
                setActiveId(first.id);
                setShuffled(shuffleWithMap(first.options));
              }
            }}
            className="rounded-2xl"
          >
            Počni popravljati
          </Button>
        )}
      </div>
    </Layout>
  );
}
