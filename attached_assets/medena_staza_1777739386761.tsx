import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

type Question = {
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type Feedback = {
  type: "correct" | "wrong";
  text: string;
};

const questions: Question[] = [
  {
    category: "Namaz",
    question: "Koji namaz se klanja prije izlaska sunca?",
    options: ["Sabah", "Podne", "Akšam", "Jacija"],
    correctIndex: 0,
    explanation: "Sabah se klanja prije izlaska sunca.",
  },
  {
    category: "Abdest",
    question: "Šta se uzima prije namaza kada nemamo abdest?",
    options: ["Abdest", "Zekat", "Post", "Hadž"],
    correctIndex: 0,
    explanation: "Abdest je čišćenje prije namaza.",
  },
  {
    category: "Kur’an",
    question: "Kako se zove Allahova Knjiga objavljena Muhammedu, a.s.?",
    options: ["Tevrat", "Zebur", "Indžil", "Kur’an"],
    correctIndex: 3,
    explanation: "Kur’an je posljednja Allahova objava.",
  },
  {
    category: "Dova",
    question: "Šta je dova?",
    options: [
      "Obraćanje Allahu",
      "Ime jednog namaza",
      "Naziv mjeseca",
      "Vrsta hrane",
    ],
    correctIndex: 0,
    explanation: "Dova je obraćanje Allahu i traženje dobra od Njega.",
  },
  {
    category: "Lijepo ponašanje",
    question: "Šta je lijepo reći kada sretnemo muslimana?",
    options: ["Doviđenja", "Esselamu alejkum", "Laku noć", "Izvini"],
    correctIndex: 1,
    explanation: "Selam je lijep islamski pozdrav i dova za mir.",
  },
  {
    category: "Ramazan",
    question: "Kako se zove mjesec u kojem muslimani poste?",
    options: ["Ševval", "Muharrem", "Ramazan", "Redžeb"],
    correctIndex: 2,
    explanation: "Ramazan je mjesec posta, Kur’ana i ibadeta.",
  },
  {
    category: "Dobra djela",
    question: "Koje od ovoga je dobro djelo?",
    options: ["Ruganje", "Laž", "Pomoć roditeljima", "Svađa"],
    correctIndex: 2,
    explanation: "Pomoć roditeljima je veliko i lijepo dobro djelo.",
  },
  {
    category: "Imanski šarti",
    question: "Koliko ima imanskih šarta?",
    options: ["Četiri", "Pet", "Šest", "Sedam"],
    correctIndex: 2,
    explanation: "Imanskih šarta ima šest.",
  },
];

const MAX_LIVES = 3;

export default function MedenaStaza() {
  const [, setLocation] = useLocation();

  const timeoutRef = useRef<number | null>(null);

  const [step, setStep] = useState(0);
  const [honey, setHoney] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);

  const currentQuestion = questions[step];
  const progressPercent = Math.round((step / questions.length) * 100);

  const clearPendingTimeout = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const resetGame = () => {
    clearPendingTimeout();
    setStep(0);
    setHoney(0);
    setLives(MAX_LIVES);
    setSelectedIndex(null);
    setFeedback(null);
    setFinished(false);
    setFailed(false);
  };

  const answerQuestion = (optionIndex: number) => {
    if (selectedIndex !== null || finished || failed) return;

    setSelectedIndex(optionIndex);

    const isCorrect = optionIndex === currentQuestion.correctIndex;

    if (isCorrect) {
      setHoney((prev) => prev + 10);
      setFeedback({
        type: "correct",
        text: `Tačno. ${currentQuestion.explanation}`,
      });

      timeoutRef.current = window.setTimeout(() => {
        if (step + 1 >= questions.length) {
          setFinished(true);
          setFeedback(null);
          setSelectedIndex(null);
          return;
        }

        setStep((prev) => prev + 1);
        setSelectedIndex(null);
        setFeedback(null);
      }, 900);

      return;
    }

    const nextLives = lives - 1;
    setLives(nextLives);
    setFeedback({
      type: "wrong",
      text:
        nextLives <= 0
          ? `Netačno. Tačan odgovor je: ${currentQuestion.options[currentQuestion.correctIndex]}.`
          : "Netačno. Pokušaj još jednom.",
    });

    timeoutRef.current = window.setTimeout(() => {
      if (nextLives <= 0) {
        setFailed(true);
        setSelectedIndex(null);
        return;
      }

      setSelectedIndex(null);
      setFeedback(null);
    }, 950);
  };

  useEffect(() => {
    return () => {
      clearPendingTimeout();
    };
  }, []);

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-5 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Mekteb igre
            </p>
            <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">
              Medena staza
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Pčelica ide od cvijeta do cvijeta. Svaki cvijet krije jedno pitanje.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLocation("/igrice")}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100"
          >
            Nazad na igrice
          </button>
        </div>

        <section className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 sm:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Med</p>
            <p className="text-2xl font-bold text-emerald-950">{honey}</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Životi</p>
            <p className="text-2xl font-bold text-emerald-950">
              {"♥".repeat(lives)}
              <span className="text-slate-300">{"♥".repeat(MAX_LIVES - lives)}</span>
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Staza</p>
            <p className="text-2xl font-bold text-emerald-950">
              {Math.min(step + 1, questions.length)} / {questions.length}
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Napredak</p>
            <p className="text-2xl font-bold text-emerald-950">{progressPercent}%</p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-emerald-100">
            <div
              className={[
                "h-full rounded-full bg-emerald-600 transition-all duration-500",
                progressPercent >= 25 ? "w-1/4" : "",
                progressPercent >= 50 ? "w-1/2" : "",
                progressPercent >= 75 ? "w-3/4" : "",
                progressPercent >= 100 ? "w-full" : "",
                progressPercent < 25 ? "w-0" : "",
              ].join(" ")}
            />
          </div>

          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {questions.map((question, index) => {
              const isDone = index < step;
              const isCurrent = index === step && !finished && !failed;

              return (
                <div
                  key={`${question.category}-${index}`}
                  className={[
                    "flex min-h-24 flex-col items-center justify-center rounded-3xl p-3 text-center shadow-sm ring-1 transition",
                    isDone
                      ? "bg-amber-100 text-amber-900 ring-amber-200"
                      : isCurrent
                        ? "bg-emerald-600 text-white ring-emerald-700"
                        : "bg-emerald-50 text-emerald-900 ring-emerald-100",
                  ].join(" ")}
                >
                  <div className="text-2xl">{isDone ? "🍯" : isCurrent ? "🐝" : "🌼"}</div>
                  <p className="mt-1 text-xs font-bold">{question.category}</p>
                </div>
              );
            })}
          </div>
        </section>

        {!finished && !failed && currentQuestion && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
            <div className="mb-4">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                Cvijet {step + 1}: {currentQuestion.category}
              </p>
              <h2 className="mt-2 text-xl font-bold text-emerald-950 sm:text-2xl">
                {currentQuestion.question}
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedIndex === index;
                const isCorrect = index === currentQuestion.correctIndex;

                const resultClass =
                  selectedIndex === null
                    ? "bg-white text-slate-800 ring-emerald-100 hover:bg-emerald-50"
                    : isSelected && isCorrect
                      ? "bg-emerald-600 text-white ring-emerald-700"
                      : isSelected && !isCorrect
                        ? "bg-red-500 text-white ring-red-600"
                        : "bg-slate-50 text-slate-500 ring-slate-100";

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => answerQuestion(index)}
                    disabled={selectedIndex !== null}
                    className={[
                      "rounded-2xl px-4 py-4 text-left text-sm font-bold shadow-sm ring-1 transition sm:text-base",
                      resultClass,
                    ].join(" ")}
                  >
                    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div
                className={[
                  "mt-4 rounded-2xl p-4 text-sm font-semibold ring-1",
                  feedback.type === "correct"
                    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                    : "bg-red-50 text-red-900 ring-red-200",
                ].join(" ")}
              >
                {feedback.text}
              </div>
            )}
          </section>
        )}

        {finished && (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-emerald-100">
            <div className="text-5xl">🍯</div>
            <h2 className="mt-3 text-2xl font-bold text-emerald-950">
              Aferim! Završio si Medenu stazu.
            </h2>
            <p className="mt-2 text-slate-600">
              Pčelica je skupila {honey} meda i obišla sve cvjetove znanja.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={resetGame}
                className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
              >
                Igraj ponovo
              </button>

              <button
                type="button"
                onClick={() => setLocation("/igrice")}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100"
              >
                Nazad na igrice
              </button>
            </div>
          </section>
        )}

        {failed && (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-red-100">
            <div className="text-5xl">🐝</div>
            <h2 className="mt-3 text-2xl font-bold text-red-900">
              Pčelica se umorila.
            </h2>
            <p className="mt-2 text-slate-600">
              Skupio si {honey} meda. Pokušaj ponovo i osvoji cijelu stazu.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={resetGame}
                className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
              >
                Pokušaj ponovo
              </button>

              <button
                type="button"
                onClick={() => setLocation("/igrice")}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-100"
              >
                Nazad na igrice
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}