import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest, getApiBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, BookOpen, Loader2, X, Save,
  Image as ImageIcon, Eye, EyeOff, Upload, FolderOpen, ChevronDown,
} from "lucide-react";

const WysiwygEditor = lazy(() =>
  import("@/components/wysiwyg-editor").then((m) => ({ default: m.WysiwygEditor })),
);

interface Knjiga {
  id: number;
  slug: string;
  naslov: string;
  kategorija: string;
  contentHtml: string;
  coverImage: string | null;
  redoslijed: number;
  isPublished: boolean;
  createdAt: string | null;
}

interface Kategorija {
  id: number;
  slug: string;
  naziv: string;
  opis: string | null;
  redoslijed: number;
  defaultOpen: boolean;
  brojPrica: number;
}

type FormState = {
  id: number | null;
  slug: string;
  naslov: string;
  kategorija: string;
  contentHtml: string;
  coverImage: string | null;
  redoslijed: number;
  isPublished: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  slug: "",
  naslov: "",
  kategorija: "prica",
  contentHtml: "",
  coverImage: null,
  redoslijed: 0,
  isPublished: true,
};

type KatFormState = {
  id: number | null;
  slug: string;
  naziv: string;
  opis: string;
  redoslijed: number;
  defaultOpen: boolean;
};

