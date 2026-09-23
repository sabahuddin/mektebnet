import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { Cookie } from "lucide-react";

export default function KolaciciPage() {
  const { t } = useLanguage();
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <Cookie className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-foreground">{t("Politika kolačića")}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t("Posljednje ažuriranje")}: septembar 2026.</p>
        </div>

        <div className="bg-white rounded-3xl border border-border/40 shadow-sm p-6 sm:p-10 space-y-8 text-[15px] leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">1. {t("Što su kolačići?")}</h2>
            <p>
              Kolačići (engl. „cookies") i lokalna pohrana preglednika čuvaju podatke na vašem uređaju.
              Koristimo ih za pristup prijavljenom nalogu i H5P vježbama te za pamćenje vaših postavki.
              Datumi potvrđivanja Uvjeta, Pravila privatnosti i izjava čuvaju se na serveru, a ne u kolačiću.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">2. {t("Koje kolačiće koristimo")}</h2>

            <h3 className="font-semibold text-foreground/90 mt-3 mb-2">2.1 Neophodni (obavezni)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 border border-border/40 font-bold">Naziv</th>
                    <th className="text-left p-2 border border-border/40 font-bold">Svrha</th>
                    <th className="text-left p-2 border border-border/40 font-bold">Trajanje</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-border/40"><code>mekteb_token</code> i <code>mekteb_user</code> (lokalna pohrana)</td>
                    <td className="p-2 border border-border/40">Prijava i osnovni podaci prijavljenog naloga</td>
                    <td className="p-2 border border-border/40">Do odjave ili brisanja podataka preglednika; token vrijedi najduže 30 dana</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-border/40"><code>mekteb_h5p_session</code> (kolačić)</td>
                    <td className="p-2 border border-border/40">Omogućava pristup zaštićenim H5P vježbama prijavljenom korisniku; nije dostupan JavaScriptu (HttpOnly)</td>
                    <td className="p-2 border border-border/40">Najduže 30 dana; briše se pri odjavi</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="font-semibold text-foreground/90 mt-4 mb-2">2.2 Funkcionalni</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 border border-border/40 font-bold">Naziv</th>
                    <th className="text-left p-2 border border-border/40 font-bold">Svrha</th>
                    <th className="text-left p-2 border border-border/40 font-bold">Trajanje</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-border/40"><code>mekteb-lang</code> (lokalna pohrana)</td>
                    <td className="p-2 border border-border/40">Pamti odabrani jezik sučelja</td>
                    <td className="p-2 border border-border/40">Trajno (do brisanja)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-border/40"><code>mekteb-fontsize</code> (lokalna pohrana)</td>
                    <td className="p-2 border border-border/40">Pamti odabranu veličinu fonta</td>
                    <td className="p-2 border border-border/40">Trajno (do brisanja)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-border/40"><code>mekteb-audio-muted</code> (lokalna pohrana)</td>
                    <td className="p-2 border border-border/40">Pamti uključenost/isključenost zvuka</td>
                    <td className="p-2 border border-border/40">Trajno (do brisanja)</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-border/40"><code>mekteb-cookie-consent</code> (lokalna pohrana)</td>
                    <td className="p-2 border border-border/40">Pamti da ste zatvorili informativnu obavijest o kolačićima</td>
                    <td className="p-2 border border-border/40">Do brisanja podataka preglednika ili promjene verzije obavijesti</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">3. {t("Kolačići trećih strana")}</h2>
            <p>
              Platforma ne koristi kolačiće za oglašavanje niti alate poput Google Analyticsa ili
              Facebook Pixela. Ukoliko korisnik omogući push obavijesti, koristi se servis OneSignal
              koji može postaviti vlastite tehničke kolačiće isključivo radi isporuke obavijesti.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">4. {t("Upravljanje kolačićima")}</h2>
            <p className="mb-2">
              Obavijest o kolačićima služi informisanju; dugme „U redu” ne uključuje opcionalno
              praćenje niti zamjenjuje potvrde Uvjeta i Pravila privatnosti. Prijava zahtijeva
              neophodnu pohranu, a promjene jezika, fonta i zvuka čuvaju se lokalno na vašem uređaju.
            </p>
            <p className="mb-2">Kolačićima možete upravljati kroz postavke vašeg preglednika:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Chrome:</strong> Postavke &gt; Privatnost i sigurnost &gt; Kolačići</li>
              <li><strong>Firefox:</strong> Postavke &gt; Privatnost i sigurnost &gt; Kolačići</li>
              <li><strong>Safari:</strong> Postavke &gt; Privatnost &gt; Kolačići</li>
              <li><strong>Edge:</strong> Postavke &gt; Kolačići i dozvole stranica</li>
            </ul>
            <p className="mt-2">
              Napomena: brisanje pohranjenih podataka može vas odjaviti i vratiti postavke na početne
              vrijednosti. Blokiranje neophodnog H5P kolačića može onemogućiti pristup H5P vježbama.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">5. {t("Izmjene")}</h2>
            <p>
              Zadržavamo pravo izmjene ove Politike kolačića. Promjene stupaju na snagu objavljivanjem
              na ovoj stranici. Preporučujemo redovno pregledanje ove stranice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">6. {t("Kontakt")}</h2>
            <p>
              Za sva pitanja vezana za kolačiće i privatnost, obratite nam se na{" "}
              <a href="mailto:info@mekteb.net" className="text-primary font-semibold hover:underline">info@mekteb.net</a>{" "}
              ili putem <a href="/kontakt" className="text-primary font-semibold hover:underline">kontakt forme</a>.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
