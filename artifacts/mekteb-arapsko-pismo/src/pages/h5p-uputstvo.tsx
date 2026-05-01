import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import {
  Step1Illustration,
  Step2Illustration,
  Step3Illustration,
  Step4Illustration,
  DragWordsExample,
  MultipleChoiceExample,
  ImageHotspotsExample,
} from "@/components/h5p/StepIllustrations";
import {
  ArrowLeft,
  Sparkles,
  Download,
  Apple,
  Monitor,
  Cog,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  FileText,
  ListChecks,
  Image as ImageIcon,
  Layers,
  ArrowRight,
} from "lucide-react";

interface H5pTemplate {
  fileName: string;
  naslov: string;
  tip: string;
  opis: string;
  primjer: string;
}

const H5P_TEMPLATES: H5pTemplate[] = [
  {
    fileName: "harfovi-drag-the-words.h5p",
    naslov: "Spoji harf sa imenom",
    tip: "Drag the Words",
    opis: "Učenik povlači imena harfova na pravo mjesto pored arapskog slova.",
    primjer: "ا → elif,  ب → ba,  ت → ta",
  },
  {
    fileName: "ilmihal-sartovi-imana.h5p",
    naslov: "Ilmihal — šartovi imana",
    tip: "Multiple Choice",
    opis: "5 pitanja sa po 4 ponuđena odgovora. Učenik bira tačan odgovor.",
    primjer: "Koliko ima šartova imana? a) 5  b) 6  c) 7  d) 8",
  },
  {
    fileName: "vakat-namaza-pairs.h5p",
    naslov: "Vakat namaza",
    tip: "Image Pairs",
    opis: "5 parova kartica: doba dana ↔ naziv namaza (sabah, podne, ikindija, akšam, jacija). Šablon dolazi sa SVG ilustracijama — muallim u Lumi-ju može zamijeniti svojim slikama.",
    primjer: "izlazak sunca ↔ SABAH,  podne ↔ PODNE,  zalazak sunca ↔ AKŠAM",
  },
  {
    fileName: "dijelovi-dzamije-hotspots.h5p",
    naslov: "Dijelovi džamije (starter)",
    tip: "Multiple Choice",
    opis: "Starter pitanja o dijelovima džamije (mihrab, minber, munara, mahfil). Naziv fajla pominje 'hotspot' jer muallim može u Lumi-ju lako konvertovati u Image Hotspots dodavanjem slike džamije.",
    primjer: "Šta je mihrab? a) Niša okrenuta Kibli  b) Munara  c) Minber  d) Mahfil",
  },
  {
    fileName: "harf-izgovor-memory.h5p",
    naslov: "Harf i izgovor — povuci par (starter)",
    tip: "Drag the Words",
    opis: "Starter vježba — učenik povlači izgovor na pravo mjesto pored arapskog harfa (džim, ha, ha tačka, dal…). Muallim u Lumi-ju može konvertovati u Memory Game dodavanjem slika harfova kao kartica.",
    primjer: "ج → džim,  ح → ha,  خ → ha (sa tačkom),  د → dal",
  },
];

const H5P_TIPOVI = [
  {
    Icon: ListChecks,
    color: "text-blue-600",
    bg: "bg-blue-100",
    tip: "Drag the Words",
    primjena: "Vježba pravopisa harfova, redoslijed riječi u dovi",
  },
  {
    Icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-100",
    tip: "Multiple Choice",
    primjena: "Ilmihal pitanja, kviz iz povijesti islama",
  },
  {
    Icon: ImageIcon,
    color: "text-purple-600",
    bg: "bg-purple-100",
    tip: "Image Hotspots",
    primjena: "Karta islamskih zemalja, dijelovi džamije, dijelovi tijela u abdestu",
  },
  {
    Icon: Sparkles,
    color: "text-pink-600",
    bg: "bg-pink-100",
    tip: "Memory Game",
    primjena: "Parovi harf↔izgovor, parovi pojam↔značenje",
  },
  {
    Icon: Layers,
    color: "text-amber-600",
    bg: "bg-amber-100",
    tip: "Image Pairs",
    primjena: "Spoji harf sa riječi, spoji vakat namaza sa dobom dana",
  },
  {
    Icon: ArrowRight,
    color: "text-teal-600",
    bg: "bg-teal-100",
    tip: "Sequencing",
    primjena: "Redosljed namaza, koraci uzimanja abdesta, dijelovi rukna",
  },
];

