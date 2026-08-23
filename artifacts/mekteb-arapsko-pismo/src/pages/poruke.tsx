import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { goBackOr } from "@/lib/back-navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  MessageSquare, Send, Loader2, InboxIcon, Users,
  CheckSquare, Square, Search, X, ChevronLeft, Inbox, SendHorizonal,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PORUKE_READ_EVENT } from "@/hooks/use-unread-poruke";
import { useLanguage } from "@/context/language";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Korisnik {
  id: number; displayName: string; role: string;
  grupaId?: number; grupaNaziv?: string; grupeNazivi?: string[];
}
interface Poruka {
  id: number; posiljateljId: number; primateljId: number;
  naslov: string; sadrzaj: string; procitanoAt: string | null; createdAt: string;
}
interface Razgovor {
  saKorisnikom: Korisnik; zadnjaPoruka: Poruka; neprocitano: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s: string) {
  const d = new Date(s), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("bs-BA", { day: "numeric", month: "short" });
}
function roleLabel(r: string) {
  return ({ muallim: "Muallim", roditelj: "Roditelj", admin: "Admin", ucenik: "Učenik" } as Record<string, string>)[r] || r;
}
function sortAZ(list: Korisnik[]) {
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName, "bs"));
}
function getGrupe(k: Korisnik): string[] {
  return k.grupeNazivi && k.grupeNazivi.length > 0 ? k.grupeNazivi : k.grupaNaziv ? [k.grupaNaziv] : [];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div className={`${cls} shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center font-extrabold text-primary`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function UnreadBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="shrink-0 bg-primary text-primary-foreground text-[9px] rounded-full min-w-[1rem] h-4 flex items-center justify-center font-bold px-1">
      {n}
    </span>
  );
}

const ROLE_ORDER = ["muallim", "admin", "ucenik", "roditelj"];
const ROLE_LABELS: Record<string, string> = { muallim: "Muallimi", admin: "Admini", ucenik: "Učenici", roditelj: "Roditelji" };

// ─── Main component ───────────────────────────────────────────────────────────

