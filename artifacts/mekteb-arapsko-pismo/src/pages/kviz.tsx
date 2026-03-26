import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Star, Pencil, X, Plus, Trash2, Save, Loader2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Pitanje {
  type?: "radio" | "checkbox" | "reorder" | "markWords" | "dragDrop";
  question: string;
  options?: string[];
  answer?: string;
  correct?: string[];
  explanation?: string;
  image?: string;
  slika?: string;
  // reorder
  items?: { text: string; order: number }[];
  // markWords
  text?: string;
  words?: string[];
  incorrect?: string[];
  // dragDrop
  template?: string[];
}

interface Kviz {
  id: number;
  naslov: string;
  nivo: number;
  pitanja: Pitanje[];
}

function AdminEditModal({ kviz, token, onClose, onSaved }: {
  kviz: Kviz; token: string; onClose: () => void; onSaved: (updated: Kviz) => void;
}) {
  const { toast } = useToast();
  const [naslov, setNaslov] = useState(kviz.naslov);
  const [pitanja, setPitanja] = useState<Pitanje[]>(JSON.parse(JSON.stringify(kviz.pitanja)));
  const [isLoading, setIsLoading] = useState(false);
  const [activePitanje, setActivePitanje] = useState(0);

  const updatePitanje = (idx: number, field: keyof Pitanje, value: any) => {
    setPitanja(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const updateOption = (pIdx: number, oIdx: number, value: string) => {
    setPitanja(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const opts = [...(p.options || [])];
      const oldVal = opts[oIdx];
      opts[oIdx] = value;
      // keep correct array in sync if this option was marked correct
      const correct = p.correct ? [...p.correct] : (p.answer ? [p.answer] : []);
      const newCorrect = correct.map(c => c === oldVal ? value : c);
      return { ...p, options: opts, correct: newCorrect, answer: newCorrect[0] || "" };
    }));
  };

  // Toggle an option as correct/incorrect in the editor
  const toggleCorrectInEditor = (pIdx: number, opt: string) => {
    setPitanja(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const correct = p.correct ? [...p.correct] : (p.answer ? [p.answer] : []);
      const newCorrect = correct.includes(opt)
        ? correct.filter(c => c !== opt)
        : [...correct, opt];
      return {
        ...p,
        correct: newCorrect,
        answer: newCorrect.length === 1 ? newCorrect[0] : (newCorrect[0] || ""),
        type: newCorrect.length > 1 ? "checkbox" : (p.type === "checkbox" ? "radio" : p.type),
      };
    }));
  };

  const addPitanje = () => {
    setPitanja(prev => [...prev, { question: "", options: ["", "", "", ""], answer: "", explanation: "" }]);
    setActivePitanje(pitanja.length);
  };

  const removePitanje = (idx: number) => {
    setPitanja(prev => prev.filter((_, i) => i !== idx));
    setActivePitanje(Math.max(0, idx - 1));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiRequest("PUT", `/admin/kvizovi/${kviz.id}`, { naslov, pitanja }, token);
      toast({ title: "Kviz sačuvan!", description: `${naslov} — ${pitanja.length} pitanja` });
      onSaved({ ...kviz, naslov, pitanja });
      onClose();
    } catch {
      toast({ title: "Greška", description: "Nije moguće sačuvati kviz", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const p = pitanja[activePitanje];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-extrabold text-lg text-foreground">Uredi kviz</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Naziv kviza</label>
            <input value={naslov} onChange={e => setNaslov(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold" />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {pitanja.map((_, i) => (
              <button key={i} onClick={() => setActivePitanje(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === activePitanje ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {i + 1}
              </button>
            ))}
            <button onClick={addPitanje}
              className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center transition-all">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {p && (
            <div className="bg-muted/30 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Pitanje {activePitanje + 1}/{pitanja.length}</span>
                <button onClick={() => removePitanje(activePitanje)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <textarea value={p.question} onChange={e => updatePitanje(activePitanje, "question", e.target.value)}
                rows={2} placeholder="Tekst pitanja..."
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-medium" />

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Ilustracija (opciono, putanja npr. /edu/assets/images/pitanja/slika.jpg)</label>
                <input value={p.slika || ""} onChange={e => updatePitanje(activePitanje, "slika", e.target.value)}
                  placeholder="/edu/assets/images/pitanja/..."
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                {p.slika && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-border aspect-[3/2]">
                    <img src={p.slika} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                  </div>
                )}
              </div>

              <div>
                {(() => {
                  const correctArr = p.correct && p.correct.length > 0
                    ? p.correct
                    : p.answer ? [p.answer] : [];
                  const isMulti = correctArr.length > 1;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-muted-foreground">
                          Opcije — klikni kvadratić da označiš tačan odgovor
                        </label>
                        {isMulti && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {correctArr.length} tačna odgovora
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {(p.options || []).map((opt, oIdx) => {
                          const isCorrect = correctArr.includes(opt);
                          return (
                            <div key={oIdx} className="flex items-center gap-2">
                              <button
                                onClick={() => toggleCorrectInEditor(activePitanje, opt)}
                                className={`w-5 h-5 rounded border-2 shrink-0 transition-all flex items-center justify-center
                                  ${isCorrect ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-400"}`}
                              >
                                {isCorrect && <span className="text-white text-xs font-bold leading-none">✓</span>}
                              </button>
                              <input value={opt} onChange={e => updateOption(activePitanje, oIdx, e.target.value)}
                                placeholder={`Opcija ${oIdx + 1}`}
                                className={`flex-1 border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40
                                  ${isCorrect ? "border-emerald-400 bg-emerald-50 font-bold" : "border-border"}`} />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Objašnjenje (opciono)</label>
                <input value={p.explanation || ""} onChange={e => updatePitanje(activePitanje, "explanation", e.target.value)}
                  placeholder="Kratko objašnjenje tačnog odgovora..."
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Odustani</Button>
          <Button onClick={handleSave} disabled={isLoading} className="rounded-xl flex items-center gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sačuvaj kviz
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

const QUIZ_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function KvizPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [kviz, setKviz] = useState<Kviz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pitanja, setPitanja] = useState<Pitanje[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [markedWords, setMarkedWords] = useState<string[]>([]);
  const [droppedWords, setDroppedWords] = useState<(string | null)[]>([]);
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (!slug) return;
    apiRequest<Kviz>("GET", `/content/kvizovi/${slug}`)
      .then(data => {
        setKviz(data);
        if (data.pitanja.length > 0) {
          const pool = shuffle(data.pitanja);
          const selected = pool.slice(0, Math.min(QUIZ_SIZE, pool.length));
          setPitanja(selected);
          // init state for the first question
          const first = selected[0];
          if (first.type === "reorder" && first.items) {
            setOrderedItems(shuffle(first.items.map((i: any) => i.text)));
          }
          if (first.type === "dragDrop" && first.template && first.words) {
            const dropCount = first.template.filter((t: string) => t === "DROP").length;
            setDroppedWords(Array(dropCount).fill(null));
            setWordBank(shuffle([...first.words]));
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) return <Layout><div className="max-w-2xl mx-auto"><Skeleton className="h-96 rounded-3xl" /></div></Layout>;
  if (!kviz) return <Layout><div className="text-center py-20 text-muted-foreground">Kviz nije pronađen</div></Layout>;

  if (kviz.pitanja.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">{kviz.naslov}</h2>
          <p className="text-muted-foreground mb-6">Ovaj kviz je u pripremi — pitanja uskoro stižu!</p>
          <button onClick={() => setLocation("/kvizovi")}
            className="flex items-center gap-2 mx-auto text-muted-foreground hover:text-primary font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Nazad na kvizove
          </button>
        </div>
      </Layout>
    );
  }

  if (pitanja.length === 0) return <Layout><div className="max-w-2xl mx-auto"><Skeleton className="h-96 rounded-3xl" /></div></Layout>;

  const pitanje = pitanja[current];
  const isLast = current === pitanja.length - 1;

  // Auto-detect checkbox if pitanje has multiple correct answers, regardless of stored type
  const hasMultiCorrect = (pitanje?.correct && pitanje.correct.length > 1)
    || (pitanje?.answer?.includes("|||"));
  const qType = pitanje?.type === "checkbox" || hasMultiCorrect
    ? "checkbox"
    : pitanje?.type || "radio";

  const getCorrectArr = (p: Pitanje): string[] => {
    if (p.correct && Array.isArray(p.correct)) return p.correct;
    return p.answer ? p.answer.split("|||") : [];
  };

  const initQuestion = (p: Pitanje) => {
    setSelected(null);
    setSelectedMulti([]);
    setMarkedWords([]);
    if (p.type === "reorder" && p.items) {
      setOrderedItems(shuffle(p.items.map(i => i.text)));
    }
    if (p.type === "dragDrop" && p.template && p.words) {
      const dropCount = p.template.filter(t => t === "DROP").length;
      setDroppedWords(Array(dropCount).fill(null));
      setWordBank(shuffle([...p.words]));
    }
    setAnswered(false);
  };

  const handleSelect = (opt: string) => {
    if (answered) return;
    if (qType === "checkbox") {
      setSelectedMulti(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
    } else {
      setSelected(opt);
      setAnswered(true);
      if (opt === pitanje.answer) setScore(s => s + 1);
    }
  };

  const confirmCheckbox = () => {
    if (answered) return;
    setAnswered(true);
    const correctArr = getCorrectArr(pitanje);
    const ok = selectedMulti.length === correctArr.length && correctArr.every(c => selectedMulti.includes(c));
    if (ok) setScore(s => s + 1);
  };

  const confirmReorder = () => {
    if (answered) return;
    setAnswered(true);
    const correctOrder = [...(pitanje.items || [])].sort((a, b) => a.order - b.order).map(i => i.text);
    if (JSON.stringify(orderedItems) === JSON.stringify(correctOrder)) setScore(s => s + 1);
  };

  const confirmMarkWords = () => {
    if (answered) return;
    setAnswered(true);
    const incorrect = pitanje.incorrect || [];
    const ok = markedWords.length === incorrect.length && incorrect.every(w => markedWords.includes(w));
    if (ok) setScore(s => s + 1);
  };

  const dropWord = (word: string, slotIdx: number) => {
    if (answered) return;
    const prev = droppedWords[slotIdx];
    const newDropped = [...droppedWords];
    newDropped[slotIdx] = word;
    setDroppedWords(newDropped);
    const newBank = wordBank.filter(w => w !== word);
    if (prev !== null) newBank.push(prev);
    setWordBank(shuffle(newBank));
  };

  const removeDropped = (slotIdx: number) => {
    if (answered) return;
    const word = droppedWords[slotIdx];
    if (!word) return;
    const newDropped = [...droppedWords];
    newDropped[slotIdx] = null;
    setDroppedWords(newDropped);
    setWordBank(prev => shuffle([...prev, word]));
  };

  const confirmDragDrop = () => {
    if (answered || droppedWords.some(w => w === null)) return;
    setAnswered(true);
    const correct = pitanje.correct || [];
    const ok = droppedWords.every((w, i) => w === correct[i]);
    if (ok) setScore(s => s + 1);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= orderedItems.length) return;
    const a = [...orderedItems];
    [a[idx], a[newIdx]] = [a[newIdx], a[idx]];
    setOrderedItems(a);
  };

  const next = () => {
    if (isLast) {
      const bodovi = Math.round((score / pitanja.length) * 100);
      if (user && token) {
        apiRequest("POST", "/content/napredak", {
          contentType: "kviz", contentId: kviz.id,
          zavrsen: true, bodovi, tacniOdgovori: score, ukupnoPitanja: pitanja.length,
        }, token).catch(() => {});
      }
      setFinished(true);
    } else {
      const nextIdx = current + 1;
      setCurrent(nextIdx);
      initQuestion(pitanja[nextIdx]);
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
            <p className="text-muted-foreground mb-6">Tačnih odgovora: {score} od {pitanja.length} pitanja</p>
            {kviz.pitanja.length > QUIZ_SIZE && (
              <p className="text-xs text-muted-foreground mb-2">nasumično odabrano iz {kviz.pitanja.length} pitanja</p>
            )}
            <div className="text-5xl font-extrabold text-primary mb-6">{pct}%</div>
            {pct >= 80 && (
              <div className="flex items-center gap-2 justify-center bg-yellow-50 text-yellow-700 rounded-2xl p-4 mb-6 border border-yellow-200">
                <Star className="w-5 h-5 fill-yellow-500" />
                <span className="font-bold">Odlično! Zaradio/la si hasanate</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setLocation("/kvizovi")} className="rounded-2xl">Nazad</Button>
              <Button onClick={() => {
                const pool = shuffle(kviz.pitanja);
                const sel = pool.slice(0, Math.min(QUIZ_SIZE, pool.length));
                setPitanja(sel);
                setCurrent(0); setScore(0); setFinished(false);
                const first = sel[0];
                setSelected(null); setSelectedMulti([]); setMarkedWords([]); setAnswered(false);
                if (first?.type === "reorder" && first.items) setOrderedItems(shuffle(first.items.map((i: any) => i.text)));
                if (first?.type === "dragDrop" && first.template && first.words) { setDroppedWords(Array(first.template.filter((t: string) => t === "DROP").length).fill(null)); setWordBank(shuffle([...first.words])); }
              }} className="rounded-2xl">
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
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setLocation("/kvizovi")} className="flex items-center gap-2 text-muted-foreground hover:text-primary font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Nazad
          </button>
          {user?.role === "admin" && (
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Uredi kviz
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold text-foreground">{kviz.naslov}</h1>
          <span className="text-sm font-bold text-muted-foreground">{current + 1} / {pitanja.length}</span>
        </div>

        <div className="h-2 bg-muted rounded-full mb-8 overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((current + 1) / pitanja.length) * 100}%` }} transition={{ type: "spring", stiffness: 300 }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-3xl border border-border/50 shadow-sm p-6 md:p-8">

            {(pitanje.image || pitanje.slika) && (() => {
              const imgRaw = pitanje.image || pitanje.slika!;
              const imgPath = imgRaw.startsWith("/") ? imgRaw : "/" + imgRaw;
              const imgSrc = imgPath.startsWith("/edu") ? imgPath : `/edu${imgPath}`;
              return (
                <div className="rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-[rgb(36,143,146)]">
                  <img
                    src={imgSrc}
                    alt=""
                    className="w-full h-auto aspect-[3/2] object-cover"
                    onError={e => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = "1";
                        img.src = `https://mekteb.net${imgPath.startsWith("/edu") ? imgPath : "/edu" + imgPath}`;
                      } else {
                        (img.parentElement as HTMLElement).style.display = "none";
                      }
                    }}
                  />
                </div>
              );
            })()}

            <p className="text-lg font-bold text-foreground mb-2 leading-relaxed">{pitanje.question}</p>

            {/* ── TRUE/FALSE (Da/Ne) ── */}
            {qType === "truefalse" && (
              <div className="flex gap-4 mt-6 mb-6">
                {["Da", "Ne"].map((opt) => {
                  const isCorrect = opt === pitanje.answer;
                  const isSelected = opt === selected;
                  const isDa = opt === "Da";
                  let cls = "flex-1 border-2 rounded-2xl py-5 text-center font-extrabold text-lg transition-all cursor-pointer ";
                  if (!answered) {
                    cls += isDa
                      ? "border-emerald-300 hover:bg-emerald-50 text-emerald-700"
                      : "border-red-300 hover:bg-red-50 text-red-700";
                  } else if (isCorrect) {
                    cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                  } else if (isSelected) {
                    cls += "border-red-400 bg-red-50 text-red-800";
                  } else {
                    cls += "border-border/30 text-muted-foreground opacity-50";
                  }
                  return (
                    <button key={opt} onClick={() => handleSelect(opt)} className={cls} disabled={answered}>
                      <div className="flex items-center justify-center gap-2">
                        {answered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── RADIO ── */}
            {qType === "radio" && (
              <div className="flex flex-col gap-3 mt-4 mb-6">
                {(pitanje.options || []).map((opt) => {
                  const isCorrect = opt === pitanje.answer;
                  const isSelected = opt === selected;
                  let cls = "border-2 rounded-2xl px-5 py-4 text-left font-medium transition-all cursor-pointer ";
                  if (!answered) cls += "border-border/50 hover:border-primary/50 hover:bg-primary/5";
                  else if (isCorrect) cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                  else if (isSelected) cls += "border-red-400 bg-red-50 text-red-800";
                  else cls += "border-border/30 text-muted-foreground opacity-60";
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
            )}

            {/* ── CHECKBOX ── */}
            {qType === "checkbox" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">Odaberi sve tačne odgovore</p>}
                <div className="flex flex-col gap-3 mb-4">
                  {(pitanje.options || []).map((opt) => {
                    const correctArr = getCorrectArr(pitanje);
                    const isCorrect = correctArr.includes(opt);
                    const isSelected = selectedMulti.includes(opt);
                    let cls = "border-2 rounded-2xl px-5 py-4 text-left font-medium transition-all cursor-pointer ";
                    if (!answered) cls += isSelected ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50 hover:bg-primary/5";
                    else if (isCorrect) cls += "border-emerald-400 bg-emerald-50 text-emerald-800";
                    else if (isSelected) cls += "border-red-400 bg-red-50 text-red-800";
                    else cls += "border-border/30 text-muted-foreground opacity-60";
                    return (
                      <button key={opt} onClick={() => handleSelect(opt)} className={cls} disabled={answered}>
                        <div className="flex items-center gap-3">
                          {!answered && (
                            <div className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                              {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                          )}
                          {answered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                          {answered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                          <span>{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {!answered && (
                  <div className="flex justify-end mb-4">
                    <Button onClick={confirmCheckbox} disabled={selectedMulti.length === 0} className="rounded-2xl px-8 font-bold">
                      Potvrdi odgovor
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* ── REORDER ── */}
            {qType === "reorder" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">Poredaj stavke u tačan redosljed</p>}
                <div className="flex flex-col gap-2 mb-4">
                  {orderedItems.map((item, idx) => {
                    const correctOrder = [...(pitanje.items || [])].sort((a, b) => a.order - b.order).map(i => i.text);
                    const isCorrect = answered && correctOrder[idx] === item;
                    const isWrong = answered && correctOrder[idx] !== item;
                    return (
                      <div key={item} className={`flex items-center gap-3 border-2 rounded-2xl px-4 py-3 font-medium transition-all
                        ${isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-800" :
                          isWrong ? "border-red-400 bg-red-50 text-red-800" :
                          "border-border/50 bg-white"}`}>
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className="flex-1">{item}</span>
                        {!answered && (
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                            <button onClick={() => moveItem(idx, 1)} disabled={idx === orderedItems.length - 1} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                          </div>
                        )}
                        {answered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                        {answered && isWrong && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                {answered && (
                  <div className="bg-muted/40 rounded-2xl p-4 mb-4 text-sm text-muted-foreground">
                    <p className="font-bold text-foreground mb-2">Tačan redosljed:</p>
                    {[...(pitanje.items || [])].sort((a,b) => a.order - b.order).map((item, i) => (
                      <p key={i}>{i+1}. {item.text}</p>
                    ))}
                  </div>
                )}
                {!answered && (
                  <div className="flex justify-end mb-4">
                    <Button onClick={confirmReorder} className="rounded-2xl px-8 font-bold">Potvrdi redosljed</Button>
                  </div>
                )}
              </>
            )}

            {/* ── MARK WORDS ── */}
            {qType === "markWords" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">Klikni na pogrešnu/e riječ/i</p>}
                <div className="flex flex-wrap gap-2 mb-4 p-4 bg-muted/30 rounded-2xl">
                  {(pitanje.words || (pitanje.text || "").split(" ")).map((word, i) => {
                    const isIncorrect = (pitanje.incorrect || []).includes(word);
                    const isMarked = markedWords.includes(word);
                    return (
                      <button key={i} onClick={() => {
                        if (answered) return;
                        setMarkedWords(prev => prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]);
                      }}
                        className={`px-3 py-1.5 rounded-xl font-medium text-sm transition-all border-2
                          ${answered && isIncorrect ? "border-emerald-400 bg-emerald-50 text-emerald-800" :
                            answered && isMarked && !isIncorrect ? "border-red-400 bg-red-50 text-red-800" :
                            !answered && isMarked ? "border-primary bg-primary/10 text-primary" :
                            "border-border/30 bg-white hover:border-primary/50"}`}>
                        {word}
                      </button>
                    );
                  })}
                </div>
                {!answered && (
                  <div className="flex justify-end mb-4">
                    <Button onClick={confirmMarkWords} disabled={markedWords.length === 0} className="rounded-2xl px-8 font-bold">Potvrdi odgovor</Button>
                  </div>
                )}
              </>
            )}

            {/* ── DRAG DROP (click-based) ── */}
            {qType === "dragDrop" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">Popuni praznine klikom na odgovore ispod</p>}
                <div className="flex flex-wrap items-center gap-2 mb-4 p-4 bg-muted/30 rounded-2xl text-base font-medium leading-relaxed">
                  {(() => {
                    let dropIdx = 0;
                    return (pitanje.template || []).map((part, i) => {
                      if (part === "DROP") {
                        const idx = dropIdx++;
                        const filled = droppedWords[idx];
                        const correct = (pitanje.correct || [])[idx];
                        const isCorrect = answered && filled === correct;
                        const isWrong = answered && filled !== correct;
                        return (
                          <button key={i} onClick={() => removeDropped(idx)}
                            className={`min-w-[80px] px-3 py-1.5 rounded-xl border-2 text-sm font-bold transition-all
                              ${filled
                                ? (isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                  : isWrong ? "border-red-400 bg-red-50 text-red-800"
                                  : "border-primary bg-primary/10 text-primary")
                                : "border-dashed border-muted-foreground/50 bg-white text-muted-foreground"}`}>
                            {filled || "___"}
                          </button>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    });
                  })()}
                </div>
                {answered && droppedWords.some((w, i) => w !== (pitanje.correct || [])[i]) && (
                  <div className="bg-muted/40 rounded-2xl p-4 mb-4 text-sm text-muted-foreground">
                    <p className="font-bold text-foreground mb-1">Tačni odgovori: {(pitanje.correct || []).join(", ")}</p>
                  </div>
                )}
                {!answered && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {wordBank.map((word, i) => (
                        <button key={i} onClick={() => {
                          const firstEmpty = droppedWords.findIndex(w => w === null);
                          if (firstEmpty !== -1) dropWord(word, firstEmpty);
                        }}
                          className="px-4 py-2 rounded-xl border-2 border-primary/30 bg-primary/5 text-primary font-medium text-sm hover:bg-primary/15 transition-all">
                          {word}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <button onClick={() => { setDroppedWords(Array(droppedWords.length).fill(null)); setWordBank(shuffle([...(pitanje.words||[])])); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> Resetuj
                      </button>
                      <Button onClick={confirmDragDrop} disabled={droppedWords.some(w => w === null)} className="rounded-2xl px-8 font-bold">
                        Potvrdi odgovor
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

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

      {showEdit && kviz && token && (
        <AdminEditModal kviz={kviz} token={token} onClose={() => setShowEdit(false)} onSaved={setKviz} />
      )}
    </Layout>
  );
}
