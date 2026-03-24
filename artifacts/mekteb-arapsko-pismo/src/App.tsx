import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/auth";

// Auth pages
import LoginPage from "./pages/login";
import RegisterRoditeljPage from "./pages/register-roditelj";

// Main pages
import Home from "./pages/home";
import NotFound from "@/pages/not-found";

// Arapsko pismo module
import ArapskoPismoPage from "./pages/arapsko-pismo";
import LessonDetail from "./pages/lesson-detail";
import Exercise from "./pages/exercise";
import Progress from "./pages/progress";

// Ilmihal
import IlmihalPage from "./pages/ilmihal";
import IlmihalLekcijaPage from "./pages/ilmihal-lekcija";

// Kvizovi
import KvizoviPage from "./pages/kvizovi";
import KvizPage from "./pages/kviz";

// Čitaonica
import CitaonicaPage from "./pages/citaonica";
import CitaonicaKnjigaPage from "./pages/citaonica-knjiga";

// Roditelj panel
import RoditeljPage from "./pages/roditelj";

// Poruke
import PorukePage from "./pages/poruke";

// Admin panel
import AdminPage from "./pages/admin";

// Muallim panel
import MuallimPanel from "./pages/muallim";
import MuallimPrisustvoPage from "./pages/muallim/prisustvo";
import MuallimDodajUcenikaPage from "./pages/muallim/dodaj-ucenika";
import MuallimDodajGrupuPage from "./pages/muallim/dodaj-grupu";
import MuallimUcenikPage from "./pages/muallim/ucenik";

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
      <Route path="/napredak" component={Progress} />

      {/* Ilmihal */}
      <Route path="/ilmihal" component={IlmihalPage} />
      <Route path="/ilmihal/:slug" component={IlmihalLekcijaPage} />

      {/* Kvizovi */}
      <Route path="/kvizovi" component={KvizoviPage} />
      <Route path="/kvizovi/:slug" component={KvizPage} />

      {/* Čitaonica */}
      <Route path="/citaonica" component={CitaonicaPage} />
      <Route path="/citaonica/:slug" component={CitaonicaKnjigaPage} />

      {/* Roditelj panel */}
      <Route path="/roditelj" component={RoditeljPage} />

      {/* Poruke */}
      <Route path="/poruke" component={PorukePage} />

      {/* Admin panel */}
      <Route path="/admin" component={AdminPage} />

      {/* Muallim panel */}
      <Route path="/muallim" component={MuallimPanel} />
      <Route path="/muallim/dodaj-ucenika" component={MuallimDodajUcenikaPage} />
      <Route path="/muallim/dodaj-grupu" component={MuallimDodajGrupuPage} />
      <Route path="/muallim/prisustvo/:grupaId" component={MuallimPrisustvoPage} />
      <Route path="/muallim/ucenik/:id" component={MuallimUcenikPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
