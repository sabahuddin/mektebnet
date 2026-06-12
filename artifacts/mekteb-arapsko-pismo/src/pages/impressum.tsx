import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { Info, Mail, Globe, Phone } from "lucide-react";

export default function ImpressumPage() {
  const { t } = useLanguage();
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <Info className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-foreground">{t("Impressum")}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t("Informacije o izdavaču")}</p>
        </div>

        <div className="bg-white rounded-3xl border border-border/40 shadow-sm p-6 sm:p-10 space-y-8 text-[15px] leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">{t("O platformi")}</h2>
            <p>
              Mekteb.net je islamska edukativna platforma namijenjena djeci mektebske dobi,
              muallimima, roditeljima i mektebskim ustanovama. Platforma objedinjuje učenje ilmihala,
              Kur'ana i arapskog pisma, kvizove, čitaonicu, edukativne igre te alate za praćenje
              napretka i prisustva.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">{t("Izdavač i vlasnik")}</h2>
            <p>
              Platformu razvija i održava tim Mekteb.net. Za sve formalne i poslovne upite stojimo
              vam na raspolaganju putem kontakt podataka navedenih ispod.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">{t("Kontakt podaci")}</h2>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Mail className="w-4 h-4" />
                </span>
                <a href="mailto:info@mekteb.net" className="text-primary font-semibold hover:underline">info@mekteb.net</a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Phone className="w-4 h-4" />
                </span>
                <a href="https://wa.me/387603202010" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">+387 60 320 20 10</a>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Globe className="w-4 h-4" />
                </span>
                <a href="https://mekteb.net" className="text-primary font-semibold hover:underline">mekteb.net</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">{t("Autorska prava")}</h2>
            <p>
              Sav sadržaj objavljen na Platformi zaštićen je autorskim pravima. Više informacija
              dostupno je u <a href="/uvjeti" className="text-primary font-semibold hover:underline">Uvjetima korištenja</a>,{" "}
              <a href="/privatnost" className="text-primary font-semibold hover:underline">Pravilima privatnosti</a> i{" "}
              <a href="/kolacici" className="text-primary font-semibold hover:underline">Politici kolačića</a>.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
