import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useLocation, useSearch, Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import {
  ArrowLeft, Users, UserPlus, Printer, ChevronRight, ArrowRightLeft,
  Loader2, GraduationCap, X, Plus, Trash2, Star, ClipboardList, KeyRound,
  AlertTriangle, BookOpen, Copy, Check,
  CalendarCheck, Calendar, TrendingUp, FileText, Heart, Sparkles, ListOrdered, Pencil,
  User, ChevronDown, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { goBackOr } from "@/lib/back-navigation";
import { isOnline, formatScreentime } from "@/lib/utils";
import { LekcijaPicker } from "@/components/LekcijaPicker";
import type { NapametStavka } from "@/components/NapametPregled";
import { NapametLokalniProgramEditor } from "@/components/NapametLokalniProgramEditor";
import { MuallimGroupSidebar } from "@/components/muallim-group-sidebar";

interface Grupa {
  id: number;
  muallimId?: number;
  naziv: string;
  skolskaGodina: string;
  datumPocetka?: string | null;
  datumKraja?: string | null;
  daniNastave: string[];
  vrijemeNastave: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  muallimDisplayName?: string | null;
  sekundarniMuallimi?: { id: number; displayName: string }[];
}

interface ArhivaClan {
  ucenikId: number;
  displayName: string;
  username: string;
  archivedAt: string;
}

function fmtDatum(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  profil?: { grupaId?: number };
  lastSeenAt?: string | null;
  totalScreentimeSec?: number | null;
  roditeljPovezan?: boolean;
}

interface CreatedUcenik {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
  roditelj?: {
    id: number;
    displayName: string;
    username: string;
    generatedPassword: string;
  } | null;
  roditelji?: Array<{
    username: string;
    displayName: string | null;
    password: string;
  }>;
}

interface IlmihalLekcija {
  id: number;
  naslov: string;
  nivo: number;
  slug?: string;
}
interface NastavniMaterijal {
  id: number;
  originalName: string;
  kind: "file" | "url" | string;
  mimeType?: string | null;
  fileSize?: number | null;
  externalUrl?: string | null;
}

interface PlanLekcija {
  id: number;
  datum: string;
  lekcijaNaslov: string;
  lekcijaTip: string;
  redoslijed: number;
}

interface LekcijaStatus {
  ucenikId: number;
  zavrsenoLekcija: number;
  zavrsenoPoNivoima?: Array<{ nivo: number; broj: number }>;
  zadnjaLekcija: { id: number; naslov: string; slug: string; nivo: number } | null;
  zavrsenoAt: string | null;
}

interface RoditeljVeza {
  id: number;
  displayName: string;
  username: string;
  status: string;
}

interface InteraktivniPregledGrupe {
  ukupnoUcenika: number;
  ukupnoPokusaja: number;
  prosjekTacnosti: number | null;
  pitanja: Array<{
    lekcijaId: number;
    lekcijaNaslov: string;
    pitanjeIndex: number;
    pitanjeTekst: string;
    brojPokusaja: number;
    netacniPokusaji: number;
    procenatTacnih: number;
    pomocBroj: number;
    tacnoNakonPonovnogCitanja: number;
    prosjekVrijemeSekundi: number;
  }>;
  ucenici: Array<{
    id: number;
    displayName: string;
    brojPokusaja: number;
    procenatTacnih: number | null;
    pomocBroj: number;
    tacnoNakonPonovnogCitanja: number;
  }>;
}

interface NapametDetalji {
  stavka: { id: string; naziv: string; nivo: number; scope?: string };
  ocijenjeni: Array<{ id: number; displayName: string; ocjena: number; datum: string }>;
  nisuOcijenjeni: Array<{ id: number; displayName: string }>;
}

type GrupaModul = "ucenici" | "napamet" | "greske" | "plan";

export default function GrupaPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const [printLoading, setPrintLoading] = useState(false);

  const [grupa, setGrupa] = useState<Grupa | null>(null);
  const [zadacaBadge, setZadacaBadge] = useState(0);
  const [studentiGrupe, setStudentiGrupe] = useState<Ucenik[]>([]);
  const [sviStudenti, setSviStudenti] = useState<Ucenik[]>([]);
  const [sveGrupe, setSveGrupe] = useState<Grupa[]>([]);
  const [lekcijeStatus, setLekcijeStatus] = useState<Map<number, LekcijaStatus>>(new Map());
  const [interaktivniPregled, setInteraktivniPregled] = useState<InteraktivniPregledGrupe | null>(null);
  const [interaktivniOpen, setInteraktivniOpen] = useState(false);
  const [interaktivniLoading, setInteraktivniLoading] = useState(false);
  const [interaktivniError, setInteraktivniError] = useState<string | null>(null);
  const interaktivniRequestRef = useRef(0);
  const interaktivniInFlightRef = useRef(false);
  const [ilmihalLekcije, setIlmihalLekcije] = useState<IlmihalLekcija[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [planLekcije, setPlanLekcije] = useState<PlanLekcija[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planDatum, setPlanDatum] = useState(new Date().toISOString().split("T")[0]);
  const [planLekcijaNaslov, setPlanLekcijaNaslov] = useState("");
  const [planVrstaCasa, setPlanVrstaCasa] = useState("obrada");
  const [savingPlan, setSavingPlan] = useState(false);

  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [createdStudents, setCreatedStudents] = useState<CreatedUcenik[]>([]);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveStudent, setMoveStudent] = useState<Ucenik | null>(null);
  const [moveTargetGrupaId, setMoveTargetGrupaId] = useState<string>("");
  const [moveLoading, setMoveLoading] = useState(false);

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [arhivaClanovi, setArhivaClanovi] = useState<ArhivaClan[]>([]);

  // Ocjena modal
  const [ocjenaTarget, setOcjenaTarget] = useState<Ucenik | null>(null);
  const [newOcjena, setNewOcjena] = useState({
    kategorija: "usmeno", ocjena: 6, lekcijaNaziv: "", napomena: "",
    datum: new Date().toISOString().split("T")[0], napametStavkaId: "", lekcijaSlug: "",
  });
  const [napametKatalog, setNapametKatalog] = useState<NapametStavka[]>([]);
  const [napametRefreshKey, setNapametRefreshKey] = useState(0);
  const [napametOdabrana, setNapametOdabrana] = useState<NapametStavka | null>(null);
  const [napametDetalji, setNapametDetalji] = useState<NapametDetalji | null>(null);
  const [napametDetaljiLoading, setNapametDetaljiLoading] = useState(false);
  const [napametDetaljiError, setNapametDetaljiError] = useState<string | null>(null);
  const [savingOcjena, setSavingOcjena] = useState(false);

  // Zadaća modal — ako zadacaTarget=null → zadaća za cijelu grupu
  const [showZadacaModal, setShowZadacaModal] = useState(false);
  const [zadacaTarget, setZadacaTarget] = useState<Ucenik | null>(null);
  const [newZadaca, setNewZadaca] = useState({ naslov: "", opis: "", rokDo: "", lekcijaNaslov: "", lekcijaSlug: "" });
  const [zadMaterijali, setZadMaterijali] = useState<NastavniMaterijal[]>([]);
  const [zadPriloziIds, setZadPriloziIds] = useState<Set<number>>(new Set());
  const [savingZadaca, setSavingZadaca] = useState(false);

  // Brisanje učenika (hard delete)
  const [deleteTarget, setDeleteTarget] = useState<Ucenik | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Promjena muallima grupe (samo za glavnog)
  const [isGlavni, setIsGlavni] = useState(false);
  const [mektebMuallimi, setMektebMuallimi] = useState<{ userId: number; displayName: string; isGlavni: boolean }[]>([]);
  const [showChangeMuallim, setShowChangeMuallim] = useState(false);
  const [changeMuallimId, setChangeMuallimId] = useState<number | null>(null);
  const [changingMuallim, setChangingMuallim] = useState(false);

  // Sekundarni muallimi grupe
  const [sekundarniMuallimi, setSekundarniMuallimi] = useState<{ id: number; displayName: string }[]>([]);
  const [showAddSecMuallim, setShowAddSecMuallim] = useState(false);
  const [addSecMuallimId, setAddSecMuallimId] = useState<number | "">("");
  const [addingSecMuallim, setAddingSecMuallim] = useState(false);

  // Settings dropdown po učeniku (zupčanik na kartici)
  const [settingsOpenId, setSettingsOpenId] = useState<number | null>(null);
  const [settingsMenuPosition, setSettingsMenuPosition] = useState({ top: 0, left: 0 });

  // Zvjezdice summary po učeniku (za prikaz na kartici)
  const [zvjezdiceSummary, setZvjezdiceSummary] = useState<Map<number, { pozitivne: number; negativne: number }>>(new Map());
  // Inline Zvjezdice panel — otvoren za kojeg učenika
  const [ponasanjeOpenId, setPonasanjeOpenId] = useState<number | null>(null);
  const [pozDropOpen, setPozDropOpen] = useState<number | null>(null);
  const [negDropOpen, setNegDropOpen] = useState<number | null>(null);
  // Kategorije zvjezdica definisane od admina
  const [zvjezdiceKategorije, setZvjezdiceKategorije] = useState<{id:number; tip:string; naziv:string}[]>([]);

  // Reset šifre roditelja
  const [parentResetTarget, setParentResetTarget] = useState<Ucenik | null>(null);
  const [parentResetList, setParentResetList] = useState<RoditeljVeza[]>([]);
  const [parentResetLoading, setParentResetLoading] = useState(false);
  const [parentResetResult, setParentResetResult] = useState<{ id: number; password: string; displayName: string } | null>(null);
  const [parentResetWorking, setParentResetWorking] = useState<number | null>(null);

  const grupaId = parseInt(id || "0");
  const search = useSearch();
  const [aktivniModul, setAktivniModul] = useState<GrupaModul>("ucenici");

  useEffect(() => {
    const modul = new URLSearchParams(search).get("modul");
    if (modul === "napamet" || modul === "greske" || modul === "plan") {
      setAktivniModul(modul);
      if (modul === "greske") void loadInteraktivniPregled();
    } else {
      setAktivniModul("ucenici");
    }
  }, [search]);

  // Učitaj muallime mekteba (403 = korisnik nije glavni → nema modal za promjenu)
  useEffect(() => {
    if (!token) return;
    apiRequest<{ userId: number; displayName: string; isGlavni: boolean }[]>("GET", "/muallim/mekteb/muallimi", undefined, token)
      .then(lista => { setMektebMuallimi(lista); setIsGlavni(true); })
      .catch(() => { setIsGlavni(false); });
  }, [token]);

  useEffect(() => {
    if (!token || !grupaId) return;
    apiRequest<{ katalog: (NapametStavka & { isVisible?: boolean })[] }>("GET", `/muallim/napamet-program?grupaId=${grupaId}`, undefined, token)
      .then(data => setNapametKatalog(data.katalog.filter(s => s.isVisible !== false)))
      .catch(() => {});
    Promise.all([
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Ucenik[]>("GET", `/muallim/grupa/${grupaId}/ucenici`, undefined, token),
      apiRequest<LekcijaStatus[]>("GET", `/muallim/grupa/${grupaId}/lekcije-status`, undefined, token).catch(() => []),
      apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
      apiRequest<any[]>("GET", `/muallim/grupa/${grupaId}/zvjezdice-summary`, undefined, token).catch(() => []),
      apiRequest<{id:number;tip:string;naziv:string}[]>("GET", "/muallim/zvjezdice-kategorije", undefined, token).catch(() => []),
    ]).then(([grupe, ucenici, grupaUcenici, status, lekcije, zvData, kategorije]) => {
      const g = grupe.find(x => x.id === grupaId);
      setGrupa(g || null);
      setSekundarniMuallimi(g?.sekundarniMuallimi ?? []);
      if (g?.isArchived) {
        apiRequest<ArhivaClan[]>("GET", `/muallim/grupe/${grupaId}/arhiva-clanovi`, undefined, token)
          .then(setArhivaClanovi).catch(() => {});
      }
      setSveGrupe(grupe);
      setSviStudenti(ucenici);
      setStudentiGrupe(grupaUcenici);
      setLekcijeStatus(new Map(status.map(s => [s.ucenikId, s])));
      setIlmihalLekcije(lekcije);
      setZvjezdiceSummary(new Map((zvData as any[]).map((r: any) => [
        r.ucenik_id, { pozitivne: parseInt(r.pozitivne ?? 0) || 0, negativne: parseInt(r.negativne ?? 0) || 0 },
      ])));
      setZvjezdiceKategorije(kategorije as any[]);
    }).catch(() => {}).finally(() => setIsLoading(false));
    apiRequest<{ count: number }>("GET", `/muallim/zadace-pregled-badge?grupaId=${grupaId}`, undefined, token)
      .then(r => setZadacaBadge(r?.count ?? 0)).catch(() => {});
  }, [token, grupaId]);

  useEffect(() => {
    if (!token || !grupaId || aktivniModul !== "plan") return;
    setPlanLoading(true);
    apiRequest<PlanLekcija[]>("GET", `/muallim/plan-lekcija?grupaId=${grupaId}`, undefined, token)
      .then(setPlanLekcije)
      .catch(() => toast({ title: t("Greška"), description: t("Plan lekcija nije moguće učitati"), variant: "destructive" }))
      .finally(() => setPlanLoading(false));
  }, [token, grupaId, aktivniModul, t, toast]);

  async function savePlanLekcija() {
    if (!token || !grupaId || !planLekcijaNaslov.trim()) return;
    setSavingPlan(true);
    try {
      const nova = await apiRequest<PlanLekcija>("POST", "/muallim/plan-lekcija", {
        grupaId,
        datum: planDatum,
        lekcijaNaslov: planLekcijaNaslov.trim(),
        lekcijaTip: planVrstaCasa,
        redoslijed: planLekcije.filter(lekcija => lekcija.datum === planDatum).length,
      }, token);
      setPlanLekcije(prev => [...prev, nova]);
      setPlanLekcijaNaslov("");
      setShowPlanForm(false);
      toast({ title: t("Lekcija dodana u plan!") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  }

  async function deletePlanLekcija(id: number) {
    if (!token) return;
    try {
      await apiRequest("DELETE", `/muallim/plan-lekcija/${id}`, undefined, token);
      setPlanLekcije(prev => prev.filter(lekcija => lekcija.id !== id));
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  async function loadInteraktivniPregled() {
    if (!token || !grupaId || interaktivniInFlightRef.current) return;
    const requestId = ++interaktivniRequestRef.current;
    interaktivniInFlightRef.current = true;
    setInteraktivniLoading(true);
    setInteraktivniError(null);
    setInteraktivniPregled(null);
    try {
      const data = await apiRequest<InteraktivniPregledGrupe>("GET", `/muallim/grupa/${grupaId}/interaktivni-blokovi`, undefined, token);
      if (requestId === interaktivniRequestRef.current) {
        setInteraktivniPregled(data);
      }
    } catch (error: any) {
      if (requestId === interaktivniRequestRef.current) {
        setInteraktivniError(error?.message || t("Pregled grešaka nije moguće učitati"));
      }
    } finally {
      if (requestId === interaktivniRequestRef.current) {
        interaktivniInFlightRef.current = false;
        setInteraktivniLoading(false);
      }
    }
  }

  function refreshNapametKatalog() {
    if (!token || !grupaId) return;
    apiRequest<{ katalog: NapametStavka[] }>("GET", `/muallim/napamet-program?grupaId=${grupaId}`, undefined, token)
      .then((data) => {
        setNapametKatalog(data.katalog.filter((item: any) => item.isVisible !== false));
        setNapametRefreshKey((key) => key + 1);
      })
      .catch(() => {});
  }

  async function openNapametDetalji(item: NapametStavka) {
    if (!token || !grupaId) return;
    setNapametOdabrana(item);
    setNapametDetalji(null);
    setNapametDetaljiLoading(true);
    setNapametDetaljiError(null);
    try {
      const data = await apiRequest<NapametDetalji>("GET", `/muallim/napamet-program/${encodeURIComponent(item.id)}/detalji?grupaId=${grupaId}`, undefined, token);
      setNapametDetalji(data);
    } catch (error: any) {
      setNapametDetaljiError(error?.message || t("Nije moguće učitati ocjene"));
    } finally {
      setNapametDetaljiLoading(false);
    }
  }

  useEffect(() => {
    if (!napametDetalji) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setNapametDetalji(null); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [napametDetalji]);

  function refreshStudents() {
    if (!token) return;
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Ucenik[]>("GET", `/muallim/grupa/${grupaId}/ucenici`, undefined, token),
      apiRequest<LekcijaStatus[]>("GET", `/muallim/grupa/${grupaId}/lekcije-status`, undefined, token).catch(() => []),
    ]).then(([ucenici, grupaUcenici, status]) => {
      setSviStudenti(ucenici);
      setStudentiGrupe(grupaUcenici);
      setLekcijeStatus(new Map(status.map(s => [s.ucenikId, s])));
    }).catch(() => {});
  }

  async function addZvjezdica(ucenikId: number, tip: "pozitivna" | "negativna", kategorijaId?: number) {
    if (!token) return;
    try {
      await apiRequest("POST", `/muallim/ucenik/${ucenikId}/zvjezdice`, { tip, kategorija_id: kategorijaId ?? null }, token);
      setZvjezdiceSummary(prev => {
        const next = new Map(prev);
        const cur = next.get(ucenikId) ?? { pozitivne: 0, negativne: 0 };
        if (tip === "pozitivna") next.set(ucenikId, { ...cur, pozitivne: cur.pozitivne + 1 });
        else next.set(ucenikId, { ...cur, negativne: cur.negativne + 1 });
        return next;
      });
      setPonasanjeOpenId(null);
      toast({ title: tip === "pozitivna" ? "⭐ Zvjezdica dodijeljena!" : "★ Negativna zvjezdica dodijeljena" });
    } catch (err: any) {
      console.error("addZvjezdica greška:", err);
      toast({ title: `Greška: ${err?.message || "Server nije odgovorio"}`, variant: "destructive" });
    }
  }

  function parseBulkEntries(text: string) {
    return text.split("\n").map(line => {
      const [u, r] = line.split("|");
      return { ucenik: (u || "").trim(), roditelj: r ? r.trim() : null };
    }).filter(e => e.ucenik.length > 0);
  }

  async function handleBulkAdd() {
    if (!token || !bulkNames.trim()) return;
    setBulkLoading(true);
    try {
      const entries = parseBulkEntries(bulkNames);
      if (entries.length === 0) { toast({ title: t("Unesite barem jedno ime") }); return; }
      const results = await apiRequest<CreatedUcenik[]>("POST", "/muallim/ucenici/bulk", {
        entries, grupaId
      }, token);
      setCreatedStudents(results);
      const sRoditelja = results.filter(r => r.roditelj).length;
      toast({
        title: t("{n} učenika dodano!", { n: String(results.length) }),
        description: sRoditelja > 0 ? t("{n} sa nalogom za roditelja", { n: String(sRoditelja) }) : undefined,
      });
      refreshStudents();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Neuspješno dodavanje"), variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleMove() {
    if (!token || !moveStudent) return;
    setMoveLoading(true);
    try {
      await apiRequest("PUT", `/muallim/ucenici/${moveStudent.id}/grupa`, {
        grupaId: moveTargetGrupaId ? parseInt(moveTargetGrupaId) : null,
      }, token);
      toast({ title: t("Učenik prebačen!") });
      setShowMoveModal(false);
      setMoveStudent(null);
      refreshStudents();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće prebaciti učenika"), variant: "destructive" });
    } finally {
      setMoveLoading(false);
    }
  }

  async function handleAddExisting(ucenikId: number) {
    if (!token) return;
    try {
      await apiRequest("PUT", `/muallim/ucenici/${ucenikId}/grupa`, { grupaId }, token);
      toast({ title: t("Učenik dodan u grupu!") });
      refreshStudents();
      setShowAddExisting(false);
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  function openOcjena(u: Ucenik) {
    setOcjenaTarget(u);
    setNewOcjena({
      kategorija: "usmeno", ocjena: 6, lekcijaNaziv: "", napomena: "",
      datum: new Date().toISOString().split("T")[0], napametStavkaId: "", lekcijaSlug: "",
    });
  }

  async function saveOcjena() {
    if (!token || !ocjenaTarget) return;
    setSavingOcjena(true);
    try {
      await apiRequest("POST", "/muallim/ocjene", {
        ucenikId: ocjenaTarget.id,
        kategorija: newOcjena.kategorija,
        ocjena: parseInt(String(newOcjena.ocjena)),
        lekcijaNaziv: newOcjena.lekcijaNaziv || null,
        lekcijaSlug: newOcjena.lekcijaSlug || null,
        napomena: newOcjena.napomena,
        datum: newOcjena.datum,
        grupaId,
        napametStavkaId: newOcjena.napametStavkaId || undefined,
      }, token);
      toast({ title: t("Ocjena dodana!"), description: `${ocjenaTarget.displayName} — ${newOcjena.ocjena}` });
      setOcjenaTarget(null);
      refreshNapametKatalog();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće dodati ocjenu"), variant: "destructive" });
    } finally {
      setSavingOcjena(false);
    }
  }

  function openZadacaForOne(u: Ucenik) {
    setZadacaTarget(u);
    setNewZadaca({ naslov: "", opis: "", rokDo: "", lekcijaNaslov: "", lekcijaSlug: "" });
    setZadMaterijali([]); setZadPriloziIds(new Set());
    setShowZadacaModal(true);
  }

  async function saveZadaca() {
    if (!token || !newZadaca.naslov.trim()) {
      toast({ title: t("Naslov je obavezan"), variant: "destructive" });
      return;
    }
    setSavingZadaca(true);
    try {
      await apiRequest("POST", "/muallim/zadace", {
        grupaId,
        naslov: newZadaca.naslov.trim(),
        opis: newZadaca.opis.trim() || null,
        rokDo: newZadaca.rokDo || null,
        lekcijaNaslov: newZadaca.lekcijaNaslov || null,
        lekcijaSlug: newZadaca.lekcijaSlug || null,
        lekcijaTip: newZadaca.lekcijaSlug ? "ilmihal" : null,
        priloziIds: Array.from(zadPriloziIds),
        ucenikIds: zadacaTarget ? [zadacaTarget.id] : [],
      }, token);
      toast({
        title: t("Zadaća dodana!"),
        description: zadacaTarget ? t("Pojedinačna za {ime}", { ime: zadacaTarget.displayName }) : t("Za cijelu grupu ({n} učenika)", { n: String(studentiGrupe.length) }),
      });
      setShowZadacaModal(false);
      setZadacaTarget(null);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće dodati zadaću"), variant: "destructive" });
    } finally {
      setSavingZadaca(false);
    }
  }

  async function openParentReset(u: Ucenik) {
    if (!token) return;
    setParentResetTarget(u);
    setParentResetList([]);
    setParentResetResult(null);
    setParentResetLoading(true);
    try {
      const list = await apiRequest<RoditeljVeza[]>("GET", `/muallim/ucenici/${u.id}/roditelji`, undefined, token);
      setParentResetList(list);
    } catch {
      toast({ title: t("Greška"), description: t("Ne mogu učitati roditelje"), variant: "destructive" });
    } finally {
      setParentResetLoading(false);
    }
  }

  async function doParentReset(roditeljId: number) {
    if (!token) return;
    setParentResetWorking(roditeljId);
    try {
      const res = await apiRequest<{ ok: boolean; newPassword: string; displayName: string; username: string }>(
        "POST", `/muallim/roditelj/${roditeljId}/reset-password`, {}, token,
      );
      setParentResetResult({ id: roditeljId, password: res.newPassword, displayName: res.displayName });
      toast({ title: t("Šifra roditelja vraćena na standardnu!") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Reset neuspješan"), variant: "destructive" });
    } finally {
      setParentResetWorking(null);
    }
  }

  async function handleHardDelete() {
    if (!token || !deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/muallim/ucenik/${deleteTarget.id}/hard`, undefined, token);
      toast({ title: t("Učenik obrisan"), description: t("{ime} i svi podaci su trajno uklonjeni.", { ime: deleteTarget.displayName }) });
      setDeleteTarget(null);
      refreshStudents();
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Brisanje neuspješno"), variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  function openPrintWindow(cards: CreatedUcenik[]) {
    const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t("Kartice učenika")}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Nunito', sans-serif; }
  @media print { @page { margin: 8mm; } }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .card {
    border: 2px solid #14b8a6; border-radius: 12px; padding: 10px;
    page-break-inside: avoid; background: #f0fdfa;
  }
  .logo { text-align: center; font-size: 14px; font-weight: 800; color: #0d9488; margin-bottom: 5px; }
  .name { font-size: 13px; font-weight: 800; color: #134e4a; margin-bottom: 3px; }
  .section-title { font-size: 10px; font-weight: 800; color: #0d9488; text-transform: uppercase; letter-spacing: 0.5px; margin: 6px 0 2px; }
  .field { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; border-bottom: 1px dashed #99f6e4; gap: 6px; }
  .label { color: #5eead4; font-weight: 600; flex-shrink: 0; }
  .value { color: #134e4a; font-weight: 800; font-family: monospace; text-align: right; word-break: break-all; }
  .parent-block { background: #fef3c7; border: 1px dashed #f59e0b; border-radius: 8px; padding: 5px 8px; margin-top: 5px; }
  .parent-block .field { border-bottom-color: #fde68a; }
  .parent-block .label { color: #b45309; }
  .parent-block .value { color: #78350f; }
  .grupa-info { text-align: center; color: #5eead4; font-size: 9px; margin-top: 5px; }
</style></head><body>
<div class="grid">${cards.map(c => `
  <div class="card">
    <div class="logo">MEKTEB</div>
    <div class="name">${esc(c.displayName)}</div>
    <div class="field"><span class="label">${t("Korisničko ime:")}</span><span class="value">${esc(c.username)}</span></div>
    <div class="field"><span class="label">${t("Lozinka:")}</span><span class="value">${esc(c.generatedPassword)}</span></div>
    ${((): string => {
      // Normalizuj: singular c.roditelj (generatedPassword) i plural c.roditelji (password)
      // u jedinstven niz da print window uvijek prikaže roditelja bez obzira na izvor.
      const rods: Array<{username: string; displayName: string | null; password: string}> =
        c.roditelji && c.roditelji.length > 0
          ? c.roditelji.map(r => ({ username: r.username, displayName: r.displayName ?? null, password: r.password }))
          : c.roditelj
            ? [{ username: c.roditelj.username, displayName: c.roditelj.displayName, password: c.roditelj.generatedPassword }]
            : [];
      return rods.map((r, idx) => `
    <div class="parent-block">
      <div class="section-title">${t("Roditelj")}${rods.length > 1 ? ` ${idx + 1}` : ""}${r.displayName ? ` — ${esc(r.displayName)}` : ""}</div>
      <div class="field"><span class="label">${t("Korisničko ime:")}</span><span class="value">${esc(r.username)}</span></div>
      <div class="field"><span class="label">${t("Lozinka:")}</span><span class="value">${esc(r.password)}</span></div>
    </div>`).join("");
    })()}
    <div class="grupa-info">${esc(grupa?.naziv || "")} · mekteb.net</div>
  </div>`).join("")}
</div></body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 300);
    }
  }

  function printCards() {
    if (studentiGrupe.length === 0) return;
    setPrintLoading(true);
    const ucenikIds = studentiGrupe.map(s => s.id);
    apiRequest<CreatedUcenik[]>("POST", "/muallim/print-kartice", { ucenikIds }, token!)
      .then(cards => {
        openPrintWindow(cards);
        toast({ title: t("Kartice su spremne za štampu"), description: t("Prikazane su trenutne standardne lozinke — štampanje ne mijenja i ne resetuje nijednu šifru.") });
      })
      .catch(() => {
        toast({ title: t("Greška"), description: t("Nije moguće generisati kartice"), variant: "destructive" });
      })
      .finally(() => setPrintLoading(false));
  }

  async function confirmChangeMuallim() {
    if (!token || !grupa || changeMuallimId === null) return;
    setChangingMuallim(true);
    try {
      const updated = await apiRequest<Grupa>("PUT", `/muallim/grupe/${grupa.id}`, { muallimId: changeMuallimId }, token);
      setGrupa(prev => prev ? { ...prev, muallimId: updated.muallimId, muallimDisplayName: updated.muallimDisplayName } : prev);
      setShowChangeMuallim(false);
      toast({ title: t("Muallim grupe promijenjen") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setChangingMuallim(false);
    }
  }

  async function addSekundarniMuallim() {
    if (!token || !grupa || !addSecMuallimId) return;
    setAddingSecMuallim(true);
    try {
      const res = await apiRequest<{ ok: boolean; muallim: { id: number; displayName: string } }>(
        "POST", `/muallim/grupe/${grupa.id}/muallimi`, { muallimId: Number(addSecMuallimId) }, token,
      );
      setSekundarniMuallimi(prev => [...prev.filter(m => m.id !== res.muallim.id), res.muallim]);
      setShowAddSecMuallim(false);
      setAddSecMuallimId("");
      toast({ title: t("Muallim dodan grupi!") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message, variant: "destructive" });
    } finally {
      setAddingSecMuallim(false);
    }
  }

  async function removeSekundarniMuallim(muallimId: number) {
    if (!token || !grupa) return;
    try {
      await apiRequest("DELETE", `/muallim/grupe/${grupa.id}/muallimi/${muallimId}`, undefined, token);
      setSekundarniMuallimi(prev => prev.filter(m => m.id !== muallimId));
      toast({ title: t("Muallim uklonjen iz grupe") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    }
  }

  // Učenici bez ikakve grupe — mogu se dodati u ovu grupu.
  // Za glavnog muallima: svi slobodni učenici džemata.
  const bezGrupe = sviStudenti.filter(u => {
    const gId = (u.profil as any)?.grupaId || (u as any).grupaId;
    return !gId;
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted/50 rounded-2xl animate-pulse" />)}
        </div>
      </Layout>
    );
  }

  if (!grupa) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">{t("Grupa nije pronađena")}</p>
          <Button className="mt-4" onClick={() => goBackOr(() => setLocation("/muallim"))}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Sticky traka na vrhu — uvijek vidljiva pri skrolu, jasno pokazuje
          u kojoj smo grupi i kako izaći nazad na panel. Header layout-a je
          h-16 (top-16), pa naša traka sjeda odmah ispod njega. */}
      <div className="sticky top-16 z-30 -mx-3 px-3 py-2.5 sm:-mx-4 sm:px-4 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-b border-emerald-200/70 shadow-sm mb-5 sm:mb-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => goBackOr(() => setLocation("/muallim?tab=grupe"))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-colors shrink-0"
            data-testid="btn-nazad-na-panel"
          >
            <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-extrabold text-foreground truncate">{grupa.naziv}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {t("{n} učenika", { n: String(studentiGrupe.length) })}</span>
          </div>
          <button
            onClick={() => setLocation(`/muallim/grupa/${grupa.id}/uredi`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-sm transition-colors shrink-0"
            data-testid="btn-uredi-grupu"
          >
            <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t("Uredi")}</span>
          </button>
        </div>
      </div>

         <div className="max-w-6xl mx-auto">
         <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] items-start">
          <aside className="order-1 xl:order-2 xl:sticky xl:top-24">
            <MuallimGroupSidebar grupaId={grupa.id} activeModule={aktivniModul} zadacaBadge={zadacaBadge} />
          </aside>

         <div className="order-2 xl:order-1 min-w-0">

        {grupa.isArchived && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6">
            <p className="font-extrabold text-amber-800 mb-1">{t("Grupa je arhivirana")}</p>
            <p className="text-sm text-amber-700">
              {t("Podaci grupe (ocjene, prisustvo, članstvo) su sačuvani. Učenici su oslobođeni i mogu se dodati u druge grupe.")}
              {grupa.archivedAt ? ` (${new Date(grupa.archivedAt).toLocaleDateString("bs-BA")})` : ""}
            </p>
            {arhivaClanovi.length > 0 && (
              <div className="mt-3">
                <p className="font-bold text-amber-800 text-sm mb-2">{t("Bivši članovi grupe")} ({arhivaClanovi.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {arhivaClanovi.map(c => (
                    <span key={c.ucenikId} className="bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-sm font-medium text-foreground">
                      {c.displayName || c.username}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {!grupa.isArchived && (
            <>
              <Button onClick={() => { setShowBulkAdd(true); setCreatedStudents([]); setBulkNames(""); }}
                className="rounded-xl font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> {t("Dodaj učenike")}
              </Button>
              <Button variant="outline" onClick={() => setShowAddExisting(true)}
                className="rounded-xl font-bold flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t("Dodaj postojećeg")}
              </Button>
            </>
          )}
          {(studentiGrupe.length > 0 || createdStudents.length > 0) && (
            <Button variant="outline" onClick={printCards} disabled={printLoading} className="rounded-xl font-bold flex items-center gap-2">
              {printLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} {t("Printaj kartice")}
            </Button>
          )}
        </div>

         {aktivniModul === "plan" && (
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
                  <BookOpen className="h-5 w-5 text-violet-600" />
                  {t("Plan lekcija")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("Plan za grupu")} {grupa.naziv}</p>
              </div>
              {!grupa.isArchived && (
                <Button type="button" onClick={() => setShowPlanForm(open => !open)} className="rounded-xl">
                  <Plus className="mr-1.5 h-4 w-4" /> {t("Dodaj lekciju")}
                </Button>
              )}
            </div>

            {showPlanForm && !grupa.isArchived && (
              <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-muted-foreground">
                    {t("Datum")}
                    <input type="date" value={planDatum} onChange={e => setPlanDatum(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="text-xs font-bold text-muted-foreground">
                    {t("Vrsta časa")}
                    <select value={planVrstaCasa} onChange={e => setPlanVrstaCasa(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground">
                      <option value="obrada">{t("Obrada")}</option>
                      <option value="ponavljanje">{t("Ponavljanje")}</option>
                      <option value="provjera">{t("Provjera")}</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-bold text-muted-foreground">
                  {t("Lekcija")}
                  <select value={planLekcijaNaslov} onChange={e => setPlanLekcijaNaslov(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground">
                    <option value="">{t("Odaberi lekciju")}</option>
                    {ilmihalLekcije.map(lekcija => <option key={lekcija.id} value={lekcija.naslov}>{lekcija.naslov}</option>)}
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowPlanForm(false)}>{t("Otkaži")}</Button>
                  <Button type="button" onClick={savePlanLekcija} disabled={savingPlan || !planLekcijaNaslov.trim()}>
                    {savingPlan && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{t("Sačuvaj")}
                  </Button>
                </div>
              </div>
            )}

            {planLoading ? (
              <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
            ) : planLekcije.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-white py-14 text-center text-sm text-muted-foreground">{t("Nema dodanih lekcija u planu")}</div>
            ) : (
              <div className="space-y-2">
                {[...planLekcije].sort((a, b) => a.datum.localeCompare(b.datum) || a.redoslijed - b.redoslijed).map(lekcija => (
                  <div key={lekcija.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-foreground">{lekcija.lekcijaNaslov}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{new Date(`${lekcija.datum}T12:00:00`).toLocaleDateString("bs-BA")} · {lekcija.lekcijaTip}</p>
                    </div>
                    {!grupa.isArchived && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => deletePlanLekcija(lekcija.id)} title={t("Obriši")}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
         )}

         {aktivniModul === "napamet" && !grupa.isArchived && (
           <NapametLokalniProgramEditor key={napametRefreshKey} grupaId={grupaId} globalItems={napametKatalog.filter((item) => item.scope === "global")} onChanged={refreshNapametKatalog} onItemClick={openNapametDetalji} />
         )}

         {aktivniModul === "greske" && <section className="bg-white border border-teal-200 rounded-2xl overflow-hidden mb-6" data-testid="interaktivni-pregled-grupe">
          <button type="button" aria-expanded={interaktivniOpen} onClick={() => {
            const next = !interaktivniOpen;
            setInteraktivniOpen(next);
             if (next) void loadInteraktivniPregled();
          }} className="w-full px-5 py-4 bg-teal-50/70 flex flex-wrap items-center justify-between gap-3 text-left">
            <div>
              <h2 className="font-extrabold text-teal-950 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-700" /> {t("Gdje učenici zapinju u lekcijama")}
              </h2>
              <p className="text-xs text-teal-800 mt-1">
                {t("Ovo je privatni pregled učenja, odvojen od ocjena i zvjezdica.")}
              </p>
            </div>
            {interaktivniPregled?.ukupnoPokusaja ? (
              <div className="flex gap-3 text-xs font-bold text-teal-900">
                <span>{interaktivniPregled.ukupnoPokusaja} {t("pokušaja")}</span>
                <span>{interaktivniPregled.prosjekTacnosti}% {t("tačno")}</span>
              </div>
            ) : null}
            <ChevronDown className={`w-5 h-5 text-teal-700 transition-transform ${interaktivniOpen ? "rotate-180" : ""}`} />
          </button>
           {interaktivniOpen && interaktivniLoading ? (
            <div className="px-5 py-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t("Učitavanje pregleda...")}</div>
           ) : interaktivniOpen && interaktivniError ? (
             <div className="px-5 py-6 space-y-3 text-sm text-red-700" role="alert">
               <p>{interaktivniError}</p>
               <Button type="button" variant="outline" size="sm" onClick={() => void loadInteraktivniPregled()} className="rounded-lg border-red-200 text-red-700 hover:bg-red-50">
                 {t("Pokušaj ponovo")}
               </Button>
             </div>
          ) : interaktivniOpen && !interaktivniPregled?.ukupnoPokusaja ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              {t("Kad učenici odgovore na pitanja „Provjeri znanje“ u lekciji, ovdje ćeš vidjeti gdje im treba dodatno objašnjenje.")}
            </p>
          ) : interaktivniOpen ? (
            <div className="divide-y divide-border/50">
              {(interaktivniPregled?.pitanja ?? []).slice(0, 5).map(p => (
                <div key={`${p.lekcijaId}-${p.pitanjeIndex}`} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-teal-700 mb-1">{p.lekcijaNaslov}</p>
                      <p className="font-bold text-foreground">{p.pitanjeTekst}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2.5 py-1 text-xs font-extrabold ${p.procenatTacnih >= 80 ? "bg-emerald-100 text-emerald-800" : p.procenatTacnih >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                      {p.procenatTacnih}% {t("tačno")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("{n} pogrešnih od {ukupno} pokušaja", { n: String(p.netacniPokusaji), ukupno: String(p.brojPokusaja) })}
                    {` · ${t("prosječno: {n} s", { n: String(p.prosjekVrijemeSekundi) })}`}
                    {p.pomocBroj > 0 ? ` · ${t("pomoć: {n}", { n: String(p.pomocBroj) })}` : ""}
                    {p.tacnoNakonPonovnogCitanja > 0 ? ` · ${t("tačno nakon ponovnog čitanja: {n}", { n: String(p.tacnoNakonPonovnogCitanja) })}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
         </section>}

        {showBulkAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-foreground flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> {t("Dodaj više učenika odjednom")}
              </h3>
              <button onClick={() => setShowBulkAdd(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdStudents.length > 0 ? (
              <div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <p className="font-bold text-emerald-800 mb-3">{t("{n} učenika uspješno kreirano!", { n: String(createdStudents.length) })}</p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {createdStudents.map(s => (
                      <div key={s.id} className="space-y-1">
                        <div className="bg-white rounded-lg p-3 flex items-center justify-between text-sm border border-emerald-100">
                          <div>
                            <span className="font-bold text-foreground">{t("Učenik: {ime}", { ime: s.displayName })}</span>
                            <span className="text-muted-foreground ml-2 font-mono text-xs">{s.username}</span>
                          </div>
                          <span className="font-mono font-bold text-primary">{s.generatedPassword}</span>
                        </div>
                        {s.roditelj && (
                          <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between text-sm border border-blue-200 ml-4">
                            <div>
                              <span className="font-bold text-blue-900">{t("Roditelj: {ime}", { ime: s.roditelj.displayName })}</span>
                              <span className="text-blue-700/70 ml-2 font-mono text-xs">{s.roditelj.username}</span>
                            </div>
                            <span className="font-mono font-bold text-blue-700">{s.roditelj.generatedPassword}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-sm text-blue-900 flex items-start gap-2">
                  <Printer className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{t("Kartice s lozinkama možete odštampati bilo kada preko dugmeta \"Printaj kartice\" na vrhu stranice grupe. Štampanje samo prikazuje trenutne lozinke i ništa ne mijenja.")}</span>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => { setCreatedStudents([]); setBulkNames(""); }}
                    className="flex-1 rounded-xl font-bold">{t("Dodaj još")}</Button>
                  <Button variant="outline" onClick={() => { setCreatedStudents([]); setShowBulkAdd(false); }}
                    className="rounded-xl">{t("Gotovo")}</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t("Unesite imena učenika, svako u novi red. Ako želite kreirati i nalog za roditelja, upišite ga iza znaka")}{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">|</code>:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-900">
                  <div className="font-bold mb-1">{t("Primjer:")}</div>
                  <code className="block whitespace-pre-wrap font-mono leading-relaxed">
                    Amina Hasić | Senad Hasić{"\n"}Ahmed Begović{"\n"}Merjem Hadžić | Edina Hadžić
                  </code>
                  <p className="mt-2 text-blue-800">{t("Roditelj ne ulazi u kvotu licenci.")}</p>
                </div>
                <textarea value={bulkNames} onChange={e => setBulkNames(e.target.value)}
                  rows={8} placeholder={"Amina Hasić | Senad Hasić\nAhmed Begović\nMerjem Hadžić | Edina Hadžić"}
                  className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 resize-none font-medium font-mono text-sm" />
                {(() => {
                  const entries = parseBulkEntries(bulkNames);
                  const sRoditelja = entries.filter(e => e.roditelj).length;
                  return (
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      {t("{n} učenika", { n: String(entries.length) })}{sRoditelja > 0 ? t(" · {r} sa roditeljem", { r: String(sRoditelja) }) : ""}
                    </p>
                  );
                })()}
                <Button onClick={handleBulkAdd} disabled={bulkLoading || !bulkNames.trim()}
                  className="w-full rounded-xl font-bold py-3">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {bulkLoading ? t("Kreiranje...") : t("Kreiraj {n} učenika", { n: String(parseBulkEntries(bulkNames).length) })}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {showAddExisting && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-border/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-foreground">{t("Dodaj postojećeg učenika u grupu")}</h3>
              <button onClick={() => setShowAddExisting(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            {bezGrupe.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("Nema dostupnih učenika za dodavanje")}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {bezGrupe.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-muted/20 rounded-xl px-4 py-3">
                    <div>
                      <span className="font-bold text-foreground">{u.displayName}</span>
                      <span className="text-muted-foreground text-xs ml-2">{u.username}</span>
                    </div>
                    <Button size="sm" onClick={() => handleAddExisting(u.id)}
                      className="rounded-lg text-xs font-bold">
                      <Plus className="w-3 h-3 mr-1" /> {t("Dodaj")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Backdrop za zatvaranje settings dropdowna */}
        {settingsOpenId !== null && (
          <div className="fixed inset-0 z-10" onClick={() => setSettingsOpenId(null)} />
        )}

         {aktivniModul === "ucenici" && <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/30">
            <h3 className="font-extrabold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-secondary" /> {t("Učenici u grupi ({n})", { n: String(studentiGrupe.length) })}
            </h3>
          </div>
          {studentiGrupe.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{t("Nema učenika u ovoj grupi")}</p>
              <p className="text-sm mt-1">{t("Dodaj učenike koristeći dugme iznad")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-b-2xl">
              {studentiGrupe.map((u, i) => {
                const settingsOpen = settingsOpenId === u.id;
                const ucenje = interaktivniPregled?.ucenici.find(x => x.id === u.id);
                 const lekcije = lekcijeStatus.get(u.id);
                return (
                  <motion.div key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="relative bg-white border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all">

                    {/* Gornji red: avatar + ime (klikabilno → profil) + zupčanik */}
                    <div className="flex items-center gap-3 mb-3">
                      <Link href={`/muallim/ucenik/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-75 transition-opacity">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center text-sm font-extrabold text-primary">
                            {u.displayName.charAt(0)}
                          </div>
                          {isOnline(u.lastSeenAt) && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white"
                              title={t("Online")} data-testid={`online-dot-${u.id}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-foreground truncate">{u.displayName}</p>
                            {u.roditeljPovezan && (
                              <span className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black border border-emerald-200"
                                title={t("Roditelj povezan")} aria-label={t("Roditelj povezan")}
                                data-testid={`roditelj-povezan-grupa-${u.id}`}>R</span>
                            )}
                            {isOnline(u.lastSeenAt) && (
                              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{t("online")}</span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Settings zupčanik */}
                      <div className="relative z-20 shrink-0">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (settingsOpen) {
                              setSettingsOpenId(null);
                              return;
                            }
                            const buttonRect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 220;
                            const roomAbove = buttonRect.top;
                            const roomBelow = window.innerHeight - buttonRect.bottom;
                             const placement = roomAbove >= menuHeight || roomAbove >= roomBelow ? "above" : "below";
                             const menuWidth = 180;
                             const top = placement === "above"
                               ? Math.max(8, buttonRect.top - menuHeight)
                               : Math.max(8, Math.min(window.innerHeight - menuHeight - 8, buttonRect.bottom + 8));
                             const left = Math.min(
                               Math.max(8, buttonRect.right - menuWidth),
                               window.innerWidth - menuWidth - 8,
                             );
                             setSettingsMenuPosition({ top, left });
                            setSettingsOpenId(u.id);
                          }}
                          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                          title={t("Upravljanje učenikom")}
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                         {settingsOpen && typeof document !== "undefined" && createPortal(
                           <div
                             className="fixed z-[60] min-w-[180px] rounded-xl border border-border/60 bg-white py-1 shadow-xl"
                             style={{ top: settingsMenuPosition.top, left: settingsMenuPosition.left }}
                             onClick={e => e.stopPropagation()}
                           >
                            <Link href={`/muallim/ucenik/${u.id}`}>
                              <button className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-muted flex items-center gap-2 text-foreground"
                                onClick={() => setSettingsOpenId(null)}>
                                <User className="w-4 h-4" /> {t("Profil učenika")}
                              </button>
                            </Link>
                            <button
                              onClick={() => { setSettingsOpenId(null); openParentReset(u); }}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-blue-50 text-blue-700 flex items-center gap-2"
                              data-testid={`btn-roditelj-reset-${u.id}`}
                            >
                              <KeyRound className="w-4 h-4" /> {t("Šifra roditelja")}
                            </button>
                            <button
                              onClick={() => { setSettingsOpenId(null); setMoveStudent(u); setMoveTargetGrupaId(""); setShowMoveModal(true); }}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-cyan-50 text-cyan-700 flex items-center gap-2"
                            >
                              <ArrowRightLeft className="w-4 h-4" /> {t("Prebaci u grupu")}
                            </button>
                            <div className="border-t border-border/50 my-1" />
                            <button
                              onClick={() => { setSettingsOpenId(null); setDeleteTarget(u); }}
                              className="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-red-50 text-red-600 flex items-center gap-2"
                              data-testid={`btn-delete-${u.id}`}
                            >
                              <Trash2 className="w-4 h-4" /> {t("Obriši učenika")}
                            </button>
                           </div>,
                           document.body,
                         )}
                      </div>
                    </div>

                    {ucenje?.brojPokusaja ? (
                      <Link href={`/muallim/ucenik/${u.id}`} className="mb-3 block rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2 hover:bg-teal-50 transition-colors">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-teal-800">{t("Učenje u lekcijama")}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-teal-950">
                          <span><strong>{ucenje.procenatTacnih}%</strong> {t("tačno")}</span>
                          <span>{ucenje.brojPokusaja} {t("pokušaja")}</span>
                          {ucenje.pomocBroj > 0 && <span>{t("pomoć: {n}", { n: String(ucenje.pomocBroj) })}</span>}
                          {ucenje.tacnoNakonPonovnogCitanja > 0 && <span>{t("nakon čitanja: {n}", { n: String(ucenje.tacnoNakonPonovnogCitanja) })}</span>}
                        </div>
                      </Link>
                    ) : null}

                    {lekcije && (
                      <div
                        className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2"
                        title={t("Završene Ilmihal lekcije po nivoima")}
                      >
                        <div className="flex items-center gap-1.5 text-violet-900">
                          <BookOpen className="w-4 h-4 text-violet-600" />
                          <span className="text-[10px] font-extrabold uppercase tracking-wide">{t("Ilmihal")}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-extrabold text-violet-950">
                          {(lekcije.zavrsenoPoNivoima?.length ?? 0) > 0
                            ? lekcije.zavrsenoPoNivoima!.map(({ nivo, broj }) => (
                              <span key={nivo} className="rounded-md bg-white/80 px-1.5 py-0.5">{broj}/{nivo}</span>
                            ))
                            : <span className="rounded-md bg-white/80 px-1.5 py-0.5">0</span>}
                          <span className="ml-1 text-[10px] font-bold text-violet-700/70">
                            {t("ukupno {n}", { n: String(lekcije.zavrsenoLekcija) })}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Akcije: Ocjene, Zadaća, Zvjezdice */}
                    <div className="grid grid-cols-3 gap-1">
                      <button onClick={() => { openOcjena(u); }}
                        className="flex flex-col items-center gap-0.5 py-2 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors"
                        data-testid={`btn-ocjena-${u.id}`}>
                        <Star className="w-4 h-4" />
                        <span className="text-[10px] font-bold leading-tight">{t("Ocjene")}</span>
                      </button>
                      <button onClick={() => openZadacaForOne(u)}
                        className="flex flex-col items-center gap-0.5 py-2 rounded-xl hover:bg-violet-50 text-violet-600 transition-colors"
                        data-testid={`btn-zadaca-ucenik-${u.id}`}>
                        <ClipboardList className="w-4 h-4" />
                        <span className="text-[10px] font-bold leading-tight">{t("Zadaća")}</span>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setPonasanjeOpenId(ponasanjeOpenId === u.id ? null : u.id); setSettingsOpenId(null); }}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors ${ponasanjeOpenId === u.id ? "bg-amber-100 text-amber-700" : "hover:bg-amber-50 text-amber-600"}`}
                      >
                        <span className="text-base leading-none">⭐</span>
                        <span className="text-[10px] font-bold leading-tight">{t("Zvjezdice")}</span>
                      </button>
                    </div>

                    {/* Inline Zvjezdice panel — pozitivne i negativne zvjezdice po kategorijama */}
                    {ponasanjeOpenId === u.id && (() => {
                      const pozKat = zvjezdiceKategorije.filter(k => k.tip === "pozitivna");
                      const negKat = zvjezdiceKategorije.filter(k => k.tip === "negativna");
                      return (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <div className="flex gap-2 justify-center">
                            {/* ⭐ Pozitivna */}
                            <div className="relative">
                              <button
                                onClick={() => setPozDropOpen(pozDropOpen === u.id ? null : u.id)}
                                className="flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors font-bold text-sm"
                              >
                                <span className="text-xl leading-none">⭐</span>
                                <span className="text-[10px] font-extrabold">{t("Pozitivna")}</span>
                              </button>
                              {pozDropOpen === u.id && typeof document !== "undefined" && createPortal(
                                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
                                  onClick={() => setPozDropOpen(null)}>
                                  <div role="dialog" aria-modal="true" aria-labelledby={`pozitivna-zvjezdica-${u.id}`}
                                    className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                                    onClick={e => e.stopPropagation()}>
                                    <div className="shrink-0 border-b border-border/40 px-5 py-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <h3 id={`pozitivna-zvjezdica-${u.id}`} className="font-extrabold text-foreground">
                                            ⭐ {t("Pozitivna zvjezdica")}
                                          </h3>
                                          <p className="mt-1 text-sm text-muted-foreground">{u.displayName}</p>
                                        </div>
                                        <button type="button" onClick={() => setPozDropOpen(null)}
                                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("Zatvori")}>
                                          <X className="h-5 w-5" />
                                        </button>
                                      </div>
                                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                                        {t("Trenutno: {n}", { n: String(zvjezdiceSummary.get(u.id)?.pozitivne ?? 0) })}
                                      </p>
                                    </div>
                                    <div className="min-h-0 overflow-y-auto p-3">
                                      <button
                                        onClick={() => { addZvjezdica(u.id, "pozitivna"); setPozDropOpen(null); }}
                                        className="w-full rounded-xl border border-amber-200 px-3 py-3 text-left text-sm font-medium text-amber-700 hover:bg-amber-50"
                                      >
                                        ⭐ {t("Bez kategorije")}
                                      </button>
                                      {pozKat.map(k => (
                                        <button key={k.id}
                                          onClick={() => { addZvjezdica(u.id, "pozitivna", k.id); setPozDropOpen(null); }}
                                          className="mt-2 w-full rounded-xl border border-border/50 px-3 py-3 text-left text-sm text-amber-700 hover:bg-amber-50"
                                        >
                                          ⭐ {k.naziv}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="shrink-0 border-t border-border/40 bg-muted/20 p-3">
                                      <button type="button" onClick={() => setPozDropOpen(null)}
                                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted">
                                        {t("Otkaži")}
                                      </button>
                                    </div>
                                  </div>
                                </div>,
                                document.body
                              )}
                            </div>

                            {/* ★ Negativna */}
                            <div className="relative">
                              <button
                                onClick={() => setNegDropOpen(negDropOpen === u.id ? null : u.id)}
                                className="flex flex-col items-center gap-0.5 px-6 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200 transition-colors font-bold text-sm"
                              >
                                <span className="text-xl leading-none">★</span>
                                <span className="text-[10px] font-extrabold">{t("Negativna")}</span>
                              </button>
                              {negDropOpen === u.id && typeof document !== "undefined" && createPortal(
                                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
                                  onClick={() => setNegDropOpen(null)}>
                                  <div role="dialog" aria-modal="true" aria-labelledby={`negativna-zvjezdica-${u.id}`}
                                    className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                                    onClick={e => e.stopPropagation()}>
                                    <div className="shrink-0 border-b border-border/40 px-5 py-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <h3 id={`negativna-zvjezdica-${u.id}`} className="font-extrabold text-foreground">
                                            ★ {t("Negativna zvjezdica")}
                                          </h3>
                                          <p className="mt-1 text-sm text-muted-foreground">{u.displayName}</p>
                                        </div>
                                        <button type="button" onClick={() => setNegDropOpen(null)}
                                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={t("Zatvori")}>
                                          <X className="h-5 w-5" />
                                        </button>
                                      </div>
                                      <p className="mt-3 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">
                                        {t("Trenutno: {n}", { n: String(zvjezdiceSummary.get(u.id)?.negativne ?? 0) })}
                                      </p>
                                    </div>
                                    <div className="min-h-0 overflow-y-auto p-3">
                                      <button
                                        onClick={() => { addZvjezdica(u.id, "negativna"); setNegDropOpen(null); }}
                                        className="w-full rounded-xl border border-border/60 px-3 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                                      >
                                        ★ {t("Bez kategorije")}
                                      </button>
                                      {negKat.map(k => (
                                        <button key={k.id}
                                          onClick={() => { addZvjezdica(u.id, "negativna", k.id); setNegDropOpen(null); }}
                                          className="mt-2 w-full rounded-xl border border-border/50 px-3 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                          ★ {k.naziv}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="shrink-0 border-t border-border/40 bg-muted/20 p-3">
                                      <button type="button" onClick={() => setNegDropOpen(null)}
                                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted">
                                        {t("Otkaži")}
                                      </button>
                                    </div>
                                  </div>
                                </div>,
                                document.body
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>}
         </div>
         </div>

        {showMoveModal && moveStudent && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="font-extrabold text-foreground mb-1">{t("Prebaci učenika")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("{ime} → odaberi novu grupu", { ime: moveStudent.displayName })}
              </p>
              <select value={moveTargetGrupaId} onChange={e => setMoveTargetGrupaId(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20 mb-4">
                <option value="">{t("Bez grupe")}</option>
                {sveGrupe.filter(g => !g.isArchived && g.id !== grupaId).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.muallimDisplayName ? `${g.naziv} (${g.muallimDisplayName})` : g.naziv}
                  </option>
                ))}
              </select>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowMoveModal(false)} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={handleMove} disabled={moveLoading} className="flex-1 rounded-xl font-bold">
                  {moveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Prebaci")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {ocjenaTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !savingOcjena && setOcjenaTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-extrabold text-foreground mb-1 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" /> {t("Ocjena za {ime}", { ime: ocjenaTarget.displayName })}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">{t("Unesi ocjenu i pripadajuću kategoriju.")}</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Kategorija")}</label>
                    <select value={newOcjena.kategorija}
                      onChange={e => setNewOcjena(o => ({ ...o, kategorija: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                      <option value="usmeno">{t("Usmeno")}</option>
                      <option value="ucenje">{t("Učenje")}</option>
                      <option value="prakticno">{t("Praktično")}</option>
                       <option value="test">{t("Test")}</option>
                       <option value="ponasanje">{t("Napamet")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Ocjena (1–6)")}</label>
                    <select value={newOcjena.ocjena}
                      onChange={e => setNewOcjena(o => ({ ...o, ocjena: parseInt(e.target.value) }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white font-bold">
                      {[6,5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={!!newOcjena.napametStavkaId}
                    onChange={async (e) => {
                      if (!e.target.checked) { setNewOcjena(o => ({ ...o, napametStavkaId: "" })); return; }
                      let katalog = napametKatalog;
                      if (napametKatalog.length === 0 && token && ocjenaTarget) {
                        const data = await apiRequest<{ katalog: NapametStavka[] }>("GET", `/muallim/napamet/${ocjenaTarget.id}`, undefined, token);
                        katalog = data.katalog;
                        setNapametKatalog(data.katalog);
                      }
                      setNewOcjena(o => ({ ...o, napametStavkaId: katalog[0]?.id || "" }));
                    }} />
                  <span className="text-sm font-bold text-emerald-900">
                    {newOcjena.lekcijaSlug && napametKatalog.some(s => s.sourceLessonSlug === newOcjena.lekcijaSlug)
                      ? t("Povezana lekcija će se automatski dodati u Napamet")
                      : t("Dodaj u Napamet tab")}
                  </span>
                </label>
                {!!newOcjena.napametStavkaId && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Napamet stavka")}</label>
                    <select value={newOcjena.napametStavkaId}
                      onChange={e => setNewOcjena(o => ({ ...o, napametStavkaId: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-white">
                      <option value="select" disabled>{t("Odaberi stavku")}</option>
                      {[1, 2, 3, 4].map(nivo => (
                        <optgroup key={nivo} label={nivo === 4 ? t("Dodatak") : `${t("Napamet")} ${nivo}. nivo`}>
                          {napametKatalog.filter(s => s.nivo === nivo).map(s => <option key={s.id} value={s.id}>{s.naziv}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Lekcija")}</label>
                  <LekcijaPicker
                    lekcije={ilmihalLekcije}
                    value={newOcjena.lekcijaNaziv}
                    onChange={v => setNewOcjena(o => ({ ...o, lekcijaNaziv: v, lekcijaSlug: "" }))}
                    onSelectLesson={lekcija => {
                      const source = lekcija?.slug
                        ? napametKatalog.find(s => s.sourceLessonSlug === lekcija.slug)
                        : undefined;
                      setNewOcjena(o => ({
                        ...o,
                        lekcijaNaziv: lekcija?.naslov || "",
                        lekcijaSlug: lekcija?.slug || "",
                        napametStavkaId: source?.id || "",
                      }));
                    }}
                    placeholder={t("Pretraži lekciju ili upiši broj…")}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Datum")}</label>
                  <input type="date" value={newOcjena.datum}
                    onChange={e => setNewOcjena(o => ({ ...o, datum: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Napomena (opciono)")}</label>
                  <textarea value={newOcjena.napomena} rows={2}
                    onChange={e => setNewOcjena(o => ({ ...o, napomena: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setOcjenaTarget(null)} disabled={savingOcjena} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={saveOcjena} disabled={savingOcjena} className="flex-1 rounded-xl font-bold">
                  {savingOcjena ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Spremi")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {showZadacaModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !savingZadaca && setShowZadacaModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-extrabold text-foreground mb-1 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-violet-600" />
                {zadacaTarget ? t("Zadaća za {ime}", { ime: zadacaTarget.displayName }) : t("Zadaća za cijelu grupu")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {zadacaTarget
                  ? t("Vidljivo samo ovom učeniku.")
                  : t("Vidljivo svim učenicima u grupi ({n}).", { n: String(studentiGrupe.length) })}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Naslov *")}</label>
                  <input type="text" value={newZadaca.naslov}
                    onChange={e => setNewZadaca(z => ({ ...z, naslov: e.target.value }))}
                    placeholder={t("Npr. Nauči Fatihu napamet")}
                    className="w-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="input-zadaca-naslov"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Opis")}</label>
                  <textarea value={newZadaca.opis} rows={3}
                    onChange={e => setNewZadaca(z => ({ ...z, opis: e.target.value }))}
                    placeholder={t("Detalji zadaće (opciono)")}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Rok do")}</label>
                    <input type="date" value={newZadaca.rokDo}
                      onChange={e => setNewZadaca(z => ({ ...z, rokDo: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Lekcija")}</label>
                    <LekcijaPicker
                      lekcije={ilmihalLekcije}
                      value={newZadaca.lekcijaNaslov}
                      onChange={v => setNewZadaca(z => ({ ...z, lekcijaNaslov: v }))}
                      onSelectLesson={async lekcija => {
                        setNewZadaca(z => ({ ...z, lekcijaSlug: lekcija?.slug || "" }));
                        setZadPriloziIds(new Set());
                        if (!lekcija?.slug || !token) { setZadMaterijali([]); return; }
                        try {
                          const data = await apiRequest<{ prilozi?: NastavniMaterijal[] }>("GET", `/content/ilmihal/${lekcija.slug}`, undefined, token);
                          setZadMaterijali((data.prilozi || []).filter(p => p.kind === "file" || p.kind === "url"));
                        } catch { setZadMaterijali([]); }
                      }}
                      placeholder={t("Pretraži lekciju ili upiši broj…")}
                    />
                  </div>
                </div>
                {newZadaca.lekcijaSlug && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">{t("Materijali za nastavu")}</label>
                    {zadMaterijali.length === 0 ? <p className="text-xs text-muted-foreground italic">{t("Ova lekcija nema dostupnih materijala.")}</p> : (
                      <div className="border border-border rounded-xl p-2 space-y-1 max-h-36 overflow-y-auto">
                        {zadMaterijali.map(m => <label key={m.id} className="flex items-center gap-2 px-1 py-1 cursor-pointer">
                          <input type="checkbox" checked={zadPriloziIds.has(m.id)} onChange={() => setZadPriloziIds(prev => {
                            const next = new Set(prev); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); return next;
                          })} className="w-4 h-4 accent-primary" />
                          <span className="text-sm">{m.originalName}</span>
                        </label>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowZadacaModal(false)} disabled={savingZadaca} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={saveZadaca} disabled={savingZadaca || !newZadaca.naslov.trim()} className="flex-1 rounded-xl font-bold"
                  data-testid="btn-save-zadaca"
                >
                  {savingZadaca ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Dodaj zadaću")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {parentResetTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !parentResetWorking && setParentResetTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-extrabold text-foreground flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-blue-600" /> {t("Šifra roditelja")}
                </h3>
                <button onClick={() => setParentResetTarget(null)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t("Vrati šifru roditelja učenika {ime} na standardnu.", { ime: parentResetTarget.displayName })}</p>

              {parentResetLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : parentResetList.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  {t("Ovaj učenik nema povezanog roditelja. Roditelja možeš dodati iz profila učenika (klikni strelicu desno).")}
                </div>
              ) : (
                <div className="space-y-2">
                  {parentResetList.map(r => (
                    <div key={r.id} className="bg-muted/20 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground truncate">{r.displayName}</p>
                          <p className="text-xs font-mono text-muted-foreground">{r.username}</p>
                        </div>
                        <Button size="sm" onClick={() => doParentReset(r.id)}
                          disabled={parentResetWorking === r.id}
                          className="rounded-lg text-xs font-bold flex items-center gap-1.5">
                          {parentResetWorking === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                          {t("Resetuj šifru")}
                        </Button>
                      </div>
                      {parentResetResult?.id === r.id && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-700">{t("Standardna šifra:")}</span>
                          <code className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-800">{parentResetResult.password}</code>
                          <Button size="sm" variant="outline"
                            onClick={async () => { try { await navigator.clipboard.writeText(parentResetResult.password); toast({ title: t("Kopirano!") }); } catch {} }}
                            className="rounded-lg text-[11px] h-6 px-2">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !deleteLoading && setDeleteTarget(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-extrabold text-foreground">{t("Obriši učenika trajno?")}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">{deleteTarget.displayName}</strong>{" "}{t("i svi njegovi podaci (ocjene, prisustvo, napredak, zadaće, povezivanja s roditeljima) bit će")}{" "}<strong className="text-red-600">{t("trajno obrisani")}</strong>{t(". Ova akcija se ne može poništiti.")}
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
                {t(`Ako želiš samo da ga ukloniš iz grupe (zadržavajući podatke), iskoristi dugme "Prebaci u drugu grupu" i odaberi "Bez grupe".`)}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="flex-1 rounded-xl">
                  {t("Otkaži")}
                </Button>
                <Button onClick={handleHardDelete} disabled={deleteLoading}
                  className="flex-1 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-confirm-delete"
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Obriši trajno")}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Modal: promjena muallima grupe (samo za glavnog) */}
      {showChangeMuallim && isGlavni && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => { if (!changingMuallim) setShowChangeMuallim(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="font-extrabold text-foreground">{t("Promijeni muallima grupe")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("Odaberi muallima koji će biti odgovoran za grupu")} <span className="font-bold text-foreground">„{grupa?.naziv}"</span>.
            </p>
            <div className="space-y-2 mb-5">
              {mektebMuallimi.map(m => (
                <label key={m.userId}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${changeMuallimId === m.userId ? "border-emerald-400 bg-emerald-50" : "border-border hover:border-emerald-200 hover:bg-emerald-50/40"}`}>
                  <input type="radio" className="sr-only" checked={changeMuallimId === m.userId}
                    onChange={() => setChangeMuallimId(m.userId)} />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${changeMuallimId === m.userId ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"}`}>
                    {changeMuallimId === m.userId && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm text-foreground">{m.displayName}</span>
                    {m.isGlavni && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-extrabold">{t("GLAVNI")}</span>}
                  </div>
                  {changeMuallimId === m.userId && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowChangeMuallim(false)} disabled={changingMuallim} className="flex-1 rounded-xl">
                {t("Otkaži")}
              </Button>
              <Button onClick={confirmChangeMuallim}
                disabled={changingMuallim || changeMuallimId === null || changeMuallimId === grupa?.muallimId}
                className="flex-1 rounded-xl font-bold">
                {changingMuallim ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Potvrdi")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {napametOdabrana && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          onClick={() => { setNapametOdabrana(null); setNapametDetalji(null); setNapametDetaljiError(null); }}>
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            role="dialog" aria-modal="true" aria-labelledby="napamet-detalji-title"
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  {napametOdabrana.nivo === 4 ? t("Dodatak") : `${t("Napamet")} ${napametOdabrana.nivo}. ${t("nivo")}`}
                </p>
                <h2 id="napamet-detalji-title" className="mt-1 text-lg font-extrabold text-emerald-950">
                  {napametDetalji?.stavka.naziv || napametOdabrana.naziv}
                </h2>
              </div>
              <button type="button" aria-label={t("Zatvori")} onClick={() => { setNapametOdabrana(null); setNapametDetalji(null); }} className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              {napametDetaljiLoading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> {t("Učitavanje...")}</div>}
              {napametDetaljiError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{napametDetaljiError}</div>}
              {napametDetalji && !napametDetaljiLoading && !napametDetaljiError && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 font-extrabold text-emerald-800"><Check className="h-4 w-4" /> {t("Ocijenjeni")} <span className="text-xs font-bold text-muted-foreground">({napametDetalji.ocijenjeni.length})</span></h3>
                    {napametDetalji.ocijenjeni.length ? <div className="space-y-2">{napametDetalji.ocijenjeni.map((student) => (
                      <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                        <span className="min-w-0 truncate text-sm font-bold">{student.displayName}</span>
                        <span className="shrink-0 text-right"><strong className="rounded-full bg-emerald-100 px-2 py-1 text-sm text-emerald-800">{student.ocjena}</strong><small className="ml-2 text-xs text-muted-foreground">{fmtDatum(student.datum) || student.datum}</small></span>
                      </div>
                    ))}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-muted-foreground">{t("Niko još nije ocijenjen.")}</p>}
                  </div>
                  <div>
                    <h3 className="mb-2 flex items-center gap-2 font-extrabold text-slate-600"><Users className="h-4 w-4" /> {t("Još nisu ocijenjeni")} <span className="text-xs font-bold text-muted-foreground">({napametDetalji.nisuOcijenjeni.length})</span></h3>
                    {napametDetalji.nisuOcijenjeni.length ? <div className="space-y-2">{napametDetalji.nisuOcijenjeni.map((student) => (
                      <div key={student.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-600">{student.displayName}</div>
                    ))}</div> : <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{t("Svi učenici su ocijenjeni.")}</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-border p-4"><Button variant="outline" onClick={() => { setNapametOdabrana(null); setNapametDetalji(null); }} className="w-full rounded-xl">{t("Zatvori")}</Button></div>
          </motion.div>
        </div>
      )}

    </Layout>
  );
}
