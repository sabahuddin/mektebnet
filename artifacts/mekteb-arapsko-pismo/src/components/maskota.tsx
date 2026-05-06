import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
  /** Funkcija koja iz širine i visine viewporta izračuna X tačke. */
  x: (vw: number, vh: number) => number[];
  /** Funkcija koja iz širine i visine viewporta izračuna Y tačke. */
  y: (vw: number, vh: number) => number[];
  /** Vrijednosti rotacije u stepenima (prati smjer leta). */
  rotate: number[];
  /** Horizontalno zrcaljenje pčele: -1 za let zdesna nalijevo. */
  scaleX?: 1 | -1;
  /** Vremenske čvorne tačke (0..1). Duplirane susjedne tačke = pauza. */
  times: number[];
  /** Per-frame opacity (0/1) — kontroliše ulaz i izlaz. */
  opacity: number[];
  /** Trajanje cijelog leta u sekundama. */
  duration: number;
};

const TRAJECTORIES: FlightTrajectory[] = [
  {
    // 1. Lijevo→desno, gornji dio ekrana, blagi luk.
    x: (vw) => [-120, vw * 0.25, vw * 0.55, vw * 0.8, vw + 120],
    y: (_, vh) => [vh * 0.18, vh * 0.12, vh * 0.22, vh * 0.15, vh * 0.2],
    rotate: [-8, -3, 4, -2, 6],
    times: [0, 0.2, 0.5, 0.8, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.4,
  },
  {
    // 2. Lijevo→desno, donji dio ekrana, mirna putanja.
    x: (vw) => [-120, vw * 0.3, vw * 0.6, vw * 0.85, vw + 120],
    y: (_, vh) => [vh * 0.78, vh * 0.7, vh * 0.85, vh * 0.74, vh * 0.82],
    rotate: [-5, 0, 3, -1, 4],
    times: [0, 0.25, 0.5, 0.78, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.8,
  },
  {
    // 3. Velika dijagonala — gornji-lijevi ćošak → donji-desni ćošak.
    x: (vw) => [-120, vw * 0.28, vw * 0.6, vw + 120],
    y: (_, vh) => [vh * 0.1, vh * 0.4, vh * 0.7, vh * 0.95],
    rotate: [12, 18, 24, 30],
    times: [0, 0.32, 0.66, 1],
    opacity: [0, 1, 1, 0],
    duration: 5.6,
  },
  {
    // 4. Velika dijagonala — donji-lijevi ćošak → gornji-desni ćošak.
    x: (vw) => [-120, vw * 0.3, vw * 0.65, vw + 120],
    y: (_, vh) => [vh * 0.92, vh * 0.6, vh * 0.3, vh * 0.05],
    rotate: [-12, -18, -22, -28],
    times: [0, 0.3, 0.65, 1],
    opacity: [0, 1, 1, 0],
    duration: 5.6,
  },
  {
    // 5. Lijevo→desno, zig-zag preko cijele visine.
    x: (vw) => [-120, vw * 0.22, vw * 0.42, vw * 0.62, vw * 0.82, vw + 120],
    y: (_, vh) => [vh * 0.5, vh * 0.2, vh * 0.7, vh * 0.25, vh * 0.65, vh * 0.4],
    rotate: [-6, 14, -12, 14, -10, 6],
    times: [0, 0.18, 0.38, 0.6, 0.82, 1],
    opacity: [0, 1, 1, 1, 1, 0],
    duration: 6.2,
  },
  {
    // 6. Lijevo→desno, ZASTAJANJE u centru — pčela lebdi ~2.5s prije nego što odleti.
    x: (vw) => [-120, vw * 0.32, vw * 0.5, vw * 0.5, vw * 0.78, vw + 120],
    y: (_, vh) => [vh * 0.4, vh * 0.45, vh * 0.5, vh * 0.5, vh * 0.4, vh * 0.5],
    rotate: [-6, -2, 0, 0, 4, 8],
    times: [0, 0.15, 0.3, 0.62, 0.85, 1],
    opacity: [0, 1, 1, 1, 1, 0],
    duration: 8.5,
  },
  {
    // 7. DESNO→LIJEVO, gornji dio (pčela zrcaljena).
    x: (vw) => [vw + 120, vw * 0.75, vw * 0.45, vw * 0.2, -120],
    y: (_, vh) => [vh * 0.22, vh * 0.16, vh * 0.28, vh * 0.18, vh * 0.24],
    rotate: [8, 3, -4, 2, -6],
    scaleX: -1,
    times: [0, 0.22, 0.5, 0.78, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.6,
  },
  {
    // 8. DESNO→LIJEVO, srednji dio, sa ZASTAJANJEM negdje desno od centra.
    x: (vw) => [vw + 120, vw * 0.7, vw * 0.55, vw * 0.55, vw * 0.25, -120],
    y: (_, vh) => [vh * 0.55, vh * 0.5, vh * 0.48, vh * 0.48, vh * 0.6, vh * 0.5],
    rotate: [6, 2, 0, 0, -4, -8],
    scaleX: -1,
    times: [0, 0.18, 0.32, 0.62, 0.84, 1],
    opacity: [0, 1, 1, 1, 1, 0],
    duration: 9,
  },
  {
    // 9. ODOZGO PREMA DOLE — pčela se spušta sa vrha ekrana (rotacija 90°, leti glavom dolje).
    x: (vw) => [vw * 0.7, vw * 0.65, vw * 0.74, vw * 0.66, vw * 0.7],
    y: (_, vh) => [-120, vh * 0.25, vh * 0.55, vh * 0.8, vh + 120],
    rotate: [78, 88, 92, 88, 96],
    times: [0, 0.25, 0.5, 0.75, 1],
    opacity: [0, 1, 1, 1, 0],
    duration: 5.4,
  },
  {
    // 10. ODOZDO PREMA GORE sa pauzom — penje se sa dna, zastane na sredini, nastavi ka vrhu.
    x: (vw) => [vw * 0.28, vw * 0.32, vw * 0.3, vw * 0.3, vw * 0.34, vw * 0.28],
    y: (_, vh) => [vh + 120, vh * 0.7, vh * 0.5, vh * 0.5, vh * 0.25, -120],
    rotate: [-95, -88, -82, -82, -88, -96],
    times: [0, 0.2, 0.38, 0.65, 0.85, 1],
    opacity: [0, 1, 1, 1, 1, 0],
    duration: 8.8,
  },
];


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
            initial={{ opacity: 0, scale: 0.5, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            style={{
              position: "absolute",
              left: "50%",
              top: centerY - 10,
              transform: "translateX(-50%) translateY(-100%)",
            }}
            className="bg-white rounded-3xl shadow-2xl border-2 border-primary/20 px-8 py-5 max-w-sm text-center"
          >
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-2 border-b-2 border-primary/20 rotate-45 rounded-br-sm" />
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
  const [vh, setVh] = useState<number>(typeof window !== "undefined" ? window.innerHeight : 800);
  const lastTrajIdx = useRef<number>(-1);

  const reduce =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) return;
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    setFlight(null);
    const startTimer = setTimeout(() => {
      // Izaberi nasumičnu putanju koja nije ista kao prethodna — više raznolikosti.
      let idx = Math.floor(Math.random() * TRAJECTORIES.length);
      if (idx === lastTrajIdx.current && TRAJECTORIES.length > 1) {
        idx = (idx + 1 + Math.floor(Math.random() * (TRAJECTORIES.length - 1))) % TRAJECTORIES.length;
      }
      lastTrajIdx.current = idx;
      const traj = TRAJECTORIES[idx];
      setFlight((prev) => ({ id: (prev?.id ?? 0) + 1, traj }));
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
              x: flight.traj.x(vw, vh)[0],
              y: flight.traj.y(vw, vh)[0],
              opacity: 0,
              rotate: flight.traj.rotate[0],
            }}
            animate={{
              x: flight.traj.x(vw, vh),
              y: flight.traj.y(vw, vh),
              opacity: flight.traj.opacity,
              rotate: flight.traj.rotate,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: flight.traj.duration, ease: "easeInOut", times: flight.traj.times }}
            onAnimationComplete={() => setFlight(null)}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: size,
              height: size,
            }}
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
                style={{
                  width: size,
                  height: size,
                  transform: flight.traj.scaleX === -1 ? "scaleX(-1)" : undefined,
                }}
                className="object-contain select-none drop-shadow-md"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
