import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UserPlus, User, Mail, AlertCircle, CheckCircle2,
  GraduationCap, Users, Building2, MapPin, ExternalLink, ShieldCheck, Globe
} from "lucide-react";

const BMAC_LINKS = {
  ucenik: {
    bih: "https://buymeacoffee.com/mekteb/e/517837",
    world: "https://buymeacoffee.com/mekteb/e/517833",
  },
  roditelj: {
    bih: [
      "https://buymeacoffee.com/mekteb/e/517837",
      "https://buymeacoffee.com/mekteb/e/517839",
      "https://buymeacoffee.com/mekteb/e/517841",
      "https://buymeacoffee.com/mekteb/e/523964",
    ],
    world: [
      "https://buymeacoffee.com/mekteb/e/517833",
      "https://buymeacoffee.com/mekteb/e/517834",
      "https://buymeacoffee.com/mekteb/e/517835",
      "https://buymeacoffee.com/mekteb/e/523965",
    ],
  },
};

const PRICE_BIH = { 1: "10 KM", 2: "18 KM", 3: "24 KM", 4: "26 KM" } as Record<number, string>;
const PRICE_EUR = { 1: "10 €", 2: "18 €", 3: "24 €", 4: "26 €" } as Record<number, string>;

const PAKETI = [
  { id: 1, naziv: "Paket 1", opis: "1 muallim + 50 učeničkih računa" },
  { id: 2, naziv: "Paket 2", opis: "2 muallima + 100 učeničkih računa" },
  { id: 3, naziv: "Paket 3", opis: "3 muallima + 150 učeničkih računa" },
  { id: 4, naziv: "Posebni zahtjevi", opis: "Prilagođen paket prema vašim potrebama" },
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

function CaptchaField({ captcha, value, onChange }: {
  captcha: { a: number; b: number };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Zaštita od spam-a</label>
      <div className="flex items-center gap-3">
        <div className="bg-muted/50 border border-border/70 rounded-xl px-4 py-2.5 font-bold text-foreground text-base whitespace-nowrap flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          {captcha.a} + {captcha.b} = ?
        </div>
        <Input
          type="number"
          required
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Odgovor"
          className="h-11 rounded-xl border-border/70 w-24 text-center font-bold"
        />
      </div>
    </div>
  );
}

type Tab = "ucenik" | "roditelj" | "mekteb";

export default function RegisterRoditeljPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("ucenik");
  const [isBiH, setIsBiH] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [ucenikForm, setUcenikForm] = useState({ displayName: "", email: "" });
  const [roditeljForm, setRoditeljForm] = useState({ displayName: "", email: "", brojDjece: 1 });
  const [mektebForm, setMektebForm] = useState({
    email: "", korisnickoIme: "", drzava: "", grad: "", nazivMekteba: "", paket: 1,
    koliko_muallima: 1, koliko_ucenika: "50"
  });

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

  const priceMap = isBiH ? PRICE_BIH : PRICE_EUR;

  const validateCaptcha = () => {
    if (parseInt(captchaAnswer) !== captcha.answer) {
      setError("Neispravan odgovor na zaštitno pitanje. Pokušajte ponovo.");
      resetCaptcha();
      return false;
    }
    return true;
  };

  const handleUcenikSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateCaptcha()) return;
    setIsLoading(true);
    const link = isBiH ? BMAC_LINKS.ucenik.bih : BMAC_LINKS.ucenik.world;
    try {
      await apiRequest("POST", "/auth/register-ucenik", { ...ucenikForm, paymentLink: link });
      window.open(link, "_blank");
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Greška pri registraciji");
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
    const links = isBiH ? BMAC_LINKS.roditelj.bih : BMAC_LINKS.roditelj.world;
    const link = links[roditeljForm.brojDjece - 1];
    try {
      await apiRequest("POST", "/auth/register-roditelj-v2", { ...roditeljForm, paymentLink: link });
      window.open(link, "_blank");
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Greška pri registraciji");
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
      await apiRequest("POST", "/auth/register-mekteb", mektebForm);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Greška pri slanju zahtjeva");
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
        style={{ backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)" }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md text-center">
          <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-10">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-3">Hvala na registraciji!</h2>
            <p className="text-muted-foreground mb-6">
              {activeTab === "mekteb"
                ? "Vaš zahtjev je zaprimljen. Kontaktirat ćemo vas putem e-maila na info@mekteb.net."
                : "Podaci za prijavu bit će poslani na vaš e-mail nakon što admin odobri vaš račun."}
            </p>
            <Button onClick={() => setLocation("/login")} className="rounded-xl">
              Nazad na prijavu
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "ucenik", label: "Registracija", icon: <GraduationCap className="w-4 h-4" /> },
    { key: "roditelj", label: "Roditelj", icon: <Users className="w-4 h-4" /> },
    { key: "mekteb", label: "Mekteb", icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)" }}>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-mekteb.png" alt="Mekteb" className="h-20 w-auto mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Islamska edukativna platforma</p>
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
                      <strong>Samostalna registracija</strong> — pristup svim sadržajima (Ilmihal, Sufara, Kvizovi, Čitaonica).
                    </p>
                    <p className="text-sm text-primary font-bold mt-1.5">
                      Pretplata: {isBiH === null ? "..." : (isBiH ? "10 KM" : "10 €")} / mjesečno
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

                    <CaptchaField captcha={captcha} value={captchaAnswer} onChange={setCaptchaAnswer} />

                    <Button type="submit" size="lg" disabled={isLoading}
                      className="w-full h-12 rounded-xl text-base font-bold mt-1 shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      {isLoading ? "Obrada..." : `Plati i registriraj se`}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Nakon uplate, admin odobrava račun i šalje podatke za prijavu na vaš email.
                    </p>
                  </form>
                </motion.div>
              )}

              {activeTab === "roditelj" && (
                <motion.div key="roditelj" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-5">
                    <p className="text-sm text-foreground">
                      <strong>Registracija roditelja</strong> — kreirajte račun za sebe i svoju djecu.
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

                    <div>
                      <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Broj djece</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map(n => (
                          <button key={n} type="button" onClick={() => setRoditeljForm(p => ({ ...p, brojDjece: n }))}
                            className={`py-3 rounded-xl text-center font-bold transition-all border-2 ${
                              roditeljForm.brojDjece === n
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 text-muted-foreground hover:border-primary/40"
                            }`}>
                            <div className="text-lg">{n}</div>
                            <div className="text-xs">{n === 1 ? "dijete" : "djece"}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-center">
                      <p className="text-sm font-bold text-amber-800">
                        Pretplata: {isBiH === null ? "..." : priceMap[roditeljForm.brojDjece]} / mjesečno
                      </p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        za {roditeljForm.brojDjece} {roditeljForm.brojDjece === 1 ? "dijete" : "djece"}
                      </p>
                    </div>

                    <CaptchaField captcha={captcha} value={captchaAnswer} onChange={setCaptchaAnswer} />

                    <Button type="submit" size="lg" disabled={isLoading}
                      className="w-full h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20 flex items-center justify-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      {isLoading ? "Obrada..." : "Plati i registriraj se"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Nakon uplate, admin odobrava račun i šalje podatke za prijavu na vaš email.
                    </p>
                  </form>
                </motion.div>
              )}

              {activeTab === "mekteb" && (
                <motion.div key="mekteb" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mb-5">
                    <p className="text-base font-bold text-foreground">
                      Registrirajte vaš mekteb. Javićemo vam se uskoro!
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
                      <label className="text-sm font-bold text-foreground mb-1.5 block">Korisničko ime muallima</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="text" required value={mektebForm.korisnickoIme}
                          onChange={e => setMektebForm(p => ({ ...p, korisnickoIme: e.target.value }))}
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
                        {PAKETI.map(p => (
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
                            <span className="text-xs font-bold text-primary shrink-0 ml-2">
                              {p.id === 4 ? "Po dogovoru" : "Kontaktirajte nas"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence>
                      {mektebForm.paket === 4 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-4">
                            <p className="text-sm font-bold text-amber-800">Posebni zahtjevi — prilagodite paket:</p>
                            <div>
                              <label className="text-sm font-bold text-foreground mb-1.5 block">Koliko muallima?</label>
                              <select value={mektebForm.koliko_muallima}
                                onChange={e => setMektebForm(p => ({ ...p, koliko_muallima: parseInt(e.target.value) }))}
                                className="w-full h-11 rounded-xl border border-border/70 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-bold text-foreground mb-1.5 block">Koliko učenika?</label>
                              <select value={mektebForm.koliko_ucenika}
                                onChange={e => setMektebForm(p => ({ ...p, koliko_ucenika: e.target.value }))}
                                className="w-full h-11 rounded-xl border border-border/70 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                                {["50", "100", "150", "200", "200+"].map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <CaptchaField captcha={captcha} value={captchaAnswer} onChange={setCaptchaAnswer} />

                    <Button type="submit" size="lg" disabled={isLoading}
                      className="w-full h-12 rounded-xl text-base font-bold mt-1 shadow-md shadow-primary/20">
                      {isLoading ? "Slanje..." : "Pošalji zahtjev"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Komunikacija se odvija putem e-maila. Link za uplatu bit će poslan na vašu adresu.
                    </p>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            Već imate nalog?{" "}
            <button onClick={() => setLocation("/login")} className="text-primary font-bold hover:underline">
              Prijavite se
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
