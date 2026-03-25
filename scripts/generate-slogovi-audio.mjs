import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../artifacts/mekteb-arapsko-pismo/public/audio/slogovi');
const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'R6nda3uM038xEEKi7GFl'; // Anas — Calm, Attractive and Clear
const MODEL = 'eleven_multilingual_v2';

if (!API_KEY) {
  console.error('Missing ELEVENLABS_API_KEY');
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

// Filename: md5 of the Arabic text (safe for filesystem)
function slugify(text) {
  return createHash('md5').update(text).digest('hex').slice(0, 12);
}

// All unique syllables from čitaj-slog exercises
const SLOGOVI = [
  'بَ','بِ','بُ','تَ','تِ','تُ','ثَ','ثِ','ثُ',
  'بَتَ','تَبَ','بِتَ','تِبَ','بُتَ','تُبَ',
  'بَثَ','ثَبَ','بِثَ','ثِبَ','تَثَ','ثَتَ',
  'أَبَ','أَتَ','أَثَ',
  'بَتَثَ','تَبَثَ','أَبَتَ','ثَبَتَ','بِتَثَ','أَتَثَ',
  'جَ','جِ','جُ','حَ','حِ','حُ','خَ','خِ','خُ',
  'جَبَ','حَبَ','خَبَ','بَجَ','تَجَ','ثَجَ','حَجَ','جَحَ','خَجَ',
  'جِبَ','حِتَ','خُبَ',
  'بَحَثَ','حَجَبَ','خَبَثَ','جَبَتَ','حَبَثَ','تَجَحَ','خَجَبَ',
  'جِبَثَ','بُجُحَ',
  'أَ','خَثَ','بِحَ','تُخَ','بُجَ',
];

// Mapping file to save so app can look up filenames
const mapping = {};

async function generate(text) {
  const filename = `${slugify(text)}.mp3`;
  const filepath = join(OUTPUT_DIR, filename);

  if (existsSync(filepath)) {
    console.log(`  ✓ Skip (exists): ${text} → ${filename}`);
    mapping[text] = filename;
    return;
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.80,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`  ✗ FAIL: ${text} → ${err}`);
    return;
  }

  const buffer = await response.arrayBuffer();
  writeFileSync(filepath, Buffer.from(buffer));
  mapping[text] = filename;
  console.log(`  ✓ Generated: ${text} → ${filename} (${buffer.byteLength} bytes)`);

  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 300));
}

console.log(`Generating ${SLOGOVI.length} syllables...`);
for (const slog of SLOGOVI) {
  await generate(slog);
}

// Save mapping JSON for the app to use
const mappingPath = join(OUTPUT_DIR, 'mapping.json');
writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
console.log(`\nDone! Mapping saved to ${mappingPath}`);
console.log(`Total: ${Object.keys(mapping).length}/${SLOGOVI.length}`);
