import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";

// Opcija B: tanak `/medaljon/:slug` ekran je povučen. Medaljon je sada PUNA
// lekcija (`/ilmihal/medaljon-nivo{N}-{ord}`). Ova komponenta samo preusmjerava
// stare linkove/bookmarke na odgovarajuću lekciju (back-compat).
export default function MedaljonDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/medaljon/:slug");
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const slug = params?.slug ?? "";

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    // Slug je već u formi medaljon-lekcije → idi direktno.
    if (/^medaljon-nivo\d+-\d+$/.test(slug)) {
      setLocation(`/ilmihal/${slug}`, { replace: true });
      return;
    }

    // Inače je stvarni medaljon slug — izračunaj nivo + redni broj iz mape.
    (async () => {
      try {
        const etapa = await apiRequest<{ medaljon: { id: number; nivo: number } }>(
          "GET", `/etape/medaljon/${slug}`, undefined, token || undefined,
        );
        const nivo = etapa.medaljon.nivo;
        const mapa = await apiRequest<{ medaljoni: { id: number; posAfterRedoslijed: number }[] }>(
          "GET", `/mapa/nivo/${nivo}`, undefined, token || undefined,
        );
        const sorted = [...(mapa.medaljoni ?? [])].sort(
          (a, b) => a.posAfterRedoslijed - b.posAfterRedoslijed,
        );
        const idx = sorted.findIndex((m) => m.id === etapa.medaljon.id);
        if (cancelled) return;
        if (idx >= 0) {
          setLocation(`/ilmihal/medaljon-nivo${nivo}-${idx + 1}`, { replace: true });
        } else {
          setLocation(`/nivo${nivo}-mapa`, { replace: true });
        }
      } catch {
        if (!cancelled) setLocation("/nivo1-mapa", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, token, setLocation]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-amber-50">
      <div className="text-amber-800 font-bold">Preusmjeravam…</div>
    </div>
  );
}
