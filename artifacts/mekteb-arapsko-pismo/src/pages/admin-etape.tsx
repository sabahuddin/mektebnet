import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { goBackOr } from "@/lib/back-navigation";
import { ArrowLeft, Crown, Medal, Save, Plus, Trash2, Pencil, X, Loader2 } from "lucide-react";

interface Etapa {
  id: number;
  slug: string;
  nivo: number;
  naziv: string;
  opis: string;
  posAfterRedoslijed: number;
  ikona: string;
  boja: string;
  contentHtml: string;
  kvizIds: number[] | null;
  kvizPitanjaIds: number[] | null;
  pragProlazaPercent: number;
  isGating: boolean;
}

interface Krunisanje {
  id: number;
  nivo: number;
  naslov: string;
  opisHtml: string;
  ikona: string;
  boja: string;
  kvizIds: number[] | null;
  kvizPitanjaIds: number[] | null;
  pragProlazaPercent: number;
  isGating: boolean;
}

interface KrunskaLekcija {
  id: number;
  krunisanjeId: number;
  slug: string;
  naslov: string;
  contentHtml: string;
  redoslijed: number;
  isPublished: boolean;
}

interface BankaPitanje {
  id: number;
  pitanje: string;
  vrsta: string;
  kategorija?: string | null;
  lekcijaId?: number | null;
}

interface BankaLekcija { id: number; naslov: string; redoslijed: number; }
interface BankaResponse { lekcije: BankaLekcija[]; pitanja: BankaPitanje[]; }
interface EtapniKviz {
  id: number;
  nivo: number | null;
  etapa: number | null;
  naslov: string;
  isPublished: boolean;
  pitanjaCount: number;
}

