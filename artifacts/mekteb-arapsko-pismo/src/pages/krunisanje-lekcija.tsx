import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen } from "lucide-react";

interface Lekcija {
  id: number;
  krunisanjeId: number;
  slug: string;
  naslov: string;
  contentHtml: string;
  redoslijed: number;
  nivo: number;
}

export default function KrunisanjeLekcijaPage() {
  const [, params] = useRoute<{ slug: string }>("/krunisanje/lekcija/:slug");
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const [lekcija, setLekcija] = useState<Lekcija | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.slug) return;
    apiRequest<Lekcija>("GET", `/krunisanja/lekcija/${params.slug}`, undefined, token || undefined)
      .then(setLekcija)
      .catch(() => setLekcija(null))
      .finally(() => setLoading(false));
  }, [params?.slug, token]);

  if (loading) {
    return <Layout><div className="max-w-2xl mx-auto p-4"><Skeleton className="h-64 rounded-xl" /></div></Layout>;
  }
  if (!lekcija) {
    return <Layout><div className="max-w-2xl mx-auto p-6 text-center text-muted-foreground">Lekcija nije pronađena.</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button
            onClick={() => setLocation(`/krunisanje/${lekcija.nivo ?? 1}`)}
            className="p-2 rounded-lg hover:bg-amber-50 text-amber-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-amber-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Krunska lekcija
          </h1>
        </div>
        <div className="rounded-3xl bg-white border-2 border-amber-100 p-6 shadow">
          <h2 className="text-2xl font-extrabold text-amber-900 mb-4">{lekcija.naslov}</h2>
          <div
            className="prose prose-sm max-w-none prose-headings:text-amber-900"
            dangerouslySetInnerHTML={{ __html: lekcija.contentHtml || "<p class='text-muted-foreground italic'>Sadržaj nije unesen.</p>" }}
          />
        </div>
      </div>
    </Layout>
  );
}
