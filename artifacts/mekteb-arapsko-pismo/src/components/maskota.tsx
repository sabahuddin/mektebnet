import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = `${import.meta.env.BASE_URL}images/maskota`;

export type MaskotaVarijanta = "bravo" | "pozdrav" | "knjiga" | "prazno" | "letenje";

// Frontalna pčela (sa knjigom) za empty states / pozdrav / pohvale i bočna
// "leteća" pčela (profil pose, leti udesno) za animacije letenja preko ekrana.
// Bočna se koristi u SelamWelcome i FlyingMaskota — pčele zaista lete bočno,
// ne sa stomakom prema gledaocu.
const SRC: Record<MaskotaVarijanta, string> = {
  bravo: `${BASE}/pcela.png`,
  pozdrav: `${BASE}/pcela.png`,
  knjiga: `${BASE}/pcela.png`,
  prazno: `${BASE}/pcela.png`,
  letenje: `${BASE}/pcela-letenje.png`,
};

const ALT: Record<MaskotaVarijanta, string> = {
  bravo: "Maskota pčela slavi tvoj uspjeh",
  pozdrav: "Maskota pčela pozdravlja",
  knjiga: "Maskota pčela sa knjigom",
  prazno: "Maskota pčela",
  letenje: "Maskota pčela u letu",
};

interface MaskotaProps {
  varijanta?: MaskotaVarijanta;
  className?: string;
  size?: number;
  alt?: string;
}

export function Maskota({ varijanta = "pozdrav", className = "", size, alt }: MaskotaProps) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <img
      src={SRC[varijanta]}
      alt={alt ?? ALT[varijanta]}
      className={`object-contain select-none pointer-events-none ${className}`}
      style={style}
      loading="lazy"
      draggable={false}
      data-testid={`maskota-${varijanta}`}
    />
  );
}

interface MaskotaPrazanStateProps {
  varijanta?: MaskotaVarijanta;
  naslov: string;
  opis?: string;
  akcija?: React.ReactNode;
  size?: number;
  className?: string;
}

