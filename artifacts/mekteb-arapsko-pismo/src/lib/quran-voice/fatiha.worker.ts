import * as ort from "onnxruntime-web/wasm";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { createRecognitionSession, type RecognitionSession, type WorkerOutbound } from "@tilawa/core";
import vocab from "./vocab.json";
import quranCtcTokens from "./fatiha-ctc-tokens.json";
import quran from "./fatiha-verses.json";

// CC BY 4.0: Muhammed Durakovic, Tilawi FastConformer, derived from NVIDIA
// stt_ar_fastconformer_hybrid_large_pcd_v1.0. See VOICE-LICENSES.md.
const MODEL_URL =
  "https://huggingface.co/muhdur/tilawi-fastconformer-quran/resolve/e9448a0e84f3adb64c28b7a8db501dd8e0e59a84/fastconformer_full_mixed.onnx";

type Incoming = { type: "init" } | { type: "audio"; samples: Float32Array } | { type: "stop" };
type Outgoing =
  | { type: "ready" }
  | { type: "match"; ayah: number }
  | { type: "stopped" }
  | { type: "error"; message: string };

function send(message: Outgoing) {
  self.postMessage(message);
}

let recognition: RecognitionSession | null = null;

function emitMatches(events: WorkerOutbound[]) {
  for (const event of events) {
    if (event.type === "verse_match" && event.surah === 1 && event.ayah >= 1 && event.ayah <= 7) {
      send({ type: "match", ayah: event.ayah });
    }
  }
}

async function handle(message: Incoming) {
  if (message.type === "init") {
    ort.env.wasm.numThreads = 1;
    // Vite fingerprints the runtime. Without an explicit URL ONNX tries to
    // fetch it beside the worker and receives the app's HTML fallback instead.
    ort.env.wasm.wasmPaths = { wasm: ortWasmUrl };
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Model nije dostupan (HTTP ${response.status}).`);
    const model = await response.arrayBuffer();
    const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
    recognition = await createRecognitionSession({
      engine: "fastconformer",
      runner: {
        async run(audio) {
          const input = new ort.Tensor("float32", audio, [1, audio.length]);
          const length = new ort.Tensor("int64", BigInt64Array.from([BigInt(audio.length)]), [1]);
          const results = await session.run({ audio_signal: input, length });
          const output = results[session.outputNames[0]];
          if (!output || output.dims.length !== 3) throw new Error("Model je vratio neispravan rezultat.");
          const [, timeSteps, vocabSize] = output.dims.map(Number);
          return { logprobs: output.data as Float32Array, timeSteps, vocabSize };
        },
      },
      assets: { vocab, quranCtcTokens, quran },
    });
    send({ type: "ready" });
    return;
  }
  if (!recognition) return;
  if (message.type === "audio") emitMatches(await recognition.feed(message.samples));
  if (message.type === "stop") {
    emitMatches(await recognition.stop());
    recognition.reset();
    send({ type: "stopped" });
  }
}

// ONNX work must never overlap: a slow inference can otherwise reorder chunks.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<Incoming>) => {
  queue = queue.then(() => handle(event.data)).catch((error: unknown) => {
    send({ type: "error", message: error instanceof Error ? error.message : "Prepoznavanje nije uspjelo." });
  });
};