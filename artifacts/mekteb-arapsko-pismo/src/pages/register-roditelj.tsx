import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/api";
import { useLanguage } from "@/context/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserPlus, User, Mail, AlertCircle, CheckCircle2,
  GraduationCap, Users, Building2, MapPin, ExternalLink, ShieldCheck, Globe,
  Calendar, KeyRound, Copy
} from "lucide-react";

// Jedinstveni Buy Me a Coffee membership link — korisnik na BMAC stranici
// bira nivo pretplate (pojedinačna, porodična, mektebska, mektebska XL).
const BMAC_MEMBERSHIP_LINK = "https://buymeacoffee.com/mekteb/membership";

// Cijena za pojedinačnu (učeničku) pretplatu — fiksno godišnje.
const UCENIK_PRICE_BIH = "20 BAM (12 €)";
const UCENIK_PRICE_EUR = "20 €";

// Porodična (roditeljska) — jedinstvena cijena za do 4 djece.
const RODITELJ_PRICE_BIH = "50 BAM (25 €)";
const RODITELJ_PRICE_EUR = "50 €";

// Mektebski paketi — 2 opcije.
type MektebPaketId = "do100" | "vise100";
const MEKTEB_PAKETI: Array<{
  id: MektebPaketId;
  naziv: string;
  opis: string;
  cijenaBih: string;
  cijenaEur: string;
}> = [
  {
    id: "do100",
    naziv: "Mektebska pretplata",
    opis: "Do 100 učenika",
    cijenaBih: "200 BAM (100 €)",
    cijenaEur: "200 €",
  },
  {
    id: "vise100",
    naziv: "Mektebska pretplata XL",
    opis: "Više od 100 učenika",
    cijenaBih: "300 BAM (150 €)",
    cijenaEur: "250 €",
  },
];

const DRZAVE = [
  "Bosna i Hercegovina", "Hrvatska", "Srbija", "Crna Gora", "Kosovo",
  "S. Makedonija", "Slovenija", "Italija", "Austrija", "Njemačka",
  "Francuska", "Benelux", "Švedska", "Norveška", "Finska", "UK", "USA", "Australija"
];

