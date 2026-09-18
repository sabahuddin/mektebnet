import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest, getApiBase } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language";
import { goBackOr } from "@/lib/back-navigation";
import { ArrowLeft, ShieldCheck, Download, Loader2, Database, FolderOpen, Github } from "lucide-react";

interface Pregled {
  vrijeme: string;
  tabele: { tabela: string; redova: number }[];
  ukupnoRedova: number;
  fajlovi: { folder: string; fajlova: number; bajtova: number };
}

function megabajti(bajtova: number): string {
  if (bajtova < 1024 * 1024) return `${Math.max(1, Math.round(bajtova / 1024))} KB`;
  return `${(bajtova / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminSigurnosnaKopijaPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [pregled, setPregled] = useState<Pregled | null>(null);
  const [ucitavanje, setUcitavanje] = useState(true);
  const [preuzimanje, setPreuzimanje] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "admin") {
      setLocation("/");
      return;
    }
    let otkazano = false;
    (async () => {
      try {
        const data = await apiRequest<Pregled>("GET", "/admin/sigurnosna-kopija/pregled", undefined, token);
        if (!otkazano) setPregled(data);
      } catch {
        if (!otkazano) {
          toast({ title: t("Greška"), description: t("Nije moguće pročitati stanje sadržaja"), variant: "destructive" });
        }
      } finally {
        if (!otkazano) setUcitavanje(false);
      }
    })();
    return () => { otkazano = true; };
  }, [user, token, authLoading]);

  // Kopija se preuzima uz Authorization zaglavlje, pa ne može običnim <a href>.
  const preuzmi = async () => {
    if (!token) return;
    setPreuzimanje(true);
    try {
      const res = await fetch(`${getApiBase()}/admin/sigurnosna-kopija`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      const zaglavlje = res.headers.get("Content-Disposition") || "";
      const ime = /filename="([^"]+)"/.exec(zaglavlje)?.[1] || "mekteb-sadrzaj.ndjson.gz";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const veza = document.createElement("a");
      veza.href = url;
      veza.download = ime;
      document.body.appendChild(veza);
      veza.click();
      veza.remove();
      URL.revokeObjectURL(url);
      toast({ title: t("Kopija je preuzeta"), description: t("Spasi je izvan servera — na računar ili u oblak.") });
    } catch {
      toast({ title: t("Greška"), description: t("Preuzimanje kopije nije uspjelo"), variant: "destructive" });
    } finally {
      setPreuzimanje(false);
    }
  };

  if (authLoading || !user || user.role !== "admin") return null;

  const najvece = (pregled?.tabele ?? [])
    .filter(red => red.redova > 0)
    .sort((a, b) => b.redova - a.redova);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => goBackOr(() => setLocation("/admin"))}
          className="flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-6 font-semibold w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na admin")}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("Sigurnosna kopija")}</h1>
            <p className="text-muted-foreground text-base">{t("Da ništa ne propadne ako server nestane")}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mb-5">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-sky-600 mt-1 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-foreground">{t("1. Sadržaj (lekcije, kvizovi, učenici, vježbe)")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Sve što je u bazi, u jednoj datoteci. Preuzmi je jednom sedmično i čuvaj izvan servera.")}
              </p>
              {ucitavanje ? (
                <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("Čitam stanje…")}
                </p>
              ) : pregled ? (
                <p className="text-sm text-foreground mt-3" data-testid="kopija-ukupno">
                  {t("Trenutno")}: <strong>{pregled.ukupnoRedova.toLocaleString("bs-BA")}</strong> {t("zapisa u")}{" "}
                  <strong>{pregled.tabele.length}</strong> {t("tabela")}
                </p>
              ) : null}
              <button
                onClick={preuzmi}
                disabled={preuzimanje}
                data-testid="button-preuzmi-kopiju"
                className="mt-4 inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700 disabled:opacity-60"
              >
                {preuzimanje ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {preuzimanje ? t("Pripremam…") : t("Preuzmi kopiju sadržaja")}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mb-5">
          <div className="flex items-start gap-3">
            <FolderOpen className="w-5 h-5 text-amber-600 mt-1 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-foreground">{t("2. Priloženi fajlovi (PDF, slike, audio, H5P)")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Oni nisu u bazi nego na disku servera, pa se kopiraju zasebno — u Coolifyju.")}
              </p>
              {pregled ? (
                <p className="text-sm text-foreground mt-3" data-testid="kopija-fajlovi">
                  <strong>{pregled.fajlovi.fajlova.toLocaleString("bs-BA")}</strong> {t("fajlova")},{" "}
                  <strong>{megabajti(pregled.fajlovi.bajtova)}</strong>
                  <span className="block text-muted-foreground break-all">{pregled.fajlovi.folder}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mb-5">
          <div className="flex items-start gap-3">
            <Github className="w-5 h-5 text-foreground mt-1 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-foreground">{t("3. Kod platforme")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("Kod je na GitHubu i svaka izmjena ostaje zapisana. Dovoljno je povremeno spasiti i kopiju na svoj računar.")}
              </p>
            </div>
          </div>
        </div>

        {najvece.length > 0 ? (
          <details className="rounded-2xl border border-border bg-card p-5">
            <summary className="font-bold text-foreground cursor-pointer">{t("Šta je unutra")}</summary>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {najvece.map(red => (
                <li key={red.tabela} className="flex justify-between gap-3 border-b border-border/50 py-1">
                  <span className="truncate text-muted-foreground">{red.tabela}</span>
                  <span className="font-semibold text-foreground">{red.redova.toLocaleString("bs-BA")}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Layout>
  );
}
