import { useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/language";
import { ArrowLeft, Upload, Loader2, CheckCircle, AlertTriangle, Wand2 } from "lucide-react";

// Admin AI uvoz kviza — paste JSON od Anthropic/Claude i jednim klikom
// kreiraš kompletan kviz sa pitanjima u banci.

export default function AdminAiImportPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [jsonText, setJsonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const parsePreview = () => {
    setError(null);
    setPreview(null);
    try {
      const data = JSON.parse(jsonText.trim());
      if (!data.naslov || !data.slug || !Array.isArray(data.pitanja)) {
        setError(t("JSON mora sadržavati: naslov, slug, pitanja (niz)"));
        return;
      }
      setPreview({
        naslov: data.naslov,
        slug: data.slug,
        ukupno: data.pitanja.length,
        kategorija: data.kategorija || t("(nije postavljeno)"),
      });
    } catch {
      setError(t("Nevalidan JSON format"));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    let data: any;
    try {
      data = JSON.parse(jsonText.trim());
    } catch {
      setError(t("Nevalidan JSON"));
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<any>("POST", "/admin/kvizovi/ai-import", data, token!);
      toast({ title: t("Kviz importovan"), description: t(`"{naslov}" — {n} pitanja`, { naslov: result.naslov, n: String(result.ukupnoPitanja) }) });
      setJsonText("");
      setPreview(null);
      setLocation(`/admin/kviz/${result.kvizId}`);
    } catch (err: any) {
      toast({ title: t("Greška"), description: err?.message || t("Import nije uspio"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation("/admin"); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {t("Nazad na admin")}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-foreground">{t("AI uvoz kviza")}</h1>
            <p className="text-sm text-muted-foreground">{t("Nalepi JSON od Anthropic/Claude i klikni Import.")}</p>
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">{t("JSON kviza")}</label>
            <textarea
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder={`{\n  "naslov": "Allah i Njegova ljepota",\n  "slug": "allah_ljepota",\n  "kategorija": "akaid",\n  "tagovi": ["allah"],\n  "pitanja": [\n    {\n      "pitanje": "Ko je stvorio svemir?",\n      "opcije": ["Allah", "Muhamed", "Ibrahim"],\n      "correctIndex": 0,\n      "vrsta": "single",\n      "kategorija": "akaid",\n      "tagovi": ["allah"],\n      "tezina": 1,\n      "objasnjenje": "Allah je jedini stvoritelj."\n    }\n  ]\n}`}
              rows={18}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={parsePreview}
              disabled={!jsonText.trim() || saving}
              className="px-4 py-2 rounded-xl border border-border font-semibold text-sm hover:bg-muted disabled:opacity-50"
            >
              {t("Provjeri")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!jsonText.trim() || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {saving ? t("Importujem...") : t("Importuj kviz")}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {preview && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{preview.naslov}</span>
              <span className="text-muted-foreground">({preview.slug}) · {preview.ukupno} pitanja · {preview.kategorija}</span>
            </div>
          )}
        </div>

        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          <p className="font-semibold mb-1">{t("Kako koristiti:")}</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>{t("Pošalji Anthropic/Claude template (vidi ispod) da generiše kviz.")}</li>
            <li>{t("Kopiraj JSON odgovor i nalepi ovdje.")}</li>
            <li>{t(`Klikni "Importuj kviz" — kviz i pitanja se automatski kreiraju.`)}</li>
            <li>{t("Ako pitanje već postoji u banci (isti tekst), koristi se postojeći ID.")}</li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}
