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
      { speaker: "amir",  text: "A, kao tačkice, samo umjesto suglasnika za samoglasnike?" },
      { speaker: "dzana", text: "Tačno! Na primjer, elif sa fehom iznad se čita 'e', a sa kesrom ispod čita se 'i'." },
      { speaker: "amir",  text: "A šta je sa dammom? Kako izgleda?" },
      { speaker: "dzana", text: "Damma izgleda kao mali zarez iznad slova i daje zvuk 'u'. Elif s dammom čita se 'u'." },
      { speaker: "amir",  text: "Znači, samo jedno slovo može se čitati na više načina! Elif je kao čarobnjak." },
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
      arabic: "أَ", hareke: "ـَ", name: "Fetha",
      sound: "e", colour: "teal",
      description: "Crtica iznad slova — daje kratki zvuk \"e\"",
      napomena: "Iznad krupnih (jakih) harfova čita se \"a\"",
      soundFile: "hareke-fatha.mp3",
    },
    {
      arabic: "إِ", hareke: "ـِ", name: "Kesra",
      sound: "i", colour: "blue",
      description: "Crtica ispod slova — daje kratki zvuk \"i\"",
      napomena: null,
      soundFile: "hareke-kasra.mp3",
    },
    {
      arabic: "أُ", hareke: "ـُ", name: "Damma",
      sound: "u", colour: "violet",
      description: "Znak poput zareza iznad slova — daje kratki zvuk \"u\"",
      napomena: null,
      soundFile: "hareke-damma.mp3",
    },
    {
      arabic: "أْ", hareke: "ـْ", name: "Sukun",
      sound: "–", colour: "gray",
      description: "Kružić iznad slova — nema samoglasnika, slovo se zaustavlja",
      napomena: null,
      soundFile: "hareke-sukun.mp3",
    },
    {
      arabic: "أّ", hareke: "ـّ", name: "Tešdid",
      sound: "×2", colour: "orange",
      description: "Znak poput slova \"w\" — udvostrucuje suglasnik",
      napomena: null,
      soundFile: "hareke-sedda.mp3",
    },
  ],
  exercises: [
    {
      title: "Prepoznaj hareke",
      description: "Pročitaj slovo s harekom i odaberi tačan zvuk",
      icon: "👁️",
      hasanatReward: 15,
      words: [
        { arabic: "أَب",    latin: "eb",    meaning: "otac" },
        { arabic: "أُمّ",   latin: "umm",   meaning: "majka" },
        { arabic: "أَخ",    latin: "eh",    meaning: "brat" },
        { arabic: "أُخْت",  latin: "uht",   meaning: "sestra" },
        { arabic: "إِسْم",  latin: "ism",   meaning: "ime" },
        { arabic: "أَرْض",  latin: "erd",   meaning: "zemlja" },
        { arabic: "أَسَد",  latin: "esed",  meaning: "lav" },
        { arabic: "أُذُن",  latin: "uzun",  meaning: "uho" },
        { arabic: "إِبِل",  latin: "ibil",  meaning: "deva" },
        { arabic: "أَيْن",  latin: "eyn",   meaning: "gdje" },
      ]
    },
    {
      title: "Upiši zvuk hareke",
      description: "Pogledaj hareke pa upiši koji zvuk daje",
      icon: "✏️",
      hasanatReward: 10,
      words: [
        { arabic: "أَمْس",    latin: "ems",    meaning: "jučer" },
        { arabic: "أَوْ",     latin: "ew",     meaning: "ili" },
        { arabic: "إِلَى",    latin: "ila",    meaning: "prema" },
        { arabic: "أَحْمَد",  latin: "Ahmed",  meaning: "Ahmed" },
        { arabic: "أَمِين",   latin: "Emin",   meaning: "Emin" },
        { arabic: "إِيمَان",  latin: "Iman",   meaning: "vjera" },
        { arabic: "أُسْبُوع", latin: "usbuu",  meaning: "sedmica" },
        { arabic: "أَلَم",    latin: "elem",   meaning: "bol" },
        { arabic: "أَخْضَر",  latin: "ahdar",  meaning: "zeleno" },
        { arabic: "أَبْيَض",  latin: "ebjed",  meaning: "bijelo" },
      ]
    },
  ],
};