const EMPTY_KAT_FORM: KatFormState = {
  id: null,
  slug: "",
  naziv: "",
  opis: "",
  redoslijed: 100,
  defaultOpen: false,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/š/g, "s").replace(/đ/g, "dj").replace(/č/g, "c")
    .replace(/ć/g, "c").replace(/ž/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function AdminCitaonicaPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [list, setList] = useState<Knjiga[]>([]);
  const [kategorije, setKategorije] = useState<Kategorija[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Kategorije CRUD state
  const [katOpen, setKatOpen] = useState(false);
  const [editingKat, setEditingKat] = useState<KatFormState | null>(null);
  const [savingKat, setSavingKat] = useState(false);
  const [autoKatSlug, setAutoKatSlug] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    void loadAll();
  }, [user, token]);

  const loadAll = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [knj, kats] = await Promise.all([
        apiRequest<Knjiga[]>("GET", "/admin/knjige", undefined, token),
        apiRequest<Kategorija[]>("GET", "/admin/kategorije-knjiga", undefined, token),
      ]);
      setList(knj);
      setKategorije(kats);
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati podatke", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadList = loadAll;

  const startNew = () => {
    const defaultKat = kategorije[0]?.slug ?? "prica";
    setEditing({
      ...EMPTY_FORM,
      kategorija: defaultKat,
      redoslijed: (list[list.length - 1]?.redoslijed ?? 0) + 10,
    });
    setAutoSlug(true);
  };

  const startEdit = async (k: Knjiga) => {
    if (!token) return;
    try {
      const full = await apiRequest<Knjiga>("GET", `/admin/knjige/${k.id}`, undefined, token);
      setEditing({
        id: full.id,
        slug: full.slug,
        naslov: full.naslov,
        kategorija: full.kategorija,
        contentHtml: full.contentHtml,
        coverImage: full.coverImage,
        redoslijed: full.redoslijed,
        isPublished: full.isPublished,
      });
      setAutoSlug(false);
    } catch {
      toast({ title: "Greška", description: "Ne mogu otvoriti priču", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!editing || !token) return;
    if (!editing.naslov.trim()) {
      toast({ title: "Greška", description: "Naslov je obavezan", variant: "destructive" });
      return;
    }
    if (!editing.slug.trim()) {
      toast({ title: "Greška", description: "Slug je obavezan", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        await apiRequest("PUT", `/admin/knjige/${editing.id}`, editing, token);
        toast({ title: "Sačuvano", description: `Priča "${editing.naslov}" je ažurirana` });
      } else {
        await apiRequest("POST", "/admin/knjige", editing, token);
        toast({ title: "Dodano", description: `Priča "${editing.naslov}" je kreirana` });
      }
      setEditing(null);
      void loadList();
    } catch (err: any) {
      toast({
        title: "Greška",
        description: err?.message || "Nije moguće sačuvati",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (k: Knjiga) => {
    if (!token) return;
    if (!confirm(`Obrisati priču "${k.naslov}"? Ova radnja se ne može poništiti.`)) return;
    try {
      await apiRequest("DELETE", `/admin/knjige/${k.id}`, undefined, token);
      toast({ title: "Obrisano", description: `Priča "${k.naslov}" je uklonjena` });
      setList((prev) => prev.filter((x) => x.id !== k.id));
    } catch {
      toast({ title: "Greška", description: "Nije moguće obrisati", variant: "destructive" });
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!editing || !token) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`${getApiBase()}/admin/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload neuspješan");
      }
      const data = await res.json();
      setEditing((prev) => (prev ? { ...prev, coverImage: data.url } : prev));
      toast({ title: "Učitano", description: "Cover slika je dodana" });
    } catch (err: any) {
      toast({
        title: "Greška",
        description: err?.message || "Upload nije uspio",
        variant: "destructive",
      });
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const onNaslovChange = (v: string) => {
    setEditing((prev) =>
      prev ? { ...prev, naslov: v, slug: autoSlug ? slugify(v) : prev.slug } : prev,
    );
  };

  // ── Kategorije CRUD handlers ─────────────────────────────────────────────────
  const startNewKat = () => {
    const maxRed = kategorije.reduce((m, k) => Math.max(m, k.redoslijed), 0);
    setEditingKat({ ...EMPTY_KAT_FORM, redoslijed: maxRed + 10 });
    setAutoKatSlug(true);
  };

  const startEditKat = (k: Kategorija) => {
    setEditingKat({
      id: k.id,
      slug: k.slug,
      naziv: k.naziv,
      opis: k.opis ?? "",
      redoslijed: k.redoslijed,
      defaultOpen: k.defaultOpen,
    });
    setAutoKatSlug(false);
  };

  const handleSaveKat = async () => {
    if (!editingKat || !token) return;
    if (!editingKat.naziv.trim()) {
      toast({ title: "Greška", description: "Naziv kategorije je obavezan", variant: "destructive" });
      return;
    }
    if (!editingKat.slug.trim()) {
      toast({ title: "Greška", description: "Slug je obavezan", variant: "destructive" });
      return;
    }
    setSavingKat(true);
    try {
      const payload = {
        slug: editingKat.slug.trim(),
        naziv: editingKat.naziv.trim(),
        opis: editingKat.opis.trim() || null,
        redoslijed: editingKat.redoslijed,
        defaultOpen: editingKat.defaultOpen,
      };
      if (editingKat.id) {
        await apiRequest("PUT", `/admin/kategorije-knjiga/${editingKat.id}`, payload, token);
        toast({ title: "Sačuvano", description: `Kategorija "${editingKat.naziv}" je ažurirana` });
      } else {
        await apiRequest("POST", "/admin/kategorije-knjiga", payload, token);
        toast({ title: "Dodano", description: `Kategorija "${editingKat.naziv}" je kreirana` });
      }
      setEditingKat(null);
      void loadAll();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Nije moguće sačuvati", variant: "destructive" });
    } finally {
      setSavingKat(false);
    }
  };

  const handleDeleteKat = async (k: Kategorija) => {
    if (!token) return;
    const warn = k.brojPrica > 0
      ? `Kategorija "${k.naziv}" ima ${k.brojPrica} ${k.brojPrica === 1 ? "priču" : "priča"}. Brisanjem će one ostati ali bez kategorije (prikazane pod "Bez kategorije" na čitaonici). Nastaviti?`
      : `Obrisati kategoriju "${k.naziv}"?`;
    if (!confirm(warn)) return;
    try {
      await apiRequest("DELETE", `/admin/kategorije-knjiga/${k.id}`, undefined, token);
      toast({ title: "Obrisano", description: `Kategorija "${k.naziv}" je uklonjena` });
      void loadAll();
    } catch {
      toast({ title: "Greška", description: "Nije moguće obrisati", variant: "destructive" });
    }
  };

  const onKatNazivChange = (v: string) => {
    setEditingKat((prev) =>
      prev ? { ...prev, naziv: v, slug: autoKatSlug ? slugify(v) : prev.slug } : prev,
    );
  };

  // ── Grupisanje priča po kategoriji za prikaz ────────────────────────────────
  // Svaka kategorija je posebna sekcija (uključujući prazne — admin treba da ih
  // vidi). Priče čija kategorija ne postoji u tabeli idu pod "Bez kategorije".
  const grouped = useMemo(() => {
    const knownSlugs = new Set(kategorije.map((k) => k.slug));
    const orphans = list.filter((k) => !knownSlugs.has(k.kategorija));
    return {
      sections: kategorije.map((kat) => ({
        kategorija: kat,
        items: list.filter((k) => k.kategorija === kat.slug),
      })),
      orphans,
    };
  }, [list, kategorije]);

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => setLocation("/admin")}
          className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold"
          data-testid="link-nazad"
        >
          <ArrowLeft className="w-4 h-4" /> Nazad na admin
        </button>

        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Čitaonica — priče</h1>
              <p className="text-muted-foreground text-base">
                {list.length} {list.length === 1 ? "priča" : "priča"} ukupno
              </p>
            </div>
          </div>
          <button
            onClick={startNew}
            data-testid="button-nova-prica"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition shrink-0"
          >
            <Plus className="w-4 h-4" /> Nova priča
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <KategorijeManager
              kategorije={kategorije}
              expanded={katOpen}
              onToggleExpanded={() => setKatOpen((v) => !v)}
              onNew={startNewKat}
              onEdit={startEditKat}
              onDelete={handleDeleteKat}
            />

            {list.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-semibold">Nema priča u Čitaonici</p>
                <p className="text-base mt-1">Klikni "Nova priča" da dodaš prvu</p>
              </div>
            ) : (
              <>
                {grouped.sections.map((s) =>
                  s.items.length > 0 ? (
                    <Section
                      key={s.kategorija.slug}
                      naslov={s.kategorija.naziv}
                      items={s.items}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                    />
                  ) : null,
                )}
                {grouped.orphans.length > 0 && (
                  <Section
                    naslov="Bez kategorije (kategorija obrisana)"
                    items={grouped.orphans}
                    onEdit={startEdit}
                    onDelete={handleDelete}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          form={editing}
          setForm={(updater) =>
            setEditing((prev) => (prev ? (typeof updater === "function" ? updater(prev) : updater) : prev))
          }
          autoSlug={autoSlug}
          setAutoSlug={setAutoSlug}
          saving={saving}
          uploadingCover={uploadingCover}
          coverInputRef={coverInputRef}
          token={token!}
          kategorije={kategorije}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onNaslovChange={onNaslovChange}
          onCoverUpload={handleCoverUpload}
        />
      )}

      {editingKat && (
        <EditKatModal
          form={editingKat}
          setForm={(updater) =>
            setEditingKat((prev) => (prev ? (typeof updater === "function" ? updater(prev) : updater) : prev))
          }
          autoSlug={autoKatSlug}
          setAutoSlug={setAutoKatSlug}
          saving={savingKat}
          onClose={() => setEditingKat(null)}
          onSave={handleSaveKat}
          onNazivChange={onKatNazivChange}
        />
      )}
    </Layout>
  );
}

function KategorijeManager({
  kategorije,
  expanded,
  onToggleExpanded,
  onNew,
  onEdit,
  onDelete,
}: {
  kategorije: Kategorija[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onNew: () => void;
  onEdit: (k: Kategorija) => void;
  onDelete: (k: Kategorija) => void;
}) {
  return (
    <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpanded}
        data-testid="button-toggle-kategorije-manager"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-50/50 transition"
        aria-expanded={expanded}
      >
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <FolderOpen className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground">Kategorije</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {kategorije.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grupe priča za čitaonicu (npr. Priče o vjerovjesnicima, Hadis za djecu, Ahlak).
          </p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-amber-600 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-amber-200 p-4 space-y-3 bg-amber-50/30">
          <div className="flex justify-end">
            <button
              onClick={onNew}
              data-testid="button-nova-kategorija"
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 transition"
            >
              <Plus className="w-4 h-4" /> Nova kategorija
            </button>
          </div>

          {kategorije.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Nema kategorija. Klikni "Nova kategorija" da dodaš prvu.
            </p>
          ) : (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              {kategorije.map((k, i) => (
                <div
                  key={k.id}
                  data-testid={`row-kategorija-${k.id}`}
                  className={`flex items-center gap-3 p-3 ${
                    i < kategorije.length - 1 ? "border-b border-amber-100" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground truncate">{k.naziv}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                        {k.brojPrica} {k.brojPrica === 1 ? "priča" : "priča"}
                      </span>
                      {k.defaultOpen && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          OTVORENA
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span>slug: <code className="font-mono">{k.slug}</code></span>
                      <span>red: {k.redoslijed}</span>
                    </div>
                    {k.opis && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{k.opis}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onEdit(k)}
                      data-testid={`button-edit-kategorija-${k.id}`}
                      className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700 transition"
                      title="Uredi"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(k)}
                      data-testid={`button-delete-kategorija-${k.id}`}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
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
      )}
    </div>
  );
}

function EditKatModal({
  form,
  setForm,
  autoSlug,
  setAutoSlug,
  saving,
  onClose,
  onSave,
  onNazivChange,
}: {
  form: KatFormState;
  setForm: (updater: KatFormState | ((prev: KatFormState) => KatFormState)) => void;
  autoSlug: boolean;
  setAutoSlug: (v: boolean) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onNazivChange: (v: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg my-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-uredi-kategoriju"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h3 className="text-lg font-extrabold text-foreground">
            {form.id ? "Uredi kategoriju" : "Nova kategorija"}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-zatvori-kat-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Naziv *</label>
            <input
              value={form.naziv}
              onChange={(e) => onNazivChange(e.target.value)}
              placeholder="npr. Priče o vjerovjesnicima"
              data-testid="input-kat-naziv"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-semibold text-foreground mb-1">
              <span>Slug *</span>
              <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSlug}
                  onChange={(e) => setAutoSlug(e.target.checked)}
                  data-testid="checkbox-kat-auto-slug"
                />
                automatski iz naziva
              </label>
            </label>
            <input
              value={form.slug}
              onChange={(e) => {
                setAutoSlug(false);
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
              placeholder="npr. prica"
              data-testid="input-kat-slug"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tehnički ključ — koristi se interno za grupisanje priča. Ako mijenjaš slug postojeće
              kategorije, sve njene priče se automatski prebacuju na novi slug.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Kratki opis (opcionalno)
            </label>
            <input
              value={form.opis}
              onChange={(e) => setForm((prev) => ({ ...prev, opis: e.target.value }))}
              placeholder="npr. Životne priče poslanika u hronološkom redu."
              data-testid="input-kat-opis"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Redoslijed</label>
              <input
                type="number"
                value={form.redoslijed}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, redoslijed: parseInt(e.target.value) || 0 }))
                }
                data-testid="input-kat-redoslijed"
                className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-muted-foreground mt-1">manji broj = ranije</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Početno stanje
              </label>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, defaultOpen: !prev.defaultOpen }))}
                data-testid="button-kat-toggle-open"
                className={`w-full px-4 py-2.5 border rounded-xl font-semibold flex items-center justify-center gap-2 transition ${
                  form.defaultOpen
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                    : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {form.defaultOpen ? (
                  <><Eye className="w-4 h-4" /> Otvorena</>
                ) : (
                  <><EyeOff className="w-4 h-4" /> Zatvorena</>
                )}
              </button>
              <p className="text-xs text-muted-foreground mt-1">akordion na čitaonici</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border/50 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            data-testid="button-kat-otkazi"
            className="px-5 py-2.5 rounded-xl font-semibold text-foreground hover:bg-gray-100 transition disabled:opacity-50"
          >
            Otkaži
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            data-testid="button-kat-sacuvaj"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {form.id ? "Sačuvaj izmjene" : "Kreiraj kategoriju"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  naslov,
  items,
  onEdit,
  onDelete,
}: {
  naslov: string;
  items: Knjiga[];
  onEdit: (k: Knjiga) => void;
  onDelete: (k: Knjiga) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2 px-1">
        {naslov}
      </h2>
      <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
        {items.map((k, i) => (
          <div
            key={k.id}
            data-testid={`row-knjiga-${k.id}`}
            className={`flex items-center gap-4 p-3 hover:bg-amber-50/40 transition ${
              i < items.length - 1 ? "border-b border-border/40" : ""
            }`}
          >
            <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 overflow-hidden flex items-center justify-center shrink-0">
              {k.coverImage ? (
                <img src={k.coverImage} alt={k.naslov} className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-6 h-6 text-amber-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground truncate">{k.naslov}</span>
                {!k.isPublished && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                    NEOBJAVLJENO
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                <span>slug: <code className="font-mono">{k.slug}</code></span>
                <span>red: {k.redoslijed}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(k)}
                data-testid={`button-edit-${k.id}`}
                className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700 transition"
                title="Uredi"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(k)}
                data-testid={`button-delete-${k.id}`}
                className="p-2 rounded-lg hover:bg-red-100 text-red-600 transition"
                title="Obriši"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditModal({
  form,
  setForm,
  autoSlug,
  setAutoSlug,
  saving,
  uploadingCover,
  coverInputRef,
  token,
  kategorije,
  onClose,
  onSave,
  onNaslovChange,
  onCoverUpload,
}: {
  form: FormState;
  setForm: (updater: FormState | ((prev: FormState) => FormState)) => void;
  autoSlug: boolean;
  setAutoSlug: (v: boolean) => void;
  saving: boolean;
  uploadingCover: boolean;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  token: string;
  kategorije: Kategorija[];
  onClose: () => void;
  onSave: () => void;
  onNaslovChange: (v: string) => void;
  onCoverUpload: (file: File) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl my-4 shadow-xl flex flex-col max-h-[calc(100vh-2rem)]"
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-uredi-pricu"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50 shrink-0">
          <h3 className="text-lg font-extrabold text-foreground">
            {form.id ? "Uredi priču" : "Nova priča"}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-zatvori-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Naslov *</label>
            <input
              value={form.naslov}
              onChange={(e) => onNaslovChange(e.target.value)}
              placeholder="npr. Priča o Adem a.s."
              data-testid="input-naslov"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="flex items-center justify-between text-sm font-semibold text-foreground mb-1">
              <span>Slug (URL identifikator) *</span>
              <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSlug}
                  onChange={(e) => setAutoSlug(e.target.checked)}
                  data-testid="checkbox-auto-slug"
                />
                automatski iz naslova
              </label>
            </label>
            <input
              value={form.slug}
              onChange={(e) => {
                setAutoSlug(false);
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
              placeholder="npr. adem"
              data-testid="input-slug"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL će biti: <code>/citaonica/{form.slug || "..."}</code>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Kategorija</label>
              <select
                value={form.kategorija}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, kategorija: e.target.value }))
                }
                data-testid="select-kategorija"
                className="w-full px-4 py-2.5 border border-border rounded-xl text-base bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {kategorije.length === 0 && (
                  <option value="">— nema kategorija —</option>
                )}
                {kategorije.map((k) => (
                  <option key={k.id} value={k.slug}>
                    {k.naziv}
                  </option>
                ))}
                {/* Ako trenutna kategorija ne postoji u tabeli (orphan), pokaži je
                    da admin može vidjeti šta je trenutno postavljeno. */}
                {form.kategorija && !kategorije.some((k) => k.slug === form.kategorija) && (
                  <option value={form.kategorija}>
                    {form.kategorija} (kategorija ne postoji)
                  </option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Redoslijed
              </label>
              <input
                type="number"
                value={form.redoslijed}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    redoslijed: parseInt(e.target.value) || 0,
                  }))
                }
                data-testid="input-redoslijed"
                className="w-full px-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-muted-foreground mt-1">manji broj = ranije</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Status</label>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, isPublished: !prev.isPublished }))
                }
                data-testid="button-toggle-published"
                className={`w-full px-4 py-2.5 border rounded-xl font-semibold flex items-center justify-center gap-2 transition ${
                  form.isPublished
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                    : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {form.isPublished ? (
                  <>
                    <Eye className="w-4 h-4" /> Objavljeno
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" /> Skriveno
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Naslovna slika (cover)
            </label>
            <div className="flex items-center gap-3">
              <div className="w-24 h-24 rounded-xl bg-amber-50 border border-amber-200 overflow-hidden flex items-center justify-center shrink-0">
                {form.coverImage ? (
                  <img
                    src={form.coverImage}
                    alt="cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-amber-400" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    data-testid="button-upload-cover"
                    className="flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-sm font-semibold transition disabled:opacity-50"
                  >
                    {uploadingCover ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {form.coverImage ? "Zamijeni" : "Učitaj sliku"}
                  </button>
                  {form.coverImage && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, coverImage: null }))
                      }
                      data-testid="button-remove-cover"
                      className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-semibold transition"
                    >
                      <X className="w-4 h-4" /> Ukloni
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={form.coverImage || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      coverImage: e.target.value || null,
                    }))
                  }
                  placeholder="ili unesi URL/putanju npr. /citaonica/adem.png"
                  data-testid="input-cover-url"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onCoverUpload(f);
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Sadržaj priče
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Koristi alatnu traku iznad za formatiranje, ubacivanje slika, audio
              snimaka i naslova. Slike se uploaduju klikom na ikonu slike.
            </p>
            <Suspense
              fallback={
                <div className="border border-border rounded-xl p-10 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Učitavam editor...
                </div>
              }
            >
              <WysiwygEditor
                content={form.contentHtml}
                onChange={(html) =>
                  setForm((prev) => ({ ...prev, contentHtml: html }))
                }
                token={token}
              />
            </Suspense>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border/50 shrink-0 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            data-testid="button-otkazi"
            className="px-5 py-2.5 rounded-xl font-semibold text-foreground hover:bg-gray-100 transition disabled:opacity-50"
          >
            Otkaži
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            data-testid="button-sacuvaj"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {form.id ? "Sačuvaj izmjene" : "Kreiraj priču"}
          </button>
        </div>
      </div>
    </div>
  );
}
