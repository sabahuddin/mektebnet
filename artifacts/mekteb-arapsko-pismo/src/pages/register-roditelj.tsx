import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, User, Lock, Mail, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterRoditeljPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ username: "", password: "", displayName: "", email: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError("Lozinka mora imati najmanje 6 znakova"); return; }

    setIsLoading(true);
    try {
      await apiRequest("POST", "/auth/register-roditelj", form);
      await login(form.username, form.password);
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Greška pri registraciji");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: "radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.08) 0%, transparent 70%)" }}>
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-4">
            <span className="text-white font-arabic font-bold text-3xl">م</span>
          </div>
          <h1 className="text-3xl font-extrabold text-primary">mekteb<span className="text-secondary">.net</span></h1>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-border/50 p-8">
          <h2 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Registracija roditelja
          </h2>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {[
              { key: "displayName", label: "Ime i prezime", icon: User, placeholder: "Vaše ime", type: "text" },
              { key: "username", label: "Korisničko ime", icon: User, placeholder: "npr. amira.besic", type: "text" },
              { key: "email", label: "Email (opciono)", icon: Mail, placeholder: "email@primjer.ba", type: "email" },
              { key: "password", label: "Lozinka", icon: Lock, placeholder: "min. 6 znakova", type: "password" },
            ].map(({ key, label, icon: Icon, placeholder, type }) => (
              <div key={key}>
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type={type} value={form[key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder} className="pl-10 h-12 rounded-xl border-border/70"
                    required={key !== "email"} />
                </div>
              </div>
            ))}

            <Button type="submit" size="lg" className="w-full h-12 rounded-xl text-base font-bold mt-2" disabled={isLoading}>
              {isLoading ? "Registracija..." : "Registruj se"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Već imaš račun?{" "}
            <button onClick={() => setLocation("/login")} className="text-primary font-bold hover:underline">Prijavi se</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
