import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, X, Search, ChevronUp, ChevronDown,
  ArrowRightLeft, BookOpenCheck, ClipboardList, Database, Pencil
} from "lucide-react";

// Admin editor jednog kviza. Pravi novi kviz (kad nema id-a) ili uređuje
// postojeći. Pitanja se NE čuvaju u JSONB-u — bira ih iz centralne banke
// preko join tabele `kviz_pitanja`.
//
// Backend rute:
//   POST   /admin/kvizovi                              (kreiraj prazan kviz)
//   PUT    /admin/kvizovi/:id                          (meta: naslov, kategorija, lekcijaId, opis, ...)
//   DELETE /admin/kvizovi/:id                          (cascade)
//   GET    /admin/kvizovi/:id/pitanja                  (linkovana iz banke, sortirana)
//   POST   /admin/kvizovi/:id/dodaj-pitanja            { pitanjeIds: number[] }
//   DELETE /admin/kvizovi/:id/pitanja/:pitanjeId
//   POST   /admin/kvizovi/:id/premjesti-pitanje        { pitanjeId, ciljniKvizId }
//   PUT    /admin/kvizovi/:id/redoslijed               { pitanjeIds: number[] }

interface Kviz {
  id: number;
  nivo: number | null;
  slug: string;
  naslov: string;
  modul: string;
  variant: string | null;
  kategorija: string | null;
  lekcijaId: number | null;
  opis: string;
  isPublished: boolean;
}

interface PitanjeMeta {
  template?: string[];
  words?: string[];
  correct?: string[];
  text?: string;
  incorrect?: string[];
}

interface KvizPitanjeRow {
  id: number;
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  vrsta: string;
  meta: PitanjeMeta | null;
  kategorija: string | null;
  redoslijed: number;
  linkId: number;
}

interface PitanjeBanka {
  id: number;
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  vrsta: string;
  meta: PitanjeMeta | null;
  kategorija: string | null;
  lekcijaId: number | null;
}

const VRSTA_LABELS: Record<string, string> = {
  single: "Jedan tačan",
  multiple: "Više tačnih",
  truefalse: "Da/Ne",
  reorder: "Poredaj",
  dragDrop: "Dopuni",
  markWords: "Pronađi grešku",
};

function PitanjeAnswerPreview({ p }: { p: { vrsta?: string; meta: PitanjeMeta | null; opcije: string[]; correctIndex: number } }) {
  if (p.vrsta === "dragDrop" && p.meta?.template) {
    let dropIdx = 0;
    return (
      <p className="text-xs text-emerald-700 mt-0.5 line-clamp-1">
        {p.meta.template.map((t, i) => t === "DROP"
          ? <span key={i} className="px-1.5 mx-0.5 bg-amber-100 rounded text-amber-800 font-semibold">{p.meta!.correct?.[dropIdx++] || "___"}</span>
          : <span key={i}>{t} </span>
        )}
      </p>
    );
  }
  if (p.vrsta === "markWords" && p.meta?.words) {
    return (
      <p className="text-xs text-emerald-700 mt-0.5 line-clamp-1">
        {p.meta.words.map((w, i) => (
          <span key={i} className={p.meta!.incorrect?.includes(w) ? "text-red-600 line-through font-semibold mr-1" : "mr-1"}>{w}</span>
        ))}
      </p>
    );
  }
  if (p.vrsta === "reorder") {
    return <p className="text-xs text-emerald-700 mt-0.5 line-clamp-1">✓ {p.opcije.join(" → ")}</p>;
  }
  return <p className="text-xs text-emerald-700 mt-0.5">✓ {p.opcije[p.correctIndex] ?? "—"}</p>;
}

interface PitanjeListResp { total: number; page: number; pageSize: number; rows: PitanjeBanka[]; }
interface IlmihalLekcija { id: number; nivo: number; slug: string; naslov: string; }

