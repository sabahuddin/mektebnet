import React, { useState, useEffect, useRef, useCallback, lazy, memo, Suspense } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { computeUnlockedCellCount } from "@/lib/lekcija-unlock";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { RjecnikContent } from "@/components/rjecnik-content";
import {
  ArrowLeft, CheckCircle2, BookOpen, BookMarked,
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare, PenLine,
  HelpCircle, Sparkles, Trophy, FilePen, Save, X, Loader2, Code,
  ImagePlus, Camera, Printer, FileDown, FileText, ExternalLink, Trash2, Upload, Paperclip, Lock, Unlock, Plus, Pencil, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Maskota } from "@/components/maskota";
import { PcelaRating } from "@/components/PcelaRating";
import { CelebrationModal, type CelebrationData } from "@/components/celebration-modal";
import confetti from "canvas-confetti";
const WysiwygEditor = lazy(() => import("@/components/wysiwyg-editor").then(m => ({ default: m.WysiwygEditor })));
const H5PPlayerLazy = lazy(() => import("@/components/h5p-player").then(m => ({ default: m.H5PPlayer })));

// Minimalni oblik /mapa/nivo/:nivo odgovora — samo polja potrebna za gate
// otključavanja lekcije (ista logika kao mapa, vidi @/lib/lekcija-unlock).
interface MapaUnlockData {
  lekcije: { id: number; redoslijed: number }[];
  medaljoni: { id: number; posAfterRedoslijed: number; imaKviz?: boolean; isGating?: boolean }[];
  zavrsene: number[];
  osvojeniMedaljoni: number[];
}

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
  kind?: "file" | "url" | "h5p" | "embed";
  externalUrl?: string | null;
  h5pPath?: string | null;
  approved?: boolean;
  /** Kapi meda koje učenik dobija klikom "Završio sam" — samo embed (0/3/5/10). */
  hasanatReward?: number;
}

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed?: number;
  contentHtml: string;
  audioSrc?: string;
  predmet?: string | null;
  kvizPitanja?: LekcijaKvizPitanje[] | null;
  prilozi?: Prilog[];
  locked?: boolean;
  lockedNote?: string | null;
  lockedAt?: string | null;
  userProgress?: {
    timeSpentSeconds: number;
    zavrsen: boolean;
    /** ISO timestamp kad je učenik tačno odgovorio na sva pitanja iz mini-kviza
     *  "Provjeri znanje". Null/undefined ako još nije položio. Koristi se kao
     *  4. uslov gate-a za "Označi kao završeno". */
    quizPassedAt?: string | null;
  };
}

// Minimum aktivnog vremena (sekundi) koje učenik mora provesti čitajući
// lekciju prije nego se "Označi kao završeno" otključa. Drži paralelno s
// `MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION` u backendu.
const MIN_ACTIVE_SECONDS = 300;
// Uvodne lekcije ("uvodna-rijec*") su kratke i nemaju kviz — za njih je
// 5 minuta čitanja prepreka koja onemogućava završavanje. Snižavamo na 30s
// SAMO za te slugove. Drži paralelno s `INTRO_MIN_ACTIVE_SECONDS_FOR_ILMIHAL_COMPLETION`
// u backend `content.ts`.
const INTRO_MIN_ACTIVE_SECONDS = 30;
function isIntroSlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.startsWith("uvodna-rijec");
}
// Koliko često (sekundi) šalje se heartbeat na server. 10s je dobar balans:
// dovoljno često da `delta = NOW() - last_hb` bude < 15s cap-a (ne gubimo
// vrijeme), a ne tako često da generiše hrpu HTTP poziva. Heartbeat je sada
// JEDINI način da `time_spent_seconds` raste server-side za ilmihal — POST
// /napredak ignoriše klijentski timeSpentSeconds (anti-cheat fix).
const HEARTBEAT_INTERVAL_S = 10;
// Koliko mora biti skrolovano da se completion otključa (% ukupne visine
// dokumenta). 85% omogućava bottom-padding/footer da ne blokira.
const MIN_SCROLL_PERCENT = 0.85;

