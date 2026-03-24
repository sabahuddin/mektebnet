import { useParams } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen, Gamepad2, Info, PlayCircle, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL;

const MOCK_LESSON_DETAIL = {
  id: 2,
  orderNum: 2,
  slug: "elif-hareketi",
  title: "Elif i hareketi",
  letters: ["ا"],
  isCompleted: false,
  story: {
    lines: [
      { speaker: "dzana", text: "Amir, jesi li znao da arapska slova sama po sebi uglavnom nemaju samoglasnik?" },
      { speaker: "amir",  text: "Nisam! Kako onda znamo kako se čitaju?" },
      { speaker: "dzana", text: "Zato postoje hareketi! To su mali znakovi koji se stavljaju iznad ili ispod slova." },
      { speaker: "amir",  text: "A, kao tačkice — samo za samoglasnike?" },
      { speaker: "dzana", text: "Tačno! Fetha iznad elife daje zvuk 'e', a kesra ispod daje zvuk 'i'." },
      { speaker: "amir",  text: "A šta je damma? Kako izgleda?" },
      { speaker: "dzana", text: "Damma izgleda kao mali zarez iznad slova i daje zvuk 'u'. Elif s dammom čita se 'u'." },
      { speaker: "amir",  text: "Super! Znači samo elif može se čitati kao 'e', 'i' ili 'u' — ovisno o hareketu!" },
    ]
  },
  letterData: [
    {
      arabic: "ا",
      name: "Elif",
      transliteration: "E / I / U",
      forms: { isolated: "ا", initial: "ا", medial: "ـا", final: "ـا" },
      nonConnecting: true,
      visualAssociation: "Kao uspravan štap — jednostavan i snažan",
      soundFile: "elif.mp3",
    }
  ],
  hareketi: [
    {
      arabic: "أَ", hareke: "ـَـ", name: "Fetha",
      sound: "e", colour: "teal",
      description: "Crtica iznad slova — daje kratki zvuk \"e\"",
      napomena: "Iznad krupnih (jakih) harfova čita se \"a\"",
      soundFile: "hareke-fatha.mp3",
    },
    {
      arabic: "إِ", hareke: "ـِـ", name: "Kesra",
      sound: "i", colour: "blue",
      description: "Crtica ispod slova — daje kratki zvuk \"i\"",
      napomena: null,
      soundFile: "hareke-kasra.mp3",
    },
    {
      arabic: "أُ", hareke: "ـُـ", name: "Damma",
      sound: "u", colour: "violet",
      description: "Zarez iznad slova — daje kratki zvuk \"u\"",
      napomena: null,
      soundFile: "hareke-damma.mp3",
    },
  ],
  exercises: [
    {
      title: "Prepoznaj hareket",
      description: "Pogledaj elif s harekom — koji je to hareket?",
      icon: "👁️",
      hasanatReward: 15,
      items: [
        { show: "أَ", answer: "Fetha" },
        { show: "إِ", answer: "Kesra" },
        { show: "أُ", answer: "Damma" },
        { show: "أُ", answer: "Damma" },
        { show: "أَ", answer: "Fetha" },
        { show: "إِ", answer: "Kesra" },
        { show: "أَ", answer: "Fetha" },
        { show: "أُ", answer: "Damma" },
        { show: "إِ", answer: "Kesra" },
        { show: "أَ", answer: "Fetha" },
        { show: "إِ", answer: "Kesra" },
        { show: "أُ", answer: "Damma" },
        { show: "أَ", answer: "Fetha" },
        { show: "إِ", answer: "Kesra" },
        { show: "أُ", answer: "Damma" },
        { show: "أَ", answer: "Fetha" },
        { show: "أُ", answer: "Damma" },
        { show: "إِ", answer: "Kesra" },
        { show: "أَ", answer: "Fetha" },
        { show: "أُ", answer: "Damma" },
      ]
    },
    {
      title: "Koji zvuk?",
      description: "Pogledaj hareket simbol — koji zvuk daje?",
      icon: "🔤",
      hasanatReward: 15,
      items: [
        { show: "ـَـ", answer: "e" },
        { show: "ـِـ", answer: "i" },
        { show: "ـُـ", answer: "u" },
        { show: "ـِـ", answer: "i" },
        { show: "ـَـ", answer: "e" },
        { show: "ـُـ", answer: "u" },
        { show: "ـَـ", answer: "e" },
        { show: "ـِـ", answer: "i" },
        { show: "ـُـ", answer: "u" },
        { show: "ـِـ", answer: "i" },
        { show: "ـَـ", answer: "e" },
        { show: "ـُـ", answer: "u" },
        { show: "ـَـ", answer: "e" },
        { show: "ـُـ", answer: "u" },
        { show: "ـِـ", answer: "i" },
        { show: "ـَـ", answer: "e" },
        { show: "ـُـ", answer: "u" },
        { show: "ـِـ", answer: "i" },
        { show: "ـَـ", answer: "e" },
        { show: "ـِـ", answer: "i" },
      ]
    },
    {
      title: "Slušaj i odaberi",
      description: "Pritisni dugme 🔊 — koji elif odgovara zvuku?",
      icon: "🎧",
      hasanatReward: 20,
      items: [
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 i", answer: "إِ" },
        { show: "🔊 u", answer: "أُ" },
        { show: "🔊 u", answer: "أُ" },
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 i", answer: "إِ" },
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 u", answer: "أُ" },
        { show: "🔊 i", answer: "إِ" },
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 u", answer: "أُ" },
        { show: "🔊 i", answer: "إِ" },
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 i", answer: "إِ" },
        { show: "🔊 u", answer: "أُ" },
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 u", answer: "أُ" },
        { show: "🔊 i", answer: "إِ" },
        { show: "🔊 e", answer: "أَ" },
        { show: "🔊 u", answer: "أُ" },
      ]
    },
    {
      title: "Napiši zvuk",
      description: "Pogledaj elif — napiši latinično koji zvuk ima",
      icon: "✏️",
      hasanatReward: 10,
      items: [
        { show: "أَ", answer: "e" },
        { show: "إِ", answer: "i" },
        { show: "أُ", answer: "u" },
        { show: "أَ", answer: "e" },
        { show: "أُ", answer: "u" },
        { show: "إِ", answer: "i" },
        { show: "أُ", answer: "u" },
        { show: "أَ", answer: "e" },
        { show: "إِ", answer: "i" },
        { show: "أَ", answer: "e" },
        { show: "إِ", answer: "i" },
        { show: "أُ", answer: "u" },
        { show: "أَ", answer: "e" },
        { show: "أُ", answer: "u" },
        { show: "إِ", answer: "i" },
        { show: "أَ", answer: "e" },
        { show: "إِ", answer: "i" },
        { show: "أُ", answer: "u" },
        { show: "أَ", answer: "e" },
        { show: "إِ", answer: "i" },
      ]
    },
  ],
};

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

