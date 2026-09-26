import { useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import {
  BookOpen, HelpCircle, Library, Gamepad2, GraduationCap,
  Shield, LayoutDashboard, Users, CalendarCheck, ClipboardList,
  Star, Trophy, Wrench, Target, Sparkles, FileText, KeyRound,
  Printer, ChevronRight, Hexagon, Flower2, Bird,
  Zap, Brain, MapPin, Flag, Clock, ArrowRight, Baby, MessageSquare, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const IMG = (name: string) => `${import.meta.env.BASE_URL}screenshots/vodic/${name}.jpg`;

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-10">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="text-3xl font-black text-foreground">{title}</h2>
      {subtitle && <p className="text-muted-foreground font-medium mt-2 max-w-xl mx-auto">{subtitle}</p>}
    </div>
  );
}

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="my-6">
      <img src={src} alt={alt} className="w-full rounded-2xl border border-border/40 shadow-sm" loading="lazy" />
      {caption && <p className="text-xs text-muted-foreground text-center mt-2">{caption}</p>}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color }: { icon: any; title: string; desc: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border/40 p-5 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h4 className="font-bold text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function RoleSection({
  role,
  title,
  subtitle,
  icon: Icon,
  color,
  modules,
  screenshot,
}: {
  role: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  modules: { icon: any; title: string; desc: string }[];
  screenshot?: { src: string; alt: string; caption: string };
}) {
  return (
    <section id={role} className="scroll-mt-24">
      <div className={`rounded-3xl border border-border/30 p-8 md:p-10 ${color}`}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary">
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-foreground">{title}</h3>
            <p className="text-muted-foreground font-medium">{subtitle}</p>
          </div>
        </div>

        {screenshot && <Screenshot src={screenshot.src} alt={screenshot.alt} caption={screenshot.caption} />}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m, i) => (
            <FeatureCard key={i} icon={m.icon} title={m.title} desc={m.desc} color="bg-primary" />
          ))}
        </div>
      </div>
    </section>
  );
}

