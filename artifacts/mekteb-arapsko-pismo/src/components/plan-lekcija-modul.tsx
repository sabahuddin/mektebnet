import { useEffect, useState } from "react";
import { Calendar, Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface PlanLekcija {
  id: number;
  grupaId?: number;
  datum: string;
  lekcijaNaslov: string;
  opisCasa: string | null;
  lekcijaTip: string;
  redoslijed: number;
  // Redni broj časa tog dana (1-baziran); server ga izvodi iz `redoslijed`.
  cas?: number;
}

export interface PlanIlmihalLekcija {
  id: number;
  naslov: string;
  izvorniNaslov?: string;
  nivo: number;
  slug?: string;
}

interface KalendarUnos {
  datum: string;
  tip: string;
}

/** Najviše časova po danu; isti broj čuva i server pri upisu plana. */
export const MAX_CASOVA = 8;

/**
 * Vrsta časa se veže uz pojedini čas, pa isti dan može imati obradu lekcije na
 * prvom i provjeru na drugom času.
 */
export const VRSTE_CASA = [
  { kljuc: "obrada", naziv: "Obrada" },
  { kljuc: "ponavljanje", naziv: "Ponavljanje" },
  { kljuc: "provjera", naziv: "Provjera" },
  { kljuc: "test", naziv: "Test" },
  { kljuc: "prakticno", naziv: "Praktično" },
  { kljuc: "ilmihal", naziv: "Ilmihal" },
] as const;

interface Props {
  grupaId: number;
  /** Arhivirana grupa — plan se samo čita. */
  readOnly?: boolean;
  /** Prečica na modul Kalendar kad grupa nema upisanih dana nastave. */
  onOtvoriKalendar?: () => void;
}

/**
 * Plan lekcija po danima nastave. Dani dolaze iz kalendara grupe (tip
 * "mekteb"), pa svaki dan stoji u spisku i prije nego što je plan upisan —
 * prazan dan se vidi kao „Plan nije upisan”. Svaki dan ima najmanje dva časa
 * (1. i 2.), a muallim može dodati i naredne.
 */
export function PlanLekcijaModul({ grupaId, readOnly = false, onOtvoriKalendar }: Props) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [plan, setPlan] = useState<PlanLekcija[]>([]);
  const [lekcije, setLekcije] = useState<PlanIlmihalLekcija[]>([]);
  const [kalendar, setKalendar] = useState<KalendarUnos[]>([]);
  const [loading, setLoading] = useState(true);
  const [prikaz, setPrikaz] = useState<"nadolazeci" | "svi">("nadolazeci");
  // Radne vrijednosti po jednom času: ključ je `${datum}#${cas}`.
  const [unosi, setUnosi] = useState<Record<string, { opis: string; lekcija: string; tip: string }>>({});
  const [dodatniCasovi, setDodatniCasovi] = useState<Record<string, number>>({});
  const [cuvaCas, setCuvaCas] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !grupaId) return;
    setLoading(true);
    setUnosi({});
    setDodatniCasovi({});
    Promise.all([
      apiRequest<PlanLekcija[]>("GET", `/muallim/plan-lekcija?grupaId=${grupaId}`, undefined, token),
      apiRequest<PlanIlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
      apiRequest<KalendarUnos[]>("GET", `/muallim/kalendar?grupaId=${grupaId}`, undefined, token).catch(() => []),
    ]).then(([p, l, k]) => {
      setPlan(p);
      setLekcije(l);
      setKalendar(k);
    }).catch(() => {
      toast({ title: t("Greška"), description: t("Plan lekcija nije moguće učitati"), variant: "destructive" });
    }).finally(() => setLoading(false));
    // toast i t su stabilni; ponovo učitavamo samo kad se promijeni grupa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, grupaId]);

  // Server prepisuje postojeći unos za isti dan i čas, pa isto dugme radi i za
  // prvi upis i za izmjenu.
  async function sacuvajCas(datum: string, cas: number, opis: string, lekcija: string, tip: string) {
    const naslov = lekcija.trim() || opis.trim();
    if (!token || !naslov) return;
    const kljuc = `${datum}#${cas}`;
    setCuvaCas(kljuc);
    try {
      const upisan = await apiRequest<PlanLekcija>("POST", "/muallim/plan-lekcija", {
        grupaId, datum, cas, lekcijaNaslov: naslov, opisCasa: opis.trim() || null, lekcijaTip: tip,
      }, token);
      setPlan(prev => [...prev.filter(p => p.id !== upisan.id), upisan]);
      setUnosi(prev => {
        const sljedeci = { ...prev };
        delete sljedeci[kljuc];
        return sljedeci;
      });
      toast({ title: t("Čas upisan u plan!") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setCuvaCas(null);
    }
  }

  async function obrisiCas(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/plan-lekcija/${id}`, undefined, token);
      setPlan(prev => prev.filter(p => p.id !== id));
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  }

  const casBroj = (p: PlanLekcija) => p.cas ?? (p.redoslijed ?? 0) + 1;
  const daniNastave = kalendar.filter(k => k.tip === "mekteb").map(k => k.datum);
  const sviDani = [...new Set([...daniNastave, ...plan.map(p => p.datum)])].sort();
  const danas = new Date().toISOString().split("T")[0];
  const prikazaniDani = prikaz === "nadolazeci" ? sviDani.filter(d => d >= danas) : sviDani;
  const planPoDanu = plan.reduce<Record<string, PlanLekcija[]>>((acc, p) => {
    (acc[p.datum] ||= []).push(p);
    return acc;
  }, {});
  const bezPlana = sviDani.filter(d => (planPoDanu[d]?.length ?? 0) === 0).length;

  return (
    <div className="space-y-5" data-testid="modul-plan-lekcija">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t("{ukupno} dana nastave · {prazno} bez plana", { ukupno: String(sviDani.length), prazno: String(bezPlana) })}
        </p>
        <div className="inline-flex rounded-xl border border-border bg-white p-0.5">
          {(["nadolazeci", "svi"] as const).map(kljuc => (
            <button key={kljuc} onClick={() => setPrikaz(kljuc)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${prikaz === kljuc ? "bg-violet-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`btn-plan-prikaz-${kljuc}`}>
              {kljuc === "nadolazeci" ? t("Nadolazeći") : t("Svi datumi")}
            </button>
          ))}
        </div>
      </div>

      {daniNastave.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("Za ovu grupu još nisu označeni datumi nastave. Označi ih u modulu Kalendar pa će se ovdje sami pojaviti.")}
          {onOtvoriKalendar && (
            <button onClick={onOtvoriKalendar} className="ml-2 font-bold underline underline-offset-2">{t("Otvori kalendar")}</button>
          )}
        </div>
      )}

      {prikazaniDani.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-white p-8 text-center">
          <Calendar className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {prikaz === "nadolazeci"
              ? t("Nema nadolazećih datuma nastave. Prebaci na „Svi datumi” za pregled ranijih časova.")
              : t("Nema unesenih datuma nastave za ovu grupu.")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {prikazaniDani.map(datum => {
            const casoviDana = (planPoDanu[datum] ?? []).slice().sort((a, b) => casBroj(a) - casBroj(b));
            // Stariji unosi znaju dijeliti isti redni broj; prvi zauzima svoj
            // čas, a ostali se prikazuju posebno da se ne izgube iz plana.
            const poCasu = new Map<number, PlanLekcija>();
            const viskovi: PlanLekcija[] = [];
            for (const stavka of casoviDana) {
              const broj = casBroj(stavka);
              if (broj >= 1 && broj <= MAX_CASOVA && !poCasu.has(broj)) poCasu.set(broj, stavka);
              else viskovi.push(stavka);
            }
            const najviseCas = [...poCasu.keys()].reduce((max, broj) => Math.max(max, broj), 0);
            const vidljivoCasova = Math.min(MAX_CASOVA, Math.max(2, najviseCas, dodatniCasovi[datum] ?? 0));
            const redovi = Array.from({ length: vidljivoCasova }, (_, i) => i + 1);

            return (
              <div key={datum} className="overflow-hidden rounded-2xl border border-border/50 bg-white" data-testid={`plan-dan-${datum}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 bg-muted/30 px-4 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
                    <Calendar className="h-4 w-4 text-violet-500" />
                    {new Date(`${datum}T12:00:00`).toLocaleDateString("bs-BA", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${casoviDana.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {casoviDana.length > 0 ? t("{n} časova u planu", { n: String(casoviDana.length) }) : t("Plan nije upisan")}
                  </span>
                </div>

                <div className="divide-y divide-border/30">
                  {redovi.map(cas => {
                    const postojeci = poCasu.get(cas) ?? null;
                    const kljuc = `${datum}#${cas}`;
                    const unos = unosi[kljuc];
                     const stariNaslov = postojeci?.lekcijaNaslov ?? "";
                     const poznataLekcija = lekcije.some(l => (l.izvorniNaslov ?? l.naslov) === stariNaslov);
                     const stariOpis = postojeci?.opisCasa ?? (poznataLekcija ? "" : stariNaslov);
                     const staraLekcija = postojeci?.opisCasa
                       ? (postojeci.opisCasa === stariNaslov ? "" : stariNaslov)
                       : (poznataLekcija ? stariNaslov : "");
                     const opis = unos?.opis ?? stariOpis;
                     const lekcija = unos?.lekcija ?? staraLekcija;
                    const tip = unos?.tip ?? postojeci?.lekcijaTip ?? "obrada";
                     const izmijenjeno = !!unos && (
                       opis !== stariOpis || lekcija !== staraLekcija || tip !== (postojeci?.lekcijaTip ?? "obrada")
                     );
                     const postaviUnos = (izmjene: Partial<{ opis: string; lekcija: string; tip: string }>) =>
                       setUnosi(prev => ({ ...prev, [kljuc]: { opis, lekcija, tip, ...izmjene } }));

                    if (readOnly) {
                      return (
                        <div key={kljuc} className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
                          <span className="shrink-0 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">
                            {t("{n}. čas", { n: String(cas) })}
                          </span>
                          <span className="min-w-0 flex-1 break-words text-sm text-foreground">
                             {postojeci?.opisCasa && postojeci.opisCasa !== stariNaslov && (
                               <span className="block">{postojeci.opisCasa}</span>
                             )}
                             {stariNaslov || <span className="text-muted-foreground">{t("nije upisano")}</span>}
                          </span>
                           {stariNaslov && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{t(nazivVrste(tip))}</span>}
                        </div>
                      );
                    }

                    return (
                      <div key={kljuc} className="px-3 py-3 sm:px-4" data-testid={`plan-cas-${datum}-${cas}`}>
                         <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
                           <span className="self-start rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">
                            {t("{n}. čas", { n: String(cas) })}
                          </span>
                           <div className="grid min-w-0 gap-2 lg:grid-cols-2">
                             <label className="min-w-0 text-xs font-bold text-muted-foreground">
                               {t("Šta radimo na ovom času")}
                               <input
                                 type="text"
                                 maxLength={300}
                                 value={opis}
                                 placeholder={t("Npr. ispitivanje prethodne lekcije")}
                                 onChange={e => postaviUnos({ opis: e.target.value })}
                                 className="mt-1 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-violet-300"
                                 data-testid={`input-plan-opis-${datum}-${cas}`}
                               />
                             </label>
                             <label className="min-w-0 text-xs font-bold text-muted-foreground">
                               {t("Lekcija (neobavezno)")}
                               <select
                                 value={lekcija}
                                 onChange={e => postaviUnos({ lekcija: e.target.value })}
                                 className="mt-1 w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-violet-300"
                                 data-testid={`select-plan-lekcija-${datum}-${cas}`}
                               >
                                 <option value="">{t("— Bez povezane lekcije —")}</option>
                                 {lekcija && !lekcije.some(l => (l.izvorniNaslov ?? l.naslov) === lekcija) && (
                                   <option value={lekcija}>{lekcija}</option>
                                 )}
                                 {[1, 2, 3, 4].map(nivo => {
                                   const nivoLekcije = lekcije.filter(l => l.nivo === nivo);
                                   if (nivoLekcije.length === 0) return null;
                                   return (
                                     <optgroup key={nivo} label={t("Nivo {n}", { n: String(nivo) })}>
                                       {nivoLekcije.map(l => <option key={l.id} value={l.izvorniNaslov ?? l.naslov}>{l.naslov}</option>)}
                                     </optgroup>
                                   );
                                 })}
                               </select>
                             </label>
                           </div>
                           <div className="flex flex-wrap items-center gap-2 sm:col-start-2">
                          <select
                            value={tip}
                            onChange={e => postaviUnos({ tip: e.target.value })}
                            className="rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 sm:w-44"
                            aria-label={t("Vrsta časa")}
                          >
                            {VRSTE_CASA.map(v => <option key={v.kljuc} value={v.kljuc}>{t(v.naziv)}</option>)}
                            {!VRSTE_CASA.some(v => v.kljuc === tip) && <option value={tip}>{tip}</option>}
                          </select>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                               onClick={() => sacuvajCas(datum, cas, opis, lekcija, tip)}
                               disabled={!(opis.trim() || lekcija) || !izmijenjeno || cuvaCas === kljuc}
                              className="rounded-xl bg-violet-600 text-sm font-bold hover:bg-violet-700"
                              data-testid={`btn-plan-sacuvaj-${datum}-${cas}`}
                            >
                              {cuvaCas === kljuc ? <Loader2 className="h-4 w-4 animate-spin" /> : postojeci ? t("Izmijeni") : t("Sačuvaj")}
                            </Button>
                            {postojeci && (
                              <button type="button" onClick={() => obrisiCas(postojeci.id)} className="p-2 text-red-400 hover:text-red-600" title={t("Obriši")}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {viskovi.length > 0 && (
                  <div className="border-t border-border/30 bg-amber-50/60 px-3 py-2 sm:px-4">
                    <p className="mb-1.5 text-xs font-bold text-amber-800">{t("Stariji unosi bez broja časa")}</p>
                    <div className="space-y-1">
                      {viskovi.map(stavka => (
                        <div key={stavka.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 break-words text-foreground">{stavka.lekcijaNaslov}</span>
                          {!readOnly && (
                            <button type="button" onClick={() => obrisiCas(stavka.id)} className="shrink-0 p-1 text-red-400 hover:text-red-600" title={t("Obriši")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!readOnly && (
                  <div className="border-t border-border/30 px-3 py-2 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setDodatniCasovi(prev => ({ ...prev, [datum]: vidljivoCasova + 1 }))}
                      disabled={vidljivoCasova >= MAX_CASOVA}
                      className="flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800 disabled:opacity-40"
                      data-testid={`btn-plan-dodaj-cas-${datum}`}
                    >
                      <Plus className="h-4 w-4" /> {t("Dodaj čas")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function nazivVrste(kljuc: string): string {
  return VRSTE_CASA.find(v => v.kljuc === kljuc)?.naziv ?? kljuc;
}
