/**
 * Globalni "mute all" toggle. Stanje se čuva u localStorage pod ključem
 * `mekteb-audio-muted` i sinhronizovano se primjenjuje na:
 *   - sve <audio> i <video> elemente (postojeće i nove preko MutationObserver-a),
 *   - sve `new Audio(...)` instance (preko patch-a na HTMLMediaElement.prototype.play),
 *   - YouTube embed iframe-ove preko postMessage IFrame API-ja
 *     (zahtijeva `?enablejsapi=1` na embed URL-u).
 *
 * Pčelin "bzzz" i `playRewardSound()` dodatno provjeravaju `isAudioMuted()`
 * kako uopšte ne bi pravili Audio instancu kad je mute uključen.
 */

const KEY = "mekteb-audio-muted";
const listeners = new Set<(muted: boolean) => void>();
let installed = false;

export function isAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, muted ? "true" : "false");
  } catch {
    /* noop */
  }
  applyToAllMedia(muted);
  listeners.forEach((fn) => {
    try {
      fn(muted);
    } catch {
      /* noop */
    }
  });
}

export function subscribeAudioMuted(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function isYouTubeIframe(iframe: HTMLIFrameElement): boolean {
  const src = iframe.src || "";
  return /(?:youtube\.com|youtube-nocookie\.com|youtu\.be)/.test(src);
}

function postYouTube(iframe: HTMLIFrameElement, func: string): void {
  try {
    iframe.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*",
    );
  } catch {
    /* noop */
  }
}

function applyToAllMedia(muted: boolean): void {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
    el.muted = muted;
    if (muted) {
      try {
        el.pause();
      } catch {
        /* noop */
      }
    }
  });
  document.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
    if (!isYouTubeIframe(iframe)) return;
    postYouTube(iframe, muted ? "mute" : "unMute");
    if (muted) postYouTube(iframe, "pauseVideo");
  });
}

export function installAudioMute(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function patchedPlay(this: HTMLMediaElement) {
    if (isAudioMuted()) {
      this.muted = true;
    }
    return origPlay.apply(this, arguments as unknown as []);
  };

  const observer = new MutationObserver((muts) => {
    if (!isAudioMuted()) return;
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLMediaElement) {
          n.muted = true;
        } else if (n instanceof HTMLIFrameElement) {
          if (isYouTubeIframe(n)) {
            const iframe = n;
            const tryMute = (delay: number) =>
              window.setTimeout(() => postYouTube(iframe, "mute"), delay);
            tryMute(800);
            tryMute(2000);
          }
        } else if (n instanceof Element) {
          n.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
            el.muted = true;
          });
          n.querySelectorAll<HTMLIFrameElement>("iframe").forEach((iframe) => {
            if (!isYouTubeIframe(iframe)) return;
            const cap = iframe;
            window.setTimeout(() => postYouTube(cap, "mute"), 800);
            window.setTimeout(() => postYouTube(cap, "mute"), 2000);
          });
        }
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  applyToAllMedia(isAudioMuted());
}
