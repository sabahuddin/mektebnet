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
  // Ne dozvoli browseru da sam odmah krene puniti izvor — `ensureSeekable()`
  // ispod prvo provjeri podržava li server HTTP Range. Tako izbjegavamo
  // dvostruko preuzimanje (browserov auto-load + naš probe).
  audio.preload = "none";

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
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuenow", "0");
  bar.tabIndex = 0;

  const track = document.createElement("div");
  track.className = "mekteb-audio__track";

  const progress = document.createElement("div");
  progress.className = "mekteb-audio__progress";
  track.appendChild(progress);

  const handle = document.createElement("div");
  handle.className = "mekteb-audio__handle";

  bar.appendChild(track);
  bar.appendChild(handle);
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
      wrap.classList.add("is-seekable");
      bar.setAttribute("aria-valuemax", String(Math.floor(audio.duration)));
      time.textContent = `${fmt(audio.currentTime || 0)} / ${fmt(audio.duration)}`;
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
  // Trajanje za neke fajlove postane poznato tek naknadno ("durationchange").
  audio.addEventListener("durationchange", showDuration);
  // Ako su metapodaci već učitani (keširan audio) prije nego smo zakačili
  // listener, "loadedmetadata" se neće ponovo okinuti — pokreni ručno da
  // seek/trajanje ne ostanu trajno onemogućeni.
  if (audio.readyState >= 1) handleMetadata();

  // ── Premotavanje (seek) fix ────────────────────────────────────────────────
  // Neki proxyji ispred produkcije (npr. Cloudflare) IGNORIŠU HTTP Range
  // zahtjeve i vrate cijeli fajl sa statusom 200 umjesto 206. Tada je
  // `audio.seekable` prazan pa SVAKO premotavanje vrati snimak na početak
  // (a nativni plejer prikaže "Emitiranje uživo" jer trajanje ostane nepoznato).
  //
  // Strategija: pošalji mali Range probe (2 bajta).
  //   • 206  → server poštuje Range; direktan (streaming) izvor je premotljiv.
  //   • 200  → Range ignorisan; tijelo tog odgovora JE cijeli fajl, pa ga
  //            iskoristimo kao blob i postavimo `blob:` URL kao izvor. Blob je
  //            uvijek potpuno premotljiv jer su podaci lokalni — bez servera.
  let blobUrl: string | null = null;
  const loadDirect = () => {
    audio.preload = "metadata";
    audio.load();
  };
  const ensureSeekable = async () => {
    const src = audio.getAttribute("src") || audio.currentSrc || "";
    if (!src || src.startsWith("blob:")) {
      loadDirect();
      return;
    }
    let probe: Response;
    try {
      probe = await fetch(src, { headers: { Range: "bytes=0-1" } });
    } catch {
      loadDirect(); // mreža/CORS — zadrži originalni izvor
      return;
    }
    // Range radi → streaming izvor je premotljiv; odbaci probe tijelo.
    if (probe.status === 206) {
      try {
        await probe.body?.cancel();
      } catch {
        /* noop */
      }
      loadDirect();
      return;
    }
    // 403/404/500… — ne pravi blob od greške.
    if (!probe.ok) {
      loadDirect();
      return;
    }
    const ct = probe.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      loadDirect();
      return;
    }
    // 200 → Range ignorisan; probe tijelo je cijeli fajl (jedno preuzimanje).
    let blob: Blob;
    try {
      blob = await probe.blob();
    } catch {
      loadDirect();
      return;
    }
    if (!blob.size) {
      loadDirect();
      return;
    }
    // Sačuvaj poziciju/stanje ako je korisnik već krenuo slušati direktan izvor
    // dok je preuzimanje teklo.
    const wasPlaying = !audio.paused && !audio.ended;
    const prevTime = audio.currentTime || 0;
    blobUrl = URL.createObjectURL(blob);
    // Zakači restore PRIJE postavljanja izvora — brzi "loadedmetadata" se inače
    // može okinuti prije nego stignemo dodati listener.
    if (wasPlaying || prevTime > 0) {
      const onMeta = () => {
        audio.removeEventListener("loadedmetadata", onMeta);
        if (prevTime > 0 && isFinite(audio.duration)) {
          try {
            audio.currentTime = Math.min(prevTime, audio.duration);
          } catch {
            /* noop */
          }
        }
        if (wasPlaying) audio.play().catch(() => {});
      };
      audio.addEventListener("loadedmetadata", onMeta);
    }
    audio.preload = "metadata";
    audio.src = blobUrl;
    audio.load();
  };
  void ensureSeekable();

  let dragging = false;
  const render = (cur: number) => {
    if (durationKnown && audio.duration > 0) {
      const pct = Math.min(100, Math.max(0, (cur / audio.duration) * 100));
      progress.style.width = `${pct}%`;
      handle.style.left = `${pct}%`;
      bar.setAttribute("aria-valuenow", String(Math.floor(cur)));
      time.textContent = `${fmt(cur)} / ${fmt(audio.duration)}`;
    } else {
      time.textContent = fmt(cur);
    }
  };
  const update = () => {
    // Dok korisnik prevlači, ne dozvoli da reprodukcija pregazi "preview".
    if (dragging) return;
    render(audio.currentTime || 0);
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
    handle.style.left = "0%";
    bar.setAttribute("aria-valuenow", "0");
  });

  play.addEventListener("click", (e) => {
    e.preventDefault();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  const ratioFromX = (clientX: number): number | null => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };
  // Vizuelni "preview" tokom prevlačenja — ne diramo audio.currentTime dok ne
  // pustimo, da reprodukcija ne "trza".
  const previewAt = (clientX: number) => {
    if (!durationKnown || !(audio.duration > 0)) return;
    const r = ratioFromX(clientX);
    if (r === null) return;
    render(r * audio.duration);
  };
  const commitAt = (clientX: number) => {
    if (!durationKnown || !(audio.duration > 0)) return;
    const r = ratioFromX(clientX);
    if (r === null) return;
    try {
      audio.currentTime = r * audio.duration;
    } catch {
      /* noop */
    }
  };
  // Pointer Events pokrivaju i miš i dodir (tableti) jednim kodom; HTML5 drag
  // ne radi pouzdano na touch uređajima. Običan tap = pointerdown + pointerup
  // na istom mjestu, pa i to premota.
  bar.addEventListener("pointerdown", (e) => {
    if (!durationKnown || !(audio.duration > 0)) return;
    dragging = true;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    e.preventDefault();
    previewAt(e.clientX);
  });
  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    previewAt(e.clientX);
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try {
      bar.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    commitAt(e.clientX);
    render(audio.currentTime || 0);
  };
  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);
  // Tipkovnica (role="slider"): strelice ±5s, Home/End na početak/kraj.
  bar.addEventListener("keydown", (e) => {
    if (!durationKnown || !(audio.duration > 0)) return;
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = 5;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -5;
    else if (e.key === "Home") delta = -1e9;
    else if (e.key === "End") delta = 1e9;
    else return;
    e.preventDefault();
    const next = Math.min(
      audio.duration,
      Math.max(0, (audio.currentTime || 0) + delta),
    );
    try {
      audio.currentTime = next;
    } catch {
      /* noop */
    }
    render(next);
  });

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
