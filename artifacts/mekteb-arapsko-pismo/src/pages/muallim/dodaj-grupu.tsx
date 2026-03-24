import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const DANI = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"];

export default function DodajGrupuPage() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const [naziv, setNaziv] = useState("");
  const [skolskaGodina, setSkolskaGodina] = useState("2024/25");
  const [vrijemeNastave, setVrijemeNastave] = useState("");
  const [daniNastave, setDaniNastave] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  function toggleDan(dan: string) {
    setDaniNastave(prev => prev.includes(dan) ? prev.filter(d => d !== dan) : [...prev, dan]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !naziv.trim()) return;
    setIsLoading(true);
    try {
      await apiRequest("POST", "/muallim/grupe", {
        naziv: naziv.trim(),
        skolskaGodina,
        vrijemeNastave,
        daniNastave,
      }, token);
      toast({ title: "Grupa kreirana!", description: `"${naziv}" je uspješno dodana` });
      setLocation("/muallim");
    } catch {
      toast({ title: "Greška", description: "Nije moguće kreirati grupu", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <button onClick={() => setLocation("/muallim")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad na panel
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Nova grupa</h1>
            <p className="text-muted-foreground text-sm">Kreiranje razreda / grupe učenika</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-border/50 rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">
              Naziv grupe <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={naziv}
              onChange={e => setNaziv(e.target.value)}
              placeholder="npr. 1. razred — Subota"
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">Školska godina</label>
            <input
              type="text"
              value={skolskaGodina}
              onChange={e => setSkolskaGodina(e.target.value)}
              placeholder="2024/25"
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-foreground mb-2 block">Dani nastave</label>
            <div className="flex flex-wrap gap-2">
              {DANI.map(dan => (
                <button
                  key={dan}
                  type="button"
                  onClick={() => toggleDan(dan)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    daniNastave.includes(dan)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                  }`}
                >
                  {dan.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">Vrijeme nastave</label>
            <input
              type="text"
              value={vrijemeNastave}
              onChange={e => setVrijemeNastave(e.target.value)}
              placeholder="npr. 10:00 – 12:00"
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <Button type="submit" disabled={isLoading || !naziv.trim()} className="w-full rounded-xl font-bold py-3">
            <GraduationCap className="w-4 h-4 mr-2" />
            {isLoading ? "Kreiranje..." : "Kreiraj grupu"}
          </Button>
        </form>
      </div>
    </Layout>
  );
}
