import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ayahAudioUrl, DEFAULT_RECITER_ID, reciterById } from "@/lib/quran";

export interface PlayItem {
  surah: number;
  numberInSurah: number;
}

export const ayahKey = (it: PlayItem) => `${it.surah}:${it.numberInSurah}`;

const RECITER_STORAGE_KEY = "mekteb.kuran.reciter";

/** Odabir učača sa perzistencijom u localStorage. */
export function useReciter() {
  const [reciterId, setReciterIdState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_RECITER_ID;
    return window.localStorage.getItem(RECITER_STORAGE_KEY) || DEFAULT_RECITER_ID;
  });
  const setReciterId = useCallback((id: string) => {
    setReciterIdState(id);
    try {
      window.localStorage.setItem(RECITER_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);
  return { reciterId, setReciterId };
}

/**
 * Audio engine za Kur'an reader. Radi nad uređenom listom ajeta (`items`);
 * auto-advance ide na sljedeći element liste, pa funkcioniše i za suru i za
 * Mushaf stranicu (više sura). Štiti se token-čuvarom od zastarjelih play()
 * poziva pri brzoj promjeni ajeta/sadržaja/učača.
 */
export function useQuranAudio(items: PlayItem[], reciterId: string) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatCount, setRepeatCount] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const activeKeyRef = useRef<string | null>(null);
  const repeatCountRef = useRef(1);
  const completedRef = useRef(0);
  const playbackRateRef = useRef(1);
  const itemsRef = useRef(items);
  const folderRef = useRef(reciterById(reciterId).folder);
  const playToken = useRef(0);

  repeatCountRef.current = repeatCount;
  playbackRateRef.current = playbackRate;
  itemsRef.current = items;
  folderRef.current = reciterById(reciterId).folder;

  const setActive = useCallback((k: string | null) => {
    activeKeyRef.current = k;
    setActiveKey(k);
  }, []);

  const playItem = useCallback(
    (it: PlayItem) => {
      const audio = audioRef.current;
      if (!audio) return;
      const token = ++playToken.current;
      completedRef.current = 0;
      audio.src = ayahAudioUrl(it.surah, it.numberInSurah, folderRef.current);
      audio.playbackRate = playbackRateRef.current;
      const k = ayahKey(it);
      setActive(k);
      audio.play().catch(() => {
        if (playToken.current === token) setIsPlaying(false);
      });
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-ayah-key="${k}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [setActive],
  );

  const handleEnded = useCallback(() => {
    const k = activeKeyRef.current;
    const list = itemsRef.current;
    if (!k) return;
    completedRef.current++;
    if (completedRef.current < repeatCountRef.current) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
      }
      return;
    }
    const idx = list.findIndex((i) => ayahKey(i) === k);
    if (idx >= 0 && idx < list.length - 1) {
      playItem(list[idx + 1]);
    } else {
      setIsPlaying(false);
      setActive(null);
    }
  }, [playItem, setActive]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
    } else if (activeKeyRef.current) {
      // isPlaying se vodi preko onPlay/onPause eventa (audioProps), pa nema
      // stale-state rizika ako se play() razriješi kasno.
      audio.play().catch(() => {});
    } else if (itemsRef.current[0]) {
      playItem(itemsRef.current[0]);
    }
  }, [playItem]);

  const stop = useCallback(() => {
    playToken.current++;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    completedRef.current = 0;
    setActive(null);
  }, [setActive]);

  const handleError = useCallback(() => {
    if (!activeKeyRef.current) return;
    setIsPlaying(false);
    toast({
      title: "Audio nije dostupan",
      description: "Učenje za ovaj ajet se trenutno ne može učitati.",
      variant: "destructive",
    });
  }, [toast]);

  // Promjena učača: ako nešto svira, ponovo postavi izvor i nastavi.
  useEffect(() => {
    const audio = audioRef.current;
    const k = activeKeyRef.current;
    if (!audio || !k) return;
    const cur = itemsRef.current.find((i) => ayahKey(i) === k);
    if (!cur) return;
    const wasPlaying = !audio.paused;
    const token = ++playToken.current;
    completedRef.current = 0;
    audio.src = ayahAudioUrl(cur.surah, cur.numberInSurah, reciterById(reciterId).folder);
    audio.playbackRate = playbackRateRef.current;
    if (wasPlaying) {
      audio.play().catch(() => {
        if (playToken.current === token) setIsPlaying(false);
      });
    }
  }, [reciterId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Promjena sadržaja (nova sura/stranica): resetuj reprodukciju.
  useEffect(() => {
    playToken.current++;
    const audio = audioRef.current;
    if (audio) audio.pause();
    setIsPlaying(false);
    completedRef.current = 0;
    setActive(null);
  }, [items, setActive]);

  // Cleanup na unmount: zaustavi audio i invalidiraj sve kasne play() pozive.
  useEffect(() => {
    return () => {
      playToken.current++;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);

  return {
    audioRef,
    activeKey,
    isPlaying,
    repeatCount,
    setRepeatCount,
    playbackRate,
    setPlaybackRate,
    playItem,
    togglePlay,
    stop,
    audioProps: {
      ref: audioRef,
      onEnded: handleEnded,
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onError: handleError,
      preload: "none" as const,
    },
  };
}
