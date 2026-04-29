import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = `${import.meta.env.BASE_URL}images/maskota`;

export type MaskotaVarijanta = "bravo" | "pozdrav" | "knjiga" | "prazno";

// Trenutno svaka varijanta koristi istu sliku — pčela sa ruksakom i knjigom je
// dovoljno ekspresivna i ide uz sve kontekste (učenje, pozdrav, pohvala, prazna stanja).
// Različite poze možemo dodati kasnije bez mijenjanja konzumera.
const SRC: Record<MaskotaVarijanta, string> = {
  bravo: `${BASE}/pcela.png`,
  pozdrav: `${BASE}/pcela.png`,
  knjiga: `${BASE}/pcela.png`,
  prazno: `${BASE}/pcela.png`,
};

const ALT: Record<MaskotaVarijanta, string> = {
  bravo: "Maskota pčela slavi tvoj uspjeh",
  pozdrav: "Maskota pčela pozdravlja",
  knjiga: "Maskota pčela sa knjigom",
  prazno: "Maskota pčela",
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
  /** Funkcija koja iz širine viewporta izračuna 5 X tačaka (od ulaska do izlaska). */
  x: (vw: number) => number[];
  /** 5 Y tačaka u px (relativno na vrh ekrana). */
  y: number[];
  /** 5 vrijednosti rotacije u stepenima. */
  rotate: number[];
  /** Vremenske čvorne tačke (0..1). */
  times: number[];
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
    duration: 5.4,
  },
  {
    // Donja, mirnija putanja — pčela krstari sredinom ekrana.
    x: (vw) => [-120, vw * 0.3, vw * 0.6, vw * 0.85, vw + 120],
    y: [360, 320, 390, 340, 380],
    rotate: [-5, 0, 3, -1, 4],
    times: [0, 0.25, 0.5, 0.78, 1],
    duration: 5.8,
  },
  {
    // Diagonala odozgo nadole — uđe visoko lijevo, izađe nisko desno.
    x: (vw) => [-120, vw * 0.28, vw * 0.55, vw * 0.82, vw + 120],
    y: [180, 250, 320, 400, 460],
    rotate: [4, 8, 12, 9, 6],
    times: [0, 0.22, 0.48, 0.78, 1],
    duration: 5.0,
  },
  {
    // Diagonala odozdo nagore — uđe nisko lijevo, izađe visoko desno.
    x: (vw) => [-120, vw * 0.27, vw * 0.55, vw * 0.83, vw + 120],
    y: [440, 360, 280, 220, 170],
    rotate: [-12, -9, -6, -3, 0],
    times: [0, 0.22, 0.5, 0.78, 1],
    duration: 5.2,
  },
  {
    // Zig-zag — više valova, življa putanja.
    x: (vw) => [-120, vw * 0.22, vw * 0.42, vw * 0.62, vw * 0.82, vw + 120],
    y: [280, 220, 340, 230, 320, 260],
    rotate: [-6, 4, -5, 6, -4, 5],
    times: [0, 0.18, 0.38, 0.6, 0.82, 1],
    duration: 5.6,
  },
];

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
              opacity: [0, 1, 1, 1, 0, 0].slice(0, flight.traj.times.length),
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
                src={SRC.pozdrav}
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
