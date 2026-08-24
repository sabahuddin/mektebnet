import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { goBackOr } from "@/lib/back-navigation";
import { useToast } from "@/hooks/use-toast";
import { LANG_NAMES, type Lang } from "@/lib/i18n";
import sqFlat from "@/locales/sq.json";
import deFlat from "@/locales/de.json";
import enFlat from "@/locales/en.json";
import trFlat from "@/locales/tr.json";
import arFlat from "@/locales/ar.json";
import {
  ArrowLeft, Search, Save, RotateCcw, Loader2, X, Languages, FileText, Pencil,
} from "lucide-react";

const EDIT_LANGS: Lang[] = ["sq", "de", "en", "tr", "ar"];

const LOCALE_FLAT: Record<string, Record<string, string>> = {
  sq: sqFlat as Record<string, string>,
  de: deFlat as Record<string, string>,
  en: enFlat as Record<string, string>,
  tr: trFlat as Record<string, string>,
  ar: arFlat as Record<string, string>,
};

const TABELA_LABELS: Record<string, string> = {
  ilmihal_lekcije: "Ilmihal — lekcije",
  knjige: "Čitaonica — knjige",
  medaljoni: "Medaljoni",
  rjecnik: "Rječnik",
  pitanja_banka: "Banka pitanja",
  igra_pitanja: "Igra — pitanja",
  kvizovi: "Kvizovi",
  misija_definicija: "Misije",
};

interface UiRow { jezik: string; kljuc: string; prijevod: string }
interface ContentHit {
  id: number; tabela: string; redId: number; polje: string;
  snippet: string; len: number; izvor: string;
}
interface ContentFull {
  id: number; tabela: string; redId: number; polje: string;
  jezik: string; prijevod: string; izvor: string;
}

