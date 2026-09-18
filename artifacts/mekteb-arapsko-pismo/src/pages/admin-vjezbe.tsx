import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { goBackOr } from "@/lib/back-navigation";
import AdminNaseVjezbe from "./admin-nase-vjezbe";
import { 
  ArrowLeft, Search, Loader2, Save, RotateCcw, 
  Check, FileCode2, Eye, FileEdit, AlertTriangle, 
  Clock, XCircle, Type, Code2, ChevronDown, ChevronUp
} from "lucide-react";

interface VjezbaListItem {
  key: string;
  naslov: string;
  maxScore: number;
  hasOverride: boolean;
  updatedAt: string | null;
}

interface VjezbaDetail extends VjezbaListItem {
  sourceHtml: string;
}

export default function AdminVjezbePage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [list, setList] = useState<VjezbaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listSearch, setListSearch] = useState("");

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<VjezbaDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sourceHtml, setSourceHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [sourceSearch, setSourceSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewKey, setPreviewKey] = useState(0);

  // Kartica "Naše vježbe" (osmosmjerka, popuni prazninu) stoji uz postojeće
  // etapne vježbe: iste su vrste posla, pa ih admin traži na istom mjestu.
  const [kartica, setKartica] = useState<"nase" | "etapne">("nase");

  const [advancedMode, setAdvancedMode] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const isDirty = detail ? sourceHtml !== detail.sourceHtml : false;

  const matchCount = findText ? (sourceHtml.match(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;

  const handleApplyReplace = () => {
    if (matchCount === 0 || findText === replaceText) return;
    if (matchCount > 1 && !window.confirm(t(`Pronađeno je ${matchCount} istih tekstova. Zamijeniti ih sve?`))) {
      return;
    }
    const newHtml = sourceHtml.split(findText).join(replaceText);
    setSourceHtml(newHtml);
    setFindText("");
    setReplaceText("");
    toast({ title: t("Zamijenjeno"), description: t("Tekst je uspješno zamijenjen. Sačuvajte da biste vidjeli pregled.") });
  };


  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    loadList();
  }, [user, token, authLoading]);

  const loadList = async () => {
    if (!token) return;
    try {
      setLoadingList(true);
      const data = await apiRequest<VjezbaListItem[]>("GET", "/admin/static-vjezbe", undefined, token);
      setList(data);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati listu vježbi"), variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  };

  const openDetail = async (key: string) => {
    if (isDirty && !window.confirm(t("Imate nesačuvane izmjene. Jeste li sigurni da želite napustiti?"))) {
      return;
    }
    if (!token) return;
    try {
      setLoadingDetail(true);
      setActiveKey(key);
      const data = await apiRequest<VjezbaDetail>("GET", `/admin/static-vjezbe/${key}`, undefined, token);
      setDetail(data);
      setSourceHtml(data.sourceHtml || "");
      setPreviewKey(prev => prev + 1);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati vježbu"), variant: "destructive" });
      setActiveKey(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleBack = () => {
    if (isDirty && !window.confirm(t("Imate nesačuvane izmjene. Jeste li sigurni da želite napustiti?"))) {
      return;
    }
    setActiveKey(null);
    setDetail(null);
    setSourceHtml("");
    loadList();
  };

  const handleSave = async () => {
    if (!activeKey || !token) return;
    setSaving(true);
    try {
      const data = await apiRequest<VjezbaDetail>("PUT", `/admin/static-vjezbe/${activeKey}`, { sourceHtml }, token);
      setDetail(data);
      setSourceHtml(data.sourceHtml || "");
      setPreviewKey(prev => prev + 1);
      toast({ title: t("Sačuvano"), description: t("Izmjene su uspješno sačuvane.") });
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće sačuvati"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!activeKey || !token) return;
    if (!window.confirm(t("Da li ste sigurni da želite obrisati svoje izmjene? Ovo će vratiti originalnu verziju vježbe iz koda (ugrađenu verziju)."))) {
      return;
    }
    setResetting(true);
    try {
      const data = await apiRequest<VjezbaDetail>("DELETE", `/admin/static-vjezbe/${activeKey}`, undefined, token);
      setDetail(data);
      setSourceHtml(data.sourceHtml || "");
      setPreviewKey(prev => prev + 1);
      toast({ title: t("Vraćeno"), description: t("Vježba je vraćena na originalnu verziju.") });
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Nije moguće vratiti vježbu"), variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const handleSourceSearch = () => {
    if (!textareaRef.current || !sourceSearch) return;
    const text = textareaRef.current.value;
    const index = text.toLowerCase().indexOf(sourceSearch.toLowerCase());
    if (index !== -1) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index + sourceSearch.length);
      // Rough approximation to scroll to the line
      const lines = text.substring(0, index).split('\n');
      const lineHeight = 24; // approximate
      textareaRef.current.scrollTop = Math.max(0, (lines.length - 2) * lineHeight);
    } else {
      toast({ title: t("Nije pronađeno"), description: t("Traženi tekst nije pronađen u kodu."), variant: "destructive" });
    }
  };

  const filteredList = useMemo(() => {
    if (!listSearch.trim()) return list;
    const q = listSearch.toLowerCase();
    return list.filter(item => 
      item.naslov.toLowerCase().includes(q) || 
      item.key.toLowerCase().includes(q)
    );
  }, [list, listSearch]);

  if (authLoading || !user || user.role !== "admin") return null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 h-full flex flex-col min-h-[calc(100vh-4rem)]">
        {!activeKey ? (
          // List View
          <>
            <button onClick={() => goBackOr(() => setLocation("/admin"))} className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold w-fit">
              <ArrowLeft className="w-4 h-4" /> {t("Nazad na admin")}
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">{t("Vježbe")}</h1>
                <p className="text-muted-foreground text-base">{t("Naše vježbe i izvorni kod etapnih vježbi")}</p>
              </div>
            </div>

            <div className="inline-flex bg-muted rounded-xl p-1 mb-6 self-start">
              <button
                onClick={() => setKartica("nase")}
                className={`px-4 py-2.5 min-h-11 rounded-lg font-bold text-sm ${kartica === "nase" ? "bg-white shadow-sm text-teal-700" : "text-muted-foreground"}`}
                data-testid="kartica-nase-vjezbe"
              >
                {t("Naše vježbe")}
              </button>
              <button
                onClick={() => setKartica("etapne")}
                className={`px-4 py-2.5 min-h-11 rounded-lg font-bold text-sm ${kartica === "etapne" ? "bg-white shadow-sm text-emerald-700" : "text-muted-foreground"}`}
                data-testid="kartica-etapne-vjezbe"
              >
                {t("Etapne vježbe (HTML)")}
              </button>
            </div>

            {kartica === "nase" && <AdminNaseVjezbe />}

            {kartica === "etapne" && (
            <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  placeholder={t("Pretraži vježbe po imenu ili ključu...")}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {loadingList ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : filteredList.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-white border border-border/50 rounded-2xl">
                <FileCode2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-semibold">{t("Nema pronađenih vježbi")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredList.map(item => (
                  <button
                    key={item.key}
                    onClick={() => openDetail(item.key)}
                    className="flex flex-col text-left bg-white border border-border/60 hover:border-emerald-300 rounded-2xl p-4 transition shadow-sm group"
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-bold text-lg text-foreground leading-tight group-hover:text-emerald-700 transition-colors">
                        {item.naslov}
                      </h3>
                      {item.hasOverride && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md shrink-0 uppercase tracking-wider">
                          Izmijenjeno
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded inline-block mb-3 w-fit">
                      {item.key}
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground border-t border-border/30 pt-3">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Max {item.maxScore} bod.
                      </span>
                      {item.updatedAt && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3.5 h-3.5" /> 
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            </>
            )}
          </>
        ) : (
          // Detail / Editor View
          <div className="flex flex-col flex-1 h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border/50 shrink-0">
              <div>
                <button onClick={handleBack} className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800 mb-2 font-semibold">
                  <ArrowLeft className="w-4 h-4" /> {t("Nazad na listu")}
                </button>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-foreground">{detail?.naslov}</h1>
                  {isDirty && <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" title={t("Nesačuvane izmjene")} />}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{detail?.key}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {detail?.hasOverride && (
                  <button
                    onClick={handleReset}
                    disabled={resetting || saving}
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-semibold transition disabled:opacity-50 text-sm border border-red-200"
                    title={t("Vrati na originalnu verziju")}
                  >
                    {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    {t("Resetuj na original")}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-semibold transition disabled:opacity-50 text-sm shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("Sačuvaj izmjene")}
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                {/* Editor Column */}
                <div className="flex flex-col gap-4">
                  {/* Simple Mode */}
                  <div className="bg-white border border-border/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="bg-muted/30 border-b border-border/50 px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Type className="w-4 h-4 text-emerald-600" />
                        {t("Ispravi tekst")}
                      </div>
                    </div>
                    
                    {detail?.hasOverride && (
                      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-start gap-2 text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>{t("Pažnja:")}</strong> {t("Uređujete prilagođenu verziju ove vježbe. Resetovanjem ćete zauvijek izgubiti ove izmjene i vratiti se na verziju ugrađenu u sâmu aplikaciju.")}
                        </div>
                      </div>
                    )}
                    
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">{t("Pronađi tekst")}</label>
                        <input
                          value={findText}
                          onChange={e => setFindText(e.target.value)}
                          placeholder={t("Tekst s greškom...")}
                          className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50"
                        />
                        {findText && (
                          <div className={`mt-1.5 text-xs font-medium ${matchCount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {matchCount === 0 
                              ? t("Nije pronađeno u kodu.") 
                              : matchCount === 1 
                                ? t("Pronađeno 1 tačno podudaranje.") 
                                : t(`Pronađeno ${matchCount} tačnih podudaranja.`)}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">{t("Zamijeni sa")}</label>
                        <input
                          value={replaceText}
                          onChange={e => setReplaceText(e.target.value)}
                          placeholder={t("Ispravan tekst...")}
                          className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50"
                        />
                      </div>
                      
                      <button
                        onClick={handleApplyReplace}
                        disabled={matchCount === 0 || findText === replaceText}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        <Check className="w-4 h-4" />
                        {t("Primijeni zamjenu")}
                      </button>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        {t("Nakon primjene zamjene, obavezno sačuvajte izmjene da biste ih vidjeli u pregledu.")}
                      </p>
                    </div>
                  </div>

                  {/* Advanced Mode */}
                  <div className="bg-white border border-border/80 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
                    <button 
                      onClick={() => setAdvancedMode(!advancedMode)}
                      className="bg-muted/30 hover:bg-muted/50 transition-colors border-b border-border/50 px-4 py-2.5 flex items-center justify-between w-full text-left"
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Code2 className="w-4 h-4 text-slate-500" />
                        {t("Napredni HTML")}
                      </div>
                      {advancedMode ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    
                    {advancedMode && (
                      <div className="flex flex-col flex-1 min-h-[350px]">
                        <div className="bg-red-50 px-4 py-2 flex items-start gap-2 text-xs text-red-800 border-b border-red-100">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <strong>{t("Samo za napredne izmjene:")}</strong> {t("Neispravan HTML može uzrokovati da vježba prestane raditi.")}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-slate-50">
                          <span className="text-xs font-semibold text-muted-foreground">{t("Uređivač koda")}</span>
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <input 
                                value={sourceSearch}
                                onChange={e => setSourceSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSourceSearch()}
                                placeholder={t("Pronađi u kodu...")}
                                className="pl-3 pr-8 py-1 text-xs border border-border rounded-md w-32 focus:w-48 transition-all focus:outline-none focus:border-emerald-400 bg-white"
                              />
                              {sourceSearch && (
                                <button 
                                  onClick={() => { setSourceSearch(""); textareaRef.current?.focus(); }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <button 
                              onClick={handleSourceSearch}
                              className="p-1 text-muted-foreground hover:text-emerald-600 bg-white border border-border rounded-md"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <textarea
                          ref={textareaRef}
                          value={sourceHtml}
                          onChange={(e) => setSourceHtml(e.target.value)}
                          className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-inset focus:ring-2 focus:ring-emerald-400/50 bg-slate-50 text-slate-800 leading-relaxed min-h-[300px]"
                          spellCheck="false"
                          style={{ tabSize: 4 }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Column */}
                <div className="flex flex-col bg-white border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-muted/30 border-b border-border/50 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      {t("Pregled uživo")}
                    </div>
                    {isDirty && (
                      <span className="text-xs text-amber-600 font-medium animate-pulse">
                        {t("Sačuvajte za pregled izmjena")}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 bg-muted/10 relative overflow-hidden flex items-center justify-center p-2">
                    {/* We use the preview URL which renders the HTML in an iframe safely */}
                    <div className="w-full h-full border border-border/50 bg-white shadow-inner rounded-xl overflow-hidden">
                      <iframe 
                        key={previewKey}
                        src={`/api/vjezbe/${activeKey}/content`}
                        className="w-full h-full border-none"
                        title="Vježba pregled"
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
