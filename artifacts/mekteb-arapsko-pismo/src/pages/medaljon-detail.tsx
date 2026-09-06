import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { Layout } from "@/components/layout";
import { EtapaQuizCard } from "@/components/etapa-quiz-card";
import { ArrowLeft, BookOpen, Loader2, Medal } from "lucide-react";

interface EtapaDetail {
  medaljon: {
    id: number;
    slug: string;
    nivo: number;
    naziv: string;
    opis: string;
    contentHtml: string;
    posAfterRedoslijed: number;
    imaKviz: boolean;
  };
  lekcije: Array<{ id: number; slug: string; naslov: string; redoslijed: number }>;
}

export default function MedaljonDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/medaljon/:slug");
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { t } = useLanguage();
  const slug = params?.slug ?? "";
  const [data, setData] = useState<EtapaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<EtapaDetail>("GET", `/etape/medaljon/${slug}`, undefined, token || undefined)
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, token]);

  if (loading) {
    return <Layout><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div></Layout>;
  }
  if (!data) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="font-bold text-muted-foreground">{t("Etapa nije pronađena")}</p>
          <button className="mt-4 rounded-xl border px-4 py-2" onClick={() => setLocation("/ilmihal")}>{t("Nazad")}</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => setLocation(`/nivo${data.medaljon.nivo}-mapa`)}
          className="mb-5 flex items-center gap-2 font-bold text-amber-800 hover:text-amber-950"
        >
          <ArrowLeft className="h-4 w-4" /> {t("Nazad na mapu")}
        </button>

        <header className="mb-6 rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-100 to-yellow-50 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-500 p-3 text-white"><Medal className="h-8 w-8" /></div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-amber-700">{t("Etapa")} · {t("Nivo {n}", { n: String(data.medaljon.nivo) })}</p>
              <h1 className="text-2xl font-black text-amber-950">{data.medaljon.naziv}</h1>
              {data.medaljon.opis && <p className="mt-2 text-amber-900">{data.medaljon.opis}</p>}
            </div>
          </div>
          {data.medaljon.contentHtml && (
            <div className="prose prose-amber mt-5 max-w-none" dangerouslySetInnerHTML={{ __html: data.medaljon.contentHtml }} />
          )}
        </header>

        <section className="mb-6 rounded-2xl border bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><BookOpen className="h-5 w-5 text-amber-600" /> {t("Lekcije ove etape")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.lekcije.map((lekcija) => (
              <button
                key={lekcija.id}
                onClick={() => setLocation(`/ilmihal/${lekcija.slug}`)}
                className="rounded-xl border px-3 py-2 text-left text-sm font-semibold hover:border-amber-400 hover:bg-amber-50"
              >
                {lekcija.redoslijed}. {lekcija.naslov}
              </button>
            ))}
          </div>
        </section>

        {data.medaljon.imaKviz ? (
          <EtapaQuizCard medaljonLessonSlug={slug} />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center font-bold text-amber-900">
            {t("Kviz za ovu etapu još nije konfigurisan.")}
          </div>
        )}
      </div>
    </Layout>
  );
}
