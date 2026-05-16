import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, CheckCircle2, AlertCircle, KeyRound, Eye, EyeOff } from "lucide-react";

export default function ResetSifraPage() {
  const [, setLocation] = useLocation();
  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Link nije valjan.");
      return;
    }
    if (pw1.length < 6) {
      setError("Šifra mora imati najmanje 6 karaktera.");
      return;
    }
    if (pw1 !== pw2) {
      setError("Šifre se ne podudaraju.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Greška pri promjeni šifre.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Greška servera.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" style={{
      backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)",
    }}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/logo-mekteb.png" alt="Mekteb" className="h-20 w-auto mx-auto mb-4" />
          <p className="text-muted-foreground mt-1 font-medium">Nova šifra</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-8">
          <h2 className="text-xl font-bold mb-2 text-foreground flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Postavi novu šifru
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Odaberite novu šifru za vaš Mekteb.net račun.
          </p>

          {done ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-600" />
              <div>
                <p className="font-bold text-foreground mb-1">Šifra je promijenjena!</p>
                <p className="text-sm text-muted-foreground">Sada se možete prijaviti s novom šifrom.</p>
              </div>
              <Button onClick={() => setLocation("/login")} className="rounded-xl">Idi na prijavu</Button>
            </div>
          ) : (
            <>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}
              {!token && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 mb-4 text-sm">
                  Link nije valjan ili nedostaje token. Zatražite novi link na stranici "Zaboravljena šifra".
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Nova šifra</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPw ? "text" : "password"}
                      value={pw1}
                      onChange={e => setPw1(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 pr-12 h-12 rounded-xl border-border/70"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Ponovi šifru</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPw ? "text" : "password"}
                      value={pw2}
                      onChange={e => setPw2(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10 h-12 rounded-xl border-border/70"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full h-12 rounded-xl text-base font-bold mt-2" disabled={isLoading || !token}>
                  {isLoading ? "Mijenjanje..." : "Postavi novu šifru"}
                </Button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
