import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLanguage } from "@/context/language";
import { BookOpen, Search, Volume2, Lock, PlayCircle } from "lucide-react";
import { LESSONS } from "@/data/lessons";

const BASE = import.meta.env.BASE_URL;

interface Harf {
  id: number;
  arabic: string;
  name: string;
  trans: string;
  dots: number;
  connecting: boolean;
  group: string;
  audioFile: string;
}

const HARFOVI: Harf[] = [
  { id: 1,  arabic: "ا", name: "Elif", trans: "A / E",      dots: 0, connecting: false, group: "Grupa 1",  audioFile: "elif.mp3" },
  { id: 2,  arabic: "ب", name: "Ba",   trans: "B",          dots: 1, connecting: true,  group: "Grupa 1",  audioFile: "ba.mp3" },
  { id: 3,  arabic: "ت", name: "Ta",   trans: "T",          dots: 2, connecting: true,  group: "Grupa 1",  audioFile: "ta.mp3" },
  { id: 4,  arabic: "ث", name: "Sa",   trans: "S (meko)",   dots: 3, connecting: true,  group: "Grupa 1",  audioFile: "sa.mp3" },
  { id: 5,  arabic: "ج", name: "Džim", trans: "Dž",         dots: 1, connecting: true,  group: "Grupa 2",  audioFile: "dzim.mp3" },
  { id: 6,  arabic: "ح", name: "Ha",   trans: "H (duboko)", dots: 0, connecting: true,  group: "Grupa 2",  audioFile: "ha.mp3" },
  { id: 7,  arabic: "خ", name: "Ha",   trans: "H (grlo)",   dots: 1, connecting: true,  group: "Grupa 2",  audioFile: "ha2.mp3" },
  { id: 8,  arabic: "د", name: "Dal",  trans: "D",          dots: 0, connecting: false, group: "Grupa 3",  audioFile: "dal.mp3" },
  { id: 9,  arabic: "ذ", name: "Zal",  trans: "Z (meko)",   dots: 1, connecting: false, group: "Grupa 3",  audioFile: "zal.mp3" },
  { id: 10, arabic: "ر", name: "Ra",   trans: "R",          dots: 0, connecting: false, group: "Grupa 3",  audioFile: "ra.mp3" },
  { id: 11, arabic: "ز", name: "Zejn", trans: "Z",          dots: 1, connecting: false, group: "Grupa 3",  audioFile: "zejn.mp3" },
  { id: 12, arabic: "س", name: "Sin",  trans: "S",          dots: 0, connecting: true,  group: "Grupa 4",  audioFile: "sin.mp3" },
  { id: 13, arabic: "ش", name: "Šin",  trans: "Š",          dots: 3, connecting: true,  group: "Grupa 4",  audioFile: "sin2.mp3" },
  { id: 14, arabic: "ص", name: "Sad",  trans: "S (jako)",   dots: 0, connecting: true,  group: "Grupa 5",  audioFile: "sad.mp3" },
  { id: 15, arabic: "ض", name: "Dad",  trans: "D (jako)",   dots: 1, connecting: true,  group: "Grupa 5",  audioFile: "dad.mp3" },
  { id: 16, arabic: "ط", name: "Ta",   trans: "T (jako)",   dots: 0, connecting: true,  group: "Grupa 6",  audioFile: "ta2.mp3" },
  { id: 17, arabic: "ظ", name: "Za",   trans: "Z (jako)",   dots: 1, connecting: true,  group: "Grupa 6",  audioFile: "za.mp3" },
  { id: 18, arabic: "ع", name: "Ajn",  trans: "' (grlo)",   dots: 0, connecting: true,  group: "Grupa 7",  audioFile: "ajn.mp3" },
  { id: 19, arabic: "غ", name: "Gajn", trans: "G (grlo)",   dots: 1, connecting: true,  group: "Grupa 7",  audioFile: "gajn.mp3" },
  { id: 20, arabic: "ف", name: "Fa",   trans: "F",          dots: 1, connecting: true,  group: "Grupa 8",  audioFile: "fa.mp3" },
  { id: 21, arabic: "ق", name: "Kaf",  trans: "K (duboko)", dots: 2, connecting: true,  group: "Grupa 8",  audioFile: "kaf.mp3" },
  { id: 22, arabic: "ك", name: "Kef",  trans: "K",          dots: 0, connecting: true,  group: "Grupa 9",  audioFile: "kef.mp3" },
  { id: 23, arabic: "ل", name: "Lam",  trans: "L",          dots: 0, connecting: true,  group: "Grupa 9",  audioFile: "lam.mp3" },
  { id: 24, arabic: "م", name: "Mim",  trans: "M",          dots: 0, connecting: true,  group: "Grupa 9",  audioFile: "mim.mp3" },
  { id: 25, arabic: "ن", name: "Nun",  trans: "N",          dots: 1, connecting: true,  group: "Grupa 9",  audioFile: "nun.mp3" },
  { id: 26, arabic: "ه", name: "He",   trans: "H",          dots: 0, connecting: true,  group: "Grupa 10", audioFile: "he.mp3" },
  { id: 27, arabic: "و", name: "Waw",  trans: "V / U",      dots: 0, connecting: false, group: "Grupa 10", audioFile: "waw.mp3" },
  { id: 28, arabic: "ي", name: "Ja",   trans: "J / I",      dots: 2, connecting: true,  group: "Grupa 10", audioFile: "ja.mp3" },
];

