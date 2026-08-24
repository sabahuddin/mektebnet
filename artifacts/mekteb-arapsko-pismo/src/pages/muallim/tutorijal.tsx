import { Children, cloneElement, isValidElement, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { BackLink } from "@/components/back-link";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  HeartHandshake,
  Info,
  Layers3,
  ListChecks,
  LockKeyhole,
  Mail,
  MessageSquare,
  MousePointer2,
  Network,
  NotebookPen,
  Printer,
  RotateCcw,
  School,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  UserCheck,
  UserPlus,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type IconType = typeof School;

function TranslateContent({ children }: { children: ReactNode }) {
  const { t } = useLanguage();

  const translate = (node: ReactNode): ReactNode => {
    if (typeof node === "string") return t(node.replace(/\s+/g, " "));
    if (!isValidElement(node)) return node;
    const childNodes = (node.props as { children?: ReactNode }).children;
    return cloneElement(node, undefined, Children.map(childNodes, translate));
  };

  return <>{Children.map(children, translate)}</>;
}

function GuideCallout({
  kind,
  title,
  children,
}: {
  kind: "why" | "next" | "important";
  title: string;
  children: ReactNode;
}) {
  const styles = {
    why: {
      shell: "border-teal-200 bg-teal-50/75",
      icon: "bg-teal-600 text-white",
      title: "text-teal-900",
      body: "text-teal-950/75",
      Icon: Info,
    },
    next: {
      shell: "border-amber-200 bg-amber-50/80",
      icon: "bg-amber-500 text-white",
      title: "text-amber-950",
      body: "text-amber-950/75",
      Icon: ArrowRight,
    },
    important: {
      shell: "border-rose-200 bg-rose-50/80",
      icon: "bg-rose-600 text-white",
      title: "text-rose-950",
      body: "text-rose-950/75",
      Icon: ShieldAlert,
    },
  }[kind];
  const Icon = styles.Icon;

  return (
    <aside className={`rounded-2xl border p-4 ${styles.shell}`} data-testid={`callout-${kind}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h4 className={`text-sm font-black uppercase tracking-[0.12em] ${styles.title}`}>{title}</h4>
          <div className={`mt-1.5 text-sm leading-6 ${styles.body}`}>{children}</div>
        </div>
      </div>
    </aside>
  );
}

function StepFrame({
  number,
  eyebrow,
  title,
  icon: Icon,
  accent,
  children,
  click,
  action,
  why,
  next,
  important,
}: {
  number: string;
  eyebrow: string;
  title: string;
  icon: IconType;
  accent: string;
  children: ReactNode;
  click: ReactNode;
  action: ReactNode;
  why: ReactNode;
  next: ReactNode;
  important?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <section id={`korak-${number}`} className="scroll-mt-24" data-testid={`guide-step-${number}`}>
      <div className="relative overflow-hidden rounded-[2rem] border border-[#dfd7c8] bg-[#fffdf8] shadow-[0_16px_50px_rgba(79,65,43,0.08)]">
        <div className={`h-1.5 ${accent}`} />
        <div className="p-5 sm:p-7 lg:p-9">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${accent}`}>
              <Icon className="h-6 w-6" />
              <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full border-4 border-[#fffdf8] bg-[#173f3d] px-1 text-xs font-black text-white">
                {number}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46d38]">{t(eyebrow)}</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#173f3d] sm:text-3xl">{t(title)}</h2>
            </div>
          </div>

          <div className="guide-prose mt-7 max-w-4xl text-[1.02rem] leading-8 text-[#405052]"><TranslateContent>{children}</TranslateContent></div>

          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#d9e5df] bg-[#f3f8f4] p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#174f47]">
                <MousePointer2 className="h-4 w-4" />
                {t("Klikni ovdje")}
              </div>
              <div className="text-sm leading-6 text-[#355953]"><TranslateContent>{click}</TranslateContent></div>
            </div>
            <div className="rounded-2xl border border-[#e9ddc9] bg-[#fcf6eb] p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#7b4b27]">
                <NotebookPen className="h-4 w-4" />
                {t("Unesi i uradi")}
              </div>
              <div className="text-sm leading-6 text-[#6f5136]"><TranslateContent>{action}</TranslateContent></div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <GuideCallout kind="why" title={t("Zašto")}><TranslateContent>{why}</TranslateContent></GuideCallout>
            <GuideCallout kind="next" title={t("Šta sada možeš")}><TranslateContent>{next}</TranslateContent></GuideCallout>
          </div>
          {important && <div className="mt-3"><GuideCallout kind="important" title={t("Važno")}><TranslateContent>{important}</TranslateContent></GuideCallout></div>}
        </div>
      </div>
    </section>
  );
}

function MiniLabel({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e6df] bg-[#f5faf6] px-2.5 py-1 text-xs font-extrabold text-[#20564e]">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function NumberedRail({ items }: { items: { number: string; title: string; detail: string }[] }) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <a
          key={item.number}
          href={`#korak-${item.number}`}
          className="group rounded-2xl border border-[#dfd7c8] bg-[#fffdf8] p-4 transition-colors hover:border-[#78a69a] hover:bg-[#f4faf5]"
          data-testid={`link-guide-step-${item.number}`}
        >
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#b46d38]">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#173f3d] text-white">{item.number}</span>
            {t("Korak")}
          </span>
          <span className="mt-2 block font-black text-[#173f3d] group-hover:text-[#20695e]">{item.title}</span>
          <span className="mt-1 block text-xs leading-5 text-[#6b6d68]">{item.detail}</span>
        </a>
      ))}
    </div>
  );
}

