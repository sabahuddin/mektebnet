import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  Users, GraduationCap, CalendarCheck, BookMarked, ChevronRight, Plus,
  BarChart3, Clock, Loader2, Calendar, ChevronLeft, Trash2, BookOpen,
  Settings, Save, X, UserCheck, UserX, UserPlus, TrendingUp, ClipboardList,
  Award, Target, CheckCircle2, Download, Eye, FileSpreadsheet, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  ukupnoUcenika: number;
  ukupnoGrupa: number;
  danasnjePrisustvo?: number;
}

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  grupaId?: number;
  grupaIme?: string;
  aktivanStatus: boolean;
}

interface Grupa {
  id: number;
  naziv: string;
  skolskaGodina: string;
  daniNastave: string[];
  vrijemeNastave: string;
}

interface KalendarEntry {
  id: number;
  grupaId: number;
  datum: string;
  tip: "mekteb" | "ferije" | "vazan_datum";
  opis?: string;
}

interface PlanLekcija {
  id: number;
  grupaId: number;
  datum: string;
  lekcijaNaslov: string;
  lekcijaTip: string;
  redoslijed: number;
}

interface IlmihalLekcija {
  id: number;
  naslov: string;
  nivo: number;
}

interface PendingRoditelj {
  id: number;
  roditeljId: number;
  ucenikId: number;
  status: string;
  roditelj: { displayName: string; username: string };
  ucenik: { displayName: string; username: string };
}

interface StatistikaUcenik {
  id: number;
  ime: string;
  prisustvoPct: number | null;
  prisutanCount: number;
  odsutanCount: number;
  zakasnioCount: number;
  opravdanCount: number;
  ukupnoPrisustvo: number;
  prisustvoPoDatumu: Record<string, string>;
  mjesecnoStats: { mjesec: string; prisutan: number; ukupno: number; pct: number | null }[];
  prosjecneOcjene: Record<string, number>;
  ukupnaProsjecna: number | null;
  brojOcjena: number;
  kvizCount: number;
  kvizProsjecniProcenat: number | null;
  ukupnoBodova: number;
  kvizovaProslejSedmice: number;
}

interface MjesecniPregled {
  mjesec: string;
  prisutan: number;
  odsutan: number;
  zakasnio: number;
  opravdan: number;
  ukupno: number;
  pct: number | null;
}

interface PrisustvoPoDatumu {
  datum: string;
  prisutan: number;
  ukupno: number;
  pct: number | null;
  perStudent: Record<number, string>;
}

interface StatData {
  ucenici: StatistikaUcenik[];
  ukupnoCasova: number;
  svaDatumi: string[];
  mjesecniPregled: MjesecniPregled[];
  grupaPrisustvoPct: number | null;
  grupaProsjekOcjena: number | null;
  aktivnihProslejSedmice: number;
  ukupnoKvizova: number;
  ukupnoBodovaGrupa: number;
  prosjekBodovaGrupa: number;
  prisustvoPoDatumu: PrisustvoPoDatumu[];
}

interface Zadaca {
  id: number;
  grupaId: number;
  naslov: string;
  opis?: string;
  rokDo?: string;
  lekcijaNaslov?: string;
  lekcijaTip?: string;
  isActive: boolean;
  createdAt: string;
}

const TIP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  mekteb: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", label: "Mekteb" },
  ferije: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", label: "Ferije" },
  vazan_datum: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700", label: "Važan datum" },
};

const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

