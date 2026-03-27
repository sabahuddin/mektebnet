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

      <footer className="border-t border-border/30 py-6 text-center text-sm text-muted-foreground">
        <span className="font-bold text-primary">mekteb<span className="text-secondary">.net</span></span>
        <span className="mx-2">©</span>
        <span>{new Date().getFullYear()} · {t("footer.platforma")}</span>
      </footer>
    </div>
  );
}
