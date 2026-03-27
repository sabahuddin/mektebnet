import { useState, useEffect } from "react";
import { useGetProgress } from "@workspace/api-client-react";
import { getStudentId } from "@/lib/student";
import { Layout } from "@/components/layout";
import { Star, Flame, Trophy, Award, Crown, Zap, BookOpen, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/context/auth";

const ALL_BADGES = [
  { id: "hafiz", name: "Mladi hafiz", emoji: "🌙", description: "Završene sve lekcije" },
  { id: "zvijezda", name: "Zvijezda elif-be", emoji: "⭐", description: "Osvojeno 1000 hasanata" },
  { id: "silsila", name: "Silsila", emoji: "🔥", description: "7 dana zaredom učenje" },
  { id: "pisac", name: "Pisac", emoji: "🖊️", description: "Završene vježbe pisanja" },
  { id: "brzinac", name: "Brzinac", emoji: "⚡", description: "Završena vježba ispod 30s" },
];

interface KvizRezultat {
  id: number;
  kvizNaslov: string;
  tacniOdgovori: number;
  ukupnoPitanja: number;
  procenat: number;
  bodovi: number;
  completedAt: string;
}

export default function Progress() {
  const studentId = getStudentId();
  const { token } = useAuth();
  const [kvizRezultati, setKvizRezultati] = useState<KvizRezultat[]>([]);
  const [showAllKvizovi, setShowAllKvizovi] = useState(false);
  
  const { data: progress, isLoading } = useGetProgress({ studentId }, {
    query: { retry: 1 }
  });

  useEffect(() => {
    if (!token) return;
    apiRequest<KvizRezultat[]>("GET", "/content/kviz-rezultati", undefined, token)
      .then(data => { if (Array.isArray(data)) setKvizRezultati(data); })
      .catch(() => {});
  }, [token]);

  const earnedBadgeIds = progress?.badges?.map(b => b.id) || [];
  const displayedKvizovi = showAllKvizovi ? kvizRezultati : kvizRezultati.slice(0, 5);
  const avgProcenat = kvizRezultati.length ? Math.round(kvizRezultati.reduce((s, r) => s + r.procenat, 0) / kvizRezultati.length) : 0;

  if (isLoading) {
    return (
      <Layout>
        <Skeleton className="w-64 h-12 mb-8 rounded-full" />
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
        <Skeleton className="w-full h-96 rounded-3xl" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <UserIcon />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">Tvoj Profil</h1>
          <p className="text-muted-foreground font-medium">Prati svoj napredak i skupljaj nagrade!</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} transition={{delay:0.1}}>
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 flex items-center gap-6">
            <div className="w-16 h-16 bg-yellow-400 text-white rounded-2xl flex items-center justify-center shadow-inner">
              <Star className="w-8 h-8 fill-current" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-yellow-800/70">Ukupno Hasanata</p>
              <p className="text-4xl font-black text-yellow-600">{progress?.totalHasanat || 0}</p>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} transition={{delay:0.2}}>
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 flex items-center gap-6">
            <div className="w-16 h-16 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-inner">
              <Flame className="w-8 h-8 fill-current" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-orange-800/70">Vatreni Niz</p>
              <p className="text-4xl font-black text-orange-600">{progress?.streakDays || 0} <span className="text-xl">dana</span></p>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} transition={{delay:0.3}}>
          <Card className="p-6 bg-gradient-to-br from-teal-50 to-blue-50 border-teal-200 flex items-center gap-6">
            <div className="w-16 h-16 bg-teal-500 text-white rounded-2xl flex items-center justify-center shadow-inner">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-teal-800/70">Završeno Lekcija</p>
              <p className="text-4xl font-black text-teal-600">{progress?.completedLessons?.length || 0}</p>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Quiz History */}
      {kvizRezultati.length > 0 && (
        <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} transition={{delay:0.4}} className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Tvoji Kvizovi
            <span className="ml-auto text-base font-medium text-muted-foreground">
              Prosjek: <span className={`font-bold ${avgProcenat >= 80 ? "text-emerald-600" : avgProcenat >= 50 ? "text-amber-600" : "text-red-500"}`}>{avgProcenat}%</span>
            </span>
          </h2>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border/50">
              {displayedKvizovi.map((r, i) => (
                <motion.div key={r.id} initial={{x:-10, opacity:0}} animate={{x:0, opacity:1}} transition={{delay:0.05*i}}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${r.procenat >= 80 ? "bg-emerald-100 text-emerald-600" : r.procenat >= 50 ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-500"}`}>
                    {r.procenat}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{r.kvizNaslov}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.tacniOdgovori}/{r.ukupnoPitanja} tačnih
                      {r.bodovi > 0 && <span className="ml-2 text-amber-600 font-bold">+{r.bodovi} hasanata</span>}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground shrink-0">
                    {r.completedAt ? new Date(r.completedAt).toLocaleDateString("bs-BA") : "-"}
                  </div>
                </motion.div>
              ))}
            </div>
            {kvizRezultati.length > 5 && (
              <button onClick={() => setShowAllKvizovi(!showAllKvizovi)}
                className="w-full py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1">
                {showAllKvizovi ? (<>Prikaži manje <ChevronUp className="w-4 h-4" /></>) : (<>Prikaži sve ({kvizRezultati.length}) <ChevronDown className="w-4 h-4" /></>)}
              </button>
            )}
          </Card>
        </motion.div>
      )}

      {/* Badges Section */}
      <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Award className="w-6 h-6 text-primary" />
        Kolekcija Bedževa
      </h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {ALL_BADGES.map((badge, i) => {
          const isEarned = earnedBadgeIds.includes(badge.id);
          return (
            <motion.div 
              initial={{scale: 0.9, opacity: 0}} 
              animate={{scale: 1, opacity: 1}} 
              transition={{delay: 0.1 * i}}
              key={badge.id}
            >
              <Card className={`p-6 flex flex-col items-center text-center h-full transition-all ${isEarned ? 'bg-white border-primary/30 shadow-md shadow-primary/5' : 'bg-muted/50 border-dashed opacity-60 grayscale'}`}>
                <div className={`text-5xl mb-4 ${isEarned ? 'drop-shadow-lg scale-110' : ''}`}>
                  {badge.emoji}
                </div>
                <h3 className={`font-bold leading-tight mb-2 ${isEarned ? 'text-foreground' : 'text-muted-foreground'}`}>{badge.name}</h3>
                <p className="text-xs text-muted-foreground mt-auto">{badge.description}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </Layout>
  );
}

// Simple generic user icon since Lucide User has variations
function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
