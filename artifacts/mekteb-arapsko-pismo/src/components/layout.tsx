import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { Home, User, Menu, X, BookOpen, HelpCircle, Library, LayoutDashboard, LogOut, Shield, GraduationCap, BookMarked, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface LayoutProps { children: ReactNode; }

const FONT_LEVELS = ["font-size-1", "font-size-2", "font-size-3"];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
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
    { href: "/", label: "Početna", icon: Home },
    { href: "/ilmihal", label: "Ilmihal", icon: BookOpen },
    { href: "/kvizovi", label: "Kvizovi", icon: HelpCircle },
    { href: "/citaonica", label: "Čitaonica", icon: Library },
    { href: "/arapsko-pismo", label: "Sufara", icon: GraduationCap },
  ];

  const roleLinks = {
    muallim: [
      { href: "/muallim", label: "Muallim panel", icon: LayoutDashboard },
      { href: "/poruke", label: "Poruke", icon: MessageSquare },
    ],
    admin: [
      { href: "/admin", label: "Admin panel", icon: Shield },
      { href: "/poruke", label: "Poruke", icon: MessageSquare },
    ],
    roditelj: [
      { href: "/roditelj", label: "Moja djeca", icon: User },
      { href: "/poruke", label: "Poruke", icon: MessageSquare },
    ],
    ucenik: [{ href: "/napredak", label: "Moj napredak", icon: BookMarked }],
  };

  const extraLinks = user ? (roleLinks[user.role] || []) : [];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer shrink-0">
            <img src="/logo-mekteb.png" alt="Mekteb" className="h-10 w-auto group-hover:scale-105 transition-transform" />
          </Link>

          {/* Desktop Nav */}
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

          {/* Right side */}
          <div className="flex items-center gap-2">

            {/* Font size controls */}
            <div className="hidden sm:flex items-center gap-1 bg-muted/60 rounded-xl px-1 py-1">
              <button
                onClick={() => setFontLevel(l => Math.max(0, l - 1))}
                disabled={fontLevel === 0}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold text-muted-foreground hover:bg-white hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Smanji font"
              >
                A<span className="text-[10px] leading-none align-bottom">−</span>
              </button>
              <button
                onClick={() => setFontLevel(l => Math.min(2, l + 1))}
                disabled={fontLevel === 2}
                className="w-7 h-7 flex items-center justify-center rounded-lg font-bold text-muted-foreground hover:bg-white hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Povećaj font"
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
                <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-red-500 rounded-xl" title="Odjavi se">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button className="rounded-full font-bold shadow-sm" size="sm">Prijava</Button>
              </Link>
            )}

            {/* Mobile menu toggle */}
            <Button variant="ghost" size="icon" className="lg:hidden text-primary rounded-xl" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-border/50 bg-white">
              <nav className="flex flex-col p-4 gap-1">
                {/* Mobile font controls */}
                <div className="flex items-center gap-2 px-4 py-2 mb-1">
                  <span className="text-xs font-bold text-muted-foreground mr-1">Veličina fonta:</span>
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
                    Odjavi se ({user.displayName})
                  </button>
                )}
                {!user && (
                  <Link href="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 mt-2 rounded-xl font-bold text-base bg-primary text-primary-foreground">
                    <User className="w-5 h-5" />
                    Prijavi se
                  </Link>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 text-center text-sm text-muted-foreground">
        <span className="font-bold text-primary">mekteb<span className="text-secondary">.net</span></span>
        <span className="mx-2">©</span>
        <span>{new Date().getFullYear()} · Islamska edukativna platforma</span>
      </footer>
    </div>
  );
}
