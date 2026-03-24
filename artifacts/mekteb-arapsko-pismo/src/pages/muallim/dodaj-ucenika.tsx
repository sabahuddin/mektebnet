import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Grupa {
  id: number;
  naziv: string;
}

interface CreatedUcenik {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
}

export default function DodajUcenikaPage() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [grupaId, setGrupaId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<CreatedUcenik | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token)
      .then(setGrupe).catch(() => {});
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !displayName.trim()) return;
    setIsLoading(true);
    try {
      const result = await apiRequest<CreatedUcenik>("POST", "/muallim/ucenici", {
        displayName: displayName.trim(),
        grupaId: grupaId ? parseInt(grupaId) : undefined,
      }, token);
      setCreated(result);
    } catch (err: any) {
      toast({
        title: "Greška",
        description: err?.message || "Nije moguće kreirati učenika",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function copyCredentials() {
    if (!created) return;
    const text = `Korisničko ime: ${created.username}\nLozinka: ${created.generatedPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <button onClick={() => setLocation("/muallim")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Dodaj učenika</h1>
            <p className="text-muted-foreground text-sm">Kreiranje novog naloga za učenika</p>
          </div>
        </div>

        {created ? (
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
            <h2 className="text-lg font-extrabold text-emerald-800 mb-1">Učenik kreiran! ✓</h2>
            <p className="text-emerald-700 text-sm mb-5">Proslijedi ove podatke učeniku ili roditelju:</p>

            <div className="bg-white rounded-xl border border-emerald-200 p-4 font-mono text-sm space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ime:</span>
                <span className="font-bold text-foreground">{created.displayName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Korisničko ime:</span>
                <span className="font-bold text-foreground">{created.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Lozinka:</span>
                <span className="font-bold text-foreground">{created.generatedPassword}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={copyCredentials} className="flex-1 rounded-xl flex items-center gap-2">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Kopirano!" : "Kopiraj podatke"}
              </Button>
              <Button onClick={() => { setCreated(null); setDisplayName(""); setGrupaId(""); }} className="flex-1 rounded-xl">
                Dodaj još
              </Button>
            </div>

            <button onClick={() => setLocation("/muallim")} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors">
              Nazad na panel
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-border/50 rounded-2xl p-6 space-y-5">
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">
                Ime i prezime <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="npr. Amina Hasić"
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Korisničko ime i lozinka se generišu automatski</p>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">Grupa (razred)</label>
              <select
                value={grupaId}
                onChange={e => setGrupaId(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              >
                <option value="">Bez grupe</option>
                {grupe.map(g => (
                  <option key={g.id} value={g.id}>{g.naziv}</option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={isLoading || !displayName.trim()} className="w-full rounded-xl font-bold py-3 flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              {isLoading ? "Kreiranje..." : "Kreiraj učenika"}
            </Button>
          </form>
        )}
      </div>
    </Layout>
  );
}
