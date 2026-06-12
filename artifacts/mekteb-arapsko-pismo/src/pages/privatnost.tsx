import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { ShieldCheck } from "lucide-react";

export default function PrivatnostPage() {
  const { t } = useLanguage();
  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-foreground">{t("Pravila privatnosti")}</h1>
          <p className="text-sm text-muted-foreground mt-2">{t("Posljednje ažuriranje")}: {t("juni 2026.")}</p>
        </div>

        <div className="bg-white rounded-3xl border border-border/40 shadow-sm p-6 sm:p-10 space-y-8 text-[15px] leading-relaxed text-foreground/80">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">1. {t("Uvod")}</h2>
            <p>
              Tim Mekteb.net (u daljnjem tekstu: „Vlasnik") posvećen je zaštiti privatnosti korisnika
              platforme Mekteb.net (u daljnjem tekstu: „Platforma"). Ova Pravila privatnosti objašnjavaju
              koje podatke prikupljamo, kako ih koristimo i koje mjere poduzimamo za njihovu zaštitu.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">2. {t("Koje podatke prikupljamo")}</h2>
            <h3 className="font-semibold text-foreground/90 mt-3 mb-1">2.1 Podaci o registraciji</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Korisničko ime i ime i prezime</li>
              <li>Email adresa (za muallime, roditelje i administratore)</li>
              <li>Lozinka (pohranjena u šifriranom obliku)</li>
              <li>Korisnička uloga (učenik, muallim, roditelj, administrator)</li>
              <li>Pripadnost mektebu/grupi</li>
            </ul>
            <h3 className="font-semibold text-foreground/90 mt-3 mb-1">2.2 Podaci o korištenju</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Rezultati kvizova i skupljeni bodovi (hasanati, kapi meda)</li>
              <li>Napredak kroz lekcije, medaljoni i prisustvo</li>
              <li>Poruke razmijenjene unutar Platforme</li>
              <li>Datum i vrijeme aktivnosti na Platformi</li>
            </ul>
            <h3 className="font-semibold text-foreground/90 mt-3 mb-1">2.3 Tehnički podaci</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>IP adresa</li>
              <li>Tip preglednika i uređaja</li>
              <li>Podaci o sesiji (lokalna pohrana)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">3. {t("Kako koristimo podatke")}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Pružanje i poboljšanje usluga Platforme</li>
              <li>Upravljanje korisničkim računom i autentifikaciju</li>
              <li>Praćenje napretka u učenju i bodovanje</li>
              <li>Omogućavanje muallimima praćenje napretka učenika</li>
              <li>Omogućavanje roditeljima uvid u aktivnosti djeteta</li>
              <li>Komunikaciju s korisnicima (odgovori na upite, obavijesti)</li>
              <li>Sigurnost i zaštitu od zloupotrebe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">4. {t("Zaštita podataka djece")}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Račune za djecu kreiraju muallimi ili roditelji/staratelji.</li>
              <li>Ne prikupljamo više podataka nego što je neophodno za funkcioniranje Platforme.</li>
              <li>Podaci djece nisu javno vidljivi izvan Platforme.</li>
              <li>Na rang-listama se prikazuju samo korisničko ime i bodovi.</li>
              <li>Povezivanje roditelja s djetetom zahtijeva odobrenje muallima.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">5. {t("Dijeljenje podataka")}</h2>
            <p className="mb-2">
              Vaše podatke ne prodajemo, ne iznajmljujemo i ne dijelimo s trećim stranama, osim u
              sljedećim slučajevima:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>kada je to zakonski obavezno (sudski nalog, zakonska obaveza);</li>
              <li>muallimima — ograničen pristup podacima o napretku njihovih učenika;</li>
              <li>roditeljima — pristup podacima o napretku vlastite djece (nakon odobrenja);</li>
              <li>administratorima mekteba — agregirane statistike.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">6. {t("Sigurnost podataka")}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Lozinke se pohranjuju koristeći savremene kriptografske algoritme.</li>
              <li>Zaštita od automatiziranih napada (ograničavanje broja pokušaja).</li>
              <li>Sanitizacija korisničkih unosa.</li>
              <li>Sigurne sesije i autorizovani pristup zaštićenim sadržajima.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">7. {t("Vaša prava")}</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Pristup</strong> — možete zatražiti uvid u podatke koje imamo o vama.</li>
              <li><strong>Ispravku</strong> — možete zatražiti ispravku netačnih podataka.</li>
              <li><strong>Brisanje</strong> — možete zatražiti brisanje računa i podataka.</li>
              <li><strong>Prigovor</strong> — možete uložiti prigovor na obradu vaših podataka.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">8. {t("Čuvanje podataka")}</h2>
            <p>
              Vaše podatke čuvamo dok je korisnički račun aktivan ili dok su potrebni za pružanje
              usluga. Nakon brisanja računa, podaci se trajno uklanjaju u razumnom roku, osim ako
              zakon nalaže duže čuvanje.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">9. {t("Izmjene politike privatnosti")}</h2>
            <p>
              Zadržavamo pravo izmjene ovih Pravila privatnosti. O značajnim promjenama korisnici će
              biti obaviješteni putem Platforme. Preporučujemo redovno pregledanje ove stranice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-2">10. {t("Kontakt")}</h2>
            <p>
              Za sva pitanja vezana za privatnost i zaštitu podataka, obratite nam se na{" "}
              <a href="mailto:info@mekteb.net" className="text-primary font-semibold hover:underline">info@mekteb.net</a>{" "}
              ili putem <a href="/kontakt" className="text-primary font-semibold hover:underline">kontakt forme</a>.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
