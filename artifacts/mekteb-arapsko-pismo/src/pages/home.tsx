import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { Layout } from "@/components/layout";
import { BookOpen, HelpCircle, Library, GraduationCap, Star, Flame, ChevronRight, BookMarked } from "lucide-react";

const MODULES = [
  {
    href: "/ilmihal",
    icon: BookOpen,
    label: "Ilmihal",
    desc: "Tri udžbenika islamske vjeronauke — interaktivne lekcije za sve razrede",
    color: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    count: "231 lekcija",
  },
  {
    href: "/kvizovi",
    icon: HelpCircle,
    label: "Kvizovi",
    desc: "Provjeri znanje kroz zanimljive kvizove i sakupljaj hasanate",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    count: "43+ kviza",
  },
  {
    href: "/citaonica",
    icon: Library,
    label: "Čitaonica",
    desc: "Priče o poslanicima i islamske teme za unapređenje čitanja",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    text: "text-violet-700",
    count: "14 priča",
  },
  {
    href: "/arapsko-pismo",
    icon: GraduationCap,
    label: "Arapsko pismo",
    desc: "Nauči arapsko pismo kroz igru sa Džanom i Amirom",
    color: "from-primary to-teal-600",
    bg: "bg-primary/5",
    border: "border-primary/20",
    text: "text-primary",
    count: "6 lekcija",
  },
];

export default function Home() {
  const { user } = useAuth();

  const greeting = user
    ? `Es-selamu 'alejkum, ${user.displayName}! 👋`
    : "Es-selamu 'alejkum! 👋";

  return (
    <Layout>
      {/* Hero */}
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
              Dobrodošli na mekteb.net — tvoje mjesto za učenje islama. Odaberi modul i počni učiti!
            </p>
            {user?.role === "ucenik" && (
              <div className="flex items-center gap-4 mt-5 flex-wrap">
                <div className="flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-full font-bold shadow-sm border border-orange-200 text-sm">
                  <Flame className="w-4 h-4 fill-orange-500" />
                  Streak aktivan
                </div>
                <div className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full font-bold shadow-sm border border-yellow-200 text-sm">
                  <Star className="w-4 h-4 fill-yellow-500" />
                  Sakupljaj hasanate
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

      {/* Modules Grid */}
      <h2 className="text-xl font-extrabold text-foreground mb-6 flex items-center gap-2">
        <BookMarked className="w-5 h-5 text-primary" />
        Odaberi modul
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
                  <span>Otvori</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Role-specific quick panel */}
      {user?.role === "muallim" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-white border-2 border-secondary/30 rounded-3xl p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-foreground">Muallim panel</h3>
            <p className="text-muted-foreground text-sm mt-1">Upravljaj učenicima, grupama, prisustvom i ocjenama</p>
          </div>
          <Link href="/muallim">
            <button className="bg-secondary text-secondary-foreground rounded-2xl px-6 py-3 font-bold hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0">
              Otvori <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </motion.div>
      )}

      {!user && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="bg-white border-2 border-primary/20 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg text-primary">Prijavi se za puni pristup</h3>
            <p className="text-muted-foreground text-sm mt-1">Prijavi se da pratiš napredak, zarađuješ hasanate i koristiš sve funkcije</p>
          </div>
          <Link href="/login">
            <button className="bg-primary text-primary-foreground rounded-2xl px-6 py-3 font-bold hover:opacity-90 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0">
              Prijavi se <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </motion.div>
      )}
    </Layout>
  );
}