function generateCaptcha(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

function CaptchaField({ captcha, value, onChange, label }: {
  captcha: { a: number; b: number };
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">{label}</label>
      <div className="flex items-center gap-3">
        <div className="bg-muted/50 border border-border/70 rounded-xl px-4 py-2.5 font-bold text-foreground text-base whitespace-nowrap flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {captcha.a} + {captcha.b} = ?
        </div>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          className="h-11 rounded-xl border-border/70 w-24 text-center font-bold"
        />
      </div>
    </div>
  );
}

type Tab = "ucenik" | "roditelj" | "mekteb";

export default function RegisterRoditeljPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("ucenik");
  const [isBiH, setIsBiH] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [ucenikForm, setUcenikForm] = useState({ displayName: "", email: "", godine: "" });
  const [roditeljForm, setRoditeljForm] = useState({ displayName: "", email: "" });
  const [mektebForm, setMektebForm] = useState<{
    email: string;
    korisnickoIme: string;
    displayName: string;
    drzava: string;
    grad: string;
    nazivMekteba: string;
    paket: MektebPaketId;
    koliko_muallima: number;
  }>({
    email: "", korisnickoIme: "", displayName: "", drzava: "", grad: "", nazivMekteba: "",
    paket: "do100", koliko_muallima: 1
  });

  // Kredencijali vraćeni iz API-ja nakon uspješne registracije.
  const [credentials, setCredentials] = useState<{
    username: string;
    password: string;
    displayName: string;
    trialUntil: string;
  } | null>(null);

  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const resetCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer("");
  }, []);

  useEffect(() => {
    apiRequest<{ isBiH: boolean }>("GET", "/auth/geo")
      .then(data => setIsBiH(data.isBiH))
      .catch(() => setIsBiH(false));
  }, []);

  const ucenikPrice = isBiH ? UCENIK_PRICE_BIH : UCENIK_PRICE_EUR;
  const roditeljPrice = isBiH ? RODITELJ_PRICE_BIH : RODITELJ_PRICE_EUR;

  const validateCaptcha = () => {
    if (parseInt(captchaAnswer) !== captcha.answer) {
      setError(t("login.neispravanCaptcha"));
      resetCaptcha();
      return false;
    }
    return true;
  };

  const handleUcenikSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateCaptcha()) return;
    if (!ucenikForm.godine || parseInt(ucenikForm.godine) < 1) {
      setError("Unesite koliko godina imate.");
      return;
    }
    setIsLoading(true);
    try {
      const r = await apiRequest<{ success: boolean; displayName: string; username: string; password: string; trialUntil: string }>(
        "POST", "/auth/register-ucenik", { ...ucenikForm, godine: parseInt(ucenikForm.godine) }
      );
      setCredentials({ username: r.username, password: r.password, displayName: r.displayName, trialUntil: r.trialUntil });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || t("common.greskaRegistracija"));
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoditeljSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateCaptcha()) return;
    setIsLoading(true);
    try {
      const r = await apiRequest<{ success: boolean; displayName: string; username: string; password: string; trialUntil: string }>(
        "POST", "/auth/register-roditelj-v2", roditeljForm
      );
      setCredentials({ username: r.username, password: r.password, displayName: r.displayName, trialUntil: r.trialUntil });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || t("common.greskaRegistracija"));
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMektebSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateCaptcha()) return;
    setIsLoading(true);
    try {
      const r = await apiRequest<{ success: boolean; displayName: string; username: string; password: string; trialUntil: string }>(
        "POST", "/auth/register-mekteb", mektebForm
      );
      setCredentials({ username: r.username, password: r.password, displayName: r.displayName, trialUntil: r.trialUntil });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || t("common.greskaSlanje"));
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  if (success && credentials) {
    const trialDate = new Date(credentials.trialUntil);
    const trialDateStr = trialDate.toLocaleDateString("bs-BA", { day: "numeric", month: "long", year: "numeric" });
    const copyText = `Korisničko ime: ${credentials.username}\nLozinka: ${credentials.password}`;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
        style={{ backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)" }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground mb-2">Račun je otvoren!</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Dobrodošli, <strong className="text-foreground">{credentials.displayName}</strong>. Sačuvajte podatke za prijavu.
              </p>
            </div>

            <div className="bg-muted/40 border border-border/60 rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vaši podaci za prijavu</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Korisničko ime:</span>
                  <code className="font-bold text-foreground bg-white px-2 py-1 rounded border border-border/40 select-all">{credentials.username}</code>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Lozinka:</span>
                  <code className="font-bold text-foreground bg-white px-2 py-1 rounded border border-border/40 select-all">{credentials.password}</code>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => navigator.clipboard?.writeText(copyText)}
                className="w-full mt-4 rounded-xl flex items-center justify-center gap-2">
                <Copy className="w-3.5 h-3.5" /> Kopiraj podatke
              </Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
              <Calendar className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold text-amber-900">7 dana besplatnog probnog perioda</div>
                <div className="text-amber-800 mt-0.5">
                  Probni period traje do <strong>{trialDateStr}</strong>. Da biste nastavili koristiti platformu i poslije, obavite uplatu pretplate.
                </div>
              </div>
            </div>

            <a href={BMAC_MEMBERSHIP_LINK} target="_blank" rel="noopener noreferrer"
              className="block w-full text-center bg-primary/5 border border-primary/20 hover:bg-primary/10 transition rounded-xl px-4 py-3 mb-3 text-sm font-bold text-primary flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" /> Plati pretplatu
            </a>

            <Button onClick={() => setLocation("/login")} size="lg" className="w-full rounded-xl">
              Prijavite se sada
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "ucenik", label: t("register.ucenik"), icon: <GraduationCap className="w-4 h-4" /> },
    { key: "roditelj", label: t("register.roditelj"), icon: <Users className="w-4 h-4" /> },
    { key: "mekteb", label: t("register.mekteb"), icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)" }}>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-mekteb.png" alt="Mekteb" className="h-20 w-auto mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">{t("login.podNaslov")}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-border/50 overflow-hidden">
          <div className="flex border-b border-border/50">
            {tabs.map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); setError(""); resetCaptcha(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-7">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {activeTab === "ucenik" && (
                <motion.div key="ucenik" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-5">
                    <p className="text-sm text-foreground">
                      <strong>Pojedinačna pretplata</strong> — pristup svim sadržajima za jednu osobu. <strong>7 dana besplatnog probnog perioda</strong>, pa pretplata.
                    </p>
                    <p className="text-sm text-primary font-bold mt-1.5">
                      Pretplata: {isBiH === null ? "..." : ucenikPrice} / godišnje
                    </p>
                  </div>

                  <form onSubmit={handleUcenikSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Ime i prezime</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={ucenikForm.displayName}
                          onChange={e => setUcenikForm(p => ({ ...p, displayName: e.target.value }))}
                          placeholder="Vaše ime i prezime" className="pl-10 h-12 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" required value={ucenikForm.email}
                          onChange={e => setUcenikForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="vas@email.com" className="pl-10 h-12 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Koliko godina imate?</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="number" min={1} max={120} required value={ucenikForm.godine}
                          onChange={e => setUcenikForm(p => ({ ...p, godine: e.target.value.replace(/[^0-9]/g, "") }))}
                          placeholder="npr. 12" className="pl-10 h-12 rounded-xl border-border/70" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Bit ćete raspoređeni u odgovarajuću Online Mekteb grupu prema dobi.
                      </p>
                    </div>

                    <CaptchaField captcha={captcha} value={captchaAnswer} onChange={setCaptchaAnswer} label={t("login.zastitaOdSpama")} />

                    <Button type="submit" size="lg" disabled={isLoading}
                      className="w-full h-12 rounded-xl text-base font-bold mt-1 shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      {isLoading ? "Obrada..." : "Otvori račun (7 dana besplatno)"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Odmah dobijate korisničko ime i lozinku. Pretplatu možete uplatiti u toku 7 dana.
                    </p>
                  </form>
                </motion.div>
              )}

              {activeTab === "roditelj" && (
                <motion.div key="roditelj" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-5">
                    <p className="text-sm text-foreground">
                      <strong>Porodična pretplata</strong> — pristup svim sadržajima za roditelja + 4 djece. Djecu dodajete nakon prijave. <strong>7 dana besplatnog probnog perioda</strong>.
                    </p>
                    <p className="text-sm text-primary font-bold mt-1.5">
                      Pretplata: {isBiH === null ? "..." : roditeljPrice} / godišnje
                    </p>
                  </div>

                  <form onSubmit={handleRoditeljSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Ime i prezime</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={roditeljForm.displayName}
                          onChange={e => setRoditeljForm(p => ({ ...p, displayName: e.target.value }))}
                          placeholder="Vaše ime i prezime" className="pl-10 h-12 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" required value={roditeljForm.email}
                          onChange={e => setRoditeljForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="vas@email.com" className="pl-10 h-12 rounded-xl border-border/70" />
                      </div>
                    </div>

                    <CaptchaField captcha={captcha} value={captchaAnswer} onChange={setCaptchaAnswer} label={t("login.zastitaOdSpama")} />

                    <Button type="submit" size="lg" disabled={isLoading}
                      className="w-full h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      {isLoading ? "Obrada..." : "Otvori račun (7 dana besplatno)"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Odmah dobijate korisničko ime i lozinku. Pretplatu možete uplatiti u toku 7 dana.
                    </p>
                  </form>
                </motion.div>
              )}

              {activeTab === "mekteb" && (
                <motion.div key="mekteb" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-5">
                    <p className="text-sm text-foreground">
                      <strong>Registracija mekteba</strong> — odmah dobijate muallimski račun. <strong>7 dana besplatnog probnog perioda</strong>, učenike dodajete nakon prijave.
                    </p>
                  </div>

                  <form onSubmit={handleMektebSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Email muallima</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" required value={mektebForm.email}
                          onChange={e => setMektebForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="muallim@example.com" className="pl-10 h-11 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Ime i prezime muallima</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={mektebForm.displayName}
                          onChange={e => setMektebForm(p => ({ ...p, displayName: e.target.value }))}
                          placeholder="npr. Hasan Hodžić" className="pl-10 h-11 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Korisničko ime muallima</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={mektebForm.korisnickoIme}
                          onChange={e => setMektebForm(p => ({ ...p, korisnickoIme: e.target.value.toLowerCase().replace(/\s+/g, ".") }))}
                          placeholder="hasan.muallim" className="pl-10 h-11 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Država</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select required value={mektebForm.drzava}
                          onChange={e => setMektebForm(p => ({ ...p, drzava: e.target.value }))}
                          className="w-full pl-10 h-11 rounded-xl border border-border/70 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none">
                          <option value="">Odaberite državu</option>
                          {DRZAVE.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Grad</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={mektebForm.grad}
                          onChange={e => setMektebForm(p => ({ ...p, grad: e.target.value }))}
                          placeholder="npr. Tuzla" className="pl-10 h-11 rounded-xl border-border/70" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Naziv mekteba</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={mektebForm.nazivMekteba}
                          onChange={e => setMektebForm(p => ({ ...p, nazivMekteba: e.target.value }))}
                          placeholder="npr. Mekteb džamije Sultan Ahmeta" className="pl-10 h-11 rounded-xl border-border/70" />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-foreground mb-2 block">Odaberite paket</label>
                      <div className="flex flex-col gap-2">
                        {MEKTEB_PAKETI.map(p => (
                          <button key={p.id} type="button" onClick={() => setMektebForm(prev => ({ ...prev, paket: p.id }))}
                            className={`flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                              mektebForm.paket === p.id
                                ? "border-primary bg-primary/5"
                                : "border-border/50 hover:border-primary/30"
                            }`}>
                            <div>
                              <div className="font-bold text-foreground text-sm">{p.naziv}</div>
                              <div className="text-xs text-muted-foreground">{p.opis}</div>
                            </div>
                            <span className="text-xs font-bold text-primary shrink-0 ml-2 text-right">
                              {isBiH === null ? "..." : (isBiH ? p.cijenaBih : p.cijenaEur)}
                              <div className="text-[10px] font-normal text-muted-foreground">/ godišnje</div>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Koliko muallimskih računa je potrebno?</label>
                      <select value={mektebForm.koliko_muallima}
                        onChange={e => setMektebForm(p => ({ ...p, koliko_muallima: parseInt(e.target.value) }))}
                        className="w-full h-11 rounded-xl border border-border/70 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    <CaptchaField captcha={captcha} value={captchaAnswer} onChange={setCaptchaAnswer} label={t("login.zastitaOdSpama")} />

                    <Button type="submit" size="lg" disabled={isLoading}
                      className="w-full h-12 rounded-xl text-base font-bold mt-1 shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      {isLoading ? "Obrada..." : "Otvori muallimski račun (7 dana besplatno)"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Odmah dobijate korisničko ime i lozinku. Pretplatu možete uplatiti u toku 7 dana.
                    </p>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            {t("register.vecImateRacun")}{" "}
            <button onClick={() => setLocation("/login")} className="text-primary font-bold hover:underline">
              {t("register.prijavite")}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
