import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";
import { LanguageProvider } from "@/context/language";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PushPrompt } from "@/components/push-prompt";

// Auth pages
import LoginPage from "./pages/login";
import RegisterRoditeljPage from "./pages/register-roditelj";

// Main pages
import Home from "./pages/home";
import NotFound from "@/pages/not-found";

// Arapsko pismo module
import ArapskoPismoPage from "./pages/arapsko-pismo";
import LessonDetail from "./pages/lesson-detail";
import KartaHarfova from "./pages/karta-harfova";
import Exercise from "./pages/exercise";
import Progress from "./pages/progress";

// Ilmihal
import IlmihalPage from "./pages/ilmihal";
import IlmihalLekcijaPage from "./pages/ilmihal-lekcija";
import Nivo1MapaPage from "./pages/nivo1-mapa";
import MedaljonDetailPage from "./pages/medaljon-detail";

// Kvizovi
import KvizoviPage from "./pages/kvizovi";
import KvizPage from "./pages/kviz";

// Čitaonica
import CitaonicaPage from "./pages/citaonica";
import CitaonicaKnjigaPage from "./pages/citaonica-knjiga";

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
import AdminCitaonicaPage from "./pages/admin-citaonica";

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
import MuallimIzvjestajPage from "./pages/muallim/izvjestaj";
import H5pUputstvoPage from "./pages/h5p-uputstvo";
import MuallimH5pStatistikaPage from "./pages/muallim/h5p-statistika";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 },
  },
});

function Router() {
  return (
    <Switch>
      {/* Root */}
      <Route path="/" component={Home} />

      {/* Auth */}
      <Route path="/login" component={LoginPage} />
      <Route path="/registracija" component={RegisterRoditeljPage} />

      {/* Arapsko pismo */}
      <Route path="/arapsko-pismo" component={ArapskoPismoPage} />
      <Route path="/lesson/:id" component={LessonDetail} />
      <Route path="/lesson/:id/exercise/:type" component={Exercise} />
      <Route path="/karta-harfova" component={KartaHarfova} />
      <Route path="/napredak" component={Progress} />

      {/* Ilmihal */}
      <Route path="/ilmihal" component={IlmihalPage} />
      <Route path="/nivo1-mapa" component={Nivo1MapaPage} />
      <Route path="/medaljon/:slug" component={MedaljonDetailPage} />
      <Route path="/ilmihal/:slug" component={IlmihalLekcijaPage} />

      {/* Kvizovi */}
      <Route path="/kvizovi" component={KvizoviPage} />
      <Route path="/kvizovi/:slug" component={KvizPage} />

      {/* Čitaonica */}
      <Route path="/citaonica" component={CitaonicaPage} />
      <Route path="/citaonica/:slug" component={CitaonicaKnjigaPage} />

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
      <Route path="/admin/citaonica" component={AdminCitaonicaPage} />
      <Route path="/admin" component={AdminPage} />

      {/* Muallim panel */}
      <Route path="/muallim/izvjestaj/svi" component={MuallimIzvjestajPage} />
      <Route path="/muallim/izvjestaj/:tip/:id" component={MuallimIzvjestajPage} />
      <Route path="/muallim/h5p-uputstvo" component={H5pUputstvoPage} />
      <Route path="/muallim/h5p-statistika" component={MuallimH5pStatistikaPage} />
      <Route path="/muallim" component={MuallimPanel} />
      <Route path="/muallim/dodaj-ucenika" component={MuallimDodajUcenikaPage} />
      <Route path="/muallim/dodaj-grupu" component={MuallimDodajGrupuPage} />
      <Route path="/muallim/prisustvo/:grupaId" component={MuallimPrisustvoPage} />
      <Route path="/muallim/ucenik/:id" component={MuallimUcenikPage} />
      <Route path="/muallim/grupa/:id" component={MuallimGrupaPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <OfflineIndicator />
            <PushPrompt />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
