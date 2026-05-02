import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { Layout } from "@/components/layout";
import { Maskota } from "@/components/maskota";
import { BookOpen, HelpCircle, Library, GraduationCap, Star, Flame, ChevronRight, BookMarked } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Sufara modul je u izradi — kartica se prikazuje samo administratoru.
  const MODULES = [
    {
      href: "/ilmihal",
      icon: BookOpen,
      label: t("nav.ilmihal"),
      desc: t("home.ilmihalDesc"),
      color: "from-emerald-500 to-teal-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      count: `231 ${t("home.lekcija")}`,
    },
    {
      href: "/kvizovi",
      icon: HelpCircle,
      label: t("nav.kvizovi"),
      desc: t("home.kvizoviDesc"),
      color: "from-amber-500 to-orange-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      count: `43+ ${t("home.kviza")}`,
    },
    {
      href: "/citaonica",
      icon: Library,
      label: t("nav.citaonica"),
      desc: t("home.citaonicaDesc"),
      color: "from-violet-500 to-purple-600",
      bg: "bg-violet-50",
      border: "border-violet-200",
      text: "text-violet-700",
      count: `14 ${t("home.prica")}`,
    },
    ...(user?.role === "admin"
      ? [{
          href: "/arapsko-pismo",
          icon: GraduationCap,
          label: t("nav.sufara"),
          desc: t("home.sufaraDesc"),
          color: "from-primary to-teal-600",
          bg: "bg-primary/5",
          border: "border-primary/20",
          text: "text-primary",
          count: `6 ${t("home.lekcija6")}`,
        }]
      : []),
  ];

  const greeting = user
    ? `${t("home.selamUser", { name: user.displayName })} 👋`
    : `${t("home.selam")}! 👋`;

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden mb-10"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, hsl(var(--secondary)/0.05) 100%)" }}
      >
        <div className="p-8 md:p-10 flex items-center justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary mb-3 leading-tight">{greeting}</h1>
            <p className="text-muted-foreground font-medium text-lg leading-relaxed max-w-lg">
              {t("home.dobrodosli")}
            </p>
            {user?.role === "ucenik" && (
              <div className="flex items-center gap-4 mt-5 flex-wrap">
                <div className="flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-full font-bold shadow-sm border border-orange-200 text-sm">
                  <Flame className="w-4 h-4 fill-orange-500" />
                  {t("home.streakAktivan")}
                </div>
                <div className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full font-bold shadow-sm border border-yellow-200 text-sm">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  {t("home.sakupljajHasanate")}
                </div>
              </div>
            )}
          </div>
          <div className="hidden md:flex items-center shrink-0" data-testid="home-maskota-pozdrav">
            <motion.div
              initial={{ opacity: 0, x: 20, rotate: -8 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.2 }}
            >
              <motion.div
                animate={
                  typeof window !== "undefined" &&
                  typeof window.matchMedia === "function" &&
                  window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? undefined
                    : { rotate: [0, -6, 6, -4, 0] }
                }
                transition={{ duration: 2.4, ease: "easeInOut", delay: 0.8, repeat: 1, repeatDelay: 6 }}
                style={{ transformOrigin: "50% 90%" }}
              >
                <Maskota varijanta="pozdrav" size={120} className="drop-shadow-md" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <h2 className="text-xl font-extrabold text-foreground mb-6 flex items-center gap-2">
        <BookMarked className="w-5 h-5 text-primary" />
        {t("home.odaberiModul")}
      </h2>

      <div className="mb-10" data-testid="home-honeycomb">
        {(() => {
          const HEX_CLIP = { clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" };
          const rows: typeof MODULES[] = [];
          for (let i = 0; i < MODULES.length; i += 2) rows.push(MODULES.slice(i, i + 2));
          return rows.map((row, ri) => {
            // Offset/preklop primjenjujemo SAMO kad red ima 2 kartice (puni honeycomb).
            // Za neparan ukupni broj modula, zadnji "offset" red ima 1 karticu —
            // bez ovog guarda izgleda pomjerena/necentirana (translateX 13% + negativni mt).
            const isOffset = ri % 2 === 1 && row.length === 2;
            return (
              <div
                key={ri}
                className={`flex justify-center gap-2 sm:gap-4 ${isOffset ? "-mt-[12%] sm:-mt-[7%] md:-mt-[6%]" : ""}`}
                style={isOffset ? { transform: "translateX(13%)" } : undefined}
              >
                {row.map((mod, ci) => (
                  <motion.div
                    key={mod.href}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (ri * 2 + ci) * 0.08, type: "spring", stiffness: 200, damping: 18 }}
                    className="w-[46%] sm:w-[42%] md:w-[36%] lg:w-[28%]"
                  >
                    <Link href={mod.href}>
                      <div
                        className={`relative cursor-pointer transition-transform duration-200 hover:-translate-y-1 hover:drop-shadow-xl group`}
                        style={{ aspectRatio: "1 / 1.1547" }}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${mod.color}`}
                          style={HEX_CLIP}
                        />
                        <div
                          className={`absolute inset-[3px] ${mod.bg} flex flex-col items-center justify-center text-center px-[14%] py-[10%] gap-1.5 sm:gap-2`}
                          style={HEX_CLIP}
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${mod.color} rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                            <mod.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          </div>
                          <h3 className={`text-sm sm:text-base md:text-lg font-extrabold ${mod.text} leading-tight`}>
                            {mod.label}
                          </h3>
                          <span className={`text-[10px] sm:text-xs font-bold ${mod.text} px-2 py-0.5 rounded-full bg-white/70 whitespace-nowrap`}>
                            {mod.count}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            );
          });
        })()}
      </div>

      {user?.role === "muallim" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-white border-2 border-secondary/30 rounded-3xl p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-foreground">{t("nav.muallimPanel")}</h3>
          </div>
          <Link href="/muallim">
            <button className="bg-secondary text-secondary-foreground rounded-2xl px-6 py-3 font-bold hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </motion.div>
      )}

      {!user && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-white border-2 border-primary/20 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-primary">{t("home.prijaviSe")}</h3>
          </div>
          <Link href="/login">
            <button className="bg-primary text-primary-foreground rounded-2xl px-6 py-3 font-bold hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0">
              {t("nav.prijaviSe")} <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </motion.div>
      )}
    </Layout>
  );
}
