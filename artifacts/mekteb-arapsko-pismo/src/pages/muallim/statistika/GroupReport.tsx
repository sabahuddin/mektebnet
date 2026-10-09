import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import type { GroupStatisticsReport } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelGrupeLink } from "@/components/teacher-top-nav";
import { MuallimGroupSidebar } from "@/components/muallim-group-sidebar";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { downloadGroupExcel } from "@/lib/group-report-download";
import { Loader2, Printer, Download } from "lucide-react";

export default function GroupReport() {
  const [, params] = useRoute<{ id: string }>("/muallim/izvjestaj/grupa/:id");
  const grupaId = Number(params?.id);
  return <ReportContent key={grupaId} grupaId={grupaId} />;
}

const SECTIONS = [
  ["prisustvo", "Prisustvo"], ["lekcije", "Lekcije"], ["vjezbe", "Vježbe"],
  ["kvizovi", "Kvizovi"], ["ocjene", "Ocjene"], ["etape", "Etape i medaljoni"],
];

function ReportContent({ grupaId }: { grupaId: number }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [report, setReport] = useState<GroupStatisticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [students, setStudents] = useState<GroupStatisticsReport["ucenici"] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [sections, setSections] = useState(SECTIONS.map(([id]) => id));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setReport(null);
    setError(null);
    apiRequest<GroupStatisticsReport>("GET", `/muallim/grupa/${grupaId}/izvjestaj-statistika${query ? `?${query}` : ""}`, undefined, token)
      .then(data => {
        if (!active) return;
        setReport(data);
        if (students === null) {
          setStudents(data.ucenici);
          setSelected(data.ucenici.map(u => u.id));
        }
      })
      .catch(err => { if (active) setError(err.message || t("Greška pri učitavanju")); });
    return () => { active = false; };
  }, [grupaId, token, query]);

  function applyFilters() {
    if (from && to && from > to) { setError(t("Početni datum je nakon završnog")); return; }
    const params = new URLSearchParams({ ucenici: selected.join(","), sekcije: sections.join(",") });
    if (from) params.set("od", from);
    if (to) params.set("do", to);
    if (params.toString() !== query) setReport(null);
    setQuery(params.toString());
    setDirty(false);
  }

  async function exportExcel() {
    if (!token || !report) return;
    setExporting(true);
    try {
      await downloadGroupExcel(grupaId, token, query);
    } catch {
      setError(t("Greška pri preuzimanju"));
    } finally {
      setExporting(false);
    }
  }

  const cell = (value: string | number | null) => value === null ? "–" : typeof value === "number" ? value : t(value);

  return (
    <Layout>
      <style>{`
        @media print {
          @page { margin: 1.2cm; size: A4 landscape; }
          body { background: white !important; }
          body:has(.print-worksheet) .print-worksheet { position: static !important; inset: auto !important; width: auto !important; margin: 0 !important; padding: 0 !important; }
          .group-report-layout { display: block !important; max-width: none !important; }
          .group-report-section { break-before: page; border: none !important; padding: 0 !important; }
          .group-report-section h2, .group-report-section h3 { break-after: avoid; }
          .group-report-table { overflow: visible !important; }
          .group-report-table table { table-layout: fixed; font-size: 9pt; width: 100% !important; }
          .group-report-table th, .group-report-table td { overflow-wrap: anywhere; padding: 4px !important; }
          .group-report-table thead { display: table-header-group; }
          .group-report-table tr { break-inside: avoid; }
        }
      `}</style>
      <div className="group-report-layout max-w-7xl mx-auto grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <main className="min-w-0 print-worksheet space-y-6">
          <div className="no-print flex flex-wrap justify-between gap-3">
            <PanelGrupeLink grupaId={grupaId} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportExcel} disabled={!report || exporting || dirty || !sections.length} data-testid="btn-export-excel">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Excel
              </Button>
              <Button onClick={() => window.print()} disabled={!report || dirty || !sections.length} data-testid="btn-stampaj">
                <Printer className="h-4 w-4 mr-2" /> {t("Štampaj / PDF")}
              </Button>
            </div>
          </div>
          {students && <div className="no-print rounded-2xl border border-border/50 bg-white p-5 space-y-4">
            <h2 className="font-bold">{t("Izbor učenika i sekcija")}</h2>
            <p className="text-sm text-muted-foreground">{t("Period sužava samo prisustvo i ocjene tekuće mektebske godine. Napredak učenja ostaje kumulativan.")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium">{t("Od")}<Input type="date" value={from} onChange={e => { setFrom(e.target.value); setDirty(true); }} /></label>
              <label className="text-sm font-medium">{t("Do")}<Input type="date" value={to} onChange={e => { setTo(e.target.value); setDirty(true); }} /></label>
            </div>
            <div className="grid sm:grid-cols-3 grid-cols-2 gap-3">
              {SECTIONS.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sections.includes(id)} onChange={e => {
                  setSections(prev => e.target.checked ? [...prev, id] : prev.filter(s => s !== id)); setDirty(true);
                }} /> {t(label)}
              </label>)}
            </div>
            <Input aria-label={t("Pretraga učenika")} placeholder={t("Pretraga učenika")} value={search} onChange={e => setSearch(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSelected(students.map(u => u.id)); setDirty(true); }}>{t("Odaberi sve")}</Button>
              <Button variant="outline" size="sm" onClick={() => { setSelected([]); setDirty(true); }}>{t("Poništi izbor")}</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {students.filter(u => u.ime.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(u => <label key={u.id} className="flex gap-2 text-sm items-center">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={e => {
                  setSelected(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)); setDirty(true);
                }} /> {u.ime}
              </label>)}
            </div>
            <Button onClick={applyFilters} disabled={!dirty} data-testid="btn-primijeni-filtere">{t("Primijeni izbor")}</Button>
          </div>}
          {error && <p role="alert" className="no-print rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          {!report && !error && <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
          {report && <>
            <div className="rounded-2xl border border-border/50 bg-white p-5 text-center">
              <h1 className="text-2xl font-extrabold">{t("Izvještaj grupe")} – {report.naslov.replace(/^Grupa: /, "")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t(report.period)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("Izvještaj generisan")}: {new Date().toLocaleDateString("bs-BA")}</p>
              <p className="mt-1 text-sm">{t("Učenika")}: {report.ucenici.length}</p>
              <h2 className="mt-5 mb-3 text-lg font-bold">{t("Zbirni pregled")}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-left">
                {report.sections.map(s => <div key={s.id} className="rounded-xl border border-border/50 p-3">
                  <h3 className="mb-2 font-bold">{t(s.title)}</h3>
                  <dl className="text-sm space-y-1">{s.summary.map(m => <div key={m.label} className="flex justify-between gap-3">
                    <dt>{t(m.label)}</dt><dd className="font-bold whitespace-nowrap">{cell(m.value)}</dd>
                  </div>)}</dl>
                </div>)}
              </div>
            </div>
            {report.sections.map(section => <section key={section.id} className="group-report-section rounded-2xl border border-border/50 bg-white p-5 space-y-4" data-testid={`report-section-${section.id}`}>
              <h2 className="text-xl font-extrabold">{t(section.title)}</h2>
              <p className="text-sm">{section.summary.map(m => `${t(m.label)}: ${cell(m.value)}`).join(" · ")}</p>
              {section.tables.map(table => <div key={table.title}>
                <h3 className="font-bold text-sm mb-2">{t(table.title)}</h3>
                {table.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("Nema podataka.")}</p> : <div className="group-report-table overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b-2 border-border/50">{table.headers.map((h, i) => <th key={i} className="text-left p-2">{t(h)}</th>)}</tr></thead>
                    <tbody>{table.rows.map((row, i) => <tr key={i} className="border-b border-border/30">{row.map((v, j) => <td key={j} className="p-2 align-top">{cell(v)}</td>)}</tr>)}</tbody>
                  </table>
                </div>}
              </div>)}
            </section>)}
          </>}
        </main>
        <aside className="no-print xl:sticky xl:top-24 self-start"><MuallimGroupSidebar grupaId={grupaId} activeModule="izvjestaji" /></aside>
      </div>
    </Layout>
  );
}
