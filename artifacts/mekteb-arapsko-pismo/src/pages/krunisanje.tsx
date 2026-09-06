import { useEffect, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Crown, BookOpen, Lock, Trophy, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/language";

interface Krunisanje {
  id: number;
  nivo: number;
  naslov: string;
  opisHtml: string;
  ikona: string;
  boja: string;
  pragProlazaPercent: number;
  isGating: boolean;
  brojPitanja: number;
  imaKviz: boolean;
}

interface KrunskaLekcija {
  id: number;
  slug: string;
  naslov: string;
  redoslijed: number;
}

interface Pitanje {
  id: number;
  pitanje: string;
  opcije: string[];
  slika: string | null;
  vrsta: string;
}

interface Polozeno {
  polozenoAt: string;
  procenat: number;
  brojTacnih: number;
  brojPitanja: number;
}

export default function KrunisanjeNivoPage() {
  const [, params] = useRoute<{ nivo: string }>("/krunisanje/:nivo");
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const nivo = Number(params?.nivo ?? "1");

  const [krunisanje, setKrunisanje] = useState<Krunisanje | null>(null);
  const [lekcije, setLekcije] = useState<KrunskaLekcija[]>([]);
  const [polozeno, setPolozeno] = useState<Polozeno | null>(null);
  const [loading, setLoading] = useState(true);

  // Kviz state
  const [kvizActive, setKvizActive] = useState(false);
  const [pitanja, setPitanja] = useState<Pitanje[]>([]);
  const [odgovori, setOdgovori] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rezultat, setRezultat] = useState<{
    polozeno: boolean;
    procenat: number;
    brojTacnih: number;
    brojPitanja: number;
    hasanatGained?: number;
    newBadges?: Array<{
      id: string;
      naziv: string;
      ikona: string;
      hasanatReward: number;
    }>;
  } | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivo, token]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<{ krunisanje: Krunisanje; lekcije: KrunskaLekcija[]; polozeno: Polozeno | null }>(
        "GET",
        `/krunisanja/nivo/${nivo}`,
        undefined,
        token || undefined,
      );
      setKrunisanje(data.krunisanje);
      setLekcije(data.lekcije);
      setPolozeno(data.polozeno);
    } catch {
      setKrunisanje(null);
    } finally {
      setLoading(false);
    }
  }

  async function startKviz() {
    if (!krunisanje || !token) return;
    try {
      const data = await apiRequest<{ pitanja: Pitanje[] }>(
        "POST",
        `/krunisanja/${krunisanje.id}/start`,
        {},
        token,
      );
      setPitanja(data.pitanja);
      setOdgovori({});
      setRezultat(null);
      setKvizActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška"), description: msg, variant: "destructive" });
    }
  }

  async function predaj() {
    if (!krunisanje || !token || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        odgovori: Object.entries(odgovori).map(([pid, idx]) => ({
          pitanjeId: Number(pid),
          optionIndex: idx,
        })),
      };
      const res = await apiRequest<{
        polozeno: boolean;
        procenat: number;
        brojTacnih: number;
        brojPitanja: number;
        hasanatGained?: number;
        newBadges?: Array<{
          id: string;
          naziv: string;
          ikona: string;
          hasanatReward: number;
        }>;
      }>(
        "POST",
        `/krunisanja/${krunisanje.id}/predaj`,
        payload,
        token,
      );
      setRezultat(res);
      if (res.newBadges?.length) {
        const badgeReward = res.newBadges.reduce((sum, badge) => sum + badge.hasanatReward, 0);
        toast({
          title: res.newBadges.length === 1
            ? t("🎉 Osvojio si bedž!")
            : t("🎉 Osvojio si nove bedževe!"),
          description: `${res.newBadges.map((badge) => `${badge.ikona} ${badge.naziv}`).join(", ")} · +${badgeReward} ${t("kapi meda")} 🍯`,
        });
      }
      if (res.polozeno) {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        toast({ title: t("Bravo!"), description: t("Krunisanje nivoa {nivo} položeno! {procenat}%", { nivo: String(nivo), procenat: String(res.procenat) }) });
        await load();
      } else {
        toast({ title: t("Nije položeno"), description: t("{procenat}% — potrebno {prag}%", { procenat: String(res.procenat), prag: String(krunisanje.pragProlazaPercent) }), variant: "destructive" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška pri predaji"), description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Layout><div className="max-w-3xl mx-auto p-4"><Skeleton className="h-64 rounded-2xl" /></div></Layout>;
  }
  if (!krunisanje) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-muted-foreground">{t("Krunisanje za ovaj nivo nije pronađeno.")}</p>
        </div>
      </Layout>
    );
  }

  const sviOdgovoreni = pitanja.every((p) => odgovori[p.id] !== undefined);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button onClick={() => setLocation(`/nivo${nivo}-mapa`)} className="p-2 rounded-lg hover:bg-amber-50 text-amber-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-amber-900">{t("Krunisanje nivoa {nivo}", { nivo: String(nivo) })}</h1>
        </div>

        {/* Hero */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative rounded-3xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 ring-4 ring-white ring-amber-100 p-6 shadow-2xl text-center overflow-hidden"
        >
          <div className="mx-auto w-28 h-28 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 ring-8 ring-white shadow-2xl flex items-center justify-center">
            <Crown className="w-14 h-14 text-white drop-shadow-lg" strokeWidth={2.5} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-amber-900">
            {krunisanje.naslov || t("Krunisanje nivoa {nivo}", { nivo: String(nivo) })}
          </h2>
          {polozeno && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500 text-white px-4 py-2 font-bold text-sm shadow">
              <Trophy className="w-4 h-4" /> {t("Položeno")} {polozeno.procenat}% ({polozeno.brojTacnih}/{polozeno.brojPitanja})
            </div>
          )}
        </motion.div>

        {/* Opis */}
        {krunisanje.opisHtml && (
          <div
            className="mt-5 rounded-2xl bg-white border border-amber-100 p-5 prose prose-sm max-w-none prose-headings:text-amber-900"
            dangerouslySetInnerHTML={{ __html: krunisanje.opisHtml }}
          />
        )}

        {/* Krunske lekcije */}
        {lekcije.length > 0 && (
          <section className="mt-6">
            <h3 className="font-extrabold text-amber-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> {t("Dodatne lekcije pred krunisanje")}
            </h3>
            <div className="space-y-2">
              {lekcije.map((l) => (
                <Link
                  key={l.id}
                  href={`/krunisanje/lekcija/${l.slug}`}
                  className="block bg-white border border-amber-100 rounded-xl p-3 hover:bg-amber-50 font-bold text-amber-900"
                  data-testid={`link-krunska-lekcija-${l.id}`}
                >
                  {l.naslov}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Završni ispit */}
        <section className="mt-6">
          <h3 className="font-extrabold text-amber-900 mb-3 flex items-center gap-2">
            <Crown className="w-5 h-5" /> {t("Završni ispit krunisanja")}
          </h3>
          {!krunisanje.imaKviz ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              {t("Završni ispit još nije konfigurisan. Obavijesti muallima/admina.")}
            </div>
          ) : !user || user.role !== "ucenik" ? (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
              {t("Prijavi se kao učenik da bi pristupio ispitu ({broj} pitanja, prag {prag}%).", { broj: String(krunisanje.brojPitanja), prag: String(krunisanje.pragProlazaPercent) })}
            </div>
          ) : !kvizActive ? (
            <button
              onClick={startKviz}
              className="w-full px-6 py-4 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white font-extrabold text-lg shadow-lg hover:scale-[1.02] transition"
              data-testid="button-start-krunisanje"
            >
              {polozeno ? t("Ponovi ispit") : t("Započni ispit")} — {t("{broj} pitanja", { broj: String(krunisanje.brojPitanja) })}
            </button>
          ) : (
            <div className="space-y-4">
              {pitanja.map((p, idx) => (
                <div key={p.id} className="bg-white border border-amber-100 rounded-xl p-4">
                  <div className="font-bold text-amber-900 mb-2">
                    {idx + 1}. {p.pitanje}
                  </div>
                  {p.slika && <img src={p.slika} alt="" className="my-2 max-h-40 mx-auto rounded" />}
                  <div className="space-y-2">
                    {p.opcije.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                          odgovori[p.id] === oi ? "bg-amber-100 border-amber-400" : "bg-white border-gray-200 hover:bg-amber-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`p${p.id}`}
                          checked={odgovori[p.id] === oi}
                          onChange={() => setOdgovori((o) => ({ ...o, [p.id]: oi }))}
                          data-testid={`radio-pitanje-${p.id}-${oi}`}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {rezultat && (
                <div className={`rounded-xl p-4 font-bold text-center ${rezultat.polozeno ? "bg-green-100 text-green-900 border-2 border-green-400" : "bg-red-50 text-red-900 border-2 border-red-300"}`}>
                  {rezultat.polozeno ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 inline mr-2" /> {t("Položeno!")} {rezultat.procenat}% ({rezultat.brojTacnih}/{rezultat.brojPitanja})
                      {rezultat.hasanatGained ? (
                        <span className="ml-2 text-amber-700">
                          +{rezultat.hasanatGained} {t("kapi meda")} 🍯
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <><Lock className="w-5 h-5 inline mr-2" /> {t("Nije položeno:")} {rezultat.procenat}%. {t("Potrebno {prag}%.", { prag: String(krunisanje.pragProlazaPercent) })}</>
                  )}
                </div>
              )}
              <button
                onClick={predaj}
                disabled={!sviOdgovoreni || submitting}
                className="w-full px-6 py-3 rounded-xl bg-amber-600 text-white font-extrabold shadow disabled:opacity-50"
                data-testid="button-predaj-krunisanje"
              >
                {submitting ? "Predajem..." : "Predaj ispit"}
              </button>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
