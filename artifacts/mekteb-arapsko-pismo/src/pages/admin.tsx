import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { goBackOr } from "@/lib/back-navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  Users, Building2, ShieldCheck, BookOpen, LayoutDashboard,
  Plus, KeyRound, ToggleLeft, ToggleRight, Loader2, X, Check,
  BarChart3, Globe, TrendingUp, Award, ClipboardList, Pencil, ChevronDown,
  ChevronRight, UserCog, ArrowRightLeft, Trash2, Download, Upload, Bell, FileText, Link2, Eye, Wand2, Languages, Lock, ExternalLink, Database, Wrench, Gamepad2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { SelamSetting } from "@/components/selam-setting";
import { NapametGlobalProgramEditor } from "@/components/NapametGlobalProgramEditor";
import { LANG_LABELS, type Lang } from "@/lib/i18n";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SVI_JEZICI: Lang[] = ["bs", "sq", "de", "en", "tr", "ar"];

interface AnalyticsData {
  period?: string;
  granularity?: "hour" | "day";
  kpi?: {
    aktivniKorisnici: number;
    uceniciUce: number;
    zavrseneLekcije: number;
    kvizovi: number;
  };
  registracijePoMjesecu: { datum: string; broj: number }[];
  kvizoviPoPeriodu: { datum: string; broj: number }[];
  najaktivnijeLekcije: { id: number; naslov: string; nivo: number; ucenici: number; zavrseno: number; minuti: number }[];
  najaktivnijiKvizovi: { id: number; naslov: string; pokusaji: number; ucenici: number; prosjecniProcenat: number }[];
  korisnikStats: { role: string; aktivni: number; neaktivni: number }[];
  nedavniRezultati: { id: number; userId: number; kvizNaslov: string; tacniOdgovori: number; ukupnoPitanja: number; procenat: number; bodovi: number; completedAt: string; username: string; displayName: string }[];
}

type AnalyticsPeriod = "danas" | "7d" | "30d";
const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  danas: "Danas",
  "7d": "Zadnjih 7 dana",
  "30d": "Zadnjih 30 dana",
};

interface OnlineData {
  ukupno: number;
  poLokaciji: { country: string | null; city: string | null; broj: number }[];
}

interface KvizStatistika {
  id: number;
  naslov: string;
  kategorija: string;
  pokusaji: number;
  prosjecniProcenat: number;
  najvisiBodovi: number;
  najniziBodovi: number;
}

interface Statistike {
  korisnici: Record<string, number>;
  ukupnoKorisnika: number;
  ukupnoMekteba: number;
  aktivnePretplate: number;
}

interface Korisnik {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastSeenAt?: string | null;
  totalScreentimeSec?: number;
  trialUntil?: string | null;
}

type SortField = "displayName" | "createdAt" | "lastLoginAt" | "totalScreentimeSec";
type SortDir = "asc" | "desc";

function formatScreentime(sec: number | undefined | null): string {
  const s = sec ?? 0;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return `${h}h ${rem}min`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

interface MuallimPregled {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  brojGrupa: number;
  brojUcenika: number;
  aktivniUcenici: number;
  isGlavni: boolean | null;
  mektebId: number | null;
  mektebNaziv: string | null;
  mektebGrad: string | null;
  dozvoljenoMuallima: number | null;
  grupe: { id: number; naziv: string; skolskaGodina: string; isActive: boolean; brojUcenika: number; aktivniUcenika: number }[];
}

interface MektebOpcija {
  id: number;
  naziv: string;
  grad: string | null;
}

interface GrupaAll {
  id: number;
  naziv: string;
  muallimId: number;
  muallimName: string;
  isActive: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  muallim: "bg-teal-100 text-teal-700",
  roditelj: "bg-blue-100 text-blue-700",
  ucenik: "bg-amber-100 text-amber-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", muallim: "Muallim", roditelj: "Roditelj", ucenik: "Učenik",
};

const prezimeOd = (ime: string) => ime.trim().split(/\s+/).slice(-1)[0]?.toLowerCase() ?? "";

function pripremiMuallime(list: MuallimPregled[], search: string, sort: "prezime" | "datum") {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? list.filter(m =>
        m.displayName.toLowerCase().includes(q) ||
        (m.username?.toLowerCase().includes(q) ?? false) ||
        (m.mektebNaziv?.toLowerCase().includes(q) ?? false) ||
        (m.mektebGrad?.toLowerCase().includes(q) ?? false))
    : [...list];
  filtered.sort((a, b) =>
    sort === "datum"
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : prezimeOd(a.displayName).localeCompare(prezimeOd(b.displayName), "bs"));
  return filtered;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white border border-border/50 rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground font-medium">{label}</div>
      </div>
    </div>
  );
}

function AdminToolCard({
  icon,
  label,
  tone,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "teal" | "amber" | "orange" | "violet" | "emerald" | "sky";
  onClick: () => void;
  testId?: string;
}) {
  const tones = {
    teal: "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100",
    amber: "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100",
    orange: "bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100",
    violet: "bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100",
    sky: "bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100",
  };

  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`min-h-16 flex items-center gap-3 px-4 py-3 border rounded-xl font-semibold text-sm text-left transition-colors ${tones[tone]}`}
    >
      <span className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </span>
      <span>{label}</span>
      <ChevronRight className="w-4 h-4 ml-auto opacity-60 shrink-0" />
    </button>
  );
}

