import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { LanguageProvider, useLanguage } from "@/context/language";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PushPrompt } from "@/components/push-prompt";
import { InstallPrompt } from "@/components/install-prompt";
import { CookieConsent } from "@/components/cookie-consent";

// Auth pages
import LoginPage from "./pages/login";
import RegisterRoditeljPage from "./pages/register-roditelj";
import ZaboravljenaSifraPage from "./pages/zaboravljena-sifra";
import ResetSifraPage from "./pages/reset-sifra";

// Main pages
import Home from "./pages/home";
import VodicPage from "./pages/vodic";
import NotFound from "@/pages/not-found";

// Informativne / pravne stranice
import ImpressumPage from "./pages/impressum";
import KontaktPage from "./pages/kontakt";
import UvjetiPage from "./pages/uvjeti";
import PrivatnostPage from "./pages/privatnost";
import KolaciciPage from "./pages/kolacici";

// Arapsko pismo module
import ArapskoPismoPage from "./pages/arapsko-pismo";
import LessonDetail from "./pages/lesson-detail";
import KartaHarfova from "./pages/karta-harfova";
import Exercise from "./pages/exercise";
import Progress from "./pages/progress";

// Ilmihal
import IlmihalPage from "./pages/ilmihal";
import IlmihalSvePage from "./pages/ilmihal-sve";
import IlmihalLekcijaPage from "./pages/ilmihal-lekcija";
import Nivo1MapaPage from "./pages/nivo1-mapa";
import MedaljonDetailPage from "./pages/medaljon-detail";

// Kvizovi
import KvizoviPage from "./pages/kvizovi";
import KvizPage from "./pages/kviz";

// Čitaonica
import CitaonicaPage from "./pages/citaonica";
import CitaonicaKnjigaPage from "./pages/citaonica-knjiga";

// Kur'an — admin može pregledati aktivni modul dok je javni pristup u razvoju.
import KuranPage from "./pages/kuran";
import KuranSuraPage from "./pages/kuran-sura";
import KuranStranicaPage from "./pages/kuran-stranica";

// Roditelj panel
import RoditeljPage from "./pages/roditelj";
import RoditeljKalendarPage from "./pages/roditelj/kalendar";
import RoditeljZadacePage from "./pages/roditelj/zadace";

// Poruke
import PorukePage from "./pages/poruke";

// Admin panel
import AdminPage from "./pages/admin";
import AdminRjecnikPage from "./pages/admin-rjecnik";
import AdminOrphanUploadsPage from "./pages/admin-orphan-uploads";
import AdminBankaPitanjaPage from "./pages/admin-banka-pitanja";
import AdminKvizEditorPage from "./pages/admin-kviz-editor";
import AdminAiImportPage from "./pages/admin-ai-import";
import AdminCitaonicaPage from "./pages/admin-citaonica";
import AdminEtapePage from "./pages/admin-etape";
import AdminPrijevodiPage from "./pages/admin-prijevodi";
import KrunisanjeNivoPage from "./pages/krunisanje";
import KrunisanjeLekcijaPage from "./pages/krunisanje-lekcija";

// Učenik profil
import UcenikProfilPage from "./pages/ucenik-profil";

// Igrice (gamifikacija)
import IgricePage from "./pages/igrice";
import PopraviSacePage from "./pages/popravi-sace";
import MisijePage from "./pages/misije";
import PamtiPar from "./pages/igrice/pamti-par";
import BrziKviz from "./pages/igrice/brzi-kviz";
import GlavniGradovi from "./pages/igrice/glavni-gradovi";
import ZastaveSvijeta from "./pages/igrice/zastave";
import MektebskoSace from "./pages/igrice/sace";
import MedenaStaza from "./pages/igrice/medena-staza";
import PcelinLet from "./pages/igrice/pcelin-let";
import Ljestvica from "./pages/igrice/ljestvica";