function RhythmCard({
  icon: Icon,
  title,
  time,
  children,
  color,
}: {
  icon: IconType;
  title: string;
  time: string;
  children: ReactNode;
  color: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-[#dfd7c8] bg-[#fffdf8] p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-white ${color}`}><Icon className="h-5 w-5" /></span>
        <span className="rounded-full bg-[#f4ecdf] px-2.5 py-1 text-xs font-black text-[#8a5a32]">{t(time)}</span>
      </div>
      <h3 className="mt-4 text-lg font-black text-[#173f3d]">{t(title)}</h3>
      <p className="mt-2 text-sm leading-6 text-[#5c6563]"><TranslateContent>{children}</TranslateContent></p>
    </div>
  );
}

export default function MuallimTutorijalPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [printed, setPrinted] = useState(false);

  if (!user || (user.role !== "muallim" && user.role !== "admin")) {
    return (
      <Layout>
        <div className="mx-auto max-w-md rounded-3xl border border-[#dfd7c8] bg-[#fffdf8] p-8 text-center shadow-sm">
          <LockKeyhole className="mx-auto h-10 w-10 text-[#b46d38]" />
          <h1 className="mt-4 text-2xl font-black text-[#173f3d]">{t("Muallimski tutorijal")}</h1>
          <p className="mt-2 text-sm leading-6 text-[#65706d]">{t("Ovaj vodič je dostupan samo muallimima i administratorima.")}</p>
          <Button asChild className="mt-6 rounded-xl font-bold">
            <BackLink fallback="/muallim" data-testid="link-tutorijal-back-denied">{t("Nazad na panel")}</BackLink>
          </Button>
        </div>
      </Layout>
    );
  }

  const handlePrint = () => {
    setPrinted(true);
    window.setTimeout(() => setPrinted(false), 1200);
    window.print();
  };

  return (
    <Layout>
      <TranslateContent>
      <div className="mx-auto max-w-5xl">
        <div className="no-print mb-6 flex items-center justify-between gap-3">
          <BackLink
            fallback="/muallim"
            className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-extrabold text-[#55706a] transition-colors hover:bg-[#eaf2ed] hover:text-[#173f3d]"
            data-testid="link-tutorijal-back"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Nazad na Muallimski panel")}
          </BackLink>
          <Button
            onClick={handlePrint}
            variant="outline"
            className="rounded-xl border-[#cfc6b7] bg-[#fffdf8] font-extrabold text-[#42625b]"
            data-testid="button-tutorijal-print"
          >
            {printed ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Printer className="mr-2 h-4 w-4" />}
            {printed ? t("Pripremljeno za štampu") : t("Štampaj vodič")}
          </Button>
        </div>

        <header className="relative overflow-hidden rounded-[2rem] border border-[#d8ccba] bg-[#173f3d] px-6 py-9 text-[#fffaf1] shadow-[0_20px_60px_rgba(23,63,61,0.18)] sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[#d99a5b]/20" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full border-[22px] border-[#9cc2aa]/15" />
          <div className="relative max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#d99a5b] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#392617]">
                <School className="h-3.5 w-3.5" />
                {t("Mekteb.net za muallime")}
              </span>
              <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-[#dce9df]">{t("Vodič kroz cijelu godinu")}</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              {t("Od prvog naloga do mirne sedmice u mektebu.")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#dce9df] sm:text-lg">
              {t("Zamislimo jedan džemat: oko 100 djece, tri muallima i šest grupa. Ovaj tutorijal prati stvarni put glavnog muallima — od postavljanja mekteba do pregleda podataka koji otkriva kome treba dodatna pažnja.")}
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <MiniLabel icon={Users}>{t("100 djece")}</MiniLabel>
              <MiniLabel icon={Network}>{t("3 muallima")}</MiniLabel>
              <MiniLabel icon={Layers3}>{t("6 grupa")}</MiniLabel>
              <MiniLabel icon={CalendarCheck}>{t("Jedan zajednički ritam")}</MiniLabel>
            </div>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-[#e3d9ca] bg-[#f8f1e5] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46d38]">{t("Prije nego počnemo")}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[#173f3d]">{t("Čitaj kao putanju, ne kao spisak.")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6563]">
                {t("Svaki korak ima četiri odgovora: gdje se klikne, šta se unosi, zašto je to važno i šta se time otvara za sljedeći čas.")}
              </p>
            </div>
            <ArrowDown className="hidden h-8 w-8 shrink-0 text-[#b46d38] sm:block" />
          </div>
          <div className="mt-5">
            <NumberedRail items={[
              { number: "01", title: t("Postavi ljude"), detail: t("Profil, podešavanja i muallimski nalozi") },
              { number: "02", title: t("Složi grupe"), detail: t("Godina, termini i odgovornost muallima") },
              { number: "03", title: t("Uvedi djecu"), detail: t("Masovni unos, roditelji i kartice") },
              { number: "04", title: t("Provjeri mrežu"), detail: t("Sastav grupa i saradnja") },
              { number: "05", title: t("Označi godinu"), detail: t("Kalendar grupe i kopiranje") },
              { number: "06", title: t("Napravi put"), detail: t("Plan lekcija i redoslijed") },
              { number: "07", title: t("Bilježi susret"), detail: t("Prisustvo odmah poslije časa") },
              { number: "08", title: t("Daj povratnu informaciju"), detail: t("Ocjene, zvjezdice i zadaća") },
            ]} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <a href="#korak-09" className="rounded-2xl border border-[#dfd7c8] bg-[#fffdf8] p-4 text-sm font-black text-[#173f3d] hover:border-[#78a69a]" data-testid="link-guide-step-09">{t("09 · Zadaća kroz pregled")}</a>
            <a href="#korak-10" className="rounded-2xl border border-[#dfd7c8] bg-[#fffdf8] p-4 text-sm font-black text-[#173f3d] hover:border-[#78a69a]" data-testid="link-guide-step-10">{t("10 · Statistika i izvještaji")}</a>
            <a href="#korak-11" className="rounded-2xl border border-[#dfd7c8] bg-[#fffdf8] p-4 text-sm font-black text-[#173f3d] hover:border-[#78a69a]" data-testid="link-guide-step-11">{t("11 · Roditelji i poruke")}</a>
            <a href="#sedmicni-ritam" className="rounded-2xl border border-[#dfd7c8] bg-[#fffdf8] p-4 text-sm font-black text-[#173f3d] hover:border-[#78a69a]" data-testid="link-guide-rhythm">{t("Sedmični ritam rada")}</a>
          </div>
        </section>

        <div className="mt-8 space-y-7">
          <StepFrame
            number="01"
            eyebrow="Prvi dan · postavi ljude"
            title="Glavni muallim prvo pravi tim"
            icon={UserPlus}
            accent="bg-[#237a6d]"
            click={<><strong>Muallimski panel → Profil.</strong> Profil je ujedno i <strong>Podešavanja mekteba</strong>. U sekciji <strong>Muallimi mekteba</strong> izaberi kreiranje novog naloga.</>}
            action={<>Unesi ime i prezime prvog, pa zatim drugog muallima. Aplikacija automatski generiše korisničko ime i šifru.</>}
            why={<>Tri muallima ne znače samo podjelu posla. Oni dobijaju jasne lične kontekste, pa svaki muallim vidi svoje grupe, učenike i podatke bez traženja po cijelom mektebu.</>}
            next={<>Kada su nalozi spremni, možeš svakom muallimu dodijeliti njegove grupe i početi raditi paralelno — bez dijeljenja jednog naloga.</>}
            important={<>Šifra se prikazuje samo jednom. Zapiši je ili kopiraj odmah i sigurno proslijedi muallimu. Nemoj je slati u javnu grupu, ostavljati na papiru u učionici ili pretpostaviti da će se kasnije ponovo pojaviti.</>}
          >
            <p>
              Prije nego što se pojavi prvo ime djeteta, glavni muallim otvara <strong>Muallimski panel</strong> i odlazi na tab <strong>Profil</strong>. To nije samo lični profil: u ovoj aplikaciji taj tab je i mjesto za podešavanja mekteba. U sekciji <strong>Muallimi mekteba</strong> kreira još dva naloga, tako da naš džemat dobija ukupno tri osobe koje mogu voditi nastavu.
            </p>
            <p className="mt-4">
              Nalozi se stvaraju jedan po jedan. Nakon svakog kreiranja zastani na trenutak: provjeri ime, sačuvaj korisničko ime i šifru, pa tek onda pređi na sljedećeg muallima. Tako će početak godine biti uredan, a ne potraga za izgubljenim pristupom.
            </p>
          </StepFrame>

          <StepFrame
            number="02"
            eyebrow="Drugi dan · napravi strukturu"
            title="Šest grupa dobija svoje vrijeme i svog muallima"
            icon={Layers3}
            accent="bg-[#b46d38]"
            click={<><strong>Muallimski panel → Grupe → Nova grupa.</strong> Otvori isti obrazac šest puta, jednom za svaku grupu.</>}
            action={<>Upiši naziv, odaberi mektebsku godinu, datum početka i kraja, označi dane nastave, upiši vrijeme i kroz <strong>Muallim grupe</strong> izaberi odgovornu osobu.</>}
            why={<>Dodjela grupe određuje lični kontekst muallima: čiji učenici, prisustvo, planovi i zadaće ulaze u njegov pregled. To je temelj odgovornosti i saradnje.</>}
            next={<>Muallimi mogu otvoriti svoje grupe i odmah nastaviti s učenicima. Glavni muallim zadržava pregled cijelog mekteba i može kasnije provjeriti raspodjelu.</>}
            important={<>Rasporedite dvije grupe svakom od tri muallima. Ako je termin isti, to ne smeta; bitno je da je odgovorna osoba tačno izabrana u polju <strong>Muallim grupe</strong>.</>}
          >
            <p>
              Sada džemat dobija oblik. Za svaku od šest grupa idi na <strong>Grupe → Nova grupa</strong>. Unesi naziv koji će roditelji i muallimi lako prepoznati, na primjer „Mlađa grupa — subota“ ili „Starija grupa — nedjelja“. Zatim odaberi mektebsku godinu, datum početka i datum kraja.
            </p>
            <p className="mt-4">
              Označi dane nastave i upiši vrijeme. Na kraju obrasca nalazi se <strong>Muallim grupe</strong>. Tu napravi raspodjelu: dvije grupe prvom muallimu, dvije drugom i dvije trećem. Ne biraj nasumično — ova postavka kasnije filtrira čije podatke muallim vidi u svom ličnom kontekstu.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <MiniLabel icon={Calendar}>Mektebska godina</MiniLabel>
              <MiniLabel icon={CalendarCheck}>Dani nastave</MiniLabel>
              <MiniLabel icon={Users}>Muallim grupe</MiniLabel>
              <MiniLabel icon={CheckCircle2}>6 ponavljanja obrasca</MiniLabel>
            </div>
          </StepFrame>

          <StepFrame
            number="03"
            eyebrow="Treći dan · uvedi djecu"
            title="Sto djece ulazi u mekteb bez stotinu ponavljanja"
            icon={Users}
            accent="bg-[#3d8a73]"
            click={<><strong>Otvori svaku grupu → Dodaj učenike.</strong> Za veći broj djece koristi masovni unos. Za pojedinačno dijete možeš koristiti postojeći obrazac.</>}
            action={<>Glavni muallim u tekstualno polje upiše svako dijete u novi red. Roditelja prvi put unese uz jedno dijete pomoću znaka <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">|</code>, a zatim sam pronađe tog roditelja i poveže ga sa svom ostalom djecom iz iste porodice.</>}
            why={<>Masovni unos štedi vrijeme, a jedan roditeljski nalog omogućava roditelju da prati svu svoju djecu. Glavni muallim ovim redom rada sprečava duplikate i osigurava da svako dijete bude povezano s pravim roditeljem i svojim muallimom.</>}
            next={<>Tek kada su djeca, roditelji, grupe i muallimi povezani, glavni muallim štampa pristupne kartice sa korisničkim imenima i šiframa.</>}
            important={<>Glavni muallim treba prvi unijeti djecu i roditelje za cijeli mekteb. <strong>Roditelj ne treba naknadno slati zahtjev za drugo dijete:</strong> glavni muallim sam povezuje svu djecu sa roditeljem i sa odgovarajućim muallimom prije štampanja kartica. Pristupne podatke uruči sigurno, pojedinačno i bez javnog dijeljenja.</>}
          >
            <p>
              Otvori prvu grupu i izaberi <strong>Dodaj učenike</strong>. U polje za masovni unos ne upisuješ sve u jednu rečenicu: <strong>svako ime ide u novi red</strong>. Glavni muallim zatim ponovi unos za sve grupe i sam odlučuje kako će rasporediti djecu prema stvarnim potrebama džemata.
            </p>
            <div className="my-5 rounded-2xl border border-[#d5e3dc] bg-[#f5faf6] p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#237a6d]">Obrazac za unos</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7 text-[#355953]">Amina Hasić | Senad Hasić{"\n"}Ahmed Begović{"\n"}Merjem Hadžić | Edina Hadžić</pre>
              <p className="mt-3 text-xs leading-5 text-[#55706a]">Lijevo od znaka je učenik, desno je roditelj. Roditeljski nalog je opcionalan.</p>
            </div>
            <p>
              Ako dijete već postoji u mektebu, ne pravi novi nalog. Izaberi <strong>Dodaj postojećeg</strong> i poveži ga s ovom grupom. Kada je grupa popunjena, koristi <strong>Printaj kartice</strong> za čuvanje i štampanje pristupnih podataka.
            </p>
            <div className="mt-5 rounded-2xl border border-[#e8c98d] bg-[#fff8e9] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#b46d38]" />
                <div>
                  <p className="text-sm font-black text-[#7b4b27]">Jedna porodica, jedan roditeljski nalog</p>
                  <p className="mt-1 text-sm leading-6 text-[#6f5136]">
                    Na primjer, ako Senad Hasić ima Aminu i Ahmeda, roditelja <strong>Senad Hasić</strong> glavni muallim kreira samo uz prvo dijete. Kod drugog djeteta ga sam pronađe među postojećim roditeljima i poveže — roditelj ne treba ponovo slati zahtjev niti dobiti duplikat naloga.
                  </p>
                </div>
              </div>
            </div>
          </StepFrame>

          <StepFrame
            number="04"
            eyebrow="Prva provjera · pogledaj mrežu"
            title="Prije prvog časa provjeri da niko nije između redova"
            icon={UserCheck}
            accent="bg-[#5b7b91]"
            click={<><strong>Panel → Grupe</strong>, zatim otvori svaku grupu. Na karticama učenika provjeri sastav i oznaku povezivanja roditelja.</>}
            action={<>Provjeri ko pripada kojoj grupi, da li je svako dijete povezano sa pravim roditeljem i muallimom, te da li će se na karticama prikazati tačni pristupni podaci.</>}
            why={<>Ova kratka provjera sprečava pogrešne izvještaje: dijete ne smije biti u pogrešnoj grupi, a roditelj ne smije pratiti tuđe podatke.</>}
            next={<>Glavni muallim može otvoriti pregled drugog muallima bez prijavljivanja kao on. Tako se provjerava saradnja, a da se ne remeti tuđi nalog.</>}
            important={<>Kartice štampaj tek kada su sve veze provjerene. Glavni muallim po potrebi može resetirati sve šifre učenika i roditelja odjednom, ali to ne treba koristiti bez stvarne potrebe jer se tada mijenjaju pristupni podaci za cijeli mekteb.</>}
          >
            <p>
              Kada su djeca unesena, nemoj odmah preći na plan lekcija. Prvo napravi krug kroz sve grupe. Na grupnoj kartici provjeri imena, roditeljske veze i muallima grupe. Ovaj pregled je posljednja provjera prije štampanja kartica.
            </p>
            <p className="mt-4">
              Glavni muallim ima još jednu važnu mogućnost: u panelu može otvoriti <strong>pregled drugog muallima</strong> bez prijavljivanja kao on. To je korisno kada se provjerava da li su grupe pravilno raspoređene, da li se bilješke redovno unose i gdje treba ponuditi pomoć.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <MiniLabel icon={Users}>Sastav grupa</MiniLabel>
              <MiniLabel icon={HeartHandshake}>Roditelji i djeca</MiniLabel>
              <MiniLabel icon={Search}>Saradnja muallima</MiniLabel>
            </div>
          </StepFrame>

          <StepFrame
            number="05"
            eyebrow="Prije nastave · označi godinu"
            title="Kalendar jednom, ritam za svih šest grupa"
            icon={Calendar}
            accent="bg-[#4c79a1]"
            click={<><strong>Otvori grupu → Kalendar.</strong> U kalendaru grupe označi dane nastave, ferije, Ramazan i važne datume.</>}
            action={<>Dodaj datume i opise tako da muallim, učenik i roditelj znaju kada se nastava održava i šta dolazi.</>}
            why={<>Kalendar pretvara godinu iz dogovora po porukama u zajedničku referencu. Ferije i Ramazan postaju vidljivi prije nego nastane zabuna oko časa ili roka.</>}
            next={<>Kada je kalendar prve grupe dobro postavljen, kopiraj kalendar između grupa. Ne radi isti posao šest puta.</>}
          >
            <p>
              Na nivou svake grupe otvori <strong>Kalendar</strong>. Označi redovne dane nastave, ali i ono što prekida ili mijenja ritam: ferije, Ramazan i važne datume džemata. Nije cilj da kalendar bude ukras; cilj je da roditelj koji pogleda svoj pregled dobije isti odgovor koji ima muallim.
            </p>
            <p className="mt-4">
              Pošto šest grupa često dijeli isti mektebski ritam, iskoristi mogućnost kopiranja kalendara između grupa. Napravi dobar osnovni kalendar, kopiraj ga na ostale grupe, a zatim samo popravi razlike u terminima. Tako se isti posao ne radi šest puta, a promjena važnog datuma lakše ostaje dosljedna.
            </p>
          </StepFrame>

          <StepFrame
            number="06"
            eyebrow="Opcija za planiranje · napravi put"
            title="Plan lekcija pomaže muallimu, ali ne mora zaključati učenika"
            icon={BookOpen}
            accent="bg-[#765aa8]"
            click={<><strong>Otvori grupu → Plan lekcija</strong> ako želiš planirati naredni mjesec ili cijelu godinu. Klik na lekciju vodi odmah na tu lekciju u jednom od tri nivoa. Za redoslijed otključavanja otvori <strong>Raspored lekcija</strong>.</>}
            action={<>U planu opcionalno dodijeli lekciju konkretnom datumu. U rasporedu možeš složiti redoslijed lekcija i time uticati na put kojim ih učenici otključavaju.</>}
            why={<>Plan je pomoć muallimu da zna šta je predviđeno za određeni čas, mjesec ili godinu. Učenici i dalje mogu raditi lekcije svojim tempom i izabrati šta žele, osim lekcija koje su zaključane dok ne ispune potrebni uslov.</>}
            next={<>Muallim dobija pregled planiranog rada, a učenici slobodu da vježbaju prema svom napretku. Raspored lekcija ipak daje muallimu način da usmjeri redoslijed kada je to pedagoški korisno.</>}
            important={<>Plan lekcija je opcija, nije obavezna prepreka. Zaključane lekcije se otključavaju tek nakon ispunjenog uslova, dok ostale učenik može raditi po želji. Raspored lekcija može uticati na redoslijed, ali trenutno ne mora prisiliti svakog učenika da ide istim tempom.</>}
          >
            <p>
              Za svaku grupu, ako ti je korisno, napravi <strong>Plan lekcija</strong>. To je vaš nastavni dnevnik: na određeni datum vežeš lekciju ili temu koju želite obraditi. Možeš ga pripremiti za naredni mjesec ili cijelu godinu, a klik na naziv lekcije vodi direktno na lekciju u jednom od tri nivoa.
            </p>
            <p className="mt-4">
              Zatim, po potrebi, otvori <strong>Raspored lekcija</strong>. On ne govori koji je datum časa, nego može uticati na redoslijed kojim učenici otključavaju lekcije. Učenik može raditi lekcije koje su mu dostupne kako želi; samo zaključane lekcije čekaju ispunjenje svog uslova. Tako muallim ima putanju koju može preporučiti, bez nepotrebnog zaustavljanja učenika koji je spreman za drugi sadržaj.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900"><strong>Plan lekcija</strong><br />Opcionalni plan za mjesec ili godinu</div>
              <ArrowRight className="my-auto hidden h-5 w-5 text-violet-400 sm:block" />
              <div className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900"><strong>Raspored lekcija</strong><br />Usmjerava redoslijed, ali ne prisiljava tempo</div>
            </div>
          </StepFrame>

          <StepFrame
            number="07"
            eyebrow="Na početku časa · zabilježi susret"
            title="Prisustvo se radi na početku časa, a kasnije se može ažurirati"
            icon={ClipboardCheck}
            accent="bg-[#2e8290]"
            click={<><strong>Otvori grupu → Prisustvo</strong> na početku časa. Izaberi datum časa i prođi redom kroz svakog učenika.</>}
            action={<>Označi <strong>prisutan, odsutan, zakasnio</strong> ili <strong>opravdano</strong>. Ako se situacija promijeni ili nešto saznaš naknadno, isti unos možeš kasnije ažurirati.</>}
            why={<>Unos na početku časa odmah daje stvarnu sliku ko je prisutan. Kasnije ažuriranje ostavlja prostor za opravdanje, ispravku ili dopunu bez brisanja cijele evidencije.</>}
            next={<>Na pregledu vidiš obrazac izostanaka, možeš povezati ga sa ocjenama i javiti roditelju kada je potrebno.</>}
            important={<>Prisustvo uradi na početku časa, ali ga ne moraš smatrati konačnim u tom trenutku. Po potrebi ga ažuriraj kasnije.</>}
          >
            <p>
              Na početku časa uđi u <strong>Prisustvo</strong> na grupnoj kartici. Izaberi datum i prođi kroz listu. Četiri statusa nisu ista poruka: <strong>prisutan</strong> govori da je dijete bilo tu, <strong>odsutan</strong> da nije došlo, <strong>zakasnio</strong> da je stiglo nakon početka, a <strong>opravdano</strong> daje važan kontekst odsustvu.
            </p>
            <p className="mt-4">
              Ako treba, dopiši napomenu: kratko i činjenično, bez etiketa. Ako se roditelj javi naknadno ili muallim uoči grešku, ažuriraj postojeći unos. Kasnije će se isti podaci pojaviti u pregledima i izvještajima, gdje mogu pokazati da li učeniku treba razgovor, podrška ili drugačiji tempo.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["Prisutan", "Odsutan", "Zakasnio", "Opravdano"].map((status) => (
                <div key={status} className="rounded-xl border border-[#d6e5e0] bg-[#f6faf7] px-3 py-3 text-center text-xs font-black text-[#285d54]">{status}</div>
              ))}
            </div>
          </StepFrame>

          <StepFrame
            number="08"
            eyebrow="Na grupnoj kartici · prati napredak"
            title="Ocjena je trag učenja, Napamet je procjena pamćenja"
            icon={Star}
            accent="bg-[#c38a30]"
            click={<><strong>Na kartici učenika izaberi Ocjene</strong> za procjenu, <strong>Zvjezdice</strong> za pozitivne i negativne bilješke, a <strong>Zadaće</strong> za rad koji treba uraditi.</>}
            action={<>Odaberi kategoriju <strong>Usmeno, Učenje, Praktično, Test</strong> ili <strong>Napamet</strong>, po potrebi veži je za lekciju i dodaj kratku konstruktivnu povratnu informaciju.</>}
            why={<>Učenik i roditelj ne dobijaju samo broj. Dobijaju objašnjenje šta je dobro, šta treba vježbati i zašto je određena lekcija važna. Pozitivne i negativne zvjezdice sada rješavaju praćenje ponašanja.</>}
            next={<>Iz ocjena, zvjezdica i zadaća dobijaš materijal za individualni razgovor i kasniji izvještaj, umjesto da se oslanjaš na utisak.</>}
            important={<>Kapi meda u zadaći predstavljaju znanje. One nisu valuta igrica niti razlog da se učenik poredi kao da se takmiči za novac.</>}
          >
            <p>
              Na grupnoj kartici svaki učenik ima svoje brze akcije. U <strong>Ocjene</strong> odaberi kategoriju koja odgovara onome što procjenjuješ: <strong>Usmeno, Učenje, Praktično, Test</strong> ili <strong>Napamet</strong>. Ocjenu možeš vezati za konkretnu lekciju, pa kasnije znaš da li je teškoća bila u jednoj temi ili u kontinuitetu.
            </p>
            <p className="mt-4">
              Povratna informacija neka bude konstruktivna: napiši šta je učenik uradio dobro i koji je sljedeći mali korak. Za pamćenje koristi <strong>Napamet</strong>, a za ponašanje koristi pozitivne ili negativne kategorije u <strong>Zvjezdicama</strong>. Zvjezdica treba pomoći razgovoru, ne zamijeniti razgovor.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <MiniLabel icon={Star}>Ocjene</MiniLabel>
              <MiniLabel icon={BookOpen}>Veza s lekcijom</MiniLabel>
              <MiniLabel icon={HeartHandshake}>Konstruktivna povratna informacija</MiniLabel>
              <MiniLabel icon={Sparkles}>Zvjezdice i kategorije</MiniLabel>
            </div>
          </StepFrame>

          <StepFrame
            number="09"
            eyebrow="Tokom sedmice · zadaća ima nastavak"
            title="Od jedne lekcije do praćenja urađenog rada"
            icon={ClipboardList}
            accent="bg-[#a55f8c]"
            click={<><strong>Grupa → Zadaća</strong> ili na kartici učenika izaberi <strong>Zadaća</strong>. Odredi da li je zadaća za grupu ili pojedinca.</>}
            action={<>Postavi lekciju, opis i rok. U pregledu prati urađeno, ocjenu i kapi meda. Kroz <strong>Uredi</strong> možeš promijeniti rok svima u zadaći, a kroz pregled po učeniku sačuvati individualni status.</>}
            why={<>Zadaća dobija vlasnika, sadržaj i rok. Muallim zna šta prati, a učenik i roditelj dobijaju jasnu sljedeću obavezu umjesto neodređenog „vježbaj kod kuće“.</>}
            next={<>Iz pregleda možeš prepoznati ko redovno radi, kome treba podsjetnik i gdje treba produžiti rok zbog stvarne situacije.</>}
            important={<>Roditelj vidi zadaću, opis, rok i status djeteta. Učenik vidi šta treba uraditi i može pratiti vlastiti napredak. Ako svima treba produžiti rok, promijeni ga kroz <strong>Uredi</strong> na zadaći; nemoj zbog toga svakom djetetu upisivati „Prolongirano“. Ta oznaka treba ostati za stvarnu individualnu situaciju.</>}
          >
            <p>
              Kada znaš šta je grupa radila, zadaća je prirodan sljedeći korak. U grupi otvori <strong>Zadaća</strong> i izaberi dodjelu za cijelu grupu, ili na kartici učenika otvori zadaću za pojedinca. Postavi lekciju, napiši opis koji dijete može razumjeti i dodaj rok.
            </p>
            <p className="mt-4">
              Ne završava se sve klikom na „Dodaj“. U pregledu se vraćaš na zadaću: vidiš ko je uradio, upisuješ ocjenu, dodjeljuješ kapi meda kao znak znanja, a kroz <strong>Uredi</strong> možeš promijeniti opis, lekciju ili rok svima. Individualni rok koristi samo kada stvarno postoji razlog za jedno dijete; grupni rok mijenjaj na samoj zadaći.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-4">
              {[
                { icon: CheckCircle2, label: "Urađeno" },
                { icon: Star, label: "Ocjena" },
                { icon: Sparkles, label: "Kapi meda" },
                { icon: RotateCcw, label: "Produži rok / završi" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-[#ead6e3] bg-[#fff7fb] px-3 py-3 text-xs font-black text-[#724060]">
                  <Icon className="h-4 w-4" /> {label}
                </div>
              ))}
            </div>
          </StepFrame>

          <StepFrame
            number="10"
            eyebrow="Kraj sedmice ili mjeseca · pročitaj tragove"
            title="Statistika i izvještaji vode od mekteba do učenika"
            icon={BarChart3}
            accent="bg-[#536b9d]"
            click={<><strong>Panel → Statistika</strong> ili <strong>Izvještaji</strong>. Kreći se kroz hijerarhiju <strong>mekteb → muallim → grupa → učenik</strong>.</>}
            action={<>Pregledaj prisustvo, ocjene, kvizove, zvjezdice i plan lekcija. Po potrebi uradi CSV/Excel izvoz za arhivu ili sastanak.</>}
            why={<>Brojevi nisu cilj sami po sebi. Oni pomažu da primijetiš obrazac: dijete koje izostaje, grupu koja kasni s planom ili učenika koji treba drugačiju podršku.</>}
            next={<>Iz širokog pregleda brzo ulaziš u detalj konkretnog učenika i razgovor pretvaraš u tačnu, dobronamjernu pomoć.</>}
            important={<>Izvoz CSV/Excel koristi pažljivo: preuzete izvještaje čuvaj na sigurnom mjestu jer mogu sadržavati podatke o djeci.</>}
          >
            <p>
              Kada se sedmica ili mjesec zatvori, nemoj pregledati samo jedan broj. Uđi u <strong>Statistiku</strong> i izvještaje po jasnoj putanji: prvo mekteb, zatim muallim, grupa i na kraju učenik. Na svakom nivou gledaš ono što je korisno za taj razgovor.
            </p>
            <p className="mt-4">
              U podatke ulaze <strong>prisustvo, ocjene, kvizovi, zvjezdice</strong> i ostvarenje <strong>plana lekcija</strong>. Ako treba sastanak, administrativnu arhivu ili obradu van aplikacije, koristi <strong>CSV/Excel izvoz</strong>. Najvažnije pitanje nije „ko ima najveći broj“, nego „kome ovaj podatak govori da treba pomoć?“
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {["Mekteb", "Muallim", "Grupa", "Učenik"].map((level, index) => (
                <span key={level} className="flex items-center gap-2">
                  <span className="rounded-xl border border-[#d6ddea] bg-[#f5f7fc] px-3 py-2 text-xs font-black text-[#42577f]">{level}</span>
                  {index < 3 && <ArrowRight className="h-4 w-4 text-[#8a9abf]" />}
                </span>
              ))}
            </div>
          </StepFrame>

          <StepFrame
            number="11"
            eyebrow="Tokom mjeseca · budi u kontaktu"
            title="Roditelj je partner, a poruka treba imati pravi dom"
            icon={MessageSquare}
            accent="bg-[#b85f63]"
            click={<><strong>Panel → Roditelji</strong> za pregled roditelja po grupama i slanje poruka ili obavještenja.</>}
            action={<>Provjeri da porodica vidi samo svoju djecu. Za informaciju cijeloj grupi pošalji obavještenje; za osjetljiv ili individualan razgovor koristi privatnu poruku.</>}
            why={<>Razlika između grupne informacije i privatne poruke štiti dostojanstvo djeteta i čuva pažnju roditelja. Svi dobiju ono što se tiče njih, a ne tuđe detalje.</>}
            next={<>Roditelji vide relevantne obavijesti i napredak svog djeteta, a muallim može riješiti pitanje prije nego postane problem na času.</>}
            important={<>Ne šalji individualnu ocjenu, izostanak ili osjetljivu napomenu cijeloj grupi. Grupni kanal je za zajedničke datume i upute; privatna poruka je za jednu porodicu.</>}
          >
            <p>
              U tabu <strong>Roditelji</strong> pregledaj roditelje po grupama i provjeri da je glavni muallim ranije povezao roditelja sa svom njegovom djecom. Roditelj tada u svom nalogu vidi samo podatke koji mu pripadaju.
            </p>
            <p className="mt-4">
              Kada šalješ poruku, prvo odluči da li govoriš svima ili jednoj porodici. Informacija cijeloj grupi odgovara za promjenu termina, podsjetnik na ferije ili zajedničku uputu. Privatna poruka odgovara za izostanak, ocjenu, napredak ili dogovor koji se tiče samo jednog učenika.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-rose-900"><Users className="h-4 w-4" /> Cijela grupa</div>
                <p className="mt-2 text-sm leading-6 text-rose-950/70">Termin, ferije, zajednički materijal i obavijest koja važi za sve.</p>
              </div>
              <div className="rounded-2xl border border-[#d9e5df] bg-[#f3f8f4] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-[#174f47]"><Mail className="h-4 w-4" /> Privatno</div>
                <p className="mt-2 text-sm leading-6 text-[#355953]">Jedno dijete, njegova ocjena, prisustvo ili dogovor s roditeljem.</p>
              </div>
            </div>
          </StepFrame>
        </div>

        <section id="sedmicni-ritam" className="mt-8 scroll-mt-24 rounded-[2rem] border border-[#d8ccba] bg-[#173f3d] p-5 text-[#fffaf1] shadow-[0_16px_50px_rgba(23,63,61,0.14)] sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d99a5b]">Kada se sistem ustali</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Sedmični ritam koji ne zavisi od pamćenja</h2>
            <p className="mt-3 text-sm leading-6 text-[#dce9df]">
              Mekteb.net je najkorisniji kada male evidencije radiš redovno. Evo ritma za tri muallima i šest grupa.
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <RhythmCard icon={CalendarCheck} title="Prije časa" time="10–15 min" color="bg-[#b46d38]">
              Pogledaj plan lekcija i kalendar grupe, provjeri rokove zadaća i pripremi jednu jasnu poruku ako se termin mijenja.
            </RhythmCard>
            <RhythmCard icon={School} title="Na času" time="Tok časa" color="bg-[#237a6d]">
              Radi s učenicima, zabilježi važne napomene i već tokom susreta primijeti kome treba dodatno objašnjenje.
            </RhythmCard>
            <RhythmCard icon={ClipboardCheck} title="Poslije časa" time="10 min" color="bg-[#4c79a1]">
              Odmah unesi prisustvo, dodaj ocjenu ili zvjezdicu gdje ima smisla, zadaj sljedeći mali korak i dopuni plan.
            </RhythmCard>
            <RhythmCard icon={BarChart3} title="Kraj mjeseca" time="30–45 min" color="bg-[#765aa8]">
              Otvori statistiku i izvještaje, idi do učenika kojem treba pomoć, razgovaraj s roditeljem i sačuvaj CSV/Excel kada je potreban.
            </RhythmCard>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-[#e3d9ca] bg-[#f8f1e5] p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b46d38]">Kontrolna lista</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#173f3d]">Džemat od 100 djece</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6563]">Kratak pregled koji glavni muallim može proći prije početka godine i na kraju svakog mjeseca.</p>
            </div>
            <ListChecks className="hidden h-10 w-10 text-[#b46d38] sm:block" />
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {[
              "Tri muallimska naloga su kreirana, a šifre sigurno proslijeđene.",
              "Kreirano je šest grupa sa tačnom mektebskom godinom, datumima, danima i vremenom.",
              "Svaki od tri muallima vodi po dvije grupe.",
              "Djeca su raspoređena prema stvarnim potrebama džemata; postojeći učenici nisu duplirani.",
              "Glavni muallim je povezao svu djecu sa roditeljima i muallimima prije štampanja kartica.",
              "Kalendar, ferije, Ramazan i važni datumi su postavljeni ili kopirani.",
              "Plan lekcija je postavljen po potrebi, a Raspored lekcija podešen ako muallim želi usmjeriti redoslijed.",
              "Prisustvo je uneseno odmah nakon svakog časa.",
              "Ocjene, zvjezdice i zadaće imaju smislen kontekst i povratnu informaciju.",
              "Na kraju mjeseca pregledani su mekteb, muallimi, grupe i učenici kojima treba pomoć.",
            ].map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-[#dfd7c8] bg-[#fffdf8] px-4 py-3 text-sm leading-6 text-[#445753]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#237a6d] text-white"><Check className="h-3.5 w-3.5" /></span>
                <span><strong className="text-[#173f3d]">{index + 1}.</strong> {item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-rose-200 bg-rose-50 p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white"><XCircle className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Kraj mektebske godine</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-rose-950">Arhiviraj, ali ne briši u žurbi.</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-rose-950/75">
                Na kraju godine grupu možeš arhivirati. Arhiviranje čuva historiju i oslobađa učenike za naredni raspored. Grupu nemoj brisati prije nego što preuzmeš potrebne izvještaje: brisanje trajno uklanja evidencije prisustva, plana, kalendara i zadaća.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white/70 px-3 py-2 text-xs font-black text-rose-900"><ArchiveIcon className="h-4 w-4" /> Arhiviraj grupu</span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white/70 px-3 py-2 text-xs font-black text-rose-900"><Download className="h-4 w-4" /> Preuzmi izvještaje</span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white/70 px-3 py-2 text-xs font-black text-rose-900"><LockKeyhole className="h-4 w-4" /> Čuvaj podatke</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="no-print mb-4 mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#dfd7c8] pt-6 text-sm sm:flex-row">
          <p className="text-[#65706d]">Kada je put dobro postavljen, više vremena ostaje za djecu.</p>
          <Link href="/muallim" className="inline-flex items-center gap-2 font-black text-[#237a6d] hover:text-[#173f3d]" data-testid="link-tutorijal-finish">
            Otvori Muallimski panel <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      </div>
      </TranslateContent>
      <style>{`
        .guide-prose strong { color: #173f3d; font-weight: 800; }
        .guide-prose p + p { margin-top: 1rem; }
        .guide-prose code { border: 1px solid #d9e5df; background: #f3f8f4; color: #174f47; }
        @media print {
          .guide-prose { font-size: 0.95rem !important; line-height: 1.65 !important; }
          [data-testid^="guide-step-"] { break-inside: avoid; margin-bottom: 1rem; }
          [data-testid^="guide-step-"] > div { box-shadow: none !important; }
          #sedmicni-ritam { color: #173f3d !important; background: #f8f1e5 !important; }
          #sedmicni-ritam p { color: #405052 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </Layout>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return <WalletCards className={className} />;
}