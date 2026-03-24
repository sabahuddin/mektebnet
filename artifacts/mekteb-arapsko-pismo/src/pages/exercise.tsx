import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useGetLessonById, useSaveExerciseSession } from "@workspace/api-client-react";
import { getStudentId } from "@/lib/student";
import { X, Star, Timer, AlertCircle, CheckCircle2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Utilities for generating game data
const ALL_LETTERS = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش"];
const DOT_COUNTS: Record<string, number> = { "ا":0, "ب":1, "ت":2, "ث":3, "ج":1, "ح":0, "خ":1 };

export default function Exercise() {
  const { id, type } = useParams();
  const [, setLocation] = useLocation();
  const lessonId = parseInt(id || "1", 10);
  const studentId = getStudentId();
  
  const { data: lesson } = useGetLessonById(lessonId);
  const { mutateAsync: saveSession, isPending: isSaving } = useSaveExerciseSession();

  const [gameState, setGameState] = useState<'intro' | 'playing' | 'completed'>('intro');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Dynamic config based on type
  const config = lesson?.exercises.find(e => e.type === type) || { rounds: 5, hasanatReward: 10, title: "Vježba", timeLimit: 60 };
  const totalRounds = config.rounds;

  // Timer logic
  useEffect(() => {
    if (gameState !== 'playing' || !config.timeLimit) return;
    if (timeLeft <= 0) {
      endGame();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  const handleAnswer = (isCorrect: boolean) => {
    if (feedback !== null) return; // Prevent multiple clicks
    
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore(s => s + 1);

    setTimeout(() => {
      setFeedback(null);
      if (round + 1 >= totalRounds) {
        endGame();
      } else {
        setRound(r => r + 1);
      }
    }, 1000);
  };

  const endGame = async () => {
    setGameState('completed');
    if (score > totalRounds / 2) {
      triggerConfetti();
    }
    
    try {
      await saveSession({
        data: {
          studentId,
          lessonId,
          exerciseType: type || "unknown",
          correctAnswers: score,
          totalQuestions: totalRounds,
          timeSpentSeconds: config.timeLimit ? config.timeLimit - timeLeft : 30
        }
      });
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51']
      });

      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  // ---------------------------------------------------------
  // GAME RENDERERS
  // ---------------------------------------------------------

  const renderGameV1FindLetter = () => {
    const target = lesson?.letters[round % lesson.letters.length] || "ا";
    const grid = Array.from({length: 12}, () => ALL_LETTERS[Math.floor(Math.random() * ALL_LETTERS.length)]);
    // Ensure target exists
    grid[Math.floor(Math.random() * 12)] = target;

    return (
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-center">Pronađi slovo: <span className="font-arabic text-4xl text-primary mx-2">{target}</span></h2>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-2xl">
          {grid.map((letter, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(letter === target)}
              className="aspect-square bg-white rounded-2xl shadow-sm border-2 border-border/50 text-5xl font-arabic hover:bg-primary/5 hover:border-primary/30 transition-all active:scale-95 flex items-center justify-center"
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderGameV2CountDots = () => {
    const target = lesson?.letters[round % lesson.letters.length] || "ب";
    const correctDots = DOT_COUNTS[target] || 0;

    return (
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-8 text-center">Koliko tačaka ima ovo slovo?</h2>
        <div className="text-9xl font-arabic text-primary mb-12 drop-shadow-md">{target}</div>
        <div className="flex gap-4">
          {[0, 1, 2, 3].map(num => (
            <button
              key={num}
              onClick={() => handleAnswer(num === correctDots)}
              className="w-20 h-20 bg-white rounded-2xl shadow-md border-b-4 border-border text-3xl font-black hover:bg-primary hover:text-white hover:border-primary-foreground transition-all active:translate-y-1 active:border-b-0"
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderGameV4YesNo = () => {
    const isActuallyCorrect = Math.random() > 0.5;
    const targetLetter = lesson?.letters[round % lesson.letters.length] || "ت";
    const displayLetter = isActuallyCorrect ? targetLetter : ALL_LETTERS.find(l => l !== targetLetter) || "ا";

    return (
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-8 text-center">Da li je ovo slovo <span className="text-primary font-black uppercase">{targetLetter === "ت" ? "TA" : targetLetter}</span>?</h2>
        <div className="text-9xl font-arabic text-foreground mb-12 drop-shadow-md">{displayLetter}</div>
        <div className="flex gap-6 w-full max-w-md">
          <button onClick={() => handleAnswer(isActuallyCorrect)} className="flex-1 py-6 bg-green-500 rounded-2xl shadow-lg border-b-4 border-green-700 text-white text-3xl font-black hover:bg-green-400 active:translate-y-1 active:border-b-0 transition-all">DA</button>
          <button onClick={() => handleAnswer(!isActuallyCorrect)} className="flex-1 py-6 bg-red-500 rounded-2xl shadow-lg border-b-4 border-red-700 text-white text-3xl font-black hover:bg-red-400 active:translate-y-1 active:border-b-0 transition-all">NE</button>
        </div>
      </div>
    );
  };

  const renderGameV6Listen = () => {
    const targetLetter = lesson?.letters[round % lesson.letters.length] || "ث";
    const options = [targetLetter, ...ALL_LETTERS.filter(l => l !== targetLetter).slice(0, 3)].sort(() => Math.random() - 0.5);

    return (
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-8 text-center">Poslušaj i odaberi tačno slovo</h2>
        
        <button className="w-32 h-32 bg-primary rounded-full shadow-lg border-b-8 border-primary-foreground/30 flex items-center justify-center text-white hover:brightness-110 active:translate-y-2 active:border-b-0 transition-all mb-12 animate-pulse">
          <Volume2 className="w-16 h-16" />
        </button>

        <div className="flex gap-4">
          {options.map((letter, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(letter === targetLetter)}
              className="w-24 h-24 bg-white rounded-2xl shadow-md border-b-4 border-border text-5xl font-arabic hover:bg-secondary hover:text-white hover:border-secondary-foreground transition-all active:translate-y-1 active:border-b-0"
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const getActiveGame = () => {
    switch (type) {
      case 'find_letter': return renderGameV1FindLetter();
      case 'count_dots': return renderGameV2CountDots();
      case 'yes_no': return renderGameV4YesNo();
      case 'listen_recognize': return renderGameV6Listen();
      default: return renderGameV1FindLetter(); // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Decorative bg */}
      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-bg.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }} />

      {/* Top Bar */}
      <div className="relative z-10 p-4 md:p-6 flex justify-between items-center">
        <Button variant="ghost" size="icon" className="rounded-full bg-white/50 backdrop-blur" onClick={() => setLocation(`/lesson/${lessonId}`)}>
          <X className="w-6 h-6" />
        </Button>
        
        {gameState === 'playing' && (
          <div className="flex items-center gap-6 bg-white/80 backdrop-blur px-6 py-3 rounded-full shadow-sm font-bold border border-white">
            <div className="flex items-center gap-2 text-primary">
              <span className="text-muted-foreground uppercase text-xs tracking-wider">Runda</span>
              <span className="text-xl">{round + 1}/{totalRounds}</span>
            </div>
            {config.timeLimit && (
              <div className={`flex items-center gap-2 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-foreground'}`}>
                <Timer className="w-5 h-5" />
                <span className="text-xl font-mono">{timeLeft}s</span>
              </div>
            )}
          </div>
        )}

        <div className="w-10 h-10" /> {/* Balancer */}
      </div>

      {/* Main Play Area */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          
          {gameState === 'intro' && (
            <motion.div 
              key="intro"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border-2 border-primary/20 text-center max-w-md w-full"
            >
              <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-6">
                <Gamepad2 className="w-10 h-10" />
              </div>
              <h1 className="text-3xl font-black mb-4 text-foreground">{config.title}</h1>
              <p className="text-lg text-muted-foreground font-medium mb-8">Pripremi se! Igra traje {config.timeLimit} sekundi. Pokušaj osvojiti maksimalan broj poena.</p>
              <Button size="lg" className="w-full text-xl py-8 rounded-2xl game-button shadow-lg shadow-primary/30" onClick={() => setGameState('playing')}>
                ZAPOČNI IGRU
              </Button>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div 
              key={`round-${round}`}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              className="w-full max-w-4xl"
            >
              {getActiveGame()}
            </motion.div>
          )}

          {gameState === 'completed' && (
            <motion.div 
              key="completed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border-4 border-yellow-400 text-center max-w-md w-full relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500" />
              <div className="w-24 h-24 bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Trophy className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-black mb-2 text-foreground">Kraj igre!</h1>
              <p className="text-xl font-bold text-muted-foreground mb-8">Tvoj rezultat: <span className="text-primary text-3xl mx-2">{score}/{totalRounds}</span></p>
              
              <div className="bg-yellow-50 rounded-2xl p-6 mb-8 border border-yellow-200 flex flex-col items-center">
                <span className="text-sm font-bold uppercase tracking-wider text-yellow-800 mb-2">Osvojio si</span>
                <div className="flex items-center justify-center gap-3 text-4xl font-black text-yellow-600">
                  <Star className="w-8 h-8 fill-current" />
                  +{Math.round((score / totalRounds) * config.hasanatReward)}
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full text-xl py-6 rounded-xl"
                disabled={isSaving}
                onClick={() => setLocation(`/lesson/${lessonId}`)}
              >
                {isSaving ? "Spremanje..." : "Nazad na lekciju"}
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className={`absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none`}
          >
            {feedback === 'correct' ? (
              <div className="bg-green-500 text-white rounded-full p-8 shadow-2xl">
                <CheckCircle2 className="w-32 h-32" />
              </div>
            ) : (
              <div className="bg-red-500 text-white rounded-full p-8 shadow-2xl">
                <AlertCircle className="w-32 h-32" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
