import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { goBackOr } from "@/lib/back-navigation";
import { apiRequest, getApiBase, openAuthorizedFile } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  User, Users, GraduationCap, CalendarCheck, BookMarked, ChevronRight, Plus,
  BarChart3, Clock, Loader2, Calendar, ChevronLeft, Trash2, BookOpen,
  Settings, Save, X, UserCheck, UserX, UserPlus, TrendingUp, ClipboardList,
  Award, Target, CheckCircle2, Download, Eye, FileSpreadsheet, Star, FileText, Printer, Sparkles,
  Heart, School, Copy, KeyRound, Upload, Pencil, Archive, ChevronDown, Search, RotateCcw, Bell, MessageSquare
} from "lucide-react";
import RoditeljiTab from "./roditelji-tab";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LekcijaPicker } from "@/components/LekcijaPicker";
import { useLanguage } from "@/context/language";
import { PushToggle } from "@/components/push-toggle";
import { SelamSetting } from "@/components/selam-setting";
import { MuallimGroupSidebar, type GroupModuleKey } from "@/components/muallim-group-sidebar";

interface Stats {
  ukupnoUcenika: number;
  ukupnoGrupa: number;
  danasnjePrisustvo?: number;
}

function formatScreentimeShort(sec: number | null | undefined): string {
  const s = sec ?? 0;
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MyScreentimeBadge() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [data, setData] = useState<{ totalScreentimeSec: number } | null>(null);
  useEffect(() => {
    if (!token) return;
    apiRequest<{ totalScreentimeSec: number; lastSeenAt: string | null }>("GET", "/aktivnost/me", undefined, token)
      .then(setData).catch(() => {});
  }, [token]);
  return (
    <div className="hidden sm:flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5" title={t("Vaše ukupno vrijeme provedeno u Mektebu")} data-testid="badge-moje-vrijeme">
      <Clock className="w-4 h-4 text-teal-700" />
      <div className="text-xs">
        <div className="text-[9px] font-bold text-teal-700/70 uppercase leading-none">{t("Moje vrijeme")}</div>
        <div className="font-extrabold text-teal-800 leading-tight">{formatScreentimeShort(data?.totalScreentimeSec)}</div>
      </div>
    </div>
  );
}

interface DashboardStats {
  ukupnoUcenika: number;
  aktivnihUcenika: number;
  ukupnoGrupa: number;
  skolskaGodina: string | null;
  dostupneGodine?: string[];
  prosjekPrisustva: number | null;
  prosjekOcjena: number | null;
  ukupnoLekcijaZavrseno: number;
  prosjekLekcijaPoUceniku: number;
  ukupnoKvizovaUradeno: number;
  prosjekKvizovaPoUceniku: number;
  ukupnoBodova: number;
  danasnjePrisustvoPct: number | null;
  danasnjeEvidentirano: number;
}

// Školska godina počinje 15. avgusta.
// Aug 14, 2026 → 2025/26; Aug 15, 2026 → 2026/27.
function computeCurrentSchoolYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1–12
  const d = now.getDate();
  const newYearStarted = m >= 8; // od 1. avgusta prikazujemo novu školsku godinu
  const startYear = newYearStarted ? y : y - 1;
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

function formatSchoolYearOptionLabel(value: string): string {
  const cleaned = value.replace(/^Mektebska\s+/i, "").trim();
  const match = cleaned.match(/^(\d{4})\/(\d{2}|\d{4})$/);
  if (!match) return cleaned;
  return `${match[1].slice(-2)}/${match[2].slice(-2)}`;
}

interface MektebStats {
  perGrupa: Array<{
    id: number;
    naziv: string;
    skolskaGodina: string;
    ukupnoUcenika: number;
    ukupnoCasova: number;
    prisustvoPct: number | null;
    prosjekOcjena: number | null;
    ukupnoKvizova: number;
    ukupnoBodova: number;
    prosjekBodova: number;
    aktivnihProslejSedmice: number;
    zvjezdicePozitivne?: number;
    zvjezdiceNegativne?: number;
  }>;
  global: {
    ukupnoGrupa: number;
    ukupnoUcenika: number;
    ukupnoCasova: number;
    prosjekPrisustva: number | null;
    prosjekOcjena: number | null;
    ukupnoKvizova: number;
    ukupnoBodova: number;
    ukupnoLekcijaZavrseno: number;
    prosjekLekcijaPoUceniku: number;
    prosjekKvizovaPoUceniku: number;
    zvjezdicePozitivne?: number;
    zvjezdiceNegativne?: number;
  };
}

interface KalendarSveData {
  kalendar: Array<KalendarEntry & { grupaNaziv: string | null }>;
  planLekcija: Array<PlanLekcija & { grupaNaziv: string | null }>;
}

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  grupaId?: number;
  grupaIme?: string;
  aktivanStatus: boolean;
  roditeljPovezan?: boolean;
  muallimId?: number | null;
  muallimDisplayName?: string | null;
}

interface Grupa {
  id: number;
  muallimId?: number;
  naziv: string;
  skolskaGodina: string;
  daniNastave: string[];
  vrijemeNastave: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  muallimDisplayName?: string | null;
  sekundarniMuallimi?: { id: number; displayName: string }[];
}

// Paleta boja za kartice — svaki muallim dobija svoju boju determinisztički po ID-u.
const MUALLIM_PALETA = [
  { border: "border-teal-400/60 hover:border-teal-500",   icon: "text-teal-600",   link: "text-teal-600"   },
  { border: "border-blue-300   hover:border-blue-500",     icon: "text-blue-500",   link: "text-blue-500"   },
  { border: "border-violet-300 hover:border-violet-500",   icon: "text-violet-500", link: "text-violet-500" },
  { border: "border-emerald-300 hover:border-emerald-500", icon: "text-emerald-600",link: "text-emerald-600"},
  { border: "border-amber-300  hover:border-amber-500",    icon: "text-amber-600",  link: "text-amber-600"  },
  { border: "border-rose-300   hover:border-rose-500",     icon: "text-rose-500",   link: "text-rose-500"   },
  { border: "border-cyan-300   hover:border-cyan-500",     icon: "text-cyan-600",   link: "text-cyan-600"   },
  { border: "border-orange-300 hover:border-orange-500",   icon: "text-orange-500", link: "text-orange-500" },
] as const;

interface KalendarEntry {
  id: number;
  grupaId: number;
  datum: string;
  tip: "mekteb" | "ferije" | "vazan_datum" | "ramazan";
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
  slug?: string;
  dostupnost?: "svi" | "muallimi";
}

interface NastavniMaterijal {
  id: number;
  originalName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  kind: "file" | "url" | string;
  externalUrl?: string | null;
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
  zvjezdicePozitivne?: number;
  zvjezdiceNegativne?: number;
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
  zvjezdicePozitivne?: number;
  zvjezdiceNegativne?: number;
}

interface Zadaca {
  id: number;
  grupaId: number;
  naslov: string;
  opis?: string;
  rokDo?: string;
  lekcijaNaslov?: string;
  lekcijaSlug?: string | null;
  lekcijaTip?: string;
  isActive: boolean;
  createdAt: string;
  ucenikIds?: number[];
  zavrsenih?: number;
  ukupno?: number;
  completed?: boolean;
  lekcijaZavrsenih?: number;
  lekcijaUkupno?: number | null;
  prilozi?: NastavniMaterijal[];
}

interface ZadacaStatusRed {
  ucenikId: number;
  displayName: string;
  username: string;
  uradjeno: boolean;
  ocjena: number | null;
  kapiMeda: number;
  noviRok: string | null;
  prolongCount: number;
  status: string;
  lekcijaZavrsena: boolean;
  lekcijaZavrsenaAt: string | null;
}

const KAPI_MEDA_OPCIJE = [0, 10, 20, 30];

