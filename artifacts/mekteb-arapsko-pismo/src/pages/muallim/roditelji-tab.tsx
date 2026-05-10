import { useState, useEffect, useRef } from "react";
import { apiRequest, getApiBase } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Megaphone, Plus, Trash2, Edit3, Image, X, Loader2, Users,
  Send, ChevronDown, Mail, User, Save, Heart
} from "lucide-react";

interface Obavjestenje {
  id: number;
  naslov: string;
  sadrzaj: string;
  slikaUrl: string | null;
  grupaId: number | null;
  grupaNaziv: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Grupa {
  id: number;
  naziv: string;
}

interface RoditeljEntry {
  roditelj: {
    id: number;
    displayName: string;
    username: string;
    email: string | null;
  };
  djeca: {
    id: number;
    displayName: string;
    grupaId: number | null;
    grupaNaziv: string | null;
  }[];
}

export default function RoditeljiTab({
  grupe,
  filterGrupaId = null,
}: {
  grupe: Grupa[];
  filterGrupaId?: number | null;
}) {
  const { token } = useAuth();
  const { toast } = useToast();

  const [obavjestenja, setObavjestenja] = useState<Obavjestenje[]>([]);
  const [roditelji, setRoditelji] = useState<RoditeljEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"obavjestenja" | "roditelji">("obavjestenja");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [naslov, setNaslov] = useState("");
  const [sadrzaj, setSadrzaj] = useState("");
  const [grupaId, setGrupaId] = useState<number | "">(filterGrupaId ?? "");

  // Kad iz Grupa stranice dođe filterGrupaId, predefinisi novu objavu na tu
  // grupu i prebaci na roditelji listu (jer korisnik je tu radi te grupe).
  useEffect(() => {
    if (filterGrupaId) {
      setGrupaId(filterGrupaId);
    }
  }, [filterGrupaId]);

  const filteredRoditelji = filterGrupaId
    ? roditelji.filter(r => r.djeca.some(d => d.grupaId === filterGrupaId))
    : roditelji;
  const filteredObavjestenja = filterGrupaId
    ? obavjestenja.filter(o => o.grupaId === filterGrupaId || o.grupaId === null)
    : obavjestenja;
  const filterGrupaNaziv = filterGrupaId
    ? grupe.find(g => g.id === filterGrupaId)?.naziv
    : null;
  const [slikaUrl, setSlikaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiRequest<Obavjestenje[]>("GET", "/muallim/obavjestenja", undefined, token),
      apiRequest<RoditeljEntry[]>("GET", "/muallim/roditelji-lista", undefined, token),
    ]).then(([o, r]) => {
      setObavjestenja(o);
      setRoditelji(r);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setNaslov("");
    setSadrzaj("");
    setGrupaId(filterGrupaId ?? "");
    setSlikaUrl("");
  }

  function startEdit(o: Obavjestenje) {
    setEditingId(o.id);
    setNaslov(o.naslov);
    setSadrzaj(o.sadrzaj);
    setGrupaId(o.grupaId || "");
    setSlikaUrl(o.slikaUrl || "");
    setShowForm(true);
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiRequest<{ url: string }>("POST", "/admin/upload", fd, token, true);
      setSlikaUrl(res.url);
      toast({ title: "Slika uploadovana" });
    } catch {
      toast({ title: "Greška pri uploadu slike", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!token || !naslov.trim() || !sadrzaj.trim()) return;
    setSaving(true);
    try {
      const body = {
        naslov: naslov.trim(),
        sadrzaj: sadrzaj.trim(),
        grupaId: grupaId || null,
        slikaUrl: slikaUrl || null,
      };
      if (editingId) {
        const updated = await apiRequest<Obavjestenje>("PUT", `/muallim/obavjestenja/${editingId}`, body, token);
        setObavjestenja(prev => prev.map(o => o.id === editingId ? { ...o, ...updated, grupaNaziv: grupaId ? grupe.find(g => g.id === grupaId)?.naziv || null : null } : o));
        toast({ title: "Obavještenje ažurirano" });
      } else {
        const created = await apiRequest<Obavjestenje>("POST", "/muallim/obavjestenja", body, token);
        const withGrupa = { ...created, grupaNaziv: grupaId ? grupe.find(g => g.id === Number(grupaId))?.naziv || null : null };
        setObavjestenja(prev => [withGrupa, ...prev]);
        toast({ title: "Obavještenje objavljeno" });
      }
      resetForm();
    } catch {
      toast({ title: "Greška", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !confirm("Obrisati ovo obavještenje?")) return;
    try {
      await apiRequest("DELETE", `/muallim/obavjestenja/${id}`, undefined, token);
      setObavjestenja(prev => prev.filter(o => o.id !== id));
      toast({ title: "Obrisano" });
    } catch {
      toast({ title: "Greška", variant: "destructive" });
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {filterGrupaNaziv && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800 font-medium flex items-center gap-2">
          <Heart className="w-4 h-4 shrink-0" />
          <span>
            Prikazani su samo roditelji i obavještenja za grupu <strong>{filterGrupaNaziv}</strong>.
            Nove objave će biti automatski usmjerene na ovu grupu.
          </span>
        </div>
      )}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView("obavjestenja")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${view === "obavjestenja" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}
        >
          <Megaphone className="w-4 h-4" /> Obavještenja ({filteredObavjestenja.length})
        </button>
        <button
          onClick={() => setView("roditelji")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${view === "roditelji" ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}
        >
          <Users className="w-4 h-4" /> Roditelji ({filteredRoditelji.length})
        </button>
      </div>

      {view === "obavjestenja" && (
        <div className="space-y-4">
          {!showForm && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Novo obavještenje
            </Button>
          )}

          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-border/50 rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-primary" />
                    {editingId ? "Uredi obavještenje" : "Novo obavještenje"}
                  </h3>
                  <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">Naslov</label>
                  <input
                    type="text"
                    value={naslov}
                    onChange={e => setNaslov(e.target.value)}
                    placeholder="Npr: Raspored za ramazan"
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">Sadržaj</label>
                  <textarea
                    value={sadrzaj}
                    onChange={e => setSadrzaj(e.target.value)}
                    placeholder="Tekst obavještenja..."
                    rows={5}
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">Za koga?</label>
                  <div className="relative">
                    <select
                      value={grupaId}
                      onChange={e => setGrupaId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none bg-white pr-10"
                    >
                      <option value="">Svi roditelji</option>
                      {grupe.map(g => (
                        <option key={g.id} value={g.id}>{g.naziv}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-muted-foreground block mb-1">Ilustracija (opciono)</label>
                  {slikaUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={slikaUrl.startsWith("/") ? `${getApiBase().replace("/api", "")}${slikaUrl}` : slikaUrl}
                        alt="Priložena slika"
                        className="max-h-40 rounded-xl border border-border/50"
                      />
                      <button
                        onClick={() => setSlikaUrl("")}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="rounded-xl"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Image className="w-4 h-4 mr-1" />}
                        Dodaj sliku
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} disabled={saving || !naslov.trim() || !sadrzaj.trim()} className="rounded-xl">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : editingId ? <Save className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                    {editingId ? "Sačuvaj izmjene" : "Objavi"}
                  </Button>
                  <Button variant="outline" onClick={resetForm} className="rounded-xl">Otkaži</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {filteredObavjestenja.length === 0 && !showForm ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nema obavještenja</p>
              <p className="text-sm mt-1">Kreirajte prvo obavještenje za roditelje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredObavjestenja.map(o => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-border/50 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-extrabold text-foreground text-base">{o.naslov}</h4>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${o.grupaId ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {o.grupaNaziv || "Svi roditelji"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{formatDate(o.createdAt)}</p>
                      <p className="text-foreground whitespace-pre-wrap leading-relaxed">{o.sadrzaj}</p>
                      {o.slikaUrl && (
                        <img
                          src={o.slikaUrl.startsWith("/") ? `${getApiBase().replace("/api", "")}${o.slikaUrl}` : o.slikaUrl}
                          alt="Ilustracija"
                          className="mt-3 max-h-48 rounded-xl border border-border/30"
                        />
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(o)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(o.id)} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "roditelji" && (
        <div className="space-y-3">
          {filteredRoditelji.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nema registrovanih roditelja{filterGrupaNaziv ? ` u grupi "${filterGrupaNaziv}"` : ""}</p>
              <p className="text-sm mt-1">Roditelji se prikazuju nakon što povežu svoj nalog sa djetetom</p>
            </div>
          ) : (
            filteredRoditelji.map(r => (
              <div key={r.roditelj.id} className="bg-white border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{r.roditelj.displayName}</div>
                    <div className="text-sm text-muted-foreground">@{r.roditelj.username}</div>
                  </div>
                  {r.roditelj.email && (
                    <a href={`mailto:${r.roditelj.email}`} className="text-primary hover:underline text-sm flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {r.roditelj.email}
                    </a>
                  )}
                </div>
                <div className="pl-13 space-y-1">
                  {r.djeca.map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Dijete:</span>
                      <span className="font-semibold text-foreground">{d.displayName}</span>
                      {d.grupaNaziv && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{d.grupaNaziv}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}
