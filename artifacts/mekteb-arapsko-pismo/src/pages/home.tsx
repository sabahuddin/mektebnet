import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { Layout } from "@/components/layout";
import { Maskota } from "@/components/maskota";
import { BookOpen, HelpCircle, Library, GraduationCap, Gamepad2, Star, Flame, ChevronRight, BookMarked } from "lucide-react";

interface ModuleCard {
  href: string;
  icon: typeof BookOpen;
  label: string;
  desc: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  count: string;
  comingSoon?: boolean;
  beePose?: string;
  beeAlt?: string;
}

const POSES_BASE = `${import.meta.env.BASE_URL}images/maskota/poses`;

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Sufara modul je u izradi — kartica se prikazuje SVIMA, ali sa "USKORO"
  // badge-om i nije klikabilna (link je onemogućen). Klasična /arapsko-pismo
  // ruta i dalje radi za adminstratore (i muallime, ako bude trebalo testirati).
  const MODULES: ModuleCard[] = [
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
      beePose: "pcela-klanja.png",
      beeAlt: "Pčela klanja na seđadi",
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
      beePose: "pcela-razmislja.png",
      beeAlt: "Pčela razmišlja",
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
      beePose: "pcela-cita-kuran.png",
      beeAlt: "Pčela čita Kur'an",
    },
    {
      href: "/igrice",
      icon: Gamepad2,
      label: t("nav.igrice"),
      desc: t("home.igriceDesc"),
      color: "from-pink-500 to-rose-600",
      bg: "bg-pink-50",
      border: "border-pink-200",
      text: "text-pink-700",
      count: `7 ${t("nav.igrice").toLowerCase()}`,
      beePose: "pcela-hoda.png",
      beeAlt: "Pčela hoda sa torbom",
    },
    {
      href: "/arapsko-pismo",
      icon: GraduationCap,
      label: t("nav.sufara"),
      desc: t("home.sufaraDesc"),
      color: "from-primary to-teal-600",
      bg: "bg-primary/5",
      border: "border-primary/20",
      text: "text-primary",
      count: `6 ${t("home.lekcija6")}`,
      comingSoon: true,
    },
  ];

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden mb-10"
        style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, hsl(var(--secondary)/0.05) 100%)" }}
      >
        <div className="p-8 md:p-12 flex flex-col items-center text-center gap-5">
          <motion.div
            data-testid="home-maskota-pozdrav"
            initial={{ opacity: 0, y: -14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.1 }}
          >
            <motion.div
              animate={
                typeof window !== "undefined" &&
                typeof window.matchMedia === "function" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? undefined
                  : { y: [0, -10, 0] }
              }
              transition={{ duration: 2.6, ease: "easeInOut", delay: 0.7, repeat: Infinity, repeatDelay: 4 }}
            >
              <Maskota varijanta="pozdrav" size={100} className="drop-shadow-md" />
            </motion.div>
          </motion.div>
          {user?.role === "ucenik" && (
            <div className="flex items-center gap-4 flex-wrap justify-center">
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
      </motion.div>

      <h2 className="text-xl font-extrabold text-foreground mb-6 flex items-center gap-2">
        <BookMarked className="w-5 h-5 text-primary" />
        {t("home.odaberiModul")}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10" data-testid="home-modules">
        {MODULES.map((mod, i) => {
          // Sadržaj kartice — koristi se i u Link i u "div" varijanti
          // (za onemogućenu Sufara karticu sa USKORO badge-om).
          const cardInner = (
            <div
              className={`${mod.bg} ${mod.border} border-2 rounded-3xl p-6 transition-all group h-full relative overflow-hidden ${
                mod.comingSoon
                  ? "cursor-not-allowed opacity-75"
                  : "cursor-pointer hover:shadow-lg hover:-translate-y-1 duration-200"
              }`}
              data-testid={`module-card-${mod.href.replace("/", "")}`}
            >
              {mod.beePose && (
                <picture>
                  <source srcSet={`${POSES_BASE}/${mod.beePose.replace(".png", ".webp")}`} type="image/webp" />
                  <img
                    src={`${POSES_BASE}/${mod.beePose}`}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    width={128}
                    height={128}
                    className="absolute -bottom-3 -right-2 w-28 md:w-32 h-auto object-contain pointer-events-none select-none opacity-90 group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-300 drop-shadow-md"
                    data-testid={`module-bee-${mod.href.replace("/", "")}`}
                  />
                </picture>
              )}
              {mod.comingSoon && (
                <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full shadow-sm border border-amber-500/40 z-10">
                  {t("home.uskoro")}
                </div>
              )}
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${mod.color} rounded-2xl flex items-center justify-center shadow-md ${
                    mod.comingSoon ? "" : "group-hover:scale-110"
                  } transition-transform`}
                >
                  <mod.icon className="w-6 h-6 text-white" />
                </div>
                <div
                  className={`text-xs font-bold ${mod.text} px-3 py-1 rounded-full border ${mod.border} bg-white/60 ${
                    mod.comingSoon ? "mr-16" : ""
                  }`}
                >
                  {mod.count}
                </div>
              </div>
              <h3 className={`text-xl font-extrabold ${mod.text} mb-2 relative z-10`}>{mod.label}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-4 relative z-10 pr-24 md:pr-28">{mod.desc}</p>
              {!mod.comingSoon && (
                <div className={`flex items-center gap-1 ${mod.text} font-bold text-sm relative z-10`}>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </div>
          );

          return (
            <motion.div
              key={mod.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              {mod.comingSoon ? cardInner : <Link href={mod.href}>{cardInner}</Link>}
            </motion.div>
          );
        })}
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
