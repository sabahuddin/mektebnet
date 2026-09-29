import { useCallback, useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "ready" | "permission" | "listening" | "stopping" | "done" | "error";
type WorkerMessage =
  | { type: "ready" }
  | { type: "match"; ayah: number }
  | { type: "stopped" }
  | { type: "error"; message: string };

const INPUT_CHUNK_SIZE = 12_800; // 0,8 s @ 16 kHz
const TARGET_RATE = 16_000;

export function useFatihaVoice() {
  const [state, setState] = useState<State>("idle");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const mediaRef = useRef<{
    stream: MediaStream;
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    flush: () => void;
  } | null>(null);
  const stateRef = useRef<State>("idle");
  const mountedRef = useRef(true);

  const changeState = useCallback((value: State) => {
    stateRef.current = value;
    if (mountedRef.current) setState(value);
  }, []);

  const releaseMicrophone = useCallback((flush = false) => {
    const media = mediaRef.current;
    mediaRef.current = null;
    if (!media) return;
    if (flush) media.flush();
    media.processor.onaudioprocess = null;
    media.source.disconnect();
    media.processor.disconnect();
    media.stream.getTracks().forEach((track) => track.stop());
    void media.context.close();
  }, []);

  const stop = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (stateRef.current === "listening") {
      releaseMicrophone(true);
      changeState("stopping");
      worker.postMessage({ type: "stop" });
    } else {
      releaseMicrophone();
      worker.terminate();
      workerRef.current = null;
      changeState("idle");
    }
  }, [changeState, releaseMicrophone]);

  const fail = useCallback((message: string) => {
    releaseMicrophone();
    workerRef.current?.terminate();
    workerRef.current = null;
    if (mountedRef.current) setError(message);
    changeState("error");
  }, [changeState, releaseMicrophone]);

  const openMicrophone = useCallback(async (worker: Worker) => {
    changeState("permission");
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (workerRef.current !== worker) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (workerRef.current !== worker) {
        stream.getTracks().forEach((track) => track.stop());
        void context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silence = context.createGain();
      silence.gain.value = 0;
      source.connect(processor);
      processor.connect(silence);
      silence.connect(context.destination);
      // Native sample rates are usually 44.1/48 kHz. Carry the fractional read
      // position between callbacks so no gaps are introduced at buffer edges.
      const ratio = context.sampleRate / TARGET_RATE;
      let readPosition = 0;
      let pending: number[] = [];
      const flush = () => {
        if (!pending.length) return;
        const samples = Float32Array.from(pending);
        pending = [];
        worker.postMessage({ type: "audio", samples }, [samples.buffer]);
      };
      mediaRef.current = { stream, context, source, processor, flush };
      processor.onaudioprocess = (event) => {
        if (workerRef.current !== worker || stateRef.current !== "listening") return;
        const input = event.inputBuffer.getChannelData(0);
        while (readPosition < input.length) {
          const index = Math.floor(readPosition);
          const fraction = readPosition - index;
          pending.push(input[index] * (1 - fraction) + input[Math.min(index + 1, input.length - 1)] * fraction);
          readPosition += ratio;
        }
        readPosition -= input.length;
        if (pending.length >= INPUT_CHUNK_SIZE) {
          flush();
        }
      };
      changeState("listening");
    } catch (e) {
      const hadMedia = mediaRef.current !== null;
      releaseMicrophone();
      stream?.getTracks().forEach((track) => track.stop());
      if (context && !hadMedia) void context.close();
      if (workerRef.current === worker) {
        const message = e instanceof DOMException && e.name === "NotAllowedError"
          ? "Mikrofon nije dozvoljen. Omogući pristup mikrofonu u postavkama preglednika."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "Nije pronađen mikrofon na ovom uređaju."
            : "Mikrofon se nije mogao pokrenuti. Provjeri da nije zauzet u drugoj aplikaciji.";
        if (mountedRef.current) setError(message);
        changeState("ready");
      }
    }
  }, [changeState, releaseMicrophone]);

  const start = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      fail("Ovaj uređaj ili preglednik ne podržava pristup mikrofonu.");
      return;
    }
    if (workerRef.current) {
      if (stateRef.current === "ready" || stateRef.current === "done") {
        setActiveKey(null);
        setError(null);
        void openMicrophone(workerRef.current);
      }
      return;
    }
    setActiveKey(null);
    setError(null);
    changeState("loading");
    const worker = new Worker(new URL("../lib/quran-voice/fatiha.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onerror = () => { if (workerRef.current === worker) fail("Model se nije mogao pokrenuti na ovom uređaju."); };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (workerRef.current !== worker) return;
      const message = event.data;
      if (message.type === "ready") changeState("ready");
      if (message.type === "match") {
        setActiveKey(`1:${message.ayah}`);
        requestAnimationFrame(() => {
          document.querySelector(`[data-ayah-key="1:${message.ayah}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      if (message.type === "stopped") {
        changeState("done");
      }
      if (message.type === "error") fail(message.message);
    };
    worker.postMessage({ type: "init" });
  }, [changeState, fail, openMicrophone]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      releaseMicrophone();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [releaseMicrophone]);

  return {
    state,
    activeKey,
    error,
    start,
    stop,
    isActive: state === "loading" || state === "permission" || state === "listening" || state === "stopping",
  };
}