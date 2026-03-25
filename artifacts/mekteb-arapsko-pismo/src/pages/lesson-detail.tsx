import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen, Check, Download, Gamepad2, Info, Map, PlayCircle, RotateCcw, Search, Star, Trophy, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLessonById, LESSONS, type Exercise, type ExerciseItem } from "@/data/lessons";

const BASE = import.meta.env.BASE_URL;

const COLOUR_MAP: Record<string, { card: string; badge: string; sound: string }> = {
  teal:   { card: "bg-teal-50 border-teal-300",    badge: "bg-teal-500 text-white",   sound: "bg-teal-100 text-teal-700 hover:bg-teal-200" },
  blue:   { card: "bg-blue-50 border-blue-300",    badge: "bg-blue-500 text-white",   sound: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  violet: { card: "bg-violet-50 border-violet-300",badge: "bg-violet-500 text-white", sound: "bg-violet-100 text-violet-700 hover:bg-violet-200" },
};

function isArabicChar(s: string) {
  const c = (s || "").codePointAt(0) ?? 0;
  return c >= 0x0600 && c <= 0x06FF;
}

function playAudio(file: string) {
  const audio = new Audio(`${BASE}audio/harfovi/${file}`);
  audio.play().catch(() => {});
}

function speakArabic(text: string) {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ar-SA";
  utter.rate = 0.75;
  window.speechSynthesis.speak(utter);
}

function ReadingGridModal({
  exercise,
  onClose,
  onComplete,
}: {
  exercise: Exercise;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [played, setPlayed] = useState<Set<number>>(new Set());
  const [shuffled] = useState<ExerciseItem[]>(() =>
    [...exercise.items].sort(() => Math.random() - 0.5)
  );

  function handleSpeak(text: string, idx: number) {
    speakArabic(text);
    setPlayed((prev) => { const n = new Set(prev); n.add(idx); return n; });
  }

  function handleFinish() {
    onComplete();
    onClose();
  }

  const pct = shuffled.length > 0 ? Math.round((played.size / shuffled.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-teal-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 pt-5 pb-4 shrink-0 border-b border-white/10">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-black text-xl leading-tight">{exercise.title}</h2>
          <p className="text-white/60 text-base">Pročitaj svaki slog naglas — klikni za izgovor</p>
        </div>
        <div className="text-white font-extrabold text-lg shrink-0 bg-white/15 px-3 py-1 rounded-full">
          {played.size}/{shuffled.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 shrink-0">
        <motion.div
          className="h-1.5 bg-green-400"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-center text-white/40 text-base mb-4">
          {played.size === 0
            ? "👆 Klikni na slog da čuješ izgovor"
            : played.size === shuffled.length
            ? "✅ Sve pročitano! Možeš završiti vježbu."
            : `Nastavi čitati — ostalo ${shuffled.length - played.size} slogova`}
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-w-3xl mx-auto">
          {shuffled.map((item, i) => {
            const isPlayed = played.has(i);
            const len = item.show.length;
            const fontSize = len <= 2 ? "2.8rem" : len <= 4 ? "2.1rem" : len <= 6 ? "1.6rem" : "1.3rem";
            return (
              <motion.button
                key={i}
                onClick={() => handleSpeak(item.show, i)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.93 }}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg transition-colors ${
                  isPlayed
                    ? "bg-green-500 shadow-green-500/30"
                    : "bg-white/15 hover:bg-white/25"
                }`}
              >
                <span
                  className="text-white font-bold text-center leading-none"
                  style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize }}
                >
                  {item.show}
                </span>
                {isPlayed && <Volume2 className="w-4 h-4 text-white/70" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 pt-4 shrink-0 border-t border-white/10">
        <Button
          onClick={handleFinish}
          className="w-full game-button text-lg py-6"
        >
          {played.size === shuffled.length
            ? "Odlično! Završi vježbu ✓"
            : `Završi vježbu (${played.size}/${shuffled.length} pročitano)`}
        </Button>
      </div>
    </div>
  );
}

function PronadiModal({
  exercise,
  onClose,
  onComplete,
}: {
  exercise: Exercise;
  onClose: () => void;
  onComplete: () => void;
}) {
  const target     = exercise.items[0]?.show ?? "ب";
  const targetName = exercise.items[0]?.answer ?? "?";
  const pool       = exercise.pool ?? ["ا"];
  const targetCount = exercise.targetCount ?? 6;
  const TOTAL = 30;

  const [cells, setCells] = useState<{ harf: string; isTarget: boolean; found: boolean; shake: boolean }[]>(() => {
    const arr: { harf: string; isTarget: boolean; found: boolean; shake: boolean }[] = [];
    for (let i = 0; i < targetCount; i++) arr.push({ harf: target, isTarget: true, found: false, shake: false });
    for (let i = 0; i < TOTAL - targetCount; i++) {
      arr.push({ harf: pool[i % pool.length], isTarget: false, found: false, shake: false });
    }
    return arr.sort(() => Math.random() - 0.5);
  });

  const foundCount = cells.filter(c => c.found).length;
  const allFound   = foundCount >= targetCount;
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (allFound && !notified) { setNotified(true); onComplete(); }
  }, [allFound, notified, onComplete]);

  function handleTap(idx: number) {
    const cell = cells[idx];
    if (cell.found) return;
    if (cell.isTarget) {
      speakArabic(target);
      setCells(prev => prev.map((c, i) => i === idx ? { ...c, found: true } : c));
    } else {
      setCells(prev => prev.map((c, i) => i === idx ? { ...c, shake: true } : c));
      setTimeout(() => setCells(prev => prev.map((c, i) => i === idx ? { ...c, shake: false } : c)), 500);
    }
  }

  const pct = Math.round((foundCount / targetCount) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-indigo-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 pt-5 pb-4 shrink-0 border-b border-white/10">
        <button onClick={onClose} className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-black text-xl leading-tight">Pronađi {targetName}!</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-white/60 text-base">Traži:</span>
            <span className="text-white font-bold" style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "1.6rem", lineHeight: 1 }}>{target}</span>
          </div>
        </div>
        <div className={`font-extrabold text-lg px-3 py-1 rounded-full shrink-0 transition-colors ${allFound ? "bg-green-500 text-white" : "bg-white/15 text-white"}`}>
          {foundCount}/{targetCount}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 shrink-0">
        <motion.div className="h-1.5 bg-green-400" animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {allFound && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-center mb-4 bg-green-500/20 border border-green-400/30 rounded-2xl py-3 px-4">
            <p className="text-green-300 text-xl font-black">🎉 Bravo! Sve si pronašao!</p>
          </motion.div>
        )}
        {!allFound && (
          <p className="text-center text-white/40 text-base mb-4">
            👆 Klikni svaki <span style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "1.2em" }}>{target}</span> koji pronađeš
          </p>
        )}
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-w-md mx-auto">
          {cells.map((cell, i) => (
            <motion.button
              key={i}
              onClick={() => handleTap(i)}
              whileTap={!cell.found ? { scale: 0.88 } : {}}
              animate={cell.shake ? { x: [-7, 7, -7, 7, 0] } : {}}
              transition={{ duration: 0.35 }}
              className={`aspect-square rounded-2xl flex items-center justify-center shadow-md transition-colors ${
                cell.found
                  ? "bg-green-500 shadow-green-500/30"
                  : cell.shake
                  ? "bg-red-500"
                  : "bg-white/15 hover:bg-white/25"
              }`}
            >
              {cell.found
                ? <Check className="w-5 h-5 text-white" />
                : <span style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "1.7rem", lineHeight: 1 }} className="text-white font-bold">{cell.harf}</span>
              }
            </motion.button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 pt-4 shrink-0 border-t border-white/10">
        <Button
          onClick={() => { if (!notified) { setNotified(true); onComplete(); } onClose(); }}
          className="w-full game-button text-lg py-6"
        >
          {allFound ? "Odlično! Završi ✓" : `Završi (${foundCount}/${targetCount} pronađeno)`}
        </Button>
      </div>
    </div>
  );
}

function QuizModal({
  exercise,
  onClose,
  onComplete,
}: {
  exercise: Exercise;
  onClose: () => void;
  onComplete: () => void;
}) {
  const isTypeInput   = exercise.type === "napiši";
  const isListening   = exercise.type === "slušaj";
  const isReadingSlog = exercise.type === "čitaj-slog";

  const [qIdx,       setQIdx]    = useState(0);
  const [score,      setScore]   = useState(0);
  const [status,     setStatus]  = useState<"asking" | "correct" | "wrong" | "done">("asking");
  const [selected,   setSelected] = useState<string | null>(null);
  const [text,       setText]    = useState("");
  const [choices,    setChoices] = useState<string[]>([]);
  const [wasCompleted, setWasCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const item  = exercise.items[qIdx];
  const total = exercise.items.length;

  useEffect(() => {
    const pool    = exercise.choices;
    const correct = item.answer;
    const wrong   = pool.filter(c => c !== correct);
    const picked  = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setChoices([correct, ...picked].sort(() => Math.random() - 0.5));
    setSelected(null);
    setText("");
    setStatus("asking");

    if (isListening && item.audio) {
      setTimeout(() => playAudio(item.audio!), 350);
    }
    if (isTypeInput) setTimeout(() => inputRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx]);

  // Notify parent once when quiz is completed for the first time
  useEffect(() => {
    if (status === "done" && !wasCompleted) {
      setWasCompleted(true);
      onComplete();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function answer(a: string) {
    if (status !== "asking") return;
    const correct = item.answer.toLowerCase().trim();
    const isOk    = a.toLowerCase().trim() === correct;
    setSelected(a);
    setStatus(isOk ? "correct" : "wrong");
    if (isOk) setScore(s => s + 1);
    setTimeout(() => {
      if (qIdx + 1 >= total) setStatus("done");
      else setQIdx(q => q + 1);
    }, 1300);
  }

  function restart() {
    setQIdx(0); setScore(0); setStatus("asking"); setSelected(null); setText("");
  }

  const pct = Math.round((score / total) * 100);

  if (status === "done") {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-1">Odlično!</h2>
          <p className="text-xl text-muted-foreground mb-2">{score} / {total} tačnih</p>
          <p className="text-4xl font-black text-primary mb-8">{pct}%</p>
          <div className="flex gap-3">
            <Button onClick={restart} variant="outline" className="flex-1 text-base py-5">
              <RotateCcw className="w-4 h-4 mr-2" /> Ponovi
            </Button>
            <Button onClick={onClose} className="flex-1 text-base py-5 game-button">
              Gotovo ✓
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const showIsAr = isArabicChar(item.show);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-teal-800 via-teal-700 to-teal-900">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 pt-5 pb-3 shrink-0">
        <button onClick={onClose}
          className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="flex-1 bg-white/20 rounded-full h-3 overflow-hidden">
          <motion.div
            className="bg-white h-3 rounded-full"
            animate={{ width: `${(qIdx / total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="text-white font-black text-lg flex items-center gap-1">
          <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
          {score}
        </div>
      </div>

      <p className="text-center text-white/60 text-base font-medium px-4 mb-2">
        {qIdx + 1} / {total}
      </p>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <p className="text-white/80 text-xl font-semibold text-center">{exercise.description}</p>

        {isListening ? (
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { if (item.audio) playAudio(item.audio); }}
            className="w-44 h-44 bg-white/20 hover:bg-white/30 rounded-3xl flex flex-col items-center justify-center gap-3 text-white shadow-xl transition-colors"
          >
            <Volume2 className="w-16 h-16" />
            <span className="text-2xl font-bold opacity-60">Pritisni za glas</span>
          </motion.button>
        ) : isReadingSlog ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-white/60 text-lg font-semibold tracking-wide uppercase">
              👆 Pročitaj naglas, pa odaberi
            </p>
            <motion.div
              key={qIdx}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/20 rounded-3xl flex items-center justify-center shadow-xl px-10 py-6"
              style={{ minWidth: "14rem" }}
            >
              <span
                className="font-bold text-white text-center"
                style={{
                  fontSize: item.show.length <= 4 ? "5rem" : item.show.length <= 6 ? "4rem" : "3rem",
                  lineHeight: "1.6",
                  fontFamily: "Noto Naskh Arabic, serif",
                  direction: "rtl",
                }}
              >
                {item.show}
              </span>
            </motion.div>
          </div>
        ) : (
          <motion.div
            key={qIdx}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-44 h-52 bg-white/20 rounded-3xl flex items-center justify-center shadow-xl overflow-visible"
            style={{ paddingTop: showIsAr ? "2rem" : "0" }}
          >
            <span
              className="font-bold text-white"
              style={{
                fontSize: showIsAr ? "5.5rem" : "4.5rem",
                lineHeight: showIsAr ? "1.5" : "1.2",
                fontFamily: showIsAr ? "Noto Naskh Arabic, serif" : undefined,
              }}
            >
              {item.show}
            </span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {status === "correct" && (
            <motion.div key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-green-300 text-3xl font-black">
              <Check className="w-8 h-8" /> Tačno!
            </motion.div>
          )}
          {status === "wrong" && (
            <motion.div key="no" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-red-300 text-3xl font-black flex items-center gap-2 justify-center">
                <X className="w-8 h-8" /> Netačno
              </p>
              <p className="text-white/80 text-xl mt-1">
                Tačno:{" "}
                <strong
                  style={{
                    fontFamily: isArabicChar(item.answer) ? "Noto Naskh Arabic, serif" : undefined,
                    fontSize: isArabicChar(item.answer) ? "1.6rem" : undefined,
                  }}
                  className="text-white"
                >
                  {item.answer}
                </strong>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Answer section */}
      <div className="px-5 pb-8 shrink-0">
        {isTypeInput ? (
          <div className="flex gap-3 max-w-xs mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && text.trim()) answer(text); }}
              disabled={status !== "asking"}
              maxLength={6}
              placeholder="Napiši glas…"
              className="flex-1 text-2xl font-bold text-center rounded-2xl border-2 border-white/30 bg-white/20 text-white placeholder:text-white/50 px-4 py-4 outline-none focus:border-white"
            />
            <button
              onClick={() => { if (text.trim()) answer(text); }}
              disabled={!text.trim() || status !== "asking"}
              className="bg-green-400 hover:bg-green-300 disabled:opacity-40 text-white rounded-2xl px-6 font-black text-2xl transition-colors"
            >
              ✓
            </button>
          </div>
        ) : (
          <div className={`grid gap-3 max-w-md mx-auto ${choices.length <= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {choices.map((choice, i) => {
              const isCorrect  = choice === item.answer;
              const isSelected = selected === choice;
              let cls = "bg-white/20 hover:bg-white/30 text-white border-2 border-white/20 hover:scale-105";
              if (status !== "asking") {
                if (isCorrect) cls = "bg-green-400 text-white border-2 border-green-300 scale-105";
                else if (isSelected) cls = "bg-red-400 text-white border-2 border-red-300";
                else cls = "bg-white/10 text-white/40 border-2 border-white/10";
              }
              const choiceIsAr = isArabicChar(choice);
              return (
                <motion.button
                  key={i}
                  whileTap={status === "asking" ? { scale: 0.93 } : {}}
                  onClick={() => answer(choice)}
                  disabled={status !== "asking"}
                  className={`rounded-2xl p-4 font-bold transition-all shadow-lg min-h-[80px] flex items-center justify-center ${cls}`}
                >
                  <span
                    style={{
                      fontSize: choiceIsAr ? "2.8rem" : undefined,
                      fontFamily: choiceIsAr ? "Noto Naskh Arabic, serif" : undefined,
                      lineHeight: choiceIsAr ? "1.6" : undefined,
                    }}
                    className={choiceIsAr ? "font-bold" : "text-xl font-bold"}
                  >
                    {choice}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LessonDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const lessonId = parseInt(id ?? "2", 10);
  const data = getLessonById(lessonId);

  const dzanaImg = `${BASE}images/dzana-avatar.png`;
  const amirImg  = `${BASE}images/amir-avatar.png`;
  const [activeQuiz, setActiveQuiz] = useState<number | null>(null);
  const [activeReading, setActiveReading] = useState<number | null>(null);
  const [activePronadi, setActivePronadi] = useState<number | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!data) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h1 className="text-3xl font-black mb-4">Lekcija nije pronađena</h1>
          <Link href="/arapsko-pismo" className="text-primary font-bold underline">← Nazad na lekcije</Link>
        </div>
      </Layout>
    );
  }

  function getLetterAudio(idx: number): string {
    if (!data) return "elif.mp3";
    const ld = data.letterData[idx];
    return ld?.soundFile ?? "elif.mp3";
  }

  function markExerciseComplete(exerciseIdx: number) {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      next.add(exerciseIdx);
      return next;
    });
  }

  const allDone = data.exercises.length > 0 && completedExercises.size >= data.exercises.length;
  const nextLessonId = data.id + 1;
  const hasNextLesson = !!getLessonById(nextLessonId);

  function finishLesson() {
    if (hasNextLesson) {
      navigate(`/lesson/${nextLessonId}`);
    } else {
      navigate("/arapsko-pismo");
    }
  }

  return (
    <Layout>
      {/* Finish modal */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-black mb-2">Lekcija završena!</h2>
            <p className="text-xl text-muted-foreground mb-2">
              Odradio si sve {data.exercises.length} vježbe u lekciji <strong>{data.title}</strong>!
            </p>
            <p className="text-base text-muted-foreground mb-6">
              Preuzmi radni list i vježbaj čitanje i bez ekrana!
            </p>
            <Button
              onClick={() => {
                setIsPrinting(true);
                setTimeout(() => { window.print(); setTimeout(() => setIsPrinting(false), 1000); }, 150);
              }}
              variant="outline"
              className="w-full text-base py-5 mb-3 border-teal-300 text-teal-700 hover:bg-teal-50"
            >
              <Download className="w-5 h-5 mr-2" /> Preuzmi radni list (PDF)
            </Button>
            {hasNextLesson && (
              <Button onClick={finishLesson} className="w-full game-button text-lg py-6 mb-3">
                Sljedeća lekcija →
              </Button>
            )}
            <Button onClick={() => { setShowFinishModal(false); navigate("/arapsko-pismo"); }}
              variant="outline" className="w-full text-base py-5">
              Nazad na lekcije
            </Button>
          </motion.div>
        </div>
      )}

      {activeQuiz !== null && (
        <QuizModal
          exercise={data.exercises[activeQuiz]}
          onClose={() => setActiveQuiz(null)}
          onComplete={() => markExerciseComplete(activeQuiz)}
        />
      )}

      {activeReading !== null && (
        <ReadingGridModal
          exercise={data.exercises[activeReading]}
          onClose={() => setActiveReading(null)}
          onComplete={() => markExerciseComplete(activeReading)}
        />
      )}

      {activePronadi !== null && (
        <PronadiModal
          exercise={data.exercises[activePronadi]}
          onClose={() => setActivePronadi(null)}
          onComplete={() => markExerciseComplete(activePronadi)}
        />
      )}

      {/* Print worksheet — invisible on screen, shows @media print */}
      {isPrinting && (
        <div id="print-worksheet" className="hidden print:block">
          <div style={{ fontFamily: "Noto Naskh Arabic, serif" }}>
            {/* Header */}
            <div style={{ textAlign: "center", borderBottom: "3px solid #0d9488", paddingBottom: "12px", marginBottom: "16px" }}>
              <div style={{ fontSize: "2rem", fontWeight: 900, color: "#0d9488", fontFamily: "Nunito, sans-serif" }}>
                🕌 Mekteb — Arapsko pismo
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#134e4a", fontFamily: "Nunito, sans-serif", marginTop: "4px" }}>
                Lekcija {data.orderNum}: {data.title}
              </div>
              <div style={{ fontSize: "0.95rem", color: "#6b7280", fontFamily: "Nunito, sans-serif", marginTop: "4px" }}>
                Radni list za čitanje — Muallim: ______________________   Datum: ___________
              </div>
            </div>

            {/* Letters with forms */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "#374151", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Harfovi — oblici slova
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {data.letterData.map((ld, i) => (
                  <div key={i} style={{ border: "2px solid #e5e7eb", borderRadius: "12px", padding: "10px 14px", textAlign: "center", minWidth: "100px" }}>
                    <div style={{ fontSize: "3.5rem", color: "#0d9488", lineHeight: 1.3 }}>{ld.arabic}</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#374151" }}>{ld.name} / {ld.transliteration}</div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "6px", justifyContent: "center" }}>
                      {[ld.forms.initial, ld.forms.medial, ld.forms.final].map((f, fi) => (
                        <span key={fi} style={{ fontSize: "1.4rem", background: "#f0fdf4", padding: "2px 6px", borderRadius: "6px", lineHeight: 1.6 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reading grid — from čitaj-slog exercises */}
            {data.exercises.filter(e => e.type === "čitaj-slog").map((ex, xi) => (
              <div key={xi} style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "#374151", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  📖 {ex.title}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px" }}>
                  {ex.items.map((item, ii) => (
                    <div key={ii} style={{ border: "1.5px solid #d1fae5", borderRadius: "10px", padding: "10px 6px", textAlign: "center", background: "#f0fdf4" }}>
                      <div style={{ fontSize: item.show.length <= 2 ? "2.2rem" : item.show.length <= 4 ? "1.7rem" : "1.3rem", color: "#134e4a", lineHeight: 1.5 }}>{item.show}</div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: "0.75rem", color: "#6b7280", marginTop: "2px" }}>{item.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Footer */}
            <div style={{ marginTop: "24px", borderTop: "2px solid #e5e7eb", paddingTop: "10px", textAlign: "center", fontFamily: "Nunito, sans-serif", fontSize: "0.8rem", color: "#9ca3af" }}>
              mekteb.net • Arapsko pismo • {data.title}
            </div>
          </div>
        </div>
      )}

      {/* Nazad */}
      <div className="mb-6">
        <Link href="/arapsko-pismo" className="inline-flex items-center gap-2 text-primary hover:text-teal-700 font-bold bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-colors text-base">
          <ArrowLeft className="w-5 h-5" />
          Nazad na lekcije
        </Link>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-border mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
              Lekcija {data.orderNum}
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-foreground mt-2">{data.title}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.letters.map((letter, i) => (
              <button
                key={i}
                onClick={() => playAudio(getLetterAudio(i))}
                className="w-24 h-24 bg-gradient-to-br from-primary to-teal-600 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-primary/20 text-white gap-1 hover:scale-105 transition-transform"
              >
                <span className="text-5xl font-bold" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{letter}</span>
                <Volume2 className="w-4 h-4 opacity-70" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Priča */}
      <Card className="p-6 mb-8 bg-gradient-to-r from-orange-50 to-pink-50 border-orange-100">
        <h2 className="text-2xl font-bold text-orange-800 flex items-center gap-2 mb-6">
          <BookOpen className="w-6 h-6" />
          Priča za danas
        </h2>

        {/* Unified story renderer — handles narator, otac, dzana, amir */}
        {(() => {
          const hasNarator = data.story.lines.some(l => l.speaker === "narator" || l.speaker === "otac");

          const renderLine = (line: typeof data.story.lines[0], i: number, delayBase = 0) => {
            if (line.speaker === "narator") {
              return (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: delayBase + i * 0.06 }}
                  className="w-full px-2 py-1">
                  <p className="text-base italic text-orange-800/70 leading-relaxed text-center">
                    {line.text}
                  </p>
                </motion.div>
              );
            }

            const isDzana = line.speaker === "dzana";
            const isOtac  = line.speaker === "otac";
            const isAmir  = line.speaker === "amir";

            const alignClass = isAmir ? "flex-row-reverse" : "";
            const label = isDzana ? "Džana" : isOtac ? "Babo" : "Amir";
            const labelColor = isDzana ? "text-orange-700" : isOtac ? "text-emerald-700" : "text-primary";

            const bubbleClass = isDzana
              ? "bg-white text-foreground rounded-2xl rounded-bl-sm border border-orange-100"
              : isOtac
                ? "bg-emerald-600 text-white rounded-2xl rounded-bl-sm"
                : "bg-primary text-white rounded-2xl rounded-br-sm";

            const avatar = isDzana
              ? <img src={dzanaImg} alt="Džana" className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover shrink-0" />
              : isOtac
                ? <div className="w-11 h-11 rounded-full bg-emerald-100 border-2 border-emerald-300 shadow-md flex items-center justify-center text-2xl shrink-0">👨</div>
                : <img src={amirImg} alt="Amir" className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover shrink-0" />;

            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delayBase + i * 0.07 }}
                className={`flex items-end gap-3 ${alignClass}`}>
                {avatar}
                <div className={`flex flex-col gap-1 max-w-[80%] ${isAmir ? "items-end" : "items-start"}`}>
                  <span className={`text-sm font-extrabold px-1 ${labelColor}`}>{label}</span>
                  <div className={`px-5 py-3 text-base font-medium leading-relaxed shadow-sm ${bubbleClass}`}>
                    {line.text}
                  </div>
                </div>
              </motion.div>
            );
          };

          if (hasNarator) {
            // Single-column for mixed narator/dialogue stories
            return (
              <div className="flex flex-col gap-4">
                {data.story.lines.map((line, i) => renderLine(line, i))}
              </div>
            );
          }

          // Two-column for pure dialogue stories (desktop only)
          const half = Math.ceil(data.story.lines.length / 2);
          return (
            <>
              <div className="flex flex-col gap-4 md:hidden">
                {data.story.lines.map((line, i) => renderLine(line, i))}
              </div>
              <div className="hidden md:grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-3">
                  {data.story.lines.slice(0, half).map((line, i) => renderLine(line, i))}
                </div>
                <div className="flex flex-col gap-3">
                  {data.story.lines.slice(half).map((line, i) => renderLine(line, i, 0.4))}
                </div>
              </div>
            </>
          );
        })()}
      </Card>

      {/* Harfovi i hareketi */}
      <div className="mb-8">
        {data.isRevision ? (
          /* ── Revision lesson: compact reminder, no full letter breakdown ── */
          <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-5">
            <h2 className="text-xl font-extrabold text-teal-800 flex items-center gap-2 mb-4">
              <Volume2 className="w-5 h-5" />
              Podsjetnik — sva slova
            </h2>
            <div className="flex flex-wrap gap-3">
              {data.letterData.map((letter, i) => (
                <button
                  key={i}
                  onClick={() => playAudio(letter.soundFile)}
                  className="flex flex-col items-center gap-1 bg-white border-2 border-teal-200 hover:border-teal-500 rounded-2xl px-4 py-3 transition-all hover:shadow-md group"
                >
                  <span
                    className="text-4xl text-teal-800 leading-none"
                    style={{ fontFamily: "Noto Naskh Arabic, serif" }}
                  >{letter.arabic}</span>
                  <span className="text-sm font-bold text-teal-600 group-hover:text-teal-800">{letter.name}</span>
                  <Volume2 className="w-3 h-3 text-teal-400 group-hover:text-teal-600" />
                </button>
              ))}
            </div>
            <p className="text-base text-teal-700 mt-4 font-medium">
              Klikni na svako slovo da čuješ izgovor — pa prijeđi na vježbe!
            </p>
          </div>
        ) : (
        <>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-5">
          <Info className="w-6 h-6 text-primary" />
          {data.hareketi ? "Upoznajmo slovo i harekete" : "Upoznajmo harfove"}
        </h2>

        {data.letterData.map((letter, i) => (
          <Card key={i} className="p-6 border-2 border-border/50 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-3xl font-extrabold text-foreground">{letter.name}</h3>
                  <button
                    onClick={() => playAudio(letter.soundFile)}
                    className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xl text-muted-foreground font-medium">Izgovor: /{letter.transliteration}/</p>
                <p className="text-base text-muted-foreground mt-1 italic">{letter.visualAssociation}</p>
                {letter.nonConnecting && (
                  <span className="inline-block mt-3 bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-lg uppercase">
                    Ne spaja se ulijevo
                  </span>
                )}
              </div>
              <div className="text-9xl text-primary shrink-0" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>
                {letter.arabic}
              </div>
            </div>
            <div className="bg-muted rounded-xl p-5">
              <p className="text-base font-bold text-muted-foreground mb-4 text-center uppercase tracking-wider">Oblici slova</p>
              <div className="grid grid-cols-4 gap-3 text-center" dir="rtl">
                {[
                  { form: letter.forms.isolated, label: "Samostalan" },
                  { form: letter.forms.initial,  label: "Početak" },
                  { form: letter.forms.medial,   label: "Sredina" },
                  { form: letter.forms.final,    label: "Kraj" },
                ].map(({ form, label }) => (
                  <div key={label} className="bg-white rounded-xl p-3">
                    <div className="text-5xl font-bold text-foreground mb-2" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{form}</div>
                    <div className="text-base font-bold text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hareketi slogovi — BE/BI/BU kartice (samo za lekcije bez posebne hareketi sekcije) */}
            {!data.hareketi && !data.isRevision && (
              <div className="mt-5">
                <p className="text-base font-bold text-muted-foreground mb-3 text-center uppercase tracking-wider">
                  🔊 Klikni i pročitaj naglas
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { hareke: "\u064E", sound: "E" },
                    { hareke: "\u0650", sound: "I" },
                    { hareke: "\u064F", sound: "U" },
                  ].map(({ hareke, sound }) => {
                    const combined = letter.arabic + hareke;
                    const short = letter.transliteration.split(" ")[0].replace(/[^A-ZČĆŽŠĐa-zčćžšđ]/g, "");
                    const label = (short || letter.name[0]) + sound;
                    return (
                      <motion.button
                        key={sound}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => speakArabic(combined)}
                        className="bg-teal-50 hover:bg-teal-100 border-2 border-teal-200 hover:border-teal-400 rounded-2xl py-5 px-2 flex flex-col items-center gap-1 transition-all group"
                      >
                        <span
                          style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "2.8rem", lineHeight: 1.5 }}
                          className="text-teal-800 font-bold"
                        >
                          {combined}
                        </span>
                        <span className="text-base font-extrabold text-teal-600 group-hover:text-teal-800">{label}</span>
                        <Volume2 className="w-4 h-4 text-teal-400 group-hover:text-teal-600" />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        ))}

        {/* Hareketi kartice (samo ako ih ima) */}
        {data.hareketi && data.hareketi.length > 0 && (
          <>
            <h3 className="text-xl font-bold text-foreground mb-4">Hareketi — znakovi za samoglasnike</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {data.hareketi.map((h, i) => {
                const c = COLOUR_MAP[h.colour] ?? COLOUR_MAP.teal;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`border-2 rounded-2xl overflow-hidden ${c.card}`}
                  >
                    <div className="flex items-stretch">
                      {/* Lijevo: veliki arapski karakter — dovoljno prostora za dijakritike */}
                      <div className="flex items-center justify-center border-r border-black/5 shrink-0"
                        style={{ minWidth: "110px", paddingTop: "2rem", paddingBottom: "1.5rem", paddingLeft: "0.75rem", paddingRight: "0.75rem" }}>
                        <span
                          style={{
                            fontFamily: "Noto Naskh Arabic, serif",
                            fontSize: "5rem",
                            lineHeight: 2,
                            display: "block",
                          }}
                        >
                          {h.arabic}
                        </span>
                      </div>

                      {/* Desno: naziv, opis, glas dugme */}
                      <div className="flex flex-col justify-between p-4 flex-1 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span
                              style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "1.6rem", lineHeight: 2 }}
                            >
                              {h.hareke}
                            </span>
                            <span className="text-xl font-extrabold text-foreground">{h.name}</span>
                          </div>
                          <p className="text-base font-medium leading-snug text-foreground">{h.description}</p>
                          {h.napomena && (
                            <p className="text-sm mt-2 opacity-70 italic leading-snug">{h.napomena}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => playAudio(h.soundFile)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${c.sound}`}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <span className={`text-sm font-extrabold px-3 py-1 rounded-full ${c.badge}`}>
                            glas: {h.sound}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
        </>
        )}
      </div>

      {/* Vježbe */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Gamepad2 className="w-6 h-6 text-accent" />
          Vježbe
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {data.exercises.map((ex, ei) => {
            const isDone = completedExercises.has(ei);
            return (
            <Card key={ei} className={`p-5 flex flex-col transition-all ${isDone ? "border-2 border-green-400 bg-green-50/30" : "border-2 border-border/50"}`}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{ex.icon}</span>
                <div className="flex-1">
                  <h3 className="font-extrabold text-xl text-foreground">{ex.title}</h3>
                  <p className="text-base text-muted-foreground">{ex.description}</p>
                </div>
                {isDone ? (
                  <span className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full font-bold text-sm shrink-0">
                    <Check className="w-4 h-4" /> Završeno
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600 font-bold text-base shrink-0">
                    <Star className="w-5 h-5 fill-current" /> {ex.hasanatReward}
                  </span>
                )}
              </div>

              {/* Pregled vježbe */}
              {ex.type === "pronadi-harf" ? (
                <>
                  <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 mb-4 flex items-center gap-5 flex-1">
                    <div className="text-center">
                      <p className="text-xs font-bold text-indigo-500 uppercase mb-1 tracking-wider">Pronađi</p>
                      <span
                        className="text-6xl font-bold text-indigo-800 block leading-none"
                        style={{ fontFamily: "Noto Naskh Arabic, serif" }}
                      >
                        {ex.items[0]?.show}
                      </span>
                      <p className="text-sm font-bold text-indigo-600 mt-1">{ex.items[0]?.answer}</p>
                    </div>
                    <div className="grid grid-cols-5 gap-1 flex-1 opacity-60">
                      {(ex.pool ?? []).concat([ex.items[0]?.show ?? "ب", ex.items[0]?.show ?? "ب"]).slice(0, 10).map((h, pi) => (
                        <div key={pi} className="aspect-square rounded-lg bg-indigo-100 flex items-center justify-center">
                          <span style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "1.1rem" }} className="text-indigo-700">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-center text-base text-muted-foreground mb-4 font-medium">
                    🔍 Pronađi {ex.targetCount ?? 6} harfova sakrivenih u gridu od 30
                  </p>
                  <Button
                    className="w-full game-button text-base py-5"
                    style={{ background: isDone ? undefined : "linear-gradient(135deg, #6366f1, #4f46e5)" }}
                    onClick={() => setActivePronadi(ei)}
                  >
                    <Search className="w-5 h-5 mr-2" />
                    {isDone ? "Igraj ponovo" : "Pronađi harfove"}
                  </Button>
                </>
              ) : ex.type === "čitaj-slog" ? (
                <>
                  <div className="grid grid-cols-4 gap-2 mb-3 flex-1">
                    {ex.items.slice(0, 8).map((item, wi) => (
                      <div key={wi} className="bg-teal-50 border border-teal-200 rounded-xl p-2 flex items-center justify-center">
                        <span
                          className="font-bold text-teal-900 text-center leading-none"
                          style={{
                            fontFamily: "Noto Naskh Arabic, serif",
                            fontSize: item.show.length <= 2 ? "1.8rem" : item.show.length <= 4 ? "1.4rem" : "1.1rem",
                          }}
                        >
                          {item.show}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center text-base text-muted-foreground mb-4 font-medium">
                    📖 {ex.items.length} slogova — klikni da čuješ izgovor
                  </div>
                  <Button
                    className="w-full game-button text-base py-5"
                    size="sm"
                    onClick={() => setActiveReading(ei)}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" /> {isDone ? "Čitaj ponovo" : "Čitaj slogove"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-5 flex-1">
                    {ex.items.slice(0, 6).map((item, wi) => {
                      const showIsListen = item.show === "🔊";
                      return (
                        <div key={wi} className="bg-muted/50 rounded-xl px-2 py-4 flex flex-row items-center justify-center gap-2 text-center">
                          {showIsListen ? (
                            <Volume2 className="w-6 h-6 text-teal-600" />
                          ) : (
                            <span
                              className={`font-bold text-foreground ${isArabicChar(item.show) ? "" : "text-3xl"}`}
                              style={isArabicChar(item.show) ? {
                                fontFamily: "Noto Naskh Arabic, serif",
                                fontSize: "2rem",
                                lineHeight: 2.2,
                                display: "block",
                              } : undefined}
                            >
                              {item.show}
                            </span>
                          )}
                          <span
                            className="text-xl font-bold text-primary"
                            style={{
                              fontFamily: isArabicChar(item.answer) ? "Noto Naskh Arabic, serif" : undefined,
                              fontSize: isArabicChar(item.answer) ? "1.4rem" : undefined,
                            }}
                          >
                            {item.answer}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-center text-sm text-muted-foreground mb-4 font-medium">
                    + još {ex.items.length - 6} pitanja u igri
                  </div>
                  <Button
                    className="w-full game-button text-base py-5"
                    size="sm"
                    onClick={() => setActiveQuiz(ei)}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" /> {isDone ? "Ponovi vježbu" : "Počni vježbu"}
                  </Button>
                </>
              )}
            </Card>
          );
          })}
        </div>

        <div className={`mt-6 p-6 rounded-2xl border text-center transition-all ${allDone ? "bg-green-50 border-green-300" : "bg-muted/40 border-border"}`}>
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {data.exercises.map((_, ei) => (
              <div key={ei} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg transition-all ${
                completedExercises.has(ei)
                  ? "bg-green-500 text-white shadow-lg scale-110"
                  : "bg-muted text-muted-foreground border-2 border-border"
              }`}>
                {completedExercises.has(ei) ? <Check className="w-5 h-5" /> : ei + 1}
              </div>
            ))}
          </div>

          <h3 className={`font-extrabold text-xl mb-2 ${allDone ? "text-green-800" : "text-foreground/70"}`}>
            {allDone
              ? "Sve vježbe završene! 🎉"
              : `${completedExercises.size} / ${data.exercises.length} vježbi urađeno`}
          </h3>
          <p className={`mb-4 text-base ${allDone ? "text-green-700/80" : "text-muted-foreground"}`}>
            {allDone
              ? (hasNextLesson ? "Odlično! Spreman za sljedeću lekciju." : "Čestitamo — završio si sve dostupne lekcije!")
              : "Uradi vježbe da utvrdiš gradivo, ili prijeđi na sljedeću lekciju."}
          </p>
          <Button
            size="lg"
            onClick={() => setShowFinishModal(true)}
            className={`w-full text-lg py-6 ${allDone ? "bg-green-600 hover:bg-green-700 text-white game-button" : "game-button"}`}
          >
            {hasNextLesson ? "Završi i idi na sljedeću lekciju →" : "Završi lekciju ✓"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
