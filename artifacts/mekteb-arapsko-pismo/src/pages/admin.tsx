import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useLocation } from "wouter";
import {
  Users, Building2, ShieldCheck, BookOpen, LayoutDashboard,
  Plus, KeyRound, ToggleLeft, ToggleRight, Loader2, X, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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

export default function AdminPage() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [statistike, setStatistike] = useState<Statistike | null>(null);
  const [korisnici, setKorisnici] = useState<Korisnik[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDodajMuallim, setShowDodajMuallim] = useState(false);
  const [resetKorisnik, setResetKorisnik] = useState<Korisnik | null>(null);
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadData = async () => {
    if (!token) return;
    try {
      const [stat, kor] = await Promise.all([
        apiRequest<Statistike>("GET", "/admin/statistike", undefined, token),
        apiRequest<Korisnik[]>("GET", "/admin/korisnici", undefined, token),
      ]);
      setStatistike(stat);
      setKorisnici(kor);
    } catch {
      toast({ title: "Greška", description: "Nije moguće učitati podatke", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [token]);

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

        {/* Statistike */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : statistike && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<Users className="w-6 h-6 text-teal-700" />} label="Ukupno korisnika" value={statistike.ukupnoKorisnika} color="bg-teal-100" />
            <StatCard icon={<ShieldCheck className="w-6 h-6 text-amber-700" />} label="Muallima" value={statistike.korisnici.muallim || 0} color="bg-amber-100" />
            <StatCard icon={<Users className="w-6 h-6 text-blue-700" />} label="Roditelja" value={statistike.korisnici.roditelj || 0} color="bg-blue-100" />
            <StatCard icon={<Building2 className="w-6 h-6 text-purple-700" />} label="Mekteba" value={statistike.ukupnoMekteba} color="bg-purple-100" />
          </div>
        )}

        {/* Korisnici tabela */}
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
              <Button size="sm" onClick={() => setShowDodajMuallim(true)} className="rounded-xl flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Dodaj muallima
              </Button>
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
                          <button onClick={() => setResetKorisnik(k)}
                            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="Promijeni lozinku">
                            <KeyRound className="w-4 h-4" />
                          </button>
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
      </div>

      {showDodajMuallim && (
        <DodajMuallimModal token={token!} onClose={() => setShowDodajMuallim(false)} onCreated={loadData} />
      )}
      {resetKorisnik && (
        <ResetPasswordModal token={token!} korisnik={resetKorisnik} onClose={() => setResetKorisnik(null)} />
      )}
    </Layout>
  );
}
