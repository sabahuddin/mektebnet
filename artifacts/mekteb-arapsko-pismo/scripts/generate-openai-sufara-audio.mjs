// Generisanje Sufara audio-snimaka preko OpenAI integracije.
//
// VAŽNO — zašto ovdje postoje ograničenja dužine:
// Prva verzija ove skripte nije imala nijedno. Model koji se koristi je
// razgovorni (chat s audio-izlazom), a ne namjenski TTS, pa kad mu se pošalje
// goli arapski slog, zna umjesto kratkog izgovora otići u petlju i govoriti
// dok ga nešto ne zaustavi. Zaustavilo ga je tek serversko ograničenje: 258
// snimaka ima tačno 13 min 39 s, ukupno skoro 60 sati zvuka umjesto oko 19
// minuta koliko je posao tražio. Izlazni audio-tokeni se plaćaju, pa je to bio
// i skup i neupotrebljiv rezultat.
//
// Tri brave ispod moraju ostati:
//   1. max_completion_tokens — jedino što stvarno ograničava trošak, jer
//      zaustavlja generisanje na serveru. Provjera nakon preuzimanja ne pomaže:
//      minute zvuka su već napravljene i naplaćene.
//   2. provjera trajanja — predugačak snimak se ne upisuje na disk.
//   3. prekid cijelog posla nakon nekoliko promašaja i nakon ukupnog budžeta,
//      da sistemska greška košta tri snimka, a ne dvjesta.
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { trajanjeMp3, formatirajTrajanje } from "./lib/mp3-trajanje.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAPPING_FILE = path.join(ROOT, "src/data/slogovi-mapping.ts");
const WORD_BANK_FILE = path.join(ROOT, "src/data/reading-word-bank.ts");
const OUTPUT_DIR = path.join(ROOT, "public/audio/slogovi");
const API_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const MODEL = process.env.OPENAI_TTS_MODEL || "gpt-audio";
const VOICE = process.env.OPENAI_TTS_VOICE || "alloy";
const DRY_RUN = process.argv.includes("--dry-run");
const OVERWRITE = process.argv.includes("--overwrite");

function argBroj(zastavica, podrazumijevano) {
  const i = process.argv.indexOf(zastavica);
  if (i === -1) return podrazumijevano;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : podrazumijevano;
}

// Brava 1: serversko ograničenje izlaza. Jedan slog stane u nekoliko sekundi
// zvuka; ako se snimci vraćaju odsječeni, podigni ovo, ali pažljivo.
const MAX_TOKENA = argBroj("--max-tokena", Number(process.env.OPENAI_TTS_MAX_TOKENS) || 600);
// Brava 2: sve duže od ovoga je greška, ne snimak.
const MAX_SEKUNDI = argBroj("--max-sekundi", 15);
// Brava 3: koliko neispravnih odgovora trpimo i koliko ukupno zvuka smijemo
// napraviti prije nego posao sam stane.
const MAX_PROMASAJA = argBroj("--max-promasaja", 3);
const BUDZET_MINUTA = argBroj("--budzet-minuta", 45);

const source = await readFile(MAPPING_FILE, "utf8");
const baseEntries = [...source.matchAll(/"([^"]+)":\s*"([^"]+\.mp3)"/g)];
const baseArabic = new Set(baseEntries.map(([, arabic]) => arabic));
const baseTargets = baseEntries
  .filter(([, , file]) => file.startsWith("openai-"))
  .map(([, arabic, file]) => ({ arabic, file }));
const wordBankSource = await readFile(WORD_BANK_FILE, "utf8");
const readingWords = [...wordBankSource.matchAll(/^\s*\d+:\s*\[([\s\S]*?)\],/gm)]
  .flatMap(([, block]) => [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
const readingWordAudioFile = (text) =>
  `openai-reading-${Array.from(text, (character) => character.codePointAt(0).toString(16)).join("-")}.mp3`;
const readingTargets = [...new Set(readingWords)]
  .filter((arabic) => !baseArabic.has(arabic))
  .map((arabic) => ({ arabic, file: readingWordAudioFile(arabic) }));
const targets = [...baseTargets, ...readingTargets];

if (targets.length === 0) {
  throw new Error("Nema OpenAI audio ciljeva u slogovi-mapping.ts.");
}

console.log(`OpenAI Sufara audio: ${targets.length} zapisa, model=${MODEL}, voice=${VOICE}`);
console.log(
  `Ograničenja: najviše ${MAX_TOKENA} tokena po odgovoru, ${MAX_SEKUNDI} s po snimku, ` +
    `${MAX_PROMASAJA} promašaja i ${BUDZET_MINUTA} min ukupnog zvuka.`,
);
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

let napravljenoSekundi = 0;
const promasaji = [];

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
      temperature: 0,
      max_completion_tokens: MAX_TOKENA,
      messages: [
        {
          role: "system",
          content: [
            "You are the single Bosnian-speaking Qur'an-reading instructor for the entire Sufara course.",
            "Keep exactly the same neutral voice, microphone distance, volume, pace, and dry studio sound in every recording.",
            "Pronounce only the fully vowelled Arabic text provided.",
            "Use clear Quranic Arabic articulation suitable for a beginner reading exercise.",
            "Do not name the letters, translate, explain, sing, or add any other word.",
            "Never insert a consonant, glide, diphthong, or tashdid that is not written.",
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

  const zvuk = Buffer.from(audioData, "base64");
  const mjera = trajanjeMp3(zvuk);
  napravljenoSekundi += mjera.sekunde ?? 0;

  if (mjera.sekunde === null || mjera.sekunde > MAX_SEKUNDI) {
    promasaji.push({ ...target, trajanje: mjera.sekunde });
    console.warn(
      `[${index + 1}/${targets.length}] ODBAČEN ${target.file} — ` +
        `${formatirajTrajanje(mjera.sekunde)} za jedan zapis (dozvoljeno ${MAX_SEKUNDI} s). Nije upisan.`,
    );
    if (promasaji.length >= MAX_PROMASAJA) {
      throw new Error(
        `Prekid: ${promasaji.length} neispravnih odgovora zaredom s modelom ${MODEL}. ` +
          `Model ne vraća kratke snimke — provjeri upit i max_completion_tokens prije nastavka.`,
      );
    }
    continue;
  }

  if (napravljenoSekundi > BUDZET_MINUTA * 60) {
    throw new Error(
      `Prekid: potrošen budžet od ${BUDZET_MINUTA} min zvuka na ${index + 1} zapisa. ` +
        `Nešto vraća predugačke odgovore — provjeri prije nego nastaviš.`,
    );
  }

  await writeFile(output, zvuk);
  console.log(
    `[${index + 1}/${targets.length}] napravljen ${target.file} (${target.arabic}) — ${formatirajTrajanje(mjera.sekunde)}`,
  );
}

console.log(
  `Gotovo. Ukupno napravljeno ${formatirajTrajanje(napravljenoSekundi)} zvuka, ` +
    `odbačenih ${promasaji.length}.`,
);
if (promasaji.length) {
  console.log("Odbačeni (nisu upisani):");
  for (const p of promasaji) console.log(`  ${p.file} — ${formatirajTrajanje(p.trajanje)}`);
}
console.log("Preslušaj kandidate u administratorskom audio-pregledu prije javne objave.");
