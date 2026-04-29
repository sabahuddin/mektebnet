import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  User, Star, CalendarCheck, ClipboardList, BookOpen, Calendar,
  ChevronLeft, ChevronRight, Award, GraduationCap, MessageSquare,
  Flame, Trophy, Sparkles, Target, Footprints
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StudentProgress {
  studentId: string;
  totalHasanat: number;
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
    bedzevi?: { id: string; naziv: string; opis: string; ikona: string; bojaGradient: string; uslov: string; earned: boolean; earnedAt: string | null }[];
  };
}

interface KalendarEntry {
  id: number; datum: string; tip: string; opis?: string;
}

interface PlanLekcija {
  id: number; datum: string; lekcijaNaslov: string; lekcijaTip: string;
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
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];
const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

export default function UcenikProfilPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [profil, setProfil] = useState<ProfilData | null>(null);
  const [kalendar, setKalendar] = useState<KalendarEntry[]>([]);
  const [planLekcija, setPlanLekcija] = useState<PlanLekcija[]>([]);
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [ilmihalLekcije, setIlmihalLekcije] = useState<IlmihalLekcija[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"moj-put" | "pregled" | "ocjene" | "kalendar" | "kvizovi">("moj-put");
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<ProfilData>("GET", "/ucenik/profil", undefined, token)
      .then(data => {
        setProfil(data);
        return Promise.all([
          apiRequest<KalendarEntry[]>("GET", "/ucenik/kalendar", undefined, token).catch(() => []),
          apiRequest<PlanLekcija[]>("GET", "/ucenik/plan-lekcija", undefined, token).catch(() => []),
        ]);
      })
      .then(([k, p]) => { setKalendar(k); setPlanLekcija(p); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!user) return;
    apiRequest<StudentProgress>("GET", `/progress?studentId=${encodeURIComponent(String(user.id))}`)
      .then(setProgress)
      .catch(() => setProgress(null));
    apiRequest<IlmihalLekcija[]>("GET", "/content/ilmihal")
      .then(data => setIlmihalLekcije(Array.isArray(data) ? data : []))
      .catch(() => setIlmihalLekcije([]));
  }, [user]);

  if (!user || user.role !== "ucenik") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo učenicima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  const monthNames = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

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
    { id: "moj-put", label: "Moj put", icon: Footprints },
    { id: "pregled", label: "Pregled", icon: User },
    { id: "ocjene", label: "Ocjene", icon: Star },
    { id: "kalendar", label: "Kalendar", icon: Calendar },
    { id: "kvizovi", label: "Kvizovi", icon: ClipboardList },
  ] as const;

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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !profil ? (
          <div className="text-center py-20 text-muted-foreground">Greška pri učitavanju profila</div>
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
                  {profil.muallim && <span> · Muallim: {profil.muallim.displayName}</span>}
                </p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => setLocation("/poruke")}>
                <MessageSquare className="w-4 h-4 mr-1" /> Poruke
              </Button>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border ${activeTab === tab.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "moj-put" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                        <span className="text-sm font-extrabold uppercase tracking-wider opacity-90">Niz dana</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={streakDays} />
                      </div>
                      <div className="text-sm font-bold opacity-90 mt-1">
                        {streakDays === 1 ? "dan zaredom" : "dana zaredom"} 🔥
                      </div>
                      <div className="text-xs opacity-80 mt-2">
                        {streakDays === 0
                          ? "Završi lekciju danas i započni svoj niz!"
                          : streakDays < 3
                          ? "Odličan početak — nastavi sutra!"
                          : streakDays < 7
                          ? "Bravo, ne staj sad!"
                          : "Mašallah, pravi mudžahid znanja!"}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 text-amber-900 shadow-lg shadow-amber-400/20"
                  >
                    <div className="absolute -right-4 -top-4 opacity-25">
                      <Star className="w-32 h-32 fill-current" />
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="text-sm font-extrabold uppercase tracking-wider">Hasanati</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={totalHasanat} />
                      </div>
                      <div className="text-sm font-bold mt-1 opacity-80">ukupno sakupljeno</div>
                      <div className="text-xs mt-2 opacity-75">
                        Za svaku završenu lekciju zaradiš nove hasanate ⭐
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
                        <span className="text-sm font-extrabold uppercase tracking-wider opacity-90">Lekcije</span>
                      </div>
                      <div className="text-5xl font-black leading-none">
                        <AnimatedNumber value={zavrsenoUkupno} />
                        <span className="text-2xl font-bold opacity-80">/{totalLekcija || "—"}</span>
                      </div>
                      <div className="text-sm font-bold opacity-90 mt-1">završeno</div>
                      <div className="text-xs opacity-80 mt-2">
                        {ukupniProcenat}% pređenog ilmihala
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Overall progress bar */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white border border-border/50 rounded-2xl p-5 mb-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" /> Ukupan napredak kroz ilmihal
                    </h3>
                    <span className="font-black text-primary">
                      {zavrsenoUkupno}/{totalLekcija || "—"} lekcija
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
                    {ukupniProcenat}% — nastavi tempom i bićeš pravi alim! 📚
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
                          {n.pct}% završeno
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

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
                      <div className="font-extrabold text-foreground">Nastavi učenje</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Završi sljedeću lekciju i zaradi +20 hasanata.
                      </div>
                      <Button size="sm" className="rounded-xl" onClick={() => setLocation("/ilmihal")}>
                        <BookOpen className="w-4 h-4 mr-1" /> Otvori ilmihal
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                      <Award className="w-7 h-7 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-foreground">
                        {progress?.badges?.length ? `${progress.badges.length} bedž${progress.badges.length === 1 ? "" : "eva"}` : "Još bez bedža"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {progress?.lastActivityDate
                          ? `Posljednja aktivnost: ${progress.lastActivityDate}`
                          : "Završi prvu lekciju da pokreneš svoj niz."}
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
                      <h2 className="text-lg font-extrabold text-foreground">Moj put učenja</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      <div className="bg-white border border-orange-200 rounded-2xl p-4 text-center">
                        <Flame className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                        <div className="text-3xl font-extrabold text-orange-600">{profil.napredak.streakDays}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">{profil.napredak.streakDays === 1 ? "dan zaredom" : "dana zaredom"}</div>
                      </div>
                      <div className="bg-white border border-amber-200 rounded-2xl p-4 text-center">
                        <Sparkles className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                        <div className="text-3xl font-extrabold text-amber-600">{profil.napredak.totalHasanat}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">hasanata</div>
                      </div>
                      <div className="bg-white border border-emerald-200 rounded-2xl p-4 text-center">
                        <BookOpen className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                        <div className="text-3xl font-extrabold text-emerald-700">{profil.napredak.completedCount}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-0.5">{profil.napredak.completedCount === 1 ? "lekcija" : "lekcija završeno"}</div>
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
                              <span>Ilmihal — Nivo {nivo}</span>
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
                            <h3 className="text-sm font-extrabold text-foreground">Moji bedževi ({earnedCount}/{totalCount})</h3>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {profil.napredak!.bedzevi!.map(b => (
                              <div key={b.id} className="group relative" title={`${b.naziv} — ${b.opis}${b.earned ? "" : ` (uslov: ${b.uslov})`}`}>
                                <div className={`aspect-square rounded-2xl flex items-center justify-center shadow-md transition-all ${b.earned ? `bg-gradient-to-br ${b.bojaGradient} hover:scale-105 cursor-help` : "bg-gray-200 grayscale opacity-50 border border-dashed border-gray-300"}`}>
                                  <span className={`text-2xl ${b.earned ? "filter drop-shadow-sm" : ""}`}>{b.ikona}</span>
                                </div>
                                <div className={`text-[10px] text-center font-bold mt-1 truncate ${b.earned ? "text-foreground/70" : "text-muted-foreground"}`}>{b.naziv}</div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-3 italic">
                            Sivi bedževi su zaključani — nastavi učiti da ih osvojiš!
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Prosječna ocjena", value: prosjecnaOcjena, icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
                    { label: "Prisustvo", value: profil.prisustvo.length ? `${prisutnih}/${profil.prisustvo.length}` : "—", icon: CalendarCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Kvizova završeno", value: profil.kvizovi.length, icon: ClipboardList, color: "text-primary", bg: "bg-primary/5" },
                    { label: "Ukupno ocjena", value: profil.ocjene.length, icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50" },
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
                      <Star className="w-4 h-4 text-amber-500" /> Posljednje ocjene
                    </h3>
                    {profil.ocjene.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nema ocjena</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {profil.ocjene.slice(0, 8).map(o => (
                          <div key={o.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-foreground capitalize">{o.kategorija}</span>
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
                      <CalendarCheck className="w-4 h-4 text-primary" /> Posljednje prisustvo
                    </h3>
                    {profil.prisustvo.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nema evidencije</p>
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
                    <Star className="w-5 h-5 text-amber-500" /> Sve ocjene
                    <span className="ml-auto text-base font-medium text-muted-foreground">Prosjek: <span className="font-bold text-amber-600">{prosjecnaOcjena}</span></span>
                  </h3>
                  {profil.ocjene.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nema unesenih ocjena</p>
                  ) : (
                    <div className="space-y-2">
                      {profil.ocjene.map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl">
                          <div>
                            <span className="font-bold text-foreground capitalize">{o.kategorija}</span>
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

                          return (
                            <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                              className={`relative aspect-square rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center
                                ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                                ${tipStyle ? `${tipStyle.bg} ${tipStyle.text} border ${tipStyle.border}` : "hover:bg-muted/50 border border-transparent"}`}>
                              {day}
                              {hasLekcije && <div className="w-1.5 h-1.5 bg-violet-500 rounded-full absolute bottom-1" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> Mekteb</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 border border-red-400" /> Ferije</span>
                        <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Važan datum</span>
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
                                    <BookOpen className="w-3.5 h-3.5 text-violet-500" /> Lekcije za ovaj dan
                                  </h5>
                                  <div className="space-y-1.5">
                                    {lekcije.map(l => (
                                      <div key={l.id} className="bg-violet-50 rounded-lg px-3 py-2 text-sm font-medium text-foreground">
                                        {l.lekcijaNaslov}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!entry && lekcije.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-3">Nema informacija za ovaj dan</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Klikni na dan za detalje</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "kvizovi" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-primary" /> Historija kvizova
                  </h3>
                  {profil.kvizovi.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Još nisi radio/la kvizove</p>
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
                              {r.tacniOdgovori}/{r.ukupnoPitanja} tačnih
                              {r.bodovi > 0 && <span className="ml-2 text-amber-600 font-bold">+{r.bodovi} hasanata</span>}
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
          </>
        )}
      </div>
    </Layout>
  );
}
