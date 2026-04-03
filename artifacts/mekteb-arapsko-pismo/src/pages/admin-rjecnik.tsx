import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { invalidateRjecnikCache } from "@/lib/rjecnik";
import { ArrowLeft, Plus, Search, Pencil, Trash2, BookOpen, Loader2, X, Save, Download } from "lucide-react";

interface RjecnikEntry {
  id: number;
  rijec: string;
  definicija: string;
}

export default function AdminRjecnikPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [entries, setEntries] = useState<RjecnikEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ rijec: "", definicija: "" });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    loadEntries();
  }, [user, token]);

  const loadEntries = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiRequest<RjecnikEntry[]>("GET", "/admin/rjecnik", undefined, token);
      setEntries(data);
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati rječnik", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(e => e.rijec.includes(q) || e.definicija.toLowerCase().includes(q));
  }, [entries, search]);

  const handleSave = async () => {
    if (!form.rijec.trim() || !form.definicija.trim()) {
      toast({ title: "Greška", description: "Riječ i definicija su obavezne", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await apiRequest("PUT", `/admin/rjecnik/${editId}`, form, token!);
        toast({ title: "Ažurirano", description: `Riječ "${form.rijec}" je ažurirana` });
      } else {
        await apiRequest("POST", "/admin/rjecnik", form, token!);
        toast({ title: "Dodano", description: `Riječ "${form.rijec}" je dodana u rječnik` });
      }
      invalidateRjecnikCache();
      setShowAdd(false);
      setEditId(null);
      setForm({ rijec: "", definicija: "" });
      loadEntries();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Nije moguće sačuvati", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: RjecnikEntry) => {
    if (!confirm(`Obrisati riječ "${entry.rijec}"?`)) return;
    try {
      await apiRequest("DELETE", `/admin/rjecnik/${entry.id}`, undefined, token!);
      invalidateRjecnikCache();
      toast({ title: "Obrisano", description: `Riječ "${entry.rijec}" je obrisana` });
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch {
      toast({ title: "Greška", description: "Nije moguće obrisati", variant: "destructive" });
    }
  };

  const handleSeed = async () => {
    if (entries.length > 0 && !confirm("Rječnik već ima podatke. Seed će dodati samo nove riječi koje ne postoje. Nastaviti?")) return;
    setSeeding(true);
    try {
      const result = await apiRequest<{ message: string; count: number }>("POST", "/admin/rjecnik/seed", {}, token!);
      toast({ title: "Uspješno", description: result.message });
      invalidateRjecnikCache();
      loadEntries();
    } catch {
      toast({ title: "Greška", description: "Seed nije uspio", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const startEdit = (entry: RjecnikEntry) => {
    setEditId(entry.id);
    setForm({ rijec: entry.rijec, definicija: entry.definicija });
    setShowAdd(true);
  };

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => setLocation("/admin")} className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold">
          <ArrowLeft className="w-4 h-4" /> Nazad na admin
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Rječnik pojmova</h1>
            <p className="text-muted-foreground text-base">{entries.length} {entries.length === 1 ? "riječ" : entries.length < 5 ? "riječi" : "riječi"} u rječniku</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pretraži rječnik..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          <button
            onClick={() => { setShowAdd(true); setEditId(null); setForm({ rijec: "", definicija: "" }); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition shrink-0"
          >
            <Plus className="w-4 h-4" /> Nova riječ
          </button>
          {entries.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition shrink-0 disabled:opacity-50"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Učitaj početne podatke
            </button>
          )}
        </div>

        {showAdd && (
          <div className="bg-white border-2 border-teal-200 rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-foreground">{editId ? "Uredi riječ" : "Nova riječ"}</h3>
              <button onClick={() => { setShowAdd(false); setEditId(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-base font-semibold text-foreground mb-1">Riječ / termin</label>
                <input
                  value={form.rijec}
                  onChange={e => setForm(prev => ({ ...prev, rijec: e.target.value }))}
                  placeholder="npr. hadž"
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-foreground mb-1">Definicija</label>
                <textarea
                  value={form.definicija}
                  onChange={e => setForm(prev => ({ ...prev, definicija: e.target.value }))}
                  placeholder="Objasni značenje riječi..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editId ? "Sačuvaj izmjene" : "Dodaj u rječnik"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-semibold">
              {search ? "Nema rezultata pretrage" : "Rječnik je prazan"}
            </p>
            <p className="text-base mt-1">
              {search ? "Pokušaj s drugim pojmom" : "Klikni 'Učitaj početne podatke' za dodavanje početnog rječnika"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div key={entry.id} className="bg-white border border-border/50 rounded-xl px-5 py-3.5 flex items-start gap-4 hover:border-teal-200 transition group">
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-teal-700 text-base capitalize">{entry.rijec}</span>
                  <p className="text-base text-muted-foreground mt-0.5 leading-relaxed">{entry.definicija}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(entry)}
                    className="p-2 rounded-lg hover:bg-teal-50 text-muted-foreground hover:text-teal-600 transition"
                    title="Uredi"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
                    title="Obriši"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
