import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Star, Pencil, X, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Pitanje {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  image?: string;
  slika?: string;
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
      const opts = [...p.options];
      opts[oIdx] = value;
      return { ...p, options: opts };
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
                {p.slika && <img src={p.slika} alt="" className="mt-2 rounded-xl max-h-32 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Opcije (klikni na tačan odgovor da ga označiš)</label>
                <div className="flex flex-col gap-2">
                  {p.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <button onClick={() => updatePitanje(activePitanje, "answer", opt)}
                        className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${p.answer === opt ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-400"}`} />
                      <input value={opt} onChange={e => updateOption(activePitanje, oIdx, e.target.value)}
                        placeholder={`Opcija ${oIdx + 1}`}
                        className={`flex-1 border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${p.answer === opt ? "border-emerald-400 bg-emerald-50 font-bold" : "border-border"}`} />
                    </div>
                  ))}
                </div>
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
          setPitanja(pool.slice(0, Math.min(QUIZ_SIZE, pool.length)));
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
                setPitanja(pool.slice(0, Math.min(QUIZ_SIZE, pool.length)));
                setCurrent(0); setScore(0); setSelected(null); setAnswered(false); setFinished(false);
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
              return (
                <img
                  src={`/edu${imgPath}`}
                  alt=""
                  className="w-full mb-5 object-contain max-h-64 edu-image"
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = "1";
                      img.src = `https://mekteb.net/edu${imgPath}`;
                    } else {
                      img.style.display = "none";
                    }
                  }}
                />
              );
            })()}

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

      {showEdit && kviz && token && (
        <AdminEditModal kviz={kviz} token={token} onClose={() => setShowEdit(false)} onSaved={setKviz} />
      )}
    </Layout>
  );
}
