/**
 * Prilagođeni "Mektebnet" audio plejer.
 *
 * Nativni <audio controls> u nekim browserima (Chrome) pokazuje natpis
 * "Emitiranje uživo" / "Live broadcast" za fajlove čije trajanje nije poznato,
 * a taj se tekst ne može promijeniti niti se nativni kontroler može pouzdano
 * centrirati/stilizovati. Zato nativni kontroler zamjenjujemo vlastitim:
 * centriran, responzivan, s fiksnim natpisom "Mektebnet".
 *
 * Koristi se na dvije render-staze:
 *   - učenički prikaz lekcije (RjecnikContent → enhanceAllAudioPlayers),
 *   - Tiptap editor (AudioBlock NodeView → buildAudioPlayer).
 */

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Wrappa postojeći <audio> element u Mektebnet plejer. Idempotentno —
 * već obrađeni elementi se preskaču. Vraća wrapper element (ili null).
 */
export function enhanceAudioPlayer(
  audio: HTMLAudioElement | null,
): HTMLElement | null {
  if (!audio) return null;
  if (audio.dataset.mektebAudio === "1") {
    return audio.closest<HTMLElement>(".mekteb-audio");
  }
  audio.dataset.mektebAudio = "1";
  audio.removeAttribute("controls");
  audio.preload = "metadata";

  const wrap = document.createElement("div");
  wrap.className = "mekteb-audio";

  const play = document.createElement("button");
  play.type = "button";
  play.className = "mekteb-audio__play";
  play.setAttribute("aria-label", "Pusti ili pauziraj");
  play.innerHTML = PLAY_ICON;

  const body = document.createElement("div");
  body.className = "mekteb-audio__body";

  const label = document.createElement("div");
  label.className = "mekteb-audio__label";
  label.textContent = "Mektebnet";

  const bar = document.createElement("div");
  bar.className = "mekteb-audio__bar";
  bar.setAttribute("role", "slider");
  bar.setAttribute("aria-label", "Pozicija u snimku");

  const progress = document.createElement("div");
  progress.className = "mekteb-audio__progress";
  bar.appendChild(progress);
  body.appendChild(label);
  body.appendChild(bar);

  const time = document.createElement("div");
  time.className = "mekteb-audio__time";
  time.textContent = "0:00";

  // Umetni wrapper na mjesto audio elementa, pa premjesti audio unutar njega.
  const parent = audio.parentNode;
  if (parent) parent.insertBefore(wrap, audio);
  wrap.appendChild(play);
  wrap.appendChild(body);
  wrap.appendChild(time);
  wrap.appendChild(audio);
  audio.hidden = true;
  audio.style.display = "none";

  let durationKnown = false;
  const showDuration = () => {
    if (isFinite(audio.duration) && audio.duration > 0) {
      durationKnown = true;
      time.textContent = `0:00 / ${fmt(audio.duration)}`;
    }
  };

  const handleMetadata = () => {
    // Neki streamovani/VBR MP3 fajlovi prijave duration=Infinity dok se ne
    // pređe kroz cijeli fajl. Trik: skoči na ogroman currentTime da browser
    // izračuna stvarno trajanje, pa vrati nazad na početak.
    if (!isFinite(audio.duration)) {
      const onSeek = () => {
        audio.removeEventListener("timeupdate", onSeek);
        try {
          audio.currentTime = 0;
        } catch {
          /* noop */
        }
        showDuration();
      };
      audio.addEventListener("timeupdate", onSeek);
      try {
        audio.currentTime = 1e101;
      } catch {
        /* noop */
      }
    } else {
      showDuration();
    }
  };
  audio.addEventListener("loadedmetadata", handleMetadata);
  // Ako su metapodaci već učitani (keširan audio) prije nego smo zakačili
  // listener, "loadedmetadata" se neće ponovo okinuti — pokreni ručno da
  // seek/trajanje ne ostanu trajno onemogućeni.
  if (audio.readyState >= 1) handleMetadata();

  const update = () => {
    const cur = audio.currentTime || 0;
    if (durationKnown && audio.duration > 0) {
      progress.style.width = `${Math.min(100, (cur / audio.duration) * 100)}%`;
      time.textContent = `${fmt(cur)} / ${fmt(audio.duration)}`;
    } else {
      time.textContent = fmt(cur);
    }
  };
  audio.addEventListener("timeupdate", update);

  const setPlaying = (playing: boolean) => {
    play.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    wrap.classList.toggle("is-playing", playing);
  };
  audio.addEventListener("play", () => setPlaying(true));
  audio.addEventListener("pause", () => setPlaying(false));
  audio.addEventListener("ended", () => {
    setPlaying(false);
    progress.style.width = "0%";
  });

  play.addEventListener("click", (e) => {
    e.preventDefault();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  const seek = (clientX: number) => {
    if (!durationKnown || !(audio.duration > 0)) return;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    try {
      audio.currentTime = ratio * audio.duration;
    } catch {
      /* noop */
    }
    update();
  };
  bar.addEventListener("click", (e) => seek(e.clientX));

  return wrap;
}

/** Wrappa sve <audio> elemente unutar datog kontejnera. */
export function enhanceAllAudioPlayers(container: HTMLElement | null): void {
  if (!container) return;
  container
    .querySelectorAll<HTMLAudioElement>("audio")
    .forEach((a) => enhanceAudioPlayer(a));
}

/**
 * Kreira novi Mektebnet plejer za zadati src. Koristi se u Tiptap NodeView-u
 * (editor). Uvijek vraća .mekteb-audio wrapper element.
 */
export function buildAudioPlayer(
  src: string | null | undefined,
  _title?: string | null,
): HTMLElement {
  const audio = document.createElement("audio");
  if (src) audio.src = src;
  audio.className = "lesson-audio";
  audio.preload = "metadata";

  // Privremeni parent da enhancer ima parentNode za insertBefore.
  const holder = document.createElement("div");
  holder.appendChild(audio);
  const player = enhanceAudioPlayer(audio);
  return player ?? holder;
}