const TIP_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  mekteb: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", label: "Mekteb" },
  ferije: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", label: "Ferije" },
  vazan_datum: { bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700", label: "Važan datum" },
  ramazan: { bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700", label: "Ramazan" },
};

const DAYS_BS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

interface MektebInfo {
  hasMekteb: boolean;
  isGlavni: boolean;
  naziv: string | null;
  grad: string | null;
  dozvoljenoMuallima: number;
  brojMuallima: number;
  slobodnoMjesta: number;
}

interface MektebMuallim {
  userId: number;
  username: string | null;
  displayName: string;
  isActive: boolean;
  isGlavni: boolean;
  brojGrupa: number;
  brojUcenika: number;
}

interface MektebStatsAll {
  global: {
    ukupnoUcenika: number;
    brojMuallima: number;
    brojGrupa: number;
    prosjekPrisustva: number | null;
    prosjekOcjena?: number | null;
    ukupnoCasova?: number;
    ukupnoKvizova?: number;
    ukupnoBodova?: number;
    zvjezdicePozitivne?: number;
    zvjezdiceNegativne?: number;
    ukupnoLekcijaZavrseno: number;
    napredakPoNivoima: { nivo: number; zavrseno: number }[];
    ukupnoScreentimeSec: number;
  };
  muallimi?: {
    muallimId: number;
    displayName: string;
    isGlavni: boolean;
    brojGrupa: number;
    ukupnoUcenika: number;
    ukupnoCasova: number;
    prisustvoPct: number | null;
    prosjekOcjena: number | null;
    ukupnoKvizova: number;
    ukupnoBodova: number;
    zvjezdicePozitivne: number;
    zvjezdiceNegativne: number;
  }[];
  perGrupa: {
    id: number;
    naziv: string;
    muallimId?: number;
    muallimNaziv: string;
    skolskaGodina: string;
    ukupnoUcenika: number;
    ukupnoCasova: number;
    prisustvoPct: number | null;
    prosjekOcjena: number | null;
    ukupnoKvizova: number;
    ukupnoBodova: number;
    zvjezdicePozitivne?: number;
    zvjezdiceNegativne?: number;
  }[];
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

interface InteraktivniPregledGrupe {
  ukupnoPokusaja: number;
  prosjekTacnosti: number | null;
  pitanja: Array<{
    lekcijaNaslov: string;
    pitanjeTekst: string;
    brojPokusaja: number;
    netacniPokusaji: number;
    procenatTacnih: number;
    pomocBroj: number;
    tacnoNakonPonovnogCitanja: number;
    prosjekVrijemeSekundi: number;
  }>;
}

function formatScreentime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export default function MuallimPanel() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  type TabId = "pregled" | "ucenici" | "grupe" | "prisustvo" | "kalendar" | "plan" | "statistika" | "muallimi" | "mekteb" | "zadace" | "izvjestaji" | "roditelji" | "h5p" | "profil";
  const [activeTab, setActiveTab] = useState<TabId>("pregled");
  const [panelContext, setPanelContext] = useState<"moje" | "mekteb">("moje");
  const [selectedMuallimId, setSelectedMuallimId] = useState<number | null>(null);

  // Otvara odgovarajući tab kad URL sadrži ?tab=… (npr. iz Panel dropdown
  // linka "Profil" → /muallim?tab=profil). Pokreće se na svakoj promjeni
  // location-a da omogući in-app navigaciju iz header dropdown-a.
  const [locationPath] = useLocation();
  const locationSearch = useSearch();
  const groupContextId = useMemo(() => {
    const grupaId = Number(new URLSearchParams(locationSearch).get("grupaId"));
    return Number.isInteger(grupaId) && grupaId > 0 ? grupaId : null;
  }, [locationSearch]);
  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const t = params.get("tab");
    if (t && ["pregled","ucenici","grupe","prisustvo","kalendar","plan","statistika","muallimi","mekteb","zadace","izvjestaji","roditelji","h5p","profil"].includes(t)) {
      setActiveTab(t as TabId);
      if (t === "ucenici") setPanelContext("mekteb");
      else setPanelContext("moje");
    }
    const mid = params.get("muallimId");
    setSelectedMuallimId(mid && Number.isInteger(Number(mid)) && Number(mid) > 0 ? Number(mid) : null);
    if (mid) setPanelContext("mekteb");
    // Pre-selektuj grupu kad link iz Grupa stranice prosijedi ?grupaId=…
    // (npr. iz kartica "Plan lekcija", "Statistika", "Kalendar", "Zadaća").
    const gid = params.get("grupaId");
    if (gid) {
      const n = parseInt(gid);
      if (!Number.isNaN(n) && n > 0) {
        setSelectedGrupaId(n);
        setStatGrupaId(n);
        setPlanGrupaId(n);
        setZadGrupaId(n);
      }
    }
  }, [locationPath, locationSearch]);

  // Inicijalizuj polje za uređivanje imena kad korisnik otvori Profil tab —
  // bez ovoga editDisplayName ostaje prazan, pa klik na "Sačuvaj" prije bilo
  // kakvog unosa može obrisati postojeće displayName.
  useEffect(() => {
    if (activeTab === "profil" && user?.displayName) {
      setEditDisplayName(prev => prev || user.displayName);
    }
  }, [activeTab, user?.displayName]);
  const [ucenici, setUcenici] = useState<Ucenik[]>([]);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mekteb (škola) — glavni muallim kontekst i administracija
  const [mektebMeta, setMektebMeta] = useState<{ isGlavni: boolean; mektebNaziv: string | null }>({ isGlavni: false, mektebNaziv: null });
  // Dok /muallim/info ne stigne, ne znamo da li je korisnik glavni muallim, pa
  // ni koji scope statistika treba. Bez ovog flaga prvi fetch krene bez
  // muallimId-a i keširani rezultat ostane "cijeli mekteb" i u "Moje grupe".
  const [mektebMetaLoaded, setMektebMetaLoaded] = useState(false);
  const [mektebInfo, setMektebInfo] = useState<MektebInfo | null>(null);
  const [mektebMuallimi, setMektebMuallimi] = useState<MektebMuallim[] | null>(null);
  const [novMuallimIme, setNovMuallimIme] = useState("");
  const [kreiranMuallim, setKreiranMuallim] = useState<{ displayName: string; username: string; generatedPassword: string } | null>(null);
  const [muallimSaving, setMuallimSaving] = useState(false);
  const [editingMuallimId, setEditingMuallimId] = useState<number | null>(null);
  const [editMuallimName, setEditMuallimName] = useState("");
  const [editMuallimSaving, setEditMuallimSaving] = useState(false);
  const [editMuallimNewPass, setEditMuallimNewPass] = useState<string | null>(null);
  const [mektebStatsAll, setMektebStatsAll] = useState<MektebStatsAll | null>(null);
  const [mektebDokumenti, setMektebDokumenti] = useState<MektebDokument[] | null>(null);
  const [dokNaziv, setDokNaziv] = useState("");
  const [dokOpis, setDokOpis] = useState("");
  const [dokFile, setDokFile] = useState<File | null>(null);
  const [dokUploading, setDokUploading] = useState(false);

  const [selectedGrupaId, setSelectedGrupaId] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [kalendar, setKalendar] = useState<KalendarEntry[]>([]);
  const [planLekcija, setPlanLekcija] = useState<PlanLekcija[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [kalendarLoading, setKalendarLoading] = useState(false);
  const [activeTip, setActiveTip] = useState<"mekteb" | "ferije" | "vazan_datum" | "ramazan">("mekteb");
  const [opisInput, setOpisInput] = useState("");
  const [dostupneLekcije, setDostupneLekcije] = useState<IlmihalLekcija[]>([]);
  const [showLekcijaSelect, setShowLekcijaSelect] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchDatumi, setBatchDatumi] = useState<string[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  // Kopiranje kalendara iz druge grupe
  const [showCopyKalendar, setShowCopyKalendar] = useState(false);
  const [copyFromGrupaId, setCopyFromGrupaId] = useState<number | null>(null);
  const [copyOverride, setCopyOverride] = useState(false);
  const [copyingKalendar, setCopyingKalendar] = useState(false);
  // Kopiranje u grupe (za glavnog muallima)
  const [copyToMode, setCopyToMode] = useState<"from" | "to">("from");
  const [copyToGrupeIds, setCopyToGrupeIds] = useState<number[]>([]);
  const [copyingToGrupe, setCopyingToGrupe] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showBulkResetConfirm, setShowBulkResetConfirm] = useState(false);
  const [bulkResetting, setBulkResetting] = useState(false);
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passChanging, setPassChanging] = useState(false);
  // Modal za potvrdu brisanja grupe (korak 1: spasi izvještaj, korak 2: upiši naziv)
  const [deleteGrupaTarget, setDeleteGrupaTarget] = useState<Grupa | null>(null);
  const [deleteGrupaConfirm, setDeleteGrupaConfirm] = useState("");
  const [deletingGrupa, setDeletingGrupa] = useState(false);
  const [izvjestajSpasen, setIzvjestajSpasen] = useState(false);
  const [downloadingIzvjestaj, setDownloadingIzvjestaj] = useState(false);
  // Izvještaji tab — opseg (jedna grupa / sve moje grupe / cijeli mekteb)
  const [izvjestajOpseg, setIzvjestajOpseg] = useState<"grupa" | "moje" | "mekteb">("moje");
  const [izvjestajGrupaId, setIzvjestajGrupaId] = useState<number | null>(null);
  const [uceniciSearch, setUceniciSearch] = useState("");
  const [brzaPretraga, setBrzaPretraga] = useState("");
  const [uceniciMuallimFilter, setUceniciMuallimFilter] = useState<number | "sve">("sve");
  const [uceniciGrupaFilter, setUceniciGrupaFilter] = useState<number | "sve">("sve");
  const [uceniciStatusFilter, setUceniciStatusFilter] = useState<"aktivni" | "svi">("aktivni");
  // Lični mod uvijek šalje eksplicitan muallim scope. Tako svi pod-tabovi,
  // uključujući izvještaje, prikazuju samo njegove grupe; bez scope-a glavni
  // muallim legitimno dobija cijeli mekteb.
  const scopedMuallimId = selectedMuallimId ?? (
    panelContext === "moje" ? (user?.id ?? null) : null
  );
  const muallimScopeQuery = scopedMuallimId ? `?muallimId=${encodeURIComponent(String(scopedMuallimId))}` : "";

  const [pendingRoditelji, setPendingRoditelji] = useState<PendingRoditelj[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(() => computeCurrentSchoolYear());
  const [mektebStats, setMektebStats] = useState<MektebStats | null>(null);
  const [mektebStatsLoading, setMektebStatsLoading] = useState(false);
  const [kalendarSve, setKalendarSve] = useState<KalendarSveData | null>(null);
  const [kalendarSveLoading, setKalendarSveLoading] = useState(false);
  const [kalendarMode, setKalendarMode] = useState<"sve" | "grupa">("sve");

  const [statGrupaId, setStatGrupaId] = useState<number | null>(null);
  const [statUcenikId, setStatUcenikId] = useState<number | null>(null);
  // Drill-down u statistici: Mekteb → Muallim → Grupa → Učenik.
  // statMuallimId je postavljen samo kad glavni muallim s mektebskog nivoa
  // otvori pojedinog muallima; za vlastite grupe nivo muallima je korijen.
  const [statMuallimId, setStatMuallimId] = useState<number | null>(null);
  const [statData, setStatData] = useState<StatData | null>(null);
  const [interaktivniStatPregled, setInteraktivniStatPregled] = useState<InteraktivniPregledGrupe | null>(null);
  const [statLoading, setStatLoading] = useState(false);
  const [statView, setStatView] = useState<"pregled" | "prisustvo" | "mjesecno">("pregled");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingSpisak, setExportingSpisak] = useState(false);

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
  const [zadTipTab, setZadTipTab] = useState<"pojedinacno" | "svi">("svi");
  const [zadSubTab, setZadSubTab] = useState<"nova" | "utoku" | "zavrseno">("utoku");
  const [zadDodjela, setZadDodjela] = useState<"svi" | "pojedinacno">("svi");
  const [zadNaslov, setZadNaslov] = useState("");
  const [zadOpis, setZadOpis] = useState("");
  const [zadRok, setZadRok] = useState("");
  const [zadLekcija, setZadLekcija] = useState("");
  const [zadLekcijaSlug, setZadLekcijaSlug] = useState("");
  const [zadUcenikIds, setZadUcenikIds] = useState<Set<number>>(new Set());
  const [savingZadaca, setSavingZadaca] = useState(false);
  const [editingZadaca, setEditingZadaca] = useState<Zadaca | null>(null);
  // Pregled (review) panel za cijelu grupu
  const [pregledZadaca, setPregledZadaca] = useState<Zadaca | null>(null);
  const [pregledUcenici, setPregledUcenici] = useState<ZadacaStatusRed[]>([]);
  const [pregledLoading, setPregledLoading] = useState(false);
  const [savingRedId, setSavingRedId] = useState<number | null>(null);

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
      apiRequest<Ucenik[]>("GET", `/muallim/ucenici${muallimScopeQuery}`, undefined, token),
      apiRequest<Grupa[]>("GET", `/muallim/grupe${muallimScopeQuery}`, undefined, token),
      apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
    ]).then(([u, g, l]) => {
      setUcenici(u);
      setGrupe(g);
      setDostupneLekcije(l);
    }).catch(() => {}).finally(() => setIsLoading(false));
    if (!selectedMuallimId) {
      loadPendingRoditelji();
    } else {
      setPendingRoditelji([]);
    }
  }, [token, selectedMuallimId, panelContext, mektebMeta.isGlavni, user?.id]);

  // Odvojeni fetch za dashboard-stats — re-fetcha kad se promijeni odabrana godina.
  // Auto-fallback: ako odabrana godina nema grupe ali baza ima podatke za druge
  // godine, automatski prebaci na najnoviju godinu s podacima (jednom, bez petlje).
  useEffect(() => {
    if (!token) return;
    setDashboardStatsLoading(true);
    setDashboardStats(null);
    apiRequest<DashboardStats>(
      "GET",
      `/muallim/dashboard-stats?skolskaGodina=${encodeURIComponent(selectedYear)}${scopedMuallimId ? `&muallimId=${encodeURIComponent(String(scopedMuallimId))}` : ""}`,
      undefined, token,
    ).then(ds => {
      const hasData = ds.ukupnoGrupa > 0;
      const altYears = (ds.dostupneGodine ?? []).filter(y => y !== selectedYear);
      if (!hasData && altYears.length > 0) {
        // Prebaci na najnoviju godinu koja stvarno ima grupe — sprečava prikazivanje
        // nula kad je default tekuća schulska godina ali grupe su još pod prošlom.
        setSelectedYear(altYears[0]);
        // ds za ovu godinu nećemo prikazati — novi fetch dođe automatski.
      } else {
        setDashboardStats(ds);
      }
    })
      .catch(() => {})
      .finally(() => setDashboardStatsLoading(false));
  }, [token, selectedYear, scopedMuallimId]);

  // Kad se scope promijeni (Moje grupe ↔ Mekteb, ili pregled drugog muallima),
  // keširana statistika više ne odgovara — očisti je da se ponovo dohvati.
  useEffect(() => {
    setMektebStats(null);
  }, [scopedMuallimId, panelContext]);

  useEffect(() => {
    if (!token || !mektebMetaLoaded || activeTab !== "statistika" || mektebStats) return;
    setMektebStatsLoading(true);
    apiRequest<MektebStats>("GET", `/muallim/statistika-mekteb${muallimScopeQuery}`, undefined, token)
      .then(setMektebStats)
      .catch(() => {})
      .finally(() => setMektebStatsLoading(false));
  }, [token, mektebMetaLoaded, activeTab, mektebStats, scopedMuallimId]);

  useEffect(() => {
    if (!token || activeTab !== "kalendar" || kalendarMode !== "sve" || kalendarSve) return;
    setKalendarSveLoading(true);
    apiRequest<KalendarSveData>("GET", `/muallim/kalendar/sve${muallimScopeQuery}`, undefined, token)
      .then(setKalendarSve)
      .catch(() => {})
      .finally(() => setKalendarSveLoading(false));
  }, [token, activeTab, kalendarMode, kalendarSve, scopedMuallimId]);

  // Učitaj mekteb dokumente:
  // - za glavnog muallima: u Profilu (ima i upload/brisanje)
  // - za obične muallime: kad otvori "Pregled" tab (read-only prikaz)
  useEffect(() => {
    if (!token) return;
    if (mektebMeta.isGlavni && activeTab !== "profil") return;
    if (!mektebMeta.isGlavni && activeTab !== "pregled") return;
    apiRequest<MektebDokument[]>("GET", "/muallim/mekteb/dokumenti", undefined, token)
      .then(setMektebDokumenti)
      .catch(() => setMektebDokumenti([]));
  }, [token, activeTab, mektebMeta.isGlavni]);

  async function handleUploadDokument() {
    if (!token || !dokFile) return;
    setDokUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", dokFile);
      fd.append("naziv", dokNaziv.trim());
      fd.append("opis", dokOpis.trim());
      const created = await apiRequest<MektebDokument>("POST", "/muallim/mekteb/dokumenti", fd, token, true);
      setMektebDokumenti(prev => [created, ...(prev || [])]);
      setDokNaziv("");
      setDokOpis("");
      setDokFile(null);
      toast({ title: t("Dokument dodan"), description: created.naziv });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Upload nije uspio"), variant: "destructive" });
    } finally {
      setDokUploading(false);
    }
  }

  async function handleDeleteDokument(id: number) {
    if (!token) return;
    if (!window.confirm(t("Obrisati ovaj dokument?"))) return;
    try {
      await apiRequest("DELETE", `/muallim/mekteb/dokumenti/${id}`, undefined, token);
      setMektebDokumenti(prev => (prev || []).filter(d => d.id !== id));
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Brisanje nije uspjelo"), variant: "destructive" });
    }
  }

  async function handleExportMektebSpisak() {
    if (!token) return;
    setExportingSpisak(true);
    try {
      const res = await fetch(`${getApiBase()}/muallim/mekteb/spisak-excel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("Greška pri izvozu") }));
        throw new Error(err.error || t("Greška pri izvozu"));
      }
      const disp = res.headers.get("Content-Disposition") || "";
      const mStar = disp.match(/filename\*=UTF-8''([^;]+)/i);
      const mPlain = disp.match(/filename="?([^";]+)"?/i);
      const filename = mStar ? decodeURIComponent(mStar[1])
        : mPlain ? mPlain[1]
        : `spisak_ucenika_mekteba_${new Date().toISOString().split("T")[0]}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast({ title: t("Spisak je preuzet"), description: t("Excel sadrži pregled po muallimima i grupama.") });
    } catch (e: any) {
      toast({ title: t("Greška pri izvozu"), description: e?.message || t("Spisak nije moguće preuzeti"), variant: "destructive" });
    } finally {
      setExportingSpisak(false);
    }
  }

  async function handleApproveRoditelj(roditeljUcenikId: number, approved: boolean) {
    if (!token || selectedMuallimId) return;
    setApprovingId(roditeljUcenikId);
    try {
      await apiRequest("POST", "/muallim/approve-roditelj", { roditeljUcenikId, approved }, token);
      toast({ title: approved ? t("Roditelj odobren!") : t("Zahtjev odbijen") });
      setPendingRoditelji(prev => prev.filter(p => p.id !== roditeljUcenikId));
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
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
      toast({ title: t("{n} dana označeno kao {tip}!", { n: String(batchDatumi.length), tip: activeTip === "mekteb" ? t("Mekteb") : activeTip === "ferije" ? t("Ferije") : activeTip === "ramazan" ? t("Ramazan") : t("Važan datum") }) });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
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
      toast({ title: t("Sačuvano!") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  async function copyKalendarToGrupe() {
    if (!token || !selectedGrupaId || copyToGrupeIds.length === 0) {
      toast({ title: t("Odaberi bar jednu grupu"), variant: "destructive" });
      return;
    }
    setCopyingToGrupe(true);
    let ukupnoKopirano = 0;
    let greske = 0;
    try {
      for (const tgtId of copyToGrupeIds) {
        try {
          const result = await apiRequest<{ kopirano: number; preskoceno: number; ukupno: number }>(
            "POST", "/muallim/kalendar/kopiraj",
            { sourceGrupaId: selectedGrupaId, targetGrupaId: tgtId, override: copyOverride },
            token,
          );
          ukupnoKopirano += result.kopirano;
        } catch { greske++; }
      }
      toast({
        title: t("Kalendar kopiran!"),
        description: t("Kopirano u {n} grupe{g}.", {
          n: String(copyToGrupeIds.length - greske),
          g: greske > 0 ? t(", {e} grešaka", { e: String(greske) }) : "",
        }),
      });
      setShowCopyKalendar(false);
      setCopyToGrupeIds([]);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće kopirati"), variant: "destructive" });
    } finally {
      setCopyingToGrupe(false);
    }
  }

    async function copyKalendarFromGrupa() {
    if (!token || !selectedGrupaId || !copyFromGrupaId) {
      toast({ title: t("Odaberi izvornu grupu"), variant: "destructive" });
      return;
    }
    if (copyFromGrupaId === selectedGrupaId) {
      toast({ title: t("Izvor i odredište ne mogu biti ista grupa"), variant: "destructive" });
      return;
    }
    setCopyingKalendar(true);
    try {
      const result = await apiRequest<{ kopirano: number; preskoceno: number; ukupno: number }>(
        "POST",
        "/muallim/kalendar/kopiraj",
        { sourceGrupaId: copyFromGrupaId, targetGrupaId: selectedGrupaId, override: copyOverride },
        token,
      );
      const updated = await apiRequest<KalendarEntry[]>("GET", `/muallim/kalendar?grupaId=${selectedGrupaId}`, undefined, token);
      setKalendar(updated);
      toast({
        title: t("Kalendar kopiran!"),
        description: t("Dodano {n} datuma{extra}.", { n: String(result.kopirano), extra: result.preskoceno > 0 ? t(", preskočeno {p} (već postoje)", { p: String(result.preskoceno) }) : "" }),
      });
      setShowCopyKalendar(false);
      setCopyFromGrupaId(null);
      setCopyOverride(false);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće kopirati kalendar"), variant: "destructive" });
    } finally {
      setCopyingKalendar(false);
    }
  }

  async function deleteKalendarEntry(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/kalendar/${id}`, undefined, token);
      setKalendar(prev => prev.filter(k => k.id !== id));
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  async function addLekcija(datum: string, lekcijaNaslov: string, lekcijaTip: string) {
    if (!token || !selectedGrupaId) return;
    try {
      const nova = await apiRequest<PlanLekcija>("POST", "/muallim/plan-lekcija", {
        grupaId: selectedGrupaId, datum, lekcijaNaslov, lekcijaTip, redoslijed: planLekcija.filter(p => p.datum === datum).length,
      }, token);
      setPlanLekcija(prev => [...prev, nova]);
      setShowLekcijaSelect(false);
      toast({ title: t("Lekcija dodana!") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  async function deleteLekcija(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/plan-lekcija/${id}`, undefined, token);
      setPlanLekcija(prev => prev.filter(p => p.id !== id));
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  useEffect(() => {
    if (!token || !statGrupaId) return;
    setStatLoading(true);
    Promise.all([
      apiRequest<StatData>("GET", `/muallim/grupa/${statGrupaId}/statistika`, undefined, token),
      apiRequest<InteraktivniPregledGrupe>("GET", `/muallim/grupa/${statGrupaId}/interaktivni-blokovi`, undefined, token).catch(() => null),
    ])
      .then(([data, interaktivni]) => { setStatData(data); setInteraktivniStatPregled(interaktivni); setStatView("pregled"); })
      .catch(() => toast({ title: t("Greška pri učitavanju statistike"), variant: "destructive" }))
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
      toast({ title: t("Lekcija dodana u plan!") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
    finally { setSavingPlanLekcija(false); }
  }

  async function deletePlanLekcija(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/plan-lekcija/${id}`, undefined, token);
      setPlanLekcijaSep(prev => prev.filter(p => p.id !== id));
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
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
    }).catch(() => toast({ title: t("Greška pri učitavanju zadaća"), variant: "destructive" }))
      .finally(() => setZadLoading(false));
  }, [token, zadGrupaId]);

  async function saveZadaca() {
    if (!token || !zadGrupaId) return;
    // Lekcija je naziv zadaće; ako nema lekcije, opis je obavezan.
    if (!zadLekcija.trim() && !zadOpis.trim()) {
      toast({ title: t("Odaberi lekciju ili upiši opis"), variant: "destructive" });
      return;
    }
    if (zadDodjela === "pojedinacno" && zadUcenikIds.size === 0) {
      toast({ title: t("Odaberi najmanje jednog učenika"), variant: "destructive" });
      return;
    }
    setSavingZadaca(true);
    try {
      const payload = {
        grupaId: zadGrupaId,
        naslov: zadLekcija.trim() || zadOpis.trim().slice(0, 80),
        opis: zadOpis.trim() || null,
        rokDo: zadRok || null,
        lekcijaNaslov: zadLekcija || null,
        lekcijaSlug: zadLekcijaSlug || null,
        lekcijaTip: zadLekcijaSlug ? "ilmihal" : null,
         tipDodjele: zadDodjela,
         ucenikIds: zadDodjela === "pojedinacno" ? Array.from(zadUcenikIds) : [],
      };
      const saved = await apiRequest<Zadaca>(
        editingZadaca ? "PUT" : "POST",
        editingZadaca ? `/muallim/zadace/${editingZadaca.id}` : "/muallim/zadace",
        payload,
        token,
      );
      setZadace(prev => editingZadaca
        ? prev.map(z => z.id === saved.id ? saved : z)
        : [saved, ...prev]);
      setZadNaslov(""); setZadOpis(""); setZadRok(""); setZadLekcija(""); setZadLekcijaSlug(""); setZadUcenikIds(new Set());
      setEditingZadaca(null);
      setShowZadForm(false);
      setZadTipTab(saved.ucenikIds?.length ? "pojedinacno" : "svi");
      setZadSubTab("utoku");
      toast({ title: editingZadaca ? t("Zadaća ažurirana") : t("Zadaća dodana!") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
    finally { setSavingZadaca(false); }
  }

  function openEditZadaca(zadaca: Zadaca) {
    setEditingZadaca(zadaca);
    setZadLekcija(zadaca.lekcijaNaslov || "");
    setZadLekcijaSlug(zadaca.lekcijaSlug || "");
    setZadOpis(zadaca.opis || "");
    setZadRok(zadaca.rokDo ? zadaca.rokDo.slice(0, 10) : "");
    setZadUcenikIds(new Set(zadaca.ucenikIds || []));
    setZadDodjela(zadaca.ucenikIds?.length ? "pojedinacno" : "svi");
    setZadTipTab(zadaca.ucenikIds?.length ? "pojedinacno" : "svi");
    setZadSubTab("nova");
    setShowZadForm(true);
  }

  async function deleteZadaca(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/zadace/${id}`, undefined, token);
      setZadace(prev => prev.filter(z => z.id !== id));
      toast({ title: t("Zadaća obrisana") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  async function arhivirajZadacu(zadaca: Zadaca) {
    if (!token || zadaca.ucenikIds?.length) return;
    if (!confirm(t("Arhivirati ovu zadaću za cijelu grupu? Učenicima koji je nisu završili prikazat će se kao neurađena."))) return;
    try {
      const archived = await apiRequest<Zadaca>("PUT", `/muallim/zadace/${zadaca.id}/arhiviraj`, {}, token);
      setZadace(prev => prev.map(z => z.id === zadaca.id ? { ...z, ...archived, isActive: false } : z));
      setZadSubTab("zavrseno");
      toast({ title: t("Zadaća arhivirana") });
    } catch {
      toast({ title: t("Greška pri arhiviranju zadaće"), variant: "destructive" });
    }
  }

  async function openPregled(z: Zadaca) {
    if (!token) return;
    setPregledZadaca(z);
    setPregledUcenici([]);
    setPregledLoading(true);
    try {
      const data = await apiRequest<{ zadaca: Zadaca; ucenici: ZadacaStatusRed[] }>(
        "GET", `/muallim/zadace/${z.id}/pregled`, undefined, token);
      setPregledUcenici(data.ucenici);
    } catch { toast({ title: t("Greška pri učitavanju pregleda"), variant: "destructive" }); }
    finally { setPregledLoading(false); }
  }

  function updatePregledRed(ucenikId: number, patch: Partial<ZadacaStatusRed>) {
    setPregledUcenici(prev => prev.map(r => r.ucenikId === ucenikId ? { ...r, ...patch } : r));
  }

  async function saveStatusRed(red: ZadacaStatusRed, oznaciZavrseno?: boolean) {
    if (!token || !pregledZadaca) return;
    setSavingRedId(red.ucenikId);
    try {
      const saved = await apiRequest<any>(
        "PUT", `/muallim/zadace/${pregledZadaca.id}/status/${red.ucenikId}`,
        {
          uradjeno: red.uradjeno,
          ocjena: red.ocjena,
          kapiMeda: red.kapiMeda,
          noviRok: red.noviRok || null,
          ...(oznaciZavrseno !== undefined ? { oznaciZavrseno } : {}),
        }, token);
      updatePregledRed(red.ucenikId, {
        status: saved.status,
        prolongCount: saved.prolongCount,
        noviRok: saved.noviRok,
        uradjeno: saved.uradjeno,
        ocjena: saved.ocjena,
        kapiMeda: saved.kapiMeda,
      });
      toast({ title: oznaciZavrseno === true ? t("Označeno završenim") : t("Sačuvano") });
      // Osvježi listu zadaća da se kartica pomjeri u tab "U toku"/"Završeno".
      if (zadGrupaId) {
        apiRequest<Zadaca[]>("GET", `/muallim/zadace?grupaId=${zadGrupaId}`, undefined, token)
          .then(setZadace).catch(() => {});
      }
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
    finally { setSavingRedId(null); }
  }

  async function deleteUcenik(ucenikId: number) {
    if (!token) return;
    if (!confirm(t("Da li ste sigurni da želite arhivirati ovog učenika?"))) return;
    try {
      await apiRequest("DELETE", `/muallim/ucenici/${ucenikId}`, undefined, token);
      setUcenici(prev => prev.filter(u => u.id !== ucenikId));
      toast({ title: t("Učenik arhiviran") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  async function arhivirajGrupu(grupaId: number) {
    if (!token) return;
    if (!confirm(t("Arhivirati ovu grupu? Učenici će biti oslobođeni za druge grupe, a podaci grupe (ocjene, prisustvo, članstvo) ostaju sačuvani u arhivi."))) return;
    try {
      await apiRequest("POST", `/muallim/grupe/${grupaId}/arhiviraj`, undefined, token);
      setGrupe(prev => prev.map(g => g.id === grupaId ? { ...g, isArchived: true, archivedAt: new Date().toISOString() } : g));
      setUcenici(prev => prev.map(u => u.grupaId === grupaId ? { ...u, grupaId: undefined, grupaIme: undefined } : u));
      toast({ title: t("Grupa arhivirana") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  async function vratiGrupu(grupaId: number) {
    if (!token) return;
    try {
      await apiRequest("POST", `/muallim/grupe/${grupaId}/vrati`, undefined, token);
      setGrupe(prev => prev.map(g => g.id === grupaId ? { ...g, isArchived: false, archivedAt: null } : g));
      toast({ title: t("Grupa vraćena iz arhive") });
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
  }

  function deleteGrupa(grupaId: number) {
    const g = grupe.find(x => x.id === grupaId);
    if (!g) return;
    setDeleteGrupaTarget(g);
    setDeleteGrupaConfirm("");
    // Grupe s 0 učenika nemaju šta sačuvati — preskoči korak izvještaja
    const studentCount = ucenici.filter(u => u.grupaId === grupaId).length;
    setIzvjestajSpasen(studentCount === 0);
  }

  function closeDeleteModal() {
    if (deletingGrupa) return;
    setDeleteGrupaTarget(null);
    setDeleteGrupaConfirm("");
    setIzvjestajSpasen(false);
  }

  async function downloadIzvjestajGrupe() {
    if (!token || !deleteGrupaTarget) return;
    setDownloadingIzvjestaj(true);
    try {
      type IzvjestajRow = Record<string, unknown>;
      type IzvjestajData = {
        grupa: { id: number; naziv: string; skolskaGodina: string };
        ucenici: IzvjestajRow[];
        prisustvo: IzvjestajRow[];
        ocjene: IzvjestajRow[];
        planLekcija: IzvjestajRow[];
      };
      const data = await apiRequest("GET", `/muallim/grupe/${deleteGrupaTarget.id}/izvjestaj`, undefined, token) as IzvjestajData;

      // Gradi CSV s BOM-om za ispravno kodiranje u Excelu
      const bom = "\uFEFF";
      const sep = ";";
      const lines: string[] = [];

      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return s.includes(sep) || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"` : s;
      };

      // Naslov dokumenta
      lines.push(`IZVJEŠTAJ GRUPE${sep}${esc(data.grupa.naziv)}${sep}${esc(data.grupa.skolskaGodina)}`);
      lines.push(`Preuzeto${sep}${new Date().toLocaleDateString("bs-BA")}`);
      lines.push("");

      // === UČENICI ===
      lines.push("UČENICI");
      lines.push(["Ime i prezime", "Korisničko ime"].map(esc).join(sep));
      for (const u of (data.ucenici ?? [])) {
        lines.push([u.displayName, u.username].map(esc).join(sep));
      }
      lines.push(`Ukupno${sep}${data.ucenici?.length ?? 0}`);
      lines.push("");

      // === PRISUSTVO ===
      lines.push("PRISUSTVO");
      lines.push(["Datum", "Učenik", "Status", "Napomena"].map(esc).join(sep));
      for (const p of (data.prisustvo ?? [])) {
        const statusBs = p.status === "prisutan" ? "Prisutan" : p.status === "odsutan" ? "Odsutan" : p.status === "opravdano" ? "Opravdano" : String(p.status ?? "");
        lines.push([p.datum, p.ucenikIme, statusBs, p.napomena].map(esc).join(sep));
      }
      if (!data.prisustvo?.length) lines.push("(nema evidentiranog prisustva)");
      lines.push("");

      // === OCJENE ===
      lines.push("OCJENE");
      lines.push(["Datum", "Učenik", "Kategorija", "Ocjena", "Lekcija", "Napomena"].map(esc).join(sep));
      for (const o of (data.ocjene ?? [])) {
        lines.push([o.datum, o.ucenikIme, o.kategorija, o.ocjena, o.lekcijaNaziv, o.napomena].map(esc).join(sep));
      }
      if (!data.ocjene?.length) lines.push("(nema evidentiranih ocjena)");
      lines.push("");

      // === PLAN LEKCIJA ===
      lines.push("PLAN LEKCIJA");
      lines.push(["Datum", "Lekcija", "Napomena"].map(esc).join(sep));
      for (const pl of (data.planLekcija ?? [])) {
        lines.push([pl.datum, pl.lekcijaNaslov, pl.napomena].map(esc).join(sep));
      }
      if (!data.planLekcija?.length) lines.push("(nema unesenih lekcija)");

      const csv = bom + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const naziv = deleteGrupaTarget.naziv.replace(/[^a-zA-Z0-9čćšđžČĆŠĐŽ _-]/g, "");
      a.href = url;
      a.download = `Izvjestaj_${naziv}_${deleteGrupaTarget.skolskaGodina}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIzvjestajSpasen(true);
      toast({ title: t("Izvještaj preuzet"), description: t("Možeš nastaviti s brisanjem.") });
    } catch {
      toast({ title: t("Greška pri preuzimanju izvještaja"), variant: "destructive" });
    } finally {
      setDownloadingIzvjestaj(false);
    }
  }

  async function confirmDeleteGrupa() {
    if (!token || !deleteGrupaTarget) return;
    setDeletingGrupa(true);
    try {
      await apiRequest("DELETE", `/muallim/grupe/${deleteGrupaTarget.id}`, undefined, token);
      setGrupe(prev => prev.filter(g => g.id !== deleteGrupaTarget.id));
      setUcenici(prev => prev.map(u => u.grupaId === deleteGrupaTarget.id ? { ...u, grupaId: undefined, grupaIme: undefined } : u));
      toast({ title: t("Grupa obrisana") });
      setDeleteGrupaTarget(null);
      setDeleteGrupaConfirm("");
      setIzvjestajSpasen(false);
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setDeletingGrupa(false);
    }
  }

  async function saveProfile() {
    if (!token) return;
    setSavingProfile(true);
    try {
      await apiRequest("PUT", "/muallim/profil", { displayName: editDisplayName }, token);
      toast({ title: t("Profil ažuriran!") });
      setShowProfileEdit(false);
      window.location.reload();
    } catch { toast({ title: t("Greška"), variant: "destructive" }); }
    finally { setSavingProfile(false); }
  }

  async function handleChangePassword() {
    if (!token) return;
    if (!oldPass.trim() || !newPass.trim() || !confirmPass.trim()) {
      toast({ title: t("Greška"), description: t("Popunite sva polja"), variant: "destructive" }); return;
    }
    if (newPass !== confirmPass) {
      toast({ title: t("Greška"), description: t("Šifre se ne podudaraju"), variant: "destructive" }); return;
    }
    if (newPass.length < 6) {
      toast({ title: t("Greška"), description: t("Nova šifra mora imati najmanje 6 znakova"), variant: "destructive" }); return;
    }
    setPassChanging(true);
    try {
      await apiRequest("PUT", "/muallim/profil/password", { currentPassword: oldPass, newPassword: newPass }, token);
      toast({ title: t("Šifra promijenjena"), description: t("Nova šifra je uspješno sačuvana.") });
      setOldPass(""); setNewPass(""); setConfirmPass("");
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Promjena šifre nije uspjela"), variant: "destructive" });
    } finally {
      setPassChanging(false);
    }
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
      toast({ title: t("Excel izvještaj preuzet!") });
    } catch {
      toast({ title: t("Greška pri preuzimanju"), variant: "destructive" });
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

  // Mekteb kontekst (isGlavni + naziv mekteba) — učitava se jednom; određuje
  // da li glavni muallim vidi tabove "Muallimi" i "Mekteb" statistiku.
  // MORA biti prije auth guard conditional return (Rules of Hooks).
  useEffect(() => {
    if (!token) return;
    apiRequest<{ isGlavni: boolean; mektebNaziv: string | null }>("GET", "/muallim/info", undefined, token)
      .then(d => setMektebMeta({ isGlavni: !!d.isGlavni, mektebNaziv: d.mektebNaziv ?? null }))
      .catch(() => {})
      .finally(() => setMektebMetaLoaded(true));
  }, [token]);

  // Stari URL-ovi za uklonjene tabove vode u Profil glavnog muallima, odnosno
  // u Pregled za običnog muallima. Backend dodatno štiti osjetljive rute (403).
  useEffect(() => {
    if (!mektebMetaLoaded || !["muallimi", "mekteb"].includes(activeTab)) return;
    setLocation(mektebMeta.isGlavni ? "/muallim?tab=profil" : "/muallim?tab=pregled");
  }, [mektebMetaLoaded, mektebMeta.isGlavni, activeTab]);

  // Pregled drugog muallima je strogo read-only: Profil sadrži lične i
  // mektebske izmjene, pa u tom kontekstu uvijek vraćamo na Pregled.
  // MORA biti prije auth guard conditional return-a (Rules of Hooks).
  useEffect(() => {
    if (selectedMuallimId !== null && activeTab === "profil") {
      setLocation(`/muallim?tab=pregled&muallimId=${selectedMuallimId}`);
    }
  }, [selectedMuallimId, activeTab]);

  // Učitaj muallime + info kad glavni muallim otvori Profil.
  useEffect(() => {
    if (!token || !mektebMeta.isGlavni || activeTab !== "profil") return;
    apiRequest<MektebInfo>("GET", "/muallim/mekteb/info", undefined, token).then(setMektebInfo).catch(() => {});
    apiRequest<MektebMuallim[]>("GET", "/muallim/mekteb/muallimi", undefined, token).then(setMektebMuallimi).catch(() => setMektebMuallimi([]));
  }, [token, activeTab, mektebMeta.isGlavni]);

  // Učitaj zbirnu statistiku kada je glavni muallim na mektebskom nivou
  // Statistike (drill-down po muallimima).
  useEffect(() => {
    if (!token || mektebStatsAll) return;
    const trebaZaStatistiku = activeTab === "statistika" && mektebMeta.isGlavni && !scopedMuallimId;
    if (!trebaZaStatistiku) return;
    apiRequest<MektebStatsAll>("GET", "/muallim/mekteb/statistika", undefined, token).then(setMektebStatsAll).catch(() => {});
  }, [token, activeTab, mektebStatsAll, mektebMeta.isGlavni, scopedMuallimId]);

  if (!user || (user.role !== "muallim" && user.role !== "admin")) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">{t("Pristup dozvoljen samo muallimima")}</p>
          <Button className="mt-4" onClick={() => goBackOr(() => setLocation("/"))}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  const handleKreirajMuallima = async () => {
    if (!token || !novMuallimIme.trim()) return;
    setMuallimSaving(true);
    try {
      const res = await apiRequest<{ userId: number; displayName: string; username: string; generatedPassword: string }>(
        "POST", "/muallim/mekteb/muallimi", { displayName: novMuallimIme.trim() }, token);
      setKreiranMuallim(res);
      setNovMuallimIme("");
      const [info, lista] = await Promise.all([
        apiRequest<MektebInfo>("GET", "/muallim/mekteb/info", undefined, token),
        apiRequest<MektebMuallim[]>("GET", "/muallim/mekteb/muallimi", undefined, token),
      ]);
      setMektebInfo(info); setMektebMuallimi(lista);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće kreirati muallima"), variant: "destructive" });
    } finally { setMuallimSaving(false); }
  };

  const handleObrisiMuallima = async (userId: number, ime: string) => {
    if (!token) return;
    if (!window.confirm(t('Obrisati muallima "{ime}"? Ova radnja je trajna.', { ime }))) return;
    try {
      await apiRequest("DELETE", `/muallim/mekteb/muallimi/${userId}`, undefined, token);
      const [info, lista] = await Promise.all([
        apiRequest<MektebInfo>("GET", "/muallim/mekteb/info", undefined, token),
        apiRequest<MektebMuallim[]>("GET", "/muallim/mekteb/muallimi", undefined, token),
      ]);
      setMektebInfo(info); setMektebMuallimi(lista);
      toast({ title: t("Obrisano"), description: t('Muallim "{ime}" je obrisan.', { ime }) });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće obrisati muallima"), variant: "destructive" });
    }
  };

  const handleEditMuallima = async (userId: number, opts: { displayName?: string; resetPassword?: boolean }) => {
    if (!token) return;
    setEditMuallimSaving(true);
    try {
      const result = await apiRequest<{ success: boolean; displayName: string; newPassword?: string }>(
        "PUT", `/muallim/mekteb/muallimi/${userId}`, opts, token
      );
      const lista = await apiRequest<MektebMuallim[]>("GET", "/muallim/mekteb/muallimi", undefined, token);
      setMektebMuallimi(lista);
      if (result.newPassword) {
        setEditMuallimNewPass(result.newPassword);
      } else {
        toast({ title: t("Sačuvano"), description: t("Podaci muallima su ažurirani.") });
        setEditingMuallimId(null);
      }
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Izmjena nije uspjela"), variant: "destructive" });
    } finally {
      setEditMuallimSaving(false);
    }
  };

  const openMuallimPreview = (muallimId: number) => {
    setSelectedMuallimId(muallimId);
    setPanelContext("mekteb");
    setActiveTab("pregled");
    setMektebStats(null);
    setKalendarSve(null);
    setLocation(`/muallim?tab=pregled&muallimId=${muallimId}`);
  };

  const closeMuallimPreview = () => {
    setSelectedMuallimId(null);
    setPanelContext("moje");
    setActiveTab("profil");
    setMektebStats(null);
    setKalendarSve(null);
    setLocation("/muallim?tab=profil");
  };

  const isMuallimPreview = selectedMuallimId !== null;
  const canManageMekteb = mektebMeta.isGlavni && !isMuallimPreview;

  // Glavni tabovi panela = pogled na cijeli mekteb. Tabovi vezani za jednu grupu
  // (Prisustvo, Plan lekcija, Zadaća, H5P statistika) preselili su se u Grupa
  // stranicu (kartice unutar grupe). Te blokove i dalje renderujemo niže — link
  // iz Grupe ih otvara preko ?tab=…&grupaId=… s pre-selektovanom grupom.
  // Postavke mekteba i upravljanje muallimima su dio taba Profil.
  const TABS = [
    { id: "pregled", label: t("Pregled"), icon: BarChart3 },
    { id: "grupe", label: t("Grupe ({n})", { n: String(grupe.filter(g => !g.isArchived && g.skolskaGodina === selectedYear).length) }), icon: GraduationCap },
    { id: "statistika", label: t("Statistika"), icon: TrendingUp },
    ...(mektebMeta.isGlavni ? [
      { id: "ucenici", label: t("Svi učenici"), icon: Users },
    ] : []),
    { id: "izvjestaji", label: t("Izvještaji"), icon: FileText },
    { id: "kalendar", label: t("Kalendar"), icon: Calendar },
    { id: "roditelji", label: t("Roditelji"), icon: Heart },
    { id: "profil", label: t("Profil"), icon: Settings },
  ];
  const visibleTabs = panelContext === "moje" && mektebMeta.isGlavni && !isMuallimPreview
    ? TABS.filter(tab => tab.id !== "ucenici")
    : isMuallimPreview
      ? TABS.filter(tab => tab.id !== "profil")
    : TABS;

  const brzaPretragaQ = brzaPretraga.trim().toLocaleLowerCase();
  const rezultatiBrzePretrage = brzaPretragaQ.length < 2 ? { ucenici: [], lekcije: [] } : {
    ucenici: ucenici.filter(u =>
      `${u.displayName} ${u.username} ${u.grupaIme || ""}`.toLocaleLowerCase().includes(brzaPretragaQ),
    ).slice(0, 8),
    lekcije: dostupneLekcije.filter(l =>
      `${l.naslov} ${l.slug || ""}`.toLocaleLowerCase().includes(brzaPretragaQ),
    ).slice(0, 8),
  };

  // ── Hijerarhija statistike: Mekteb → Muallim → Grupa → Učenik ──────────────
  // Mektebski nivo postoji samo glavnom muallimu kad NIJE sužen na jednog
  // muallima ("Moje grupe" i pregled drugog muallima počinju od nivoa muallima).
  const statMektebNivoDostupan = mektebMeta.isGlavni && !scopedMuallimId;
  const statNivo: "mekteb" | "muallim" | "grupa" | "ucenik" =
    statUcenikId ? "ucenik" : statGrupaId ? "grupa" : (statMektebNivoDostupan && !statMuallimId ? "mekteb" : "muallim");
  // Podaci nivoa muallima: kad je glavni ušao u tuđeg muallima, dolaze iz
  // mektebskog agregata; inače iz vlastitog (scoped) agregata.
  const statMuallimRed = statMuallimId != null
    ? mektebStatsAll?.muallimi?.find(m => m.muallimId === statMuallimId) ?? null
    : null;
  const statMuallimGrupe = statMuallimId != null
    ? (mektebStatsAll?.perGrupa ?? []).filter(g => g.muallimId === statMuallimId)
    : (mektebStats?.perGrupa ?? []);
  const statMuallimNaziv = statMuallimId != null
    ? (statMuallimRed?.displayName
        || mektebMuallimi?.find(m => m.userId === statMuallimId)?.displayName
        || t("Muallim"))
    : (isMuallimPreview
        ? (mektebMuallimi?.find(m => m.userId === selectedMuallimId)?.displayName || t("Muallim"))
        : t("Moje grupe"));
  const statGrupaNaziv = statGrupaId
    ? (grupe.find(g => g.id === statGrupaId)?.naziv
        || mektebStatsAll?.perGrupa.find(g => g.id === statGrupaId)?.naziv
        || statMuallimGrupe.find(g => g.id === statGrupaId)?.naziv
        || t("Grupa"))
    : null;
  // Scope za štampu/izvještaj na nivou muallima — glavni koji gleda tuđeg
  // muallima štampa njegov skup, ne cijeli mekteb.
  const statIzvjestajQuery = statMuallimId != null
    ? `?muallimId=${encodeURIComponent(String(statMuallimId))}`
    : muallimScopeQuery;

  // Zbirni brojevi nivoa muallima: kad glavni gleda tuđeg muallima dolaze iz
  // mektebskog agregata (statMuallimRed), inače iz vlastitog scoped agregata.
  const statMuallimGlobal = statMuallimId != null
    ? (statMuallimRed ? {
        ukupnoUcenika: statMuallimRed.ukupnoUcenika,
        ukupnoGrupa: statMuallimRed.brojGrupa,
        ukupnoCasova: statMuallimRed.ukupnoCasova,
        prosjekPrisustva: statMuallimRed.prisustvoPct,
        prosjekOcjena: statMuallimRed.prosjekOcjena,
        ukupnoKvizova: statMuallimRed.ukupnoKvizova,
        ukupnoBodova: statMuallimRed.ukupnoBodova,
        zvjezdicePozitivne: statMuallimRed.zvjezdicePozitivne,
        zvjezdiceNegativne: statMuallimRed.zvjezdiceNegativne,
      } : null)
    : (mektebStats ? {
        ukupnoUcenika: mektebStats.global.ukupnoUcenika,
        ukupnoGrupa: mektebStats.global.ukupnoGrupa,
        ukupnoCasova: mektebStats.global.ukupnoCasova,
        prosjekPrisustva: mektebStats.global.prosjekPrisustva,
        prosjekOcjena: mektebStats.global.prosjekOcjena,
        ukupnoKvizova: mektebStats.global.ukupnoKvizova,
        ukupnoBodova: mektebStats.global.ukupnoBodova,
        zvjezdicePozitivne: mektebStats.global.zvjezdicePozitivne ?? 0,
        zvjezdiceNegativne: mektebStats.global.zvjezdiceNegativne ?? 0,
      } : null);

  const otvoriStatMuallima = (muallimId: number) => {
    setStatMuallimId(muallimId);
    setStatGrupaId(null);
    setStatData(null);
    setStatUcenikId(null);
  };
  const otvoriStatGrupu = (grupaId: number) => {
    setStatGrupaId(grupaId);
    setStatUcenikId(null);
  };
  const otvoriStatUcenika = (ucenikId: number) => {
    setStatUcenikId(ucenikId);
  };
  const nazadNaStatMekteb = () => {
    setStatMuallimId(null);
    setStatGrupaId(null);
    setStatData(null);
    setStatUcenikId(null);
  };
  const nazadNaStatMuallima = () => {
    setStatGrupaId(null);
    setStatData(null);
    setStatUcenikId(null);
  };
  const nazadNaStatGrupu = () => {
    setStatUcenikId(null);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto min-w-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-secondary to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-foreground">{t("Muallim panel")}</h1>
            {mektebMeta.mektebNaziv && (
              <p className="text-xs text-muted-foreground font-medium truncate">
                {isMuallimPreview
                  ? `${mektebMeta.mektebNaziv} — ${mektebMuallimi?.find(m => m.userId === selectedMuallimId)?.displayName || t("pregled muallima")}`
                  : `${mektebMeta.mektebNaziv}${mektebMeta.isGlavni ? t(" — glavni muallim") : ""}`}
              </p>
            )}
          </div>
           <Link
             href="/muallim/tutorijal"
             className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-extrabold text-primary transition-colors hover:bg-primary/10 sm:text-sm"
             title={t("Detaljni tutorijal za muallime")}
             data-testid="link-muallim-tutorijal"
           >
             <BookOpen className="h-4 w-4 shrink-0" />
             <span className="hidden sm:inline">{t("Muallim tutorijal")}</span>
           </Link>
          <MyScreentimeBadge />
        </div>

         <div className="relative mb-5">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
           <input
             type="search"
             value={brzaPretraga}
             onChange={e => setBrzaPretraga(e.target.value)}
             placeholder={t("Brza pretraga učenika ili lekcija...")}
             aria-label={t("Pretraži učenike i lekcije")}
             className="w-full rounded-2xl border border-primary/20 bg-white py-3 pl-12 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
             data-testid="muallim-brza-pretraga"
           />
           {brzaPretragaQ.length > 0 && brzaPretragaQ.length < 2 && (
             <p className="mt-1 px-2 text-xs text-muted-foreground">{t("Unesite najmanje 2 znaka.")}</p>
           )}
           {brzaPretragaQ.length >= 2 && (
             <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
               {rezultatiBrzePretrage.ucenici.length === 0 && rezultatiBrzePretrage.lekcije.length === 0 ? (
                 <p className="px-4 py-4 text-sm text-muted-foreground">{t("Nema rezultata.")}</p>
               ) : (
                 <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
                   {rezultatiBrzePretrage.ucenici.length > 0 && (
                     <>
                       <p className="px-3 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("Učenici")}</p>
                       {rezultatiBrzePretrage.ucenici.map(u => (
                         <button
                           key={`u-${u.id}`}
                           type="button"
                           onClick={() => { setBrzaPretraga(""); setLocation(`/muallim/ucenik/${u.id}`); }}
                           className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary/5"
                         >
                           <Users className="h-4 w-4 shrink-0 text-primary" />
                           <span className="min-w-0 flex-1">
                             <span className="block truncate text-sm font-bold">{u.displayName}</span>
                             <span className="block truncate text-xs text-muted-foreground">@{u.username}{u.grupaIme ? ` · ${u.grupaIme}` : ""}</span>
                           </span>
                           <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                         </button>
                       ))}
                     </>
                   )}
                   {rezultatiBrzePretrage.lekcije.length > 0 && (
                     <>
                       <p className="px-3 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("Lekcije")}</p>
                       {rezultatiBrzePretrage.lekcije.map(l => (
                         <button
                           key={`l-${l.id}`}
                           type="button"
                           onClick={() => { setBrzaPretraga(""); if (l.slug) setLocation(`/ilmihal/${l.slug}`); }}
                           className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary/5"
                         >
                           <BookOpen className="h-4 w-4 shrink-0 text-emerald-600" />
                           <span className="min-w-0 flex-1">
                             <span className="block truncate text-sm font-bold">{l.naslov}</span>
                             <span className="block text-xs text-muted-foreground">{t("Nivo")} {l.nivo}</span>
                           </span>
                           <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                         </button>
                       ))}
                     </>
                   )}
                 </div>
               )}
             </div>
           )}
         </div>

        {mektebMeta.isGlavni && !isMuallimPreview && (
          <div className="grid grid-cols-2 gap-2 p-1.5 mb-4 rounded-2xl bg-muted/60 border border-border/40">
            <button
              type="button"
               onClick={() => {
                 setPanelContext("moje");
                 setActiveTab("pregled");
                 setSelectedMuallimId(null);
                 setSelectedGrupaId(null);
                 setStatGrupaId(null);
                 setPlanGrupaId(null);
                 setZadGrupaId(null);
                 setLocation("/muallim?tab=pregled");
               }}
              className={`rounded-xl px-4 py-3 text-left transition-all ${panelContext === "moje" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <span className="block text-sm font-extrabold">{t("Moje grupe")}</span>
              <span className="block text-xs mt-0.5 opacity-80">{t("Prisustvo, plan i učenici koje vodite")}</span>
            </button>
            <button
              type="button"
              onClick={() => { setPanelContext("mekteb"); setActiveTab("ucenici"); setSelectedMuallimId(null); setLocation("/muallim?tab=ucenici"); }}
              className={`rounded-xl px-4 py-3 text-left transition-all ${panelContext === "mekteb" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <span className="block text-sm font-extrabold">{t("Mekteb")}</span>
              <span className="block text-xs mt-0.5 opacity-80">{t("Svi učenici, muallimi i zbirni pregled")}</span>
            </button>
          </div>
        )}

        {isMuallimPreview && (
          <div className="flex items-center justify-between gap-3 mb-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold truncate">
                {t("Pregled muallima")}: {mektebMuallimi?.find(m => m.userId === selectedMuallimId)?.displayName || "—"}
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={closeMuallimPreview} className="rounded-xl shrink-0">
              {t("Nazad na muallime")}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)] gap-4 sm:gap-6 items-start">
        {/* Moduli — na desktopu stalno dostupni desno */}
        <aside className="xl:order-2 xl:sticky xl:top-4 min-w-0">
         {groupContextId ? (
           <MuallimGroupSidebar
             grupaId={groupContextId}
             activeModule={activeTab as GroupModuleKey}
           />
         ) : (
         <div className="rounded-2xl border border-border/50 bg-muted/30 p-2">
          <p className="px-3 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{t("Moduli")}</p>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:flex xl:flex-col">
          {visibleTabs.map(tab => {
            const badgeCount = tab.id === "pregled" ? pendingRoditelji.length : 0;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative flex w-full items-center gap-2 px-4 py-3 rounded-xl text-left font-bold text-sm transition-all border ${activeTab === tab.id ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
                {badgeCount > 0 && (
                  <span
                    className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-extrabold shadow-sm"
                    data-testid={`badge-${tab.id}`}
                    title={t("{n} zahtjev/a roditelja čeka odobrenje", { n: String(badgeCount) })}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
         )}
        </aside>
        <main className="xl:order-1 min-w-0">
        {isLoading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : (
          <>
            {/* PREGLED */}
            {activeTab === "pregled" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {(() => {
                  // Dropdown: 3 fiksne godine (prošla/tekuća/sljedeća) + sve stvarne
                  // godine iz baze (dostupneGodine). Ako muallim ima grupe pod "25/26"
                  // a default je "26/27", ta godina mora biti vidljiva u dropdownu.
                  const schoolYearOptions = (() => {
                    const base = computeCurrentSchoolYear(); // npr. "2026/27"
                    const startYear = parseInt(base.slice(0, 4));
                    const fixed = [startYear - 1, startYear, startYear + 1]
                      .map(y => `${y}/${String(y + 1).slice(2)}`);
                    const fromDb = dashboardStats?.dostupneGodine ?? [];
                    const all = [...new Set([...fixed, ...fromDb])].sort().reverse();
                    return all.map(y => ({
                      value: y,
                      label: formatSchoolYearOptionLabel(y), // "2025/26" ili "Mektebska 2025/26" → "25/26"
                    }));
                  })();
                  const aktivneGodine = grupe.filter(g => !g.isArchived && g.skolskaGodina === selectedYear);
                  const nUcenika = dashboardStats?.ukupnoUcenika ?? 0;
                  const nAktivnih = dashboardStats?.aktivnihUcenika ?? 0;
                  const nGrupa = dashboardStats?.ukupnoGrupa ?? 0;
                  const prisustvoVal = dashboardStats?.prosjekPrisustva;
                  const prisustvoColor = prisustvoVal !== null && prisustvoVal !== undefined
                    ? (prisustvoVal >= 80 ? "text-emerald-600" : prisustvoVal >= 50 ? "text-amber-600" : "text-red-500")
                    : "text-emerald-600";
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      {/* Ukupno učenika */}
                      <div className="bg-primary/5 border border-border/50 rounded-2xl p-5">
                        <Users className="w-6 h-6 text-primary mb-3" />
                        <div className="text-2xl font-extrabold text-primary">
                          {dashboardStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : nUcenika}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">{t("Ukupno učenika")}</div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">{t("{n} aktivnih", { n: String(nAktivnih) })}</div>
                      </div>
                      {/* Aktivnih grupa */}
                      <div className="bg-secondary/5 border border-border/50 rounded-2xl p-5">
                        <GraduationCap className="w-6 h-6 text-secondary mb-3" />
                        <div className="text-2xl font-extrabold text-secondary">
                          {dashboardStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : nGrupa}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">{t("Aktivnih grupa")}</div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {nGrupa > 0 && nUcenika > 0 ? t("prosj. {n} po grupi", { n: (nUcenika / nGrupa).toFixed(1) }) : "—"}
                        </div>
                      </div>
                      {/* Prosj. prisustvo */}
                      <div className="bg-emerald-50 border border-border/50 rounded-2xl p-5">
                        <CalendarCheck className="w-6 h-6 text-emerald-600 mb-3" />
                        <div className={`text-2xl font-extrabold ${prisustvoColor}`}>
                          {dashboardStatsLoading ? <Loader2 className="w-5 h-5 animate-spin" />
                            : prisustvoVal !== null && prisustvoVal !== undefined ? `${prisustvoVal}%` : "—"}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">{t("Prosj. prisustvo")}</div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {dashboardStats?.danasnjeEvidentirano
                            ? t("danas {n}%", { n: String(dashboardStats.danasnjePrisustvoPct ?? 0) })
                            : t("danas još nema")}
                        </div>
                      </div>
                      {/* Mektebska godina — interaktivni selector */}
                      <div className="bg-violet-50 border border-border/50 rounded-2xl p-5 relative">
                        <Clock className="w-6 h-6 text-violet-600 mb-3" />
                        <div className="relative">
                          <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                            className="text-2xl font-extrabold text-violet-600 bg-transparent border-none outline-none cursor-pointer appearance-none pr-6 w-full leading-tight"
                          >
                            {schoolYearOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 pointer-events-none" />
                        </div>
                        <div className="text-sm text-muted-foreground font-medium mt-1">{t("Mektebska godina")}</div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">{t("odaberi godinu")}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Druga vrsta — agregat akademskih pokazatelja kroz cijeli mekteb */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    {
                      label: t("Prosj. ocjena"),
                      value: dashboardStats?.prosjekOcjena !== null && dashboardStats?.prosjekOcjena !== undefined ? dashboardStats.prosjekOcjena.toFixed(1) : "—",
                      sub: t("kroz sve grupe"),
                      icon: Star, color: "text-violet-600", bg: "bg-violet-50",
                    },
                    {
                      label: t("Završene lekcije"),
                      value: dashboardStats?.ukupnoLekcijaZavrseno ?? 0,
                      sub: dashboardStats ? t("prosj. {n} po učeniku", { n: String(dashboardStats.prosjekLekcijaPoUceniku) }) : "—",
                      icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50",
                    },
                    {
                      label: t("Urađeni kvizovi"),
                      value: dashboardStats?.ukupnoKvizovaUradeno ?? 0,
                      sub: dashboardStats ? t("prosj. {n} po učeniku", { n: String(dashboardStats.prosjekKvizovaPoUceniku) }) : "—",
                      icon: Award, color: "text-amber-600", bg: "bg-amber-50",
                    },
                    {
                      label: t("Ukupno bodova"),
                      value: dashboardStats?.ukupnoBodova ?? 0,
                      sub: t("iz kvizova"),
                      icon: Heart, color: "text-rose-600", bg: "bg-rose-50",
                    },
                  ].map(stat => (
                    <div key={stat.label} className={`${stat.bg} border border-border/50 rounded-2xl p-5`}>
                      <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                      <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                      <div className="text-sm text-muted-foreground font-medium mt-1">{stat.label}</div>
                      <div className="text-xs text-muted-foreground/70 mt-0.5">{stat.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Izvještaji za štampu / PDF */}
                {/* Izvještaji za štampu/PDF su premješteni u zasebni tab "Izvještaji". */}

                {!isMuallimPreview && pendingRoditelji.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <UserPlus className="w-5 h-5 text-amber-600" />
                      <h3 className="font-extrabold text-base text-amber-800">
                        {t("Zahtjevi roditelja ({n})", { n: String(pendingRoditelji.length) })}
                      </h3>
                    </div>
                    <p className="text-sm text-amber-700 mb-4">
                      {t("Roditelji koji žele povezati račun sa učenikom. Pregledajte i odobrite ili odbijte.")}
                    </p>
                    <div className="space-y-3">
                      {pendingRoditelji.map(pr => (
                        <div key={pr.id} className="bg-white rounded-xl border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1">
                            <div className="font-bold text-foreground">{pr.roditelj.displayName}</div>
                            <div className="text-sm text-muted-foreground">@{pr.roditelj.username}</div>
                            <div className="text-sm text-amber-700 mt-1">
                              {t("želi se povezati sa učenikom:")} <span className="font-bold">{pr.ucenik.displayName}</span> (@{pr.ucenik.username})
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
                              {t("Odbij")}
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={approvingId === pr.id}
                              onClick={() => handleApproveRoditelj(pr.id, true)}
                            >
                              {approvingId === pr.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4 mr-1" />}
                              {t("Odobri")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* DOKUMENTI MEKTEBA — read-only za obične muallime */}
                {!mektebMeta.isGlavni && mektebDokumenti && mektebDokumenti.length > 0 && (
                  <div className="bg-white rounded-2xl border border-border/50 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-sm text-foreground">{t("Dokumenti mekteba")}</h3>
                    </div>
                    <div className="space-y-2">
                      {mektebDokumenti.map(d => (
                        <div key={d.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground truncate">{d.naziv}</div>
                            {d.opis && <div className="text-xs text-muted-foreground truncate">{d.opis}</div>}
                          </div>
                          <button
                            onClick={() => openAuthorizedFile(`/muallim/mekteb/dokumenti/${d.id}/file`, token).catch((e: any) => toast({ title: t("Greška"), description: e?.message || t("Otvaranje nije uspjelo"), variant: "destructive" }))}
                            className="text-xs font-bold text-primary hover:underline shrink-0"
                          >
                            {t("Otvori")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* UČENICI — svi učenici mekteba (samo glavni muallim) */}
            {activeTab === "ucenici" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Toolbar: pretraga + filteri + dugme */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="relative min-w-0 flex-1 basis-full sm:min-w-[200px] sm:basis-auto max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t("Pretraži po imenu...")}
                      value={uceniciSearch}
                      onChange={e => setUceniciSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                    />
                  </div>
                  {/* Filter po muallimu */}
                  {mektebMeta.isGlavni && !isMuallimPreview && (() => {
                    const muallimOptions = Array.from(
                      new Map(ucenici.filter(u => u.muallimId && u.muallimDisplayName).map(u => [u.muallimId, u.muallimDisplayName!]))
                    ).sort((a, b) => a[1].localeCompare(b[1]));
                    if (muallimOptions.length < 2) return null;
                    return (
                      <select
                        value={uceniciMuallimFilter === "sve" ? "sve" : String(uceniciMuallimFilter)}
                        onChange={e => setUceniciMuallimFilter(e.target.value === "sve" ? "sve" : Number(e.target.value))}
                        className="text-sm border border-border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="sve">{t("Svi muallimi")}</option>
                        {muallimOptions.map(([id, name]) => (
                          <option key={id} value={String(id)}>{name}</option>
                        ))}
                      </select>
                    );
                  })()}
                  {grupe.length > 1 && (
                    <select
                      value={uceniciGrupaFilter === "sve" ? "sve" : String(uceniciGrupaFilter)}
                      onChange={e => setUceniciGrupaFilter(e.target.value === "sve" ? "sve" : Number(e.target.value))}
                      className="text-sm border border-border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      aria-label={t("Filter po grupi")}
                    >
                      <option value="sve">{t("Sve grupe")}</option>
                      {grupe.map(g => <option key={g.id} value={String(g.id)}>{g.naziv}</option>)}
                    </select>
                  )}
                  {/* Filter aktivan/svi */}
                  <select
                    value={uceniciStatusFilter}
                    onChange={e => setUceniciStatusFilter(e.target.value as "aktivni" | "svi")}
                    className="text-sm border border-border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="aktivni">{t("Samo aktivni")}</option>
                    <option value="svi">{t("Aktivni + arhivirani")}</option>
                  </select>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl font-bold flex items-center gap-2"
                      onClick={() => setLocation(`/muallim/izvjestaj/svi${muallimScopeQuery}`)}
                    >
                      <Printer className="w-4 h-4" /> {t("Izradi spisak")}
                    </Button>
                    {!isMuallimPreview && (
                      <Link href="/muallim/dodaj-ucenika">
                        <Button className="rounded-xl font-bold flex items-center gap-2">
                          <Plus className="w-4 h-4" /> {t("Dodaj učenika")}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Tablica */}
                <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                  {(() => {
                    let filtered = ucenici;
                    // Status filter
                    if (uceniciStatusFilter === "aktivni") filtered = filtered.filter(u => u.aktivanStatus);
                    // Muallim filter
                    if (!isMuallimPreview && uceniciMuallimFilter !== "sve") filtered = filtered.filter(u => u.muallimId === uceniciMuallimFilter);
                    if (uceniciGrupaFilter !== "sve") filtered = filtered.filter(u => u.grupaId === uceniciGrupaFilter);
                    // Tekst pretraga
                    if (uceniciSearch.trim()) {
                      const q = uceniciSearch.toLowerCase();
                      filtered = filtered.filter(u =>
                        u.displayName.toLowerCase().includes(q) ||
                        u.username.toLowerCase().includes(q) ||
                        (u.grupaIme || "").toLowerCase().includes(q)
                      );
                    }

                    const showMuallimCol = mektebMeta.isGlavni;

                    if (ucenici.length === 0) return (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">{t("Nema učenika. Dodaj prvog učenika.")}</p>
                      </div>
                    );
                    if (filtered.length === 0) return (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">{t("Nema učenika koji odgovaraju filterima.")}</p>
                      </div>
                    );
                    return (
                      <>
                        <div className="px-4 py-2 border-b border-border/30 bg-muted/20 text-xs text-muted-foreground font-medium">
                          {filtered.length} {t("učenika")}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[500px]">
                            <thead className="border-b border-border/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t("Ime i prezime")}</th>
                                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t("Korisničko ime")}</th>
                                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t("Grupa")}</th>
                                {showMuallimCol && <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t("Muallim")}</th>}
                                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{t("Status")}</th>
                                <th className="px-4 py-3" />
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((u, i) => (
                                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                                  className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3 font-bold text-foreground">
                                    <span className="inline-flex items-center gap-2">
                                      {u.displayName}
                                      {u.roditeljPovezan && (
                                        <span
                                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black border border-emerald-200"
                                          title={t("Roditelj povezan")}
                                          aria-label={t("Roditelj povezan")}
                                          data-testid={`roditelj-povezan-${u.id}`}
                                        >R</span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground font-mono text-sm">{u.username}</td>
                                  <td className="px-4 py-3 text-muted-foreground text-sm">{u.grupaIme || "—"}</td>
                                  {showMuallimCol && (
                                    <td className="px-4 py-3 text-sm text-muted-foreground">{u.muallimDisplayName || "—"}</td>
                                  )}
                                  <td className="px-4 py-3">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.aktivanStatus ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                      {u.aktivanStatus ? t("Aktivan") : t("Arhiviran")}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                       {u.grupaId && (
                                         <Link href={`/muallim/prisustvo/${u.grupaId}`}>
                                           <button className="text-emerald-700 hover:underline font-bold text-sm flex items-center gap-1" title={t("Otvori prisustvo")}>
                                             <CalendarCheck className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{t("Prisustvo")}</span>
                                           </button>
                                         </Link>
                                       )}
                                       <button
                                         type="button"
                                         onClick={() => setLocation(`/poruke?primateljId=${u.id}`)}
                                         className="text-blue-600 hover:underline font-bold text-sm flex items-center gap-1"
                                         title={t("Pošalji poruku")}
                                       >
                                         <MessageSquare className="w-3.5 h-3.5" /> <span className="hidden lg:inline">{t("Poruka")}</span>
                                       </button>
                                      <Link href={`/muallim/ucenik/${u.id}`}>
                                        <button className="text-primary hover:underline font-bold text-sm flex items-center gap-1">
                                          {t("Detalji")} <ChevronRight className="w-3 h-3" />
                                        </button>
                                      </Link>
                                      {!isMuallimPreview && (
                                        <button onClick={() => deleteUcenik(u.id)} className="text-red-400 hover:text-red-600 p-1" title={t("Arhiviraj učenika")}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </motion.div>
            )}

            {/* GRUPE */}
            {activeTab === "grupe" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-end mb-4">
                  <Link href="/muallim/dodaj-grupu">
                    <Button className="rounded-xl font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4" /> {t("Nova grupa")}
                    </Button>
                  </Link>
                </div>
                {grupe.filter(g => !g.isArchived).length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{t("Nema grupa. Kreiraj prvu grupu (razred).")}</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {(() => {
                      // Boja ostaje pomoćni vizuelni signal, ali primarna podjela je po muallimu.
                      const muallimColorMap = new Map<number, number>();
                      if (user?.id) muallimColorMap.set(user.id, 0);
                      let ci = 1;
                      for (const g of grupe) {
                        if (g.muallimId && !muallimColorMap.has(g.muallimId)) {
                          muallimColorMap.set(g.muallimId, ci % MUALLIM_PALETA.length);
                          ci++;
                        }
                      }
                      const poMuallimu = new Map<string, { naziv: string; grupe: Grupa[] }>();
                      for (const g of grupe.filter(g => !g.isArchived)) {
                        const key = g.muallimId ? String(g.muallimId) : "bez-muallima";
                        const naziv = g.muallimDisplayName || (g.muallimId === user?.id ? t("Moje grupe") : t("Nedodijeljene grupe"));
                        const sekcija = poMuallimu.get(key) || { naziv, grupe: [] };
                        sekcija.grupe.push(g);
                        poMuallimu.set(key, sekcija);
                      }
                      return Array.from(poMuallimu.entries()).map(([key, sekcija], sekcijaIndex) => {
                        const first = sekcija.grupe[0];
                        const paleta = MUALLIM_PALETA[(first.muallimId ? muallimColorMap.get(first.muallimId) : 0) ?? 0];
                        return (
                          <section key={key}>
                            <div className="flex items-center gap-2 mb-3">
                              <GraduationCap className={`w-5 h-5 ${paleta.icon}`} />
                              <h3 className="font-extrabold text-foreground">{sekcija.naziv}</h3>
                              <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {sekcija.grupe.length} {t("grupa")}
                              </span>
                            </div>
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {sekcija.grupe.map((g, i) => {
                                const mozeBrisati = !g.muallimId || g.muallimId === user?.id || mektebMeta.isGlavni;
                                return (
                                  <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (sekcijaIndex * 0.1) + (i * 0.05) }}>
                                    <div className={`bg-white border-2 rounded-2xl p-5 hover:shadow-md transition-all group relative ${paleta.border}`}>
                                      <div className="absolute top-3 right-3 flex items-center gap-1">
                                        {mozeBrisati && (
                                          <>
                                            <button onClick={(e) => { e.stopPropagation(); arhivirajGrupu(g.id); }}
                                              className="text-amber-400 hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition-colors" title={t("Arhiviraj grupu")}>
                                              <Archive className="w-4 h-4" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteGrupa(g.id); }}
                                              className="text-red-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title={t("Obriši grupu")}>
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                      <Link href={`/muallim/grupa/${g.id}`}>
                                        <div className="cursor-pointer">
                                          <GraduationCap className={`w-8 h-8 mb-3 ${paleta.icon}`} />
                                          <h4 className="font-extrabold text-foreground text-lg">{g.naziv}</h4>
                                          {(g.sekundarniMuallimi ?? []).length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              + {(g.sekundarniMuallimi ?? []).map(m => m.displayName).join(", ")}
                                            </p>
                                          )}
                                          <p className="text-sm text-muted-foreground mt-1">{g.skolskaGodina} · {ucenici.filter(u => u.grupaId === g.id).length} {t("učenika")}</p>
                                          <div className={`flex items-center gap-1 font-bold text-sm mt-3 ${paleta.link}`}>
                                            {t("Otvori")} <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                          </div>
                                        </div>
                                      </Link>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      });
                    })()}
                  </div>
                )}
                {grupe.some(g => g.isArchived) && (
                  <div className="mt-8">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-3">
                      <Archive className="w-5 h-5 text-muted-foreground" />
                      {t("Arhiva grupa")} ({grupe.filter(g => g.isArchived).length})
                    </h3>
                    <div className="space-y-6">
                      {(() => {
                        const poMuallimu = new Map<string, { naziv: string; grupe: Grupa[] }>();
                        for (const g of grupe.filter(g => g.isArchived)) {
                          const key = g.muallimId ? String(g.muallimId) : "bez-muallima";
                          const naziv = g.muallimDisplayName || (g.muallimId === user?.id ? t("Moje grupe") : t("Nedodijeljene grupe"));
                          const sekcija = poMuallimu.get(key) || { naziv, grupe: [] };
                          sekcija.grupe.push(g);
                          poMuallimu.set(key, sekcija);
                        }
                        return Array.from(poMuallimu.entries()).map(([key, sekcija]) => (
                          <section key={key}>
                            <h4 className="font-bold text-sm text-muted-foreground mb-3">{sekcija.naziv}</h4>
                            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {sekcija.grupe.map(g => {
                                const isVlasnik = !g.muallimId || g.muallimId === user?.id || mektebMeta.isGlavni;
                                return (
                                  <div key={g.id} className="bg-muted/40 border-2 border-border/60 rounded-2xl p-5 relative opacity-80 hover:opacity-100 transition-opacity">
                                    <Link href={`/muallim/grupa/${g.id}`}>
                                      <div className="cursor-pointer">
                                        <Archive className="w-7 h-7 text-muted-foreground mb-3" />
                                        <h5 className="font-extrabold text-foreground text-lg">{g.naziv}</h5>
                                        <p className="text-sm text-muted-foreground mt-1">
                                          {g.skolskaGodina}
                                          {g.archivedAt ? ` · ${t("arhivirana")} ${new Date(g.archivedAt).toLocaleDateString("bs-BA")}` : ""}
                                        </p>
                                      </div>
                                    </Link>
                                    {isVlasnik && (
                                      <Button variant="outline" size="sm" className="mt-3 rounded-xl font-bold"
                                        onClick={() => vratiGrupu(g.id)}>
                                        {t("Vrati iz arhive")}
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* PRISUSTVO */}
            {activeTab === "prisustvo" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
                <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-foreground mb-2">{t("Evidencija prisustva")}</p>
                <p className="text-sm">{t("Odaberi grupu da uneseš prisustvo za danas")}</p>
                <div className="flex flex-wrap gap-3 justify-center mt-6">
                  {grupe.filter(g => !g.isArchived).map(g => (
                    <Link key={g.id} href={`/muallim/prisustvo/${g.id}`}>
                      <button className="bg-primary/10 text-primary border border-primary/20 rounded-xl px-5 py-3 font-bold hover:bg-primary hover:text-primary-foreground transition-all text-left">
                        <div>{g.naziv}</div>
                        {g.muallimDisplayName && <div className="text-[10px] opacity-70 font-medium">{g.muallimDisplayName}</div>}
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
                    <p className="font-bold text-foreground mb-2">{t("Odaberi grupu za plan lekcija")}</p>
                    <div className="flex flex-wrap gap-3 justify-center mt-6">
                      {grupe.filter(g => !g.isArchived).map(g => (
                        <button key={g.id} onClick={() => setPlanGrupaId(g.id)}
                          className="bg-violet-50 text-violet-700 border border-violet-200 rounded-xl px-5 py-3 font-bold hover:bg-violet-600 hover:text-white transition-all text-left">
                          <div>{g.naziv}</div>
                          {g.muallimDisplayName && <div className="text-[10px] opacity-70 font-medium">{g.muallimDisplayName}</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : planLekcijeLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="min-w-0 font-extrabold text-lg text-foreground flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-violet-600" />
                        {t("Plan lekcija:")} {grupe.find(g => g.id === planGrupaId)?.naziv}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => setShowPlanForm(!showPlanForm)}
                          className="flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800">
                          <Plus className="w-4 h-4" /> {t("Dodaj lekciju")}
                        </button>
                        <button onClick={() => { setPlanGrupaId(null); setPlanLekcijaSep([]); }}
                          className="text-sm text-muted-foreground hover:text-foreground font-medium">{t("← Promijeni grupu")}</button>
                      </div>
                    </div>

                    {showPlanForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Datum")}</label>
                            <input type="date" value={planDatum} onChange={e => setPlanDatum(e.target.value)}
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Vrsta časa")}</label>
                            <select value={planVrstaCasa} onChange={e => setPlanVrstaCasa(e.target.value)}
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                              <option value="obrada">{t("Obrada")}</option>
                              <option value="ponavljanje">{t("Ponavljanje")}</option>
                              <option value="test">{t("Test")}</option>
                              <option value="prakticno">{t("Praktično")}</option>
                              <option value="ilmihal">{t("Ilmihal")}</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Lekcija")}</label>
                          <select value={planLekcijaNaslov} onChange={e => setPlanLekcijaNaslov(e.target.value)}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                            <option value="">{t("— Odaberi lekciju —")}</option>
                            {[1, 2, 3, 4].map(nivo => {
                              const nivoLekcije = dostupneLekcije.filter(l => l.nivo === nivo);
                              if (nivoLekcije.length === 0) return null;
                              return (
                                <optgroup key={nivo} label={t("Nivo {n}", { n: String(nivo) })}>
                                  {nivoLekcije.map(l => (
                                    <option key={l.id} value={l.naslov}>{l.naslov}</option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                        </div>
                        {!planLekcijaNaslov && (
                          <input type="text" placeholder={t("Ili upišite naziv lekcije ručno")} value={planLekcijaNaslov}
                            onChange={e => setPlanLekcijaNaslov(e.target.value)}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300" />
                        )}
                        <div className="flex gap-2">
                          <Button onClick={savePlanLekcija} disabled={savingPlanLekcija || !planLekcijaNaslov.trim()}
                            className="rounded-xl font-bold text-sm bg-violet-600 hover:bg-violet-700">
                            {savingPlanLekcija ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Sačuvaj")}
                          </Button>
                          <button onClick={() => setShowPlanForm(false)} className="text-sm text-muted-foreground hover:text-foreground font-medium px-3">{t("Otkaži")}</button>
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
                            <p className="text-sm text-muted-foreground">{t("Nema dodanih lekcija u planu")}</p>
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
                                <span className="text-xs text-muted-foreground">{groupedByDate[datum].length} {t("lekcija")}</span>
                              </div>
                              <div className="divide-y divide-border/30">
                                {groupedByDate[datum].map(l => (
                                  <div key={l.id} className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4 hover:bg-muted/10 transition-colors">
                                    <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${VRSTA_COLORS[l.lekcijaTip] || "bg-gray-100 text-gray-700"}`}>
                                        {l.lekcijaTip === "obrada" ? t("Obrada") : l.lekcijaTip === "ponavljanje" ? t("Ponavljanje") : l.lekcijaTip === "test" ? t("Test") : l.lekcijaTip === "prakticno" ? t("Praktično") : l.lekcijaTip}
                                      </span>
                                      {(() => {
                                        const matchSlug = dostupneLekcije.find(dl => dl.naslov === l.lekcijaNaslov)?.slug;
                                        return matchSlug ? (
                                          <Link href={`/ilmihal/${matchSlug}`} className="min-w-0 break-words font-medium text-primary hover:underline inline-flex items-start gap-1">
                                            <BookOpen className="w-3.5 h-3.5" />{l.lekcijaNaslov}
                                          </Link>
                                        ) : (
                                          <span className="min-w-0 break-words font-medium text-foreground">{l.lekcijaNaslov}</span>
                                        );
                                      })()}
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
                {/* Breadcrumb hijerarhije — Mekteb → Muallim → Grupa → Učenik */}
                <div className="bg-white border border-border/50 rounded-2xl p-4 mb-4">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {statMektebNivoDostupan && (
                      <>
                        <button
                          onClick={nazadNaStatMekteb}
                          className={`rounded-xl px-3 py-1.5 font-bold border transition-all ${statNivo === "mekteb" ? "bg-primary text-primary-foreground border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"}`}
                          data-testid="btn-stat-mekteb">
                          {mektebMeta.mektebNaziv || t("Cijeli mekteb")}
                        </button>
                        {statNivo !== "mekteb" && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </>
                    )}
                    {statNivo !== "mekteb" && (
                      <>
                        <button
                          onClick={nazadNaStatMuallima}
                          className={`rounded-xl px-3 py-1.5 font-bold border transition-all ${statNivo === "muallim" ? "bg-primary text-primary-foreground border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"}`}
                          data-testid="btn-stat-muallim">
                          {statMuallimNaziv}
                        </button>
                        {(statNivo === "grupa" || statNivo === "ucenik") && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </>
                    )}
                    {(statNivo === "grupa" || statNivo === "ucenik") && (
                      <>
                        <button
                          onClick={nazadNaStatGrupu}
                          className={`rounded-xl px-3 py-1.5 font-bold border transition-all ${statNivo === "grupa" ? "bg-primary text-primary-foreground border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"}`}
                          data-testid="btn-stat-grupa">
                          {statGrupaNaziv}
                        </button>
                        {statNivo === "ucenik" && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      </>
                    )}
                    {statNivo === "ucenik" && (() => {
                      const u = statData?.ucenici.find(u => u.id === statUcenikId);
                      return u ? (
                        <span className="rounded-xl px-3 py-1.5 font-bold border bg-primary text-primary-foreground border-primary"
                          data-testid="btn-stat-ucenik">
                          {u.ime}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {statNivo === "mekteb"
                      ? t("Klikni na muallima da vidiš njegove grupe.")
                      : statNivo === "muallim"
                        ? t("Klikni na grupu da vidiš učenike.")
                        : statNivo === "grupa"
                          ? t("Klikni na učenika za detaljan profil.")
                          : t("Detaljan pregled učenika.")}
                  </p>
                </div>

                {statNivo === "mekteb" ? (
                  !mektebStatsAll ? (
                    <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                          <School className="w-5 h-5 text-primary" />
                          {t("Mekteb — zbir i prosjek po muallimima")}
                        </h3>
                        <Button onClick={() => setLocation("/muallim/izvjestaj/svi")}
                          className="rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 flex items-center gap-2">
                          <Printer className="w-4 h-4" /> {t("Štampaj izvještaj mekteba")}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-primary/5 border border-border/50 rounded-2xl p-5">
                          <Users className="w-5 h-5 text-primary mb-2" />
                          <div className="text-2xl font-extrabold text-primary">{mektebStatsAll.global.ukupnoUcenika}</div>
                          <div className="text-sm text-muted-foreground font-medium">
                            {t("Učenika · {m} muallima · {g} grupa", { m: String(mektebStatsAll.global.brojMuallima), g: String(mektebStatsAll.global.brojGrupa) })}
                          </div>
                        </div>
                        <div className={`border border-border/50 rounded-2xl p-5 ${mektebStatsAll.global.prosjekPrisustva !== null && mektebStatsAll.global.prosjekPrisustva >= 80 ? "bg-emerald-50" : mektebStatsAll.global.prosjekPrisustva !== null && mektebStatsAll.global.prosjekPrisustva >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                          <Target className="w-5 h-5 mb-2 text-foreground/60" />
                          <div className={`text-2xl font-extrabold ${mektebStatsAll.global.prosjekPrisustva !== null && mektebStatsAll.global.prosjekPrisustva >= 80 ? "text-emerald-600" : mektebStatsAll.global.prosjekPrisustva !== null && mektebStatsAll.global.prosjekPrisustva >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {mektebStatsAll.global.prosjekPrisustva !== null ? `${mektebStatsAll.global.prosjekPrisustva}%` : "—"}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Prosj. prisustvo (mekteb)")}</div>
                        </div>
                        <div className="bg-violet-50 border border-border/50 rounded-2xl p-5">
                          <Star className="w-5 h-5 text-violet-600 mb-2" />
                          <div className="text-2xl font-extrabold text-violet-600">{mektebStatsAll.global.prosjekOcjena ?? "—"}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Prosj. ocjena (mekteb)")}</div>
                        </div>
                        <div className="bg-amber-50 border border-border/50 rounded-2xl p-5">
                          <Star className="w-5 h-5 text-amber-500 mb-2" />
                          <div className="flex items-baseline gap-3">
                            <span className="text-2xl font-extrabold text-amber-600">★ {mektebStatsAll.global.zvjezdicePozitivne ?? 0}</span>
                            <span className="text-2xl font-extrabold text-slate-800">★ {mektebStatsAll.global.zvjezdiceNegativne ?? 0}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Žute / crne zvjezdice")}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-border/50 p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Award className="w-4 h-4 text-amber-500" />
                            <h4 className="font-bold text-sm text-foreground">{t("Napredak po nivoima (Ilmihal)")}</h4>
                          </div>
                          {mektebStatsAll.global.napredakPoNivoima.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("Još nema završenih lekcija.")}</p>
                          ) : (
                            <div className="space-y-2">
                              {mektebStatsAll.global.napredakPoNivoima.map(n => (
                                <div key={n.nivo} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{t("Nivo {n}", { n: String(n.nivo) })}</span>
                                  <span className="font-bold text-foreground">{t("{n} završenih", { n: String(n.zavrseno) })}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                                <span className="text-muted-foreground">{t("Ukupno")}</span>
                                <span className="font-extrabold text-foreground">{mektebStatsAll.global.ukupnoLekcijaZavrseno}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="bg-white rounded-2xl border border-border/50 p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-4 h-4 text-violet-600" />
                            <h4 className="font-bold text-sm text-foreground">{t("Aktivnost učenika")}</h4>
                          </div>
                          <div className="text-2xl font-extrabold text-violet-600">{formatScreentime(mektebStatsAll.global.ukupnoScreentimeSec)}</div>
                          <div className="text-sm text-muted-foreground mt-1">{t("Ukupno aktivno vrijeme svih učenika na platformi")}</div>
                        </div>
                      </div>

                      <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
                          <h4 className="font-extrabold text-foreground flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" /> {t("Muallimi")}
                          </h4>
                          <span className="text-xs text-muted-foreground">{(mektebStatsAll.muallimi ?? []).length} {t("muallima")}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="border-b border-border/50 bg-muted/20">
                              <tr>
                                {[t("Muallim"), t("Grupa"), t("Učenika"), t("Prisustvo"), t("Prosj. ocjena"), t("Kvizovi"), t("Bodovi"), t("Zvjezdice")].map(h => (
                                  <th key={h} className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(mektebStatsAll.muallimi ?? []).map((m, i) => (
                                <motion.tr key={m.muallimId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                  className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                                  onClick={() => otvoriStatMuallima(m.muallimId)}
                                  data-testid={`row-stat-muallim-${m.muallimId}`}>
                                  <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {m.displayName}
                                      {m.isGlavni && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{t("glavni")}</span>}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-sm font-medium text-foreground">{m.brojGrupa}</td>
                                  <td className="px-3 py-3 text-sm font-medium text-foreground">{m.ukupnoUcenika}</td>
                                  <td className="px-3 py-3">
                                    {m.prisustvoPct !== null ? (
                                      <span className={`text-sm font-bold ${m.prisustvoPct >= 80 ? "text-emerald-600" : m.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>{m.prisustvoPct}%</span>
                                    ) : <span className="text-sm text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-3 py-3 text-sm font-extrabold text-foreground">{m.prosjekOcjena ?? "—"}</td>
                                  <td className="px-3 py-3 text-sm font-medium text-foreground">{m.ukupnoKvizova}</td>
                                  <td className="px-3 py-3 text-sm font-extrabold text-amber-600">{m.ukupnoBodova}</td>
                                  <td className="px-3 py-3 whitespace-nowrap">
                                    <span className="text-sm font-extrabold text-amber-600">★ {m.zvjezdicePozitivne}</span>
                                    <span className="text-sm font-extrabold text-slate-800 ml-2">★ {m.zvjezdiceNegativne}</span>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                ) : statNivo === "muallim" ? (
                  mektebStatsLoading && !statMuallimGlobal ? (
                    <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                  ) : statMuallimGlobal ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          {t("{ime} — zbir i prosjek grupa", { ime: statMuallimNaziv })}
                        </h3>
                        <Button onClick={() => setLocation(`/muallim/izvjestaj/svi${statIzvjestajQuery}`)}
                          className="rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 flex items-center gap-2">
                          <Printer className="w-4 h-4" /> {t("Štampaj sve učenike")}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-primary/5 border border-border/50 rounded-2xl p-5">
                          <Users className="w-5 h-5 text-primary mb-2" />
                          <div className="text-2xl font-extrabold text-primary">{statMuallimGlobal.ukupnoUcenika}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Učenika u {n} grupa", { n: String(statMuallimGlobal.ukupnoGrupa) })}</div>
                        </div>
                        <div className="bg-emerald-50 border border-border/50 rounded-2xl p-5">
                          <CalendarCheck className="w-5 h-5 text-emerald-600 mb-2" />
                          <div className="text-2xl font-extrabold text-emerald-600">{statMuallimGlobal.ukupnoCasova}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Održanih časova")}</div>
                        </div>
                        <div className={`border border-border/50 rounded-2xl p-5 ${statMuallimGlobal.prosjekPrisustva !== null && statMuallimGlobal.prosjekPrisustva >= 80 ? "bg-emerald-50" : statMuallimGlobal.prosjekPrisustva !== null && statMuallimGlobal.prosjekPrisustva >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                          <Target className="w-5 h-5 mb-2 text-foreground/60" />
                          <div className={`text-2xl font-extrabold ${statMuallimGlobal.prosjekPrisustva !== null && statMuallimGlobal.prosjekPrisustva >= 80 ? "text-emerald-600" : statMuallimGlobal.prosjekPrisustva !== null && statMuallimGlobal.prosjekPrisustva >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {statMuallimGlobal.prosjekPrisustva !== null ? `${statMuallimGlobal.prosjekPrisustva}%` : "—"}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Prosj. prisustvo")}</div>
                        </div>
                        <div className="bg-violet-50 border border-border/50 rounded-2xl p-5">
                          <Star className="w-5 h-5 text-violet-600 mb-2" />
                          <div className="text-2xl font-extrabold text-violet-600">{statMuallimGlobal.prosjekOcjena ?? "—"}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Prosj. ocjena")}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        {mektebStats && statMuallimId == null && (
                          <div className="bg-blue-50 border border-border/50 rounded-2xl p-5">
                            <BookOpen className="w-5 h-5 text-blue-600 mb-2" />
                            <div className="text-2xl font-extrabold text-blue-600">{mektebStats.global.ukupnoLekcijaZavrseno}</div>
                            <div className="text-sm text-muted-foreground font-medium">{t("Završenih lekcija")}</div>
                            <div className="text-xs text-muted-foreground/70 mt-1">{t("prosj. {n} po učeniku", { n: String(mektebStats.global.prosjekLekcijaPoUceniku) })}</div>
                          </div>
                        )}
                        <div className="bg-amber-50 border border-border/50 rounded-2xl p-5">
                          <Award className="w-5 h-5 text-amber-600 mb-2" />
                          <div className="text-2xl font-extrabold text-amber-600">{statMuallimGlobal.ukupnoKvizova}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Urađenih kvizova")}</div>
                        </div>
                        <div className="bg-rose-50 border border-border/50 rounded-2xl p-5">
                          <Heart className="w-5 h-5 text-rose-600 mb-2" />
                          <div className="text-2xl font-extrabold text-rose-600">{statMuallimGlobal.ukupnoBodova}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Ukupno bodova")}</div>
                        </div>
                        <div className="bg-amber-50 border border-border/50 rounded-2xl p-5">
                          <Star className="w-5 h-5 text-amber-500 mb-2" />
                          <div className="flex items-baseline gap-3">
                            <span className="text-2xl font-extrabold text-amber-600">★ {statMuallimGlobal.zvjezdicePozitivne}</span>
                            <span className="text-2xl font-extrabold text-slate-800">★ {statMuallimGlobal.zvjezdiceNegativne}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Žute / crne zvjezdice")}</div>
                        </div>
                      </div>

                      <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between">
                          <h4 className="font-extrabold text-foreground flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-primary" /> {t("Grupe")}
                          </h4>
                          <span className="text-xs text-muted-foreground">{statMuallimGrupe.length} {t("grupa")}</span>
                        </div>
                        {statMuallimGrupe.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground">{t("Nema aktivnih grupa")}</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  {[t("Grupa"), t("Učenika"), t("Časova"), t("Prisustvo"), t("Prosj. ocjena"), t("Kvizovi"), t("Bodovi"), t("Zvjezdice")].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {statMuallimGrupe.map((g, i) => (
                                  <motion.tr key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                    className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                                    onClick={() => otvoriStatGrupu(g.id)}
                                    data-testid={`row-stat-grupa-${g.id}`}>
                                    <td className="px-3 py-3 font-bold text-foreground whitespace-nowrap">{g.naziv}</td>
                                    <td className="px-3 py-3 text-sm font-medium text-foreground">{g.ukupnoUcenika}</td>
                                    <td className="px-3 py-3 text-sm font-medium text-foreground">{g.ukupnoCasova}</td>
                                    <td className="px-3 py-3">
                                      {g.prisustvoPct !== null ? (
                                        <span className={`text-sm font-bold ${g.prisustvoPct >= 80 ? "text-emerald-600" : g.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>{g.prisustvoPct}%</span>
                                      ) : <span className="text-sm text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-sm font-extrabold text-foreground">{g.prosjekOcjena ?? "—"}</td>
                                    <td className="px-3 py-3 text-sm font-medium text-foreground">{g.ukupnoKvizova}</td>
                                    <td className="px-3 py-3 text-sm font-extrabold text-amber-600">{g.ukupnoBodova}</td>
                                    <td className="px-3 py-3 whitespace-nowrap">
                                      <span className="text-sm font-extrabold text-amber-600">★ {g.zvjezdicePozitivne ?? 0}</span>
                                      <span className="text-sm font-extrabold text-slate-800 ml-2">★ {g.zvjezdiceNegativne ?? 0}</span>
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                      <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="font-bold text-foreground">{t("Nema podataka za prikaz")}</p>
                    </div>
                  )
                ) : statNivo === "ucenik" && statData ? (() => {
                  const u = statData.ucenici.find(u => u.id === statUcenikId);
                  if (!u) return (
                    <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                      <p className="font-bold text-foreground">{t("Učenik nije pronađen")}</p>
                    </div>
                  );
                  return (
                    <div className="space-y-6">
                      {/* Zaglavlje */}
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          {u.ime}
                        </h3>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button
                            onClick={() => setLocation(`/muallim/ucenik/${u.id}`)}
                            className="rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 flex items-center gap-2">
                            <Eye className="w-4 h-4" /> {t("Puni profil")}
                          </Button>
                          <button onClick={nazadNaStatGrupu}
                            className="text-sm text-muted-foreground hover:text-foreground font-medium">
                            {t("← Nazad na grupu")}
                          </button>
                        </div>
                      </div>

                      {/* Karte — ključni pokazatelji */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className={`border border-border/50 rounded-2xl p-5 ${u.prisustvoPct !== null && u.prisustvoPct >= 80 ? "bg-emerald-50" : u.prisustvoPct !== null && u.prisustvoPct >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                          <CalendarCheck className={`w-5 h-5 mb-2 ${u.prisustvoPct !== null && u.prisustvoPct >= 80 ? "text-emerald-600" : u.prisustvoPct !== null && u.prisustvoPct >= 50 ? "text-amber-600" : "text-red-500"}`} />
                          <div className={`text-2xl font-extrabold ${u.prisustvoPct !== null && u.prisustvoPct >= 80 ? "text-emerald-600" : u.prisustvoPct !== null && u.prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {u.prisustvoPct !== null ? `${u.prisustvoPct}%` : "—"}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Prisustvo")}</div>
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            {u.prisutanCount}P · {u.odsutanCount}O · {u.zakasnioCount}Z · {u.opravdanCount}OP
                          </div>
                        </div>
                        <div className="bg-violet-50 border border-border/50 rounded-2xl p-5">
                          <Star className="w-5 h-5 text-violet-600 mb-2" />
                          <div className="text-2xl font-extrabold text-violet-600">
                            {u.ukupnaProsjecna !== null ? u.ukupnaProsjecna : "—"}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Prosj. ocjena")}</div>
                          {u.brojOcjena > 0 && <div className="text-xs text-muted-foreground/70 mt-1">{u.brojOcjena} {t("ocjena")}</div>}
                        </div>
                        <div className="bg-amber-50 border border-border/50 rounded-2xl p-5">
                          <Award className="w-5 h-5 text-amber-600 mb-2" />
                          <div className="text-2xl font-extrabold text-amber-600">{u.ukupnoBodova || 0}</div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Bodova")}</div>
                          {u.kvizCount > 0 && (
                            <div className="text-xs text-muted-foreground/70 mt-1">
                              {u.kvizCount} {t("kvizova")}
                              {u.kvizProsjecniProcenat !== null && ` · ${u.kvizProsjecniProcenat}%`}
                            </div>
                          )}
                        </div>
                        <div className="bg-amber-50 border border-border/50 rounded-2xl p-5">
                          <Sparkles className="w-5 h-5 text-amber-500 mb-2" />
                          <div className="flex items-baseline gap-3">
                            <span className="text-2xl font-extrabold text-amber-600">★ {u.zvjezdicePozitivne ?? 0}</span>
                            <span className="text-2xl font-extrabold text-slate-800">★ {u.zvjezdiceNegativne ?? 0}</span>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">{t("Žute / crne zvjezdice")}</div>
                        </div>
                      </div>

                      {/* Prisustvo po datumima */}
                      {Object.keys(u.prisustvoPoDatumu).length > 0 && (
                        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                            <h4 className="font-extrabold text-foreground flex items-center gap-2">
                              <CalendarCheck className="w-4 h-4 text-primary" /> {t("Prisustvo po datumima")}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">{t("P = Prisutan, O = Odsutan, Z = Zakasnio, OP = Opravdan")}</p>
                          </div>
                          <div className="p-4 flex flex-wrap gap-2">
                            {statData.svaDatumi.map(d => {
                              const st = u.prisustvoPoDatumu[d];
                              if (!st) return null;
                              const cls = st === "prisutan" ? "bg-emerald-500 text-white" : st === "odsutan" ? "bg-red-500 text-white" : st === "zakasnio" ? "bg-amber-400 text-white" : "bg-blue-400 text-white";
                              const label = st === "prisutan" ? "P" : st === "odsutan" ? "O" : st === "zakasnio" ? "Z" : "OP";
                              const parts = d.split("-");
                              return (
                                <div key={d} className="flex flex-col items-center gap-0.5">
                                  <span className={`inline-block w-8 h-8 leading-8 rounded-md text-xs font-bold text-center ${cls}`}>{label}</span>
                                  <span className="text-[10px] text-muted-foreground font-medium">{parts[2]}.{parts[1]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Ocjene po kategorijama */}
                      {Object.keys(u.prosjecneOcjene).length > 0 && (
                        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                            <h4 className="font-extrabold text-foreground flex items-center gap-2">
                              <Star className="w-4 h-4 text-violet-600" /> {t("Ocjene po kategorijama")}
                            </h4>
                          </div>
                          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(u.prosjecneOcjene).map(([kat, ocj]) => (
                              <div key={kat} className="bg-muted/20 rounded-xl p-3">
                                <div className="text-xs text-muted-foreground font-medium mb-1">{kat}</div>
                                <div className={`text-xl font-extrabold ${ocj >= 4 ? "text-emerald-600" : ocj >= 2.5 ? "text-amber-600" : "text-red-600"}`}>{ocj}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Prisustvo po mjesecima */}
                      {u.mjesecnoStats.length > 0 && (
                        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                          <div className="px-4 py-3 bg-muted/30 border-b border-border/30">
                            <h4 className="font-extrabold text-foreground flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary" /> {t("Prisustvo po mjesecima")}
                            </h4>
                          </div>
                          <div className="p-4 space-y-3">
                            {u.mjesecnoStats.map(m => {
                              const parts = m.mjesec.split("-");
                              const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
                              return (
                                <div key={m.mjesec} className="flex items-center gap-4">
                                  <span className="w-24 text-sm font-bold text-foreground">{naziv}</span>
                                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                                    {m.pct !== null && (
                                      <div className={`h-full rounded-full ${m.pct >= 80 ? "bg-emerald-500" : m.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                        style={{ width: `${m.pct}%` }} />
                                    )}
                                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground/70">
                                      {m.prisutan}/{m.ukupno}
                                    </span>
                                  </div>
                                  <span className={`w-12 text-right font-extrabold text-sm ${m.pct !== null && m.pct >= 80 ? "text-emerald-600" : m.pct !== null && m.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                    {m.pct !== null ? `${m.pct}%` : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : statLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : statData ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary" />
                        {statGrupaNaziv} {t("— Izvještaji")}
                      </h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button onClick={() => setLocation(`/muallim/izvjestaj/grupa/${statGrupaId}`)}
                          className="rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 flex items-center gap-2"
                          data-testid="btn-stampaj-izvjestaj-grupe">
                          <Printer className="w-4 h-4" /> {t("Štampaj izvještaj")}
                        </Button>
                        <Button onClick={() => exportExcel(statGrupaId!)} disabled={exportingExcel}
                          className="rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
                          {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileSpreadsheet className="w-4 h-4" /> {t("Excel izvještaj")}</>}
                        </Button>
                        <button onClick={nazadNaStatMuallima}
                          className="text-sm text-muted-foreground hover:text-foreground font-medium">{t("← Nazad na grupe")}</button>
                      </div>
                    </div>

                    <section className="bg-teal-50/60 border border-teal-200 rounded-2xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-extrabold text-teal-950 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-teal-700" /> {t("Gdje učenici zapinju u lekcijama")}
                          </h4>
                          <p className="text-xs text-teal-800 mt-1">{t("Privatni pedagoški pregled — odvojen od ocjena, bodova i zvjezdica.")}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setLocation(`/muallim/grupa/${statGrupaId}`)}
                          className="rounded-xl border-teal-300 bg-white text-teal-900">
                          {t("Otvori grupu")}
                        </Button>
                      </div>
                      {!interaktivniStatPregled?.ukupnoPokusaja ? (
                        <p className="text-sm text-teal-900/70 mt-4">{t("Još nema zabilježenih odgovora iz ugrađenih pitanja lekcija.")}</p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-bold text-teal-900">
                            {interaktivniStatPregled.ukupnoPokusaja} {t("pokušaja")} · {interaktivniStatPregled.prosjekTacnosti}% {t("tačno")}
                          </p>
                          {interaktivniStatPregled.pitanja.slice(0, 3).map((p, index) => (
                            <div key={`${p.lekcijaNaslov}-${index}`} className="rounded-xl bg-white/80 px-3 py-2 text-sm">
                              <span className="font-bold text-foreground">{p.pitanjeTekst}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {t("{n} pogrešnih od {ukupno}", { n: String(p.netacniPokusaji), ukupno: String(p.brojPokusaja) })}
                                {` · ${t("prosječno: {n} s", { n: String(p.prosjekVrijemeSekundi) })}`}
                                {p.tacnoNakonPonovnogCitanja ? ` · ${t("nakon čitanja: {n}", { n: String(p.tacnoNakonPonovnogCitanja) })}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-primary/5 border border-border/50 rounded-2xl p-5">
                        <Users className="w-5 h-5 text-primary mb-2" />
                        <div className="text-2xl font-extrabold text-primary">{statData.ucenici.length}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Učenika")}</div>
                      </div>
                      <div className="bg-emerald-50 border border-border/50 rounded-2xl p-5">
                        <CalendarCheck className="w-5 h-5 text-emerald-600 mb-2" />
                        <div className="text-2xl font-extrabold text-emerald-600">{statData.ukupnoCasova}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Održanih časova")}</div>
                      </div>
                      <div className={`border border-border/50 rounded-2xl p-5 ${statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 80 ? "bg-emerald-50" : statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                        <Target className="w-5 h-5 mb-2 text-foreground/60" />
                        <div className={`text-2xl font-extrabold ${statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 80 ? "text-emerald-600" : statData.grupaPrisustvoPct !== null && statData.grupaPrisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                          {statData.grupaPrisustvoPct !== null ? `${statData.grupaPrisustvoPct}%` : "—"}
                        </div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Prisustvo grupe")}</div>
                      </div>
                      <div className="bg-violet-50 border border-border/50 rounded-2xl p-5">
                        <Star className="w-5 h-5 text-violet-600 mb-2" />
                        <div className="text-2xl font-extrabold text-violet-600">{statData.grupaProsjekOcjena || "—"}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Prosj. ocjena grupe")}</div>
                      </div>
                      <div className="bg-amber-50 border border-border/50 rounded-2xl p-5">
                        <Star className="w-5 h-5 text-amber-500 mb-2" />
                        <div className="flex items-baseline gap-3">
                          <span className="text-2xl font-extrabold text-amber-600">★ {statData.zvjezdicePozitivne ?? 0}</span>
                          <span className="text-2xl font-extrabold text-slate-800">★ {statData.zvjezdiceNegativne ?? 0}</span>
                        </div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Žute / crne zvjezdice")}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 bg-muted/30 rounded-xl p-1">
                      {([
                        { id: "pregled" as const, label: t("Zbirni pregled"), icon: BarChart3 },
                        { id: "prisustvo" as const, label: t("Prisustvo po datumima"), icon: CalendarCheck },
                        { id: "mjesecno" as const, label: t("Mjesečni pregled"), icon: Calendar },
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
                              <Users className="w-4 h-4 text-primary" /> {t("Pregled učenika")}
                            </h4>
                            <span className="text-xs text-muted-foreground">{statData.ucenici.length} {t("učenika")}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  {[t("Učenik"), t("Prisustvo"), t("P"), t("O"), t("Z"), t("OP"), t("Prosj. ocjena"), t("Kvizovi"), t("Bodovi"), t("Zvjezdice")].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {statData.ucenici.map((u, i) => (
                                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                    className="border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer"
                                    onClick={() => otvoriStatUcenika(u.id)}
                                    data-testid={`row-stat-ucenik-${u.id}`}>
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
                                    <td className="px-3 py-3 whitespace-nowrap">
                                      <span className="text-sm font-extrabold text-amber-600">★ {u.zvjezdicePozitivne ?? 0}</span>
                                      <span className="text-sm font-extrabold text-slate-800 ml-2">★ {u.zvjezdiceNegativne ?? 0}</span>
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
                              <CalendarCheck className="w-4 h-4" /> {t("Upozorenje — slabo prisustvo")}
                            </h4>
                            <div className="space-y-1">
                              {statData.ucenici.filter(u => u.prisustvoPct !== null && u.prisustvoPct < 50).map(u => (
                                <p key={u.id} className="text-sm text-red-700">
                                  <span className="font-bold">{u.ime}</span> {t("— prisustvo {pct}% ({prisutan}/{ukupno} časova)", { pct: String(u.prisustvoPct), prisutan: String(u.prisutanCount), ukupno: String(u.ukupnoPrisustvo) })}
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
                            <CalendarCheck className="w-4 h-4 text-primary" /> {t("Matrica prisustva — svi datumi")}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">{t("P = Prisutan, O = Odsutan, Z = Zakasnio, OP = Opravdan")}</p>
                        </div>
                        {statData.svaDatumi.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground">{t("Nema evidentiranog prisustva")}</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-extrabold uppercase text-muted-foreground sticky left-0 bg-white z-20 min-w-[140px] shadow-[1px_0_0_0_hsl(var(--border))]">{t("Učenik")}</th>
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
                                    <td className="px-3 py-2 font-bold text-foreground sticky left-0 bg-white z-10 whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]">{u.ime}</td>
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
                                  <td className="px-3 py-2 font-extrabold text-foreground sticky left-0 bg-white z-20 shadow-[1px_0_0_0_hsl(var(--border))]">{t("UKUPNO")}</td>
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
                              <Calendar className="w-4 h-4 text-primary" /> {t("Prisustvo po mjesecima — grupa")}
                            </h4>
                          </div>
                          {statData.mjesecniPregled.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">{t("Nema podataka")}</div>
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
                              <Users className="w-4 h-4 text-primary" /> {t("Prisustvo po mjesecima — učenici")}
                            </h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-border/50 bg-muted/20">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-extrabold uppercase text-muted-foreground min-w-[140px]">{t("Učenik")}</th>
                                  {statData.mjesecniPregled.map(m => {
                                    const parts = m.mjesec.split("-");
                                    return <th key={m.mjesec} className="px-3 py-2 text-center text-xs font-bold text-muted-foreground">{MJESEC_NAZIVI[parts[1]]} {parts[0].slice(2)}</th>;
                                  })}
                                  <th className="px-3 py-2 text-center text-xs font-extrabold uppercase text-muted-foreground">{t("Ukupno")}</th>
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

            {/* PODEŠAVANJA MEKTEBA — samo glavni muallim */}
            {activeTab === "profil" && canManageMekteb && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-white to-secondary/10 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <School className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-foreground">{t("Muallimi mekteba")}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">{t("Upravljajte timom, pristupima i zajedničkim dokumentima mekteba.")}</p>
                      </div>
                    </div>
                    {mektebInfo && (
                      <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${mektebInfo.slobodnoMjesta > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {mektebInfo.slobodnoMjesta > 0
                          ? t("{n} slobodno", { n: String(mektebInfo.slobodnoMjesta) })
                          : t("popunjeno")}
                      </span>
                    )}
                  </div>
                  {mektebInfo && (
                    <p className="mt-4 border-t border-primary/10 pt-3 text-sm text-muted-foreground">
                      {mektebInfo.naziv} · {t("{broj}/{dozvoljeno} naloga iskorišteno", { broj: String(mektebInfo.brojMuallima), dozvoljeno: String(mektebInfo.dozvoljenoMuallima) })}
                    </p>
                  )}
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
                <div className="bg-white rounded-2xl border border-border/50 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-extrabold text-sm text-foreground">{t("Pregled po muallimu")}</h3>
                </div>
                  <p className="mb-4 text-xs text-muted-foreground">{t("Otvorite pregled grupa i učenika svakog člana tima bez promjene svog naloga.")}</p>
                  <div className="grid grid-flow-col auto-cols-[minmax(190px,1fr)] gap-2 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-2 sm:auto-cols-auto">
                  {(mektebMuallimi || []).map(m => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => openMuallimPreview(m.userId)}
                        className="min-w-[190px] text-left rounded-xl border border-border/60 bg-gradient-to-br from-white to-muted/20 px-3 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      data-testid={`tab-muallim-${m.userId}`}
                    >
                      <span className="block text-sm font-extrabold text-foreground truncate">{m.displayName}</span>
                      <span className="block text-xs text-muted-foreground mt-1">
                        {m.brojGrupa} {t("grupa")} · {m.brojUcenika} {t("učenika")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary mt-2">
                        <Eye className="w-3.5 h-3.5" /> {t("Otvori pregled")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

                <div className="h-fit rounded-2xl border border-primary/20 bg-white p-5 shadow-sm xl:sticky xl:top-6 space-y-3">
                  <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><UserPlus className="w-4 h-4 text-primary" /></div><h3 className="font-extrabold text-sm text-foreground">{t("Dodaj muallima")}</h3></div>
                  <p className="text-xs text-muted-foreground">{t("Sistem će generisati korisničko ime i šifru koje proslijedite kolegi. Šifra se prikazuje samo jednom.")}</p>
                  <div className="flex flex-col gap-2">
                    <input
                      value={novMuallimIme}
                      onChange={e => setNovMuallimIme(e.target.value)}
                      placeholder={t("Ime i prezime muallima")}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 text-sm"
                      data-testid="input-nov-muallim"
                    />
                    <button
                      onClick={handleKreirajMuallima}
                      disabled={muallimSaving || !novMuallimIme.trim() || (mektebInfo ? mektebInfo.slobodnoMjesta <= 0 : false)}
                      className="w-full px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      data-testid="button-kreiraj-muallim"
                    >
                      {muallimSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("Kreiraj")}
                    </button>
                  </div>
                  {mektebInfo && mektebInfo.slobodnoMjesta <= 0 && (
                    <p className="text-xs text-amber-600 font-medium">{t("Dostigli ste maksimalan broj muallima za vaš paket.")}</p>
                  )}
                  {kreiranMuallim && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm"><KeyRound className="w-4 h-4" /> {t("Nalog kreiran — zapišite podatke")}</div>
                      <div className="text-sm"><span className="text-muted-foreground">{t("Ime:")}</span> <b>{kreiranMuallim.displayName}</b></div>
                      <div className="text-sm"><span className="text-muted-foreground">{t("Korisničko ime:")}</span> <b>{kreiranMuallim.username}</b></div>
                      <div className="text-sm"><span className="text-muted-foreground">{t("Šifra:")}</span> <b>{kreiranMuallim.generatedPassword}</b></div>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(`${t("Muallim:")} ${kreiranMuallim.displayName}\n${t("Korisničko ime:")} ${kreiranMuallim.username}\n${t("Šifra:")} ${kreiranMuallim.generatedPassword}`); toast({ title: t("Kopirano"), description: t("Podaci za prijavu su kopirani.") }); }}
                        className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:underline"
                        data-testid="button-kopiraj-kredencijale"
                      >
                        <Copy className="w-3.5 h-3.5" /> {t("Kopiraj podatke")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="xl:col-span-2 rounded-2xl border border-border/50 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-secondary" />
                      <h3 className="font-extrabold text-sm text-foreground">{t("Muallimi mekteba")}</h3>
                    </div>
                    {mektebMuallimi && <span className="text-xs font-bold text-muted-foreground">{mektebMuallimi.length} {t("ukupno")}</span>}
                  </div>
                  {mektebMuallimi === null ? (
                    <Skeleton className="h-20 rounded-2xl" />
                  ) : mektebMuallimi.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">{t("Još nema muallima.")}</div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                    {mektebMuallimi.map(m => (
                      <div key={m.userId} className="bg-white rounded-2xl border border-border/50 overflow-hidden" data-testid={`muallim-red-${m.userId}`}>
                        {editingMuallimId === m.userId ? (
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="w-4 h-4 text-secondary" />
                              <span className="text-xs text-muted-foreground font-medium">{m.username}</span>
                            </div>
                            {editMuallimNewPass ? (
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                                <div className="text-xs text-emerald-700 font-bold">{t("Nova šifra — zapišite")}</div>
                                <div className="font-mono font-bold text-foreground text-base">{editMuallimNewPass}</div>
                                <button
                                  onClick={() => { navigator.clipboard?.writeText(editMuallimNewPass!); toast({ title: t("Kopirano") }); }}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                                >
                                  <Copy className="w-3 h-3" /> {t("Kopiraj")}
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  value={editMuallimName}
                                  onChange={e => setEditMuallimName(e.target.value)}
                                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  placeholder={t("Ime i prezime")}
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" onClick={() => handleEditMuallima(m.userId, { displayName: editMuallimName })} disabled={editMuallimSaving || !editMuallimName.trim()} className="rounded-xl text-xs h-8">
                                    {editMuallimSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                                    {t("Sačuvaj ime")}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleEditMuallima(m.userId, { resetPassword: true })} disabled={editMuallimSaving} className="rounded-xl text-xs h-8 border-amber-300 text-amber-700 hover:bg-amber-50">
                                    <KeyRound className="w-3.5 h-3.5 mr-1" /> {t("Resetuj šifru")}
                                  </Button>
                                </div>
                              </>
                            )}
                            <button onClick={() => { setEditingMuallimId(null); setEditMuallimNewPass(null); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <X className="w-3 h-3" /> {t("Zatvori")}
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center"><GraduationCap className="w-5 h-5 text-secondary" /></div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-foreground flex items-center gap-2">
                                {m.displayName}
                                {m.isGlavni && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-extrabold">{t("GLAVNI")}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground">{m.username} · {t("{grupa} grupa · {ucenika} učenika", { grupa: String(m.brojGrupa), ucenika: String(m.brojUcenika) })}</div>
                            </div>
                            {!m.isGlavni && (
                              <>
                                <button onClick={() => { setEditingMuallimId(m.userId); setEditMuallimName(m.displayName); setEditMuallimNewPass(null); }} className="p-2 rounded-lg text-primary hover:bg-primary/10" title={t("Uredi muallima")} data-testid={`button-uredi-muallim-${m.userId}`}>
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleObrisiMuallima(m.userId, m.displayName)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50" title={t("Obriši muallima")} data-testid={`button-obrisi-muallim-${m.userId}`}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    </div>
                  )}
                </div>
                </div>
              </motion.div>
            )}

            {/* DOKUMENTI MEKTEBA — samo glavni muallim */}
            {activeTab === "profil" && canManageMekteb && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
                {/* DOKUMENTI — pravila, kućni red, obavještenja (PDF) */}
                <div className="bg-white rounded-2xl border border-border/50 p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><FileText className="w-4 h-4 text-primary" /></div>
                    <div>
                      <h3 className="font-extrabold text-sm text-foreground">{t("Dokumenti mekteba")}</h3>
                      <p className="text-xs text-muted-foreground">{t("Zajednički dokumenti dostupni svim porodicama u mektebu.")}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">
                    {t("Dodajte PDF dokumente (pravila, kućni red, obavještenja). Vidljivi su svim učenicima i roditeljima u mektebu.")}
                  </p>

                  <div className="rounded-xl border border-dashed border-primary/25 bg-primary/[0.03] p-4 mb-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={dokNaziv}
                        onChange={e => setDokNaziv(e.target.value)}
                        placeholder={t("Naziv dokumenta (npr. Kućni red)")}
                        className="w-full rounded-lg border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        type="text"
                        value={dokOpis}
                        onChange={e => setDokOpis(e.target.value)}
                        placeholder={t("Kratak opis (neobavezno)")}
                        className="w-full rounded-lg border border-border/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-border/60 bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        {dokFile ? dokFile.name : t("Odaberi PDF")}
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={e => setDokFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <button
                        onClick={handleUploadDokument}
                        disabled={!dokFile || !dokNaziv.trim() || dokUploading}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-all"
                      >
                        {dokUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {t("Dodaj dokument")}
                      </button>
                      <span className="text-xs text-muted-foreground">{t("Samo PDF, do 20 MB.")}</span>
                    </div>
                  </div>

                  {mektebDokumenti === null ? (
                    <div className="flex flex-col gap-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                  ) : mektebDokumenti.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">{t("Još nema dodanih dokumenata.")}</p>
                  ) : (
                    <div className="space-y-2">
                      {mektebDokumenti.map(d => (
                        <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-foreground truncate">{d.naziv}</div>
                            {d.opis && <div className="text-xs text-muted-foreground truncate">{d.opis}</div>}
                            <div className="text-xs text-muted-foreground/70 mt-0.5">{formatFileSize(d.fileSize)}</div>
                          </div>
                          <button
                            onClick={() => openAuthorizedFile(`/muallim/mekteb/dokumenti/${d.id}/file`, token).catch((e: any) => toast({ title: t("Greška"), description: e?.message || t("Otvaranje nije uspjelo"), variant: "destructive" }))}
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/50"
                          >
                            <Download className="w-3.5 h-3.5" /> {t("Otvori")}
                          </button>
                          <button
                            onClick={() => handleDeleteDokument(d.id)}
                            className="inline-flex items-center justify-center rounded-lg border border-destructive/30 text-destructive p-1.5 hover:bg-destructive/10"
                            aria-label={t("Obriši dokument")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* ZADAĆE */}
            {activeTab === "zadace" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {!zadGrupaId ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                    <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-bold text-foreground mb-2">{t("Odaberi grupu za zadaće")}</p>
                    <div className="flex flex-wrap gap-3 justify-center mt-6">
                      {grupe.filter(g => !g.isArchived).map(g => (
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
                        {t("Zadaće:")} {grupe.find(g => g.id === zadGrupaId)?.naziv}
                      </h3>
                      <button onClick={() => { setZadGrupaId(null); setZadace([]); setZadUcenikIds(new Set()); setShowZadForm(false); }}
                        className="text-sm text-muted-foreground hover:text-foreground font-medium">{t("← Promijeni grupu")}</button>
                    </div>

                    {/* Vrsta zadaće: pojedinačna ili za cijelu grupu */}
                    {(() => {
                      const pojedinacne = zadace.filter(z => (z.ucenikIds?.length ?? 0) > 0);
                      const zaSve = zadace.filter(z => !z.ucenikIds?.length);
                      return (
                        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1.5">
                          {([
                            { id: "pojedinacno" as const, label: t("Pojedinačne"), broj: pojedinacne.length },
                            { id: "svi" as const, label: t("Svi"), broj: zaSve.length },
                          ]).map(tab => {
                            const aktivan = zadTipTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                  setZadTipTab(tab.id);
                                   setZadDodjela(tab.id);
                                  setEditingZadaca(null);
                                  setShowZadForm(false);
                                  setZadSubTab("utoku");
                                  if (tab.id === "svi") setZadUcenikIds(new Set());
                                }}
                                className={`rounded-xl px-4 py-3 text-sm font-extrabold transition-all ${aktivan ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                {tab.label}
                                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${aktivan ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{tab.broj}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Pod-tabovi: Nova zadaća / U toku / Završeno */}
                    {(() => {
                      const zadacePoTipu = zadace.filter(z => zadTipTab === "svi" ? !z.ucenikIds?.length : (z.ucenikIds?.length ?? 0) > 0);
                      const uTokuBroj = zadacePoTipu.filter(z => z.isActive !== false && !z.completed).length;
                      const zavrsenoBroj = zadacePoTipu.filter(z => z.completed || z.isActive === false).length;
                      const tabovi: { id: "nova" | "utoku" | "zavrseno"; label: string; broj?: number }[] = [
                        { id: "nova", label: t("Nova zadaća") },
                        { id: "utoku", label: t("U toku"), broj: uTokuBroj },
                        { id: "zavrseno", label: t("Završeno"), broj: zavrsenoBroj },
                      ];
                      return (
                        <div className="flex flex-wrap gap-2">
                          {tabovi.map(t => {
                            const aktivan = zadSubTab === t.id;
                            return (
                              <button key={t.id} onClick={() => { setZadSubTab(t.id); if (t.id === "nova") setShowZadForm(true); }}
                                className={`rounded-xl px-4 py-2.5 text-sm font-bold border transition-colors flex items-center gap-2 ${aktivan ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:bg-muted/40"}`}>
                                {t.id === "nova" && <Plus className="w-4 h-4" />}
                                {t.label}
                                {typeof t.broj === "number" && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${aktivan ? "bg-white/25" : "bg-muted text-muted-foreground"}`}>{t.broj}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {zadSubTab === "nova" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="bg-white border border-border/50 rounded-2xl p-4 sm:p-5">
                        <h4 className="font-extrabold text-foreground mb-4 flex items-center gap-2">
                          {editingZadaca ? <Pencil className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                          {editingZadaca ? t("Uredi zadaću") : t("Nova zadaća")}
                        </h4>
                        {editingZadaca && (
                          <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                            {t("Promjena roka ovdje važi za sve učenike kojima je zadaća dodijeljena. Individualni rok mijenjaj samo kroz pregled učenika kada za to postoji stvaran razlog.")}
                          </p>
                        )}
                        <div className="grid sm:grid-cols-2 gap-4">
                           <div className="sm:col-span-2">
                             <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Dodjela zadaće")}</label>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                               <button
                                 type="button"
                                 onClick={() => { setZadDodjela("svi"); setZadUcenikIds(new Set()); }}
                                 className={`rounded-xl border px-4 py-3 text-left transition-colors ${zadDodjela === "svi" ? "border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200" : "border-border bg-white text-muted-foreground hover:bg-muted/30"}`}
                               >
                                 <span className="block text-sm font-extrabold">{t("Za sve učenike")}</span>
                                 <span className="block text-xs mt-1 opacity-80">{t("Svi aktivni učenici odabrane grupe")}</span>
                               </button>
                               <button
                                 type="button"
                                 onClick={() => setZadDodjela("pojedinacno")}
                                 className={`rounded-xl border px-4 py-3 text-left transition-colors ${zadDodjela === "pojedinacno" ? "border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-200" : "border-border bg-white text-muted-foreground hover:bg-muted/30"}`}
                               >
                                 <span className="block text-sm font-extrabold">{t("Odabrani učenici")}</span>
                                 <span className="block text-xs mt-1 opacity-80">{t("Jedan ili više učenika")}</span>
                               </button>
                             </div>
                           </div>
                           {zadDodjela === "svi" && (
                            <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                              {t("Ova zadaća bit će dodijeljena svim aktivnim učenicima odabrane grupe.")}
                            </div>
                          )}
                          <div className="sm:col-span-2">
                            <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Lekcija")}</label>
                            <LekcijaPicker
                               lekcije={dostupneLekcije}
                              value={zadLekcija}
                              onChange={setZadLekcija}
                              onSelectLesson={lekcija => {
                                setZadLekcijaSlug(lekcija?.slug || "");
                              }}
                              placeholder={t("Pretraži i odaberi lekciju...")}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Opis (opcionalno)")}</label>
                            <textarea value={zadOpis} onChange={e => setZadOpis(e.target.value)} rows={2}
                              placeholder={t("Detalji zadaće...")}
                              className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Rok do")}</label>
                            <input type="date" value={zadRok} onChange={e => setZadRok(e.target.value)}
                              className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          </div>
                          <div className={`sm:col-span-2 ${zadDodjela === "svi" ? "hidden" : ""}`}>
                            <label className="text-sm font-bold text-muted-foreground block mb-1">
                              {t("Učenici")} {zadUcenikIds.size === 0 ? t("(cijela grupa)") : t("({n} učenik/a)", { n: String(zadUcenikIds.size) })}
                            </label>
                            {(() => {
                              const grupaUcenici = ucenici.filter(u => u.grupaId === zadGrupaId && u.aktivanStatus);
                              if (grupaUcenici.length === 0) {
                                return <p className="text-xs text-muted-foreground italic px-1">{t("U ovoj grupi nema aktivnih učenika.")}</p>;
                              }
                              const allSelected = zadUcenikIds.size === grupaUcenici.length;
                              return (
                                <div className="border border-border rounded-xl p-3 bg-muted/20">
                        <div className="flex flex-col items-start gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-muted-foreground">
                                      {t("Odaberi jednog ili više učenika za pojedinačnu zadaću.")}
                                    </p>
                                    <div className="flex gap-2">
                                      <button type="button" onClick={() => setZadUcenikIds(allSelected ? new Set() : new Set(grupaUcenici.map(u => u.id)))}
                                        className="text-xs font-bold text-primary hover:underline">
                                        {allSelected ? t("Poništi sve") : t("Označi sve")}
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                    {grupaUcenici.map(u => {
                                      const checked = zadUcenikIds.has(u.id);
                                      return (
                                        <label key={u.id}
                                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${checked ? "bg-primary/15" : "hover:bg-muted/40"}`}>
                                          <input type="checkbox" checked={checked}
                                            onChange={() => {
                                              setZadUcenikIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(u.id)) next.delete(u.id); else next.add(u.id);
                                                return next;
                                              });
                                            }}
                                            className="w-4 h-4 accent-primary" />
                                          <span className="text-sm font-medium text-foreground truncate">{u.displayName}</span>
                                          {u.roditeljPovezan && (
                                            <span
                                              className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black border border-emerald-200"
                                              title={t("Roditelj povezan")}
                                              aria-label={t("Roditelj povezan")}
                                              data-testid={`roditelj-povezan-zadaca-${u.id}`}
                                            >
                                              R
                                            </span>
                                          )}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end">
                          <button onClick={() => { setShowZadForm(false); setEditingZadaca(null); setZadSubTab("utoku"); setZadUcenikIds(new Set()); setZadNaslov(""); setZadOpis(""); setZadRok(""); setZadLekcija(""); setZadLekcijaSlug(""); }} className="w-full text-muted-foreground hover:text-foreground text-sm font-medium px-4 py-2 sm:w-auto">
                            {t("Otkaži")}
                          </button>
                          <Button onClick={saveZadaca} disabled={savingZadaca || (!zadLekcija.trim() && !zadOpis.trim()) || (zadDodjela === "pojedinacno" && zadUcenikIds.size === 0)} className="w-full rounded-xl font-bold sm:w-auto">
                            {savingZadaca ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> {editingZadaca ? t("Sačuvaj izmjene") : t("Sačuvaj")}</>}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {zadSubTab !== "nova" && (() => {
                      const zadacePoTipu = zadace.filter(z => zadTipTab === "svi" ? !z.ucenikIds?.length : (z.ucenikIds?.length ?? 0) > 0);
                      const filtrirane = zadacePoTipu.filter(z => zadSubTab === "zavrseno"
                        ? z.completed || z.isActive === false
                        : z.isActive !== false && !z.completed);
                      const praznoTekst = zadSubTab === "zavrseno"
                        ? t("Nema završenih zadaća. Zadaća se prebaci ovdje kad svi učenici budu označeni završenim.")
                        : t("Nema zadaća u toku. Kreiraj novu zadaću.");
                      return filtrirane.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground bg-white rounded-2xl border border-border/50">
                        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">{praznoTekst}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filtrirane.map((z, i) => {
                          const isArchived = z.isActive === false;
                          const isExpired = !z.completed && !isArchived && z.rokDo && new Date(z.rokDo) < new Date();
                          return (
                            <motion.div key={z.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                              className={`bg-white border rounded-2xl p-4 sm:p-5 ${z.completed ? "border-emerald-200 bg-emerald-50/30" : isArchived ? "border-slate-200 bg-slate-50/60" : isExpired ? "border-red-200 bg-red-50/30" : "border-border/50"}`}>
                              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-extrabold text-foreground text-base">{z.naslov}</h4>
                                    {z.completed && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t("Završeno")}</span>}
                                     {isArchived && !z.completed && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1"><Archive className="w-3 h-3" /> {t("Arhivirano")}</span>}
                                     {typeof z.ukupno === "number" && z.ukupno > 0 && (
                                       <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{t("Pregledano: {zavrsenih}/{ukupno}", { zavrsenih: String(z.zavrsenih ?? 0), ukupno: String(z.ukupno) })}</span>
                                     )}
                                     {z.lekcijaSlug && typeof z.lekcijaUkupno === "number" && z.lekcijaUkupno > 0 && (
                                       <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                                         <BookOpen className="w-3 h-3" />
                                         {t("Lekcija: {zavrsenih}/{ukupno}", { zavrsenih: String(z.lekcijaZavrsenih ?? 0), ukupno: String(z.lekcijaUkupno) })}
                                       </span>
                                     )}
                                    {isExpired && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t("Isteklo")}</span>}
                                    {z.ucenikIds && z.ucenikIds.length > 0 ? (
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title={
                                        z.ucenikIds.map(id => ucenici.find(u => u.id === id)?.displayName || `#${id}`).join(", ")
                                      }>{t("Pojedinačno · {n}", { n: String(z.ucenikIds.length) })}</span>
                                    ) : (
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t("Cijela grupa")}</span>
                                    )}
                                  </div>
                                  {z.opis && <p className="text-sm text-muted-foreground mt-1">{z.opis}</p>}
                                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                                    {z.rokDo && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {t("Rok:")} {new Date(z.rokDo).toLocaleDateString("bs-BA")}
                                      </span>
                                    )}
                                    {z.lekcijaNaslov && (() => {
                                      const matchSlug = dostupneLekcije.find(dl => dl.naslov === z.lekcijaNaslov)?.slug;
                                      return matchSlug ? (
                                        <Link href={`/ilmihal/${matchSlug}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                          <BookOpen className="w-3 h-3" /> {z.lekcijaNaslov}
                                        </Link>
                                      ) : (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <BookOpen className="w-3 h-3" /> {z.lekcijaNaslov}
                                        </span>
                                      );
                                    })()}
                                    <span className="text-xs text-muted-foreground">
                                      {t("Kreirano:")} {new Date(z.createdAt).toLocaleDateString("bs-BA")}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto sm:shrink-0">
                                  <Button onClick={() => openPregled(z)} variant="outline" size="sm"
                                    className="rounded-xl font-bold flex items-center gap-1.5">
                                    <Eye className="w-4 h-4" /> {t("Pregled")}
                                  </Button>
                                   <Button onClick={() => openEditZadaca(z)} variant="outline" size="sm"
                                     className="rounded-xl font-bold flex items-center gap-1.5" title={t("Uredi zadaću")}>
                                     <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t("Uredi")}</span>
                                   </Button>
                                   {!z.ucenikIds?.length && z.isActive !== false && (
                                     <Button onClick={() => arhivirajZadacu(z)} variant="outline" size="sm"
                                       className="rounded-xl font-bold flex items-center gap-1.5 text-slate-700" title={t("Arhiviraj zadaću")}>
                                       <Archive className="w-4 h-4" /> <span className="hidden sm:inline">{t("Arhiviraj")}</span>
                                     </Button>
                                   )}
                                  <button onClick={() => deleteZadaca(z.id)}
                                    className="text-red-400 hover:text-red-600 p-2">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                    })()}
                  </div>
                )}

                {/* PREGLED PANEL — cijela grupa, jedan ekran */}
                {pregledZadaca && (
                  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
                    onClick={() => setPregledZadaca(null)}>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                      onClick={e => e.stopPropagation()}
                      className="bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col">
                      <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border/50">
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-foreground text-lg truncate">{pregledZadaca.naslov}</h3>
                           <p className="text-xs text-muted-foreground mt-0.5">
                             {t("Pregled za adresate zadaće — automatski završetak lekcije je odvojen od ručnog pregleda.")}
                           </p>
                           {pregledZadaca.lekcijaSlug && (
                             <div className="flex flex-wrap gap-2 mt-2">
                               <span className="text-xs font-bold px-2 py-1 rounded-lg bg-violet-100 text-violet-700">
                                 {t("Lekcija završena: {zavrsenih}/{ukupno}", {
                                   zavrsenih: String(pregledUcenici.filter(u => u.lekcijaZavrsena).length),
                                   ukupno: String(pregledUcenici.length),
                                 })}
                               </span>
                               <span className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-700">
                                 {t("Ručno pregledano: {zavrsenih}/{ukupno}", {
                                   zavrsenih: String(pregledUcenici.filter(u => u.status === "zavrseno").length),
                                   ukupno: String(pregledUcenici.length),
                                 })}
                               </span>
                             </div>
                           )}
                        </div>
                        <button onClick={() => setPregledZadaca(null)} className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="overflow-y-auto p-4 space-y-3">
                        {pregledLoading ? (
                          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
                        ) : pregledUcenici.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8 font-medium">{t("Nema učenika za ovu zadaću.")}</p>
                        ) : (
                          pregledUcenici.map(red => {
                            const zavrseno = red.status === "zavrseno";
                            return (
                              <div key={red.ucenikId}
                                className={`rounded-2xl border p-4 ${zavrseno ? "border-emerald-200 bg-emerald-50/40" : "border-border/60 bg-white"}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="font-extrabold text-foreground truncate">{red.displayName}</span>
                                    {red.lekcijaZavrsena && (
                                      <span
                                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0"
                                        title={red.lekcijaZavrsenaAt ? `${t("Završeno")} ${new Date(red.lekcijaZavrsenaAt).toLocaleString("bs-BA")}` : undefined}
                                      >
                                        <BookOpen className="w-3 h-3" /> {t("Lekcija završena")}
                                      </span>
                                    )}
                                    {zavrseno && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                    {red.prolongCount > 0 && (
                                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 shrink-0">
                                        {t("Prolongirano ×{n}", { n: String(red.prolongCount) })}
                                      </span>
                                    )}
                                  </div>
                                  {!zavrseno && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">{t("Na čekanju")}</span>
                                  )}
                                </div>
                                {red.lekcijaZavrsena && red.lekcijaZavrsenaAt && (
                                  <p className="text-[11px] text-violet-700 mb-3">
                                    {t("Lekcija završena:")} {new Date(red.lekcijaZavrsenaAt).toLocaleString("bs-BA")}
                                  </p>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {/* Uradjeno da/ne */}
                                  <div>
                                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Zadaća")}</label>
                                    <div className="flex gap-1.5">
                                      <button type="button" onClick={() => updatePregledRed(red.ucenikId, { uradjeno: true })}
                                        className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-bold border transition-colors ${red.uradjeno ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-border text-muted-foreground hover:bg-muted"}`}>
                                        {t("Da")}
                                      </button>
                                      <button type="button" onClick={() => updatePregledRed(red.ucenikId, { uradjeno: false })}
                                        className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-bold border transition-colors ${!red.uradjeno ? "bg-red-500 text-white border-red-500" : "bg-white border-border text-muted-foreground hover:bg-muted"}`}>
                                        {t("Ne")}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Ocjena 1-6 */}
                                  <div>
                                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Ocjena")}</label>
                                    <select value={red.ocjena ?? ""}
                                      onChange={e => updatePregledRed(red.ucenikId, { ocjena: e.target.value ? Number(e.target.value) : null })}
                                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                                      <option value="">—</option>
                                      {[1, 2, 3, 4, 5, 6].map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  </div>

                                  {/* Kapi meda */}
                                  <div>
                                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Kapi meda")}</label>
                                    <div className="flex gap-1">
                                      {KAPI_MEDA_OPCIJE.map(k => (
                                        <button key={k} type="button" onClick={() => updatePregledRed(red.ucenikId, { kapiMeda: k })}
                                          className={`flex-1 rounded-lg px-1 py-1.5 text-sm font-bold border transition-colors ${red.kapiMeda === k ? "bg-amber-500 text-white border-amber-500" : "bg-white border-border text-muted-foreground hover:bg-muted"}`}>
                                          {k === 0 ? "0" : `+${k}`}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Novi termin (prolongacija) */}
                                  <div>
                                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Novi termin")}</label>
                                    <input type="date" value={red.noviRok ?? ""}
                                      onChange={e => updatePregledRed(red.ucenikId, { noviRok: e.target.value || null })}
                                      className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
                                  </div>
                                </div>

                                <div className="flex gap-2 mt-3 justify-end">
                                  <Button variant="outline" size="sm" disabled={savingRedId === red.ucenikId}
                                    onClick={() => saveStatusRed(red)}
                                    className="rounded-lg font-bold">
                                    {savingRedId === red.ucenikId ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Sačuvaj")}
                                  </Button>
                                  {!zavrseno ? (
                                    <Button size="sm" disabled={savingRedId === red.ucenikId}
                                       onClick={() => saveStatusRed({ ...red, uradjeno: true }, true)}
                                      className="rounded-lg font-bold flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4" /> {t("Završeno")}
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" disabled={savingRedId === red.ucenikId}
                                      onClick={() => saveStatusRed(red, false)}
                                      className="rounded-lg font-bold">
                                      {t("Vrati na čekanje")}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {/* KALENDAR */}
            {activeTab === "kalendar" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Stalna traka za izbor pregleda kalendara */}
                <div className="bg-white border border-border/50 rounded-2xl p-4 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground mr-2">{t("Pregled:")}</span>
                    <button
                      onClick={() => { setKalendarMode("sve"); setSelectedGrupaId(null); }}
                      className={`rounded-xl px-4 py-2 text-sm font-bold border transition-all ${kalendarMode === "sve" && !selectedGrupaId ? "bg-primary text-primary-foreground border-primary" : "bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"}`}
                      data-testid="btn-kal-sve">
                      {t("Svi termini")}
                    </button>
                    {grupe.filter(g => !g.isArchived).map(g => (
                      <button key={g.id}
                        onClick={() => { setKalendarMode("grupa"); setSelectedGrupaId(g.id); }}
                        className={`rounded-xl px-4 py-2 text-sm font-bold border transition-all ${selectedGrupaId === g.id ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground border-border/50 hover:bg-muted/50"}`}>
                        {g.naziv}
                      </button>
                    ))}
                  </div>
                  {kalendarMode === "sve" && !selectedGrupaId && (
                    <p className="text-xs text-muted-foreground mt-2">{t("Pregled spaja sve grupe — za uređivanje datuma odaberi konkretnu grupu.")}</p>
                  )}
                </div>

                {kalendarMode === "sve" && !selectedGrupaId ? (
                  kalendarSveLoading ? (
                    <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                  ) : kalendarSve ? (
                    <div className="grid lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <div className="bg-white border border-border/50 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })}
                              className="p-2 hover:bg-muted rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                            <h3 className="font-extrabold text-lg text-foreground">{monthNames[currentMonth.month]} {currentMonth.year}</h3>
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
                              const dayEntries = kalendarSve.kalendar.filter(k => k.datum === dateStr);
                              const dayLekcije = kalendarSve.planLekcija.filter(p => p.datum === dateStr);
                              const isSelected = selectedDate === dateStr;
                              // Boja po dominantnom tipu (prioritet: vazan_datum > ramazan > ferije > mekteb)
                              const dominantTip = dayEntries.find(e => e.tip === "vazan_datum")?.tip
                                ?? dayEntries.find(e => e.tip === "ramazan")?.tip
                                ?? dayEntries.find(e => e.tip === "ferije")?.tip
                                ?? dayEntries[0]?.tip;
                              const tipStyle = dominantTip ? TIP_COLORS[dominantTip] : null;
                              const grupaCount = new Set(dayEntries.map(e => e.grupaId)).size;

                              return (
                                <button key={dateStr}
                                  onClick={() => setSelectedDate(dateStr)}
                                  className={`relative h-8 rounded-md text-xs font-bold transition-all flex flex-col items-center justify-center gap-0
                                    ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                                    ${tipStyle ? `${tipStyle.bg} ${tipStyle.text} border ${tipStyle.border}` : "hover:bg-muted/50 border border-transparent"}`}>
                                  {day}
                                  {grupaCount > 1 && (
                                    <div className="absolute top-0.5 right-0.5 text-[8px] bg-primary text-primary-foreground rounded-full px-1 font-extrabold leading-none py-0.5">{grupaCount}</div>
                                  )}
                                  {dayLekcije.length > 0 && (
                                    <div className="w-1.5 h-1.5 bg-violet-500 rounded-full absolute bottom-1" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> {t("Mekteb")}</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 border border-red-400" /> {t("Ferije")}</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> {t("Važan datum")}</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> {t("Plan lekcija")}</span>
                            <span className="flex items-center gap-1"><div className="text-[10px] bg-primary text-primary-foreground rounded-full px-1 font-extrabold">N</div> {t("Više grupa")}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {selectedDate ? (
                          <>
                            <div className="bg-white border border-border/50 rounded-2xl p-5">
                              <h4 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" /> {selectedDate}
                              </h4>
                              {kalendarSve.kalendar.filter(k => k.datum === selectedDate).length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-3">{t("Nema označenog tipa za ovaj dan ni u jednoj grupi")}</p>
                              ) : (
                                <div className="space-y-2">
                                  {kalendarSve.kalendar.filter(k => k.datum === selectedDate).map(e => {
                                    const ts = TIP_COLORS[e.tip];
                                    return (
                                      <div key={e.id} className={`rounded-lg px-3 py-2 border ${ts.bg} ${ts.border}`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className={`text-xs font-extrabold ${ts.text}`}>{ts.label}</span>
                                          <button
                                            onClick={() => { setKalendarMode("grupa"); setSelectedGrupaId(e.grupaId); }}
                                            className="text-xs font-bold text-primary hover:underline">
                                            {e.grupaNaziv || t("Grupa #{id}", { id: String(e.grupaId) })} →
                                          </button>
                                        </div>
                                        {e.opis && <div className={`text-sm mt-1 ${ts.text}`}>{e.opis}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="bg-white border border-border/50 rounded-2xl p-5">
                              <h4 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-violet-500" /> {t("Plan lekcija po grupama")}
                              </h4>
                              {kalendarSve.planLekcija.filter(p => p.datum === selectedDate).length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-3">{t("Nema dodanih lekcija za ovaj dan")}</p>
                              ) : (
                                <div className="space-y-2">
                                  {kalendarSve.planLekcija.filter(p => p.datum === selectedDate).map(l => (
                                    <div key={l.id} className="bg-violet-50 rounded-lg px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-medium text-foreground">{l.lekcijaNaslov}</span>
                                        <button
                                          onClick={() => { setKalendarMode("grupa"); setSelectedGrupaId(l.grupaId); }}
                                          className="text-xs font-bold text-primary hover:underline whitespace-nowrap">
                                          {l.grupaNaziv || t("Grupa #{id}", { id: String(l.grupaId) })} →
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center">
                            <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">{t("Klikni na dan za detalje")}</p>
                            <p className="text-xs text-muted-foreground mt-1">{t("Vidiš sve termine svih grupa odjednom")}</p>
                          </div>
                        )}

                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                          <div className="text-xs font-bold text-primary mb-2">{t("Sažetak")}</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("Termini ukupno:")}</span> <span className="font-extrabold text-foreground">{kalendarSve.kalendar.length}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("Plan lekcija:")}</span> <span className="font-extrabold text-foreground">{kalendarSve.planLekcija.length}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("Grupa:")}</span> <span className="font-extrabold text-foreground">{grupe.length}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-white rounded-2xl border border-border/50">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="font-bold text-foreground">{t("Nema kreiranih grupa")}</p>
                    </div>
                  )
                ) : kalendarLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
                ) : (
                  <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
                    <div>
                      <div className="bg-white border border-border/50 rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <button onClick={() => { setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }); setSelectedDate(null); }}
                            className="p-2 hover:bg-muted rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                          <h3 className="font-extrabold text-lg text-foreground">
                            {monthNames[currentMonth.month]} {currentMonth.year}
                          </h3>
                          <button onClick={() => { setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }); setSelectedDate(null); }}
                            className="p-2 hover:bg-muted rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                        </div>

                        <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
                          <span className="text-sm font-bold text-muted-foreground mr-1">{t("Označi dan kao:")}</span>
                          {Object.entries(TIP_COLORS).map(([key, val]) => (
                            <button key={key} onClick={() => setActiveTip(key as any)}
                              className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border-2 transition-all ${activeTip === key ? `${val.bg} ${val.border} ${val.text}` : "border-border/50 text-muted-foreground hover:bg-muted"}`}>
                              {val.label}
                            </button>
                          ))}
                          <button onClick={() => { setBatchMode(!batchMode); setBatchDatumi([]); }}
                            className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border-2 transition-all ${batchMode ? "bg-violet-100 border-violet-400 text-violet-700" : "border-border/50 text-muted-foreground hover:bg-muted"}`}>
                            {batchMode ? t("✓ Grupno") : t("Grupno")}
                          </button>
                          <button
                            onClick={() => { setShowCopyKalendar(v => !v); setCopyFromGrupaId(null); setCopyOverride(false); }}
                            className={`text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border-2 transition-all ${showCopyKalendar ? "bg-emerald-100 border-emerald-400 text-emerald-700" : "border-border/50 text-muted-foreground hover:bg-muted"}`}>
                            {t("Kopiraj")}
                          </button>
                          <button onClick={() => { setSelectedGrupaId(null); setBatchMode(false); setBatchDatumi([]); setShowCopyKalendar(false); }} className="ml-auto text-xs sm:text-sm text-muted-foreground hover:text-foreground font-medium">
                            {t("← Promijeni grupu")}
                          </button>
                        </div>

                        {showCopyKalendar && (
                          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            {mektebMeta.isGlavni && (
                              <div className="flex gap-2 mb-3">
                                <button onClick={() => setCopyToMode("from")}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${copyToMode === "from" ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-300 text-emerald-800 hover:bg-emerald-100"}`}>
                                  {t("Kopiraj IZ grupe")}
                                </button>
                                <button onClick={() => setCopyToMode("to")}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${copyToMode === "to" ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-300 text-emerald-800 hover:bg-emerald-100"}`}>
                                  {t("Kopiraj U grupe")}
                                </button>
                              </div>
                            )}

                            {copyToMode === "from" && (
                              <>
                                <div className="text-sm font-bold text-emerald-800 mb-2">
                                  {t("Kopiraj datume nastave i praznike iz druge grupe u trenutnu grupu")}
                                </div>
                                {grupe.filter(g => !g.isArchived && g.id !== selectedGrupaId).length === 0 ? (
                                  <div className="text-sm text-emerald-700">{t("Nema druge grupe za kopiranje.")}</div>
                                ) : (
                                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                    <select
                                      value={copyFromGrupaId ?? ""}
                                      onChange={(e) => setCopyFromGrupaId(e.target.value ? Number(e.target.value) : null)}
                                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-foreground flex-1">
                                      <option value="">{t("— odaberi izvornu grupu —")}</option>
                                      {grupe.filter(g => !g.isArchived && g.id !== selectedGrupaId).map(g => (
                                        <option key={g.id} value={g.id}>
                                          {g.muallimDisplayName ? `${g.naziv} (${g.muallimDisplayName})` : g.naziv}
                                        </option>
                                      ))}
                                    </select>
                                    <label className="flex items-center gap-2 text-sm text-emerald-800 font-medium select-none">
                                      <input type="checkbox" checked={copyOverride} onChange={(e) => setCopyOverride(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                                      {t("Prepiši postojeće")}
                                    </label>
                                    <Button onClick={copyKalendarFromGrupa} disabled={!copyFromGrupaId || copyingKalendar}
                                      className="rounded-xl font-bold text-sm px-4 py-2 h-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                                      {copyingKalendar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                      {t("Kopiraj")}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}

                            {copyToMode === "to" && mektebMeta.isGlavni && (() => {
                              const ostaleGrupe = grupe.filter(g => !g.isArchived && g.id !== selectedGrupaId);
                              const muallimi = [...new Map(ostaleGrupe.filter(g => g.muallimDisplayName).map(g => [g.muallimId, g.muallimDisplayName])).entries()];
                              return (
                                <>
                                  <div className="text-sm font-bold text-emerald-800 mb-2">
                                    {t("Kopiraj kalendar ove grupe u odabrane grupe:")}
                                  </div>
                                  {ostaleGrupe.length === 0 ? (
                                    <div className="text-sm text-emerald-700">{t("Nema grupa u džematu.")}</div>
                                  ) : (
                                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                      {muallimi.map(([mId, mName]) => (
                                        <div key={mId}>
                                          <div className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wide mb-1">{mName}</div>
                                          {ostaleGrupe.filter(g => g.muallimId === mId).map(g => (
                                            <label key={g.id} className="flex items-center gap-2 text-sm text-emerald-900 cursor-pointer hover:bg-emerald-100 rounded px-2 py-1 select-none">
                                              <input type="checkbox"
                                                checked={copyToGrupeIds.includes(g.id)}
                                                onChange={e => setCopyToGrupeIds(prev => e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id))}
                                                className="w-4 h-4 accent-emerald-600" />
                                              {g.naziv}
                                            </label>
                                          ))}
                                        </div>
                                      ))}
                                      {ostaleGrupe.filter(g => !g.muallimDisplayName || g.muallimId === undefined).map(g => (
                                        <label key={g.id} className="flex items-center gap-2 text-sm text-emerald-900 cursor-pointer hover:bg-emerald-100 rounded px-2 py-1 select-none">
                                          <input type="checkbox"
                                            checked={copyToGrupeIds.includes(g.id)}
                                            onChange={e => setCopyToGrupeIds(prev => e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id))}
                                            className="w-4 h-4 accent-emerald-600" />
                                          {g.naziv}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <label className="flex items-center gap-2 text-sm text-emerald-800 font-medium select-none">
                                      <input type="checkbox" checked={copyOverride} onChange={(e) => setCopyOverride(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                                      {t("Prepiši postojeće")}
                                    </label>
                                    <Button onClick={copyKalendarToGrupe} disabled={copyToGrupeIds.length === 0 || copyingToGrupe}
                                      className="rounded-xl font-bold text-sm px-4 py-2 h-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                                      {copyingToGrupe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                      {t("Kopiraj u {n} grupe", { n: String(copyToGrupeIds.length) })}
                                    </Button>
                                  </div>
                                </>
                              );
                            })()}

                            <div className="text-xs text-emerald-700 mt-2">
                              {t("Kopiraju se svi datumi (mekteb, ferije, važni datumi). Po defaultu se preskaču datumi koji već postoje.")}
                            </div>
                          </div>
                        )}

                        {batchMode && (
                          <div className="flex items-center gap-3 mb-4 bg-violet-50 border border-violet-200 rounded-xl p-3">
                            <span className="text-sm font-bold text-violet-700">{t("Klikni na dane koje želiš označiti")}</span>
                            <span className="text-sm text-violet-600 font-bold">{t("{n} odabrano", { n: String(batchDatumi.length) })}</span>
                            <div className="ml-auto flex gap-2">
                              <Button onClick={saveBatchKalendar} disabled={batchDatumi.length === 0 || batchSaving}
                                className="rounded-xl font-bold text-sm px-4 py-1.5 h-auto flex items-center gap-1.5">
                                {batchSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {t("Sačuvaj")} ({batchDatumi.length})
                              </Button>
                              <button onClick={() => setBatchDatumi([])} className="text-sm text-violet-600 hover:text-violet-800 font-medium px-2">
                                {t("Poništi")}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-7 gap-0.5">
                          {DAYS_BS.map(d => (
                            <div key={d} className="text-center text-[10px] sm:text-xs font-extrabold text-muted-foreground py-1 sm:py-2">{d}</div>
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
                                {hasLekcije && <div className="w-1 h-1 bg-violet-500 rounded-full absolute bottom-0.5" />}
                                {isBatchSelected && <div className="w-2 h-2 bg-violet-500 rounded-full absolute top-1 right-1" />}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" /> {t("Mekteb")}</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 border border-red-400" /> {t("Ferije")}</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> {t("Važan datum")}</span>
                          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-200 border border-purple-400" /> {t("Ramazan")}</span>
                          <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> {t("Ima lekcije")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 space-y-4">
                      {/* Lista označenih datuma — uvijek vidljiva */}
                      <div className="bg-white border border-border/50 rounded-2xl p-5">
                        {(() => {
                          const monthPrefix = `${currentMonth.year}-${String(currentMonth.month+1).padStart(2,"0")}`;
                          const monthEntries = [...kalendar].filter(e => e.datum.startsWith(monthPrefix)).sort((a, b) => a.datum.localeCompare(b.datum));
                          if (monthEntries.length === 0) {
                            return (
                              <div className="text-center py-6">
                                <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                                <p className="text-sm text-muted-foreground">{t("Klikni na dan u kalendaru za detalje")}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t("Dupli klik označava dan aktivnim tipom")}</p>
                              </div>
                            );
                          }
                          return (
                            <>
                              <h4 className="font-extrabold text-sm text-foreground mb-3">{t("Označeni datumi — ovaj mjesec")}</h4>
                              <div className="space-y-1.5">
                                {monthEntries.map(entry => {
                                  const ts = TIP_COLORS[entry.tip];
                                  const isActive = selectedDate === entry.datum;
                                  return (
                                    <div key={entry.id}
                                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border cursor-pointer transition-all ${ts?.bg} ${isActive ? `${ts?.border} ring-2 ring-offset-1 ring-primary/40` : ts?.border} hover:opacity-90`}
                                      onClick={() => { setSelectedDate(isActive ? null : entry.datum); setOpisInput(entry.opis || ''); }}>
                                      <div className="shrink-0 w-8 text-center">
                                        <div className={`text-sm font-extrabold leading-tight ${ts?.text}`}>{entry.datum.slice(8)}</div>
                                        <div className={`text-[10px] leading-tight ${ts?.text} opacity-70`}>{monthNames[parseInt(entry.datum.slice(5,7))-1]?.slice(0,3)}</div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className={`text-xs font-bold ${ts?.text}`}>{ts?.label}</span>
                                        {entry.opis && <p className={`text-xs ${ts?.text} opacity-80 truncate mt-0.5`}>{entry.opis}</p>}
                                      </div>
                                      <button onClick={e => { e.stopPropagation(); deleteKalendarEntry(entry.id); }}
                                        className="shrink-0 text-red-400 hover:text-red-600 p-0.5 rounded">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Detalj odabranog datuma — prikazan ispod liste */}
                      {selectedDate && (
                        <>
                          <div className="bg-white border border-border/50 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-extrabold text-foreground flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                {selectedDate}
                              </h4>
                              <button onClick={() => setSelectedDate(null)} className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-lg hover:bg-muted">
                                ✕ {t("Zatvori")}
                              </button>
                            </div>
                            {(() => {
                              const entry = kalendar.find(k => k.datum === selectedDate);
                              return (
                                <div className="space-y-3">
                                  <div className="flex gap-2 flex-wrap">
                                    {Object.entries(TIP_COLORS).map(([key, val]) => (
                                      <button key={key} onClick={() => {
                                        if (key === "vazan_datum" && !opisInput.trim()) {
                                          const naziv = prompt(t("Unesite naziv važnog datuma:"));
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
                                  <textarea placeholder={entry?.tip === "vazan_datum" ? t("Naziv važnog datuma") : entry?.tip === "ramazan" ? t("Npr. Ramazan 1446") : t("Opis (opcionalno)")} value={opisInput}
                                    onChange={e => setOpisInput(e.target.value)}
                                    onBlur={() => { if (entry) saveKalendarEntry(selectedDate, entry.tip, opisInput); }}
                                    rows={3}
                                    className="w-full border border-border rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                                </div>
                              );
                            })()}
                          </div>

                          <div className="bg-white border border-border/50 rounded-2xl p-5">
                            <h4 className="font-extrabold text-foreground mb-3 flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-violet-500" /> {t("Plan lekcija")}
                            </h4>
                            {planLekcija.filter(p => p.datum === selectedDate).length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-3">{t("Nema dodanih lekcija za ovaj dan")}</p>
                            ) : (
                              <div className="space-y-2 mb-3">
                                {planLekcija.filter(p => p.datum === selectedDate).map(l => (
                                  <div key={l.id} className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2">
                                    {(() => {
                                      const matchSlug = dostupneLekcije.find(dl => dl.naslov === l.lekcijaNaslov)?.slug;
                                      return matchSlug ? (
                                        <Link href={`/ilmihal/${matchSlug}`} className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1">
                                          <BookOpen className="w-3.5 h-3.5" />{l.lekcijaNaslov}
                                        </Link>
                                      ) : (
                                        <span className="text-sm font-medium text-foreground">{l.lekcijaNaslov}</span>
                                      );
                                    })()}
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
                                          {t("Nivo {n}", { n: String(nivo) })}
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
                                  {t("Zatvori")}
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setShowLekcijaSelect(true)}
                                className="flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80">
                                <Plus className="w-4 h-4" /> {t("Dodaj lekciju")}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* IZVJEŠTAJI — premješteni iz Pregled-a u svoj tab radi preglednosti. */}
            {activeTab === "izvjestaji" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5" data-testid="card-izvjestaji">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-extrabold text-base text-foreground">{t("Izvještaji za štampu / PDF")}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t(`Sastavlja izvještaj sa zaglavljem MEKTEB platforme — prisustvo, ocjene, kvizovi i napredak. U pregledu birate učenike, period i sekcije, pa "Štampaj / Sačuvaj kao PDF" ili "Izvezi Excel".`)}
                  </p>

                  {/* Opseg izvještaja — jedna grupa / sve moje grupe / cijeli mekteb */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Opseg izvještaja")}</label>
                      <select
                        value={izvjestajOpseg}
                        onChange={e => setIzvjestajOpseg(e.target.value as "grupa" | "moje" | "mekteb")}
                        className="text-sm border border-border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
                        data-testid="select-izvjestaj-opseg"
                      >
                        <option value="grupa">{t("Jedna grupa")}</option>
                        <option value="moje">{isMuallimPreview ? t("Sve grupe ovog muallima") : t("Sve moje grupe")}</option>
                        {mektebMeta.isGlavni && !isMuallimPreview && (
                          <option value="mekteb">{t("Cijeli mekteb")}</option>
                        )}
                      </select>
                    </div>
                    {izvjestajOpseg === "grupa" && (
                      <div>
                        <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Grupa")}</label>
                        <select
                          value={izvjestajGrupaId ?? ""}
                          onChange={e => setIzvjestajGrupaId(e.target.value ? Number(e.target.value) : null)}
                          className="text-sm border border-border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
                          data-testid="select-izvjestaj-grupa"
                        >
                          <option value="">{t("— odaberi grupu —")}</option>
                          {grupe.filter(g => !g.isArchived).map(g => (
                            <option key={g.id} value={String(g.id)}>{g.naziv}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        if (izvjestajOpseg === "grupa") {
                          if (!izvjestajGrupaId) {
                            toast({ title: t("Odaberite grupu"), variant: "destructive" });
                            return;
                          }
                          setLocation(`/muallim/izvjestaj/grupa/${izvjestajGrupaId}`);
                        } else if (izvjestajOpseg === "mekteb") {
                          setLocation("/muallim/izvjestaj/svi");
                        } else {
                          setLocation(`/muallim/izvjestaj/svi${muallimScopeQuery}`);
                        }
                      }}
                      className="rounded-xl font-bold text-sm bg-primary hover:bg-primary/90 flex items-center gap-2"
                      data-testid="btn-izvjestaj-svi"
                    >
                      <Printer className="w-4 h-4" />
                      {izvjestajOpseg === "grupa"
                        ? t("Otvori izvještaj grupe")
                        : izvjestajOpseg === "mekteb"
                          ? t("Otvori izvještaj mekteba")
                          : t("Svi učenici") + ` (${ucenici.length})`}
                    </Button>
                    {izvjestajOpseg === "grupa" && izvjestajGrupaId && (
                      <Button
                        onClick={() => exportExcel(izvjestajGrupaId)}
                        disabled={exportingExcel}
                        variant="outline"
                        className="rounded-xl font-bold text-sm flex items-center gap-2"
                        data-testid="btn-izvjestaj-grupa-excel"
                      >
                        {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                        {t("Excel izvještaj grupe")}
                      </Button>
                    )}
                    {mektebMeta.isGlavni && (
                      <Button
                        onClick={handleExportMektebSpisak}
                        disabled={exportingSpisak}
                        variant="outline"
                        className="rounded-xl font-bold text-sm flex items-center gap-2"
                        data-testid="btn-export-spisak-mekteba"
                      >
                        {exportingSpisak ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                        {t("Spisak cijelog mekteba (Excel)")}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "roditelji" && (
              <RoditeljiTab
                grupe={grupe}
                filterGrupaId={selectedGrupaId}
                muallimId={scopedMuallimId}
                readOnly={isMuallimPreview}
              />
            )}

            {activeTab === "h5p" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                    <h3 className="font-extrabold text-lg text-foreground">{t("H5P statistika učenika")}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
                    {t("Pregled napretka učenika kroz H5P interaktivne vježbe — najslabiji rezultati, prosjek po vježbi, mjesečni trendovi.")}
                  </p>
                  <Link href="/muallim/h5p-statistika">
                    <Button className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2" data-testid="btn-otvori-h5p-statistiku">
                      <BarChart3 className="w-4 h-4" /> {t("Otvori H5P statistiku")}
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* PROFIL — uređivanje display name-a, premješteno iz inline header dugmeta. */}
            {activeTab === "profil" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" /> {t("Uredi profil")}
                  </h3>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Korisničko ime")}</label>
                      <input type="text" value={user.username} disabled
                        className="w-full border border-border rounded-xl px-3 py-2 text-base bg-muted/30 text-muted-foreground" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Ime i prezime")}</label>
                      <input type="text"
                        value={editDisplayName || user.displayName || ""}
                        onChange={e => setEditDisplayName(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid="input-profil-display-name" />
                    </div>
                    <Button onClick={saveProfile} disabled={savingProfile || !editDisplayName.trim()} className="rounded-xl" data-testid="btn-sacuvaj-profil">
                      {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      {t("Sačuvaj promjene")}
                    </Button>
                  </div>
                </div>

                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground mb-4 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-primary" /> {t("Promjena šifre")}
                  </h3>
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Trenutna šifra")}</label>
                      <input
                        type="password"
                        value={oldPass}
                        onChange={e => setOldPass(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoComplete="current-password"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Nova šifra")}</label>
                      <input
                        type="password"
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoComplete="new-password"
                      />
                      <p className="text-xs text-muted-foreground mt-1">{t("Minimalno 6 znakova")}</p>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-muted-foreground block mb-1">{t("Ponovi novu šifru")}</label>
                      <input
                        type="password"
                        value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                        className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoComplete="new-password"
                      />
                    </div>
                    <Button
                      onClick={handleChangePassword}
                      disabled={passChanging || !oldPass || !newPass || !confirmPass}
                      className="rounded-xl"
                    >
                      {passChanging ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <KeyRound className="w-4 h-4 mr-1" />}
                      {t("Promijeni šifru")}
                    </Button>
                  </div>
                </div>

                {/* Push obavijesti */}
                <div className="bg-white border border-border/50 rounded-2xl p-5">
                  <h3 className="font-extrabold text-foreground mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" /> {t("Obavijesti")}
                  </h3>
                  <PushToggle />
                      <SelamSetting />
                </div>

                {/* Bulk reset šifri — samo za glavnog muallima (nikad u pregledu drugog muallima) */}
                {canManageMekteb && (
                  <div className="bg-white border border-red-200 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground mb-1 flex items-center gap-2">
                      <RotateCcw className="w-5 h-5 text-red-500" /> {t("Reset svih šifri učenika")}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("Vraća šifre svih učenika i roditelja u mektebu na standardnu lozinku")} <span className="font-mono font-bold text-foreground">Mekteb1234</span> {t("(broj iz korisničkog imena). Korisno kad se zaborave šifre.")}
                    </p>
                    {!showBulkResetConfirm ? (
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
                        onClick={() => setShowBulkResetConfirm(true)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {t("Resetuj sve šifre na default")}
                      </Button>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                        <p className="text-sm font-bold text-red-800">
                          ⚠️ {t("Jesi li siguran? Sve prilagođene šifre će biti zamijenjene standardnom Mekteb lozinkom.")}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                            disabled={bulkResetting}
                            onClick={async () => {
                              setBulkResetting(true);
                              try {
                                const res = await apiRequest<{ ok: boolean; resetovano: number }>(
                                  "POST", "/muallim/bulk-reset-passwords", {}, token
                                );
                                toast({ title: `✅ ${t("Resetovano")} ${res.resetovano} ${t("korisnika na standardnu šifru.")}` });
                                setShowBulkResetConfirm(false);
                              } catch (e: any) {
                                toast({ title: t("Greška pri resetu šifri"), description: e?.message, variant: "destructive" });
                              } finally {
                                setBulkResetting(false);
                              }
                            }}
                          >
                            {bulkResetting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                            {t("Da, resetuj sve")}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            disabled={bulkResetting}
                            onClick={() => setShowBulkResetConfirm(false)}
                          >
                            {t("Odustani")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
        </main>
        </div>
      </div>

      {/* Modal: potvrda brisanja grupe — korak 1: spasi izvještaj, korak 2: upiši naziv */}
      {deleteGrupaTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Naslov */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-foreground text-lg">{t("Trajno brisanje grupe")}</h3>
                <p className="text-sm text-muted-foreground">{t("Ova akcija se ne može poništiti.")}</p>
              </div>
            </div>

            {/* Šta se briše */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm space-y-2">
              <p className="font-bold text-red-800">{t("Brisanjem grupe")} <span className="font-mono">„{deleteGrupaTarget.naziv}"</span> {t("trajno se brišu:")}</p>
              <ul className="space-y-1 text-red-700">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{t("Sve evidencije prisustva")}</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{t("Plan lekcija")}</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{t("Mektebski kalendar grupe")}</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{t("Zadaće dodijeljene grupi")}</li>
              </ul>
              <p className="text-red-800 pt-1 border-t border-red-200">{t("Učenici i njihove ocjene ostaju — samo se odvajaju od grupe.")}</p>
            </div>

            {/* Korak 1: Spasi izvještaj */}
            <div className={`rounded-xl border-2 p-4 transition-colors ${izvjestajSpasen ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${izvjestajSpasen ? "bg-green-500 text-white" : "bg-amber-400 text-white"}`}>
                  {izvjestajSpasen ? <CheckCircle2 className="w-5 h-5" /> : "1"}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${izvjestajSpasen ? "text-green-800" : "text-amber-900"}`}>
                    {izvjestajSpasen ? t("Izvještaj je preuzet ✓") : t("Spasi izvještaj grupe")}
                  </p>
                  <p className={`text-xs mt-0.5 ${izvjestajSpasen ? "text-green-700" : "text-amber-800"}`}>
                    {izvjestajSpasen
                      ? t("Prisustvo, ocjene i plan lekcija su sačuvani u CSV fajlu.")
                      : t("Preuzmi prisustvo, ocjene i plan lekcija kao CSV fajl — jedini način da sačuvaš ove podatke.")}
                  </p>
                  {!izvjestajSpasen && (
                    <Button
                      onClick={downloadIzvjestajGrupe}
                      disabled={downloadingIzvjestaj}
                      className="mt-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm h-9 px-4"
                    >
                      {downloadingIzvjestaj
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />{t("Preuzimam...")}</>
                        : <><Download className="w-4 h-4 mr-1.5" />{t("Preuzmi izvještaj (.csv)")}</>}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Korak 2: Upiši naziv grupe */}
            <div className={`rounded-xl border-2 p-4 transition-colors ${!izvjestajSpasen ? "border-gray-200 bg-gray-50 opacity-50 pointer-events-none" : "border-red-300 bg-white"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${izvjestajSpasen ? "bg-red-500 text-white" : "bg-gray-300 text-white"}`}>
                  2
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground mb-2">
                    {t("Upiši naziv grupe da potvrdiš brisanje:")}
                  </p>
                  <input
                    type="text"
                    value={deleteGrupaConfirm}
                    onChange={e => setDeleteGrupaConfirm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && izvjestajSpasen && deleteGrupaConfirm === deleteGrupaTarget.naziv && !deletingGrupa) {
                        confirmDeleteGrupa();
                      }
                    }}
                    placeholder={deleteGrupaTarget.naziv}
                    className="w-full border border-red-300 rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                    autoFocus={izvjestajSpasen}
                    data-testid="input-potvrda-naziv-grupe"
                  />
                  {izvjestajSpasen && deleteGrupaConfirm.length > 0 && deleteGrupaConfirm !== deleteGrupaTarget.naziv && (
                    <p className="text-xs text-red-600 mt-1">{t("Naziv se ne podudara.")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Akcije */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={closeDeleteModal}
                disabled={deletingGrupa}
                className="flex-1 rounded-xl"
              >
                {t("Otkaži")}
              </Button>
              <Button
                onClick={confirmDeleteGrupa}
                disabled={deletingGrupa || !izvjestajSpasen || deleteGrupaConfirm !== deleteGrupaTarget.naziv}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-40"
                data-testid="btn-potvrdi-brisanje-grupe"
              >
                {deletingGrupa
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Trash2 className="w-4 h-4 mr-1.5" />{t("Obriši trajno")}</>}
              </Button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
