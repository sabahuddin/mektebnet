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

export default function KartaHarfova() {
  return (
    <Layout>
      {/* Nazad */}
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
        <p className="text-teal-200 text-lg">Svi harfovi koje si učio/la — klikni za izgovor</p>
      </div>

      {/* Grouped by lesson */}
      <div className="space-y-10">
        {LESSONS.map((lesson, li) => (
          <section key={lesson.id}>
            {/* Lesson header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${LESSON_COLORS[li % LESSON_COLORS.length]} flex items-center justify-center text-white font-black text-lg shadow-md`}>
                {lesson.orderNum}
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground leading-tight">{lesson.title}</h2>
                <Link href={`/lesson/${lesson.id}`} className="text-sm font-semibold text-primary hover:underline">
                  → Idi na lekciju
                </Link>
              </div>
            </div>

            {/* Letters grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {lesson.letterData.map((ld, i) => (
                <motion.button
                  key={i}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => ld.soundFile ? playAudio(ld.soundFile) : speakArabic(ld.arabic)}
                  className="group bg-white border-2 border-border/50 hover:border-teal-400 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all"
                >
                  <span
                    className="text-5xl text-primary font-bold leading-none"
                    style={{ fontFamily: "Noto Naskh Arabic, serif" }}
                  >
                    {ld.arabic}
                  </span>
                  <span className="text-sm font-bold text-foreground">{ld.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground">/{ld.transliteration}/</span>
                  <Volume2 className="w-4 h-4 text-teal-400 group-hover:text-teal-600 transition-colors" />
                </motion.button>
              ))}

              {/* Hareketi za lekciju koja ih ima */}
              {lesson.hareketi && lesson.hareketi.map((h, i) => (
                <motion.button
                  key={`h-${i}`}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => playAudio(h.soundFile)}
                  className="group bg-teal-50 border-2 border-teal-200 hover:border-teal-400 rounded-2xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-all"
                >
                  <span
                    className="text-5xl text-teal-700 font-bold leading-none"
                    style={{ fontFamily: "Noto Naskh Arabic, serif" }}
                  >
                    {h.arabic}
                  </span>
                  <span className="text-sm font-bold text-teal-800">{h.name}</span>
                  <span className="text-xs font-semibold text-teal-600">glas: {h.sound}</span>
                  <Volume2 className="w-4 h-4 text-teal-400 group-hover:text-teal-600 transition-colors" />
                </motion.button>
              ))}
            </div>

            {/* Divider */}
            {li < LESSONS.length - 1 && <div className="mt-8 border-b border-border/40" />}
          </section>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-base text-muted-foreground font-medium">
          Svi harfovi iz {LESSONS.length} lekcija — klikni svaki da čuješ izgovor 🔊
        </p>
      </div>
    </Layout>
  );
}
