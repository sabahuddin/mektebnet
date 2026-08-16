import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  MessageSquare, Send, Loader2, InboxIcon, Users,
  CheckSquare, Square, Search, X, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PORUKE_READ_EVENT } from "@/hooks/use-unread-poruke";
import { useLanguage } from "@/context/language";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Korisnik {
  id: number;
  displayName: string;
  role: string;
  grupaId?: number;
  grupaNaziv?: string;
  grupeNazivi?: string[];
}

interface Poruka {
  id: number;
  posiljateljId: number;
  primateljId: number;
  naslov: string;
  sadrzaj: string;
  procitanoAt: string | null;
  createdAt: string;
}

interface Razgovor {
  saKorisnikom: Korisnik;
  zadnjaPoruka: Poruka;
  neprocitano: number;
}

// Encode/decode filter:
//   "svi" | "muallimi" | "admini" | "ucenik:GRUPANAZIV" | "roditelj:GRUPANAZIV"
type FilterKey = string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("bs-BA", { day: "numeric", month: "short" });
}

function roleLabel(role: string) {
  return { muallim: "Muallim", roditelj: "Roditelj", admin: "Admin", ucenik: "Učenik" }[role] || role;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const cls = size === "sm"
    ? "w-7 h-7 text-[10px]"
    : "w-9 h-9 text-xs";
  return (
    <div className={`${cls} shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center font-extrabold text-primary`}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

function sortAZ(list: Korisnik[]) {
  return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName, "bs"));
}