const KATEGORIJE_LABELS: Record<string, string> = {
  vjerovanje: "Vjerovanje", namaz: "Namaz", ahlak: "Ahlak", historija: "Historija",
  bosna: "Bosna", sure: "Sure", dove: "Dove", halal_haram: "Halal/Haram",
  kuran: "Kur'an", sufara: "Sufara", opce: "Opće",
};

const slugify = (s: string) => s.toLowerCase()
  .replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export default function AdminKvizEditorPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [matchEdit, paramsEdit] = useRoute<{ id: string }>("/admin/kviz/:id");
  const { toast } = useToast();

  const isNew = !matchEdit;
  const kvizId = matchEdit ? parseInt(paramsEdit!.id) : 0;

  const [meta, setMeta] = useState<Partial<Kviz>>({
    naslov: "", slug: "", modul: "ilmihal", nivo: 1, variant: "normal",
    kategorija: "", lekcijaId: null, opis: "", isPublished: true,
  });
  const [pitanja, setPitanja] = useState<KvizPitanjeRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [lekcije, setLekcije] = useState<IlmihalLekcija[]>([]);
  const [allKvizovi, setAllKvizovi] = useState<Kviz[]>([]);

  // Add-from-bank modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Move modal
  const [moveTarget, setMoveTarget] = useState<KvizPitanjeRow | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") { setLocation("/"); return; }
  }, [user, setLocation]);

  useEffect(() => {
    if (!token) return;
    apiRequest<IlmihalLekcija[]>("GET", "/content/ilmihal", undefined, token).then(setLekcije).catch(() => {});
    apiRequest<Kviz[]>("GET", "/content/kvizovi", undefined, token).then(setAllKvizovi).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (isNew || !token) return;
    void loadKviz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kvizId]);

  const loadKviz = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Mali workaround: GET /content/kvizovi/:slug treba slug, mi imamo id.
      // Lakše: učitamo iz allKvizovi nakon što stigne ili iz /admin/kvizovi/:id?
      // Pošto admin ruta ne postoji, koristimo allKvizovi koji upravo dolazi.
      const list = await apiRequest<Kviz[]>("GET", "/content/kvizovi", undefined, token);
      setAllKvizovi(list);
      const found = list.find(k => k.id === kvizId);
      if (found) setMeta(found);
      const pit = await apiRequest<KvizPitanjeRow[]>("GET", `/admin/kvizovi/${kvizId}/pitanja`, undefined, token);
      setPitanja(pit);
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati kviz", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!token) return;
    if (!meta.naslov?.trim() || !meta.slug?.trim()) {
      toast({ title: "Greška", description: "Naslov i slug su obavezni", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        naslov: meta.naslov.trim(),
        slug: meta.slug.trim(),
        modul: meta.modul,
        nivo: meta.nivo,
        variant: meta.variant,
        kategorija: meta.kategorija || null,
        lekcijaId: meta.lekcijaId || null,
        opis: meta.opis || "",
        isPublished: meta.isPublished,
      };
      if (isNew) {
        const created = await apiRequest<Kviz>("POST", "/admin/kvizovi", body, token);
        toast({ title: "Kreiran", description: `Kviz "${created.naslov}" je dodan. Sada dodaj pitanja iz banke.` });
        setLocation(`/admin/kviz/${created.id}`);
      } else {
        await apiRequest("PUT", `/admin/kvizovi/${kvizId}`, body, token);
        toast({ title: "Sačuvano", description: "Podaci kviza ažurirani" });
      }
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Nije moguće sačuvati", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKviz = async () => {
    if (!token || isNew) return;
    if (!confirm(`Obrisati kviz "${meta.naslov}"? Pitanja u banci ostaju, samo veze i kviz nestaju. Postojeći rezultati učenika ostaju.`)) return;
    try {
      await apiRequest("DELETE", `/admin/kvizovi/${kvizId}`, undefined, token);
      toast({ title: "Obrisano", description: "Kviz obrisan" });
      setLocation("/admin");
    } catch {
      toast({ title: "Greška", description: "Nije moguće obrisati", variant: "destructive" });
    }
  };

  const handleRemovePitanje = async (p: KvizPitanjeRow) => {
    if (!token) return;
    if (!confirm(`Ukloniti pitanje iz kviza? Pitanje ostaje u banci.`)) return;
    try {
      await apiRequest("DELETE", `/admin/kvizovi/${kvizId}/pitanja/${p.id}`, undefined, token);
      setPitanja(prev => prev.filter(x => x.id !== p.id));
      toast({ title: "Uklonjeno", description: "Pitanje uklonjeno iz kviza" });
    } catch {
      toast({ title: "Greška", description: "Nije moguće ukloniti", variant: "destructive" });
    }
  };

  const handleMove = async (dir: -1 | 1, idx: number) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= pitanja.length) return;
    const next = [...pitanja];
    [next[idx], next[ni]] = [next[ni]!, next[idx]!];
    setPitanja(next);
    if (!token) return;
    try {
      await apiRequest("PUT", `/admin/kvizovi/${kvizId}/redoslijed`, { pitanjeIds: next.map(p => p.id) }, token);
    } catch {
      toast({ title: "Greška", description: "Redoslijed nije sačuvan", variant: "destructive" });
    }
  };

  const handleAddedFromBank = (added: PitanjeBanka[]) => {
    // optimistic — server je već vratio success; reload da dobijemo redoslijed
    void apiRequest<KvizPitanjeRow[]>("GET", `/admin/kvizovi/${kvizId}/pitanja`, undefined, token!).then(setPitanja);
    toast({ title: "Dodano", description: `${added.length} pitanja dodano u kviz` });
  };

  const handleMovePitanje = async (target: Kviz) => {
    if (!moveTarget || !token) return;
    try {
      await apiRequest("POST", `/admin/kvizovi/${kvizId}/premjesti-pitanje`, {
        pitanjeId: moveTarget.id,
        ciljniKvizId: target.id,
      }, token);
      setPitanja(prev => prev.filter(x => x.id !== moveTarget.id));
      setMoveTarget(null);
      toast({ title: "Premješteno", description: `Pitanje premješteno u "${target.naslov}"` });
    } catch {
      toast({ title: "Greška", description: "Nije moguće premjestiti", variant: "destructive" });
    }
  };

  if (!user || user.role !== "admin") return null;

  if (loading) return (
    <Layout><div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div></Layout>
  );

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => setLocation("/admin")} className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Nazad na admin
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-foreground truncate">{isNew ? "Novi kviz" : meta.naslov || "Kviz"}</h1>
            <p className="text-muted-foreground text-base">{isNew ? "Sačuvaj osnovne podatke pa dodaj pitanja iz banke." : `${pitanja.length} pitanja`}</p>
          </div>
          {!isNew && (
            <button onClick={handleDeleteKviz} className="px-3 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Obriši
            </button>
          )}
        </div>

        {/* META */}
        <div className="bg-white border border-border/60 rounded-2xl p-5 mb-6 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Naslov</label>
              <input
                value={meta.naslov || ""}
                onChange={e => setMeta(p => ({ ...p, naslov: e.target.value, slug: isNew && !p.slug ? slugify(e.target.value) : p.slug }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Slug (URL)</label>
              <input
                value={meta.slug || ""}
                onChange={e => setMeta(p => ({ ...p, slug: slugify(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Modul</label>
              <select value={meta.modul || "ilmihal"} onChange={e => setMeta(p => ({ ...p, modul: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="ilmihal">Ilmihal</option>
                <option value="knjige">Knjige</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Nivo</label>
              <input type="number" min={1} max={4} value={meta.nivo ?? ""} onChange={e => setMeta(p => ({ ...p, nivo: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Varijanta</label>
              <select value={meta.variant || "normal"} onChange={e => setMeta(p => ({ ...p, variant: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="normal">Normal</option>
                <option value="napredni">Napredni</option>
                <option value="zavrsni">Završni</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Status</label>
              <select value={meta.isPublished ? "1" : "0"} onChange={e => setMeta(p => ({ ...p, isPublished: e.target.value === "1" }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="1">Objavljen</option>
                <option value="0">Skriven</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Kategorija</label>
              <select value={meta.kategorija || ""} onChange={e => setMeta(p => ({ ...p, kategorija: e.target.value || null }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">— bez —</option>
                {Object.entries(KATEGORIJE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Lekcija (opciono)</label>
              <select value={meta.lekcijaId ?? ""} onChange={e => setMeta(p => ({ ...p, lekcijaId: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">— nijedna —</option>
                {lekcije.map(l => <option key={l.id} value={l.id}>N{l.nivo} · {l.naslov}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Opis (opciono)</label>
            <textarea value={meta.opis || ""} onChange={e => setMeta(p => ({ ...p, opis: e.target.value }))} rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleSaveMeta} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isNew ? "Kreiraj kviz" : "Sačuvaj podatke"}
            </button>
          </div>
        </div>

        {/* PITANJA — samo nakon što je kviz kreiran */}
        {!isNew && (
          <div className="bg-white border border-border/60 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg flex items-center gap-2"><Database className="w-5 h-5 text-amber-600" /> Pitanja u kvizu ({pitanja.length})</h2>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition">
                <Plus className="w-4 h-4" /> Dodaj iz banke
              </button>
            </div>

            {pitanja.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold">Kviz nema pitanja</p>
                <p className="text-sm">Klikni "Dodaj iz banke" da odabereš pitanja</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pitanja.map((p, i) => (
                  <div key={p.id} className="border border-border/50 rounded-xl px-3 py-2.5 flex items-start gap-2 hover:border-amber-200 transition group">
                    <div className="flex flex-col gap-0.5 pt-1">
                      <button onClick={() => handleMove(-1, i)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => handleMove(1, i)} disabled={i === pitanja.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700 font-bold text-sm shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {p.kategorija && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{KATEGORIJE_LABELS[p.kategorija] || p.kategorija}</span>}
                        {p.vrsta && p.vrsta !== "single" && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{VRSTA_LABELS[p.vrsta] || p.vrsta}</span>
                        )}
                        <span className="text-xs text-muted-foreground">#{p.id}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{p.pitanje}</p>
                      <PitanjeAnswerPreview p={p} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <a
                        href={`/admin/banka-pitanja?edit=${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-amber-50 text-muted-foreground hover:text-amber-700"
                        title="Uredi u banci pitanja (otvara u novom tabu — izmjena utiče na sve kvizove koji koriste ovo pitanje)"
                      >
                        <Pencil className="w-4 h-4" />
                      </a>
                      <button onClick={() => setMoveTarget(p)} className="p-2 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600" title="Premjesti u drugi kviz">
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleRemovePitanje(p)} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500" title="Ukloni iz kviza">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showAddModal && (
          <DodajIzBankeModal
            kvizId={kvizId}
            token={token!}
            postojeciIds={new Set(pitanja.map(p => p.id))}
            onClose={() => setShowAddModal(false)}
            onAdded={(added) => { setShowAddModal(false); handleAddedFromBank(added); }}
          />
        )}

        {moveTarget && (
          <PremjestiModal
            pitanje={moveTarget}
            kvizovi={allKvizovi.filter(k => k.id !== kvizId)}
            onClose={() => setMoveTarget(null)}
            onPick={handleMovePitanje}
          />
        )}
      </div>
    </Layout>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal: Dodaj iz banke (multi-select s pretragom i kategorijom)
// ──────────────────────────────────────────────────────────────────────────────
function DodajIzBankeModal({
  kvizId, token, postojeciIds, onClose, onAdded,
}: {
  kvizId: number;
  token: string;
  postojeciIds: Set<number>;
  onClose: () => void;
  onAdded: (added: PitanjeBanka[]) => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [kategorija, setKategorija] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PitanjeListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebSearch(search), 300); return () => clearTimeout(t); }, [search]);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [debSearch, kategorija, page]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page), pageSize: "30",
        ...(debSearch ? { search: debSearch } : {}),
        ...(kategorija ? { kategorija } : {}),
      }).toString();
      const r = await apiRequest<PitanjeListResp>("GET", `/admin/banka-pitanja?${qs}`, undefined, token);
      setData(r);
    } finally { setLoading(false); }
  };

  const togglePick = (id: number) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async () => {
    if (picked.size === 0) return;
    setAdding(true);
    try {
      await apiRequest("POST", `/admin/kvizovi/${kvizId}/dodaj-pitanja`, { pitanjeIds: [...picked] }, token);
      const addedRows = (data?.rows || []).filter(r => picked.has(r.id));
      onAdded(addedRows);
    } catch {
      toast({ title: "Greška", description: "Nije moguće dodati", variant: "destructive" });
    } finally { setAdding(false); }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-extrabold text-lg">Dodaj pitanja iz banke</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 border-b border-border/40 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Pretraži pitanja..."
              className="w-full pl-10 pr-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <select value={kategorija} onChange={e => { setKategorija(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Sve kategorije</option>
            {Object.entries(KATEGORIJE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
          ) : !data || data.rows.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">Nema rezultata</p>
          ) : (
            <div className="space-y-1">
              {data.rows.map(p => {
                const exists = postojeciIds.has(p.id);
                const isPicked = picked.has(p.id);
                return (
                  <label key={p.id}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${exists ? "bg-muted/40 opacity-60 cursor-not-allowed" : isPicked ? "bg-amber-50 border-amber-300" : "border-border/40 hover:border-amber-200"}`}>
                    <input type="checkbox" disabled={exists} checked={isPicked || exists}
                      onChange={() => togglePick(p.id)} className="mt-1 w-4 h-4 accent-amber-600" />
                    <div className="flex-1 min-w-0">
                      {p.kategorija && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 mr-1">{KATEGORIJE_LABELS[p.kategorija] || p.kategorija}</span>}
                      {p.vrsta && p.vrsta !== "single" && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 mr-1">{VRSTA_LABELS[p.vrsta] || p.vrsta}</span>
                      )}
                      <span className="text-xs text-muted-foreground">#{p.id}</span>
                      {exists && <span className="text-xs text-muted-foreground italic ml-2">(već u kvizu)</span>}
                      <p className="text-sm font-semibold mt-0.5">{p.pitanje}</p>
                      <PitanjeAnswerPreview p={p} />
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 rounded border disabled:opacity-30">‹</button>
            <span>{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2 py-1 rounded border disabled:opacity-30">›</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{picked.size} odabrano</span>
            <button onClick={submit} disabled={picked.size === 0 || adding}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Dodaj odabrana
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal: Premjesti pitanje u drugi kviz
// ──────────────────────────────────────────────────────────────────────────────
function PremjestiModal({
  pitanje, kvizovi, onClose, onPick,
}: {
  pitanje: KvizPitanjeRow;
  kvizovi: Kviz[];
  onClose: () => void;
  onPick: (k: Kviz) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return kvizovi;
    return kvizovi.filter(k => k.naslov.toLowerCase().includes(q) || k.slug.includes(q));
  }, [kvizovi, search]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-extrabold text-lg flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Premjesti pitanje</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-3 bg-muted/30 text-sm border-b border-border/40 line-clamp-2">{pitanje.pitanje}</div>
        <div className="p-3 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži kvizove..."
              className="w-full pl-10 pr-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.map(k => (
            <button key={k.id} onClick={() => onPick(k)}
              className="w-full text-left px-3 py-2 rounded-xl border border-border/40 hover:bg-blue-50 hover:border-blue-200 flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm">{k.naslov}</span>
              <span className="text-xs text-muted-foreground ml-auto">N{k.nivo}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