const COLOUR_MAP: Record<string, { card: string; badge: string; sound: string }> = {
  teal:   { card: "bg-teal-50 border-teal-300",    badge: "bg-teal-500 text-white",   sound: "bg-teal-100 text-teal-700 hover:bg-teal-200" },
  blue:   { card: "bg-blue-50 border-blue-300",    badge: "bg-blue-500 text-white",   sound: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  violet: { card: "bg-violet-50 border-violet-300",badge: "bg-violet-500 text-white", sound: "bg-violet-100 text-violet-700 hover:bg-violet-200" },
  gray:   { card: "bg-gray-50 border-gray-300",    badge: "bg-gray-500 text-white",   sound: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  orange: { card: "bg-orange-50 border-orange-300",badge: "bg-orange-500 text-white", sound: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
};

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

      {/* Priča — dvije kolone na desktopu */}
      <Card className="p-6 mb-8 bg-gradient-to-r from-orange-50 to-pink-50 border-orange-100">
        <h2 className="text-2xl font-bold text-orange-800 flex items-center gap-2 mb-6">
          <BookOpen className="w-6 h-6" />
          Priča za danas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Džana — lijeva kolona */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 mb-1">
              <img src={dzanaImg} alt="Džana"
                className="w-12 h-12 rounded-full border-3 border-white shadow-md object-cover" />
              <span className="text-lg font-extrabold text-orange-700">Džana</span>
            </div>
            {dzanaLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm text-base font-medium leading-relaxed text-foreground border border-orange-100"
              >
                {line.text}
              </motion.div>
            ))}
          </div>

          {/* Amir — desna kolona */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 mb-1 justify-end">
              <span className="text-lg font-extrabold text-primary">Amir</span>
              <img src={amirImg} alt="Amir"
                className="w-12 h-12 rounded-full border-3 border-white shadow-md object-cover" />
            </div>
            {amirLines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 + 0.08 }}
                className="bg-primary rounded-2xl rounded-tr-sm px-5 py-4 shadow-sm text-base font-medium leading-relaxed text-white"
              >
                {line.text}
              </motion.div>
            ))}
          </div>
        </div>
      </Card>

      {/* Elif kartica */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-5">
          <Info className="w-6 h-6 text-primary" />
          Upoznajmo slova i harekete
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
              <div className="text-9xl text-primary" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>
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
                    <div className="text-sm font-semibold text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

        {/* Hareketi kartice */}
        <h3 className="text-xl font-bold text-foreground mb-4">Hareketi — znakovi za samoglasnike</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.hareketi.map((h, i) => {
            const c = COLOUR_MAP[h.colour];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`border-2 rounded-2xl p-5 ${c.card}`}
              >
                {/* Top: arabic + badge + audio */}
                <div className="flex items-start justify-between mb-4">
                  <div className="text-8xl leading-none" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>
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
                      zvuk: «{h.sound}»
                    </span>
                  </div>
                </div>

                {/* Hareke symbol + name */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl font-bold" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{h.hareke}</span>
                  <span className="text-2xl font-extrabold">{h.name}</span>
                </div>

                {/* Description */}
                <p className="text-base font-medium leading-snug">{h.description}</p>
                {h.napomena && (
                  <p className="text-sm mt-2 opacity-75 italic">{h.napomena}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Vježbe */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <Gamepad2 className="w-6 h-6 text-accent" />
          Vježbe
        </h2>
        <div className="grid lg:grid-cols-2 gap-6">
          {data.exercises.map((ex, ei) => (
            <Card key={ei} className="p-5 border-2 border-border/50">
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
              <div className="grid grid-cols-2 gap-2">
                {ex.words.map((w, wi) => (
                  <div key={wi} className="bg-muted/50 rounded-xl px-3 py-3 flex items-center justify-between gap-2">
                    <span className="text-3xl font-bold text-foreground" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{w.arabic}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">{w.latin}</div>
                      <div className="text-xs text-muted-foreground">{w.meaning}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4 game-button text-base py-5" size="sm">
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
