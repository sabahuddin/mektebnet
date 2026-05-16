import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";

export default function ZaboravljenaSifraPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Unesite email adresu.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Greška pri slanju zahtjeva.");
      }
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
          <p className="text-muted-foreground mt-1 font-medium">Zaboravljena šifra</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-8">
          <h2 className="text-xl font-bold mb-2 text-foreground flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Postavi novu šifru
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Unesite email adresu sa kojom ste se registrovali — poslat ćemo vam link za postavljanje nove šifre.
          </p>

          {done ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-600" />
              <div>
                <p className="font-bold text-foreground mb-1">Provjerite svoj email!</p>
                <p className="text-sm text-muted-foreground">
                  Ako račun s tom adresom postoji, poslali smo link za postavljanje nove šifre. Link važi 1 sat.
                </p>
              </div>
              <Button onClick={() => setLocation("/login")} variant="outline" className="rounded-xl">
                <ArrowLeft className="w-4 h-4 mr-2" /> Nazad na prijavu
              </Button>
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
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="vas@email.com"
                      className="pl-10 h-12 rounded-xl border-border/70 font-medium"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full h-12 rounded-xl text-base font-bold mt-2" disabled={isLoading}>
                  {isLoading ? "Slanje..." : "Pošalji link za reset"}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border/50 text-center">
                <button onClick={() => setLocation("/login")} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Nazad na prijavu
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