// Lumi download: oficijelna stranica je lumi.education (open-source projekat).
const LUMI_HOMEPAGE = "https://lumi.education/";

const LUMI_DOWNLOADS = [
  { Icon: Monitor, label: "Windows", href: LUMI_HOMEPAGE, note: ".exe" },
  { Icon: Apple, label: "macOS", href: LUMI_HOMEPAGE, note: ".dmg" },
  { Icon: Cog, label: "Linux", href: LUMI_HOMEPAGE, note: ".AppImage" },
];

// Inline SVG ilustracije (komponente uvezene gore): izbjegavaju HTTP/cache
// probleme koje smo vidjeli sa spoljnim .svg fajlovima u Playwright e2e testovima.
const STEP_ILLUSTRATIONS = [
  Step1Illustration,
  Step2Illustration,
  Step3Illustration,
  Step4Illustration,
];

function StepIllustration({ step }: { step: 1 | 2 | 3 | 4 }) {
  const Illustration = STEP_ILLUSTRATIONS[step - 1];
  return (
    <div data-testid={`h5p-step-illustration-${step}`}>
      <Illustration />
    </div>
  );
}

function StepCard({
  broj,
  naslov,
  children,
}: {
  broj: number;
  naslov: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border-2 border-blue-100 rounded-2xl p-5 md:p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white font-extrabold text-lg md:text-xl flex items-center justify-center shadow-md">
          {broj}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-base md:text-lg text-blue-900 mb-2">
            {naslov}
          </h3>
          <div className="text-sm md:text-[0.95rem] text-slate-700 leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Apsolutni put kroz BASE_URL (npr. "/", "/mekteb-arapsko-pismo/" itd.)
// — relativni "./..." linkovi razlažu se kroz aktivnu rutu i upadnu na pogrešnu putanju.
const TEMPLATES_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/h5p-templates`;

type Availability = "loading" | "available" | "missing";

function TemplateCard({
  template,
  status,
}: {
  template: H5pTemplate;
  status: Availability;
}) {
  return (
    <div className="bg-white border border-purple-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-bold uppercase text-purple-600 tracking-wide">
            {template.tip}
          </span>
        </div>
        <h4 className="font-extrabold text-base text-slate-900">{template.naslov}</h4>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{template.opis}</p>
      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 italic">
        Primjer: {template.primjer}
      </div>
      <div className="mt-auto pt-2">
        {status === "available" ? (
          <a
            href={`${TEMPLATES_BASE}/${template.fileName}`}
            download={template.fileName}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Preuzmi šablon
          </a>
        ) : status === "loading" ? (
          <div className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-slate-50 text-slate-400 font-bold text-sm">
            Provjeravam…
          </div>
        ) : (
          <div className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-slate-100 text-slate-500 font-bold text-sm cursor-not-allowed">
            Šablon dolazi uskoro
          </div>
        )}
      </div>
    </div>
  );
}

export default function H5pUputstvoPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [statuses, setStatuses] = useState<Record<string, Availability>>(() =>
    Object.fromEntries(H5P_TEMPLATES.map((t) => [t.fileName, "loading" as Availability])),
  );

  // Provjeri koji šabloni stvarno postoje. Vite dev server vraća SPA index.html
  // (HTTP 200 + text/html) za nepoznate putanje, pa moramo eksplicitno odbaciti
  // HTML fallback. .h5p fajl je zip arhiva — content-type je obično
  // application/zip, application/octet-stream ili nešto što NIJE text/html.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      H5P_TEMPLATES.map(async (t): Promise<readonly [string, Availability]> => {
        try {
          const res = await fetch(`${TEMPLATES_BASE}/${t.fileName}`, { method: "HEAD" });
          if (!res.ok) return [t.fileName, "missing"];
          const ct = (res.headers.get("content-type") ?? "").toLowerCase();
          if (ct.includes("text/html")) return [t.fileName, "missing"];
          return [t.fileName, "available"];
        } catch {
          return [t.fileName, "missing"];
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setStatuses(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allChecked = Object.values(statuses).every((s) => s !== "loading");
  const noneAvailable = allChecked && Object.values(statuses).every((s) => s !== "available");

  if (!user || (user.role !== "admin" && user.role !== "muallim")) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground font-medium">
            Pristup dozvoljen samo muallimima i adminima
          </p>
          <Button className="mt-4" onClick={() => setLocation("/")}>
            Nazad
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <button
          onClick={() => setLocation("/muallim")}
          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Nazad na muallim panel
        </button>

        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-500 rounded-3xl p-6 md:p-10 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-widest opacity-90">
              Vodič za muallime
            </span>
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold leading-tight mb-3">
            Kako napraviti svoju prvu H5P vježbu
          </h1>
          <p className="text-base md:text-lg opacity-95 max-w-2xl leading-relaxed">
            U 4 koraka: preuzmi besplatnu Lumi aplikaciju, klikni i napravi vježbu, sačuvaj
            kao .h5p fajl, uploaduj u Mekteb. Učenici je odmah mogu igrati u browseru.
          </p>
        </div>

        {/* Šta je H5P */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Šta je H5P?
          </h2>
          <div className="text-slate-700 leading-relaxed space-y-3 text-sm md:text-[0.95rem]">
            <p>
              <strong>H5P</strong> je open-source standard za interaktivne edukativne
              vježbe — kvizovi, drag-and-drop, memory igrice, image hotspots i još
              30+ tipova. Sve radi u browseru, bez instalacije za učenika.
            </p>
            <p>
              Mekteb prima gotov <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">.h5p</code> fajl
              i automatski ga prikazuje učenicima u lekciji. Ti samo kreiraš sadržaj
              i uploaduješ — sve ostalo radi platforma (bilježi rezultate u napredak učenika).
            </p>
          </div>

          {/* 3 primjera kako H5P izgleda u praksi */}
          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              Tri najčešća tipa H5P vježbi:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <DragWordsExample />
              <MultipleChoiceExample />
              <ImageHotspotsExample />
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">
              Sve tri vježbe učenik radi direktno u browseru — bez instalacije,
              bez plugina. Mekteb pamti rezultat u napredak učenika.
            </p>
          </div>
        </section>

        {/* Korak 1 */}
        <StepCard broj={1} naslov="Preuzmi Lumi Education (besplatno)">
          <p>
            <strong>Lumi</strong> je besplatna desktop aplikacija za pravljenje H5P
            vježbi. <strong>Ne traži račun, radi offline</strong>, i jednom napravljen
            sadržaj možeš ponovo otvarati i mijenjati.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {LUMI_DOWNLOADS.map(({ Icon, label, href, note }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-sm transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
                <span className="text-xs opacity-70">{note}</span>
              </a>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Klikom na bilo koje dugme otvara se zvanična{" "}
            <a
              href="https://lumi.education/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:no-underline inline-flex items-center gap-1"
            >
              lumi.education <ExternalLink className="w-3 h-3" />
            </a>{" "}
            stranica — preuzmi installer za svoj operativni sistem
            (Lumi-Setup-*.exe za Windows, Lumi-*.dmg za macOS, Lumi-*.AppImage
            za Linux).
          </p>
          <StepIllustration step={1} />
        </StepCard>

        {/* Korak 2 */}
        <StepCard broj={2} naslov="Kreiraj novu vježbu u Lumi-ju">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Otvori Lumi i klikni dugme <strong>"H5P Editor"</strong> (ili "Create new H5P").</li>
            <li>Iz biblioteke izaberi tip vježbe — npr. <em>Multiple Choice</em>, <em>Drag the Words</em>, <em>Memory Game</em>.</li>
            <li>Lumi će prvi put preuzeti potrebne biblioteke (potrebna je internet veza prvi put — ~50MB).</li>
          </ol>
          <p className="text-xs text-slate-500 mt-2">
            Savjet: ako ne znaš koji tip izabrati, pogledaj tabelu <em>Preporučeni tipovi</em> niže.
          </p>
          <StepIllustration step={2} />
        </StepCard>

        {/* Korak 3 */}
        <StepCard broj={3} naslov="Popuni sadržaj">
          <p>
            Lumi otvara formu sa svim poljima koje ti treba taj tip vježbe. Za
            primjer <em>Multiple Choice</em>:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Question</strong> — pitanje (npr. "Koliko ima šartova islama?")</li>
            <li><strong>Available options</strong> — ponuđeni odgovori, jedan po jedan</li>
            <li><strong>Correct?</strong> — čekiraj tačan odgovor</li>
            <li><strong>Tip / Feedback</strong> — opcionalna pomoć i objašnjenje (lijepa praksa)</li>
          </ul>
          <p>
            Pišeš na bosanskom — samo ostavi UI label-e Lumi-ja na engleskom (učenik
            ih neće vidjeti, vidjet će samo tvoj sadržaj).
          </p>
          <StepIllustration step={3} />
        </StepCard>

        {/* Korak 4 */}
        <StepCard broj={4} naslov="Sačuvaj kao .h5p i uploaduj u Mekteb">
          <ol className="list-decimal pl-5 space-y-1">
            <li>U Lumi-ju klikni <strong>File → Save as .h5p</strong> (ili dugme "Save").</li>
            <li>Daj fajlu ime po lekciji — npr. <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">sartovi-imana.h5p</code>.</li>
            <li>
              Vrati se u Mekteb, otvori odgovarajuću ilmihal lekciju, otvori sekciju{" "}
              <strong>"Materijali za nastavu"</strong> i klikni{" "}
              <strong>"Dodaj H5P vježbu"</strong>.
            </li>
            <li>Izaberi sačuvani .h5p fajl i pričekaj nekoliko sekundi.</li>
            <li>Vježba je odmah dostupna učenicima u toj lekciji.</li>
          </ol>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <strong>Maksimalna veličina:</strong> 50MB po vježbi. Ako koristiš slike,
            kompresuj ih (npr. <a href="https://squoosh.app" target="_blank" rel="noopener noreferrer" className="underline">squoosh.app</a>) prije nego ih ubaciš u Lumi.
          </div>
          <StepIllustration step={4} />
        </StepCard>

        {/* Tabela tipova */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 mb-4">
            <FileText className="w-5 h-5 text-teal-600" />
            Preporučeni tipovi za mektebske teme
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {H5P_TIPOVI.map(({ Icon, color, bg, tip, primjena }) => (
              <div
                key={tip}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50"
              >
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-sm text-slate-900">{tip}</div>
                  <div className="text-xs text-slate-600 leading-relaxed mt-0.5">
                    {primjena}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Šabloni */}
        <section className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-5 md:p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-purple-900 mb-2">
            <Download className="w-5 h-5 text-purple-600" />
            Preuzmi gotov šablon
          </h2>
          <p className="text-sm text-purple-800/80 mb-4 leading-relaxed">
            Otvori šablon u Lumi-ju, zamijeni primjere svojim sadržajem (harfovi,
            pitanja, slike), i ponovo eksportuj kao .h5p. Drastično ubrzava prvu vježbu.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {H5P_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.fileName}
                template={t}
                status={statuses[t.fileName] ?? "loading"}
              />
            ))}
          </div>
          {noneAvailable && (
            <p className="text-xs text-purple-700/70 mt-4 italic">
              Šabloni se trenutno pripremaju i bit će dodani uskoro. U međuvremenu,
              možeš slijediti uputstvo iznad i kreirati vježbu od nule — uzima
              5-10 minuta po vježbi.
            </p>
          )}
        </section>

        {/* CTA */}
        <div className="bg-white border-2 border-teal-200 rounded-2xl p-5 md:p-6 text-center">
          <h3 className="font-extrabold text-lg text-slate-900 mb-2">
            Spreman/na za upload?
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Otvori bilo koju ilmihal lekciju i u sekciji{" "}
            <strong>"Materijali za nastavu"</strong> klikni{" "}
            <strong>"Dodaj H5P vježbu"</strong>.
          </p>
          <Link
            href="/ilmihal"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-colors"
          >
            Otvori ilmihal lekcije
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </Layout>
  );
}
