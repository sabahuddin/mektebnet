import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Layout } from "@/components/layout";
import { goBackOr } from "@/lib/back-navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, GraduationCap, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { GroupStudentSetup } from "@/components/group-student-setup";

const DANI = ["Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"];

/** Vraća tekuću mektebsku godinu u formatu "Mektebska YYYY/YY".
 *  Nova mektebska godina počinje u augustu (8. mj.). */
function getCurrentSkolskaGodina(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const startYear = month >= 8 ? year : year - 1;
  return `Mektebska ${startYear}/${String(startYear + 1).slice(-2)}`;
}

interface Grupa {
  id: number;
  naziv: string;
  skolskaGodina: string;
  datumPocetka?: string | null;
  datumKraja?: string | null;
  daniNastave: string[];
  vrijemeNastave: string;
  muallimId?: number;
}

interface Muallim {
  userId: number;
  displayName: string;
  isGlavni: boolean;
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
  const { token, user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [naziv, setNaziv] = useState("");
  const [skolskaGodina, setSkolskaGodina] = useState(getCurrentSkolskaGodina);
  const [datumPocetka, setDatumPocetka] = useState("");
  const [datumKraja, setDatumKraja] = useState("");
  const [vrijemeNastave, setVrijemeNastave] = useState("");
  const [daniNastave, setDaniNastave] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEdit);
  const [loaded, setLoaded] = useState(!isEdit);

  // Muallim dodjela (samo za glavnog muallima)
  const [muallimi, setMuallimi] = useState<Muallim[]>([]);
  const [isGlavni, setIsGlavni] = useState(false);
  const [selectedMuallimId, setSelectedMuallimId] = useState<number | null>(null);

  // Učitaj listu muallima — 403 znači da korisnik nije glavni, ignoriramo grešku
  useEffect(() => {
    if (!token) return;
    apiRequest<Muallim[]>("GET", "/muallim/mekteb/muallimi", undefined, token)
      .then(lista => {
        setMuallimi(lista);
        setIsGlavni(true);
        // Postavi defaultnog muallima na samog sebe ako još nije odabran
        if (!selectedMuallimId && user?.id) {
          setSelectedMuallimId(user.id);
        }
      })
      .catch(() => {
        // 403 → nije glavni muallim, nema dropdowna
        setIsGlavni(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!isEdit || !token) return;
    setIsFetching(true);
    apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token)
      .then(grupe => {
        const g = grupe.find(x => x.id === editId);
        if (!g) {
          toast({ title: t("Greška"), description: t("Grupa nije pronađena"), variant: "destructive" });
          setLocation("/muallim?tab=grupe");
          return;
        }
        setNaziv(g.naziv || "");
        setSkolskaGodina(g.skolskaGodina || "");
        setDatumPocetka(dateInput(g.datumPocetka));
        setDatumKraja(dateInput(g.datumKraja));
        setVrijemeNastave(g.vrijemeNastave || "");
        setDaniNastave(g.daniNastave || []);
        if (g.muallimId) setSelectedMuallimId(g.muallimId);
        setLoaded(true);
      })
      .catch(() => toast({ title: t("Greška"), description: t("Nije moguće učitati grupu"), variant: "destructive" }))
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
      const payload: Record<string, unknown> = {
        naziv: naziv.trim(),
        skolskaGodina,
        datumPocetka: datumPocetka || null,
        datumKraja: datumKraja || null,
        vrijemeNastave,
        daniNastave,
      };
      // Glavnom muallimu pošalji odabranog muallima
      if (isGlavni && selectedMuallimId) {
        payload.muallimId = selectedMuallimId;
      }
      if (isEdit) {
        await apiRequest("PUT", `/muallim/grupe/${editId}`, payload, token);
        toast({ title: t("Sačuvano!"), description: t(`Grupa "{naziv}" je ažurirana`, { naziv }) });
        setLocation(`/muallim/grupa/${editId}`);
      } else {
        await apiRequest("POST", "/muallim/grupe", payload, token);
        toast({ title: t("Grupa kreirana!"), description: t(`"{naziv}" je uspješno dodana`, { naziv }) });
        setLocation("/muallim");
      }
    } catch {
      toast({ title: t("Greška"), description: isEdit ? t("Nije moguće sačuvati izmjene") : t("Nije moguće kreirati grupu"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <button onClick={() => goBackOr(() => setLocation("/muallim"))} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("Nazad")}
        </button>

        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-secondary to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{isEdit ? t("Uredi grupu") : t("Nova grupa")}</h1>
            <p className="text-muted-foreground text-sm">{isEdit ? t("Izmjena podataka grupe") : t("Kreiranje razreda / grupe učenika")}</p>
          </div>
        </div>

        {isFetching ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center text-muted-foreground">{t("Učitavanje...")}</div>
        ) : !loaded ? (
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center space-y-4">
            <p className="text-muted-foreground">{t("Nije moguće učitati podatke grupe.")}</p>
            <Button onClick={() => goBackOr(() => setLocation("/muallim?tab=grupe"))} variant="outline" className="rounded-xl font-bold">{t("Nazad na grupe")}</Button>
          </div>
        ) : (
        <div className="space-y-5">
        <form onSubmit={handleSubmit} className="bg-white border border-border/50 rounded-2xl p-4 sm:p-6 space-y-5">

          {/* Muallim grupe — samo za glavnog muallima */}
          {isGlavni && muallimi.length > 0 && (
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-muted-foreground" />
                {t("Muallim grupe")}
              </label>
              <select
                value={selectedMuallimId ?? ""}
                onChange={e => setSelectedMuallimId(Number(e.target.value))}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              >
                {muallimi.map(m => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}{m.isGlavni ? ` (${t("vi")})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">
              {t("Naziv grupe")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={naziv}
              onChange={e => setNaziv(e.target.value)}
              placeholder={t("npr. 1. razred — Subota")}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-foreground mb-1.5 block">{t("Mektebska godina")}</label>
            <input
              type="text"
              value={skolskaGodina}
              onChange={e => setSkolskaGodina(e.target.value)}
              placeholder={t("Mektebska 2025/26")}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">{t("Početak mektebske godine")}</label>
              <input
                type="date"
                value={datumPocetka}
                onChange={e => setDatumPocetka(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">{t("Kraj mektebske godine")}</label>
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
            <label className="text-sm font-bold text-foreground mb-2 block">{t("Dani nastave")}</label>
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
            <label className="text-sm font-bold text-foreground mb-1.5 block">{t("Vrijeme nastave")}</label>
            <input
              type="text"
              value={vrijemeNastave}
              onChange={e => setVrijemeNastave(e.target.value)}
              placeholder={t("npr. 10:00 – 12:00")}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
            />
          </div>

          <Button type="submit" disabled={isLoading || !naziv.trim()} className="w-full rounded-xl font-bold py-3">
            <GraduationCap className="w-4 h-4 mr-2" />
            {isLoading ? (isEdit ? t("Spremanje...") : t("Kreiranje...")) : (isEdit ? t("Sačuvaj izmjene") : t("Kreiraj grupu"))}
          </Button>
        </form>
        {isEdit && editId && <GroupStudentSetup grupaId={editId} />}
        </div>
        )}
      </div>
    </Layout>
  );
}
