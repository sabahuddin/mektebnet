import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/context/auth";
import { useLanguage } from "@/context/language";
import { apiRequest } from "@/lib/api";
import { isLekcijaUnlocked, isEtapaPassed } from "@/lib/lekcija-unlock";
import { Check, Sparkles, X, Lock } from "lucide-react";

// Mala kamilica (SVG) — oznaka za preduvjet koji još nije završen
function ChamomileSvg({ size = 20 }: { size?: number }) {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden>
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="10" cy="4.2"
          rx="1.7" ry="3"
          fill="white"
          stroke="#d1d5db"
          strokeWidth="0.5"
          transform={`rotate(${angle} 10 10)`}
        />
      ))}
      <circle cx="10" cy="10" r="3.6" fill="#fbbf24" />
      <circle cx="10" cy="10" r="1.8" fill="#f59e0b" />
    </svg>
  );
}

const mapaPozadinaUrl = `${import.meta.env.BASE_URL}images/mapa/pozadina-pcele.png`;

interface Lekcija {
  id: number;
  slug: string;
  naslov: string;
  redoslijed: number;
  uvjetiIds?: number[];
}
interface Medaljon {
  id: number;
  slug: string;
  naziv: string;
  opis: string;
  posAfterRedoslijed: number;
  ikona: string;
  boja: string;
  imaKviz?: boolean;
  isGating?: boolean;
}
interface KrunisanjeMeta {
  id: number;
  nivo: number;
  naslov: string | null;
  isGating: boolean;
  imaKviz: boolean;
}
interface MapaData {
  lekcije: Lekcija[];
  medaljoni: Medaljon[];
  krunisanje?: KrunisanjeMeta | null;
  zavrsene: number[];
  osvojeniMedaljoni: number[];
  polozenaKrunisanja?: number[];
}

// Layout: 5 kolona × N lekcijskih redova snake (bottom-up). Vrata zauzimaju
// prazno mjesto na vrhu (ako postoji) i otvaraju sljedeći nivo.
const COLS = 5;

interface NivoConfig {
  totalCells: number;        // broj polja za lekcije (npr. 64 za Nivo 1)
  medaljonCount: number;     // broj medaljona u top baru
  doorTo: string | null;     // ruta na koju vode vrata (null = nema vrata)
  doorLabel: string;         // tekst za alt/title
  fallbackTotal: number;     // za guest/empty case
}

const NIVO_CONFIGS: Record<number, NivoConfig> = {
  1: { totalCells: 64, medaljonCount: 6, doorTo: "/nivo2-mapa", doorLabel: "Vrata u Zlatnu košnicu", fallbackTotal: 64 },
  2: { totalCells: 69, medaljonCount: 6, doorTo: "/nivo3-mapa", doorLabel: "Vrata u Košnicu mudrosti", fallbackTotal: 69 },
  3: { totalCells: 0,  medaljonCount: 10, doorTo: null,         doorLabel: "",                         fallbackTotal: 50 }, // totalCells=0 ⇒ koristi data.length
};

