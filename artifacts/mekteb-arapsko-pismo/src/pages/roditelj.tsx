import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { Users, CalendarCheck, Star, Link2, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, AlertCircle, UserPlus, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Dijete {
  id: number;
  displayName: string;
  username: string;
}

interface Prisustvo {
  id: number;
  datum: string;
  status: string;
  napomena?: string;
}

interface Ocjena {
  id: number;
  kategorija: string;
  ocjena: number;
  napomena?: string;
  datum: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  prisutan: { label: "Prisutan", color: "text-emerald-600 bg-emerald-50", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  odsutan: { label: "Odsutan", color: "text-red-600 bg-red-50", icon: <XCircle className="w-3.5 h-3.5" /> },
  zakasnio: { label: "Zakasnio", color: "text-amber-600 bg-amber-50", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  opravdan: { label: "Opravdan", color: "text-blue-600 bg-blue-50", icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const OCJENA_COLOR = ["", "text-red-700 bg-red-100", "text-orange-700 bg-orange-100", "text-amber-700 bg-amber-100", "text-blue-700 bg-blue-100", "text-emerald-700 bg-emerald-100"];

function DijeteCard({ dijete, token }: { dijete: Dijete; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"prisustvo" | "ocjene">("prisustvo");

  const loadData = async () => {
    if (isLoading || prisustvo.length > 0) return;
    setIsLoading(true);
    try {
      const [prs, oc] = await Promise.all([
        apiRequest<Prisustvo[]>("GET", `/roditelj/prisustvo/${dijete.id}`, undefined, token),
        apiRequest<Ocjena[]>("GET", `/roditelj/ocjene/${dijete.id}`, undefined, token),
      ]);
      setPrisustvo(prs);
      setOcjene(oc);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    setExpanded(v => !v);
    if (!expanded) loadData();
  };

  const prisutnih = prisustvo.filter(p => p.status === "prisutan").length;
  const prosjecna = ocjene.length ? (ocjene.reduce((s, o) => s + o.ocjena, 0) / ocjene.length).toFixed(2) : null;

  return (
    <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
            <span className="text-lg font-extrabold text-primary">{dijete.displayName[0]}</span>
          </div>
          <div className="text-left">
            <div className="font-extrabold text-foreground">{dijete.displayName}</div>
            <div className="text-xs text-muted-foreground font-mono">{dijete.username}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {prisustvo.length > 0 && (
            <div className="flex gap-3 text-xs font-bold">
              <span className="text-emerald-600">{prisutnih}/{prisustvo.length} ✓</span>
              {prosjecna && <span className="text-amber-600">⭐ {prosjecna}</span>}
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-border/50 p-5">
          {isLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                {(["prisustvo", "ocjene"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {tab === "prisustvo" ? `Prisustvo (${prisustvo.length})` : `Ocjene (${ocjene.length})`}
                  </button>
                ))}
              </div>

              {activeTab === "prisustvo" && (
                prisustvo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nema evidencije prisustva</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {[...prisustvo].sort((a, b) => b.datum.localeCompare(a.datum)).map(p => {
                      const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.prisutan;
                      return (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{p.datum}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            {p.napomena && <span className="text-xs text-muted-foreground">({p.napomena})</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {activeTab === "ocjene" && (
                ocjene.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nema unesenih ocjena</p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {[...ocjene].sort((a, b) => b.datum.localeCompare(a.datum)).map(o => (
                      <div key={o.id} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-foreground capitalize">{o.kategorija}</span>
                          {o.napomena && <span className="text-muted-foreground ml-2">— {o.napomena}</span>}
                          <span className="text-muted-foreground ml-2 text-xs">{o.datum}</span>
                        </div>
                        <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${OCJENA_COLOR[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                          {o.ocjena}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default function RoditeljPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [djeca, setDjeca] = useState<Dijete[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLink, setShowLink] = useState(false);
  const [showDodaj, setShowDodaj] = useState(false);
  const [ucenikUsername, setUcenikUsername] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [novoIme, setNovoIme] = useState("");
  const [novaLozinka, setNovaLozinka] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ username: string; displayName: string } | null>(null);
  const [passwordChangeId, setPasswordChangeId] = useState<number | null>(null);
  const [newPw, setNewPw] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);

  const loadDjeca = () => {
    if (!token) return;
    apiRequest<Dijete[]>("GET", "/roditelj/djeca", undefined, token)
      .then(setDjeca).catch(() => {}).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDjeca(); }, [token]);

  if (!user || user.role !== "roditelj") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo roditeljima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  async function linkDijete(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !ucenikUsername.trim()) return;
    setIsLinking(true);
    try {
      await apiRequest("POST", "/roditelj/link-dijete", { ucenikUsername: ucenikUsername.trim() }, token);
      toast({ title: "Zahtjev poslan!", description: "Muallim mora odobriti povezivanje s djetetom." });
      setUcenikUsername("");
      setShowLink(false);
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Korisničko ime nije pronađeno", variant: "destructive" });
    } finally {
      setIsLinking(false);
    }
  }

  async function dodajDijete(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !novoIme.trim() || !novaLozinka) return;
    setIsCreating(true);
    try {
      const result = await apiRequest<{ id: number; displayName: string; username: string }>(
        "POST", "/roditelj/dodaj-dijete", { displayName: novoIme.trim(), password: novaLozinka }, token
      );
      setCreatedInfo({ username: result.username, displayName: result.displayName });
      setNovoIme("");
      setNovaLozinka("");
      loadDjeca();
      toast({ title: "Dijete dodano!", description: `Korisničko ime: ${result.username}` });
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Nije moguće dodati dijete", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !passwordChangeId || !newPw) return;
    setIsChangingPw(true);
    try {
      await apiRequest("PUT", "/roditelj/dijete-lozinka", { ucenikId: passwordChangeId, newPassword: newPw }, token);
      toast({ title: "Lozinka promijenjena!" });
      setPasswordChangeId(null);
      setNewPw("");
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Nije moguće promijeniti lozinku", variant: "destructive" });
    } finally {
      setIsChangingPw(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Moja djeca</h1>
            <p className="text-muted-foreground text-sm">Pratite napredak, prisustvo i ocjene</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
        ) : djeca.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
            <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-bold text-foreground mb-1">Nema povezane djece</p>
            <p className="text-sm text-muted-foreground mb-5">Dodajte dijete ili povežite postojeći učenički račun</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setShowDodaj(true); setShowLink(false); }} className="rounded-xl flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Dodaj dijete
              </Button>
              <Button variant="outline" onClick={() => { setShowLink(true); setShowDodaj(false); }} className="rounded-xl flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Poveži dijete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {djeca.map(d => (
              <div key={d.id}>
                <DijeteCard dijete={d} token={token!} />
                <div className="flex justify-end px-2 pt-1.5">
                  <button onClick={() => { setPasswordChangeId(passwordChangeId === d.id ? null : d.id); setNewPw(""); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-bold transition-colors">
                    <KeyRound className="w-3.5 h-3.5" /> Promijeni lozinku
                  </button>
                </div>
                {passwordChangeId === d.id && (
                  <motion.form initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    onSubmit={changePassword}
                    className="mt-1 bg-white border border-border/50 rounded-xl p-4 flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">Nova lozinka za {d.displayName}</label>
                      <input type="password" required minLength={6} placeholder="Min. 6 znakova"
                        value={newPw} onChange={e => setNewPw(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                    <Button type="submit" size="sm" disabled={isChangingPw} className="rounded-xl shrink-0">
                      {isChangingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : "Spremi"}
                    </Button>
                  </motion.form>
                )}
              </div>
            ))}
            {djeca.length < 4 && (
              <div className="flex justify-center gap-4 mt-3">
                <button onClick={() => { setShowDodaj(v => !v); setShowLink(false); setCreatedInfo(null); }}
                  className="flex items-center gap-2 text-primary hover:text-primary/80 font-bold text-sm transition-colors">
                  <UserPlus className="w-4 h-4" /> Dodaj dijete
                </button>
                <button onClick={() => { setShowLink(v => !v); setShowDodaj(false); }}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary font-bold text-sm transition-colors">
                  <Link2 className="w-4 h-4" /> Poveži postojeće
                </button>
              </div>
            )}
          </div>
        )}

        {showDodaj && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-white border border-border/50 rounded-2xl p-5">
            <h3 className="font-extrabold text-foreground mb-2 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Dodaj dijete
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Kreirajte račun za dijete. Dijete će biti u grupi "Online Mekteb" i moći će učiti arapsko pismo.
            </p>

            {createdInfo && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-emerald-800 mb-1">Račun kreiran!</p>
                <p className="text-sm text-emerald-700">
                  <strong>{createdInfo.displayName}</strong> — korisničko ime: <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded">{createdInfo.username}</span>
                </p>
                <p className="text-xs text-emerald-600 mt-1">Zapišite korisničko ime i lozinku — dijete ih koristi za prijavu.</p>
              </div>
            )}

            <form onSubmit={dodajDijete} className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">Ime i prezime djeteta</label>
                <input type="text" required placeholder="npr. Amina Hadžić" value={novoIme}
                  onChange={e => setNovoIme(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">Lozinka</label>
                <input type="password" required minLength={6} placeholder="Min. 6 znakova" value={novaLozinka}
                  onChange={e => setNovaLozinka(e.target.value)}
                  className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <Button type="submit" disabled={isCreating} className="rounded-xl flex items-center gap-2 self-end">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Kreiraj račun
              </Button>
            </form>
          </motion.div>
        )}

        {showLink && (
          <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={linkDijete}
            className="mt-4 bg-white border border-border/50 rounded-2xl p-5">
            <h3 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" /> Poveži dijete
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Unesite korisničko ime djeteta (dobijate ga od muallima). Muallim mora odobriti zahtjev.
            </p>
            <div className="flex gap-2">
              <input type="text" required placeholder="npr. amina.1234" value={ucenikUsername}
                onChange={e => setUcenikUsername(e.target.value)}
                className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <Button type="submit" disabled={isLinking} className="rounded-xl flex items-center gap-2 shrink-0">
                {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Poveži
              </Button>
            </div>
          </motion.form>
        )}
      </div>
    </Layout>
  );
}
