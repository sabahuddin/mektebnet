import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { ArrowLeft, User, CalendarCheck, Star, PlusCircle, Loader2, ClipboardList, Award, KeyRound, FileText, Copy, Check, Sparkles, Filter, Users, UserPlus, Search, X, Clock, BookOpen, CheckCircle2, AlertCircle, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { isOnline, formatScreentime } from "@/lib/utils";
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
  predmet?: string | null;
  ocjena: number;
  lekcijaNaziv?: string;
  napomena?: string;
  datum: string;
  napametStavkaId?: string | null;
}

interface ProfilOcjena extends Ocjena {
  isNapamet?: boolean;
}

interface Grupa {
  id: number;
  naziv: string;
}

interface IlmihalLekcija {
  id: number;
  naslov: string;
  nivo: number;
  slug?: string;
  predmet?: string | null;
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

interface EtapaPokusajiPregled {
  medaljonId: number;
  naziv: string;
  nivo: number;
  passed: boolean;
  nextAttemptNo: number;
  canApprove: boolean;
  approved: boolean;
  attempts: Array<{
    id: number;
    procenat: number;
    polozeno: boolean;
    pokusajBr: number;
    createdAt: string;
  }>;
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
export default function UcenikPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { token } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const params = new URLSearchParams(search);
  const hasH5pId = params.has("h5pPrilogId");
  const [ucenik, setUcenik] = useState<Ucenik | null>(null);
  const [prisustvo, setPrisustvo] = useState<Prisustvo[]>([]);
  const [ocjene, setOcjene] = useState<Ocjena[]>([]);
  const [napamet, setNapamet] = useState<{ katalog: NapametStavka[]; ocjene: NapametOcjena[] } | null>(null);
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [kvizRezultati, setKvizRezultati] = useState<KvizRezultat[]>([]);
  const [h5pPokusaji, setH5pPokusaji] = useState<H5PPokusaj[]>([]);
  const [interaktivnaPitanja, setInteraktivnaPitanja] = useState<InteraktivniPitanjePregled[]>([]);
  const [etapaPokusaji, setEtapaPokusaji] = useState<EtapaPokusajiPregled[]>([]);
  const [approvingEtapaId, setApprovingEtapaId] = useState<number | null>(null);
  const [h5pPrilozi, setH5pPrilozi] = useState<H5PPrilogInfo[]>([]);
  const [h5pFilterPrilogId, setH5pFilterPrilogId] = useState<number | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const v = params.get("h5pPrilogId");
    setH5pFilterPrilogId(v ? parseInt(v, 10) : null);
  }, [search]);
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
      apiRequest<EtapaPokusajiPregled[]>("GET", `/muallim/ucenik/${ucenikId}/etape`, undefined, token).catch(() => []),
    ]).then(([ucenici, oc, prs, g, kvizData, lekcije, h5pData, interaktivniData, rod, zad, napametData, etapeData]) => {
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
      setEtapaPokusaji((etapeData as EtapaPokusajiPregled[]) || []);
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

  async function odobriEtapaPokusaj(medaljonId: number) {
    if (!token || !id) return;
    setApprovingEtapaId(medaljonId);
    try {
      await apiRequest("POST", `/muallim/ucenik/${id}/etape/${medaljonId}/odobri`, {}, token);
      setEtapaPokusaji((current) => current.map((etapa) => (
        etapa.medaljonId === medaljonId ? { ...etapa, canApprove: false, approved: true } : etapa
      )));
      toast({ title: t("Sljedeći pokušaj je omogućen.") });
    } catch (error) {
      toast({
        title: t("Pokušaj nije omogućen"),
        description: error instanceof Error ? error.message : t("Pokušaj ponovo."),
        variant: "destructive",
      });
    } finally {
      setApprovingEtapaId(null);
    }
  }

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
  const ocjenePoPredmetu = Object.entries(ocjene.reduce<Record<string, number[]>>((acc, o) => {
    const predmet = o.predmet || t("Nije određeno");
    (acc[predmet] ||= []).push(o.ocjena);
    return acc;
  }, {})).map(([predmet, vrijednosti]) => ({
    predmet,
    broj: vrijednosti.length,
    prosjek: (vrijednosti.reduce((sum, ocjena) => sum + ocjena, 0) / vrijednosti.length).toFixed(2),
  }));
  // Napamet ocjene prikazujemo i u historiji profila, ali ih ne dodajemo u
  // prosjek: ocjenePoPredmetu i prosjecnaOcjena i dalje koriste samo `ocjene`.
  const napametNazivPoId = new Map((napamet?.katalog || []).map(stavka => [stavka.id, stavka.naziv]));
  const profilOcjene: ProfilOcjena[] = [
    ...ocjene,
    ...(napamet?.ocjene || [])
      .filter(napametOcjena => {
        if (ocjene.some(ocjena => ocjena.id === napametOcjena.id)) return false;
        const naziv = napametOcjena.napametStavkaId
          ? napametNazivPoId.get(napametOcjena.napametStavkaId)
          : undefined;
        return !ocjene.some(ocjena =>
          ocjena.datum === napametOcjena.datum
          && ocjena.ocjena === napametOcjena.ocjena
          && naziv
          && ocjena.lekcijaNaziv?.trim().toLocaleLowerCase("bs-BA") === naziv.trim().toLocaleLowerCase("bs-BA")
        );
      })
      .map(napametOcjena => ({
        ...napametOcjena,
        napomena: napametOcjena.napomena ?? undefined,
        lekcijaNaziv: napametOcjena.napametStavkaId
          ? napametNazivPoId.get(napametOcjena.napametStavkaId)
          : undefined,
        predmet: t("Napamet"),
        isNapamet: true,
      })),
  ].sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
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

  const validModules = ["pregled", "prisustvo", "ocjene", "zadace", "napamet", "h5p", "kvizovi", "interaktivno", "roditelji", "postavke", "etape"];
  let rawModule = params.get("modul") || (hasH5pId ? "h5p" : "pregled");
  if (!validModules.includes(rawModule) || (rawModule === "etape" && etapaPokusaji.length === 0)) {
    rawModule = "pregled";
  }
  const activeModule = rawModule;

  const setModule = (key: string) => {
    const p = new URLSearchParams(search);
    p.set("modul", key);
    if (key !== "h5p") p.delete("h5pPrilogId");
    setLocation(`/muallim/ucenik/${id}?${p.toString()}`);
  };

  const utokuCount = zadace.filter(z => (z.kategorija ?? "aktivne") !== "zavrsene").length;

  const modules = [
    { key: "pregled", label: t("Pregled"), icon: User },
    { key: "prisustvo", label: t("Prisustvo"), icon: CalendarCheck },
    { key: "ocjene", label: t("Ocjene"), icon: Star },
    { key: "zadace", label: t("Zadaće"), icon: ClipboardList, badge: utokuCount },
    { key: "napamet", label: t("Napamet"), icon: BookOpen },
    { key: "h5p", label: t("H5P vježbe"), icon: Sparkles },
    { key: "kvizovi", label: t("Kvizovi"), icon: CheckCircle2 },
    { key: "interaktivno", label: t("Učenje u lekcijama"), icon: BookOpen },
    { key: "roditelji", label: t("Roditelji"), icon: Users, badge: roditelji.length },
    { key: "postavke", label: t("Nalog i Lozinka"), icon: KeyRound },
  ];
  if (etapaPokusaji.length > 0) {
    modules.push({ key: "etape", label: t("Etapni ispiti"), icon: Medal });
  }

  function UcenikSidebar() {
    return (
      <div className="rounded-2xl border border-border/50 bg-white/80 p-2.5 sm:p-3">
        <p className="px-2 pb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{t("Moduli")}</p>
        <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:flex lg:flex-col lg:gap-1.5" aria-label={t("Navigacija modula")}>
          {modules.map((module) => {
            const isActive = activeModule === module.key;
            return (
              <button
                key={module.key}
                onClick={() => setModule(module.key)}
                aria-current={isActive ? "page" : undefined}
                data-testid={module.key === "postavke" ? "btn-toggle-reset-password" : module.key === "roditelji" ? "btn-toggle-roditelji" : undefined}
                className={`relative flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left text-xs font-bold transition-colors sm:px-3 sm:text-sm lg:w-full ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/60 bg-white text-foreground hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <module.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="min-w-0 truncate">{module.label}</span>
                {(module.badge ?? 0) > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white shadow-md">
                    {module.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <button onClick={() => goBackOr(() => setLocation("/muallim"))} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na panel")}
        </button>

        {isLoading ? (
          <div className="flex flex-col gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : !ucenik ? (
          <div className="text-center py-20 text-muted-foreground">{t("Učenik nije pronađen")}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6 flex-wrap bg-white border border-border/50 rounded-[24px] p-5 shadow-sm">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
                  <User className="w-8 h-8 text-white" />
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
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{ucenik.displayName}</h1>
                  {isOnline(ucenik.lastSeenAt) && (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{t("online")}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="max-w-full truncate text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md text-sm">{ucenik.username}</span>
                  {ucenik.role && <span className="text-muted-foreground text-xs uppercase tracking-wide font-bold">{ucenik.role}</span>}
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <Button
                  onClick={() => setLocation(`/muallim/izvjestaj/ucenik/${ucenik.id}`)}
                  variant="outline"
                  className="rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 w-full sm:w-auto"
                  data-testid="btn-izvjestaj-ucenik"
                >
                  <FileText className="w-4 h-4" /> {t("Izvještaj")}
                </Button>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px] items-start gap-6">
              <div className="lg:sticky lg:top-20 lg:col-start-2 lg:row-start-1">
                <UcenikSidebar />
              </div>

              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                {activeModule === "pregled" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                      {/* Prisustvo stat card */}
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
                      {/* Prosj. ocjena */}
                      <div className="bg-white border border-border/50 rounded-2xl p-4">
                        <Star className="w-5 h-5 text-amber-500 mb-2" />
                        <div className="text-2xl font-extrabold text-amber-600">{prosjecnaOcjena || "—"}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Prosj. ocjena")}</div>
                        {ocjene.length > 0 && <div className="text-xs text-muted-foreground mt-1">{t("{n} ocjena", { n: String(ocjene.length) })}</div>}
                      </div>
                      {/* Kvizova */}
                      <div className="bg-white border border-border/50 rounded-2xl p-4">
                        <ClipboardList className="w-5 h-5 text-blue-600 mb-2" />
                        <div className="text-2xl font-extrabold text-blue-600">{kvizRezultati.length || "—"}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Kvizova")}</div>
                        {kvizProsjek !== null && <div className="text-xs text-muted-foreground mt-1">{t("Prosjek: {n}%", { n: String(kvizProsjek) })}</div>}
                      </div>
                      {/* Bodova */}
                      <div className="bg-white border border-border/50 rounded-2xl p-4">
                        <Award className="w-5 h-5 text-amber-600 mb-2" />
                        <div className="text-2xl font-extrabold text-amber-600">{ukupnoBodova || "—"}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Bodova")}</div>
                      </div>
                      {/* Screentime */}
                      <div className="bg-white border border-border/50 rounded-2xl p-4" data-testid="card-screentime">
                        <Clock className="w-5 h-5 text-teal-600 mb-2" />
                        <div className="text-2xl font-extrabold text-teal-600">{formatScreentime(ucenik.totalScreentimeSec || 0)}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Vrijeme na platformi")}</div>
                        {ucenik.lastSeenAt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {isOnline(ucenik.lastSeenAt)
                              ? <span className="font-bold text-emerald-600">{t("Trenutno online")}</span>
                              : <>{t("Zadnji put:")} {new Date(ucenik.lastSeenAt).toLocaleString("bs-BA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
                          </div>
                        )}
                      </div>
                      {/* Zvjezdice stat */}
                      <div className="bg-white border border-border/50 rounded-2xl p-4">
                        <span className="text-lg mb-1 block leading-none">⭐</span>
                        <div className="text-2xl font-extrabold text-amber-500">{zvjezdice?.pozitivne ?? "—"}</div>
                        <div className="text-sm text-muted-foreground font-medium">{t("Zvjezdice")}</div>
                        {zvjezdice && zvjezdice.negativne > 0 && (
                          <div className="text-xs text-gray-500 mt-1">★ {zvjezdice.negativne} {t("negativnih")}</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-border/50 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-extrabold text-foreground flex items-center gap-2">
                          <Star className="w-5 h-5 text-amber-500" /> {t("Dnevnik zvjezdica")}
                        </h2>
                        {zvjezdice && (zvjezdice.pozitivne > 0 || zvjezdice.negativne > 0) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={resetujZvjezdice}
                            disabled={resetZvjezdiceLoading}
                            className="rounded-xl text-xs text-red-600 border-red-200 hover:bg-red-50 h-8"
                          >
                            {resetZvjezdiceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t("Resetuj sve")}
                          </Button>
                        )}
                      </div>
                      {/* Log — pregled zvjezdica sa kategorijom/razlogom */}
                      {zvjezdiceLoading ? (
                        <div className="text-sm text-muted-foreground">{t("Učitavanje...")}</div>
                      ) : zvjezdice && zvjezdice.entries.length > 0 ? (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                          {zvjezdice.entries.map((e: any) => (
                            <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                              <span className="text-base">{e.tip === "pozitivna" ? "⭐" : "★"}</span>
                              <span className="font-bold text-foreground">
                                {e.kategorija_naziv || (e.tip === "pozitivna" ? t("Pozitivna") : t("Negativna"))}
                              </span>
                              {e.razlog && <span className="text-muted-foreground truncate">— {e.razlog}</span>}
                              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/80">{new Date(e.created_at).toLocaleString("bs-BA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-xl">{t("Učenik nema dodijeljenih zvjezdica")}</p>
                      )}
                    </div>
                  </div>
                )}

                {activeModule === "prisustvo" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border border-border/50 rounded-2xl p-5">
                      <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                        <CalendarCheck className="w-5 h-5 text-primary" /> {t("Prisustvo — pregled")}
                      </h2>
                      {prisustvo.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">{t("Nema evidencije prisustva")}</p>
                      ) : (
                        <div className="space-y-6">
                          <div>
                            <div className="text-base font-extrabold text-foreground mb-2">{t("{n} časova evidentirano", { n: String(prisustvo.length) })}</div>
                            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
                              {prisutnih > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(prisutnih / prisustvo.length) * 100}%` }} title={t("Prisutan: {n}", { n: String(prisutnih) })} />}
                              {zakasnio > 0 && <div className="bg-amber-400 h-full" style={{ width: `${(zakasnio / prisustvo.length) * 100}%` }} title={t("Zakasnio: {n}", { n: String(zakasnio) })} />}
                              {opravdano > 0 && <div className="bg-blue-500 h-full" style={{ width: `${(opravdano / prisustvo.length) * 100}%` }} title={t("Opravdan: {n}", { n: String(opravdano) })} />}
                              {odsutnih > 0 && <div className="bg-red-500 h-full" style={{ width: `${(odsutnih / prisustvo.length) * 100}%` }} title={t("Odsutan: {n}", { n: String(odsutnih) })} />}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-bold">
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500" /> {prisutnih} {t("Prisutan")}</span>
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500" /> {opravdano} {t("Opravdan")}</span>
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" /> {odsutnih} {t("Odsutan")}</span>
                              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> {zakasnio} {t("Zakasnio")}</span>
                            </div>
                          </div>

                          {mjesecniPrisustvo.length > 0 && (
                            <div className="space-y-3 pt-2 border-t border-border/50">
                              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("Po mjesecima")}</h3>
                              {mjesecniPrisustvo.map(m => {
                                const parts = m.mjesec.split("-");
                                const naziv = `${MJESEC_NAZIVI[parts[1]] || parts[1]} ${parts[0]}`;
                                return (
                                  <div key={m.mjesec} className="flex items-center gap-3">
                                    <span className="w-24 text-sm font-bold text-foreground">{naziv}</span>
                                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden relative">
                                      <div className={`h-full rounded-full ${m.pct >= 80 ? "bg-emerald-500" : m.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                        style={{ width: `${m.pct}%` }} />
                                    </div>
                                    <span className={`w-16 text-right text-sm font-extrabold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                                      {m.pct}% <span className="text-[10px] text-muted-foreground font-normal block -mt-1">({m.prisutan}/{m.total})</span>
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
                              <div className="pt-2 border-t border-border/50">
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
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeModule === "ocjene" && (
                  <div className="bg-white border border-border/50 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-extrabold text-foreground flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-500" /> {t("Ocjene")}
                      </h2>
                    </div>

                    {profilOcjene.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{t("Nema unesenih ocjena")}</p>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {ocjenePoPredmetu.map(item => (
                            <div key={item.predmet} className="rounded-xl bg-muted/30 border border-border/50 p-4">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{item.predmet}</p>
                              <p className="mt-1 text-2xl font-black text-foreground">{item.prosjek}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{t("{n} ocjena", { n: String(item.broj) })}</p>
                            </div>
                          ))}
                        </div>
                        <div className="overflow-x-auto border border-border/50 rounded-xl">
                          <table className="w-full text-sm border-collapse min-w-[500px]">
                            <thead className="bg-muted/30 border-b border-border/50">
                              <tr className="text-left text-xs font-bold text-muted-foreground uppercase tracking-wide">
                                <th className="py-3 px-4 font-bold">{t("Predmet")}</th>
                                <th className="py-3 px-4 font-bold">{t("Naziv lekcije/zadatka")}</th>
                                <th className="py-3 px-4 font-bold whitespace-nowrap text-right">{t("Datum")}</th>
                                <th className="py-3 px-4 font-bold text-center w-24">{t("Ocjena")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {profilOcjene.map(o => (
                                <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                                  <td className="py-3 px-4">
                                    <span className={`font-extrabold text-sm ${o.isNapamet ? "text-emerald-700" : "text-foreground"}`}>
                                      {o.isNapamet ? t("Napamet") : (o.predmet || t("Nije određeno"))}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-foreground">
                                    <span className="font-bold text-sm block">{o.lekcijaNaziv || <span className="text-muted-foreground font-normal">—</span>}</span>
                                    {o.napomena && <span className="block text-xs text-muted-foreground mt-0.5">{o.napomena}</span>}
                                  </td>
                                  <td className="py-3 px-4 text-muted-foreground text-right whitespace-nowrap text-xs font-medium">
                                    {o.datum.split("-").reverse().join(".")}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`inline-flex items-center justify-center w-8 h-8 text-sm font-extrabold rounded-full shadow-sm ${OCJENA_COLORS[o.ocjena] || "bg-gray-100 text-gray-700"}`}>
                                      {o.ocjena}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeModule === "zadace" && (
                  <div className="bg-white border border-border/50 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="section-zadace-ucenik">
                    {(() => {
                      const utoku = zadace.filter(z => (z.kategorija ?? "aktivne") !== "zavrsene");
                      const zavrsene = zadace.filter(z => z.kategorija === "zavrsene");
                      const lista = zadSubTab === "zavrseno" ? zavrsene : utoku;
                      return (
                      <>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h2 className="font-extrabold text-foreground flex items-center gap-2">
                          <ClipboardList className="w-5 h-5 text-primary" /> {t("Zadaće")}
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
                        <p className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-xl">{zadSubTab === "zavrseno" ? t("Nema završenih zadaća.") : t("Učenik trenutno nema zadaća u toku.")}</p>
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
                              className={`border-2 rounded-2xl p-4 ${isDone ? "border-emerald-200" : isOverdue ? "border-red-200 bg-red-50/30" : isUrgent ? "border-amber-200 bg-amber-50/30" : "border-border/50"}`}>
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
                )}

                {activeModule === "napamet" && (
                  <div className="bg-white border border-emerald-200 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="section-napamet-ucenik">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-5 h-5 text-emerald-700" />
                      <h2 className="font-extrabold text-foreground">{t("Napamet")}</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">{t("Pregled stavki iz programa ove grupe i posljednjih ocjena učenika.")}</p>
                    <NapametPregled katalog={napamet?.katalog || []} ocjene={napamet?.ocjene || []} loading={napamet === null} />
                  </div>
                )}

                {activeModule === "h5p" && (
                  <div
                    ref={h5pSectionRef}
                    className={`bg-white border rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300 ${h5pFilterPrilogId ? "border-primary/40 ring-2 ring-primary/15" : "border-border/50"}`}
                    data-testid="section-h5p-pokusaji"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h2 className="font-extrabold text-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" /> {t("H5P vježbe")}
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
                              <Award className="w-4 h-4" /> {h5pHasanat}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {h5pPokusaji.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-xl">{t("Učenik još nije radio nijednu H5P vježbu")}</p>
                    ) : (
                      <>
                        {(h5pPrilozi.length > 1 || h5pFilterPrilogId !== null) && (
                          <div className="flex flex-wrap items-center gap-1.5 mb-4 p-2 bg-muted/30 rounded-xl border border-border/50" data-testid="filter-h5p-prilozi">
                            <Filter className="w-4 h-4 text-muted-foreground mx-1" />
                            <button
                              onClick={() => {
                                setH5pFilterPrilogId(null);
                                const params = new URLSearchParams(search);
                                params.delete("h5pPrilogId");
                                setLocation(`/muallim/ucenik/${id}?${params.toString()}`);
                              }}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${h5pFilterPrilogId === null ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
                              data-testid="btn-h5p-filter-sve"
                            >
                              {t("Sve")}
                            </button>
                            {h5pPrilozi.map(p => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setH5pFilterPrilogId(p.id);
                                  const params = new URLSearchParams(search);
                                  params.set("h5pPrilogId", String(p.id));
                                  setLocation(`/muallim/ucenik/${id}?${params.toString()}`);
                                }}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors max-w-[200px] truncate ${h5pFilterPrilogId === p.id ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}
                                title={p.originalName}
                                data-testid={`btn-h5p-filter-prilog-${p.id}`}
                              >
                                {p.originalName.replace(/\.h5p$/i, "")}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="space-y-3" data-testid="list-h5p-pokusaji">
                          {filteredH5pPokusaji.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">{t("Nema pokušaja za odabranu vježbu")}</p>
                          ) : filteredH5pPokusaji.map(p => {
                            const info = h5pPriloziMap.get(p.priloziId);
                            return (
                              <div key={p.id} className="bg-muted/10 border border-border/50 rounded-xl p-4 transition-colors hover:bg-muted/20" data-testid={`row-h5p-pokusaj-${p.id}`}>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-extrabold text-base text-foreground truncate" title={info?.originalName}>
                                      {info ? info.originalName.replace(/\.h5p$/i, "") : t("Vježba #{n}", { n: String(p.priloziId) })}
                                    </div>
                                    {info?.lekcijaNaslov && (
                                      <div className="text-xs text-muted-foreground mt-1 truncate">
                                        <BookOpen className="w-3 h-3 inline mr-1" />{info.lekcijaNaslov}
                                        {info.lekcijaNivo != null && <span className="ml-2 inline-block bg-primary/10 text-primary px-1.5 rounded text-[10px] font-bold align-middle">{t("Nivo {n}", { n: String(info.lekcijaNivo) })}</span>}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`text-sm font-black px-2.5 py-1 rounded-full shadow-sm shrink-0 ${p.procenat >= 80 ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : p.procenat >= 50 ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                                    {p.procenat}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                                  <span className="font-medium bg-white px-2 py-1 rounded-md border border-border/50">{t("Pokušaj #{n} · {score}/{max}", { n: String(p.attemptNo), score: String(p.score), max: String(p.maxScore) })}</span>
                                  <div className="flex items-center gap-3">
                                    {p.hasanatGained > 0 && (
                                      <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md">
                                        <Award className="w-3.5 h-3.5" /> {p.hasanatGained}
                                      </span>
                                    )}
                                    <span className="font-medium">{p.completedAt ? new Date(p.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
                                  <div className={`h-full rounded-full ${p.procenat >= 80 ? "bg-emerald-500" : p.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                                    style={{ width: `${p.procenat}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeModule === "kvizovi" && (
                  <div className="bg-white border border-border/50 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <ClipboardList className="w-5 h-5 text-primary" /> {t("Rezultati kvizova")}
                    </h2>
                    {kvizRezultati.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-xl">{t("Učenik još nije radio kvizove")}</p>
                    ) : (
                      <div className="space-y-3">
                        {kvizRezultati.map(r => (
                          <div key={r.id} className="bg-muted/10 border border-border/50 rounded-xl p-4 transition-colors hover:bg-muted/20">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-extrabold text-base text-foreground truncate mr-2">{r.kvizNaslov}</span>
                              <span className={`text-sm font-black px-2.5 py-1 rounded-full shadow-sm shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : r.procenat >= 50 ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                                {r.procenat}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                              <span className="font-medium bg-white px-2 py-1 rounded-md border border-border/50">{t("{tacni}/{ukupno} tačnih", { tacni: String(r.tacniOdgovori), ukupno: String(r.ukupnoPitanja) })}</span>
                              <div className="flex items-center gap-3">
                                {r.bodovi > 0 && (
                                  <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md">
                                    <Award className="w-3.5 h-3.5" /> {r.bodovi}
                                  </span>
                                )}
                                <span className="font-medium">{r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "-"}</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
                              <div className={`h-full rounded-full ${r.procenat >= 80 ? "bg-emerald-500" : r.procenat >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                                style={{ width: `${r.procenat}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeModule === "interaktivno" && (
                  <section className="bg-white border border-teal-200 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="interaktivni-pregled-ucenik">
                    <div className="px-5 py-5 bg-teal-50/70 border-b border-teal-100">
                      <h2 className="font-extrabold text-teal-950 flex items-center gap-2 text-lg">
                        <BookOpen className="w-5 h-5 text-teal-700" /> {t("Učenje u lekcijama")}
                      </h2>
                      <p className="text-sm text-teal-800 mt-2">
                        {t("Privatni trag pokušaja, pomoći i ponovnog čitanja — nije ocjena ni zvjezdica.")}
                      </p>
                    </div>
                    {interaktivnaPitanja.length === 0 ? (
                      <p className="px-5 py-8 text-sm text-muted-foreground text-center bg-muted/10">{t("Još nema odgovora iz ugrađenih pitanja lekcija.")}</p>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {interaktivnaPitanja.map((p, index) => (
                          <div key={`${p.lekcijaNaslov}-${index}`} className="px-5 py-4 hover:bg-muted/10 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-3 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-extrabold text-teal-700 uppercase tracking-wider mb-1.5">{p.lekcijaNaslov}</p>
                                <p className="font-bold text-foreground text-base leading-snug">{p.pitanjeTekst}</p>
                              </div>
                              <span className={`h-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-black shadow-sm ${p.procenatTacnih >= 80 ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : p.procenatTacnih >= 50 ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-red-100 text-red-800 border border-red-200"}`}>
                                {p.procenatTacnih}% {t("tačno")}
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium">
                              <span className="bg-white border border-border/50 px-2 py-1 rounded-md">{t("{n} pogrešnih od {ukupno} pokušaja", { n: String(p.netacniPokusaji), ukupno: String(p.brojPokusaja) })}</span>
                              <span className="bg-white border border-border/50 px-2 py-1 rounded-md">{t("prosječno: {n} s", { n: String(p.prosjekVrijemeSekundi) })}</span>
                              {p.pomocBroj > 0 && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md">{t("pomoć: {n}", { n: String(p.pomocBroj) })}</span>}
                              {p.tacnoNakonPonovnogCitanja > 0 && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md">{t("tačno nakon ponovnog čitanja: {n}", { n: String(p.tacnoNakonPonovnogCitanja) })}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {activeModule === "roditelji" && (
                  <div className="bg-white border border-border/50 rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="form-roditelji">
                    <h3 className="font-extrabold text-foreground mb-5 flex items-center gap-2 text-lg">
                      <Users className="w-5 h-5 text-primary" /> {t("Roditelji za {ime}", { ime: ucenik.displayName })}
                    </h3>

                    {/* Postojeći roditelji */}
                    {roditelji.length > 0 ? (
                      <div className="mb-6">
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">{t("Povezani roditelji ({n})", { n: String(roditelji.length) })}</p>
                        <div className="space-y-2">
                          {roditelji.map(r => (
                            <div key={r.id} className="bg-white border border-border/60 rounded-xl p-4 shadow-sm hover:border-primary/30 transition-colors">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-extrabold text-foreground text-base block truncate">{r.displayName}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="font-mono text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{r.username}</span>
                                      <button
                                        type="button"
                                        title={t("Kopiraj korisničko ime")}
                                        onClick={async () => { try { await navigator.clipboard.writeText(r.username); toast({ title: t("Kopirano!"), description: r.username }); } catch {} }}
                                        className="text-blue-500 hover:text-blue-700 transition-colors bg-white rounded-md p-0.5 border border-transparent hover:border-blue-200"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                                    r.status === "approved" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                                    r.status === "pending" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                    "bg-gray-100 text-gray-700 border border-gray-200"
                                  }`}>
                                    {r.status === "approved" ? t("Odobren") : r.status === "pending" ? t("Na čekanju") : r.status}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => resetRoditeljPassword(r.id)}
                                    disabled={resetRoditeljId === r.id}
                                    className="rounded-xl text-xs font-bold flex items-center gap-1.5 h-8 px-3"
                                    data-testid={`btn-reset-roditelja-${r.id}`}
                                  >
                                    {resetRoditeljId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                                    {t("Reset šifre")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => ukloniRoditelja(r.id)}
                                    disabled={uklaniRoditeljId === r.id}
                                    className="rounded-xl text-xs font-bold flex items-center gap-1.5 h-8 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                                    title={t("Ukloni vezu s roditeljem (ne briše nalog)")}
                                  >
                                    {uklaniRoditeljId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                    {t("Ukloni")}
                                  </Button>
                                </div>
                              </div>
                              {resetRoditeljPass?.id === r.id && (
                                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-emerald-800 w-24 shrink-0">{t("Korisničko ime:")}</span>
                                    <code className="bg-white border border-emerald-300 rounded-md px-2.5 py-1 text-sm font-mono font-bold text-emerald-900 shadow-sm">{resetRoditeljPass.username}</code>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-emerald-800 w-24 shrink-0">{t("Standardna šifra:")}</span>
                                    <code className="bg-white border border-emerald-300 rounded-md px-2.5 py-1 text-sm font-mono font-bold text-emerald-900 shadow-sm">{resetRoditeljPass.password}</code>
                                    <Button
                                      size="sm" variant="outline"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(`${t("Korisničko ime")}: ${resetRoditeljPass.username}\n${t("Lozinka")}: ${resetRoditeljPass.password}`);
                                          toast({ title: t("Kopirano!") });
                                        } catch {}
                                      }}
                                      className="rounded-xl text-xs font-bold h-7 px-3 ml-2 bg-white"
                                    >
                                      <Copy className="w-3.5 h-3.5 mr-1.5" />{t("Kopiraj sve")}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mb-6 p-6 bg-muted/20 border border-border/50 rounded-2xl text-center">
                        <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm font-bold text-foreground">{t("Nema povezanih roditelja")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("Učenik još nema povezanog roditelja.")}</p>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Poveži postojećeg */}
                      {!kreiraniRoditelj && approvedRoditeljiCount < 2 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                          <p className="text-sm font-extrabold text-blue-900 mb-3 flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-600" /> {t("Poveži postojećeg")}
                          </p>
                          <div className="relative mb-3">
                            <div className="flex flex-col gap-2">
                              <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                                <input
                                  type="text"
                                  value={odabraniRoditelj ? odabraniRoditelj.displayName : postojeciUsername}
                                  onChange={e => {
                                    setOdabraniRoditelj(null);
                                    setPostojeciUsername(e.target.value);
                                  }}
                                  onKeyDown={e => { if (e.key === "Enter" && odabraniRoditelj && !linkujemPostojeceg) linkPostojecegRoditelja(); }}
                                  placeholder={t("Pretraži ime ili prezime...")}
                                  className="w-full border border-blue-200 rounded-xl pl-9 pr-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white shadow-sm placeholder:text-muted-foreground/60"
                                  data-testid="input-roditelj-pretraga"
                                />
                              </div>
                              <Button
                                onClick={linkPostojecegRoditelja}
                                disabled={linkujemPostojeceg || !odabraniRoditelj}
                                className="rounded-xl font-bold flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white w-full"
                                data-testid="btn-poveži-postojećeg-roditelja"
                              >
                                {linkujemPostojeceg ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                {t("Poveži")}
                              </Button>
                            </div>
                            {(pretragaRoditelja || roditeljRezultati.length > 0) && !odabraniRoditelj && (
                              <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-blue-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                {pretragaRoditelja ? (
                                  <div className="px-4 py-3 text-sm text-muted-foreground font-medium flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> {t("Pretražujem...")}
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
                                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 border-blue-100 flex items-center justify-between gap-3 transition-colors"
                                      data-testid={`roditelj-rezultat-${r.id}`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block font-extrabold text-sm text-blue-950 truncate">{r.displayName}</span>
                                        <span className="block text-[11px] text-blue-700 font-mono truncate font-medium mt-0.5">@{r.username}</span>
                                      </span>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100/50 px-2 py-1 rounded-md shrink-0 border border-blue-200/50">
                                        {t("{n} djece", { n: String(r.brojDjece) })}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-blue-700/80 leading-relaxed font-medium">
                            {t("Prikazuju se roditelji koji već imaju dijete u ovom mektebu.")}
                          </p>
                        </div>
                      )}

                      {/* Dodaj novog / Kreirani */}
                      {kreiraniRoditelj ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
                          <h4 className="font-extrabold text-emerald-900 mb-3 flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {t("Roditelj kreiran!")}
                          </h4>
                          <div className="bg-white rounded-xl p-4 border border-emerald-100 shadow-sm space-y-2 text-sm mb-4">
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-xs font-bold text-emerald-800">{t("Ime:")}</span>
                              <span className="font-extrabold text-foreground text-right">{kreiraniRoditelj.displayName}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2 pt-2 border-t border-emerald-50">
                              <span className="text-xs font-bold text-emerald-800">{t("Korisničko ime:")}</span>
                              <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{kreiraniRoditelj.username}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2 pt-2 border-t border-emerald-50">
                              <span className="text-xs font-bold text-emerald-800">{t("Lozinka:")}</span>
                              <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{kreiraniRoditelj.generatedPassword}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={copyRoditeljKredencijale}
                              className="rounded-xl flex-1 text-xs font-bold flex items-center justify-center gap-1.5 border-emerald-200 bg-white hover:bg-emerald-50 hover:text-emerald-800"
                              data-testid="btn-copy-roditelj"
                            >
                              {copiedRoditelj ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                              {copiedRoditelj ? t("Kopirano!") : t("Kopiraj sve")}
                            </Button>
                            <Button
                              onClick={() => { setKreiraniRoditelj(null); setNovoRoditeljIme(""); }}
                              className="rounded-xl flex-1 text-xs font-bold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                              data-testid="btn-gotovo-roditelj"
                            >
                              <Check className="w-4 h-4" /> {t("Gotovo")}
                            </Button>
                          </div>
                        </div>
                      ) : approvedRoditeljiCount < 2 ? (
                        <div className="bg-gray-50 border border-border/50 rounded-2xl p-5 shadow-sm">
                          <p className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-muted-foreground" /> {t("Kreiraj novi nalog")}
                          </p>
                          <div className="flex flex-col gap-2 mb-3">
                            <input
                              type="text"
                              value={novoRoditeljIme}
                              onChange={e => setNovoRoditeljIme(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && novoRoditeljIme.trim() && !savingRoditelj) addRoditelj(); }}
                              placeholder={t("Ime i prezime...")}
                              className="w-full border border-border/60 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white shadow-sm placeholder:text-muted-foreground/60"
                              data-testid="input-roditelj-ime"
                            />
                            <Button
                              onClick={addRoditelj}
                              disabled={savingRoditelj || !novoRoditeljIme.trim()}
                              className="rounded-xl font-bold flex items-center justify-center gap-1.5 w-full"
                              data-testid="btn-dodaj-roditelja"
                            >
                              {savingRoditelj ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                              {t("Kreiraj i poveži")}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                            {t("Automatski generiše")} <strong>Mekteb####</strong> {t("šifru. Odmah se povezuje.")}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {activeModule === "postavke" && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border border-border/50 rounded-2xl p-5 sm:p-6 shadow-sm" data-testid="form-reset-password">
                      <h3 className="font-extrabold text-foreground mb-2 flex items-center gap-2 text-xl">
                        <KeyRound className="w-6 h-6 text-primary" /> {t("Reset lozinke")}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6 font-medium leading-relaxed max-w-2xl">
                        {t("Standardna šifra je oblika")} <strong>Mekteb####</strong> {t("(broj iz korisničkog imena) i identična je onoj na odštampanoj kartici. Resetovanje vraća šifru na tu standardnu vrijednost.")}
                      </p>
                      <Button
                        onClick={() => resetPassword()}
                        disabled={resettingPass}
                        className="rounded-xl font-bold flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto h-12 px-6 shadow-sm"
                        data-testid="btn-reset-standardna-sifra"
                      >
                        {resettingPass ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                        {t("Vrati na standardnu šifru")}
                      </Button>

                      {newPassword && (
                        <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5" data-testid="display-nova-sifra">
                          <p className="text-sm text-emerald-800 font-extrabold mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {t("Standardna šifra je postavljena.")}
                          </p>
                          <div className="flex gap-3 items-center flex-wrap">
                            <code className="bg-white border border-emerald-300 rounded-xl px-4 py-3 text-lg font-mono font-black text-emerald-900 shadow-sm flex-1">{newPassword}</code>
                            <Button
                              onClick={copyPassword}
                              variant="outline"
                              className="rounded-xl font-bold text-sm flex items-center gap-2 h-[50px] px-5 bg-white border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                              data-testid="btn-copy-sifra"
                            >
                              {copiedPass ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                              {copiedPass ? t("Kopirano") : t("Kopiraj")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeModule === "etape" && etapaPokusaji.length > 0 && (
                  <section className="bg-white border border-amber-200 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="etapni-pokusaji-ucenik">
                    <div className="px-5 py-5 bg-amber-50 border-b border-amber-100">
                      <h2 className="font-extrabold text-amber-950 flex items-center gap-2 text-lg">
                        <Medal className="w-5 h-5 text-amber-700" /> {t("Etapni ispiti")}
                      </h2>
                      <p className="text-sm text-amber-800 mt-2 font-medium">
                        {t("Nakon drugog neuspješnog pokušaja muallim odobrava svaki naredni pokušaj.")}
                      </p>
                    </div>
                    <div className="divide-y divide-border/50">
                      {etapaPokusaji.map((etapa) => {
                        const latest = etapa.attempts[0];
                        return (
                          <div key={etapa.medaljonId} className="px-5 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/10 transition-colors">
                            <div>
                              <p className="font-extrabold text-foreground text-base">{etapa.naziv} <span className="text-muted-foreground/40 mx-1">·</span> <span className="text-amber-700 text-sm">{t("Nivo")} {etapa.nivo}</span></p>
                              <p className="text-xs font-medium text-muted-foreground mt-1.5 flex items-center gap-2">
                                <span className="bg-white border border-border/50 px-2 py-0.5 rounded-md">{t("{n} pokušaja", { n: String(etapa.attempts.length) })}</span>
                                {latest && <span className="bg-white border border-border/50 px-2 py-0.5 rounded-md">{t("posljednji: {n}%", { n: String(latest.procenat) })}</span>}
                              </p>
                            </div>
                            {etapa.passed ? (
                              <span className="text-sm font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2 text-center shadow-sm">{t("Položeno")}</span>
                            ) : etapa.approved ? (
                              <span className="text-sm font-black rounded-full bg-blue-100 text-blue-800 border border-blue-200 px-4 py-2 text-center shadow-sm">{t("Pokušaj omogućen")}</span>
                            ) : etapa.canApprove ? (
                              <Button
                                onClick={() => odobriEtapaPokusaj(etapa.medaljonId)}
                                disabled={approvingEtapaId === etapa.medaljonId}
                                className="font-bold rounded-xl shadow-sm h-10 px-5 bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                {approvingEtapaId === etapa.medaljonId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {t("Omogući pokušaj {n}", { n: String(etapa.nextAttemptNo) })}
                              </Button>
                            ) : (
                              <span className="text-xs font-bold rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2.5 text-center leading-tight max-w-[200px]">{t("Drugi pokušaj se otvara automatski nakon 7 dana")}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
