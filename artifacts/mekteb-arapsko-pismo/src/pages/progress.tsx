import { useGetProgress } from "@workspace/api-client-react";
import { getStudentId } from "@/lib/student";
import { Layout } from "@/components/layout";
import { Star, Flame, Trophy, Award, Crown, Zap, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

const ALL_BADGES = [
  { id: "hafiz", name: "Mladi hafiz", emoji: "🌙", description: "Završene sve lekcije" },
  { id: "zvijezda", name: "Zvijezda elif-be", emoji: "⭐", description: "Osvojeno 1000 hasanata" },
  { id: "silsila", name: "Silsila", emoji: "🔥", description: "7 dana zaredom učenje" },
  { id: "pisac", name: "Pisac", emoji: "🖊️", description: "Završene vježbe pisanja" },
  { id: "brzinac", name: "Brzinac", emoji: "⚡", description: "Završena vježba ispod 30s" },
];

export default function Progress() {
  const studentId = getStudentId();
  
  const { data: progress, isLoading } = useGetProgress({ studentId }, {
    query: { retry: 1 }
  });

  const earnedBadgeIds = progress?.badges?.map(b => b.id) || [];

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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className="w-8 h-8">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