function PitanjaPicker({
  url, token, selectedIds, onChange,
}: {
  url: string;
  token: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useLanguage();
  const [data, setData] = useState<BankaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLekcija, setFilterLekcija] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    apiRequest<BankaResponse>("GET", url, undefined, token)
      .then((d) => { if (!cancel) setData(d); })
      .catch(() => { if (!cancel) setData({ lekcije: [], pitanja: [] }); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [url, token]);

  if (loading) return <div className="text-sm text-muted-foreground py-2">{t("Učitavam pitanja iz banke…")}</div>;
  if (!data) return null;

  const selSet = new Set(selectedIds);
  const lekcijaMap = new Map(data.lekcije.map((l) => [l.id, l]));
  const visible = data.pitanja.filter((p) => {
    if (filterLekcija !== "all" && p.lekcijaId !== filterLekcija) return false;
    if (search && !p.pitanje.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const toggle = (id: number) => {
    if (selSet.has(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };
  const allVisIds = visible.map((p) => p.id);
  const allVisSelected = allVisIds.length > 0 && allVisIds.every((id) => selSet.has(id));

  return (
    <div className="border rounded-lg p-2 bg-gray-50 max-h-80 overflow-auto" data-testid="pitanja-picker">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select
          className="text-xs px-2 py-1 border rounded"
          value={String(filterLekcija)}
          onChange={(e) => setFilterLekcija(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}
        >
          <option value="all">{t("Sve lekcije ({n})", { n: String(data.lekcije.length) })}</option>
          {data.lekcije.map((l) => (
            <option key={l.id} value={l.id}>#{l.redoslijed} {l.naslov}</option>
          ))}
        </select>
        <input
          className="text-xs px-2 py-1 border rounded flex-1 min-w-[120px]"
          placeholder={t("Pretraga…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-100"
          onClick={() => {
            if (allVisSelected) onChange(selectedIds.filter((id) => !allVisIds.includes(id)));
            else onChange(Array.from(new Set([...selectedIds, ...allVisIds])));
          }}
        >
          {allVisSelected ? t("Odznači sve") : t("Označi sve")}
        </button>
        <span className="text-xs text-muted-foreground">
          {t("{n} odabrano", { n: String(selectedIds.length) })} • {t("{a}/{b} prikazano", { a: String(visible.length), b: String(data.pitanja.length) })}
        </span>
      </div>
      {visible.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          {t("Nema pitanja u banci za ovaj raspon. Dodaj pitanja u Banci pitanja sa lekcijaId iz ovog opsega.")}
        </div>
      ) : (
        <ul className="space-y-1">
          {visible.map((p) => {
            const lek = p.lekcijaId ? lekcijaMap.get(p.lekcijaId) : null;
            return (
              <li key={p.id}>
                <label className="flex items-start gap-2 text-xs bg-white border rounded px-2 py-1 cursor-pointer hover:bg-emerald-50">
                  <input
                    type="checkbox"
                    checked={selSet.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="font-mono text-gray-400 mr-1">#{p.id}</span>
                    {p.pitanje}
                    {lek && <span className="ml-1 text-gray-400">— {lek.naslov}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function KvizoviEtapaPicker({
  nivo, etapa, token, selectedIds, onChange,
}: {
  nivo: number;
  etapa?: number;
  token: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useLanguage();
  const [kvizovi, setKvizovi] = useState<EtapniKviz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<EtapniKviz[]>("GET", `/content/kvizovi?nivo=${nivo}&modul=ilmihal`, undefined, token)
      .then((rows) => {
        if (!cancelled) {
          setKvizovi(
            rows
              .filter((kviz) => kviz.etapa != null && (etapa == null || kviz.etapa === etapa))
              .sort((a, b) => (a.etapa ?? 0) - (b.etapa ?? 0) || a.naslov.localeCompare(b.naslov)),
          );
        }
      })
      .catch(() => { if (!cancelled) setKvizovi([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nivo, etapa, token]);

  if (loading) return <div className="py-3 text-sm text-muted-foreground">{t("Učitavam etapne kvizove…")}</div>;
  if (kvizovi.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {etapa == null
          ? t("Nema kvizova označenih etapom za ovaj nivo. U editoru kviza prvo postavi Nivo i Etapu.")
          : t("Nema kvizova za ovu etapu. U editoru kviza prvo postavi isti Nivo i Etapu.")}
      </div>
    );
  }

  const selected = new Set(selectedIds);
  return (
    <div className="max-h-64 space-y-2 overflow-auto rounded-lg border bg-gray-50 p-2">
      {kvizovi.map((kviz) => (
        <label key={kviz.id} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-white px-3 py-2 hover:bg-amber-50">
          <input
            type="checkbox"
            checked={selected.has(kviz.id)}
            onChange={() => onChange(
              selected.has(kviz.id)
                ? selectedIds.filter((id) => id !== kviz.id)
                : [...selectedIds, kviz.id],
            )}
            className="mt-1"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-amber-950">
              {kviz.etapa}-{kviz.nivo} · {kviz.naslov}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("{n} pitanja", { n: String(kviz.pitanjaCount ?? 0) })}
              {!kviz.isPublished ? ` · ${t("Privatno — samo admin")}` : ""}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function parseIdsCSV(s: string): number[] {
  return s
    .split(/[\s,;]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export default function AdminEtapePage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [nivo, setNivo] = useState<1 | 2 | 3>(1);
  const [etape, setEtape] = useState<Etapa[]>([]);
  const [krunisanje, setKrunisanje] = useState<Krunisanje | null>(null);
  const [krunskeLekcije, setKrunskeLekcije] = useState<KrunskaLekcija[]>([]);
  const [loading, setLoading] = useState(false);

  const [editEtapa, setEditEtapa] = useState<Etapa | null>(null);
  const [editKrunisanje, setEditKrunisanje] = useState<Krunisanje | null>(null);
  const [editLekcija, setEditLekcija] = useState<KrunskaLekcija | null>(null);
  const [novaLekcija, setNovaLekcija] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivo, token, user?.role, authLoading]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [e, k] = await Promise.all([
        apiRequest<{ etape: Etapa[] }>("GET", `/admin/etape/nivo/${nivo}`, undefined, token),
        apiRequest<{ krunisanje: Krunisanje; lekcije: KrunskaLekcija[] }>(
          "GET",
          `/admin/krunisanja/nivo/${nivo}`,
          undefined,
          token,
        ),
      ]);
      setEtape(e.etape);
      setKrunisanje(k.krunisanje);
      setKrunskeLekcije(k.lekcije);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška"), description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function saveEtapa(e: Etapa) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/admin/etape/${e.id}`, {
        kvizIds: e.kvizIds ?? [],
        kvizPitanjaIds: e.kvizPitanjaIds ?? [],
        pragProlazaPercent: e.pragProlazaPercent,
        isGating: e.isGating,
        naziv: e.naziv,
        opis: e.opis,
        contentHtml: e.contentHtml,
      }, token);
      toast({ title: t("Sačuvano"), description: t(`Etapa "{naziv}"`, { naziv: e.naziv }) });
      setEditEtapa(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška pri spremanju"), description: msg, variant: "destructive" });
    }
  }

  async function saveKrunisanje(k: Krunisanje) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/admin/krunisanja/${k.id}`, {
        naslov: k.naslov,
        opisHtml: k.opisHtml,
        ikona: k.ikona,
        boja: k.boja,
        kvizIds: k.kvizIds ?? [],
        kvizPitanjaIds: k.kvizPitanjaIds ?? [],
        pragProlazaPercent: k.pragProlazaPercent,
        isGating: k.isGating,
      }, token);
      toast({ title: t("Sačuvano"), description: t("Krunisanje") });
      setEditKrunisanje(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška"), description: msg, variant: "destructive" });
    }
  }

  async function createLekcija(naslov: string, contentHtml: string, redoslijed: number, isPublished: boolean) {
    if (!token || !krunisanje) return;
    try {
      await apiRequest("POST", `/admin/krunisanja/${krunisanje.id}/lekcije`, {
        naslov, contentHtml, redoslijed, isPublished,
      }, token);
      toast({ title: t("Kreirana lekcija") });
      setNovaLekcija(false);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška"), description: msg, variant: "destructive" });
    }
  }

  async function updateLekcija(l: KrunskaLekcija) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/admin/krunisanja/lekcije/${l.id}`, {
        naslov: l.naslov, contentHtml: l.contentHtml, redoslijed: l.redoslijed, isPublished: l.isPublished,
      }, token);
      toast({ title: t("Sačuvano") });
      setEditLekcija(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška"), description: msg, variant: "destructive" });
    }
  }

  async function deleteLekcija(id: number) {
    if (!token) return;
    if (!confirm(t("Obrisati ovu krunsku lekciju?"))) return;
    try {
      await apiRequest("DELETE", `/admin/krunisanja/lekcije/${id}`, undefined, token);
      toast({ title: t("Obrisano") });
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: t("Greška"), description: msg, variant: "destructive" });
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="flex items-center gap-3 mb-5 pt-2">
          <button onClick={() => goBackOr(() => setLocation("/admin"))} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-extrabold text-emerald-900 flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" /> {t("Etape i krunisanja")}
          </h1>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setNivo(n as 1 | 2 | 3)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${
                nivo === n
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50"
              }`}
              data-testid={`button-nivo-${n}`}
            >
              {t("Nivo {n}", { n: String(n) })}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-10 text-emerald-700">
            <Loader2 className="w-6 h-6 animate-spin inline" /> {t("Učitavam...")}
          </div>
        )}

        {!loading && (
          <>
            {/* ETAPE */}
            <section className="mb-8">
              <h2 className="text-lg font-extrabold text-emerald-900 mb-3 flex items-center gap-2">
                <Medal className="w-5 h-5" /> {t("Etape (medaljoni) — Nivo {nivo}", { nivo: String(nivo) })}
              </h2>
              <div className="space-y-3">
                {etape.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                    {t("Nema medaljona za ovaj nivo.")}
                  </div>
                )}
                {etape.map((e) => {
                  const ids = e.kvizPitanjaIds ?? [];
                  const kvizIds = e.kvizIds ?? [];
                  return (
                    <div key={e.id} className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-emerald-900 truncate">{e.naziv}</div>
                        <div className="text-xs text-emerald-700/70 truncate">{e.opis}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("{n} odabranih kvizova", { n: String(kvizIds.length) })} • {t("{n} dodatnih pitanja", { n: String(ids.length) })} • {t("prag")} {e.pragProlazaPercent}% • {t("gating")} {e.isGating ? t("DA") : t("NE")} • {t("pos")} {e.posAfterRedoslijed}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditEtapa({ ...e, kvizIds, kvizPitanjaIds: ids })}
                        className="flex items-center gap-1 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-semibold text-sm hover:bg-emerald-100 whitespace-nowrap"
                        data-testid={`button-edit-etapa-${e.id}`}
                      >
                        <Pencil className="w-4 h-4" /> {t("Uredi")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* KRUNISANJE */}
            {krunisanje && (
              <section>
                <h2 className="text-lg font-extrabold text-amber-900 mb-3 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" /> {t("Krunisanje — Nivo {nivo}", { nivo: String(nivo) })}
                </h2>
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-4 mb-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-extrabold text-amber-900 truncate">
                        {krunisanje.naslov || <span className="italic text-amber-700/60">{t("[bez naslova]")}</span>}
                      </div>
                      <div className="text-xs text-amber-700/70 mt-1">
                        {t("{n} odabranih kvizova", { n: String((krunisanje.kvizIds ?? []).length) })} • {t("{n} dodatnih pitanja", { n: String((krunisanje.kvizPitanjaIds ?? []).length) })} • {t("prag")} {krunisanje.pragProlazaPercent}% • {t("gating")} {krunisanje.isGating ? t("DA") : t("NE")}
                      </div>
                    </div>
                    <button
                      onClick={() => setEditKrunisanje({
                        ...krunisanje,
                        kvizIds: krunisanje.kvizIds ?? [],
                        kvizPitanjaIds: krunisanje.kvizPitanjaIds ?? [],
                      })}
                      className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600"
                      data-testid="button-edit-krunisanje"
                    >
                      <Pencil className="w-4 h-4" /> {t("Uredi krunisanje")}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-emerald-900">{t("Krunske lekcije (proizvoljni dodatni sadržaj)")}</h3>
                  <button
                    onClick={() => setNovaLekcija(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700"
                    data-testid="button-nova-krunska-lekcija"
                  >
                    <Plus className="w-4 h-4" /> {t("Nova lekcija")}
                  </button>
                </div>
                <div className="space-y-2">
                  {krunskeLekcije.length === 0 && (
                    <div className="text-sm text-muted-foreground italic text-center py-4">
                      {t("Nema krunskih lekcija. Dodaj prvu da popuniš sadržaj prije završnog ispita.")}
                    </div>
                  )}
                  {krunskeLekcije.map((l) => (
                    <div key={l.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-amber-900 truncate flex items-center gap-2">
                          {l.naslov}
                          {!l.isPublished && <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">{t("draft")}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{t("redoslijed")}: {l.redoslijed} • /krunisanje/lekcija/{l.slug}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setEditLekcija({ ...l })} className="p-2 hover:bg-amber-50 rounded text-amber-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteLekcija(l.id)} className="p-2 hover:bg-red-50 rounded text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* EDIT MODALI */}
      {editEtapa && <EtapaModal etapa={editEtapa} etapaBroj={etape.findIndex((e) => e.id === editEtapa.id) + 1} onClose={() => setEditEtapa(null)} onSave={saveEtapa} token={token!} />}
      {editKrunisanje && <KrunisanjeModal krunisanje={editKrunisanje} onClose={() => setEditKrunisanje(null)} onSave={saveKrunisanje} token={token!} />}
      {(novaLekcija || editLekcija) && (
        <LekcijaModal
          lekcija={editLekcija}
          onClose={() => { setEditLekcija(null); setNovaLekcija(false); }}
          onCreate={createLekcija}
          onUpdate={updateLekcija}
        />
      )}
    </Layout>
  );
}

function EtapaModal({ etapa, etapaBroj, onClose, onSave, token }: { etapa: Etapa; etapaBroj: number; onClose: () => void; onSave: (e: Etapa) => void; token: string }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Etapa>(etapa);
  const [selectedKvizIds, setSelectedKvizIds] = useState<number[]>(etapa.kvizIds ?? []);
  const [selectedIds, setSelectedIds] = useState<number[]>(etapa.kvizPitanjaIds ?? []);
  const [showRaw, setShowRaw] = useState(false);
  const [idsText, setIdsText] = useState((etapa.kvizPitanjaIds ?? []).join(", "));

  return (
    <ModalShell title={t(`Etapa: {naziv}`, { naziv: etapa.naziv })} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t("Naziv")}>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} />
        </Field>
        <Field label={t("Opis")}>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
        </Field>
        <Field label={t("Cijeli kvizovi za ovu etapu ({n} odabrano)", { n: String(selectedKvizIds.length) })}>
          <KvizoviEtapaPicker
            nivo={etapa.nivo}
            etapa={etapaBroj}
            token={token}
            selectedIds={selectedKvizIds}
            onChange={setSelectedKvizIds}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Sva pitanja odabranih kvizova ulaze u završni ispit ove etape. Kviz može ostati privatan.")}
          </p>
        </Field>
        <Field label={t("Pitanja iz banke — odaberi iz lekcija ove etape ({n} odabrano)", { n: String(selectedIds.length) })}>
          <PitanjaPicker
            url={`/admin/etape/${etapa.id}/banka`}
            token={token}
            selectedIds={selectedIds}
            onChange={(ids) => { setSelectedIds(ids); setIdsText(ids.join(", ")); }}
          />
          <div className="flex items-center gap-2 mt-1">
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? t("Sakrij") : t("Prikaži")} {t("ručni unos ID-jeva (napredno)")}
            </button>
          </div>
          {showRaw && (
            <textarea
              className="w-full mt-1 px-3 py-2 border rounded-lg font-mono text-sm h-20"
              value={idsText}
              onChange={(e) => {
                setIdsText(e.target.value);
                setSelectedIds(parseIdsCSV(e.target.value));
              }}
              placeholder={t("npr. 12, 45, 78, 102")}
              data-testid="textarea-pitanja-ids"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Prag prolaza (%)")}>
            <input type="number" min={0} max={100} className="w-full px-3 py-2 border rounded-lg"
              value={form.pragProlazaPercent}
              onChange={(e) => setForm({ ...form, pragProlazaPercent: parseInt(e.target.value, 10) || 0 })} />
          </Field>
          <Field label={t("Gating (zaključava dalje lekcije)")}>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
              <input type="checkbox" checked={form.isGating} onChange={(e) => setForm({ ...form, isGating: e.target.checked })} />
              <span className="text-sm">{form.isGating ? t("Aktivno") : t("Isključeno")}</span>
            </label>
          </Field>
        </div>
        <Field label={t("HTML sadržaj prikazan na strani etape (opcionalno)")}>
          <textarea className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-32"
            value={form.contentHtml ?? ""} onChange={(e) => setForm({ ...form, contentHtml: e.target.value })} />
        </Field>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold text-sm">{t("Otkaži")}</button>
        <button onClick={() => onSave({ ...form, kvizIds: selectedKvizIds, kvizPitanjaIds: selectedIds })}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center gap-1"
          data-testid="button-save-etapa">
          <Save className="w-4 h-4" /> {t("Sačuvaj")}
        </button>
      </div>
    </ModalShell>
  );
}

function KrunisanjeModal({ krunisanje, onClose, onSave, token }: { krunisanje: Krunisanje; onClose: () => void; onSave: (k: Krunisanje) => void; token: string }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Krunisanje>(krunisanje);
  const [selectedKvizIds, setSelectedKvizIds] = useState<number[]>(krunisanje.kvizIds ?? []);
  const [selectedIds, setSelectedIds] = useState<number[]>(krunisanje.kvizPitanjaIds ?? []);
  const [showRaw, setShowRaw] = useState(false);
  const [idsText, setIdsText] = useState((krunisanje.kvizPitanjaIds ?? []).join(", "));
  return (
    <ModalShell title={t(`Krunisanje — Nivo {nivo}`, { nivo: String(krunisanje.nivo) })} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t("Naslov")}>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.naslov}
            onChange={(e) => setForm({ ...form, naslov: e.target.value })} />
        </Field>
        <Field label={t("Opis (HTML)")}>
          <textarea className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-28"
            value={form.opisHtml ?? ""} onChange={(e) => setForm({ ...form, opisHtml: e.target.value })} />
        </Field>
        <Field label={t("Kvizovi iz etapa — sva pitanja odabranih kvizova ulaze u završni ispit ({n} odabrano)", { n: String(selectedKvizIds.length) })}>
          <KvizoviEtapaPicker
            nivo={krunisanje.nivo}
            token={token}
            selectedIds={selectedKvizIds}
            onChange={setSelectedKvizIds}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Kviz može ostati privatan: učenik ga neće vidjeti u katalogu, ali će njegova pitanja biti dio Krunisanja.")}
          </p>
        </Field>
        <Field label={t("Dodatna pojedinačna pitanja iz banke (opcionalno) — nivo {nivo} ({n} odabrano)", { nivo: String(krunisanje.nivo), n: String(selectedIds.length) })}>
          <PitanjaPicker
            url={`/admin/krunisanja/${krunisanje.id}/banka`}
            token={token}
            selectedIds={selectedIds}
            onChange={(ids) => { setSelectedIds(ids); setIdsText(ids.join(", ")); }}
          />
          <div className="flex items-center gap-2 mt-1">
            <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? t("Sakrij") : t("Prikaži")} {t("ručni unos ID-jeva (napredno)")}
            </button>
          </div>
          {showRaw && (
            <textarea className="w-full mt-1 px-3 py-2 border rounded-lg font-mono text-sm h-20"
              value={idsText}
              onChange={(e) => { setIdsText(e.target.value); setSelectedIds(parseIdsCSV(e.target.value)); }}
              placeholder={t("npr. 12, 45, 78")} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Prag prolaza (%)")}>
            <input type="number" min={0} max={100} className="w-full px-3 py-2 border rounded-lg"
              value={form.pragProlazaPercent}
              onChange={(e) => setForm({ ...form, pragProlazaPercent: parseInt(e.target.value, 10) || 0 })} />
          </Field>
          <Field label={t("Gating (zaključava sljedeći nivo)")}>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
              <input type="checkbox" checked={form.isGating} onChange={(e) => setForm({ ...form, isGating: e.target.checked })} />
              <span className="text-sm">{form.isGating ? t("Aktivno") : t("Isključeno")}</span>
            </label>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Ikona (lucide ime, opcionalno)")}>
            <input className="w-full px-3 py-2 border rounded-lg" value={form.ikona ?? ""}
              onChange={(e) => setForm({ ...form, ikona: e.target.value })} />
          </Field>
          <Field label={t("Boja")}>
            <input className="w-full px-3 py-2 border rounded-lg" value={form.boja ?? ""}
              onChange={(e) => setForm({ ...form, boja: e.target.value })} placeholder="amber/emerald/sky..." />
          </Field>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold text-sm">{t("Otkaži")}</button>
        <button onClick={() => onSave({ ...form, kvizIds: selectedKvizIds, kvizPitanjaIds: selectedIds })}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm flex items-center gap-1"
          data-testid="button-save-krunisanje">
          <Save className="w-4 h-4" /> {t("Sačuvaj")}
        </button>
      </div>
    </ModalShell>
  );
}

function LekcijaModal({
  lekcija, onClose, onCreate, onUpdate,
}: {
  lekcija: KrunskaLekcija | null;
  onClose: () => void;
  onCreate: (naslov: string, contentHtml: string, redoslijed: number, isPublished: boolean) => void;
  onUpdate: (l: KrunskaLekcija) => void;
}) {
  const { t } = useLanguage();
  const [naslov, setNaslov] = useState(lekcija?.naslov ?? "");
  const [contentHtml, setContentHtml] = useState(lekcija?.contentHtml ?? "");
  const [redoslijed, setRedoslijed] = useState(lekcija?.redoslijed ?? 100);
  const [isPublished, setIsPublished] = useState(lekcija?.isPublished ?? true);

  return (
    <ModalShell title={lekcija ? t("Uredi krunsku lekciju") : t("Nova krunska lekcija")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t("Naslov")}>
          <input className="w-full px-3 py-2 border rounded-lg" value={naslov} onChange={(e) => setNaslov(e.target.value)} />
        </Field>
        <Field label={t("Sadržaj (HTML)")}>
          <textarea className="w-full px-3 py-2 border rounded-lg font-mono text-sm h-40" value={contentHtml} onChange={(e) => setContentHtml(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Redoslijed")}>
            <input type="number" className="w-full px-3 py-2 border rounded-lg" value={redoslijed} onChange={(e) => setRedoslijed(parseInt(e.target.value, 10) || 0)} />
          </Field>
          <Field label={t("Status")}>
            <label className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              <span className="text-sm">{isPublished ? t("Objavljeno") : t("Draft")}</span>
            </label>
          </Field>
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-bold text-sm">{t("Otkaži")}</button>
        <button
          onClick={() => {
            if (!naslov.trim()) return;
            if (lekcija) onUpdate({ ...lekcija, naslov, contentHtml, redoslijed, isPublished });
            else onCreate(naslov, contentHtml, redoslijed, isPublished);
          }}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center gap-1"
          data-testid="button-save-lekcija"
        >
          <Save className="w-4 h-4" /> {t("Sačuvaj")}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground block mb-1">{label}</span>
      {children}
    </label>
  );
}
