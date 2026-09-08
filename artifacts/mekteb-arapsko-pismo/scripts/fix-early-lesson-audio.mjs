import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLOGOVI_DIR = path.join(ROOT, "public/audio/slogovi");
const HARFOVI_DIR = path.join(ROOT, "public/audio/harfovi");
const MAPPING_FILE = path.join(ROOT, "src/data/slogovi-mapping.ts");
const WORD_BANK_FILE = path.join(ROOT, "src/data/reading-word-bank.ts");
const API_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-audio";
const VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const DRY_RUN = process.argv.includes("--dry-run");

const mappingSource = await readFile(MAPPING_FILE, "utf8");
const mappingEntries = [...mappingSource.matchAll(/"([^"]+)":\s*"([^"]+\.mp3)"/g)]
  .map(([, arabic, file]) => ({ arabic, file }));
const mappedFile = new Map(mappingEntries.map(({ arabic, file }) => [arabic, file]));

const hasOnlyEarlyLessonSigns = (arabic) =>
  /^[أإبتثَُِ]+$/u.test(arabic) && !/[ّْ]/u.test(arabic);

const targets = new Map();
for (const { arabic, file } of mappingEntries) {
  if (hasOnlyEarlyLessonSigns(arabic)) {
    targets.set(path.join(SLOGOVI_DIR, file), arabic);
  }
}

const wordBankSource = await readFile(WORD_BANK_FILE, "utf8");
const earlyBlocks = [...wordBankSource.matchAll(/^\s*(2|3):\s*\[([\s\S]*?)\],/gm)];
const readingAudioFile = (text) =>
  `openai-reading-${Array.from(text, (character) => character.codePointAt(0).toString(16)).join("-")}.mp3`;

for (const [, , block] of earlyBlocks) {
  for (const [, arabic] of block.matchAll(/"([^"]+)"/g)) {
    const file = mappedFile.get(arabic) || readingAudioFile(arabic);
    targets.set(path.join(SLOGOVI_DIR, file), arabic);
  }
}

targets.set(path.join(HARFOVI_DIR, "hareke-fatha.mp3"), "أَ");
targets.set(path.join(HARFOVI_DIR, "hareke-kasra.mp3"), "إِ");
targets.set(path.join(HARFOVI_DIR, "hareke-damma.mp3"), "أُ");

const consonants = { "أ": "", "إ": "", "ب": "b", "ت": "t", "ث": "s" };
const vowels = { "َ": "e", "ِ": "i", "ُ": "u" };

function bosnianGuide(arabic) {
  const syllables = [];
  const characters = Array.from(arabic);
  for (let index = 0; index < characters.length; index += 1) {
    const consonant = consonants[characters[index]];
    if (consonant === undefined) continue;
    const vowel = vowels[characters[index + 1]];
    if (!vowel) throw new Error(`Nedostaje ili nije podržan hareket u zapisu ${arabic}.`);
    syllables.push(`${consonant}${vowel}`);
    index += 1;
  }
  return syllables.join("-");
}

console.log(`Ispravka ranog audio-seta: ${targets.size} snimaka, model=${MODEL}, voice=${VOICE}`);
if (DRY_RUN) {
  for (const [output, arabic] of targets) {
    console.log(`${path.relative(ROOT, output)}\t${arabic}\t${bosnianGuide(arabic)}`);
  }
  process.exit(0);
}

if (!API_BASE_URL || !API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL i AI_INTEGRATIONS_OPENAI_API_KEY moraju biti dostupni.");
}

await mkdir(SLOGOVI_DIR, { recursive: true });
await mkdir(HARFOVI_DIR, { recursive: true });

for (const [index, [output, arabic]] of [...targets].entries()) {
  const guide = bosnianGuide(arabic);
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
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You are one Bosnian-speaking Qur'an-reading instructor recording a beginner Sufara course.",
            "Keep exactly the same neutral voice, microphone distance, volume, pace, and dry studio sound for every item.",
            "The Bosnian pronunciation guide supplied by the user is authoritative: fatha is short e, kasra is i, and damma is u.",
            "Pronounce every hyphen-separated syllable distinctly with a tiny natural separation, but keep the item in one recording.",
            "Never merge two consonants, never double a consonant unless a tashdid is visibly present, and never insert a y/j or any diphthong.",
            "Do not use Arabic letter-name pronunciation and do not add an explanation, count-in, echo, reverb, or extra sound.",
            "Speak the requested guide exactly once.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Arabic display: ${arabic}\nRequired spoken output: ${guide}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status} za ${arabic}: ${await response.text()}`);
  }

  const payload = await response.json();
  const audioData = payload.choices?.[0]?.message?.audio?.data;
  if (!audioData) throw new Error(`OpenAI nije vratio audio podatke za ${arabic}.`);

  await writeFile(output, Buffer.from(audioData, "base64"));
  console.log(`[${index + 1}/${targets.size}] ${path.basename(output)}: ${arabic} = ${guide}`);
}

// Osiguraj da sva tri osnovna snimka zaista postoje nakon regeneracije.
for (const file of ["hareke-fatha.mp3", "hareke-kasra.mp3", "hareke-damma.mp3"]) {
  await access(path.join(HARFOVI_DIR, file), constants.F_OK);
}

console.log("Gotovo: lekcije 2 i 3 sada koriste isti glas i strogo rastavljene slogove.");
