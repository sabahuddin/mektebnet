import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, History, Loader2, RotateCcw, Eye, Search, Lock } from "lucide-react";

interface LekcijaLite {
  id: number;
  slug: string;
  naslov: string;
  nivo: number;
  redoslijed: number;
  locked: boolean;
}

type VersionSource = "current" | "scrape" | "pre_ai" | "diac";

interface Version {
  source: VersionSource;
  label: string;
  contentHtml: string;
  length: number;
  naslov?: string;
  locked?: boolean;
}

interface VersionsResponse {
  slug: string;
  lekcija: { id: number; slug: string; naslov: string; nivo: number; locked: boolean };
  versions: Version[];
}

const NIVO_LABEL: Record<number, string> = {
  1: "N1 — Sufara",
  2: "N2 — Ilmihal I",
  3: "N3 — Ilmihal II",
  4: "N4 — Ilmihal III",
};

const SOURCE_COLOR: Record<VersionSource, string> = {
  current: "bg-emerald-50 border-emerald-300 text-emerald-900",
  scrape: "bg-slate-50 border-slate-300 text-slate-900",
  pre_ai: "bg-amber-50 border-amber-300 text-amber-900",
  diac: "bg-sky-50 border-sky-300 text-sky-900",
};

// Jednostavan paragraph-level diff: razdvoji oba HTML-a po blokovima
// (<p>, <li>, <h*>, <button>, <div>) i označi koji su drugačiji.
function tokenize(html: string): string[] {
  // Splitanje na granicama close tagova najčešćih blok elemenata
  return html
    .replace(/(<\/(p|li|h[1-6]|button|div)>)/gi, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function diffBlocks(a: string, b: string): { same: number; aOnly: number; bOnly: number; lines: Array<{ type: "same" | "del" | "add"; text: string }> } {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  const bSet = new Set(bTokens);
  const aSet = new Set(aTokens);
  let same = 0, aOnly = 0, bOnly = 0;
  const lines: Array<{ type: "same" | "del" | "add"; text: string }> = [];
  for (const t of aTokens) {
    if (bSet.has(t)) {
      same++;
      lines.push({ type: "same", text: t });
    } else {
      aOnly++;
      lines.push({ type: "del", text: t });
    }
  }
  for (const t of bTokens) {
    if (!aSet.has(t)) {
      bOnly++;
      lines.push({ type: "add", text: t });
    }
  }
  return { same, aOnly, bOnly, lines };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export default function AdminLessonVersionsPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [lekcije, setLekcije] = useState<LekcijaLite[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringSource, setRestoringSource] = useState<VersionSource | null>(null);
  const [previewSource, setPreviewSource] = useState<VersionSource | null>(null);
  const [diffLeft, setDiffLeft] = useState<VersionSource>("current");
  const [diffRight, setDiffRight] = useState<VersionSource | null>(null);

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
      const data = await apiRequest<{ lekcije: LekcijaLite[] }>("GET", "/admin/lekcije/list-all", undefined, token);
      setLekcije(data.lekcije || []);
    } catch (e: any) {
      toast({ title: "Greška pri učitavanju lekcija", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (slug: string) => {
    if (!token) return;
    try {
      setLoadingVersions(true);
      setVersions(null);
      setPreviewSource(null);
      setDiffRight(null);
      const data = await apiRequest<VersionsResponse>("GET", `/admin/lekcije/${slug}/versions`, undefined, token);
      setVersions(data);
    } catch (e: any) {
      toast({ title: "Greška pri učitavanju verzija", description: e.message, variant: "destructive" });
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSelectLekcija = (slug: string) => {
    setSelectedSlug(slug);
    void loadVersions(slug);
  };

  const handleRestore = async (source: VersionSource) => {
    if (!versions || !token) return;
    if (source === "current") return;
    const slug = versions.slug;
    const confirmText = window.prompt(
      `Vraćaš lekciju "${versions.lekcija.naslov}" na verziju: ${versions.versions.find(v => v.source === source)?.label}.\n\nOvo će prepisati TRENUTNI sadržaj. Za potvrdu upiši:\n\nVRATI ${slug}`
    );
    if (confirmText !== `VRATI ${slug}`) {
      toast({ title: "Otkazano", description: "Tekst za potvrdu se ne poklapa." });
      return;
    }
    try {
      setRestoringSource(source);
      const res = await apiRequest<{ ok: boolean; sourceLabel: string; lengthAfter: number }>(
        "POST",
        `/admin/lekcije/${slug}/restore-version`,
        { source, confirm: confirmText },
        token
      );
      toast({ title: "Verzija vraćena", description: `${res.sourceLabel} → ${res.lengthAfter} znakova.` });
      await loadVersions(slug);
    } catch (e: any) {
      toast({ title: "Greška pri restore-u", description: e.message, variant: "destructive" });
    } finally {
      setRestoringSource(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lekcije;
    return lekcije.filter(l => l.naslov.toLowerCase().includes(q) || l.slug.toLowerCase().includes(q));
  }, [lekcije, search]);

  const groupedByLevel = useMemo(() => {
    const groups: Record<number, LekcijaLite[]> = {};
    for (const l of filtered) {
      if (!groups[l.nivo]) groups[l.nivo] = [];
      groups[l.nivo].push(l);
    }
    return groups;
  }, [filtered]);

  const previewVersion = useMemo(() => {
    if (!versions || !previewSource) return null;
    return versions.versions.find(v => v.source === previewSource) || null;
  }, [versions, previewSource]);

  const diffData = useMemo(() => {
    if (!versions || !diffRight) return null;
    const left = versions.versions.find(v => v.source === diffLeft);
    const right = versions.versions.find(v => v.source === diffRight);
    if (!left || !right) return null;
    return { left, right, ...diffBlocks(left.contentHtml, right.contentHtml) };
  }, [versions, diffLeft, diffRight]);

  if (!user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Admin
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" /> Historija verzija lekcija
          </h1>
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded-lg p-3 mb-4">
          Ovdje možeš uporediti trenutnu verziju lekcije sa snimcima iz baze. Restore se uvijek
          radi <strong>ručno</strong> i traži potvrdu. Zaključane lekcije se ne mogu vratiti dok ne
          otključaš.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Lijeva strana: lista lekcija */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 max-h-[80vh] overflow-y-auto">
            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Traži lekciju..."
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(nivo => {
                  const items = groupedByLevel[nivo];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={nivo}>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1 px-1">{NIVO_LABEL[nivo] || `Nivo ${nivo}`}</div>
                      <div className="space-y-1">
                        {items.map(l => (
                          <button
                            key={l.id}
                            onClick={() => handleSelectLekcija(l.slug)}
                            className={`w-full text-left px-2 py-1.5 rounded text-sm transition flex items-center gap-1.5 ${
                              selectedSlug === l.slug
                                ? "bg-indigo-100 text-indigo-900 font-semibold"
                                : "hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            {l.locked && <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                            <span className="truncate">{l.naslov}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desna strana: verzije + diff + preview */}
          <div className="space-y-4">
            {!selectedSlug && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                Izaberi lekciju iz liste lijevo.
              </div>
            )}

            {selectedSlug && loadingVersions && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            )}

            {selectedSlug && versions && (
              <>
                {/* Lekcija header */}
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-1">{NIVO_LABEL[versions.lekcija.nivo]} · slug: {versions.lekcija.slug}</div>
                  <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {versions.lekcija.locked && <Lock className="w-4 h-4 text-amber-600" />}
                    {versions.lekcija.naslov}
                  </div>
                </div>

                {/* Verzije kartice */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {versions.versions.map(v => (
                    <div key={v.source} className={`border rounded-xl p-3 ${SOURCE_COLOR[v.source]}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-sm">{v.label}</div>
                        <div className="text-xs opacity-75">{v.length.toLocaleString()} znakova</div>
                      </div>
                      <div className="text-xs opacity-80 mb-3 line-clamp-2 font-mono">
                        {stripTags(v.contentHtml).slice(0, 120)}...
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setPreviewSource(v.source)}
                          className="text-xs px-2 py-1 bg-white/80 hover:bg-white border border-current rounded"
                        >
                          <Eye className="w-3 h-3 inline mr-1" />Pogledaj
                        </button>
                        {v.source !== "current" && (
                          <>
                            <button
                              onClick={() => setDiffRight(v.source)}
                              className="text-xs px-2 py-1 bg-white/80 hover:bg-white border border-current rounded"
                            >
                              Uporedi sa trenutnim
                            </button>
                            <button
                              onClick={() => handleRestore(v.source)}
                              disabled={restoringSource !== null || versions.lekcija.locked}
                              className="text-xs px-2 py-1 bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded inline-flex items-center gap-1"
                            >
                              {restoringSource === v.source ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              Vrati ovu verziju
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Diff prikaz */}
                {diffData && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-sm">
                        Razlike: <span className="text-slate-500">{diffData.left.label}</span> ↔ <span className="text-slate-500">{diffData.right.label}</span>
                      </div>
                      <button onClick={() => setDiffRight(null)} className="text-xs text-slate-500 hover:text-slate-900">× zatvori</button>
                    </div>
                    <div className="text-xs text-slate-600 mb-3 flex gap-3">
                      <span><span className="inline-block w-3 h-3 bg-emerald-200 mr-1 align-middle"></span>Iste sekcije: {diffData.same}</span>
                      <span><span className="inline-block w-3 h-3 bg-rose-200 mr-1 align-middle"></span>Samo lijevo: {diffData.aOnly}</span>
                      <span><span className="inline-block w-3 h-3 bg-sky-200 mr-1 align-middle"></span>Samo desno: {diffData.bOnly}</span>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded font-mono text-xs">
                      {diffData.lines.map((line, i) => (
                        <div
                          key={i}
                          className={`px-2 py-1 border-b border-slate-100 ${
                            line.type === "same"
                              ? "bg-white text-slate-700"
                              : line.type === "del"
                              ? "bg-rose-50 text-rose-900"
                              : "bg-sky-50 text-sky-900"
                          }`}
                        >
                          <span className="text-slate-400 mr-2">
                            {line.type === "same" ? " " : line.type === "del" ? "−" : "+"}
                          </span>
                          {stripTags(line.text).slice(0, 200)}
                          {stripTags(line.text).length > 200 ? "..." : ""}
                        </div>
                      ))}
                      {diffData.lines.length === 0 && (
                        <div className="px-2 py-3 text-slate-500">Verzije su identične.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Preview pune lekcije */}
                {previewVersion && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-sm">Pregled: {previewVersion.label}</div>
                      <button onClick={() => setPreviewSource(null)} className="text-xs text-slate-500 hover:text-slate-900">× zatvori</button>
                    </div>
                    <div
                      className="lesson-preview prose prose-sm max-w-none border border-slate-200 rounded p-4 max-h-[600px] overflow-y-auto"
                      // Sigurno: ovo je sadržaj iz NAŠE baze, isti format koji renderira ilmihal-lekcija.tsx
                      dangerouslySetInnerHTML={{ __html: previewVersion.contentHtml }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
