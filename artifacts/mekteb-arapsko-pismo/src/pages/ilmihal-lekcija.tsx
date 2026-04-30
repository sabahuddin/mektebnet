import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { RjecnikContent } from "@/components/rjecnik-content";
import {
  ArrowLeft, CheckCircle2, BookOpen, BookMarked,
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare, PenLine,
  HelpCircle, Sparkles, Trophy, FilePen, Save, X, Loader2, Code,
  ImagePlus, Camera, Printer, FileDown, FileText, ExternalLink, Trash2, Upload, Paperclip, Lock, Unlock, Plus, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Maskota } from "@/components/maskota";
import { CelebrationModal, type CelebrationData } from "@/components/celebration-modal";
import confetti from "canvas-confetti";
const WysiwygEditor = lazy(() => import("@/components/wysiwyg-editor").then(m => ({ default: m.WysiwygEditor })));
const H5PPlayerLazy = lazy(() => import("@/components/h5p-player").then(m => ({ default: m.H5PPlayer })));

interface LekcijaKvizPitanje {
  question: string;
  options: string[];
  answer: string;
}

interface Prilog {
  id: number;
  originalName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  createdAt: string;
  kind?: "file" | "url" | "h5p";
  externalUrl?: string | null;
  h5pPath?: string | null;
}

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  contentHtml: string;
  audioSrc?: string;
  kvizPitanja?: LekcijaKvizPitanje[] | null;
  prilozi?: Prilog[];
  locked?: boolean;
  lockedNote?: string | null;
  lockedAt?: string | null;
}

