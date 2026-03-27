import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { Layout } from "@/components/layout";
import { BookOpen, HelpCircle, Library, GraduationCap, Star, Flame, ChevronRight, BookMarked } from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();

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
    },
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
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <img src={`${import.meta.env.BASE_URL}images/dzana.png`} alt="Džana" className="w-24 h-24 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <img src={`${import.meta.env.BASE_URL}images/amir.png`} alt="Amir" className="w-24 h-24 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        </div>
      </motion.div>

      <h2 className="text-xl font-extrabold text-foreground mb-6 flex items-center gap-2">
        <BookMarked className="w-5 h-5 text-primary" />
        {t("home.odaberiModul")}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {MODULES.map((mod, i) => (
          <motion.div key={mod.href} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Link href={mod.href}>
              <div className={`${mod.bg} ${mod.border} border-2 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${mod.color} rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                    <mod.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`text-xs font-bold ${mod.text} px-3 py-1 rounded-full border ${mod.border} bg-white/60`}>
                    {mod.count}
                  </div>
                </div>
                <h3 className={`text-xl font-extrabold ${mod.text} mb-2`}>{mod.label}</h3>
                <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-4">{mod.desc}</p>
                <div className={`flex items-center gap-1 ${mod.text} font-bold text-sm`}>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
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
