import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { ArrowLeft, Volume2 } from "lucide-react";
import { LESSONS } from "@/data/lessons";

const BASE = import.meta.env.BASE_URL;

function playAudio(file: string) {
  const audio = new Audio(`${BASE}audio/harfovi/${file}`);
  audio.play().catch(() => {});
}

function speakArabic(text: string) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-SA";
  u.rate = 0.75;
  window.speechSynthesis.speak(u);
}

function speakGlas(glas: string) {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(glas.replace(/^-/, ""));
  u.lang = "bs-BA";
  u.rate = 0.8;
  window.speechSynthesis.speak(u);
}

function playHareketiSound(h: { sound: string; soundFile: string; speakText?: string }) {
  if (h.speakText) {
    speakGlas(h.speakText);
  } else if (h.sound.startsWith("-")) {
    speakGlas(h.sound);
  } else {
    playAudio(h.soundFile);
  }
}

const LESSON_COLORS = [
  "from-teal-400 to-teal-600",
  "from-blue-400 to-blue-600",
  "from-violet-400 to-violet-600",
  "from-indigo-400 to-indigo-600",
  "from-orange-400 to-orange-600",
  "from-rose-400 to-rose-600",
  "from-amber-400 to-amber-600",
  "from-emerald-400 to-emerald-600",
];

const BADGE_COLORS = [
  "bg-teal-100 text-teal-800 border-teal-300",
  "bg-blue-100 text-blue-800 border-blue-300",
  "bg-violet-100 text-violet-800 border-violet-300",
  "bg-indigo-100 text-indigo-800 border-indigo-300",
  "bg-orange-100 text-orange-800 border-orange-300",
  "bg-rose-100 text-rose-800 border-rose-300",
  "bg-amber-100 text-amber-800 border-amber-300",
  "bg-emerald-100 text-emerald-800 border-emerald-300",
];

export default function KartaHarfova() {
  return (
    <Layout>
      <div className="mb-6">
        <Link href="/arapsko-pismo" className="inline-flex items-center gap-2 text-primary hover:text-teal-700 font-bold bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-colors text-base">
          <ArrowLeft className="w-5 h-5" />
          Nazad na lekcije
        </Link>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-700 to-teal-900 rounded-3xl p-8 mb-8 text-white text-center shadow-xl">
        <div className="text-5xl mb-3">🗺️</div>
        <h1 className="text-4xl font-black mb-2">Karta harfova</h1>
        <p className="text-teal-100 text-lg flex items-center justify-center gap-2">
          Svi harfovi koje smo učili — klikni za izgovor
          <Volume2 className="w-5 h-5 text-teal-300" />
        </p>
      </div>

      {/* Grouped by lesson */}
      <div className="space-y-10">
        {LESSONS.map((lesson, li) => (
          <section key={lesson.id}>
            {/* Lesson header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${LESSON_COLORS[li % LESSON_COLORS.length]} flex items-center justify-center text-white font-black text-lg shadow-md shrink-0`}>
                {lesson.orderNum}
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground leading-tight">{lesson.title}</h2>
                <Link href={`/lesson/${lesson.id}`} className="text-sm font-semibold text-primary hover:underline">
                  → Idi na lekciju
                </Link>
              </div>
            </div>

            {/* Letters + hareketi grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {lesson.letterData.map((ld, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => ld.soundFile ? playAudio(ld.soundFile) : speakArabic(ld.arabic)}
                  className={`relative group bg-white border-2 border-border/40 hover:border-teal-400 rounded-2xl pt-6 pb-4 px-3 flex flex-col items-center gap-1 shadow-sm hover:shadow-md transition-all`}
                >
                  <Volume2 className="absolute top-2 right-2 w-3.5 h-3.5 text-teal-300 group-hover:text-teal-500 transition-colors" />
                  <span
                    className="text-5xl text-primary font-bold"
                    style={{ fontFamily: "Noto Naskh Arabic, serif", lineHeight: 1.4 }}
                  >
                    {ld.arabic}
                  </span>
                  <span className="text-sm font-bold text-foreground text-center leading-tight">{ld.name}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${BADGE_COLORS[li % BADGE_COLORS.length]}`}>
                    /{ld.transliteration}/
                  </span>
                </motion.button>
              ))}

              {lesson.hareketi && lesson.hareketi.map((h, i) => (
                <motion.button
                  key={`h-${i}`}
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => playHareketiSound(h)}
                  className="relative group bg-teal-50 border-2 border-teal-200 hover:border-teal-500 rounded-2xl pt-6 pb-4 px-3 flex flex-col items-center gap-1 shadow-sm hover:shadow-md transition-all"
                >
                  <Volume2 className="absolute top-2 right-2 w-3.5 h-3.5 text-teal-300 group-hover:text-teal-600 transition-colors" />
                  <span
                    className="text-5xl text-teal-700 font-bold"
                    style={{ fontFamily: "Noto Naskh Arabic, serif", lineHeight: 1.8 }}
                  >
                    {h.arabic}
                  </span>
                  <span className="text-sm font-bold text-teal-900 text-center leading-tight">{h.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-teal-100 text-teal-700 border-teal-300">
                    {h.sound}
                  </span>
                </motion.button>
              ))}
            </div>

            {li < LESSONS.length - 1 && <div className="mt-8 border-b border-border/40" />}
          </section>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-base text-muted-foreground font-medium">
          {LESSONS.length} lekcija · klikni svaki harf da čuješ izgovor 🔊
        </p>
      </div>
    </Layout>
  );
}
