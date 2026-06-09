import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { useGameCredits, formatSeconds } from "@/hooks/use-game-credits";
import { useAuth } from "@/context/auth";
import { Gamepad2, Clock, Star, Trophy, Sparkles, Brain, Zap, Info, MapPin, Flag, Hexagon, Flower2, Bird } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useLanguage } from "@/context/language";

export default function IgricePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: credits, loading, error } = useGameCredits();

  if (!user) {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed">
          <Gamepad2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-bold text-foreground mb-1">{t("Igrice su dostupne samo prijavljenim učenicima")}</p>
          <Link href="/login" className="text-primary font-bold underline">{t("Prijavi se")}</Link>
        </Card>
      </Layout>
    );
  }
  if (user.role !== "ucenik") {
    return (
      <Layout>
        <Card className="p-8 text-center bg-muted/30 border-dashed" data-testid="role-guard-igrice">
          <Gamepad2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-bold text-foreground mb-1">{t("Igrice su dostupne samo učeničkim nalozima")}</p>
          <p className="text-sm text-muted-foreground">{t("Tvoj nalog je")} <strong>{user.role}</strong>. {t("Prijavi se kao učenik za pristup igricama.")}</p>
        </Card>
      </Layout>
    );
  }

  const remaining = credits?.secondsRemaining ?? 0;
  const allowed = credits?.secondsAllowed ?? 0;
  const spent = credits?.secondsSpent ?? 0;
  const totalHas = credits?.totalHasanat ?? 0;
  const totalMed = credits?.totalMed ?? 0;
  const blocks = Math.floor(totalHas / (credits?.hasanatPerBlock || 100));
  const noCredit = !loading && remaining <= 0;

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-white shadow-md">
          <Gamepad2 className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">{t("Igrice")}</h1>
          <p className="text-muted-foreground font-medium">{t("Zarađuj kapi meda 🍯 kroz lekcije i kvizove — zatim se zabavi i sakupljaj Aferime ⭐!")}</p>
        </div>
      </div>

      {/* Vremenski budžet */}
      <Card className="p-6 mb-8 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-400 text-white rounded-2xl flex items-center justify-center shadow-inner">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800/70">{t("Vrijeme za igre danas (i ukupno)")}</p>
              <p className="text-3xl font-black text-amber-700" data-testid="text-credit-remaining">
                {loading ? "…" : formatSeconds(remaining)} <span className="text-base font-bold text-amber-600">{t("preostalo")}</span>
              </p>
              <p className="text-xs text-amber-700/70 font-medium mt-1">
                {t("Otključano:")} {formatSeconds(allowed)} {t("· Iskorišteno:")} <span data-testid="text-credit-spent">{formatSeconds(spent)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3 border border-orange-200">
            <span className="text-2xl leading-none" aria-hidden>🍯</span>
            <div>
              <p className="text-xs font-bold text-orange-800/70 uppercase flex items-center gap-1">
                {t("Kapi meda")}
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("Kako kapi meda otključavaju vrijeme")}
                        className="text-orange-600 hover:text-orange-700 cursor-help"
                        data-testid="tooltip-hasanat-rule"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                      {t("Svakih")} <strong>{t("{n} kapi meda", { n: String(credits?.hasanatPerBlock || 100) })}</strong> {t("otključava")}{" "}
                      <strong>{formatSeconds(credits?.secondsPerBlock || 600)}</strong> {t("vremena za igre. Kapi meda se NE troše — ostaju ti zauvijek, samo otključavaju vrijeme.")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </p>
              <p className="text-xl font-black text-orange-600">{totalHas}</p>
              <p className="text-[10px] text-orange-700/70">{blocks} × {formatSeconds(credits?.secondsPerBlock || 600)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/70 rounded-xl px-4 py-3 border border-amber-200">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <div>
              <p className="text-xs font-bold text-amber-800/70 uppercase">{t("Aferimi")}</p>
              <p className="text-xl font-black text-yellow-600" data-testid="text-total-med">{totalMed}</p>
              <p className="text-[10px] text-amber-700/70">{t("zarađeni igranjem ⭐")}</p>
            </div>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 font-medium">{t("Greška pri učitavanju ({error}).", { error: String(error) })}</p>
        )}
      </Card>

      {noCredit && (
        <Card className="p-5 mb-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground mb-1">{t("Nema više vremena za igre")}</p>
              <p className="text-sm text-muted-foreground">
                {t("Svakih")} <strong>{t("{n} kapi meda 🍯", { n: String(credits?.hasanatPerBlock || 100) })}</strong> {t("otključava")}{" "}
                <strong>{formatSeconds(credits?.secondsPerBlock || 600)}</strong> {t("vremena za igre. Završi lekciju ili pokušaj kviz da zaradiš još.")}
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Link href="/ilmihal" className="text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:opacity-90">{t("Ilmihal lekcije")}</Link>
                <Link href="/kvizovi" className="text-sm font-bold bg-secondary text-secondary-foreground px-4 py-2 rounded-xl hover:opacity-90">{t("Kvizovi")}</Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      <h2 className="text-xl font-extrabold text-foreground mb-4 flex items-center gap-2">
        <Gamepad2 className="w-5 h-5 text-primary" />
        {t("Odaberi igru")}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
          <Link href="/igrice/pamti-par">
            <div data-testid="link-game-pamti-par" className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-purple-700 px-3 py-1 rounded-full border border-purple-200 bg-white/60">{t("Pamćenje")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-purple-700 mb-2">{t("Pamti par")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t(`Spoji parove arapskih harfova u što manje pokušaja. Klasična "Memory" igra.`)}
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Link href="/igrice/brzi-kviz">
            <div data-testid="link-game-brzi-kviz" className="bg-orange-50 border-2 border-orange-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-orange-700 px-3 py-1 rounded-full border border-orange-200 bg-white/60">{t("60 sekundi")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-orange-700 mb-2">{t("Brzi kviz")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t("Što više tačnih odgovora u 60 sekundi. Pitanja iz svih ilmihal lekcija.")}
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <Link href="/igrice/glavni-gradovi">
            <div data-testid="link-game-glavni-gradovi" className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 bg-white/60">{t("Geografija")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-emerald-700 mb-2">{t("Glavni gradovi")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t("Pojavi se grad — pogodi državu kojoj pripada. Naglasak na muslimanske zemlje.")}
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <Link href="/igrice/zastave">
            <div data-testid="link-game-zastave" className="bg-sky-50 border-2 border-sky-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Flag className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-sky-700 px-3 py-1 rounded-full border border-sky-200 bg-white/60">{t("Zastave")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-sky-700 mb-2">{t("Zastave svijeta")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t("Pojavi se zastava — pogodi državu. Učimo zemlje umme i svijeta.")}
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <Link href="/igrice/sace">
            <div data-testid="link-game-sace" className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Hexagon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-amber-700 px-3 py-1 rounded-full border border-amber-200 bg-white/60">{t("Saće 🐝")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-amber-700 mb-2">{t("Mektebsko saće")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t("Slaži šestougaone ćelije saća kao u Tetrisu. Popuni cijeli red i nestaje. Igraj dok ne izgubiš!")}
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <Link href="/igrice/medena-staza">
            <div data-testid="link-game-medena-staza" className="bg-emerald-50 border-2 border-emerald-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Flower2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 bg-white/60">{t("Ilmihal 🌼")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-emerald-700 mb-2">{t("Medena staza")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t("Pčelica ide od cvijeta do cvijeta. Tačno odgovori na ilmihalska pitanja i skupi sav med!")}
              </p>
            </div>
          </Link>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}>
          <Link href="/igrice/pcelin-let">
            <div data-testid="link-game-pcelin-let" className="bg-yellow-50 border-2 border-yellow-200 rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all group hover:-translate-y-1 duration-200 h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Bird className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-yellow-700 px-3 py-1 rounded-full border border-yellow-200 bg-white/60">{t("Refleksi 🐝")}</span>
              </div>
              <h3 className="text-xl font-extrabold text-yellow-700 mb-2">{t("Pčelin let")}</h3>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {t("90 sekundi leta — pčelica skuplja medene heksagone i izbjegava oblake. Klik / Space leti gore.")}
              </p>
            </div>
          </Link>
        </motion.div>
      </div>

      <Link href="/igrice/ljestvica">
        <div data-testid="link-leaderboard" className="bg-white border-2 border-primary/20 rounded-3xl p-5 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-teal-600 rounded-2xl flex items-center justify-center shadow-md">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-extrabold text-lg text-foreground">{t("Tabela")}</p>
              <p className="text-sm text-muted-foreground">{t("Pogledaj najbolje rezultate u svojoj grupi, mektebu i globalno.")}</p>
            </div>
          </div>
        </div>
      </Link>
    </Layout>
  );
}
