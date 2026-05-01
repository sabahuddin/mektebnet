import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { LANG_LABELS, type Lang } from "@/lib/i18n";
import { Home, User, Menu, X, BookOpen, HelpCircle, Library, LayoutDashboard, LogOut, Shield, GraduationCap, BookMarked, MessageSquare, Globe, Calendar, ClipboardList, Gamepad2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlyingMaskota } from "@/components/maskota";
import { motion, AnimatePresence } from "framer-motion";
import { useUnreadPoruke } from "@/hooks/use-unread-poruke";

interface LayoutProps { children: ReactNode; }

type NavLink = {
  href: string;
  label: string;
  icon: any;
  /** Ako postoji, link se renderuje kao dropdown grupa; trigger linkuje na own href. */
  children?: NavLink[];
};

const FONT_LEVELS = ["font-size-1", "font-size-2", "font-size-3"];

const LANG_ORDER: Lang[] = ["bs", "de", "en", "tr", "ar"];

/**
 * Desktop dropdown grupa za nav linkove (npr. "Moj profil" → Moj profil / Moj napredak / Poruke).
 * Trigger je dugme; klikom se otvara mali popover sa child linkovima. Badge sa brojem
 * nepročitanih poruka pokazuje se i na trigger-u (kada je dropdown zatvoren) i pored
 * "Poruke" stavke unutar dropdown-a, da korisnik ne propusti nove poruke.
 */
