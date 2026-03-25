import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, Volume2, CheckCircle2, BookOpen, BookMarked,
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare, PenLine,
  HelpCircle, Sparkles, Trophy, FileEdit, Save, X, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface LekcijaKvizPitanje {
  question: string;
  options: string[];
  answer: string;
}

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  contentHtml: string;
  audioSrc?: string;
  kvizPitanja?: LekcijaKvizPitanje[] | null;
}

interface AccordionSection {
  id: string;
  title: string;
  html: string;
  defaultOpen: boolean;
  type: "story" | "ilmihal" | "quiz_box" | "pitanja" | "zadatak" | "other";
}

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
}

interface LekcijaNav {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed: number;
}

// ──────────────────────────────────────────────────
// Horizontal lesson strip
// ──────────────────────────────────────────────────
function LekcijeStrip({ lekcije, currentSlug, onNavigate }: {
  lekcije: LekcijaNav[];
  currentSlug: string;
  onNavigate: (slug: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const currentIdx = lekcije.findIndex(l => l.slug === currentSlug);

  useEffect(() => {
    if (activeRef.current && stripRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [currentSlug]);

  const prev = currentIdx > 0 ? lekcije[currentIdx - 1] : null;
  const next = currentIdx < lekcije.length - 1 ? lekcije[currentIdx + 1] : null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => prev && onNavigate(prev.slug)}
          disabled={!prev}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-border/60 bg-white hover:bg-muted disabled:opacity-30 transition-colors"
          title={prev?.naslov}
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        <div ref={stripRef} className="flex-1 overflow-x-auto scrollbar-hide flex gap-1.5 py-1 px-0.5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {lekcije.map((l, i) => {
            const isActive = l.slug === currentSlug;
            return (
              <button
                key={l.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => onNavigate(l.slug)}
                title={l.naslov}
                className={`shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-bold transition-all min-w-[2.5rem]
                  ${isActive
                    ? "bg-teal-500 text-white shadow-md shadow-teal-200 scale-105"
                    : "bg-white border border-border/50 text-muted-foreground hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"
                  }`}
              >
                <span className="text-[10px] leading-none">{i + 1}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => next && onNavigate(next.slug)}
          disabled={!next}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-border/60 bg-white hover:bg-muted disabled:opacity-30 transition-colors"
          title={next?.naslov}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      {/* Current lesson name + position */}
      <div className="text-center mt-1.5">
        {currentIdx >= 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            {currentIdx + 1} / {lekcije.length} — {lekcije[currentIdx]?.naslov}
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Admin content editor modal — split panel (desktop only)
// ──────────────────────────────────────────────────
function AdminLekcijaEditor({ lekcija, token, onClose, onSaved }: {
  lekcija: { id: number; naslov: string; contentHtml: string };
  token: string;
  onClose: () => void;
  onSaved: (html: string) => void;
}) {
  const { toast } = useToast();
  const [html, setHtml] = useState(lekcija.contentHtml);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (val: string) => {
    setHtml(val);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PUT", `/admin/ilmihal/${lekcija.id}`, { contentHtml: html }, token);
      toast({ title: "Sačuvano! ✓", description: "Sadržaj lekcije uspješno ažuriran" });
      setIsDirty(false);
      onSaved(html);
      onClose();
    } catch {
      toast({ title: "Greška pri čuvanju", description: "Pokušaj ponovo", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm("Ima nesačuvanih promjena. Zatvori bez čuvanja?")) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Mobile guard */}
      <div className="flex md:hidden flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <FileEdit className="w-12 h-12 text-amber-500" />
        <h3 className="font-extrabold text-lg text-foreground">Editor dostupan samo na desktopu</h3>
        <p className="text-muted-foreground text-sm">Otvori stranicu na računaru da bi mogao/la uređivati sadržaj lekcije.</p>
        <Button variant="outline" onClick={onClose} className="rounded-xl">Zatvori</Button>
      </div>

      {/* Desktop split panel */}
      <div className="hidden md:flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileEdit className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-foreground truncate">Uredi sadržaj: {lekcija.naslov}</h3>
              <p className="text-xs text-muted-foreground">Lijevo: HTML kod — Desno: Vizuelni pregled (ažurira se u realnom vremenu)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zatvori"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Split panels */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: HTML editor */}
          <div className="w-1/2 flex flex-col border-r border-border">
            <div className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs font-mono font-bold flex items-center gap-2 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="ml-2">content_html</span>
            </div>
            <textarea
              value={html}
              onChange={e => handleChange(e.target.value)}
              className="flex-1 bg-zinc-900 text-green-300 font-mono text-xs leading-relaxed p-4 resize-none focus:outline-none"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          {/* Right: live preview */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-muted/60 text-xs font-bold text-muted-foreground border-b border-border shrink-0 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block animate-pulse" />
              Vizuelni pregled (sve sekcije razvijene)
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-white">
              {/* Inject CSS to reveal all hidden sections and hide accordion controls */}
              <style>{`
                .editor-preview .lesson-section-btn,
                .editor-preview .hero-box,
                .editor-preview h1:first-child,
                .editor-preview .quiz-container,
                .editor-preview .audio-controls { display: none !important; }
                .editor-preview .lesson-content { display: block !important; }
                .editor-preview .lesson-accordion { margin-bottom: 1.5rem; border-left: 3px solid #e2e8f0; padding-left: 1rem; }
                .editor-preview .arabic-card { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 0.75rem 1rem; border-radius: 0.5rem; margin: 0.75rem 0; }
                .editor-preview .lesson-text { margin-bottom: 0.75rem; line-height: 1.75; font-size: 0.9rem; }
                .editor-preview strong { font-weight: 700; }
              `}</style>
              <div
                className="editor-preview ilmihal-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        </div>

        {/* Bottom bar — Sačuvaj */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-border bg-white shrink-0">
          {isDirty && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Nesačuvano
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="rounded-xl px-6 font-bold flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Čuvam..." : "Sačuvaj"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Post-process section HTML to fix wall-of-text
// Splits oversized <p class="lesson-text"> into multiple paragraphs
// ──────────────────────────────────────────────────
function postProcessHtml(html: string): string {
  return html.replace(/<p class="lesson-text">([\s\S]*?)<\/p>/g, (_match, content: string) => {
    if (content.length < 400) return `<p class="lesson-text">${content}</p>`;
    // Split at sentence boundaries: ". UPPERCASE" or "! UPPERCASE" or "? UPPERCASE"
    const sentences = content.split(/(?<=[.!?])\s+(?=[A-ZŠĐĆŽČ])/);
    if (sentences.length <= 1) {
      // Try splitting at ALL-CAPS words (headings embedded in text)
      const parts = content.split(/(?=\b[A-ZŠĐĆŽČ]{4,}(?:\s[A-ZŠĐĆŽČ]{2,})+)/);
      if (parts.length > 1) {
        return parts.map(p => p.trim()).filter(Boolean).map((p, i) =>
          i > 0 && /^[A-ZŠĐĆŽČ]{4}/.test(p)
            ? `<p class="lesson-text lesson-heading">${p}</p>`
            : `<p class="lesson-text">${p}</p>`
        ).join('\n');
      }
      return `<p class="lesson-text">${content}</p>`;
    }
    // Group sentences into paragraphs (3-4 sentences each)
    const grouped: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) {
      grouped.push(sentences.slice(i, i + 3).join(' '));
    }
    return grouped.map(g => `<p class="lesson-text">${g.trim()}</p>`).join('\n');
  });
}

// ──────────────────────────────────────────────────
// Parse the lesson HTML into structured sections
// Uses DOMParser for robust nested-div handling
// ──────────────────────────────────────────────────
function parseSections(html: string): { heroImage: string | null; sections: AccordionSection[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Hero image from .hero-box
  const heroImg = doc.querySelector(".hero-box img");
  const heroImage = heroImg ? heroImg.getAttribute("src") : null;

  const sections: AccordionSection[] = [];
  const accordions = doc.querySelectorAll(".lesson-accordion");

  accordions.forEach(accordion => {
    const btn = accordion.querySelector(".lesson-section-btn");
    if (!btn) return;

    // Extract section ID from onclick="toggleSection('SECTION_ID', this)"
    const onclickAttr = btn.getAttribute("onclick") || "";
    const idMatch = onclickAttr.match(/toggleSection\('([^']+)'/);
    if (!idMatch) return;
    const sectionId = idMatch[1];

    // Button title: text without the span
    const iconSpan = btn.querySelector(".section-icon");
    if (iconSpan) iconSpan.remove();
    const title = btn.textContent?.trim() || sectionId;

    // Content div
    const contentDiv = accordion.querySelector(".lesson-content");
    if (!contentDiv) return;
    const contentHtml = contentDiv.innerHTML.trim();

    // Default open: has "active" class or is the story/first narrative section
    const titleCheck = title.toUpperCase().replace(/^\d+\.\s*/, "");
    const isStoryLike = sectionId === "STORY" || titleCheck.includes("PUTOKAZ") || titleCheck.includes("PRIČA") || titleCheck.includes("PRICA");
    const isActive = contentDiv.classList.contains("active") || isStoryLike;

    // Classify section type — first by sectionId, then by title text as fallback
    let type: AccordionSection["type"] = "other";
    const sid = sectionId.toUpperCase();
    const classify = (s: string) => {
      if (s === "STORY" || s.includes("PRIČA") || s.includes("PRICA") || s.includes("PUTOKAZ") || s.includes("PUTO")) return "story" as const;
      if (s === "ILMIHAL" || s.includes("ILMIHAL")) return "ilmihal" as const;
      // quiz_box: only if the section ID itself is a quiz section (not just title keywords)
      if (s === "QUIZ_BOX" || s === "QUIZ" || s === "QUIZ_SECTION" || s === "QUIZ-SECTION" || s === "KVIZ") return "quiz_box" as const;
      if (s.includes("PITAN") || s.includes("RAZGOVOR")) return "pitanja" as const;
      if (s.includes("ZADATAK") || s.includes("ZADACI") || s.includes("AKTIVNOST") || s === "ZADACA") return "zadatak" as const;
      return null;
    };
    // Only classify by sectionId — don't use title keywords for quiz_box (too broad)
    type = classify(sid) || "other";

    const processedHtml = postProcessHtml(contentHtml);
    sections.push({ id: sectionId, title, html: processedHtml, defaultOpen: isActive, type });
  });

  return { heroImage, sections };
}

// ──────────────────────────────────────────────────
// Section type config
// ──────────────────────────────────────────────────
const SECTION_CONFIG = {
  story: {
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    headerBg: "bg-amber-500/10 hover:bg-amber-500/15",
    headerText: "text-amber-800",
    icon: <Sparkles className="w-4 h-4 shrink-0" />,
    iconBg: "bg-amber-100 text-amber-600",
  },
  ilmihal: {
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    headerBg: "bg-blue-500/10 hover:bg-blue-500/15",
    headerText: "text-blue-800",
    icon: <BookMarked className="w-4 h-4 shrink-0" />,
    iconBg: "bg-blue-100 text-blue-700",
  },
  pitanja: {
    bg: "bg-red-50",
    ring: "ring-red-200",
    headerBg: "bg-red-500/10 hover:bg-red-500/15",
    headerText: "text-red-800",
    icon: <MessageSquare className="w-4 h-4 shrink-0" />,
    iconBg: "bg-red-100 text-red-600",
  },
  zadatak: {
    bg: "bg-purple-50",
    ring: "ring-purple-200",
    headerBg: "bg-purple-500/10 hover:bg-purple-500/15",
    headerText: "text-purple-800",
    icon: <PenLine className="w-4 h-4 shrink-0" />,
    iconBg: "bg-purple-100 text-purple-600",
  },
  quiz_box: {
    bg: "bg-white",
    ring: "ring-teal-200",
    headerBg: "bg-teal-50 hover:bg-teal-100/60",
    headerText: "text-teal-800",
    icon: <HelpCircle className="w-4 h-4 shrink-0" />,
    iconBg: "bg-teal-100 text-teal-700",
  },
  other: {
    bg: "bg-gray-50",
    ring: "ring-gray-200",
    headerBg: "bg-gray-100 hover:bg-gray-200",
    headerText: "text-gray-800",
    icon: <BookOpen className="w-4 h-4 shrink-0" />,
    iconBg: "bg-gray-100 text-gray-600",
  },
};

// ──────────────────────────────────────────────────
// Inline Mini-Quiz (nivo3, no score)
// ──────────────────────────────────────────────────
function MiniKviz({ slug, nivo }: { slug: string; nivo: number }) {
  const [pitanja, setPitanja] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiRequest<any[]>("GET", `/content/kvizovi?nivo=${nivo}&modul=ilmihal`)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const saPitanjima = data.filter((k: any) => k.pitanja?.length > 0);
          if (saPitanjima.length > 0) {
            const kviz = saPitanjima[Math.floor(Math.random() * saPitanjima.length)];
            const sva: QuizQuestion[] = typeof kviz.pitanja === "string"
              ? JSON.parse(kviz.pitanja) : kviz.pitanja;
            const shuffled = [...sva].sort(() => Math.random() - 0.5).slice(0, 5);
            setPitanja(shuffled);
          }
        }
      }).catch(() => {});
  }, [nivo]);

  if (pitanja.length === 0) return (
    <p className="text-sm text-teal-700 font-medium text-center py-4">
      Kviz za ovu lekciju uskoro...
    </p>
  );

  if (done) return (
    <div className="text-center py-6">
      <Trophy className="w-10 h-10 mx-auto mb-3 text-amber-500" />
      <p className="text-lg font-extrabold text-foreground">{score}/{pitanja.length} tačnih!</p>
      <p className="text-sm text-muted-foreground mt-1">Ovo je provjera za sebe — ne broji u bodove</p>
      <Button size="sm" variant="outline" onClick={() => { setCurrent(0); setScore(0); setDone(false); setSelected(null); }}
        className="mt-4 rounded-xl">Ponovi</Button>
    </div>
  );

  const q = pitanja[current];
  const isCorrect = selected !== null && selected === q.answer;
  const isWrong = selected !== null && selected !== q.answer;

  return (
    <div>
      <p className="text-xs text-muted-foreground font-bold mb-3">Pitanje {current + 1}/{pitanja.length}</p>
      <p className="font-bold text-foreground mb-4 leading-relaxed">{q.question}</p>
      <div className="flex flex-col gap-2">
        {q.options.map((opt) => (
          <button key={opt} disabled={!!selected}
            onClick={() => {
              setSelected(opt);
              if (opt === q.answer) setScore(s => s + 1);
            }}
            className={`text-left px-4 py-3 rounded-xl border font-medium text-sm transition-all ${
              selected === null ? "border-border hover:border-teal-400 hover:bg-teal-50" :
              opt === q.answer ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold" :
              selected === opt ? "border-red-400 bg-red-50 text-red-700" :
              "border-border opacity-50"
            }`}>
            {opt}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => {
            if (current + 1 >= pitanja.length) setDone(true);
            else { setCurrent(c => c + 1); setSelected(null); }
          }} className="rounded-xl">
            {current + 1 >= pitanja.length ? "Završi" : "Sljedeće →"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// AI-generated lekcija kviz accordion
// ──────────────────────────────────────────────────
function LekcijaKvizBox({ pitanja }: { pitanja: LekcijaKvizPitanje[] }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);

  const reset = () => { setCurrent(0); setSelected(null); setScore(0); setDone(false); };

  const q = pitanja[current];

  return (
    <div className="ring-2 ring-inset rounded-2xl overflow-hidden bg-teal-50 ring-teal-200">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors bg-teal-500/10 hover:bg-teal-500/15">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-teal-100 text-teal-700">
            <HelpCircle className="w-4 h-4 shrink-0" />
          </span>
          <span className="font-extrabold text-sm tracking-wide uppercase text-teal-800">
            Provjeri znanje
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-teal-800 opacity-70" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-5 pb-5 pt-4">
              {done ? (
                <div className="text-center py-4">
                  <Trophy className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                  <p className="text-lg font-extrabold text-foreground">{score}/{pitanja.length} tačnih!</p>
                  <p className="text-sm text-muted-foreground mt-1">Provjera za sebe — ne broji u bodove</p>
                  <Button size="sm" variant="outline" onClick={reset} className="mt-4 rounded-xl">Ponovi kviz</Button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-3">Pitanje {current + 1}/{pitanja.length}</p>
                  <p className="font-bold text-foreground mb-4 leading-relaxed">{q.question}</p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt) => (
                      <button key={opt} disabled={!!selected}
                        onClick={() => {
                          setSelected(opt);
                          if (opt === q.answer) setScore(s => s + 1);
                        }}
                        className={`text-left px-4 py-3 rounded-xl border font-medium text-sm transition-all ${
                          !selected
                            ? "border-border hover:border-teal-400 hover:bg-teal-50 bg-white"
                            : opt === q.answer
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold"
                              : selected === opt
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-border opacity-50 bg-white"
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                  {selected && (
                    <div className="mt-4 flex justify-end">
                      <Button size="sm" onClick={() => {
                        if (current + 1 >= pitanja.length) setDone(true);
                        else { setCurrent(c => c + 1); setSelected(null); }
                      }} className="rounded-xl">
                        {current + 1 >= pitanja.length ? "Završi ✓" : "Sljedeće →"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Single accordion section
// ──────────────────────────────────────────────────
function SectionAccordion({ section, slug, nivo }: { section: AccordionSection; slug: string; nivo: number }) {
  const [open, setOpen] = useState(section.defaultOpen);
  const cfg = SECTION_CONFIG[section.type];

  return (
    <div className={`ring-2 ring-inset rounded-2xl overflow-hidden ${cfg.bg} ${cfg.ring}`}>
      <button onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${cfg.headerBg}`}>
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
            {cfg.icon}
          </span>
          <span className={`font-extrabold text-sm tracking-wide uppercase ${cfg.headerText}`}>
            {section.title}
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className={`w-5 h-5 ${cfg.headerText} opacity-70`} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-5 pb-5 pt-4">
              <div
                className="ilmihal-content"
                dangerouslySetInnerHTML={{ __html: section.html }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────
export default function IlmihalLekcijaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [lekcija, setLekcija] = useState<Lekcija | null>(null);
  const [parsed, setParsed] = useState<{ heroImage: string | null; sections: AccordionSection[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lekcijeStrip, setLekcijeStrip] = useState<LekcijaNav[]>([]);
  const [showEditor, setShowEditor] = useState(false);

  const displayNivo = (nivo: number) => nivo === 21 ? 2 : nivo;

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    apiRequest<Lekcija>("GET", `/content/ilmihal/${slug}`)
      .then(data => {
        setLekcija(data);
        setParsed(parseSections(data.contentHtml));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [slug]);

  // Fetch all lekcije for the same nivo to build the strip
  useEffect(() => {
    apiRequest<LekcijaNav[]>("GET", "/content/ilmihal")
      .then(all => {
        if (!lekcija) return;
        const dn = displayNivo(lekcija.nivo);
        const same = all
          .filter(l => displayNivo(l.nivo) === dn)
          .sort((a, b) => (a.redoslijed ?? 0) - (b.redoslijed ?? 0));
        setLekcijeStrip(same);
      })
      .catch(() => {});
  }, [lekcija]);

  const markComplete = async () => {
    if (!lekcija || !user) return;
    try {
      await apiRequest("POST", "/content/napredak", {
        contentType: "ilmihal",
        contentId: lekcija.id,
        zavrsen: true,
        bodovi: 10,
      }, token);
      setCompleted(true);
      toast({ title: "Bravo! ⭐", description: "Lekcija označena kao završena" });
    } catch {}
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const NIVO_LABELS: Record<number, string> = { 1: "Nivo 1", 2: "Nivo 2", 21: "Nivo 2", 3: "Nivo 3" };
  const backNivo = lekcija ? displayNivo(lekcija.nivo) : null;
  const goBack = () => setLocation(backNivo ? `/ilmihal?nivo=${backNivo}` : "/ilmihal");

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-6 w-40 rounded-xl mb-6" />
          <Skeleton className="h-48 rounded-2xl mb-4" />
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl mb-3" />)}
        </div>
      </Layout>
    );
  }

  if (!lekcija || !parsed) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Lekcija nije pronađena</p>
          <Button className="mt-4" onClick={() => setLocation("/ilmihal")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  return (
    <>
    {showEditor && lekcija && token && (
      <AdminLekcijaEditor
        lekcija={{ id: lekcija.id, naslov: lekcija.naslov, contentHtml: lekcija.contentHtml }}
        token={token}
        onClose={() => setShowEditor(false)}
        onSaved={html => {
          setLekcija(prev => prev ? { ...prev, contentHtml: html } : prev);
          setParsed(parseSections(html));
        }}
      />
    )}
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Back navigation */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary font-bold text-sm transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/10">
            <ArrowLeft className="w-4 h-4" /> Nazad
          </button>
          <span className="text-border/70">|</span>
          <button onClick={goBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-primary font-medium text-sm transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/10">
            📋 Ilmihal lista
          </button>
          {user?.role === "admin" && (
            <>
              <span className="text-border/70 ml-auto">|</span>
              <button onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                <FileEdit className="w-3.5 h-3.5" /> Uredi sadržaj
              </button>
            </>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 mb-2">
              {NIVO_LABELS[lekcija.nivo] || `Nivo ${lekcija.nivo}`}
            </span>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">{lekcija.naslov}</h1>
          </div>
          {lekcija.audioSrc && (
            <>
              <button onClick={toggleAudio}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm shrink-0 transition-colors ${isPlaying ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                <Volume2 className="w-4 h-4" /> {isPlaying ? "Pauza" : "Slušaj"}
              </button>
              <audio ref={audioRef} src={lekcija.audioSrc} onEnded={() => setIsPlaying(false)} />
            </>
          )}
        </div>

        {/* Hero image */}
        {parsed.heroImage && (
          <div className="rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-[rgb(36,143,146)]">
            <img
              src={parsed.heroImage}
              alt={lekcija.naslov}
              className="w-full h-auto aspect-[3/2] object-cover"
              onError={e => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = "1";
                  img.src = `https://mekteb.net${parsed.heroImage}`;
                } else {
                  img.style.display = "none";
                }
              }}
            />
          </div>
        )}

        {/* Lesson navigation strip */}
        {lekcijeStrip.length > 1 && slug && (
          <LekcijeStrip
            lekcije={lekcijeStrip}
            currentSlug={slug}
            onNavigate={s => setLocation(`/ilmihal/${s}`)}
          />
        )}

        {/* Accordion sections — ordered: story → ilmihal → Provjeri znanje → pitanja → zadatak → other */}
        {parsed.sections.length > 0 ? (
          <div className="flex flex-col gap-3 mb-6">
            {(() => {
              const ORDER: Record<AccordionSection["type"], number> = {
                story: 0, ilmihal: 1, quiz_box: 2, pitanja: 3, zadatak: 4, other: 5,
              };
              const kvizPitanja = lekcija.kvizPitanja && lekcija.kvizPitanja.length > 0 ? lekcija.kvizPitanja : null;
              // Filter out original quiz_box sections — replaced by AI LekcijaKvizBox
              const visibleSections = parsed.sections.filter(s => s.type !== "quiz_box");
              const sorted = [...visibleSections].sort((a, b) => ORDER[a.type] - ORDER[b.type]);

              const items: React.ReactNode[] = [];
              let kvizInserted = false;
              for (const section of sorted) {
                items.push(
                  <SectionAccordion key={section.id} section={section} slug={slug!} nivo={lekcija.nivo} />
                );
                // Insert AI MCQ quiz right after the ilmihal section
                if (!kvizInserted && section.type === "ilmihal" && kvizPitanja) {
                  items.push(<LekcijaKvizBox key="lekcija-kviz" pitanja={kvizPitanja} />);
                  kvizInserted = true;
                }
              }
              // If no ilmihal section found but we have pitanja, add kviz at end (before pitanja/zadatak)
              if (!kvizInserted && kvizPitanja) {
                items.push(<LekcijaKvizBox key="lekcija-kviz" pitanja={kvizPitanja} />);
              }
              return items;
            })()}
          </div>
        ) : (
          /* Fallback: if no sections parsed, render raw HTML */
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6 mb-6">
            <div className="ilmihal-content" dangerouslySetInnerHTML={{ __html: lekcija.contentHtml }} />
          </div>
        )}

        {/* Complete button */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex justify-end">
            <Button
              onClick={markComplete}
              disabled={completed}
              className={`rounded-2xl px-8 py-3 font-bold text-base ${completed ? "bg-emerald-500 hover:bg-emerald-500" : ""}`}
            >
              {completed ? (
                <><CheckCircle2 className="w-5 h-5 mr-2" /> Završeno! ⭐</>
              ) : (
                <><BookOpen className="w-5 h-5 mr-2" /> Označi kao završeno</>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </Layout>
    </>
  );
}
