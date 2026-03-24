import { useParams } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useGetLessonById } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen, Gamepad2, Info, CheckCircle2, PlayCircle, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Comprehensive mock data in case API is not ready
const MOCK_LESSON_DETAIL = {
  id: 2, orderNum: 2, slug: "elif-ba", title: "Elif i Hareketi", lessonType: "new_content" as const, letters: ["ا", "ب"], durationMin: 10, isUnlocked: true, isCompleted: false, hasanatEarned: 0,
  story: {
    character: "both" as const,
    lines: [
      { speaker: "dzana", text: "Znaš li Amire da se arapski čita zdesna nalijevo?", emotion: "happy" },
      { speaker: "amir", text: "Znam! I slova mijenjaju oblik zavisno gdje se nalaze u riječi.", emotion: "excited" }
    ]
  },
  letterData: [
    {
      arabic: "ا", name: "Elif", transliteration: "A/I/U",
      forms: { isolated: "ا", initial: "ا", medial: "ـا", final: "ـا" },
      dotCount: 0, nonConnecting: true, visualAssociation: "Kao uspravan štap", soundFile: "elif.mp3"
    },
    {
      arabic: "ب", name: "Ba", transliteration: "B",
      forms: { isolated: "ب", initial: "بـ", medial: "ـبـ", final: "ـب" },
      dotCount: 1, nonConnecting: false, visualAssociation: "Lađica s jednom tačkom ispod", soundFile: "ba.mp3"
    }
  ],
  exercises: [
    { type: "find_letter" as const, title: "Pronađi slovo", rounds: 5, hasanatReward: 10, timeLimit: 60 },
    { type: "count_dots" as const, title: "Broji tačke", rounds: 5, hasanatReward: 10 },
    { type: "which_form" as const, title: "Koji oblik?", rounds: 5, hasanatReward: 15 }
  ]
};

export default function LessonDetail() {
  const { id } = useParams();
  const lessonId = parseInt(id || "1", 10);
  
  const { data: lesson, isLoading, error } = useGetLessonById(lessonId, {
    query: { 
      retry: 1,
    }
  });

  // Fallback to mock data if API fails to load
  const data = (lesson || MOCK_LESSON_DETAIL) as typeof MOCK_LESSON_DETAIL;

  if (isLoading && !lesson) {
    return (
      <Layout>
        <Skeleton className="w-48 h-8 mb-8" />
        <Skeleton className="w-full h-64 rounded-3xl mb-8" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </Layout>
    );
  }

  const dzanaImg = `${import.meta.env.BASE_URL}images/dzana-avatar.png`;
  const amirImg = `${import.meta.env.BASE_URL}images/amir-avatar.png`;

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-teal-700 font-bold bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Nazad na lekcije
        </Link>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-border mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
                Lekcija {data.orderNum}
              </span>
              {data.isCompleted && (
                <span className="flex items-center gap-1 text-green-600 text-sm font-bold bg-green-50 px-3 py-1 rounded-full">
                  <CheckCircle2 className="w-4 h-4" /> Završeno
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-foreground">{data.title}</h1>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {data.letters.map((letter, i) => (
              <div key={i} className="w-16 h-16 bg-gradient-to-br from-primary to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white font-arabic text-4xl font-bold">
                {letter}
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.story && (
        <Card className="p-6 mb-8 bg-gradient-to-r from-orange-50 to-pink-50 border-orange-100">
          <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2 mb-6">
            <BookOpen className="w-6 h-6" />
            Priča za danas
          </h2>
          <div className="flex flex-col gap-4">
            {data.story.lines.map((line, i) => {
              const isDzana = line.speaker === 'dzana';
              return (
                <motion.div 
                  initial={{ opacity: 0, x: isDzana ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.2 }}
                  key={i} 
                  className={`flex items-end gap-4 ${!isDzana ? 'flex-row-reverse' : ''}`}
                >
                  <img 
                    src={isDzana ? dzanaImg : amirImg} 
                    alt={line.speaker} 
                    className="w-16 h-16 rounded-full bg-white shadow-sm border-2 border-white"
                  />
                  <div className={`relative px-6 py-4 rounded-2xl max-w-lg shadow-sm font-medium text-lg ${isDzana ? 'bg-white rounded-bl-none text-foreground' : 'bg-primary text-white rounded-br-none'}`}>
                    {line.text}
                    {/* Speech bubble tail */}
                    <div className={`absolute bottom-0 w-4 h-4 ${isDzana ? '-left-2 bg-white' : '-right-2 bg-primary'}`} style={{ clipPath: isDzana ? 'polygon(100% 0, 0 100%, 100% 100%)' : 'polygon(0 0, 0 100%, 100% 100%)' }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-8 mb-12">
        {/* Letters Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Info className="w-6 h-6 text-primary" />
            Upoznajmo slova
          </h2>
          
          <div className="grid gap-4">
            {data.letterData.map((letter, i) => (
              <Card key={i} className="p-6 border-2 border-border/50 hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-foreground">{letter.name}</h3>
                    <p className="text-muted-foreground font-medium">Izgovor: /{letter.transliteration}/</p>
                    {letter.nonConnecting && (
                      <span className="inline-block mt-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase">Ne spaja se ulijevo</span>
                    )}
                  </div>
                  <div className="text-6xl font-arabic font-bold text-primary">
                    {letter.arabic}
                  </div>
                </div>
                
                <div className="bg-muted rounded-xl p-4">
                  <p className="text-sm font-bold text-muted-foreground mb-3 text-center uppercase tracking-wider">Oblici slova</p>
                  <div className="flex justify-between text-center" dir="rtl">
                    <div>
                      <div className="text-4xl font-arabic font-bold text-foreground mb-1">{letter.forms.isolated}</div>
                      <div className="text-xs text-muted-foreground">Sam.</div>
                    </div>
                    <div>
                      <div className="text-4xl font-arabic font-bold text-foreground mb-1">{letter.forms.initial}</div>
                      <div className="text-xs text-muted-foreground">Poč.</div>
                    </div>
                    <div>
                      <div className="text-4xl font-arabic font-bold text-foreground mb-1">{letter.forms.medial}</div>
                      <div className="text-xs text-muted-foreground">Sred.</div>
                    </div>
                    <div>
                      <div className="text-4xl font-arabic font-bold text-foreground mb-1">{letter.forms.final}</div>
                      <div className="text-xs text-muted-foreground">Kraj.</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Exercises Section */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-accent" />
            Vježbe
          </h2>
          
          <div className="grid gap-4">
            {data.exercises.map((exercise, i) => (
              <Link key={i} href={`/lesson/${lessonId}/exercise/${exercise.type}`}>
                <Card className="p-4 flex items-center gap-4 hover:-translate-y-1 transition-transform cursor-pointer border-2 border-transparent hover:border-primary/20 shadow-sm hover:shadow-md group">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <PlayCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">{exercise.title}</h3>
                    <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                      <span>{exercise.rounds} rundi</span>
                      <span className="flex items-center gap-1 text-yellow-600">
                        <Star className="w-4 h-4 fill-current" /> {exercise.hasanatReward}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" className="shrink-0 group-hover:bg-primary/10">
                    Igraj
                  </Button>
                </Card>
              </Link>
            ))}
          </div>
          
          <div className="mt-8 p-6 bg-green-50 rounded-2xl border border-green-200 text-center">
            <h3 className="font-bold text-green-800 mb-2">Spreman za prelazak?</h3>
            <p className="text-green-700/80 mb-4 text-sm">Završi sve vježbe da bi otključao sljedeću lekciju i zaradio sve hasanate!</p>
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white game-button">
              Završi lekciju
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