function NavDropdown({
  link,
  isActive,
  unreadPoruke,
}: {
  link: NavLink;
  isActive: (href: string) => boolean;
  unreadPoruke: number;
}) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const children = link.children ?? [];
  const groupActive = children.some((c) => isActive(c.href));
  const triggerBadge =
    !open && children.some((c) => c.href === "/poruke") && unreadPoruke > 0;

  // Zatvori dropdown ako se ruta promijeni iz nekog drugog razloga
  // (npr. korisnik pritisne logo ili glavni meni dok je dropdown otvoren),
  // da ne ostane stale-open popover.
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Escape key zatvara dropdown — A11y poboljšanje za keyboard korisnike.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`nav-dropdown-${link.href.replace(/\W+/g, "-")}`}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-full font-bold text-base transition-all whitespace-nowrap ${
          groupActive
            ? "bg-secondary text-secondary-foreground"
            : "text-secondary hover:bg-secondary/10"
        }`}
      >
        <span className="relative inline-flex">
          <link.icon className="w-4 h-4" />
          {triggerBadge && (
            <span
              data-testid="badge-poruke-desktop"
              aria-label={`${unreadPoruke} nepročitanih poruka`}
              className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-none font-extrabold flex items-center justify-center shadow-sm border border-white"
            >
              {unreadPoruke > 9 ? "9+" : unreadPoruke}
            </span>
          )}
        </span>
        {link.label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
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
              className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-border/50 py-1 min-w-[200px]"
              role="menu"
            >
              {children.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold transition-colors ${
                    isActive(c.href)
                      ? "bg-secondary/10 text-secondary"
                      : "text-foreground/70 hover:bg-muted"
                  }`}
                >
                  <c.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{c.label}</span>
                  {c.href === "/poruke" && unreadPoruke > 0 && (
                    <span
                      aria-label={`${unreadPoruke} nepročitanih poruka`}
                      className="ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-none font-extrabold flex items-center justify-center"
                    >
                      {unreadPoruke > 9 ? "9+" : unreadPoruke}
                    </span>
                  )}
                </Link>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);

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
              {LANG_ORDER.map(l => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setOpen(false); }}
                  className={`w-full px-4 py-2 text-left text-sm font-bold transition-colors flex items-center gap-2 ${
                    lang === l ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                  }`}
                >
                  {LANG_LABELS[l]}
                  {lang === l && <span className="ml-auto text-primary">●</span>}
                </button>
              ))}
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
  const unreadPoruke = useUnreadPoruke();
  const [fontLevel, setFontLevel] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("mekteb-fontsize") || "0", 10); } catch { return 0; }
  });

  useEffect(() => {
    const root = document.documentElement;
    FONT_LEVELS.forEach(c => root.classList.remove(c));
    root.classList.add(FONT_LEVELS[fontLevel]);
    try { localStorage.setItem("mekteb-fontsize", String(fontLevel)); } catch {}
  }, [fontLevel]);

  const mainNavLinks: NavLink[] = [
    { href: "/", label: t("nav.pocetna"), icon: Home },
    { href: "/ilmihal", label: t("nav.ilmihal"), icon: BookOpen },
    { href: "/kvizovi", label: t("nav.kvizovi"), icon: HelpCircle },
    { href: "/citaonica", label: t("nav.citaonica"), icon: Library },
    { href: "/arapsko-pismo", label: t("nav.sufara"), icon: GraduationCap },
  ];

  // "Moj profil" za učenika je sada dropdown grupa: pod njim su Moj profil,
  // Moj napredak i Poruke. Tako top-level meni ima samo 2 stavke ("Moj profil"
  // i "Igrice") umjesto 4. Ostale uloge i dalje imaju flat listu.
  const roleLinks: Record<string, NavLink[]> = {
    muallim: [
      { href: "/muallim", label: t("nav.muallimPanel"), icon: LayoutDashboard },
      { href: "/poruke", label: t("nav.poruke"), icon: MessageSquare },
    ],
    admin: [
      { href: "/admin", label: t("nav.adminPanel"), icon: Shield },
      { href: "/poruke", label: t("nav.poruke"), icon: MessageSquare },
    ],
    roditelj: [
      { href: "/roditelj", label: t("nav.mojaDjeca"), icon: User },
      { href: "/roditelj/kalendar", label: "Kalendar", icon: Calendar },
      { href: "/roditelj/zadace", label: "Zadaće", icon: ClipboardList },
      { href: "/poruke", label: t("nav.poruke"), icon: MessageSquare },
    ],
    ucenik: [
      {
        href: "/ucenik",
        label: t("nav.mojProfil"),
        icon: User,
        children: [
          { href: "/ucenik", label: t("nav.mojProfil"), icon: User },
          { href: "/napredak", label: t("nav.mojNapredak"), icon: BookMarked },
          { href: "/poruke", label: t("nav.poruke"), icon: MessageSquare },
        ],
      },
      { href: "/igrice", label: t("nav.igrice"), icon: Gamepad2 },
    ],
  };

  const extraLinks: NavLink[] = user ? (roleLinks[user.role] || []) : [];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <FlyingMaskota />
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          <Link href="/" className="flex items-center gap-2 group cursor-pointer shrink-0">
            <img src="/logo-mekteb.png" alt="Mekteb" className="h-10 w-auto group-hover:scale-105 transition-transform" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {mainNavLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-base transition-all whitespace-nowrap ${isActive(link.href) ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-foreground/60 hover:bg-muted hover:text-foreground"}`}>
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
            {extraLinks.map(link => (
              link.children && link.children.length > 0 ? (
                <NavDropdown
                  key={link.href}
                  link={link}
                  isActive={isActive}
                  unreadPoruke={unreadPoruke}
                />
              ) : (
                <Link key={link.href} href={link.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-full font-bold text-base transition-all whitespace-nowrap ${isActive(link.href) ? "bg-secondary text-secondary-foreground" : "text-secondary hover:bg-secondary/10"}`}>
                  <span className="relative inline-flex">
                    <link.icon className="w-4 h-4" />
                    {link.href === "/poruke" && unreadPoruke > 0 && (
                      <span
                        data-testid="badge-poruke-desktop"
                        aria-label={`${unreadPoruke} nepročitanih poruka`}
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-none font-extrabold flex items-center justify-center shadow-sm border border-white"
                      >
                        {unreadPoruke > 9 ? "9+" : unreadPoruke}
                      </span>
                    )}
                  </span>
                  {link.label}
                </Link>
              )
            ))}
          </nav>

          <div className="flex items-center gap-2">

            <LanguageSwitcher />

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
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-bold text-foreground leading-tight">{user.displayName}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-red-500 rounded-xl" title={t("nav.odjaviSe")}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
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
                  <span className="text-xs font-bold text-muted-foreground mr-1">{t("nav.velicinaFonta")}</span>
                  <button onClick={() => setFontLevel(l => Math.max(0, l - 1))} disabled={fontLevel === 0}
                    className="px-3 py-1 rounded-lg bg-muted text-sm font-bold disabled:opacity-30">A−</button>
                  <button onClick={() => setFontLevel(l => Math.min(2, l + 1))} disabled={fontLevel === 2}
                    className="px-3 py-1 rounded-lg bg-muted text-sm font-bold disabled:opacity-30">A+</button>
                </div>
                {[...mainNavLinks, ...extraLinks].map((link) => (
                  link.children && link.children.length > 0 ? (
                    // Grupa: parent kao mali naslov, children indentirane stavke ispod.
                    // Tako mobile meni jasno prikazuje hijerarhiju bez dodatnog tap-a.
                    <div key={link.href} className="mt-1">
                      <div
                        className="flex items-center gap-2 px-4 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-secondary/70"
                        data-testid={`nav-mobile-group-${link.href.replace(/\W+/g, "-")}`}
                      >
                        <link.icon className="w-3.5 h-3.5" />
                        {link.label}
                      </div>
                      {link.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 pl-7 pr-4 py-2.5 rounded-xl font-bold text-base transition-colors ${
                            isActive(c.href) ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"
                          }`}
                        >
                          <c.icon className="w-5 h-5" />
                          <span className="flex-1">{c.label}</span>
                          {c.href === "/poruke" && unreadPoruke > 0 && (
                            <span
                              data-testid="badge-poruke-mobile"
                              aria-label={`${unreadPoruke} nepročitanih poruka`}
                              className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs leading-none font-extrabold flex items-center justify-center shadow-sm"
                            >
                              {unreadPoruke > 9 ? "9+" : unreadPoruke}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-base transition-colors ${isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"}`}>
                      <link.icon className="w-5 h-5" />
                      <span className="flex-1">{link.label}</span>
                      {link.href === "/poruke" && unreadPoruke > 0 && (
                        <span
                          data-testid="badge-poruke-mobile"
                          aria-label={`${unreadPoruke} nepročitanih poruka`}
                          className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs leading-none font-extrabold flex items-center justify-center shadow-sm"
                        >
                          {unreadPoruke > 9 ? "9+" : unreadPoruke}
                        </span>
                      )}
                    </Link>
                  )
                ))}
                {user && (
                  <button onClick={() => { logout(); setMobileOpen(false); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-base text-red-500 hover:bg-red-50 transition-colors text-left mt-2 border-t border-border/30 pt-4">
                    <LogOut className="w-5 h-5" />
                    {t("nav.odjaviSe")} ({user.displayName})
                  </button>
                )}
                {!user && (
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

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border/30 py-6 text-center text-sm text-muted-foreground space-y-2">
        <div className="flex items-center justify-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}images/maskota/pcela.png`}
            alt=""
            aria-hidden="true"
            className="w-7 h-7 object-contain opacity-90"
            data-testid="footer-maskota"
          />
          <span className="font-bold text-primary">mekteb<span className="text-secondary">.net</span></span>
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
      </footer>
    </div>
  );
}
