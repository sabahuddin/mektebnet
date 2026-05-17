import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardList, Lock, Medal, Sparkles, Trophy } from "lucide-react";

interface MedaljonFull {
  id: number;
  slug: string;
  nivo: number;
  naziv: string;
  opis: string;
  ikona: string;
  boja: string;
  contentHtml: string;
  posAfterRedoslijed: number;
  pragProlazaPercent: number;
  isGating: boolean;
  brojPitanja: number;
  imaKviz: boolean;
}

interface EtapaLekcija { id: number; slug: string; naslov: string; redoslijed: number }

interface EtapaData {
  medaljon: MedaljonFull;
  lekcije: EtapaLekcija[];
  polozeno: null | { id: number; procenat: number; brojTacnih: number; brojPitanja: number; polozenoAt: string };
  brojPokusaja: number;
}

interface Pitanje { id: number; pitanje: string; opcije: string[]; slika: string | null; vrsta: string }

interface MapaSlim {
  zavrsene: number[];
  osvojeniMedaljoni: number[];
}

const BOJE: Record<string, { from: string; to: string; ring: string; text: string }> = {
  emerald: { from: "from-emerald-300", to: "to-emerald-600", ring: "ring-emerald-200", text: "text-emerald-900" },
  sky:     { from: "from-sky-300",     to: "to-sky-600",     ring: "ring-sky-200",     text: "text-sky-900" },
  amber:   { from: "from-amber-300",   to: "to-amber-600",   ring: "ring-amber-200",   text: "text-amber-900" },
  orange:  { from: "from-orange-300",  to: "to-orange-600",  ring: "ring-orange-200",  text: "text-orange-900" },
  yellow:  { from: "from-yellow-300",  to: "to-yellow-500",  ring: "ring-yellow-200",  text: "text-yellow-900" },
};

