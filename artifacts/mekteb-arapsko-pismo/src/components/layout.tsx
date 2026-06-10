import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { LANG_LABELS, type Lang } from "@/lib/i18n";
import { Home, User, Menu, X, BookOpen, HelpCircle, Library, LayoutDashboard, LogOut, Shield, GraduationCap, Globe, Gamepad2, Volume2, VolumeX, MessageSquare, BookMarked, KeyRound, BookA } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlyingMaskota, SelamWelcome } from "@/components/maskota";
import { motion, AnimatePresence } from "framer-motion";
import { installAudioMute, isAudioMuted, setAudioMuted, subscribeAudioMuted } from "@/lib/audio-mute";
import { useUnreadPoruke } from "@/hooks/use-unread-poruke";
import { TrialBanner } from "@/components/trial-banner";

/** Inicijali iz displayName-a, max 2 slova (npr. "Tarik Avdić" → "TA"). */
function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).map(p => p[0] ?? "").filter(Boolean);
  return (parts.slice(0, 2).join("") || name.trim().slice(0, 2) || "?").toUpperCase();
}

interface LayoutProps { children: ReactNode; }

type NavLink = {
  href: string;
  label: string;
  icon: any;
  /** Akcija umjesto navigacije (npr. Sufara "Uskoro"). Kada je postavljena,
   *  stavka se renderuje kao <button> i ne koristi se href. */
  onClick?: () => void;
  /** Broj nepročitanih poruka — kada > 0 prikazuje se crveni značak.
   *  Koristi se samo na "Poruke" stavci. */
  badge?: number;
};

const FONT_LEVELS = ["font-size-1", "font-size-2", "font-size-3"];

const LANG_ORDER: Lang[] = ["bs", "sq", "de", "en", "tr", "ar"];

