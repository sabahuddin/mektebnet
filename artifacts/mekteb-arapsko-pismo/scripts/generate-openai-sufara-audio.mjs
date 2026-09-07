import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAPPING_FILE = path.join(ROOT, "src/data/slogovi-mapping.ts");
const OUTPUT_DIR = path.join(ROOT, "public/audio/slogovi");
const API_URL = "https://api.openai.com/v1/audio/speech";
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const VOICE = process.env.OPENAI_TTS_VOICE || "cedar";
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

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("Postavi OPENAI_API_KEY kao Replit Secret pa ponovo pokreni skriptu.");
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

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      response_format: "mp3",
      input: target.arabic,
      instructions: [
        "Pronounce only the fully vowelled Arabic text provided.",
        "Use clear Quranic Arabic articulation suitable for a beginner reading exercise.",
        "Do not name the letters, translate, explain, sing, or add any other word.",
        "Read the text exactly once, slowly but as one connected unit.",
      ].join(" "),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status} za ${target.arabic}: ${detail}`);
  }

  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  console.log(`[${index + 1}/${targets.length}] napravljen ${target.file} (${target.arabic})`);
}

console.log("Gotovo. Preslušaj kandidate u administratorskom audio-pregledu prije javne objave.");
