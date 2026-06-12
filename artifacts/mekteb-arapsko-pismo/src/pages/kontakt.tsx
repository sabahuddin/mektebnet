import { useState } from "react";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, Send, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function KontaktPage() {
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

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-foreground">{t("Kontakt")}</h1>
          <p className="text-muted-foreground mt-2">{t("Imate pitanje ili prijedlog? Javite nam se!")}</p>
        </div>

        <div className="grid md:grid-cols-[1fr_1.6fr] gap-6">
          <div className="bg-white rounded-3xl border border-border/40 shadow-sm p-6 flex flex-col gap-4">
            <h2 className="font-bold text-foreground">{t("Kontakt podaci")}</h2>
            <a href="mailto:info@mekteb.net" className="flex items-center gap-3 group">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                <Mail className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">{t("Email")}</span>
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">info@mekteb.net</span>
              </span>
            </a>
            <a href="https://wa.me/387603202010" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                <Phone className="w-5 h-5" />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">WhatsApp</span>
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">+387 60 320 20 10</span>
              </span>
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {t("Za pitanja o pretplati, tehničku podršku ili saradnju, slobodno nam pišite. Trudimo se odgovoriti što prije.")}
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-border/40 shadow-sm p-6 sm:p-8">
            {done ? (
              <div className="flex flex-col items-center text-center gap-4 py-8">
                <CheckCircle2 className="w-14 h-14 text-emerald-600" />
                <div>
                  <p className="font-bold text-foreground mb-1">{t("Poruka poslana!")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("Hvala vam — javit ćemo vam se u najkraćem roku.")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setDone(false);
                    setIme(""); setEmail(""); setPredmet(""); setPoruka("");
                  }}
                >
                  {t("Pošalji novu poruku")}
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </motion.div>
                )}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Ime i prezime")}</label>
                    <Input
                      value={ime}
                      onChange={e => setIme(e.target.value)}
                      placeholder={t("Vaše ime i prezime")}
                      className="h-12 rounded-xl border-border/70 font-medium"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Email")}</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="vas@email.com"
                      className="h-12 rounded-xl border-border/70 font-medium"
                      maxLength={160}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Predmet")}</label>
                    <Input
                      value={predmet}
                      onChange={e => setPredmet(e.target.value)}
                      placeholder={t("Tema vaše poruke")}
                      className="h-12 rounded-xl border-border/70 font-medium"
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-muted-foreground mb-1.5 block">{t("Poruka")}</label>
                    <Textarea
                      value={poruka}
                      onChange={e => setPoruka(e.target.value)}
                      placeholder={t("Vaša poruka...")}
                      className="min-h-[140px] rounded-xl border-border/70 font-medium resize-y"
                      maxLength={5000}
                      required
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full h-12 rounded-xl text-base font-bold mt-1" disabled={isLoading}>
                    {isLoading ? t("Slanje...") : (<><Send className="w-4 h-4 mr-2" /> {t("Pošalji poruku")}</>)}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
