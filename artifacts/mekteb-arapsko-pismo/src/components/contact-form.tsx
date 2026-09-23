import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ContactForm() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [ime, setIme] = useState("");
  const [email, setEmail] = useState("");
  const [predmet, setPredmet] = useState("");
  const [poruka, setPoruka] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ime.trim() || !email.trim() || !poruka.trim()) {
      setError(t("Molimo popunite ime, email i poruku."));
      return;
    }
    setIsLoading(true);
    try {
      await apiRequest("POST", "/content/kontakt", {
        ime: ime.trim(),
        email: email.trim(),
        predmet: predmet.trim(),
        poruka: poruka.trim(),
      });
      setDone(true);
      toast({
        title: t("Poruka poslana!"),
        description: t("Hvala vam — javit ćemo vam se u najkraćem roku."),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Greška pri slanju poruke."));
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-8">
        <CheckCircle2 className="w-14 h-14 text-emerald-600" />
        <div>
          <p className="font-bold text-foreground mb-1">{t("Poruka poslana!")}</p>
          <p className="text-sm text-muted-foreground">{t("Hvala vam — javit ćemo vam se u najkraćem roku.")}</p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => {
          setDone(false);
          setIme(""); setEmail(""); setPredmet(""); setPoruka("");
        }}>
          {t("Pošalji novu poruku")}
        </Button>
      </div>
    );
  }

  return (
    <>
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </motion.div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="kontakt-ime" className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Ime i prezime")}</label>
          <Input id="kontakt-ime" value={ime} onChange={e => setIme(e.target.value)}
            placeholder={t("Vaše ime i prezime")} className="h-12 rounded-xl border-border/70 font-medium" maxLength={120} required />
        </div>
        <div>
          <label htmlFor="kontakt-email" className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Email")}</label>
          <Input id="kontakt-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="vas@email.com" className="h-12 rounded-xl border-border/70 font-medium" maxLength={160} required />
        </div>
        <div>
          <label htmlFor="kontakt-predmet" className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Predmet")}</label>
          <Input id="kontakt-predmet" value={predmet} onChange={e => setPredmet(e.target.value)}
            placeholder={t("Tema vaše poruke")} className="h-12 rounded-xl border-border/70 font-medium" maxLength={200} />
        </div>
        <div>
          <label htmlFor="kontakt-poruka" className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Poruka")}</label>
          <Textarea id="kontakt-poruka" value={poruka} onChange={e => setPoruka(e.target.value)}
            placeholder={t("Vaša poruka...")} className="min-h-[140px] rounded-xl border-border/70 font-medium resize-y" maxLength={5000} required />
        </div>
        <Button type="submit" size="lg" className="w-full h-12 rounded-xl text-base font-bold mt-1" disabled={isLoading}>
          {isLoading ? t("Slanje...") : (<><Send className="w-4 h-4 mr-2" /> {t("Pošalji poruku")}</>)}
        </Button>
      </form>
    </>
  );
}