import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, User, Lock, AlertCircle, BookOpen } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(username.trim(), password);
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Greška pri prijavi");
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-4">
            <span className="text-white font-arabic font-bold text-3xl">م</span>
          </div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">
            mekteb<span className="text-secondary">.net</span>
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Islamska edukativna platforma</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-8">
          <h2 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" />
            Prijava
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
                Korisničko ime
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
                Lozinka
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

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 rounded-xl text-base font-bold mt-2 shadow-md shadow-primary/20"
              disabled={isLoading}
            >
              {isLoading ? "Prijavljivanje..." : "Prijavi se"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/50">
            <p className="text-sm text-center text-muted-foreground">
              Roditelj?{" "}
              <button
                onClick={() => setLocation("/registracija")}
                className="text-primary font-bold hover:underline"
              >
                Registruj se ovdje
              </button>
            </p>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-primary/5 rounded-2xl p-4 border border-primary/10">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Nemaš korisničko ime?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Korisničko ime i lozinku dobijaju učenici od svog muallima. Roditelji se mogu sami registrovati.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
