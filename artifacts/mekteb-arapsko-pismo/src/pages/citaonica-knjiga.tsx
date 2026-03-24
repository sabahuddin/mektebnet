import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Library
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Knjiga {
  id: number;
  slug: string;
  naslov: string;
  kategorija: string;
  contentHtml: string;
  coverImage?: string;
  kvizSlug?: string;
  redoslijed?: number;
}

interface KnjigaListItem {
  id: number;
  slug: string;
  naslov: string;
  kategorija: string;
  redoslijed?: number;
}

export default function CitaonicaKnjigaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const [knjiga, setKnjiga] = useState<Knjiga | null>(null);
  const [allKnjige, setAllKnjige] = useState<KnjigaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("normal");

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    setCompleted(false);
    Promise.all([
      apiRequest<Knjiga>("GET", `/content/knjige/${slug}`),
      apiRequest<KnjigaListItem[]>("GET", "/content/knjige"),
    ])
      .then(([k, lista]) => {
        setKnjiga(k);
        setAllKnjige(lista);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [slug]);

  const markComplete = async () => {
    if (!knjiga || !user) return;
    try {
      await apiRequest("POST", "/content/napredak", {
        contentType: "knjiga",
        contentId: knjiga.id,
        zavrsen: true,
        bodovi: 15,
      }, token);
      setCompleted(true);
    } catch {}
  };

  const currentIdx = allKnjige.findIndex(k => k.slug === slug);
  const prevKnjiga = currentIdx > 0 ? allKnjige[currentIdx - 1] : null;
  const nextKnjiga = currentIdx >= 0 && currentIdx < allKnjige.length - 1 ? allKnjige[currentIdx + 1] : null;

  const FONT_SIZES = {
    normal: "text-lg leading-[1.9]",
    large:  "text-xl leading-[1.9]",
    xlarge: "text-2xl leading-[1.85]",
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-6 w-40 rounded-xl mb-6" />
          <Skeleton className="h-16 rounded-2xl mb-3 w-3/4 mx-auto" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (!knjiga) {
    return (
      <Layout>
        <div className="text-center py-20">
          <Library className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground font-medium">Knjiga nije pronađena</p>
          <Button className="mt-4" onClick={() => setLocation("/citaonica")}>Na Čitaonicu</Button>
        </div>
      </Layout>
    );
  }

  const isPrica = knjiga.kategorija === "prica";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">

        {/* Back nav */}
        <button
          onClick={() => setLocation("/citaonica")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary font-bold text-sm transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/10 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Čitaonica
        </button>

        {/* Title card — centred */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <span className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border mb-4 ${
            isPrica
              ? "text-violet-700 bg-violet-50 border-violet-200"
              : "text-teal-700 bg-teal-50 border-teal-200"
          }`}>
            {isPrica ? "Priča o poslaniku" : "Knjiga"}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight px-4">
            {knjiga.naslov}
          </h1>
          {allKnjige.length > 0 && currentIdx >= 0 && (
            <p className="text-xs text-muted-foreground mt-2 font-medium">
              {currentIdx + 1} / {allKnjige.length}
            </p>
          )}
        </motion.div>

        {/* Cover image */}
        {knjiga.coverImage && (
          <div className="rounded-2xl overflow-hidden mb-6 shadow-sm border-2 border-violet-200">
            <img
              src={knjiga.coverImage}
              alt={knjiga.naslov}
              className="w-full h-auto aspect-[3/2] object-cover"
            />
          </div>
        )}

        {/* Font size controls */}
        <div className="flex items-center justify-end gap-1 mb-3">
          <span className="text-xs text-muted-foreground mr-2 font-medium">Veličina teksta:</span>
          {(["normal", "large", "xlarge"] as const).map(size => (
            <button
              key={size}
              onClick={() => setFontSize(size)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${
                fontSize === size
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-muted-foreground border-border hover:border-violet-400"
              }`}
            >
              {size === "normal" ? "A" : size === "large" ? "A+" : "A++"}
            </button>
          ))}
        </div>

        {/* Book content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl border border-border/50 shadow-sm mb-6 overflow-hidden"
        >
          {/* Decorative top strip */}
          <div className={`h-1.5 w-full ${isPrica ? "bg-gradient-to-r from-violet-400 to-purple-500" : "bg-gradient-to-r from-teal-400 to-emerald-500"}`} />

          <div className="p-6 md:p-10">
            <div
              className={`citaonica-content ${FONT_SIZES[fontSize]}`}
              dangerouslySetInnerHTML={{ __html: knjiga.contentHtml }}
            />
          </div>
        </motion.div>

        {/* Bottom actions: kviz + mark complete */}
        <div className="flex flex-wrap items-center gap-3 justify-end mb-8">
          {knjiga.kvizSlug && (
            <Button variant="outline" onClick={() => setLocation(`/kvizovi/${knjiga.kvizSlug}`)} className="rounded-2xl font-bold">
              📝 Riješi kviz
            </Button>
          )}
          {user && (
            <Button
              onClick={markComplete}
              disabled={completed}
              className={`rounded-2xl px-7 font-bold ${completed ? "bg-emerald-500 hover:bg-emerald-500" : ""}`}
            >
              {completed
                ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Pročitano!</>
                : <><BookOpen className="w-4 h-4 mr-2" /> Označi kao pročitano</>}
            </Button>
          )}
        </div>

        {/* Prev / Next navigation */}
        {(prevKnjiga || nextKnjiga) && (
          <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-6 mb-4">
            <div>
              {prevKnjiga && (
                <button
                  onClick={() => setLocation(`/citaonica/${prevKnjiga.slug}`)}
                  className="group w-full flex flex-col gap-1 p-4 bg-white rounded-2xl border border-border/50 hover:border-violet-300 hover:shadow-sm transition-all text-left"
                >
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-bold uppercase tracking-wide">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prethodna
                  </span>
                  <span className="text-sm font-bold text-foreground leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
                    {prevKnjiga.naslov}
                  </span>
                </button>
              )}
            </div>
            <div>
              {nextKnjiga && (
                <button
                  onClick={() => setLocation(`/citaonica/${nextKnjiga.slug}`)}
                  className="group w-full flex flex-col gap-1 p-4 bg-white rounded-2xl border border-border/50 hover:border-violet-300 hover:shadow-sm transition-all text-right"
                >
                  <span className="flex items-center gap-1 justify-end text-xs text-muted-foreground font-bold uppercase tracking-wide">
                    Sljedeća <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm font-bold text-foreground leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
                    {nextKnjiga.naslov}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