function SistemAlati({ token }: { token: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleSeed = async () => {
    if (confirmText !== "DEMO") return;
    setIsSeeding(true);
    try {
      const data = await apiRequest<{ message?: string }>("POST", "/admin/system/seed-demo", { confirm: "DEMO" }, token);
      const msg = data.message || t("Demo podaci dodani.");
      setLastResult(msg);
      toast({ title: t("Gotovo!"), description: msg });
      setShowSeedModal(false);
      setConfirmText("");
    } catch (err: any) {
      const detail = err?.message || t("Pokušaj ponovo.");
      toast({ title: t("Greška"), description: detail, variant: "destructive" });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <>
      <div className="mt-8 bg-white border border-border/50 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-extrabold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> {t("Sistem alati")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{t("Administrativne radnje nad bazom podataka")}</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex-1">
              <div className="font-bold text-foreground">{t("Učitaj demo podatke")}</div>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Dodaje 3 demo grupe sa muallimom, 18 učenika i 2 roditelja (svi sa prefiksom ")}<code className="text-xs bg-white px-1 rounded">demo.</code>{t(", lozinka ")}<code className="text-xs bg-white px-1 rounded">demo123</code>{t("). Tvoji stvarni korisnici se NE diraju.")}
              </p>
              {lastResult && (
                <p className="text-xs text-emerald-700 mt-2 font-medium">✓ {lastResult}</p>
              )}
            </div>
            <Button
              onClick={() => setShowSeedModal(true)}
              data-testid="button-seed-demo"
              className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" /> {t("Učitaj demo")}
            </Button>
          </div>
        </div>
      </div>

      {showSeedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isSeeding && setShowSeedModal(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-foreground mb-2">{t("Potvrdi učitavanje demo podataka")}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t("Skripta će dodati demo grupe, muallima, učenike i roditelje u ")}<strong>{t("ovu bazu")}</strong>{t(". Postojeći demo nalozi će biti osvježeni.")}
            </p>
            <p className="text-sm text-foreground mb-2">{t("Da potvrdiš, upiši ")}<code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">DEMO</code>:</p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              data-testid="input-confirm-seed"
              autoFocus
              disabled={isSeeding}
              placeholder="DEMO"
              className="w-full px-3 py-2 border border-border rounded-xl mb-4 font-mono uppercase"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowSeedModal(false); setConfirmText(""); }}
                disabled={isSeeding}
                className="flex-1 rounded-xl"
              >
                {t("Otkaži")}
              </Button>
              <Button
                onClick={handleSeed}
                disabled={confirmText !== "DEMO" || isSeeding}
                data-testid="button-confirm-seed"
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Učitaj")}
              </Button>
            </div>
            {isSeeding && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {t("Ovo može potrajati 10-30 sekundi...")}
              </p>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}

interface PendingPrilog {
  id: number;
  lekcijaId: number;
  lekcijaNaslov: string | null;
  lekcijaSlug: string | null;
  lekcijaNivo: number | null;
  originalName: string;
  storedName: string;
  fileSize: number;
  mimeType: string;
  kind: string;
  externalUrl: string | null;
  uploadedByRole: string | null;
  createdAt: string;
}

function PendingPrilozi({ token }: { token: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [pending, setPending] = useState<PendingPrilog[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PendingPrilog[]>("GET", "/admin/pending-prilozi", undefined, token);
      setPending(data);
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handle = async (id: number, approve: boolean) => {
    setProcessingId(id);
    try {
      await apiRequest("PUT", `/admin/prilozi/${id}/approve`, { approve }, token);
      toast({ title: approve ? t("Odobreno") : t("Odbijeno"), description: approve ? t("Materijal je sada vidljiv učenicima.") : t("Materijal je obrisan.") });
      setPending(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return (
    <div className="bg-white border border-border/50 rounded-2xl p-5">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (pending.length === 0) return (
    <div className="bg-white border border-border/50 rounded-2xl p-5 flex items-center gap-3">
      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      <span className="text-sm text-muted-foreground">{t("Nema materijala koji čekaju odobrenje.")}</span>
    </div>
  );

  return (
    <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
        <Bell className="w-5 h-5 text-amber-600" />
        <h3 className="font-extrabold text-foreground">{t("Materijali čekaju odobrenje")}</h3>
        <span className="ml-auto text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">{pending.length}</span>
      </div>
      <div className="divide-y divide-border/40">
        {pending.map(p => {
          // Pregledaj URL po tipu priloga:
          //  - file (PDF/Word/itd.) → /api/uploads/<storedName> (statički,
          //    requireH5pAuth propušta ne-h5p putanje)
          //  - url → externalUrl direktno
          //  - h5p → otvori lekciju (H5P se renderuje u kontekstu lekcije)
          const lekcijaUrl = p.lekcijaSlug ? `/ilmihal/${p.lekcijaSlug}` : null;
          let previewUrl: string | null = null;
          if (p.kind === "url" && p.externalUrl) {
            previewUrl = p.externalUrl;
          } else if (p.kind === "h5p") {
            previewUrl = lekcijaUrl;
          } else if (p.storedName) {
            previewUrl = `/api/uploads/${p.storedName}`;
          }
          return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl flex-shrink-0">
              {p.kind === "url" ? <Link2 className="w-5 h-5 text-teal-500" /> : <FileText className="w-5 h-5 text-blue-500" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{p.originalName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {lekcijaUrl ? (
                  <a
                    href={lekcijaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 hover:underline font-semibold"
                    data-testid={`link-lekcija-${p.id}`}
                  >
                    {p.lekcijaNaslov || t("Lekcija #{id}", { id: String(p.lekcijaId) })}
                    {p.lekcijaNivo ? ` · ${t("Nivo {nivo}", { nivo: String(p.lekcijaNivo) })}` : ""}
                  </a>
                ) : (
                  <span className="text-red-600">{t("Lekcija obrisana (#{id})", { id: String(p.lekcijaId) })}</span>
                )}
                {" · "}
                {p.uploadedByRole || "muallim"}
                {" · "}
                {new Date(p.createdAt).toLocaleDateString("bs-BA")}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold transition-colors"
                  data-testid={`button-pregledaj-${p.id}`}
                  title={t("Otvori prilog u novom tabu")}
                >
                  <Eye className="w-3.5 h-3.5" /> {t("Pregledaj")}
                </a>
              )}
              <button
                onClick={() => handle(p.id, true)}
                disabled={processingId === p.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {processingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t("Odobri")}
              </button>
              <button
                onClick={() => handle(p.id, false)}
                disabled={processingId === p.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> {t("Odbij")}
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

const MEDENA_KATEGORIJE_META: Record<string, { naziv: string; ikona: string }> = {
  sarti: { naziv: "Imanski i islamski šarti", ikona: "🌷" },
  sure: { naziv: "Sure i ajeti", ikona: "📖" },
  dove: { naziv: "Dove i zikrovi", ikona: "🤲" },
  namaz: { naziv: "Namaz i ibadeti", ikona: "🕌" },
  ponasanje: { naziv: "Lijepo ponašanje", ikona: "💛" },
  halal_haram: { naziv: "Halal i haram", ikona: "✅" },
  historija: { naziv: "Islamska historija", ikona: "📜" },
  bosna: { naziv: "Bosna i njena baština", ikona: "🌿" },
};
const MEDENA_KAT_REDOSLIJED = ["sarti", "sure", "dove", "namaz", "ponasanje", "halal_haram", "historija", "bosna"] as const;

type IgraPitanje = {
  id: number;
  kategorija: string;
  pitanje: string;
  opcije: string[];
  correctIndex: number;
  objasnjenje: string | null;
  tezina: number;
  aktivno: boolean;
};

type KatStats = { ukupno: number; aktivnih: number };

function IgraPitanjaEditor({ token }: { token: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Record<string, KatStats>>({});
  const [activeKat, setActiveKat] = useState<string>("sarti");
  const [pitanja, setPitanja] = useState<IgraPitanje[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<IgraPitanje | "new" | null>(null);
  const [seedingMedena, setSeedingMedena] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<null | { inserted: number; updated: number; errorsCount: number; errors: Array<{ red: number; razlog: string }> }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    try {
      const data = await apiRequest<{ stats: Record<string, KatStats> }>("GET", "/admin/igra-pitanja/stats", undefined, token);
      setStats(data.stats || {});
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Ne mogu učitati statistiku"), variant: "destructive" });
    }
  };

  const loadPitanja = async (kat: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<{ pitanja: IgraPitanje[] }>("GET", `/admin/igra-pitanja?kategorija=${kat}`, undefined, token);
      setPitanja(data.pitanja || []);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Ne mogu učitati pitanja"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadPitanja(activeKat); }, [activeKat]);

  const handleDelete = async (p: IgraPitanje) => {
    if (!confirm(t("Obrisati pitanje?\n\n\"{pitanje}\"", { pitanje: p.pitanje }))) return;
    try {
      await apiRequest("DELETE", `/admin/igra-pitanja/${p.id}`, undefined, token);
      toast({ title: t("Obrisano"), description: t("Pitanje uklonjeno") });
      loadPitanja(activeKat);
      loadStats();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Brisanje neuspjelo"), variant: "destructive" });
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await fetch(`${getApiBase()}/admin/igra-pitanja/export.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t("Greška pri izvozu") }));
        throw new Error(err.error || t("Greška pri izvozu"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `igra-pitanja-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t("Izvezeno"), description: t("CSV preuzet") });
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Izvoz neuspio"), variant: "destructive" });
    }
  };

  const handleImportCsv = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiRequest<{ inserted: number; updated: number; errorsCount: number; errors: Array<{ red: number; razlog: string }> }>(
        "POST", "/admin/igra-pitanja/import", fd, token, true,
      );
      setImportResult({
        inserted: res.inserted ?? 0,
        updated: res.updated ?? 0,
        errorsCount: res.errorsCount ?? 0,
        errors: res.errors ?? [],
      });
      loadStats();
      loadPitanja(activeKat);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Uvoz neuspio"), variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSeedMedena = async () => {
    if (!confirm(t("Učitati početni set od 160 pitanja (8 kategorija × 20)? Postojeća pitanja sa istim tekstom će se ažurirati."))) return;
    setSeedingMedena(true);
    try {
      const res = await apiRequest<{ inserted?: number; updated?: number; total?: number; message?: string }>(
        "POST", "/admin/system/seed-medena-pitanja", {}, token,
      );
      toast({
        title: t("Gotovo!"),
        description: res.message || t("Dodato: {dodato}, ažurirano: {azurirano}, ukupno: {ukupno}", { dodato: String(res.inserted ?? 0), azurirano: String(res.updated ?? 0), ukupno: String(res.total ?? 0) }),
      });
      loadStats();
      loadPitanja(activeKat);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Seed neuspješan"), variant: "destructive" });
    } finally {
      setSeedingMedena(false);
    }
  };

  return (
    <>
      <div className="mt-8 bg-white border border-border/50 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-extrabold text-foreground flex items-center gap-2">
              🍯 {t("Medena staza — pitanja")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("Banka pitanja za igricu. U svakoj partiji djeca dobiju po jedno nasumično pitanje iz svake kategorije.")}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleExportCsv}
              variant="outline"
              data-testid="button-export-csv"
              className="rounded-xl text-sky-700 border-sky-300 hover:bg-sky-50"
            >
              <Download className="w-4 h-4 mr-2" /> {t("Izvezi CSV")}
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              variant="outline"
              data-testid="button-import-csv"
              className="rounded-xl text-sky-700 border-sky-300 hover:bg-sky-50"
            >
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {t("Uvezi CSV")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              data-testid="input-csv-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportCsv(f);
              }}
            />
            <Button
              onClick={handleSeedMedena}
              disabled={seedingMedena}
              variant="outline"
              data-testid="button-seed-medena"
              className="rounded-xl text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              {seedingMedena ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {t("Učitaj početni set (160)")}
            </Button>
            <Button onClick={() => setEditing("new")} data-testid="button-novo-pitanje" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> {t("Novo pitanje")}
            </Button>
          </div>
        </div>

        <div className="p-4 border-b border-border/50 bg-amber-50/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {MEDENA_KAT_REDOSLIJED.map((kat) => {
              const meta = MEDENA_KATEGORIJE_META[kat];
              const s = stats[kat] ?? { ukupno: 0, aktivnih: 0 };
              const aktivan = activeKat === kat;
              const upozori = s.aktivnih === 0;
              return (
                <button
                  key={kat}
                  onClick={() => setActiveKat(kat)}
                  data-testid={`tab-kat-${kat}`}
                  className={[
                    "rounded-xl p-2 text-left transition border",
                    aktivan
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : upozori
                        ? "bg-red-50 text-foreground border-red-300 hover:border-red-400"
                        : "bg-white text-foreground border-border/60 hover:border-emerald-300",
                  ].join(" ")}
                >
                  <div className="text-lg leading-none">{meta.ikona}</div>
                  <div className="text-[11px] font-bold leading-tight mt-1">{meta.naziv}</div>
                  <div className={["text-[10px] mt-0.5 font-medium", aktivan ? "text-emerald-50" : upozori ? "text-red-700" : "text-muted-foreground"].join(" ")}>
                    {s.aktivnih} / {s.ukupno}{upozori ? " ⚠️" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> {t("Učitavam...")}</div>
          ) : pitanja.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("Nema pitanja u ovoj kategoriji. Klikni ")}<strong>{t("Novo pitanje")}</strong>{t(" ili ")}<strong>{t("Učitaj početni set")}</strong>.
            </div>
          ) : (
            <div className="space-y-2">
              {pitanja.map((p) => (
                <div key={p.id} data-testid={`row-pitanje-${p.id}`} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border/40 hover:bg-amber-50/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={["text-[10px] font-bold px-2 py-0.5 rounded-full", p.aktivno ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"].join(" ")}>
                        {p.aktivno ? t("AKTIVNO") : t("NEAKTIVNO")}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">{t("težina {n}", { n: String(p.tezina) })}</span>
                    </div>
                    <div className="font-bold text-sm text-foreground">{p.pitanje}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.opcije.map((o, i) => (
                        <span key={i} className={i === p.correctIndex ? "text-emerald-700 font-bold" : ""}>
                          {i === p.correctIndex ? "✓ " : ""}{o}{i < p.opcije.length - 1 ? "  •  " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setEditing(p)}
                      data-testid={`button-edit-${p.id}`}
                      className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-700"
                      title={t("Uredi")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      data-testid={`button-delete-${p.id}`}
                      className="p-2 rounded-lg hover:bg-red-100 text-red-600"
                      title={t("Obriši")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <PitanjeModal
          token={token}
          kategorija={activeKat}
          pitanje={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadPitanja(activeKat); loadStats(); }}
        />
      )}

      {importResult && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setImportResult(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl my-4"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-import-rezultat"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-foreground">{t("Rezultat uvoza CSV-a")}</h3>
              <button onClick={() => setImportResult(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                <div className="text-2xl font-extrabold text-emerald-700" data-testid="text-import-inserted">{importResult.inserted}</div>
                <div className="text-xs text-emerald-700 font-medium">{t("Dodano")}</div>
              </div>
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-center">
                <div className="text-2xl font-extrabold text-sky-700" data-testid="text-import-updated">{importResult.updated}</div>
                <div className="text-xs text-sky-700 font-medium">{t("Ažurirano")}</div>
              </div>
              <div className={[
                "rounded-xl border p-3 text-center",
                importResult.errorsCount > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200",
              ].join(" ")}>
                <div className={["text-2xl font-extrabold", importResult.errorsCount > 0 ? "text-red-700" : "text-gray-500"].join(" ")} data-testid="text-import-errors">
                  {importResult.errorsCount}
                </div>
                <div className={["text-xs font-medium", importResult.errorsCount > 0 ? "text-red-700" : "text-gray-500"].join(" ")}>{t("Grešaka")}</div>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  {t("Greške (prvih {n}):", { n: String(importResult.errors.length) })}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-red-100">
                  {importResult.errors.map((e, i) => (
                    <div key={i} className="px-3 py-2 text-xs" data-testid={`row-import-error-${i}`}>
                      <span className="font-bold text-red-700">{t("Red {red}:", { red: String(e.red) })}</span>{" "}
                      <span className="text-foreground">{e.razlog}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button onClick={() => setImportResult(null)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                {t("U redu")}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

function PitanjeModal({
  token, kategorija, pitanje, onClose, onSaved,
}: {
  token: string;
  kategorija: string;
  pitanje: IgraPitanje | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    kategorija: pitanje?.kategorija ?? kategorija,
    pitanje: pitanje?.pitanje ?? "",
    opcije: pitanje?.opcije ?? ["", "", "", ""],
    correctIndex: pitanje?.correctIndex ?? 0,
    objasnjenje: pitanje?.objasnjenje ?? "",
    tezina: pitanje?.tezina ?? 1,
    aktivno: pitanje?.aktivno ?? true,
  });
  const [saving, setSaving] = useState(false);

  const setOpcija = (i: number, val: string) => {
    setForm((f) => ({ ...f, opcije: f.opcije.map((o, idx) => (idx === i ? val : o)) }));
  };

  const handleSave = async () => {
    if (!form.pitanje.trim()) { toast({ title: t("Pitanje je obavezno"), variant: "destructive" }); return; }
    if (form.opcije.some((o) => !o.trim())) { toast({ title: t("Sve 4 opcije moraju biti popunjene"), variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        kategorija: form.kategorija,
        pitanje: form.pitanje.trim(),
        opcije: form.opcije.map((o) => o.trim()),
        correctIndex: form.correctIndex,
        objasnjenje: form.objasnjenje.trim() || null,
        tezina: form.tezina,
        aktivno: form.aktivno,
      };
      if (pitanje) {
        await apiRequest("PUT", `/admin/igra-pitanja/${pitanje.id}`, body, token);
        toast({ title: t("Sačuvano"), description: t("Pitanje ažurirano") });
      } else {
        await apiRequest("POST", "/admin/igra-pitanja", body, token);
        toast({ title: t("Dodano"), description: t("Novo pitanje sačuvano") });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Spremanje neuspjelo"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-foreground">
            {pitanje ? t("Uredi pitanje") : t("Novo pitanje")}
          </h3>
          <button onClick={onClose} disabled={saving} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Kategorija")}</label>
            <select
              value={form.kategorija}
              onChange={(e) => setForm((f) => ({ ...f, kategorija: e.target.value }))}
              data-testid="select-kategorija"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm"
            >
              {MEDENA_KAT_REDOSLIJED.map((k) => (
                <option key={k} value={k}>{MEDENA_KATEGORIJE_META[k].ikona} {MEDENA_KATEGORIJE_META[k].naziv}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Pitanje")}</label>
            <textarea
              value={form.pitanje}
              onChange={(e) => setForm((f) => ({ ...f, pitanje: e.target.value }))}
              data-testid="input-pitanje"
              rows={2}
              placeholder={t("Npr. Koliko ima imanskih šarta?")}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Opcije (označi tačnu)")}</label>
            <div className="space-y-2">
              {form.opcije.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correctIndex === i}
                    onChange={() => setForm((f) => ({ ...f, correctIndex: i }))}
                    data-testid={`radio-correct-${i}`}
                    className="w-4 h-4 accent-emerald-600"
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => setOpcija(i, e.target.value)}
                    data-testid={`input-opcija-${i}`}
                    placeholder={t("Opcija {n}", { n: String(i + 1) })}
                    className="flex-1 border border-border rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Objašnjenje (opciono)")}</label>
            <textarea
              value={form.objasnjenje}
              onChange={(e) => setForm((f) => ({ ...f, objasnjenje: e.target.value }))}
              data-testid="input-objasnjenje"
              rows={2}
              placeholder={t("Kratko objašnjenje koje se prikaže nakon odgovora")}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Težina (1–3)")}</label>
              <select
                value={form.tezina}
                onChange={(e) => setForm((f) => ({ ...f, tezina: parseInt(e.target.value) }))}
                data-testid="select-tezina"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm"
              >
                <option value={1}>{t("1 — lako")}</option>
                <option value={2}>{t("2 — srednje")}</option>
                <option value={3}>{t("3 — teško")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Status")}</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, aktivno: !f.aktivno }))}
                data-testid="toggle-aktivno"
                className={["w-full px-3 py-2 rounded-xl text-sm font-bold border transition",
                  form.aktivno ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-gray-100 border-gray-300 text-gray-600"].join(" ")}
              >
                {form.aktivno ? t("✓ Aktivno") : t("Neaktivno")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1 rounded-xl">{t("Odustani")}</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-pitanje" className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (pitanje ? t("Sačuvaj") : t("Dodaj"))}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function DodajMuallimModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "", licenceCount: "30" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/muallim", {
        ...form,
        licenceCount: parseInt(form.licenceCount) || 30,
      }, token);
      toast({ title: t("Muallim kreiran!"), description: `${form.displayName} (${form.username})` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Greška pri kreiranju"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">{t("Dodaj muallima")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "displayName", label: t("Ime i prezime"), placeholder: t("Npr. Amra Čolić") },
            { key: "username", label: t("Korisničko ime"), placeholder: t("Npr. amra.colic") },
            { key: "password", label: t("Lozinka"), placeholder: t("Min. 6 karaktera") },
            { key: "email", label: t("E-mail (opciono)"), placeholder: "muallim@mekteb.ba" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-muted-foreground mb-1">{f.label}</label>
              <input
                type={f.key === "password" ? "password" : "text"}
                required={f.key !== "email"}
                placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Broj licenci (učenika)")}</label>
            <input type="number" min="1" max="500" value={form.licenceCount}
              onChange={e => setForm(p => ({ ...p, licenceCount: e.target.value }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">{t("Odustani")}</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Dodaj")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DodajAdminaModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/admin", form, token);
      toast({ title: t("Admin kreiran!"), description: `${form.displayName} (${form.username})` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Greška pri kreiranju"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">{t("Dodaj admina")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "displayName", label: t("Ime i prezime"), placeholder: t("Npr. Amra Čolić") },
            { key: "username", label: t("Korisničko ime"), placeholder: t("Npr. amra.colic") },
            { key: "password", label: t("Lozinka"), placeholder: t("Min. 6 karaktera") },
            { key: "email", label: t("E-mail (opciono)"), placeholder: "admin@mekteb.ba" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-muted-foreground mb-1">{f.label}</label>
              <input
                type={f.key === "password" ? "password" : "text"}
                required={f.key !== "email"}
                placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">{t("Odustani")}</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Dodaj")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DodajUcenikaModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/ucenik", form, token);
      toast({ title: t("Učenik kreiran!"), description: `${form.displayName} (${form.username})` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Greška pri kreiranju"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">{t("Dodaj učenika")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "displayName", label: t("Ime i prezime"), placeholder: t("Npr. Džana Begović") },
            { key: "username", label: t("Korisničko ime"), placeholder: t("Npr. dzana.begovic") },
            { key: "password", label: t("Lozinka"), placeholder: t("Min. 6 karaktera") },
            { key: "email", label: t("E-mail (opciono)"), placeholder: "ucenik@mekteb.ba" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold text-muted-foreground mb-1">{f.label}</label>
              <input
                type={f.key === "password" ? "password" : "text"}
                required={f.key !== "email"}
                placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">{t("Odustani")}</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Dodaj")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

interface MuallimProfil {
  userId: number;
  licenceCount: number;
  licencesUsed: number;
  mektebId?: number;
  dozvoljeniJezici?: string[] | null;
}

function EditKorisnikModal({ token, korisnik, muallimProfil, onClose, onSaved }: {
  token: string; korisnik: Korisnik; muallimProfil?: MuallimProfil; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [displayName, setDisplayName] = useState(korisnik.displayName);
  const [email, setEmail] = useState(korisnik.email || "");
  const [licenceCount, setLicenceCount] = useState(muallimProfil?.licenceCount?.toString() || "30");
  const [jezici, setJezici] = useState<Lang[]>(() => {
    const init = Array.isArray(muallimProfil?.dozvoljeniJezici)
      ? (muallimProfil!.dozvoljeniJezici as string[]).filter((l): l is Lang => SVI_JEZICI.includes(l as Lang))
      : SVI_JEZICI;
    return init.includes("bs") ? init : ["bs", ...init];
  });
  const [isLoading, setIsLoading] = useState(false);

  const toggleJezik = (l: Lang) => {
    if (l === "bs") return; // bosanski je uvijek uključen
    setJezici(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("PUT", `/admin/korisnici/${korisnik.id}`, {
        displayName: displayName.trim(),
        email: email || null,
      }, token);

      if (korisnik.role === "muallim" && muallimProfil) {
        await apiRequest("PUT", `/admin/muallim/${korisnik.id}/licence`, {
          licenceCount: parseInt(licenceCount) || 30,
        }, token);
        await apiRequest("PUT", `/admin/muallim/${korisnik.id}/jezici`, {
          jezici: SVI_JEZICI.filter(l => l === "bs" || jezici.includes(l)),
        }, token);
      }

      toast({ title: t("Korisnik ažuriran!"), description: displayName });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Greška pri ažuriranju"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">{t("Uredi korisnika")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[korisnik.role] || "bg-gray-100"}`}>
            {ROLE_LABELS[korisnik.role]}
          </span>
          <span className="ml-2 font-mono">{korisnik.username}</span>
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("Ime i prezime")}</label>
            <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">{t("E-mail")}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("opciono")}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          {korisnik.role === "muallim" && muallimProfil && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-sm text-teal-800">{t("Licence za učenike")}</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-teal-700 mb-1">{t("Ukupno licenci")}</label>
                  <input type="number" min="1" max="999" value={licenceCount}
                    onChange={e => setLicenceCount(e.target.value)}
                    className="w-full border border-teal-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
                </div>
                <div className="text-center pt-5">
                  <div className="text-2xl font-black text-teal-700">{muallimProfil.licencesUsed}</div>
                  <div className="text-xs text-teal-600 font-medium">{t("iskorišteno")}</div>
                </div>
              </div>
              <div className="text-xs text-teal-600">
                {t("Preostalo: ")}<span className="font-bold">{(parseInt(licenceCount) || 0) - (muallimProfil.licencesUsed || 0)}</span>{t(" licenci")}
              </div>
            </div>
          )}
          {korisnik.role === "muallim" && muallimProfil && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
              <h4 className="font-bold text-sm text-indigo-800">{t("Dostupni jezici")}</h4>
              <p className="text-xs text-indigo-600">{t("Muallim i njegovi učenici mogu prebaciti aplikaciju samo na uključene jezike. Bosanski je uvijek uključen.")}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {SVI_JEZICI.map(l => {
                  const checked = l === "bs" || jezici.includes(l);
                  return (
                    <label
                      key={l}
                      className={`flex items-center gap-2 text-sm font-medium rounded-lg px-2 py-1.5 border transition-colors ${
                        l === "bs" ? "opacity-70 cursor-default bg-white border-indigo-200" : "cursor-pointer bg-white border-indigo-200 hover:bg-indigo-100/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={l === "bs"}
                        onChange={() => toggleJezik(l)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-indigo-900">{LANG_LABELS[l]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">{t("Odustani")}</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Sačuvaj")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ResetPasswordModal({ token, korisnik, onClose }: { token: string; korisnik: Korisnik; onClose: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [lozinka, setLozinka] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/reset-password", { userId: korisnik.id, newPassword: lozinka }, token);
      toast({ title: t("Lozinka promijenjena!"), description: t("Korisnik: {ime}", { ime: korisnik.displayName }) });
      onClose();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće promijeniti lozinku"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-foreground">{t("Reset lozinke")}</h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{korisnik.displayName} ({korisnik.username})</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="password" required minLength={6} placeholder={t("Nova lozinka (min. 6 znakova)")}
            value={lozinka} onChange={e => setLozinka(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">{t("Odustani")}</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} {t("Promijeni")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function RasporediModal({ token, korisnik, grupeAll, onClose, onSaved }: {
  token: string; korisnik: Korisnik; grupeAll: GrupaAll[]; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [selectedGrupaId, setSelectedGrupaId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedGrupa = grupeAll.find(g => g.id === selectedGrupaId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGrupa) return;
    setIsLoading(true);
    try {
      await apiRequest("PUT", `/admin/ucenik/${korisnik.id}/rasporedi`, {
        muallimId: selectedGrupa.muallimId,
        grupaId: selectedGrupa.id,
      }, token);
      toast({ title: t("Učenik raspoređen!"), description: `${korisnik.displayName} → ${selectedGrupa.naziv} (${selectedGrupa.muallimName})` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Greška pri raspoređivanju"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const grupeByMuallim = grupeAll.reduce((acc, g) => {
    const key = g.muallimName || t("Nepoznat");
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {} as Record<string, GrupaAll[]>);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">{t("Rasporedi učenika")}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-bold text-foreground">{korisnik.displayName}</span> ({korisnik.username})
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-2">{t("Odaberite grupu")}</label>
            {grupeAll.length === 0 ? (
              <div className="border border-border rounded-xl p-4 text-center text-sm text-muted-foreground">
                {t("Nema dostupnih grupa. Prvo kreirajte grupu kod muallima.")}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-border rounded-xl">
                {Object.entries(grupeByMuallim).map(([muallimName, grupe]) => (
                  <div key={muallimName}>
                    <div className="px-3 py-2 bg-muted/30 text-xs font-bold text-muted-foreground sticky top-0">
                      {muallimName}
                    </div>
                    {grupe.map(g => (
                      <button key={g.id} type="button" onClick={() => setSelectedGrupaId(g.id)}
                        className={`w-full text-left px-4 py-2.5 text-sm border-b border-border/20 transition-colors ${
                          selectedGrupaId === g.id ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/20"
                        }`}>
                        {g.naziv}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">{t("Odustani")}</Button>
            <Button type="submit" disabled={isLoading || !selectedGrupaId} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />} {t("Rasporedi")}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── KATEGORIJE ZVJEZDICA ─────────────────────────────────────────────────────
function KategorijeZvjezdica({ token }: { token: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [kategorije, setKategorije] = useState<{id:number; tip:string; naziv:string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaNaziv, setNovaNaziv] = useState("");
  const [novaTip, setNovaTip] = useState<"pozitivna"|"negativna">("pozitivna");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{id:number;tip:string;naziv:string}[]>("GET", "/admin/zvjezdice-kategorije", undefined, token)
      .then(setKategorije).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  async function dodaj() {
    if (!novaNaziv.trim()) return;
    setSaving(true);
    try {
      const nova = await apiRequest<{id:number;tip:string;naziv:string}>("POST", "/admin/zvjezdice-kategorije", { tip: novaTip, naziv: novaNaziv.trim() }, token);
      setKategorije(prev => [...prev, nova]);
      setNovaNaziv("");
      toast({ title: t("Kategorija dodana") });
    } catch {
      toast({ title: t("Greška"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function obrisi(id: number) {
    try {
      await apiRequest("DELETE", `/admin/zvjezdice-kategorije/${id}`, undefined, token);
      setKategorije(prev => prev.filter(k => k.id !== id));
    } catch {
      toast({ title: t("Greška pri brisanju"), variant: "destructive" });
    }
  }

  const pozitivne = kategorije.filter(k => k.tip === "pozitivna");
  const negativne = kategorije.filter(k => k.tip === "negativna");

  return (
    <div className="bg-white border border-border/50 rounded-2xl p-5">
      <h3 className="font-extrabold text-foreground mb-1 flex items-center gap-2">
        <span>⭐★</span> {t("Kategorije zvjezdica — ponašanje")}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {t("Muallim bira kategoriju kada dodjeljuje zvjezdicu učeniku. Dodaj pozitivne (⭐) i negativne (★) razloge.")}
      </p>

      {loading ? <div className="text-sm text-muted-foreground">{t("Učitavanje...")}</div> : (
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-extrabold text-amber-600 mb-2">⭐ {t("Pozitivne")}</p>
            <div className="space-y-1">
              {pozitivne.length === 0 && <p className="text-xs text-muted-foreground italic">{t("Nema kategorija")}</p>}
              {pozitivne.map(k => (
                <div key={k.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                  <span className="text-sm font-medium">⭐ {k.naziv}</span>
                  <button onClick={() => obrisi(k.id)} className="text-red-400 hover:text-red-600 ml-2"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-600 mb-2">★ {t("Negativne")}</p>
            <div className="space-y-1">
              {negativne.length === 0 && <p className="text-xs text-muted-foreground italic">{t("Nema kategorija")}</p>}
              {negativne.map(k => (
                <div key={k.id} className="flex items-center justify-between bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5">
                  <span className="text-sm font-medium">★ {k.naziv}</span>
                  <button onClick={() => obrisi(k.id)} className="text-red-400 hover:text-red-600 ml-2"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Forma za dodavanje */}
      <div className="flex gap-2 flex-wrap border-t border-border/30 pt-3">
        <select
          value={novaTip}
          onChange={e => setNovaTip(e.target.value as "pozitivna"|"negativna")}
          className="border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="pozitivna">⭐ {t("Pozitivna")}</option>
          <option value="negativna">★ {t("Negativna")}</option>
        </select>
        <input
          type="text"
          value={novaNaziv}
          onChange={e => setNovaNaziv(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !saving) dodaj(); }}
          placeholder={t("npr. Iskren, Pomaže drugima...")}
          className="flex-1 min-w-[180px] border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button onClick={dodaj} disabled={saving || !novaNaziv.trim()} className="rounded-xl font-bold flex items-center gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("Dodaj")}
        </Button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<"muallimi" | "korisnici" | "analitika" | "rezultati" | "statistika">(() => {
    if (typeof window === "undefined") return "muallimi";
    const saved = window.sessionStorage.getItem("admin-active-tab");
    return saved === "korisnici" || saved === "analitika" || saved === "rezultati" || saved === "statistika" ? saved : "muallimi";
  });
  const [statSadrzaja, setStatSadrzaja] = useState<{ lekcije: any[]; prilozi: any[]; kvizovi: any[] }>({ lekcije: [], prilozi: [], kvizovi: [] });
  const [statLoading, setStatLoading] = useState(false);
  const [statSubTab, setStatSubTab] = useState<"lekcije" | "prilozi" | "kvizovi">("lekcije");
  const [statSort, setStatSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "zavrseno", dir: "desc" });
  // Preduvjeti modal (admin panel → Lekcije tab)
  const [preduvjetiRow, setPreduvjetiRow] = useState<any | null>(null);
  const [preduvjetiDraft, setPreduvjetiDraft] = useState<number[]>([]);
  const [savingPreduvjeti, setSavingPreduvjeti] = useState(false);
  const [allLekcijeListaAdmin, setAllLekcijeListaAdmin] = useState<{ id: number; nivo: number; naslov: string; redoslijed: number }[]>([]);
  const [loadingListaAdmin, setLoadingListaAdmin] = useState(false);

  const otvoriPreduvjetiAdmin = async (row: any) => {
    setPreduvjetiRow(row);
    setPreduvjetiDraft(Array.isArray(row.uvjeti_ids) ? row.uvjeti_ids : []);
    if (allLekcijeListaAdmin.length === 0) {
      setLoadingListaAdmin(true);
      try {
        const data = await apiRequest<{ id: number; nivo: number; naslov: string; redoslijed: number }[]>(
          "GET", "/admin/ilmihal/lista", undefined, token,
        );
        setAllLekcijeListaAdmin(data);
      } catch {
        toast({ title: t("Greška"), description: t("Ne mogu učitati listu lekcija."), variant: "destructive" });
      } finally {
        setLoadingListaAdmin(false);
      }
    }
  };

  const handleSavePreduvjetiAdmin = async () => {
    if (!preduvjetiRow || !token) return;
    setSavingPreduvjeti(true);
    try {
      await apiRequest("PUT", `/admin/ilmihal/${preduvjetiRow.id}`, { uvjetiIds: preduvjetiDraft }, token);
      setStatSadrzaja((prev) => ({
        ...prev,
        lekcije: prev.lekcije.map((l) =>
          l.id === preduvjetiRow.id ? { ...l, uvjeti_ids: preduvjetiDraft } : l,
        ),
      }));
      toast({
        title: t("Preduvjeti ažurirani"),
        description: preduvjetiDraft.length > 0
          ? t("{n} preduvjet(a) postavljeno.", { n: String(preduvjetiDraft.length) })
          : t("Lekcija nema preduvjeta."),
      });
      setPreduvjetiRow(null);
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Ne mogu spasiti preduvjete."), variant: "destructive" });
    } finally {
      setSavingPreduvjeti(false);
    }
  };

  const togglePreduvjetAdmin = (id: number) => {
    setPreduvjetiDraft((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) {
        toast({ title: t("Maksimum 6 preduvjeta"), variant: "destructive" });
        return prev;
      }
      return [...prev, id];
    });
  };

  const loadStatistikaSadrzaja = async () => {
    setStatLoading(true);
    try {
      const data = await apiRequest<{ lekcije: any[]; prilozi: any[]; kvizovi: any[] }>("GET", "/admin/statistika-sadrzaja", undefined, token);
      setStatSadrzaja(data);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err.message, variant: "destructive" });
    } finally {
      setStatLoading(false);
    }
  };
  const [activeMainTab, setActiveMainTab] = useState<"korisnici" | "sistemski">(() => {
    if (typeof window === "undefined") return "korisnici";
    return window.sessionStorage.getItem("admin-main-tab") === "sistemski" ? "sistemski" : "korisnici";
  });
  const [statistike, setStatistike] = useState<Statistike | null>(null);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("30d");
  const [online, setOnline] = useState<OnlineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showDodajMuallim, setShowDodajMuallim] = useState(false);
  const [showDodajAdmina, setShowDodajAdmina] = useState(false);
  const [showDodajUcnika, setShowDodajUcnika] = useState(false);
  const [showDodajMenu, setShowDodajMenu] = useState(false);
  const [kvizStatistike, setKvizStatistike] = useState<KvizStatistika[]>([]);
  const [kvizLoading, setKvizLoading] = useState(false);
  const [resetKorisnik, setResetKorisnik] = useState<Korisnik | null>(null);
  const [editKorisnik, setEditKorisnik] = useState<Korisnik | null>(null);
  const [muallimProfili, setMuallimProfili] = useState<MuallimProfil[]>([]);
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "displayName" ? "asc" : "desc");
    }
  };

  const [muallimPregled, setMuallimPregled] = useState<MuallimPregled[]>([]);
  const [muallimLoading, setMuallimLoading] = useState(false);
  const [expandedMuallim, setExpandedMuallim] = useState<number | null>(null);
  const [muallimSearch, setMuallimSearch] = useState("");
  const [muallimSort, setMuallimSort] = useState<"prezime" | "datum">("prezime");
  const muallimiPrikaz = pripremiMuallime(muallimPregled, muallimSearch, muallimSort);

  const [rasporediKorisnik, setRasporediKorisnik] = useState<Korisnik | null>(null);
  const [mektebiOpcije, setMektebiOpcije] = useState<MektebOpcija[]>([]);
  const [muallimAkcija, setMuallimAkcija] = useState<number | null>(null);
  const [noviDzematZa, setNoviDzematZa] = useState<number | null>(null);
  const [noviDzematNaziv, setNoviDzematNaziv] = useState("");
  const [noviDzematGrad, setNoviDzematGrad] = useState("");
  const [grupeAll, setGrupeAll] = useState<GrupaAll[]>([]);
  const [deleteKorisnik, setDeleteKorisnik] = useState<Korisnik | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = async () => {
    if (!token) return;
    try {
      const [stat, kor, mp] = await Promise.all([
        apiRequest<Statistike>("GET", "/admin/statistike", undefined, token),
        apiRequest<Korisnik[]>("GET", "/admin/korisnici", undefined, token),
        apiRequest<MuallimProfil[]>("GET", "/admin/muallim-profili", undefined, token).catch(() => []),
      ]);
      setStatistike(stat);
      setKorisnici(kor);
      setMuallimProfili(mp);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati podatke"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMuallimPregled = async () => {
    if (!token) return;
    setMuallimLoading(true);
    try {
      const data = await apiRequest<MuallimPregled[]>("GET", "/admin/muallim-pregled", undefined, token);
      setMuallimPregled(data);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće učitati pregled muallima"), variant: "destructive" });
    } finally {
      setMuallimLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!token) return;
    setAnalyticsLoading(true);
    try {
      const data = await apiRequest<AnalyticsData>("GET", `/admin/analytics?period=${analyticsPeriod}`, undefined, token);
      setAnalytics(data);
    } catch {
      toast({ title: t("Greška"), description: t("Analitika nedostupna"), variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadOnline = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<OnlineData>("GET", "/admin/online", undefined, token);
      setOnline(data);
    } catch {}
  };

  const loadKvizStatistike = async () => {
    if (!token || kvizStatistike.length > 0) return;
    setKvizLoading(true);
    try {
      const data = await apiRequest<KvizStatistika[]>("GET", "/admin/kviz-statistike", undefined, token);
      setKvizStatistike(data);
    } catch {} finally {
      setKvizLoading(false);
    }
  };

  const loadGrupeAll = async () => {
    if (!token || grupeAll.length > 0) return;
    try {
      const data = await apiRequest<GrupaAll[]>("GET", "/admin/grupe-all", undefined, token);
      setGrupeAll(data);
    } catch {}
  };

  const loadMektebiOpcije = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<MektebOpcija[]>("GET", "/admin/mektebi", undefined, token);
      setMektebiOpcije(data);
    } catch {}
  };

  const dodijeliMekteb = async (userId: number, mektebId: number | null) => {
    if (!token) return;
    setMuallimAkcija(userId);
    try {
      await apiRequest("PUT", `/admin/muallim/${userId}/mekteb`, { mektebId }, token);
      toast({ title: t("Sačuvano"), description: t("Džemat ažuriran") });
      await loadMuallimPregled();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće promijeniti džemat"), variant: "destructive" });
    } finally {
      setMuallimAkcija(null);
    }
  };

  const postaviGlavni = async (userId: number, isGlavni: boolean) => {
    if (!token) return;
    setMuallimAkcija(userId);
    try {
      await apiRequest("PUT", `/admin/muallim/${userId}/glavni`, { isGlavni }, token);
      toast({ title: t("Sačuvano"), description: isGlavni ? t("Postavljen kao glavni muallim") : t("Skinut status glavnog") });
      await loadMuallimPregled();
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće promijeniti status"), variant: "destructive" });
    } finally {
      setMuallimAkcija(null);
    }
  };

  const postaviDozvoljeno = async (mektebId: number, dozvoljenoMuallima: number) => {
    if (!token) return;
    setMuallimAkcija(mektebId);
    try {
      await apiRequest("PUT", `/admin/mekteb/${mektebId}/dozvoljeno-muallima`, { dozvoljenoMuallima }, token);
      toast({ title: t("Sačuvano"), description: t("Dozvoljeno muallima: {n}", { n: String(dozvoljenoMuallima) }) });
      await loadMuallimPregled();
    } catch (e: any) {
      toast({ title: t("Greška"), description: e?.message || t("Nije moguće promijeniti limit"), variant: "destructive" });
    } finally {
      setMuallimAkcija(null);
    }
  };

  const kreirajIDodijeliDzemat = async (userId: number) => {
    if (!token) return;
    const naziv = noviDzematNaziv.trim();
    if (!naziv) { toast({ title: t("Greška"), description: t("Unesite naziv džemata"), variant: "destructive" }); return; }
    setMuallimAkcija(userId);
    try {
      const novi = await apiRequest<{ id: number }>("POST", "/admin/mektebi", { naziv, grad: noviDzematGrad.trim() || null }, token);
      await apiRequest("PUT", `/admin/muallim/${userId}/mekteb`, { mektebId: novi.id }, token);
      toast({ title: t("Sačuvano"), description: t('Džemat "{naziv}" kreiran i dodijeljen', { naziv }) });
      setNoviDzematZa(null); setNoviDzematNaziv(""); setNoviDzematGrad("");
      await Promise.all([loadMuallimPregled(), loadMektebiOpcije()]);
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće kreirati džemat"), variant: "destructive" });
    } finally {
      setMuallimAkcija(null);
    }
  };

  useEffect(() => { loadData(); loadMuallimPregled(); loadGrupeAll(); loadMektebiOpcije(); }, [token]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("admin-main-tab", activeMainTab);
      window.sessionStorage.setItem("admin-active-tab", activeTab);
    }
  }, [activeMainTab, activeTab]);
  useEffect(() => { if (activeTab === "analitika") loadAnalytics(); }, [activeTab, analyticsPeriod]);
  useEffect(() => {
    if (activeMainTab !== "korisnici" || activeTab !== "analitika") return;
    loadOnline();
    const id = setInterval(loadOnline, 30000);
    return () => clearInterval(id);
  }, [activeMainTab, activeTab, token]);
  useEffect(() => { if (activeTab === "rezultati") loadKvizStatistike(); }, [activeTab]);
  useEffect(() => { if (activeTab === "statistika") loadStatistikaSadrzaja(); }, [activeTab]);

  if (!user || user.role !== "admin") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">{t("Pristup dozvoljen samo adminima")}</p>
          <Button className="mt-4" onClick={() => goBackOr(() => setLocation("/"))}>{t("Nazad")}</Button>
        </div>
      </Layout>
    );
  }

  const handleDeleteKorisnik = async (k: Korisnik) => {
    if (!token) return;
    setDeletingId(k.id);
    try {
      await apiRequest("DELETE", `/admin/korisnik/${k.id}`, undefined, token);
      setKorisnici(prev => prev.filter(u => u.id !== k.id));
      setDeleteKorisnik(null);
      toast({ title: t('Korisnik "{ime}" je obrisan', { ime: k.displayName }) });
      if (k.role === "muallim") loadMuallimPregled();
    } catch (e: any) {
      toast({
        title: t("Greška pri brisanju korisnika"),
        description: e?.message || t("Nepoznata greška"),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (k: Korisnik) => {
    setTogglingId(k.id);
    try {
      await apiRequest("PUT", `/admin/korisnici/${k.id}`, { isActive: !k.isActive }, token!);
      setKorisnici(prev => prev.map(u => u.id === k.id ? { ...u, isActive: !u.isActive } : u));
      if (k.role === "muallim") loadMuallimPregled();
    } catch {
      toast({ title: t("Greška"), description: t("Nije moguće promijeniti status"), variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const filtrirani = korisnici
    .filter(k => filterRole === "all" || k.role === filterRole)
    .filter(k =>
      !searchQuery ||
      k.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "displayName") {
        return a.displayName.localeCompare(b.displayName, "bs") * dir;
      }
      if (sortField === "totalScreentimeSec") {
        return ((a.totalScreentimeSec ?? 0) - (b.totalScreentimeSec ?? 0)) * dir;
      }
      const dateA = sortField === "lastLoginAt" ? a.lastLoginAt : a.createdAt;
      const dateB = sortField === "lastLoginAt" ? b.lastLoginAt : b.createdAt;
      const ta = dateA ? new Date(dateA).getTime() : 0;
      const tb = dateB ? new Date(dateB).getTime() : 0;
      return (ta - tb) * dir;
    });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-foreground">{t("Admin panel")}</h1>
            <p className="text-muted-foreground text-sm">{t("Pregled platforme i upravljanje korisnicima")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl inline-flex items-center gap-2"
            onClick={() => setLocation("/muallim/h5p-uputstvo")}
          >
            <BookOpen className="w-4 h-4" /> {t("H5P uputstvo")}
          </Button>
        </div>

        <div className="bg-white border border-border/50 rounded-2xl px-5 py-1 mb-6 max-w-xl">
          <SelamSetting />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : statistike && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users className="w-6 h-6 text-teal-700" />} label={t("Ukupno korisnika")} value={statistike.ukupnoKorisnika} color="bg-teal-100" />
            <StatCard icon={<ShieldCheck className="w-6 h-6 text-amber-700" />} label={t("Muallima")} value={statistike.korisnici.muallim || 0} color="bg-amber-100" />
            <StatCard icon={<Users className="w-6 h-6 text-blue-700" />} label={t("Učenika")} value={statistike.korisnici.ucenik || 0} color="bg-blue-100" />
            <StatCard icon={<Building2 className="w-6 h-6 text-purple-700" />} label={t("Roditelja")} value={statistike.korisnici.roditelj || 0} color="bg-purple-100" />
          </div>
        )}

        <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl mb-6">
          {[
            { key: "korisnici" as const, label: t("Korisnici"), icon: <Users className="w-4 h-4" /> },
            { key: "sistemski" as const, label: t("Sistemski alati"), icon: <ShieldCheck className="w-4 h-4" /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveMainTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeMainTab === tab.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeMainTab === "korisnici" && (
          <div className="flex gap-1 bg-muted/30 p-1 rounded-xl mb-5 overflow-x-auto">
            {[
              { key: "muallimi" as const, label: t("Muallimi"), icon: <UserCog className="w-4 h-4" /> },
              { key: "korisnici" as const, label: t("Korisnici"), icon: <Users className="w-4 h-4" /> },
              { key: "analitika" as const, label: t("Analitika"), icon: <BarChart3 className="w-4 h-4" /> },
              { key: "rezultati" as const, label: t("Kviz rezultati"), icon: <ClipboardList className="w-4 h-4" /> },
              { key: "statistika" as const, label: t("Statistika sadržaja"), icon: <BarChart3 className="w-4 h-4" /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {activeMainTab === "korisnici" && (<>
        {/* ── TAB: MUALLIMI ── */}
        {activeTab === "muallimi" && (
          <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-foreground flex items-center gap-2">
                    <UserCog className="w-5 h-5 text-primary" /> {t("Pregled muallima")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{t("Muallimi, njihovi džemati, grupe i broj učenika")}</p>
                </div>
                <Button size="sm" onClick={() => { setShowDodajMuallim(true); }} className="rounded-xl flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t("Dodaj muallima")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  placeholder={t("Pretraži po imenu ili džematu...")}
                  value={muallimSearch}
                  onChange={e => setMuallimSearch(e.target.value)}
                  className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 flex-1 min-w-[200px]"
                />
                <span className="text-xs text-muted-foreground">{t("Poredaj:")}</span>
                <select value={muallimSort} onChange={e => setMuallimSort(e.target.value as "prezime" | "datum")}
                  className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="prezime">{t("Po prezimenu")}</option>
                  <option value="datum">{t("Po datumu registracije")}</option>
                </select>
              </div>
            </div>
            {muallimLoading ? (
              <div className="p-4 flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : muallimiPrikaz.length > 0 ? (
              <div>
                {muallimiPrikaz.map(m => (
                  <div key={m.id} className="border-b border-border/20 last:border-b-0">
                    <button
                      onClick={() => setExpandedMuallim(expandedMuallim === m.id ? null : m.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.isActive ? "bg-teal-100" : "bg-red-100"}`}>
                          <UserCog className={`w-5 h-5 ${m.isActive ? "text-teal-700" : "text-red-700"}`} />
                        </div>
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-2">
                            {m.displayName}
                            {m.isGlavni && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{t("Glavni")}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground/70">
                              <Building2 className="w-3 h-3" />
                              {m.mektebNaziv ? `${m.mektebNaziv}${m.mektebGrad ? `, ${m.mektebGrad}` : ""}` : t("Bez džemata")}
                            </span>
                            <span>· {m.email || m.username} · {m.brojGrupa} {t("grupa")} · {m.aktivniUcenici}/{m.brojUcenika} {t("učenika")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {m.isActive ? t("Aktivan") : t("Neaktivan")}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedMuallim === m.id ? "rotate-90" : ""}`} />
                      </div>
                    </button>
                    {expandedMuallim === m.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="px-4 pb-4">
                        {/* Admin kontrole: džemat, glavni, dozvoljeni broj muallima */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3 flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{t("Džemat")}</label>
                              <div className="flex items-center gap-2">
                                <select
                                  value={m.mektebId ?? ""}
                                  disabled={muallimAkcija === m.id}
                                  onChange={e => dodijeliMekteb(m.id, e.target.value === "" ? null : parseInt(e.target.value))}
                                  className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[200px]"
                                >
                                  <option value="">{t("Bez džemata")}</option>
                                  {mektebiOpcije.map(o => (
                                    <option key={o.id} value={o.id}>{o.naziv}{o.grad ? `, ${o.grad}` : ""}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => { setNoviDzematZa(noviDzematZa === m.id ? null : m.id); setNoviDzematNaziv(""); setNoviDzematGrad(""); }}
                                  className="text-xs font-bold text-primary hover:underline whitespace-nowrap"
                                >
                                  {noviDzematZa === m.id ? t("Otkaži") : t("+ Novi džemat")}
                                </button>
                              </div>
                              {noviDzematZa === m.id && (
                                <div className="flex flex-wrap items-center gap-2 mt-1 bg-white border border-border rounded-lg p-2">
                                  <input
                                    type="text" placeholder={t("Naziv džemata")}
                                    value={noviDzematNaziv}
                                    onChange={e => setNoviDzematNaziv(e.target.value)}
                                    className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[180px]"
                                  />
                                  <input
                                    type="text" placeholder={t("Grad (opcionalno)")}
                                    value={noviDzematGrad}
                                    onChange={e => setNoviDzematGrad(e.target.value)}
                                    className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[140px]"
                                  />
                                  <button
                                    type="button"
                                    disabled={muallimAkcija === m.id || !noviDzematNaziv.trim()}
                                    onClick={() => kreirajIDodijeliDzemat(m.id)}
                                    className="px-3 py-1.5 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    {t("Kreiraj i dodijeli")}
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{t("Glavni muallim")}</label>
                              <button
                                disabled={muallimAkcija === m.id || !m.mektebId}
                                onClick={() => postaviGlavni(m.id, !m.isGlavni)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${m.isGlavni ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-muted text-foreground hover:bg-muted/70"}`}
                                title={!m.mektebId ? t("Muallim prvo mora imati džemat") : undefined}
                              >
                                {m.isGlavni ? t("Skini status glavnog") : t("Postavi za glavnog")}
                              </button>
                            </div>
                            {m.mektebId && (
                              <div className="flex flex-col gap-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{t("Dozvoljeno muallima u džematu")}</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number" min={1} max={99}
                                    defaultValue={m.dozvoljenoMuallima ?? 1}
                                    disabled={muallimAkcija === m.mektebId}
                                    id={`dozv-${m.mektebId}`}
                                    className="border border-border rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                  />
                                  <button
                                    disabled={muallimAkcija === m.mektebId}
                                    onClick={() => {
                                      const el = document.getElementById(`dozv-${m.mektebId}`) as HTMLInputElement | null;
                                      const val = parseInt(el?.value || "");
                                      if (val && m.mektebId) postaviDozvoljeno(m.mektebId, val);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    {t("Sačuvaj")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {t("Glavni muallim može sam dodavati kolege u svoj džemat do dozvoljenog broja.")}
                          </p>
                        </div>
                        {m.grupe.length > 0 ? (
                          <div className="bg-muted/30 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/30 bg-muted/50">
                                  {[t("Grupa"), t("Šk. godina"), t("Aktivni učenici"), t("Ukupno učenika"), t("Status")].map(h => (
                                    <th key={h} className="text-left px-4 py-2 font-bold text-xs text-muted-foreground">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {m.grupe.map(g => (
                                  <tr key={g.id} className="border-b border-border/20 last:border-b-0">
                                    <td className="px-4 py-2.5 font-bold text-foreground">{g.naziv}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground">{g.skolskaGodina}</td>
                                    <td className="px-4 py-2.5 font-bold text-emerald-600">{g.aktivniUcenika}</td>
                                    <td className="px-4 py-2.5 font-bold text-foreground">{g.brojUcenika}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                                        {g.isActive ? t("Aktivna") : t("Neaktivna")}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-3 text-center">{t("Nema grupa")}</p>
                        )}
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Nema muallima</div>
            )}
          </div>
        )}

        {/* ── TAB: ANALITIKA ── */}
        {activeTab === "analitika" && (
          <div className="space-y-6">
            {/* Trenutno online */}
            <div className="bg-white border border-border/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-extrabold text-foreground flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                  {t("Trenutno online")}
                </h3>
                <span className="text-xs text-muted-foreground">{t("Aktivni u zadnjih 5 min · osvježava se svakih 30 s")}</span>
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-extrabold text-green-600">{online?.ukupno ?? 0}</span>
                <span className="text-muted-foreground text-sm">{(() => {
                  const n = online?.ukupno ?? 0;
                  const mod10 = n % 10, mod100 = n % 100;
                  const rijec = (mod10 === 1 && mod100 !== 11) ? t("osoba") : (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) ? t("osobe") : t("osoba");
                  return t("{rijec} online", { rijec });
                })()}</span>
              </div>
              {online && online.poLokaciji.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {online.poLokaciji.map((l, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        <Globe className="w-4 h-4 inline-block mr-1.5 text-purple-500 align-text-bottom" />
                        {l.city && l.city !== "Unknown" ? `${l.city}, ` : ""}{l.country || t("Nepoznato")}
                      </span>
                      <span className="text-sm font-extrabold text-foreground ml-2">{l.broj}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm py-2">{t("Trenutno nema aktivnih posjetilaca.")}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-muted-foreground mr-1">{t("Period:")}</span>
              {(["danas", "7d", "30d"] as AnalyticsPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setAnalyticsPeriod(p)}
                  className={`text-sm font-bold px-3.5 py-1.5 rounded-full border transition-colors ${
                    analyticsPeriod === p
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-white text-foreground border-border/60 hover:bg-muted/50"
                  }`}
                >
                  {t(PERIOD_LABELS[p])}
                </button>
              ))}
            </div>

            {analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
              </div>
            ) : analytics ? (
              <>
                {analytics.kpi && (() => {
                  const kartice = [
                    { naslov: t("Prijavljeni korisnici"), vrijednost: analytics.kpi.aktivniKorisnici, icon: Users, boja: "text-teal-600" },
                    { naslov: t("Učenici koji su učili"), vrijednost: analytics.kpi.uceniciUce, icon: BookOpen, boja: "text-blue-600" },
                    { naslov: t("Završene lekcije"), vrijednost: analytics.kpi.zavrseneLekcije, icon: Award, boja: "text-indigo-600" },
                    { naslov: t("Pokušaji kviza"), vrijednost: analytics.kpi.kvizovi, icon: ClipboardList, boja: "text-amber-600" },
                  ];
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {kartice.map(k => {
                        const Icon = k.icon;
                        return (
                          <div key={k.naslov} className="bg-white border border-border/50 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-muted-foreground">{k.naslov}</span>
                              <Icon className={`w-4 h-4 ${k.boja}`} />
                            </div>
                            <div className="text-2xl font-extrabold text-foreground">{k.vrijednost.toLocaleString("bs")}</div>
                            <div className="text-xs font-medium mt-1 text-muted-foreground">{t("u odabranom periodu")}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <ClipboardList className="w-5 h-5 text-teal-600" /> {t("Pokušaji kviza ({period})", { period: t(PERIOD_LABELS[analyticsPeriod]).toLowerCase() })}
                    </h3>
                    {analytics.kvizoviPoPeriodu.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={analytics.kvizoviPoPeriodu}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="datum" tick={{ fontSize: 10 }} tickFormatter={d => d.length > 5 ? d.slice(5) : d} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip labelFormatter={l => t("Datum: {l}", { l: String(l) })} />
                          <Line type="monotone" dataKey="broj" stroke="#0d9488" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">{t("Nema pokušaja kviza u ovom periodu")}</p>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-blue-600" /> {t("Nove registracije ({period})", { period: t(PERIOD_LABELS[analyticsPeriod]).toLowerCase() })}
                    </h3>
                    {analytics.registracijePoMjesecu.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.registracijePoMjesecu}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="datum" tick={{ fontSize: 10 }} tickFormatter={d => d.length > 5 ? d.slice(5) : d} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip labelFormatter={l => t("Datum: {l}", { l: String(l) })} />
                          <Bar dataKey="broj" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">{t("Nema registracija")}</p>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-rose-600" /> {t("Najaktivnije lekcije")}
                    </h3>
                    {analytics.najaktivnijeLekcije.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.najaktivnijeLekcije.map(lekcija => {
                          const max = analytics.najaktivnijeLekcije[0].ucenici || 1;
                          return (
                            <div key={lekcija.id}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium text-foreground truncate mr-2" title={lekcija.naslov}>
                                  <span className="text-xs text-muted-foreground mr-1">N{lekcija.nivo}</span>{lekcija.naslov}
                                </span>
                                <span className="font-extrabold text-foreground shrink-0">{lekcija.ucenici} {t("učenika")}</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.max(4, (lekcija.ucenici / max) * 100)}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">{t("Nema aktivnosti na lekcijama u ovom periodu")}</p>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <Award className="w-5 h-5 text-emerald-600" /> {t("Najaktivniji kvizovi")}
                    </h3>
                    {analytics.najaktivnijiKvizovi.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.najaktivnijiKvizovi.map(kviz => (
                          <div key={kviz.id} className="flex items-center justify-between gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-foreground truncate">{kviz.naslov}</p>
                              <p className="text-xs text-muted-foreground">
                                {kviz.ucenici} {t("učenika")} · {kviz.pokusaji} {t("pokušaja")} · {kviz.prosjecniProcenat}% {t("prosječno")}
                              </p>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                              {kviz.pokusaji}×
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">{t("Nema pokušaja kviza u ovom periodu")}</p>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-border/50">
                    <h3 className="font-extrabold text-foreground">{t("Pregled korisnika po ulogama")}</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        {[t("Uloga"), t("Aktivni"), t("Neaktivni"), t("Ukupno")].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.korisnikStats.map(s => (
                        <tr key={s.role} className="border-b border-border/20">
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[s.role] || "bg-gray-100 text-gray-700"}`}>
                              {ROLE_LABELS[s.role] || s.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{s.aktivni}</td>
                          <td className="px-4 py-3 font-bold text-red-500">{s.neaktivni}</td>
                          <td className="px-4 py-3 font-bold text-foreground">{s.aktivni + s.neaktivni}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bg-white border border-border/50 rounded-2xl p-8 text-center text-muted-foreground">
                {t("Nije moguće učitati analitiku")}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: KVIZ REZULTATI ── */}
        {activeTab === "rezultati" && (
          <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-extrabold text-foreground flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> {t("Pregled kvizova")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">{t("Statistika svih kvizova — koliko puta su rađeni i prosječna tačnost")}</p>
            </div>
            {kvizLoading ? (
              <div className="p-4 flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : kvizStatistike.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      {[t("Naziv kviza"), t("Kategorija"), t("Pokušaji"), t("Prosj. tačnost"), t("Najviši %"), t("Najniži %"), ""].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kvizStatistike.map(k => (
                      <tr key={k.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{k.naslov}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{k.kategorija}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-extrabold text-foreground">{k.pokusaji}</span>
                          <span className="text-xs text-muted-foreground ml-1">{t("puta")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {k.pokusaji > 0 ? (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${k.prosjecniProcenat >= 80 ? "bg-emerald-100 text-emerald-700" : k.prosjecniProcenat >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {k.prosjecniProcenat}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{k.pokusaji > 0 ? `${k.najvisiBodovi}%` : "—"}</td>
                        <td className="px-4 py-3 font-bold text-red-500">{k.pokusaji > 0 ? `${k.najniziBodovi}%` : "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setLocation(`/admin/kviz/${k.id}`)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition flex items-center gap-1"
                            title={t("Uredi kviz")}
                          >
                            <Pencil className="w-3 h-3" /> {t("Uredi")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">{t("Nema kvizova")}</div>
            )}
          </div>
        )}


        {/* ── TAB: STATISTIKA SADRŽAJA ── */}
        {activeTab === "statistika" && (
          <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <h2 className="font-extrabold text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> {t("Statistika sadržaja")}
              </h2>
              <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
                {([
                  { k: "lekcije" as const, l: t("Lekcije ({n})", { n: String(statSadrzaja.lekcije.length) }) },
                  { k: "prilozi" as const, l: t("Materijali ({n})", { n: String(statSadrzaja.prilozi.length) }) },
                  { k: "kvizovi" as const, l: t("Kvizovi ({n})", { n: String(statSadrzaja.kvizovi.length) }) },
                ]).map(t => (
                  <button key={t.k} onClick={() => setStatSubTab(t.k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statSubTab === t.k ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            {statLoading ? (
              <div className="p-4 flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                {(() => {
                  const rows = statSadrzaja[statSubTab] ?? [];
                  const sorted = rows.slice().sort((a: any, b: any) => {
                    const dir = statSort.dir === "asc" ? 1 : -1;
                    const av = a[statSort.field], bv = b[statSort.field];
                    if (typeof av === "string") return String(av).localeCompare(String(bv), "bs") * dir;
                    return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
                  });
                  const toggle = (f: string) => setStatSort(s => s.field === f ? { field: f, dir: s.dir === "asc" ? "desc" : "asc" } : { field: f, dir: f === "naslov" || f === "naziv" ? "asc" : "desc" });
                  const arrow = (f: string) => statSort.field === f ? (statSort.dir === "asc" ? " ↑" : " ↓") : " ⇅";
                  const SortBtn = ({ f, label }: { f: string; label: string }) => (
                    <button type="button" onClick={() => toggle(f)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      {label}{arrow(f)}
                    </button>
                  );
                  if (statSubTab === "lekcije") {
                    return (
                      <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/40 bg-muted/30">
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="naslov" label={t("Lekcija")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="nivo" label={t("Nivo")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground">{t("Preduvjeti")}</th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="zavrseno" label={t("Završili")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="avg_ocjena" label={t("Prosj. ocjena")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="broj_ocjena" label={t("Br. ocjena")} /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((r: any) => {
                            const uvjetiCount = Array.isArray(r.uvjeti_ids) ? r.uvjeti_ids.length : 0;
                            return (
                            <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20">
                              <td className="px-4 py-3 font-bold text-foreground">
                                <a href={`/ilmihal/${r.slug}`} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 hover:text-primary hover:underline transition-colors">
                                  {r.naslov}
                                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-60 flex-shrink-0" />
                                </a>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">N{r.nivo ?? "-"}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => otvoriPreduvjetiAdmin(r)}
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${uvjetiCount > 0 ? "bg-orange-100 text-orange-700 hover:bg-orange-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                  title={t("Uredi preduvjete ove lekcije")}>
                                  <Lock className="w-3 h-3" />
                                  {uvjetiCount > 0 ? uvjetiCount : "—"}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm tabular-nums">{r.zavrseno}</td>
                              <td className="px-4 py-3 text-sm tabular-nums">{r.broj_ocjena > 0 ? `${Number(r.avg_ocjena).toFixed(2)} 🐝` : "—"}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{r.broj_ocjena}</td>
                            </tr>
                            );
                          })}
                          {sorted.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("Nema podataka")}</td></tr>}
                        </tbody>
                      </table>
                      {/* Preduvjeti modal (admin panel) */}
                      {preduvjetiRow && (
                        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                          onClick={() => !savingPreduvjeti && setPreduvjetiRow(null)}>
                          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <h3 className="font-extrabold text-base mb-1">{t("Preduvjeti lekcije")}</h3>
                            <p className="text-xs text-muted-foreground mb-1 font-semibold">{preduvjetiRow.naslov}</p>
                            <p className="text-xs text-muted-foreground mb-3">
                              {t("Odaberi lekcije koje učenik mora završiti da bi ova postala dostupna. Maksimalno 6.")}
                            </p>
                            {preduvjetiDraft.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {preduvjetiDraft.map((id) => {
                                  const l = allLekcijeListaAdmin.find((x) => x.id === id);
                                  return (
                                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold">
                                      {l ? `N${l.nivo}/${l.redoslijed}. ${l.naslov.slice(0, 24)}` : `#${id}`}
                                      <button onClick={() => togglePreduvjetAdmin(id)} className="hover:text-red-600">×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border min-h-0 mb-4">
                              {loadingListaAdmin ? (
                                <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                              ) : (
                                [1, 2, 3].flatMap((nv) => {
                                  const nivoLekcije = allLekcijeListaAdmin.filter((l) => l.nivo === nv && l.id !== preduvjetiRow.id);
                                  if (nivoLekcije.length === 0) return [];
                                  return [
                                    <div key={`h-${nv}`} className="px-3 py-1.5 bg-gray-50 text-xs font-bold text-muted-foreground sticky top-0">
                                      {t("Nivo {nivo}", { nivo: String(nv) })}
                                    </div>,
                                    ...nivoLekcije.map((l) => {
                                      const isSelected = preduvjetiDraft.includes(l.id);
                                      const isDisabled = !isSelected && preduvjetiDraft.length >= 6;
                                      return (
                                        <button key={l.id} onClick={() => togglePreduvjetAdmin(l.id)} disabled={isDisabled}
                                          className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${isSelected ? "bg-orange-50" : isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"}`}>
                                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                                            {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                                          </div>
                                          <span className="text-sm"><span className="text-muted-foreground text-xs mr-1">{l.redoslijed}.</span>{l.naslov}</span>
                                        </button>
                                      );
                                    }),
                                  ];
                                })
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setPreduvjetiRow(null)} disabled={savingPreduvjeti}
                                className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                                {t("Odustani")}
                              </button>
                              <button onClick={handleSavePreduvjetiAdmin} disabled={savingPreduvjeti || loadingListaAdmin}
                                className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                                {savingPreduvjeti ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("Sačuvaj")}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      </>
                    );
                  }
                  if (statSubTab === "prilozi") {
                    return (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/40 bg-muted/30">
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="naziv" label={t("Materijal")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="lekcija_naslov" label={t("Lekcija")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="kind" label={t("Tip")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="zavrseno" label={t("Završili")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="avg_ocjena" label={t("Prosj. ocjena")} /></th>
                            <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="broj_ocjena" label={t("Br. ocjena")} /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((r: any) => (
                            <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20">
                              <td className="px-4 py-3 font-bold text-foreground">{r.naziv}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{r.lekcija_naslov ?? "—"}</td>
                              <td className="px-4 py-3 text-xs"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold">{r.kind}</span></td>
                              <td className="px-4 py-3 text-sm tabular-nums">{r.zavrseno}</td>
                              <td className="px-4 py-3 text-sm tabular-nums">{r.broj_ocjena > 0 ? `${Number(r.avg_ocjena).toFixed(2)} 🐝` : "—"}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{r.broj_ocjena}</td>
                            </tr>
                          ))}
                          {sorted.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("Nema podataka")}</td></tr>}
                        </tbody>
                      </table>
                    );
                  }
                  // kvizovi
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/40 bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="naslov" label={t("Kviz")} /></th>
                          <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="kategorija" label={t("Kategorija")} /></th>
                          <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="broj_pokusaja" label={t("Pokušaja")} /></th>
                          <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="prosjek_postotak" label={t("Prosjek %")} /></th>
                          <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="avg_ocjena" label={t("Prosj. ocjena")} /></th>
                          <th className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground"><SortBtn f="broj_ocjena" label={t("Br. ocjena")} /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r: any) => (
                          <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20">
                            <td className="px-4 py-3 font-bold text-foreground">{r.naslov}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{r.kategorija ?? "—"}</td>
                            <td className="px-4 py-3 text-sm tabular-nums">{r.broj_pokusaja}</td>
                            <td className="px-4 py-3 text-sm tabular-nums">{r.broj_pokusaja > 0 ? `${Number(r.prosjek_postotak).toFixed(0)}%` : "—"}</td>
                            <td className="px-4 py-3 text-sm tabular-nums">{r.broj_ocjena > 0 ? `${Number(r.avg_ocjena).toFixed(2)} 🐝` : "—"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{r.broj_ocjena}</td>
                          </tr>
                        ))}
                        {sorted.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("Nema podataka")}</td></tr>}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: KORISNICI ── */}
        {activeTab === "korisnici" && (
        <>
        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <h2 className="font-extrabold text-foreground">{t("Korisnici")}</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder={t("Pretraga...")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-40"
              />
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="all">{t("Svi")}</option>
                {["admin", "muallim", "roditelj", "ucenik"].map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <div className="relative">
                <Button size="sm" onClick={() => setShowDodajMenu(v => !v)} className="rounded-xl flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> {t("Dodaj")} <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                {showDodajMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-30 w-48 py-1">
                    {[
                      { label: t("Admina"), action: () => setShowDodajAdmina(true) },
                      { label: t("Muallima"), action: () => setShowDodajMuallim(true) },
                      { label: t("Učenika"), action: () => setShowDodajUcnika(true) },
                    ].map(item => (
                      <button key={item.label} onClick={() => { item.action(); setShowDodajMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="p-4 flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    {([
                      { label: t("Ime"), sort: "displayName" as SortField },
                      { label: t("Korisničko ime"), sort: null },
                      { label: t("Uloga"), sort: null },
                      { label: t("Status"), sort: null },
                      { label: t("Registrovan"), sort: "createdAt" as SortField },
                       { label: t("Zadnja prijava"), sort: "lastLoginAt" as SortField },
                      { label: t("Vrijeme na platformi"), sort: "totalScreentimeSec" as SortField },
                      { label: t("Akcije"), sort: null },
                    ]).map(h => (
                      <th key={h.label} className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground">
                        {h.sort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(h.sort as SortField)}
                            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            {h.label}
                            {sortField === h.sort ? (sortDir === "asc" ? " ↑" : " ↓") : " ⇅"}
                          </button>
                        ) : h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrirani.map(k => (
                    <tr key={k.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">{k.displayName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{k.username}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[k.role] || "bg-gray-100 text-gray-700"}`}>
                          {ROLE_LABELS[k.role] || k.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          if (k.isActive) {
                            return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t("Aktivan")}</span>;
                          }
                          const trialMs = k.trialUntil ? new Date(k.trialUntil).getTime() - Date.now() : 0;
                          if (trialMs > 0) {
                            const dana = Math.ceil(trialMs / (24 * 60 * 60 * 1000));
                            return (
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300"
                                title={`Probni period ističe: ${new Date(k.trialUntil!).toLocaleString("bs-BA")}`}
                              >
                                Probni — još {dana} {dana === 1 ? "dan" : "dana"}
                              </span>
                            );
                          }
                          return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Neaktivan</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString("bs-BA")}
                      </td>
                       <td
                         className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap"
                         title={k.lastLoginAt ? new Date(k.lastLoginAt).toLocaleString("bs-BA") : t("Korisnik se još nije prijavio")}
                       >
                         {k.lastLoginAt
                           ? new Date(k.lastLoginAt).toLocaleString("bs-BA", {
                               day: "2-digit",
                               month: "2-digit",
                               year: "numeric",
                               hour: "2-digit",
                               minute: "2-digit",
                             })
                           : t("Nikad")}
                       </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground" title={k.lastSeenAt ? `Posljednje viđen: ${new Date(k.lastSeenAt).toLocaleString("bs-BA")}` : "Nikad nije bio aktivan"}>
                        {formatScreentime(k.totalScreentimeSec)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleActive(k)} disabled={togglingId === k.id}
                            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title={k.isActive ? "Deaktiviraj" : "Aktiviraj"}>
                            {togglingId === k.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : k.isActive ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-red-500" />
                            )}
                          </button>
                          <button onClick={() => setEditKorisnik(k)}
                            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="Uredi korisnika">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setResetKorisnik(k)}
                            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="Promijeni lozinku">
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {k.role === "ucenik" && (
                            <button onClick={() => { setRasporediKorisnik(k); loadGrupeAll(); }}
                              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                              title="Rasporedi u grupu">
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}
                          {k.role !== "admin" && (
                            <button onClick={() => setDeleteKorisnik(k)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                              title={t("Obriši korisnika")}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrirani.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Nema korisnika</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}

        </>)}

        {activeMainTab === "sistemski" && (
          <Tabs defaultValue="sadrzaj" className="space-y-5">
            <TabsList className="w-full h-auto grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-muted/60 rounded-2xl">
              <TabsTrigger value="sadrzaj" data-testid="admin-system-tab-sadrzaj" className="rounded-xl py-3 gap-2 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4" /> Sadržaj
              </TabsTrigger>
              <TabsTrigger value="moderacija" data-testid="admin-system-tab-moderacija" className="rounded-xl py-3 gap-2 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4" /> Moderacija
              </TabsTrigger>
              <TabsTrigger value="igre" data-testid="admin-system-tab-igre" className="rounded-xl py-3 gap-2 text-xs sm:text-sm">
                <Gamepad2 className="w-4 h-4" /> Igre
              </TabsTrigger>
              <TabsTrigger value="odrzavanje" data-testid="admin-system-tab-odrzavanje" className="rounded-xl py-3 gap-2 text-xs sm:text-sm">
                <Wrench className="w-4 h-4" /> Održavanje
              </TabsTrigger>
              <TabsTrigger value="napamet" className="rounded-xl py-3 gap-2 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4" /> NAPAMET
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sadrzaj" data-testid="admin-system-content-sadrzaj" className="mt-0 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AdminToolCard icon={<BookOpen />} label="Rječnik pojmova" tone="teal" onClick={() => setLocation("/admin/rjecnik")} />
                <AdminToolCard icon={<ClipboardList />} label="Banka pitanja" tone="amber" onClick={() => setLocation("/admin/banka-pitanja")} />
                <AdminToolCard icon={<BookOpen />} label="Čitaonica — priče" tone="amber" onClick={() => setLocation("/admin/citaonica")} testId="button-admin-citaonica" />
                <AdminToolCard icon={<Plus />} label="Novi kviz" tone="orange" onClick={() => setLocation("/admin/kviz-novi")} />
                <AdminToolCard icon={<Wand2 />} label="AI uvoz kviza" tone="violet" onClick={() => setLocation("/admin/ai-import")} />
                <AdminToolCard icon={<BookOpen />} label="Slike bez lekcije" tone="amber" onClick={() => setLocation("/admin/orphan-uploads")} />
                <AdminToolCard icon={<Award />} label="Etape i krunisanja" tone="emerald" onClick={() => setLocation("/admin/etape")} testId="button-admin-etape" />
                <AdminToolCard icon={<Languages />} label="Uređivanje prijevoda" tone="sky" onClick={() => setLocation("/admin/prijevodi")} testId="button-admin-prijevodi" />
              </div>
            </TabsContent>

            <TabsContent value="napamet" className="mt-0">
              <NapametGlobalProgramEditor />
            </TabsContent>

            <TabsContent value="moderacija" data-testid="admin-system-content-moderacija" className="mt-0 space-y-5">
              <KategorijeZvjezdica token={token!} />
              <PendingPrilozi token={token!} />
            </TabsContent>

            <TabsContent value="igre" data-testid="admin-system-content-igre" className="mt-0">
              <IgraPitanjaEditor token={token!} />
            </TabsContent>

            <TabsContent value="odrzavanje" data-testid="admin-system-content-odrzavanje" className="mt-0 space-y-5">
              <SistemAlati token={token!} />
              <div className="bg-white border border-border/50 rounded-2xl p-5 flex items-start gap-3">
                <Database className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-bold text-foreground">Podaci i održavanje</h3>
                  <p className="text-sm text-muted-foreground mt-1">Demo podaci i administrativne radnje nad bazom nalaze se ovdje, odvojeno od sadržaja koji vide učenici.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {showDodajAdmina && (
        <DodajAdminaModal token={token!} onClose={() => setShowDodajAdmina(false)} onCreated={() => { loadData(); loadMuallimPregled(); }} />
      )}
      {showDodajMuallim && (
        <DodajMuallimModal token={token!} onClose={() => setShowDodajMuallim(false)} onCreated={() => { loadData(); loadMuallimPregled(); }} />
      )}
      {showDodajUcnika && (
        <DodajUcenikaModal token={token!} onClose={() => setShowDodajUcnika(false)} onCreated={() => { loadData(); loadMuallimPregled(); }} />
      )}
      {resetKorisnik && (
        <ResetPasswordModal token={token!} korisnik={resetKorisnik} onClose={() => setResetKorisnik(null)} />
      )}
      {editKorisnik && (
        <EditKorisnikModal
          token={token!}
          korisnik={editKorisnik}
          muallimProfil={muallimProfili.find(mp => mp.userId === editKorisnik.id)}
          onClose={() => setEditKorisnik(null)}
          onSaved={() => { loadData(); loadMuallimPregled(); }}
        />
      )}
      {rasporediKorisnik && (
        <RasporediModal
          token={token!}
          korisnik={rasporediKorisnik}
          grupeAll={grupeAll}
          onClose={() => setRasporediKorisnik(null)}
          onSaved={() => { loadData(); loadMuallimPregled(); }}
        />
      )}
      {deleteKorisnik && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteKorisnik(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-foreground mb-2">{t("Obriši korisnika?")}</h3>
            <p className="text-sm text-muted-foreground mb-1">
              {t("Jeste li sigurni da želite trajno obrisati korisnika:")}
            </p>
            <p className="font-bold text-foreground mb-4">{deleteKorisnik.displayName} ({deleteKorisnik.username})</p>
            <p className="text-xs text-red-600 mb-4">{t("Ova akcija je nepovratna. Svi podaci korisnika će biti obrisani.")}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setDeleteKorisnik(null)} className="flex-1 rounded-xl">{t("Otkaži")}</Button>
              <Button onClick={() => handleDeleteKorisnik(deleteKorisnik)} disabled={deletingId === deleteKorisnik.id}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white">
                {deletingId === deleteKorisnik.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("Obriši")}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
