import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest, getApiBase, openAuthorizedFile } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import { CalendarCheck, Star, Link2, Loader2, CheckCircle2, XCircle, AlertCircle, UserPlus, KeyRound, BookOpen, Flame, Award, Settings, Megaphone, MessageSquare, User as UserIcon, Calendar, ClipboardList, ChevronLeft, ChevronRight, Clock, FileText, Download } from "lucide-react";
import { PushToggle } from "@/components/push-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MaskotaPrazanState } from "@/components/maskota";
import { formatScreentime, isOnline, kategorijaOcjeneLabel } from "@/lib/utils";

function formatScreentimeShort(sec: number | null | undefined): string {
  const s = sec ?? 0;
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MyScreentimeBadgeRoditelj() {
  const { token } = useAuth();
  const [data, setData] = useState<{ totalScreentimeSec: number } | null>(null);
  useEffect(() => {
    if (!token) return;
    apiRequest<{ totalScreentimeSec: number; lastSeenAt: string | null }>("GET", "/aktivnost/me", undefined, token)
      .then(setData).catch(() => {});
  }, [token]);
  return (
    <div className="flex items-center gap-3 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl px-4 py-3 mb-4" data-testid="card-moje-vrijeme-roditelj">
      <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
        <Clock className="w-5 h-5 text-teal-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-teal-700/80 uppercase tracking-wide">Moje vrijeme na platformi</div>
        <div className="text-lg font-extrabold text-teal-800 leading-tight">{formatScreentimeShort(data?.totalScreentimeSec)}</div>
      </div>
    </div>
  );
}

interface Dijete {
  id: number;
  displayName: string;
  username: string;
  lastSeenAt?: string | null;
  totalScreentimeSec?: number | null;
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

interface RoditeljObavjestenje {
  id: number;
  naslov: string;
  sadrzaj: string;
  slikaUrl: string | null;
  muallimIme: string | null;
  grupaNaziv: string | null;
  createdAt: string;
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

interface KalendarEntry {
  id: number;
  grupaId: number;
  datum: string;
  tip: string;
  opis?: string;
  grupaNaziv?: string | null;
}

interface ZadacaRoditelj {
  id: number;
  grupaId: number;
  naslov: string;
  opis?: string | null;
  rokDo?: string | null;
  lekcijaNaslov?: string | null;
  lekcijaTip?: string | null;
  isActive: boolean;
  createdAt: string;
  grupaNaziv?: string | null;
  djecaIds: number[];
  djecaImena: string[];
  prolongCount?: number;
}

function fmtMinSec(s: number): string {
  if (s <= 0) return "0 min";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min` : `${s} s`;
}

const TIP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  mekteb: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", label: "Mekteb" },
  ferije: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", label: "Ferije" },
  vazan_datum: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700", label: "Važan datum" },
};

const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const MJESEC_NAZIVI = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

type TopTab = "obavjestenja" | "poruke" | "profil" | number;
type ChildSubTab = "kalendar" | "zadaca" | "ocjene" | "prisustvo" | "dokumenti";

interface MektebDokument {
  id: number;
  naziv: string;
  opis: string | null;
  originalName: string;
  storedName: string;
  fileSize: number;
  createdAt: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function DijeteContent({
  dijete,
  token,
  summary,
  summaryLoading,
  gameStats,
}: {
  dijete: Dijete;
  token: string;
  summary: DashboardSummary | null;
  summaryLoading: boolean;
  gameStats: GameStatsResp | null;
}) {
  const [childSubTab, setChildSubTab] = useState<ChildSubTab>("kalendar");
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [godine, setGodine] = useState<string[]>([]);
  const [tekucaGodina, setTekucaGodina] = useState<string | null>(null);
  const [selectedGodina, setSelectedGodina] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<BedzInfo | null>(null);
  const [kalendarEntries, setKalendarEntries] = useState<KalendarEntry[]>([]);
  const [kalendarLoading, setKalendarLoading] = useState(false);
  const [zadace, setZadace] = useState<ZadacaRoditelj[]>([]);
  const [zadaceLoading, setZadaceLoading] = useState(false);
  const [dokumenti, setDokumenti] = useState<MektebDokument[] | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Reset odabira godine kad se promijeni dijete (svako dijete ima svoje godine).
  useEffect(() => {
    setSelectedGodina(null);
    apiRequest<{ godine: string[]; tekuca: string | null }>("GET", `/roditelj/godine/${dijete.id}`, undefined, token)
      .then((d) => { setGodine(d.godine || []); setTekucaGodina(d.tekuca ?? null); })
      .catch(() => { setGodine([]); setTekucaGodina(null); });
  }, [dijete.id, token]);

  useEffect(() => {
    setDetailLoading(true);
    const q = selectedGodina ? `?mektebskaGodina=${encodeURIComponent(selectedGodina)}` : "";
    Promise.all([
      apiRequest<Prisustvo[]>("GET", `/roditelj/prisustvo/${dijete.id}${q}`, undefined, token),
      apiRequest<Ocjena[]>("GET", `/roditelj/ocjene/${dijete.id}${q}`, undefined, token),
    ])
      .then(([prs, oc]) => { setPrisustvo(prs); setOcjene(oc); })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [dijete.id, token, selectedGodina]);

  useEffect(() => {
    setKalendarLoading(true);
    apiRequest<KalendarEntry[]>("GET", "/roditelj/kalendar", undefined, token)
      .then(setKalendarEntries)
      .catch(() => setKalendarEntries([]))
      .finally(() => setKalendarLoading(false));
  }, [token]);

  useEffect(() => {
    setZadaceLoading(true);
    const q = selectedGodina ? `?mektebskaGodina=${encodeURIComponent(selectedGodina)}` : "";
    apiRequest<ZadacaRoditelj[]>("GET", `/roditelj/zadace/${dijete.id}${q}`, undefined, token)
      .then(setZadace)
      .catch(() => setZadace([]))
      .finally(() => setZadaceLoading(false));
  }, [token, dijete.id, selectedGodina]);

  useEffect(() => {
    setDokumenti(null);
    apiRequest<MektebDokument[]>("GET", `/roditelj/dijete/${dijete.id}/dokumenti`, undefined, token)
      .then(setDokumenti)
      .catch(() => setDokumenti([]));
  }, [dijete.id, token]);

  const filteredZadace = useMemo(() =>
    zadace.filter(z => z.djecaIds.includes(dijete.id)),
    [zadace, dijete.id],
  );

  const entriesByDate = useMemo(() => {
    const map: Record<string, KalendarEntry[]> = {};
    kalendarEntries.forEach(e => {
      if (!map[e.datum]) map[e.datum] = [];
      map[e.datum].push(e);
    });
    return map;
  }, [kalendarEntries]);

  const grid = useMemo(() => {
    const firstDay = new Date(viewDate.year, viewDate.month, 1);
    const lastDay = new Date(viewDate.year, viewDate.month + 1, 0);
    const dayOfWeek = (firstDay.getDay() + 6) % 7;
    const days: (string | null)[] = [];
    for (let i = 0; i < dayOfWeek; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [viewDate]);

  function navigateMonth(delta: number) {
    setViewDate(v => {
      const newMonth = v.month + delta;
      if (newMonth < 0) return { year: v.year - 1, month: 11 };
      if (newMonth > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: newMonth };
    });
    setSelectedDate(null);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const selectedEntries = selectedDate ? entriesByDate[selectedDate] || [] : [];

  const SUB_TABS: { id: ChildSubTab; label: string; icon: any }[] = [
    { id: "kalendar", label: "Kalendar", icon: Calendar },
    { id: "zadaca", label: "Zadaća", icon: ClipboardList },
    { id: "ocjene", label: "Ocjene", icon: Star },
    { id: "prisustvo", label: "Prisustvo", icon: CalendarCheck },
    { id: "dokumenti", label: "Dokumenti", icon: FileText },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center shrink-0">
          <span className="text-lg font-extrabold text-primary">{dijete.displayName[0]}</span>
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="font-extrabold text-foreground truncate">{dijete.displayName}</div>
          <div className="text-xs text-muted-foreground font-mono truncate">{dijete.username}</div>
        </div>
        {godine.length > 0 && (
          <select
            data-testid="select-mektebska-godina-dijete"
            value={selectedGodina ?? tekucaGodina ?? godine[0] ?? ""}
            onChange={(e) => setSelectedGodina(e.target.value)}
            className="rounded-xl border border-border/60 bg-white px-3 py-2 text-sm font-bold text-foreground shrink-0"
            title="Mektebska godina"
          >
            {godine.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

      <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-teal-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-teal-700/80 font-bold uppercase tracking-wide">Vrijeme na platformi</div>
          <div className="text-base font-extrabold text-teal-800 leading-tight">
            {formatScreentime(dijete.totalScreentimeSec)}
          </div>
        </div>
        {dijete.lastSeenAt && (
          <div className="text-[10px] text-teal-700/80 font-bold text-right shrink-0">
            {isOnline(dijete.lastSeenAt)
              ? <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>Online</span>
              : <>Zadnji put:<br/>{new Date(dijete.lastSeenAt).toLocaleString("bs-BA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
          </div>
        )}
      </div>

      {summaryLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : summary?.bedzevi && summary.bedzevi.length > 0 ? (
        <div className="bg-gradient-to-br from-primary/5 via-violet-50 to-amber-50 border border-primary/15 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Award className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-extrabold text-foreground">
              {summary.bedzeviError
                ? "Bedževi: trenutno nedostupni"
                : `Bedževi: ${summary.bedzeviEarnedCount ?? 0} / ${summary.bedzeviUkupno ?? summary.bedzevi.length}`}
            </h3>
          </div>
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-8 gap-1.5">
              {summary.bedzevi.map(b => {
                const earnedAtFormatted = b.earned ? formatEarnedDate(b.earnedAt) : null;
                return (
                  <Tooltip key={b.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={b.earned ? `${b.naziv}: ${b.opis}` : `${b.naziv} (zaključan)`}
                        onClick={() => setSelectedBadge(b)}
                        className="group relative w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                      >
                        <div className={`aspect-square rounded-lg flex items-center justify-center transition-all ${b.earned ? "hover:scale-110 cursor-pointer" : "grayscale opacity-50 cursor-pointer"}`}>
                          <img
                            src={`${import.meta.env.BASE_URL}bedzevi/${b.id}.png?v=4`}
                            alt={b.naziv}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-center">
                      <div className="font-bold">{b.naziv}</div>
                      <div className="opacity-90 mt-0.5">{b.opis}</div>
                      {earnedAtFormatted && <div className="opacity-90 mt-1">Osvojeno: {earnedAtFormatted}</div>}
                      {!b.earned && <div className="opacity-80 mt-1 italic">Zaključan — uslov: {b.uslov}</div>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          <Dialog open={selectedBadge !== null} onOpenChange={(open) => { if (!open) setSelectedBadge(null); }}>
            <DialogContent className="max-w-sm">
              {selectedBadge && (
                <>
                  <DialogHeader>
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-24 h-24 flex items-center justify-center ${selectedBadge.earned ? "" : "grayscale opacity-60"}`}>
                        <img
                          src={`${import.meta.env.BASE_URL}bedzevi/${selectedBadge.id}.png?v=4`}
                          alt={selectedBadge.naziv}
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <DialogTitle className="text-center text-lg font-extrabold">{selectedBadge.naziv}</DialogTitle>
                    </div>
                    <DialogDescription className="text-center text-sm pt-1">{selectedBadge.opis}</DialogDescription>
                  </DialogHeader>
                  {selectedBadge.earned ? (
                    <div className="text-center text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-2 px-3">
                      Osvojeno{formatEarnedDate(selectedBadge.earnedAt) ? `: ${formatEarnedDate(selectedBadge.earnedAt)}` : ""}
                    </div>
                  ) : (
                    <div className="text-center text-sm bg-amber-50 text-amber-800 border border-amber-100 rounded-xl py-2 px-3">
                      <span className="font-bold">Zaključan — uslov:</span> {selectedBadge.uslov}
                    </div>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      {gameStats && (gameStats.games.length > 0 || gameStats.secondsAllowed > 0) && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h3 className="text-xs font-extrabold text-purple-800 uppercase tracking-wide">Igre</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {gameStats.groupRank !== null && gameStats.groupTotal !== null && gameStats.groupTotal > 0 && (
                <span className="text-[10px] text-purple-800 font-extrabold bg-white border border-purple-200 rounded-md px-2 py-0.5">
                  Mjesto u grupi: {gameStats.groupRank} od {gameStats.groupTotal}
                </span>
              )}
              <span className="text-[10px] text-purple-700/70 font-bold">
                Vrijeme: {fmtMinSec(gameStats.secondsSpent)} / {fmtMinSec(gameStats.secondsAllowed)}
              </span>
              <span className="text-[10px] text-purple-700/70 font-bold">
                Aferimi: <span className="text-purple-800 font-extrabold">{gameStats.totalHasanat}</span>
              </span>
            </div>
          </div>
          {gameStats.games.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {(["memory", "quiz"] as const).map(gid => {
                const g = gameStats.games.find(x => x.gameId === gid);
                const label = gid === "memory" ? "Pamti par" : "Brzi kviz";
                return (
                  <div key={gid} className="bg-white rounded-lg p-2 border border-purple-100">
                    <div className="text-[10px] font-bold text-purple-700/70 uppercase">{label}</div>
                    <div className="text-sm font-extrabold text-purple-800">{g ? `${g.bestScore} pt` : "—"}</div>
                    <div className="text-[10px] text-muted-foreground">{g ? `${g.totalGames} ${g.totalGames === 1 ? "igra" : "igara"}` : "još nije igrao"}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setChildSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${childSubTab === tab.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {childSubTab === "prisustvo" && (
        <div className="bg-white border border-border/50 rounded-2xl p-4">
          {detailLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
          ) : prisustvo.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nema evidencije prisustva</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
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
          )}
        </div>
      )}

      {childSubTab === "ocjene" && (
        <div className="bg-white border border-border/50 rounded-2xl p-4">
          {detailLoading ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
          ) : ocjene.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nema unesenih ocjena</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {[...ocjene].sort((a, b) => b.datum.localeCompare(a.datum)).map(o => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-foreground">{kategorijaOcjeneLabel(o.kategorija)}</span>
                    {o.napomena && <span className="text-muted-foreground ml-2">— {o.napomena}</span>}
                    <span className="text-muted-foreground ml-2 text-xs">{o.datum}</span>
                  </div>
                  <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${OCJENA_COLOR[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                    {o.ocjena}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {childSubTab === "kalendar" && (
        <div className="bg-white border border-border/50 rounded-2xl p-4">
          {kalendarLoading ? (
            <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : kalendarEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nema unesenih datuma u kalendaru</p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigateMonth(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="font-extrabold text-lg text-foreground">{MJESEC_NAZIVI[viewDate.month]} {viewDate.year}</h3>
                <button onClick={() => navigateMonth(1)} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS_BS.map(d => (
                  <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((dateStr, i) => {
                  if (!dateStr) return <div key={i} className="aspect-square" />;
                  const dayEntries = entriesByDate[dateStr] || [];
                  const firstEntry = dayEntries[0];
                  const tipStyle = firstEntry ? TIP_COLORS[firstEntry.tip] : null;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const day = parseInt(dateStr.split("-")[2]);
                  return (
                    <button key={dateStr} onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                        tipStyle ? `${tipStyle.bg} ${tipStyle.text} font-bold border-2 ${tipStyle.border} hover:scale-105 cursor-pointer` : "hover:bg-muted text-foreground/70"
                      } ${isToday ? "ring-2 ring-primary ring-offset-1" : ""} ${isSelected ? "ring-2 ring-foreground ring-offset-1" : ""}`}>
                      <span>{day}</span>
                      {dayEntries.length > 1 && <span className="text-[9px] opacity-70">+{dayEntries.length - 1}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center flex-wrap gap-3 mt-4 pt-4 border-t border-border/40">
                {Object.entries(TIP_COLORS).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${val.bg} border-2 ${val.border}`} />
                    <span className="text-xs text-muted-foreground font-medium">{val.label}</span>
                  </div>
                ))}
              </div>
              {selectedDate && selectedEntries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                  <p className="text-xs text-muted-foreground font-bold mb-2">
                    {new Date(selectedDate).toLocaleDateString("bs-BA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {selectedEntries.map(entry => (
                    <div key={entry.id} className={`${TIP_COLORS[entry.tip]?.bg} rounded-lg px-3 py-2 border ${TIP_COLORS[entry.tip]?.border}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${TIP_COLORS[entry.tip]?.text}`}>{TIP_COLORS[entry.tip]?.label}</span>
                        {entry.grupaNaziv && <span className="text-xs text-muted-foreground bg-white/60 rounded px-2 py-0.5 font-medium">{entry.grupaNaziv}</span>}
                      </div>
                      {entry.opis && <p className={`text-sm ${TIP_COLORS[entry.tip]?.text} mt-1`}>{entry.opis}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {childSubTab === "zadaca" && (
        <div className="bg-white border border-border/50 rounded-2xl p-4">
          {zadaceLoading ? (
            <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : filteredZadace.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nema zadaća za {dijete.displayName}</p>
          ) : (
            <div className="space-y-3">
              {filteredZadace.map(z => {
                const expired = z.rokDo ? new Date(z.rokDo) < new Date(new Date().toDateString()) : false;
                return (
                  <div key={z.id} className={`border rounded-xl p-4 ${expired ? "border-red-200 bg-red-50/30" : "border-border/50"}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-extrabold text-foreground text-base">{z.naslov}</h3>
                      {expired && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Isteklo</span>}
                    </div>
                    {z.grupaNaziv && (
                      <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5 font-medium">{z.grupaNaziv}</span>
                    )}
                    {z.opis && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{z.opis}</p>}
                    <div className="flex items-center gap-4 flex-wrap mt-2">
                      {z.rokDo && (
                        <span className={`text-xs flex items-center gap-1 ${expired ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" /> Rok: {new Date(z.rokDo).toLocaleDateString("bs-BA")}
                        </span>
                      )}
                      {z.lekcijaNaslov && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {z.lekcijaNaslov}
                        </span>
                      )}
                      {(z.prolongCount ?? 0) > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          Prolongirano ×{z.prolongCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {childSubTab === "dokumenti" && (
        <div className="bg-white border border-border/50 rounded-2xl p-4">
          <p className="text-sm text-muted-foreground mb-4">Pravila, kućni red i druga obavještenja mekteba.</p>
          {dokumenti === null ? (
            <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : dokumenti.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Još nema dokumenata.</p>
          ) : (
            <div className="space-y-2">
              {dokumenti.map(d => (
                <button
                  key={d.id}
                  onClick={() => openAuthorizedFile(`/roditelj/dijete/${dijete.id}/dokumenti/${d.id}/file`, token).catch((e: any) => alert(e?.message || "Otvaranje dokumenta nije uspjelo"))}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">{d.naziv}</p>
                    {d.opis && <p className="text-sm text-muted-foreground truncate">{d.opis}</p>}
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{formatFileSize(d.fileSize)}</p>
                  </div>
                  <Download className="w-5 h-5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoditeljPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [djeca, setDjeca] = useState<Dijete[]>([]);
  const [summaryMap, setSummaryMap] = useState<Map<number, DashboardSummary | null>>(new Map());
  const [gameStatsMap, setGameStatsMap] = useState<Map<number, GameStatsResp | null>>(new Map());
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
  const [obavjestenja, setObavjestenja] = useState<RoditeljObavjestenje[]>([]);
  const [activeTab, setActiveTab] = useState<TopTab>("obavjestenja");
  const [selamEnabled, setSelamEnabled] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("mekteb-selam-disabled") !== "true" : true
  );

  const loadDjeca = () => {
    if (!token) return;
    setIsLoading(true);
    apiRequest<Array<{
      dijete: Dijete;
      summary: DashboardSummary | null;
      gameStats: GameStatsResp | null;
    }>>("GET", "/roditelj/djeca-summary", undefined, token)
      .then(rows => {
        setDjeca(rows.map(r => r.dijete));
        setSummaryMap(new Map(rows.map(r => [r.dijete.id, r.summary])));
        setGameStatsMap(new Map(rows.map(r => [r.dijete.id, r.gameStats])));
        if (rows.length > 0 && activeTab === "obavjestenja") {
        }
      })
      .catch(async () => {
        try {
          const list = await apiRequest<Dijete[]>("GET", "/roditelj/djeca", undefined, token);
          setDjeca(list);
          setSummaryMap(new Map());
          setGameStatsMap(new Map());
        } catch {}
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDjeca(); }, [token]);

  useEffect(() => {
    if (!token) return;
    apiRequest<RoditeljObavjestenje[]>("GET", "/roditelj/obavjestenja", undefined, token)
      .then(setObavjestenja)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (activeTab === "poruke") {
      setLocation("/poruke");
      setActiveTab("obavjestenja");
    }
  }, [activeTab, setLocation]);

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

  const topTabs: { id: TopTab; label: string; icon: any }[] = [
    { id: "obavjestenja", label: "Obavještenja", icon: Megaphone },
    ...djeca.map(d => ({ id: d.id as TopTab, label: d.displayName, icon: UserIcon })),
    { id: "poruke", label: "Poruke", icon: MessageSquare },
    { id: "profil", label: "Profil", icon: Settings },
  ];

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <MyScreentimeBadgeRoditelj />
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 border-b border-border/40">
          {topTabs.map(tab => (
            <button key={String(tab.id)} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "obavjestenja" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {obavjestenja.length === 0 ? (
              <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                <Megaphone className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-bold text-foreground mb-1">Nema obavještenja</p>
                <p className="text-sm text-muted-foreground">Muallim još nije objavio obavještenja.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {obavjestenja.map(o => (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-white to-primary/5 border border-primary/20 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-extrabold text-foreground text-base">{o.naslov}</h4>
                      {o.grupaNaziv && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{o.grupaNaziv}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {o.muallimIme && <span className="font-semibold">{o.muallimIme}</span>}
                      {o.muallimIme && " — "}
                      {new Date(o.createdAt).toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">{o.sadrzaj}</p>
                    {o.slikaUrl && (
                      <img
                        src={o.slikaUrl.startsWith("/") ? `${getApiBase().replace("/api", "")}${o.slikaUrl}` : o.slikaUrl}
                        alt="Ilustracija"
                        className="mt-3 max-h-48 rounded-xl border border-border/30"
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {typeof activeTab === "number" && (() => {
          const dijete = djeca.find(d => d.id === activeTab);
          if (!dijete) return null;
          return (
            <motion.div key={dijete.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <DijeteContent
                dijete={dijete}
                token={token!}
                summary={summaryMap.get(dijete.id) ?? null}
                summaryLoading={isLoading}
                gameStats={gameStatsMap.get(dijete.id) ?? null}
              />
              <div className="flex justify-end px-2 pt-3">
                <button onClick={() => { setPasswordChangeId(passwordChangeId === dijete.id ? null : dijete.id); setNewPw(""); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-bold transition-colors">
                  <KeyRound className="w-3.5 h-3.5" /> Promijeni lozinku
                </button>
              </div>
              {passwordChangeId === dijete.id && (
                <motion.form initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  onSubmit={changePassword}
                  className="mt-1 bg-white border border-border/50 rounded-xl p-4 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Nova lozinka za {dijete.displayName}</label>
                    <input type="password" required minLength={6} placeholder="Min. 6 znakova"
                      value={newPw} onChange={e => setNewPw(e.target.value)}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  </div>
                  <Button type="submit" size="sm" disabled={isChangingPw} className="rounded-xl shrink-0">
                    {isChangingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : "Spremi"}
                  </Button>
                </motion.form>
              )}
            </motion.div>
          );
        })()}

        {activeTab === "profil" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
            ) : djeca.length === 0 ? (
              <div className="bg-white rounded-2xl border border-border/50">
                <MaskotaPrazanState
                  naslov="Još nema povezane djece"
                  opis="Dodajte dijete ili povežite postojeći učenički račun da biste pratili napredak, prisustvo i ocjene."
                  akcija={
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button onClick={() => { setShowDodaj(true); setShowLink(false); }} className="rounded-xl flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Dodaj dijete
                      </Button>
                      <Button variant="outline" onClick={() => { setShowLink(true); setShowDodaj(false); }} className="rounded-xl flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Poveži dijete
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : (
              <div className="flex justify-center gap-4">
                {djeca.length < 4 && (
                  <>
                    <button onClick={() => { setShowDodaj(v => !v); setShowLink(false); setCreatedInfo(null); }}
                      className="flex items-center gap-2 text-primary hover:text-primary/80 font-bold text-sm transition-colors">
                      <UserPlus className="w-4 h-4" /> Dodaj dijete
                    </button>
                    <button onClick={() => { setShowLink(v => !v); setShowDodaj(false); }}
                      className="flex items-center gap-2 text-muted-foreground hover:text-primary font-bold text-sm transition-colors">
                      <Link2 className="w-4 h-4" /> Poveži postojeće
                    </button>
                  </>
                )}
              </div>
            )}

            {showDodaj && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-border/50 rounded-2xl p-5">
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
                className="bg-white border border-border/50 rounded-2xl p-5">
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
                      className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <Button type="submit" disabled={isLinking} className="rounded-xl flex items-center gap-2 shrink-0">
                      {isLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                      Poveži
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            <div className="bg-white border border-border/50 rounded-2xl p-5">
              <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-primary" /> Postavke
              </h3>
              <PushToggle />
              <div className="mt-4 pt-4 border-t border-border/40">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selamEnabled}
                    onChange={e => {
                      const val = e.target.checked;
                      setSelamEnabled(val);
                      localStorage.setItem("mekteb-selam-disabled", val ? "false" : "true");
                    }}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/40"
                  />
                  <span className="text-sm font-bold text-foreground">Prikaži pozdrav pri ulasku na platformu</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 ml-7">Pčela sa selamom pri svakom otvaranju stranice</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