// Muallim panel
import MuallimPanel from "./pages/muallim";
import MuallimPrisustvoPage from "./pages/muallim/prisustvo";
import MuallimDodajUcenikaPage from "./pages/muallim/dodaj-ucenika";
import MuallimDodajGrupuPage from "./pages/muallim/dodaj-grupu";
import MuallimUcenikPage from "./pages/muallim/ucenik";
import MuallimGrupaPage from "./pages/muallim/grupa";
import MuallimRasporedPage from "./pages/muallim/raspored";
import MuallimIzvjestajPage from "./pages/muallim/izvjestaj";
import MuallimTutorijalPage from "./pages/muallim/tutorijal";
import H5pUputstvoPage from "./pages/h5p-uputstvo";
import MuallimH5pStatistikaPage from "./pages/muallim/h5p-statistika";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
  },
});

function KuranAdminLandingRoute() {
  const { user } = useAuth();
  return user?.role === "admin" ? <KuranPage /> : <NotFound />;
}

function KuranAdminSuraRoute() {
  const { user } = useAuth();
  return user?.role === "admin" ? <KuranSuraPage /> : <NotFound />;
}

function KuranAdminPageRoute() {
  const { user } = useAuth();
  return user?.role === "admin" ? <KuranStranicaPage /> : <NotFound />;
}

function SufaraAdminRoute() {
  const { user } = useAuth();
  return user?.role === "admin" ? <ArapskoPismoPage /> : <NotFound />;
}

