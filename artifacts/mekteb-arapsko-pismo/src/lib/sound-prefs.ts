export const SOUND_PREF_KEY = "mekteb:soundEffectsEnabled";

export function getSoundEffectsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(SOUND_PREF_KEY);
    if (v === null) return true;
    return v === "true";
  } catch {
    return true;
  }
}

export function setSoundEffectsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, enabled ? "true" : "false");
  } catch {
    /* noop */
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let cachedAudio: HTMLAudioElement | null = null;
let cachedSrc: string | null = null;

export function playRewardSound(): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  if (!getSoundEffectsEnabled()) return;
  try {
    const base = import.meta.env.BASE_URL ?? "/";
    const src = `${base}sounds/reward.wav`;
    if (!cachedAudio || cachedSrc !== src) {
      cachedAudio = new Audio(src);
      cachedAudio.preload = "auto";
      cachedSrc = src;
    }
    cachedAudio.currentTime = 0;
    cachedAudio.volume = 0.7;
    const p = cachedAudio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* autoplay blocked or no user gesture — silently ignore */
      });
    }
  } catch {
    /* noop */
  }
}
