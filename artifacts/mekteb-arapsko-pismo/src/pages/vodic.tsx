import { useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import {
  BookOpen, HelpCircle, Library, Gamepad2, GraduationCap,
  Shield, LayoutDashboard, Users, CalendarCheck, ClipboardList,
  Star, Trophy, Wrench, Target, Sparkles, FileText, KeyRound,
  Printer, Download, ChevronRight, Hexagon, Flower2, Bird,
  Zap, Brain, MapPin, Flag, Clock, ArrowRight, Baby, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function VodicPage() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <div ref={printRef} className="max-w-4xl mx-auto space-y-16 print:space-y-8">
        {/* ===== HERO ===== */}
        <section className="text-center pt-4">
          <img
            src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
            alt="Maskota pčela"
            className="w-24 h-24 mx-auto mb-4"
          />
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Vodič kroz <span className="text-primary">Mekteb</span>
          </h1>
          <p className="text-lg text-muted-foreground font-medium mt-3 max-w-2xl mx-auto">
            Kompletan pregled islamske edukativne platforme — što nudi, kako funkcionira i kako svaka uloga koristi alate za učenje.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3 print:hidden">
            <Button onClick={handlePrint} className="rounded-xl font-bold gap-2">
              <Printer className="w-4 h-4" /> Preuzmi PDF / Printaj
            </Button>
            <Button variant="outline" asChild className="rounded-xl font-bold gap-2">
              <Link href="/login">
                <Download className="w-4 h-4" /> Isprobaj platformu
              </Link>
            </Button>
          </div>
        </section>

        {/* ===== O PLATFORMI ===== */}
        <section>
          <SectionTitle
            icon={Sparkles}
            title="O platformi"
            subtitle="Mekteb.net je digitalna islamska edukativna platforma namijenjena mektebskoj pouci, samostalnom učenju i roditeljskom praćenju napretka djece."
          />
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Cilj platforme
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Omogućiti svakom djetetu pristup kvalitetnom islamskom obrazovanju bez obzira na to gdje živi. Platforma kombinuje tradicionalnu mektebsku nastavu sa modernom tehnologijom — interaktivne lekcije, kvizove, priče i edukativne igrice motiviraju učenike da uče redovno i s radošću.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-6">
              <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" /> Pedagoški pristup
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Sadržaj je usklađen sa suvremenim pedagoškim standardima: mikro-učenje (kratke lekcije), vizualno učenje (ilustracije i animacije), gamifikacija (nagrade i igrice), te diferencirana nastava (prilagođeno dobi i nivou znanja). Svaka lekcija prolazi kroz etape: uvod, sadržaj, kviz i ponavljanje.
              </p>
            </div>
          </div>
          <Screenshot src={IMG("home")} alt="Početna stranica" caption="Početna stranica sa pregledom svih modula" />
        </section>

        {/* ===== ZAŠTO PČELA ===== */}
        <section>
          <SectionTitle
            icon={Hexagon}
            title="Zašto pčela?"
            subtitle="Pčela je simbol rada, discipline, zajedništva i korisnog znanja — savršen uzor za svakog učenika."
          />
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-foreground font-medium leading-relaxed mb-4">
                  U islamskoj tradiciji pčele su spomenute u Kur'anu (Sura En-Nahl) kao primjer organizacije, predanosti i korisnosti. Naša maskota — <strong>Mektebska pčela</strong> — prati učenike kroz cijelu platformu: slavi uspjehe, podsjeća na zadaće, bodri kod grešaka i leti bočno kroz ekran kao znatiželjan pratilac.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> Radoznalost i stalno učenje</li>
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> Rad u zajednici (košnica = mekteb)</li>
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> Korisno znanje koje donosi blagodat (med)</li>
                  <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" /> Ustrajnost i redovnost</li>
                </ul>
              </div>
              <div className="flex justify-center">
                <img
                  src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
                  alt="Maskota pčela"
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
            title="Gamifikacija i napredovanje"
            subtitle="Učenje postaje zabava — djeca zarađuju nagrade kroz lekcije, kvizove i igrice, a roditelji prate napredak u stvarnom vremenu."
          />

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-6">
              <div className="w-12 h-12 bg-amber-400 rounded-xl flex items-center justify-center text-white mb-3">
                <Trophy className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-foreground mb-1">Aferimi ⭐</h4>
              <p className="text-sm text-muted-foreground">
                Bodovi za tačne odgovore u kvizovima. Sakupi što više Aferima i takmiči se s drugima na tabeli.
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 p-6">
              <div className="w-12 h-12 bg-orange-400 rounded-xl flex items-center justify-center text-white mb-3 text-xl">
                🍯
              </div>
              <h4 className="font-bold text-foreground mb-1">Kapi meda</h4>
              <p className="text-sm text-muted-foreground">
                Postignuti rezultat učenika. Učenik zarađuje kapi meda učeći lekcije i rješavajući kvizove — s njima zarađuje vrijeme za igrice. Same kapi meda ostaju kao trajno postignuće.
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center text-white mb-3">
                <Wrench className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-foreground mb-1">Popravi saće</h4>
              <p className="text-sm text-muted-foreground">
                Pogrešni odgovori se ne brišu — čuvaju se u "saću grešaka". Učenik kasnije može popraviti svaku grešku i naučiti iz nje.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border/40 p-6 mb-6">
            <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" /> Misije (dnevne i sedmične)
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Svakog dana i svake sedmice učenik dobija nove izazove — npr. "Pročitaj 3 lekcije", "Riješi kviz bez greške", "Popravi 5 grešaka iz saća". Završene misije donose dodatne nagrade.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                <BookOpen className="w-4 h-4" /> Učenje
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm font-bold">
                <Zap className="w-4 h-4" /> Kvizovi
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-sm font-bold">
                <Wrench className="w-4 h-4" /> Popravljanje
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-100 text-pink-700 text-sm font-bold">
                <Gamepad2 className="w-4 h-4" /> Igrice
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <h5 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Vremenski budžet za igrice
              </h5>
              <p className="text-sm text-muted-foreground">
                Igrice nisu beskonačno dostupne — učenik zarađuje vremenski kredit učeći (kroz kapi meda), a roditelj prati koliko vremena dijete provodi u igricama. Kada kredit istekne, vrati se učenju da bi zaradio više.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-5">
              <h5 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Flower2 className="w-4 h-4 text-primary" /> Etape i krunisanje
              </h5>
              <p className="text-sm text-muted-foreground">
                Svaki nivo (košnica) ima etape — skupove lekcija koje se zaključuju završnim ispitom. Nakon što učenik položi sve etape i završni kviz, nivo se "kruniše" i otvara se sljedeća košnica.
              </p>
            </div>
          </div>
        </section>

        {/* ===== GLAVNI MODULI (za sve) ===== */}
        <section>
          <SectionTitle
            icon={BookOpen}
            title="Glavni moduli platforme"
            subtitle="Pet centralnih modula dostupnih svim korisnicima, sa različitim nivoima pristupa ovisno o ulozi."
          />

          <div className="space-y-8">
            {/* Ilmihal */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Ilmihal</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Tri digitalna udžbenika (Mala Košnica, Zlatna Košnica, Košnica Mudrosti) sa 231 interaktivnom lekcijom. Svaka lekcija kombinuje tekst, ilustracije, audio i H5P interaktivne elemente. Lekcije su organizirane u medaljone (teme), a učenik napreduje kroz mapu puta sa brojevima u kružićima.
                </p>
                <Screenshot src={IMG("ilmihal")} alt="Ilmihal — izbor košnice" caption="Tri nivoa košnica prilagođena dobi i znanju" />
                <Screenshot src={IMG("nivo1-mapa")} alt="Mapa puta" caption="Mapa puta — svaki kružić je jedna lekcija, a heksagoni su etape" />
              </div>
            </div>

            {/* Kvizovi */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Kvizovi</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  43+ kvizova sa pitanjima iz banke pitanja. Kvizovi su grupirani po nivoima i oblastima (iman, ibadet, ahlak, siret, Kur'an). Svaki točan odgovor donosi Aferime. Pogrešni odgovori idu u "saće grešaka" za kasnije ponavljanje.
                </p>
                <Screenshot src={IMG("kvizovi")} alt="Kvizovi" caption="Lista kvizova po nivoima sa brojem pitanja i statusom zaključavanja" />
              </div>
            </div>

            {/* Čitaonica */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
                    <Library className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Čitaonica</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Životne priče poslanika i islamskih junaka u hronološkom redu. Svaka priča je ilustrovana i podijeljena na poglavlja. Čitaonica podstiče ljubav prema islamskoj historiji i uzorima. Trenutno 12+ knjiga sa više poglavlja.
                </p>
                <Screenshot src={IMG("citaonica")} alt="Čitaonica" caption="Knjige u čitaonici sa ilustracijama i statusom čitanja" />
              </div>
            </div>

            {/* Igrice */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Igrice</h3>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Edukativne igrice koje učenik otključava vremenskim kreditom zarađenim kroz kapi meda: Pamti par, Brzi kviz, Glavni gradovi, Zastave svijeta, Mektebsko saće, Medena staza, Pčelin let, Tabela Aferima. Svaka igrica nosi Aferime kao nagradu za uspjeh. Roditelj prati napredak i vrijeme igranja.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Brain, label: "Pamti par" },
                    { icon: Zap, label: "Brzi kviz" },
                    { icon: MapPin, label: "Glavni gradovi" },
                    { icon: Flag, label: "Zastave" },
                    { icon: Hexagon, label: "Mektebsko saće" },
                    { icon: Flower2, label: "Medena staza" },
                    { icon: Bird, label: "Pčelin let" },
                    { icon: Trophy, label: "Tabela" },
                  ].map((g, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 text-sm font-bold text-foreground">
                      <g.icon className="w-4 h-4 text-primary" /> {g.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sufara */}
            <div className="bg-white rounded-2xl border border-border/40 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Sufara (Arapsko pismo)</h3>
                  <span className="ml-auto px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold">Uskoro</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Modul za učenje arapskog pisma i tedžvida. Uključuje kartu harfova, interaktivne lekcije i vježbe prepoznavanja. Trenutno u izradi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 3 ROLE ===== */}
        <section>
          <SectionTitle
            icon={Users}
            title="Tri razine korisnika"
            subtitle="Svaka uloga ima specijalizirane alate prilagođene svojim potrebama — od učenika koji uči, preko roditelja koji prati, do muallima koji upravlja."
          />

          {/* UČENIK */}
          <RoleSection
            role="ucenik"
            title="Učenik"
            subtitle="Glavni korisnik platforme — uči, rješava kvizove, igra igrice i napreduje kroz košnice."
            icon={GraduationCap}
            color="bg-emerald-50/50"
            modules={[
              { icon: BookOpen, title: "Ilmihal lekcije", desc: "231 lekcija u 3 nivoa, interaktivna mapa puta, medaljoni i etape." },
              { icon: HelpCircle, title: "Kvizovi", desc: "43+ kvizova, Aferime za tačne odgovore, saće grešaka za ponavljanje." },
              { icon: Library, title: "Čitaonica", desc: "Životne priče poslanika sa ilustracijama i audio zapisima." },
              { icon: Gamepad2, title: "Igrice", desc: "8 edukativnih igrica otključanih vremenskim kreditom (kapi meda → vrijeme za igru)." },
              { icon: Wrench, title: "Popravi saće", desc: "Ponovi i popravi svaku grešku iz prethodnih kvizova." },
              { icon: Target, title: "Misije", desc: "Dnevni i sedmični izazovi sa nagradama." },
              { icon: Trophy, title: "Tabela", desc: "Takmiči se i uporedi svoj rezultat s drugim učenicima u grupi." },
              { icon: Star, title: "Moj profil", desc: "Pregled napretka, statistike, završenih lekcija i osvojenih nagrada." },
            ]}
            screenshot={{ src: IMG("nivo1-mapa"), alt: "Mapa puta učenika", caption: "Učenik kreće od lekcije 1 i napreduje kroz mapu puta" }}
          />

          <div className="my-8" />

          {/* RODITELJ */}
          <RoleSection
            role="roditelj"
            title="Roditelj"
            subtitle="Praćenje napretka djece, komunikacija sa muallimom i organizacija obaveza."
            icon={Baby}
            color="bg-blue-50/50"
            modules={[
              { icon: LayoutDashboard, title: "Roditeljski panel", desc: "Pregled svih djece, njihovog napretka, prisustva i ocjena na jednom mjestu." },
              { icon: CalendarCheck, title: "Kalendar", desc: "Pregled mektebskih događaja, dana nastave i važnih datuma." },
              { icon: ClipboardList, title: "Zadaće", desc: "Pregled aktivnih zadaća za svako dijete sa rokovima i statusom." },
              { icon: Clock, title: "Screen time", desc: "Praćenje vremena provedenog na platformi po djetetu." },
              { icon: FileText, title: "Izvještaji", desc: "Detaljni izvještaji o prisustvu, ocjenama, kvizovima i napretku." },
              { icon: MessageSquare, title: "Poruke", desc: "Direktna komunikacija sa muallimom i administracijom." },
            ]}
          />

          <div className="my-8" />

          {/* MUALLIM */}
          <RoleSection
            role="muallim"
            title="Muallim"
            subtitle="Upravljanje mektebom, grupama, učenicima, praćenje napretka i komunikacija sa roditeljima."
            icon={Shield}
            color="bg-amber-50/50"
            modules={[
              { icon: LayoutDashboard, title: "Muallim panel", desc: "Centralni pregled svih grupa, učenika, obavještenja i brzih akcija." },
              { icon: Users, title: "Grupe", desc: "Kreiranje grupa, dodavanje učenika, dodjela učenika u grupe." },
              { icon: CalendarCheck, title: "Prisustvo", desc: "Evidentiranje prisustva (prisutan, odsutan, zakasnio, opravdano) po danu." },
              { icon: Star, title: "Ocjene", desc: "Unos ocjena iz praktičnog, teoretskog i ponašanja. Opciono vezano za lekciju." },
              { icon: ClipboardList, title: "Zadaće", desc: "Dodavanje zadaća za cijelu grupu ili pojedinačnog učenika sa rokom." },
              { icon: HelpCircle, title: "Kvizovi i etape", desc: "Konfiguracija završnih ispisa za etape i krunisanje nivoa." },
              { icon: FileText, title: "Izvještaji", desc: "Detaljni izvještaji po učeniku, grupi ili cijelom mektebu." },
              { icon: KeyRound, title: "Print kartice", desc: "Generisanje kartica sa šiframa za prijavu na mektebskom danu." },
              { icon: MessageSquare, title: "Poruke", desc: "Komunikacija sa roditeljima i učenicima." },
            ]}
          />
        </section>

        {/* ===== KAKO ZAPOČETI ===== */}
        <section>
          <SectionTitle
            icon={ArrowRight}
            title="Kako započeti?"
          />
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-border/40 p-6 text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-black">1</div>
              <h4 className="font-bold text-foreground mb-1">Registracija</h4>
              <p className="text-sm text-muted-foreground">Otvori račun kao učenik, roditelj ili mekteb. 7 dana besplatno.</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-6 text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-black">2</div>
              <h4 className="font-bold text-foreground mb-1">Pretraga</h4>
              <p className="text-sm text-muted-foreground">Pogledaj module, isprobaj demo prijavu, istraži lekcije i kvizove.</p>
            </div>
            <div className="bg-white rounded-2xl border border-border/40 p-6 text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-black">3</div>
              <h4 className="font-bold text-foreground mb-1">Učenje</h4>
              <p className="text-sm text-muted-foreground">Kreni s Ilmihalom, rješavaj kvizove, zarađuj nagrade i napreduj!</p>
            </div>
          </div>
          <Screenshot src={IMG("login")} alt="Login stranica" caption="Login sa dva taba: Prijava (za registrovane) i Demo prijava (za istraživanje)" />
        </section>

        {/* ===== FOOTER CTA ===== */}
        <section className="text-center pb-8">
          <div className="bg-primary/5 rounded-3xl border border-primary/10 p-8 md:p-10">
            <img
              src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
              alt="Pčela"
              className="w-16 h-16 mx-auto mb-4"
            />
            <h3 className="text-2xl font-black text-foreground mb-2">Spreman za let?</h3>
            <p className="text-muted-foreground font-medium mb-6 max-w-lg mx-auto">
              Pridruži se hiljadama učenika, roditelja i muallima koji već uče, prate i podučavaju putem Mekteb platforme.
            </p>
            <div className="flex items-center justify-center gap-3 print:hidden">
              <Button asChild size="lg" className="rounded-xl font-bold">
                <Link href="/registracija">Otvori račun</Link>
              </Button>
              <Button variant="outline" asChild size="lg" className="rounded-xl font-bold">
                <Link href="/login">Demo prijava</Link>
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
