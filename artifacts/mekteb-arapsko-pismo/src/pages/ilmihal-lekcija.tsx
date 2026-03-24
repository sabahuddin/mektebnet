import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, Volume2, CheckCircle2, BookOpen, BookMarked,
  ChevronDown, MessageSquare, PenLine, HelpCircle, Sparkles, Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Lekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  contentHtml: string;
  audioSrc?: string;
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

    // Default open: has "active" class
    const isActive = contentDiv.classList.contains("active") || sectionId === "STORY";

    // Classify section type
    let type: AccordionSection["type"] = "other";
    if (sectionId === "STORY") type = "story";
    else if (sectionId === "ILMIHAL") type = "ilmihal";
    else if (sectionId === "QUIZ_BOX") type = "quiz_box";
    else if (sectionId.includes("PITAN") || sectionId.includes("RAZGOVOR")) type = "pitanja";
    else if (sectionId.includes("ZADATAK") || sectionId.includes("ZADACI") || sectionId.includes("AKTIVNOST")) type = "zadatak";

    sections.push({ id: sectionId, title, html: contentHtml, defaultOpen: isActive, type });
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
              {section.type === "quiz_box" ? (
                <MiniKviz slug={slug} nivo={nivo} />
              ) : (
                <div
                  className="ilmihal-content"
                  dangerouslySetInnerHTML={{ __html: section.html }}
                />
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [lekcija, setLekcija] = useState<Lekcija | null>(null);
  const [parsed, setParsed] = useState<{ heroImage: string | null; sections: AccordionSection[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

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

  const NIVO_LABELS: Record<number, string> = { 1: "Nivo 1", 2: "Nivo 2", 21: "Nivo 2 — Dio II", 3: "Nivo 3" };

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
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button onClick={() => setLocation("/ilmihal")}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary font-bold text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na Ilmihal
        </button>

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
          <div className="rounded-2xl overflow-hidden mb-5 shadow-sm">
            <img src={parsed.heroImage} alt={lekcija.naslov}
              className="w-full h-auto aspect-[3/2] object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        {/* Accordion sections */}
        {parsed.sections.length > 0 ? (
          <div className="flex flex-col gap-3 mb-6">
            {parsed.sections.map(section => (
              <SectionAccordion key={section.id} section={section} slug={slug!} nivo={lekcija.nivo} />
            ))}
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
  );
}
