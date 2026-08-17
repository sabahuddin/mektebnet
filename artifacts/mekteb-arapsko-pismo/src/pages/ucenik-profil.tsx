import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest, openAuthorizedFile } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import {
  User, Star, CalendarCheck, ClipboardList, BookOpen, Calendar,
  ChevronLeft, ChevronRight, Award, GraduationCap, MessageSquare,
  Flame, Trophy, Sparkles, Target, Footprints, Settings, Volume2, VolumeX,
  FileText, Clock, AlertCircle, Medal, Lock, CheckCircle2, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getSoundEffectsEnabled,
  setSoundEffectsEnabled,
  prefersReducedMotion,
  playRewardSound,
} from "@/lib/sound-prefs";
import { PushToggle } from "@/components/push-toggle";
import { SelamSetting } from "@/components/selam-setting";
import { kategorijaOcjeneLabel } from "@/lib/utils";
import { useLanguage } from "@/context/language";

interface StudentProgress {
  studentId: string;
  totalHasanat: number;
  totalMed: number;
  completedLessons: number[];
  badges: { id: string; name?: string; emoji?: string }[];
  streakDays: number;
  lastActivityDate: string | null;
}

interface IlmihalLekcija {
  id: number;
  nivo: number;
  slug: string;
  naslov: string;
  redoslijed: number;
}

interface MapaMedaljon {
  id: number;
  nivo: number;
  slug: string;
  naziv: string;
  opis: string;
  posAfterRedoslijed: number;
  boja: string;
}

interface Nivo1MapaData {
  medaljoni: MapaMedaljon[];
  zavrsene: number[];
  osvojeniMedaljoni: number[];
}

const MEDALJON_GRADIENT: Record<string, string> = {
  emerald: "from-emerald-300 to-emerald-600",
  sky:     "from-sky-300 to-sky-600",
  amber:   "from-amber-300 to-amber-600",
  orange:  "from-orange-300 to-orange-600",
  yellow:  "from-yellow-300 to-yellow-500",
  violet:  "from-violet-300 to-violet-600",
  bronze:  "from-amber-600 to-amber-900",
  silver:  "from-slate-300 to-slate-500",
  gold:    "from-yellow-400 to-amber-600",
};

function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString("bs-BA"));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    const unsubscribe = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration]);

  return <span ref={ref}>0</span>;
}

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