// Formatira sekunde u kratku BS oznaku (npr. "5m 23s", "47s", "1h 12m").
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
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
  const { t } = useLanguage();
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
                title={`${l.naslov}${isDone ? " ✓" : isNext ? ` (${t("sljedeća")})` : ""}`}
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
  const { t } = useLanguage();
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
      toast({ title: t("Sačuvano! ✓"), description: t("Sadržaj lekcije uspješno ažuriran") });
      setIsDirty(false);
      onSaved(saveHtml);
      onClose();
    } catch {
      toast({ title: t("Greška pri čuvanju"), description: t("Pokušaj ponovo"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm(t("Ima nesačuvanih promjena. Zatvori bez čuvanja?"))) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex md:hidden flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <FilePen className="w-12 h-12 text-amber-500" />
        <h3 className="font-extrabold text-lg text-foreground">{t("Editor dostupan samo na desktopu")}</h3>
        <p className="text-muted-foreground text-sm">{t("Otvori stranicu na računaru da bi mogao/la uređivati sadržaj lekcije.")}</p>
        <Button variant="outline" onClick={onClose} className="rounded-xl">{t("Zatvori")}</Button>
      </div>

      <div className="hidden md:flex flex-col h-full">
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FilePen className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-foreground truncate">{t("Uredi sadržaj:")} {lekcija.naslov}</h3>
              <p className="text-xs text-muted-foreground">
                {mode === "visual" ? t("Vizuelni editor — klikni na tekst i uredi kao u Wordu") : t("HTML kod — za napredne izmjene")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMode(mode === "visual" ? "html" : "visual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                mode === "html" ? "bg-zinc-800 text-green-400" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              title={t("Prebaci između vizuelnog i HTML editora")}
            >
              <Code className="w-3.5 h-3.5" />
              {mode === "html" ? "HTML" : t("Kod")}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={t("Zatvori")}
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
                  {t("Vizuelni pregled")}
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
              {t("Nesačuvano")}
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="rounded-xl px-6 font-bold flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t("Čuvam...") : t("Sačuvaj")}
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
  const { t } = useLanguage();
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
            const shuffled = [...sva]
              .sort(() => Math.random() - 0.5)
              .slice(0, 5)
              .map(p => ({ ...p, options: [...p.options].sort(() => Math.random() - 0.5) }));
            setPitanja(shuffled);
          }
        }
      }).catch(() => {});
  }, [nivo]);

  if (pitanja.length === 0) return (
    <p className="text-sm text-teal-700 font-medium text-center py-4">
      {t("Kviz za ovu lekciju uskoro...")}
    </p>
  );

  if (done) return (
    <div className="text-center py-6">
      <Trophy className="w-10 h-10 mx-auto mb-3 text-amber-500" />
      <p className="text-lg font-extrabold text-foreground">{score}/{pitanja.length} {t("tačnih!")}</p>
      <p className="text-sm text-muted-foreground mt-1">{t("Ovo je provjera za sebe — ne broji u bodove")}</p>
      <Button size="sm" variant="outline" onClick={() => {
        setCurrent(0); setScore(0); setDone(false); setSelected(null);
        // Re-shuffle pitanja i opcije da redoslijed nije isti kao u prošlom pokušaju.
        setPitanja(prev => [...prev]
          .sort(() => Math.random() - 0.5)
          .map(p => ({ ...p, options: [...p.options].sort(() => Math.random() - 0.5) }))
        );
      }}
        className="mt-4 rounded-xl">{t("Ponovi")}</Button>
    </div>
  );

  const q = pitanja[current];
  const isCorrect = selected !== null && selected === q.answer;
  const isWrong = selected !== null && selected !== q.answer;

  return (
    <div>
      <p className="text-xs text-muted-foreground font-bold mb-3">{t("Pitanje")} {current + 1}/{pitanja.length}</p>
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
            {current + 1 >= pitanja.length ? t("Završi") : t("Sljedeće →")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────
// Vezani kvizovi za ovu lekciju (kvizovi.lekcija_id = lekcijaId)
// Sakriva se ako nema vezanih kvizova (graceful degradation).
// ──────────────────────────────────────────────────
function VezaniKvizovi({ lekcijaId }: { lekcijaId: number }) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [kvizovi, setKvizovi] = useState<Array<{
    id: number;
    slug: string;
    naslov: string;
    opis?: string | null;
    pitanjaCount?: number;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<any[]>("GET", `/content/kvizovi?lekcijaId=${lekcijaId}`)
      .then(data => {
        if (cancelled) return;
        setKvizovi(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setKvizovi([]); });
    return () => { cancelled = true; };
  }, [lekcijaId]);

  if (!kvizovi || kvizovi.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-5 shadow-sm" data-testid="vezani-kvizovi">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="w-5 h-5 text-teal-700" />
        <h3 className="text-base font-extrabold text-teal-900">{t("Kvizovi za ovu lekciju")}</h3>
      </div>
      <div className="flex flex-col gap-2">
        {kvizovi.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setLocation(`/kvizovi/${k.slug}`)}
            className="w-full text-left bg-white hover:bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors"
            data-testid={`vezani-kviz-${k.slug}`}
          >
            <div className="min-w-0">
              <p className="font-bold text-foreground truncate">{k.naslov}</p>
              {k.opis ? (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{k.opis}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {typeof k.pitanjaCount === "number" && k.pitanjaCount > 0 && (
                <span className="text-xs font-bold text-teal-800 bg-teal-100 rounded-full px-2 py-0.5">
                  {k.pitanjaCount} {k.pitanjaCount === 1 ? t("pitanje") : t("pitanja")}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-teal-600" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// AI-generated lekcija kviz accordion
// ──────────────────────────────────────────────────
function LekcijaKvizBox({ pitanja, lekcijaId, isAdmin, token, onSaved, onPassed, alreadyPassed, defaultOpen }: {
  pitanja: LekcijaKvizPitanje[];
  lekcijaId?: number;
  isAdmin?: boolean;
  token?: string | null;
  onSaved?: (novaPitanja: LekcijaKvizPitanje[]) => void;
  /** Pozove se JEDNOM kad učenik tačno odgovori na SVA pitanja u jednom prolazu.
   *  Koristi se za 4. uslov gate-a "Označi kao završeno". */
  onPassed?: () => void;
  /** Da li je učenik već ranije položio kviz (server kaže `quizPassedAt != null`).
   *  Koristi za prikaz "već položeno ✓" u headeru — ne mijenja runtime ponašanje. */
  alreadyPassed?: boolean;
  /** Auto-otvori kviz kad se montira — npr. da gate pill može uputiti učenika
   *  na vidljiv kviz. */
  defaultOpen?: boolean;
}) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(!!defaultOpen);
  const [editOpen, setEditOpen] = useState(false);
  // Brojač koji se inkrementira na "Ponovi" — koristi se kao dependency u
  // useMemo da re-shuffle-ujemo pitanja i opcije pri svakom novom pokušaju.
  const [shuffleSeed, setShuffleSeed] = useState(0);
  // Lokalni guard da onPassed pozovemo TAČNO jednom (i bez obzira što
  // useEffect može opaliti više puta na re-renderima).
  const passedFiredRef = useRef(false);

  const reset = () => {
    setCurrent(0); setSelected(null); setScore(0); setDone(false);
    setShuffleSeed(s => s + 1);
  };

  // Hardening: izbaci malformed legacy zapise (nema teksta ili nedovoljno opcija).
  // useMemo je nužan da se opcije ne re-shuffle-uju na svaki render (inače bi
  // se redoslijed mijenjao usred odgovaranja). Re-shuffle dolazi samo kad se
  // promijeni `pitanja` prop ili kad učenik klikne "Ponovi" (shuffleSeed++).
  const safePitanja: LekcijaKvizPitanje[] = React.useMemo(() => (pitanja || [])
    .map(p => ({
      question: typeof p?.question === "string" ? p.question : "",
      options: Array.isArray(p?.options) ? p.options.filter(o => typeof o === "string" && o.trim().length > 0) : [],
      answer: typeof p?.answer === "string" ? p.answer : "",
    }))
    .filter(p => p.question.trim().length > 0 && p.options.length >= 2)
    .map(p => ({ ...p, options: [...p.options].sort(() => Math.random() - 0.5) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pitanja, shuffleSeed]);

  const safeIdx = Math.min(current, Math.max(0, safePitanja.length - 1));
  const q = safePitanja[safeIdx];
  const canEdit = !!(isAdmin && token && lekcijaId);
  const isPerfect = done && safePitanja.length > 0 && score === safePitanja.length;

  // Fire onPassed TAČNO jednom kad učenik završi kviz sa svim tačnim odgovorima.
  // Roditelj koristi ovo da: (a) POST-uje quizPassed u backend, (b) lokalno
  // otključa 4. uslov gate-a za "Označi kao završeno". Koristimo ref-guard
  // jer reset() kasnije postavlja done=false pa bi useEffect mogao opaliti
  // ponovo na sljedeći prolaz; želimo samo prvi success da bude trigger.
  useEffect(() => {
    if (isPerfect && !passedFiredRef.current) {
      passedFiredRef.current = true;
      onPassed?.();
    }
  }, [isPerfect, onPassed]);

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
              {t("Provjeri znanje")}
            </span>
            {/* Indicator da je učenik već uspješno riješio kviz — gate je
                zadovoljen i može mirno označiti lekciju kao završenu. */}
            {(alreadyPassed || isPerfect) && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                data-testid="badge-kviz-polozen"
              >
                <CheckCircle2 className="w-3 h-3" strokeWidth={3} /> {t("Položen")}
              </span>
            )}
            {canEdit && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-200/80 text-teal-900">
                {safePitanja.length} {safePitanja.length === 1 ? t("pitanje") : t("pitanja")}
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
            title={t("Uredi pitanja")}
            data-testid="button-uredi-pitanja"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Uredi")}</span>
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
                  {t("Nema pitanja. Klikni \"Uredi\" pa \"Dodaj pitanje\" da kreiraš.")}
                </div>
              ) : done ? (
                <div className="text-center py-4" data-testid="kviz-done-summary">
                  <Trophy className={`w-10 h-10 mx-auto mb-3 ${isPerfect ? "text-emerald-500" : "text-amber-500"}`} />
                  <p className="text-lg font-extrabold text-foreground">{score}/{safePitanja.length} {t("tačnih!")}</p>
                  {isPerfect ? (
                    <p className="text-sm font-bold text-emerald-700 mt-1">
                      {t("✓ Sva pitanja tačna — sad možeš označiti lekciju kao završenu.")}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700 mt-1">
                      {t("Pokušaj ponovo — sva pitanja moraju biti tačna da otključaš \"Označi kao završeno\".")}
                    </p>
                  )}
                  <Button size="sm" variant="outline" onClick={reset} className="mt-4 rounded-xl" data-testid="button-ponovi-kviz">{t("Ponovi kviz")}</Button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-3">{t("Pitanje")} {safeIdx + 1}/{safePitanja.length}</p>
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
                        {safeIdx + 1 >= safePitanja.length ? t("Završi ✓") : t("Sljedeće →")}
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
  const { t } = useLanguage();
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
    if (isDirty() && !confirm(t("Imate nesačuvane izmjene. Zatvoriti i izgubiti ih?"))) return;
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
    if (!confirm(t("Obrisati ovo pitanje?"))) return;
    setPitanja(prev => prev.filter((_, i) => i !== idx));
  };

  const addP = () => {
    setPitanja(prev => [...prev, { question: "", options: ["", "", "", ""], answer: "" }]);
  };

  const validate = (): string | null => {
    if (pitanja.length === 0) return t("Mora postojati barem jedno pitanje (ili otkažite za potpuno uklanjanje).");
    for (let i = 0; i < pitanja.length; i++) {
      const p = pitanja[i];
      if (!p.question.trim()) return t("Pitanje {n}: tekst pitanja ne smije biti prazan.", { n: String(i + 1) });
      const opts = p.options.map(o => o.trim()).filter(Boolean);
      if (opts.length < 2) return t("Pitanje {n}: mora imati barem 2 opcije.", { n: String(i + 1) });
      const set = new Set(opts);
      if (set.size !== opts.length) return t("Pitanje {n}: opcije moraju biti različite.", { n: String(i + 1) });
      if (!p.answer || !opts.includes(p.answer.trim())) return t("Pitanje {n}: označite tačan odgovor.", { n: String(i + 1) });
    }
    return null;
  };

  const save = async () => {
    if (saving) return; // idempotency: spriječi duple PUT-ove
    const err = validate();
    if (err) { toast({ title: t("Provjeri unos"), description: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const cleaned = pitanja.map(p => ({
        question: p.question.trim(),
        options: p.options.map(o => o.trim()).filter(Boolean),
        answer: p.answer.trim(),
      }));
      await apiRequest("PUT", `/admin/ilmihal/${lekcijaId}`, { kvizPitanja: cleaned }, token);
      toast({ title: t("Spremljeno"), description: t("Pitanja su ažurirana ({n}).", { n: String(cleaned.length) }) });
      onSaved(cleaned);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Pokušajte ponovo"), variant: "destructive" });
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
            <Pencil className="w-5 h-5 text-teal-600" /> {t("Uredi pitanja \"Provjeri znanje\"")}
          </h3>
          <button
            type="button"
            onClick={requestClose}
            className="p-2 rounded-lg hover:bg-muted/60 text-muted-foreground"
            aria-label={t("Zatvori")}
            data-testid="button-zatvori-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {pitanja.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {t("Nema pitanja. Kliknite \"Dodaj pitanje\" ispod.")}
            </div>
          )}
          {pitanja.map((p, idx) => (
            <div key={idx} className="border border-border/60 rounded-xl p-4 bg-muted/10" data-testid={`card-pitanje-${idx}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {t("Pitanje")} {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeP(idx)}
                  className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                  data-testid={`button-obrisi-pitanje-${idx}`}
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t("Obriši")}
                </button>
              </div>

              <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Tekst pitanja")}</label>
              <textarea
                value={p.question}
                onChange={e => updateP(idx, { question: e.target.value })}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/40 mb-3 resize-y"
                placeholder={t("npr. Šta znači riječ 'Allah'?")}
                data-testid={`input-pitanje-${idx}`}
              />

              <label className="block text-xs font-bold text-muted-foreground mb-1">
                {t("Opcije")} <span className="font-normal">{t("(označite tačan odgovor)")}</span>
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
                        aria-label={t("Označi opciju {n} kao tačan odgovor", { n: String(oIdx + 1) })}
                        data-testid={`radio-tacan-${idx}-${oIdx}`}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => updateOption(idx, oIdx, e.target.value)}
                        className="flex-1 bg-transparent border-0 px-2 py-1 text-sm focus:outline-none"
                        placeholder={t("Opcija {n}", { n: String(oIdx + 1) })}
                        data-testid={`input-opcija-${idx}-${oIdx}`}
                      />
                      {isAnswer && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                          {t("Tačan")}
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
                  <Plus className="w-3.5 h-3.5" /> {t("Dodaj opciju")}
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
            <Plus className="w-4 h-4" /> {t("Dodaj pitanje")}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60 bg-muted/20 rounded-b-2xl sticky bottom-0">
          <Button variant="outline" onClick={requestClose} disabled={saving} className="rounded-xl" data-testid="button-otkazi-modal">
            {t("Otkaži")}
          </Button>
          <Button onClick={save} disabled={saving} className="rounded-xl flex items-center gap-2" data-testid="button-sacuvaj-pitanja">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("Sačuvaj")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Single accordion section
// ──────────────────────────────────────────────────
// Memoizovano: roditelj (ilmihal-lekcija) re-renderuje svake sekunde zbog
// `timeSpent` ticka. Bez memo-a se motion.div (height:auto) re-mjeri svake
// sekunde, što izaziva reflow YouTube iframe-a unutar dangerouslySetInnerHTML
// — vizuelno "treperenje" i nemogućnost pokretanja video-a.
const SectionAccordion = memo(function SectionAccordion({ section, slug, nivo, onOpened }: {
  section: AccordionSection;
  slug: string;
  nivo: number;
  /** Pozove se prvi put kad se sekcija otvori (uključujući i defaultOpen).
   *  Glavna stranica koristi za praćenje "sve sekcije pregledane" gate-a. */
  onOpened?: (sectionId: string) => void;
}) {
  const [open, setOpen] = useState(section.defaultOpen);
  const cfg = SECTION_CONFIG[section.type];

  // Ako sekcija krene otvorena (defaultOpen=true), odmah prijavi roditelju
  // da je "viđena" — inače učenik ne bi morao kliknuti na već otvorenu STORY
  // sekciju da bi gate prošao.
  useEffect(() => {
    if (section.defaultOpen && onOpened) onOpened(section.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    setOpen(v => {
      const next = !v;
      if (next && onOpened) onOpened(section.id);
      return next;
    });
  };

  return (
    <div className={`ring-2 ring-inset rounded-2xl overflow-hidden ${cfg.bg} ${cfg.ring}`}>
      <button onClick={handleToggle}
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
});

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
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await apiRequest<{ url: string }>("POST", "/admin/upload", formData, token, true);
      if (!uploadRes?.url) throw new Error(t("Upload nije uspio"));

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
      toast({ title: t("Slika ažurirana! ✓") });
      onUpdated(newHtml);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e.message || t("Upload nije uspio"), variant: "destructive" });
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
          <span className="text-sm font-bold">{uploading ? t("Uploadujem...") : t("Dodaj hero sliku")}</span>
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
          {uploading ? t("Uploadujem...") : t("Zamijeni sliku")}
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

// Memoizovan YouTube iframe — izolovan od parent re-rendera (npr. heartbeat
// tick svake sekunde). Bez ovoga iframe trepće jer se Framer Motion wrapper
// (motion.div height:auto) re-mjeri pri svakom re-renderu, što povlači
// reflow iframe-a i konstantno repaintovanje compositor sloja.
const YouTubeEmbed = memo(function YouTubeEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
      <iframe
        src={src}
        className="w-full h-full block border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title}
        loading="lazy"
      />
    </div>
  );
});

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // ?enablejsapi=1 omogućava postMessage IFrame API (mute/unMute/pauseVideo)
    // koji koristi globalni mute toggle iz `lib/audio-mute.ts`.
    const Q = "?enablejsapi=1";
    if (/youtu\.be$/i.test(u.hostname)) {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}${Q}` : null;
    }
    if (/youtube\.com$/i.test(u.hostname) || /^(www\.)?youtube\.com$/i.test(u.hostname)) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}${Q}`;
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
      if (m) return `https://www.youtube.com/embed/${m[2]}${Q}`;
    }
    return null;
  } catch { return null; }
}

function PriloziSection({
  lekcija,
  token,
  canManage,
  canDelete,
  onH5pCelebration,
}: {
  lekcija: Lekcija;
  token: string | null;
  /** Da li korisnik smije dodavati materijale (muallim ili admin). */
  canManage: boolean;
  /** Da li korisnik smije BRISATI materijale (samo admin). Muallim NE smije
   *  brisati embedovane vježbe, linkove, fajlove itd. — backend takođe odbija. */
  canDelete: boolean;
  onH5pCelebration?: (data: CelebrationData) => void;
}) {
  // Lokalni alias za čitljivost — ranije su uvjeti pisali `isAdmin`, ali sada
  // "upravljanje materijalima" obuhvata i muallim-a (vidi backend admin.ts).
  // NAPOMENA: `isAdmin` ovdje znači "može upravljati" (admin ili muallim);
  // za radnje koje su STROGO admin-only (brisanje, edit), koristi `canDelete`.
  const isAdmin = canManage;
  const { user } = useAuth();
  const { t } = useLanguage();
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
  const [showEmbedForm, setShowEmbedForm] = useState(false);
  const [embedValue, setEmbedValue] = useState("");
  const [embedLabel, setEmbedLabel] = useState("");
  const [embedReward, setEmbedReward] = useState<0 | 3 | 5 | 10>(5);
  const [savingEmbed, setSavingEmbed] = useState(false);
  const [openEmbed, setOpenEmbed] = useState<Prilog | null>(null);
  // H5P vježba se otvara u popup-u (kao embed), ne inline punom širinom.
  const [openH5p, setOpenH5p] = useState<Prilog | null>(null);
  // Edit embed (samo admin) — modal sa label + hasanatReward.
  const [editEmbed, setEditEmbed] = useState<Prilog | null>(null);
  const [editEmbedLabel, setEditEmbedLabel] = useState("");
  const [editEmbedReward, setEditEmbedReward] = useState<0 | 3 | 5 | 10>(0);
  const [savingEditEmbed, setSavingEditEmbed] = useState(false);
  // "Završio sam" claim — koje je učenik već claim-ovao u ovoj sesiji
  // (poslije refresh-a server svejedno odbije sa alreadyClaimed:true).
  const [claimedEmbeds, setClaimedEmbeds] = useState<Set<number>>(new Set());
  const [claimingEmbed, setClaimingEmbed] = useState(false);
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
      toast({ title: t("Uspješno"), description: t('"{name}" uploadovan.', { name: file.name }) });
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
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
      toast({ title: t("H5P uploadovan"), description: t('"{name}" je dodan.', { name: file.name }) });
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setUploadingH5p(false);
      if (h5pInputRef.current) h5pInputRef.current.value = "";
    }
  };

  // Helper: ponovo dovuci broj pokušaja (i multiplier za sljedeći) za jedan
  // prilog. Koristi se nakon završetka vježbe i pri klik-u na "Ponovi" kako bi
  // badge iznad playera uvijek pokazivao tačan "Pokušaj X — Y% nagrade".
  const refreshH5pAttempts = useCallback(async (priloziId: number) => {
    if (!token) return;
    try {
      const fresh = await apiRequest<{ nextAttemptNo: number; nextMultiplier: number }>(
        "GET", `/h5p/attempts/${priloziId}`, undefined, token,
      );
      setH5pAttempts(prev => ({
        ...prev,
        [priloziId]: { nextAttemptNo: fresh.nextAttemptNo, nextMultiplier: fresh.nextMultiplier },
      }));
    } catch {/* ignore — npr. admin/muallim ne dobija ovaj endpoint */}
  }, [token]);

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
          ? t("Ovo je tvoj {n}. pokušaj — daljnji pokušaji ne donose kapi meda.", { n: String(res.attemptNo) })
          : t("Pokušaj {n}: {procenat}%", { n: String(res.attemptNo), procenat: String(res.procenat) });
        toast({ title: t("Vježba završena"), description: reason });
      }
      // Refresh attempts za ovaj prilog (smanji prikazani max za sljedeći put).
      await refreshH5pAttempts(priloziId);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setH5pSubmitting(prev => ({ ...prev, [priloziId]: false }));
    }
  }, [token, h5pSubmitting, onH5pCelebration, toast, refreshH5pAttempts]);

  const handleAddUrl = async () => {
    if (!urlValue.trim() || !token) return;
    setSavingUrl(true);
    try {
      const result = await apiRequest<Prilog>("POST", `/admin/prilozi/${lekcija.id}/url`, {
        url: urlValue.trim(), label: urlLabel.trim() || undefined
      }, token);
      setAttachments(prev => [{ ...result, url: (result as any).externalUrl || urlValue.trim() }, ...prev]);
      toast({ title: t("Link dodan"), description: result.originalName });
      setUrlValue(""); setUrlLabel(""); setShowUrlForm(false);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setSavingUrl(false);
    }
  };

  const handleAddEmbed = async () => {
    if (!embedValue.trim() || !token) return;
    setSavingEmbed(true);
    try {
      const result = await apiRequest<Prilog>("POST", `/admin/prilozi/${lekcija.id}/embed`, {
        embedCode: embedValue.trim(),
        label: embedLabel.trim() || undefined,
        hasanatReward: embedReward,
      }, token);
      setAttachments(prev => [{ ...result, url: (result as any).externalUrl || "" }, ...prev]);
      toast({ title: t("Embed vježba dodana"), description: result.originalName });
      setEmbedValue(""); setEmbedLabel(""); setEmbedReward(5); setShowEmbedForm(false);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setSavingEmbed(false);
    }
  };

  const openEditEmbed = (a: Prilog) => {
    setEditEmbed(a);
    setEditEmbedLabel(a.originalName);
    const r = (a.hasanatReward ?? 0) as number;
    setEditEmbedReward((r === 3 || r === 5 || r === 10 ? r : 0) as 0 | 3 | 5 | 10);
  };

  const handleSaveEditEmbed = async () => {
    if (!editEmbed || !token) return;
    if (!editEmbedLabel.trim()) {
      toast({ title: t("Greška"), description: t("Naziv ne može biti prazan"), variant: "destructive" });
      return;
    }
    setSavingEditEmbed(true);
    try {
      const result = await apiRequest<Prilog>("PUT", `/admin/prilozi/${editEmbed.id}`, {
        label: editEmbedLabel.trim(),
        hasanatReward: editEmbedReward,
      }, token);
      setAttachments(prev => prev.map(a => a.id === editEmbed.id ? { ...a, ...result, url: (result as any).externalUrl || a.url } : a));
      toast({ title: t("Sačuvano"), description: result.originalName });
      setEditEmbed(null);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setSavingEditEmbed(false);
    }
  };

  const handleClaimEmbed = async (a: Prilog) => {
    if (!token || claimingEmbed) return;
    if (claimedEmbeds.has(a.id)) return;
    setClaimingEmbed(true);
    try {
      // studentId backend čita iz JWT-a (req.user.userId), ne iz body-ja —
      // prevent IDOR. Šaljemo samo priloziId.
      const res = await apiRequest<{
        hasanatGained: number;
        totalHasanat?: number;
        previousHasanat?: number;
        alreadyClaimed?: boolean;
      }>("POST", `/content/embed/zavrseno`, { priloziId: a.id }, token);
      setClaimedEmbeds(prev => new Set(prev).add(a.id));
      if (res.alreadyClaimed) {
        toast({ title: t("Već si dobio kapi"), description: t("Za ovu vježbu si ranije primio kapi meda.") });
      } else if (res.hasanatGained > 0) {
        onH5pCelebration?.({
          isRepeat: false,
          hasanatGained: res.hasanatGained,
          totalHasanat: res.totalHasanat ?? 0,
          previousHasanat: res.previousHasanat ?? 0,
          streakDays: 0,
          streakIncreased: false,
        });
      } else {
        toast({ title: t("Vježba završena"), description: t("Za ovu vježbu nisu predviđene kapi meda.") });
      }
      setOpenEmbed(null);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setClaimingEmbed(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(t('Obrisati "{name}"?', { name }))) return;
    try {
      await apiRequest("DELETE", `/admin/prilozi/${id}`, undefined, token);
      setAttachments(prev => prev.filter(a => a.id !== id));
      toast({ title: t("Obrisano"), description: t('"{name}" je obrisan.', { name }) });
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    }
  };

  // attachment.url vraca /api/admin/... pa NE dodajemo apiBase — to bi dalo
  // /api/api/admin/... (dvostruki prefix) i 404 koji je izgledao kao 4KB download.
  const downloadFile = async (attachment: Prilog, openInTab = false) => {
    try {
      const res = await fetch(attachment.url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(t("Greška pri preuzimanju ({status})", { status: String(res.status) }));
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (openInTab) {
        window.open(blobUrl, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = attachment.originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
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
          {t("Materijali za nastavu")}
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
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Uploadujem...")}</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> {t("Dodaj fajl")}</>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowUrlForm(v => !v)}
                      variant="outline"
                      className="rounded-xl border-blue-300 text-blue-700 hover:bg-blue-100 font-bold"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> {showUrlForm ? t("Odustani") : t("Dodaj link")}
                    </Button>
                    <Button
                      onClick={() => h5pInputRef.current?.click()}
                      disabled={uploadingH5p}
                      variant="outline"
                      className="rounded-xl border-purple-300 text-purple-700 hover:bg-purple-100 font-bold"
                    >
                      {uploadingH5p ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Uploadujem H5P...")}</>
                      ) : (
                        <><Sparkles className="w-4 h-4 mr-2" /> {t("Dodaj H5P vježbu")}</>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowEmbedForm(v => !v)}
                      variant="outline"
                      className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100 font-bold"
                    >
                      <Sparkles className="w-4 h-4 mr-2" /> {showEmbedForm ? t("Odustani") : t("Dodaj embed vježbu")}
                    </Button>
                  </div>
                  <p className="text-sm text-blue-400 mt-1">{t("PDF, DOCX, XLSX, PPTX, TXT (max 20MB), YouTube/web link, .h5p arhiva (max 50MB), ili embed (LearningApps, Wordwall, Genially, Quizizz, Kahoot, Padlet, Mentimeter)")}</p>
                  <Link
                    href="/muallim/h5p-uputstvo"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-800 mt-1.5 underline-offset-2 hover:underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("Nemaš još .h5p fajl? Pogledaj kako da napraviš svoju prvu vježbu")}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
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
                        placeholder={t("Naziv (opciono, npr. 'Video o abdestu')")}
                        value={urlLabel}
                        onChange={e => setUrlLabel(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-blue-200 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <Button
                        onClick={handleAddUrl}
                        disabled={savingUrl || !urlValue.trim()}
                        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold self-start"
                      >
                        {savingUrl ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Spašavam...")}</> : t("Spasi link")}
                      </Button>
                    </div>
                  )}
                  {showEmbedForm && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200 flex flex-col gap-2">
                      <p className="text-xs text-amber-700 font-semibold">
                        {t("Zalijepi embed kod (iframe) ili URL vježbe sa LearningApps, Wordwall, Genially, Quizizz, Kahoot, Padlet, Mentimeter ili H5P.org. Drugi izvori nisu dozvoljeni.")}
                      </p>
                      <textarea
                        placeholder='&lt;iframe src="https://learningapps.org/watch?app=..."&gt;&lt;/iframe&gt; ili samo URL'
                        value={embedValue}
                        onChange={e => setEmbedValue(e.target.value)}
                        rows={4}
                        className="px-3 py-2 rounded-lg border border-amber-200 text-sm focus:outline-none focus:border-amber-500 font-mono"
                      />
                      <input
                        type="text"
                        placeholder={t("Naziv vježbe (opciono)")}
                        value={embedLabel}
                        onChange={e => setEmbedLabel(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-amber-200 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs font-bold text-amber-800">{t("Kapi meda za završetak:")}</label>
                        <select
                          value={embedReward}
                          onChange={e => setEmbedReward(Number(e.target.value) as 0 | 3 | 5 | 10)}
                          className="px-2 py-1.5 rounded-lg border border-amber-300 text-sm font-semibold bg-white focus:outline-none focus:border-amber-500"
                          data-testid="embed-reward-select"
                        >
                          <option value={0}>{t("Bez nagrade (0 🍯)")}</option>
                          <option value={3}>{t("Lahka vježba — 3 🍯")}</option>
                          <option value={5}>{t("Srednja vježba — 5 🍯")}</option>
                          <option value={10}>{t("Teža vježba — 10 🍯")}</option>
                        </select>
                      </div>
                      <p className="text-xs text-amber-600 italic">
                        {t("Učenik dobija kapi tek kada klikne")} <strong>{t('"Završio sam vježbu"')}</strong> {t("u popupu — i to samo prvi put.")}
                      </p>
                      <Button
                        onClick={handleAddEmbed}
                        disabled={savingEmbed || !embedValue.trim()}
                        className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold self-start"
                      >
                        {savingEmbed ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Spašavam...")}</> : t("Spasi embed vježbu")}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {attachments.length === 0 ? (
                <p className="text-blue-400 text-base italic">{t("Nema uploadovanih materijala za ovu lekciju.")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Embed vježbe idu na dno spiska — prikazuju se kao široki
                      button koji otvara popup, da bi vježba imala maksimum prostora
                      umjesto da se gubi u 4 ugnježdena okvira. */}
                  {[...attachments].sort((x, y) => {
                    const ex = x.kind === "embed" ? 1 : 0;
                    const ey = y.kind === "embed" ? 1 : 0;
                    return ex - ey;
                  }).map(a => {
                    const isUrl = a.kind === "url";
                    const isH5p = a.kind === "h5p";
                    const isEmbed = a.kind === "embed";
                    const targetUrl = a.externalUrl || a.url;
                    const ytEmbed = isUrl ? getYoutubeEmbedUrl(targetUrl) : null;

                    // Embed: široki button preko cijele kartice umjesto inline iframe-a
                    if (isEmbed) {
                      const reward = a.hasanatReward ?? 0;
                      const subtitle = reward > 0
                        ? t("Klikni da otvoriš vježbu • do {reward} kapi meda 🍯", { reward: String(reward) })
                        : t("Klikni da otvoriš vježbu • bez kapi meda 🍯");
                      return (
                        <div key={a.id} className="flex flex-col gap-1">
                          <div className="flex items-stretch gap-2">
                          <button
                            onClick={() => setOpenEmbed(a)}
                            className="flex-1 flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 hover:border-amber-400 transition-all shadow-sm hover:shadow-md text-left"
                            data-testid={`embed-open-${a.id}`}
                          >
                            <span className="text-3xl flex-shrink-0">🎯</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-base text-amber-900 truncate">{a.originalName}</p>
                              <p className="text-xs text-amber-700">{subtitle}</p>
                            </div>
                            {isAdmin && a.approved === false && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-800 border border-amber-400 flex-shrink-0">
                                {t("Čeka odobrenje")}
                              </span>
                            )}
                            <ExternalLink className="w-5 h-5 text-amber-700 flex-shrink-0" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => openEditEmbed(a)}
                              className="px-3 py-2 rounded-xl text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors border-2 border-amber-300 hover:border-amber-500 flex items-center gap-1.5 font-bold text-xs"
                              title={t("Uredi naziv i nagradu")}
                              data-testid={`embed-edit-${a.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                              <span className="hidden sm:inline">{t("Uredi")}</span>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(a.id, a.originalName)}
                              className="p-2 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors border-2 border-transparent hover:border-red-200"
                              title={t("Obriši")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          </div>
                          <PcelaRating tip="prilog" id={a.id} size={16} align="right" className="pr-2" />
                        </div>
                      );
                    }
                    // a.url backend već vraća kao apsolutnu putanju from origin (npr.
                    // "/uploads/h5p/12"). NE prefixaj sa apiBase ("/api") — statički
                    // sadržaj se servira iz "/uploads", ne "/api/uploads". Sam URL se
                    // koristi u H5P popup-u (vidi openH5p Dialog), ne više inline.
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
                            {isH5p ? "🧩" : isEmbed ? "🎯" : isUrl ? (ytEmbed ? "▶️" : "🔗") : getFileIcon(a.mimeType)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-base text-gray-800 truncate">{a.originalName}</p>
                              {isAdmin && a.approved === false && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300 flex-shrink-0">
                                  {t("Čeka odobrenje")}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 truncate">
                              {isH5p
                                ? (maxNext > 0
                                    ? t("Interaktivna vježba — Pokušaj {n} · do {max} {unit} 🍯", { n: String(att?.nextAttemptNo ?? 1), max: String(maxNext), unit: maxNext === 1 ? t("kap meda") : t("kapi meda") })
                                    : t("Interaktivna vježba — Pokušaj {n} · bez kapi meda", { n: String(att?.nextAttemptNo ?? 1) }))
                                : isEmbed ? t("Embed vježba (bez kapi meda)") : isUrl ? targetUrl : formatFileSize(a.fileSize)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isH5p ? (
                              <button
                                onClick={() => {
                                  // Svaki put kad se otvori popup: nova instanca
                                  // playera (contentKey se mijenja) + osvježen
                                  // brojač pokušaja da badge pokaže tačan
                                  // "Pokušaj X — Y%".
                                  setH5pAttemptKey(prev => ({ ...prev, [a.id]: attemptKey + 1 }));
                                  void refreshH5pAttempts(a.id);
                                  setOpenH5p(a);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors"
                                title={t("Otvori vježbu")}
                                data-testid={`h5p-open-${a.id}`}
                              >
                                <Sparkles className="w-4 h-4" /> {t("Otvori vježbu")}
                              </button>
                            ) : isUrl ? (
                              <a
                                href={targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" /> {t("Otvori")}
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
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(a.id, a.originalName)}
                                className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title={t("Obriši")}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {ytEmbed && (
                          <YouTubeEmbed src={ytEmbed} title={a.originalName} />
                        )}
                        <PcelaRating tip="prilog" id={a.id} size={16} align="right" className="pt-1" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Modal za embed vježbe — full-screen na mobile, large na desktop.
                  X dugme gore desno, žuta napomena unutra iznad iframe-a.
                  Footer "Završio sam" se prikazuje samo učeniku (ne admin/muallim)
                  i samo ako vježba ima hasanatReward > 0. */}
              <Dialog open={!!openEmbed} onOpenChange={(o) => { if (!o) setOpenEmbed(null); }}>
                <DialogContent
                  className="p-0 gap-0 max-w-[100vw] sm:max-w-[95vw] md:max-w-5xl w-full h-[100dvh] sm:h-[92vh] sm:rounded-2xl rounded-none overflow-hidden flex flex-col"
                  data-testid="embed-modal"
                >
                  {(() => {
                    const reward = openEmbed?.hasanatReward ?? 0;
                    const isStudent = user?.role === "ucenik";
                    const alreadyClaimed = openEmbed ? claimedEmbeds.has(openEmbed.id) : false;
                    const showClaim = !!openEmbed && reward > 0 && isStudent;
                    const headerBadge = reward > 0
                      ? t("Do {reward} kapi meda 🍯", { reward: String(reward) })
                      : t("Bez kapi meda 🍯");
                    return (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200 flex-shrink-0">
                          <span className="text-2xl flex-shrink-0">🎯</span>
                          <DialogTitle className="flex-1 min-w-0 text-left text-base font-bold text-amber-900 truncate">
                            {openEmbed?.originalName}
                          </DialogTitle>
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                            {headerBadge}
                          </span>
                        </div>
                        <div className="sm:hidden px-4 py-2 bg-amber-100/60 text-xs font-semibold text-amber-800 text-center flex-shrink-0">
                          {headerBadge}
                        </div>
                        {openEmbed && (openEmbed.externalUrl || openEmbed.url) && (
                          <iframe
                            src={openEmbed.externalUrl || openEmbed.url}
                            title={openEmbed.originalName}
                            className="flex-1 w-full bg-white"
                            style={{ border: "none" }}
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                            referrerPolicy="no-referrer"
                            allow="fullscreen"
                          />
                        )}
                        {showClaim && openEmbed && (
                          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border-t border-amber-200 flex-shrink-0">
                            <p className="text-xs sm:text-sm text-amber-800 font-semibold">
                              {alreadyClaimed
                                ? t("Već si dobio kapi za ovu vježbu.")
                                : t("Kad završiš vježbu, klikni dugme da dobiješ kapi meda.")}
                            </p>
                            <Button
                              onClick={() => handleClaimEmbed(openEmbed)}
                              disabled={claimingEmbed || alreadyClaimed}
                              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold whitespace-nowrap"
                              data-testid="embed-claim"
                            >
                              {claimingEmbed
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Spašavam...")}</>
                                : alreadyClaimed
                                  ? t("✓ Završeno")
                                  : t("Završio sam vježbu • +{reward} 🍯", { reward: String(reward) })}
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* Popup za H5P vježbu — otvara se klikom na "Otvori vježbu", umjesto
                  inline prikaza punom širinom. Attempt-aware header gore, player u
                  scroll-abilnom dijelu, napomena o kapima meda u footeru.
                  CelebrationModal (z-[60]) se prikazuje IZNAD ovog popupa (z-50). */}
              <Dialog open={!!openH5p} onOpenChange={(o) => { if (!o) setOpenH5p(null); }}>
                <DialogContent
                  className="p-0 gap-0 max-w-[100vw] sm:max-w-[95vw] md:max-w-4xl w-full h-[100dvh] sm:h-[92vh] sm:rounded-2xl rounded-none overflow-hidden flex flex-col"
                  data-testid="h5p-modal"
                >
                  {openH5p && (() => {
                    const a = openH5p;
                    const aKey = h5pAttemptKey[a.id] ?? 0;
                    const aAtt = h5pAttempts[a.id];
                    const aMult = aAtt?.nextMultiplier ?? 1;
                    const aMax = Math.round(50 * aMult);
                    const aUrl = a.url;
                    return (
                      <>
                        <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center gap-2 flex-shrink-0">
                          <span className="text-2xl flex-shrink-0">🧩</span>
                          <DialogTitle className="flex-1 min-w-0 text-left text-base font-bold text-purple-900 truncate">
                            {a.originalName}
                          </DialogTitle>
                        </div>
                        <div className="px-4 py-2 bg-purple-50/70 border-b border-purple-100 flex items-center gap-2 flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <p className="text-sm font-semibold text-purple-700">
                            {aMax > 0
                              ? <>
                                  {t("Pokušaj")} <span className="text-purple-900">{aAtt?.nextAttemptNo ?? 1}</span>
                                  {" — "}
                                  <span className="text-purple-900">{Math.round(aMult * 100)}{t("% nagrade")}</span>
                                  {" "}{t("· možeš osvojiti do")}{" "}
                                  <span className="text-purple-900">{aMax} {aMax === 1 ? t("kap meda") : t("kapi meda")} 🍯</span>
                                </>
                              : <>
                                  {t("Pokušaj")} <span className="text-purple-900">{aAtt?.nextAttemptNo ?? 1}</span>
                                  {" — "}
                                  <span className="text-purple-900">{t("više pokušaja ne donosi kapi meda")}</span>
                                  {" ("}{t("već")}{" "}{Math.max(0, (aAtt?.nextAttemptNo ?? 1) - 1)} {t("pokušaja")}{")"}
                                </>
                            }
                          </p>
                        </div>
                        <div className="flex-1 overflow-auto bg-white px-4 sm:px-6 py-4">
                          {aUrl && (
                            <Suspense fallback={
                              <div className="flex items-center gap-2 text-blue-500 text-sm py-4 px-3">
                                <Loader2 className="w-4 h-4 animate-spin" /> {t("Učitavam vježbu...")}
                              </div>
                            }>
                              <H5PPlayerLazy
                                h5pPath={aUrl}
                                contentKey={`${a.id}-${aKey}`}
                                onCompleted={(r) => handleH5pCompleted(a.id, r.score, r.maxScore)}
                                isManager={canManage}
                              />
                            </Suspense>
                          )}
                        </div>
                        <p className="px-4 py-2 text-xs text-purple-500 bg-purple-50/60 flex-shrink-0">
                          {t("Maks. 50 kapi meda. 1. pokušaj: 100% nagrade, 2. pokušaj: 50%, 3+: bez nagrade.")}
                        </p>
                      </>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              {/* Edit modal za embed (samo admin) — uređuje naziv + nagradu.
                  Promjena URL-a se NE radi ovdje; ako URL nije ispravan, admin
                  obriše prilog i doda novi (rijedak slučaj). */}
              <Dialog open={!!editEmbed} onOpenChange={(o) => { if (!o) setEditEmbed(null); }}>
                <DialogContent className="max-w-md" data-testid="embed-edit-modal">
                  <DialogTitle className="text-lg font-bold text-amber-900">{t("Uredi embed vježbu")}</DialogTitle>
                  <div className="flex flex-col gap-3 mt-2">
                    <label className="text-xs font-bold text-amber-800">{t("Naziv vježbe")}</label>
                    <input
                      type="text"
                      value={editEmbedLabel}
                      onChange={e => setEditEmbedLabel(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-amber-300 text-sm focus:outline-none focus:border-amber-500"
                      data-testid="embed-edit-label"
                    />
                    <label className="text-xs font-bold text-amber-800">{t("Kapi meda za završetak")}</label>
                    <select
                      value={editEmbedReward}
                      onChange={e => setEditEmbedReward(Number(e.target.value) as 0 | 3 | 5 | 10)}
                      className="px-3 py-2 rounded-lg border border-amber-300 text-sm font-semibold bg-white focus:outline-none focus:border-amber-500"
                      data-testid="embed-edit-reward"
                    >
                      <option value={0}>{t("Bez nagrade (0 🍯)")}</option>
                      <option value={3}>{t("Lahka vježba — 3 🍯")}</option>
                      <option value={5}>{t("Srednja vježba — 5 🍯")}</option>
                      <option value={10}>{t("Teža vježba — 10 🍯")}</option>
                    </select>
                    <p className="text-xs text-amber-600 italic">
                      {t("Učenici koji su već dobili kapi za ovu vježbu ih neće dobiti ponovo, čak i ako povećaš nagradu.")}
                    </p>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditEmbed(null)}
                        className="rounded-lg font-bold"
                      >
                        {t("Odustani")}
                      </Button>
                      <Button
                        onClick={handleSaveEditEmbed}
                        disabled={savingEditEmbed || !editEmbedLabel.trim()}
                        className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        data-testid="embed-edit-save"
                      >
                        {savingEditEmbed ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("Spašavam...")}</> : t("Spasi")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
  const { t } = useLanguage();
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
  const [savingPredmet, setSavingPredmet] = useState(false);
  const [predmetModalOpen, setPredmetModalOpen] = useState(false);
  const [predmetDraft, setPredmetDraft] = useState("");
  const [kategorijeOpcije, setKategorijeOpcije] = useState<{ slug: string; naziv: string }[]>([]);
  const [loadingKategorije, setLoadingKategorije] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  // Bočne dekoracije (pčele/saće/cvijeće) na body-ju samo dok je lekcija otvorena.
  // Narandžasta podloga je uklonjena — body sad zadržava default boju.
  useEffect(() => {
    document.body.classList.add("lekcija-honey-bg");
    return () => document.body.classList.remove("lekcija-honey-bg");
  }, []);

  // Anti-cheat gate state — sva ČETIRI uslova moraju biti ispunjena da se
  // dugme "Označi kao završeno" otključa za nezavršene lekcije:
  //   1) timeSpent >= MIN_ACTIVE_SECONDS (300s aktivnog čitanja)
  //   2) scrollPercent >= MIN_SCROLL_PERCENT (skrolovao bar 85%)
  //   3) openedSectionIds pokriva sve vidljive sekcije
  //   4) quizPassed — ako lekcija ima `kvizPitanja`, mora tačno na sva
  //      odgovoriti u mini-kvizu "Provjeri znanje" (učitano iz
  //      `userProgress.quizPassedAt` ili lokalno setovano nakon prolaza)
  const [timeSpent, setTimeSpent] = useState(0);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [openedSectionIds, setOpenedSectionIds] = useState<Set<string>>(new Set());
  const [quizPassed, setQuizPassed] = useState(false);
  // `timeSpent` u UI-u je server-truth — sinhronizuje se na svakom heartbeat
  // odgovoru. Lokalni 1s/sec tick je samo "vizuelni glat" između heartbeat-a
  // (svakih 10s), tako da brojač ne stoji nepomično ako tab ostane aktivan.
  const timeSpentRef = useRef(0);
  useEffect(() => { timeSpentRef.current = timeSpent; }, [timeSpent]);

  const handleSectionOpened = useCallback((sectionId: string) => {
    setOpenedSectionIds(prev => {
      if (prev.has(sectionId)) return prev;
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  }, []);

  // Pozove se kad učenik tačno odgovori na SVA pitanja u mini-kvizu
  // "Provjeri znanje". Lokalno odmah otključavamo gate (UX) i šaljemo
  // backend-u `quizPassed: true` da idempotentno setuje `quiz_passed_at` —
  // tako sljedeći put kad učenik dođe na lekciju gate je već prošao.
  // Greška u POST-u ne blokira UX (lokalni gate je otvoren) — backend
  // gate u markComplete-u hvata `quiz_not_passed` i pretvara u prijateljski
  // toast ako se desi race.
  const handleQuizPassed = useCallback(() => {
    setQuizPassed(true);
    if (!lekcija || !token) return;
    apiRequest("POST", "/content/napredak", {
      contentType: "ilmihal",
      contentId: lekcija.id,
      zavrsen: false,
      quizPassed: true,
      timeSpentSeconds: timeSpentRef.current,
    }, token).catch(() => {/* ignore — markComplete će ponovo poslati ako treba */});
  }, [lekcija?.id, token]);

  const displayNivo = (nivo: number) => nivo;

  // Admin-only: izmjena predmeta lekcije (kategorija za "Sve lekcije" filter).
  // Muallim NEMA pristup ovome — backend ruta /admin/* je admin-only middleware,
  // a UI dugme se renderuje samo za user.role === "admin".
  // Admin: otvori modal i učitaj kategorije (predmete) iz Banke pitanja.
  const otvoriPredmetModal = async () => {
    if (!lekcija || !token) return;
    setPredmetDraft(lekcija.predmet || "");
    setPredmetModalOpen(true);
    setLoadingKategorije(true);
    try {
      const data = await apiRequest<{ kategorije: { slug: string; naziv: string }[] }>(
        "GET", "/admin/banka-pitanja/kategorije", undefined, token,
      );
      setKategorijeOpcije(data.kategorije || []);
    } catch {
      setKategorijeOpcije([]);
    } finally {
      setLoadingKategorije(false);
    }
  };

  const handleSavePredmet = async () => {
    if (!lekcija || !token) return;
    const novi = predmetDraft.trim();
    const trenutni = lekcija.predmet || "";
    if (novi === trenutni) { setPredmetModalOpen(false); return; }
    setSavingPredmet(true);
    try {
      await apiRequest("PUT", `/admin/ilmihal/${lekcija.id}`, { predmet: novi }, token);
      setLekcija(prev => prev ? { ...prev, predmet: novi || null } : prev);
      toast({ title: t("Predmet ažuriran"), description: novi ? t("Predmet: {novi}", { novi }) : t("Predmet uklonjen.") });
      setPredmetModalOpen(false);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Ne mogu spasiti predmet."), variant: "destructive" });
    } finally {
      setSavingPredmet(false);
    }
  };

  const handleSaveNaslov = async () => {
    if (!lekcija || !token) return;
    const novi = naslovDraft.trim();
    if (!novi) {
      toast({ title: t("Naziv ne smije biti prazan"), variant: "destructive" });
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
      toast({ title: t("Naziv ažuriran"), description: t("Lekcija sada nosi naziv: {novi}", { novi }) });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Ne mogu spasiti naziv."), variant: "destructive" });
    } finally {
      setSavingNaslov(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    // Reset gate state pri prelasku na novu lekciju (npr. preko strip-a) —
    // inače bi vrijeme/skrol/sekcije iz prethodne lekcije ostali kao "ljepak".
    setTimeSpent(0);
    setScrollPercent(0);
    setOpenedSectionIds(new Set());
    setQuizPassed(false);
    // Token je obavezan da bi backend uključio `prilozi` u response
    // (učenici vide H5P/URL prilozi, muallim/admin sve). Bez tokena
    // dobijemo lekciju ali bez priloga, što razbije H5P prikaz.
    apiRequest<Lekcija>("GET", `/content/ilmihal/${slug}`, undefined, token)
      .then(async (data) => {
        // Gate pristupa lekciji MORA pratiti ISTU logiku otključavanja kao
        // mapa (medaljon-blokovi), a NE tvrdi redoslijed<=10. Ranije je ovdje
        // stajao hard-limit (r > 10), pa je mapa otključala sljedeću lekciju
        // ali ju je ova stranica i dalje blokirala — 12. lekcija se nije
        // otvarala iako je mapa pokazivala otključano (vidi memory:
        // lekcije-dvije-brave). Sada dohvatimo mapu nivoa i izračunamo isti
        // broj otključanih ćelija pa blokiramo samo lekcije iza granice.
        const isPrivileged =
          user?.role === "admin" || user?.role === "muallim" || user?.role === "roditelj";
        if (!isPrivileged) {
          let blocked = false;
          try {
            const mapa = await apiRequest<MapaUnlockData>(
              "GET", `/mapa/nivo/${data.nivo ?? 1}`, undefined, token || undefined,
            );
            const lekcijeSorted = [...(mapa.lekcije ?? [])].sort(
              (a, b) => a.redoslijed - b.redoslijed,
            );
            const zavrseneSet = new Set(mapa.zavrsene ?? []);
            const osvojeniSet = new Set(mapa.osvojeniMedaljoni ?? []);
            const completedCount = lekcijeSorted.filter((l) => zavrseneSet.has(l.id)).length;
            const unlocked = computeUnlockedCellCount({
              isPrivileged: false,
              isGuest: !user,
              totalCells: lekcijeSorted.length,
              medaljoni: mapa.medaljoni ?? [],
              completedCount,
              osvojeniSet,
            });
            const idx = lekcijeSorted.findIndex((l) => l.id === data.id);
            // Lekcija nije u mapi (npr. medaljon/dodatak van glavnog niza) →
            // padni na konzervativni redoslijed-limit.
            blocked = idx >= 0 ? idx >= unlocked : (data.redoslijed ?? 0) > (!user ? 5 : 10);
          } catch {
            // Mapa nedostupna → konzervativni fallback (stari limit).
            blocked = (data.redoslijed ?? 0) > (!user ? 5 : 10);
          }
          if (blocked) {
            toast({
              title: t("Zaključano"),
              description: !user
                ? t("Prijavi se da otključaš više lekcija.")
                : t("Završi prethodne lekcije da otključaš ovu."),
              variant: "destructive",
            });
            setLocation(`/ilmihal?nivo=${data.nivo ?? 1}`);
            return;
          }
        }
        setLekcija(data);
        setParsed(parseSections(data.contentHtml));
        // Učitaj akumulirano vrijeme iz ranijih sesija — server vraća
        // server-store time. Tako npr. povratak učenika ne počne od 0.
        const initial = data.userProgress?.timeSpentSeconds ?? 0;
        setTimeSpent(initial);
        // Ako je učenik već ranije položio mini-kviz (server čuva
        // `quizPassedAt`), 4. uslov gate-a je već zadovoljen — ne mora
        // ponovo rješavati pri svakom posjetu.
        if (data.userProgress?.quizPassedAt) setQuizPassed(true);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [slug, token]);

  // Lokalni "vizuelni" tick — povećava prikaz `timeSpent` svake sekunde dok
  // je tab vidljiv. Ovo je SAMO za UX da brojač ne stoji između heartbeat-a
  // (koji se šalju svakih 10s). Server-store vrijeme je TRUTH i postavlja se
  // na svakom heartbeat odgovoru (vidi useEffect ispod).
  //
  // Page Visibility API: kad korisnik prebaci tab/minimizira, lokalni brojač
  // staje. Server-side, ako prestaje slati hb, sljedeći hb će dodati max 15s
  // (cap), tako da ostavljanje taba u pozadini ne farmuje vrijeme.
  useEffect(() => {
    if (!lekcija || !user) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        setTimeSpent(t => t + 1);
      }
    };
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lekcija?.id, user?.id]);

  // SERVER-SIDE HEARTBEAT — jedini path kojim time_spent_seconds raste
  // server-side za ilmihal. Klijent samo signalizira "živ sam, čitam" — server
  // izračuna deltu (NOW() - last_heartbeat_at, cap 15s) i doda u DB.
  //
  // Šalje se samo dok je tab vidljiv. Ako je tab u pozadini, server svejedno
  // ima `last_heartbeat_at` iz ranije pa se prilikom povratka delta cap-uje
  // na 15s.
  //
  // Sinhronizujemo lokalni `timeSpent` sa server-truth iz odgovora — tako se
  // svaki "drift" lokalnog ticka (npr. tab je bio neaktivan) automatski
  // ispravlja prema server-store vrijednosti.
  useEffect(() => {
    if (!lekcija || !user || !token) return;
    const sendHeartbeat = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      apiRequest<{ timeSpentSeconds: number }>("POST", "/content/heartbeat", {
        contentType: "ilmihal",
        contentId: lekcija.id,
      }, token).then(resp => {
        if (typeof resp?.timeSpentSeconds === "number") {
          // Sinhronizuj UI sa server-truth. `Math.max` da lokalni tick koji je
          // možda otišao naprijed između hb-a ne skoči nazad.
          setTimeSpent(prev => Math.max(prev, resp.timeSpentSeconds));
        }
      }).catch(() => {});
    };
    // Pošalji prvi hb odmah da inicijalizujemo `last_heartbeat_at` server-side,
    // pa onda interval. Bez ovoga prvi hb bi došao tek nakon 10s.
    sendHeartbeat();
    const id = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_S * 1000);
    return () => window.clearInterval(id);
  }, [lekcija?.id, user?.id, token]);

  // Scroll progress tracker — koristi scroll na window-u jer sadržaj lekcije
  // se renderira u glavnom toku stranice. Kad učenik dođe blizu dna (>=85%),
  // gate se otključava sa te strane.
  useEffect(() => {
    if (!lekcija) return;
    const update = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const viewport = window.innerHeight || doc.clientHeight;
      const total = doc.scrollHeight - viewport;
      if (total <= 0) {
        // Sadržaj kraći od viewporta — automatski zadovoljen scroll uslov.
        setScrollPercent(prev => (prev < 1 ? 1 : prev));
        return;
      }
      const pct = Math.max(0, Math.min(1, scrollTop / total));
      // Monotono raste — ako učenik skroluje gore, gate ostaje otključan.
      setScrollPercent(prev => (pct > prev ? pct : prev));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [lekcija?.id, parsed?.sections.length]);

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
          // NE šaljemo `timeSpentSeconds` — backend ignoriše klijentsku vrijednost
          // za ilmihal i koristi server-store time (akumuliran preko POST
          // /content/heartbeat). Tako tehnički vješt korisnik ne može poslati
          // `timeSpentSeconds: 300` curl-om i preskočiti gate.
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
            timeSpentSeconds: timeSpentRef.current,
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
              title: `${t("🎉 Osvojio si bedž!")}${newBadges.length > 1 ? ` (+${newBadges.length - 1})` : ""}`,
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
    } catch (e: any) {
      // 422 = backend gate — pokaži prijateljsku poruku zavisno od `error`
      // koda umjesto generičke "Greška servera".
      if (e?.status === 422 && e?.data?.error === "min_time_not_reached") {
        const min = Number(e.data.minSeconds) || MIN_ACTIVE_SECONDS;
        const cur = Number(e.data.currentSeconds) || timeSpentRef.current;
        const remaining = Math.max(0, min - cur);
        toast({
          title: t("Treba još malo čitanja"),
          description: t("Provedi još {time} aktivnog čitanja prije nego označiš lekciju kao završenu.", { time: formatDuration(remaining) }),
          variant: "destructive",
        });
      } else if (e?.status === 422 && e?.data?.error === "quiz_not_passed") {
        // Race-case: lokalni gate je dozvolio klik ali server nema
        // `quiz_passed_at` (npr. mreža je propustila prethodni POST iz
        // handleQuizPassed). Sinhroniziraj lokalni state da gate ostane
        // zaključan i uputi učenika na kviz.
        setQuizPassed(false);
        toast({
          title: t("Najprije riješi kviz"),
          description: t('Tačno odgovori na sva pitanja u "Provjeri znanje" pa onda označi lekciju kao završenu.'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("Greška"),
          description: e?.message || t("Ne mogu sačuvati napredak. Pokušaj ponovo."),
          variant: "destructive",
        });
      }
    }
  };

  // Vidljive sekcije za TRENUTNOG korisnika (muallim/admin vidi priprema,
  // učenik ne). Računa se izvan IIFE-a u JSX-u kako bismo gate logici dali
  // pristup broju i ID-ovima sekcija.
  const visibleSections = React.useMemo(() => {
    if (!parsed) return [] as AccordionSection[];
    const isMuallim = user?.role === "admin" || user?.role === "muallim";
    return parsed.sections
      .filter(s => s.type !== "quiz_box" && (s.type !== "priprema" || isMuallim))
      .slice()
      .sort((a, b) => (a.type === "priprema" ? 1 : 0) - (b.type === "priprema" ? 1 : 0));
  }, [parsed, user?.role]);

  // Anti-cheat gate: ČETIRI uslova moraju biti true. `completed` se ne broji
  // ovdje — već-završene lekcije imaju zaseban UI (vidi dugme dolje).
  // `lekcijaHasQuiz` mirror-uje istu validaciju koju backend radi u
  // POST /content/napredak (≥1 dobro formulisano pitanje sa ≥2 opcije i
  // tačnim odgovorom u opcijama). Bez ovog filtra prazan/malformed kviz
  // bi vječno blokirao učenika.
  const lekcijaHasQuiz = React.useMemo(() => {
    const arr = lekcija?.kvizPitanja;
    if (!Array.isArray(arr)) return false;
    return arr.some(p => {
      if (!p || typeof p.question !== "string" || p.question.trim().length === 0) return false;
      if (!Array.isArray(p.options)) return false;
      const opts = p.options.filter(o => typeof o === "string" && o.trim().length > 0);
      if (opts.length < 2) return false;
      return typeof p.answer === "string" && opts.includes(p.answer);
    });
  }, [lekcija?.kvizPitanja]);
  const effectiveMinSeconds = isIntroSlug(lekcija?.slug) ? INTRO_MIN_ACTIVE_SECONDS : MIN_ACTIVE_SECONDS;
  const timeOk = timeSpent >= effectiveMinSeconds;
  const scrollOk = scrollPercent >= MIN_SCROLL_PERCENT;
  const sectionsOk = visibleSections.length === 0
    || visibleSections.every(s => openedSectionIds.has(s.id));
  const quizOk = !lekcijaHasQuiz || quizPassed;
  const canMarkComplete = timeOk && scrollOk && sectionsOk && quizOk;
  const remainingSeconds = Math.max(0, effectiveMinSeconds - timeSpent);
  const remainingSections = visibleSections.filter(s => !openedSectionIds.has(s.id)).length;

  const NIVO_LABELS: Record<number, string> = { 1: "Nivo 1", 2: "Nivo 2", 3: "Nivo 3" };
  const backNivo = lekcija ? displayNivo(lekcija.nivo) : null;
  // Nazad vodi KORAK nazad — na snake-mapu lekcija tog nivoa (gdje učenik bira
  // sljedeću lekciju), a NE na izbor košnica/nivoa (što djeluje kao izlazak).
  const goBack = () => setLocation(backNivo ? `/nivo${backNivo}-mapa` : "/ilmihal");

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
    // Specijalni slučaj: medaljon-prazna lekcija. Slug forma:
    // `medaljon-nivo{N}-{NN}` (npr. medaljon-nivo1-10). Admin dobije dugme
    // koje jednim klikom kreira praznu lekciju sa tim slugom.
    const medMatch = slug?.match(/^medaljon-nivo(\d+)-(\d+)$/);
    const isAdminUser = user?.role === "admin";
    return (
      <Layout>
        <div className="text-center py-20 max-w-md mx-auto px-4">
          <p className="text-muted-foreground font-medium">{t("Lekcija nije pronađena")}</p>
          {medMatch && isAdminUser && token && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300">
              <p className="text-sm text-amber-900 font-bold mb-1">
                {t("Zlatni medaljon — Nivo")} {medMatch[1]} · {t("medaljon")} {medMatch[2]}
              </p>
              <p className="text-xs text-amber-800 mb-4">
                {t("Ova prazna lekcija još ne postoji. Klikni dugme da je kreiraš, pa je popuni akordionima i vježbama.")}
              </p>
              <Button
                onClick={async () => {
                  try {
                    const naslov = `Zlatni medaljon — Nivo ${medMatch[1]} (medaljon ${medMatch[2]})`;
                    await apiRequest(
                      "POST",
                      "/admin/ilmihal",
                      {
                        naslov,
                        slug,
                        nivo: parseInt(medMatch[1]),
                        redoslijed: 9000 + parseInt(medMatch[2]),
                        contentHtml: `<h1>${naslov}</h1><p>Čestitamo na osvojenom medaljonu! Ovdje admin dodaje sadržaj.</p>`,
                      },
                      token,
                    );
                    toast({ title: t("Lekcija kreirana"), description: t("Učitavam…") });
                    setTimeout(() => window.location.reload(), 600);
                  } catch (err: any) {
                    toast({
                      title: t("Greška"),
                      description: err?.message || t("Nije moguće kreirati lekciju"),
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-create-medaljon-lekcija"
                className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold"
              >
                {t("Kreiraj praznu lekciju")}
              </Button>
            </div>
          )}
          <Button className="mt-4" variant="outline" onClick={() => setLocation("/ilmihal")}>{t("Nazad")}</Button>
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
        {/* Admin toolbar (samo admin) */}
        {user?.role === "admin" && (
          <div className="flex items-center gap-2 mb-4 justify-end flex-wrap">
            <button onClick={async () => {
              if (!lekcija || !token) return;
              const isLocked = lekcija.locked;
              const url = `/admin/ilmihal/${lekcija.id}/${isLocked ? "unlock" : "lock"}`;
              if (isLocked && !confirm(t("Otključati lekciju? Nakon otključavanja je možeš uređivati ili je auto-skripte mogu prepisati."))) return;
              try {
                await apiRequest("POST", url, {}, token);
                setLekcija(prev => prev ? { ...prev, locked: !isLocked } : prev);
                toast({ title: isLocked ? t("Otključano") : t("🔒 Zaključano"), description: isLocked ? t("Lekcija je otključana.") : t("Sadržaj je zaštićen od izmjena.") });
              } catch {
                toast({ title: t("Greška"), description: t("Ne mogu promijeniti status zaključavanja."), variant: "destructive" });
              }
            }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${lekcija?.locked ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              title={lekcija?.locked ? (lekcija.lockedNote || t("Lekcija je zaključana")) : t("Zaključaj lekciju (zaštita od auto-skripti)")}>
              {lekcija?.locked ? <><Lock className="w-3.5 h-3.5" /> {t("Zaključano")}</> : <><Unlock className="w-3.5 h-3.5" /> {t("Zaključaj")}</>}
            </button>
            <button onClick={() => { setNaslovDraft(lekcija?.naslov || ""); setEditingNaslov(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors">
              <PenLine className="w-3.5 h-3.5" /> {t("Uredi naziv")}
            </button>
            <button onClick={otvoriPredmetModal} disabled={savingPredmet}
              title={t("Promijeni predmet (kategoriju) lekcije za 'Sve lekcije' filter")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors disabled:opacity-50">
              {savingPredmet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
              {t("Predmet:")} {lekcija.predmet || "—"}
            </button>
            <button onClick={() => setShowEditor(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
              <FilePen className="w-3.5 h-3.5" /> {t("Uredi sadržaj")}
            </button>
          </div>
        )}

        {/* Predmet modal (admin) — dropdown kategorija iz Banke pitanja */}
        {predmetModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => !savingPredmet && setPredmetModalOpen(false)}>
            <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-extrabold text-base text-foreground mb-1">{t("Predmet lekcije")}</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t("Odaberi predmet (kategoriju iz Banke pitanja). Nove predmete dodaješ u Banci pitanja.")}
              </p>
              {loadingKategorije ? (
                <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <select
                  value={predmetDraft}
                  onChange={(e) => setPredmetDraft(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm mb-4 bg-white"
                  data-testid="select-predmet"
                >
                  <option value="">{t("— Bez predmeta —")}</option>
                  {kategorijeOpcije.map((k) => (
                    <option key={k.slug} value={k.naziv}>{k.naziv}</option>
                  ))}
                  {predmetDraft && !kategorijeOpcije.some((k) => k.naziv === predmetDraft) && (
                    <option value={predmetDraft}>{predmetDraft} {t("(trenutni)")}</option>
                  )}
                </select>
              )}
              <div className="flex gap-2">
                <button onClick={() => setPredmetModalOpen(false)} disabled={savingPredmet}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  data-testid="button-predmet-odustani">
                  {t("Odustani")}
                </button>
                <button onClick={handleSavePredmet} disabled={savingPredmet || loadingKategorije}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  data-testid="button-predmet-sacuvaj">
                  {savingPredmet ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("Sačuvaj")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header — naslov centriran, Nazad ispod */}
        <div className="mb-5">
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
                  {savingNaslov ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("Spasi")}
                </button>
                <button
                  onClick={() => setEditingNaslov(false)}
                  disabled={savingNaslov}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> {t("Otkaži")}
                </button>
              </div>
            </div>
          ) : (
            <h1 className="text-2xl font-extrabold text-foreground leading-tight text-center">{lekcija.naslov}</h1>
          )}
          <div className="flex justify-center mt-2">
            <button onClick={goBack}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary font-bold text-sm transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/10">
              <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
            </button>
          </div>
          {(user?.role === "admin" || user?.role === "muallim") && (() => {
            const nextUndone = lekcijeStrip.find(l => !completedIds.has(l.id) && l.id !== lekcija.id);
            if (!nextUndone) return null;
            return (
              <div className="flex justify-center mt-1">
                <button
                  onClick={() => setLocation(`/ilmihal/${nextUndone.slug}`)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 hover:text-amber-800 hover:underline"
                  data-testid="link-sljedeca-lekcija"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-muted-foreground font-semibold">{t("Sljedeća:")}</span>
                  <span className="truncate max-w-[16rem] sm:max-w-xs">{nextUndone.naslov}</span>
                </button>
              </div>
            );
          })()}
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
                <div class="nivo-badge">${t("Nivo")} ${lekcija.nivo}</div>
                <h1>${lekcija.naslov}</h1>
                ${parsed.heroImage ? '<div class="hero-print"><img src="' + (parsed.heroImage.startsWith("http") ? parsed.heroImage : "https://mekteb.net" + parsed.heroImage) + '" /></div>' : ""}
                ${sections}
                <div class="footer">mekteb.net — ${t("Islamska edukativna platforma")}</div>
              </body></html>`);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" /> {t("Printaj lekciju")}
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

        {/* Ocjena lekcije (5 pčelica) — vidi se svima, glasaju prijavljeni */}
        {lekcija?.id && (
          <div className="flex justify-end -mt-3 mb-4 pr-1">
            <PcelaRating tip="lekcija" id={lekcija.id} size={20} align="right" label={t("Ocijeni lekciju")} />
          </div>
        )}

        {/* Lesson navigation strip — samo muallim/admin (učenik se kreće samo iz Košnice) */}
        {(user?.role === "admin" || user?.role === "muallim") && lekcijeStrip.length > 1 && slug && (
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
              const isAdmin = user?.role === "admin";
              const onKvizSaved = (novaPitanja: LekcijaKvizPitanje[]) => {
                setLekcija(prev => prev ? { ...prev, kvizPitanja: novaPitanja } : prev);
              };
              // `visibleSections` se izvan ovog IIFE-a računa preko useMemo.

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
                      onPassed={handleQuizPassed}
                      alreadyPassed={quizPassed}
                      // Auto-otvori kviz dok god gate uslov nije zadovoljen —
                      // tako učenik vidi šta još treba uraditi bez dodatnog klika.
                      // Već završene lekcije i položeni kvizovi ostaju zatvoreni.
                      defaultOpen={lekcijaHasQuiz && !quizPassed && !completed}
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
                      <Plus className="w-4 h-4" /> {t('Dodaj kviz "Provjeri znanje"')}
                    </button>
                  );
                }
                return null;
              };

              const items: React.ReactNode[] = [];
              let kvizInserted = false;
              for (const section of visibleSections) {
                items.push(
                  <SectionAccordion
                    // Uključujemo slug u key kako bi React PRIMUSAO unmount/mount
                    // kad učenik prelazi između lekcija (section.id="STORY" je
                    // isti u svim lekcijama → bez slug-a komponenta bi se reuse-ovala
                    // i useEffect za defaultOpen ne bi opet ispalio onOpened()).
                    key={`${slug}-${section.id}`}
                    section={section}
                    slug={slug!}
                    nivo={lekcija.nivo}
                    onOpened={handleSectionOpened}
                  />
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
          /* Fallback: ako nema akordion sekcija (lekcija sa čistim <p> sadržajem),
             renderujemo raw HTML + kviz box ispod (ako lekcija ima kvizPitanja).
             Bez ovoga, učenik nikad ne vidi kviz pa "Završeno" ostaje zaključano. */
          <div className="flex flex-col gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6">
              <RjecnikContent html={lekcija.contentHtml} />
            </div>
            {lekcija.kvizPitanja && lekcija.kvizPitanja.length > 0 && (
              <LekcijaKvizBox
                key="lekcija-kviz-fallback"
                pitanja={lekcija.kvizPitanja}
                lekcijaId={lekcija.id}
                isAdmin={user?.role === "admin"}
                token={token}
                onSaved={(novaPitanja) => setLekcija(prev => prev ? { ...prev, kvizPitanja: novaPitanja } : prev)}
                onPassed={handleQuizPassed}
                alreadyPassed={quizPassed}
                defaultOpen={lekcijaHasQuiz && !quizPassed && !completed}
              />
            )}
            {user?.role === "admin" && token && (!lekcija.kvizPitanja || lekcija.kvizPitanja.length === 0) && (
              <button
                type="button"
                onClick={() => {
                  setLekcija(prev => prev ? { ...prev, kvizPitanja: [{ question: "", options: ["", "", "", ""], answer: "" }] } : prev);
                }}
                className="w-full ring-2 ring-inset ring-teal-200 bg-teal-50 hover:bg-teal-100 rounded-2xl px-5 py-4 flex items-center justify-center gap-2 text-sm font-bold text-teal-800 transition-colors"
                data-testid="button-dodaj-kviz-fallback"
              >
                <Plus className="w-4 h-4" /> {t('Dodaj kviz "Provjeri znanje"')}
              </button>
            )}
          </div>
        )}

        {/* Prilozi / Materijali — backend već filtrira: učenici vide samo H5P
            i URL prilozi (ne fajlove); muallim i admin vide sve. */}
        {user && (
          <PriloziSection
            lekcija={lekcija}
            token={token}
            canManage={user.role === "admin" || user.role === "muallim"}
            canDelete={user.role === "admin"}
            onH5pCelebration={setCelebration}
          />
        )}

        {/* Vezani kvizovi (kvizovi.lekcija_id = lekcija.id) — sakriveno ako nema rezultata */}
        <VezaniKvizovi lekcijaId={lekcija.id} />

        {/* Complete button + anti-cheat gate UI */}
        {user && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-end gap-3">
            {/* Gate pillovi — pokazuju se samo dok lekcija nije završena i
                gate još nije zadovoljen. Učeniku pokazujemo šta još fali. */}
            {!completed && !canMarkComplete && (
              <div
                className="flex flex-wrap gap-2 justify-end max-w-full"
                data-testid="ilmihal-completion-gate"
                aria-live="polite"
              >
                {!timeOk && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                    data-testid="gate-time"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {t("Još")} {formatDuration(remainingSeconds)} {t("čitanja")}
                  </span>
                )}
                {!scrollOk && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                    data-testid="gate-scroll"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    {t("Skrolaj do dna")} ({Math.round(scrollPercent * 100)}%)
                  </span>
                )}
                {!sectionsOk && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 ring-1 ring-purple-200"
                    data-testid="gate-sections"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    {t("Otvori još")} {remainingSections} {remainingSections === 1 ? t("sekciju") : t("sekcija")}
                  </span>
                )}
                {!quizOk && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                    data-testid="gate-quiz"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {t("Riješi kviz tačno")}
                  </span>
                )}
              </div>
            )}

            {/* Status za već-završene lekcije: učenik se može vratiti i čitati
                slobodno, vrijeme se i dalje akumulira (server radi MAX), ali
                Kapi meda ne dobija opet. */}
            {completed && (
              <div
                className="flex flex-wrap gap-2 justify-end items-center text-xs text-muted-foreground"
                data-testid="ilmihal-already-completed-note"
              >
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200">
                  <Clock className="w-3.5 h-3.5" />
                  Provedeno: {formatDuration(timeSpent)}
                </span>
                <span className="italic">
                  Već završeno ✓ — ponovi koliko želiš, kapi meda ne dobijaš opet.
                </span>
              </div>
            )}

            <Button
              onClick={markComplete}
              disabled={completed || !canMarkComplete}
              data-testid="button-mark-complete"
              title={
                completed
                  ? "Lekcija je već završena"
                  : canMarkComplete
                    ? "Označi lekciju kao završenu"
                    : "Završi sve uslove iznad da otključaš dugme"
              }
              className={`rounded-2xl px-8 py-3 font-bold text-base ${completed ? "bg-emerald-500 hover:bg-emerald-500" : ""}`}
            >
              {completed ? (
                <><CheckCircle2 className="w-5 h-5 mr-2" /> {t("Završeno! ⭐")}</>
              ) : (
                <><BookOpen className="w-5 h-5 mr-2" /> {t("Označi kao završeno")}</>
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </Layout>
    </>
  );
}