const GROUPS = Array.from(new Set(HARFOVI.map(h => h.group)));

const DOT_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-500",
  1: "bg-teal-50 text-teal-600",
  2: "bg-blue-50 text-blue-600",
  3: "bg-purple-50 text-purple-700",
};

function playHarf(file: string) {
  const audio = new Audio(`${BASE}audio/harfovi/${file}`);
  audio.play().catch(() => {});
}

export default function ArapskoPismoPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const filtered = HARFOVI.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.name.toLowerCase().includes(q) || h.trans.toLowerCase().includes(q) || h.arabic.includes(q);
    const matchGroup = !activeGroup || h.group === activeGroup;
    return matchSearch && matchGroup;
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-200">
            <span className="text-white text-2xl font-bold" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>ب</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">{t("sufara.naslov")}</h1>
            <p className="text-muted-foreground font-medium">28 {t("sufara.harfova")} · {t("sufara.nauci")}</p>
          </div>
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-2xl">👧🏻</span>
          <div>
            <p className="font-bold text-teal-800 text-sm">{t("sufara.dzanaKaze")}</p>
            <p className="text-teal-700 text-sm">{t("sufara.arabiAlphabet")} {t("sufara.zdesna")}</p>
          </div>
        </div>

        {/* ── Karta harfova banner ── */}
        <Link href="/karta-harfova">
          <div className="mb-6 flex items-center gap-4 p-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-2xl cursor-pointer shadow-md transition-all group">
            <div className="text-4xl">🗺️</div>
            <div className="flex-1">
              <p className="font-extrabold text-white text-lg leading-tight">{t("sufara.kartaHarfova")}</p>
              <p className="text-teal-100 text-sm font-medium">{t("sufara.referenca")}</p>
            </div>
            <div className="text-white/70 group-hover:text-white text-2xl transition-colors">→</div>
          </div>
        </Link>

        {/* ── Lekcije ── */}
        <div className="mb-8">
          <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2 mb-4">
            <PlayCircle className="w-5 h-5 text-primary" />
            {t("sufara.lekcije")}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {LESSONS.map((lesson, i) => {
              const isUnlocked = true;
              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  {isUnlocked ? (
                    <Link href={`/lesson/${lesson.id}`}>
                      <div className="flex items-center gap-4 p-4 bg-white border-2 border-primary/30 hover:border-primary rounded-2xl cursor-pointer hover:shadow-md transition-all group">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-teal-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                          {lesson.orderNum}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-foreground text-base leading-tight">{lesson.title}</p>
                          <div className="flex items-center gap-2 mt-1" dir="rtl">
                            {lesson.letters.map(l => (
                              <span key={l} className="text-3xl font-bold text-primary" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{l}</span>
                            ))}
                          </div>
                        </div>
                        <PlayCircle className="w-6 h-6 text-primary opacity-60 group-hover:opacity-100 shrink-0 transition-opacity" />
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 p-4 bg-muted/40 border-2 border-border/40 rounded-2xl opacity-60">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-black text-lg shrink-0">
                        {lesson.orderNum}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-muted-foreground text-base leading-tight">{lesson.title}</p>
                        <div className="flex items-center gap-2 mt-1" dir="rtl">
                          {lesson.letters.slice(0, 3).map(l => (
                            <span key={l} className="text-3xl font-bold text-muted-foreground" style={{ fontFamily: "Noto Naskh Arabic, serif" }}>{l}</span>
                          ))}
                        </div>
                      </div>
                      <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Harfovi referenca ── */}
        <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          {t("sufara.referenca")}
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("sufara.pretrazi")}
              className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveGroup(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!activeGroup ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {t("common.svi")}
            </button>
            {GROUPS.map(g => (
              <button key={g} onClick={() => setActiveGroup(g === activeGroup ? null : g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeGroup === g ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> {t("sufara.spajaSe")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" /> {t("sufara.neSpajaSe")}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((harf, i) => (
            <motion.div
              key={harf.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative"
            >
              {/* Play button — stops propagation so card navigation doesn't trigger */}
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); playHarf(harf.audioFile); }}
                className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-teal-100 hover:bg-teal-200 text-teal-700 flex items-center justify-center transition-colors shadow-sm"
                title={`${t("sufara.cujIzgovor")}: ${harf.name}`}
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <div className="bg-white border-2 border-border/40 hover:border-primary/20 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col items-center">
                <div className="text-center mb-3">
                  <span
                    className="text-7xl text-foreground leading-none block"
                    style={{ fontFamily: "Noto Naskh Arabic, serif", direction: "rtl" }}
                  >
                    {harf.arabic}
                  </span>
                </div>
                <div className="text-center mb-3">
                  <p className="font-extrabold text-foreground text-xl leading-tight">{harf.name}</p>
                  <p className="text-base text-teal-600 font-bold mt-0.5">{harf.trans}</p>
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${DOT_COLORS[harf.dots]} ${harf.dots > 0 ? "border-current/20" : "border-transparent"}`}>
                    {harf.dots === 0 ? "–" : `${harf.dots}●`}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${harf.connecting ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                    {harf.connecting ? t("sufara.spaja") : t("sufara.solo")}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-bold">{t("sufara.nemaRezultata")} "{search}"</p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: t("sufara.ukupnoHarfova"), value: "28", icon: "🔤" },
            { label: t("sufara.spajajuSe"), value: "22", icon: "🔗" },
            { label: t("sufara.neSpajajuSe"), value: "6", icon: "✂️" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border/50 rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-extrabold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