export default function AdminPrijevodiPage() {
  const { user, token } = useAuth();
  const { t, reloadUiOverrides } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tab, setTab] = useState<"ui" | "sadrzaj">("ui");
  const [lang, setLang] = useState<Lang>("en");

  // Override mapa { jezik: { kljuc: prijevod } } iz baze
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    void loadOverrides();
  }, [user, token]);

  const loadOverrides = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ rows: UiRow[] }>("GET", "/admin/prijevodi/ui", undefined, token);
      const map: Record<string, Record<string, string>> = {};
      for (const r of data.rows) (map[r.jezik] ??= {})[r.kljuc] = r.prijevod;
      setOverrides(map);
    } catch {
      // tiho — prikazat će se samo bundlani prijevodi
    }
  }, [token]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <button
          onClick={() => goBackOr(() => setLocation("/admin"))}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Languages className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-extrabold">{t("Uređivanje prijevoda")}</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          {t("Ispravi bilo koji prijevod interfejsa ili sadržaja bez diranja koda. Izmjene su odmah vidljive na platformi (interfejs odmah, sadržaj nakon osvježavanja stranice).")}
        </p>

        {/* Jezik */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-muted-foreground">{t("Jezik:")}</span>
          {EDIT_LANGS.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
                lang === l
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white text-foreground border-border hover:bg-muted"
              }`}
            >
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>

        {/* Tabovi */}
        <div className="flex gap-2 mb-5 border-b border-border">
          <button
            onClick={() => setTab("ui")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === "ui" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Languages className="w-4 h-4" /> {t("Interfejs")}
          </button>
          <button
            onClick={() => setTab("sadrzaj")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === "sadrzaj" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" /> {t("Sadržaj")}
          </button>
        </div>

        {tab === "ui" ? (
          <UiTab
            lang={lang}
            token={token}
            overrides={overrides}
            onSaved={async () => { await loadOverrides(); await reloadUiOverrides(); }}
          />
        ) : (
          <SadrzajTab lang={lang} token={token} />
        )}
      </div>
    </Layout>
  );
}

/* ----------------------------- Interfejs tab ----------------------------- */
function UiTab({
  lang, token, overrides, onSaved,
}: {
  lang: Lang;
  token: string | null;
  overrides: Record<string, Record<string, string>>;
  onSaved: () => Promise<void>;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const ovLang = overrides[lang] ?? {};
  const base = LOCALE_FLAT[lang] ?? {};

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [] as { kljuc: string; current: string; overridden: boolean }[];
    const out: { kljuc: string; current: string; overridden: boolean }[] = [];
    for (const kljuc of Object.keys(base)) {
      const overridden = Object.prototype.hasOwnProperty.call(ovLang, kljuc);
      const current = overridden ? ovLang[kljuc] : base[kljuc];
      if (kljuc.toLowerCase().includes(needle) || (current ?? "").toLowerCase().includes(needle)) {
        out.push({ kljuc, current: current ?? "", overridden });
      }
      if (out.length >= 200) break;
    }
    return out;
  }, [q, base, ovLang]);

  const startEdit = (kljuc: string, current: string) => {
    setEditKey(kljuc);
    setDraft(current);
  };

  const save = async () => {
    if (!token || editKey == null) return;
    if (!draft.trim()) { toast({ title: t("Prijevod ne smije biti prazan"), variant: "destructive" }); return; }
    setBusy(true);
    try {
      await apiRequest("POST", "/admin/prijevodi/ui", { jezik: lang, kljuc: editKey, prijevod: draft }, token);
      toast({ title: t("Sačuvano"), description: t("Prijevod interfejsa ažuriran.") });
      setEditKey(null);
      await onSaved();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Spremanje neuspjelo"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revert = async (kljuc: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await apiRequest("DELETE", "/admin/prijevodi/ui", { jezik: lang, kljuc }, token);
      toast({ title: t("Vraćeno"), description: t("Override uklonjen — koristi se originalni prijevod.") });
      if (editKey === kljuc) setEditKey(null);
      await onSaved();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Vraćanje neuspjelo"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Upiši riječ koju vidiš na ekranu (npr. Ilmihan)…")}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {q.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("Upiši najmanje 2 znaka za pretragu prijevoda interfejsa.")}
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('Nema rezultata za "{query}".', { query: q })}</p>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.kljuc} className="border border-border rounded-xl p-3 bg-white">
              <div className="text-xs text-muted-foreground mb-1">
                {t("Bosanski (izvor):")} <span className="text-foreground font-medium">{r.kljuc}</span>
                {r.overridden && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">{t("izmijenjeno")}</span>
                )}
              </div>
              {editKey === r.kljuc ? (
                <div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={save} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Sačuvaj")}
                    </button>
                    <button onClick={() => setEditKey(null)} disabled={busy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-semibold">
                      <X className="w-4 h-4" /> {t("Odustani")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm flex-1" dir={lang === "ar" ? "rtl" : "ltr"}>{r.current || <span className="text-muted-foreground italic">{t("(prazno)")}</span>}</div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => startEdit(r.kljuc, r.current)} title={t("Uredi")}
                      className="p-1.5 rounded-lg hover:bg-muted text-primary"><Pencil className="w-4 h-4" /></button>
                    {r.overridden && (
                      <button onClick={() => revert(r.kljuc)} disabled={busy} title={t("Vrati original")}
                        className="p-1.5 rounded-lg hover:bg-muted text-amber-600"><RotateCcw className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {results.length >= 200 && (
            <p className="text-xs text-muted-foreground text-center pt-2">{t("Prikazano prvih 200 — suzi pretragu.")}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Sadržaj tab ------------------------------ */
function SadrzajTab({ lang, token }: { lang: Lang; token: string | null }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ContentHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ContentFull | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!token) return;
    const term = q.trim();
    if (term.length < 2) { toast({ title: t("Upiši najmanje 2 znaka"), variant: "destructive" }); return; }
    setLoading(true);
    try {
      const data = await apiRequest<{ rows: ContentHit[] }>(
        "GET",
        `/admin/prijevodi/content?lang=${lang}&q=${encodeURIComponent(term)}&limit=200`,
        undefined,
        token,
      );
      setHits(data.rows);
      setSearched(true);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Pretraga neuspjela"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openEdit = async (id: number) => {
    if (!token) return;
    try {
      const full = await apiRequest<ContentFull>("GET", `/admin/prijevodi/content/${id}`, undefined, token);
      setEditing(full);
      setDraft(full.prijevod);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Učitavanje neuspjelo"), variant: "destructive" });
    }
  };

  const save = async () => {
    if (!token || !editing) return;
    if (!draft.trim()) { toast({ title: t("Prijevod ne smije biti prazan"), variant: "destructive" }); return; }
    setBusy(true);
    try {
      await apiRequest("PUT", `/admin/prijevodi/content/${editing.id}`, { prijevod: draft }, token);
      toast({ title: t("Sačuvano"), description: t("Prijevod sadržaja ažuriran.") });
      setHits((prev) => prev.map((h) => (h.id === editing.id
        ? { ...h, snippet: draft.slice(0, 240), len: draft.length }
        : h)));
      setEditing(null);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Spremanje neuspjelo"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const isHtml = editing ? editing.polje.includes("html") : false;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
            placeholder={t("Upiši pogrešnu riječ iz lekcije/kviza/knjige…")}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <button onClick={search} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {t("Traži")}
        </button>
      </div>

      {!searched ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("Pretraži prevedeni sadržaj ({jezik}) po tekstu koji vidiš na platformi.", { jezik: LANG_NAMES[lang] })}
        </p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('Nema rezultata za "{query}".', { query: q })}</p>
      ) : (
        <div className="space-y-2">
          {hits.map((h) => (
            <button key={h.id} onClick={() => openEdit(h.id)}
              className="w-full text-left border border-border rounded-xl p-3 bg-white hover:border-primary/50 transition">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold text-muted-foreground">
                   {TABELA_LABELS[h.tabela] ? t(TABELA_LABELS[h.tabela]) : h.tabela} · {h.polje}
                </span>
                 {h.len > 240 && <span className="text-[10px] text-muted-foreground">{t("(duži tekst)")}</span>}
              </div>
              {h.izvor && (
                 <div className="text-xs text-muted-foreground mb-0.5">{t("BS:")} {h.izvor}</div>
              )}
              <div className="text-sm" dir={lang === "ar" ? "rtl" : "ltr"}>{h.snippet}</div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
               <h3 className="font-bold">{TABELA_LABELS[editing.tabela] ? t(TABELA_LABELS[editing.tabela]) : editing.tabela} · {editing.polje}</h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            {editing.izvor && (
              <div className="mb-3">
                 <div className="text-xs font-semibold text-muted-foreground mb-1">{t("Bosanski izvor")}</div>
                <div className="text-sm bg-muted/50 rounded-lg p-2 max-h-32 overflow-auto whitespace-pre-wrap">{editing.izvor}</div>
              </div>
            )}
            <div className="text-xs font-semibold text-muted-foreground mb-1">
               {t("Prijevod ({jezik})", { jezik: LANG_NAMES[lang] })}{isHtml && t(" — HTML, pazi na tagove")}
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={isHtml ? 14 : 5}
              dir={lang === "ar" ? "rtl" : "ltr"}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={save} disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                 {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("Sačuvaj")}
              </button>
              <button onClick={() => setEditing(null)} disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-semibold">
                 <X className="w-4 h-4" /> {t("Odustani")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
