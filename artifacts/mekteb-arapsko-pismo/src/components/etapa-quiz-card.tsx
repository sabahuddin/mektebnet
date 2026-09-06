import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Medal, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";

interface EtapaMeta {
  medaljon: {
    id: number;
    slug: string;
    naziv: string;
    pragProlazaPercent: number;
    brojPitanja: number;
    imaKviz: boolean;
  };
  polozeno: {
    procenat: number;
    brojTacnih: number;
    brojPitanja: number;
  } | null;
  brojPokusaja: number;
}

interface EtapaPitanje {
  id: number;
  pitanje: string;
  opcije: string[];
  slika: string | null;
  vrsta: string;
}

interface StartResponse {
  naziv: string;
  pragProlazaPercent: number;
  pitanja: EtapaPitanje[];
}

interface ResultResponse {
  polozeno: boolean;
  procenat: number;
  brojTacnih: number;
  brojPitanja: number;
  pragProlazaPercent: number;
  pokusajBr: number;
  hasanatGained?: number;
  totalHasanat?: number;
  newBadges?: Array<{
    id: string;
    naziv: string;
    opis: string;
    ikona: string;
    hasanatReward: number;
  }>;
}

export function EtapaQuizCard({ medaljonLessonSlug }: { medaljonLessonSlug: string }) {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [meta, setMeta] = useState<EtapaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pitanja, setPitanja] = useState<EtapaPitanje[]>([]);
  const [odgovori, setOdgovori] = useState<Record<number, number>>({});
  const [rezultat, setRezultat] = useState<ResultResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<EtapaMeta>("GET", `/etape/medaljon/${medaljonLessonSlug}`, undefined, token || undefined)
      .then((data) => { if (!cancelled) setMeta(data); })
      .catch(() => { if (!cancelled) setMeta(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [medaljonLessonSlug, token]);

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> {t("Učitavam završni ispit etape…")}
      </div>
    );
  }
  if (!meta?.medaljon.imaKviz) return null;

  async function start() {
    if (!token) return;
    setStarting(true);
    setRezultat(null);
    setOdgovori({});
    try {
      const data = await apiRequest<StartResponse>(
        "POST",
        `/etape/medaljon/${medaljonLessonSlug}/start`,
        {},
        token,
      );
      setPitanja(data.pitanja);
    } catch (error) {
      toast({
        title: t("Ispit nije dostupan"),
        description: error instanceof Error ? error.message : t("Nije moguće pokrenuti ispit."),
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  }

  async function predaj() {
    if (!token || pitanja.length === 0) return;
    if (Object.keys(odgovori).length < pitanja.length) {
      toast({ title: t("Odgovori na sva pitanja prije predaje.") });
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiRequest<ResultResponse>(
        "POST",
        `/etape/medaljon/${medaljonLessonSlug}/predaj`,
        { odgovori: pitanja.map((p) => ({ pitanjeId: p.id, optionIndex: odgovori[p.id] })) },
        token,
      );
      setRezultat(data);
      setPitanja([]);
      if (data.newBadges?.length) {
        const badgeReward = data.newBadges.reduce((sum, badge) => sum + badge.hasanatReward, 0);
        toast({
          title: data.newBadges.length === 1
            ? t("🎉 Osvojio si bedž!")
            : t("🎉 Osvojio si nove bedževe!"),
          description: `${data.newBadges.map((badge) => `${badge.ikona} ${badge.naziv}`).join(", ")} · +${badgeReward} ${t("kapi meda")} 🍯`,
        });
      }
      if (data.polozeno) {
        setMeta((current) => current ? {
          ...current,
          polozeno: {
            procenat: data.procenat,
            brojTacnih: data.brojTacnih,
            brojPitanja: data.brojPitanja,
          },
          brojPokusaja: data.pokusajBr,
        } : current);
      }
    } catch (error) {
      toast({
        title: t("Greška pri predaji"),
        description: error instanceof Error ? error.message : t("Pokušaj ponovo."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isStudent = user?.role === "ucenik";
  return (
    <section className="mb-6 overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg" data-testid="etapa-quiz-card">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-400 p-3 text-white shadow">
            <Medal className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold text-amber-950">{t("Završni ispit etape")}</h2>
            <p className="mt-1 text-sm text-amber-800">
              {meta.medaljon.naziv} · {t("{broj} pitanja", { broj: String(meta.medaljon.brojPitanja) })} · {t("prag")} {meta.medaljon.pragProlazaPercent}%
            </p>
          </div>
        </div>

        {(meta.polozeno || rezultat) && (
          <div className={`mt-4 rounded-2xl border p-4 font-bold ${
            (rezultat?.polozeno ?? !!meta.polozeno)
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}>
            {(rezultat?.polozeno ?? !!meta.polozeno)
              ? (
                <>
                  <CheckCircle2 className="mr-2 inline h-5 w-5" />
                  {t("Etapa je položena!")} {(rezultat ?? meta.polozeno)?.procenat}%
                  {rezultat && rezultat.hasanatGained ? (
                    <span className="ml-2 text-amber-700">
                      +{rezultat.hasanatGained} {t("kapi meda")} 🍯
                    </span>
                  ) : null}
                </>
              )
              : <>{t("Etapa nije položena")} — {(rezultat ?? meta.polozeno)?.procenat}%</>}
          </div>
        )}

        {!isStudent ? (
          <p className="mt-4 rounded-xl border bg-white/70 p-3 text-sm text-amber-900">
            {t("Prijavi se kao učenik da bi pristupio ispitu.")}
          </p>
        ) : pitanja.length === 0 ? (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 font-extrabold text-white shadow hover:bg-amber-600 disabled:opacity-60"
            data-testid="button-start-etapa-kviz"
          >
            {starting
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : meta.polozeno
                ? <RotateCcw className="h-5 w-5" />
                : <Medal className="h-5 w-5" />}
            {meta.polozeno ? t("Ponovi ispit") : t("Započni ispit")}
          </button>
        ) : (
          <div className="mt-5 space-y-4">
            {pitanja.map((pitanje, index) => (
              <div key={pitanje.id} className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="mb-3 font-bold text-amber-950">{index + 1}. {pitanje.pitanje}</p>
                {pitanje.slika && <img src={pitanje.slika} alt="" className="mx-auto mb-3 max-h-48 rounded-xl" />}
                <div className="space-y-2">
                  {pitanje.opcije.map((opcija, optionIndex) => (
                    <label key={optionIndex} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                      odgovori[pitanje.id] === optionIndex ? "border-amber-500 bg-amber-100" : "border-gray-200 hover:bg-amber-50"
                    }`}>
                      <input
                        type="radio"
                        name={`etapa-${pitanje.id}`}
                        checked={odgovori[pitanje.id] === optionIndex}
                        onChange={() => setOdgovori((current) => ({ ...current, [pitanje.id]: optionIndex }))}
                      />
                      <span className="text-sm">{opcija}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={predaj}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-extrabold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              data-testid="button-submit-etapa-kviz"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              {t("Predaj ispit")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}