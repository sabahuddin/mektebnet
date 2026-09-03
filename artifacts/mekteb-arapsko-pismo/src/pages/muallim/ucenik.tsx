import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { ArrowLeft, User, CalendarCheck, Star, PlusCircle, Loader2, ClipboardList, Award, KeyRound, FileText, Copy, Check, Sparkles, Filter, Users, UserPlus, Search, X, Clock, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isOnline, formatScreentime, kategorijaOcjeneLabel } from "@/lib/utils";
import { goBackOr } from "@/lib/back-navigation";
import { NapametPregled, type NapametStavka, type NapametOcjena } from "@/components/NapametPregled";

interface Ucenik {
  id: number;
  displayName: string;
  username: string;
  role: string;
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
  lekcijaNaziv?: string;
  napomena?: string;
  datum: string;
  napametStavkaId?: string | null;
}

interface Grupa {
  id: number;
  naziv: string;
}

interface IlmihalLekcija {
  id: number;
  naslov: string;
  nivo: number;
}

interface ZadacaPregled {
  id: number;
  naslov: string;
  opis?: string | null;
  rokDo?: string | null;
  lekcijaNaslov?: string | null;
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

interface KvizRezultat {
  id: number;
  kvizNaslov: string;
  tacniOdgovori: number;
  ukupnoPitanja: number;
  procenat: number;
  bodovi: number;
  completedAt: string;
}

interface H5PPokusaj {
  id: number;
  priloziId: number;
  attemptNo: number;
  score: number;
  maxScore: number;
  procenat: number;
  hasanatGained: number;
  completedAt: string;
}

interface H5PPrilogInfo {
  id: number;
  originalName: string;
  lekcijaId: number;
  lekcijaNaslov: string | null;
  lekcijaSlug: string | null;
  lekcijaNivo: number | null;
}

interface InteraktivniPitanjePregled {
  lekcijaNaslov: string;
  pitanjeTekst: string;
  brojPokusaja: number;
  netacniPokusaji: number;
  procenatTacnih: number;
  pomocBroj: number;
  tacnoNakonPonovnogCitanja: number;
  prosjekVrijemeSekundi: number;
}

interface RoditeljVeza {
  id: number;
  displayName: string;
  username: string;
  status: string;
  approvedAt: string | null;
}

interface RoditeljPretraga {
  id: number;
  displayName: string;
  username: string;
  brojDjece: number;
}

interface KreiraniRoditelj {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
}

const STATUS_COLORS: Record<string, string> = {
  prisutan: "bg-emerald-100 text-emerald-700",
  odsutan: "bg-red-100 text-red-700",
  zakasnio: "bg-amber-100 text-amber-700",
  opravdan: "bg-blue-100 text-blue-700",
};

const OCJENA_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-emerald-200 text-emerald-800"];
// Aktivne kategorije ocjena (vrijednost -> prikaz). Vrijednosti su stabilne radi
// kompatibilnosti sa starim ocjenama; mijenja se samo prikazni naziv.
const OCJENA_KATEGORIJE: { value: string; label: string }[] = [
  { value: "napamet", label: "Učenje" },
  { value: "usmeno", label: "Usmeno" },
  { value: "pismeno", label: "Pismeno" },
  { value: "prakticno", label: "Praktično" },
  { value: "zadaća", label: "Zadaća" },
  { value: "test", label: "Test" },
  { value: "vladanje", label: "Napamet" },
];

export default function UcenikPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [ucenik, setUcenik] = useState<Ucenik | null>(null);
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [napamet, setNapamet] = useState<{ katalog: NapametStavka[]; ocjene: NapametOcjena[] } | null>(null);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [kvizRezultati, setKvizRezultati] = useState<KvizRezultat[]>([]);
  const [h5pPokusaji, setH5pPokusaji] = useState<H5PPokusaj[]>([]);
  const [interaktivnaPitanja, setInteraktivnaPitanja] = useState<InteraktivniPitanjePregled[]>([]);
  const [h5pPrilozi, setH5pPrilozi] = useState<H5PPrilogInfo[]>([]);
  const [h5pFilterPrilogId, setH5pFilterPrilogId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("h5pPrilogId");
    return v ? parseInt(v) : null;
  });
  const h5pSectionRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planLekcije, setPlanLekcije] = useState<{ id: number; lekcijaNaslov: string }[]>([]);
  const [ilmihalLekcije, setIlmihalLekcije] = useState<IlmihalLekcija[]>([]);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Roditelji
  const [roditelji, setRoditelji] = useState<RoditeljVeza[]>([]);
  const [showRoditeljForm, setShowRoditeljForm] = useState(false);
  const [novoRoditeljIme, setNovoRoditeljIme] = useState("");
  const [savingRoditelj, setSavingRoditelj] = useState(false);
  const [kreiraniRoditelj, setKreiraniRoditelj] = useState<KreiraniRoditelj | null>(null);
  const [copiedRoditelj, setCopiedRoditelj] = useState(false);
  const [resetRoditeljId, setResetRoditeljId] = useState<number | null>(null);
  const [resetRoditeljPass, setResetRoditeljPass] = useState<{ id: number; password: string; displayName: string; username: string } | null>(null);
  // Povezivanje POSTOJEĆEG roditelja (drugo dijete istih roditelja itd.)
  const [postojeciUsername, setPostojeciUsername] = useState("");
  const [odabraniRoditelj, setOdabraniRoditelj] = useState<RoditeljPretraga | null>(null);
  const [roditeljRezultati, setRoditeljRezultati] = useState<RoditeljPretraga[]>([]);
  const [pretragaRoditelja, setPretragaRoditelja] = useState(false);
  const [linkujemPostojeceg, setLinkujemPostojeceg] = useState(false);
  const [uklaniRoditeljId, setUklaniRoditeljId] = useState<number | null>(null);

  // Pregled zadaća ovog učenika (read-only). Dodavanje ide iz Muallim → Zadaća.
  const [zadace, setZadace] = useState<ZadacaPregled[]>([]);
  const [zadSubTab, setZadSubTab] = useState<"utoku" | "zavrseno">("utoku");

  // Zvjezdice — classroom management (read-only na profilu; dodavanje je na kartici grupe)
  const [zvjezdice, setZvjezdice] = useState<{ entries: any[]; pozitivne: number; negativne: number } | null>(null);
  const [zvjezdiceLoading, setZvjezdiceLoading] = useState(false);
  const [resetZvjezdiceLoading, setResetZvjezdiceLoading] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    const ucenikId = parseInt(id);
    Promise.all([
      apiRequest<Ucenik[]>("GET", "/muallim/ucenici", undefined, token),
      apiRequest<Ocjena[]>("GET", `/muallim/ocjene/${ucenikId}`, undefined, token),
      apiRequest<Prisustvo[]>("GET", `/muallim/prisustvo-ucenik/${ucenikId}`, undefined, token),
      apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token),
      apiRequest<{ rezultati: KvizRezultat[] }>("GET", `/muallim/ucenik-rezultati/${ucenikId}`, undefined, token).catch(() => ({ rezultati: [] })),
      apiRequest<IlmihalLekcija[]>("GET", "/muallim/lekcije-za-plan", undefined, token).catch(() => []),
      apiRequest<{ pokusaji: H5PPokusaj[]; prilozi: H5PPrilogInfo[] }>("GET", `/muallim/ucenik/${ucenikId}/h5p-pokusaji`, undefined, token).catch(() => ({ pokusaji: [], prilozi: [] })),
      apiRequest<{ pitanja: InteraktivniPitanjePregled[] }>("GET", `/muallim/ucenik/${ucenikId}/interaktivni-blokovi`, undefined, token).catch(() => ({ pitanja: [] })),
      apiRequest<RoditeljVeza[]>("GET", `/muallim/ucenici/${ucenikId}/roditelji`, undefined, token).catch(() => []),
      apiRequest<ZadacaPregled[]>("GET", `/muallim/ucenik/${ucenikId}/zadace`, undefined, token).catch(() => []),
      apiRequest<{ katalog: NapametStavka[]; ocjene: NapametOcjena[] }>("GET", `/muallim/napamet/${ucenikId}`, undefined, token).catch(() => ({ katalog: [], ocjene: [] })),
    ]).then(([ucenici, oc, prs, g, kvizData, lekcije, h5pData, interaktivniData, rod, zad, napametData]) => {
      setRoditelji((rod as RoditeljVeza[]) || []);
      setZadace((zad as ZadacaPregled[]) || []);
      const found = (ucenici as any[]).find(u => u.id === ucenikId);
      setUcenik(found || null);
      setOcjene(oc);
      setNapamet(napametData as { katalog: NapametStavka[]; ocjene: NapametOcjena[] });
      setPrisustvo(prs);
      setGrupe(g);
      setKvizRezultati((kvizData as any).rezultati || []);
      setIlmihalLekcije(lekcije as IlmihalLekcija[]);
      setH5pPokusaji((h5pData as any).pokusaji || []);
      setH5pPrilozi((h5pData as any).prilozi || []);
      setInteraktivnaPitanja((interaktivniData as any).pitanja || []);
      const gId = found?.profil?.grupaId || found?.grupaId;
      if (gId) {
        apiRequest<{ id: number; lekcijaNaslov: string }[]>("GET", `/muallim/plan-lekcija?grupaId=${gId}`, undefined, token)
          .then(pl => {
            const unique = [...new Map(pl.map(l => [l.lekcijaNaslov, l])).values()];
            setPlanLekcije(unique);
          }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [token, id]);

  // Zvjezdice učenika (classroom management)
  useEffect(() => {
    if (!token || !id) return;
    setZvjezdiceLoading(true);
    apiRequest<{ entries: any[]; pozitivne: number; negativne: number }>(
      "GET", `/muallim/ucenik/${parseInt(id)}/zvjezdice`, undefined, token
    ).then(setZvjezdice).catch((err) => {
      console.error("zvjezdice GET greška:", err?.message, err?.status);
    }).finally(() => setZvjezdiceLoading(false));
  }, [token, id]);

  async function resetujZvjezdice() {
    if (!token || !id) return;
    setResetZvjezdiceLoading(true);
    try {
      await apiRequest("DELETE", `/muallim/ucenik/${parseInt(id)}/zvjezdice`, undefined, token);
      setZvjezdice({ entries: [], pozitivne: 0, negativne: 0 });
      toast({ title: t("Zvjezdice resetovane") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setResetZvjezdiceLoading(false);
    }
  }

  useEffect(() => {
    if (!token || postojeciUsername.trim().length < 2 || odabraniRoditelj) {
      setRoditeljRezultati([]);
      setPretragaRoditelja(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setPretragaRoditelja(true);
      try {
        const results = await apiRequest<RoditeljPretraga[]>(
          "GET",
          `/muallim/roditelji/pretraga?q=${encodeURIComponent(postojeciUsername.trim())}`,
          undefined,
          token,
        );
        setRoditeljRezultati(results);
      } catch {
        setRoditeljRezultati([]);
      } finally {
        setPretragaRoditelja(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [token, postojeciUsername, odabraniRoditelj]);


  async function resetPassword() {
    if (!token || !id) return;
    setResettingPass(true);
    try {
      const res = await apiRequest<{ ok: boolean; newPassword: string; displayName: string; username: string }>(
        "POST",
        `/muallim/ucenik/${parseInt(id)}/reset-password`,
        {},
        token
      );
      setNewPassword(res.newPassword);
      setCopiedPass(false);
      toast({ title: t("Šifra vraćena na standardnu!"), description: t("Standardna šifra je prikazana ispod.") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće resetovati šifru"), variant: "destructive" });
    } finally {
      setResettingPass(false);
    }
  }

  async function copyPassword() {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    } catch {}
  }

  async function addRoditelj() {
    if (!token || !id || !novoRoditeljIme.trim()) {
      toast({ title: t("Unesite ime roditelja"), variant: "destructive" });
      return;
    }
    setSavingRoditelj(true);
    try {
      const created = await apiRequest<KreiraniRoditelj>(
        "POST",
        `/muallim/ucenici/${parseInt(id)}/roditelj`,
        { displayName: novoRoditeljIme.trim() },
        token,
      );
      setKreiraniRoditelj(created);
      setRoditelji(prev => [...prev, {
        id: created.id,
        displayName: created.displayName,
        username: created.username,
        status: "approved",
        approvedAt: new Date().toISOString(),
      }]);
      setNovoRoditeljIme("");
      toast({ title: t("Roditelj kreiran!"), description: t("Proslijedi kredencijale roditelju.") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće kreirati roditelja"), variant: "destructive" });
    } finally {
      setSavingRoditelj(false);
    }
  }

  async function linkPostojecegRoditelja() {
    const username = odabraniRoditelj?.username || postojeciUsername.trim();
    if (!token || !id || !username) {
      toast({ title: t("Pretražite i odaberite roditelja"), variant: "destructive" });
      return;
    }
    setLinkujemPostojeceg(true);
    try {
      const linked = await apiRequest<{ id: number; displayName: string; username: string; status: string }>(
        "POST",
        `/muallim/ucenici/${parseInt(id)}/povezi-roditelja`,
        { roditeljUsername: username },
        token,
      );
      setRoditelji(prev => {
        if (prev.some(r => r.id === linked.id)) return prev;
        return [...prev, {
          id: linked.id,
          displayName: linked.displayName,
          username: linked.username,
          status: "approved",
          approvedAt: new Date().toISOString(),
        }];
      });
      setPostojeciUsername("");
      setOdabraniRoditelj(null);
      setRoditeljRezultati([]);
      toast({ title: t("Roditelj povezan!"), description: t("{ime} sada može pratiti ovog učenika.", { ime: linked.displayName }) });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće povezati roditelja"), variant: "destructive" });
    } finally {
      setLinkujemPostojeceg(false);
    }
  }

  async function resetRoditeljPassword(roditeljId: number) {
    if (!token) return;
    setResetRoditeljId(roditeljId);
    try {
      const res = await apiRequest<{ ok: boolean; newPassword: string; displayName: string; username: string }>(
        "POST", `/muallim/roditelj/${roditeljId}/reset-password`, {}, token,
      );
      setResetRoditeljPass({ id: roditeljId, password: res.newPassword, displayName: res.displayName, username: res.username });
      toast({ title: t("Šifra roditelja vraćena na standardnu!"), description: t("Standardna šifra je prikazana ispod.") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće resetovati šifru roditelja"), variant: "destructive" });
    } finally {
      setResetRoditeljId(null);
    }
  }

  async function copyRoditeljKredencijale() {
    if (!kreiraniRoditelj) return;
    try {
      const txt = t("Roditelj: {ime}\nKorisničko ime: {korisnik}\nLozinka: {lozinka}", { ime: kreiraniRoditelj.displayName, korisnik: kreiraniRoditelj.username, lozinka: kreiraniRoditelj.generatedPassword });
      await navigator.clipboard.writeText(txt);
      setCopiedRoditelj(true);
      setTimeout(() => setCopiedRoditelj(false), 2000);
    } catch {}
  }

  async function ukloniRoditelja(roditeljId: number) {
    if (!token || !id) return;
    setUklaniRoditeljId(roditeljId);
    try {
      await apiRequest("DELETE", `/muallim/ucenici/${parseInt(id)}/roditelji/${roditeljId}`, undefined, token);
      setRoditelji(prev => prev.filter(r => r.id !== roditeljId));
      toast({ title: t("Roditelj uklonjen"), description: t("Veza je raskinuta. Nalog roditelja nije obrisan.") });
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće ukloniti roditelja"), variant: "destructive" });
    } finally {
      setUklaniRoditeljId(null);
    }
  }

  // Model 1 učenik = 1 roditelj: kad učenik već ima odobrenog roditelja,
  const approvedRoditeljiCount = roditelji.filter(r => r.status === "approved").length;

  const prisutnih = prisustvo.filter(p => p.status === "prisutan").length;
  const odsutnih = prisustvo.filter(p => p.status === "odsutan").length;
  const zakasnio = prisustvo.filter(p => p.status === "zakasnio").length;
  const opravdano = prisustvo.filter(p => p.status === "opravdan").length;
  const prisustvoPct = prisustvo.length > 0 ? Math.round((prisutnih / prisustvo.length) * 100) : null;
  const prosjecnaOcjena = ocjene.length ? (ocjene.reduce((s, o) => s + o.ocjena, 0) / ocjene.length).toFixed(2) : null;
  const ukupnoBodova = kvizRezultati.reduce((s, r) => s + (r.bodovi || 0), 0);
  const kvizProsjek = kvizRezultati.length ? Math.round(kvizRezultati.reduce((s, r) => s + r.procenat, 0) / kvizRezultati.length) : null;

  const h5pPriloziMap = new Map<number, H5PPrilogInfo>(h5pPrilozi.map(p => [p.id, p]));
  const filteredH5pPokusaji = h5pFilterPrilogId
    ? h5pPokusaji.filter(p => p.priloziId === h5pFilterPrilogId)
    : h5pPokusaji;
  const h5pProsjek = filteredH5pPokusaji.length
    ? Math.round(filteredH5pPokusaji.reduce((s, p) => s + p.procenat, 0) / filteredH5pPokusaji.length)
    : null;
  const h5pHasanat = filteredH5pPokusaji.reduce((s, p) => s + (p.hasanatGained || 0), 0);

  useEffect(() => {
    if (h5pFilterPrilogId && !isLoading && h5pSectionRef.current) {
      h5pSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [h5pFilterPrilogId, isLoading]);

  const mjesecniPrisustvo = (() => {
    const map: Record<string, { prisutan: number; total: number }> = {};
    prisustvo.forEach(p => {
      const m = p.datum.substring(0, 7);
      if (!map[m]) map[m] = { prisutan: 0, total: 0 };
      map[m].total++;
      if (p.status === "prisutan") map[m].prisutan++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([mjesec, v]) => ({
      mjesec,
      ...v,
      pct: Math.round((v.prisutan / v.total) * 100),
    }));
  })();

  const MJESEC_NAZIVI: Record<string, string> = {
    "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Maj", "06": "Jun",
    "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dec",
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <button onClick={() => goBackOr(() => setLocation("/muallim"))} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na panel")}
        </button>

        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !ucenik ? (
          <div className="text-center py-20 text-muted-foreground">{t("Učenik nije pronađen")}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
                  <User className="w-7 h-7 text-white" />
                </div>
                {isOnline(ucenik.lastSeenAt) && (
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-white"
                    title={t("Online")}
                    data-testid="online-dot-profile"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-extrabold text-foreground">{ucenik.displayName}</h1>
                  {isOnline(ucenik.lastSeenAt) && (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{t("online")}</span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm font-mono">{ucenik.username}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => { setShowResetForm(s => !s); setNewPassword(null); }}
                  variant="outline"
                  className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                  data-testid="btn-toggle-reset-password"
                >
                  <KeyRound className="w-4 h-4" /> {t("Šifra")}
                </Button>
                <Button
                  onClick={() => { setShowRoditeljForm(s => !s); setKreiraniRoditelj(null); setNovoRoditeljIme(""); }}
                  variant="outline"
                  className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                  data-testid="btn-toggle-roditelji"
                >
                  <Users className="w-4 h-4" /> {t("Roditelji")}
                  {roditelji.length > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center bg-primary/10 text-primary rounded-full text-[10px] font-extrabold w-4 h-4">
                      {roditelji.length}
                    </span>
                  )}
                </Button>
                <Button
                  onClick={() => setLocation(`/muallim/izvjestaj/ucenik/${ucenik.id}`)}
                  variant="outline"
                  className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                  data-testid="btn-izvjestaj-ucenik"
                >
                  <FileText className="w-4 h-4" /> {t("Izvještaj")}
                </Button>
              </div>
            </div>

            {showResetForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-white border border-border/50 rounded-2xl p-5 mb-6 shadow-sm"
                data-testid="form-reset-password"
              >
                <h3 className="font-extrabold text-foreground mb-2 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" /> {t("Šifra za {ime}", { ime: ucenik.displayName })}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("Standardna šifra je oblika")} <strong>Mekteb####</strong> {t("(broj iz korisničkog imena) i identična je onoj na odštampanoj kartici. Reset vraća šifru na tu standardnu vrijednost.")}
                </p>
                <Button
                  onClick={() => resetPassword()}
                  disabled={resettingPass}
                  className="rounded-xl font-bold flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 w-full sm:w-auto"
                  data-testid="btn-reset-standardna-sifra"
                >
                  {resettingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {t("Vrati na standardnu šifru")}
                </Button>
                {newPassword && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4" data-testid="display-nova-sifra">
                    <p className="text-xs text-emerald-700 font-bold mb-1">{t("Standardna šifra je postavljena. Predajte je učeniku:")}</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <code className="bg-white border border-emerald-300 rounded-lg px-3 py-2 text-base font-mono font-bold text-emerald-800 flex-1">{newPassword}</code>
                      <Button
                        onClick={copyPassword}
                        variant="outline"
                        className="rounded-xl font-bold text-sm flex items-center gap-1.5"
                        data-testid="btn-copy-sifra"
                      >
                        {copiedPass ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {copiedPass ? t("Kopirano") : t("Kopiraj")}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {showRoditeljForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-white border border-border/50 rounded-2xl p-5 mb-6 shadow-sm"
                data-testid="form-roditelji"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> {t("Roditelji za {ime}", { ime: ucenik.displayName })}
                  </h3>
                  <button
                    onClick={() => { setShowRoditeljForm(false); setKreiraniRoditelj(null); setNovoRoditeljIme(""); }}
                    className="p-1 hover:bg-muted rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Postojeći roditelji */}
                {roditelji.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-muted-foreground mb-2">{t("Povezani roditelji ({n}):", { n: String(roditelji.length) })}</p>
                    <div className="space-y-1.5">
                      {roditelji.map(r => (
                        <div key={r.id} className="bg-muted/30 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <User className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-foreground block truncate">{r.displayName}</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="font-mono text-[11px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded">{r.username}</span>
                                  <button
                                    type="button"
                                    title={t("Kopiraj korisničko ime")}
                                    onClick={async () => { try { await navigator.clipboard.writeText(r.username); toast({ title: t("Kopirano!"), description: r.username }); } catch {} }}
                                    className="text-blue-500 hover:text-blue-700 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                              r.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                              r.status === "pending" ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {r.status === "approved" ? t("Odobren") : r.status === "pending" ? t("Na čekanju") : r.status}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetRoditeljPassword(r.id)}
                              disabled={resetRoditeljId === r.id}
                              className="rounded-lg text-[11px] font-bold flex items-center gap-1 h-7 px-2"
                              data-testid={`btn-reset-roditelj-${r.id}`}
                            >
                              {resetRoditeljId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                              {t("Reset šifre")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => ukloniRoditelja(r.id)}
                              disabled={uklaniRoditeljId === r.id}
                              className="rounded-lg text-[11px] font-bold flex items-center gap-1 h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                              data-testid={`btn-ukloni-roditelja-${r.id}`}
                              title={t("Ukloni vezu s roditeljem (ne briše nalog)")}
                            >
                              {uklaniRoditeljId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                              {t("Ukloni")}
                            </Button>
                          </div>
                          {resetRoditeljPass?.id === r.id && (
                            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-emerald-700 w-20 shrink-0">{t("Korisničko ime:")}</span>
                                <code className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-800">{resetRoditeljPass.username}</code>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-emerald-700 w-20 shrink-0">{t("Standardna šifra:")}</span>
                                <code className="bg-white border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-800">{resetRoditeljPass.password}</code>
                                <Button
                                  size="sm" variant="outline"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(`${t("Korisničko ime")}: ${resetRoditeljPass.username}\n${t("Lozinka")}: ${resetRoditeljPass.password}`);
                                      toast({ title: t("Kopirano!") });
                                    } catch {}
                                  }}
                                  className="rounded-lg text-[11px] h-6 px-2"
                                  title={t("Kopiraj korisničko ime i lozinku")}
                                >
                                  <Copy className="w-3 h-3 mr-1" />{t("Kopiraj sve")}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">{t("Učenik još nema povezanog roditelja.")}</p>
                )}

                {/* Poveži postojećeg roditelja (npr. roditelj već ima drugo dijete u mektebu) */}
                {!kreiraniRoditelj && approvedRoditeljiCount < 2 && (
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> {t("Poveži postojećeg roditelja:")}
                    </p>
                    <div className="relative">
                      <div className="flex gap-2 flex-wrap">
                        <div className="relative min-w-0 flex-1 basis-full sm:min-w-[240px] sm:basis-auto">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                          <input
                            type="text"
                            value={odabraniRoditelj ? odabraniRoditelj.displayName : postojeciUsername}
                            onChange={e => {
                              setOdabraniRoditelj(null);
                              setPostojeciUsername(e.target.value);
                            }}
                            onKeyDown={e => { if (e.key === "Enter" && odabraniRoditelj && !linkujemPostojeceg) linkPostojecegRoditelja(); }}
                            placeholder={t("Pretraži ime ili prezime roditelja")}
                            className="w-full border border-blue-200 rounded-xl pl-9 pr-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                            data-testid="input-roditelj-pretraga"
                          />
                        </div>
                        <Button
                          onClick={linkPostojecegRoditelja}
                          disabled={linkujemPostojeceg || !odabraniRoditelj}
                          className="rounded-xl font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                          data-testid="btn-poveži-postojećeg-roditelja"
                        >
                          {linkujemPostojeceg ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          {t("Poveži")}
                        </Button>
                      </div>
                      {(pretragaRoditelja || roditeljRezultati.length > 0) && !odabraniRoditelj && (
                        <div className="absolute z-20 left-0 right-[92px] mt-1 bg-white border border-blue-200 rounded-xl shadow-lg overflow-hidden">
                          {pretragaRoditelja ? (
                            <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> {t("Pretražujem roditelje...")}
                            </div>
                          ) : (
                            roditeljRezultati.map(r => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  setOdabraniRoditelj(r);
                                  setPostojeciUsername(r.username);
                                  setRoditeljRezultati([]);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b last:border-b-0 border-blue-100 flex items-center justify-between gap-3"
                                data-testid={`roditelj-rezultat-${r.id}`}
                              >
                                <span className="min-w-0">
                                  <span className="block font-bold text-sm text-blue-950 truncate">{r.displayName}</span>
                                  <span className="block text-xs text-blue-700 font-mono truncate">@{r.username}</span>
                                </span>
                                <span className="text-[11px] text-blue-600 shrink-0">
                                  {t("{n} djece", { n: String(r.brojDjece) })}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-blue-700 mt-2">
                      {t("Upiši dio imena ili prezimena, odaberi roditelja sa liste i klikni Poveži. Prikazuju se roditelji koji već imaju dijete u ovom mektebu.")}
                    </p>
                  </div>
                )}

                {/* Forma za novog / poruka "već ima roditelja" / kreirani roditelj */}
                {kreiraniRoditelj ? (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h4 className="font-extrabold text-blue-900 mb-2 flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> {t("Roditelj kreiran!")}
                    </h4>
                    <p className="text-blue-800 text-xs mb-3">{t("Proslijedi ove podatke roditelju:")}</p>
                    <div className="bg-white rounded-lg p-3 space-y-1.5 text-sm mb-3">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t("Ime:")}</span>
                        <span className="font-bold text-foreground">{kreiraniRoditelj.displayName}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t("Korisničko ime:")}</span>
                        <span className="font-mono font-bold text-foreground">{kreiraniRoditelj.username}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t("Lozinka:")}</span>
                        <span className="font-mono font-bold text-foreground">{kreiraniRoditelj.generatedPassword}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={copyRoditeljKredencijale}
                        className="rounded-xl flex items-center gap-1.5"
                        data-testid="btn-copy-roditelj"
                      >
                        {copiedRoditelj ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        {copiedRoditelj ? t("Kopirano!") : t("Kopiraj kredencijale")}
                      </Button>
                      <Button
                        onClick={() => { setShowRoditeljForm(false); setKreiraniRoditelj(null); setNovoRoditeljIme(""); }}
                        className="rounded-xl flex items-center gap-1.5"
                        data-testid="btn-gotovo-roditelj"
                      >
                        <Check className="w-4 h-4" /> {t("Gotovo")}
                      </Button>
                    </div>
                  </div>
                ) : approvedRoditeljiCount < 2 ? (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground mb-2">{t("Ili dodaj novi nalog za roditelja:")}</p>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        value={novoRoditeljIme}
                        onChange={e => setNovoRoditeljIme(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && novoRoditeljIme.trim() && !savingRoditelj) addRoditelj(); }}
                        placeholder={t("Ime i prezime roditelja")}
                        className="min-w-0 flex-1 basis-full border border-border rounded-xl px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/30 sm:min-w-[200px] sm:basis-auto"
                        data-testid="input-roditelj-ime"
                      />
                      <Button
                        onClick={addRoditelj}
                        disabled={savingRoditelj || !novoRoditeljIme.trim()}
                        className="rounded-xl font-bold flex items-center gap-1.5"
                        data-testid="btn-dodaj-roditelja"
                      >
                        {savingRoditelj ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        {t("Dodaj")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("Kreiraće se nalog s automatskom šifrom")} <strong>Mekteb####</strong>. {t("Roditelj se odmah povezuje s učenikom i NE ulazi u kvotu licenci.")}
                    </p>
                  </div>
                ) : null}
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className={`border border-border/50 rounded-2xl p-4 ${prisustvoPct !== null && prisustvoPct >= 80 ? "bg-emerald-50" : prisustvoPct !== null && prisustvoPct >= 50 ? "bg-amber-50" : "bg-red-50"}`}>
                <CalendarCheck className="w-5 h-5 text-foreground/60 mb-2" />
                <div className={`text-2xl font-extrabold ${prisustvoPct !== null && prisustvoPct >= 80 ? "text-emerald-600" : prisustvoPct !== null && prisustvoPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {prisustvoPct !== null ? `${prisustvoPct}%` : "—"}
                </div>
                <div className="text-sm text-muted-foreground font-medium">{t("Prisustvo")}</div>
                {prisustvo.length > 0 && (
                  <div className="flex gap-2 mt-2 text-xs font-medium flex-wrap">
                    <span className="text-emerald-600">{prisutnih}P</span>
                    <span className="text-red-600">{odsutnih}O</span>
                    <span className="text-amber-600">{zakasnio}Z</span>
                    <span className="text-blue-600">{opravdano}OP</span>
                  </div>
                )}
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <Star className="w-5 h-5 text-amber-500 mb-2" />
                <div className="text-2xl font-extrabold text-amber-600">{prosjecnaOcjena || "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">{t("Prosj. ocjena")}</div>
                {ocjene.length > 0 && <div className="text-xs text-muted-foreground mt-1">{t("{n} ocjena", { n: String(ocjene.length) })}</div>}
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <ClipboardList className="w-5 h-5 text-blue-600 mb-2" />
                <div className="text-2xl font-extrabold text-blue-600">{kvizRezultati.length || "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">{t("Kvizova")}</div>
                {kvizProsjek !== null && <div className="text-xs text-muted-foreground mt-1">{t("Prosjek: {n}%", { n: String(kvizProsjek) })}</div>}
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <Award className="w-5 h-5 text-amber-600 mb-2" />
                <div className="text-2xl font-extrabold text-amber-600">{ukupnoBodova || "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">{t("Bodova")}</div>
              </div>
              <div className="bg-white border border-border/50 rounded-2xl p-4" data-testid="card-screentime">
                <Clock className="w-5 h-5 text-teal-600 mb-2" />
                <div className="text-2xl font-extrabold text-teal-600">{formatScreentime(ucenik.totalScreentimeSec)}</div>
                <div className="text-sm text-muted-foreground font-medium">{t("Vrijeme na platformi")}</div>
                {ucenik.lastSeenAt && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {isOnline(ucenik.lastSeenAt)
                      ? <span className="font-bold text-emerald-600">{t("Trenutno online")}</span>
                      : <>{t("Zadnji put:")} {new Date(ucenik.lastSeenAt).toLocaleString("bs-BA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
                  </div>
                )}
              </div>
              {/* 6. Zvjezdice stat kartica */}
              <div className="bg-white border border-border/50 rounded-2xl p-4">
                <span className="text-lg mb-1 block leading-none">⭐</span>
                <div className="text-2xl font-extrabold text-amber-500">{zvjezdice?.pozitivne ?? "—"}</div>
                <div className="text-sm text-muted-foreground font-medium">{t("Zvjezdice")}</div>
                {zvjezdice && zvjezdice.negativne > 0 && (
                  <div className="text-xs text-gray-500 mt-1">★ {zvjezdice.negativne} {t("negativnih")}</div>
                )}
              </div>
            </div>

            {/* Prisustvo bar — sada ispod kartica */}
            {prisustvo.length > 0 && (
              <div className="bg-white border border-border/50 rounded-2xl p-4 mb-6">
                <CalendarCheck className="w-5 h-5 text-primary mb-2" />
                <div className="text-base font-extrabold text-foreground mb-2">{t("{n} časova evidentirano", { n: String(prisustvo.length) })}</div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
                  {prisutnih > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(prisutnih / prisustvo.length) * 100}%` }} title={t("Prisutan: {n}", { n: String(prisutnih) })} />}
                  {zakasnio > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(zakasnio / prisustvo.length) * 100}%` }} title={t("Zakasnio: {n}", { n: String(zakasnio) })} />}
                  {opravdano > 0 && <div className="bg-blue-400 h-full" style={{ width: `${(opravdano / prisustvo.length) * 100}%` }} title={t("Opravdan: {n}", { n: String(opravdano) })} />}
                  {odsutnih > 0 && <div className="bg-red-500 h-full" style={{ width: `${(odsutnih / prisustvo.length) * 100}%` }} title={t("Odsutan: {n}", { n: String(odsutnih) })} />}
                </div>
              </div>
            )}

            {/* Zvjezdice — pregled (dodavanje je na kartici u grupi) */}
            <div className="bg-white border border-border/50 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h2 className="font-extrabold text-foreground flex items-center gap-2">
                  <span className="text-lg">⭐</span> {t("Zvjezdice — ponašanje")}
                  {zvjezdice && (
                    <span className="flex items-center gap-2 ml-2">
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5 text-sm font-extrabold border border-amber-200">⭐ {zvjezdice.pozitivne}</span>
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-sm font-extrabold border border-gray-200">★ {zvjezdice.negativne}</span>
                    </span>
                  )}
                </h2>
                {zvjezdice && (zvjezdice.pozitivne > 0 || zvjezdice.negativne > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetujZvjezdice}
                    disabled={resetZvjezdiceLoading}
                    className="rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {resetZvjezdiceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("Resetuj sve")}
                  </Button>
                )}
              </div>

              {/* Log — pregled zvjezdica sa kategorijom/razlogom */}
              {zvjezdiceLoading ? (
                <div className="text-sm text-muted-foreground">{t("Učitavanje...")}</div>
              ) : zvjezdice && zvjezdice.entries.length > 0 ? (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {zvjezdice.entries.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                      <span>{e.tip === "pozitivna" ? "⭐" : "★"}</span>
                      <span className="font-medium text-foreground">
                        {e.kategorija_naziv || (e.tip === "pozitivna" ? t("Pozitivna") : t("Negativna"))}
                      </span>
                      {e.razlog && <span className="text-muted-foreground">— {e.razlog}</span>}
                      <span className="ml-auto shrink-0 text-[10px]">{new Date(e.created_at).toLocaleString("bs-BA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">{t("Učenik nema zvjezdica")}</p>
              )}
            </div>

            {/* Napamet — katalog ove grupe i posljednje ocjene učenika */}
            <div className="bg-white border border-emerald-200 rounded-2xl p-5 mb-6" data-testid="section-napamet-ucenik">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-emerald-700" />
                <h2 className="font-extrabold text-foreground">{t("Napamet")}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{t("Pregled stavki iz programa ove grupe i posljednjih ocjena učenika.")}</p>
              <NapametPregled katalog={napamet?.katalog || []} ocjene={napamet?.ocjene || []} loading={napamet === null} />
            </div>

            {/* Pregled zadaća učenika (read-only). Dodaje se iz Muallim → Zadaća. */}
            <div className="bg-white border border-border/50 rounded-2xl p-5 mb-6" data-testid="section-zadace-ucenik">
              {(() => {
                const utoku = zadace.filter(z => (z.kategorija ?? "aktivne") !== "zavrsene");
                const zavrsene = zadace.filter(z => z.kategorija === "zavrsene");
                const lista = zadSubTab === "zavrseno" ? zavrsene : utoku;
                return (
                <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="font-extrabold text-foreground flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" /> {t("Zadaće")}
                  </h2>
                </div>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setZadSubTab("utoku")}
                    className={`flex-1 sm:flex-none rounded-xl px-4 py-2 text-sm font-extrabold border transition-all ${zadSubTab === "utoku" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                    {t("U toku ({n})", { n: String(utoku.length) })}
                  </button>
                  <button onClick={() => setZadSubTab("zavrseno")}
                    className={`flex-1 sm:flex-none rounded-xl px-4 py-2 text-sm font-extrabold border transition-all ${zadSubTab === "zavrseno" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-white border-border/60 text-muted-foreground hover:bg-muted"}`}>
                    {t("Završeno ({n})", { n: String(zavrsene.length) })}
                  </button>
                </div>
                {lista.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{zadSubTab === "zavrseno" ? t("Nema završenih zadaća.") : t("Učenik trenutno nema zadaća u toku.")}</p>
                ) : (
                <div className="space-y-3">
                  {[...lista].sort((a, b) => {
                    const ar = a.efektivniRok ?? a.rokDo ?? "9999-99-99";
                    const br = b.efektivniRok ?? b.rokDo ?? "9999-99-99";
                    return ar.localeCompare(br);
                  }).map(z => {
                    const efektivni = z.efektivniRok ?? z.rokDo ?? null;
                    const parseLocal = (s?: string | null) => {
                      if (!s) return null;
                      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
                      if (!m) return null;
                      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                      return isNaN(d.getTime()) ? null : d;
                    };
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const rokDate = parseLocal(efektivni);
                    const daysLeft = rokDate ? Math.round((rokDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const isDone = z.kategorija === "zavrsene";
                    const isOverdue = !isDone && daysLeft !== null && daysLeft < 0;
                    const isUrgent = !isDone && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
                    const rokColor = isDone ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : isOverdue ? "bg-red-100 text-red-700 border-red-300"
                      : isUrgent ? "bg-amber-100 text-amber-700 border-amber-300"
                      : daysLeft !== null ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-muted text-muted-foreground border-border";
                    const rokDisplay = efektivni ? efektivni.slice(0, 10).split("-").reverse().join(".") : "";
                    const rokLabel = isDone ? t("Završeno")
                      : !efektivni ? t("Bez roka")
                      : isOverdue ? t("Rok prošao ({rok})", { rok: rokDisplay })
                      : daysLeft === 0 ? t("Rok je danas!")
                      : daysLeft === 1 ? t("Rok je sutra")
                      : t("Još {n} dana ({rok})", { n: String(daysLeft), rok: rokDisplay });

                    return (
                      <div key={z.id} data-testid={`zadaca-ucenik-${z.id}`}
                        className={`border-2 rounded-2xl p-4 ${isDone ? "border-emerald-200" : isOverdue ? "border-red-200" : isUrgent ? "border-amber-200" : "border-border/50"}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-xl ${isDone ? "bg-emerald-50" : isOverdue ? "bg-red-50" : isUrgent ? "bg-amber-50" : "bg-violet-50"}`}>
                              {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : isOverdue ? <AlertCircle className="w-5 h-5 text-red-600" /> : <FileText className="w-5 h-5 text-violet-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-extrabold text-foreground text-base">{z.naslov}</h3>
                              {z.lekcijaNaslov && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  <BookOpen className="w-3 h-3 inline mr-1" />{z.lekcijaNaslov}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${rokColor}`}>
                            <Clock className="w-3 h-3" /> {rokLabel}
                          </span>
                        </div>
                        {z.opis && (
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-2 pl-12">{z.opis}</p>
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
                </>
                );
              })()}
            </div>

            {/* H5P pokušaji — drilldown sa /muallim/h5p-statistika */}
            <div
              ref={h5pSectionRef}
              className={`bg-white border rounded-2xl p-5 mb-6 ${h5pFilterPrilogId ? "border-primary/40 ring-2 ring-primary/15" : "border-border/50"}`}
              data-testid="section-h5p-pokusaji"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="font-extrabold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> {t("H5P vježbe")}
                  {h5pPokusaji.length > 0 && (
                    <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full" data-testid="badge-h5p-broj-pokusaja">
                      {filteredH5pPokusaji.length}{h5pFilterPrilogId ? `/${h5pPokusaji.length}` : ""} {t("pokušaja")}
                    </span>
                  )}
                </h2>
                {h5pProsjek !== null && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-extrabold px-2.5 py-0.5 rounded-full ${h5pProsjek >= 80 ? "bg-emerald-100 text-emerald-700" : h5pProsjek >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`} data-testid="stat-h5p-prosjek">
                      Ø {h5pProsjek}%
                    </span>
                    {h5pHasanat > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <Award className="w-3.5 h-3.5" /> {h5pHasanat}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {h5pPokusaji.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("Učenik još nije radio nijednu H5P vježbu")}</p>
              ) : (
                <>
                  {(h5pPrilozi.length > 1 || h5pFilterPrilogId !== null) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3" data-testid="filter-h5p-prilozi">
                      <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                      <button
                        onClick={() => {
                          setH5pFilterPrilogId(null);
                          if (typeof window !== "undefined") {
                            const url = new URL(window.location.href);
                            url.searchParams.delete("h5pPrilogId");
                            window.history.replaceState({}, "", url.toString());
                          }
                        }}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${h5pFilterPrilogId === null ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
                        data-testid="btn-h5p-filter-sve"
                      >
                        {t("Sve")}
                      </button>
                      {h5pPrilozi.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setH5pFilterPrilogId(p.id);
                            if (typeof window !== "undefined") {
                              const url = new URL(window.location.href);
                              url.searchParams.set("h5pPrilogId", String(p.id));
                              window.history.replaceState({}, "", url.toString());
                            }
                          }}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors max-w-[200px] truncate ${h5pFilterPrilogId === p.id ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
                          title={p.originalName}
                          data-testid={`btn-h5p-filter-prilog-${p.id}`}
                        >
                          {p.originalName.replace(/\.h5p$/i, "")}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="list-h5p-pokusaji">
                    {filteredH5pPokusaji.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("Nema pokušaja za odabranu vježbu")}</p>
                    ) : filteredH5pPokusaji.map(p => {
                      const info = h5pPriloziMap.get(p.priloziId);
                      return (
                        <div key={p.id} className="bg-muted/20 rounded-xl p-3" data-testid={`row-h5p-pokusaj-${p.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-foreground truncate" title={info?.originalName}>
                                {info ? info.originalName.replace(/\.h5p$/i, "") : t("Vježba #{n}", { n: String(p.priloziId) })}
                              </div>
                              {info?.lekcijaNaslov && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {t("Lekcija:")} {info.lekcijaNaslov}
                                  {info.lekcijaNivo != null && <span className="ml-1.5 inline-block bg-primary/10 text-primary px-1.5 rounded text-[10px] font-bold align-middle">{t("Nivo {n}", { n: String(info.lekcijaNivo) })}</span>}
                                </div>
                              )}
                            </div>
                            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full shrink-0 ${p.procenat >= 80 ? "bg-emerald-100 text-emerald-700" : p.procenat >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {p.procenat}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t("Pokušaj #{n} · {score}/{max}", { n: String(p.attemptNo), score: String(p.score), max: String(p.maxScore) })}</span>
                            <div className="flex items-center gap-2">
                              {p.hasanatGained > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                  <Award className="w-3 h-3" /> {p.hasanatGained}
                                </span>
                              )}
                              <span>{p.completedAt ? new Date(p.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                            <div className={`h-1.5 rounded-full ${p.procenat >= 80 ? "bg-emerald-500" : p.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                              style={{ width: `${p.procenat}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <section className="bg-white border border-teal-200 rounded-2xl overflow-hidden mb-6" data-testid="interaktivni-pregled-ucenik">
              <div className="px-5 py-4 bg-teal-50/70 border-b border-teal-100">
                <h2 className="font-extrabold text-teal-950 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-700" /> {t("Učenje u lekcijama")}
                </h2>
                <p className="text-xs text-teal-800 mt-1">
                  {t("Privatni trag pokušaja, pomoći i ponovnog čitanja — nije ocjena ni zvjezdica.")}
                </p>
              </div>
              {interaktivnaPitanja.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">{t("Još nema odgovora iz ugrađenih pitanja lekcija.")}</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {interaktivnaPitanja.map((p, index) => (
                    <div key={`${p.lekcijaNaslov}-${index}`} className="px-5 py-4">
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
              )}
            </section>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Kviz rezultati */}
              <div className="bg-white border border-border/50 rounded-2xl p-5">
                <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                  <ClipboardList className="w-4 h-4 text-primary" /> {t("Rezultati kvizova")}
                </h2>
                {kvizRezultati.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("Učenik još nije radio kvizove")}</p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {kvizRezultati.map(r => (
                      <div key={r.id} className="bg-muted/20 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-foreground truncate mr-2">{r.kvizNaslov}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-700" : r.procenat >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {r.procenat}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t("{tacni}/{ukupno} tačnih", { tacni: String(r.tacniOdgovori), ukupno: String(r.ukupnoPitanja) })}</span>
                          <div className="flex items-center gap-2">
                            {r.bodovi > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-600 font-bold">
                                <Award className="w-3 h-3" /> {r.bodovi}
                              </span>
                            )}
                            <span>{r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div className={`h-1.5 rounded-full ${r.procenat >= 80 ? "bg-emerald-500" : r.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                            style={{ width: `${r.procenat}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ocjene */}
              <div className="bg-white border border-border/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-extrabold text-foreground flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" /> {t("Ocjene")}
                  </h2>
                </div>

                {ocjene.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("Nema unesenih ocjena")}</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto -mx-1">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          <th className="py-2 px-2 font-bold">{t("Predmet")}</th>
                          <th className="py-2 px-2 font-bold">{t("Naziv")}</th>
                          <th className="py-2 px-2 font-bold whitespace-nowrap">{t("Datum")}</th>
                          <th className="py-2 px-2 font-bold text-center">{t("Ocjena")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ocjene.map(o => {
                          const izZadace = o.kategorija === "zadaća";
                          return (
                            <tr key={o.id} className="border-t border-border/50 align-top">
                              <td className="py-2 px-2">
                                <span className="font-bold text-foreground">{kategorijaOcjeneLabel(o.kategorija)}</span>
                                {izZadace && (
                                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary align-middle">{t("Zadaća")}</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-foreground">
                                {o.lekcijaNaziv || <span className="text-muted-foreground">—</span>}
                                {o.napomena && <span className="block text-xs text-muted-foreground mt-0.5">{o.napomena}</span>}
                              </td>
                              <td className="py-2 px-2 text-muted-foreground whitespace-nowrap text-xs">{o.datum}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`inline-block text-sm font-extrabold px-2.5 py-0.5 rounded-full ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                                  {o.ocjena}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Prisustvo — mjesečno + detalji */}
              <div className="bg-white border border-border/50 rounded-2xl p-5 md:col-span-2">
                <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                  <CalendarCheck className="w-4 h-4 text-primary" /> {t("Prisustvo — pregled")}
                </h2>
                {prisustvo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("Nema evidencije prisustva")}</p>
                ) : (
                  <div className="space-y-4">
                    {mjesecniPrisustvo.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("Po mjesecima")}</h3>
                        {mjesecniPrisustvo.map(m => {
                          const parts = m.mjesec.split("-");
                          const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
                          return (
                            <div key={m.mjesec} className="flex items-center gap-3">
                              <span className="w-20 text-sm font-medium text-foreground">{naziv}</span>
                              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                                <div className={`h-full rounded-full ${m.pct >= 80 ? "bg-emerald-500" : m.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${m.pct}%` }} />
                              </div>
                              <span className={`w-16 text-right text-sm font-bold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                {m.pct}% <span className="text-xs text-muted-foreground font-normal">({m.prisutan}/{m.total})</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(() => {
                      const oznaka: Record<string, { slovo: string; cls: string }> = {
                        prisutan: { slovo: "P", cls: "bg-emerald-500" },
                        opravdan: { slovo: "OP", cls: "bg-blue-500" },
                        odsutan: { slovo: "O", cls: "bg-red-500" },
                        zakasnio: { slovo: "Z", cls: "bg-amber-400" },
                      };
                      const prisMap = new Map<string, string>();
                      prisustvo.forEach(p => prisMap.set(p.datum.slice(0, 10), p.status));
                      const mjeseci = [...new Set(prisustvo.map(p => p.datum.slice(0, 7)))].sort();
                      const dani = [...new Set(prisustvo.map(p => parseInt(p.datum.slice(8, 10), 10)))].sort((a, b) => a - b);
                      return (
                        <div>
                          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("Kalendar prisustva")}</h3>
                          <div className="overflow-x-auto">
                            <table className="border-separate" style={{ borderSpacing: "4px" }}>
                              <thead>
                                <tr>
                                  <th className="px-1"></th>
                                  {mjeseci.map(m => {
                                    const [god, mj] = m.split("-");
                                    return (
                                      <th key={m} className="text-[11px] font-bold text-muted-foreground text-center px-1 whitespace-nowrap">
                                        {MJESEC_NAZIVI[mj] || mj} <span className="text-muted-foreground/60">{god.slice(2)}</span>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {dani.map(dan => (
                                  <tr key={dan}>
                                    <td className="text-xs font-bold text-muted-foreground text-right pr-1 w-7">{dan}.</td>
                                    {mjeseci.map(m => {
                                      const key = `${m}-${String(dan).padStart(2, "0")}`;
                                      const status = prisMap.get(key);
                                      const cfg = status ? oznaka[status] : null;
                                      return (
                                        <td key={m} className="text-center">
                                          {cfg ? (
                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-extrabold ${cfg.cls}`}
                                              title={`${dan}.${m.split("-")[1]}.${m.split("-")[0]}.`}>
                                              {cfg.slovo}
                                            </span>
                                          ) : (
                                            <span className="inline-block w-7 h-7 rounded-full bg-muted/40" />
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
                            <span className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold">P</span> {t("Prisutan")}</span>
                            <span className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-extrabold">OP</span> {t("Opravdan")}</span>
                            <span className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-extrabold">O</span> {t("Odsutan")}</span>
                            <span className="flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-[9px] font-extrabold">Z</span> {t("Zakasnio")}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
