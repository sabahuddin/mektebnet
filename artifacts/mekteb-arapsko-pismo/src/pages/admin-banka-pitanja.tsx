import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Search, Pencil, Trash2, Loader2, X, Save,
  Database, AlertTriangle, ChevronLeft, ChevronRight, Filter, BookOpenCheck
} from "lucide-react";

// Banka pitanja — centralni admin UI za sva kviz pitanja.
// Backend rute u admin.ts:
//   GET    /admin/banka-pitanja?search=&kategorija=&page=&pageSize=
//   GET    /admin/banka-pitanja/:id
//   GET    /admin/banka-pitanja/:id/usage
//   POST   /admin/banka-pitanja
//   PUT    /admin/banka-pitanja/:id
//   DELETE /admin/banka-pitanja/:id  (CASCADE briše iz svih kvizova)

interface PitanjeBanka {
  id: number;
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  objasnjenje: string;
  slika: string | null;
  vrsta: string;
  kategorija: string | null;
  lekcijaId: number | null;
  tezina: number;
  createdAt: string;
  updatedAt: string;
}

interface PitanjeListResp {
  total: number;
  page: number;
  pageSize: number;
  rows: PitanjeBanka[];
}

interface IlmihalLekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
}

interface UsageInfo {
  count: number;
  kvizovi: { kvizId: number; slug: string; naslov: string; modul: string }[];
}

const PAGE_SIZE = 50;

const KATEGORIJE_LABELS: Record<string, string> = {
  vjerovanje: "Vjerovanje",
  namaz: "Namaz",
  ahlak: "Ahlak",
  historija: "Historija",
  bosna: "Bosna",
  sure: "Sure",
  dove: "Dove",
  halal_haram: "Halal/Haram",
  kuran: "Kur'an",
  sufara: "Sufara",
  opce: "Opće",
};

function emptyForm() {
  return {
    pitanje: "",
    opcije: ["", "", "", ""],
    correctIndex: 0,
    objasnjenje: "",
    slika: "",
    vrsta: "single",
    kategorija: "",
    lekcijaId: "" as string | number,
    tezina: 1,
  };
}

