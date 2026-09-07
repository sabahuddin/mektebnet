import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAPPING_FILE = path.join(ROOT, "src/data/slogovi-mapping.ts");
const OUTPUT_DIR = path.join(ROOT, "public/audio/slogovi");
const API_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-audio";
const VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const DRY_RUN = process.argv.includes("--dry-run");
const OVERWRITE = process.argv.includes("--overwrite");

const source = await readFile(MAPPING_FILE, "utf8");
const targets = [...source.matchAll(/"([^"]+)":\s*"(openai-[^"]+\.mp3)"/g)]
  .map(([, arabic, file]) => ({ arabic, file }));

if (targets.length === 0) {
  throw new Error("Nema OpenAI audio ciljeva u slogovi-mapping.ts.");
}

console.log(`OpenAI Sufara audio: ${targets.length} zapisa, model=${MODEL}, voice=${VOICE}`);
if (DRY_RUN) {
  for (const target of targets) console.log(`${target.file}\t${target.arabic}`);
  process.exit(0);
}

if (!API_BASE_URL || !API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL i AI_INTEGRATIONS_OPENAI_API_KEY moraju biti dostupni.",
  );
}

await mkdir(OUTPUT_DIR, { recursive: true });

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

for (const [index, target] of targets.entries()) {
  const output = path.join(OUTPUT_DIR, target.file);
  if (!OVERWRITE && await exists(output)) {
    console.log(`[${index + 1}/${targets.length}] preskačem postojeći ${target.file}`);
    continue;
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
            "Pronounce only the fully vowelled Arabic text provided.",
            "Use clear Quranic Arabic articulation suitable for a beginner reading exercise.",
            "Do not name the letters, translate, explain, sing, or add any other word.",
            "Read the text exactly once, slowly but as one connected unit.",
          ].join(" "),
        },
        { role: "user", content: target.arabic },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status} za ${target.arabic}: ${detail}`);
  }

  const payload = await response.json();
  const audioData = payload.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    throw new Error(`OpenAI nije vratio audio podatke za ${target.arabic}.`);
  }

  await writeFile(output, Buffer.from(audioData, "base64"));
  console.log(`[${index + 1}/${targets.length}] napravljen ${target.file} (${target.arabic})`);
}

console.log("Gotovo. Preslušaj kandidate u administratorskom audio-pregledu prije javne objave.");