function Router() {
  return (
    <Switch>
      {/* Root */}
      <Route path="/" component={Home} />
      <Route path="/vodic" component={VodicPage} />

      {/* Informativne / pravne stranice */}
      <Route path="/impressum" component={ImpressumPage} />
      <Route path="/kontakt" component={KontaktPage} />
      <Route path="/uvjeti" component={UvjetiPage} />
      <Route path="/privatnost" component={PrivatnostPage} />
      <Route path="/kolacici" component={KolaciciPage} />

      {/* Auth */}
      <Route path="/login" component={LoginPage} />
      <Route path="/registracija" component={RegisterRoditeljPage} />
      <Route path="/zaboravljena-sifra" component={ZaboravljenaSifraPage} />
      <Route path="/reset-sifra" component={ResetSifraPage} />

      {/* Arapsko pismo */}
      <Route path="/arapsko-pismo" component={SufaraAdminRoute} />
      <Route path="/lesson/:id" component={LessonDetail} />
      <Route path="/lesson/:id/exercise/:type" component={Exercise} />
      <Route path="/karta-harfova" component={KartaHarfova} />
      <Route path="/napredak" component={Progress} />

      {/* Ilmihal */}
      <Route path="/ilmihal" component={IlmihalPage} />
      <Route path="/ilmihal/sve" component={IlmihalSvePage} />
      <Route path="/nivo1-mapa" component={() => <Nivo1MapaPage nivo={1} />} />
      <Route path="/nivo2-mapa" component={() => <Nivo1MapaPage nivo={2} />} />
      <Route path="/nivo3-mapa" component={() => <Nivo1MapaPage nivo={3} />} />
      {/* Back-compat: stari /nivo2 link sada vodi direktno u Zlatnu košnicu. */}
      <Route path="/nivo2" component={() => <Nivo1MapaPage nivo={2} />} />
      <Route path="/medaljon/:slug" component={MedaljonDetailPage} />
      <Route path="/krunisanje/lekcija/:slug" component={KrunisanjeLekcijaPage} />
      <Route path="/krunisanje/:nivo" component={KrunisanjeNivoPage} />
      <Route path="/ilmihal/:slug" component={IlmihalLekcijaPage} />

      {/* Kvizovi */}
      <Route path="/kvizovi" component={KvizoviPage} />
      <Route path="/kvizovi/:slug" component={KvizPage} />

      {/* Čitaonica */}
      <Route path="/citaonica" component={CitaonicaPage} />
      <Route path="/citaonica/:slug" component={CitaonicaKnjigaPage} />

      {/* Kur'an — aktivan za admina, razvojna poruka za ostale korisnike */}
      <Route path="/kuran" component={KuranAdminLandingRoute} />
      <Route path="/kuran/stranica/:p" component={KuranAdminPageRoute} />
      <Route path="/kuran/:n" component={KuranAdminSuraRoute} />

      {/* Roditelj panel */}
      <Route path="/roditelj/kalendar" component={RoditeljKalendarPage} />
      <Route path="/roditelj/zadace" component={RoditeljZadacePage} />
      <Route path="/roditelj" component={RoditeljPage} />

      {/* Učenik profil */}
      <Route path="/ucenik" component={UcenikProfilPage} />

      {/* Igrice */}
      <Route path="/igrice/pamti-par" component={PamtiPar} />
      <Route path="/igrice/brzi-kviz" component={BrziKviz} />
      <Route path="/igrice/glavni-gradovi" component={GlavniGradovi} />
      <Route path="/igrice/zastave" component={ZastaveSvijeta} />
      <Route path="/igrice/sace" component={MektebskoSace} />
      <Route path="/igrice/medena-staza" component={MedenaStaza} />
      <Route path="/igrice/pcelin-let" component={PcelinLet} />
      <Route path="/igrice/ljestvica" component={Ljestvica} />
      <Route path="/igrice" component={IgricePage} />

      {/* Popravi saće + Misije */}
      <Route path="/popravi-sace" component={PopraviSacePage} />
      <Route path="/misije" component={MisijePage} />

      {/* Poruke */}
      <Route path="/poruke" component={PorukePage} />

      {/* Admin panel */}
      <Route path="/admin/rjecnik" component={AdminRjecnikPage} />
      <Route path="/admin/orphan-uploads" component={AdminOrphanUploadsPage} />
      <Route path="/admin/banka-pitanja" component={AdminBankaPitanjaPage} />
      <Route path="/admin/kviz/:id" component={AdminKvizEditorPage} />
      <Route path="/admin/kviz-novi" component={AdminKvizEditorPage} />
      <Route path="/admin/ai-import" component={AdminAiImportPage} />
      <Route path="/admin/citaonica" component={AdminCitaonicaPage} />
      <Route path="/admin/etape" component={AdminEtapePage} />
      <Route path="/admin/prijevodi" component={AdminPrijevodiPage} />
      <Route path="/admin" component={AdminPage} />

      {/* Muallim panel */}
      <Route path="/muallim/izvjestaj/svi" component={MuallimIzvjestajPage} />
      <Route path="/muallim/izvjestaj/:tip/:id" component={MuallimIzvjestajPage} />
      <Route path="/muallim/tutorijal" component={MuallimTutorijalPage} />
      <Route path="/muallim/h5p-uputstvo" component={H5pUputstvoPage} />
      <Route path="/muallim/h5p-statistika" component={MuallimH5pStatistikaPage} />
      <Route path="/muallim" component={MuallimPanel} />
      <Route path="/muallim/dodaj-ucenika" component={MuallimDodajUcenikaPage} />
      <Route path="/muallim/dodaj-grupu" component={MuallimDodajGrupuPage} />
      <Route path="/muallim/grupa/:id/uredi" component={MuallimDodajGrupuPage} />
      <Route path="/muallim/prisustvo/:grupaId" component={MuallimPrisustvoPage} />
      <Route path="/muallim/ucenik/:id" component={MuallimUcenikPage} />
      <Route path="/muallim/grupa/:id" component={MuallimGrupaPage} />
      <Route path="/muallim/raspored/:grupaId" component={MuallimRasporedPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function HeartbeatMount() {
  useHeartbeat();
  return null;
}

/**
 * Sadržaj iz baze (lekcije, kvizovi, knjige, rječnik, igre...) dohvaća se preko
 * `apiRequest` u `useEffect`-ima koji ovise o ID-u resursa, a NE o jeziku — pa
 * promjena jezika ne bi ponovo dohvatila već učitan sadržaj (UI tekstovi se
 * mijenjaju reaktivno preko `t()`, ali DB sadržaj bi ostao na starom jeziku).
 * To je pravilo nastanka "miješanja" (npr. njemački meni + albanska lekcija).
 *
 * Rješenje: kompletno stablo stranica se REMOUNTUJE kad se jezik promijeni
 * (`key={lang}`), pa svi `useEffect` fetcheri ponovo opale s novim `X-Lang`
 * headerom. Tako je sadržaj uvijek u jednom, trenutno odabranom jeziku.
 */
function AppRoutes() {
  const { lang } = useLanguage();
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router key={lang} />
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <HeartbeatMount />
            <AppRoutes />
            <OfflineIndicator />
            <CookieConsent />
            <PushPrompt />
            <InstallPrompt />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