export default function AdminBankaPitanjaPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [rows, setRows] = useState<PitanjeBanka[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKategorija, setFilterKategorija] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [lekcije, setLekcije] = useState<IlmihalLekcija[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{ pitanje: PitanjeBanka; usage: UsageInfo | null } | null>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") { setLocation("/"); return; }
  }, [user, setLocation]);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!token) return;
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, debouncedSearch, filterKategorija]);

  useEffect(() => {
    if (!token) return;
    apiRequest<IlmihalLekcija[]>("GET", "/content/ilmihal", undefined, token)
      .then(setLekcije)
      .catch(() => {});
  }, [token]);

  const loadList = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filterKategorija ? { kategorija: filterKategorija } : {}),
      }).toString();
      const data = await apiRequest<PitanjeListResp>("GET", `/admin/banka-pitanja?${qs}`, undefined, token);
      setRows(data.rows);
      setTotal(data.total);
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati banku pitanja", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const startNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const startEdit = (p: PitanjeBanka) => {
    setEditId(p.id);
    setForm({
      pitanje: p.pitanje,
      opcije: p.opcije.length >= 2 ? [...p.opcije] : [...p.opcije, "", ""].slice(0, Math.max(4, p.opcije.length)),
      correctIndex: p.correctIndex,
      objasnjenje: p.objasnjenje,
      slika: p.slika || "",
      vrsta: p.vrsta,
      kategorija: p.kategorija || "",
      lekcijaId: p.lekcijaId || "",
      tezina: p.tezina,
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditId(null); };

  const handleOpcijaChange = (i: number, val: string) => {
    setForm(prev => {
      const next = [...prev.opcije];
      next[i] = val;
      return { ...prev, opcije: next };
    });
  };

  const addOpcija = () => setForm(prev => ({ ...prev, opcije: [...prev.opcije, ""] }));
  const removeOpcija = (i: number) => setForm(prev => {
    const next = prev.opcije.filter((_, j) => j !== i);
    let ci = prev.correctIndex;
    if (i === ci) ci = 0;
    else if (i < ci) ci = ci - 1;
    return { ...prev, opcije: next, correctIndex: Math.max(0, Math.min(next.length - 1, ci)) };
  });

  const handleSave = async () => {
    if (!token) return;
    const opcijeClean = form.opcije.map(o => o.trim()).filter(Boolean);
    if (!form.pitanje.trim()) {
      toast({ title: "Greška", description: "Tekst pitanja je obavezan", variant: "destructive" });
      return;
    }
    if (opcijeClean.length < 2) {
      toast({ title: "Greška", description: "Minimum 2 opcije", variant: "destructive" });
      return;
    }
    if (form.correctIndex >= opcijeClean.length) {
      toast({ title: "Greška", description: "Tačan odgovor je izvan raspona", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        pitanje: form.pitanje.trim(),
        opcije: opcijeClean,
        correctIndex: form.correctIndex,
        objasnjenje: form.objasnjenje.trim(),
        slika: form.slika.trim() || null,
        vrsta: form.vrsta,
        kategorija: form.kategorija || null,
        lekcijaId: form.lekcijaId ? Number(form.lekcijaId) : null,
        tezina: form.tezina,
      };
      if (editId) {
        await apiRequest("PUT", `/admin/banka-pitanja/${editId}`, body, token);
        toast({ title: "Sačuvano", description: "Pitanje ažurirano u banci" });
      } else {
        await apiRequest("POST", "/admin/banka-pitanja", body, token);
        toast({ title: "Dodano", description: "Novo pitanje u banci" });
      }
      setShowForm(false);
      setEditId(null);
      void loadList();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Nije moguće sačuvati", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const askDelete = async (p: PitanjeBanka) => {
    if (!token) return;
    try {
      const usage = await apiRequest<UsageInfo>("GET", `/admin/banka-pitanja/${p.id}/usage`, undefined, token);
      setConfirmDelete({ pitanje: p, usage });
    } catch {
      setConfirmDelete({ pitanje: p, usage: null });
    }
  };

  const confirmDeleteNow = async () => {
    if (!confirmDelete || !token) return;
    try {
      await apiRequest("DELETE", `/admin/banka-pitanja/${confirmDelete.pitanje.id}`, undefined, token);
      toast({ title: "Obrisano", description: "Pitanje uklonjeno iz banke i svih kvizova" });
      setConfirmDelete(null);
      void loadList();
    } catch {
      toast({ title: "Greška", description: "Nije moguće obrisati", variant: "destructive" });
    }
  };

  const lekcijeMap = useMemo(() => {
    const m = new Map<number, IlmihalLekcija>();
    lekcije.forEach(l => m.set(l.id, l));
    return m;
  }, [lekcije]);

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <button onClick={() => setLocation("/admin")} className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Nazad na admin
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
            <Database className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Banka pitanja</h1>
            <p className="text-muted-foreground text-base">{total} pitanja u banci · isto pitanje može biti u više kvizova</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Pretraži po tekstu pitanja..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={filterKategorija}
              onChange={e => { setFilterKategorija(e.target.value); setPage(1); }}
              className="pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white min-w-[180px]"
            >
              <option value="">Sve kategorije</option>
              {Object.entries(KATEGORIJE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition shrink-0"
          >
            <Plus className="w-4 h-4" /> Novo pitanje
          </button>
        </div>

        {showForm && (
          <PitanjeForm
            form={form}
            setForm={setForm}
            lekcije={lekcije}
            kategorijeLabels={KATEGORIJE_LABELS}
            editId={editId}
            saving={saving}
            onSave={handleSave}
            onCancel={cancelForm}
            onOpcijaChange={handleOpcijaChange}
            onAddOpcija={addOpcija}
            onRemoveOpcija={removeOpcija}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-semibold">Nema pitanja</p>
            <p className="text-base mt-1">Promijeni filter ili dodaj novo</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map(p => {
                const lek = p.lekcijaId ? lekcijeMap.get(p.lekcijaId) : null;
                return (
                  <div key={p.id} className="bg-white border border-border/50 rounded-xl px-4 py-3 hover:border-amber-200 transition group">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {p.kategorija && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              {KATEGORIJE_LABELS[p.kategorija] || p.kategorija}
                            </span>
                          )}
                          {lek && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 flex items-center gap-1">
                              <BookOpenCheck className="w-3 h-3" /> {lek.naslov}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">#{p.id}</span>
                        </div>
                        <p className="text-base font-semibold text-foreground leading-snug">{p.pitanje}</p>
                        <div className="text-sm text-muted-foreground mt-1">
                          {p.opcije.map((o, i) => (
                            <span key={i} className={i === p.correctIndex ? "text-emerald-700 font-semibold" : ""}>
                              {o}{i < p.opcije.length - 1 ? " · " : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-2 rounded-lg hover:bg-amber-50 text-muted-foreground hover:text-amber-600 transition"
                          title="Uredi"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => askDelete(p)}
                          className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
                          title="Obriši"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-sm font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" /> Prethodna
                </button>
                <span className="text-sm text-muted-foreground">Strana {page} od {totalPages} ({total} pitanja)</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border hover:bg-muted disabled:opacity-40 text-sm font-semibold"
                >
                  Sljedeća <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-extrabold text-lg text-foreground">Obrisati pitanje?</h3>
              </div>
              <p className="text-base text-muted-foreground mb-2 line-clamp-3">{confirmDelete.pitanje.pitanje}</p>
              {confirmDelete.usage && confirmDelete.usage.count > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm">
                  <p className="font-semibold text-amber-800 mb-1">⚠️ Pitanje se koristi u {confirmDelete.usage.count} {confirmDelete.usage.count === 1 ? "kvizu" : "kvizova"}:</p>
                  <ul className="text-amber-700 list-disc list-inside">
                    {confirmDelete.usage.kvizovi.slice(0, 6).map(k => <li key={k.kvizId}>{k.naslov}</li>)}
                    {confirmDelete.usage.kvizovi.length > 6 && <li>… i još {confirmDelete.usage.kvizovi.length - 6}</li>}
                  </ul>
                  <p className="text-amber-800 mt-2 text-xs">Brisanje će ukloniti pitanje iz svih ovih kvizova. Već postojeći rezultati učenika ostaju netaknuti.</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted">Odustani</button>
                <button onClick={confirmDeleteNow} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">Obriši</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

interface FormProps {
  form: ReturnType<typeof emptyForm>;
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyForm>>>;
  lekcije: IlmihalLekcija[];
  kategorijeLabels: Record<string, string>;
  editId: number | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onOpcijaChange: (i: number, val: string) => void;
  onAddOpcija: () => void;
  onRemoveOpcija: (i: number) => void;
}

function PitanjeForm({ form, setForm, lekcije, kategorijeLabels, editId, saving, onSave, onCancel, onOpcijaChange, onAddOpcija, onRemoveOpcija }: FormProps) {
  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-foreground">{editId ? "Uredi pitanje" : "Novo pitanje"}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-base font-semibold text-foreground mb-1">Pitanje</label>
          <textarea
            value={form.pitanje}
            onChange={e => setForm(prev => ({ ...prev, pitanje: e.target.value }))}
            rows={2}
            className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          />
        </div>
        <div>
          <label className="block text-base font-semibold text-foreground mb-1">Opcije (klikni radio za tačan odgovor)</label>
          <div className="space-y-2">
            {form.opcije.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={form.correctIndex === i}
                  onChange={() => setForm(prev => ({ ...prev, correctIndex: i }))}
                  className="w-5 h-5 accent-emerald-600"
                />
                <input
                  value={o}
                  onChange={e => onOpcijaChange(i, e.target.value)}
                  placeholder={`Opcija ${i + 1}`}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {form.opcije.length > 2 && (
                  <button onClick={() => onRemoveOpcija(i)} className="p-2 text-muted-foreground hover:text-red-500" title="Ukloni">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={onAddOpcija} className="mt-2 text-sm text-amber-700 font-semibold hover:underline">+ Dodaj opciju</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Kategorija</label>
            <select
              value={form.kategorija}
              onChange={e => setForm(prev => ({ ...prev, kategorija: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— bez —</option>
              {Object.entries(kategorijeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Lekcija (opciono)</label>
            <select
              value={form.lekcijaId}
              onChange={e => setForm(prev => ({ ...prev, lekcijaId: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— nijedna —</option>
              {lekcije.map(l => <option key={l.id} value={l.id}>N{l.nivo} · {l.naslov}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Težina</label>
            <select
              value={form.tezina}
              onChange={e => setForm(prev => ({ ...prev, tezina: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value={1}>Lako</option>
              <option value={2}>Srednje</option>
              <option value={3}>Teško</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">Slika (URL, opciono)</label>
          <input
            value={form.slika}
            onChange={e => setForm(prev => ({ ...prev, slika: e.target.value }))}
            placeholder="/uploads/slika.png"
            className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1">Objašnjenje (opciono, prikazuje se nakon odgovora)</label>
          <textarea
            value={form.objasnjenje}
            onChange={e => setForm(prev => ({ ...prev, objasnjenje: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted">Odustani</button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editId ? "Sačuvaj" : "Dodaj u banku"}
          </button>
        </div>
      </div>
    </div>
  );
}