/** Empty/zero state sa maskotom. Koristi se gdje god nema podataka. */
export function MaskotaPrazanState({
  varijanta = "prazno",
  naslov,
  opis,
  akcija,
  size = 140,
  className = "",
}: MaskotaPrazanStateProps) {
  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-10 px-4 ${className}`}
      data-testid="maskota-prazan-state"
    >
      <motion.div
        initial={reduce ? false : { y: -6, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Maskota varijanta={varijanta} size={size} />
      </motion.div>
      <h3 className="mt-4 text-base sm:text-lg font-extrabold text-foreground" data-testid="text-maskota-naslov">
        {naslov}
      </h3>
      {opis && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md" data-testid="text-maskota-opis">
          {opis}
        </p>
      )}
      {akcija && <div className="mt-4">{akcija}</div>}
    </div>
  );
}

interface MaskotaCelebrationProps {
  poruka?: string;
  podporuka?: string;
  varijanta?: MaskotaVarijanta;
  size?: number;
  className?: string;
}

/**
 * Animirani prikaz maskote sa skok-ulazom — koristi se unutar Celebration overlay-a.
 * Subtilan bounce i wiggle, poštuje prefers-reduced-motion.
 */
export function MaskotaCelebration({
  poruka,
  podporuka,
  varijanta = "bravo",
  size = 140,
  className = "",
}: MaskotaCelebrationProps) {
  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Pre-load (image već generated, ali da ne flash-a)
  useEffect(() => {
    const img = new Image();
    img.src = SRC[varijanta];
  }, [varijanta]);

  return (
    <div className={`flex flex-col items-center ${className}`} data-testid="maskota-celebration">
      <motion.div
        initial={reduce ? false : { scale: 0, rotate: -25, y: -10 }}
        animate={
          reduce
            ? undefined
            : { scale: 1, rotate: 0, y: 0 }
        }
        transition={{ type: "spring", stiffness: 320, damping: 14, delay: 0.05 }}
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        >
          <Maskota varijanta={varijanta} size={size} alt={poruka} />
        </motion.div>
      </motion.div>
      {poruka && (
        <p className="mt-3 text-xl font-extrabold text-foreground" data-testid="text-maskota-poruka">
          {poruka}
        </p>
      )}
      {podporuka && (
        <p className="mt-1 text-sm text-muted-foreground" data-testid="text-maskota-podporuka">
          {podporuka}
        </p>
      )}
    </div>
  );
}

/**
 * Mala pčela koja pri svakoj promjeni rute "preleti" preko ekrana.
 * - Ulazi sa lijeva, izlazi desno, sa blagim talasanjem gore-dolje.
 * - Pojavi se samo jednom po promjeni rute, sa kratkim odgađanjem.
 * - pointer-events: none — nikad ne blokira interakciju.
 * - Poštuje prefers-reduced-motion (potpuno se ne renderuje).
 */
type FlightTrajectory = {
  /** Funkcija koja iz širine viewporta izračuna X tačke (od ulaska do izlaska). */
  x: (vw: number) => number[];
  /** Y tačke u px (relativno na vrh ekrana). */
  y: number[];
  /** Vrijednosti rotacije u stepenima. */
  rotate: number[];
  /** Vremenske čvorne tačke (0..1). Duplirane susjedne tačke = pauza. */
  times: number[];
  /** Per-frame opacity (0/1) — kontroliše ulaz i izlaz. */
  opacity: number[];
  /** Trajanje cijelog leta u sekundama. */
  duration: number;
};

const TRAJECTORIES: FlightTrajectory[] = [
  {
    // Klasični luk preko gornjeg dijela — talasanje gore-dolje.
    x: (vw) => [-120, vw * 0.25, vw * 0.55, vw * 0.8, vw + 120],
    y: [220, 180, 250, 195, 235],
    rotate: [-8, -3, 4, -2, 6],
    times: [0, 0.2, 0.5, 0.8, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.4,
  },
  {
    // Donja, mirnija putanja — pčela krstari sredinom ekrana.
    x: (vw) => [-120, vw * 0.3, vw * 0.6, vw * 0.85, vw + 120],
    y: [360, 320, 390, 340, 380],
    rotate: [-5, 0, 3, -1, 4],
    times: [0, 0.25, 0.5, 0.78, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.8,
  },
  {
    // Diagonala odozgo nadole — uđe visoko lijevo, izađe nisko desno.
    x: (vw) => [-120, vw * 0.28, vw * 0.55, vw * 0.82, vw + 120],
    y: [180, 250, 320, 400, 460],
    rotate: [4, 8, 12, 9, 6],
    times: [0, 0.22, 0.48, 0.78, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.0,
  },
  {
    // Diagonala odozdo nagore — uđe nisko lijevo, izađe visoko desno.
    x: (vw) => [-120, vw * 0.27, vw * 0.55, vw * 0.83, vw + 120],
    y: [440, 360, 280, 220, 170],
    rotate: [-12, -9, -6, -3, 0],
    times: [0, 0.22, 0.5, 0.78, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.2,
  },
  {
    // Zig-zag — više valova, življa putanja.
    x: (vw) => [-120, vw * 0.22, vw * 0.42, vw * 0.62, vw * 0.82, vw + 120],
    y: [280, 220, 340, 230, 320, 260],
    rotate: [-6, 4, -5, 6, -4, 5],
    times: [0, 0.18, 0.38, 0.6, 0.82, 1],
    opacity: [0, 1, 1, 1, 1, 0],
    duration: 5.6,
  },
  {
    // PAUZA jednom — uđe lijevo, doleti do sredine, zastane ~2.5s lebdeći, pa odleti udesno.
    // Indeksi 2 i 3 imaju iste x/y → pauza dok times prelaze 0.30 → 0.62.
    x: (vw) => [-120, vw * 0.32, vw * 0.5, vw * 0.5, vw * 0.78, vw + 120],
    y: [260, 230, 250, 250, 220, 260],
    rotate: [-6, -2, 0, 0, 4, 8],
    times: [0, 0.15, 0.3, 0.62, 0.85, 1],
    opacity: [0, 1, 1, 1, 1, 0],
    duration: 8.5,
  },
  {
    // PAUZA dva puta — uđe, prva pauza @ ~30% širine, leti do ~65%, druga pauza, pa izađe.
    // Indeksi 2-3 = prva pauza, indeksi 4-5 = druga pauza.
    x: (vw) => [-120, vw * 0.2, vw * 0.34, vw * 0.34, vw * 0.66, vw * 0.66, vw * 0.86, vw + 120],
    y: [200, 240, 270, 270, 300, 300, 240, 210],
    rotate: [-9, -4, 0, 0, 4, 4, 8, 12],
    times: [0, 0.1, 0.22, 0.45, 0.58, 0.82, 0.92, 1],
    opacity: [0, 1, 1, 1, 1, 1, 1, 0],
    duration: 11,
  },
];

/**
 * Sintetski "bzzz" zvuk pčele preko Web Audio API-ja — sawtooth sa vibratom.
 * Bez audio fajla, vrlo subtilno (gain 0.035). Poštuje localStorage toggle
 * `mekteb-bee-sound` (default uključen) i autoplay policy (tiho fail-uje
 * dok korisnik ne interaguje sa stranicom).
 */
function playBeeBuzz(durationSec: number): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("mekteb-bee-sound") === "false") return;
  const AC: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  try {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    osc.type = "sawtooth";
    osc.frequency.value = 215;
    lfo.type = "sine";
    lfo.frequency.value = 17;
    lfoGain.gain.value = 28;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    const peak = 0.035;
    const fade = Math.min(0.45, durationSec * 0.15);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + fade);
    gain.gain.setValueAtTime(peak, now + Math.max(fade, durationSec - fade));
    gain.gain.linearRampToValueAtTime(0, now + durationSec);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + durationSec + 0.05);
    lfo.stop(now + durationSec + 0.05);
    osc.onended = () => {
      try {
        ctx.close();
      } catch {}
    };
  } catch {
    try {
      ctx.close();
    } catch {}
  }
}

type SelamPhase = "flying-in" | "hovering" | "cloud" | "flying-out" | "done";

export function SelamWelcome({ userName }: { userName?: string | null }) {
  const [phase, setPhase] = useState<SelamPhase>("done");
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 720);

  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) return;
    if (localStorage.getItem("mekteb-selam-disabled") === "true") return;
    const shown = sessionStorage.getItem("mekteb-selam-shown");
    if (shown) return;
    sessionStorage.setItem("mekteb-selam-shown", "1");
    setPhase("flying-in");

    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [reduce]);

  useEffect(() => {
    if (phase === "done" || phase === "flying-in") return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "hovering") {
      timer = setTimeout(() => setPhase("cloud"), 400);
    } else if (phase === "cloud") {
      timer = setTimeout(() => setPhase("flying-out"), 3500);
    } else if (phase === "flying-out") {
      timer = setTimeout(() => setPhase("done"), 1800);
    }
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "done" || reduce) return null;

  const name = userName || "";
  const greeting = name
    ? `Esselamu alejkum, ${name}!`
    : "Esselamu alejkum!";

  const beeSize = Math.min(180, vw * 0.22);
  const centerX = vw / 2 - beeSize / 2;
  const centerY = vh / 2 - beeSize / 2 - 40;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[60] overflow-hidden"
      data-testid="selam-welcome"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "flying-out" ? 0 : 0.25 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 bg-black"
      />

      <motion.div
        style={{ position: "absolute", width: beeSize, height: beeSize }}
        initial={{ x: -beeSize - 40, y: centerY + 80, rotate: 15, scale: 0.6 }}
        animate={
          phase === "flying-in"
            ? { x: centerX, y: centerY, rotate: 0, scale: 1, opacity: 1 }
            : phase === "hovering" || phase === "cloud"
            ? { x: centerX, y: centerY, rotate: 0, scale: 1, opacity: 1 }
            : { x: vw + 60, y: centerY - 60, rotate: -15, scale: 0.7, opacity: 0 }
        }
        transition={
          phase === "flying-in"
            ? { duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }
            : phase === "flying-out"
            ? { duration: 1.5, ease: [0.55, 0.06, 0.68, 0.19] }
            : { duration: 0.3 }
        }
        onAnimationComplete={() => {
          if (phase === "flying-in") setPhase("hovering");
        }}
      >
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: "100%", height: "100%" }}
        >
          <img
            src={SRC.letenje}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%" }}
            className="object-contain select-none drop-shadow-2xl"
          />
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {(phase === "cloud") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            style={{
              position: "absolute",
              left: "50%",
              top: centerY + beeSize + 10,
              transform: "translateX(-50%)",
            }}
            className="bg-white rounded-3xl shadow-2xl border-2 border-primary/20 px-8 py-5 max-w-sm text-center"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-l-2 border-t-2 border-primary/20 rotate-45 rounded-tl-sm" />
            <p className="text-xl sm:text-2xl font-extrabold text-primary leading-snug">{greeting}</p>
            <p className="text-base sm:text-lg text-muted-foreground font-bold mt-2">Idemo s Bismillom!</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FlyingMaskota() {
  const [location] = useLocation();
  const [flight, setFlight] = useState<{ id: number; traj: FlightTrajectory } | null>(null);
  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1280);

  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) return;
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    setFlight(null);
    const startTimer = setTimeout(() => {
      const traj = TRAJECTORIES[Math.floor(Math.random() * TRAJECTORIES.length)];
      setFlight((prev) => ({ id: (prev?.id ?? 0) + 1, traj }));
      playBeeBuzz(traj.duration);
    }, 350);
    return () => clearTimeout(startTimer);
  }, [location, reduce]);

  if (reduce) return null;

  const size = 56;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-30 overflow-hidden"
      data-testid="flying-maskota-container"
    >
      <AnimatePresence>
        {flight && (
          <motion.div
            key={flight.id}
            initial={{
              x: flight.traj.x(vw)[0],
              y: flight.traj.y[0],
              opacity: 0,
              rotate: flight.traj.rotate[0],
            }}
            animate={{
              x: flight.traj.x(vw),
              y: flight.traj.y,
              opacity: flight.traj.opacity,
              rotate: flight.traj.rotate,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: flight.traj.duration, ease: "easeInOut", times: flight.traj.times }}
            onAnimationComplete={() => setFlight(null)}
            style={{ position: "absolute", left: 0, top: 0, width: size, height: size }}
          >
            <motion.div
              animate={{ y: [0, -3, 0, -3, 0] }}
              transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: size, height: size }}
            >
              <img
                src={SRC.letenje}
                alt=""
                draggable={false}
                style={{ width: size, height: size }}
                className="object-contain select-none drop-shadow-md"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
