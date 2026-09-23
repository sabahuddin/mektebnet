import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { ContactForm } from "@/components/contact-form";
import { Mail, Phone, MessageSquare } from "lucide-react";

export default function KontaktPage() {
  const { t } = useLanguage();

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
            <ContactForm />
          </div>
        </div>
      </div>
    </Layout>
  );
}
