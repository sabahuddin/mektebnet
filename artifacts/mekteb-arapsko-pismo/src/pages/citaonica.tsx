import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useAuth } from "@/context/auth";
import { apiRequest } from "@/lib/api";
import { Library, ChevronRight, BookOpen, Lock, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// Guest gating: neulogovan posjetilac ima pristup samo priči o Ademu, a.s.
// Sve ostalo zaključano sa toast porukom da se prijavi/registruje.
const GUEST_UNLOCKED_KNJIGE = new Set<string>(["adem"]);

interface Knjiga {
  id: number;
  slug: string;
  naslov: string;
  kategorija: string;
  coverImage?: string;
}

interface Kategorija {
  id: number;
  slug: string;
  naziv: string;
  opis: string | null;
  redoslijed: number;
  defaultOpen: boolean;
}

// Sentinel kategorija za priče čiji `kategorija` slug ne postoji u tabeli
// kategorije_knjige (npr. nakon brisanja kategorije ili migracije).
const ORPHAN_KATEGORIJA: Kategorija = {
  id: -1,
  slug: "__orphan__",
  naziv: "Bez kategorije",
  opis: null,
  redoslijed: 9999,
  defaultOpen: false,
};

export default function CitaonicaPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [knjige, setKnjige] = useState<Knjiga[]>([]);
  const [kategorije, setKategorije] = useState<Kategorija[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Map<kategorija.slug, boolean> — true = otvoreno
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const showLockedToast = () => {
    toast({
      title: "🔒 Samo za registrirane korisnike",
      description: "Prijavite se ili registrujte da biste pristupili svim knjigama u čitaonici.",
    });
  };

  // Guest gating PRIVREMENO ISKLJUČEN — sve knjige dostupne gostima.
  // Vrati `!user && !GUEST_UNLOCKED_KNJIGE.has(k.slug)` kad treba ponovo zaključati.
  const isLocked = (_k: Knjiga) => false;

  useEffect(() => {
    Promise.all([
      apiRequest<Knjiga[]>("GET", "/content/knjige"),
      apiRequest<Kategorija[]>("GET", "/content/kategorije-knjiga"),
    ])
      .then(([knj, kats]) => {
        setKnjige(knj);
        setKategorije(kats);
        // Inicijalno stanje akordiona: koristi defaultOpen iz kategorije
        const initOpen: Record<string, boolean> = {};
        kats.forEach((k) => { initOpen[k.slug] = k.defaultOpen; });
        initOpen[ORPHAN_KATEGORIJA.slug] = false;
        setOpen(initOpen);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Grupisanje: za svaku kategoriju, koje knjige pripadaju.
  // Prazne grupe (bez knjiga) NE prikazujemo.
  const grupe = useMemo(() => {
    const knownSlugs = new Set(kategorije.map((k) => k.slug));
    const orphans = knjige.filter((k) => !knownSlugs.has(k.kategorija));
    const allKats = orphans.length > 0 ? [...kategorije, ORPHAN_KATEGORIJA] : kategorije;

    return allKats
      .map((kat) => ({
        kategorija: kat,
        knjige: kat.slug === ORPHAN_KATEGORIJA.slug
          ? orphans
          : knjige.filter((k) => k.kategorija === kat.slug),
      }))
      .filter((g) => g.knjige.length > 0);
  }, [knjige, kategorije]);

  const toggleOpen = (slug: string) => {
    setOpen((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <Library className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Čitaonica</h1>
            <p className="text-muted-foreground text-sm">
              Priče o poslanicima i islamske teme — {knjige.length} {knjige.length === 1 ? "knjiga" : "knjiga"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : grupe.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Library className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nema knjiga u čitaonici</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grupe.map((grupa) => {
              const isOpen = !!open[grupa.kategorija.slug];
              return (
                <KategorijaAccordion
                  key={grupa.kategorija.slug}
                  kategorija={grupa.kategorija}
                  knjige={grupa.knjige}
                  isOpen={isOpen}
                  onToggle={() => toggleOpen(grupa.kategorija.slug)}
                  isLocked={isLocked}
                  showLockedToast={showLockedToast}
                />
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function KategorijaAccordion({
  kategorija,
  knjige,
  isOpen,
  onToggle,
  isLocked,
  showLockedToast,
}: {
  kategorija: Kategorija;
  knjige: Knjiga[];
  isOpen: boolean;
  onToggle: () => void;
  isLocked: (k: Knjiga) => boolean;
  showLockedToast: () => void;
}) {
  const headerId = `kat-header-${kategorija.slug}`;
  const panelId = `kat-panel-${kategorija.slug}`;

  return (
    <div
      className="bg-white border-2 border-violet-200 rounded-3xl overflow-hidden shadow-sm"
      data-testid={`kategorija-${kategorija.slug}`}
    >
      <button
        id={headerId}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        data-testid={`kategorija-toggle-${kategorija.slug}`}
        className={`w-full flex items-center gap-4 p-5 text-left transition ${
          isOpen ? "bg-violet-50" : "hover:bg-violet-50/60"
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
          <Library className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-extrabold text-violet-900 text-base sm:text-lg">{kategorija.naziv}</h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-200 text-violet-800">
              {knjige.length}
            </span>
          </div>
          {kategorija.opis && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">{kategorija.opis}</p>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-violet-600" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 sm:p-5 border-t border-violet-100">
              {knjige.map((k, i) => {
                const locked = isLocked(k);
                const card = (
                  <div
                    className={`${
                      locked
                        ? "bg-muted/30 border-border grayscale-[60%]"
                        : "bg-violet-50 border-violet-200"
                    } border-2 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full relative`}
                  >
                    {locked && (
                      <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-full p-1.5 shadow">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div
                      className={`h-32 ${
                        locked
                          ? "bg-gradient-to-br from-slate-400 to-slate-600"
                          : "bg-gradient-to-br from-violet-400 to-purple-600"
                      } flex items-center justify-center overflow-hidden`}
                    >
                      {k.coverImage ? (
                        <img src={k.coverImage} alt={k.naslov} className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-12 h-12 text-white opacity-80" />
                      )}
                    </div>
                    <div className="p-3">
                      <h3
                        className={`font-extrabold leading-snug transition-colors text-sm ${
                          locked ? "text-muted-foreground" : "text-violet-800 group-hover:text-violet-600"
                        }`}
                      >
                        {k.naslov}
                      </h3>
                      <div
                        className={`flex items-center gap-1 font-bold text-xs mt-2 ${
                          locked ? "text-muted-foreground" : "text-violet-600"
                        }`}
                      >
                        {locked ? (
                          <>
                            Zaključano <Lock className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            Čitaj{" "}
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <motion.div
                    key={k.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                  >
                    {locked ? (
                      <button
                        type="button"
                        onClick={showLockedToast}
                        aria-label={`${k.naslov} — zaključano, samo za registrirane korisnike`}
                        aria-disabled="true"
                        className="w-full text-left"
                      >
                        {card}
                      </button>
                    ) : (
                      <Link href={`/citaonica/${k.slug}`}>{card}</Link>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