export default function Nivo1MapaPage({ nivo = 1 }: { nivo?: 1 | 2 | 3 } = {}) {
  const cfg = NIVO_CONFIGS[nivo] ?? NIVO_CONFIGS[1];
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<MapaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lockedPopup, setLockedPopup] = useState<Lekcija | null>(null);

  useEffect(() => {
    apiRequest<MapaData>("GET", `/mapa/nivo/${nivo}`, undefined, token || undefined)
      .then(setData)
      .catch(() => setData({ lekcije: [], medaljoni: [], krunisanje: null, zavrsene: [], osvojeniMedaljoni: [], polozenaKrunisanja: [] }))
      .finally(() => setIsLoading(false));
  }, [token, nivo]);

  const lekcijeSorted = useMemo(
    () => [...(data?.lekcije ?? [])].sort((a, b) => a.redoslijed - b.redoslijed),
    [data],
  );
  const medaljoniSorted = useMemo(
    () => [...(data?.medaljoni ?? [])].sort((a, b) => a.posAfterRedoslijed - b.posAfterRedoslijed),
    [data],
  );
  const zavrseneSet = useMemo(() => new Set(data?.zavrsene ?? []), [data]);
  const osvojeniSet = useMemo(() => new Set(data?.osvojeniMedaljoni ?? []), [data]);

  // Dinamički total: za nivoe 1/2 koristimo fiksni totalCells; za nivo 3
  // (totalCells=0) koristimo broj lekcija iz baze (ili fallback dok se učitava).
  const TOTAL_CELLS = cfg.totalCells > 0
    ? cfg.totalCells
    : Math.max(lekcijeSorted.length, cfg.fallbackTotal);
  const LESSON_ROWS = Math.ceil(TOTAL_CELLS / COLS);
  // INLINE MEDALJON-REDOVI: nakon svakih 10 lekcija (10, 20, 30...) ubacujemo
  // poseban red u kojem stoji samo medaljon (srednja kolona). Klik vodi na
  // "praznu lekciju" sa slug-om `medaljon-nivo{N}-{NN}` koju admin kreira i
  // popuni akordionima/vježbama.
  // 10 lekcija = 2 lekcijska reda → medaljon-red ide IZMEĐU svaka 2 lekcijska
  // reda (između lr=1 i lr=2, između lr=3 i lr=4, ...).
  const MED_COUNT = Math.floor(TOTAL_CELLS / 10);
  // Vrata zauzimaju prazno mjesto u zadnjem redu lekcija; ako je zadnji red pun
  // (totalCells je višekratnik 5), vrata dobiju zaseban red iznad.
  const needsExtraDoorRow = !!cfg.doorTo && TOTAL_CELLS % COLS === 0;
  const TOTAL_ROWS = LESSON_ROWS + MED_COUNT + (needsExtraDoorRow ? 1 : 0);
  const REQUIRED_FOR_DOOR = TOTAL_CELLS;

  const completedCount = useMemo(
    () => lekcijeSorted.filter((l) => zavrseneSet.has(l.id)).length,
    [lekcijeSorted, zavrseneSet],
  );
  const lessonsAllDone = completedCount >= REQUIRED_FOR_DOOR;
  // Krunisanje gating: vrata na sljedeći nivo zahtijevaju da su sve etape
  // (medaljoni) ovog nivoa "položene" (claim ili ispit). Ako krunisanje
  // postoji s konfigurisanim kvizom, vrata vode na /krunisanje/:nivo
  // (završni izazov); inače na sljedeću mapu po starom toku.
  const sveEtapePolozene = medaljoniSorted.length > 0
    && medaljoniSorted.every((m) => isEtapaPassed(m, completedCount, osvojeniSet));
  const krunisanjeMeta = data?.krunisanje ?? null;
  const krunisanjePolozeno = !!krunisanjeMeta
    && (data?.polozenaKrunisanja ?? []).includes(krunisanjeMeta.id);
  const allDone = lessonsAllDone && (medaljoniSorted.length === 0 || sveEtapePolozene);
  const doorTarget = krunisanjeMeta && krunisanjeMeta.imaKviz
    ? `/krunisanje/${nivo}`
    : cfg.doorTo;
  // Vrata su otključana kad su sve lekcije + sve etape gotove. Ako krunisanje
  // ima ispit, klik vodi na krunisanje stranicu (koja interno traži ispit).
  // Ako je krunisanje već položeno, dodatno se može direktno otići na
  // sljedeći nivo (zadržavamo isti target — krunisanje stranica ima link).
  const doorEnabled = allDone;
  const doorLabel = krunisanjeMeta && krunisanjeMeta.imaKviz
    ? (krunisanjePolozeno
        ? t("Krunisanje položeno — {naslov}", { naslov: krunisanjeMeta.naslov ?? t("Nivo {nivo}", { nivo: String(nivo) }) })
        : t("Završni izazov — {naslov}", { naslov: krunisanjeMeta.naslov ?? t("Krunisanje nivoa {nivo}", { nivo: String(nivo) }) }))
    : cfg.doorLabel;

  // Trenutni cell (linearni indeks 0..N-1, gdje je 0 = lekcija 1).
  // Ako su sve lekcije završene, vraća -1 (pčela je "izašla kroz vrata").
  const currentCellIndex = useMemo(() => {
    for (let i = 0; i < lekcijeSorted.length; i++) {
      if (!zavrseneSet.has(lekcijeSorted[i].id)) return i;
    }
    return -1;
  }, [lekcijeSorted, zavrseneSet]);

  const currentLogicalRow = currentCellIndex < 0
    ? LESSON_ROWS - 1
    : Math.floor(currentCellIndex / COLS);
  // Otključavanje po MEDALJONIMA (blokovi po 10 lekcija). Sve preko ove granice
  // je zaključano (sivo), ali vidljivo skrolovanjem.
  // Pravila pristupa:
  //   - neprijavljen (gost): samo prvih 5 lekcija otključano
  //   - prijavljen učenik: prvih 10 + dodatnih 10 po svakom medaljonu
  //   - admin/muallim: sve otključano (puni pristup)
  // Task #133: roditelj (porodica) se tretira kao GOST na cijeloj platformi
  // (osim roditeljskog panela) → NIJE privilegovan i otključava samo prvih 5
  // lekcija, isto kao neprijavljeni posjetilac.
  const isPrivilegedRole =
    user?.role === "admin" || user?.role === "muallim";
  const isGuestLike = !user || user?.role === "roditelj";

  // Per-lekcija otključavanje na osnovu preduvjeta (uvjetiIds).
  // Svaka lekcija nosi listu ID-jeva koje student mora završiti da bi je
  // otključao. Lekcije bez preduvjeta (uvjetiIds=[]) su uvijek dostupne
  // studentu. Gost: max prvih 5; admin/muallim: sve.
  // isLekcijaUnlocked logika je u @/lib/lekcija-unlock — ista se koristi i na
  // stranici lekcije (ilmihal-lekcija.tsx) da bi oba gate-a bila sinhronizovana
  // (vidi .agents/memory/lekcije-dvije-brave.md).

  // Snake mapping: logički indeks → (logicalRow, col).
  function rowColFor(i: number): { logicalRow: number; col: number } {
    const logicalRow = Math.floor(i / COLS);
    const within = i % COLS;
    const col = logicalRow % 2 === 0 ? within : COLS - 1 - within;
    return { logicalRow, col };
  }
  // Bottom-up render uz INLINE medaljone: stack pozicija (od dna, 0-idx) je
  //   - za lekcijski red lr: lr + floor(lr/2)  (svaki par lekcijskih redova
  //     dobije medaljon ispod sljedećeg para)
  //   - za medaljon r:       2 + 3*r           (medaljon 0 je 3. red od dna)
  function stackPosForLessonRow(lr: number): number {
    return lr + Math.floor(lr / 2);
  }
  function stackPosForMedaljon(r: number): number {
    return 2 + 3 * r;
  }
  function displayRowFor(logicalRow: number): number {
    return TOTAL_ROWS - 1 - stackPosForLessonRow(logicalRow);
  }
  function displayRowForMedaljon(r: number): number {
    return TOTAL_ROWS - 1 - stackPosForMedaljon(r);
  }

  // Pozicija vrata: u istom redu kao zadnja lekcija (na suprotnom kraju snake-a),
  // osim ako je zadnji red pun — tada idu sami u red iznad.
  const lastIdx = TOTAL_CELLS - 1;
  const lastLogicalRow = Math.floor(lastIdx / COLS);
  const doorDisplayRow = needsExtraDoorRow ? 0 : displayRowFor(lastLogicalRow);
  const doorCol = needsExtraDoorRow
    ? COLS - 1
    : lastLogicalRow % 2 === 0
      ? COLS - 1
      : 0;

  // Auto-scroll do trenutne lekcije (kad se data učita)
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const t = setTimeout(() => {
      const el = containerRef.current?.querySelector(
        `[data-cell-index="${currentCellIndex}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [data, currentCellIndex]);

  // Parallax: pozadina prelazi od vrha do dna svoje pune visine paralelno
  // sa scrollom sadržaja. Kad sadržaj dođe na dno, vidi se i dno pozadine.
  useEffect(() => {
    const el = containerRef.current;
    const bg = bgRef.current;
    if (!el || !bg) return;
    let rafId = 0;
    const update = () => {
      rafId = 0;
      const contentMax = el.scrollHeight - el.clientHeight;
      const bgRange = bg.offsetHeight - el.clientHeight;
      if (contentMax <= 0 || bgRange <= 0) {
        bg.style.transform = "translate3d(0,0,0)";
        return;
      }
      const ratio = Math.max(0, Math.min(1, el.scrollTop / contentMax));
      bg.style.transform = `translate3d(0, ${-(ratio * bgRange).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (rafId === 0) rafId = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    // ResizeObserver hvata kasne layout promjene (font/image load, sticky bar
    // promjena visine na različitim breakpointima, sadržaj se širi/skuplja).
    const ro = new ResizeObserver(() => onScroll());
    ro.observe(el);
    ro.observe(bg);
    update();
    // Dodatni delayed update da uhvati kasne asset dimenzije prije prvog scrolla.
    const lateT = setTimeout(update, 300);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      ro.disconnect();
      clearTimeout(lateT);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-amber-100 flex items-center justify-center z-50">
        <div className="text-amber-800 font-bold">{t("Učitavam mapu…")}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 overflow-auto"
      style={{ backgroundColor: "#FEF3C7" }}
      data-testid="mapa-fullscreen"
    >
      {/* PARALLAX POZADINA — fixed sloj koji se translatuje sa scrollom.
          Visina = max(100vh, natural aspect ratio slike 941x1672). Dok korisnik
          skroluje od vrha do dna sadržaja, pozadina paralelno prelazi od vrha
          do dna svoje pune visine (vidi useEffect ispod). */}
      <div
        ref={bgRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 right-0 top-0 z-0 will-change-transform"
        style={{
          height: "max(100vh, calc(100vw * 1672 / 941))",
          backgroundImage: `url(${mapaPozadinaUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />

      {/* TOP BAR — counter (lijevo), 6 medaljona (sredina), X (desno) — sve sticky */}
      <div className="sticky top-0 z-[60] flex items-center gap-2 px-2 sm:px-4 py-2 bg-gradient-to-b from-amber-100/95 via-amber-50/85 to-transparent backdrop-blur-sm">
        <div
          className="flex-shrink-0 px-2.5 py-1.5 rounded-full bg-white shadow text-xs sm:text-base font-extrabold text-amber-900 whitespace-nowrap"
          data-testid="mapa-progress"
        >
          {completedCount}/{lekcijeSorted.length || cfg.fallbackTotal}
        </div>

        <div className="flex-1 flex items-center justify-center gap-0.5 sm:gap-2">
          {Array.from({ length: cfg.medaljonCount }).map((_, i) => {
            const m = medaljoniSorted[i] ?? null;
            const required = (i + 1) * 10;
            const unlocked = m
              ? completedCount >= m.posAfterRedoslijed
              : completedCount >= required;
            const earned = m ? osvojeniSet.has(m.id) : false;
            return (
              <MedaljonHex
                key={m?.id ?? `slot-${i}`}
                broj={required}
                state={earned ? "earned" : unlocked ? "unlocked" : "locked"}
                onClick={() => m && unlocked && setLocation(`/ilmihal/medaljon-nivo${nivo}-${required}`)}
                title={
                  m
                    ? t("{naziv} — {required} lekcija", { naziv: m.naziv, required: String(required) })
                    : t("Otključava se na {required} lekcija", { required: String(required) })
                }
                testId={`mapa-medaljon-top-${i + 1}`}
              />
            );
          })}
        </div>

        <button
          onClick={() => setLocation("/ilmihal")}
          className="flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white hover:bg-amber-50 shadow flex items-center justify-center text-amber-900 active:scale-95 transition"
          data-testid="button-close-mapa"
          aria-label={t("Zatvori mapu")}
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3} />
        </button>
      </div>

      {/* BOARD: centralna kolona — uska na mobilnom, šira na desktopu.
          Visina se rasteže da popuni cijeli ekran kad ima mjesta (desktop),
          ili raste sa redovima kad ih ima više nego ekran može da prikaže. */}
      <div
        className="relative mx-auto max-w-sm sm:max-w-md md:max-w-xl px-3 pt-2 pb-4 flex flex-col"
        style={{ minHeight: "calc(100vh - 4rem)" }}
      >
        <div className="relative flex-1 flex flex-col">
          <PathSvg
            rowColFor={rowColFor}
            displayRowFor={displayRowFor}
            displayRowForMedaljon={displayRowForMedaljon}
            totalCells={TOTAL_CELLS}
            totalRows={TOTAL_ROWS}
            medCount={MED_COUNT}
          />
          <div
            className="relative grid items-center flex-1"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${TOTAL_ROWS}, minmax(96px, 1fr))`,
              minHeight: `${TOTAL_ROWS * 100}px`,
            }}
          >
            {/* Vrata: prazno mjesto na vrhu (samo ako nivo ima sljedeći). */}
            {doorTarget && (
              <button
                key="vrata"
                data-cell-index="door"
                onClick={() => doorEnabled && doorTarget && setLocation(doorTarget)}
                disabled={!doorEnabled}
                className="relative flex items-center justify-center disabled:cursor-not-allowed"
                style={{ gridRow: doorDisplayRow + 1, gridColumn: doorCol + 1 }}
                data-testid="mapa-polje-vrata"
                title={
                  doorEnabled
                    ? doorLabel
                    : !lessonsAllDone
                      ? t("Završi sve lekcije da otključaš")
                      : t("Položi sve etape da otključaš")
                }
              >
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 transition-transform active:scale-95 hover:scale-105">
                  {doorEnabled && (
                    <span className="absolute inset-0 rounded-full bg-amber-300/50 animate-ping" />
                  )}
                  <img
                    src={
                      doorEnabled
                        ? "/images/mapa/vrata-otvorena.png"
                        : "/images/mapa/vrata-zatvorena.png"
                    }
                    alt={doorEnabled ? t("{doorLabel} — otvorena", { doorLabel }) : t("{doorLabel} — zaključana", { doorLabel })}
                    className={`relative w-full h-full object-contain drop-shadow-md ${
                      doorEnabled ? "animate-pulse" : "opacity-80 grayscale-[40%]"
                    }`}
                  />
                  {krunisanjePolozeno && (
                    <span
                      className="absolute -top-1 -right-1 text-base sm:text-lg"
                      aria-label={t("Krunisanje položeno")}
                      title={t("Krunisanje položeno")}
                    >
                      👑
                    </span>
                  )}
                </div>
              </button>
            )}

            {/* INLINE MEDALJONI — sami u svom redu, srednja kolona (col=3 u
                1-indexed CSS gridu). Klik vodi na "praznu lekciju" sa
                standardiziranim slug-om koji admin kreira u bazi. */}
            {Array.from({ length: MED_COUNT }).map((_, r) => {
              const required = (r + 1) * 10;
              const unlocked = isPrivilegedRole || completedCount >= required;
              // Opcija B: medaljon JESTE puna lekcija. Klik vodi na
              // `/ilmihal/medaljon-nivo{N}-{ord}` (ord = redni broj medaljona).
              // Završetak te lekcije osvaja medaljon i otključava sljedećih 10.
              const realMed = medaljoniSorted[r] ?? null;
              const earned = realMed ? osvojeniSet.has(realMed.id) : false;
              const state: "locked" | "unlocked" | "earned" = earned
                ? "earned"
                : unlocked
                  ? "unlocked"
                  : "locked";
              return (
                <div
                  key={`med-row-${r}`}
                  data-cell-index={`med-${r}`}
                  style={{
                    gridRow: displayRowForMedaljon(r) + 1,
                    gridColumn: 3,
                  }}
                  className="flex items-center justify-center"
                  data-testid={`mapa-inline-medaljon-${required}`}
                >
                  <MedaljonHex
                    broj={required}
                    state={state}
                    onClick={() => realMed && unlocked && setLocation(`/ilmihal/medaljon-nivo${nivo}-${required}`)}
                    title={
                      unlocked
                        ? realMed
                          ? t("{naziv} — Ponavljanje i završni ispit", { naziv: realMed.naziv })
                          : t("Medaljon {required}", { required: String(required) })
                        : t("Otključava se na {required} lekcija", { required: String(required) })
                    }
                    testId={`mapa-inline-medaljon-btn-${required}`}
                  />
                </div>
              );
            })}

            {Array.from({ length: TOTAL_CELLS }).map((_, i) => {
              const { logicalRow, col } = rowColFor(i);
              const displayRow = displayRowFor(logicalRow);
              const isCurrent = i === currentCellIndex;

              const lekcija = lekcijeSorted[i];
              const isLocked = !isLekcijaUnlocked({
                uvjetiIds: lekcija?.uvjetiIds ?? [],
                completedIds: zavrseneSet,
                isPrivileged: isPrivilegedRole,
                isGuest: isGuestLike,
                index: i,
              });
              if (!lekcija) {
                return (
                  <div
                    key={`empty-${i}`}
                    data-cell-index={i}
                    style={{ gridRow: displayRow + 1, gridColumn: col + 1 }}
                    className="flex items-center justify-center"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gray-300 ring-2 ring-gray-600" />
                  </div>
                );
              }
              const isDone = zavrseneSet.has(lekcija.id);
              return (
                <button
                  key={`l-${lekcija.id}`}
                  data-cell-index={i}
                  onClick={() => {
                    if (isLocked) {
                      setLockedPopup(lekcija);
                    } else {
                      setLocation(`/ilmihal/${lekcija.slug}`);
                    }
                  }}
                  className="relative flex items-center justify-center"
                  style={{ gridRow: displayRow + 1, gridColumn: col + 1 }}
                  data-testid={`mapa-polje-lekcija-${lekcija.id}`}
                  title={isLocked ? t("Zaključano") : lekcija.naslov}
                >
                  <div className="relative">
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full bg-amber-300 animate-ping opacity-70" />
                    )}
                    <div
                      className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-black text-lg sm:text-2xl shadow-lg transition-transform ${
                        isDone
                          ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 ring-2 ring-amber-800 active:scale-95 hover:scale-110"
                          : isCurrent
                            ? "bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-950 ring-4 ring-white active:scale-95 hover:scale-110"
                            : isLocked
                              ? "bg-gray-300 text-gray-800 ring-2 ring-gray-700"
                              : "bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-950 ring-2 ring-amber-800 active:scale-95 hover:scale-110"
                      }`}
                      style={{
                        textShadow: isLocked
                          ? "none"
                          : "0 1px 0 rgba(255,255,255,0.6), 0 -1px 0 rgba(120,53,15,0.25)",
                      }}
                    >
                      {i + 1}
                    </div>
                    {isDone && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center shadow-md z-10"
                        aria-label={t("Završeno")}
                      >
                        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" strokeWidth={4} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {currentCellIndex >= 0 && (
            <BeeOnGrid
              currentIndex={currentCellIndex}
              rowColFor={rowColFor}
              displayRowFor={displayRowFor}
              totalRows={TOTAL_ROWS}
            />
          )}
        </div>
      </div>

      {/* Popup za zaključanu lekciju — pokazuje preduvjete učeniku */}
      {lockedPopup && (() => {
        const preduvjetiNazivi = (lockedPopup.uvjetiIds ?? [])
          .map((id) => lekcijeSorted.find((l) => l.id === id))
          .filter(Boolean) as Lekcija[];
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setLockedPopup(null)}
          >
            {/* Pozadinska maglica */}
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 32 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Zaglavlje */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{t("Zaključana lekcija")}</p>
                  <h3 className="font-extrabold text-foreground leading-tight">{lockedPopup.naslov}</h3>
                </div>
                <button
                  onClick={() => setLockedPopup(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {preduvjetiNazivi.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("Da bi otključao/la ovu lekciju, prvo završi:")}
                  </p>
                  <ul className="space-y-2">
                    {preduvjetiNazivi.map((l) => {
                      const done = zavrseneSet.has(l.id);
                      return (
                        <li key={l.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold ${done ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                          <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {done
                              ? <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" strokeWidth={3} /></span>
                              : <ChamomileSvg size={20} />
                            }
                          </span>
                          {l.naslov}
                        </li>
                      );
                    })}
                  </ul>
                  {preduvjetiNazivi.every((l) => zavrseneSet.has(l.id)) && (
                    <p className="mt-3 text-xs text-center text-emerald-700 font-bold">
                      ✅ {t("Sve preduvjetne lekcije su završene!")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("Ova lekcija je trenutno zaključana.")}
                </p>
              )}
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Heksagonalni medaljon (bee/honey tema) ──────────────────────────────
function MedaljonHex({
  broj,
  state,
  onClick,
  title,
  testId,
}: {
  broj: number;
  state: "locked" | "unlocked" | "earned";
  onClick: () => void;
  title: string;
  testId: string;
}) {
  const gradId = `hex-grad-${broj}-${state}`;
  return (
    <button
      onClick={onClick}
      disabled={state === "locked"}
      title={title}
      className="relative flex items-center justify-center group disabled:cursor-not-allowed"
      data-testid={testId}
    >
      <svg
        viewBox="0 0 100 110"
        className={`w-9 h-10 sm:w-12 sm:h-14 transition-transform drop-shadow ${
          state !== "locked" ? "group-hover:scale-110 group-active:scale-95" : ""
        }`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            {state === "earned" ? (
              <>
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="40%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#a16207" />
              </>
            ) : state === "unlocked" ? (
              <>
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#92400e" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#e5e7eb" />
                <stop offset="100%" stopColor="#6b7280" />
              </>
            )}
          </linearGradient>
        </defs>
        {/* Vanjski heksagon (zlatni ram) */}
        <polygon
          points="50,4 92,28 92,77 50,101 8,77 8,28"
          fill={`url(#${gradId})`}
          stroke={state === "locked" ? "#374151" : "#78350f"}
          strokeWidth="3"
        />
        {/* Unutrašnji heksagon (medeno polje) */}
        <polygon
          points="50,18 80,33 80,72 50,87 20,72 20,33"
          fill={
            state === "earned"
              ? "#fef3c7"
              : state === "unlocked"
                ? "#fde68a"
                : "#9ca3af"
          }
          stroke={state === "locked" ? "#4b5563" : "#b45309"}
          strokeWidth="1.5"
        />
        {/* Broj ili upitnik */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontWeight="900"
          fontSize="32"
          fill={state === "locked" ? "#374151" : "#78350f"}
          fontFamily="system-ui, sans-serif"
        >
          {state === "locked" ? "?" : broj}
        </text>
      </svg>
      {state === "earned" && (
        <Sparkles className="absolute -top-1 -right-0 w-3 h-3 sm:w-4 sm:h-4 text-yellow-200 drop-shadow animate-pulse" />
      )}
    </button>
  );
}

// ─── Snake path (bottom-up) ──────────────────────────────────────────────
function PathSvg({
  rowColFor,
  displayRowFor,
  displayRowForMedaljon,
  totalCells,
  totalRows,
  medCount,
}: {
  rowColFor: (i: number) => { logicalRow: number; col: number };
  displayRowFor: (lr: number) => number;
  displayRowForMedaljon: (r: number) => number;
  totalCells: number;
  totalRows: number;
  medCount: number;
}) {
  const points: string[] = [];
  for (let i = 0; i < totalCells; i++) {
    const { logicalRow, col } = rowColFor(i);
    const displayRow = displayRowFor(logicalRow);
    const xPct = ((col + 0.5) / COLS) * 100;
    const yPct = ((displayRow + 0.5) / totalRows) * 100;
    points.push(`${xPct},${yPct}`);
    // Nakon svake 10. lekcije ubaci medaljon-tačku (srednja kolona) prije
    // sljedeće lekcije — tako linija prolazi kroz medaljon.
    const medIdx = (i + 1) / 10 - 1;
    if (Number.isInteger(medIdx) && medIdx < medCount && i + 1 < totalCells) {
      const medX = ((2 + 0.5) / COLS) * 100;
      const medY = ((displayRowForMedaljon(medIdx) + 0.5) / totalRows) * 100;
      points.push(`${medX},${medY}`);
    }
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* Dvostruki stroke za bolju vidljivost: tamno-zlatni okvir + svijetla žuta sredina. */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#92400e"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#fde047"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Pčela ───────────────────────────────────────────────────────────────
function BeeOnGrid({
  currentIndex,
  rowColFor,
  displayRowFor,
  totalRows,
}: {
  currentIndex: number;
  rowColFor: (i: number) => { logicalRow: number; col: number };
  displayRowFor: (lr: number) => number;
  totalRows: number;
}) {
  const { logicalRow, col } = rowColFor(currentIndex);
  const displayRow = displayRowFor(logicalRow);
  const xPct = ((col + 0.5) / COLS) * 100;
  const yPct = ((displayRow + 0.5) / totalRows) * 100;
  return (
    <motion.div
      className="absolute pointer-events-none z-20"
      initial={false}
      animate={{ left: `${xPct}%`, top: `${yPct}%` }}
      transition={{ type: "spring", stiffness: 60, damping: 14 }}
      style={{ transform: "translate(-50%, -130%)" }}
      data-testid="mapa-pcela"
    >
      <motion.div
        animate={{ y: [0, -6, 0, -3, 0], rotate: [-3, 3, -3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
          <ellipse cx="14" cy="18" rx="9" ry="6" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.2)" />
          <ellipse cx="34" cy="18" rx="9" ry="6" fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.2)" />
          <ellipse cx="24" cy="26" rx="11" ry="9" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          <rect x="14" y="22" width="20" height="3" fill="#78350f" />
          <rect x="14" y="28" width="20" height="3" fill="#78350f" />
          <circle cx="35" cy="24" r="4" fill="#78350f" />
          <circle cx="36" cy="23" r="1" fill="#fff" />
        </svg>
      </motion.div>
    </motion.div>
  );
}
