import { useCallback, useEffect, useState } from "react";
import { BookOpenText, ChevronRight, CircleCheck, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";

interface Bulletin {
  id: number;
  naslov: string;
  sadrzaj: string;
  status: "nacrt" | "objavljeno";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  autorName: string;
  procitanoAt: string | null;
}

export default function BiltenTab({ onRead }: { onRead?: () => void }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<Bulletin[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [readingId, setReadingId] = useState<number | null>(null);

  const load = useCallback(async (initial = false) => {
    if (!token) return;
    if (initial) setLoading(true);
    try {
      const rows = await apiRequest<Bulletin[]>("GET", "/bilten-muallimi", undefined, token);
      setItems(rows.filter(row => row.status === "objavljeno").sort((a, b) =>
        new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const open = async (row: Bulletin) => {
    setSelectedId(row.id);
    if (!token || row.procitanoAt || readingId === row.id) return;
    setReadingId(row.id);
    // Kartica se odmah označi pročitanom; ako server odbije upis, vrati oznaku.
    const readAt = new Date().toISOString();
    setItems(current => current.map(item => item.id === row.id ? { ...item, procitanoAt: readAt } : item));
    try {
      await apiRequest("POST", `/bilten-muallimi/${row.id}/procitano`, {}, token);
      onRead?.();
    } catch (err) {
      setItems(current => current.map(item => item.id === row.id ? { ...item, procitanoAt: null } : item));
      toast({ title: t("Nije moguće označiti kao pročitano"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setReadingId(null);
    }
  };

  const selected = items.find(row => row.id === selectedId);
  return <section className="overflow-hidden rounded-[1.75rem] border border-[#bcd7ce] bg-[#f3f7f0] text-[#214a45]" data-testid="muallim-bilten">
    <header className="relative overflow-hidden bg-[#dcece4] px-5 py-8 sm:px-9 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-64 w-64 rounded-full border-[36px] border-[#b1d2c0]/45" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#275f55] text-[#eff7ef]"><BookOpenText className="h-6 w-6" /></div>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#527c70]">{t("Za muallime / Obavijesti")}</p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{t("Bilten za muallime")}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#527169]">{t("Važna obavještenja na jednom mjestu. Ovo nije privatni razgovor s administratorom.")}</p>
        </div>
      </div>
    </header>
    <div className="grid min-h-[330px] md:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.5fr)]">
      <div className="border-b border-[#cbded3] p-4 md:border-b-0 md:border-r sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#527c70]">{t("Arhiva")} · {items.length}</h3>
          <button type="button" data-testid="button-osvjezi-arhivu" onClick={() => void load(true)} aria-label={t("Osvježi arhivu")} className="rounded-lg p-2 hover:bg-[#e0ece4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#275f55]"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {loading ? <div className="space-y-3" aria-label={t("Učitavanje...")}><div className="h-20 animate-pulse rounded-xl bg-[#dbe9df]" /><div className="h-20 animate-pulse rounded-xl bg-[#dbe9df]" /></div> :
          error ? <div role="alert" className="rounded-xl border border-[#deb9a8] bg-[#fff4e9] p-4 text-sm">{t("Arhiva trenutno nije dostupna.")}<button type="button" onClick={() => void load(true)} className="mt-2 block font-bold underline">{t("Pokušaj ponovo")}</button></div> :
          items.length === 0 ? <div className="rounded-xl border border-dashed border-[#bcd7ce] p-6 text-center"><BookOpenText className="mx-auto h-8 w-8 text-[#6c9b88]" /><p className="mt-3 font-bold">{t("Arhiva je još prazna")}</p><p className="mt-1 text-sm text-[#668078]">{t("Novi bilteni će se pojaviti ovdje nakon objave.")}</p></div> :
          <div className="space-y-2">{items.map(row => <button key={row.id} type="button" onClick={() => void open(row)}
            data-testid={`button-otvori-bilten-${row.id}`} aria-current={selectedId === row.id ? "true" : undefined}
            className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#275f55] ${selectedId === row.id ? "border-[#6b9e88] bg-[#e5f1e7]" : "border-[#d3e3d8] bg-[#fbfcf7] hover:border-[#91b9a6]"}`}>
            <span className="flex items-start gap-2"><span className="min-w-0 flex-1 break-words text-sm font-bold leading-snug">{row.naslov}</span>{!row.procitanoAt ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#b87944]" aria-label={t("Nepročitano")} /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#6c9b88]" />}</span>
            <span className="mt-2 block text-xs text-[#668078]">{new Date(row.publishedAt || row.createdAt).toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric" })} · {row.autorName}</span>
          </button>)}</div>}
      </div>
      <div className="min-w-0 p-5 sm:p-9" aria-live="polite">
        {selected ? <article data-testid={`article-bilten-${selected.id}`}>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.13em] text-[#638477]">
            {selected.procitanoAt ? <><CircleCheck className="h-4 w-4" /> {t("Pročitano")}</> : t("Bilten")}
          </p>
          <h3 className="mt-4 break-words text-2xl font-extrabold leading-tight sm:text-3xl">{selected.naslov}</h3>
          <p className="mt-3 text-xs text-[#668078]">{selected.autorName} · <time dateTime={selected.publishedAt || selected.createdAt}>{new Date(selected.publishedAt || selected.createdAt).toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric" })}</time></p>
          <div className="mt-7 whitespace-pre-wrap break-words border-t border-[#cbded3] pt-7 text-[15px] leading-8 text-[#36564f]">{selected.sadrzaj}</div>
        </article> : <div className="flex h-full min-h-[210px] flex-col items-center justify-center text-center"><BookOpenText className="h-9 w-9 text-[#8bb3a1]" /><p className="mt-4 font-bold">{t("Odaberite bilten iz arhive")}</p><p className="mt-1 text-sm text-[#668078]">{t("Otvorite obavijest kako biste je pročitali.")}</p></div>}
      </div>
    </div>
  </section>;
}