function MuallimGuide() {
  const { t } = useLanguage();
  const themes = [
    {
      panel: "border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50",
      icon: "bg-teal-600",
      result: "border-teal-100 bg-white/80",
      arrow: "text-teal-600",
    },
    {
      panel: "border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50",
      icon: "bg-violet-600",
      result: "border-violet-100 bg-white/80",
      arrow: "text-violet-600",
    },
    {
      panel: "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50",
      icon: "bg-amber-500",
      result: "border-amber-100 bg-white/80",
      arrow: "text-amber-600",
    },
  ];
  const steps = [
    {
      value: "registracija",
      phase: t("POČETAK"),
      title: t("Registracija mekteba"),
      icon: Shield,
      intro: t("Otvaranjem mektebskog računa dobijaš vlastiti prostor za organizaciju nastave, muallima, grupa i učenika."),
      action: t("Na stranici Registracija izaberi Mekteb, unesi podatke mekteba i odgovorne osobe, a zatim se prijavi u Muallimski panel."),
      result: t("Mekteb dobija jedno sigurno mjesto za rad i pregled podataka, umjesto vođenja evidencije u više nepovezanih bilježnica i tabela."),
    },
    {
      value: "grupa",
      phase: t("ORGANIZACIJA"),
      title: t("Otvaranje grupe"),
      icon: Users,
      intro: t("Grupa je radni prostor jednog odjeljenja u kojem su objedinjeni učenici, plan, prisustvo, ocjene, zadaće i statistika."),
      action: t("U Muallimskom panelu otvori Grupe, izaberi Nova grupa, unesi naziv i osnovne podatke, pa otvori grupu da vidiš njen kompletan meni."),
      result: t("Kada je grupa jasno postavljena, sve informacije o njenom radu ostaju povezane i muallim ne mora tražiti podatke na više mjesta."),
    },
    {
      value: "kalendar",
      phase: t("ORGANIZACIJA"),
      title: t("Kalendar"),
      icon: CalendarCheck,
      intro: t("Kalendar prikazuje nastavne dane, događaje i važne datume povezane s mektebom i grupom."),
      action: t("Otvori Kalendar, dodaj nastavne dane i događaje, pa ih koristi kao zajednički pregled za planiranje i praćenje godine."),
      result: t("Pomaže da se nastava, izostanci i plan rada posmatraju u stvarnom vremenskom kontekstu i da se važne obaveze ne zaborave."),
    },
    {
      value: "ucenici",
      phase: t("ORGANIZACIJA"),
      title: t("Dodavanje učenika"),
      icon: GraduationCap,
      intro: t("Učenike i njihove roditelje možeš dodati pojedinačno ili masovno, a zatim ih rasporediti u odgovarajuće grupe."),
      action: t("U grupi otvori Podešavanja → Učenici grupe → Dodaj nove učenike. Unesi svakog učenika u novi red, a ime roditelja dodaj nakon zareza. Ako se pojavi isto ime i prezime, izaberi DA za istu osobu ili NE za drugu osobu."),
      result: t("Provjera se radi samo unutar istog džemata. DA preskače postojeću osobu, a NE kreira novi nalog. Ako je postojeća osoba roditelj, učenik se kreira bez novog roditelja i možeš ih spojiti naknadno."),
    },
    {
      value: "plan",
      phase: t("PLANIRANJE"),
      title: t("Plan i raspored lekcija"),
      icon: BookOpen,
      intro: t("Plan lekcija povezuje nastavne dane iz kalendara s gradivom i vrstom časa. Za svaki dan možeš planirati više časova."),
      action: t("U grupi otvori Plan lekcija, izaberi nastavni dan i za svaki čas upiši lekciju ili aktivnost. Po potrebi naknadno promijeni lekciju i vrstu časa."),
      result: t("Plan ostaje vezan za stvarni datum nastave, pa se lakše prati šta je obrađeno i šta slijedi."),
    },
    {
      value: "prisustvo",
      phase: t("TOK NASTAVE"),
      title: t("Prisustvo"),
      icon: CalendarCheck,
      intro: t("Evidencija prisustva bilježi da li je učenik prisutan, odsutan, zakasnio ili opravdano odsutan."),
      action: t("Otvori Prisustvo iz menija grupe, izaberi datum i za svakog učenika označi status. Po potrebi dodaj napomenu i sačuvaj."),
      result: t("Redovna evidencija daje pouzdanu sliku dolazaka i omogućava da se izostanci povežu s napretkom učenika."),
      screenshot: { src: IMG("muallim-prisustvo"), alt: t("Unos prisustva u muallimskoj grupi"), caption: t("Prisustvo se evidentira za odabrani datum, učenika po učenika") },
    },
    {
      value: "ocjene",
      phase: t("TOK NASTAVE"),
      title: t("Ocjene"),
      icon: Star,
      intro: t("Muallim može unositi brojčane ili opisne ocjene za obrađeno gradivo. Predmet ocjene preuzima se iz odabrane lekcije."),
      action: t("Odaberi učenika, lekciju, ocjenu i datum. Ako se ocjenjuje gradivo Napamet, označi i tu opciju."),
      result: t("Roditelj i učenik mogu vidjeti ocjene; brojčane ocjene ulaze u prosjek, a opisne služe kao povratna informacija."),
    },
    {
      value: "zadaca",
      phase: t("TOK NASTAVE"),
      title: t("Zadaća"),
      icon: ClipboardList,
      intro: t("Muallim može zadati zadaću cijeloj grupi ili pojedinom učeniku, uz opis, povezanu lekciju i rok."),
      action: t("U grupi otvori Zadaće, odaberi kome je namijenjena, upiši zadatak i rok, pa pregledaj urađene i neurađene zadaće."),
      result: t("Učenik vidi svoj zadatak, a muallim na jednom mjestu prati izvršenje i daje povratnu informaciju."),
    },
    {
      value: "zvjezdice",
      phase: t("TOK NASTAVE"),
      title: t("Zvjezdice"),
      icon: Sparkles,
      intro: t("Zvjezdice su kratka i vidljiva povratna informacija za trud, znanje, ponašanje ili druge kategorije koje muallim prati."),
      action: t("Na profilu učenika ili u grupnoj tabeli odaberi kategoriju zvjezdice, dodijeli je uz kratku procjenu i prati promjene kroz vrijeme."),
      result: t("Pomažu djeci da vide napredak i daju muallimu brz način da pohvali trud ili zabilježi važan signal tokom nastave."),
    },
    {
      value: "analiza",
      phase: t("PRAĆENJE"),
      title: t("Greške i NAPAMET"),
      icon: Wrench,
      intro: t("NAPAMET je trajno gradivo koje učenik treba usvojiti i ne zaboraviti. Muallim ga ispituje, ocjenjuje i na jednom mjestu vidi ko je koju stavku savladao."),
      action: t("Iz menija grupe otvori Gdje učenici griješe da odabereš šta treba ponoviti. Zatim u NAPAMET pregledu izaberi gradivo za ispitivanje i prati ocjene cijele grupe."),
      result: t("Centralni pregled daje jasnu sliku trajnog znanja svakog učenika, pa se ponavljanje i pomoć planiraju prema stvarnim potrebama."),
      screenshot: { src: IMG("muallim-napamet"), alt: t("Centralni NAPAMET pregled grupe"), caption: t("NAPAMET pregled pokazuje trajno gradivo i napredak cijele grupe") },
    },
    {
      value: "izvjestaji",
      phase: t("PRAĆENJE"),
      title: t("Statistika, izvještaji i roditelji"),
      icon: FileText,
      intro: t("Statistika i izvještaji objedinjuju prisustvo, ocjene, kvizove, lekcije i aktivnost učenika u razumljiv pregled."),
      action: t("Redovno otvori Statistiku ili Izvještaje, filtriraj grupu ili učenika, pregledaj zaključke i podijeli relevantne informacije s roditeljima."),
      result: t("Muallim dobija mnogo više informacija za odluke, a roditeljima može pokazati jasnu sliku rada i napretka djeteta."),
    },
  ];

  return (
    <div id="muallim" className="scroll-mt-24">
      <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-50 p-8 md:p-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-foreground">{t("Muallimski panel kao pomoć u svakodnevnom radu")}</h3>
            <p className="text-muted-foreground font-medium mt-1">
              {t("Mekteb značajno olakšava posao muallima: manje ručnog vođenja evidencije, više vremena za učenike i mnogo više korisnih informacija za svaku odluku.")}
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white/80 rounded-2xl p-5 border border-white">
            <Clock className="w-6 h-6 text-amber-600 mb-3" />
            <h4 className="font-bold text-foreground mb-1">{t("Sve na jednom mjestu")}</h4>
            <p className="text-sm text-muted-foreground">{t("Grupa, učenici, prisustvo, ocjene, zadaće i plan rada povezani su u jedan pregledan sistem.")}</p>
          </div>
          <div className="bg-white/80 rounded-2xl p-5 border border-white">
            <TrendingUp className="w-6 h-6 text-amber-600 mb-3" />
            <h4 className="font-bold text-foreground mb-1">{t("Informacije za bolju odluku")}</h4>
            <p className="text-sm text-muted-foreground">{t("Odmah vidiš ko napreduje, ko izostaje, gdje učenici griješe i kome treba dodatna podrška.")}</p>
          </div>
          <div className="bg-white/80 rounded-2xl p-5 border border-white">
            <Users className="w-6 h-6 text-amber-600 mb-3" />
            <h4 className="font-bold text-foreground mb-1">{t("Više vremena za podučavanje")}</h4>
            <p className="text-sm text-muted-foreground">{t("Kada je administracija jednostavnija, muallim može više pažnje posvetiti času i stvarnim potrebama učenika.")}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border/40 bg-white p-6 md:p-8">
        <div className="mb-5">
          <p className="text-sm font-black uppercase tracking-wider text-primary">{t("Praktični vodič")}</p>
          <h3 className="text-2xl font-black text-foreground mt-1">{t("Od registracije do svakodnevne nastave")}</h3>
        </div>
        <Accordion type="multiple" defaultValue={["registracija"]} className="border-t border-border/40">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const theme = themes[index % themes.length];
              return (
                <AccordionItem key={step.value} value={step.value}>
                  <AccordionTrigger className="gap-4 py-5 hover:no-underline">
                    <span className="flex items-center gap-4 text-left">
                      <span className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">{index + 1}</span>
                      <span>
                        <span className="block text-[11px] font-black tracking-widest text-primary mb-1">{step.phase}</span>
                        <span className="block text-base md:text-lg font-black text-foreground">{step.title}</span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <div className="pl-0 md:pl-14">
                      <div className={`rounded-2xl border p-5 md:p-6 ${theme.panel}`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 shrink-0 rounded-xl text-white flex items-center justify-center ${theme.icon}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <p className="text-sm md:text-base leading-relaxed text-foreground font-semibold">{step.intro}</p>
                        </div>
                        <div className="mt-5 flex items-start gap-3 rounded-xl bg-white/75 p-4">
                          <ArrowRight className={`mt-0.5 w-5 h-5 shrink-0 ${theme.arrow}`} />
                          <p className="text-sm leading-relaxed text-muted-foreground">{step.action}</p>
                        </div>
                      </div>
                      <div className={`mt-3 flex items-start gap-3 rounded-2xl border p-4 ${theme.result}`}>
                        <Sparkles className={`mt-0.5 w-5 h-5 shrink-0 ${theme.arrow}`} />
                        <p className="text-sm leading-relaxed text-muted-foreground">{step.result}</p>
                      </div>
                       {step.screenshot && (
                         <Screenshot
                           src={step.screenshot.src}
                           alt={step.screenshot.alt}
                           caption={step.screenshot.caption}
                         />
                       )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
        </Accordion>
      </div>
    </div>
  );
}

export default function VodicPage() {
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <div ref={printRef} className="max-w-4xl mx-auto space-y-10 md:space-y-16 print:space-y-8">
        {/* ===== HERO ===== */}
        <section className="text-center pt-0 sm:pt-4">
          <img
            src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
            alt={t("Maskota pčela")}
            className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4"
          />
          <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">
            {t("Vodič kroz")} <span className="text-primary">Mekteb</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground font-medium mt-2 md:mt-3 max-w-2xl mx-auto">
            {t("Otkrij šta na Mektebu možeš pregledati bez prijave, kako učenici uče i na koji način roditelji i muallimi prate njihov rad.")}
          </p>
          <div className="mt-5 md:mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
            <Button onClick={handlePrint} className="rounded-xl font-bold gap-2 w-full sm:w-auto">
              <Printer className="w-4 h-4" /> {t("Štampaj / Sačuvaj kao PDF")}
            </Button>
            <Button variant="outline" asChild className="rounded-xl font-bold gap-2 w-full sm:w-auto">
              <Link href="/login?tab=demo">
                <KeyRound className="w-4 h-4" /> {t("Isprobaj demo")}
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-4" aria-label={t("Šta mogu odmah uraditi?")}>
          <Link href="/kuran" className="rounded-2xl border border-teal-200 bg-teal-50 p-5 hover:border-teal-400 transition-colors">
            <BookOpen className="w-6 h-6 text-teal-700 mb-3" />
            <h2 className="font-black text-foreground">{t("Čitaj Kur'an")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("Sure i stranice Mushafa dostupne su svima, bez prijave.")}</p>
          </Link>
          <Link href="/ilmihal" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 hover:border-emerald-400 transition-colors">
            <BookOpen className="w-6 h-6 text-emerald-700 mb-3" />
            <h2 className="font-black text-foreground">{t("Pogledaj lekcije")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("Kao gost možeš pročitati prvih pet lekcija i vidjeti kako izgleda učenje.")}</p>
          </Link>
          <Link href="/login?tab=demo" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 hover:border-amber-400 transition-colors">
            <KeyRound className="w-6 h-6 text-amber-700 mb-3" />
            <h2 className="font-black text-foreground">{t("Isprobaj demo")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("Bez registracije isprobaj ulogu učenika, roditelja ili muallima.")}</p>
          </Link>
        </section>

        {/* ===== O PLATFORMI ===== */}
        <section>
          <SectionTitle
            icon={Sparkles}
            title={t("O platformi")}
            subtitle={t("Mekteb.net je digitalna islamska edukativna platforma namijenjena mektebskoj pouci, samostalnom učenju i roditeljskom praćenju napretka djece.")}
          />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> {t("Cilj platforme")}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("Povezati mektebsku pouku i samostalno učenje: učenik prolazi lekcije i kvizove, muallim organizuje nastavu, a roditelj prati rad svog djeteta. Kur'an i dio sadržaja mogu se pregledati i bez naloga.")}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" /> {t("Pedagoški pristup")}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("Tri nivoa Ilmihala vode učenika kroz lekcije, vježbe i provjere znanja. Ilustracije, audio gdje je dostupan, kvizovi i nagrade pomažu da dijete ponavlja gradivo; muallim može pratiti i usmjeravati njegov napredak.")}
              </p>
            </div>
          </div>
        </section>

        {/* ===== ZAŠTO PČELA ===== */}
        <section>
          <SectionTitle
            icon={Hexagon}
            title={t("Zašto pčela?")}
            subtitle={t("Pčela je simbol rada, discipline, zajedništva i korisnog znanja — savršen uzor za svakog učenika.")}
          />
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-foreground font-medium leading-relaxed mb-4">
                  {t("Pčela se spominje u Kur'anu (Sura En-Nahl). Naša maskota —")} <strong>{t("Mektebska pčela")}</strong> {t("— povezuje košnice, saće, kapi meda i nagrade u prepoznatljivo iskustvo učenja.")}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> {t("Radoznalost i stalno učenje")}</li>
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> {t("Rad u zajednici (košnica = mekteb)")}</li>
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> {t("Korisno znanje koje donosi blagodat (med)")}</li>
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> {t("Ustrajnost i redovnost")}</li>
                </ul>
              </div>
              <div className="flex justify-center">
                <img
                  src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
                  alt={t("Maskota pčela")}
                  className="w-48 h-48 object-contain drop-shadow-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===== GAMIFIKACIJA ===== */}
        <section>
          <SectionTitle
            icon={Gamepad2}
            title={t("Gamifikacija i napredovanje")}
            subtitle={t("Lekcije i provjere znanja donose kapi meda, igrice donose Aferime, a roditelji i muallimi mogu pratiti napredak djeteta.")}
          />

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-6">
              <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-white mb-3">
                <Trophy className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-foreground mb-1">{t("Aferimi ⭐")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("Bodovi za uspjeh u igricama. Sakupi što više Aferima igrajući igrice i takmiči se s drugima na tabeli.")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 p-6">
              <div className="w-12 h-12 bg-orange-400 rounded-xl flex items-center justify-center text-white mb-3 text-xl">
                🍯
              </div>
              <h4 className="font-bold text-foreground mb-1">{t("Kapi meda")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("Kapi meda bilježe uspjeh u učenju, lekcijama i kvizovima. Učenje otvara i vremenski kredit za igrice; sakupljene kapi ostaju prikazane kao postignuće.")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white mb-3">
                <Wrench className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-foreground mb-1">{t("Popravi saće")}</h4>
              <p className="text-sm text-muted-foreground">
                {t(`Pogrešni odgovori se ne brišu — čuvaju se u "saću grešaka". Učenik kasnije može popraviti svaku grešku i naučiti iz nje.`)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border/40 p-6 mb-6">
            <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> {t("Misije (dnevne i sedmične)")}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t("Učenik dobija izazove vezane za učenje, kvizove, popravljanje grešaka i igrice. Završene misije donose dodatne nagrade.")}
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                <BookOpen className="w-4 h-4" /> {t("Učenje")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm font-bold">
                <Zap className="w-4 h-4" /> {t("Kvizovi")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold">
                <Wrench className="w-4 h-4" /> {t("Popravljanje")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-100 text-pink-700 text-sm font-bold">
                <Gamepad2 className="w-4 h-4" /> {t("Igrice")}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <h5 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> {t("Vremenski budžet za igrice")}
              </h5>
              <p className="text-sm text-muted-foreground">
                {t("Igrice nisu beskonačno dostupne — učenik zarađuje vremenski kredit učeći (kroz kapi meda), a roditelj prati koliko vremena dijete provodi u igricama. Kada kredit istekne, vrati se učenju da bi zaradio više.")}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <h5 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Flower2 className="w-4 h-4 text-primary" /> {t("Etape i krunisanje")}
              </h5>
              <p className="text-sm text-muted-foreground">
                {t("Nivoi su podijeljeni na etape i medaljone. Učenik napreduje kroz lekcije i provjere znanja, a nakon završenog nivoa može pristupiti krunisanju.")}
              </p>
            </div>
          </div>
        </section>

        {/* ===== GLAVNI SADRŽAJI ===== */}
        <section>
          <SectionTitle
            icon={BookOpen}
            title={t("Šta možeš pronaći na platformi")}
            subtitle={t("Dio sadržaja je javan; za potpuni pristup lekcijama, kvizovima i praćenju napretka potreban je odgovarajući nalog.")}
          />

          <div className="space-y-8">
            {/* Kur'an */}
            <div className="bg-white rounded-2xl border border-border/40 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700"><BookOpen className="w-5 h-5" /></div>
                <h3 className="text-xl font-bold text-foreground">{t("Kur'an Časni")}</h3>
                <span className="ml-auto rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">{t("Bez prijave")}</span>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                {t("Čitaj sure ili listaj Mushaf po stranicama, pretraži nazive sura i slušaj dostupne učače. Kur'an je otvoren svim posjetiocima.")}
              </p>
              <Link href="/kuran" className="text-sm font-bold text-primary hover:underline">{t("Otvori Kur'an")} <ArrowRight className="inline w-4 h-4" /></Link>
            </div>

            {/* Ilmihal */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{t("Ilmihal")}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("Ilmihal vodi kroz tri nivoa: Malu Košnicu, Zlatnu Košnicu i Košnicu Mudrosti. Lekcije imaju tekst i ilustracije, a pojedine i audio, vježbe ili kviz. Mapa prikazuje redoslijed, medaljone i etape. Gost može otvoriti prvih pet lekcija; za daljnji napredak potreban je nalog učenika.")}
                </p>
                <Screenshot src={IMG("ilmihal")} alt={t("Ilmihal — izbor košnice")} caption={t("Tri nivoa košnica prilagođena dobi i znanju")} />
                <Screenshot src={IMG("nivo1-mapa")} alt={t("Mapa puta")} caption={t("Mapa puta — svaki cvjetić je jedna lekcija, a heksagoni su etape")} />
              </div>
            </div>

            {/* Kvizovi */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{t("Kvizovi")}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {t(`Kvizovi i provjere znanja prate gradivo iz različitih nivoa i oblasti. Učenik zarađuje kapi meda za znanje, a greške može ponoviti u "Popravi saće". Poseban pregled banke kvizova namijenjen je administratoru; učenik do provjera dolazi kroz učenje.`)}
                </p>
              </div>
            </div>

            {/* Čitaonica */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                    <Library className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{t("Čitaonica")}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("Ilustrovane knjige i priče za djecu, uključujući kazivanja o poslanicima i islamskim uzorima. Knjige se otvaraju po poglavljima, a dostupnost pojedinog sadržaja zavisi od vrste naloga.")}
                </p>
                <Screenshot src={IMG("citaonica")} alt={t("Čitaonica")} caption={t("Knjige u čitaonici sa ilustracijama i statusom čitanja")} />
              </div>
            </div>

            {/* Igrice */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{t("Igrice")}</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {t("Sedam igrica: Pamti par, Brzi kviz, Glavni gradovi, Zastave svijeta, Mektebsko saće, Medena staza i Pčelin let. Učenik igrom osvaja Aferime, a vrijeme za igru zarađuje učenjem. Tabela Aferima prikazuje rezultate — nije dodatna igrica.")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Brain, label: t("Pamti par") },
                    { icon: Zap, label: t("Brzi kviz") },
                    { icon: MapPin, label: t("Glavni gradovi") },
                    { icon: Flag, label: t("Zastave") },
                    { icon: Hexagon, label: t("Mektebsko saće") },
                    { icon: Flower2, label: t("Medena staza") },
                    { icon: Bird, label: t("Pčelin let") },
                  ].map((g, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 text-sm font-bold text-foreground">
                      <g.icon className="w-4 h-4 text-primary" /> {g.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sira — zaseban sajt, bez zajedničkog naloga */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
                    <Library className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{t("Sira — zasebni kvizovi")}</h3>
                  <span className="ml-auto px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-bold">{t("Zasebna stranica")}</span>
                </div>
                <p className="text-muted-foreground text-sm mb-3">
                  {t("Kvizovi o životu Poslanika dostupni su na zasebnoj stranici. To nije isti nalog ni isti napredak kao na Mekteb.net; rezultati te stranice čuvaju se na uređaju na kojem se kviz igra.")}
                </p>
                <a href="https://sira.mekteb.net" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-primary hover:underline">{t("Otvori Sira kvizove")} <ArrowRight className="inline w-4 h-4" /></a>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 3 ROLE ===== */}
        <section>
          <SectionTitle
            icon={Users}
            title={t("Vodič po ulozi")}
            subtitle={t("Izaberi svoju ulogu i upoznaj alate koji su napravljeni baš za tvoj svakodnevni rad.")}
          />

          <Tabs defaultValue="ucenik" className="w-full">
            <TabsList className="w-full h-auto grid grid-cols-3 gap-1 p-1.5 rounded-2xl bg-muted/60">
              <TabsTrigger value="ucenik" className="min-h-14 gap-2 text-sm md:text-base font-black">
                <GraduationCap className="w-5 h-5" /> {t("Učenik")}
              </TabsTrigger>
              <TabsTrigger value="roditelj" className="min-h-14 gap-2 text-sm md:text-base font-black">
                <Baby className="w-5 h-5" /> {t("Roditelj")}
              </TabsTrigger>
              <TabsTrigger value="muallim" className="min-h-14 gap-2 text-sm md:text-base font-black">
                <Shield className="w-5 h-5" /> {t("Muallim")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ucenik" className="mt-6">
              <RoleSection
                role="ucenik"
                title={t("Učenik")}
                subtitle={t("Glavni korisnik platforme — uči, rješava kvizove, igra igrice i napreduje kroz košnice.")}
                icon={GraduationCap}
                color="bg-emerald-50/50"
                modules={[
                  { icon: BookOpen, title: t("Ilmihal lekcije"), desc: t("Tri nivoa lekcija, mapa puta, medaljoni, etape i provjere znanja.") },
                  { icon: HelpCircle, title: t("Kvizovi"), desc: t("Provjeri znanje, osvoji kapi meda i vrati se greškama radi ponavljanja.") },
                  { icon: Library, title: t("Čitaonica"), desc: t("Čitaj ilustrovane priče i knjige za djecu, poglavlje po poglavlje.") },
                  { icon: Gamepad2, title: t("Igrice"), desc: t("Sedam igrica, vremenski kredit za igru i posebna tabela Aferima.") },
                  { icon: BookOpen, title: t("Kur'an"), desc: t("Čitaj sure i Mushaf po stranicama ili slušaj učače, i bez prijave.") },
                  { icon: Wrench, title: t("Popravi saće"), desc: t("Ponovi i popravi svaku grešku iz prethodnih kvizova.") },
                  { icon: Target, title: t("Misije"), desc: t("Dnevni i sedmični izazovi sa nagradama.") },
                  { icon: Trophy, title: t("Tabela"), desc: t("Takmiči se i uporedi svoj rezultat s drugim učenicima u grupi.") },
                  { icon: ClipboardList, title: t("Moje zadaće"), desc: t("Vidi šta je muallim zadao, rok i status svake zadaće.") },
                  { icon: Star, title: t("Moje ocjene"), desc: t("Pregledaj ocjene, komentar muallima i gradivo na koje se odnose.") },
                  { icon: Sparkles, title: t("Moje zvjezdice"), desc: t("Prati pohvale i zvjezdice koje dobijaš za trud, znanje i ponašanje.") },
                  { icon: MessageSquare, title: t("Poruke muallima"), desc: t("Pročitaj obavijesti i komuniciraj s muallimom kada ti treba pomoć.") },
                  { icon: Star, title: t("Moj profil"), desc: t("Pregled napretka, statistike, završenih lekcija i osvojenih nagrada.") },
                ]}
                screenshot={{ src: IMG("nivo1-mapa"), alt: t("Mapa puta učenika"), caption: t("Učenik kreće od lekcije 1 i napreduje kroz mapu puta") }}
              />
            </TabsContent>

            <TabsContent value="roditelj" className="mt-6">
              <RoleSection
                role="roditelj"
                title={t("Roditelj")}
                subtitle={t("Praćenje napretka djece, komunikacija sa muallimom i organizacija obaveza.")}
                icon={Baby}
                color="bg-blue-50/50"
                modules={[
                  { icon: LayoutDashboard, title: t("Roditeljski panel"), desc: t("Pregled svih djece, njihovog napretka, prisustva i ocjena na jednom mjestu.") },
                  { icon: Star, title: t("Ocjene djeteta"), desc: t("Za svako dijete vidi ocjene, vrstu ocjene, komentar muallima i gradivo koje je ocijenjeno.") },
                  { icon: CalendarCheck, title: t("Kalendar"), desc: t("Pregled mektebskih događaja, dana nastave i važnih datuma.") },
                  { icon: ClipboardList, title: t("Zadaće"), desc: t("Pregled aktivnih zadaća za svako dijete sa rokovima i statusom.") },
                  { icon: TrendingUp, title: t("Napredak djece"), desc: t("Prati završene lekcije, kvizove i postignuća svakog djeteta.") },
                  { icon: FileText, title: t("Izvještaji"), desc: t("Detaljni izvještaji o prisustvu, ocjenama, kvizovima i napretku.") },
                  { icon: MessageSquare, title: t("Poruke"), desc: t("Direktna komunikacija sa muallimom i administracijom.") },
                ]}
              />
            </TabsContent>

            <TabsContent value="muallim" className="mt-6">
              <MuallimGuide />
            </TabsContent>
          </Tabs>
        </section>

        {/* ===== KAKO ZAPOČETI ===== */}
        <section>
          <SectionTitle
            icon={ArrowRight}
            title={t("Kako započeti?")}
          />
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-border/40 p-6 text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-black">1</div>
              <h4 className="font-bold text-foreground mb-1">{t("Razgledaj")}</h4>
              <p className="text-sm text-muted-foreground">{t("Prvo pogledaj javni sadržaj ili isprobaj demo bez registracije.")}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-6 text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-black">2</div>
              <h4 className="font-bold text-foreground mb-1">{t("Izaberi pristup")}</h4>
              <p className="text-sm text-muted-foreground">{t("Otvori račun za učenika, porodicu ili mekteb. Registracija uključuje 30 dana probnog pristupa; zatim se pristup plaća prema odabranoj pretplati.")}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-6 text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-black">3</div>
              <h4 className="font-bold text-foreground mb-1">{t("Kreni s radom")}</h4>
              <p className="text-sm text-muted-foreground">{t("Učenik uči i vježba, roditelj prati dijete, a muallim planira nastavu i vodi grupu.")}</p>
            </div>
          </div>
        </section>

        {/* ===== FOOTER CTA ===== */}
        <section className="text-center pb-8">
          <div className="bg-primary/5 rounded-3xl border border-primary/10 p-8 md:p-10">
            <img
              src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
              alt={t("Pčela")}
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-2xl font-black text-foreground mb-2">{t("Spreman za let?")}</h3>
            <p className="text-muted-foreground font-medium mb-6 max-w-lg mx-auto">
              {t("Istraži javni sadržaj ili isprobaj demo. Kada odlučiš kako želiš koristiti Mekteb, odaberi račun za sebe, svoju porodicu ili mekteb.")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
              <Button asChild size="lg" className="rounded-xl font-bold">
                <Link href="/registracija">{t("Otvori račun")}</Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="rounded-xl font-bold">
                <Link href="/login?tab=demo">{t("Demo prijava")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, footer, .print\\:hidden, button { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
          img { max-width: 100% !important; page-break-inside: avoid; }
          section { page-break-inside: avoid; margin-bottom: 1rem !important; }
          h1, h2, h3 { page-break-after: avoid; }
        }
      `}</style>
    </Layout>
  );
}
