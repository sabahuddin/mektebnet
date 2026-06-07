import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const DANI = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"];

interface Grupa {
  id: number;
  naziv: string;
  skolskaGodina: string;
  datumPocetka?: string | null;
  datumKraja?: string | null;
  daniNastave: string[];
  vrijemeNastave: string;
}

function dateInput(s?: string | null) {
  if (!s) return "";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function DodajGrupuPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const editId = params.id ? parseInt(params.id) : null;
  const isEdit = editId !== null;
  const { token } = useAuth();
  const { toast } = useToast();
  const [naziv, setNaziv] = useState("");
  const [skolskaGodina, setSkolskaGodina] = useState("Mektebska 2025/26");
  const [datumPocetka, setDatumPocetka] = useState("");
  const [datumKraja, setDatumKraja] = useState("");
  const [vrijemeNastave, setVrijemeNastave] = useState("");
  const [daniNastave, setDaniNastave] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEdit);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || !token) return;
    setIsFetching(true);
    apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token)
      .then(grupe => {
        const g = grupe.find(x => x.id === editId);
        if (!g) {
          toast({ title: "Greška", description: "Grupa nije pronađena", variant: "destructive" });
          setLocation("/muallim?tab=grupe");
          return;
        }
        setNaziv(g.naziv || "");
        setSkolskaGodina(g.skolskaGodina || "");
        setDatumPocetka(dateInput(g.datumPocetka));
        setDatumKraja(dateInput(g.datumKraja));
        setVrijemeNastave(g.vrijemeNastave || "");
        setDaniNastave(g.daniNastave || []);
        setLoaded(true);
      })
      .catch(() => toast({ title: "Greška", description: "Nije moguće učitati grupu", variant: "destructive" }))
      .finally(() => setIsFetching(false));
  }, [isEdit, editId, token]);

  function toggleDan(dan: string) {
    setDaniNastave(prev => prev.includes(dan) ? prev.filter(d => d !== dan) : [...prev, dan]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !naziv.trim() || !loaded) return;
    setIsLoading(true);
    try {
      const payload = {
        naziv: naziv.trim(),
        skolskaGodina,
        datumPocetka: datumPocetka || null,
        datumKraja: datumKraja || null,
        vrijemeNastave,
        daniNastave,
      };
      if (isEdit) {
        await apiRequest("PUT", `/muallim/grupe/${editId}`, payload, token);
        toast({ title: "Sačuvano!", description: `Grupa "${naziv}" je ažurirana` });
        setLocation(`/muallim/grupa/${editId}`);
      } else {
        await apiRequest("POST", "/muallim/grupe", payload, token);
        toast({ title: "Grupa kreirana!", description: `"${naziv}" je uspješno dodana` });
        setLocation("/muallim");
      }
    } catch {
      toast({ title: "Greška", description: isEdit ? "Nije moguće sačuvati izmjene" : "Nije moguće kreirati grupu", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <button onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) window.history.back(); else setLocation("/muallim"); }} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Nazad
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{isEdit ? "Uredi grupu" : "Nova grupa"}</h1>
            <p className="text-muted-foreground text-sm">{isEdit ? "Izmjena podataka grupe" : "Kreiranje razreda / grupe učenika"}</p>
          </div>
        </div>

        {isFetching ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center text-muted-foreground">Učitavanje...</div>
        ) : !loaded ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center space-y-4">
            <p className="text-muted-foreground">Nije moguće učitati podatke grupe.</p>
            <Button onClick={() => setLocation("/muallim?tab=grupe")} variant="outline" className="rounded-xl font-bold">Nazad na grupe</Button>
          </div>
        ) : (
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
            <label className="text-sm font-bold text-foreground mb-1.5 block">Mektebska godina</label>
            <input
              type="text"
              value={skolskaGodina}
              onChange={e => setSkolskaGodina(e.target.value)}
              placeholder="Mektebska 2025/26"
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">Početak mektebske godine</label>
              <input
                type="date"
                value={datumPocetka}
                onChange={e => setDatumPocetka(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">Kraj mektebske godine</label>
              <input
                type="date"
                value={datumKraja}
                min={datumPocetka || undefined}
                onChange={e => setDatumKraja(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              />
            </div>
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
            {isLoading ? (isEdit ? "Spremanje..." : "Kreiranje...") : (isEdit ? "Sačuvaj izmjene" : "Kreiraj grupu")}
          </Button>
        </form>
        )}
      </div>
    </Layout>
  );
}
