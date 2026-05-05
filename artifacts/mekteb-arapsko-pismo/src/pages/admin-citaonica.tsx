import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest, getApiBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Pencil, Trash2, BookOpen, Loader2, X, Save,
  Image as ImageIcon, Eye, EyeOff, Upload,
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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    void loadList();
  }, [user, token]);

  const loadList = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiRequest<Knjiga[]>("GET", "/admin/knjige", undefined, token);
      setList(data);
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati priče", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setEditing({ ...EMPTY_FORM, redoslijed: (list[list.length - 1]?.redoslijed ?? 0) + 10 });
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

  const grouped = useMemo(() => {
    const price = list.filter((k) => k.kategorija === "prica");
    const ostale = list.filter((k) => k.kategorija !== "prica");
    return { price, ostale };
  }, [list]);

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
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-semibold">Nema priča u Čitaonici</p>
            <p className="text-base mt-1">Klikni "Nova priča" da dodaš prvu</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.price.length > 0 && (
              <Section
                naslov="Priče o vjerovjesnicima"
                items={grouped.price}
                onEdit={startEdit}
                onDelete={handleDelete}
              />
            )}
            {grouped.ostale.length > 0 && (
              <Section
                naslov="Ostale knjige"
                items={grouped.ostale}
                onEdit={startEdit}
                onDelete={handleDelete}
              />
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
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onNaslovChange={onNaslovChange}
          onCoverUpload={handleCoverUpload}
        />
      )}
    </Layout>
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
                <option value="prica">Priča (vjerovjesnik)</option>
                <option value="ostalo">Ostalo</option>
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
