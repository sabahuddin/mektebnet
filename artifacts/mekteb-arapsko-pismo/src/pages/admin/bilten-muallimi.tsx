import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookOpenText, Check, ChevronRight, CircleAlert, Eye, FilePenLine, Plus, RefreshCw, Send, X } from "lucide-react";
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

const date = (value: string) => new Date(value).toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric" });

// Urednički prijedlog je samo lokalni tekst u obrascu; ne kreira se nacrt niti
// se bilo šta šalje dok administrator ne klikne Sačuvaj i potom Objavi.
const firstBulletin = {
  naslov: "Novosti u Mektebu · 24–26. septembar 2026.",
  sadrzaj: `Dragi muallimi,

Donosimo kratak pregled novosti iz posljednjih nekoliko dana:

• Pitanja i prijedlozi — u Muallim panelu možete privatno pisati administratoru. Odgovor ćete vidjeti na istom mjestu; vaša pitanja nisu vidljiva drugim muallimima.

• Obavijesti muallimima — važne zajedničke novosti ubuduće su u posebnoj arhivi, odvojene od privatnih poruka.

• Dodavanje učenika i roditelja — pri masovnom unosu imena roditelja možete odvojiti zarezom.

• Zadaće — vraćen je prikaz rokova, a u zadaću se mogu ugraditi i Wayground vježbe. Dostupna je i ciljana dodjela podgrupama.

• Saradnja s roditeljima — pregled učenika olakšava slanje poruka roditeljima i pronalazak arhiviranih učenika.

Hvala vam na prijedlozima i svakodnevnom radu s djecom. Ako imate pitanje ili primijetite problem, pišite nam kroz „Pitanja i prijedlozi” u svom panelu.

Srdačno,
Mekteb tim`,
};