interface AccordionSection {
  id: string;
  title: string;
  html: string;
  defaultOpen: boolean;
  type: "story" | "ilmihal" | "quiz_box" | "pitanja" | "zadatak" | "priprema" | "other";
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
function LekcijeStrip({ lekcije, currentSlug, completedIds, onNavigate }: {
  lekcije: LekcijaNav[];
  currentSlug: string;
  completedIds: Set<number>;
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
  const nextLessonId = lekcije.find(l => !completedIds.has(l.id))?.id ?? null;

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
            const isDone = completedIds.has(l.id);
            const isNext = l.id === nextLessonId;
            return (
              <button
                key={l.id}
                ref={isActive ? activeRef : undefined}
                onClick={() => onNavigate(l.slug)}
                title={`${l.naslov}${isDone ? " ✓" : isNext ? " (sljedeća)" : ""}`}
                className={`relative shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-xs font-bold transition-all min-w-[2.5rem]
                  ${isActive
                    ? "bg-teal-500 text-white shadow-md shadow-teal-200 scale-105"
                    : isDone
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                      : isNext
                        ? "bg-amber-50 border-2 border-amber-300 text-amber-700 ring-2 ring-amber-200/60 hover:bg-amber-100"
                        : "bg-white border border-border/50 text-muted-foreground hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"
                  }`}
              >
                <span className="text-[10px] leading-none">{i + 1}</span>
                {isDone && !isActive && (
                  <CheckCircle2 className="absolute -top-1 -right-1 w-3 h-3 text-emerald-600 bg-white rounded-full" strokeWidth={3} />
                )}
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
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const dirtyRef = useRef(false);

  const handleChange = (val: string) => {
    setHtml(val);
    setIsDirty(true);
    dirtyRef.current = true;
  };

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let saveHtml = html;
      if (mode === "visual" && (window as any).__wysiwygGetFullHtml) {
        saveHtml = (window as any).__wysiwygGetFullHtml();
      }
      await apiRequest("PUT", `/admin/ilmihal/${lekcija.id}`, { contentHtml: saveHtml }, token);
      toast({ title: "Sačuvano! ✓", description: "Sadržaj lekcije uspješno ažuriran" });
      setIsDirty(false);
      onSaved(saveHtml);
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
      <div className="flex md:hidden flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <FilePen className="w-12 h-12 text-amber-500" />
        <h3 className="font-extrabold text-lg text-foreground">Editor dostupan samo na desktopu</h3>
        <p className="text-muted-foreground text-sm">Otvori stranicu na računaru da bi mogao/la uređivati sadržaj lekcije.</p>
        <Button variant="outline" onClick={onClose} className="rounded-xl">Zatvori</Button>
      </div>

      <div className="hidden md:flex flex-col h-full">
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FilePen className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-foreground truncate">Uredi sadržaj: {lekcija.naslov}</h3>
              <p className="text-xs text-muted-foreground">
                {mode === "visual" ? "Vizuelni editor — klikni na tekst i uredi kao u Wordu" : "HTML kod — za napredne izmjene"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMode(mode === "visual" ? "html" : "visual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                mode === "html" ? "bg-zinc-800 text-green-400" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              title="Prebaci između vizuelnog i HTML editora"
            >
              <Code className="w-3.5 h-3.5" />
              {mode === "html" ? "HTML" : "Kod"}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Zatvori"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {mode === "visual" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>}>
                <WysiwygEditor content={html} onChange={markDirty} token={token} />
              </Suspense>
            </div>
          ) : (
            <>
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
              <div className="w-1/2 flex flex-col overflow-hidden">
                <div className="px-4 py-2 bg-muted/60 text-xs font-bold text-muted-foreground border-b border-border shrink-0 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block animate-pulse" />
                  Vizuelni pregled
                </div>
                <div className="flex-1 overflow-y-auto p-5 bg-white">
                  <style>{`
                    .editor-preview details { display: block; }
                    .editor-preview details > * { display: block; }
                    .editor-preview summary { display: none; }
                    .editor-preview .arabic-card { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-left: 4px solid #10b981; padding: 0.75rem 1rem; border-radius: 0.75rem; margin: 0.75rem 0; }
                    .editor-preview .info-box { background: linear-gradient(135deg, #fefce8, #fef9c3); border-left: 4px solid #eab308; padding: 0.75rem 1rem; border-radius: 0.75rem; margin: 0.75rem 0; }
                    .editor-preview strong { font-weight: 700; }
                    .editor-preview p { margin: 0.5rem 0; line-height: 1.75; }
                    .editor-preview ul, .editor-preview ol { padding-left: 1.5rem; margin: 0.5rem 0; }
                    .editor-preview li { margin: 0.25rem 0; }
                    .editor-preview h3 { font-size: 1.2rem; font-weight: 700; margin: 1rem 0 0.5rem; }
                    .editor-preview h4 { font-size: 1.05rem; font-weight: 700; margin: 0.75rem 0 0.5rem; }
                    .editor-preview img { max-width: 100%; border-radius: 0.75rem; margin: 0.75rem 0; }
                    .editor-preview img[data-size="medium"] { max-width: 50%; width: 50%; }
                    .editor-preview img[data-size="small"] { max-width: 33%; width: 33%; }
                    .editor-preview img[data-align="left"] { float: left; margin: 0.5rem 1.25rem 0.75rem 0; }
                    .editor-preview img[data-align="right"] { float: right; margin: 0.5rem 0 0.75rem 1.25rem; }
                    .editor-preview img[data-align="center"] { display: block; margin-left: auto; margin-right: auto; }
                  `}</style>
                  <div
                    className="editor-preview ilmihal-content"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

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
    // Strip leading numbering ("1. ", "2.) ", "3 - " itd.) iz prikazanog naslova akordiona.
    // Zahtijeva najmanje jedan delimiter nakon broja, pa "A1" / "1a" ostaju netaknuti.
    const rawTitle = btn.textContent?.trim() || sectionId;
    let title = rawTitle.replace(/^\s*\d+(?:\s*[.)\-:–])+\s*/, "").trim() || rawTitle;

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
      if (s === "PRIPREMA" || s.includes("PRIPREMA ZA NASTAVU")) return "priprema" as const;
      if (s === "STORY" || s.includes("PRIČA") || s.includes("PRICA") || s.includes("PUTOKAZ") || s.includes("PUTO")) return "story" as const;
      if (s === "ILMIHAL" || s.includes("ILMIHAL")) return "ilmihal" as const;
      if (s === "QUIZ_BOX" || s === "QUIZ" || s === "QUIZ_SECTION" || s === "QUIZ-SECTION" || s === "KVIZ") return "quiz_box" as const;
      if (s.includes("PITAN") || s.includes("RAZGOVOR")) return "pitanja" as const;
      if (s.includes("ZADATAK") || s.includes("ZADACI") || s.includes("AKTIVNOST") || s === "ZADACA") return "zadatak" as const;
      return null;
    };
    // Classify by sectionId first, then by title for priprema
    type = classify(sid) || classify(titleCheck) || "other";

    // Override naslov akordiona ilmihal sekcije: "Naučimo iz ilmihala" → "Ilmihal".
    if (type === "ilmihal") {
      title = "Ilmihal";
    }

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
    Icon: Sparkles,
    iconBg: "bg-amber-100 text-amber-600",
  },
  ilmihal: {
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    headerBg: "bg-blue-500/10 hover:bg-blue-500/15",
    headerText: "text-blue-800",
    Icon: BookMarked,
    iconBg: "bg-blue-100 text-blue-700",
  },
  pitanja: {
    bg: "bg-red-50",
    ring: "ring-red-200",
    headerBg: "bg-red-500/10 hover:bg-red-500/15",
    headerText: "text-red-800",
    Icon: MessageSquare,
    iconBg: "bg-red-100 text-red-600",
  },
  zadatak: {
    bg: "bg-purple-50",
    ring: "ring-purple-200",
    headerBg: "bg-purple-500/10 hover:bg-purple-500/15",
    headerText: "text-purple-800",
    Icon: PenLine,
    iconBg: "bg-purple-100 text-purple-600",
  },
  quiz_box: {
    bg: "bg-white",
    ring: "ring-teal-200",
    headerBg: "bg-teal-50 hover:bg-teal-100/60",
    headerText: "text-teal-800",
    Icon: HelpCircle,
    iconBg: "bg-teal-100 text-teal-700",
  },
  priprema: {
    bg: "bg-green-50",
    ring: "ring-green-300",
    headerBg: "bg-green-500/10 hover:bg-green-500/15",
    headerText: "text-green-800",
    Icon: FilePen,
    iconBg: "bg-green-100 text-green-700",
  },
  other: {
    bg: "bg-gray-50",
    ring: "ring-gray-200",
    headerBg: "bg-gray-100 hover:bg-gray-200",
    headerText: "text-gray-800",
    Icon: BookOpen,
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
function LekcijaKvizBox({ pitanja, lekcijaId, isAdmin, token, onSaved }: {
  pitanja: LekcijaKvizPitanje[];
  lekcijaId?: number;
  isAdmin?: boolean;
  token?: string | null;
  onSaved?: (novaPitanja: LekcijaKvizPitanje[]) => void;
}) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const reset = () => { setCurrent(0); setSelected(null); setScore(0); setDone(false); };

  // Hardening: izbaci malformed legacy zapise (nema teksta ili nedovoljno opcija)
  const safePitanja: LekcijaKvizPitanje[] = (pitanja || [])
    .map(p => ({
      question: typeof p?.question === "string" ? p.question : "",
      options: Array.isArray(p?.options) ? p.options.filter(o => typeof o === "string" && o.trim().length > 0) : [],
      answer: typeof p?.answer === "string" ? p.answer : "",
    }))
    .filter(p => p.question.trim().length > 0 && p.options.length >= 2);

  const safeIdx = Math.min(current, Math.max(0, safePitanja.length - 1));
  const q = safePitanja[safeIdx];
  const canEdit = !!(isAdmin && token && lekcijaId);

  // Ako sva pitanja su malformed a nismo admin, ne renderiraj kviz
  if (safePitanja.length === 0 && !canEdit) return null;

  return (
    <div className="ring-2 ring-inset rounded-2xl overflow-hidden bg-teal-50 ring-teal-200">
      <div className="w-full flex items-stretch bg-teal-500/10">
        <button onClick={() => setOpen(v => !v)}
          className="flex-1 flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-teal-500/15"
          data-testid="button-toggle-kviz">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-teal-100 text-teal-700">
              <HelpCircle className="w-4 h-4 shrink-0" />
            </span>
            <span className="font-extrabold text-sm tracking-wide uppercase text-teal-800">
              Provjeri znanje
            </span>
            {canEdit && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-200/80 text-teal-900">
                {safePitanja.length} {safePitanja.length === 1 ? "pitanje" : "pitanja"}
              </span>
            )}
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-teal-800 opacity-70" />
          </motion.div>
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
            className="px-3 sm:px-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-900 hover:bg-teal-500/20 border-l border-teal-300/60 transition-colors"
            title="Uredi pitanja"
            data-testid="button-uredi-pitanja"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Uredi</span>
          </button>
        )}
      </div>

      {canEdit && editOpen && (
        <KvizEditModal
          lekcijaId={lekcijaId!}
          token={token!}
          initialPitanja={pitanja}
          onClose={() => setEditOpen(false)}
          onSaved={(novaPitanja) => {
            onSaved?.(novaPitanja);
            setEditOpen(false);
            reset();
          }}
        />
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-5 pb-5 pt-4">
              {safePitanja.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4" data-testid="text-kviz-prazan">
                  Nema pitanja. Klikni "Uredi" pa "Dodaj pitanje" da kreiraš.
                </div>
              ) : done ? (
                <div className="text-center py-4">
                  <Trophy className="w-10 h-10 mx-auto mb-3 text-amber-500" />
                  <p className="text-lg font-extrabold text-foreground">{score}/{safePitanja.length} tačnih!</p>
                  <p className="text-sm text-muted-foreground mt-1">Provjera za sebe — ne broji u bodove</p>
                  <Button size="sm" variant="outline" onClick={reset} className="mt-4 rounded-xl">Ponovi kviz</Button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-3">Pitanje {safeIdx + 1}/{safePitanja.length}</p>
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
                        if (safeIdx + 1 >= safePitanja.length) setDone(true);
                        else { setCurrent(safeIdx + 1); setSelected(null); }
                      }} className="rounded-xl">
                        {safeIdx + 1 >= safePitanja.length ? "Završi ✓" : "Sljedeće →"}
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
// Admin: editor za pitanja "Provjeri znanje"
// ──────────────────────────────────────────────────
function KvizEditModal({ lekcijaId, token, initialPitanja, onClose, onSaved }: {
  lekcijaId: number;
  token: string;
  initialPitanja: LekcijaKvizPitanje[];
  onClose: () => void;
  onSaved: (pitanja: LekcijaKvizPitanje[]) => void;
}) {
  const { toast } = useToast();
  const initial = useRef<LekcijaKvizPitanje[]>(
    (initialPitanja && initialPitanja.length > 0)
      ? initialPitanja.map(p => ({
          question: p.question || "",
          options: (p.options && p.options.length >= 2 ? p.options : ["", "", "", ""]).slice(),
          answer: p.answer || "",
        }))
      : [{ question: "", options: ["", "", "", ""], answer: "" }]
  );
  const [pitanja, setPitanja] = useState<LekcijaKvizPitanje[]>(() => initial.current.map(p => ({ ...p, options: p.options.slice() })));
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isDirty = useCallback(() => {
    return JSON.stringify(pitanja) !== JSON.stringify(initial.current);
  }, [pitanja]);

  const requestClose = useCallback(() => {
    if (isDirty() && !confirm("Imate nesačuvane izmjene. Zatvoriti i izgubiti ih?")) return;
    onClose();
  }, [isDirty, onClose]);

  // Esc da zatvori (sa dirty-check), body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  const updateP = (idx: number, patch: Partial<LekcijaKvizPitanje>) => {
    setPitanja(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const updateOption = (pIdx: number, oIdx: number, value: string) => {
    setPitanja(prev => prev.map((p, i) => {
      if (i !== pIdx) return p;
      const opts = p.options.slice();
      const old = opts[oIdx] ?? "";
      opts[oIdx] = value;
      // Ako je staro polje bilo trenutni "answer", premjesti answer na novu vrijednost
      const newAnswer = p.answer === old ? value : p.answer;
      return { ...p, options: opts, answer: newAnswer };
    }));
  };

  const setAnswer = (pIdx: number, value: string) => updateP(pIdx, { answer: value });

  const removeP = (idx: number) => {
    if (!confirm("Obrisati ovo pitanje?")) return;
    setPitanja(prev => prev.filter((_, i) => i !== idx));
  };

  const addP = () => {
    setPitanja(prev => [...prev, { question: "", options: ["", "", "", ""], answer: "" }]);
  };

  const validate = (): string | null => {
    if (pitanja.length === 0) return "Mora postojati barem jedno pitanje (ili otkažite za potpuno uklanjanje).";
    for (let i = 0; i < pitanja.length; i++) {
      const p = pitanja[i];
      if (!p.question.trim()) return `Pitanje ${i + 1}: tekst pitanja ne smije biti prazan.`;
      const opts = p.options.map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) return `Pitanje ${i + 1}: mora imati barem 2 opcije.`;
      const set = new Set(opts);
      if (set.size !== opts.length) return `Pitanje ${i + 1}: opcije moraju biti različite.`;
      if (!p.answer || !opts.includes(p.answer.trim())) return `Pitanje ${i + 1}: označite tačan odgovor.`;
    }
    return null;
  };

  const save = async () => {
    if (saving) return; // idempotency: spriječi duple PUT-ove
    const err = validate();
    if (err) { toast({ title: "Provjeri unos", description: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const cleaned = pitanja.map(p => ({
        question: p.question.trim(),
        options: p.options.map(o => o.trim()).filter(Boolean),
        answer: p.answer.trim(),
      }));
      await apiRequest("PUT", `/admin/ilmihal/${lekcijaId}`, { kvizPitanja: cleaned }, token);
      toast({ title: "Spremljeno", description: `Pitanja su ažurirana (${cleaned.length}).` });
      onSaved(cleaned);
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Pokušajte ponovo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kviz-edit-title"
      data-testid="modal-uredi-pitanja"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 sticky top-0 bg-white rounded-t-2xl">
          <h3 id="kviz-edit-title" className="font-extrabold text-foreground flex items-center gap-2">
            <Pencil className="w-5 h-5 text-teal-600" /> Uredi pitanja "Provjeri znanje"
          </h3>
          <button
            type="button"
            onClick={requestClose}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground"
            aria-label="Zatvori"
            data-testid="button-zatvori-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {pitanja.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nema pitanja. Kliknite "Dodaj pitanje" ispod.
            </div>
          )}
          {pitanja.map((p, idx) => (
            <div key={idx} className="border border-border/60 rounded-xl p-4 bg-muted/10" data-testid={`card-pitanje-${idx}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Pitanje {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeP(idx)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                  data-testid={`button-obrisi-pitanje-${idx}`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Obriši
                </button>
              </div>

              <label className="block text-xs font-bold text-muted-foreground mb-1">Tekst pitanja</label>
              <textarea
                value={p.question}
                onChange={e => updateP(idx, { question: e.target.value })}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 mb-3 resize-y"
                placeholder="npr. Šta znači riječ 'Allah'?"
                data-testid={`input-pitanje-${idx}`}
              />

              <label className="block text-xs font-bold text-muted-foreground mb-1">
                Opcije <span className="font-normal">(označite tačan odgovor)</span>
              </label>
              <div className="space-y-2">
                {p.options.map((opt, oIdx) => {
                  const trimmed = opt.trim();
                  const isAnswer = trimmed.length > 0 && p.answer === trimmed;
                  return (
                    <div key={oIdx} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${isAnswer ? "border-emerald-400 bg-emerald-50" : "border-border bg-white"}`}>
                      <input
                        type="radio"
                        name={`answer-${idx}`}
                        checked={isAnswer}
                        disabled={!trimmed}
                        onChange={() => setAnswer(idx, trimmed)}
                        className="w-4 h-4 accent-emerald-600 shrink-0"
                        aria-label={`Označi opciju ${oIdx + 1} kao tačan odgovor`}
                        data-testid={`radio-tacan-${idx}-${oIdx}`}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => updateOption(idx, oIdx, e.target.value)}
                        className="flex-1 bg-transparent border-0 px-2 py-1 text-sm focus:outline-none"
                        placeholder={`Opcija ${oIdx + 1}`}
                        data-testid={`input-opcija-${idx}-${oIdx}`}
                      />
                      {isAnswer && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                          Tačan
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {p.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => updateP(idx, { options: [...p.options, ""] })}
                  className="mt-2 text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  data-testid={`button-dodaj-opciju-${idx}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Dodaj opciju
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addP}
            className="w-full border-2 border-dashed border-teal-300 rounded-xl py-3 text-sm font-bold text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-colors flex items-center justify-center gap-2"
            data-testid="button-dodaj-pitanje"
          >
            <Plus className="w-4 h-4" /> Dodaj pitanje
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60 bg-muted/20 rounded-b-2xl sticky bottom-0">
          <Button variant="outline" onClick={requestClose} disabled={saving} className="rounded-xl" data-testid="button-otkazi-modal">
            Otkaži
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-xl flex items-center gap-2" data-testid="button-sacuvaj-pitanja">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sačuvaj
          </Button>
        </div>
      </div>
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
            <cfg.Icon className="w-4 h-4 shrink-0" />
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
              {section.type === "priprema" ? (
                <div
                  className="ilmihal-content"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
              ) : (
                <RjecnikContent html={section.html} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Hero image uploader (admin only)
// ──────────────────────────────────────────────────
function HeroImageUploader({ lekcija, token, onUpdated, showAlways }: {
  lekcija: Lekcija;
  token: string;
  onUpdated: (html: string) => void;
  showAlways?: boolean;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await apiRequest<{ url: string }>("POST", "/admin/upload", formData, token, true);
      if (!uploadRes?.url) throw new Error("Upload nije uspio");

      const parser = new DOMParser();
      const doc = parser.parseFromString(lekcija.contentHtml, "text/html");
      let heroBox = doc.querySelector(".hero-box");
      if (heroBox) {
        let heroImg = heroBox.querySelector("img");
        if (heroImg) {
          heroImg.setAttribute("src", uploadRes.url);
        } else {
          heroImg = doc.createElement("img");
          heroImg.setAttribute("src", uploadRes.url);
          heroBox.prepend(heroImg);
        }
      } else {
        const firstImg = doc.querySelector("img");
        if (firstImg) {
          firstImg.setAttribute("src", uploadRes.url);
        } else {
          heroBox = doc.createElement("div");
          heroBox.className = "hero-box";
          const img = doc.createElement("img");
          img.setAttribute("src", uploadRes.url);
          heroBox.appendChild(img);
          const container = doc.querySelector(".lesson-container") || doc.body;
          container.insertBefore(heroBox, container.firstChild);
        }
      }

      const newHtml = (doc.querySelector(".lesson-container") || doc.body).innerHTML;
      await apiRequest("PUT", `/admin/ilmihal/${lekcija.id}`, { contentHtml: newHtml }, token);
      toast({ title: "Slika ažurirana! ✓" });
      onUpdated(newHtml);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message || "Upload nije uspio", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = "";
        }}
      />
      {showAlways ? (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-2 text-gray-400 hover:text-teal-600 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <ImagePlus className="w-8 h-8" />
          )}
          <span className="text-sm font-bold">{uploading ? "Uploadujem..." : "Dodaj hero sliku"}</span>
        </button>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          {uploading ? "Uploadujem..." : "Zamijeni sliku"}
        </button>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────
// Prilozi (Materijali za muallime)
// ──────────────────────────────────────────────────
function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📑";
  if (mimeType.includes("text")) return "📃";
  return "📎";
}

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (/youtu\.be$/i.test(u.hostname)) {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (/youtube\.com$/i.test(u.hostname) || /^(www\.)?youtube\.com$/i.test(u.hostname)) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return `https://www.youtube.com/embed/${m[2]}`;
    }
    return null;
  } catch { return null; }
}

function PriloziSection({
  lekcija,
  token,
  isAdmin,
  onH5pCelebration,
}: {
  lekcija: Lekcija;
  token: string | null;
  isAdmin: boolean;
  onH5pCelebration?: (data: CelebrationData) => void;
}) {
  const [open, setOpen] = useState(true);
  const [attachments, setAttachments] = useState<Prilog[]>(lekcija.prilozi || []);
  // `lekcija.prilozi` može stići naknadno (npr. token postane dostupan tek
  // nakon AuthProvider hidratacije, pa se GET re-issuea). useState() inicijalna
  // vrijednost se NE primjenjuje na re-render — moramo ručno sync-ovati.
  // Pravila:
  //   - kad se lekcija PROMIJENI (drugi id), uvijek reset na server podatke;
  //   - na istoj lekciji prihvati server podatke samo ako lokalna lista još
  //     nije popunjena (čuva optimistic admin add/delete od overwrite-a).
  const lastLekcijaIdRef = useRef(lekcija.id);
  useEffect(() => {
    if (lastLekcijaIdRef.current !== lekcija.id) {
      lastLekcijaIdRef.current = lekcija.id;
      setAttachments(lekcija.prilozi || []);
      return;
    }
    setAttachments(prev => (prev.length > 0 ? prev : (lekcija.prilozi || [])));
  }, [lekcija.id, lekcija.prilozi]);
  const [uploading, setUploading] = useState(false);
  const [uploadingH5p, setUploadingH5p] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const h5pInputRef = useRef<HTMLInputElement>(null);
  const [h5pAttemptKey, setH5pAttemptKey] = useState<Record<number, number>>({});
  const [h5pSubmitting, setH5pSubmitting] = useState<Record<number, boolean>>({});
  // Po-prilogu: koliko pokušaja je učenik već imao (određuje multiplier
  // za sljedeći pokušaj — prikaz "možeš osvojiti do X hasenata").
  const [h5pAttempts, setH5pAttempts] = useState<Record<number, { nextAttemptNo: number; nextMultiplier: number }>>({});
  const { toast } = useToast();

  // Fetch attempts za sve H5P priloge na mount-u (i kad se attachments lista mijenja).
  useEffect(() => {
    if (!token) return;
    const h5ps = attachments.filter(a => a.kind === "h5p");
    if (h5ps.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<number, { nextAttemptNo: number; nextMultiplier: number }> = {};
      for (const a of h5ps) {
        try {
          const res = await apiRequest<{ nextAttemptNo: number; nextMultiplier: number }>(
            "GET", `/h5p/attempts/${a.id}`, undefined, token,
          );
          updates[a.id] = { nextAttemptNo: res.nextAttemptNo, nextMultiplier: res.nextMultiplier };
        } catch { /* ignore — admin/muallim ne dobija; ucenik dobija */ }
      }
      if (!cancelled) setH5pAttempts(prev => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [token, attachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await apiRequest<Prilog>("POST", `/admin/prilozi/${lekcija.id}`, fd, token, true);
      setAttachments(prev => [{ ...result, url: `/uploads/${(result as any).storedName || ""}` }, ...prev]);
      toast({ title: "Uspješno", description: `"${file.name}" uploadovan.` });
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleH5pUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploadingH5p(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await apiRequest<Prilog>("POST", `/admin/prilozi/${lekcija.id}/h5p`, fd, token, true);
      // Prefiks `/api/uploads/...` je univerzalan (vidi backend napomenu u content.ts).
      const url = `/api/uploads/${(result as any).storedName || ""}`;
      setAttachments(prev => [{ ...result, url }, ...prev]);
      toast({ title: "H5P uploadovan", description: `"${file.name}" je dodan.` });
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setUploadingH5p(false);
      if (h5pInputRef.current) h5pInputRef.current.value = "";
    }
  };

  const handleH5pCompleted = useCallback(async (priloziId: number, score: number, maxScore: number) => {
    if (!token) return;
    if (h5pSubmitting[priloziId]) return;
    setH5pSubmitting(prev => ({ ...prev, [priloziId]: true }));
    try {
      const res = await apiRequest<{
        attemptNo: number;
        score: number;
        maxScore: number;
        procenat: number;
        multiplier: number;
        hasanatGained: number;
        totalHasanat: number;
        previousHasanat: number;
      }>("POST", `/h5p/result`, { priloziId, score, maxScore }, token);
      if (res.hasanatGained > 0) {
        onH5pCelebration?.({
          isRepeat: false,
          hasanatGained: res.hasanatGained,
          totalHasanat: res.totalHasanat,
          previousHasanat: res.previousHasanat,
          streakDays: 0,
          streakIncreased: false,
        });
      } else {
        const reason = res.attemptNo >= 3
          ? `Ovo je tvoj ${res.attemptNo}. pokušaj — daljnji pokušaji ne donose hasanate.`
          : `Pokušaj ${res.attemptNo}: ${res.procenat}%`;
        toast({ title: "Vježba završena", description: reason });
      }
      // Refresh attempts za ovaj prilog (smanji prikazani max za sljedeći put).
      try {
        const fresh = await apiRequest<{ nextAttemptNo: number; nextMultiplier: number }>(
          "GET", `/h5p/attempts/${priloziId}`, undefined, token,
        );
        setH5pAttempts(prev => ({ ...prev, [priloziId]: { nextAttemptNo: fresh.nextAttemptNo, nextMultiplier: fresh.nextMultiplier } }));
      } catch {/* ignore */}
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setH5pSubmitting(prev => ({ ...prev, [priloziId]: false }));
    }
  }, [token, h5pSubmitting, onH5pCelebration, toast]);

  const handleAddUrl = async () => {
    if (!urlValue.trim() || !token) return;
    setSavingUrl(true);
    try {
      const result = await apiRequest<Prilog>("POST", `/admin/prilozi/${lekcija.id}/url`, {
        url: urlValue.trim(), label: urlLabel.trim() || undefined
      }, token);
      setAttachments(prev => [{ ...result, url: (result as any).externalUrl || urlValue.trim() }, ...prev]);
      toast({ title: "Link dodan", description: result.originalName });
      setUrlValue(""); setUrlLabel(""); setShowUrlForm(false);
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Obrisati "${name}"?`)) return;
    try {
      await apiRequest("DELETE", `/admin/prilozi/${id}`, undefined, token);
      setAttachments(prev => prev.filter(a => a.id !== id));
      toast({ title: "Obrisano", description: `"${name}" je obrisan.` });
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    }
  };

  const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";

  const downloadFile = async (attachment: Prilog, openInTab = false) => {
    try {
      const res = await fetch(`${apiBase}${attachment.url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Greška pri preuzimanju");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (openInTab) {
        window.open(blobUrl, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = attachment.originalName;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err: any) {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="mb-6 rounded-2xl border-2 border-blue-200 bg-blue-50/50 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-blue-100/50 transition-colors"
      >
        <Paperclip className="w-5 h-5 text-blue-600 flex-shrink-0" />
        <span className="font-bold text-blue-800 text-base flex-1">
          Materijali za nastavu
          {attachments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-blue-500">({attachments.length})</span>
          )}
        </span>
        <ChevronDown className={`w-5 h-5 text-blue-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {isAdmin && (
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.rtf"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <input
                    ref={h5pInputRef}
                    type="file"
                    accept=".h5p"
                    onChange={handleH5pUpload}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      variant="outline"
                      className="rounded-xl border-blue-300 text-blue-700 hover:bg-blue-100 font-bold"
                    >
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploadujem...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Dodaj fajl</>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowUrlForm(v => !v)}
                      variant="outline"
                      className="rounded-xl border-blue-300 text-blue-700 hover:bg-blue-100 font-bold"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> {showUrlForm ? "Odustani" : "Dodaj link"}
                    </Button>
                    <Button
                      onClick={() => h5pInputRef.current?.click()}
                      disabled={uploadingH5p}
                      variant="outline"
                      className="rounded-xl border-purple-300 text-purple-700 hover:bg-purple-100 font-bold"
                    >
                      {uploadingH5p ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploadujem H5P...</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> Dodaj H5P vježbu</>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-blue-400 mt-1">PDF, DOCX, XLSX, PPTX, TXT (max 20MB), YouTube/web link, ili .h5p arhiva (max 50MB)</p>
                  {showUrlForm && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200 flex flex-col gap-2">
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={urlValue}
                        onChange={e => setUrlValue(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Naziv (opciono, npr. 'Video o abdestu')"
                        value={urlLabel}
                        onChange={e => setUrlLabel(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <Button
                        onClick={handleAddUrl}
                        disabled={savingUrl || !urlValue.trim()}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold self-start"
                      >
                        {savingUrl ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Spašavam...</> : "Spasi link"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {attachments.length === 0 ? (
                <p className="text-blue-400 text-base italic">Nema uploadovanih materijala za ovu lekciju.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {attachments.map(a => {
                    const isUrl = a.kind === "url";
                    const isH5p = a.kind === "h5p";
                    const targetUrl = a.externalUrl || a.url;
                    const ytEmbed = isUrl ? getYoutubeEmbedUrl(targetUrl) : null;
                    // a.url backend već vraća kao apsolutnu putanju from origin (npr.
                    // "/uploads/h5p/12"). NE prefixaj sa apiBase ("/api") — statički
                    // sadržaj se servira iz "/uploads", ne "/api/uploads".
                    const h5pUrl = isH5p ? a.url : null;
                    const attemptKey = h5pAttemptKey[a.id] ?? 0;
                    // Attempt-aware nagrada: koliko hasanata je moguće osvojiti za
                    // sljedeći pokušaj na ovoj vježbi (uzima u obzir prošle pokušaje).
                    const att = isH5p ? h5pAttempts[a.id] : null;
                    const nextMult = att?.nextMultiplier ?? 1;
                    const maxNext = Math.round(50 * nextMult);
                    return (
                      <div key={a.id} className="flex flex-col gap-2 bg-white rounded-xl border border-blue-100 p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl flex-shrink-0">
                            {isH5p ? "🧩" : isUrl ? (ytEmbed ? "▶️" : "🔗") : getFileIcon(a.mimeType)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-base text-gray-800 truncate">{a.originalName}</p>
                            <p className="text-sm text-gray-400 truncate">
                              {isH5p ? "Interaktivna vježba (H5P)" : isUrl ? targetUrl : formatFileSize(a.fileSize)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isH5p ? (
                              <button
                                onClick={() => setH5pAttemptKey(prev => ({ ...prev, [a.id]: attemptKey + 1 }))}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors"
                                title="Pokušaj ponovo"
                              >
                                <Sparkles className="w-4 h-4" /> Ponovi
                              </button>
                            ) : isUrl ? (
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" /> Otvori
                              </a>
                            ) : (
                              <>
                                <button
                                  onClick={() => downloadFile(a, false)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                                >
                                  <FileDown className="w-4 h-4" /> Download
                                </button>
                                <button
                                  onClick={() => downloadFile(a, true)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" /> Open
                                </button>
                              </>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(a.id, a.originalName)}
                                className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Obriši"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {isH5p && h5pUrl && (
                          <div className="mt-2 rounded-lg overflow-hidden bg-white border border-purple-100">
                            {/* Attempt-aware header — pokazuje učeniku koliko hasanata
                                može osvojiti za sljedeći pokušaj (uzima u obzir prošlost). */}
                            <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                              <p className="text-sm font-semibold text-purple-700">
                                {maxNext > 0
                                  ? <>Vježba — možeš osvojiti do <span className="text-purple-900">{maxNext} hasenata</span> ({att?.nextAttemptNo ?? 1}. pokušaj)</>
                                  : <>Vježba — daljnji pokušaji ne donose hasanate (već {Math.max(0, (att?.nextAttemptNo ?? 1) - 1)} pokušaja)</>
                                }
                              </p>
                            </div>
                            <Suspense fallback={
                              <div className="flex items-center gap-2 text-blue-500 text-sm py-4 px-3">
                                <Loader2 className="w-4 h-4 animate-spin" /> Učitavam vježbu...
                              </div>
                            }>
                              <H5PPlayerLazy
                                h5pPath={h5pUrl}
                                contentKey={`${a.id}-${attemptKey}`}
                                onCompleted={(r) => handleH5pCompleted(a.id, r.score, r.maxScore)}
                              />
                            </Suspense>
                            <p className="px-3 py-2 text-xs text-purple-500 bg-purple-50/60">
                              Maks. 50 hasanata. 1. pokušaj: 100% nagrade, 2. pokušaj: 50%, 3+: bez nagrade.
                            </p>
                          </div>
                        )}
                        {ytEmbed && (
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                            <iframe
                              src={ytEmbed}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title={a.originalName}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
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
// Main page
// ──────────────────────────────────────────────────
export default function IlmihalLekcijaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [lekcija, setLekcija] = useState<Lekcija | null>(null);
  const [parsed, setParsed] = useState<{ heroImage: string | null; sections: AccordionSection[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [lekcijeStrip, setLekcijeStrip] = useState<LekcijaNav[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [showEditor, setShowEditor] = useState(false);
  const [editingNaslov, setEditingNaslov] = useState(false);
  const [naslovDraft, setNaslovDraft] = useState("");
  const [savingNaslov, setSavingNaslov] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const displayNivo = (nivo: number) => nivo;

  const handleSaveNaslov = async () => {
    if (!lekcija || !token) return;
    const novi = naslovDraft.trim();
    if (!novi) {
      toast({ title: "Naziv ne smije biti prazan", variant: "destructive" });
      return;
    }
    if (novi === lekcija.naslov) {
      setEditingNaslov(false);
      return;
    }
    setSavingNaslov(true);
    try {
      await apiRequest("PUT", `/admin/ilmihal/${lekcija.id}`, { naslov: novi }, token);
      setLekcija(prev => prev ? { ...prev, naslov: novi } : prev);
      setEditingNaslov(false);
      toast({ title: "Naziv ažuriran", description: `Lekcija sada nosi naziv: ${novi}` });
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Ne mogu spasiti naziv.", variant: "destructive" });
    } finally {
      setSavingNaslov(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    // Token je obavezan da bi backend uključio `prilozi` u response
    // (učenici vide H5P/URL prilozi, muallim/admin sve). Bez tokena
    // dobijemo lekciju ali bez priloga, što razbije H5P prikaz.
    apiRequest<Lekcija>("GET", `/content/ilmihal/${slug}`, undefined, token)
      .then(data => {
        setLekcija(data);
        setParsed(parseSections(data.contentHtml));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [slug, token]);

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

  // Učitaj listu završenih lekcija da pokažemo ✓ na strip-u i sinhronizujemo "completed" state
  useEffect(() => {
    if (!user) {
      setCompletedIds(new Set());
      return;
    }
    apiRequest<{ completedLessons?: number[] }>(
      "GET",
      `/progress?studentId=${encodeURIComponent(String(user.id))}`,
      undefined,
      token || undefined,
    )
      .then(p => {
        const ids = new Set(p.completedLessons ?? []);
        setCompletedIds(ids);
        // Sinhronizuj "completed" sa stvarnim stanjem za trenutnu lekciju.
        // Korisno kad korisnik koristi strip i prelazi između lekcija — bez ovoga
        // bi `completed=true` ostao "ljepak" iz prethodne završene lekcije.
        if (lekcija) setCompleted(ids.has(lekcija.id));
      })
      .catch(() => setCompletedIds(new Set()));
  }, [user, token, lekcija]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fireConfetti = () => {
    if (prefersReducedMotion()) return; // a11y: poštujemo OS/browser motion settings
    const duration = 1500;
    const end = Date.now() + duration;
    const colors = ["#10b981", "#14b8a6", "#fbbf24", "#f59e0b", "#a78bfa"];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 55, startVelocity: 50, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 55, startVelocity: 50, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors });
  };

  const markComplete = async () => {
    if (!lekcija || !user) return;
    try {
      const resp = await apiRequest<{ progressDelta?: { newCompletion: boolean; streakDays: number; totalHasanat: number; previousHasanat?: number; previousStreakDays?: number; hasanatGained?: number; streakIncreased?: boolean; novelyEarnedBadges?: string[]; newBadges?: { id: string; naziv: string; opis: string; ikona: string }[] } }>(
        "POST", "/content/napredak", {
          contentType: "ilmihal",
          contentId: lekcija.id,
          zavrsen: true,
          bodovi: 10,
        }, token
      );

      // Task #6: paralelno upiši i u studentProgress tabelu (za "Moj put" tab)
      try {
        await apiRequest(
          "POST",
          "/progress/lesson",
          {
            studentId: String(user.id),
            lessonId: lekcija.id,
            score: 10,
            maxScore: 10,
            timeSpentSeconds: 0,
          },
          token,
        );
      } catch {}

      const wasNew = !completed && resp?.progressDelta?.newCompletion === true;
      setCompleted(true);
      setCompletedIds(prev => {
        if (prev.has(lekcija.id)) return prev;
        const next = new Set(prev);
        next.add(lekcija.id);
        return next;
      });

      const totalHasanat = resp.progressDelta?.totalHasanat ?? 0;
      const previousHasanat = resp.progressDelta?.previousHasanat ?? Math.max(0, totalHasanat - (resp.progressDelta?.hasanatGained ?? 0));
      const streakDays = resp.progressDelta?.streakDays ?? 0;
      const streakIncreased = resp.progressDelta?.streakIncreased ?? false;
      const hasanatGained = resp.progressDelta?.hasanatGained ?? (wasNew ? 15 : 0);

      if (wasNew) {
        fireConfetti();
        setCelebration({
          isRepeat: false,
          hasanatGained,
          totalHasanat,
          previousHasanat,
          streakDays,
          streakIncreased,
        });

        const newBadges = resp.progressDelta?.newBadges || [];
        // Toast za svaki novi bedž (sa odgodom da se ne overlapuju)
        if (newBadges.length > 0) {
          setTimeout(() => {
            const first = newBadges[0];
            toast({
              title: `🎉 Osvojio si bedž!${newBadges.length > 1 ? ` (+${newBadges.length - 1})` : ""}`,
              description: `${first.ikona} ${first.naziv} — ${first.opis}`,
            });
            // Drugi konfeti za bedž — preskoči ako korisnik preferira reduced motion
            if (!prefersReducedMotion()) {
              confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 }, colors: ["#fbbf24", "#f59e0b", "#fde047"] });
            }
          }, 1000);
        }
      } else {
        // Već završena ranije — pokaži ohrabrujuću poruku
        setCelebration({
          isRepeat: true,
          hasanatGained: 0,
          totalHasanat,
          previousHasanat: totalHasanat,
          streakDays,
          streakIncreased: false,
        });
      }
    } catch {}
  };

  const NIVO_LABELS: Record<number, string> = { 1: "Nivo 1", 2: "Nivo 2", 3: "Nivo 3" };
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
    <AnimatePresence>
      {celebration && (
        <CelebrationModal
          data={celebration}
          onClose={() => setCelebration(null)}
        />
      )}
    </AnimatePresence>
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
              <button onClick={async () => {
                if (!lekcija || !token) return;
                const isLocked = lekcija.locked;
                const url = `/admin/ilmihal/${lekcija.id}/${isLocked ? "unlock" : "lock"}`;
                if (isLocked && !confirm("Otključati lekciju? Nakon otključavanja je možeš uređivati ili je auto-skripte mogu prepisati.")) return;
                try {
                  await apiRequest("POST", url, {}, token);
                  setLekcija(prev => prev ? { ...prev, locked: !isLocked } : prev);
                  toast({ title: isLocked ? "Otključano" : "🔒 Zaključano", description: isLocked ? "Lekcija je otključana." : "Sadržaj je zaštićen od izmjena." });
                } catch {
                  toast({ title: "Greška", description: "Ne mogu promijeniti status zaključavanja.", variant: "destructive" });
                }
              }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${lekcija?.locked ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                title={lekcija?.locked ? (lekcija.lockedNote || "Lekcija je zaključana") : "Zaključaj lekciju (zaštita od auto-skripti)"}>
                {lekcija?.locked ? <><Lock className="w-3.5 h-3.5" /> Zaključano</> : <><Unlock className="w-3.5 h-3.5" /> Zaključaj</>}
              </button>
              <button onClick={() => { setNaslovDraft(lekcija?.naslov || ""); setEditingNaslov(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors">
                <PenLine className="w-3.5 h-3.5" /> Uredi naziv
              </button>
              <button onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
                <FilePen className="w-3.5 h-3.5" /> Uredi sadržaj
              </button>
            </>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-block text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {NIVO_LABELS[lekcija.nivo] || `Nivo ${lekcija.nivo}`}
              </span>
              {completedIds.has(lekcija.id) && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"
                  data-testid="badge-lekcija-zavrsena"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                  Završeno
                </span>
              )}
              {!completedIds.has(lekcija.id) && (() => {
                const firstUndone = lekcijeStrip.find(l => !completedIds.has(l.id));
                return firstUndone?.id === lekcija.id ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border-2 border-amber-300"
                    data-testid="badge-lekcija-sljedeca"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Sljedeća lekcija
                  </span>
                ) : null;
              })()}
            </div>
            {editingNaslov && user?.role === "admin" ? (
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input
                  autoFocus
                  type="text"
                  value={naslovDraft}
                  onChange={(e) => setNaslovDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleSaveNaslov(); }
                    if (e.key === "Escape") { e.preventDefault(); setEditingNaslov(false); }
                  }}
                  disabled={savingNaslov}
                  className="flex-1 text-2xl font-extrabold text-foreground leading-tight bg-white border-2 border-sky-300 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-1.5 min-w-0"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNaslov}
                    disabled={savingNaslov}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50">
                    {savingNaslov ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Spasi
                  </button>
                  <button
                    onClick={() => setEditingNaslov(false)}
                    disabled={savingNaslov}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50">
                    <X className="w-3.5 h-3.5" /> Otkaži
                  </button>
                </div>
              </div>
            ) : (
              <h1 className="text-2xl font-extrabold text-foreground leading-tight">{lekcija.naslov}</h1>
            )}
            {(() => {
              const nextUndone = lekcijeStrip.find(l => !completedIds.has(l.id) && l.id !== lekcija.id);
              if (!nextUndone) return null;
              return (
                <button
                  onClick={() => setLocation(`/ilmihal/${nextUndone.slug}`)}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 hover:text-amber-800 hover:underline"
                  data-testid="link-sljedeca-lekcija"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-muted-foreground font-semibold">Sljedeća:</span>
                  <span className="truncate max-w-[16rem] sm:max-w-xs">{nextUndone.naslov}</span>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Print button */}
        <div className="flex justify-end mb-2 print:hidden">
          <button
            onClick={() => {
              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              const visibleForPrint = parsed.sections.filter(s => s.type !== "quiz_box" && s.type !== "priprema");
              const sections = visibleForPrint.map(s => `<h2 style="margin-top:24px;color:#0d6e6e;border-bottom:2px solid #0d6e6e;padding-bottom:4px;">${s.title}</h2><div>${s.html}</div>`).join("");
              printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${lekcija.naslov} — Mekteb</title><style>
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
                body{font-family:'Nunito',sans-serif;max-width:800px;margin:0 auto;padding:40px 30px;color:#222;line-height:1.7;font-size:15px;}
                h1{color:#0d6e6e;font-size:22px;margin-bottom:8px;}
                h2{font-size:18px;}
                h3{font-size:16px;color:#333;}
                h4{font-size:15px;color:#555;}
                img{max-width:100%;height:auto;border-radius:12px;margin:12px 0;}
                .hero-print{text-align:center;margin-bottom:20px;}
                .hero-print img{max-height:300px;object-fit:cover;width:100%;}
                .nivo-badge{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;color:#0d6e6e;background:#e6f7f7;padding:3px 12px;border-radius:20px;border:1px solid #b2e0e0;margin-bottom:8px;}
                .footer{margin-top:40px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;}
                p{margin:6px 0;}
                strong{color:#333;}
                .arabic-card{background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px 16px;border-radius:8px;margin:10px 0;font-size:18px;text-align:center;direction:rtl;}
                .info-box{background:#fffde7;border-left:4px solid #f9a825;padding:12px 16px;border-radius:8px;margin:10px 0;}
                @media print{body{padding:20px;}}
              </style></head><body>
                <div class="nivo-badge">Nivo ${lekcija.nivo}</div>
                <h1>${lekcija.naslov}</h1>
                ${parsed.heroImage ? '<div class="hero-print"><img src="' + (parsed.heroImage.startsWith("http") ? parsed.heroImage : "https://mekteb.net" + parsed.heroImage) + '" /></div>' : ""}
                ${sections}
                <div class="footer">mekteb.net — Islamska edukativna platforma</div>
              </body></html>`);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" /> Printaj lekciju
          </button>
        </div>

        {/* Hero image */}
        {parsed.heroImage ? (
          <div
            className="relative rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-[rgb(36,143,146)] group"
            data-hero-container
          >
            <img
              src={parsed.heroImage}
              alt={lekcija.naslov}
              className="w-full h-auto aspect-[3/2] object-cover"
              onError={e => {
                const img = e.target as HTMLImageElement;
                const stage = img.dataset.fallback;
                if (!stage && parsed.heroImage) {
                  // Step 1: try local /images/<filename> (slike koje sam kopirao iz attached_assets)
                  img.dataset.fallback = "local";
                  const fname = parsed.heroImage.split("/").pop() || "";
                  img.src = `${import.meta.env.BASE_URL}images/${fname}`;
                } else if (stage === "local" && parsed.heroImage) {
                  // Step 2: try mekteb.net (možda nešto i dalje ima)
                  img.dataset.fallback = "mekteb";
                  const cleanPath = parsed.heroImage.replace(/^(\.\.\/)+/, "/");
                  img.src = `https://mekteb.net${cleanPath}`;
                } else if (stage !== "placeholder") {
                  // Step 3: branded placeholder
                  img.dataset.fallback = "placeholder";
                  img.src = `${import.meta.env.BASE_URL}images/placeholder-hero.svg`;
                }
              }}
            />
            {user?.role === "admin" && token && (
              <HeroImageUploader
                lekcija={lekcija}
                token={token}
                onUpdated={(newHtml) => {
                  setLekcija(prev => prev ? { ...prev, contentHtml: newHtml } : prev);
                  setParsed(parseSections(newHtml));
                }}
              />
            )}
          </div>
        ) : user?.role === "admin" && token ? (
          <div className="relative rounded-2xl overflow-hidden mb-5 shadow-sm border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center aspect-[3/2]">
            <HeroImageUploader
              lekcija={lekcija}
              token={token}
              showAlways
              onUpdated={(newHtml) => {
                setLekcija(prev => prev ? { ...prev, contentHtml: newHtml } : prev);
                setParsed(parseSections(newHtml));
              }}
            />
          </div>
        ) : null}

        {/* Lesson navigation strip */}
        {lekcijeStrip.length > 1 && slug && (
          <LekcijeStrip
            lekcije={lekcijeStrip}
            currentSlug={slug}
            completedIds={completedIds}
            onNavigate={s => setLocation(`/ilmihal/${s}`)}
          />
        )}

        {/* Accordion sections — ordered: story → ilmihal → Provjeri znanje → pitanja → zadatak → other */}
        {parsed.sections.length > 0 ? (
          <div className="flex flex-col gap-3 mb-6">
            {(() => {
              const kvizPitanja = lekcija.kvizPitanja && lekcija.kvizPitanja.length > 0 ? lekcija.kvizPitanja : null;
              const isMuallim = user?.role === "admin" || user?.role === "muallim";
              const isAdmin = user?.role === "admin";
              const onKvizSaved = (novaPitanja: LekcijaKvizPitanje[]) => {
                setLekcija(prev => prev ? { ...prev, kvizPitanja: novaPitanja } : prev);
              };
              const visibleSections = parsed.sections
                .filter(s => s.type !== "quiz_box" && (s.type !== "priprema" || isMuallim))
                .slice()
                .sort((a, b) => (a.type === "priprema" ? 1 : 0) - (b.type === "priprema" ? 1 : 0));

              const renderKvizOrCta = () => {
                if (kvizPitanja) {
                  return (
                    <LekcijaKvizBox
                      key="lekcija-kviz"
                      pitanja={kvizPitanja}
                      lekcijaId={lekcija.id}
                      isAdmin={isAdmin}
                      token={token}
                      onSaved={onKvizSaved}
                    />
                  );
                }
                if (isAdmin && token) {
                  return (
                    <button
                      key="lekcija-kviz-cta"
                      type="button"
                      onClick={() => {
                        // Inicijalno dodajemo prazno pitanje kao stub; modal se otvara klikom Uredi
                        setLekcija(prev => prev ? { ...prev, kvizPitanja: [{ question: "", options: ["", "", "", ""], answer: "" }] } : prev);
                      }}
                      className="w-full ring-2 ring-inset ring-teal-200 bg-teal-50 hover:bg-teal-100 rounded-2xl px-5 py-4 flex items-center justify-center gap-2 text-sm font-bold text-teal-800 transition-colors"
                      data-testid="button-dodaj-kviz"
                    >
                      <Plus className="w-4 h-4" /> Dodaj kviz "Provjeri znanje"
                    </button>
                  );
                }
                return null;
              };

              const items: React.ReactNode[] = [];
              let kvizInserted = false;
              for (const section of visibleSections) {
                items.push(
                  <SectionAccordion key={section.id} section={section} slug={slug!} nivo={lekcija.nivo} />
                );
                if (!kvizInserted && section.type === "ilmihal") {
                  const node = renderKvizOrCta();
                  if (node) { items.push(node); kvizInserted = true; }
                }
              }
              if (!kvizInserted) {
                const node = renderKvizOrCta();
                if (node) items.push(node);
              }
              return items;
            })()}
          </div>
        ) : (
          /* Fallback: if no sections parsed, render raw HTML */
          <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6 mb-6">
            <RjecnikContent html={lekcija.contentHtml} />
          </div>
        )}

        {/* Prilozi / Materijali — backend već filtrira: učenici vide samo H5P
            i URL prilozi (ne fajlove); muallim i admin vide sve. */}
        {user && (
          <PriloziSection
            lekcija={lekcija}
            token={token}
            isAdmin={user.role === "admin"}
            onH5pCelebration={setCelebration}
          />
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