export default function MuallimPanel() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"pregled" | "ucenici" | "grupe" | "prisustvo" | "kalendar" | "plan" | "statistika" | "zadace">("pregled");
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedGrupaId, setSelectedGrupaId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [kalendar, setKalendar] = useState<KalendarEntry[]>([]);
  const [planLekcija, setPlanLekcija] = useState<PlanLekcija[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [kalendarLoading, setKalendarLoading] = useState(false);
  const [activeTip, setActiveTip] = useState<"mekteb" | "ferije" | "vazan_datum">("mekteb");
  const [opisInput, setOpisInput] = useState("");
  const [dostupneLekcije, setDostupneLekcije] = useState<IlmihalLekcija[]>([]);
  const [showLekcijaSelect, setShowLekcijaSelect] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchDatumi, setBatchDatumi] = useState<string[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [pendingRoditelji, setPendingRoditelji] = useState<PendingRoditelj[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const [statGrupaId, setStatGrupaId] = useState<number | null>(null);
  const [statData, setStatData] = useState<StatData | null>(null);
  const [statLoading, setStatLoading] = useState(false);
  const [statView, setStatView] = useState<"pregled" | "prisustvo" | "mjesecno">("pregled");
  const [exportingExcel, setExportingExcel] = useState(false);

  const [planGrupaId, setPlanGrupaId] = useState<number | null>(null);
  const [planLekcijaSep, setPlanLekcijaSep] = useState<PlanLekcija[]>([]);
  const [planLekcijeLoading, setPlanLekcijeLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planDatum, setPlanDatum] = useState(new Date().toISOString().split("T")[0]);
  const [planLekcijaNaslov, setPlanLekcijaNaslov] = useState("");
  const [planVrstaCasa, setPlanVrstaCasa] = useState("obrada");
  const [savingPlanLekcija, setSavingPlanLekcija] = useState(false);

  const [zadGrupaId, setZadGrupaId] = useState<number | null>(null);
  const [zadace, setZadace] = useState<Zadaca[]>([]);
  const [zadLoading, setZadLoading] = useState(false);
  const [showZadForm, setShowZadForm] = useState(false);
  const [zadNaslov, setZadNaslov] = useState("");
  const [zadOpis, setZadOpis] = useState("");
  const [zadRok, setZadRok] = useState("");
  const [zadLekcija, setZadLekcija] = useState("");
  const [savingZadaca, setSavingZadaca] = useState(false);

  const loadPendingRoditelji = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<PendingRoditelj[]>("GET", "/muallim/pending-roditelji", undefined, token);
      setPendingRoditelji(data);
    } catch {}
  };

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
    ]).then(([u, g]) => {
      setUcenici(u);
      setGrupe(g);
    }).catch(() => {}).finally(() => setIsLoading(false));
    loadPendingRoditelji();
  }, [token]);

  async function handleApproveRoditelj(roditeljUcenikId: number, approved: boolean) {
    if (!token) return;
    setApprovingId(roditeljUcenikId);
    try {
      await apiRequest("POST", "/muallim/approve-roditelj", { roditeljUcenikId, approved }, token);
      toast({ title: approved ? "Roditelj odobren!" : "Zahtjev odbijen" });
      setPendingRoditelji(prev => prev.filter(p => p.id !== roditeljUcenikId));
    } catch {
      toast({ title: "Greška", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  }

  useEffect(() => {
    if (!token || !selectedGrupaId) return;
    setKalendarLoading(true);
    Promise.all([
      apiRequest<KalendarEntry[]>("GET", `/muallim/kalendar?grupaId=${selectedGrupaId}`, undefined, token),
      apiRequest<PlanLekcija[]>("GET", `/muallim/plan-lekcija?grupaId=${selectedGrupaId}`, undefined, token),
      apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
    ]).then(([k, p, l]) => {
      setKalendar(k);
      setPlanLekcija(p);
      setDostupneLekcije(l);
    }).catch(() => {}).finally(() => setKalendarLoading(false));
  }, [token, selectedGrupaId]);

  async function saveBatchKalendar() {
    if (!token || !selectedGrupaId || batchDatumi.length === 0) return;
    setBatchSaving(true);
    try {
      await apiRequest("POST", "/muallim/kalendar/batch", { grupaId: selectedGrupaId, datumi: batchDatumi, tip: activeTip, opis: opisInput || "" }, token);
      const updated = await apiRequest<KalendarEntry[]>("GET", `/muallim/kalendar?grupaId=${selectedGrupaId}`, undefined, token);
      setKalendar(updated);
      setBatchDatumi([]);
      toast({ title: `${batchDatumi.length} dana označeno kao ${activeTip === "mekteb" ? "Mekteb" : activeTip === "ferije" ? "Ferije" : "Važan datum"}!` });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
    finally { setBatchSaving(false); }
  }

  function toggleBatchDate(dateStr: string) {
    setBatchDatumi(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
  }

  async function saveKalendarEntry(datum: string, tip: string, opis: string) {
    if (!token || !selectedGrupaId) return;
    try {
      await apiRequest("POST", "/muallim/kalendar", { grupaId: selectedGrupaId, datum, tip, opis }, token);
      const updated = await apiRequest<KalendarEntry[]>("GET", `/muallim/kalendar?grupaId=${selectedGrupaId}`, undefined, token);
      setKalendar(updated);
      toast({ title: "Sačuvano!" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  async function deleteKalendarEntry(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/kalendar/${id}`, undefined, token);
      setKalendar(prev => prev.filter(k => k.id !== id));
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  async function addLekcija(datum: string, lekcijaNaslov: string, lekcijaTip: string) {
    if (!token || !selectedGrupaId) return;
    try {
      const nova = await apiRequest<PlanLekcija>("POST", "/muallim/plan-lekcija", {
        grupaId: selectedGrupaId, datum, lekcijaNaslov, lekcijaTip, redoslijed: planLekcija.filter(p => p.datum === datum).length,
      }, token);
      setPlanLekcija(prev => [...prev, nova]);
      setShowLekcijaSelect(false);
      toast({ title: "Lekcija dodana!" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  async function deleteLekcija(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/plan-lekcija/${id}`, undefined, token);
      setPlanLekcija(prev => prev.filter(p => p.id !== id));
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  useEffect(() => {
    if (!token || !statGrupaId) return;
    setStatLoading(true);
    apiRequest<StatData>("GET", `/muallim/grupa/${statGrupaId}/statistika`, undefined, token)
      .then(data => { setStatData(data); setStatView("pregled"); })
      .catch(() => toast({ title: "Greška pri učitavanju statistike", variant: "destructive" }))
      .finally(() => setStatLoading(false));
  }, [token, statGrupaId]);

  useEffect(() => {
    if (!token || !planGrupaId) return;
    setPlanLekcijeLoading(true);
    Promise.all([
      apiRequest<PlanLekcija[]>("GET", `/muallim/plan-lekcija?grupaId=${planGrupaId}`, undefined, token),
      dostupneLekcije.length === 0
        ? apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => [])
        : Promise.resolve(dostupneLekcije),
    ]).then(([p, l]) => {
      setPlanLekcijaSep(p);
      if (l !== dostupneLekcije) setDostupneLekcije(l as IlmihalLekcija[]);
    }).catch(() => {}).finally(() => setPlanLekcijeLoading(false));
  }, [token, planGrupaId]);

  async function savePlanLekcija() {
    if (!token || !planGrupaId || !planLekcijaNaslov.trim()) return;
    setSavingPlanLekcija(true);
    try {
      const nova = await apiRequest<PlanLekcija>("POST", "/muallim/plan-lekcija", {
        grupaId: planGrupaId, datum: planDatum, lekcijaNaslov: planLekcijaNaslov.trim(), lekcijaTip: planVrstaCasa, redoslijed: planLekcijaSep.filter(p => p.datum === planDatum).length,
      }, token);
      setPlanLekcijaSep(prev => [...prev, nova]);
      setPlanLekcijaNaslov("");
      setShowPlanForm(false);
      toast({ title: "Lekcija dodana u plan!" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
    finally { setSavingPlanLekcija(false); }
  }

  async function deletePlanLekcija(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/plan-lekcija/${id}`, undefined, token);
      setPlanLekcijaSep(prev => prev.filter(p => p.id !== id));
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  useEffect(() => {
    if (!token || !zadGrupaId) return;
    setZadLoading(true);
    Promise.all([
      apiRequest<Zadaca[]>("GET", `/muallim/zadace?grupaId=${zadGrupaId}`, undefined, token),
      dostupneLekcije.length === 0
        ? apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => [])
        : Promise.resolve(dostupneLekcije),
    ]).then(([z, l]) => {
      setZadace(z);
      if (l !== dostupneLekcije) setDostupneLekcije(l as IlmihalLekcija[]);
    }).catch(() => toast({ title: "Greška pri učitavanju zadaća", variant: "destructive" }))
      .finally(() => setZadLoading(false));
  }, [token, zadGrupaId]);

  async function saveZadaca() {
    if (!token || !zadGrupaId || !zadNaslov.trim()) return;
    setSavingZadaca(true);
    try {
      const nova = await apiRequest<Zadaca>("POST", "/muallim/zadace", {
        grupaId: zadGrupaId,
        naslov: zadNaslov.trim(),
        opis: zadOpis.trim() || null,
        rokDo: zadRok || null,
        lekcijaNaslov: zadLekcija || null,
      }, token);
      setZadace(prev => [nova, ...prev]);
      setZadNaslov(""); setZadOpis(""); setZadRok(""); setZadLekcija("");
      setShowZadForm(false);
      toast({ title: "Zadaća dodana!" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
    finally { setSavingZadaca(false); }
  }

  async function deleteZadaca(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/zadace/${id}`, undefined, token);
      setZadace(prev => prev.filter(z => z.id !== id));
      toast({ title: "Zadaća obrisana" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  async function deleteUcenik(ucenikId: number) {
    if (!token) return;
    if (!confirm("Da li ste sigurni da želite arhivirati ovog učenika?")) return;
    try {
      await apiRequest("DELETE", `/muallim/ucenici/${ucenikId}`, undefined, token);
      setUcenici(prev => prev.filter(u => u.id !== ucenikId));
      toast({ title: "Učenik arhiviran" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  async function deleteGrupa(grupaId: number) {
    if (!token) return;
    if (!confirm("Da li ste sigurni da želite obrisati ovu grupu? Učenici neće biti obrisani, samo premješteni bez grupe.")) return;
    try {
      await apiRequest("DELETE", `/muallim/grupe/${grupaId}`, undefined, token);
      setGrupe(prev => prev.filter(g => g.id !== grupaId));
      setUcenici(prev => prev.map(u => u.grupaId === grupaId ? { ...u, grupaId: undefined, grupaIme: undefined } : u));
      toast({ title: "Grupa obrisana" });
    } catch { toast({ title: "Greška", variant: "destructive" }); }
  }

  async function saveProfile() {
    if (!token) return;
    setSavingProfile(true);
    try {
      await apiRequest("PUT", "/muallim/profil", { displayName: editDisplayName }, token);
      toast({ title: "Profil ažuriran!" });
      setShowProfileEdit(false);
      window.location.reload();
    } catch { toast({ title: "Greška", variant: "destructive" }); }
    finally { setSavingProfile(false); }
  }

  async function exportExcel(grupaId: number) {
    if (!token) return;
    setExportingExcel(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
      const res = await fetch(`${API_BASE}/muallim/grupa/${grupaId}/izvjestaj-excel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `izvjestaj_${grupaId}.xlsx`;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Excel izvještaj preuzet!" });
    } catch {
      toast({ title: "Greška pri preuzimanju", variant: "destructive" });
    } finally {
      setExportingExcel(false);
    }
  }

  const MJESEC_NAZIVI: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Maj", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dec",
  };

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

  const monthNames = ["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"];

  if (!user || (user.role !== "muallim" && user.role !== "admin")) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo muallimima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  const TABS = [
    { id: "pregled", label: "Pregled", icon: BarChart3 },
    { id: "ucenici", label: `Učenici (${ucenici.length})`, icon: Users },
    { id: "grupe", label: `Grupe (${grupe.length})`, icon: GraduationCap },
    { id: "prisustvo", label: "Prisustvo", icon: CalendarCheck },
    { id: "kalendar", label: "Kalendar", icon: Calendar },
    { id: "plan", label: "Plan lekcija", icon: BookOpen },
    { id: "statistika", label: "Statistika", icon: TrendingUp },
    { id: "zadace", label: "Zadaće", icon: ClipboardList },
  ] as const;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-foreground">Muallim panel</h1>
            <p className="text-muted-foreground text-sm">Dobrodošao/la, {user.displayName}</p>
          </div>
          <button onClick={() => { setEditDisplayName(user.displayName || ""); setShowProfileEdit(true); }}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
            <Settings className="w-4 h-4" /> Profil
          </button>
        </div>

        {showProfileEdit && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="bg-white border border-border/50 rounded-2xl p-5 mb-6">
            <h3 className="font-extrabold text-foreground mb-3">Uredi profil</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-bold text-muted-foreground block mb-1">Ime i prezime</label>
                <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile} className="rounded-xl">
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Sačuvaj</>}
              </Button>
              <button onClick={() => setShowProfileEdit(false)} className="text-muted-foreground hover:text-foreground p-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${activeTab === tab.id ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : (
          <>
            {/* PREGLED */}
            {activeTab === "pregled" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Ukupno učenika", value: ucenici.length, icon: Users, color: "text-primary", bg: "bg-primary/5" },
                    { label: "Aktivnih grupa", value: grupe.length, icon: GraduationCap, color: "text-secondary", bg: "bg-secondary/5" },
                    { label: "Aktivnih učenika", value: ucenici.filter(u => u.aktivanStatus).length, icon: BookMarked, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Školska godina", value: "2024/25", icon: Clock, color: "text-violet-600", bg: "bg-violet-50" },
                  ].map(stat => (
                    <div key={stat.label} className={`${stat.bg} border border-border/50 rounded-2xl p-5`}>
                      <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                      <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                      <div className="text-sm text-muted-foreground font-medium mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {pendingRoditelji.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <UserPlus className="w-5 h-5 text-amber-600" />
                      <h3 className="font-extrabold text-base text-amber-800">
                        Zahtjevi roditelja ({pendingRoditelji.length})
                      </h3>
                    </div>
                    <p className="text-sm text-amber-700 mb-4">
                      Roditelji koji žele povezati račun sa učenikom. Pregledajte i odobrite ili odbijte.
                    </p>
                    <div className="space-y-3">
                      {pendingRoditelji.map(pr => (
                        <div key={pr.id} className="bg-white rounded-xl border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1">
                            <div className="font-bold text-foreground">{pr.roditelj.displayName}</div>
                            <div className="text-sm text-muted-foreground">@{pr.roditelj.username}</div>
                            <div className="text-sm text-amber-700 mt-1">
                              želi se povezati sa učenikom: <span className="font-bold">{pr.ucenik.displayName}</span> (@{pr.ucenik.username})
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-red-300 text-red-600 hover:bg-red-50"
                              disabled={approvingId === pr.id}
                              onClick={() => handleApproveRoditelj(pr.id, false)}
                            >
                              {approvingId === pr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4 mr-1" />}
                              Odbij
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={approvingId === pr.id}
                              onClick={() => handleApproveRoditelj(pr.id, true)}
                            >
                              {approvingId === pr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4 mr-1" />}
                              Odobri
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* UČENICI */}
            {activeTab === "ucenici" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-end mb-4">
                  <Link href="/muallim/dodaj-ucenika">
                    <Button className="rounded-xl font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Dodaj učenika
                    </Button>
                  </Link>
                </div>
                <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                  {ucenici.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Nema učenika. Dodaj prvog učenika.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="border-b border-border/50">
                        <tr>
                          {["Ime i prezime", "Korisničko ime", "Grupa", "Status", ""].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ucenici.map((u, i) => (
                          <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-bold text-foreground">{u.displayName}</td>
                            <td className="px-4 py-3 text-muted-foreground font-mono text-sm">{u.username}</td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">{u.grupaIme || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.aktivanStatus ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {u.aktivanStatus ? "Aktivan" : "Arhiviran"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Link href={`/muallim/ucenik/${u.id}`}>
                                  <button className="text-primary hover:underline font-bold text-sm flex items-center gap-1">
                                    Detalji <ChevronRight className="w-3 h-3" />
                                  </button>
                                </Link>
                                <button onClick={() => deleteUcenik(u.id)} className="text-red-400 hover:text-red-600 p-1" title="Arhiviraj učenika">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}

            {/* GRUPE */}
            {activeTab === "grupe" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-end mb-4">
                  <Link href="/muallim/dodaj-grupu">
                    <Button className="rounded-xl font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4" /> Nova grupa
                    </Button>
                  </Link>
                </div>
                {grupe.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nema grupa. Kreiraj prvu grupu (razred).</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {grupe.map((g, i) => (
                      <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <div className="bg-white border-2 border-secondary/20 rounded-2xl p-5 hover:border-secondary hover:shadow-md transition-all group relative">
                          <button onClick={(e) => { e.stopPropagation(); deleteGrupa(g.id); }}
                            className="absolute top-3 right-3 text-red-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Obriši grupu">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <Link href={`/muallim/grupa/${g.id}`}>
                            <div className="cursor-pointer">
                              <GraduationCap className="w-8 h-8 text-secondary mb-3" />
                              <h3 className="font-extrabold text-foreground text-lg">{g.naziv}</h3>
                              <p className="text-sm text-muted-foreground mt-1">{g.skolskaGodina} · {ucenici.filter(u => u.grupaId === g.id).length} učenika</p>
                              <div className="flex items-center gap-1 text-secondary font-bold text-sm mt-3">
                                Otvori <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </div>
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* PRISUSTVO */}
            {activeTab === "prisustvo" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-foreground mb-2">Evidencija prisustva</p>
                <p className="text-sm">Odaberi grupu da uneseš prisustvo za danas</p>
                <div className="flex flex-wrap gap-3 justify-center mt-6">
                  {grupe.map(g => (
                    <Link key={g.id} href={`/muallim/prisustvo/${g.id}`}>
                      <button className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-5 py-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all">
                        {g.naziv}
                      </button>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {/* PLAN LEKCIJA */}
            {activeTab === "plan" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {!planGrupaId ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-bold text-foreground mb-2">Odaberi grupu za plan lekcija</p>
                    <div className="flex flex-wrap gap-3 justify-center mt-6">
                      {grupe.map(g => (
                        <button key={g.id} onClick={() => setPlanGrupaId(g.id)}
                          className="bg-violet-50 text-violet-700 border border-violet-200 rounded-xl px-5 py-3 font-bold hover:bg-violet-600 hover:text-white transition-all">
                          {g.naziv}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : planLekcijeLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-violet-600" />
                        Plan lekcija: {grupe.find(g => g.id === planGrupaId)?.naziv}
                      </h3>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setShowPlanForm(!showPlanForm)}
                          className="flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800">
                          <Plus className="w-4 h-4" /> Dodaj lekciju
                        </button>
                        <button onClick={() => { setPlanGrupaId(null); setPlanLekcijaSep([]); }}
                          className="text-sm text-muted-foreground hover:text-foreground font-medium">← Promijeni grupu</button>
                      </div>
                    </div>

                    {showPlanForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-muted-foreground block mb-1">Datum</label>
                            <input type="date" value={planDatum} onChange={e => setPlanDatum(e.target.value)}
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-muted-foreground block mb-1">Vrsta časa</label>
                            <select value={planVrstaCasa} onChange={e => setPlanVrstaCasa(e.target.value)}
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                              <option value="obrada">Obrada</option>
                              <option value="ponavljanje">Ponavljanje</option>
                              <option value="test">Test</option>
                              <option value="prakticno">Praktično</option>
                              <option value="ilmihal">Ilmihal</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground block mb-1">Lekcija</label>
                          <select value={planLekcijaNaslov} onChange={e => setPlanLekcijaNaslov(e.target.value)}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="">— Odaberi lekciju —</option>
                            {[1, 2, 3, 4].map(nivo => {
                              const nivoLekcije = dostupneLekcije.filter(l => l.nivo === nivo);
                              if (nivoLekcije.length === 0) return null;
                              return (
                                <optgroup key={nivo} label={`Nivo ${nivo}`}>
                                  {nivoLekcije.map(l => (
                                    <option key={l.id} value={l.naslov}>{l.naslov}</option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        </div>
                        {!planLekcijaNaslov && (
                          <input type="text" placeholder="Ili upišite naziv lekcije ručno" value={planLekcijaNaslov}
                            onChange={e => setPlanLekcijaNaslov(e.target.value)}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                        )}
                        <div className="flex gap-2">
                          <Button onClick={savePlanLekcija} disabled={savingPlanLekcija || !planLekcijaNaslov.trim()}
                            className="rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-700">
                            {savingPlanLekcija ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sačuvaj"}
                          </Button>
                          <button onClick={() => setShowPlanForm(false)} className="text-sm text-muted-foreground hover:text-foreground font-medium px-3">Otkaži</button>
                        </div>
                      </motion.div>
                    )}

                    {(() => {
                      const groupedByDate = planLekcijaSep.reduce<Record<string, PlanLekcija[]>>((acc, p) => {
                        if (!acc[p.datum]) acc[p.datum] = [];
                        acc[p.datum].push(p);
                        return acc;
                      }, {});
                      const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

                      if (sortedDates.length === 0) {
                        return (
                          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                            <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">Nema dodanih lekcija u planu</p>
                          </div>
                        );
                      }

                      const VRSTA_COLORS: Record<string, string> = {
                        obrada: "bg-blue-100 text-blue-700",
                        ponavljanje: "bg-amber-100 text-amber-700",
                        test: "bg-red-100 text-red-700",
                        prakticno: "bg-emerald-100 text-emerald-700",
                        ilmihal: "bg-violet-100 text-violet-700",
                      };

                      return (
                        <div className="space-y-4">
                          {sortedDates.map(datum => (
                            <div key={datum} className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                              <div className="bg-muted/30 px-4 py-2.5 border-b border-border/30 flex items-center justify-between">
                                <span className="font-extrabold text-sm text-foreground flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-violet-500" /> {datum}
                                </span>
                                <span className="text-xs text-muted-foreground">{groupedByDate[datum].length} lekcija</span>
                              </div>
                              <div className="divide-y divide-border/30">
                                {groupedByDate[datum].map(l => (
                                  <div key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${VRSTA_COLORS[l.lekcijaTip] || "bg-gray-100 text-gray-700"}`}>
                                        {l.lekcijaTip === "obrada" ? "Obrada" : l.lekcijaTip === "ponavljanje" ? "Ponavljanje" : l.lekcijaTip === "test" ? "Test" : l.lekcijaTip === "prakticno" ? "Praktično" : l.lekcijaTip}
                                      </span>
                                      <span className="font-medium text-foreground">{l.lekcijaNaslov}</span>
                                    </div>
                                    <button onClick={() => deletePlanLekcija(l.id)} className="text-red-400 hover:text-red-600 p-1">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </motion.div>
            )}

            {/* STATISTIKA */}
            {activeTab === "statistika" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {!statGrupaId ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-bold text-foreground mb-2">Odaberi grupu za statistiku i izvještaje</p>
                    <div className="flex flex-wrap gap-3 justify-center mt-6">
                      {grupe.map(g => (
                        <button key={g.id} onClick={() => setStatGrupaId(g.id)}
                          className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-5 py-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all">
                          {g.naziv}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : statLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : statData ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        {grupe.find(g => g.id === statGrupaId)?.naziv} — Izvještaji
                      </h3>
                      <div className="flex items-center gap-3">
                        <Button onClick={() => exportExcel(statGrupaId!)} disabled={exportingExcel}
                          className="rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                          {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileSpreadsheet className="w-4 h-4" /> Excel izvještaj</>}
                        </Button>
                        <button onClick={() => { setStatGrupaId(null); setStatData(null); }}
                          className="text-sm text-muted-foreground hover:text-foreground font-medium">← Promijeni grupu</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-primary/5 border border-border/50 rounded-2xl p-5">
                        <Users className="w-5 h-5 text-primary mb-2" />
                        <div className="text-2xl font-extrabold text-primary">{statData.ucenici.length}</div>
                        <div className="text-sm text-muted-foreground font-medium">Učenika</div>
                      </div>
                      <div className="bg-emerald-50 border border-border/50 rounded-2xl p-5">
                        <CalendarCheck className="w-5 h-5 text-emerald-600 mb-2" />
                        <div className="text-2xl font-extrabold text-emerald-600">{statData.ukupnoCasova}</div>
                        <div className="text-sm text-muted-foreground font-medium">Održanih časova</div>
                      </div>
                      <div className={`border border-border/50 rounded-2xl p-5 ${statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 80 ? "bg-emerald-50" : statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                        <Target className="w-5 h-5 mb-2 text-foreground/60" />
                        <div className={`text-2xl font-extrabold ${statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 80 ? "text-emerald-600" : statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {statData.grupaPrisustvoPct !== null ? `${statData.grupaPrisustvoPct}%` : "—"}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium">Prisustvo grupe</div>
                      </div>
                      <div className="bg-violet-50 border border-border/50 rounded-2xl p-5">
                        <Star className="w-5 h-5 text-violet-600 mb-2" />
                        <div className="text-2xl font-extrabold text-violet-600">{statData.grupaProsjekOcjena || "—"}</div>
                        <div className="text-sm text-muted-foreground font-medium">Prosj. ocjena grupe</div>
                      </div>
                    </div>

                    <div className="flex gap-2 bg-muted/30 rounded-xl p-1">
                      {([
                        { id: "pregled" as const, label: "Zbirni pregled", icon: BarChart3 },
                        { id: "prisustvo" as const, label: "Prisustvo po datumima", icon: CalendarCheck },
                        { id: "mjesecno" as const, label: "Mjesečni pregled", icon: Calendar },
                      ]).map(v => (
                        <button key={v.id} onClick={() => setStatView(v.id)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${statView === v.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                          <v.icon className="w-4 h-4" /> {v.label}
                        </button>
                      ))}
                    </div>

                    {statView === "pregled" && (
                      <>
                        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
                            <h4 className="font-extrabold text-foreground flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" /> Pregled učenika
                            </h4>
                            <span className="text-xs text-muted-foreground">{statData.ucenici.length} učenika</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  {["Učenik", "Prisustvo", "P", "O", "Z", "OP", "Prosj. ocjena", "Kvizovi", "Bodovi"].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {statData.ucenici.map((u, i) => (
                                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                    className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                                    onClick={() => window.location.href = `${import.meta.env.BASE_URL}muallim/ucenik/${u.id}`}>
                                    <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        {u.ime}
                                        {u.prisustvoPct !== null && u.prisustvoPct < 50 && (
                                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">!</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3">
                                      {u.prisustvoPct !== null ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${u.prisustvoPct >= 80 ? "bg-emerald-500" : u.prisustvoPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                              style={{ width: `${u.prisustvoPct}%` }} />
                                          </div>
                                          <span className={`text-sm font-bold ${u.prisustvoPct >= 80 ? "text-emerald-600" : u.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                            {u.prisustvoPct}%
                                          </span>
                                        </div>
                                      ) : <span className="text-sm text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-sm font-medium text-emerald-600">{u.prisutanCount}</td>
                                    <td className="px-3 py-3 text-sm font-medium text-red-600">{u.odsutanCount}</td>
                                    <td className="px-3 py-3 text-sm font-medium text-amber-600">{u.zakasnioCount}</td>
                                    <td className="px-3 py-3 text-sm font-medium text-blue-600">{u.opravdanCount}</td>
                                    <td className="px-3 py-3">
                                      {u.ukupnaProsjecna !== null ? (
                                        <span className={`text-base font-extrabold ${u.ukupnaProsjecna >= 4 ? "text-emerald-600" : u.ukupnaProsjecna >= 2.5 ? "text-amber-600" : "text-red-600"}`}>
                                          {u.ukupnaProsjecna} <span className="text-xs text-muted-foreground font-medium">({u.brojOcjena})</span>
                                        </span>
                                      ) : <span className="text-sm text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-3">
                                      {u.kvizCount > 0 ? (
                                        <span className="text-sm font-bold text-foreground">{u.kvizCount}
                                          {u.kvizProsjecniProcenat !== null && <span className="text-xs text-muted-foreground ml-1">({u.kvizProsjecniProcenat}%)</span>}
                                        </span>
                                      ) : <span className="text-sm text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-3">
                                      <span className="text-sm font-extrabold text-amber-600">{u.ukupnoBodova || 0}</span>
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {statData.ucenici.some(u => u.prisustvoPct !== null && u.prisustvoPct < 50) && (
                          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                            <h4 className="font-extrabold text-red-800 mb-2 flex items-center gap-2">
                              <CalendarCheck className="w-4 h-4" /> Upozorenje — slabo prisustvo
                            </h4>
                            <div className="space-y-1">
                              {statData.ucenici.filter(u => u.prisustvoPct !== null && u.prisustvoPct < 50).map(u => (
                                <p key={u.id} className="text-sm text-red-700">
                                  <span className="font-bold">{u.ime}</span> — prisustvo {u.prisustvoPct}% ({u.prisutanCount}/{u.ukupnoPrisustvo} časova)
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {statView === "prisustvo" && (
                      <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                          <h4 className="font-extrabold text-foreground flex items-center gap-2">
                            <CalendarCheck className="w-4 h-4 text-primary" /> Matrica prisustva — svi datumi
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">P = Prisutan, O = Odsutan, Z = Zakasnio, OP = Opravdan</p>
                        </div>
                        {statData.svaDatumi.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground">Nema evidentiranog prisustva</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-extrabold uppercase text-muted-foreground sticky left-0 bg-muted/20 z-10 min-w-[140px]">Učenik</th>
                                  {statData.svaDatumi.map(d => {
                                    const parts = d.split("-");
                                    return <th key={d} className="px-1.5 py-2 text-center text-xs font-bold text-muted-foreground whitespace-nowrap min-w-[44px]">{parts[2]}.{parts[1]}</th>;
                                  })}
                                  <th className="px-3 py-2 text-center text-xs font-extrabold uppercase text-muted-foreground">%</th>
                                </tr>
                              </thead>
                              <tbody>
                                {statData.ucenici.map((u, i) => (
                                  <tr key={u.id} className={`border-b border-border/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                                    <td className="px-3 py-2 font-bold text-foreground sticky left-0 bg-white z-10 whitespace-nowrap">{u.ime}</td>
                                    {statData.svaDatumi.map(d => {
                                      const st = u.prisustvoPoDatumu[d];
                                      const cls = st === "prisutan" ? "bg-emerald-500 text-white" : st === "odsutan" ? "bg-red-500 text-white" : st === "zakasnio" ? "bg-amber-400 text-white" : st === "opravdan" ? "bg-blue-400 text-white" : "bg-gray-100 text-gray-400";
                                      const label = st === "prisutan" ? "P" : st === "odsutan" ? "O" : st === "zakasnio" ? "Z" : st === "opravdan" ? "OP" : "·";
                                      return <td key={d} className="px-0.5 py-1.5 text-center"><span className={`inline-block w-7 h-7 leading-7 rounded-md text-xs font-bold ${cls}`}>{label}</span></td>;
                                    })}
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-extrabold ${u.prisustvoPct !== null && u.prisustvoPct >= 80 ? "text-emerald-600" : u.prisustvoPct !== null && u.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                        {u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="border-t-2 border-border/50 bg-muted/20">
                                <tr>
                                  <td className="px-3 py-2 font-extrabold text-foreground sticky left-0 bg-muted/20 z-10">UKUPNO</td>
                                  {statData.prisustvoPoDatumu.map(d => (
                                    <td key={d.datum} className="px-0.5 py-2 text-center">
                                      <span className={`text-xs font-bold ${d.pct !== null && d.pct >= 80 ? "text-emerald-600" : d.pct !== null && d.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                        {d.prisutan}/{d.ukupno}
                                      </span>
                                    </td>
                                  ))}
                                  <td className="px-3 py-2 text-center">
                                    <span className={`font-extrabold ${statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                                      {statData.grupaPrisustvoPct !== null ? `${statData.grupaPrisustvoPct}%` : "—"}
                                    </span>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {statView === "mjesecno" && (
                      <>
                        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                            <h4 className="font-extrabold text-foreground flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" /> Prisustvo po mjesecima — grupa
                            </h4>
                          </div>
                          {statData.mjesecniPregled.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">Nema podataka</div>
                          ) : (
                            <div className="p-4 space-y-3">
                              {statData.mjesecniPregled.map(m => {
                                const parts = m.mjesec.split("-");
                                const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
                                return (
                                  <div key={m.mjesec} className="flex items-center gap-4">
                                    <span className="w-24 text-sm font-bold text-foreground">{naziv}</span>
                                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                                      {m.pct !== null && (
                                        <div className={`h-full rounded-full transition-all ${m.pct >= 80 ? "bg-emerald-500" : m.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                          style={{ width: `${m.pct}%` }} />
                                      )}
                                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground/70">
                                        {m.prisutan}P / {m.odsutan}O / {m.zakasnio}Z / {m.opravdan}OP
                                      </span>
                                    </div>
                                    <span className={`w-12 text-right font-extrabold text-sm ${m.pct !== null && m.pct >= 80 ? "text-emerald-600" : m.pct !== null && m.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                      {m.pct !== null ? `${m.pct}%` : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                            <h4 className="font-extrabold text-foreground flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" /> Prisustvo po mjesecima — učenici
                            </h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-extrabold uppercase text-muted-foreground min-w-[140px]">Učenik</th>
                                  {statData.mjesecniPregled.map(m => {
                                    const parts = m.mjesec.split("-");
                                    return <th key={m.mjesec} className="px-3 py-2 text-center text-xs font-bold text-muted-foreground">{MJESEC_NAZIVI[parts[1]]} {parts[0].slice(2)}</th>;
                                  })}
                                  <th className="px-3 py-2 text-center text-xs font-extrabold uppercase text-muted-foreground">Ukupno</th>
                                </tr>
                              </thead>
                              <tbody>
                                {statData.ucenici.map((u, i) => (
                                  <tr key={u.id} className={`border-b border-border/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                                    <td className="px-3 py-2 font-bold text-foreground whitespace-nowrap">{u.ime}</td>
                                    {u.mjesecnoStats.map(m => (
                                      <td key={m.mjesec} className="px-3 py-2 text-center">
                                        {m.ukupno > 0 ? (
                                          <span className={`font-bold ${m.pct !== null && m.pct >= 80 ? "text-emerald-600" : m.pct !== null && m.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                            {m.pct}%
                                            <span className="text-xs text-muted-foreground ml-1">({m.prisutan}/{m.ukupno})</span>
                                          </span>
                                        ) : <span className="text-muted-foreground">—</span>}
                                      </td>
                                    ))}
                                    <td className="px-3 py-2 text-center">
                                      <span className={`font-extrabold ${u.prisustvoPct !== null && u.prisustvoPct >= 80 ? "text-emerald-600" : u.prisustvoPct !== null && u.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                        {u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </motion.div>
            )}

            {/* ZADAĆE */}
            {activeTab === "zadace" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {!zadGrupaId ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-bold text-foreground mb-2">Odaberi grupu za zadaće</p>
                    <div className="flex flex-wrap gap-3 justify-center mt-6">
                      {grupe.map(g => (
                        <button key={g.id} onClick={() => setZadGrupaId(g.id)}
                          className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-5 py-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all">
                          {g.naziv}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : zadLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-primary" />
                        Zadaće: {grupe.find(g => g.id === zadGrupaId)?.naziv}
                      </h3>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setZadGrupaId(null); setZadace([]); }}
                          className="text-sm text-muted-foreground hover:text-foreground font-medium">← Promijeni grupu</button>
                        <Button onClick={() => setShowZadForm(true)} className="rounded-xl font-bold flex items-center gap-2">
                          <Plus className="w-4 h-4" /> Nova zadaća
                        </Button>
                      </div>
                    </div>

                    {showZadForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="bg-white border border-border/50 rounded-2xl p-5">
                        <h4 className="font-extrabold text-foreground mb-4 flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary" /> Nova zadaća
                        </h4>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="text-sm font-bold text-muted-foreground block mb-1">Naslov *</label>
                            <input type="text" value={zadNaslov} onChange={e => setZadNaslov(e.target.value)}
                              placeholder="npr. Nauči suru El-Fatiha"
                              className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-sm font-bold text-muted-foreground block mb-1">Opis (opcionalno)</label>
                            <textarea value={zadOpis} onChange={e => setZadOpis(e.target.value)} rows={2}
                              placeholder="Detalji zadaće..."
                              className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                          </div>
                          <div>
                            <label className="text-sm font-bold text-muted-foreground block mb-1">Rok do</label>
                            <input type="date" value={zadRok} onChange={e => setZadRok(e.target.value)}
                              className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          </div>
                          <div>
                            <label className="text-sm font-bold text-muted-foreground block mb-1">Povezana lekcija</label>
                            <select value={zadLekcija} onChange={e => setZadLekcija(e.target.value)}
                              className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                              <option value="">— Bez lekcije —</option>
                              {dostupneLekcije.map(l => (
                                <option key={l.id} value={l.naslov}>N{l.nivo} · {l.naslov}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-4 justify-end">
                          <button onClick={() => setShowZadForm(false)} className="text-muted-foreground hover:text-foreground text-sm font-medium px-4 py-2">
                            Otkaži
                          </button>
                          <Button onClick={saveZadaca} disabled={savingZadaca || !zadNaslov.trim()} className="rounded-xl font-bold">
                            {savingZadaca ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Sačuvaj</>}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {zadace.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground bg-white rounded-2xl border border-border/50">
                        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nema zadaća za ovu grupu. Kreiraj prvu zadaću.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {zadace.map((z, i) => {
                          const isExpired = z.rokDo && new Date(z.rokDo) < new Date();
                          return (
                            <motion.div key={z.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                              className={`bg-white border rounded-2xl p-5 ${isExpired ? "border-red-200 bg-red-50/30" : "border-border/50"}`}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-extrabold text-foreground text-base">{z.naslov}</h4>
                                    {isExpired && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Isteklo</span>}
                                  </div>
                                  {z.opis && <p className="text-sm text-muted-foreground mt-1">{z.opis}</p>}
                                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                                    {z.rokDo && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> Rok: {new Date(z.rokDo).toLocaleDateString("bs-BA")}
                                      </span>
                                    )}
                                    {z.lekcijaNaslov && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <BookOpen className="w-3 h-3" /> {z.lekcijaNaslov}
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      Kreirano: {new Date(z.createdAt).toLocaleDateString("bs-BA")}
                                    </span>
                                  </div>
                                </div>
                                <button onClick={() => deleteZadaca(z.id)}
                                  className="text-red-400 hover:text-red-600 p-2 shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* KALENDAR */}
            {activeTab === "kalendar" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {!selectedGrupaId ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-bold text-foreground mb-2">Odaberi grupu za kalendar</p>
                    <div className="flex flex-wrap gap-3 justify-center mt-6">
                      {grupe.map(g => (
                        <button key={g.id} onClick={() => setSelectedGrupaId(g.id)}
                          className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-5 py-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all">
                          {g.naziv}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : kalendarLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : (
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

                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                          <span className="text-sm font-bold text-muted-foreground mr-1">Označi dan kao:</span>
                          {Object.entries(TIP_COLORS).map(([key, val]) => (
                            <button key={key} onClick={() => setActiveTip(key as any)}
                              className={`text-sm font-bold px-3 py-1.5 rounded-lg border-2 transition-all ${activeTip === key ? `${val.bg} ${val.border} ${val.text}` : "border-border/50 text-muted-foreground hover:bg-muted"}`}>
                              {val.label}
                            </button>
                          ))}
                          <button onClick={() => { setBatchMode(!batchMode); setBatchDatumi([]); }}
                            className={`text-sm font-bold px-3 py-1.5 rounded-lg border-2 transition-all ${batchMode ? "bg-violet-100 border-violet-400 text-violet-700" : "border-border/50 text-muted-foreground hover:bg-muted"}`}>
                            {batchMode ? "✓ Grupno označavanje" : "Grupno označavanje"}
                          </button>
                          <button onClick={() => { setSelectedGrupaId(null); setBatchMode(false); setBatchDatumi([]); }} className="ml-auto text-sm text-muted-foreground hover:text-foreground font-medium">
                            ← Promijeni grupu
                          </button>
                        </div>

                        {batchMode && (
                          <div className="flex items-center gap-3 mb-4 bg-violet-50 border border-violet-200 rounded-xl p-3">
                            <span className="text-sm font-bold text-violet-700">Klikni na dane koje želiš označiti</span>
                            <span className="text-sm text-violet-600 font-bold">{batchDatumi.length} odabrano</span>
                            <div className="ml-auto flex gap-2">
                              <Button onClick={saveBatchKalendar} disabled={batchDatumi.length === 0 || batchSaving}
                                className="rounded-xl font-bold text-sm px-4 py-1.5 h-auto flex items-center gap-1.5">
                                {batchSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Sačuvaj ({batchDatumi.length})
                              </Button>
                              <button onClick={() => setBatchDatumi([])} className="text-sm text-violet-600 hover:text-violet-800 font-medium px-2">
                                Poništi
                              </button>
                            </div>
                          </div>
                        )}

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

                            const isBatchSelected = batchDatumi.includes(dateStr);

                            return (
                              <button key={dateStr}
                                onClick={() => {
                                  if (batchMode) {
                                    toggleBatchDate(dateStr);
                                  } else {
                                    setSelectedDate(dateStr);
                                    setOpisInput(entry?.opis || "");
                                  }
                                }}
                                onDoubleClick={() => { if (!batchMode) saveKalendarEntry(dateStr, activeTip, ""); }}
                                className={`relative aspect-square rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5
                                  ${isBatchSelected ? "ring-2 ring-violet-500 ring-offset-1 bg-violet-100" : ""}
                                  ${!isBatchSelected && isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                                  ${!isBatchSelected && tipStyle ? `${tipStyle.bg} ${tipStyle.text} border ${tipStyle.border}` : !isBatchSelected ? "hover:bg-muted/50 border border-transparent" : ""}`}>
                                {day}
                                {entry?.tip === "vazan_datum" && entry?.opis && (
                                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-bold text-blue-700 truncate max-w-full px-0.5 leading-tight">{entry.opis.substring(0, 8)}</div>
                                )}
                                {hasLekcije && !entry?.opis && <div className="w-1.5 h-1.5 bg-violet-500 rounded-full absolute bottom-1" />}
                                {isBatchSelected && <div className="w-2 h-2 bg-violet-500 rounded-full absolute top-1 right-1" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> Mekteb</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 border border-red-400" /> Ferije</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Važan datum</span>
                          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Ima lekcije</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedDate && (
                        <>
                          <div className="bg-white border border-border/50 rounded-2xl p-5">
                            <h4 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" />
                              {selectedDate}
                            </h4>
                            {(() => {
                              const entry = kalendar.find(k => k.datum === selectedDate);
                              return (
                                <div className="space-y-3">
                                  <div className="flex gap-2 flex-wrap">
                                    {Object.entries(TIP_COLORS).map(([key, val]) => (
                                      <button key={key} onClick={() => {
                                        if (key === "vazan_datum" && !opisInput.trim()) {
                                          const naziv = prompt("Unesite naziv važnog datuma:");
                                          if (naziv) {
                                            setOpisInput(naziv);
                                            saveKalendarEntry(selectedDate, key, naziv);
                                          }
                                        } else {
                                          saveKalendarEntry(selectedDate, key, opisInput);
                                        }
                                      }}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${entry?.tip === key ? `${val.bg} ${val.border} ${val.text}` : "border-border/50 text-muted-foreground hover:bg-muted"}`}>
                                        {val.label}
                                      </button>
                                    ))}
                                    {entry && (
                                      <button onClick={() => deleteKalendarEntry(entry.id)} className="text-red-500 hover:text-red-700 p-1.5 ml-auto">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  {entry?.tip === "vazan_datum" && entry?.opis && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-800">
                                      {entry.opis}
                                    </div>
                                  )}
                                  <input type="text" placeholder={entry?.tip === "vazan_datum" ? "Naziv važnog datuma" : "Opis (opcionalno)"} value={opisInput}
                                    onChange={e => setOpisInput(e.target.value)}
                                    onBlur={() => { if (entry) saveKalendarEntry(selectedDate, entry.tip, opisInput); }}
                                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                                </div>
                              );
                            })()}
                          </div>

                          <div className="bg-white border border-border/50 rounded-2xl p-5">
                            <h4 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-violet-500" /> Plan lekcija
                            </h4>
                            {planLekcija.filter(p => p.datum === selectedDate).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-3">Nema dodanih lekcija za ovaj dan</p>
                            ) : (
                              <div className="space-y-2 mb-3">
                                {planLekcija.filter(p => p.datum === selectedDate).map(l => (
                                  <div key={l.id} className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2">
                                    <span className="text-sm font-medium text-foreground">{l.lekcijaNaslov}</span>
                                    <button onClick={() => deleteLekcija(l.id)} className="text-red-400 hover:text-red-600">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {showLekcijaSelect ? (
                              <div className="space-y-2">
                                <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
                                  {[1, 2, 3, 4].map(nivo => {
                                    const nivoLekcije = dostupneLekcije.filter(l => l.nivo === nivo);
                                    if (nivoLekcije.length === 0) return null;
                                    return (
                                      <div key={nivo}>
                                        <div className="sticky top-0 bg-muted/80 px-3 py-1.5 text-xs font-extrabold text-muted-foreground border-b border-border/30 backdrop-blur-sm">
                                          Nivo {nivo}
                                        </div>
                                        {nivoLekcije.map(l => (
                                          <button key={l.id} onClick={() => addLekcija(selectedDate!, l.naslov, "ilmihal")}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 border-b border-border/30 last:border-0">
                                            <span className="text-xs text-muted-foreground mr-2">N{l.nivo}</span>
                                            {l.naslov}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                                <button onClick={() => setShowLekcijaSelect(false)} className="text-sm text-muted-foreground hover:text-foreground font-medium">
                                  Zatvori
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setShowLekcijaSelect(true)}
                                className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80">
                                <Plus className="w-4 h-4" /> Dodaj lekciju
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      {!selectedDate && (
                        <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                          <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">Klikni na dan u kalendaru za detalje</p>
                          <p className="text-xs text-muted-foreground mt-1">Dupli klik označava dan aktivnim tipom</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