export default function BiltenMuallimiAdmin() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Bulletin | null>(null);
  const [naslov, setNaslov] = useState("");
  const [sadrzaj, setSadrzaj] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(false);
    try {
      const result = await apiRequest<Bulletin[]>("GET", "/bilten-muallimi", undefined, token);
      setItems(result);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const choose = (item: Bulletin | null): boolean => {
    if ((naslov !== (selected?.naslov ?? "") || sadrzaj !== (selected?.sadrzaj ?? "")) &&
      !window.confirm(t("Odbaciti nesačuvane izmjene?"))) return false;
    setSelected(item);
    setNaslov(item?.naslov ?? "");
    setSadrzaj(item?.sadrzaj ?? "");
    setPreview(item?.status === "objavljeno");
    setConfirmPublish(false);
    return true;
  };

  const notifyError = (e: unknown) => toast({
    title: t("Radnja nije uspjela"),
    description: e instanceof Error ? e.message : t("Pokušaj ponovo."),
    variant: "destructive",
  });

  // API has no conditional write/version field. Check current version immediately before saving
  // so an editor is not silently overwritten after another administrator updates the draft.
  const checkCurrent = async (item: Bulletin) => {
    const latest = await apiRequest<Bulletin[]>("GET", "/bilten-muallimi", undefined, token);
    const current = latest.find(row => row.id === item.id);
    if (!current || current.status !== "nacrt" || current.updatedAt !== item.updatedAt) {
      setItems(latest);
      throw new Error(t("Nacrt je u međuvremenu izmijenjen. Osvježi ga prije nastavka."));
    }
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!token || busy || !naslov.trim() || !sadrzaj.trim() || selected?.status === "objavljeno") return;
    setBusy(true);
    try {
      if (selected) await checkCurrent(selected);
      const row = selected
        ? await apiRequest<Bulletin>("PUT", `/bilten-muallimi/${selected.id}`, { naslov: naslov.trim(), sadrzaj: sadrzaj.trim() }, token)
        : await apiRequest<Bulletin>("POST", "/bilten-muallimi", { naslov: naslov.trim(), sadrzaj: sadrzaj.trim() }, token);
      setSelected(row);
      setNaslov(row.naslov);
      setSadrzaj(row.sadrzaj);
      toast({ title: t("Nacrt je sačuvan") });
      await load();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!token || !selected || selected.status !== "nacrt" || busy) return;
    setBusy(true);
    try {
      await checkCurrent(selected);
      await apiRequest("POST", `/bilten-muallimi/${selected.id}/objavi`, {}, token);
      setConfirmPublish(false);
      toast({ title: t("Bilten je objavljen muallimima") });
      const latest = await apiRequest<Bulletin[]>("GET", "/bilten-muallimi", undefined, token);
      setItems(latest);
      const published = latest.find(row => row.id === selected.id);
      if (published) setSelected(published);
      setPreview(true);
    } catch (err) {
      notifyError(err);
      void load();
    } finally {
      setBusy(false);
    }
  };

  const dirty = selected?.status !== "objavljeno" &&
    (naslov !== (selected?.naslov ?? "") || sadrzaj !== (selected?.sadrzaj ?? ""));
  const drafts = items.filter(item => item.status === "nacrt");
  const published = items.filter(item => item.status === "objavljeno");

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-teal-900/15 bg-[#f8f6ef] text-[#203e3a]" data-testid="admin-bilten">
      <div className="relative overflow-hidden bg-[#173f3e] px-5 py-8 text-[#f9f4e9] sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-28 h-80 w-80 rounded-full border-[42px] border-[#d8c39d]/10" />
        <p className="relative text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d9bb83]">{t("Uredništvo / Muallimi")}</p>
        <h2 className="relative mt-3 max-w-lg text-3xl font-extrabold leading-tight sm:text-4xl">{t("Bilten za muallime")}</h2>
        <p className="relative mt-3 max-w-xl text-sm leading-relaxed text-[#d6e5dc]">{t("Jedno mjesto za važne obavijesti svim muallimima. Nacrti ostaju privatni dok ih ne objavite.")}</p>
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[#d9ddd2] bg-[#eef0e6] p-4 lg:border-b-0 lg:border-r lg:p-5" aria-label={t("Bilteni")}>
          <button type="button" data-testid="button-novi-bilten" onClick={() => choose(null)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b87944] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#986136] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#986136]">
            <Plus className="h-4 w-4" /> {t("Novi nacrt")}
          </button>
           {!loading && !error && items.length === 0 && (
             <button type="button" data-testid="button-prijedlog-prvog-biltena"
               onClick={() => {
                 if (!choose(null)) return;
                 setNaslov(firstBulletin.naslov);
                 setSadrzaj(firstBulletin.sadrzaj);
               }}
               className="mt-3 w-full rounded-xl border border-[#b87944]/45 bg-[#fffaf0] px-4 py-3 text-left text-sm font-bold text-[#75502d] hover:bg-white">
               {t("Ubaci prijedlog prve objave")}
             </button>
           )}
          <div className="mt-7 flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#54726a]">{t("Nacrti")} · {drafts.length}</h3>
            <button type="button" data-testid="button-osvjezi-bilten" onClick={() => void load()} aria-label={t("Osvježi biltene")} className="rounded-lg p-1 text-[#54726a] hover:bg-[#dce5d9]"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {loading ? <div className="mt-3 space-y-2" aria-label={t("Učitavanje...")}><div className="h-16 animate-pulse rounded-xl bg-[#dae4d9]" /><div className="h-16 animate-pulse rounded-xl bg-[#dae4d9]" /></div> :
            error ? <div role="alert" className="mt-3 rounded-xl border border-[#cb9c82] bg-[#fff2e7] p-3 text-sm">{t("Bilteni nisu učitani.")}<button type="button" onClick={() => void load()} className="mt-2 block font-bold underline">{t("Pokušaj ponovo")}</button></div> :
            <>
              {drafts.length === 0 && <p className="mt-3 text-sm text-[#668078]">{t("Još nema nacrta.")}</p>}
              <div className="mt-2 space-y-2">{drafts.map(item =>
                <button key={item.id} type="button" data-testid={`button-nacrt-${item.id}`} onClick={() => choose(item)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selected?.id === item.id ? "border-[#b87944] bg-[#fffaf0]" : "border-[#d9ddd2] bg-[#f8f6ef] hover:bg-white"}`}>
                  <span className="block truncate text-sm font-bold">{item.naslov}</span>
                  <span className="mt-1 block text-xs text-[#668078]">{date(item.updatedAt)}</span>
                </button>)}</div>
              <h3 className="mt-8 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#54726a]">{t("Objavljeno")} · {published.length}</h3>
              {published.length === 0 && <p className="mt-3 text-sm text-[#668078]">{t("Još nema objavljenih biltena.")}</p>}
              <div className="mt-2 space-y-2">{published.map(item =>
                <button key={item.id} type="button" data-testid={`button-objavljen-bilten-${item.id}`} onClick={() => choose(item)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl p-3 text-left text-sm transition-colors ${selected?.id === item.id ? "bg-[#d9e5d9] font-bold" : "hover:bg-[#dfe9dd]"}`}>
                  <span className="min-w-0 truncate">{item.naslov}</span><ChevronRight className="h-4 w-4 shrink-0" />
                </button>)}</div>
            </>}
        </aside>

        <div className="min-w-0 p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9ddd2] pb-5">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.13em] text-[#54726a]">
              <BookOpenText className="h-4 w-4" /> {selected?.status === "objavljeno" ? t("Objavljeni bilten") : selected ? t("Uređivanje nacrta") : t("Novi nacrt")}
            </div>
            {selected?.status !== "objavljeno" && <div className="flex rounded-lg bg-[#e6e9df] p-1">
              <button type="button" data-testid="button-uredi-bilten" onClick={() => setPreview(false)} aria-pressed={!preview} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold ${!preview ? "bg-[#fffaf0] shadow-sm" : ""}`}><FilePenLine className="h-3.5 w-3.5" />{t("Uredi")}</button>
              <button type="button" data-testid="button-pregled-bilten" onClick={() => setPreview(true)} aria-pressed={preview} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold ${preview ? "bg-[#fffaf0] shadow-sm" : ""}`}><Eye className="h-3.5 w-3.5" />{t("Pregled")}</button>
            </div>}
          </div>
          {preview || selected?.status === "objavljeno" ?
            <article className="py-8" data-testid="preview-bilten">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#a1693d]">{selected?.status === "objavljeno" ? t("Objavljeno") : t("Pregled nacrta")}</span>
              <h3 className="mt-3 break-words text-2xl font-extrabold leading-tight sm:text-3xl">{naslov || t("Naslov biltena")}</h3>
              {selected && <p className="mt-3 text-xs text-[#668078]">{selected.autorName} · {date(selected.publishedAt || selected.updatedAt)}</p>}
              <div className="mt-7 whitespace-pre-wrap break-words border-t border-[#d9ddd2] pt-7 text-[15px] leading-8 text-[#314c46]">{sadrzaj || t("Sadržaj biltena će se prikazati ovdje.")}</div>
            </article> :
            <form id="bilten-form" onSubmit={save} className="space-y-6 py-7">
              <label className="block text-xs font-extrabold uppercase tracking-[0.12em] text-[#54726a]" htmlFor="bilten-naslov">{t("Naslov")}
                 <input id="bilten-naslov" data-testid="input-bilten-naslov" required maxLength={180} value={naslov} onChange={e => setNaslov(e.target.value)}
                  placeholder={t("Upišite naslov biltena")} className="mt-2 w-full rounded-xl border border-[#c9d3c7] bg-[#fffdf8] px-4 py-3 text-base font-semibold normal-case tracking-normal text-[#203e3a] outline-none focus:border-[#b87944] focus:ring-2 focus:ring-[#b87944]/20" />
              </label>
              <label className="block text-xs font-extrabold uppercase tracking-[0.12em] text-[#54726a]" htmlFor="bilten-sadrzaj">{t("Sadržaj")}
                 <textarea id="bilten-sadrzaj" data-testid="input-bilten-sadrzaj" required maxLength={12000} rows={13} value={sadrzaj} onChange={e => setSadrzaj(e.target.value)}
                  placeholder={t("Napišite obavijest za muallime...")} className="mt-2 w-full resize-y rounded-xl border border-[#c9d3c7] bg-[#fffdf8] px-4 py-3 text-sm font-normal normal-case leading-7 tracking-normal text-[#203e3a] outline-none focus:border-[#b87944] focus:ring-2 focus:ring-[#b87944]/20" />
              </label>
            </form>}
          {selected?.status !== "objavljeno" && <div className="flex flex-wrap items-center gap-3 border-t border-[#d9ddd2] pt-5">
            <button type={preview ? "button" : "submit"} form={preview ? undefined : "bilten-form"} onClick={preview ? () => void save() : undefined}
              disabled={busy || !dirty || !naslov.trim() || !sadrzaj.trim()} data-testid="button-sacuvaj-bilten"
              className="rounded-xl border border-[#68877a] px-5 py-2.5 text-sm font-bold text-[#24544c] hover:bg-[#e9efe7] disabled:cursor-not-allowed disabled:opacity-40">{t("Sačuvaj nacrt")}</button>
            {selected && <button type="button" data-testid="button-objavi-bilten" onClick={() => setConfirmPublish(true)}
              disabled={busy || dirty || !preview} className="flex items-center gap-2 rounded-xl bg-[#173f3e] px-5 py-2.5 text-sm font-bold text-[#f9f4e9] hover:bg-[#245952] disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" />{t("Objavi svima")}</button>}
            <p className="text-xs text-[#668078]">{dirty ? t("Sačuvajte izmjene prije objave.") : selected && !preview ? t("Pregledajte bilten prije objave.") : t("Objava šalje obavijest svim muallimima.")}</p>
          </div>}
        </div>
      </div>
      {confirmPublish && selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0c2928]/70 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setConfirmPublish(false); }}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="bilten-confirm-title" aria-describedby="bilten-confirm-description" className="w-full max-w-md rounded-2xl bg-[#fffaf0] p-6 shadow-2xl sm:p-8" onKeyDown={e => { if (e.key === "Escape" && !busy) setConfirmPublish(false); }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e5ede2] text-[#24544c]"><CircleAlert className="h-6 w-6" /></div>
          <h3 id="bilten-confirm-title" className="mt-5 text-xl font-extrabold">{t("Objaviti bilten svim muallimima?")}</h3>
          <p id="bilten-confirm-description" className="mt-2 text-sm leading-6 text-[#54726a]">{t("Objava je konačna. Muallimi će vidjeti bilten u arhivi i dobiti obavijest.")}</p>
          <p className="mt-4 break-words rounded-xl bg-[#eef0e6] p-3 font-bold">{selected.naslov}</p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus onClick={() => setConfirmPublish(false)} disabled={busy} className="flex items-center gap-1 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[#eef0e6]"><X className="h-4 w-4" />{t("Otkaži")}</button>
            <button type="button" data-testid="button-potvrdi-objavu" onClick={() => void publish()} disabled={busy} className="flex items-center gap-1 rounded-xl bg-[#173f3e] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" />{busy ? t("Objavljivanje...") : t("Potvrdi objavu")}</button>
          </div>
        </div>
      </div>}
    </section>
  );
}