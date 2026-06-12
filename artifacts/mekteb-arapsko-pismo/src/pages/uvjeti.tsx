import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { FileText } from "lucide-react";

export default function UvjetiPage() {
  const { t } = useLanguage();
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-foreground">{t("Uvjeti korištenja")}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t("Posljednje ažuriranje")}: {t("juni 2026.")}</p>
        </div>

        <div className="bg-white rounded-3xl border border-border/40 shadow-sm p-6 sm:p-10 space-y-8 text-[15px] leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">1. {t("Opći uvjeti")}</h2>
            <p>
              Korištenjem platforme Mekteb.net (u daljnjem tekstu: „Platforma") prihvaćate ove
              Uvjete korištenja u cijelosti. Platforma je u vlasništvu i pod upravljanjem tima
              Mekteb.net (u daljnjem tekstu: „Vlasnik"). Ako se ne slažete s bilo kojim dijelom
              ovih uvjeta, molimo vas da ne koristite Platformu.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">2. {t("Opis usluge")}</h2>
            <p>
              Mekteb.net je islamska edukativna platforma namijenjena djeci mektebske dobi,
              muallimima, roditeljima i mektebskim ustanovama. Platforma omogućava učenje ilmihala,
              Kur'ana i arapskog pisma, rješavanje kvizova, pristup čitaonici, edukativne igre,
              praćenje napretka i prisustva, te komunikaciju između muallima, učenika i roditelja.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">3. {t("Registracija i korisnički račun")}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Za korištenje većine funkcionalnosti Platforme potrebna je registracija.</li>
              <li>Platforma razlikuje uloge: učenik, muallim, roditelj i administrator.</li>
              <li>Račune za djecu kreiraju muallimi ili roditelji/staratelji.</li>
              <li>Korisnik je dužan pružiti tačne podatke i čuvati povjerljivost svoje lozinke.</li>
              <li>Vlasnik zadržava pravo da odbije ili ukine korisnički račun u slučaju kršenja uvjeta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">4. {t("Korištenje Platforme")}</h2>
            <p className="mb-2">Korisnici se obavezuju da će:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>koristiti Platformu u skladu sa zakonom i ovim uvjetima;</li>
              <li>ne zloupotrebljavati Platformu za nezakonitu ili štetnu aktivnost;</li>
              <li>ne pokušavati neovlašteno pristupiti tuđim računima ili podacima;</li>
              <li>ne ometati rad Platforme tehničkim ili drugim sredstvima;</li>
              <li>poštovati autorska prava na sadržaj objavljen na Platformi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">5. {t("Intelektualno vlasništvo")}</h2>
            <p>
              Sav sadržaj na Platformi — tekstovi, lekcije, slike, ilustracije, logotipi, kvizovi,
              dizajn i softver — zaštićen je autorskim pravima. Nije dozvoljeno kopiranje,
              distribucija ili modifikacija sadržaja bez prethodne pisane suglasnosti Vlasnika.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">6. {t("Bodovi i nagrade")}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Bodovi skupljeni na Platformi (hasanati, kapi meda, aferimi, medaljoni i sl.) nemaju novčanu vrijednost i ne mogu se zamijeniti za novac.</li>
              <li>Vlasnik zadržava pravo promjene sistema bodovanja i nagrađivanja u bilo kojem trenutku.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">7. {t("Pretplate i plaćanja")}</h2>
            <p>
              Pristup Platformi za mektebe i muallime ostvaruje se kroz pretplatničke pakete.
              Broj muallima i učenika definisan je odabranim paketom. Vlasnik zadržava pravo
              promjene cijena uz prethodnu obavijest korisnicima. Pretplate se mogu otkazati u
              skladu sa uslovima navedenim prilikom kupovine.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">8. {t("Ograničenje odgovornosti")}</h2>
            <p>
              Platforma se pruža „kakva jest" bez garancija bilo koje vrste. Vlasnik ne garantuje
              neprekidan ili bezgrešan rad Platforme i nije odgovoran za štetu nastalu korištenjem
              ili nemogućnošću korištenja Platforme, u mjeri u kojoj to zakon dozvoljava.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">9. {t("Izmjene uvjeta")}</h2>
            <p>
              Vlasnik zadržava pravo izmjene ovih Uvjeta korištenja. O značajnim promjenama
              korisnici će biti obaviješteni putem Platforme ili emaila. Nastavak korištenja nakon
              objave izmjena smatra se prihvaćanjem novih uvjeta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">10. {t("Raskid")}</h2>
            <p>
              Korisnik može u svakom trenutku zatražiti brisanje svog korisničkog računa putem
              kontakt forme ili emaila. Vlasnik zadržava pravo da suspenduje ili obriše korisnički
              račun u slučaju kršenja ovih uvjeta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">11. {t("Kontakt")}</h2>
            <p>
              Za sva pitanja vezana za ove Uvjete korištenja, obratite nam se na{" "}
              <a href="mailto:info@mekteb.net" className="text-primary font-semibold hover:underline">info@mekteb.net</a>{" "}
              ili putem <a href="/kontakt" className="text-primary font-semibold hover:underline">kontakt forme</a>.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
