import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, CalendarCheck, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { goBackOr } from "@/lib/back-navigation";
import { MuallimGroupSidebar } from "@/components/muallim-group-sidebar";

type Status = "prisutan" | "odsutan" | "zakasnio" | "opravdan";
const CASOVI = [1, 2, 3, 4] as const;
type Cas = typeof CASOVI[number];

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
}

interface Grupa {
  id: number;
  naziv: string;
  skolskaGodina: string;
  prisustvoCasova: number;
}

interface PrisustvoRecord {
  ucenikId: number;
  cas: number;
  status: Status;
  napomena?: string;
}

const attendanceKey = (ucenikId: number, cas: Cas) => `${ucenikId}:${cas}`;

const STATUS_OPTIONS: { value: Status; label: string; short: string; color: string; bg: string; border: string }[] = [
  { value: "prisutan", label: "Prisutan", short: "P", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-400" },
  { value: "odsutan", label: "Odsutan", short: "O", color: "text-red-700", bg: "bg-red-50", border: "border-red-400" },
  { value: "zakasnio", label: "Zakasnio", short: "Z", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-400" },
  { value: "opravdan", label: "Opravdan", short: "OP", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-400" },
];

function todayStr() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function PrisustvoPage() {
  const { grupaId } = useParams<{ grupaId: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [grupa, setGrupa] = useState<Grupa | null>(null);
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [datum, setDatum] = useState(todayStr());
  const [statusi, setStatusi] = useState<Record<string, Status>>({});
  const [napomene, setNapomene] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [attendanceLoadError, setAttendanceLoadError] = useState(false);
  const [historyMaxCas, setHistoryMaxCas] = useState(1);
  const [hasExistingRecords, setHasExistingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token || !grupaId) return;
    Promise.all([
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
    ]).then(([grupe, sviUcenici]) => {
      const g = grupe.find(g => g.id === parseInt(grupaId));
      setGrupa(g || null);
      const grupaUcenici = sviUcenici.filter((u: any) => (u.grupaId || u.profil?.grupaId) === parseInt(grupaId));
      setUcenici(grupaUcenici);
    }).catch(() => {
      toast({ title: t("Greška"), description: t("Nije moguće učitati grupu i učenike"), variant: "destructive" });
    }).finally(() => setIsLoading(false));
  }, [token, grupaId]);

  useEffect(() => {
    if (!token || !grupaId || !grupa || ucenici.length === 0) {
      setHasExistingRecords(false);
      return;
    }
    let ignore = false;
    const defaultStatusi: Record<string, Status> = {};
    ucenici.forEach(u => {
      CASOVI.slice(0, grupa.prisustvoCasova).forEach(cas => {
        defaultStatusi[attendanceKey(u.id, cas)] = "prisutan";
      });
    });
    setStatusi(defaultStatusi);
    setNapomene({});
    setHasExistingRecords(false);
    setAttendanceLoadError(false);
    setHistoryMaxCas(1);
    setIsAttendanceLoading(true);

    apiRequest<PrisustvoRecord[]>("GET", `/muallim/prisustvo?grupaId=${grupaId}&datum=${datum}`, undefined, token)
      .then(records => {
        if (ignore) return;
        // Postojeći dan uređujemo bez automatskog dopunjavanja časova koji nisu bili evidentirani.
        const newStatusi = records.length ? {} as Record<string, Status> : defaultStatusi;
        const newNapomene: Record<string, string> = {};
        setHistoryMaxCas(Math.min(4, Math.max(1, ...records.map(r => r.cas))));
        for (const r of records) {
          if (!CASOVI.includes(r.cas as Cas)) continue;
          const key = attendanceKey(r.ucenikId, r.cas as Cas);
          newStatusi[key] = r.status;
          if (r.napomena) newNapomene[key] = r.napomena;
        }
        setStatusi(newStatusi);
        setNapomene(newNapomene);
        setHasExistingRecords(records.length > 0);
      })
      .catch(() => {
        if (!ignore) {
          setAttendanceLoadError(true);
          toast({ title: t("Greška"), description: t("Nije moguće učitati prisustvo za odabrani datum"), variant: "destructive" });
        }
      })
      .finally(() => {
        if (!ignore) setIsAttendanceLoading(false);
      });

    return () => { ignore = true; };
  }, [datum, ucenici, token, grupaId, grupa, toast, t]);

  async function handleSave() {
    if (!token || !grupaId || !grupa || isAttendanceLoading || attendanceLoadError) return;
    setIsSaving(true);
    try {
      const prisustvoData = ucenici.flatMap(u =>
        visibleCasovi.filter(cas => statusi[attendanceKey(u.id, cas)])
          .map(cas => ({
            ucenikId: u.id, cas,
            status: statusi[attendanceKey(u.id, cas)] || "prisutan",
            napomena: napomene[attendanceKey(u.id, cas)] || null,
          })),
      );
      await apiRequest("POST", "/muallim/prisustvo", { grupaId: parseInt(grupaId), datum, prisustvo: prisustvoData }, token);
      toast({
        title: hasExistingRecords ? t("Prisustvo ažurirano!") : t("Prisustvo sačuvano!"),
        description: t("Evidentirano za {datum}", { datum }),
      });
      setLocation(`/muallim/grupa/${grupaId}`, { replace: true });
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće sačuvati prisustvo"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const visibleCasovi = CASOVI.slice(0, Math.max(grupa?.prisustvoCasova ?? 1, historyMaxCas));
  const visibleStatuses = ucenici.flatMap(u => visibleCasovi.map(cas => statusi[attendanceKey(u.id, cas)]));
  const prisutnih = visibleStatuses.filter(s => s === "prisutan").length;
  const odsutnih = visibleStatuses.filter(s => s === "odsutan").length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <button onClick={() => goBackOr(() => setLocation("/muallim"))} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na panel")}
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <CalendarCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              {t("Prisustvo")}{grupa ? ` — ${grupa.naziv}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm">{grupa?.skolskaGodina}</p>
            <p className="mt-1 text-xs text-muted-foreground" aria-label={t("Legenda prisustva")}>
              {STATUS_OPTIONS.map((option, index) => (
                <span key={option.value} className="inline-block mr-2">
                  {index > 0 && <span aria-hidden="true" className="mr-2">·</span>}
                  {t(option.label)} (<strong className={option.color}>{option.short}</strong>)
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_190px] items-start">
        <main className="min-w-0">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">{t("Datum")}</label>
            <input
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              max={todayStr()}
              className="border border-border rounded-xl px-4 py-2.5 font-bold text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
              {t("Odaberi raniji datum da pregledaš i ispraviš već uneseno prisustvo.")}
            </p>
          </div>
          {hasExistingRecords && !isAttendanceLoading && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {t("Postojeći zapis — izmjene će ga ažurirati")}
            </span>
          )}
          {ucenici.length > 0 && (
            <div className="flex gap-4 text-sm font-bold">
              <span className="text-emerald-600">✓ {t("{n} prisutnih", { n: String(prisutnih) })}</span>
              <span className="text-red-600">✗ {t("{n} odsutnih", { n: String(odsutnih) })}</span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : ucenici.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-border/50 text-muted-foreground">
            <p className="font-bold text-foreground mb-1">{t("Nema učenika u ovoj grupi")}</p>
            <p className="text-sm">{t("Dodaj učenike i rasporedi ih u grupu")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {historyMaxCas > (grupa?.prisustvoCasova ?? 1) && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
                {t("Za ovaj datum prikazani su i ranije evidentirani časovi. Promjena podešavanja grupe ne briše stare zapise.")}
              </p>
            )}
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-white">
              <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: 160 + visibleCasovi.length * 190 }}>
                <caption className="sr-only">{t("Evidencija prisustva po učeniku")}</caption>
                <thead className="bg-muted/40 text-sm text-foreground">
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 w-40 border-b border-r border-border/60 bg-muted px-4 py-3">{t("Učenik")}</th>
                    {visibleCasovi.map(cas => (
                      <th scope="col" key={cas} className="border-b border-border/60 px-3 py-3">
                        {visibleCasovi.length === 1 ? t("Dan") : `${cas}. ${t("čas")}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {ucenici.map(u => (
                    <tr key={u.id} className="align-top">
                      <th scope="row" className="sticky left-0 z-10 border-r border-border/60 bg-white px-4 py-3 text-sm">
                        <span className="block font-bold text-foreground">{u.displayName}</span>
                        <span className="block break-all font-mono text-xs font-normal text-muted-foreground">{u.username}</span>
                      </th>
                      {visibleCasovi.map(cas => {
                        const key = attendanceKey(u.id, cas);
                        const currentStatus = statusi[key];
                        return (
                          <td key={cas} className="px-3 py-3">
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map(opt => (
                                <button type="button" key={opt.value} disabled={isAttendanceLoading || isSaving || attendanceLoadError}
                                  aria-pressed={currentStatus === opt.value}
                                  aria-label={`${u.displayName}, ${visibleCasovi.length === 1 ? t("Dan") : `${cas}. ${t("čas")}`}: ${t(opt.label)}`}
                                  onClick={() => setStatusi(prev => ({ ...prev, [key]: opt.value }))}
                                  className={`min-w-8 rounded-lg border-2 px-1.5 py-1.5 text-xs font-bold transition-colors ${
                                    currentStatus === opt.value
                                      ? `${opt.bg} ${opt.color} ${opt.border}`
                                      : "border-transparent bg-muted/50 text-muted-foreground hover:border-border"
                                  }`}
                                >{opt.short}</button>
                              ))}
                            </div>
                            {currentStatus && currentStatus !== "prisutan" && (
                              <input type="text" disabled={isAttendanceLoading || isSaving || attendanceLoadError}
                                aria-label={`${u.displayName}, ${cas}. ${t("čas")}: ${t("Napomena (opcionalno)")}`}
                                placeholder={t("Napomena (opcionalno)")}
                                value={napomene[key] || ""}
                                onChange={e => setNapomene(prev => ({ ...prev, [key]: e.target.value }))}
                                className="mt-2 w-full min-w-0 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={isSaving || isLoading || isAttendanceLoading || attendanceLoadError || !grupa} className="rounded-xl font-bold px-8 flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {hasExistingRecords ? t("Sačuvaj izmjene") : t("Sačuvaj prisustvo")}
              </Button>
            </div>
          </div>
        )}
        </main>
        <aside className="xl:sticky xl:top-24">
          <MuallimGroupSidebar grupaId={parseInt(grupaId)} activeModule="prisustvo" />
        </aside>
        </div>
      </div>
    </Layout>
  );
}
