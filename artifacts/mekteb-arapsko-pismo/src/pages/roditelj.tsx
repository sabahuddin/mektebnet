import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { Users, CalendarCheck, Star, Link2, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, AlertCircle, UserPlus, KeyRound, BookOpen, Flame, Eye, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { MaskotaPrazanState } from "@/components/maskota";

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

interface BedzInfo {
  id: string;
  naziv: string;
  opis: string;
  ikona: string;
  bojaGradient: string;
  uslov: string;
  earned: boolean;
  earnedAt: string | null;
}

function formatEarnedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

interface DashboardSummary {
  posljednjaOcjena: { ocjena: number; kategorija: string; datum: string; napomena?: string | null } | null;
  prisustvoOvajMjesec: number;
  ukupnoOvajMjesec: number;
  zavrseneLekcije: number;
  streakDays: number;
  totalHasanat: number;
  bedzevi?: BedzInfo[];
  bedzeviEarnedCount?: number;
  bedzeviUkupno?: number;
  bedzeviError?: boolean;
}

interface GameStatsResp {
  totalHasanat: number;
  secondsAllowed: number;
  secondsSpent: number;
  secondsRemaining: number;
  groupRank: number | null;
  groupTotal: number | null;
  games: { gameId: string; totalGames: number; bestScore: number; lastScore: number; totalSeconds: number }[];
}

function fmtMinSec(s: number): string {
  if (s <= 0) return "0 min";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min` : `${s} s`;
}

function DijeteCard({ dijete, token }: { dijete: Dijete; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"prisustvo" | "ocjene">("prisustvo");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [gameStats, setGameStats] = useState<GameStatsResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    apiRequest<DashboardSummary>("GET", `/roditelj/dashboard/${dijete.id}`, undefined, token)
      .then(d => { if (!cancelled) setSummary(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    apiRequest<GameStatsResp>("GET", `/games/personal-stats?ucenikId=${dijete.id}`, undefined, token)
      .then(d => { if (!cancelled) setGameStats(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dijete.id, token]);

  const loadData = async () => {
    if (isLoading || prisustvo.length > 0 || ocjene.length > 0) return;
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
    const next = !expanded;
    setExpanded(next);
    if (next) loadData();
  };

  return (
    <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-lg font-extrabold text-primary">{dijete.displayName[0]}</span>
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="font-extrabold text-foreground truncate">{dijete.displayName}</div>
            <div className="text-xs text-muted-foreground font-mono truncate">{dijete.username}</div>
          </div>
        </div>

        {/* Summary stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <Star className="w-4 h-4 text-amber-600 mb-1" />
                <div className="text-lg font-extrabold text-amber-700 leading-none">
                  {summary?.posljednjaOcjena ? summary.posljednjaOcjena.ocjena : "—"}
                </div>
                <div className="text-[10px] text-amber-700/80 font-bold uppercase mt-1 tracking-wide">Posljednja ocjena</div>
                {summary?.posljednjaOcjena?.kategorija && (
                  <div className="text-[10px] text-amber-700/60 font-medium mt-0.5 truncate w-full">{summary.posljednjaOcjena.kategorija}</div>
                )}
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <CalendarCheck className="w-4 h-4 text-emerald-600 mb-1" />
                <div className="text-lg font-extrabold text-emerald-700 leading-none">
                  {summary ? `${summary.prisustvoOvajMjesec}/${summary.ukupnoOvajMjesec || 0}` : "—"}
                </div>
                <div className="text-[10px] text-emerald-700/80 font-bold uppercase mt-1 tracking-wide">Prisustvo ovaj mj.</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <BookOpen className="w-4 h-4 text-blue-600 mb-1" />
                <div className="text-lg font-extrabold text-blue-700 leading-none">{summary?.zavrseneLekcije ?? 0}</div>
                <div className="text-[10px] text-blue-700/80 font-bold uppercase mt-1 tracking-wide">Završene lekcije</div>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <Flame className="w-4 h-4 text-orange-600 mb-1" />
                <div className="text-lg font-extrabold text-orange-700 leading-none">{summary?.streakDays ?? 0}</div>
                <div className="text-[10px] text-orange-700/80 font-bold uppercase mt-1 tracking-wide">Dana niz</div>
              </div>
            </>
          )}
        </div>

        {/* Bedževi (badges) */}
        {summaryLoading ? (
          <Skeleton className="h-24 rounded-xl mb-4" />
        ) : summary?.bedzevi && summary.bedzevi.length > 0 ? (
          <div className="bg-gradient-to-br from-primary/5 via-violet-50 to-amber-50 border border-primary/15 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-extrabold text-foreground">
                {summary.bedzeviError
                  ? "Bedževi: trenutno nedostupni"
                  : `Bedževi: ${summary.bedzeviEarnedCount ?? 0} / ${summary.bedzeviUkupno ?? summary.bedzevi.length}`}
              </h3>
            </div>
            <TooltipProvider delayDuration={150}>
              <div className="grid grid-cols-8 sm:grid-cols-8 gap-1.5">
                {summary.bedzevi.map(b => {
                  const earnedAtFormatted = b.earned ? formatEarnedDate(b.earnedAt) : null;
                  return (
                    <Tooltip key={b.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={b.earned ? `${b.naziv}: ${b.opis}` : `${b.naziv} (zaključan, uslov: ${b.uslov})`}
                          className="group relative w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                          data-testid={`badge-${dijete.id}-${b.id}`}
                        >
                          <div className={`aspect-square rounded-lg flex items-center justify-center shadow-sm transition-all ${b.earned ? `bg-gradient-to-br ${b.bojaGradient} hover:scale-110 cursor-help` : "bg-gray-200 grayscale opacity-50 border border-dashed border-gray-300"}`}>
                            <span className={`text-base ${b.earned ? "filter drop-shadow-sm" : ""}`}>{b.ikona}</span>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-center">
                        <div className="font-bold">{b.naziv}</div>
                        <div className="opacity-90 mt-0.5">{b.opis}</div>
                        {earnedAtFormatted && (
                          <div className="opacity-90 mt-1" data-testid={`badge-earned-at-${dijete.id}-${b.id}`}>
                            Osvojeno: {earnedAtFormatted}
                          </div>
                        )}
                        {!b.earned && (
                          <div className="opacity-80 mt-1 italic">Zaključan — uslov: {b.uslov}</div>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </div>
        ) : null}

        {/* Igre — mini statistika */}
        {gameStats && (gameStats.games.length > 0 || gameStats.secondsAllowed > 0) && (
          <div
            className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4"
            data-testid={`game-stats-${dijete.id}`}
          >
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="text-xs font-extrabold text-purple-800 uppercase tracking-wide">Igre</h3>
              <div className="flex items-center gap-3 flex-wrap">
                {gameStats.groupRank !== null && gameStats.groupTotal !== null && gameStats.groupTotal > 0 && (
                  <span
                    className="text-[10px] text-purple-800 font-extrabold bg-white border border-purple-200 rounded-md px-2 py-0.5"
                    data-testid={`game-rank-${dijete.id}`}
                    title="Mjesto u grupi po sumi najboljih rezultata"
                  >
                    Mjesto u grupi: {gameStats.groupRank} od {gameStats.groupTotal}
                  </span>
                )}
                <span className="text-[10px] text-purple-700/70 font-bold">
                  Vrijeme: <span data-testid={`game-spent-${dijete.id}`}>{fmtMinSec(gameStats.secondsSpent)}</span> / {fmtMinSec(gameStats.secondsAllowed)}
                </span>
                <span
                  className="text-[10px] text-purple-700/70 font-bold"
                  data-testid={`game-hasanat-${dijete.id}`}
                  title="Ukupno hasanata — svakih 100 otključa 10 min vremena za igre"
                >
                  Hasanati: <span className="text-purple-800 font-extrabold">{gameStats.totalHasanat}</span>
                </span>
              </div>
            </div>
            {gameStats.games.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {(["memory", "quiz"] as const).map(gid => {
                  const g = gameStats.games.find(x => x.gameId === gid);
                  const label = gid === "memory" ? "Pamti par" : "Brzi kviz";
                  return (
                    <div key={gid} className="bg-white rounded-lg p-2 border border-purple-100">
                      <div className="text-[10px] font-bold text-purple-700/70 uppercase">{label}</div>
                      <div className="text-sm font-extrabold text-purple-800">
                        {g ? `${g.bestScore} pt` : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {g ? `${g.totalGames} ${g.totalGames === 1 ? "igra" : "igara"}` : "još nije igrao"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-purple-700/70 font-medium">Još nije pokrenuo nijednu igru.</p>
            )}
          </div>
        )}

        <button
          onClick={handleToggle}
          className="w-full flex items-center justify-center gap-2 text-sm font-bold text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-xl py-2.5 transition-colors"
          data-testid={`button-pogledaj-detalje-${dijete.id}`}
        >
          <Eye className="w-4 h-4" />
          {expanded ? "Sakrij detalje" : "Pogledaj detalje"}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

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
          <div className="bg-white rounded-2xl border border-border/50">
            <MaskotaPrazanState
              naslov="Još nema povezane djece"
              opis="Dodajte dijete ili povežite postojeći učenički račun da biste pratili napredak, prisustvo i ocjene."
              akcija={
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => { setShowDodaj(true); setShowLink(false); }} className="rounded-xl flex items-center gap-2" data-testid="button-dodaj-dijete-empty">
                    <UserPlus className="w-4 h-4" /> Dodaj dijete
                  </Button>
                  <Button variant="outline" onClick={() => { setShowLink(true); setShowDodaj(false); }} className="rounded-xl flex items-center gap-2" data-testid="button-povezi-dijete-empty">
                    <Link2 className="w-4 h-4" /> Poveži dijete
                  </Button>
                </div>
              }
            />
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-white border border-border/50 rounded-2xl p-5">
            <h3 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" /> Poveži se s djetetom
            </h3>

            <form onSubmit={linkDijete}>
              <p className="text-sm text-muted-foreground mb-4">
                Unesite korisničko ime djeteta koje ste dobili od muallima. Muallim mora odobriti zahtjev prije nego što vidite podatke.
              </p>
              <div className="flex gap-2">
                <input type="text" required placeholder="npr. amina.1234" value={ucenikUsername}
                  onChange={e => setUcenikUsername(e.target.value)}
                  className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-ucenik-username" />
                <Button type="submit" disabled={isLinking} className="rounded-xl flex items-center gap-2 shrink-0" data-testid="button-poveži">
                  {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Poveži
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
