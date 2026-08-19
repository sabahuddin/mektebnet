import { useState, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, User, Lock, AlertCircle, BookOpen, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { GraduationCap, Users, Building2, KeyRound } from "lucide-react";

function generateCaptcha(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [activeTab, setActiveTab] = useState<"prijava" | "demo">(
    search.includes("demo") ? "demo" : "prijava"
  );

  // Kada se na login dođe sa ?tab=demo (npr. iz menija "Demo prijava"), otvori
  // odmah Demo tab — i kada je komponenta već montirana (promjena query-ja).
  useEffect(() => {
    if (search.includes("demo")) setActiveTab("demo");
  }, [search]);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [demoBusy, setDemoBusy] = useState<string | null>(null);

  const resetCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaAnswer("");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (parseInt(captchaAnswer) !== captcha.answer) {
      setError(t("login.neispravanCaptcha"));
      resetCaptcha();
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.greskaLogin"));
      resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const doDemoLogin = async (demoUser: string, destination = "/") => {
    setDemoBusy(demoUser);
    setError("");
    try {
      await login(demoUser, "demo123");
      setLocation(destination);
    } catch (e: any) {
      setError(e?.message || "Demo prijava nije uspjela");
      setDemoBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" style={{
      backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)"
    }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/logo-mekteb.png" alt="Mekteb" className="h-20 w-auto mx-auto mb-4" />
          <p className="text-muted-foreground mt-1 font-medium">{t("login.podNaslov")}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-border/50 overflow-hidden">
          <div className="flex border-b border-border/50">
            {(
              [
                { key: "prijava", label: "Prijava", icon: <LogIn className="w-4 h-4" /> },
                { key: "demo", label: "Demo prijava", icon: <KeyRound className="w-4 h-4" /> },
              ] as const
            ).map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); setError(""); setUsername(""); setPassword(""); setCaptchaAnswer(""); setCaptcha(generateCaptcha()); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="p-8">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}

            {activeTab === "prijava" && (
              <div className="flex flex-col gap-4">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("login.korisnickoIme")}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="tvoje.ime.1234"
                        className="pl-10 h-12 rounded-xl border-border/70 font-medium"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("login.lozinka")}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={showPassword ? "Mekteb1234" : "••••••••"}
                        className="pl-10 pr-12 h-12 rounded-xl border-border/70"
                        autoComplete="current-password"
                        required
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        aria-label={showPassword ? "Sakrij lozinku" : "Pokaži lozinku"}
                        data-testid="btn-toggle-password"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                      {t("login.zastitaOdSpama")}
                    </label>
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
                        value={captchaAnswer}
                        onChange={e => setCaptchaAnswer(e.target.value.replace(/[^0-9]/g, ""))}
                        className="h-11 rounded-xl border-border/70 w-24 text-center font-bold"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full h-12 rounded-xl text-base font-bold mt-2 shadow-md shadow-primary/20"
                    disabled={isLoading}
                  >
                    {isLoading ? t("login.prijavljivanje") : t("login.prijaviSe")}
                  </Button>
                </form>

                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setLocation("/zaboravljena-sifra")}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    Zaboravili ste šifru?
                  </button>
                </div>

                <div className="mt-2 pt-4 border-t border-border/50">
                  <p className="text-sm text-center text-muted-foreground">
                    {t("login.nemateRacun")}{" "}
                    <button
                      onClick={() => setLocation("/registracija")}
                      className="text-primary font-bold hover:underline"
                    >
                      {t("login.registrujte")}
                    </button>
                  </p>
                </div>
              </div>
            )}

            {activeTab === "demo" && (
              <div className="flex flex-col gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-2">
                  <p className="text-sm text-foreground">
                    <strong>Demo prijava</strong> — isprobajte platformu bez registracije i pretplate. Odaberite ulogu:
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => doDemoLogin("demo.tarik.avdic")}
                  disabled={demoBusy !== null}
                  className="w-full h-12 rounded-xl font-bold border-amber-300 hover:bg-amber-50 flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-4 h-4 text-amber-700" />
                  {demoBusy === "demo.tarik.avdic" ? "Prijavljujem..." : "Demo učenik (Tarik Avdić)"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => doDemoLogin("demo.roditelj.amir")}
                  disabled={demoBusy !== null}
                  className="w-full h-12 rounded-xl font-bold border-amber-300 hover:bg-amber-50 flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4 text-amber-700" />
                  {demoBusy === "demo.roditelj.amir" ? "Prijavljujem..." : "Demo roditelj (Amir)"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => doDemoLogin("demo.muallim")}
                  disabled={demoBusy !== null}
                  className="w-full h-12 rounded-xl font-bold border-amber-300 hover:bg-amber-50 flex items-center justify-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-amber-700" />
                  {demoBusy === "demo.muallim" ? "Prijavljujem..." : "Demo muallim"}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Demo računi su zajednički — molimo ne mijenjajte lične podatke.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-primary/5 rounded-2xl p-4 border border-primary/10">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">{t("common.nemasKorisnickoIme")}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("common.korisnickoImeInfo")}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
