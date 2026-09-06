import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, ImageIcon, Loader2, Search, Trash2, WandSparkles } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiBase } from "@/lib/api";
import { goBackOr } from "@/lib/back-navigation";

type ImageUsage = {
  type: "lesson" | "question" | "book";
  id: number;
  title: string;
  slug?: string;
  nivo?: number;
};

type UploadImage = {
  name: string;
  url: string;
  size: number;
  modified: string;
  format: string;
  used: boolean;
  usages: ImageUsage[];
};

type LekcijaLite = { id: number; slug: string; naslov: string; nivo: number };

type UploadResponse = {
  files: UploadImage[];
  missing: string[];
  lekcije: LekcijaLite[];
  stats: { diskCount: number; usedCount: number; orphanCount: number; missingCount: number };
};

const NIVO_LABEL: Record<number, string> = {
  1: "N1 — Sufara", 2: "N2 — Ilmihal I", 3: "N3 — Ilmihal II", 4: "N4 — Ilmihal III",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function usageLabel(usage: ImageUsage) {
  if (usage.type === "lesson") return `${NIVO_LABEL[usage.nivo || 0] || `N${usage.nivo}`} · ${usage.title}`;
  if (usage.type === "question") return `Pitanje #${usage.id} · ${usage.title}`;
  return `Čitaonica · ${usage.title}`;
}

export default function AdminOrphanUploadsPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const apiBase = getApiBase().replace(/\/api$/, "");
  const [data, setData] = useState<UploadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "used" | "unused">("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setData(await apiRequest<UploadResponse>("GET", "/admin/orphan-uploads", undefined, token));
    } catch (error: any) {
      toast({ title: t("Greška"), description: error?.message || t("Nije moguće učitati slike"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    void load();
  }, [user, token]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.files.filter(file => {
      if (filter === "used" && !file.used) return false;
      if (filter === "unused" && file.used) return false;
      return !query || file.name.toLowerCase().includes(query)
        || file.usages.some(usage => usage.title.toLowerCase().includes(query));
    });
  }, [data, filter, search]);

  const legacyCount = data?.files.filter(file => file.format !== "webp").length || 0;

  const removeImage = async (file: UploadImage) => {
    if (!token || file.used) return;
    if (!window.confirm(t(`Trajno obrisati sliku "{name}"? Ova radnja se ne može poništiti.`, { name: file.name }))) return;
    try {
      setDeleting(file.name);
      await apiRequest("DELETE", `/admin/uploads/${encodeURIComponent(file.name)}`, undefined, token);
      toast({ title: t("Slika obrisana"), description: file.name });
      await load();
    } catch (error: any) {
      toast({ title: t("Brisanje nije uspjelo"), description: error?.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const convertAll = async () => {
    if (!token || legacyCount === 0) return;
    if (!window.confirm(t(`Pretvoriti {count} slika u WebP? Reference u lekcijama će biti automatski ažurirane.`, { count: String(legacyCount) }))) return;
    try {
      setConverting(true);
      const result = await apiRequest<{
        converted: Array<{ from: string; to: string; bytesBefore: number; bytesAfter: number }>;
        failed: Array<{ name: string; error: string }>;
      }>("POST", "/admin/uploads/convert-webp", undefined, token);
      const saved = result.converted.reduce((sum, item) => sum + item.bytesBefore - item.bytesAfter, 0);
      toast({
        title: t("WebP konverzija završena"),
        description: result.failed.length
          ? t(`Pretvoreno: {done}. Neuspjelo: {failed}.`, { done: String(result.converted.length), failed: String(result.failed.length) })
          : t(`Pretvoreno: {done}. Ušteđeno: {saved}.`, { done: String(result.converted.length), saved: formatSize(Math.max(0, saved)) }),
        variant: result.failed.length ? "destructive" : "default",
      });
      await load();
    } catch (error: any) {
      toast({ title: t("Konverzija nije uspjela"), description: error?.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" onClick={() => goBackOr(() => setLocation("/admin"))}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("Nazad")}
          </Button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{t("Slike u /uploads/")}</h1>
          <Button className="sm:ml-auto" onClick={convertAll} disabled={converting || loading || legacyCount === 0}>
            {converting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <WandSparkles className="w-4 h-4 mr-2" />}
            {legacyCount ? t(`Pretvori u WebP ({count})`, { count: String(legacyCount) }) : t("Sve slike su WebP")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
          {t("Zelena oznaka znači da je slika povezana sa lekcijom, pitanjem ili Čitaonicom. Brisanje je dostupno samo kada slika nema nijednu pronađenu upotrebu.")}
        </p>

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                [t("Ukupno"), data.stats.diskCount],
                [t("Upotrijebljene"), data.stats.usedCount],
                [t("Nisu upotrijebljene"), data.stats.orphanCount],
                [t("Nisu WebP"), legacyCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white border border-border/50 rounded-xl p-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-2xl font-bold">{value}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={event => setSearch(event.target.value)}
                  placeholder={t("Pretraži sliku ili naziv lekcije…")}
                  className="w-full pl-10 pr-3 py-2 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="flex rounded-lg border border-border/50 overflow-hidden">
                {(["all", "used", "unused"] as const).map(value => (
                  <button key={value} onClick={() => setFilter(value)}
                    className={`px-3 py-2 text-sm ${filter === value ? "bg-teal-600 text-white" : "bg-white hover:bg-muted"}`}>
                    {value === "all" ? t("Sve") : value === "used" ? t("Upotrijebljene") : t("Za brisanje")}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-white border border-border/50 rounded-2xl">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                {t("Nema slika za izabrani filter.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(file => (
                  <div key={file.name} className={`bg-white border rounded-xl overflow-hidden flex flex-col ${file.used ? "border-green-300" : "border-border/50"}`}>
                    <div className="aspect-video bg-gray-100 relative overflow-hidden">
                      <img src={`${apiBase}${file.url}`} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${file.used ? "bg-green-600 text-white" : "bg-white text-slate-700"}`}>
                        {file.used && <Check className="w-3.5 h-3.5" />}
                        {file.used ? t("Upotrijebljena") : t("Nije upotrijebljena")}
                      </div>
                      <span className="absolute top-2 right-2 bg-black/65 text-white text-[10px] uppercase px-2 py-1 rounded-full">{file.format}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="text-xs font-medium truncate" title={file.name}>{file.name}</div>
                      <div className="text-[11px] text-muted-foreground">{formatSize(file.size)}</div>
                      {file.used ? (
                        <div className="space-y-1 flex-1">
                          {file.usages.map(usage => (
                            <div key={`${usage.type}-${usage.id}`} className="text-xs bg-green-50 text-green-800 border border-green-100 rounded-md px-2 py-1.5" title={usageLabel(usage)}>
                              {usageLabel(usage)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex-1 text-xs text-muted-foreground">{t("Nema pronađene reference u sadržaju.")}</div>
                      )}
                      <Button variant="destructive" size="sm" disabled={file.used || deleting === file.name}
                        title={file.used ? t("Slika se koristi i ne može biti obrisana") : t("Obriši sliku")}
                        onClick={() => removeImage(file)}>
                        {deleting === file.name ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        {file.used ? t("U upotrebi") : t("Obriši")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> {t("Učitavanje…")}
          </div>
        )}
      </div>
    </Layout>
  );
}