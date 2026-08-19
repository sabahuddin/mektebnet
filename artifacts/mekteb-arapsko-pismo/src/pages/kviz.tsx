import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Layout } from "@/components/layout";
import { apiRequest, getApiBase } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, Star, Pencil, X, Plus, Trash2, Save, Loader2, ChevronUp, ChevronDown, RotateCcw, ImageIcon, Upload, FolderOpen, GripVertical, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CelebrationModal, type CelebrationData } from "@/components/celebration-modal";
import { useLanguage } from "@/context/language";
import { reconcileRetryRemediation } from "@/lib/quiz-learning";

interface Pitanje {
  id?: number;
  type?: "radio" | "checkbox" | "truefalse" | "reorder" | "markWords" | "dragDrop";
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
  learningType?: "prisjecanje" | "razlikovanje" | "primjena" | "redoslijed";
  retryMode?: "immediate";
  retryPrompt?: string;
  sourceQuestion?: string;
}

interface Kviz {
  id: number;
  naslov: string;
  nivo: number;
  pitanja: Pitanje[];
  pitanjaPoSesiji?: number | null;
}

const QUESTION_TYPES = [
  { value: "radio",     label: "Jedan tačan odgovor" },
  { value: "checkbox",  label: "Više tačnih odgovora" },
  { value: "truefalse", label: "Da / Ne" },
  { value: "markWords", label: "Pronađi grešku (označi pogrešne riječi)" },
  { value: "reorder",   label: "Poredaj redom" },
  { value: "dragDrop",  label: "Dopuni (drag & drop)" },
];

const LEARNING_TYPE_LABELS: Record<string, string> = {
  prisjecanje: "Prisjeti se",
  razlikovanje: "Razlikuj",
  primjena: "Primijeni",
  redoslijed: "Poredaj",
};

