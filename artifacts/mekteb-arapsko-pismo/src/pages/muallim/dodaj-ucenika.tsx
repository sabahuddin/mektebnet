import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { ArrowLeft, UserPlus, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { goBackOr } from "@/lib/back-navigation";

interface Grupa {
  id: number;
  naziv: string;
}

interface CreatedRoditelj {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
}

interface CreatedUcenik {
  id: number;
  displayName: string;
  username: string;
  generatedPassword: string;
  roditelj: CreatedRoditelj | null;
}

type CopyTarget = "ucenik" | "roditelj" | "oba";

export default function DodajUcenikaPage() {
  const [, setLocation] = useLocation();
  const { token } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [grupe, setGrupe] = useState<Grupa[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [grupaId, setGrupaId] = useState<string>("");
  const [dodajRoditelja, setDodajRoditelja] = useState(false);
  const [roditeljIme, setRoditeljIme] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<CreatedUcenik | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<Grupa[]>("GET", "/muallim/grupe", undefined, token)
      .then(setGrupe).catch(() => {});
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !displayName.trim()) return;
    if (dodajRoditelja && !roditeljIme.trim()) {
      toast({ title: t("Nedostaje ime roditelja"), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim(),
        grupaId: grupaId ? parseInt(grupaId) : undefined,
      };
      if (dodajRoditelja) {
        body.roditelj = { displayName: roditeljIme.trim() };
      }
      const result = await apiRequest<CreatedUcenik>("POST", "/muallim/ucenici", body, token);
      setCreated(result);
    } catch (err: any) {
      toast({
        title: t("Greška"),
        description: err?.message || t("Nije moguće kreirati učenika"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function copyText(text: string, target: CopyTarget) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    });
  }

  function copyUcenik() {
    if (!created) return;
    copyText(t("Učenik: {displayName}\nKorisničko ime: {username}\nLozinka: {password}", { displayName: created.displayName, username: created.username, password: created.generatedPassword }), "ucenik");
  }

  function copyRoditelj() {
    if (!created?.roditelj) return;
    const r = created.roditelj;
    copyText(t("Roditelj: {displayName}\nKorisničko ime: {username}\nLozinka: {password}", { displayName: r.displayName, username: r.username, password: r.generatedPassword }), "roditelj");
  }

  function copyOba() {
    if (!created) return;
    let text = t("Učenik: {displayName}\nKorisničko ime: {username}\nLozinka: {password}", { displayName: created.displayName, username: created.username, password: created.generatedPassword });
    if (created.roditelj) {
      text += "\n\n" + t("Roditelj: {displayName}\nKorisničko ime: {username}\nLozinka: {password}", { displayName: created.roditelj.displayName, username: created.roditelj.username, password: created.roditelj.generatedPassword });
    }
    copyText(text, "oba");
  }

  function reset() {
    setCreated(null);
    setDisplayName("");
    setGrupaId("");
    setDodajRoditelja(false);
    setRoditeljIme("");
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto">
        <button onClick={() => goBackOr(() => setLocation("/muallim"))} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-medium mb-6 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na panel")}
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("Dodaj učenika")}</h1>
            <p className="text-muted-foreground text-sm">{t("Kreiranje novog naloga za učenika")}</p>
          </div>
        </div>

        {created ? (
          <div className="space-y-4">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
              <h2 className="text-lg font-extrabold text-emerald-800 mb-1">{t("Učenik kreiran! ✓")}</h2>
              <p className="text-emerald-700 text-sm mb-4">{t("Proslijedi ove podatke učeniku:")}</p>

              <div className="bg-white rounded-xl border border-emerald-200 p-4 font-mono text-sm space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("Ime:")}</span>
                  <span className="font-bold text-foreground">{created.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("Korisničko ime:")}</span>
                  <span className="font-bold text-foreground">{created.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("Lozinka:")}</span>
                  <span className="font-bold text-foreground">{created.generatedPassword}</span>
                </div>
              </div>

              <Button variant="outline" onClick={copyUcenik} className="w-full rounded-xl flex items-center gap-2">
                {copiedTarget === "ucenik" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedTarget === "ucenik" ? t("Kopirano!") : t("Kopiraj podatke učenika")}
              </Button>
            </div>

            {created.roditelj && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                <h2 className="text-lg font-extrabold text-blue-800 mb-1">{t("Roditelj kreiran! ✓")}</h2>
                <p className="text-blue-700 text-sm mb-4">{t("Proslijedi ove podatke roditelju:")}</p>

                <div className="bg-white rounded-xl border border-blue-200 p-4 font-mono text-sm space-y-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("Ime:")}</span>
                    <span className="font-bold text-foreground">{created.roditelj.displayName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("Korisničko ime:")}</span>
                    <span className="font-bold text-foreground">{created.roditelj.username}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("Lozinka:")}</span>
                    <span className="font-bold text-foreground">{created.roditelj.generatedPassword}</span>
                  </div>
                </div>

                <Button variant="outline" onClick={copyRoditelj} className="w-full rounded-xl flex items-center gap-2">
                  {copiedTarget === "roditelj" ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4" />}
                  {copiedTarget === "roditelj" ? t("Kopirano!") : t("Kopiraj podatke roditelja")}
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              {created.roditelj && (
                <Button variant="outline" onClick={copyOba} className="flex-1 rounded-xl flex items-center gap-2">
                  {copiedTarget === "oba" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedTarget === "oba" ? t("Kopirano!") : t("Kopiraj oboje")}
                </Button>
              )}
              <Button onClick={reset} className="flex-1 rounded-xl">
                {t("Dodaj još")}
              </Button>
            </div>

            <button onClick={() => goBackOr(() => setLocation("/muallim"))} className="w-full text-sm text-muted-foreground hover:text-foreground font-medium transition-colors">
              {t("Nazad na panel")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-border/50 rounded-2xl p-6 space-y-5">
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">
                {t("Ime i prezime učenika")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t("npr. Amina Hasić")}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              />
              <p className="text-xs text-muted-foreground mt-1.5">{t("Korisničko ime i lozinka se generišu automatski")}</p>
            </div>

            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">{t("Grupa (razred)")}</label>
              <select
                value={grupaId}
                onChange={e => setGrupaId(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
              >
                <option value="">{t("Bez grupe")}</option>
                {grupe.map(g => (
                  <option key={g.id} value={g.id}>{g.naziv}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-border pt-5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dodajRoditelja}
                  onChange={e => setDodajRoditelja(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-border text-primary focus:ring-primary/40"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">Dodaj i nalog za roditelja</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Roditelj dobije zaseban nalog i automatski se poveže s djetetom. Ne ulazi u kvotu licenci.
                  </p>
                </div>
              </label>

              {dodajRoditelja && (
                <div className="mt-4 ml-8">
                  <label className="text-sm font-bold text-foreground mb-1.5 block">
                    Ime i prezime roditelja <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={dodajRoditelja}
                    value={roditeljIme}
                    onChange={e => setRoditeljIme(e.target.value)}
                    placeholder={t("npr. Mirsad Hasić")}
                    className="w-full border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 bg-muted/20"
                  />
                </div>
              )}
            </div>

            <Button type="submit" disabled={isLoading || !displayName.trim() || (dodajRoditelja && !roditeljIme.trim())} className="w-full rounded-xl font-bold py-3 flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              {isLoading ? "Kreiranje..." : (dodajRoditelja ? "Kreiraj učenika i roditelja" : "Kreiraj učenika")}
            </Button>
          </form>
        )}
      </div>
    </Layout>
  );
}
