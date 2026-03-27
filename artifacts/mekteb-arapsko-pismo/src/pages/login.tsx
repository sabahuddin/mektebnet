import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, User, Lock, AlertCircle, BookOpen, ShieldCheck } from "lucide-react";

function generateCaptcha(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

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

        <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-8">
          <h2 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" />
            {t("nav.prijava")}
          </h2>

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
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 h-12 rounded-xl border-border/70"
                  autoComplete="current-password"
                  required
                />
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
                  type="number"
                  required
                  value={captchaAnswer}
                  onChange={e => setCaptchaAnswer(e.target.value)}
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

          <div className="mt-6 pt-6 border-t border-border/50">
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
