import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  Users, Building2, ShieldCheck, BookOpen, LayoutDashboard,
  Plus, KeyRound, ToggleLeft, ToggleRight, Loader2, X, Check,
  BarChart3, Globe, TrendingUp, Award, ClipboardList, Pencil, ChevronDown,
  ChevronRight, UserCog, ArrowRightLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface AnalyticsData {
  registracijePoMjesecu: { datum: string; broj: number }[];
  posjetePoDrzavi: { country: string; broj: number }[];
  kvizRezultati: { kvizNaslov: string; pokusaji: number; prosjecniProcenat: number; prosjecniBodovi: number; najvisiBodovi: number }[];
  aktivnostPosmjenama: { datum: string; broj: number }[];
  korisnikStats: { role: string; aktivni: number; neaktivni: number }[];
  nedavniRezultati: { id: number; userId: number; kvizNaslov: string; tacniOdgovori: number; ukupnoPitanja: number; procenat: number; bodovi: number; completedAt: string; username: string; displayName: string }[];
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
  grupe: { id: number; naziv: string; skolskaGodina: string; isActive: boolean; brojUcenika: number; aktivniUcenika: number }[];
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

function DodajMuallimModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
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
      toast({ title: "Muallim kreiran!", description: `${form.displayName} (${form.username})` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Greška pri kreiranju", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">Dodaj muallima</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "displayName", label: "Ime i prezime", placeholder: "Npr. Amra Čolić" },
            { key: "username", label: "Korisničko ime", placeholder: "Npr. amra.colic" },
            { key: "password", label: "Lozinka", placeholder: "Min. 6 karaktera" },
            { key: "email", label: "E-mail (opciono)", placeholder: "muallim@mekteb.ba" },
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
            <label className="block text-xs font-bold text-muted-foreground mb-1">Broj licenci (učenika)</label>
            <input type="number" min="1" max="500" value={form.licenceCount}
              onChange={e => setForm(p => ({ ...p, licenceCount: e.target.value }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Odustani</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Dodaj
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DodajAdminaModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/admin", form, token);
      toast({ title: "Admin kreiran!", description: `${form.displayName} (${form.username})` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Greška pri kreiranju", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">Dodaj admina</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "displayName", label: "Ime i prezime", placeholder: "Npr. Amra Čolić" },
            { key: "username", label: "Korisničko ime", placeholder: "Npr. amra.colic" },
            { key: "password", label: "Lozinka", placeholder: "Min. 6 karaktera" },
            { key: "email", label: "E-mail (opciono)", placeholder: "admin@mekteb.ba" },
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Odustani</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Dodaj
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DodajUcenikaModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/ucenik", form, token);
      toast({ title: "Učenik kreiran!", description: `${form.displayName} (${form.username})` });
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Greška pri kreiranju", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">Dodaj učenika</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {[
            { key: "displayName", label: "Ime i prezime", placeholder: "Npr. Džana Begović" },
            { key: "username", label: "Korisničko ime", placeholder: "Npr. dzana.begovic" },
            { key: "password", label: "Lozinka", placeholder: "Min. 6 karaktera" },
            { key: "email", label: "E-mail (opciono)", placeholder: "ucenik@mekteb.ba" },
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Odustani</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Dodaj
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
}

function EditKorisnikModal({ token, korisnik, muallimProfil, onClose, onSaved }: {
  token: string; korisnik: Korisnik; muallimProfil?: MuallimProfil; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(korisnik.displayName);
  const [email, setEmail] = useState(korisnik.email || "");
  const [licenceCount, setLicenceCount] = useState(muallimProfil?.licenceCount?.toString() || "30");
  const [isLoading, setIsLoading] = useState(false);

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
      }

      toast({ title: "Korisnik ažuriran!", description: displayName });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Greška pri ažuriranju", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">Uredi korisnika</h3>
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
            <label className="block text-xs font-bold text-muted-foreground mb-1">Ime i prezime</label>
            <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opciono"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          {korisnik.role === "muallim" && muallimProfil && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-sm text-teal-800">Licence za učenike</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-teal-700 mb-1">Ukupno licenci</label>
                  <input type="number" min="1" max="999" value={licenceCount}
                    onChange={e => setLicenceCount(e.target.value)}
                    className="w-full border border-teal-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" />
                </div>
                <div className="text-center pt-5">
                  <div className="text-2xl font-black text-teal-700">{muallimProfil.licencesUsed}</div>
                  <div className="text-xs text-teal-600 font-medium">iskorišteno</div>
                </div>
              </div>
              <div className="text-xs text-teal-600">
                Preostalo: <span className="font-bold">{(parseInt(licenceCount) || 0) - (muallimProfil.licencesUsed || 0)}</span> licenci
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Odustani</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Sačuvaj
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ResetPasswordModal({ token, korisnik, onClose }: { token: string; korisnik: Korisnik; onClose: () => void }) {
  const { toast } = useToast();
  const [lozinka, setLozinka] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiRequest("POST", "/admin/reset-password", { userId: korisnik.id, newPassword: lozinka }, token);
      toast({ title: "Lozinka promijenjena!", description: `Korisnik: ${korisnik.displayName}` });
      onClose();
    } catch {
      toast({ title: "Greška", description: "Nije moguće promijeniti lozinku", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-foreground">Reset lozinke</h3>
          <button onClick={onClose} className="text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{korisnik.displayName} ({korisnik.username})</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="password" required minLength={6} placeholder="Nova lozinka (min. 6 znakova)"
            value={lozinka} onChange={e => setLozinka(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Odustani</Button>
            <Button type="submit" disabled={isLoading} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Promijeni
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
      toast({ title: "Učenik raspoređen!", description: `${korisnik.displayName} → ${selectedGrupa.naziv} (${selectedGrupa.muallimName})` });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Greška", description: err?.message || "Greška pri raspoređivanju", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const grupeByMuallim = grupeAll.reduce((acc, g) => {
    const key = g.muallimName || "Nepoznat";
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {} as Record<string, GrupaAll[]>);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-lg text-foreground">Rasporedi učenika</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-bold text-foreground">{korisnik.displayName}</span> ({korisnik.username})
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-2">Odaberite grupu</label>
            {grupeAll.length === 0 ? (
              <div className="border border-border rounded-xl p-4 text-center text-sm text-muted-foreground">
                Nema dostupnih grupa. Prvo kreirajte grupu kod muallima.
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
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">Odustani</Button>
            <Button type="submit" disabled={isLoading || !selectedGrupaId} className="flex-1 rounded-xl flex items-center gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />} Rasporedi
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function AdminPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"muallimi" | "korisnici" | "analitika" | "rezultati">("muallimi");
  const [statistike, setStatistike] = useState<Statistike | null>(null);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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

  const [muallimPregled, setMuallimPregled] = useState<MuallimPregled[]>([]);
  const [muallimLoading, setMuallimLoading] = useState(false);
  const [expandedMuallim, setExpandedMuallim] = useState<number | null>(null);

  const [rasporediKorisnik, setRasporediKorisnik] = useState<Korisnik | null>(null);
  const [grupeAll, setGrupeAll] = useState<GrupaAll[]>([]);

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
      toast({ title: "Greška", description: "Nije moguće učitati podatke", variant: "destructive" });
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
      toast({ title: "Greška", description: "Nije moguće učitati pregled muallima", variant: "destructive" });
    } finally {
      setMuallimLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!token || analytics) return;
    setAnalyticsLoading(true);
    try {
      const data = await apiRequest<AnalyticsData>("GET", "/admin/analytics", undefined, token);
      setAnalytics(data);
    } catch {
      toast({ title: "Greška", description: "Analitika nedostupna", variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
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

  useEffect(() => { loadData(); loadMuallimPregled(); loadGrupeAll(); }, [token]);
  useEffect(() => { if (activeTab === "analitika") loadAnalytics(); }, [activeTab]);
  useEffect(() => { if (activeTab === "rezultati") loadKvizStatistike(); }, [activeTab]);

  if (!user || user.role !== "admin") {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">Pristup dozvoljen samo adminima</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>Nazad</Button>
        </div>
      </Layout>
    );
  }

  const toggleActive = async (k: Korisnik) => {
    setTogglingId(k.id);
    try {
      await apiRequest("PUT", `/admin/korisnici/${k.id}`, { isActive: !k.isActive }, token!);
      setKorisnici(prev => prev.map(u => u.id === k.id ? { ...u, isActive: !u.isActive } : u));
      if (k.role === "muallim") loadMuallimPregled();
    } catch {
      toast({ title: "Greška", description: "Nije moguće promijeniti status", variant: "destructive" });
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
    );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Admin panel</h1>
            <p className="text-muted-foreground text-sm">Pregled platforme i upravljanje korisnicima</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : statistike && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users className="w-6 h-6 text-teal-700" />} label="Ukupno korisnika" value={statistike.ukupnoKorisnika} color="bg-teal-100" />
            <StatCard icon={<ShieldCheck className="w-6 h-6 text-amber-700" />} label="Muallima" value={statistike.korisnici.muallim || 0} color="bg-amber-100" />
            <StatCard icon={<Users className="w-6 h-6 text-blue-700" />} label="Učenika" value={statistike.korisnici.ucenik || 0} color="bg-blue-100" />
            <StatCard icon={<Building2 className="w-6 h-6 text-purple-700" />} label="Roditelja" value={statistike.korisnici.roditelj || 0} color="bg-purple-100" />
          </div>
        )}

        <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl mb-6 overflow-x-auto">
          {[
            { key: "muallimi" as const, label: "Muallimi", icon: <UserCog className="w-4 h-4" /> },
            { key: "korisnici" as const, label: "Korisnici", icon: <Users className="w-4 h-4" /> },
            { key: "analitika" as const, label: "Analitika", icon: <BarChart3 className="w-4 h-4" /> },
            { key: "rezultati" as const, label: "Kviz rezultati", icon: <ClipboardList className="w-4 h-4" /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.key ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: MUALLIMI ── */}
        {activeTab === "muallimi" && (
          <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-foreground flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-primary" /> Pregled muallima
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Muallimi, njihove grupe i broj učenika</p>
              </div>
              <Button size="sm" onClick={() => { setShowDodajMuallim(true); }} className="rounded-xl flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Dodaj muallima
              </Button>
            </div>
            {muallimLoading ? (
              <div className="p-4 flex flex-col gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : muallimPregled.length > 0 ? (
              <div>
                {muallimPregled.map(m => (
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
                          <div className="font-bold text-foreground">{m.displayName}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.email || m.username} · {m.brojGrupa} {m.brojGrupa === 1 ? "grupa" : "grupa"} · {m.aktivniUcenici}/{m.brojUcenika} učenika
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {m.isActive ? "Aktivan" : "Neaktivan"}
                        </span>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedMuallim === m.id ? "rotate-90" : ""}`} />
                      </div>
                    </button>
                    {expandedMuallim === m.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        className="px-4 pb-4">
                        {m.grupe.length > 0 ? (
                          <div className="bg-muted/30 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border/30 bg-muted/50">
                                  {["Grupa", "Šk. godina", "Aktivni učenici", "Ukupno učenika", "Status"].map(h => (
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
                                        {g.isActive ? "Aktivna" : "Neaktivna"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground py-3 text-center">Nema grupa</p>
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
            {analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
              </div>
            ) : analytics ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <TrendingUp className="w-5 h-5 text-teal-600" /> Posjete (zadnjih 30 dana)
                    </h3>
                    {analytics.aktivnostPosmjenama.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={analytics.aktivnostPosmjenama}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="datum" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip labelFormatter={l => `Datum: ${l}`} />
                          <Line type="monotone" dataKey="broj" stroke="#0d9488" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">Nema podataka o posjetama</p>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-blue-600" /> Nove registracije (30 dana)
                    </h3>
                    {analytics.registracijePoMjesecu.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.registracijePoMjesecu}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="datum" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip labelFormatter={l => `Datum: ${l}`} />
                          <Bar dataKey="broj" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">Nema registracija</p>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <Globe className="w-5 h-5 text-purple-600" /> Posjete po državama
                    </h3>
                    {analytics.posjetePoDrzavi.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analytics.posjetePoDrzavi} dataKey="broj" nameKey="country" cx="50%" cy="50%" outerRadius={80} label={({ country, percent }) => `${country} ${(percent * 100).toFixed(0)}%`}>
                            {analytics.posjetePoDrzavi.map((_, i) => (
                              <Cell key={i} fill={["#0d9488", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#ec4899"][i % 8]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">Nema podataka o posjetama</p>
                    )}
                  </div>

                  <div className="bg-white border border-border/50 rounded-2xl p-5">
                    <h3 className="font-extrabold text-foreground flex items-center gap-2 mb-4">
                      <Award className="w-5 h-5 text-amber-600" /> Uspješnost po kvizovima
                    </h3>
                    {analytics.kvizRezultati.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.kvizRezultati} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <YAxis dataKey="kvizNaslov" type="category" width={120} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(value: number) => `${value}%`} />
                          <Bar dataKey="prosjecniProcenat" fill="#f59e0b" radius={[0, 6, 6, 0]} name="Prosječni %" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-12">Nema rezultata kvizova</p>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-border/50">
                    <h3 className="font-extrabold text-foreground">Pregled korisnika po ulogama</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        {["Uloga", "Aktivni", "Neaktivni", "Ukupno"].map(h => (
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
                Nije moguće učitati analitiku
              </div>
            )}
          </div>
        )}

        {/* ── TAB: KVIZ REZULTATI ── */}
        {activeTab === "rezultati" && (
          <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-extrabold text-foreground flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> Pregled kvizova
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Statistika svih kvizova — koliko puta su rađeni i prosječna tačnost</p>
            </div>
            {kvizLoading ? (
              <div className="p-4 flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : kvizStatistike.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      {["Naziv kviza", "Kategorija", "Pokušaji", "Prosj. tačnost", "Najviši %", "Najniži %"].map(h => (
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
                          <span className="text-xs text-muted-foreground ml-1">puta</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">Nema kvizova</div>
            )}
          </div>
        )}

        {/* ── TAB: KORISNICI ── */}
        {activeTab === "korisnici" && (
        <>
        <div className="bg-white border border-border/50 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <h2 className="font-extrabold text-foreground">Korisnici</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Pretraga..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-40"
              />
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                className="border border-border rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                <option value="all">Svi</option>
                {["admin", "muallim", "roditelj", "ucenik"].map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <div className="relative">
                <Button size="sm" onClick={() => setShowDodajMenu(v => !v)} className="rounded-xl flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Dodaj <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                {showDodajMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-30 w-48 py-1">
                    {[
                      { label: "Admina", action: () => setShowDodajAdmina(true) },
                      { label: "Muallima", action: () => setShowDodajMuallim(true) },
                      { label: "Učenika", action: () => setShowDodajUcnika(true) },
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
                    {["Ime", "Korisničko ime", "Uloga", "Status", "Registrovan", "Akcije"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-extrabold text-xs text-muted-foreground">{h}</th>
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
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${k.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {k.isActive ? "Aktivan" : "Neaktivan"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString("bs-BA")}
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
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtrirani.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Nema korisnika</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
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
    </Layout>
  );
}
