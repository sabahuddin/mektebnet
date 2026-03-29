import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { LANG_LABELS, type Lang } from "@/lib/i18n";
import { Home, User, Menu, X, BookOpen, HelpCircle, Library, LayoutDashboard, LogOut, Shield, GraduationCap, BookMarked, MessageSquare, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface LayoutProps { children: ReactNode; }

const FONT_LEVELS = ["font-size-1", "font-size-2", "font-size-3"];

const LANG_ORDER: Lang[] = ["bs", "de", "en", "tr", "ar"];

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
  const [fontLevel, setFontLevel] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("mekteb-fontsize") || "0", 10); } catch { return 0; }
  });

  useEffect(() => {
    const root = document.documentElement;
    FONT_LEVELS.forEach(c => root.classList.remove(c));
    root.classList.add(FONT_LEVELS[fontLevel]);
    try { localStorage.setItem("mekteb-fontsize", String(fontLevel)); } catch {}
  }, [fontLevel]);

  const mainNavLinks = [
    { href: "/", label: t("nav.pocetna"), icon: Home },
    { href: "/ilmihal", label: t("nav.ilmihal"), icon: BookOpen },
    { href: "/kvizovi", label: t("nav.kvizovi"), icon: HelpCircle },
    { href: "/citaonica", label: t("nav.citaonica"), icon: Library },
    { href: "/arapsko-pismo", label: t("nav.sufara"), icon: GraduationCap },
  ];

  const roleLinks: Record<string, { href: string; label: string; icon: any }[]> = {
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
      { href: "/poruke", label: t("nav.poruke"), icon: MessageSquare },
    ],
    ucenik: [
      { href: "/ucenik", label: t("nav.mojProfil"), icon: User },
      { href: "/napredak", label: t("nav.mojNapredak"), icon: BookMarked },
      { href: "/poruke", label: t("nav.poruke"), icon: MessageSquare },
    ],
  };

  const extraLinks = user ? (roleLinks[user.role] || []) : [];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col">
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
              <Link key={link.href} href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-base transition-all whitespace-nowrap ${isActive(link.href) ? "bg-secondary text-secondary-foreground" : "text-secondary hover:bg-secondary/10"}`}>
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
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
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-base transition-colors ${isActive(link.href) ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-muted"}`}>
                    <link.icon className="w-5 h-5" />
                    {link.label}
                  </Link>
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
        <div>
          <span className="font-bold text-primary">mekteb<span className="text-secondary">.net</span></span>
          <span className="mx-2">©</span>
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
