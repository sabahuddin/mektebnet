import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Knjiga {
  id: number;
  naslov: string;
  tip: string;
  contentHtml: string;
  kvizSlug?: string;
}

export default function CitaonicaKnjigaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const [knjiga, setKnjiga] = useState<Knjiga | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!slug) return;
    apiRequest<Knjiga>("GET", `/content/knjige/${slug}`)
      .then(setKnjiga)
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

  if (isLoading) return <Layout><div className="max-w-3xl mx-auto"><Skeleton className="h-96 rounded-3xl" /></div></Layout>;
  if (!knjiga) return <Layout><div className="text-center py-20 text-muted-foreground">Knjiga nije pronađena</div></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setLocation("/citaonica")} className="flex items-center gap-2 text-muted-foreground hover:text-primary font-medium mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na Čitaonicu
        </button>

        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-600 bg-violet-50 px-3 py-1 rounded-full border border-violet-200">
            {knjiga.tip === "price" ? "Priča o poslaniku" : "Knjiga"}
          </span>
          <h1 className="text-2xl font-extrabold text-foreground mt-3">{knjiga.naslov}</h1>
        </div>

        <div className="bg-white rounded-3xl border border-border/50 shadow-sm p-6 md:p-10 mb-6">
          <div className="prose prose-sm max-w-none text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: knjiga.contentHtml }} />
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end">
          {knjiga.kvizSlug && (
            <Button variant="outline" onClick={() => setLocation(`/kvizovi/${knjiga.kvizSlug}`)} className="rounded-2xl font-bold">
              Riješi kviz uz ovu knjigu
            </Button>
          )}
          {user && (
            <Button onClick={markComplete} disabled={completed}
              className={`rounded-2xl px-8 font-bold ${completed ? "bg-emerald-500" : ""}`}>
              {completed ? <><CheckCircle2 className="w-5 h-5 mr-2" /> Završeno!</> : <><BookOpen className="w-5 h-5 mr-2" /> Označi kao pročitano</>}
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
