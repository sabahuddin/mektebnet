import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest, getApiBase } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { ArrowLeft, Printer, Loader2, Users, CalendarCheck, Star, Award, BookOpen, CheckSquare, Square, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface Prisustvo { id: number; datum: string; status: string; napomena?: string }
interface Ocjena { id: number; kategorija: string; ocjena: number; lekcijaNaziv?: string; napomena?: string; datum: string }
interface KvizRezultat { id: number; kvizNaslov: string; tacniOdgovori: number; ukupnoPitanja: number; procenat: number; bodovi: number; completedAt: string }

interface UcenikIzvjestaj {
  ucenik: { id: number; displayName: string; username: string };
  grupaNaziv: string | null;
  grupaId: number | null;
  prisustvo: Prisustvo[];
  ocjene: Ocjena[];
  kvizRezultati: KvizRezultat[];
  zavrseneLekcijeBroj: number;
}

interface IzvjestajData {
  tip: "ucenik" | "grupa" | "svi";
  naslov: string;
  podnaslov: string | null;
  mektebNaziv: string | null;
  muallimDisplayName: string;
  skolskaGodina: string | null;
  grupaNaziv?: string;
  ucenici: UcenikIzvjestaj[];
}

const STATUS_LABELS: Record<string, string> = {
  prisutan: "Prisutan",
  odsutan: "Odsutan",
  zakasnio: "Zakasnio",
  opravdan: "Opravdan",
};

const KATEGORIJA_LABELS: Record<string, string> = {
  usmeno: "Usmeno",
  pismeno: "Pismeno",
  zadaca: "Zadaća",
  vladanje: "Vladanje",
  aktivnost: "Aktivnost",
};

function statsForUcenik(u: UcenikIzvjestaj) {
  const prisutnih = u.prisustvo.filter(p => p.status === "prisutan").length;
  const odsutnih = u.prisustvo.filter(p => p.status === "odsutan").length;
  const zakasnio = u.prisustvo.filter(p => p.status === "zakasnio").length;
  const opravdano = u.prisustvo.filter(p => p.status === "opravdan").length;
  const prisustvoPct = u.prisustvo.length > 0 ? Math.round((prisutnih / u.prisustvo.length) * 100) : null;
  const prosjecnaOcjena = u.ocjene.length ? (u.ocjene.reduce((s, o) => s + o.ocjena, 0) / u.ocjene.length) : null;
  const ukupnoBodova = u.kvizRezultati.reduce((s, r) => s + (r.bodovi || 0), 0);
  const kvizProsjek = u.kvizRezultati.length ? Math.round(u.kvizRezultati.reduce((s, r) => s + r.procenat, 0) / u.kvizRezultati.length) : null;
  return { prisutnih, odsutnih, zakasnio, opravdano, prisustvoPct, prosjecnaOcjena, ukupnoBodova, kvizProsjek };
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function MuallimIzvjestajPage() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [matchUcenik, paramsUcenik] = useRoute<{ id: string }>("/muallim/izvjestaj/ucenik/:id");
  const [matchGrupa, paramsGrupa] = useRoute<{ id: string }>("/muallim/izvjestaj/grupa/:id");
  const [matchSvi] = useRoute("/muallim/izvjestaj/svi");

  const [data, setData] = useState<IzvjestajData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(true);
  const [pickerSearch, setPickerSearch] = useState("");
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    if (!token) return;
    let url = "";
    if (matchUcenik && paramsUcenik?.id) url = `/muallim/izvjestaj/ucenik/${paramsUcenik.id}`;
    else if (matchGrupa && paramsGrupa?.id) url = `/muallim/izvjestaj/grupa/${paramsGrupa.id}`;
    else if (matchSvi) url = `/muallim/izvjestaj/svi`;
    else { setError(t("Nepoznat tip izvještaja")); setIsLoading(false); return; }

    setIsLoading(true);
    apiRequest<IzvjestajData>("GET", url, undefined, token)
      .then(d => {
        setData(d);
        setError(null);
        if (d.tip === "ucenik") {
          setSelectedIds(new Set(d.ucenici.map(u => u.ucenik.id)));
          setPickerOpen(false);
        } else {
          setSelectedIds(new Set());
          setPickerOpen(true);
        }
      })
      .catch((e: any) => setError(e?.message || t("Greška pri učitavanju")))
      .finally(() => setIsLoading(false));
  }, [token, matchUcenik, paramsUcenik?.id, matchGrupa, paramsGrupa?.id, matchSvi]);

  const filteredUcenici = data ? data.ucenici.filter(u => selectedIds.has(u.ucenik.id)) : [];
  const showPicker = !!data && data.tip !== "ucenik";

  function toggleId(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible(ids: number[]) {
    setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handlePrint() {
    window.print();
  }

  // Excel izvoz je po grupi (3 lista: prisustvo, ocjene, zbirni izvještaj).
  const excelGrupaId: number | null =
    matchGrupa && paramsGrupa?.id ? parseInt(paramsGrupa.id)
    : (data?.tip === "ucenik" ? (data.ucenici[0]?.grupaId ?? null) : null);

  async function handleExportExcel() {
    if (excelGrupaId == null) return;
    setExportingExcel(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${getApiBase()}/muallim/grupa/${excelGrupaId}/izvjestaj-excel`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("Greška pri izvozu") }));
        throw new Error(err.error || t("Greška pri izvozu"));
      }
      const disp = res.headers.get("Content-Disposition") || "";
      const mStar = disp.match(/filename\*=UTF-8''([^;]+)/i);
      const mPlain = disp.match(/filename="?([^";]+)"?/i);
      const filename = mStar ? decodeURIComponent(mStar[1])
        : mPlain ? mPlain[1]
        : `izvjestaj_${new Date().toISOString().split("T")[0]}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setError(e?.message || t("Greška pri izvozu u Excel"));
    } finally {
      setExportingExcel(false);
    }
  }

  const today = new Date().toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <Layout>
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; }
          /*
            Override globalnog index.css koji postavlja .print-worksheet na
            position:fixed (radi za 1-page Citaonica worksheet, ali blokira
            paginaciju izvještaja koji se prelijeva preko više stranica).
            Treba natural flow + width auto da margin @page ne bude duplo.

            Selektor MORA matchirati specifičnost globalnog pravila
            (body:has(.print-worksheet) .print-worksheet) — inače globalno
            !important pravilo pobjeđuje i izvještaj ostaje fixed (gubi
            paginaciju). Ovaj stil je u source order POSLIJE globalnog,
            pa kod jednake specifičnosti + !important pobjeđuje.
          */
          body:has(.print-worksheet) .print-worksheet {
            position: static !important;
            width: auto !important;
            max-width: 100% !important;
          }
          .print-card { box-shadow: none !important; border-color: #d1d5db !important; page-break-inside: avoid; }
          .print-page-break { page-break-before: always; }
          .print-bg-emerald { background: #d1fae5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bg-amber { background: #fef3c7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bg-red { background: #fee2e2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bg-blue { background: #dbeafe !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bg-violet { background: #ede9fe !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bg-primary { background: rgba(16, 185, 129, 0.05) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          html, body, .print-root { color: #111827 !important; }
        }
      `}</style>

      {/*
        Klasa `print-worksheet` aktivira opt-in "izolovani worksheet" mode
        iz src/index.css: sakriva sve ostalo na stranici (visibility:hidden)
        i prikazuje samo ovaj element pri štampi. Bez nje bi se i sidebar/
        header iz Layout-a štampali — globalno pravilo za .no-print sakriva
        dugmad i kontrole. Layout chrome je već globalno sakriven u print
        modu (vidi index.css), ova klasa dodatno izoluje izvještaj od
        ostalih dijelova <main> kontejnera.
      */}
      <div className="print-worksheet max-w-4xl mx-auto print-root">
        <div className="no-print mb-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/muallim")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium text-sm transition-colors"
            data-testid="link-nazad"
          >
            <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
          </button>
          <div className="flex items-center gap-2">
            {excelGrupaId != null && (
              <Button
                onClick={handleExportExcel}
                disabled={exportingExcel}
                variant="outline"
                className="rounded-xl font-bold text-sm flex items-center gap-2"
                data-testid="btn-export-excel"
              >
                {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                {t("Izvezi Excel")}
              </Button>
            )}
            <Button
              onClick={handlePrint}
              className="rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 flex items-center gap-2"
              data-testid="btn-print"
            >
              <Printer className="w-4 h-4" /> {t("Štampaj / Sačuvaj kao PDF")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-6 text-center">
            <p className="font-bold mb-1">{t("Greška")}</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : !data ? null : (
          <>
            {/* Header — vizuelno isto kao kod pregleda + pripremno za print */}
            <div className="bg-white border border-border/50 rounded-2xl p-6 sm:p-8 mb-6 shadow-sm print-card">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/40">
                <img src="/logo-mekteb.png" alt="Mekteb" className="h-14 w-auto" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-foreground leading-tight" data-testid="header-platforma">
                    {t("MEKTEB — Islamska edukativna platforma")}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {t("Izvještaj generisan {datum}", { datum: today })}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                {data.mektebNaziv && (
                  <p className="text-base sm:text-lg font-bold text-foreground" data-testid="header-mekteb">
                    {data.mektebNaziv}
                  </p>
                )}
                <h2 className="text-lg sm:text-xl font-extrabold text-primary" data-testid="header-naslov">
                  {data.naslov}
                </h2>
                {data.podnaslov && (
                  <p className="text-sm text-muted-foreground" data-testid="header-podnaslov">{data.podnaslov}</p>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  {t("Muallim:")} <span className="font-bold text-foreground">{data.muallimDisplayName}</span>
                  {data.skolskaGodina && <> · {t("Mektebska godina:")} <span className="font-bold text-foreground">{data.skolskaGodina}</span></>}
                </p>
              </div>
            </div>

            {/* Picker za odabir učenika (samo grupa/svi) */}
            {showPicker && (
              <div className="no-print bg-white border-2 border-primary/30 rounded-2xl p-5 mb-6 shadow-sm" data-testid="picker-ucenika">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <button onClick={() => setPickerOpen(o => !o)}
                    className="flex items-center gap-2 font-extrabold text-foreground text-base hover:text-primary transition"
                    data-testid="btn-toggle-picker">
                    <Users className="w-5 h-5 text-primary" />
                    {t("Odaberi učenike za izvještaj")}
                    <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {selectedIds.size} / {data.ucenici.length}
                    </span>
                  </button>
                  {pickerOpen && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg text-xs"
                        onClick={() => selectAllVisible(data.ucenici.map(u => u.ucenik.id))}
                        data-testid="btn-select-all">
                        <CheckSquare className="w-3.5 h-3.5 mr-1" /> {t("Označi sve")}
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg text-xs"
                        onClick={clearSelection}
                        disabled={selectedIds.size === 0}
                        data-testid="btn-clear-selection">
                        <Square className="w-3.5 h-3.5 mr-1" /> {t("Poništi")}
                      </Button>
                    </div>
                  )}
                </div>

                {pickerOpen && (
                  <>
                    {data.ucenici.length > 6 && (
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                          placeholder={t("Pretraži učenike...")}
                          className="pl-9 h-10 rounded-xl"
                          data-testid="input-picker-search" />
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                      {data.ucenici
                        .filter(u => !pickerSearch || u.ucenik.displayName.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .map(u => {
                          const checked = selectedIds.has(u.ucenik.id);
                          return (
                            <label key={u.ucenik.id}
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition ${checked ? "bg-primary/5 border-primary/40" : "bg-white border-border hover:bg-muted/40"}`}
                              data-testid={`picker-row-${u.ucenik.id}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleId(u.ucenik.id)}
                                className="w-4 h-4 accent-primary cursor-pointer"
                                data-testid={`picker-checkbox-${u.ucenik.id}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-foreground truncate">{u.ucenik.displayName}</div>
                                {u.grupaNaziv && data.tip === "svi" && (
                                  <div className="text-xs text-muted-foreground truncate">{u.grupaNaziv}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sumarni statistike za grupa/svi */}
            {data.tip !== "ucenik" && filteredUcenici.length > 0 && (
              <div className="bg-white border border-border/50 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm print-card">
                <h3 className="font-extrabold text-foreground mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> {t("Sumarni pregled")}
                </h3>
                <SumarniPregled ucenici={filteredUcenici} />
              </div>
            )}

            {/* Učenici — pojedinačni izvještaji */}
            {filteredUcenici.length === 0 ? (
              <div className="bg-white border border-border/50 rounded-2xl p-8 text-center print-card">
                <p className="text-muted-foreground">
                  {data.ucenici.length === 0
                    ? t("Nema učenika za izvještaj.")
                    : t("Odaberi barem jednog učenika za pregled i štampu.")}
                </p>
              </div>
            ) : (
              filteredUcenici.map((u, idx) => (
                <UcenikSekcija key={u.ucenik.id} ucenik={u} firstOnPage={idx > 0} />
              ))
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function SumarniPregled({ ucenici }: { ucenici: UcenikIzvjestaj[] }) {
  const { t } = useLanguage();
  const stats = ucenici.map(u => ({ u, ...statsForUcenik(u) }));
  const ukupnoCasova = Math.max(...stats.map(s => s.u.prisustvo.length), 0);
  const prosjekPrisustva = (() => {
    const valid = stats.filter(s => s.prisustvoPct !== null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, v) => s + (v.prisustvoPct || 0), 0) / valid.length);
  })();
  const prosjekOcjena = (() => {
    const valid = stats.filter(s => s.prosjecnaOcjena !== null);
    if (valid.length === 0) return null;
    return (valid.reduce((s, v) => s + (v.prosjecnaOcjena || 0), 0) / valid.length).toFixed(2);
  })();

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-primary/5 print-bg-primary border border-border/50 rounded-xl p-4">
          <Users className="w-4 h-4 text-primary mb-1" />
          <div className="text-2xl font-extrabold text-primary">{ucenici.length}</div>
          <div className="text-xs text-muted-foreground font-medium">{t("Učenika")}</div>
        </div>
        <div className="bg-emerald-50 print-bg-emerald border border-border/50 rounded-xl p-4">
          <CalendarCheck className="w-4 h-4 text-emerald-600 mb-1" />
          <div className="text-2xl font-extrabold text-emerald-600">{ukupnoCasova}</div>
          <div className="text-xs text-muted-foreground font-medium">{t("Časova")}</div>
        </div>
        <div className={`border border-border/50 rounded-xl p-4 ${prosjekPrisustva !== null && prosjekPrisustva >= 80 ? "bg-emerald-50 print-bg-emerald" : prosjekPrisustva !== null && prosjekPrisustva >= 50 ? "bg-amber-50 print-bg-amber" : "bg-red-50 print-bg-red"}`}>
          <CalendarCheck className="w-4 h-4 mb-1 text-foreground/60" />
          <div className={`text-2xl font-extrabold ${prosjekPrisustva !== null && prosjekPrisustva >= 80 ? "text-emerald-600" : prosjekPrisustva !== null && prosjekPrisustva >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {prosjekPrisustva !== null ? `${prosjekPrisustva}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground font-medium">{t("Prosj. prisustvo")}</div>
        </div>
        <div className="bg-violet-50 print-bg-violet border border-border/50 rounded-xl p-4">
          <Star className="w-4 h-4 text-violet-600 mb-1" />
          <div className="text-2xl font-extrabold text-violet-600">{prosjekOcjena || "—"}</div>
          <div className="text-xs text-muted-foreground font-medium">{t("Prosj. ocjena")}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-border/50">
              <th className="text-left py-2 px-2 font-bold text-foreground">{t("Učenik")}</th>
              <th className="text-left py-2 px-2 font-bold text-foreground">{t("Grupa")}</th>
              <th className="text-right py-2 px-2 font-bold text-foreground">{t("Prisustvo")}</th>
              <th className="text-right py-2 px-2 font-bold text-foreground">{t("Prosj. ocjena")}</th>
              <th className="text-right py-2 px-2 font-bold text-foreground">{t("Bodovi (kvizovi)")}</th>
              <th className="text-right py-2 px-2 font-bold text-foreground">{t("Lekcije završeno")}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.u.ucenik.id} className="border-b border-border/30" data-testid={`row-sumarno-${s.u.ucenik.id}`}>
                <td className="py-2 px-2 font-medium text-foreground">{s.u.ucenik.displayName}</td>
                <td className="py-2 px-2 text-muted-foreground">{s.u.grupaNaziv || "—"}</td>
                <td className="py-2 px-2 text-right">
                  {s.prisustvoPct !== null
                    ? <span className={`font-bold ${s.prisustvoPct >= 80 ? "text-emerald-600" : s.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>{s.prisustvoPct}%</span>
                    : <span className="text-muted-foreground">—</span>}
                  <span className="text-xs text-muted-foreground ml-1">({s.prisutnih}/{s.u.prisustvo.length})</span>
                </td>
                <td className="py-2 px-2 text-right">
                  {s.prosjecnaOcjena !== null
                    ? <span className="font-bold text-foreground">{s.prosjecnaOcjena.toFixed(2)}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2 px-2 text-right text-foreground font-medium">{s.ukupnoBodova}</td>
                <td className="py-2 px-2 text-right text-foreground font-medium">{s.u.zavrseneLekcijeBroj}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UcenikSekcija({ ucenik, firstOnPage }: { ucenik: UcenikIzvjestaj; firstOnPage: boolean }) {
  const { t } = useLanguage();
  const s = statsForUcenik(ucenik);

  return (
    <div className={`bg-white border border-border/50 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm print-card ${firstOnPage ? "print-page-break" : ""}`} data-testid={`sekcija-ucenik-${ucenik.ucenik.id}`}>
      <div className="flex items-center gap-3 pb-3 mb-4 border-b border-border/40 flex-wrap">
        <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white font-extrabold text-lg">{ucenik.ucenik.displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-extrabold text-foreground">{ucenik.ucenik.displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {ucenik.grupaNaziv && <>{t("Grupa:")} <span className="font-bold text-foreground">{ucenik.grupaNaziv}</span> · </>}
            {t("Korisničko:")} <span className="font-mono">{ucenik.ucenik.username}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className={`border border-border/50 rounded-xl p-3 ${s.prisustvoPct !== null && s.prisustvoPct >= 80 ? "bg-emerald-50 print-bg-emerald" : s.prisustvoPct !== null && s.prisustvoPct >= 50 ? "bg-amber-50 print-bg-amber" : "bg-red-50 print-bg-red"}`}>
          <div className="text-xs text-muted-foreground font-medium mb-0.5">{t("Prisustvo")}</div>
          <div className={`text-xl font-extrabold ${s.prisustvoPct !== null && s.prisustvoPct >= 80 ? "text-emerald-600" : s.prisustvoPct !== null && s.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {s.prisustvoPct !== null ? `${s.prisustvoPct}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">{s.prisutnih}/{ucenik.prisustvo.length} {t("časova")}</div>
        </div>
        <div className="bg-violet-50 print-bg-violet border border-border/50 rounded-xl p-3">
          <div className="text-xs text-muted-foreground font-medium mb-0.5">{t("Prosj. ocjena")}</div>
          <div className="text-xl font-extrabold text-violet-600">{s.prosjecnaOcjena !== null ? s.prosjecnaOcjena.toFixed(2) : "—"}</div>
          <div className="text-xs text-muted-foreground">{ucenik.ocjene.length} {t("ocjena")}</div>
        </div>
        <div className="bg-blue-50 print-bg-blue border border-border/50 rounded-xl p-3">
          <div className="text-xs text-muted-foreground font-medium mb-0.5">{t("Kvizovi")}</div>
          <div className="text-xl font-extrabold text-blue-600">{s.kvizProsjek !== null ? `${s.kvizProsjek}%` : "—"}</div>
          <div className="text-xs text-muted-foreground">{s.ukupnoBodova} {t("bodova")}</div>
        </div>
        <div className="bg-emerald-50 print-bg-emerald border border-border/50 rounded-xl p-3">
          <div className="text-xs text-muted-foreground font-medium mb-0.5">{t("Lekcije")}</div>
          <div className="text-xl font-extrabold text-emerald-600">{ucenik.zavrseneLekcijeBroj}</div>
          <div className="text-xs text-muted-foreground">{t("završeno")}</div>
        </div>
      </div>

      {/* Prisustvo razbroj */}
      <div className="mb-5">
        <h4 className="font-bold text-sm text-foreground mb-2 flex items-center gap-1.5">
          <CalendarCheck className="w-4 h-4 text-primary" /> {t("Prisustvo")}
        </h4>
        <div className="flex gap-2 flex-wrap text-xs mb-3">
          <span className="bg-emerald-100 print-bg-emerald text-emerald-700 rounded px-2 py-1 font-bold">{t("Prisutan: {n}", { n: String(s.prisutnih) })}</span>
          <span className="bg-red-100 print-bg-red text-red-700 rounded px-2 py-1 font-bold">{t("Odsutan: {n}", { n: String(s.odsutnih) })}</span>
          <span className="bg-amber-100 print-bg-amber text-amber-700 rounded px-2 py-1 font-bold">{t("Zakasnio: {n}", { n: String(s.zakasnio) })}</span>
          <span className="bg-blue-100 print-bg-blue text-blue-700 rounded px-2 py-1 font-bold">{t("Opravdan: {n}", { n: String(s.opravdano) })}</span>
        </div>
        {ucenik.prisustvo.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t("Nema unosa prisustva.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Datum")}</th>
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Status")}</th>
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Napomena")}</th>
                </tr>
              </thead>
              <tbody>
                {ucenik.prisustvo.slice().reverse().slice(0, 30).map(p => (
                  <tr key={p.id} className="border-b border-border/20">
                    <td className="py-1 px-2 text-foreground">{fmtDate(p.datum)}</td>
                    <td className="py-1 px-2 text-foreground font-medium">{STATUS_LABELS[p.status] || p.status}</td>
                    <td className="py-1 px-2 text-muted-foreground">{p.napomena || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ucenik.prisustvo.length > 30 && (
              <p className="text-xs text-muted-foreground italic mt-1">{t("Prikazano posljednjih 30 unosa od {n}.", { n: String(ucenik.prisustvo.length) })}</p>
            )}
          </div>
        )}
      </div>

      {/* Ocjene */}
      <div className="mb-5">
        <h4 className="font-bold text-sm text-foreground mb-2 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-violet-600" /> {t("Ocjene")}
        </h4>
        {ucenik.ocjene.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t("Nema ocjena.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Datum")}</th>
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Kategorija")}</th>
                  <th className="text-center py-1.5 px-2 font-bold text-foreground">{t("Ocjena")}</th>
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Lekcija / napomena")}</th>
                </tr>
              </thead>
              <tbody>
                {ucenik.ocjene.map(o => (
                  <tr key={o.id} className="border-b border-border/20">
                    <td className="py-1 px-2 text-foreground">{fmtDate(o.datum)}</td>
                    <td className="py-1 px-2 text-foreground">{KATEGORIJA_LABELS[o.kategorija] || o.kategorija}</td>
                    <td className="py-1 px-2 text-center font-extrabold text-violet-700">{o.ocjena}</td>
                    <td className="py-1 px-2 text-muted-foreground">
                      {o.lekcijaNaziv && <span className="font-medium text-foreground">{o.lekcijaNaziv}</span>}
                      {o.lekcijaNaziv && o.napomena && " — "}
                      {o.napomena || (!o.lekcijaNaziv ? "—" : "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kvizovi */}
      <div>
        <h4 className="font-bold text-sm text-foreground mb-2 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-blue-600" /> {t("Rezultati kvizova")}
        </h4>
        {ucenik.kvizRezultati.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{t("Nema riješenih kvizova.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Datum")}</th>
                  <th className="text-left py-1.5 px-2 font-bold text-foreground">{t("Kviz")}</th>
                  <th className="text-right py-1.5 px-2 font-bold text-foreground">{t("Tačno")}</th>
                  <th className="text-right py-1.5 px-2 font-bold text-foreground">%</th>
                  <th className="text-right py-1.5 px-2 font-bold text-foreground">{t("Bodovi")}</th>
                </tr>
              </thead>
              <tbody>
                {ucenik.kvizRezultati.slice(0, 30).map(r => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="py-1 px-2 text-foreground">{fmtDate(r.completedAt)}</td>
                    <td className="py-1 px-2 text-foreground font-medium">{r.kvizNaslov}</td>
                    <td className="py-1 px-2 text-right text-muted-foreground">{r.tacniOdgovori}/{r.ukupnoPitanja}</td>
                    <td className="py-1 px-2 text-right font-bold text-blue-600">{r.procenat}%</td>
                    <td className="py-1 px-2 text-right text-foreground font-medium">{r.bodovi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ucenik.kvizRezultati.length > 30 && (
              <p className="text-xs text-muted-foreground italic mt-1">{t("Prikazano posljednjih 30 od {n}.", { n: String(ucenik.kvizRezultati.length) })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