function ChangePasswordCard() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 6) { setMsg({ kind: "err", text: t("Nova šifra mora imati najmanje 6 karaktera.") }); return; }
    if (newPassword !== confirmPassword) { setMsg({ kind: "err", text: t("Potvrda nove šifre se ne podudara.") }); return; }
    setSaving(true);
    try {
      await apiRequest("POST", "/auth/change-password", { currentPassword, newPassword }, token!);
      setMsg({ kind: "ok", text: t("Šifra je uspješno promijenjena.") });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => { setOpen(false); setMsg(null); }, 1500);
    } catch (err: any) {
      setMsg({ kind: "err", text: err?.message || t("Greška pri promjeni šifre.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-700">
        <Lock className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-extrabold text-foreground">{t("Lozinka")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("Promijeni svoju šifru za prijavu.")}</p>
          </div>
          {!open && (
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="open-change-password">
              {t("Promijeni šifru")}
            </Button>
          )}
        </div>
        {open && (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground">{t("Trenutna šifra")}</label>
              <input type="password" autoComplete="current-password" required value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-current-password" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">{t("Nova šifra (min. 6 karaktera)")}</label>
              <input type="password" autoComplete="new-password" required minLength={6} value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-new-password" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">{t("Potvrdi novu šifru")}</label>
              <input type="password" autoComplete="new-password" required minLength={6} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-confirm-password" />
            </div>
            {msg && (
              <p className={`text-xs font-bold px-3 py-2 rounded-lg ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {msg.text}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); setMsg(null); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} disabled={saving}>
                {t("Odustani")}
              </Button>
              <Button type="submit" size="sm" disabled={saving} data-testid="submit-change-password">
                {saving ? t("Spašavam...") : t("Spasi novu šifru")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function formatScreentimeShort(sec: number | null | undefined): string {
  const s = sec ?? 0;
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MyScreentimeCard() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<{ totalScreentimeSec: number; lastSeenAt: string | null } | null>(null);
  useEffect(() => {
    if (!token) return;
    apiRequest<{ totalScreentimeSec: number; lastSeenAt: string | null }>("GET", "/aktivnost/me", undefined, token)
      .then(setData).catch(() => {});
  }, [token]);
  return (
    <div className="flex items-center gap-3 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-4 mb-4" data-testid="card-moje-vrijeme">
      <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
        <Clock className="w-5 h-5 text-teal-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-teal-700/80 uppercase tracking-wide">{t("Moje vrijeme na platformi")}</div>
        <div className="text-xl font-extrabold text-teal-800 leading-tight">{formatScreentimeShort(data?.totalScreentimeSec)}</div>
      </div>
    </div>
  );
}

function formatEarnedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

interface ProfilData {
  user: { id: number; displayName: string; username: string; createdAt: string };
  profil: { grupaId: number; muallimId: number } | null;
  grupa: { id: number; naziv: string; skolskaGodina: string } | null;
  muallim: { id: number; displayName: string } | null;
  ocjene: { id: number; kategorija: string; ocjena: number; lekcijaNaziv?: string; napomena?: string; datum: string }[];
  prisustvo: { id: number; datum: string; status: string }[];
  kvizovi: { id: number; kvizNaslov: string; tacniOdgovori: number; ukupnoPitanja: number; procenat: number; bodovi: number; completedAt: string }[];
  napredak?: {
    streakDays: number;
    totalHasanat: number;
    completedCount: number;
    lastActivityDate: string | null;
    poNivou: Record<number, { ukupno: number; gotov: number }>;
    bedzevi?: BedzInfo[];
    polozeneEtape?: { medaljonId: number; nivo: number; naziv: string; slug: string; polozenoAt: string; procenat: number }[];
    polozenaKrunisanja?: { krunisanjeId: number; nivo: number; naslov: string | null; polozenoAt: string; procenat: number }[];
  };
  mektebskaGodina?: { odabrana: string | null; tekuca: string | null; godine: string[] };
}

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

interface KalendarEntry {
  id: number; datum: string; tip: string; opis?: string;
}

interface PlanLekcija {
  id: number; datum: string; lekcijaNaslov: string; lekcijaTip: string;
}

interface Zadaca {
  id: number;
  naslov: string;
  opis?: string | null;
  rokDo?: string | null;
  lekcijaNaslov?: string | null;
  lekcijaTip?: string | null;
  createdAt: string;
  efektivniRok?: string | null;
  status?: string;
  uradjeno?: boolean;
  ocjena?: number | null;
  kapiMeda?: number;
  noviRok?: string | null;
  prolongCount?: number;
  istekao?: boolean;
  kategorija?: "zavrsene" | "aktivne";
}

const STATUS_COLORS: Record<string, string> = {
  prisutan: "bg-emerald-100 text-emerald-700",
  odsutan: "bg-red-100 text-red-700",
  zakasnio: "bg-amber-100 text-amber-700",
  opravdan: "bg-blue-100 text-blue-700",
};

const TIP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  mekteb: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", label: "Mekteb" },
  ferije: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", label: "Ferije" },
  vazan_datum: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700", label: "Važan datum" },
  ramazan: { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700", label: "Ramazan" },
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];
const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

export default function UcenikProfilPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [profil, setProfil] = useState<ProfilData | null>(null);
  const [kalendar, setKalendar] = useState<KalendarEntry[]>([]);
  const [planLekcija, setPlanLekcija] = useState<PlanLekcija[]>([]);
  const [zadace, setZadace] = useState<Zadaca[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [ilmihalLekcije, setIlmihalLekcije] = useState<IlmihalLekcija[]>([]);
  const [mapa, setMapa] = useState<Nivo1MapaData | null>(null);
  const [mapaN2, setMapaN2] = useState<Nivo1MapaData | null>(null);
  const [mapaN3, setMapaN3] = useState<Nivo1MapaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Odabrana mektebska godina (null = default/tekuća; server vraća odabranu).
  const [selectedGodina, setSelectedGodina] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"moj-put" | "pregled" | "ocjene" | "kalendar" | "zadace" | "kvizovi" | "dokumenti" | "postavke">("moj-put");
  const [dokumenti, setDokumenti] = useState<MektebDokument[] | null>(null);
  const [zadSubTab, setZadSubTab] = useState<"aktivne" | "zavrsene">("aktivne");
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => getSoundEffectsEnabled());
  const reducedMotion = prefersReducedMotion();
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Selected badge for tap-to-view detail dialog (mobile-friendly fallback for hover tooltip).
  const [selectedBadge, setSelectedBadge] = useState<BedzInfo | null>(null);
  const [mojeZvjezdice, setMojeZvjezdice] = useState<{ pozitivne: number; negativne: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    const q = selectedGodina ? `?mektebskaGodina=${encodeURIComponent(selectedGodina)}` : "";
    apiRequest<ProfilData>("GET", `/ucenik/profil${q}`, undefined, token)
      .then(data => {
        setProfil(data);
        return Promise.all([
          apiRequest<KalendarEntry[]>("GET", `/ucenik/kalendar${q}`, undefined, token).catch(() => []),
          apiRequest<PlanLekcija[]>("GET", "/ucenik/plan-lekcija", undefined, token).catch(() => []),
          apiRequest<Zadaca[]>("GET", `/ucenik/zadace${q}`, undefined, token).catch(() => []),
        ]);
      })
      .then(([k, p, z]) => { setKalendar(k); setPlanLekcija(p); setZadace(z); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token, selectedGodina]);

  // Zvjezdice — prikaz ponašanja (muallim dodijeljuje)
  useEffect(() => {
    if (!token) return;
    apiRequest<{ pozitivne: number; negativne: number }>("GET", "/ucenik/moje-zvjezdice", undefined, token)
      .then(setMojeZvjezdice).catch(() => {});
  }, [token]);

  // Mekteb dokumenti (pravila, kućni red...) — vidljivi učeniku.
  useEffect(() => {
    if (!token) return;
    apiRequest<MektebDokument[]>("GET", "/ucenik/dokumenti", undefined, token)
      .then(setDokumenti)
      .catch(() => setDokumenti([]));
  }, [token]);

  useEffect(() => {
    if (!user) return;
    apiRequest<StudentProgress>("GET", `/progress?studentId=${encodeURIComponent(String(user.id))}`)
      .then(setProgress)
      .catch(() => setProgress(null));
    apiRequest<IlmihalLekcija[]>("GET", "/content/ilmihal")
      .then(data => setIlmihalLekcije(Array.isArray(data) ? data : []))
      .catch(() => setIlmihalLekcije([]));
    if (token) {
      apiRequest<Nivo1MapaData>("GET", "/mapa/nivo1", undefined, token)
        .then(setMapa)
        .catch(() => setMapa(null));
      apiRequest<Nivo1MapaData>("GET", "/mapa/nivo/2", undefined, token)
        .then(setMapaN2)
        .catch(() => setMapaN2(null));
      apiRequest<Nivo1MapaData>("GET", "/mapa/nivo/3", undefined, token)
        .then(setMapaN3)
        .catch(() => setMapaN3(null));
    }
  }, [user, token]);

  if (!user || user.role !== "ucenik") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">{t("Pristup dozvoljen samo učenicima")}</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  const monthNames = [t("Januar"), t("Februar"), t("Mart"), t("April"), t("Maj"), t("Juni"), t("Juli"), t("August"), t("Septembar"), t("Oktobar"), t("Novembar"), t("Decembar")];

  function getDaysInMonth(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startWeekDay = firstDay.getDay();
    startWeekDay = startWeekDay === 0 ? 6 : startWeekDay - 1;
    const days: (number | null)[] = [];
    for (let i = 0; i < startWeekDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }

  function formatDate(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const prisutnih = profil ? profil.prisustvo.filter(p => p.status === "prisutan").length : 0;
  const prosjecnaOcjena = profil && profil.ocjene.length ? (profil.ocjene.reduce((s, o) => s + o.ocjena, 0) / profil.ocjene.length).toFixed(1) : "—";

  const TABS = [
    { id: "moj-put", label: t("Moj put"), icon: Footprints },
    { id: "pregled", label: t("Pregled"), icon: User },
    { id: "ocjene", label: t("Ocjene"), icon: Star },
    { id: "zadace", label: t("Zadaće"), icon: FileText, badge: zadace.length },
    { id: "kalendar", label: t("Kalendar"), icon: Calendar },
    { id: "kvizovi", label: t("Kvizovi"), icon: ClipboardList },
    { id: "dokumenti", label: t("Dokumenti"), icon: FileText, badge: dokumenti?.length ?? 0 },
    { id: "postavke", label: t("Postavke"), icon: Settings },
  ] as const;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSoundEffectsEnabled(next);
    // Give immediate audio feedback when turning on (so child knows it works)
    if (next && !reducedMotion) {
      // Ensure persistence is committed before we read it back
      setTimeout(() => playRewardSound(), 0);
    }
  };

  const completedSet = new Set(progress?.completedLessons ?? []);
  const totalLekcija = ilmihalLekcije.length;
  const zavrsenoUkupno = ilmihalLekcije.filter(l => completedSet.has(l.id)).length;
  const NIVO_META: Record<number, { label: string; bg: string; border: string; bar: string; text: string }> = {
    1: { label: "Nivo 1", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", text: "text-emerald-700" },
    2: { label: "Nivo 2", bg: "bg-blue-50",    border: "border-blue-200",    bar: "bg-blue-500",    text: "text-blue-700"    },
    3: { label: "Nivo 3", bg: "bg-violet-50",  border: "border-violet-200",  bar: "bg-violet-500",  text: "text-violet-700"  },
  };
  const nivoiBreakdown = [1, 2, 3].map(n => {
    const all = ilmihalLekcije.filter(l => l.nivo === n);
    const done = all.filter(l => completedSet.has(l.id)).length;
    return { nivo: n, total: all.length, done, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  });
  const ukupniProcenat = totalLekcija ? Math.round((zavrsenoUkupno / totalLekcija) * 100) : 0;
  const streakDays = progress?.streakDays ?? 0;
  const totalHasanat = progress?.totalHasanat ?? 0;
  const totalMed = progress?.totalMed ?? 0;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !profil ? (
          <div className="text-center py-20 text-muted-foreground">{t("Greška pri učitavanju profila")}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
                <User className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-extrabold text-foreground">{profil.user.displayName}</h1>
                <p className="text-muted-foreground text-sm">
                  {profil.grupa && <span className="font-medium">{profil.grupa.naziv}</span>}
                  {profil.muallim && <span> · {t("Muallim:")} {profil.muallim.displayName}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {profil.mektebskaGodina && profil.mektebskaGodina.godine.length > 0 && (
                  <select
                    data-testid="select-mektebska-godina"
                    value={selectedGodina ?? profil.mektebskaGodina.odabrana ?? ""}
                    onChange={(e) => setSelectedGodina(e.target.value)}
                    className="rounded-xl border border-border/60 bg-white px-3 py-2 text-sm font-bold text-foreground"
                    title={t("Mektebska godina")}
                  >
                    {profil.mektebskaGodina.godine.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}
                <Button variant="outline" className="rounded-xl" onClick={() => setLocation("/poruke")}>
                  <MessageSquare className="w-4 h-4 mr-1" /> {t("Poruke")}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              {TABS.map(tab => {
                const badge = "badge" in tab ? tab.badge : 0;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    data-testid={`tab-${tab.id}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${activeTab === tab.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                    <tab.icon className="w-4 h-4" /> {tab.label}
                    {badge > 0 && (
                      <span className={`ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-extrabold ${activeTab === tab.id ? "bg-white text-primary" : "bg-orange-500 text-white"}`}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab === "moj-put" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <MyScreentimeCard />
                {/* Hero stats — Duolingo style */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20"
                  >
                    <div className="absolute -right-4 -top-4 opacity-20">
                      <Flame className="w-32 h-32" />
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <Flame className="w-5 h-5 fill-current" />
                        <span className="text-sm font-extrabold uppercase tracking-wider opacity-90">{t("Niz dana")}</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={streakDays} />
                      </div>
                      <div className="text-sm font-bold opacity-90 mt-1">
                        {streakDays === 1 ? t("dan zaredom") : t("dana zaredom")} 🔥
                      </div>
                      <div className="text-xs opacity-80 mt-2">
                        {streakDays === 0
                          ? t("Završi lekciju danas i započni svoj niz!")
                          : streakDays < 3
                          ? t("Odličan početak — nastavi sutra!")
                          : streakDays < 7
                          ? t("Bravo, ne staj sad!")
                          : t("Mašallah, pravi mudžahid znanja!")}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-900 shadow-lg shadow-amber-400/20"
                  >
                    <div className="absolute -right-4 -top-4 opacity-25 text-9xl leading-none select-none" aria-hidden>🍯</div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg" aria-hidden>🍯</span>
                        <span className="text-sm font-extrabold uppercase tracking-wider">{t("Kapi meda")}</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={totalHasanat} />
                      </div>
                      <div className="text-sm font-bold mt-1 opacity-80">{t("ukupno sakupljeno")}</div>
                      <div className="text-xs mt-2 opacity-75">
                        {t("Za svaku završenu lekciju i kviz zaradiš nove kapi meda 🍯")}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 text-orange-950 shadow-lg shadow-orange-400/20"
                    data-testid="card-med"
                  >
                    <div className="absolute -right-4 -top-4 opacity-25">
                      <Star className="w-32 h-32 fill-current" />
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="text-sm font-extrabold uppercase tracking-wider">{t("Aferimi")}</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={totalMed} />
                      </div>
                      <div className="text-sm font-bold mt-1 opacity-80">{t("igrom zarađeni")}</div>
                      <div className="text-xs mt-2 opacity-75">
                        {t("Aferimi se zarađuju samo igranjem igrica.")}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  >
                    <div className="absolute -right-4 -top-4 opacity-20">
                      <BookOpen className="w-32 h-32" />
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-sm font-extrabold uppercase tracking-wider opacity-90">{t("Lekcije")}</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={zavrsenoUkupno} />
                        <span className="text-2xl font-bold opacity-80">/{totalLekcija || "—"}</span>
                      </div>
                      <div className="text-sm font-bold opacity-90 mt-1">{t("završeno")}</div>
                      <div className="text-xs opacity-80 mt-2">
                        {t("{n}% pređenog ilmihala", { n: String(ukupniProcenat) })}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Zvjezdice (ponašanje na času) — prikazuju se samo ako muallim dodijelio */}
                {mojeZvjezdice && (mojeZvjezdice.pozitivne > 0 || mojeZvjezdice.negativne > 0) && (
                  <div className="flex items-center gap-3 bg-white border border-border/50 rounded-2xl px-4 py-3 mb-5 flex-wrap">
                    <span className="text-sm font-extrabold text-muted-foreground shrink-0">{t("Ponašanje na času:")}</span>
                    <span className="text-base font-extrabold text-amber-500">⭐ {mojeZvjezdice.pozitivne}</span>
                    <span className="text-base font-extrabold text-gray-600">★ {mojeZvjezdice.negativne}</span>
                    <span className="text-xs text-muted-foreground">{t("zvjezdice od muallima")}</span>
                  </div>
                )}

                {/* Overall progress bar */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white border border-border/50 rounded-2xl p-5 mb-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" /> {t("Ukupan napredak kroz ilmihal")}
                    </h3>
                    <span className="font-black text-primary">
                      {zavrsenoUkupno}/{totalLekcija || "—"} {t("lekcija")}
                    </span>
                  </div>
                  <div className="relative h-4 bg-muted/40 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ukupniProcenat}%` }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-teal-500 to-emerald-500 rounded-full shadow-inner"
                    />
                    {ukupniProcenat > 0 && (
                      <motion.div
                        initial={{ left: 0, opacity: 0 }}
                        animate={{ left: `${ukupniProcenat}%`, opacity: 1 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                        className="absolute -top-1 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-primary shadow-md flex items-center justify-center"
                      >
                        <Sparkles className="w-3 h-3 text-primary" />
                      </motion.div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 font-medium">
                    {t("{n}% — nastavi tempom i bićeš pravi alim! 📚", { n: String(ukupniProcenat) })}
                  </div>
                </motion.div>

                {/* Per-level breakdown */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="grid md:grid-cols-3 gap-4 mb-6"
                >
                  {nivoiBreakdown.map((n, i) => {
                    const meta = NIVO_META[n.nivo];
                    return (
                      <motion.div
                        key={n.nivo}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.45 + i * 0.08 }}
                        className={`${meta.bg} border-2 ${meta.border} rounded-2xl p-4`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-extrabold ${meta.text}`}>{meta.label}</span>
                          <span className={`text-xs font-bold ${meta.text}`}>
                            {n.done}/{n.total || "—"}
                          </span>
                        </div>
                        <div className="relative h-2.5 bg-white/70 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${n.pct}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.6 + i * 0.08 }}
                            className={`absolute inset-y-0 left-0 ${meta.bar} rounded-full`}
                          />
                        </div>
                        <div className={`text-xs ${meta.text} font-bold mt-2 opacity-80`}>
                          {t("{n}% završeno", { n: String(n.pct) })}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Medaljoni — sekcija po nivou (1=bronzani, 2=srebreni, 3=zlatni).
                    Zaključani su sivi, otključani imaju pulse, a osvojeni sjaje. */}
                {([
                  { nivo: 1, m: mapa,   theme: "from-amber-100 via-amber-50 to-orange-50 border-amber-300",  h: "text-amber-900", icon: "text-amber-700", link: "/nivo1-mapa", earnedText: "text-amber-900", unlockedText: "text-amber-800", hint: "text-amber-800/70" },
                  { nivo: 2, m: mapaN2, theme: "from-slate-100 via-slate-50 to-zinc-50 border-slate-300",    h: "text-slate-800", icon: "text-slate-500", link: "/nivo2-mapa", earnedText: "text-slate-800", unlockedText: "text-slate-700", hint: "text-slate-700/70" },
                  { nivo: 3, m: mapaN3, theme: "from-yellow-100 via-amber-50 to-yellow-50 border-yellow-400", h: "text-amber-900", icon: "text-yellow-600", link: "/nivo3-mapa", earnedText: "text-amber-900", unlockedText: "text-amber-800", hint: "text-amber-800/70" },
                ] as const).map((cfg, idx) => {
                  if (!cfg.m || cfg.m.medaljoni.length === 0) return null;
                  const earnedCount = cfg.m.osvojeniMedaljoni.length;
                  const totalCount = cfg.m.medaljoni.length;
                  const zavrseneSet = new Set(cfg.m.zavrsene);
                  return (
                    <motion.div
                      key={cfg.nivo}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.48 + idx * 0.04 }}
                      className={`bg-gradient-to-br ${cfg.theme} border-2 rounded-2xl p-5 mb-6`}
                      data-testid={`card-medaljoni-nivo-${cfg.nivo}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`font-extrabold flex items-center gap-2 ${cfg.h}`}>
                          <Medal className={`w-5 h-5 ${cfg.icon}`} />
                          {t("Medaljoni Nivoa {nivo} ({earned}/{total})", { nivo: String(cfg.nivo), earned: String(earnedCount), total: String(totalCount) })}
                        </h3>
                        <Link
                          href={cfg.link}
                          className={`text-xs font-bold hover:underline ${cfg.h}`}
                        >
                          {t("Otvori mapu →")}
                        </Link>
                      </div>
                      <div className={`grid gap-2 sm:gap-3 ${cfg.m.medaljoni.length <= 5 ? "grid-cols-5" : "grid-cols-7"}`}>
                        {cfg.m.medaljoni.map((m) => {
                          const earned = cfg.m!.osvojeniMedaljoni.includes(m.id);
                          const unlocked = zavrseneSet.size >= m.posAfterRedoslijed;
                          return (
                            <Link
                              key={m.id}
                              href={`/medaljon/${m.slug}`}
                              className="group block focus:outline-none"
                              data-testid={`medaljon-profil-${m.slug}`}
                            >
                              <div
                                className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                                  earned
                                    ? "hover:scale-105"
                                    : unlocked
                                      ? "animate-pulse hover:scale-105"
                                      : "grayscale opacity-50"
                                }`}
                              >
                                <img
                                  src={`${import.meta.env.BASE_URL}medaljoni/nivo${m.nivo}-${m.posAfterRedoslijed}-lekcija.png?v=4`}
                                  alt={m.naziv}
                                  className="w-full h-full object-contain"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                              <div className={`text-[10px] text-center font-bold mt-1 truncate ${earned ? cfg.earnedText : unlocked ? cfg.unlockedText : "text-muted-foreground"}`}>
                                {m.naziv}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      <p className={`text-[11px] mt-3 italic ${cfg.hint}`}>
                        {t("Završi lekcije da otključaš, klikni medaljon da osvojiš svoj bedž!")}
                      </p>
                    </motion.div>
                  );
                })}

                {/* Etape i krunisanja — položene s datumima (Task #126) */}
                {((profil.napredak?.polozeneEtape?.length ?? 0) > 0
                  || (profil.napredak?.polozenaKrunisanja?.length ?? 0) > 0) && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.49 }}
                    className="bg-gradient-to-br from-violet-50 via-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-5 mb-6"
                    data-testid="card-etape-krunisanja"
                  >
                    <h3 className="font-extrabold text-amber-900 flex items-center gap-2 mb-3">
                      <Trophy className="w-5 h-5 text-amber-700" />
                      {t("Položene etape i krunisanja")}
                    </h3>
                    {(profil.napredak?.polozenaKrunisanja?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800/80 mb-2">{t("Krunisanja")}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {profil.napredak!.polozenaKrunisanja!.map((k) => (
                            <Link
                              key={k.krunisanjeId}
                              href={`/krunisanje/${k.nivo}`}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 transition"
                              data-testid={`krunisanje-polozeno-${k.nivo}`}
                            >
                              <span className="text-2xl" aria-hidden>👑</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-amber-900 text-sm truncate">
                                  {k.naslov || t("Krunisanje nivoa {nivo}", { nivo: String(k.nivo) })}
                                </div>
                                <div className="text-[11px] text-amber-700/80">
                                  {t("Nivo {nivo}", { nivo: String(k.nivo) })} · {k.procenat}% · {formatEarnedDate(k.polozenoAt) ?? ""}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {(profil.napredak?.polozeneEtape?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800/80 mb-2">
                          {t("Etape s položenim ispitom")}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {profil.napredak!.polozeneEtape!.map((e) => (
                            <Link
                              key={e.medaljonId}
                              href={`/medaljon/${e.slug}`}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-violet-200 hover:border-violet-400 transition"
                              data-testid={`etapa-polozena-${e.medaljonId}`}
                            >
                              <Medal className="w-5 h-5 text-violet-600 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-foreground text-sm truncate">{e.naziv}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {t("Nivo {nivo}", { nivo: String(e.nivo) })} · {e.procenat}% · {formatEarnedDate(e.polozenoAt) ?? ""}
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Moji bedževi — preview grid */}
                {profil.napredak?.bedzevi && profil.napredak.bedzevi.length > 0 && (() => {
                  const earnedCount = profil.napredak!.bedzevi!.filter(b => b.earned).length;
                  const totalCount = profil.napredak!.bedzevi!.length;
                  return (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="bg-white border border-border/50 rounded-2xl p-5 mb-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-extrabold text-foreground flex items-center gap-2">
                          <Award className="w-5 h-5 text-amber-500" /> {t("Moji bedževi ({earned}/{total})", { earned: String(earnedCount), total: String(totalCount) })}
                        </h3>
                        <button
                          onClick={() => setActiveTab("pregled")}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {t("Vidi sve →")}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {profil.napredak!.bedzevi!.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBadge(b)}
                            aria-label={b.earned ? `${b.naziv}: ${b.opis}` : t("{naziv} (zaključan, uslov: {uslov})", { naziv: b.naziv, uslov: b.uslov })}
                            title={`${b.naziv} — ${b.opis}${b.earned ? "" : t(" (uslov: {uslov})", { uslov: b.uslov })}`}
                            className="group relative w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                            data-testid={`badge-moj-put-${b.id}`}
                          >
                            <div className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${b.earned ? "hover:scale-105 cursor-pointer" : "grayscale opacity-50 cursor-pointer"}`}>
                              <img
                                src={`${import.meta.env.BASE_URL}bedzevi/${b.id}.png?v=4`}
                                alt={b.naziv}
                                className="w-full h-full object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            </div>
                            <div className={`text-[10px] text-center font-bold mt-1 truncate ${b.earned ? "text-foreground/70" : "text-muted-foreground"}`}>{b.naziv}</div>
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-3 italic">
                        {t("Sivi bedževi su zaključani — nastavi učiti da ih osvojiš!")}
                      </p>
                    </motion.div>
                  );
                })()}

                {/* CTA + last activity */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="grid md:grid-cols-2 gap-4"
                >
                  <div className="bg-gradient-to-br from-primary/5 to-teal-50 border border-primary/20 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                      <Trophy className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-foreground">{t("Nastavi učenje")}</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {t("Završi sljedeću lekciju i zaradi +30 kapi meda 🍯.")}
                      </div>
                      <Button size="sm" className="rounded-xl" onClick={() => setLocation("/ilmihal")}>
                        <BookOpen className="w-4 h-4 mr-1" /> {t("Otvori ilmihal")}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                      <Award className="w-7 h-7 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-foreground">
                        {progress?.badges?.length ? `${progress.badges.length} bedž${progress.badges.length === 1 ? "" : "eva"}` : t("Još bez bedža")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {progress?.lastActivityDate
                          ? t("Posljednja aktivnost: {datum}", { datum: progress.lastActivityDate })
                          : t("Završi prvu lekciju da pokreneš svoj niz.")}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === "pregled" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {profil.napredak && (
                  <div className="mb-6 bg-gradient-to-br from-primary/5 via-violet-50 to-amber-50 border border-primary/20 rounded-3xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Trophy className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-extrabold text-foreground">{t("Moj put učenja")}</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-white border border-orange-200 rounded-2xl p-4 text-center">
                        <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                        <div className="text-3xl font-extrabold text-orange-600">{profil.napredak.streakDays}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">{profil.napredak.streakDays === 1 ? t("dan zaredom") : t("dana zaredom")}</div>
                      </div>
                      <div className="bg-white border border-amber-200 rounded-2xl p-4 text-center">
                        <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                        <div className="text-3xl font-extrabold text-amber-600">{profil.napredak.totalHasanat}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">{profil.napredak.totalHasanat === 1 ? t("kap meda") : t("kapi meda")}</div>
                      </div>
                      <div className="bg-white border border-emerald-200 rounded-2xl p-4 text-center">
                        <BookOpen className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                        <div className="text-3xl font-extrabold text-emerald-700">{profil.napredak.completedCount}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">{profil.napredak.completedCount === 1 ? t("lekcija") : t("lekcija završeno")}</div>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {[1, 2, 3].map(nivo => {
                        const stats = profil.napredak!.poNivou[nivo];
                        if (!stats || stats.ukupno === 0) return null;
                        const procenat = stats.ukupno > 0 ? Math.round((stats.gotov / stats.ukupno) * 100) : 0;
                        return (
                          <div key={nivo}>
                            <div className="flex justify-between text-xs font-bold text-foreground mb-1">
                              <span>{t("Ilmihal — Nivo {nivo}", { nivo: String(nivo) })}</span>
                              <span className="text-primary">{stats.gotov}/{stats.ukupno} ({procenat}%)</span>
                            </div>
                            <div className="h-2.5 bg-white border border-primary/15 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500" style={{ width: `${procenat}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {profil.napredak.bedzevi && profil.napredak.bedzevi.length > 0 && (() => {
                      const earnedCount = profil.napredak!.bedzevi!.filter(b => b.earned).length;
                      const totalCount = profil.napredak!.bedzevi!.length;
                      return (
                        <div className="mt-5 pt-5 border-t border-primary/15">
                          <div className="flex items-center gap-2 mb-3">
                            <Award className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-extrabold text-foreground">{t("Moji bedževi ({earned}/{total})", { earned: String(earnedCount), total: String(totalCount) })}</h3>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {profil.napredak!.bedzevi!.map(b => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setSelectedBadge(b)}
                                aria-label={b.earned ? `${b.naziv}: ${b.opis}` : t("{naziv} (zaključan, uslov: {uslov})", { naziv: b.naziv, uslov: b.uslov })}
                                title={`${b.naziv} — ${b.opis}${b.earned ? "" : t(" (uslov: {uslov})", { uslov: b.uslov })}`}
                                className="group relative w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                                data-testid={`badge-pregled-${b.id}`}
                              >
                                <div className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${b.earned ? "hover:scale-105 cursor-pointer" : "grayscale opacity-50 cursor-pointer"}`}>
                                  <img
                                    src={`${import.meta.env.BASE_URL}bedzevi/${b.id}.png?v=4`}
                                    alt={b.naziv}
                                    className="w-full h-full object-contain"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  />
                                </div>
                                <div className={`text-[10px] text-center font-bold mt-1 truncate ${b.earned ? "text-foreground/70" : "text-muted-foreground"}`}>{b.naziv}</div>
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-3 italic">
                            {t("Sivi bedževi su zaključani — nastavi učiti da ih osvojiš!")}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: t("Prosječna ocjena"), value: prosjecnaOcjena, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: t("Prisustvo"), value: profil.prisustvo.length ? `${prisutnih}/${profil.prisustvo.length}` : "—", icon: CalendarCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: t("Kvizova završeno"), value: profil.kvizovi.length, icon: ClipboardList, color: "text-primary", bg: "bg-primary/5" },
                    { label: t("Ukupno ocjena"), value: profil.ocjene.length, icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50" },
                  ].map(stat => (
                    <div key={stat.label} className={`${stat.bg} border border-border/50 rounded-2xl p-4`}>
                      <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                      <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-amber-500" /> {t("Posljednje ocjene")}
                    </h3>
                    {profil.ocjene.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("Nema ocjena")}</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {profil.ocjene.slice(0, 8).map(o => (
                          <div key={o.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-foreground">{kategorijaOcjeneLabel(o.kategorija)}</span>
                              {o.lekcijaNaziv && <span className="text-primary text-xs ml-1">({o.lekcijaNaziv})</span>}
                              <div className="text-xs text-muted-foreground">{o.datum}</div>
                            </div>
                            <span className={`font-extrabold px-2.5 py-0.5 rounded-full text-sm ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                              {o.ocjena}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-3">
                      <CalendarCheck className="w-4 h-4 text-primary" /> {t("Posljednje prisustvo")}
                    </h3>
                    {profil.prisustvo.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("Nema evidencije")}</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {profil.prisustvo.slice(0, 10).map(p => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{p.datum}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>{p.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "ocjene" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-amber-500" /> {t("Sve ocjene")}
                    <span className="ml-auto text-base font-medium text-muted-foreground">{t("Prosjek:")} <span className="font-bold text-amber-600">{prosjecnaOcjena}</span></span>
                  </h3>
                  {profil.ocjene.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">{t("Nema unesenih ocjena")}</p>
                  ) : (
                    <div className="space-y-2">
                      {profil.ocjene.map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                          <div>
                            <span className="font-bold text-foreground">{kategorijaOcjeneLabel(o.kategorija)}</span>
                            {o.lekcijaNaziv && <span className="text-primary text-sm ml-2">({o.lekcijaNaziv})</span>}
                            {o.napomena && <span className="text-muted-foreground ml-2 text-sm">— {o.napomena}</span>}
                            <div className="text-xs text-muted-foreground mt-0.5">{o.datum}</div>
                          </div>
                          <span className={`text-lg font-extrabold px-3 py-1 rounded-full ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                            {o.ocjena}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "zadace" && (() => {
              const aktivne = zadace.filter(z => (z.kategorija ?? "aktivne") !== "zavrsene");
              const zavrsene = zadace.filter(z => z.kategorija === "zavrsene");
              const lista = zadSubTab === "zavrsene" ? zavrsene : aktivne;
              const sortByRok = (arr: Zadaca[]) => [...arr].sort((a, b) => {
                const ar = a.efektivniRok ?? a.rokDo, br = b.efektivniRok ?? b.rokDo;
                if (!ar && !br) return 0;
                if (!ar) return 1;
                if (!br) return -1;
                return ar.localeCompare(br);
              });
              return (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setZadSubTab("aktivne")}
                    className={`flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-sm font-extrabold border transition-all ${zadSubTab === "aktivne" ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                    {t("Aktivne ({n})", { n: String(aktivne.length) })}
                  </button>
                  <button onClick={() => setZadSubTab("zavrsene")}
                    className={`flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-sm font-extrabold border transition-all ${zadSubTab === "zavrsene" ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                    {t("Završene ({n})", { n: String(zavrsene.length) })}
                  </button>
                </div>

                {lista.length === 0 ? (
                  <div className="bg-white border border-border/50 rounded-2xl p-10 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <h3 className="font-extrabold text-foreground mb-1">
                      {zadSubTab === "zavrsene" ? t("Nema završenih zadaća") : t("Nema aktivnih zadaća")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {zadSubTab === "zavrsene" ? t("Završene i ocijenjene zadaće će se prikazati ovdje.") : t("Tvoj muallim ti trenutno nije zadao zadaću.")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortByRok(lista).map(z => {
                      const parseLocal = (s?: string | null) => {
                        if (!s) return null;
                        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
                        if (!m) return null;
                        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                        return isNaN(d.getTime()) ? null : d;
                      };
                      const efektivni = z.efektivniRok ?? z.rokDo ?? null;
                      const today = new Date(); today.setHours(0, 0, 0, 0);
                      const rokDate = parseLocal(efektivni);
                      const daysLeft = rokDate ? Math.round((rokDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                      const invalidRok = !!efektivni && rokDate === null;
                      const isDone = z.kategorija === "zavrsene";
                      const isOverdue = !isDone && daysLeft !== null && daysLeft < 0;
                      const isUrgent = !isDone && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
                      const rokColor = isDone ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                        : invalidRok ? "bg-muted text-muted-foreground border-border"
                        : isOverdue ? "bg-red-100 text-red-700 border-red-300"
                        : isUrgent ? "bg-amber-100 text-amber-700 border-amber-300"
                        : daysLeft !== null ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                        : "bg-muted text-muted-foreground border-border";
                      const rokDisplay = efektivni ? efektivni.slice(0, 10).split("-").reverse().join(".") : "";
                      const rokLabel = isDone ? t("Završeno")
                        : invalidRok ? t("Neispravan rok")
                        : !efektivni ? t("Bez roka")
                        : isOverdue ? t("Rok prošao ({datum})", { datum: rokDisplay })
                        : daysLeft === 0 ? t("Rok je danas!")
                        : daysLeft === 1 ? t("Rok je sutra")
                        : t("Još {n} dana ({datum})", { n: String(daysLeft), datum: rokDisplay });

                      return (
                        <div key={z.id} data-testid={`zadaca-${z.id}`}
                          className={`bg-white border-2 rounded-2xl p-5 ${isDone ? "border-emerald-200" : isOverdue ? "border-red-200" : isUrgent ? "border-amber-200" : "border-border/50"}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`p-2 rounded-xl ${isDone ? "bg-emerald-50" : isOverdue ? "bg-red-50" : isUrgent ? "bg-amber-50" : "bg-violet-50"}`}>
                                {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : isOverdue ? <AlertCircle className="w-5 h-5 text-red-600" /> : <FileText className="w-5 h-5 text-violet-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-extrabold text-foreground text-base">{z.naslov}</h3>
                                {z.lekcijaNaslov && (() => {
                                  const matchSlug = ilmihalLekcije.find(l => l.naslov === z.lekcijaNaslov)?.slug;
                                  return matchSlug ? (
                                    <Link href={`/ilmihal/${matchSlug}`} className="text-xs text-primary hover:underline mt-0.5 inline-flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" />{z.lekcijaNaslov}
                                    </Link>
                                  ) : (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      <BookOpen className="w-3 h-3 inline mr-1" />{z.lekcijaNaslov}
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                            <span className={`shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${rokColor}`}>
                              <Clock className="w-3 h-3" /> {rokLabel}
                            </span>
                          </div>
                          {z.opis && (
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-3 pl-12">{z.opis}</p>
                          )}
                          {(isDone || (z.prolongCount ?? 0) > 0 || (z.kapiMeda ?? 0) > 0 || (z.ocjena ?? null) !== null) && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pl-12">
                              {(z.ocjena ?? null) !== null && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">{t("Ocjena: {n}", { n: String(z.ocjena) })}</span>
                              )}
                              {(z.kapiMeda ?? 0) > 0 && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">{t("+{n} kapi meda", { n: String(z.kapiMeda) })}</span>
                              )}
                              {(z.prolongCount ?? 0) > 0 && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700">{t("Prolongirano ×{n}", { n: String(z.prolongCount) })}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
              );
            })()}

            {activeTab === "kalendar" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-white border border-border/50 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={() => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })}
                          className="p-2 hover:bg-muted rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                        <h3 className="font-extrabold text-lg text-foreground">
                          {monthNames[currentMonth.month]} {currentMonth.year}
                        </h3>
                        <button onClick={() => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })}
                          className="p-2 hover:bg-muted rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {DAYS_BS.map(d => (
                          <div key={d} className="text-center text-xs font-extrabold text-muted-foreground py-2">{d}</div>
                        ))}
                        {getDaysInMonth(currentMonth.year, currentMonth.month).map((day, i) => {
                          if (day === null) return <div key={`e-${i}`} />;
                          const dateStr = formatDate(currentMonth.year, currentMonth.month, day);
                          const entry = kalendar.find(k => k.datum === dateStr);
                          const tipStyle = entry ? TIP_COLORS[entry.tip] : null;
                          const isSelected = selectedDate === dateStr;
                          const hasLekcije = planLekcija.some(p => p.datum === dateStr);
                          const hasZadaca = zadace.some(z => z.rokDo === dateStr);

                          return (
                            <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                              className={`relative aspect-square rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center
                                ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                                ${tipStyle ? `${tipStyle.bg} ${tipStyle.text} border ${tipStyle.border}` : "hover:bg-muted/50 border border-transparent"}`}>
                              {day}
                              {(hasLekcije || hasZadaca) && (
                                <div className="absolute bottom-1 flex gap-0.5">
                                  {hasLekcije && <div className="w-1.5 h-1.5 bg-violet-500 rounded-full" />}
                                  {hasZadaca && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> {t("Mekteb")}</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 border border-red-400" /> {t("Ferije")}</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> {t("Važan datum")}</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-200 border border-purple-400" /> {t("Ramazan")}</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> {t("Lekcija")}</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> {t("Rok zadaće")}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {selectedDate ? (
                      <div className="bg-white border border-border/50 rounded-2xl p-5">
                        <h4 className="font-extrabold text-foreground mb-3">{selectedDate}</h4>
                        {(() => {
                          const entry = kalendar.find(k => k.datum === selectedDate);
                          const lekcije = planLekcija.filter(p => p.datum === selectedDate);
                          const zadaceDana = zadace.filter(z => z.rokDo === selectedDate);
                          return (
                            <div className="space-y-3">
                              {entry && (
                                <div className={`${TIP_COLORS[entry.tip]?.bg} rounded-lg px-3 py-2`}>
                                  <span className={`font-bold text-sm ${TIP_COLORS[entry.tip]?.text}`}>{TIP_COLORS[entry.tip]?.label}</span>
                                  {entry.opis && <p className="text-sm text-foreground mt-1">{entry.opis}</p>}
                                </div>
                              )}
                              {lekcije.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1">
                                    <BookOpen className="w-3.5 h-3.5 text-violet-500" /> {t("Lekcije za ovaj dan")}
                                  </h5>
                                  <div className="space-y-1.5">
                                    {lekcije.map(l => (
                                      <div key={l.id} className="bg-violet-50 rounded-lg px-3 py-2 text-sm font-medium text-foreground">
                                        {(() => {
                                          const matchSlug = ilmihalLekcije.find(il => il.naslov === l.lekcijaNaslov)?.slug;
                                          return matchSlug ? (
                                            <Link href={`/ilmihal/${matchSlug}`} className="text-primary hover:underline inline-flex items-center gap-1">
                                              <BookOpen className="w-3.5 h-3.5" />{l.lekcijaNaslov}
                                            </Link>
                                          ) : l.lekcijaNaslov;
                                        })()}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {zadaceDana.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5 text-orange-500" /> {t("Rok zadaće")}
                                  </h5>
                                  <div className="space-y-1.5">
                                    {zadaceDana.map(z => (
                                      <button key={z.id} onClick={() => setActiveTab("zadace")}
                                        className="w-full text-left bg-orange-50 hover:bg-orange-100 transition rounded-lg px-3 py-2 text-sm font-medium text-foreground">
                                        {z.naslov}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!entry && lekcije.length === 0 && zadaceDana.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-3">{t("Nema informacija za ovaj dan")}</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">{t("Klikni na dan za detalje")}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "postavke" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5 max-w-xl">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-primary" /> {t("Postavke")}
                  </h3>

                  <div className="flex items-start gap-4 p-4 rounded-2xl border border-border/60 bg-muted/20">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${soundEnabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                      {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="sound-toggle" className="font-extrabold text-foreground cursor-pointer">
                          {t("Zvučni efekti")}
                        </label>
                        <button
                          id="sound-toggle"
                          role="switch"
                          aria-checked={soundEnabled}
                          aria-label={t("Zvučni efekti")}
                          data-testid="toggle-sound-effects"
                          onClick={handleToggleSound}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                            soundEnabled ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              soundEnabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {t("Kratki zvuk pohvale kad završiš novu lekciju.")} {reducedMotion && (
                          <span className="block mt-1 text-amber-700 font-medium">
                            {t("Sistem je u režimu „smanjene animacije\" — zvuk je trenutno isključen.")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <PushToggle />
                  </div>
                  <SelamSetting />

                  <div className="mt-3">
                    <ChangePasswordCard />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "kvizovi" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-primary" /> {t("Historija kvizova")}
                  </h3>
                  {profil.kvizovi.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">{t("Još nisi radio/la kvizove")}</p>
                  ) : (
                    <div className="space-y-2">
                      {profil.kvizovi.map(r => (
                        <div key={r.id} className="flex items-center gap-4 p-3 bg-muted/20 rounded-xl">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-600" : r.procenat >= 50 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-500"}`}>
                            {r.procenat}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground truncate">{r.kvizNaslov}</p>
                            <p className="text-sm text-muted-foreground">
                              {t("{tacni}/{ukupno} tačnih", { tacni: String(r.tacniOdgovori), ukupno: String(r.ukupnoPitanja) })}
                              {r.bodovi > 0 && <span className="ml-2 text-amber-600 font-bold">{t("+{n} kapi meda 🍯", { n: String(r.bodovi) })}</span>}
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground shrink-0">
                            {r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "dokumenti" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-primary" /> {t("Dokumenti mekteba")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">{t("Pravila, kućni red i druga obavještenja tvog mekteba.")}</p>
                  {dokumenti === null ? (
                    <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                  ) : dokumenti.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">{t("Još nema dokumenata.")}</p>
                  ) : (
                    <div className="space-y-2">
                      {dokumenti.map(d => (
                        <button
                          key={d.id}
                          onClick={() => openAuthorizedFile(`/ucenik/dokumenti/${d.id}/file`, token).catch((e: any) => toast({ title: t("Greška"), description: e?.message || t("Otvaranje nije uspjelo"), variant: "destructive" }))}
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
              </motion.div>
            )}
          </>
        )}

        <Dialog open={selectedBadge !== null} onOpenChange={(open) => { if (!open) setSelectedBadge(null); }}>
          <DialogContent className="max-w-sm" data-testid="badge-detail-dialog">
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
                    <DialogTitle className="text-center text-lg font-extrabold" data-testid="badge-detail-title">
                      {selectedBadge.naziv}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-center text-sm pt-1" data-testid="badge-detail-desc">
                    {selectedBadge.opis}
                  </DialogDescription>
                </DialogHeader>
                {selectedBadge.earned ? (
                  <div
                    className="text-center text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl py-2 px-3"
                    data-testid="badge-detail-earned-at"
                  >
                    {t("Osvojeno")}{formatEarnedDate(selectedBadge.earnedAt)
                      ? `: ${formatEarnedDate(selectedBadge.earnedAt)}`
                      : t(" (datum nedostupan)")}
                  </div>
                ) : (
                  <div
                    className="text-center text-sm bg-amber-50 text-amber-800 border border-amber-100 rounded-xl py-2 px-3"
                    data-testid="badge-detail-uslov"
                  >
                    <span className="font-bold">{t("Zaključan — uslov:")}</span> {selectedBadge.uslov}
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