function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Prijavljeni korisnici vide samo jezike koje je admin dozvolio njihovom
  // muallimu (učenici prate muallima; admin/roditelj imaju sve). Gosti vide sve
  // dugmiće, ali samo bosanski radi — ostali traže prijavu.
  const { data: dozvoljeni } = useQuery<Lang[]>({
    queryKey: ["dozvoljeni-jezici", user?.id ?? "guest"],
    queryFn: async () => {
      const res = await apiRequest<{ jezici: Lang[] }>(
        "GET", "/content/dozvoljeni-jezici", undefined, token ?? undefined,
      );
      return res.jezici;
    },
    enabled: !!user && !!token,
    staleTime: 60_000,
  });

  // Prijavljen korisnik: dok se lista ne učita (ili padne upit) ne otkrivamo
  // nedozvoljene jezike — pokaži samo bosanski + trenutno aktivni. Gost vidi sve.
  const allowedLangs: Lang[] = user
    ? (dozvoljeni ?? Array.from(new Set<Lang>(["bs", lang])))
    : LANG_ORDER;

  // Ako prijavljenom korisniku trenutni jezik više nije dozvoljen (npr. admin ga
  // je isključio), vrati ga na bosanski.
  useEffect(() => {
    if (user && dozvoljeni && !dozvoljeni.includes(lang)) {
      setLang("bs");
    }
  }, [user, dozvoljeni, lang, setLang]);

  // Gost vidi sve jezike (radi otkrivanja), prijavljeni samo dozvoljene.
  const visibleLangs: Lang[] = user
    ? LANG_ORDER.filter(l => allowedLangs.includes(l))
    : LANG_ORDER;

  const handlePick = (l: Lang) => {
    setOpen(false);
    if (!user && l !== "bs") {
      toast({
        title: t("Jezik dostupan prijavljenim korisnicima"),
        description: t("Prijavite se da biste koristili ovaj jezik."),
      });
      return;
    }
    setLang(l);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-sm font-bold text-foreground transition-all border border-transparent hover:border-border/50"
      >
        <Globe className="w-3.5 h-3.5 text-primary" />
        {LANG_LABELS[lang]}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-border/50 py-1 min-w-[100px]"
            >
              {visibleLangs.map(l => {
                const locked = !user && l !== "bs";
                return (
                  <button
                    key={l}
                    onClick={() => handlePick(l)}
                    className={`w-full px-4 py-2 text-left text-sm font-bold transition-colors flex items-center gap-2 ${
                      lang === l ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                    } ${locked ? "opacity-60" : ""}`}
                  >
                    {LANG_LABELS[l]}
                    {lang === l && <span className="ml-auto text-primary">●</span>}
                    {locked && <KeyRound className="w-3 h-3 ml-auto text-muted-foreground" />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [fontLevel, setFontLevel] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("mekteb-fontsize") || "0", 10); } catch { return 0; }
  });
  const [audioMuted, setAudioMutedState] = useState<boolean>(() => isAudioMuted());
  const unreadPoruke = useUnreadPoruke();

  useEffect(() => {
    const root = document.documentElement;
    FONT_LEVELS.forEach(c => root.classList.remove(c));
    root.classList.add(FONT_LEVELS[fontLevel]);
    try { localStorage.setItem("mekteb-fontsize", String(fontLevel)); } catch {}
  }, [fontLevel]);

  useEffect(() => {
    installAudioMute();
    const unsub = subscribeAudioMuted((m) => setAudioMutedState(m));
    return unsub;
  }, []);

  const toggleAudioMute = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    setAudioMutedState(next);
  };

  // Sufara modul je još u izradi — stavka u navigaciji se prikazuje SAMO
  // adminu (interni pregled na /arapsko-pismo). Ostali korisnici i posjetioci
  // je ne vide dok modul ne bude gotov.
  const mainNavLinks: NavLink[] = [
    { href: "/", label: t("nav.pocetna"), icon: Home },
    { href: "/ilmihal", label: t("nav.ilmihal"), icon: BookOpen },
    { href: "/kuran", label: t("Kur'an"), icon: BookA },
    { href: "/kvizovi", label: t("nav.kvizovi"), icon: HelpCircle },
    { href: "/citaonica", label: t("nav.citaonica"), icon: Library },
    { href: "/igrice", label: t("nav.igrice"), icon: Gamepad2 },
    { href: "/vodic", label: "Vodič", icon: BookMarked },
    ...(user?.role === "admin"
      ? [{ href: "/arapsko-pismo", label: t("nav.sufara"), icon: GraduationCap } as NavLink]
      : []),
    // Demo prijava — vidljiva samo neulogiranim posjetiocima. Vodi direktno na
    // login sa otvorenim "Demo" tabom, jer posjetioci ne znaju da klikom na
    // "Prijava" mogu isprobati platformu bez registracije.
    ...(!user ? [{ href: "/login?tab=demo", label: "Demo prijava", icon: KeyRound } as NavLink] : []),
  ];

  const roleLinks: Record<string, NavLink[]> = {
    muallim: [
      { href: "/muallim", label: t("nav.muallimPanel"), icon: LayoutDashboard },
    ],
    admin: [
      { href: "/admin", label: t("nav.adminPanel"), icon: Shield },
    ],
    roditelj: [
      { href: "/roditelj", label: t("nav.roditeljPanel"), icon: LayoutDashboard },
    ],
    ucenik: [
      { href: "/ucenik", label: t("nav.mojaKosnica"), icon: LayoutDashboard },
    ],
  };

  // Poruke su dostupne svim prijavljenim korisnicima (učenik ↔ muallim ↔
  // roditelj ↔ admin). Stavku ubacujemo na početak `extraLinks` da se ona
  // pojavi prije panel-a uloge u nav-u, sa živim brojačem nepročitanih poruka.
  const porukeLink: NavLink = {
    href: "/poruke",
    label: t("nav.poruke"),
    icon: MessageSquare,
    badge: unreadPoruke,
  };
  const extraLinks: NavLink[] = user ? [porukeLink, ...(roleLinks[user.role] || [])] : [];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <FlyingMaskota />
      <SelamWelcome userName={user?.displayName} />
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          <Link href="/" className="flex items-center gap-2 group cursor-pointer shrink-0">
            <img src="/logo-mekteb.png" alt="Mekteb" className="h-10 w-auto group-hover:scale-105 transition-transform" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {mainNavLinks.map((link) => {
              // Glavna navigacija sa ikonom i nazivom modula (ranije bila samo
              // ikona, ali korisnici nisu prepoznavali šta je šta).
              const cls = `flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive(link.href) ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-foreground/60 hover:bg-muted hover:text-foreground"}`;
              if (link.onClick) {
                return (
                  <button key={link.href} type="button" onClick={link.onClick} className={cls} title={link.label} aria-label={link.label}>
                    <link.icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </button>
                );
              }
              return (
                <Link key={link.href} href={link.href} className={cls} title={link.label} aria-label={link.label}>
                  <link.icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            {extraLinks.map(link => (
              <Link key={link.href} href={link.href}
                className={`relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all ${isActive(link.href) ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-foreground/60 hover:bg-muted hover:text-foreground"}`}>
                <link.icon className="w-5 h-5" />
                {link.label}
                {link.badge && link.badge > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white"
                    aria-label={`${link.badge} nepročitanih`}
                    data-testid="nav-poruke-badge"
                  >
                    {link.badge > 99 ? "99+" : link.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">

            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <div className="hidden sm:flex items-center gap-1 bg-muted/60 rounded-xl px-1 py-1">
              <button
                onClick={() => setFontLevel(l => Math.max(0, l - 1))}
                disabled={fontLevel === 0}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold text-muted-foreground hover:bg-white hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={t("nav.smanjiFont")}
              >
                A<span className="text-[10px] leading-none align-bottom">−</span>
              </button>
              <button
                onClick={() => setFontLevel(l => Math.min(2, l + 1))}
                disabled={fontLevel === 2}
                className="w-7 h-7 flex items-center justify-center rounded-lg font-bold text-muted-foreground hover:bg-white hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={t("nav.povecajFont")}
              >
                A<span className="text-xs leading-none align-bottom">+</span>
              </button>
              <button
                onClick={toggleAudioMute}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-white ${audioMuted ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
                title={audioMuted ? "Uključi zvuk" : "Isključi zvuk"}
                aria-label={audioMuted ? "Uključi zvuk" : "Isključi zvuk"}
                aria-pressed={audioMuted}
                data-testid="nav-audio-toggle"
              >
                {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {user ? (
              <button
                onClick={logout}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                title={t("nav.odjaviSe")}
                data-testid="nav-logout-btn"
              >
                <LogOut className="w-4 h-4" />
                <span>{t("nav.odjaviSe")}</span>
              </button>
            ) : (
              <Link href="/login">
                <Button className="rounded-full font-bold shadow-sm" size="sm">{t("nav.prijava")}</Button>
              </Link>
            )}

            <Button variant="ghost" size="icon" className="lg:hidden text-primary rounded-xl" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-border/50 bg-white">
              <nav className="flex flex-col p-4 gap-1">
                <div className="flex items-center gap-2 px-4 py-2 mb-1">
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center gap-2 px-4 py-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground mr-1">{t("nav.velicinaFonta")}</span>
                  <button onClick={() => setFontLevel(l => Math.max(0, l - 1))} disabled={fontLevel === 0}
                    className="px-3 py-1 rounded-lg bg-muted text-sm font-bold disabled:opacity-30">A−</button>
                  <button onClick={() => setFontLevel(l => Math.min(2, l + 1))} disabled={fontLevel === 2}
                    className="px-3 py-1 rounded-lg bg-muted text-sm font-bold disabled:opacity-30">A+</button>
                  <button
                    onClick={toggleAudioMute}
                    className={`ml-2 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1.5 ${audioMuted ? "bg-red-50 text-red-600" : "bg-muted text-foreground"}`}
                    aria-pressed={audioMuted}
                    data-testid="nav-mobile-audio-toggle"
                  >
                    {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span>{audioMuted ? "Zvuk isklj." : "Zvuk uklj."}</span>
                  </button>
                </div>
                {[...mainNavLinks, ...extraLinks].map((link) => (
                  link.onClick ? (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => { setMobileOpen(false); link.onClick!(); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-base transition-colors w-full text-left ${isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"}`}
                    >
                      <link.icon className="w-5 h-5" />
                      <span className="flex-1">{link.label}</span>
                    </button>
                  ) : (
                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-base transition-colors ${isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"}`}>
                      <link.icon className="w-5 h-5" />
                      <span className="flex-1">{link.label}</span>
                      {link.badge && link.badge > 0 ? (
                        <span
                          className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-xs font-black flex items-center justify-center shadow-sm"
                          aria-label={`${link.badge} nepročitanih`}
                          data-testid="nav-mobile-poruke-badge"
                        >
                          {link.badge > 99 ? "99+" : link.badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                ))}
                {user ? (
                  <button
                    onClick={() => { setMobileOpen(false); logout(); }}
                    data-testid="nav-mobile-odjava"
                    className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl font-bold text-base text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="flex-1">{t("nav.odjaviSe")}</span>
                  </button>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl font-bold text-base bg-primary text-primary-foreground">
                    <User className="w-5 h-5" />
                    {t("nav.prijaviSe")}
                  </Link>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <TrialBanner />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border/30 py-6 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
              alt=""
              aria-hidden="true"
              className="w-7 h-7 object-contain opacity-90"
              data-testid="footer-maskota"
            />
            <span className="font-bold text-primary">mekteb<span className="text-secondary">.net</span></span>
          </div>
          <div>
            <span className="mx-1">©</span>
            <span>{new Date().getFullYear()} · {t("footer.platforma")}</span>
          </div>
          <div>
            <a href="https://buymeacoffee.com/mekteb" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-medium transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.502.451-.399.801.064.217.206.399.374.54.19.159.417.254.67.286.344.043.684.114 1.034.152.48.052.964.088 1.45.116.573.034 1.148.05 1.724.05a39.64 39.64 0 003.488-.213c.398-.045.794-.097 1.19-.156.025-.004.05-.007.074-.012a.652.652 0 01.119-.006c.222.016.472.085.583.28.073.128.067.284.048.427a33.466 33.466 0 01-1.856 7.963c-.162.4-.395.97-.895.97h-.004c-.423 0-.692-.443-.859-.822a24.272 24.272 0 01-1.153-3.322 62.625 62.625 0 01-.57-2.14c-.073-.304-.122-.757-.474-.893-.249-.096-.553-.066-.753.117-.144.131-.217.331-.185.529.08.476.162.95.263 1.422.27 1.26.607 2.503 1.006 3.727.258.79.549 1.63 1.065 2.291.481.617 1.236.877 1.987.72.768-.16 1.337-.78 1.676-1.467a32.87 32.87 0 002.053-8.573l.027-.236c.007-.053.007-.109.007-.164z"/>
              </svg>
              Buy me a coffee
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