export default function LessonDetail() {
  const data = MOCK_LESSON_DETAIL;
  const dzanaImg = `${BASE}images/dzana-avatar.png`;
  const amirImg  = `${BASE}images/amir-avatar.png`;

  const dzanaLines = data.story.lines.filter(l => l.speaker === "dzana");
  const amirLines  = data.story.lines.filter(l => l.speaker === "amir");

  return (
    <Layout>
      {/* Nazad */}
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-teal-700 font-bold bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-colors text-base">
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
                onClick={() => playAudio("elif.mp3")}
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

        {/* MOBILNI: isprepleten chat (jedna kolona) */}
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
                <img
                  src={isDzana ? dzanaImg : amirImg}
                  alt={isDzana ? "Džana" : "Amir"}
                  className="w-11 h-11 rounded-full border-2 border-white shadow-md object-cover shrink-0"
                />
                <div className={`flex flex-col gap-1 max-w-[80%] ${isDzana ? "items-start" : "items-end"}`}>
                  <span className={`text-sm font-extrabold px-1 ${isDzana ? "text-orange-700" : "text-primary"}`}>
                    {isDzana ? "Džana" : "Amir"}
                  </span>
                  <div
                    className={`px-5 py-3 text-lg font-medium leading-relaxed shadow-sm ${
                      isDzana
                        ? "bg-white text-foreground rounded-2xl rounded-bl-sm border border-orange-100"
                        : "bg-primary text-white rounded-2xl rounded-br-sm"
                    }`}
                  >
                    {line.text}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* DESKTOP: dvije kolone — lijeva=prva polovina razgovora, desna=druga polovina */}
        {(() => {
          const half = Math.ceil(data.story.lines.length / 2);
          const leftLines  = data.story.lines.slice(0, half);
          const rightLines = data.story.lines.slice(half);
          const renderChat = (lines: typeof data.story.lines, startDelay: number) => (
            <div className="flex flex-col gap-3">
              {lines.map((line, i) => {
                const isDzana = line.speaker === "dzana";
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: startDelay + i * 0.1 }}
                    className={`flex items-end gap-2 ${isDzana ? "" : "flex-row-reverse"}`}
                  >
                    <img
                      src={isDzana ? dzanaImg : amirImg}
                      alt={isDzana ? "Džana" : "Amir"}
                      className="w-10 h-10 rounded-full border-2 border-white shadow-md object-cover shrink-0"
                    />
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

      {/* Elif kartica */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-5">
          <Info className="w-6 h-6 text-primary" />
          Upoznajmo slovo i harekete
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

        {/* Hareketi kartice */}
        <h3 className="text-xl font-bold text-foreground mb-4">Hareketi — znakovi za samoglasnike</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {data.hareketi.map((h, i) => {
            const c = COLOUR_MAP[h.colour];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`border-2 rounded-2xl p-5 ${c.card}`}
              >
                {/* Elif s harekom — fiksirani container */}
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

                {/* Hareke simbol (crtica) + ime */}
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
      </div>

      {/* Vježbe — 4 vrste */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Gamepad2 className="w-6 h-6 text-accent" />
          Vježbe
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {data.exercises.map((ex, ei) => (
            <Card key={ei} className="p-5 border-2 border-border/50 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-3xl">{ex.icon}</span>
                <div className="flex-1">
                  <h3 className="font-extrabold text-xl text-foreground">{ex.title}</h3>
                  <p className="text-base text-muted-foreground">{ex.description}</p>
                </div>
                <span className="flex items-center gap-1 text-yellow-600 font-bold text-base shrink-0">
                  <Star className="w-5 h-5 fill-current" /> {ex.hasanatReward}
                </span>
              </div>

              {/* Pregled prvih 6 stavki */}
              <div className="grid grid-cols-3 gap-2 mb-5 flex-1">
                {ex.items.slice(0, 6).map((item, wi) => (
                  <div key={wi} className="bg-muted/50 rounded-xl p-3 flex flex-row items-center justify-center gap-2 text-center">
                    <span
                      className={`text-3xl font-bold text-foreground leading-none ${isArabicChar(item.show) ? "ar" : ""}`}
                    >
                      {item.show}
                    </span>
                    <span className={`text-xl font-bold text-primary ${isArabicChar(item.answer) ? "ar" : ""}`}>
                      {item.answer}
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-center text-sm text-muted-foreground mb-4 font-medium">
                + još {ex.items.length - 6} pitanja u igri
              </div>

              <Button className="w-full game-button text-base py-5" size="sm">
                <PlayCircle className="w-5 h-5 mr-2" /> Počni vježbu
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-6 bg-green-50 rounded-2xl border border-green-200 text-center">
          <h3 className="font-extrabold text-xl text-green-800 mb-2">Spreman za prelazak?</h3>
          <p className="text-green-700/80 mb-4 text-base">Završi sve vježbe da otključaš sljedeću lekciju i zaradiš sve hasanate!</p>
          <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white game-button text-lg py-6">
            Završi lekciju ✓
          </Button>
        </div>
      </div>
    </Layout>
  );
}
