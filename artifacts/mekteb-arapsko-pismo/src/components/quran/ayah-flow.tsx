import { surahBosnianName, surahHasBismillahHeader, BISMILLAH } from "@/lib/quran";
import { ayahKey } from "@/hooks/use-quran-audio";

export interface FlowAyah {
  surah: number;
  numberInSurah: number;
  text: string;
  surahArabicName?: string;
}

interface AyahFlowProps {
  ayahs: FlowAyah[];
  activeKey: string | null;
  onAyahClick: (a: FlowAyah) => void;
  /** Prikaži zaglavlje + bismillu na početku svake sure (za Mushaf stranicu). */
  showSurahDividers?: boolean;
}

const QURAN_FONT = "'UthmanicHafs', 'Amiri Quran', serif";

// Grupiše uzastopne ajete po suri (za stranicu koja prelazi granicu sure).
function groupBySurah(ayahs: FlowAyah[]): FlowAyah[][] {
  const groups: FlowAyah[][] = [];
  for (const a of ayahs) {
    const last = groups[groups.length - 1];
    if (last && last[0].surah === a.surah) last.push(a);
    else groups.push([a]);
  }
  return groups;
}

function SurahDivider({ ayah }: { ayah: FlowAyah }) {
  return (
    <div className="text-center my-5 first:mt-0">
      <div className="inline-flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-primary/5 border border-primary/15">
        <span
          className="text-2xl text-primary"
          style={{ fontFamily: QURAN_FONT }}
          dir="rtl"
        >
          {ayah.surahArabicName}
        </span>
        <span className="text-sm font-extrabold text-foreground">
          {ayah.surah}. {surahBosnianName(ayah.surah)}
        </span>
      </div>
      {surahHasBismillahHeader(ayah.surah) && (
        <div
          className="text-center text-2xl sm:text-3xl text-primary mt-3"
          style={{ fontFamily: QURAN_FONT }}
          dir="rtl"
        >
          {BISMILLAH}
        </div>
      )}
    </div>
  );
}

export function AyahFlow({ ayahs, activeKey, onAyahClick, showSurahDividers }: AyahFlowProps) {
  const groups = groupBySurah(ayahs);
  return (
    <div>
      {groups.map((group) => (
        <div key={`grp-${group[0].surah}-${group[0].numberInSurah}`}>
          {showSurahDividers && <SurahDivider ayah={group[0]} />}
          <div
            dir="rtl"
            className="text-right"
            style={{
              fontFamily: QURAN_FONT,
              fontSize: "2rem",
              lineHeight: 2.5,
              textAlign: "justify",
              textAlignLast: "right",
            }}
          >
            {group.map((a) => {
              const k = ayahKey(a);
              const isActive = activeKey === k;
              return (
                <span
                  key={k}
                  data-ayah-key={k}
                  data-testid={`ajet-${a.surah}-${a.numberInSurah}`}
                  onClick={() => onAyahClick(a)}
                  className={`cursor-pointer rounded px-1 transition-colors ${
                    isActive ? "bg-gold/30" : "hover:bg-primary/5"
                  }`}
                  style={{
                    boxDecorationBreak: "clone",
                    WebkitBoxDecorationBreak: "clone",
                  }}
                >
                  {a.text}{" "}
                  <span
                    className={`inline-flex items-center justify-center align-middle mx-1 rounded-full w-7 h-7 ${
                      isActive ? "bg-gold text-gold-foreground" : "bg-primary/10 text-primary"
                    }`}
                    style={{ fontFamily: "'Nunito', sans-serif", fontSize: "0.8rem", fontWeight: 800 }}
                  >
                    {a.numberInSurah}
                  </span>{" "}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