export default function PorukePage() {
  const { user, token } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [razgovori, setRazgovori] = useState<Razgovor[]>([]);
  const [kontakti, setKontakti] = useState<Korisnik[]>([]);
  const [aktivan, setAktivan] = useState<Korisnik | null>(null);
  const [poruke, setPoruke] = useState<Poruka[]>([]);
  const [isLoadingLista, setIsLoadingLista] = useState(true);
  const [isLoadingRazgovor, setIsLoadingRazgovor] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [tekst, setTekst] = useState("");

  // Active top tab: "nova" | "primljene" | "poslane" | "bulk"
  const [activeTab, setActiveTab] = useState("primljene");

  // Left panel filters
  const [grupaFilter, setGrupaFilter] = useState<string>("");
  const [leftSearch, setLeftSearch] = useState("");

  // Bulk
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTekst, setBulkTekst] = useState("");
  const [bulkNaslov, setBulkNaslov] = useState("");
  const [bulkFilter, setBulkFilter] = useState("all");

  const endRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const canBulkSend = user && (user.role === "admin" || user.role === "muallim");

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadRazgovori = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Razgovor[]>("GET", "/poruke", undefined, token);
      setRazgovori(data);
    } catch {} finally { setIsLoadingLista(false); }
  };
  const loadKontakti = async () => {
    if (!token) return;
    try { setKontakti(await apiRequest<Korisnik[]>("GET", "/poruke/kontakti", undefined, token)); } catch {}
  };

  useEffect(() => {
    loadRazgovori(); loadKontakti();
    if ("clearAppBadge" in navigator) navigator.clearAppBadge?.().catch(() => {});
  }, [token]);

  // Brza akcija iz spiska učenika može otvoriti direktno razgovor.
  useEffect(() => {
    const rawId = new URLSearchParams(window.location.search).get("primateljId");
    const recipientId = rawId ? Number(rawId) : NaN;
    if (!Number.isInteger(recipientId) || recipientId <= 0 || kontakti.length === 0) return;
    const recipient = kontakti.find(k => k.id === recipientId);
    if (recipient) openRazgovor(recipient);
  }, [location, kontakti]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [poruke]);

  useEffect(() => {
    if (activeTab === "nova") { setLeftSearch(""); setTimeout(() => searchRef.current?.focus(), 80); }
  }, [activeTab]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const razgovorMap = useMemo(() => {
    const m = new Map<number, Razgovor>();
    for (const r of razgovori) m.set(r.saKorisnikom.id, r);
    return m;
  }, [razgovori]);

  const ukupnoNeprocitano = useMemo(() =>
    razgovori.reduce((s, r) => s + r.neprocitano, 0), [razgovori]);

  // Simple top tabs — no per-group tabs
  const tabs = useMemo(() => {
    const list: { key: string; label: string; icon?: React.ReactNode; separator?: boolean }[] = [
      { key: "nova", label: t("Nova poruka"), icon: <MessageSquare className="w-3.5 h-3.5" /> },
      { key: "primljene", label: t("Primljene"), icon: <Inbox className="w-3.5 h-3.5" /> },
      { key: "poslane", label: t("Poslane"), icon: <SendHorizonal className="w-3.5 h-3.5" /> },
    ];
    if (canBulkSend) {
      list.push({ key: "__sep1", label: "", separator: true });
      list.push({ key: "bulk", label: t("Pošalji više"), icon: <Users className="w-3.5 h-3.5" /> });
    }
    return list;
  }, [canBulkSend, t]);

  // Unread counts
  const unreadPrimljene = useMemo(() =>
    razgovori.reduce((s, r) => s + r.neprocitano, 0), [razgovori]);

  // Groups for the dropdown (visible only to muallim/admin)
  const grupeList = useMemo(() =>
    [...new Set(kontakti.flatMap(k => getGrupe(k)))].sort((a, b) => a.localeCompare(b, "bs")),
    [kontakti]
  );

  // Left panel: always shows accordion sections grouped by role
  const leftSections = useMemo(() => {
    type Item = { korisnik: Korisnik; lastMsg?: string; lastTime?: string; unread: number };
    let items: Item[] = [];

    if (activeTab === "primljene") {
      items = razgovori
        .filter(r => r.zadnjaPoruka.posiljateljId !== user?.id)
        .map(r => ({ korisnik: r.saKorisnikom, lastMsg: r.zadnjaPoruka.sadrzaj, lastTime: r.zadnjaPoruka.createdAt, unread: r.neprocitano }));
    } else if (activeTab === "poslane") {
      items = razgovori
        .filter(r => r.zadnjaPoruka.posiljateljId === user?.id)
        .map(r => ({ korisnik: r.saKorisnikom, lastMsg: r.zadnjaPoruka.sadrzaj, lastTime: r.zadnjaPoruka.createdAt, unread: r.neprocitano }));
    } else if (activeTab === "nova") {
      let filtered = kontakti;
      if (grupaFilter) filtered = filtered.filter(k => getGrupe(k).includes(grupaFilter));
      if (leftSearch.trim()) filtered = filtered.filter(k => k.displayName.toLowerCase().includes(leftSearch.toLowerCase()));
      items = sortAZ(filtered).map(k => {
        const r = razgovorMap.get(k.id);
        return { korisnik: k, lastMsg: r?.zadnjaPoruka.sadrzaj, lastTime: r?.zadnjaPoruka.createdAt, unread: r?.neprocitano || 0 };
      });
    }

    // Group by role
    const byRole: Record<string, Item[]> = {};
    for (const item of items) {
      if (!byRole[item.korisnik.role]) byRole[item.korisnik.role] = [];
      byRole[item.korisnik.role].push(item);
    }
    return ROLE_ORDER.filter(r => byRole[r]?.length).map(r => ({
      role: r,
      label: t(ROLE_LABELS[r] || r),
      items: byRole[r],
    }));
  }, [activeTab, razgovori, kontakti, razgovorMap, grupaFilter, leftSearch, user?.id, t]);

  // Bulk
  const grupeNaziviBulk = useMemo(() =>
    [...new Set(kontakti.flatMap(k => getGrupe(k)))].sort(), [kontakti]);
  const filteredKontaktiBulk = useMemo(() => {
    if (bulkFilter === "all") return kontakti;
    if (bulkFilter === "muallim") return kontakti.filter(k => k.role === "muallim");
    if (bulkFilter === "roditelj-svi") return kontakti.filter(k => k.role === "roditelj");
    if (bulkFilter === "ucenik") return kontakti.filter(k => k.role === "ucenik");
    if (bulkFilter === "admin") return kontakti.filter(k => k.role === "admin");
    return kontakti.filter(k => getGrupe(k).includes(bulkFilter));
  }, [kontakti, bulkFilter]);
  const grupiranoPoRoliBulk = useMemo(() => {
    const m: Record<string, Korisnik[]> = {};
    for (const k of filteredKontaktiBulk) { if (!m[k.role]) m[k.role] = []; m[k.role].push(k); }
    return m;
  }, [filteredKontaktiBulk]);
  const sekcijeNazivi: Record<string, string> = { admin: t("Admini"), muallim: t("Muallimi"), roditelj: t("Roditelji"), ucenik: t("Učenici") };
  const roleOrder = ["admin", "muallim", "roditelj", "ucenik"];

  // ── Actions ────────────────────────────────────────────────────────────────

  const openRazgovor = async (korisnik: Korisnik) => {
    setAktivan(korisnik);
    setIsLoadingRazgovor(true);
    try {
      const data = await apiRequest<{ drugiKorisnik: Korisnik; poruke: Poruka[] }>(
        "GET", `/poruke/razgovor/${korisnik.id}`, undefined, token!
      );
      setPoruke(data.poruke);
      setRazgovori(prev => prev.map(r => r.saKorisnikom.id === korisnik.id ? { ...r, neprocitano: 0 } : r));
      window.dispatchEvent(new CustomEvent(PORUKE_READ_EVENT));
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati razgovor"), variant: "destructive" });
    } finally { setIsLoadingRazgovor(false); }
  };

  const sendPoruka = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aktivan || !tekst.trim() || !token) return;
    setIsSending(true);
    try {
      const nova = await apiRequest<Poruka>("POST", "/poruke",
        { primateljId: aktivan.id, naslov: "Poruka", sadrzaj: tekst.trim() }, token);
      setPoruke(prev => [...prev, nova]);
      setTekst(""); loadRazgovori();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće poslati poruku"), variant: "destructive" });
    } finally { setIsSending(false); }
  };

  const sendBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !bulkTekst.trim() || !token) return;
    setIsSending(true);
    try {
      await apiRequest("POST", "/poruke/bulk",
        { primateljIds: selectedIds, naslov: bulkNaslov || "Obavijest", sadrzaj: bulkTekst.trim() }, token);
      toast({ title: t("Poruke poslane!"), description: t("Poslano {n} poruka", { n: String(selectedIds.length) }) });
      setSelectedIds([]); setBulkTekst(""); setBulkNaslov(""); setActiveTab("primljene"); loadRazgovori();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće poslati poruke"), variant: "destructive" });
    } finally { setIsSending(false); }
  };

  const toggleSel = (id: number) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAll = (ids: number[]) => setSelectedIds(p => {
    const all = ids.every(id => p.includes(id));
    return all ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])];
  });

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!user || !["muallim", "roditelj", "admin", "ucenik"].includes(user.role)) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t("Nemaš pristup porukama")}</p>
          <Button className="mt-4" onClick={() => goBackOr(() => setLocation("/"))}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div
        className="flex flex-col w-full min-h-[34rem] h-[calc(100dvh-8rem)]"
        data-testid="poruke-workspace"
      >

        {/* ══ TOP TAB BAR ══════════════════════════════════════════════════ */}
        <div className="bg-white border border-border/50 border-b-0 rounded-t-2xl overflow-x-auto shrink-0 shadow-sm">
          <div className="flex items-center px-2 py-2 gap-1 min-w-max">
            {tabs.map(tab => {
              if (tab.separator) return <div key={tab.key} className="w-px h-5 bg-border/50 mx-1" />;
              const isActive = activeTab === tab.key;
              const unread = tab.key === "primljene" ? unreadPrimljene : 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap
                    ${isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                >
                  <span className="scale-110">{tab.icon}</span>
                  {tab.label}
                  {unread > 0 && (
                    <span className={`text-[9px] rounded-full min-w-[1rem] h-4 flex items-center justify-center font-bold px-1
                      ${isActive ? "bg-white/30 text-white" : "bg-primary text-primary-foreground"}`}>
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ MAIN PANEL ═══════════════════════════════════════════════════ */}
        <div className="flex flex-1 min-h-0 bg-white border border-border/50 rounded-b-2xl overflow-hidden shadow-sm">

          {/* ── LEFT: contact/conversation list ── */}
          {activeTab !== "bulk" && (
            <div className={`border-r border-border/50 flex-col shrink-0 bg-muted/[0.08]
              ${aktivan ? "hidden md:flex md:w-72 lg:w-80" : "flex w-full md:w-72 lg:w-80"}`}>

              {/* Group filter dropdown — only for muallim/admin with groups */}
              {(user.role === "muallim" || user.role === "admin") && grupeList.length > 0 && (
                  <div className="px-3 pt-3 pb-2 border-b border-border/30">
                  <div className="relative">
                    <select
                      value={grupaFilter}
                      onChange={e => { setGrupaFilter(e.target.value); setAktivan(null); }}
                      className="w-full appearance-none border border-border/60 rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white cursor-pointer"
                    >
                      <option value="">{t("Sve grupe")}</option>
                      {grupeList.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Search input — visible on "nova" tab or always */}
              <div className="px-3 py-2 border-b border-border/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder={t("Pretraži...")}
                    value={leftSearch}
                    onChange={e => setLeftSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                  />
                  {leftSearch && (
                    <button onClick={() => setLeftSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Accordion list by role */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingLista ? (
                  <div className="p-2 space-y-1.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
                ) : leftSections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 gap-2">
                    <InboxIcon className="w-7 h-7 text-muted-foreground opacity-20" />
                    <p className="text-[11px] text-muted-foreground">
                      {activeTab === "primljene" ? t("Nema primljenih poruka") :
                       activeTab === "poslane" ? t("Nema poslanih poruka") : t("Nema kontakata")}
                    </p>
                  </div>
                ) : leftSections.map(sec => (
                  <RoleSection
                    key={sec.role}
                    label={sec.label}
                    items={sec.items}
                    aktivan={aktivan}
                    onOpen={openRazgovor}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── RIGHT: conversation / bulk / empty ── */}
          <div className={`flex-col min-w-0
            ${activeTab === "bulk" ? "w-full" : "flex-1"}
            ${!aktivan && activeTab !== "bulk" ? "hidden md:flex" : "flex"}`}>
            <AnimatePresence mode="wait">

              {/* Bulk compose */}
              {activeTab === "bulk" && (
                <motion.div key="bulk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto p-5 md:p-7 max-w-3xl mx-auto w-full">
                  <h3 className="font-extrabold text-foreground mb-1">{t("Pošalji poruku više korisnika")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t("Odaberite primatelje i napišite poruku")}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <select value={bulkFilter} onChange={e => { setBulkFilter(e.target.value); setSelectedIds([]); }}
                      className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="all">{t("Svi kontakti")}</option>
                      {user?.role === "admin" && <option value="muallim">{t("Svi muallimi")}</option>}
                      {user?.role === "muallim" && (<>
                        <option value="admin">{t("Admini")}</option>
                        <option value="muallim">{t("Muallimi")}</option>
                        <option value="ucenik">{t("Svi učenici")}</option>
                        <option value="roditelj-svi">{t("Svi roditelji")}</option>
                        {grupeNaziviBulk.length > 0 && <option disabled>──────</option>}
                        {grupeNaziviBulk.map(g => <option key={g} value={g}>{t("Grupa: {g}", { g })}</option>)}
                      </>)}
                    </select>
                    <Button size="sm" variant="outline" className="rounded-xl text-xs"
                      onClick={() => selectAll(filteredKontaktiBulk.map(k => k.id))}>
                      {filteredKontaktiBulk.every(k => selectedIds.includes(k.id)) ? t("Poništi sve") : t("Odaberi sve")}
                    </Button>
                    {selectedIds.length > 0 && (
                      <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">
                        {t("{n} odabrano", { n: String(selectedIds.length) })}
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto border border-border/50 rounded-xl mb-4">
                    {filteredKontaktiBulk.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-4 text-center">{t("Nema kontakata")}</p>
                    ) : roleOrder.filter(r => grupiranoPoRoliBulk[r]?.length).map(r => {
                      const sek = [...grupiranoPoRoliBulk[r]].sort((a, b) => a.displayName.localeCompare(b.displayName, "bs"));
                      const sviOdab = sek.every(k => selectedIds.includes(k.id));
                      return (
                        <div key={r}>
                          <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 sticky top-0 z-10 border-b border-border/30">
                            <span className="text-xs font-extrabold text-foreground uppercase tracking-wide">
                              {sekcijeNazivi[r]} <span className="font-normal text-muted-foreground">({sek.length})</span>
                            </span>
                            <button type="button" className="text-[11px] text-primary font-bold hover:underline"
                              onClick={() => sviOdab ? setSelectedIds(p => p.filter(id => !sek.find(k => k.id === id))) : selectAll(sek.map(k => k.id))}>
                              {sviOdab ? t("Poništi") : t("Odaberi sve")}
                            </button>
                          </div>
                          {sek.map(k => (
                            <button key={k.id} onClick={() => toggleSel(k.id)}
                              className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/30 text-left transition-colors border-b border-border/20 last:border-0">
                              {selectedIds.includes(k.id) ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                              <span className="font-bold text-sm text-foreground flex-1 min-w-0 truncate">{k.displayName}</span>
                              {getGrupe(k).length > 0 && <span className="text-xs text-primary/60 shrink-0">{getGrupe(k).join(", ")}</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <form onSubmit={sendBulk} className="flex flex-col gap-3">
                    <input type="text" placeholder={t("Naslov (opciono)")} value={bulkNaslov}
                      onChange={e => setBulkNaslov(e.target.value)}
                      className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <textarea rows={5} required placeholder={t("Tekst poruke...")}
                      value={bulkTekst} onChange={e => setBulkTekst(e.target.value)}
                      className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                    <Button type="submit" disabled={isSending || selectedIds.length === 0 || !bulkTekst.trim()}
                      className="rounded-xl flex items-center gap-2 self-end">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {t("Pošalji ({n})", { n: String(selectedIds.length) })}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* Active conversation */}
              {activeTab !== "bulk" && aktivan && (
                <motion.div key={aktivan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col min-h-0">
                  <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3 shrink-0 bg-white">
                    <button onClick={() => setAktivan(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <Avatar name={aktivan.displayName} size="sm" />
                    <div>
                      <div className="font-extrabold text-base text-foreground">{aktivan.displayName}</div>
                      <div className="text-sm text-muted-foreground">{roleLabel(aktivan.role)}</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 md:p-6 flex flex-col gap-3 min-h-0 bg-gradient-to-b from-muted/[0.08] to-white">
                    {isLoadingRazgovor ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                          <Skeleton className="h-14 w-48 rounded-2xl" />
                        </div>
                      ))
                    ) : poruke.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <MessageSquare className="w-7 h-7" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{t("Nema poruka — pošalji prvu!")}</p>
                          </div>
                        </div>
                      </div>
                    ) : poruke.map(p => {
                      const isMoj = p.posiljateljId === user.id;
                      return (
                        <div key={p.id} className={`flex ${isMoj ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-xs lg:max-w-lg px-4 py-2.5 rounded-2xl text-sm shadow-sm
                            ${isMoj ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                            <p className="leading-relaxed whitespace-pre-wrap">{p.sadrzaj}</p>
                            <p className={`text-xs mt-1 ${isMoj ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              {formatTime(p.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>
                  <form onSubmit={sendPoruka} className="p-3 md:p-4 border-t border-border/50 flex gap-3 shrink-0 bg-white shadow-[0_-6px_18px_rgba(0,0,0,0.03)]">
                    <label className="sr-only" htmlFor="poruke-composer">{t("Napiši poruku...")}</label>
                    <input id="poruke-composer" type="text" placeholder={t("Napiši poruku...")} value={tekst}
                      onChange={e => setTekst(e.target.value)} autoComplete="off"
                      className="flex-1 border border-border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <Button type="submit" disabled={isSending || !tekst.trim()} className="rounded-xl px-5 shrink-0">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </motion.div>
              )}

              {/* Empty state */}
              {activeTab !== "bulk" && !aktivan && (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center flex-col gap-4 text-muted-foreground text-center p-6 bg-gradient-to-b from-muted/[0.08] to-white">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">{t("Odaberi razgovor ili napiši novu poruku")}</p>
                  </div>
                  <Button type="button" onClick={() => setActiveTab("nova")} className="rounded-xl gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {t("Nova poruka")}
                  </Button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Collapsible role section for the left panel ──────────────────────────────

function RoleSection({
  label, items, aktivan, onOpen,
}: {
  label: string;
  items: { korisnik: Korisnik; lastMsg?: string; lastTime?: string; unread: number }[];
  aktivan: Korisnik | null;
  onOpen: (k: Korisnik) => void;
}) {
  const [open, setOpen] = useState(true);
  const totalUnread = items.reduce((s, i) => s + i.unread, 0);

  return (
    <div>
      {/* Section header — clickable to collapse */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-1.5 bg-muted/20 border-b border-border/20 sticky top-0 z-10 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <span className="text-[9px] font-extrabold text-muted-foreground/70 uppercase tracking-widest flex items-center gap-1.5">
          {label}
          <span className="opacity-60 font-normal normal-case tracking-normal text-[9px]">({items.length})</span>
          {totalUnread > 0 && (
            <span className="bg-primary text-primary-foreground text-[8px] rounded-full min-w-[14px] h-3.5 flex items-center justify-center font-bold px-1">
              {totalUnread}
            </span>
          )}
        </span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {/* Items */}
      {open && items.map(item => (
        <button
          key={item.korisnik.id}
          onClick={() => onOpen(item.korisnik)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-border/15 hover:bg-muted/30 text-left transition-colors
            ${aktivan?.id === item.korisnik.id ? "bg-muted/50 border-l-2 border-l-primary" : ""}`}
        >
          <Avatar name={item.korisnik.displayName} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 justify-between">
              <span className="text-xs font-bold text-foreground truncate">{item.korisnik.displayName}</span>
              <div className="flex items-center gap-1 shrink-0">
                <UnreadBadge n={item.unread} />
                {item.lastTime && <span className="text-[9px] text-muted-foreground/50">{formatTime(item.lastTime)}</span>}
              </div>
            </div>
            {item.lastMsg && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">{item.lastMsg}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
