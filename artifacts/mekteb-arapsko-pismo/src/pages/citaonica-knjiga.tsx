import { useState, useEffect, useMemo } from "react";
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

function extractPages(html: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const pageDivs = doc.querySelectorAll(".page, [data-page]");
  if (pageDivs.length > 0) {
    return Array.from(pageDivs).map(d => d.innerHTML);
  }
  const content = doc.querySelector(".book-content");
  if (content) return [content.innerHTML];
  return [html];
}

export default function CitaonicaKnjigaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const [knjiga, setKnjiga] = useState<Knjiga | null>(null);
  const [allKnjige, setAllKnjige] = useState<KnjigaListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    setCompleted(false);
    setPage(0);
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

  const pages = useMemo(() => {
    if (!knjiga) return [];
    return extractPages(knjiga.contentHtml);
  }, [knjiga]);

  const totalPages = pages.length;
  const progressPct = totalPages > 1 ? Math.round(((page + 1) / totalPages) * 100) : 100;

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

        {/* Nazad */}
        <button
          onClick={() => setLocation("/citaonica")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary font-bold text-base transition-colors px-3 py-1.5 rounded-xl hover:bg-primary/10 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Čitaonica
        </button>

        {/* Naslov + progress */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <span className={`inline-block text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full border mb-4 ${
            isPrica
              ? "text-violet-700 bg-violet-50 border-violet-200"
              : "text-teal-700 bg-teal-50 border-teal-200"
          }`}>
            {isPrica ? "Priča o poslaniku" : "Knjiga"}
          </span>

          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight px-4 mb-3">
            {knjiga.naslov}
          </h1>

          {/* Progress ispod naslova */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-base text-muted-foreground font-semibold">
                Stranica {page + 1} od {totalPages} &mdash; <span className={isPrica ? "text-violet-600" : "text-teal-600"}>{progressPct}% pročitano</span>
              </p>
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-2 rounded-full ${isPrica ? "bg-violet-500" : "bg-teal-500"}`}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Naslovna slika */}
        {knjiga.coverImage && page === 0 && (
          <div className="rounded-2xl overflow-hidden mb-6 shadow-sm border-2 border-violet-200">
            <img
              src={knjiga.coverImage}
              alt={knjiga.naslov}
              className="w-full h-auto aspect-[3/2] object-cover"
            />
          </div>
        )}

        {/* Sadržaj stranice */}
        <motion.div
          key={page}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white rounded-3xl border border-border/50 shadow-sm mb-6 overflow-hidden"
        >
          <div className={`h-1.5 w-full ${isPrica ? "bg-gradient-to-r from-violet-400 to-purple-500" : "bg-gradient-to-r from-teal-400 to-emerald-500"}`} />
          <div className="p-6 md:p-10">
            <div
              className="citaonica-content text-lg leading-[1.9]"
              dangerouslySetInnerHTML={{ __html: pages[page] ?? "" }}
            />
          </div>
        </motion.div>

        {/* Navigacija po stranicama — centrirano */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => { setPage(p => Math.max(0, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={page === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-base transition-all border-2 ${
                page === 0
                  ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                  : isPrica
                    ? "border-violet-300 text-violet-700 hover:bg-violet-50 bg-white"
                    : "border-teal-300 text-teal-700 hover:bg-teal-50 bg-white"
              }`}
            >
              <ChevronLeft className="w-5 h-5" /> Prethodna
            </button>

            <span className="text-base font-bold text-muted-foreground min-w-[80px] text-center">
              {page + 1} / {totalPages}
            </span>

            <button
              onClick={() => { setPage(p => Math.min(totalPages - 1, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={page === totalPages - 1}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-base transition-all border-2 ${
                page === totalPages - 1
                  ? "opacity-30 cursor-not-allowed border-border text-muted-foreground"
                  : isPrica
                    ? "border-violet-300 text-violet-700 hover:bg-violet-50 bg-white"
                    : "border-teal-300 text-teal-700 hover:bg-teal-50 bg-white"
              }`}
            >
              Sljedeća <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Kviz + Označi kao pročitano */}
        <div className="flex flex-wrap items-center gap-3 justify-center mb-8">
          {knjiga.kvizSlug && (
            <Button variant="outline" onClick={() => setLocation(`/kvizovi/${knjiga.kvizSlug}`)} className="rounded-2xl font-bold text-base px-6 py-5">
              📝 Riješi kviz
            </Button>
          )}
          {user && (
            <Button
              onClick={markComplete}
              disabled={completed}
              className={`rounded-2xl px-7 font-bold text-base py-5 ${completed ? "bg-emerald-500 hover:bg-emerald-500" : ""}`}
            >
              {completed
                ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Pročitano!</>
                : <><BookOpen className="w-4 h-4 mr-2" /> Označi kao pročitano</>}
            </Button>
          )}
        </div>

        {/* Prethodna / Sljedeća knjiga — centrirano */}
        {(prevKnjiga || nextKnjiga) && (
          <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-6 mb-4">
            <div>
              {prevKnjiga && (
                <button
                  onClick={() => setLocation(`/citaonica/${prevKnjiga.slug}`)}
                  className="group w-full flex flex-col gap-1 p-4 bg-white rounded-2xl border border-border/50 hover:border-violet-300 hover:shadow-sm transition-all text-left"
                >
                  <span className="flex items-center gap-1 text-sm text-muted-foreground font-bold uppercase tracking-wide">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prethodna
                  </span>
                  <span className="text-base font-bold text-foreground leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
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
                  <span className="flex items-center gap-1 justify-end text-sm text-muted-foreground font-bold uppercase tracking-wide">
                    Sljedeća <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-base font-bold text-foreground leading-snug group-hover:text-violet-700 transition-colors line-clamp-2">
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