/** True if a contact belongs to the given filter */
function contactMatchesFilter(k: Korisnik, filter: FilterKey): boolean {
  if (filter === "svi") return true;
  if (filter === "muallimi") return k.role === "muallim";
  if (filter === "admini") return k.role === "admin";
  const [tip, ...rest] = filter.split(":");
  const grp = rest.join(":");
  const liste = k.grupeNazivi && k.grupeNazivi.length > 0
    ? k.grupeNazivi
    : k.grupaNaziv ? [k.grupaNaziv] : [];
  if (tip === "ucenik") return k.role === "ucenik" && liste.includes(grp);
  if (tip === "roditelj") return k.role === "roditelj" && liste.includes(grp);
  return false;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PorukePage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Data
  const [razgovori, setRazgovori] = useState<Razgovor[]>([]);
  const [kontakti, setKontakti] = useState<Korisnik[]>([]);

  // View state
  const [aktivan, setAktivan] = useState<Korisnik | null>(null);
  const [poruke, setPoruke] = useState<Poruka[]>([]);
  const [showNovi, setShowNovi] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  // Active group filter (left nav)
  const [activeFilter, setActiveFilter] = useState<FilterKey>("svi");

  // Loading / sending
  const [isLoadingLista, setIsLoadingLista] = useState(true);
  const [isLoadingRazgovor, setIsLoadingRazgovor] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Compose
  const [tekst, setTekst] = useState("");
  const [contactSearch, setContactSearch] = useState("");

  // Bulk
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTekst, setBulkTekst] = useState("");
  const [bulkNaslov, setBulkNaslov] = useState("");
  const [bulkFilter, setBulkFilter] = useState<string>("all");

  const endRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const canBulkSend = user && (user.role === "admin" || user.role === "muallim");

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadRazgovori = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Razgovor[]>("GET", "/poruke", undefined, token);
      setRazgovori(data);
    } catch {} finally {
      setIsLoadingLista(false);
    }
  };

  const loadKontakti = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Korisnik[]>("GET", "/poruke/kontakti", undefined, token);
      setKontakti(data);
    } catch {}
  };

  useEffect(() => {
    loadRazgovori();
    loadKontakti();
    if ("clearAppBadge" in navigator) navigator.clearAppBadge?.().catch(() => {});
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [poruke]);

  useEffect(() => {
    if (showNovi) {
      setContactSearch("");
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [showNovi]);

  // ── Build filter navigation ────────────────────────────────────────────────
  // Derived from the actual kontakti list.

  const filterNav = useMemo(() => {
    const hasMuallimi = kontakti.some(k => k.role === "muallim");
    const hasAdmini = kontakti.some(k => k.role === "admin");

    // All distinct group names across all contacts
    const allGrupeSet = new Set<string>();
    for (const k of kontakti) {
      const grupe = k.grupeNazivi && k.grupeNazivi.length > 0
        ? k.grupeNazivi : k.grupaNaziv ? [k.grupaNaziv] : [];
      for (const g of grupe) allGrupeSet.add(g);
    }
    const allGrupe = [...allGrupeSet].sort((a, b) => a.localeCompare(b, "bs"));

    // Build flat list of filter items
    type NavItem = { key: FilterKey; label: string; indent?: boolean };
    const items: NavItem[] = [{ key: "svi", label: t("Svi razgovori") }];
    if (hasMuallimi) items.push({ key: "muallimi", label: t("Muallimi") });
    if (hasAdmini) items.push({ key: "admini", label: t("Admini") });

    for (const g of allGrupe) {
      const hasUcenici = kontakti.some(k => k.role === "ucenik" && contactMatchesFilter(k, `ucenik:${g}`));
      const hasRoditelji = kontakti.some(k => k.role === "roditelj" && contactMatchesFilter(k, `roditelj:${g}`));
      items.push({ key: `__header:${g}`, label: g, indent: false }); // group header (non-clickable visual separator)
      if (hasUcenici) items.push({ key: `ucenik:${g}`, label: t("Učenici"), indent: true });
      if (hasRoditelji) items.push({ key: `roditelj:${g}`, label: t("Roditelji"), indent: true });
    }

    return items;
  }, [kontakti, t]);

  // ── User→kontakt map (for cross-referencing razgovori) ────────────────────

  const kontaktMap = useMemo(() => {
    const m = new Map<number, Korisnik>();
    for (const k of kontakti) m.set(k.id, k);
    return m;
  }, [kontakti]);

  // ── Filtered conversations ─────────────────────────────────────────────────

  const filteredRazgovori = useMemo(() => {
    if (activeFilter === "svi") return razgovori;
    return razgovori.filter(r => {
      // Use richer info from kontaktMap if available
      const k = kontaktMap.get(r.saKorisnikom.id) || r.saKorisnikom;
      return contactMatchesFilter(k, activeFilter);
    });
  }, [razgovori, activeFilter, kontaktMap]);

  // ── Contacts for "Nova poruka" (filtered + search + A-Ž) ─────────────────

  const novaPorukaKontakti = useMemo(() => {
    let list = activeFilter === "svi" ? kontakti
      : kontakti.filter(k => contactMatchesFilter(k, activeFilter));
    if (contactSearch.trim())
      list = list.filter(k => k.displayName.toLowerCase().includes(contactSearch.toLowerCase()));
    return sortAZ(list);
  }, [kontakti, activeFilter, contactSearch]);

  // ── Unread counts per filter ───────────────────────────────────────────────

  const unreadPerFilter = useMemo(() => {
    const m: Record<FilterKey, number> = {};
    for (const r of razgovori) {
      if (r.neprocitano === 0) continue;
      const k = kontaktMap.get(r.saKorisnikom.id) || r.saKorisnikom;
      for (const item of filterNav) {
        if (item.key.startsWith("__header:")) continue;
        if (contactMatchesFilter(k, item.key)) {
          m[item.key] = (m[item.key] || 0) + r.neprocitano;
        }
      }
    }
    return m;
  }, [razgovori, filterNav, kontaktMap]);

  // ── Bulk helpers ───────────────────────────────────────────────────────────

  const grupeNaziviBulk = useMemo(() =>
    [...new Set(kontakti.flatMap(k => k.grupeNazivi || (k.grupaNaziv ? [k.grupaNaziv] : [])))].sort(),
    [kontakti]);

  const filteredKontaktiBulk = useMemo(() => {
    if (bulkFilter === "all") return kontakti;
    if (bulkFilter === "muallim") return kontakti.filter(k => k.role === "muallim");
    if (bulkFilter === "roditelj-svi") return kontakti.filter(k => k.role === "roditelj");
    if (bulkFilter === "ucenik") return kontakti.filter(k => k.role === "ucenik");
    if (bulkFilter === "admin") return kontakti.filter(k => k.role === "admin");
    const lista = (k: Korisnik) => k.grupeNazivi && k.grupeNazivi.length > 0 ? k.grupeNazivi : (k.grupaNaziv ? [k.grupaNaziv] : []);
    return kontakti.filter(k => lista(k).includes(bulkFilter));
  }, [kontakti, bulkFilter]);

  const grupiranoPoRoliBulk = useMemo(() => {
    const m: Record<string, Korisnik[]> = {};
    for (const k of filteredKontaktiBulk) {
      if (!m[k.role]) m[k.role] = [];
      m[k.role].push(k);
    }
    return m;
  }, [filteredKontaktiBulk]);

  const roleOrder = ["admin", "muallim", "roditelj", "ucenik"];
  const sekcijeNazivi: Record<string, string> = {
    admin: t("Admini"), muallim: t("Muallimi"), roditelj: t("Roditelji"), ucenik: t("Učenici"),
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const openRazgovor = async (korisnik: Korisnik) => {
    setAktivan(korisnik);
    setIsLoadingRazgovor(true);
    setShowNovi(false);
    setShowBulk(false);
    setContactSearch("");
    try {
      const data = await apiRequest<{ drugiKorisnik: Korisnik; poruke: Poruka[] }>(
        "GET", `/poruke/razgovor/${korisnik.id}`, undefined, token!
      );
      setPoruke(data.poruke);
      setRazgovori(prev => prev.map(r =>
        r.saKorisnikom.id === korisnik.id ? { ...r, neprocitano: 0 } : r
      ));
      window.dispatchEvent(new CustomEvent(PORUKE_READ_EVENT));
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati razgovor"), variant: "destructive" });
    } finally {
      setIsLoadingRazgovor(false);
    }
  };

  const sendPoruka = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aktivan || !tekst.trim() || !token) return;
    setIsSending(true);
    try {
      const nova = await apiRequest<Poruka>("POST", "/poruke", {
        primateljId: aktivan.id, naslov: "Poruka", sadrzaj: tekst.trim(),
      }, token);
      setPoruke(prev => [...prev, nova]);
      setTekst("");
      loadRazgovori();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće poslati poruku"), variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const sendBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !bulkTekst.trim() || !token) return;
    setIsSending(true);
    try {
      await apiRequest("POST", "/poruke/bulk", {
        primateljIds: selectedIds, naslov: bulkNaslov || "Obavijest", sadrzaj: bulkTekst.trim(),
      }, token);
      toast({ title: t("Poruke poslane!"), description: t("Poslano {n} poruka", { n: String(selectedIds.length) }) });
      setSelectedIds([]); setBulkTekst(""); setBulkNaslov(""); setShowBulk(false);
      loadRazgovori();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće poslati poruke"), variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const toggleSelection = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = (ids: number[]) =>
    setSelectedIds(prev => {
      const allSel = ids.every(id => prev.includes(id));
      return allSel ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!user || !["muallim", "roditelj", "admin", "ucenik"].includes(user.role)) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">{t("Nemaš pristup porukama")}</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  const ukupnoNeprocitano = razgovori.reduce((s, r) => s + r.neprocitano, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Page title */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-md shrink-0">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground leading-tight">
            {t("Poruke")}
            {ukupnoNeprocitano > 0 && (
              <span className="ml-2 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 align-middle">{ukupnoNeprocitano}</span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">{t("Komunikacija s roditeljima, muallimom i administratorom")}</p>
        </div>
      </div>

      {/* Main panel */}
      <div className="bg-white border border-border/50 rounded-2xl overflow-hidden flex w-full"
        style={{ height: "calc(100vh - 10.5rem)" }}>

        {/* ═══════════════════════════════════════════════════════════════
            LIJEVA KOLONA — navigacija (grupe) + filtrirani razgovori
        ════════════════════════════════════════════════════════════════ */}
        <div className="w-56 sm:w-64 border-r border-border/50 flex flex-col shrink-0">

          {/* Action buttons */}
          <div className="p-2 border-b border-border/30 flex flex-col gap-1">
            <button
              onClick={() => { setShowNovi(true); setShowBulk(false); setAktivan(null); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors
                ${showNovi ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" /> {t("Nova poruka")}
            </button>
            {canBulkSend && (
              <button
                onClick={() => { setShowBulk(true); setShowNovi(false); setAktivan(null); setSelectedIds([]); setBulkFilter("all"); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors
                  ${showBulk ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
                <Users className="w-3.5 h-3.5 shrink-0" /> {t("Pošalji više")}
              </button>
            )}
          </div>

          {/* ── Scrollable nav + conversations ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Filter navigation */}
            {filterNav.length > 1 && (
              <div className="py-1 border-b border-border/30">
                {filterNav.map(item => {
                  if (item.key.startsWith("__header:")) {
                    // Group header — non-clickable separator
                    return (
                      <div key={item.key} className="px-3 pt-2.5 pb-0.5">
                        <span className="text-[9px] font-extrabold text-muted-foreground/60 uppercase tracking-widest">
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  const unread = unreadPerFilter[item.key] || 0;
                  const isActive = activeFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveFilter(item.key)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors rounded-none
                        ${item.indent ? "pl-5" : ""}
                        ${isActive
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}
                    >
                      <span className="text-xs truncate">{item.label}</span>
                      {unread > 0 && (
                        <span className="ml-1 shrink-0 bg-primary text-primary-foreground text-[10px] rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center font-bold px-1">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Filtered conversations list */}
            <div>
              {isLoadingLista ? (
                <div className="p-2 flex flex-col gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : filteredRazgovori.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-3">
                  <InboxIcon className="w-7 h-7 text-muted-foreground opacity-20" />
                  <p className="text-[11px] text-muted-foreground">{t("Nema poruka")}</p>
                </div>
              ) : (
                filteredRazgovori.map(r => (
                  <button key={r.saKorisnikom.id} onClick={() => openRazgovor(r.saKorisnikom)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/20 hover:bg-muted/30 transition-colors
                      ${aktivan?.id === r.saKorisnikom.id ? "bg-muted/50 border-l-2 border-l-primary" : ""}`}>
                    <div className="flex items-start gap-2">
                      <Avatar name={r.saKorisnikom.displayName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[11px] text-foreground truncate">{r.saKorisnikom.displayName}</span>
                          {r.neprocitano > 0 && (
                            <span className="shrink-0 bg-primary text-primary-foreground text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{r.neprocitano}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{r.zadnjaPoruka.sadrzaj}</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">{formatTime(r.zadnjaPoruka.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            DESNA KOLONA — razgovor / nova poruka / bulk
        ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0">
          <AnimatePresence mode="wait">

            {/* ── Nova poruka ── */}
            {showNovi && (
              <motion.div key="novi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-border/50 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-extrabold text-sm text-foreground">{t("Nova poruka")}</h3>
                    {activeFilter !== "svi" && (
                      <span className="text-[10px] bg-primary/10 text-primary font-bold rounded-full px-2 py-0.5">
                        {filterNav.find(f => f.key === activeFilter)?.label}
                      </span>
                    )}
                  </div>
                  {/* Live search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder={t("Pretraži ime ili prezime...")}
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {contactSearch && (
                      <button onClick={() => setContactSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact list — A-Ž sorted, filtered */}
                <div className="flex-1 overflow-y-auto">
                  {novaPorukaKontakti.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-6 text-center">
                      {contactSearch ? t('Nema rezultata za "{q}"', { q: contactSearch }) : t("Nema dostupnih kontakata")}
                    </p>
                  ) : (() => {
                    // Group by role for visual separation
                    const grouped: Record<string, Korisnik[]> = {};
                    for (const k of novaPorukaKontakti) {
                      if (!grouped[k.role]) grouped[k.role] = [];
                      grouped[k.role].push(k);
                    }
                    return roleOrder.filter(r => grouped[r]?.length).map(role => (
                      <div key={role}>
                        <div className="px-4 py-1.5 bg-muted/30 border-b border-border/20 sticky top-0 z-10">
                          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">
                            {sekcijeNazivi[role] || role} <span className="font-normal opacity-60">({grouped[role].length})</span>
                          </span>
                        </div>
                        {grouped[role].map(k => (
                          <button key={k.id} onClick={() => openRazgovor(k)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 border-b border-border/20 text-left transition-colors">
                            <Avatar name={k.displayName} />
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-foreground">{k.displayName}</div>
                              <div className="text-xs text-muted-foreground">
                                {roleLabel(k.role)}
                                {k.grupaNaziv ? ` · ${k.grupaNaziv}` : ""}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>
            )}

            {/* ── Bulk slanje ── */}
            {showBulk && (
              <motion.div key="bulk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto p-5">
                <h3 className="font-extrabold text-foreground mb-1">{t("Pošalji poruku više korisnika")}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t("Odaberite primatelje i napišite poruku")}</p>

                <div className="flex flex-wrap gap-2 mb-3">
                  <select value={bulkFilter} onChange={e => { setBulkFilter(e.target.value); setSelectedIds([]); }}
                    className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="all">{t("Svi kontakti")}</option>
                    {user?.role === "admin" && <option value="muallim">{t("Svi muallimi")}</option>}
                    {user?.role === "muallim" && (
                      <>
                        <option value="admin">{t("Admini")}</option>
                        <option value="muallim">{t("Muallimi")}</option>
                        <option value="ucenik">{t("Svi učenici")}</option>
                        <option value="roditelj-svi">{t("Svi roditelji")}</option>
                        {grupeNaziviBulk.length > 0 && <option disabled>──────</option>}
                        {grupeNaziviBulk.map(g => <option key={g} value={g}>{t("Grupa: {g}", { g })}</option>)}
                      </>
                    )}
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

                <div className="max-h-60 overflow-y-auto border border-border/50 rounded-xl mb-4">
                  {filteredKontaktiBulk.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">{t("Nema kontakata u ovom filteru")}</p>
                  ) : roleOrder.filter(r => grupiranoPoRoliBulk[r]?.length).map(r => {
                    const sekcija = grupiranoPoRoliBulk[r];
                    const sviOdabrani = sekcija.every(k => selectedIds.includes(k.id));
                    return (
                      <div key={r}>
                        <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 sticky top-0 z-10 border-b border-border/30">
                          <span className="text-xs font-extrabold text-foreground uppercase tracking-wide">
                            {sekcijeNazivi[r] || r} <span className="text-muted-foreground font-normal">({sekcija.length})</span>
                          </span>
                          <button type="button"
                            onClick={() => sviOdabrani
                              ? setSelectedIds(prev => prev.filter(id => !sekcija.find(k => k.id === id)))
                              : selectAll(sekcija.map(k => k.id))}
                            className="text-[11px] text-primary font-bold hover:underline">
                            {sviOdabrani ? t("Poništi") : t("Odaberi sve")}
                          </button>
                        </div>
                        {sortAZ(sekcija).map(k => {
                          const grupe = k.grupeNazivi && k.grupeNazivi.length > 0 ? k.grupeNazivi : (k.grupaNaziv ? [k.grupaNaziv] : []);
                          return (
                            <button key={k.id} onClick={() => toggleSelection(k.id)}
                              className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/30 text-left transition-colors border-b border-border/20 last:border-0">
                              {selectedIds.includes(k.id) ?
                                <CheckSquare className="w-4 h-4 text-primary shrink-0" /> :
                                <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-sm text-foreground">{k.displayName}</span>
                                {grupe.length > 0 && (
                                  <span className="ml-1.5 text-xs text-primary/70">({grupe.join(", ")})</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={sendBulk} className="flex flex-col gap-3">
                  <input type="text" placeholder={t("Naslov (opciono)")} value={bulkNaslov}
                    onChange={e => setBulkNaslov(e.target.value)}
                    className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <textarea rows={4} required placeholder={t("Tekst poruke...")}
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

            {/* ── Aktivan razgovor ── */}
            {!showNovi && !showBulk && aktivan && (
              <motion.div key={aktivan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3 shrink-0">
                  <button onClick={() => setAktivan(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <Avatar name={aktivan.displayName} size="sm" />
                  <div>
                    <div className="font-extrabold text-sm text-foreground">{aktivan.displayName}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel(aktivan.role)}</div>
                  </div>
                </div>

                {/* Poruke */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
                  {isLoadingRazgovor ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                        <Skeleton className="h-14 w-48 rounded-2xl" />
                      </div>
                    ))
                  ) : poruke.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                      {t("Nema poruka — pošalji prvu!")}
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

                {/* Input */}
                <form onSubmit={sendPoruka} className="p-3 border-t border-border/50 flex gap-2 shrink-0">
                  <input type="text" placeholder={t("Napiši poruku...")} value={tekst}
                    onChange={e => setTekst(e.target.value)} autoComplete="off"
                    className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <Button type="submit" disabled={isSending || !tekst.trim()}
                    className="rounded-xl px-4 flex items-center gap-2 shrink-0">
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* ── Prazno stanje ── */}
            {!showNovi && !showBulk && !aktivan && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
                <MessageSquare className="w-12 h-12 opacity-15" />
                <p className="text-sm font-medium">{t("Odaberi razgovor ili napiši novu poruku")}</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
