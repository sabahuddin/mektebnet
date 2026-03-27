import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { MessageSquare, Send, ChevronLeft, Loader2, InboxIcon, Users, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Korisnik {
  id: number;
  displayName: string;
  role: string;
  grupaId?: number;
  grupaNaziv?: string;
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

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("bs-BA", { day: "numeric", month: "short" });
}

function roleLabel(role: string) {
  return { muallim: "Muallim", roditelj: "Roditelj", admin: "Admin", ucenik: "Učenik" }[role] || role;
}

export default function PorukePage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [razgovori, setRazgovori] = useState<Razgovor[]>([]);
  const [kontakti, setKontakti] = useState<Korisnik[]>([]);
  const [aktivan, setAktivan] = useState<Korisnik | null>(null);
  const [poruke, setPoruke] = useState<Poruka[]>([]);
  const [tekst, setTekst] = useState("");
  const [isLoadingLista, setIsLoadingLista] = useState(true);
  const [isLoadingRazgovor, setIsLoadingRazgovor] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showNovi, setShowNovi] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTekst, setBulkTekst] = useState("");
  const [bulkNaslov, setBulkNaslov] = useState("");
  const [filterGrupa, setFilterGrupa] = useState<string>("all");
  const endRef = useRef<HTMLDivElement>(null);

  const canBulkSend = user && (user.role === "admin" || user.role === "muallim");

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
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [poruke]);

  const openRazgovor = async (korisnik: Korisnik) => {
    setAktivan(korisnik);
    setIsLoadingRazgovor(true);
    setShowNovi(false);
    try {
      const data = await apiRequest<{ drugiKorisnik: Korisnik; poruke: Poruka[] }>(
        "GET", `/poruke/razgovor/${korisnik.id}`, undefined, token!
      );
      setPoruke(data.poruke);
      setRazgovori(prev => prev.map(r =>
        r.saKorisnikom.id === korisnik.id ? { ...r, neprocitano: 0 } : r
      ));
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati razgovor", variant: "destructive" });
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
        primateljId: aktivan.id,
        naslov: "Poruka",
        sadrzaj: tekst.trim(),
      }, token);
      setPoruke(prev => [...prev, nova]);
      setTekst("");
      loadRazgovori();
    } catch {
      toast({ title: "Greška", description: "Nije moguće poslati poruku", variant: "destructive" });
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
        primateljIds: selectedIds,
        naslov: bulkNaslov || "Obavijest",
        sadrzaj: bulkTekst.trim(),
      }, token);
      toast({ title: "Poruke poslane!", description: `Poslano ${selectedIds.length} poruka` });
      setSelectedIds([]);
      setBulkTekst("");
      setBulkNaslov("");
      setShowBulk(false);
      loadRazgovori();
    } catch {
      toast({ title: "Greška", description: "Nije moguće poslati poruke", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = (ids: number[]) => {
    setSelectedIds(prev => {
      const allSelected = ids.every(id => prev.includes(id));
      if (allSelected) return prev.filter(id => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const grupeNazivi = [...new Set(kontakti.filter(k => k.grupaNaziv).map(k => k.grupaNaziv!))];
  const filteredKontakti = filterGrupa === "all" ? kontakti
    : kontakti.filter(k => {
      if (filterGrupa === "muallim") return k.role === "muallim";
      if (filterGrupa === "roditelj") return k.role === "roditelj";
      if (filterGrupa === "ucenik") return k.role === "ucenik";
      if (filterGrupa === "admin") return k.role === "admin";
      return k.grupaNaziv === filterGrupa;
    });

  if (!user || !["muallim", "roditelj", "admin", "ucenik"].includes(user.role)) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Nemaš pristup porukama</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  const ukupnoNeprocitano = razgovori.reduce((s, r) => s + r.neprocitano, 0);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              Poruke {ukupnoNeprocitano > 0 && (
                <span className="ml-2 text-sm bg-primary text-primary-foreground rounded-full px-2 py-0.5">{ukupnoNeprocitano}</span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">Komunikacija s roditeljima / muallimom</p>
          </div>
        </div>

        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden flex" style={{ minHeight: 520 }}>
          {/* Lijeva strana — lista razgovora */}
          <div className="w-72 border-r border-border/50 flex flex-col shrink-0">
            <div className="p-3 border-b border-border/50 flex flex-col gap-1.5">
              <Button size="sm" onClick={() => { setShowNovi(true); setShowBulk(false); setAktivan(null); }}
                className="w-full rounded-xl flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Nova poruka
              </Button>
              {canBulkSend && (
                <Button size="sm" variant="outline" onClick={() => { setShowBulk(true); setShowNovi(false); setAktivan(null); setSelectedIds([]); setFilterGrupa("all"); }}
                  className="w-full rounded-xl flex items-center gap-2">
                  <Users className="w-4 h-4" /> Pošalji više
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingLista ? (
                <div className="p-3 flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : razgovori.length === 0 ? (
                <div className="text-center p-8">
                  <InboxIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                  <p className="text-xs text-muted-foreground">Nema poruka</p>
                </div>
              ) : (
                razgovori.map(r => (
                  <button key={r.saKorisnikom.id} onClick={() => openRazgovor(r.saKorisnikom)}
                    className={`w-full text-left p-3 border-b border-border/30 hover:bg-muted/30 transition-colors ${aktivan?.id === r.saKorisnikom.id ? "bg-muted/50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-foreground truncate">{r.saKorisnikom.displayName}</span>
                          {r.neprocitano > 0 && (
                            <span className="shrink-0 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{r.neprocitano}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.zadnjaPoruka.sadrzaj}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatTime(r.zadnjaPoruka.createdAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Desna strana — razgovor ili nova poruka */}
          <div className="flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              {showBulk ? (
                <motion.div key="bulk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 p-6 overflow-y-auto">
                  <h3 className="font-extrabold text-foreground mb-2">Pošalji poruku više korisnika</h3>
                  <p className="text-sm text-muted-foreground mb-4">Odaberite primatelje i napišite poruku</p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <select value={filterGrupa} onChange={e => setFilterGrupa(e.target.value)}
                      className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="all">Svi kontakti</option>
                      {user?.role === "admin" && <option value="muallim">Svi muallimi</option>}
                      {user?.role === "muallim" && (
                        <>
                          <option value="admin">Admini</option>
                          <option value="ucenik">Svi učenici</option>
                          <option value="roditelj">Svi roditelji</option>
                          {grupeNazivi.map(g => <option key={g} value={g}>Grupa: {g}</option>)}
                        </>
                      )}
                    </select>
                    <Button size="sm" variant="outline" className="rounded-xl text-xs"
                      onClick={() => selectAll(filteredKontakti.map(k => k.id))}>
                      {filteredKontakti.every(k => selectedIds.includes(k.id)) ? "Poništi sve" : "Odaberi sve"}
                    </Button>
                    {selectedIds.length > 0 && (
                      <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">
                        {selectedIds.length} odabrano
                      </span>
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-border/50 rounded-xl mb-4">
                    {filteredKontakti.map(k => (
                      <button key={k.id} onClick={() => toggleSelection(k.id)}
                        className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/30 text-left transition-colors border-b border-border/20 last:border-0">
                        {selectedIds.includes(k.id) ?
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" /> :
                          <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-sm text-foreground">{k.displayName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{roleLabel(k.role)}</span>
                          {k.grupaNaziv && <span className="ml-1 text-xs text-primary/70">({k.grupaNaziv})</span>}
                        </div>
                      </button>
                    ))}
                  </div>

                  <form onSubmit={sendBulk} className="flex flex-col gap-3">
                    <input type="text" placeholder="Naslov (opciono)" value={bulkNaslov}
                      onChange={e => setBulkNaslov(e.target.value)}
                      className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <textarea rows={4} required placeholder="Tekst poruke..."
                      value={bulkTekst} onChange={e => setBulkTekst(e.target.value)}
                      className="border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                    <Button type="submit" disabled={isSending || selectedIds.length === 0 || !bulkTekst.trim()}
                      className="rounded-xl flex items-center gap-2 self-end">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Pošalji ({selectedIds.length})
                    </Button>
                  </form>
                </motion.div>
              ) : showNovi ? (
                <motion.div key="novi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 p-6 overflow-y-auto">
                  <h3 className="font-extrabold text-foreground mb-4">Nova poruka</h3>
                  <div className="flex flex-col gap-2">
                    {kontakti.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nema dostupnih kontakata</p>
                    ) : (
                      kontakti.map(k => (
                        <button key={k.id} onClick={() => openRazgovor(k)}
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 border border-border/40 text-left transition-colors">
                          <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center font-extrabold text-primary shrink-0">
                            {k.displayName[0]}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">{k.displayName}</div>
                            <div className="text-xs text-muted-foreground">{roleLabel(k.role)}</div>
                            {k.grupaNaziv && <div className="text-xs text-primary/70">{k.grupaNaziv}</div>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : aktivan ? (
                <motion.div key={aktivan.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col">
                  {/* Header razgovora */}
                  <div className="p-4 border-b border-border/50 flex items-center gap-3">
                    <button onClick={() => setAktivan(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center font-extrabold text-primary text-sm">
                      {aktivan.displayName[0]}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-foreground">{aktivan.displayName}</div>
                      <div className="text-xs text-muted-foreground">{roleLabel(aktivan.role)}</div>
                    </div>
                  </div>

                  {/* Poruke */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {isLoadingRazgovor ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                          <Skeleton className="h-14 w-48 rounded-2xl" />
                        </div>
                      ))
                    ) : poruke.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                        Nema poruka — pošalji prvu!
                      </div>
                    ) : (
                      poruke.map(p => {
                        const isMoj = p.posiljateljId === user.id;
                        return (
                          <div key={p.id} className={`flex ${isMoj ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm ${isMoj ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                              <p className="leading-relaxed">{p.sadrzaj}</p>
                              <p className={`text-xs mt-1 ${isMoj ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                {formatTime(p.createdAt)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={endRef} />
                  </div>

                  {/* Input */}
                  <form onSubmit={sendPoruka} className="p-3 border-t border-border/50 flex gap-2">
                    <input
                      type="text"
                      placeholder="Napiši poruku..."
                      value={tekst}
                      onChange={e => setTekst(e.target.value)}
                      className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <Button type="submit" disabled={isSending || !tekst.trim()}
                      className="rounded-xl px-4 flex items-center gap-2 shrink-0">
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-sm font-medium">Odaberi razgovor ili napiši novu poruku</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}
