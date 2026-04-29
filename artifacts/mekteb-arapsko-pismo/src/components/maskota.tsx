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
export function FlyingMaskota() {
  const [location] = useLocation();
  const [flightId, setFlightId] = useState(0);
  const [active, setActive] = useState(false);
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
    setActive(false);
    const startTimer = setTimeout(() => {
      setFlightId((id) => id + 1);
      setActive(true);
    }, 350);
    return () => clearTimeout(startTimer);
  }, [location, reduce]);

  if (reduce) return null;

  const size = 56;
  const offscreenLeft = -120;
  const offscreenRight = vw + 120;
  const baseY = 80;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 pointer-events-none z-30 overflow-hidden"
      style={{ height: 220 }}
      data-testid="flying-maskota-container"
    >
      <AnimatePresence>
        {active && (
          <motion.div
            key={flightId}
            initial={{ x: offscreenLeft, y: baseY, opacity: 0, rotate: -8 }}
            animate={{
              x: [offscreenLeft, vw * 0.25, vw * 0.55, vw * 0.8, offscreenRight],
              y: [baseY, baseY - 35, baseY + 10, baseY - 25, baseY + 5],
              opacity: [0, 1, 1, 1, 0],
              rotate: [-8, -3, 4, -2, 6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 5.2, ease: "easeInOut", times: [0, 0.18, 0.5, 0.82, 1] }}
            onAnimationComplete={() => setActive(false)}
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