function reducedMotionAktivan(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pucajKonfete() {
  if (reducedMotionAktivan()) return;
  const defaults = { spread: 70, ticks: 90, gravity: 1, decay: 0.92, startVelocity: 35, scalar: 1.1 };
  const fire = (x: number, particleRatio: number, opts: confetti.Options) => {
    confetti({
      ...defaults, ...opts, origin: { x, y: 0.6 },
      particleCount: Math.floor(140 * particleRatio),
      colors: ["#fbbf24", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7"],
    });
  };
  fire(0.25, 0.25, { spread: 26, startVelocity: 55 });
  fire(0.5, 0.35, { spread: 100 });
  fire(0.75, 0.25, { spread: 26, startVelocity: 55 });
  fire(0.5, 0.15, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.4 });
}

export default function MedaljonDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/medaljon/:slug");
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const slug = params?.slug ?? "";

  const [etapa, setEtapa] = useState<EtapaData | null>(null);
  const [mapa, setMapa] = useState<MapaSlim | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [tab, setTab] = useState<"aktivnost" | "ispit">("aktivnost");

  // Ispit state
  const [pitanja, setPitanja] = useState<Pitanje[] | null>(null);
  const [odgovori, setOdgovori] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rezultat, setRezultat] = useState<{ polozeno: boolean; procenat: number; brojTacnih: number; brojPitanja: number; medaljonClaimed?: boolean } | null>(null);
  const [justEarned, setJustEarned] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (confettiTimerRef.current !== null) clearTimeout(confettiTimerRef.current);
  }, []);

  useEffect(() => {
    if (!slug) return;
    setIsLoading(true);
    const promises: [Promise<EtapaData | null>, Promise<MapaSlim | null>] = [
      apiRequest<EtapaData>("GET", `/etape/medaljon/${slug}`, undefined, token || undefined).catch(() => null),
      apiRequest<MapaSlim>("GET", `/mapa/nivo/${etapa?.medaljon.nivo ?? 1}`, undefined, token || undefined).catch(() => null),
    ];
    Promise.all(promises).then(([e, m]) => {
      setEtapa(e);
      setMapa(m);
    }).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token]);

  // Re-load mapa once etapa.nivo is known (mapa nivo se zna tek nakon prvog odgovora etape)
  useEffect(() => {
    if (!etapa?.medaljon.nivo) return;
    apiRequest<MapaSlim>("GET", `/mapa/nivo/${etapa.medaljon.nivo}`, undefined, token || undefined)
      .then(setMapa).catch(() => {});
  }, [etapa?.medaljon.nivo, token]);

  const medaljon = etapa?.medaljon ?? null;
  const earned = medaljon && mapa ? mapa.osvojeniMedaljoni.includes(medaljon.id) : false;
  const zavrseneCount = mapa?.zavrsene.length ?? 0;
  const lekcijeUnlocked = medaljon ? zavrseneCount >= medaljon.posAfterRedoslijed : false;
  const isUcenik = user?.role === "ucenik";

  async function startIspit() {
    if (!medaljon || !token) return;
    try {
      const data = await apiRequest<{ pitanja: Pitanje[] }>("POST", `/etape/medaljon/${medaljon.slug}/start`, {}, token);
      setPitanja(data.pitanja);
      setOdgovori({});
      setRezultat(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Ne mogu pokrenuti ispit", description: msg, variant: "destructive" });
    }
  }

  async function predaj() {
    if (!medaljon || !token || !pitanja || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        odgovori: Object.entries(odgovori).map(([pid, idx]) => ({ pitanjeId: Number(pid), optionIndex: idx })),
      };
      const res = await apiRequest<{ polozeno: boolean; procenat: number; brojTacnih: number; brojPitanja: number; medaljonClaimed: boolean }>(
        "POST", `/etape/medaljon/${medaljon.slug}/predaj`, payload, token,
      );
      setRezultat(res);
      if (res.polozeno) {
        if (res.medaljonClaimed) {
          setJustEarned(true);
          setMapa((prev) => prev ? { ...prev, osvojeniMedaljoni: [...new Set([...prev.osvojeniMedaljoni, medaljon.id])] } : prev);
          pucajKonfete();
          if (!reducedMotionAktivan()) {
            confettiTimerRef.current = setTimeout(() => { pucajKonfete(); confettiTimerRef.current = null; }, 600);
          }
        }
        toast({ title: "Položeno!", description: `${res.procenat}% — ${res.brojTacnih}/${res.brojPitanja}` });
      } else {
        toast({ title: "Nije položeno", description: `${res.procenat}% — potrebno ${medaljon.pragProlazaPercent}%`, variant: "destructive" });
      }
      // Refresh polozeno status
      apiRequest<EtapaData>("GET", `/etape/medaljon/${medaljon.slug}`, undefined, token).then(setEtapa).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Greška pri predaji", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // Legacy claim (samo kad ne postoji kviz — back-compat)
  async function claimLegacy() {
    if (!medaljon || !token || isClaiming) return;
    setIsClaiming(true);
    try {
      const r = await apiRequest<{ ok: boolean; vecOsvojen: boolean }>(
        "POST", `/mapa/medaljon/${medaljon.slug}/claim`, undefined, token,
      );
      if (r.ok && !r.vecOsvojen) {
        setJustEarned(true);
        pucajKonfete();
        setMapa((prev) => prev ? { ...prev, osvojeniMedaljoni: [...new Set([...prev.osvojeniMedaljoni, medaljon.id])] } : prev);
      }
      toast({ title: r.vecOsvojen ? "Već si osvojio" : `Bravo! ${medaljon.naziv}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Greška", description: msg, variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4">
          <Skeleton className="h-12 mb-4 rounded-xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (!medaljon) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-4 text-center">
          <p className="text-muted-foreground">Medaljon nije pronađen.</p>
          <button onClick={() => setLocation("/nivo1-mapa")} className="mt-4 text-emerald-700 font-bold underline">
            Nazad na mapu
          </button>
        </div>
      </Layout>
    );
  }

  const boje = BOJE[medaljon.boja] ?? BOJE.amber;
  const sviOdgovoreni = pitanja ? pitanja.every((p) => odgovori[p.id] !== undefined) : false;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 pb-10">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button onClick={() => setLocation(`/nivo${medaljon.nivo}-mapa`)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700" data-testid="button-nazad-mapa">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-emerald-900 truncate">Etapa: {medaljon.naziv}</h1>
        </div>

        {/* Hero medaljon */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className={`relative rounded-3xl bg-gradient-to-br from-white via-amber-50 to-orange-50 border-2 ${boje.ring} ring-4 ring-white p-6 shadow-2xl text-center overflow-hidden`}
        >
          {(earned || justEarned) && (
            <motion.div className="absolute inset-0 -z-0" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ background: "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 60%)" }} />
          )}
          <motion.div
            animate={earned || justEarned ? { y: [0, -6, 0] } : {}}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className={`mx-auto w-28 h-28 rounded-full bg-gradient-to-br ${boje.from} ${boje.to} ring-8 ring-white shadow-2xl flex items-center justify-center ${
              !lekcijeUnlocked ? "opacity-50 grayscale" : ""
            }`}
          >
            <img
              src={`${import.meta.env.BASE_URL}medaljoni/nivo${medaljon.nivo}-${medaljon.posAfterRedoslijed}-lekcija.png?v=2`}
              alt={medaljon.naziv}
              className="w-24 h-24 object-contain drop-shadow-lg"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = 'none';
              }}
            />
            {!lekcijeUnlocked && <Lock className="absolute w-10 h-10 text-white/90" />}
          </motion.div>
          <h2 className={`mt-4 text-2xl font-extrabold ${boje.text}`} data-testid="text-medaljon-naziv">{medaljon.naziv}</h2>
          <p className="mt-2 text-sm text-amber-800/80 px-2">{medaljon.opis}</p>

          {/* Status pill */}
          <div className="mt-4">
            {earned || justEarned ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500 text-white px-4 py-2 font-bold text-sm shadow">
                <Trophy className="w-4 h-4" /> Osvojen
              </div>
            ) : !lekcijeUnlocked ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-gray-200 text-gray-700 px-4 py-2 font-bold text-sm">
                <Lock className="w-4 h-4" />
                Završi {medaljon.posAfterRedoslijed - zavrseneCount} {medaljon.posAfterRedoslijed - zavrseneCount === 1 ? "lekciju" : "lekcija"} više
              </div>
            ) : medaljon.imaKviz ? (
              <button onClick={() => setTab("ispit")} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2 font-bold text-sm shadow hover:bg-emerald-700">
                <ClipboardList className="w-4 h-4" /> Pristupi završnom ispitu
              </button>
            ) : isUcenik ? (
              <button onClick={claimLegacy} disabled={isClaiming}
                className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-br ${boje.from} ${boje.to} text-white px-6 py-3 font-extrabold shadow-lg hover:scale-105 transition-transform disabled:opacity-60`}>
                <Sparkles className="w-5 h-5" /> {isClaiming ? "Osvajam..." : "Osvoji medaljon"}
              </button>
            ) : (
              <p className="text-sm text-amber-800/70">Prijavi se kao učenik da osvojiš medaljon.</p>
            )}
          </div>
        </motion.div>

        {/* Gating info */}
        {medaljon.isGating && medaljon.imaKviz && !earned && (
          <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900 flex items-start gap-2">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Naredne lekcije su zaključane dok ne položiš završni ispit ove etape.</span>
          </div>
        )}

        {/* Tabovi */}
        <div className="mt-6 flex gap-1 bg-muted/40 p-1 rounded-xl">
          {([
            { key: "aktivnost", label: "Sadržaj i ponavljanje", icon: <BookOpen className="w-4 h-4" /> },
            { key: "ispit", label: `Završni ispit${medaljon.brojPitanja ? ` (${medaljon.brojPitanja})` : ""}`, icon: <ClipboardList className="w-4 h-4" /> },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition ${
                tab === t.key ? "bg-white shadow text-emerald-900" : "text-muted-foreground hover:text-emerald-900"
              }`}
              data-testid={`tab-${t.key}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* TAB: Aktivnost */}
        {tab === "aktivnost" && (
          <div className="mt-4 space-y-4">
            {medaljon.contentHtml ? (
              <div className="rounded-2xl bg-white border-2 border-emerald-100 p-5 prose prose-sm max-w-none prose-headings:text-emerald-900"
                dangerouslySetInnerHTML={{ __html: medaljon.contentHtml }} />
            ) : null}
            {etapa && etapa.lekcije.length > 0 && (
              <div className="rounded-2xl bg-white border border-emerald-100 p-4">
                <h3 className="font-extrabold text-emerald-900 mb-3">Lekcije koje pokriva ova etapa</h3>
                <div className="space-y-1">
                  {etapa.lekcije.map((l) => (
                    <Link key={l.id} href={`/ilmihal/${l.slug}`} className="block px-3 py-2 rounded-lg hover:bg-emerald-50 text-emerald-900 font-medium" data-testid={`link-etapa-lekcija-${l.id}`}>
                      {l.naslov}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!medaljon.contentHtml && (!etapa || etapa.lekcije.length === 0) && (
              <div className="rounded-2xl bg-emerald-50/60 border-2 border-dashed border-emerald-200 p-5 text-center text-sm text-emerald-800/70">
                Sadržaj aktivnosti za ovaj medaljon će uskoro biti dodan.
              </div>
            )}
          </div>
        )}

        {/* TAB: Završni ispit */}
        {tab === "ispit" && (
          <div className="mt-4 space-y-4">
            {!medaljon.imaKviz ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                Završni ispit još nije konfigurisan. Obavijesti muallima.
              </div>
            ) : !lekcijeUnlocked ? (
              <div className="rounded-xl bg-gray-100 border border-gray-200 p-4 text-sm text-gray-800 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Prvo završi sve lekcije etape, pa onda pristupi ispitu.
              </div>
            ) : !isUcenik ? (
              <div className="rounded-xl bg-gray-50 border p-4 text-sm">Prijavi se kao učenik da pristupiš ispitu.</div>
            ) : (
              <>
                {etapa?.polozeno && (
                  <div className="rounded-xl bg-green-50 border-2 border-green-300 p-3 text-sm text-green-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      Već si položio ovaj ispit ({etapa.polozeno.procenat}% — {etapa.polozeno.brojTacnih}/{etapa.polozeno.brojPitanja}).
                      {etapa.brojPokusaja > 1 && ` Pokušaja: ${etapa.brojPokusaja}.`}
                    </span>
                  </div>
                )}

                {!pitanja ? (
                  <button onClick={startIspit} className="w-full px-6 py-4 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg shadow-lg hover:bg-emerald-700"
                    data-testid="button-start-ispit">
                    {etapa?.polozeno ? "Ponovi ispit" : "Započni ispit"} — {medaljon.brojPitanja} pitanja (prag {medaljon.pragProlazaPercent}%)
                  </button>
                ) : (
                  <>
                    {pitanja.map((p, idx) => (
                      <div key={p.id} className="bg-white border border-emerald-100 rounded-xl p-4">
                        <div className="font-bold text-emerald-900 mb-2">{idx + 1}. {p.pitanje}</div>
                        {p.slika && <img src={p.slika} alt="" className="my-2 max-h-40 mx-auto rounded" />}
                        <div className="space-y-2">
                          {p.opcije.map((opt, oi) => (
                            <label key={oi} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                              odgovori[p.id] === oi ? "bg-emerald-100 border-emerald-400" : "bg-white border-gray-200 hover:bg-emerald-50"
                            }`}>
                              <input type="radio" name={`p${p.id}`} checked={odgovori[p.id] === oi}
                                onChange={() => setOdgovori((o) => ({ ...o, [p.id]: oi }))}
                                data-testid={`radio-pitanje-${p.id}-${oi}`} />
                              <span className="text-sm">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {rezultat && (
                      <div className={`rounded-xl p-4 font-bold text-center ${
                        rezultat.polozeno ? "bg-green-100 text-green-900 border-2 border-green-400" : "bg-red-50 text-red-900 border-2 border-red-300"
                      }`}>
                        {rezultat.polozeno ? (
                          <><CheckCircle2 className="w-5 h-5 inline mr-2" /> Položeno {rezultat.procenat}% ({rezultat.brojTacnih}/{rezultat.brojPitanja})!</>
                        ) : (
                          <><Lock className="w-5 h-5 inline mr-2" /> Nije položeno: {rezultat.procenat}%. Potrebno {medaljon.pragProlazaPercent}%.</>
                        )}
                      </div>
                    )}
                    <button onClick={predaj} disabled={!sviOdgovoreni || submitting}
                      className="w-full px-6 py-3 rounded-xl bg-emerald-600 text-white font-extrabold shadow disabled:opacity-50"
                      data-testid="button-predaj-ispit">
                      {submitting ? "Predajem..." : "Predaj ispit"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
