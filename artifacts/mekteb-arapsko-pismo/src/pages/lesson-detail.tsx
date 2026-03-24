import { useState } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { ArrowLeft, BookOpen, Gamepad2, Info, CheckCircle2, PlayCircle, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BASE = import.meta.env.BASE_URL;

const MOCK_LESSON_DETAIL = {
  id: 2,
  orderNum: 2,
  slug: "elif-hareketi",
  title: "Elif i hareketi",
  lessonType: "new_content" as const,
  letters: ["ا"],
  durationMin: 15,
  isUnlocked: true,
  isCompleted: false,
  hasanatEarned: 0,
  story: {
    lines: [
      { speaker: "dzana", text: "Amir, jesi li znao da arapska slova sama po sebi uglavnom nemaju samoglasnik?" },
      { speaker: "amir",  text: "Nisam! Kako onda znamo kako se čitaju?" },
      { speaker: "dzana", text: "Zato postoje hareketi! To su mali znakovi koji se stavljaju iznad ili ispod slova." },
      { speaker: "amir",  text: "A, kao tačkice, samo za samoglasnike?" },
      { speaker: "dzana", text: "Tačno! Na primjer, elif sa fatom iznad se čita 'a', a sa kasom ispod čita se 'i'." },
      { speaker: "amir",  text: "A šta je sa damom? Ona izgleda kao mala slova 'و' iznad slova!" },
      { speaker: "dzana", text: "Super si primijetio! Dama daje zvuk 'u'. Elif s damom čita se 'u'." },
      { speaker: "amir",  text: "Znači, samo jedno slovo može se čitati na tri načina! Elif je kao čarobnjak." },
    ]
  },
  letterData: [
    {
      arabic: "ا",
      name: "Elif",
      transliteration: "A / I / U",
      forms: { isolated: "ا", initial: "ا", medial: "ـا", final: "ـا" },
      dotCount: 0,
      nonConnecting: true,
      visualAssociation: "Kao uspravan štap — jednostavan i snažan",
      soundFile: "elif.mp3",
    }
  ],
  hareketi: [
    { arabic: "أَ", name: "Fatha",  symbol: "ـَ", sound: "a", description: "Crtica iznad slova, daje kratki zvuk 'a'", colour: "teal",   soundFile: "hareke-fatha.mp3" },
    { arabic: "إِ", name: "Kasra",  symbol: "ـِ", sound: "i", description: "Crtica ispod slova, daje kratki zvuk 'i'", colour: "blue",   soundFile: "hareke-kasra.mp3" },
    { arabic: "أُ", name: "Damma",  symbol: "ـُ", sound: "u", description: "Mali 'و' iznad slova, daje kratki zvuk 'u'", colour: "violet", soundFile: "hareke-damma.mp3" },
    { arabic: "أْ", name: "Sukun",  symbol: "ـْ", sound: "–", description: "Kružić iznad slova — nema samoglasnika, slovo se 'zatvori'", colour: "gray", soundFile: "hareke-sukun.mp3" },
    { arabic: "أّ", name: "Šedda",  symbol: "ـّ", sound: "×2", description: "Znak poput 'w' — udvostrucuje suglasnik", colour: "orange", soundFile: "hareke-sedda.mp3" },
  ],
  exercises: [
    {
      title: "Prepoznaj hareke",
      description: "Pročitaj slovo s harekom i odaberi tačan zvuk",
      icon: "👁️",
      hasanatReward: 15,
      words: [
        { arabic: "أَب",   latin: "ab",   meaning: "otac" },
        { arabic: "أُمّ",  latin: "umm",  meaning: "majka" },
        { arabic: "أَخ",   latin: "ah",   meaning: "brat" },
        { arabic: "أُخْت", latin: "uht",  meaning: "sestra" },
        { arabic: "إِسْم", latin: "ism",  meaning: "ime" },
        { arabic: "أَرْض", latin: "ard",  meaning: "zemlja" },
        { arabic: "أَسَد", latin: "asad", meaning: "lav" },
        { arabic: "أُذُن", latin: "uzun", meaning: "uho" },
        { arabic: "إِبِل", latin: "ibil", meaning: "deva" },
        { arabic: "أَيْن", latin: "ayn",  meaning: "gdje" },
      ]
    },
    {
      title: "Upiši zvuk hareke",
      description: "Pogledaj hareke pa upiši koji zvuk daje",
      icon: "✏️",
      hasanatReward: 10,
      words: [
        { arabic: "أَمْس",   latin: "ams",   meaning: "jučer" },
        { arabic: "أَوْ",    latin: "aw",    meaning: "ili" },
        { arabic: "إِلَى",   latin: "ila",   meaning: "prema" },
        { arabic: "أَحْمَد", latin: "Ahmad", meaning: "Ahmed" },
        { arabic: "أَمِين",  latin: "Amin",  meaning: "Emin" },
        { arabic: "إِيمَان", latin: "Iman",  meaning: "vjera / Iman" },
        { arabic: "أُسْبُوع",latin: "usbuu", meaning: "sedmica" },
        { arabic: "أَلَم",   latin: "alam",  meaning: "bol" },
        { arabic: "أَخْضَر", latin: "ahdhar",meaning: "zeleno" },
        { arabic: "أَبْيَض", latin: "abyad", meaning: "bijelo" },
      ]
    },
  ],
};

function playAudio(file: string) {
  const audio = new Audio(`${BASE}audio/harfovi/${file}`);
  audio.play().catch(() => {});
}

const HAREKE_COLOURS: Record<string, string> = {
  teal: "bg-teal-50 border-teal-300 text-teal-800",
  blue: "bg-blue-50 border-blue-300 text-blue-800",
  violet: "bg-violet-50 border-violet-300 text-violet-800",
  gray: "bg-gray-50 border-gray-300 text-gray-700",
  orange: "bg-orange-50 border-orange-300 text-orange-800",
};

export default function LessonDetail() {
  const { id } = useParams();
  const data = MOCK_LESSON_DETAIL;

  const dzanaImg = `${BASE}images/dzana-avatar.png`;
  const amirImg  = `${BASE}images/amir-avatar.png`;

  return (
    <Layout>
      {/* Back */}
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-teal-700 font-bold bg-primary/5 px-4 py-2 rounded-full hover:bg-primary/10 transition-colors">
          <ArrowLeft className="w-4 h-4" />
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
            <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2">{data.title}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            {data.letters.map((letter, i) => (
              <button
                key={i}
                onClick={() => playAudio("elif.mp3")}
                className="w-20 h-20 bg-gradient-to-br from-primary to-teal-600 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-primary/20 text-white gap-1 hover:scale-105 transition-transform"
              >
                <span className="text-4xl font-bold" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{letter}</span>
                <Volume2 className="w-4 h-4 opacity-70" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dialog — two columns */}
      <Card className="p-6 mb-8 bg-gradient-to-r from-orange-50 to-pink-50 border-orange-100">
        <h2 className="text-xl font-bold text-orange-800 flex items-center gap-2 mb-6">
          <BookOpen className="w-6 h-6" />
          Priča za danas
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {data.story.lines.map((line, i) => {
            const isDzana = line.speaker === "dzana";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                className={`flex flex-col gap-1 ${isDzana ? "col-start-1" : "col-start-2"}`}
              >
                {/* Speaker label + avatar */}
                <div className={`flex items-center gap-1.5 ${isDzana ? "" : "flex-row-reverse"}`}>
                  <img src={isDzana ? dzanaImg : amirImg} alt={line.speaker}
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                  <span className="text-xs font-bold text-muted-foreground">
                    {isDzana ? "Džana" : "Amir"}
                  </span>
                </div>
                {/* Bubble */}
                <div className={`px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed shadow-sm
                  ${isDzana
                    ? "bg-white text-foreground rounded-tl-sm"
                    : "bg-primary text-white rounded-tr-sm"}`}>
                  {line.text}
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Letter + Hareketi */}
      <div className="space-y-8 mb-8">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Info className="w-6 h-6 text-primary" />
          Upoznajmo slova i harekete
        </h2>

        {/* Elif card */}
        {data.letterData.map((letter, i) => (
          <Card key={i} className="p-6 border-2 border-border/50 hover:border-primary/50 transition-colors">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-2xl font-bold text-foreground">{letter.name}</h3>
                  <button
                    onClick={() => playAudio(letter.soundFile)}
                    className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-muted-foreground font-medium">Izgovor: /{letter.transliteration}/</p>
                <p className="text-sm text-muted-foreground mt-1 italic">{letter.visualAssociation}</p>
                {letter.nonConnecting && (
                  <span className="inline-block mt-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase">
                    Ne spaja se ulijevo
                  </span>
                )}
              </div>
              <div className="text-8xl text-primary" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>
                {letter.arabic}
              </div>
            </div>
            <div className="bg-muted rounded-xl p-4">
              <p className="text-sm font-bold text-muted-foreground mb-3 text-center uppercase tracking-wider">Oblici slova</p>
              <div className="grid grid-cols-4 gap-2 text-center" dir="rtl">
                {[
                  { form: letter.forms.isolated, label: "Sam." },
                  { form: letter.forms.initial,  label: "Poč." },
                  { form: letter.forms.medial,   label: "Sred." },
                  { form: letter.forms.final,    label: "Kraj." },
                ].map(({ form, label }) => (
                  <div key={label} className="bg-white rounded-lg p-2">
                    <div className="text-4xl font-bold text-foreground mb-1" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{form}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

        {/* Hareketi section */}
        <div>
          <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <span className="text-2xl" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>ـَ</span>
            Hareketi — znakovi za samoglasnike
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.hareketi.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className={`border-2 rounded-2xl p-4 flex items-center gap-4 ${HAREKE_COLOURS[h.colour]}`}>
                  <div className="flex flex-col items-center shrink-0 w-16">
                    <span className="text-5xl font-bold" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{h.arabic}</span>
                    <span className="text-xs font-bold mt-1 opacity-70">zvuk: «{h.sound}»</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-extrabold text-base">{h.name}</p>
                      <span className="text-lg font-bold opacity-60" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{h.symbol}</span>
                      <button
                        onClick={() => playAudio(h.soundFile)}
                        className="ml-auto w-7 h-7 rounded-full bg-white/60 hover:bg-white flex items-center justify-center transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs leading-snug opacity-80">{h.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Exercises */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Gamepad2 className="w-6 h-6 text-accent" />
          Vježbe
        </h2>
        <div className="grid lg:grid-cols-2 gap-6">
          {data.exercises.map((ex, ei) => (
            <Card key={ei} className="p-5 border-2 border-border/50">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{ex.icon}</span>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{ex.title}</h3>
                  <p className="text-sm text-muted-foreground">{ex.description}</p>
                </div>
                <span className="ml-auto flex items-center gap-1 text-yellow-600 font-bold text-sm shrink-0">
                  <Star className="w-4 h-4 fill-current" /> {ex.hasanatReward}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ex.words.map((w, wi) => (
                  <div key={wi} className="bg-muted/50 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xl font-bold text-foreground" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{w.arabic}</span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-primary">{w.latin}</div>
                      <div className="text-[11px] text-muted-foreground">{w.meaning}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4 game-button" size="sm">
                <PlayCircle className="w-4 h-4 mr-2" /> Počni vježbu
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-6 bg-green-50 rounded-2xl border border-green-200 text-center">
          <h3 className="font-bold text-green-800 mb-2">Spreman za prelazak?</h3>
          <p className="text-green-700/80 mb-4 text-sm">Završi sve vježbe da bi otključao sljedeću lekciju i zaradio sve hasanate!</p>
          <Button size="lg" className="w-full bg-green-600 hover:bg-green-700 text-white game-button">
            Završi lekciju
          </Button>
        </div>
      </div>
    </Layout>
  );
}
