import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "public/audio/harfovi/zejn.mp3");
const API_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-audio";
const VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) {
  console.log(`Ispravka audio-snimka: ${OUTPUT} mora izgovoriti زَ kao kratko \"za\".`);
  process.exit(0);
}

if (!API_BASE_URL || !API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL i AI_INTEGRATIONS_OPENAI_API_KEY moraju biti dostupni.");
}

const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: MODEL,
    modalities: ["text", "audio"],
    audio: { voice: VOICE, format: "mp3" },
    messages: [
      {
        role: "system",
        content: [
          "Pronounce only the fully vowelled Arabic syllable provided.",
          "For زَ, produce one short, clear Quranic Arabic syllable: za.",
          "Do not say the Arabic letter name zay or zayn.",
          "Do not explain, translate, repeat, or add another sound.",
        ].join(" "),
      },
      { role: "user", content: "زَ" },
    ],
  }),
});

if (!response.ok) {
  throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
const audioData = payload.choices?.[0]?.message?.audio?.data;
if (!audioData) throw new Error("OpenAI nije vratio audio podatke za زَ.");

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, Buffer.from(audioData, "base64"));
console.log("Ispravljen zejn.mp3: sada izgovara kratko 'za', bez glasa j i bez naziva zejn.");
