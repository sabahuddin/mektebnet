import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest, getApiBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Loader2, Check, ImageIcon, Trash2 } from "lucide-react";

interface OrphanFile {
  name: string;
  url: string;
  size: number;
  modified: string;
}

interface LekcijaLite {
  id: number;
  slug: string;
  naslov: string;
  nivo: number;
}

interface OrphanResponse {
  orphans: OrphanFile[];
  used: { name: string; url: string }[];
  missing: string[];
  lekcije: LekcijaLite[];
  stats: { diskCount: number; usedCount: number; orphanCount: number; missingCount: number };
}

const NIVO_LABEL: Record<number, string> = {
  1: "N1 — Sufara",
  2: "N2 — Ilmihal I",
  3: "N3 — Ilmihal II",
  4: "N4 — Ilmihal III",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("bs-BA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminOrphanUploadsPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const apiBase = getApiBase();

  const [data, setData] = useState<OrphanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [insertingFor, setInsertingFor] = useState<string | null>(null);
  const [doneFor, setDoneFor] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<"top" | "bottom">("top");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    void load();
  }, [user, token]);

  const load = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const d = await apiRequest<OrphanResponse>("GET", "/admin/orphan-uploads", undefined, token);
      setData(d);
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Nije moguće učitati slike", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredLekcije = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.lekcije].sort((a, b) => a.nivo - b.nivo || a.naslov.localeCompare(b.naslov, "bs"));
    return sorted;
  }, [data]);

  const filteredOrphans = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.orphans;
    const q = search.toLowerCase();
    return data.orphans.filter(o => o.name.toLowerCase().includes(q));
  }, [data, search]);

  const handleInsert = async (file: OrphanFile) => {
    const lekcijaId = selections[file.name];
    if (!lekcijaId) {
      toast({ title: "Izaberi lekciju", description: "Prvo izaberi lekciju iz dropdown-a", variant: "destructive" });
      return;
    }
    if (!token) return;
    try {
      setInsertingFor(file.name);
      const r = await apiRequest<{ ok: boolean; alreadyPresent: boolean; lekcija: { slug: string; naslov?: string } }>(
        "POST",
        `/admin/lekcije/${lekcijaId}/insert-image`,
        { filename: file.name, position },
        token,
      );
      if (r.alreadyPresent) {
        toast({ title: "Već postoji", description: `Slika je već u lekciji "${r.lekcija.slug}"` });
      } else {
        toast({ title: "Dodano", description: `Slika ubačena u "${r.lekcija.naslov || r.lekcija.slug}"` });
      }
      setDoneFor(prev => new Set(prev).add(file.name));
    } catch (e: any) {
      toast({ title: "Greška", description: e?.message || "Nije moguće ubaciti sliku", variant: "destructive" });
    } finally {
      setInsertingFor(null);
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Nazad
          </Button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            Slike koje nisu povezane sa lekcijama
          </h1>
        </div>

        <p className="text-sm text-muted-foreground mb-6 max-w-3xl">
          Ovdje su sve slike koje su uploadovane u <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/uploads/</code> ali se trenutno ne koriste ni u jednoj lekciji.
          Izaberi lekciju iz dropdown-a i klikni <strong>Ubaci u lekciju</strong> — slika će biti dodana na vrh sadržaja.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Učitavanje…
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white border border-border/50 rounded-xl p-4">
                <div className="text-xs text-muted-foreground">Ukupno na disku</div>
                <div className="text-2xl font-bold">{data.stats.diskCount}</div>
              </div>
              <div className="bg-white border border-border/50 rounded-xl p-4">
                <div className="text-xs text-muted-foreground">U upotrebi</div>
                <div className="text-2xl font-bold text-green-700">{data.stats.usedCount}</div>
              </div>
              <div className="bg-white border border-border/50 rounded-xl p-4">
                <div className="text-xs text-muted-foreground">Bez veze (orphan)</div>
                <div className="text-2xl font-bold text-amber-700">{data.stats.orphanCount}</div>
              </div>
              <div className="bg-white border border-border/50 rounded-xl p-4">
                <div className="text-xs text-muted-foreground">Nedostaju na disku</div>
                <div className="text-2xl font-bold text-red-700">{data.stats.missingCount}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-5 items-start sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pretraži po imenu fajla…"
                  className="w-full pl-10 pr-3 py-2 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Pozicija:</span>
                <button
                  onClick={() => setPosition("top")}
                  className={`px-3 py-1.5 rounded-lg border ${position === "top" ? "bg-teal-600 text-white border-teal-600" : "bg-white border-border/50"}`}
                >
                  Vrh
                </button>
                <button
                  onClick={() => setPosition("bottom")}
                  className={`px-3 py-1.5 rounded-lg border ${position === "bottom" ? "bg-teal-600 text-white border-teal-600" : "bg-white border-border/50"}`}
                >
                  Dno
                </button>
              </div>
            </div>

            {filteredOrphans.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-white border border-border/50 rounded-2xl">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                {search ? "Nema rezultata za pretragu." : "Sve slike su povezane sa lekcijama."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredOrphans.map(file => {
                  const isDone = doneFor.has(file.name);
                  const isInserting = insertingFor === file.name;
                  return (
                    <div
                      key={file.name}
                      className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-opacity ${isDone ? "opacity-50 border-green-300" : "border-border/50"}`}
                    >
                      <div className="aspect-video bg-gray-100 relative overflow-hidden">
                        <img
                          src={`${apiBase.replace(/\/api$/, "")}${file.url}`}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {isDone && (
                          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                            <div className="bg-green-600 text-white rounded-full p-2">
                              <Check className="w-6 h-6" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <div className="text-xs text-muted-foreground truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex justify-between">
                          <span>{formatSize(file.size)}</span>
                          <span>{formatDate(file.modified)}</span>
                        </div>
                        <select
                          value={selections[file.name] || ""}
                          onChange={(e) => setSelections(prev => ({ ...prev, [file.name]: parseInt(e.target.value) || 0 }))}
                          disabled={isDone}
                          className="text-sm border border-border/50 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                        >
                          <option value="">— izaberi lekciju —</option>
                          {filteredLekcije.map(l => (
                            <option key={l.id} value={l.id}>
                              [{NIVO_LABEL[l.nivo] || `N${l.nivo}`}] {l.naslov}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => handleInsert(file)}
                          disabled={isDone || isInserting || !selections[file.name]}
                          className="bg-teal-600 hover:bg-teal-700 text-white"
                        >
                          {isInserting ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ubacujem…</>
                          ) : isDone ? (
                            <><Check className="w-4 h-4 mr-2" /> Ubačeno</>
                          ) : (
                            "Ubaci u lekciju"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
