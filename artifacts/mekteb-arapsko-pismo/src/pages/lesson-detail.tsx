import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen, Check, Gamepad2, Info, PlayCircle, RotateCcw, Star, Trophy, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLessonById, type Exercise } from "@/data/lessons";

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
            <span className="text-2xl font-bold opacity-60">Pritisni za zvuk</span>
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
              placeholder="Napiši zvuk…"
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
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  const [showFinishModal, setShowFinishModal] = useState(false);

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
            <p className="text-xl text-muted-foreground mb-6">
              Odradio si sve {data.exercises.length} vježbe u lekciji <strong>{data.title}</strong>!
            </p>
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

        {/* MOBILNI: isprepleten chat */}
        <div className="flex flex-col gap-4 md:hidden">
          {data.story.lines.map((line, i) => {
            const isDzana = line.speaker === "dzana";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-end gap-3 ${isDzana ? "" : "flex-row-reverse"}`}
              >
                <img src={isDzana ? dzanaImg : amirImg} alt={isDzana ? "Džana" : "Amir"}
                  className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover shrink-0" />
                <div className={`flex flex-col gap-1 max-w-[80%] ${isDzana ? "items-start" : "items-end"}`}>
                  <span className={`text-sm font-extrabold px-1 ${isDzana ? "text-orange-700" : "text-primary"}`}>
                    {isDzana ? "Džana" : "Amir"}
                  </span>
                  <div className={`px-5 py-3 text-lg font-medium leading-relaxed shadow-sm ${
                    isDzana
                      ? "bg-white text-foreground rounded-2xl rounded-bl-sm border border-orange-100"
                      : "bg-primary text-white rounded-2xl rounded-br-sm"
                  }`}>
                    {line.text}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* DESKTOP: dvije kolone */}
        {(() => {
          const half = Math.ceil(data.story.lines.length / 2);
          const leftLines  = data.story.lines.slice(0, half);
          const rightLines = data.story.lines.slice(half);
          const renderChat = (lines: typeof data.story.lines, startDelay: number) => (
            <div className="flex flex-col gap-3">
              {lines.map((line, i) => {
                const isDzana = line.speaker === "dzana";
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: startDelay + i * 0.1 }}
                    className={`flex items-end gap-2 ${isDzana ? "" : "flex-row-reverse"}`}
                  >
                    <img src={isDzana ? dzanaImg : amirImg} alt={isDzana ? "Džana" : "Amir"}
                      className="w-10 h-10 rounded-full border-2 border-white shadow-md object-cover shrink-0" />
                    <div className={`flex flex-col gap-1 ${isDzana ? "items-start" : "items-end"}`}>
                      <span className={`text-xs font-extrabold px-1 ${isDzana ? "text-orange-700" : "text-primary"}`}>
                        {isDzana ? "Džana" : "Amir"}
                      </span>
                      <div className={`px-4 py-3 text-base font-medium leading-relaxed shadow-sm ${
                        isDzana
                          ? "bg-white text-foreground rounded-2xl rounded-bl-sm border border-orange-100"
                          : "bg-primary text-white rounded-2xl rounded-br-sm"
                      }`}>
                        {line.text}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
          return (
            <div className="hidden md:grid grid-cols-2 gap-6">
              {renderChat(leftLines, 0)}
              {renderChat(rightLines, 0.4)}
            </div>
          );
        })()}
      </Card>

      {/* Harfovi i hareketi */}
      <div className="mb-8">
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
                    className={`border-2 rounded-2xl p-5 ${c.card}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-24 h-24 flex items-center justify-center overflow-hidden shrink-0"
                        style={{ fontFamily: "Noto Naskh Arabic, serif", fontSize: "4.5rem", lineHeight: 1 }}
                      >
                        {h.arabic}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => playAudio(h.soundFile)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${c.sound}`}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <span className={`text-sm font-extrabold px-3 py-1 rounded-full ${c.badge}`}>
                          zvuk: {h.sound}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-5xl font-bold ar">{h.hareke}</span>
                      <span className="text-2xl font-extrabold">{h.name}</span>
                    </div>
                    <p className="text-lg font-medium leading-snug">{h.description}</p>
                    {h.napomena && (
                      <p className="text-base mt-2 opacity-75 italic">{h.napomena}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
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

              {/* Pregled prvih 6 stavki */}
              <div className="grid grid-cols-3 gap-2 mb-5 flex-1">
                {ex.items.slice(0, 6).map((item, wi) => {
                  const showIsListen = item.show === "🔊";
                  return (
                    <div key={wi} className="bg-muted/50 rounded-xl p-3 flex flex-row items-center justify-center gap-2 text-center">
                      {showIsListen ? (
                        <Volume2 className="w-6 h-6 text-teal-600" />
                      ) : (
                        <span className={`text-3xl font-bold text-foreground leading-none ${isArabicChar(item.show) ? "ar" : ""}`}>
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