function AdminEditModal({ kviz, token, onClose, onSaved }: {
  kviz: Kviz; token: string; onClose: () => void; onSaved: (updated: Kviz) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [naslov, setNaslov] = useState(kviz.naslov);
  const [pitanja, setPitanja] = useState<Pitanje[]>(JSON.parse(JSON.stringify(kviz.pitanja)));
  const [isLoading, setIsLoading] = useState(false);
  const [activePitanje, setActivePitanje] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{name:string;url:string;size:number;modified:string}[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [gallerySearch, setGallerySearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/admin/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        toast({ title: t("Greška"), description: t("Ne mogu učitati galeriju ({status})", { status: String(resp.status) }), variant: "destructive" });
        setGalleryImages([]);
      } else {
        const data = await resp.json();
        setGalleryImages(Array.isArray(data) ? data : data.files || []);
      }
    } catch {
      toast({ title: t("Greška"), description: t("Ne mogu učitati galeriju"), variant: "destructive" });
    }
    setGalleryLoading(false);
  }, [token, toast]);

  const openGallery = useCallback(() => {
    setShowGallery(true);
    setGallerySearch("");
    loadGallery();
  }, [loadGallery]);

  const selectImage = useCallback((url: string) => {
    updatePitanje(activePitanje, "slika", url);
    updatePitanje(activePitanje, "image", undefined);
    setShowGallery(false);
  }, [activePitanje]);

  const onUploadFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const resp = await fetch(`${getApiBase()}/admin/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: t("Greška pri uploadu"), description: data.error || t("Nepoznata greška"), variant: "destructive" });
      } else if (data.url) {
        selectImage(data.url);
        toast({ title: t("Slika uploadovana ✓") });
      }
    } catch {
      toast({ title: t("Upload nije uspio"), variant: "destructive" });
    }
    setUploading(false);
  }, [token, toast, selectImage]);

  const updatePitanje = (idx: number, field: keyof Pitanje, value: any) => {
    setPitanja(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const changeType = (idx: number, newType: string) => {
    setPitanja(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      if (newType === "radio" || newType === "checkbox")
        return { ...p, type: newType as any, options: p.options?.length ? p.options : ["", "", "", ""], answer: p.answer || "", correct: p.correct || [], text: undefined, words: undefined, incorrect: undefined, items: undefined };
      if (newType === "truefalse")
        return { ...p, type: "truefalse" as any, options: ["Da", "Ne"], answer: p.answer || "Da", correct: undefined, text: undefined, words: undefined, incorrect: undefined, items: undefined };
      if (newType === "markWords")
        return { ...p, type: "markWords" as any, text: p.text || "", words: p.words || [], incorrect: p.incorrect || [], options: undefined, answer: undefined, correct: undefined, items: undefined };
      if (newType === "reorder")
        return { ...p, type: "reorder" as any, items: p.items?.length ? p.items : [{ text: "", order: 1 }, { text: "", order: 2 }, { text: "", order: 3 }], options: undefined, answer: undefined, correct: undefined, text: undefined, words: undefined, incorrect: undefined };
      if (newType === "dragDrop")
        return { ...p, type: "dragDrop" as any, template: p.template || [], words: p.words || [], correct: p.correct || [], options: undefined, answer: undefined, text: undefined, incorrect: undefined, items: undefined };
      return p;
    }));
  };

  const updateOption = (pIdx: number, oIdx: number, value: string) => {
    setPitanja(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const opts = [...(p.options || [])];
      const oldVal = opts[oIdx];
      opts[oIdx] = value;
      const correct = p.correct ? [...p.correct] : (p.answer ? [p.answer] : []);
      const newCorrect = correct.map(c => c === oldVal ? value : c);
      return { ...p, options: opts, correct: newCorrect, answer: newCorrect[0] || "" };
    }));
  };

  const toggleCorrectInEditor = (pIdx: number, opt: string) => {
    setPitanja(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const correct = p.correct ? [...p.correct] : (p.answer ? [p.answer] : []);
      const newCorrect = correct.includes(opt) ? correct.filter(c => c !== opt) : [...correct, opt];
      return { ...p, correct: newCorrect, answer: newCorrect[0] || "", type: newCorrect.length > 1 ? "checkbox" : (p.type === "checkbox" ? "radio" : p.type) };
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
      toast({ title: t("Kviz sačuvan!"), description: t("{naslov} — {n} pitanja", { naslov, n: String(pitanja.length) }) });
      onSaved({ ...kviz, naslov, pitanja });
      onClose();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće sačuvati kviz"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const p = pitanja[activePitanje];
  const pType = p?.type || "radio";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-extrabold text-lg text-foreground">{t("Uredi kviz")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Naziv */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">{t("Naziv kviza")}</label>
            <input value={naslov} onChange={e => setNaslov(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold" />
          </div>

          {/* Pitanja navigacija */}
          <div className="flex gap-2 flex-wrap items-center">
            {pitanja.map((pit, i) => (
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
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{t("Pitanje {n}/{ukupno}", { n: String(activePitanje + 1), ukupno: String(pitanja.length) })}</span>
                <button onClick={() => removePitanje(activePitanje)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Tip pitanja */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">{t("Tip pitanja")}</label>
                <select value={pType} onChange={e => changeType(activePitanje, e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium bg-white">
                  {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Tekst pitanja */}
              <textarea value={p.question} onChange={e => updatePitanje(activePitanje, "question", e.target.value)}
                rows={2} placeholder={t("Tekst pitanja...")}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-medium" />

              {/* Ilustracija */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">{t("Ilustracija (opciono)")}</label>
                {(() => {
                  const currentImg = p.slika || p.image || "";
                  const previewSrc = currentImg
                    ? (currentImg.startsWith("http") || currentImg.startsWith("/uploads/")
                        ? currentImg
                        : currentImg.startsWith("/edu") ? currentImg : `/edu${currentImg.startsWith("/") ? "" : "/"}${currentImg}`)
                    : "";
                  if (currentImg) {
                    return (
                      <div className="flex items-center gap-3 p-2 border border-border rounded-xl bg-white">
                        <img src={previewSrc} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                          onError={e => {
                            const img = e.target as HTMLImageElement;
                            if (!img.dataset.fb) {
                              img.dataset.fb = "1";
                              const path = currentImg.startsWith("/") ? currentImg : "/" + currentImg;
                              img.src = `https://mekteb.net${path.startsWith("/edu") ? path : "/edu" + path}`;
                            } else {
                              img.style.display = "none";
                            }
                          }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate font-mono">{currentImg}</p>
                          <div className="flex gap-2 mt-2">
                            <button type="button" onClick={openGallery}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" /> {t("Promijeni")}
                            </button>
                            <button type="button" onClick={() => { updatePitanje(activePitanje, "slika", ""); updatePitanje(activePitanje, "image", undefined); }}
                              className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1">
                              <X className="w-3 h-3" /> {t("Ukloni")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="flex gap-2">
                      <button type="button" onClick={openGallery}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-border text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <FolderOpen className="w-4 h-4" /> {t("Odaberi iz galerije")}
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-60">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {t("Upload")}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadFile} className="hidden" />
                    </div>
                  );
                })()}
              </div>

              {/* ── RADIO / CHECKBOX ── */}
              {(pType === "radio" || pType === "checkbox" || pType === "truefalse") && (() => {
                const correctArr = p.correct && p.correct.length > 0 ? p.correct : p.answer ? [p.answer] : [];
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-muted-foreground">
                        {t("Opcije — klikni kvadratić za tačan odgovor")}
                      </label>
                      {correctArr.length > 1 && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {t("{n} tačna odgovora", { n: String(correctArr.length) })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {(p.options || []).map((opt, oIdx) => {
                        const isCorrect = correctArr.includes(opt);
                        return (
                          <div key={oIdx} className="flex items-center gap-2">
                            <button onClick={() => toggleCorrectInEditor(activePitanje, opt)}
                              className={`w-5 h-5 rounded border-2 shrink-0 transition-all flex items-center justify-center ${isCorrect ? "bg-emerald-500 border-emerald-500" : "border-gray-300 hover:border-emerald-400"}`}>
                              {isCorrect && <span className="text-white text-xs font-bold leading-none">✓</span>}
                            </button>
                            <input value={opt} onChange={e => updateOption(activePitanje, oIdx, e.target.value)}
                              placeholder={t("Opcija {n}", { n: String(oIdx + 1) })}
                              className={`flex-1 border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${isCorrect ? "border-emerald-400 bg-emerald-50 font-bold" : "border-border"}`} />
                            {pType !== "truefalse" && (
                              <button onClick={() => updatePitanje(activePitanje, "options", (p.options || []).filter((_, j) => j !== oIdx))}
                                className="text-red-400 hover:text-red-600 p-1 shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {pType !== "truefalse" && (
                      <button onClick={() => updatePitanje(activePitanje, "options", [...(p.options || []), ""])}
                        className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> {t("Dodaj opciju")}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* ── MARK WORDS (Pronađi grešku) ── */}
              {pType === "markWords" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">
                      {t("Puni tekst (npr. cijela dova/sura s greškom unutra)")}
                    </label>
                    <textarea value={p.text || ""} onChange={e => updatePitanje(activePitanje, "text", e.target.value)}
                      rows={4} placeholder="Npr: Subhaneke allahumme ve bi hamdike ve tebarekesmuke ve..."
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-medium" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">
                      {t("SVE klikabilne riječi — odvojene zarezom")}
                      <span className="text-muted-foreground font-normal ml-1">{t("(koje riječi korisnik može kliknuti)")}</span>
                    </label>
                    <textarea value={(p.words || []).join(", ")}
                      onChange={e => updatePitanje(activePitanje, "words", e.target.value.split(",").map(w => w.trim()).filter(Boolean))}
                      rows={2} placeholder="subhaneke, allahumme, hamdike, ..."
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-amber-700 mb-1 block">
                      {t("POGREŠNE riječi — odvojene zarezom")}
                      <span className="text-muted-foreground font-normal ml-1">{t("(koje treba pronaći)")}</span>
                    </label>
                    <input value={(p.incorrect || []).join(", ")}
                      onChange={e => updatePitanje(activePitanje, "incorrect", e.target.value.split(",").map(w => w.trim()).filter(Boolean))}
                      placeholder={t("npr: hamdike, džellešanuhu")}
                      className="w-full border border-amber-300 bg-amber-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 font-medium" />
                  </div>
                </div>
              )}

              {/* ── REORDER ── */}
              {pType === "reorder" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-2 block">
                    {t("Stavke — upiši tekst i postavi tačan redosljed brojem")}
                  </label>
                  <div className="flex flex-col gap-2">
                    {(p.items || []).map((item, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2">
                        <input type="number" min={1} value={item.order}
                          onChange={e => {
                            const items = [...(p.items || [])];
                            items[iIdx] = { ...items[iIdx], order: parseInt(e.target.value) || 1 };
                            updatePitanje(activePitanje, "items", items);
                          }}
                          className="w-12 border border-border rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        <input value={item.text}
                          onChange={e => {
                            const items = [...(p.items || [])];
                            items[iIdx] = { ...items[iIdx], text: e.target.value };
                            updatePitanje(activePitanje, "items", items);
                          }}
                          placeholder={t("Stavka {n}", { n: String(iIdx + 1) })}
                          className="flex-1 border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                        <button onClick={() => updatePitanje(activePitanje, "items", (p.items || []).filter((_, j) => j !== iIdx))}
                          className="text-red-400 hover:text-red-600 p-1"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => updatePitanje(activePitanje, "items", [...(p.items || []), { text: "", order: (p.items?.length || 0) + 1 }])}
                    className="mt-2 text-xs font-bold text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> {t("Dodaj stavku")}
                  </button>
                </div>
              )}

              {/* ── DRAG DROP (read-only pregled) ── */}
              {pType === "dragDrop" && (
                <div className="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-xs font-bold text-blue-900">
                    {t("Ovaj tip pitanja se uređuje u")} <strong>{t("Admin → Banka pitanja")}</strong>.
                  </p>
                  <div className="text-xs text-blue-800 space-y-1">
                    <div><strong>{t("Tekst sa prazninama:")}</strong> {(p.template || []).map((part, i) => part === "DROP" ? <span key={i} className="inline-block px-2 mx-0.5 bg-white border border-dashed border-blue-400 rounded">___</span> : <span key={i}>{part} </span>)}</div>
                    <div><strong>{t("Riječi:")}</strong> {(p.words || []).join(", ")}</div>
                    <div><strong>{t("Tačan redoslijed:")}</strong> {(p.correct || []).join(" → ")}</div>
                  </div>
                </div>
              )}

              {/* Objašnjenje */}
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">{t("Objašnjenje (opciono)")}</label>
                <input value={p.explanation || ""} onChange={e => updatePitanje(activePitanje, "explanation", e.target.value)}
                  placeholder={t("Kratko objašnjenje tačnog odgovora...")}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-xl">{t("Odustani")}</Button>
          <Button onClick={handleSave} disabled={isLoading} className="rounded-xl flex items-center gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("Sačuvaj kviz")}
          </Button>
        </div>
      </motion.div>

      {showGallery && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowGallery(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-primary" /> {t("Odaberi sliku za pitanje")}
              </h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-60">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {t("Upload nove")}
                </button>
                <button type="button" onClick={() => setShowGallery(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-5 py-2 border-b border-gray-100">
              <input value={gallerySearch} onChange={e => setGallerySearch(e.target.value)}
                placeholder={t("Pretraga po nazivu fajla...")}
                className="w-full border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (() => {
                const filtered = galleryImages.filter(img => !gallerySearch || img.name.toLowerCase().includes(gallerySearch.toLowerCase()));
                if (filtered.length === 0) {
                  return <p className="text-center text-gray-400 py-12 text-sm">{gallerySearch ? t("Nema rezultata za pretragu") : t("Nema uploadovanih slika. Klikni 'Upload nove' gore.")}</p>;
                }
                return (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {filtered.map(img => (
                      <button key={img.url} type="button" onClick={() => selectImage(img.url)}
                        className="group relative w-full aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-primary transition-colors bg-gray-50">
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>" }} />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white truncate">{img.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onUploadFile} className="hidden" />
        </div>
      )}
    </div>
  );
}

const DEFAULT_QUIZ_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle opcije unutar pitanja kako tačan odgovor ne bi uvijek bio na istoj
// poziciji. Ne miješa truefalse (Da/Ne ostaje fiksno) niti tipove koji ne
// koriste klasične opcije (reorder, dragDrop, markWords — ovi imaju vlastiti
// shuffle za svoje strukture).
function shuffleQuestionOptions(p: Pitanje): Pitanje {
  const skip = new Set(["truefalse", "reorder", "dragDrop", "markWords"]);
  if (p.type && skip.has(p.type)) return p;
  if (!Array.isArray(p.options) || p.options.length < 2) return p;
  return { ...p, options: shuffle(p.options) };
}

export default function KvizPage() {
  const { t } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  // Task #133: roditelj (porodica) = gost → smije otvoriti samo prvi kviz.
  const isRoditelj = user?.role === "roditelj";
  const isGuestLike = !user || isRoditelj;
  const [kviz, setKviz] = useState<Kviz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blockedGuest, setBlockedGuest] = useState(false);
  const [pitanja, setPitanja] = useState<Pitanje[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [markedWords, setMarkedWords] = useState<string[]>([]);
  const [droppedWords, setDroppedWords] = useState<(string | null)[]>([]);
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [answered, setAnswered] = useState(false);
  const [currentCorrect, setCurrentCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  // Greške koje će se na kraju kviza poslati u "Popravi saće" sistem.
  // Trakiramo SAMO single-correct tipove (radio/truefalse) jer schema
  // pogresni_odgovori ima `correctIndex` (jedan integer); checkbox/reorder
  // ne mapira čisto. Limit ~20 grešaka po kvizu (cap u backendu je 50, ali
  // držimo manje da ne pravimo spam).
  const [wrongAnswers, setWrongAnswers] = useState<Array<{
    questionIndex: number;
    questionText: string;
    options: string[];
    correctIndex: number;
    wrongIndex: number;
  }>>([]);
  const [finished, setFinished] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  // Drag-and-drop redoslijed preko Pointer Events — radi i mišom i prstom
  // (touchscreen). HTML5 draggable se ne koristi jer ne radi na dodir.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    setBlockedGuest(false);
    apiRequest<Kviz>("GET", `/content/kvizovi/${slug}`)
      .then(async data => {
        // Task #133: gost/roditelj smije otvoriti SAMO prvi ilmihal kviz
        // (najmanji id), isto kao na listi kvizova. Ostali → poruka za
        // registraciju kao poseban korisnik.
        if (isGuestLike) {
          try {
            const all = await apiRequest<{ id: number; slug: string; modul?: string }[]>(
              "GET", "/content/kvizovi",
            );
            const first = all
              .filter(k => k.modul === "ilmihal" || !k.modul)
              .sort((a, b) => a.id - b.id)[0];
            if (!first || first.slug !== slug) {
              setBlockedGuest(true);
              return;
            }
          } catch {
            /* lista nedostupna → ne blokiraj lažno (fail-open) */
          }
        }
        setKviz(data);
        if (data.pitanja.length > 0) {
          const pool = shuffle(data.pitanja);
          const sessionSize = (typeof data.pitanjaPoSesiji === "number" && data.pitanjaPoSesiji > 0)
            ? data.pitanjaPoSesiji
            : DEFAULT_QUIZ_SIZE;
          const selected = pool.slice(0, Math.min(sessionSize, pool.length)).map(shuffleQuestionOptions);
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
  }, [slug, isGuestLike]);

  if (isLoading) return <Layout><div className="max-w-2xl mx-auto"><Skeleton className="h-96 rounded-3xl" /></div></Layout>;

  if (blockedGuest) {
    return (
      <Layout>
        <div className="max-w-md mx-auto text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">{t("Samo za registrovane korisnike")}</h2>
          <p className="text-muted-foreground mb-6">
            {isRoditelj
              ? t("Registrujte se kao poseban korisnik da pristupite svim kvizovima.")
              : t("Prijavite se ili registrujte da pristupite svim kvizovima.")}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setLocation("/registracija")} className="rounded-2xl">{t("Registruj se")}</Button>
            <Button variant="outline" onClick={() => setLocation("/kvizovi")} className="rounded-2xl">{t("Nazad")}</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!kviz) return <Layout><div className="text-center py-20 text-muted-foreground">{t("Kviz nije pronađen")}</div></Layout>;

  if (kviz.pitanja.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-extrabold text-foreground mb-2">{kviz.naslov}</h2>
          <p className="text-muted-foreground mb-6">{t("Ovaj kviz je u pripremi — pitanja uskoro stižu!")}</p>
          <button onClick={() => setLocation("/kvizovi")}
            className="flex items-center gap-2 mx-auto text-muted-foreground hover:text-primary font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("Nazad na kvizove")}
          </button>
        </div>
      </Layout>
    );
  }

  if (pitanja.length === 0) return <Layout><div className="max-w-2xl mx-auto"><Skeleton className="h-96 rounded-3xl" /></div></Layout>;

  const pitanje = pitanja[current];
  const isLast = current === pitanja.length - 1;

  // Auto-detect checkbox if pitanje has multiple correct answers, regardless of stored type.
  // VAŽNO: ne primijeniti override na nove tipove (dragDrop/markWords/reorder/truefalse) —
  // dragDrop ima `correct` niz sa više stavki (po jedna za svaku DROP poziciju), pa bi
  // heuristika pogrešno tretirala dragDrop kao checkbox i renderovala prazno.
  const NEW_TYPES = new Set(["dragDrop", "markWords", "reorder", "truefalse"]);
  const isNewType = pitanje?.type && NEW_TYPES.has(pitanje.type);
  const hasMultiCorrect = !isNewType && (
    (pitanje?.correct && pitanje.correct.length > 1)
    || (pitanje?.answer?.includes("|||"))
  );
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
    setCurrentCorrect(null);
  };

  const canRetryCurrentQuestion =
    answered &&
    currentCorrect === false &&
    pitanje.retryMode === "immediate";

  const retryCurrentQuestion = () => {
    initQuestion(pitanje);
  };

  const handleSelect = (opt: string) => {
    if (answered) return;
    if (qType === "checkbox") {
      setSelectedMulti(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]);
    } else {
      setSelected(opt);
      setAnswered(true);
      const ok = opt === pitanje.answer;
      setCurrentCorrect(ok);
      if (ok) {
        const stableIndex = kviz.pitanja.findIndex(p => p.question === pitanje.question);
        if (stableIndex >= 0) {
          setWrongAnswers(prev => reconcileRetryRemediation(
            prev,
            stableIndex,
            true,
            pitanje.retryMode,
          ));
        }
        setScore(s => s + 1);
      } else if (qType === "radio" || qType === "truefalse") {
        // Track grešku za "Popravi saće". Samo single-correct tipovi
        // (correct se nalazi u pitanje.answer kao tačno jedan string).
        // questionIndex MORA biti stabilan između sesija — ne smije ovisiti
        // o trenutnom shuffleu/sliceu (`current`). Koristimo originalni
        // index iz kviz.pitanja po jedinstvenom textu pitanja, da UNIQUE
        // (user_id, source_type, source_id, question_index) u DB ne pravi
        // duplikate za isto pitanje koje se pojavi na drugoj poziciji.
        const opts = pitanje.options || [];
        const correctIndex = opts.indexOf(pitanje.answer ?? "");
        const wrongIndex = opts.indexOf(opt);
        const stableIndex = kviz.pitanja.findIndex(p => p.question === pitanje.question);
        if (
          correctIndex >= 0 &&
          wrongIndex >= 0 &&
          correctIndex !== wrongIndex &&
          stableIndex >= 0
        ) {
          setWrongAnswers(prev => {
            // Cap je do 30 jer su novi tematski kvizovi do 30 pitanja po sesiji
            // (server cap je 50, ali držimo manje da ne pravimo spam u "Popravi saće").
            if (prev.length >= 30) return prev;
            // Dedup unutar iste sesije — ako učenik pogrijesi dva puta isto
            // pitanje (re-attempt nakon "Ponovi"), samo jednom šaljemo.
            if (prev.some(w => w.questionIndex === stableIndex)) return prev;
            return [...prev, {
              questionIndex: stableIndex,
              questionText: pitanje.question,
              options: opts,
              correctIndex,
              wrongIndex,
            }];
          });
        }
      }
    }
  };

  const confirmCheckbox = () => {
    if (answered) return;
    setAnswered(true);
    const correctArr = getCorrectArr(pitanje);
    const ok = selectedMulti.length === correctArr.length && correctArr.every(c => selectedMulti.includes(c));
    setCurrentCorrect(ok);
    if (ok) setScore(s => s + 1);
  };

  const confirmReorder = () => {
    if (answered) return;
    setAnswered(true);
    const correctOrder = [...(pitanje.items || [])].sort((a, b) => a.order - b.order).map(i => i.text);
    const ok = JSON.stringify(orderedItems) === JSON.stringify(correctOrder);
    setCurrentCorrect(ok);
    if (ok) setScore(s => s + 1);
  };

  const confirmMarkWords = () => {
    if (answered) return;
    setAnswered(true);
    const incorrect = pitanje.incorrect || [];
    const ok = markedWords.length === incorrect.length && incorrect.every(w => markedWords.includes(w));
    setCurrentCorrect(ok);
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
    setCurrentCorrect(ok);
    if (ok) setScore(s => s + 1);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= orderedItems.length) return;
    const a = [...orderedItems];
    [a[idx], a[newIdx]] = [a[newIdx], a[idx]];
    setOrderedItems(a);
  };

  const handleReorderPointerDown = (e: React.PointerEvent, idx: number) => {
    dragIdxRef.current = idx;
    setDragIdx(idx);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleReorderPointerMove = (e: React.PointerEvent) => {
    if (dragIdxRef.current === null) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const row = el?.closest("[data-reorder-idx]") as HTMLElement | null;
    if (!row) return;
    const overIdx = parseInt(row.getAttribute("data-reorder-idx") || "", 10);
    const from = dragIdxRef.current;
    if (Number.isNaN(overIdx) || overIdx === from) return;
    setOrderedItems(prev => {
      const a = [...prev];
      const [it] = a.splice(from, 1);
      a.splice(overIdx, 0, it);
      return a;
    });
    dragIdxRef.current = overIdx;
    setDragIdx(overIdx);
  };

  const handleReorderPointerUp = () => {
    dragIdxRef.current = null;
    setDragIdx(null);
  };

  const next = () => {
    if (isLast) {
      const bodovi = Math.round((score / pitanja.length) * 100);
      // Task #133: roditelj = gost → read-only; ne upisuje napredak/rezultat
      // (kao neprijavljeni gost). Kviz se rješava lokalno, ali se ne perzistira.
      if (user && token && !isGuestLike) {
        // Pošalji greške u "Popravi saće" sistem (fire-and-forget; ne blokira
        // kviz flow ako server ne odgovori). Idempotentno preko UNIQUE
        // (user, source_type, source_id, question_index).
        if (wrongAnswers.length > 0) {
          apiRequest("POST", "/popravi-sace/zabiljezi", {
            sourceType: "kviz",
            sourceId: kviz.id,
            sourceNaslov: kviz.naslov,
            items: wrongAnswers,
          }, token).catch(() => {});
        }
        apiRequest("POST", "/content/napredak", {
          contentType: "kviz", contentId: kviz.id,
          zavrsen: true, bodovi, tacniOdgovori: score, ukupnoPitanja: pitanja.length,
        }, token).catch(() => {});
        apiRequest<{
          hasanatEarned?: number;
          hasanatGained?: number;
          totalHasanat?: number;
          previousHasanat?: number;
          streakDays?: number;
          streakIncreased?: boolean;
          newBadges?: { id: string; naziv: string; opis: string; ikona: string }[];
        }>(
          "POST", "/content/kviz-rezultat", {
            kvizId: kviz.id, kvizNaslov: kviz.naslov,
            tacniOdgovori: score, ukupnoPitanja: pitanja.length,
          }, token
        ).then(resp => {
          const earned = resp?.hasanatEarned || 0;
          // Show the shared CelebrationModal for "passing" attempts (>= 50%),
          // matching the server-side bodovi threshold so we only celebrate
          // attempts that actually awarded hasanat.
          if (bodovi >= 50) {
            triggerConfetti();
            setCelebration({
              isRepeat: earned === 0,
              hasanatGained: resp?.hasanatGained ?? earned,
              totalHasanat: resp?.totalHasanat ?? 0,
              previousHasanat:
                resp?.previousHasanat ??
                Math.max(0, (resp?.totalHasanat ?? 0) - earned),
              streakDays: resp?.streakDays ?? 0,
              streakIncreased: resp?.streakIncreased ?? false,
            });
          } else if (earned > 0) {
            toast({ title: t("+{n} kapi meda! 🍯", { n: String(earned) }), description: t(`Odlično si riješio/la kviz "{naslov}"`, { naslov: kviz.naslov }) });
          }
          const newBadges = resp?.newBadges || [];
          if (newBadges.length > 0) {
            setTimeout(() => {
              const first = newBadges[0];
              toast({
                title: `${t("🎉 Osvojio si bedž!")}${newBadges.length > 1 ? ` (+${newBadges.length - 1})` : ""}`,
                description: `${first.ikona} ${first.naziv} — ${first.opis}`,
              });
            }, 900);
          }
        }).catch((err: any) => {
          if (err?.status === 429 || err?.message?.includes("429")) {
            toast({ title: t("Već si radio/la ovaj kviz danas"), description: t("Pokušaj ponovo sutra!"), variant: "destructive" });
          }
        });
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
            <h2 className="text-2xl font-extrabold text-foreground mb-2">{t("Kviz završen!")}</h2>
            <p className="text-muted-foreground mb-6">{t("Tačnih odgovora: {score} od {ukupno} pitanja", { score: String(score), ukupno: String(pitanja.length) })}</p>
            {(() => {
              const sessionSize = (typeof kviz.pitanjaPoSesiji === "number" && kviz.pitanjaPoSesiji > 0)
                ? kviz.pitanjaPoSesiji
                : DEFAULT_QUIZ_SIZE;
              return kviz.pitanja.length > sessionSize ? (
                <p className="text-xs text-muted-foreground mb-2">{t("nasumično odabrano iz {n} pitanja", { n: String(kviz.pitanja.length) })}</p>
              ) : null;
            })()}
            <div className="text-5xl font-extrabold text-primary mb-6">{pct}%</div>
            {pct >= 80 && (
              <div className="flex items-center gap-2 justify-center bg-yellow-50 text-yellow-700 rounded-2xl p-4 mb-6 border border-yellow-200">
                <Star className="w-5 h-5 fill-yellow-500" />
                <span className="font-bold">{t("Odlično! Zaradio/la si kapi meda 🍯")}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setLocation("/kvizovi")} className="rounded-2xl">{t("Nazad")}</Button>
              <Button onClick={() => {
                const pool = shuffle(kviz.pitanja);
                const sessionSize = (typeof kviz.pitanjaPoSesiji === "number" && kviz.pitanjaPoSesiji > 0)
                  ? kviz.pitanjaPoSesiji
                  : DEFAULT_QUIZ_SIZE;
                const sel = pool.slice(0, Math.min(sessionSize, pool.length)).map(shuffleQuestionOptions);
                setPitanja(sel);
                setCurrent(0); setScore(0); setFinished(false);
                const first = sel[0];
                setSelected(null); setSelectedMulti([]); setMarkedWords([]); setAnswered(false);
                if (first?.type === "reorder" && first.items) setOrderedItems(shuffle(first.items.map((i: any) => i.text)));
                if (first?.type === "dragDrop" && first.template && first.words) { setDroppedWords(Array(first.template.filter((t: string) => t === "DROP").length).fill(null)); setWordBank(shuffle([...first.words])); }
              }} className="rounded-2xl">
                {t("Ponovi")}
              </Button>
            </div>
            {wrongAnswers.length > 0 && (
              <div className="mt-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-sm text-amber-900 text-left">
                <p className="font-bold mb-1">{t("🍯 Saće s rupama!")}</p>
                <p>
                  {t("Imaš")} <strong>{wrongAnswers.length}</strong>{" "}
                  {wrongAnswers.length === 1 ? t("grešku") : t("grešaka")} {t("za popraviti. Idi u")}{" "}
                  <button onClick={() => setLocation("/popravi-sace")} className="underline font-bold">{t("Popravi saće")}</button> {t("i zaradi po 5 kapi meda za svaku.")}
                </p>
              </div>
            )}
          </motion.div>
        </div>
        <AnimatePresence>
          {celebration && (
            <CelebrationModal data={celebration} onClose={() => setCelebration(null)} />
          )}
        </AnimatePresence>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setLocation("/kvizovi")} className="flex items-center gap-2 text-muted-foreground hover:text-primary font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
          </button>
          {user?.role === "admin" && (
            <button onClick={() => setLocation(`/admin/kviz/${kviz.id}`)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              title={t("Otvori novi editor kviza")}>
              <Pencil className="w-3.5 h-3.5" /> {t("Uredi kviz")}
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
              // Tri formata podržana:
              //  - Apsolutni URL (http/https) → koristi kako jeste
              //  - /uploads/... → nove slike sa našeg servera (api-server static), koristi kako jeste
              //  - /edu/... ili legacy filename → stari WordPress put, fallback na mekteb.net
              const imgPath = imgRaw.startsWith("/") ? imgRaw : "/" + imgRaw;
              const isAbsolute = /^https?:\/\//.test(imgRaw);
              const isNewUpload = imgPath.startsWith("/uploads/");
              const imgSrc = isAbsolute || isNewUpload
                ? imgRaw
                : (imgPath.startsWith("/edu") ? imgPath : `/edu${imgPath}`);
              return (
                <div className="rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-[rgb(36,143,146)]">
                  <img
                    src={imgSrc}
                    alt=""
                    className="w-full h-auto aspect-[3/2] object-cover"
                    onError={e => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallback && !isAbsolute && !isNewUpload) {
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

            {pitanje.learningType && (
              <div className="mb-3">
                <span className="inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-xs font-extrabold text-teal-800">
                  {t(LEARNING_TYPE_LABELS[pitanje.learningType] || pitanje.learningType)}
                </span>
              </div>
            )}
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
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">{t("Odaberi sve tačne odgovore")}</p>}
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
                      {t("Potvrdi odgovor")}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* ── REORDER ── */}
            {qType === "reorder" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">{t("Prevuci stavke (drži i povuci) ili koristi strelice da ih poredaš u tačan redosljed")}</p>}
                <div className="flex flex-col gap-2 mb-4">
                  {orderedItems.map((item, idx) => {
                    const correctOrder = [...(pitanje.items || [])].sort((a, b) => a.order - b.order).map(i => i.text);
                    const isCorrect = answered && correctOrder[idx] === item;
                    const isWrong = answered && correctOrder[idx] !== item;
                    return (
                      <div key={item} data-reorder-idx={idx} className={`flex items-center gap-3 border-2 rounded-2xl px-4 py-3 font-medium transition-all
                        ${dragIdx === idx ? "border-primary ring-2 ring-primary/30 shadow-lg scale-[1.01]" :
                          isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-800" :
                          isWrong ? "border-red-400 bg-red-50 text-red-800" :
                          "border-border/50 bg-white"}`}>
                        {!answered && (
                          <button
                            type="button"
                            onPointerDown={e => handleReorderPointerDown(e, idx)}
                            onPointerMove={handleReorderPointerMove}
                            onPointerUp={handleReorderPointerUp}
                            onPointerCancel={handleReorderPointerUp}
                            aria-label={t("Prevuci da promijeniš redosljed")}
                            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-primary p-1 -ml-1 shrink-0"
                          >
                            <GripVertical className="w-5 h-5" />
                          </button>
                        )}
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
                    <p className="font-bold text-foreground mb-2">{t("Tačan redosljed:")}</p>
                    {[...(pitanje.items || [])].sort((a,b) => a.order - b.order).map((item, i) => (
                      <p key={i}>{i+1}. {item.text}</p>
                    ))}
                  </div>
                )}
                {!answered && (
                  <div className="flex justify-end mb-4">
                    <Button onClick={confirmReorder} className="rounded-2xl px-8 font-bold">{t("Potvrdi redosljed")}</Button>
                  </div>
                )}
              </>
            )}

            {/* ── MARK WORDS ── */}
            {qType === "markWords" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">{t("Klikni na pogrešnu/e riječ/i")}</p>}
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
                    <Button onClick={confirmMarkWords} disabled={markedWords.length === 0} className="rounded-2xl px-8 font-bold">{t("Potvrdi odgovor")}</Button>
                  </div>
                )}
              </>
            )}

            {/* ── DRAG DROP (click-based) ── */}
            {qType === "dragDrop" && (
              <>
                {!answered && <p className="text-xs text-muted-foreground mb-4 font-medium">{t("Popuni praznine klikom na odgovore ispod")}</p>}
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
                    <p className="font-bold text-foreground mb-1">{t("Tačni odgovori:")} {(pitanje.correct || []).join(", ")}</p>
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
                        <RotateCcw className="w-3.5 h-3.5" /> {t("Resetuj")}
                      </button>
                      <Button onClick={confirmDragDrop} disabled={droppedWords.some(w => w === null)} className="rounded-2xl px-8 font-bold">
                        {t("Potvrdi odgovor")}
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

            {canRetryCurrentQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6"
              >
                <p className="text-sm font-bold text-amber-900 mb-3">
                  {pitanje.retryPrompt || t("Pročitaj objašnjenje i pokušaj još jednom.")}
                </p>
                <Button onClick={retryCurrentQuestion} variant="outline" className="rounded-xl border-amber-300 text-amber-900 hover:bg-amber-100">
                  <RotateCcw className="w-4 h-4 mr-2" /> {t("Pokušaj ponovo")}
                </Button>
              </motion.div>
            )}

            {answered && !canRetryCurrentQuestion && (
              <div className="flex justify-end">
                <Button onClick={next} className="rounded-2xl px-8 font-bold">
                  {isLast ? t("Završi") : t("Sljedeće pitanje")}
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
