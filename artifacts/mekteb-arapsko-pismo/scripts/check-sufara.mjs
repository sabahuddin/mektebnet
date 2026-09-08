import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(projectRoot, "src");
const lessonsPath = join(srcRoot, "data", "lessons.ts");
const mappingPath = join(srcRoot, "data", "slogovi-mapping.ts");
const wordBankPath = join(srcRoot, "data", "reading-word-bank.ts");
const harfoviDir = join(projectRoot, "public", "audio", "harfovi");
const slogoviDir = join(projectRoot, "public", "audio", "slogovi");

const failures = [];
const warnings = [];
const sourceFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(path);
  }
}

walk(srcRoot);

for (const path of sourceFiles) {
  const source = readFileSync(path, "utf8");
  if (/speechSynthesis|SpeechSynthesisUtterance/.test(source)) {
    failures.push(`Nedozvoljeni browser TTS: ${relative(projectRoot, path)}`);
  }
}

const lessonsSource = readFileSync(lessonsPath, "utf8");
const alphabetSource = lessonsSource.match(/const ALL_ARABIC_LETTERS = \[([\s\S]*?)\];/)?.[1] ?? "";
const alphabet = [...alphabetSource.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
if (alphabet.length !== 28 || new Set(alphabet).size !== 28) {
  failures.push("Završna lista mora sadržavati tačno 28 jedinstvenih arapskih harfova.");
}
const lessonIds = [...lessonsSource.matchAll(/id:\s*(\d+),\s*orderNum:/g)].map((match) => Number(match[1]));
if (new Set(lessonIds).size !== lessonIds.length) {
  failures.push("ID-jevi lekcija moraju biti jedinstveni.");
}
for (let index = 1; index < lessonIds.length; index += 1) {
  if (lessonIds[index] !== lessonIds[index - 1] + 1) {
    failures.push(`Nedostaje lekcija između ${lessonIds[index - 1]} i ${lessonIds[index]}.`);
  }
}
const lessonSlugs = [...lessonsSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]);
if (new Set(lessonSlugs).size !== lessonSlugs.length) {
  failures.push("Slugovi lekcija moraju biti jedinstveni.");
}

const lessonStarts = [...lessonsSource.matchAll(/id:\s*(\d+),\s*orderNum:/g)];
for (let index = 0; index < lessonStarts.length; index += 1) {
  const start = lessonStarts[index];
  const end = lessonStarts[index + 1]?.index ?? lessonsSource.indexOf("export function", start.index);
  const lessonSource = lessonsSource.slice(start.index, end);
  if (!/type:\s*"čitaj-slog"/.test(lessonSource)) {
    failures.push(`Lekcija ${start[1]} nema završnu vježbu čitanja.`);
  }
  const exerciseTypes = [...lessonSource.matchAll(/type:\s*"([^"]+)"/g)].map((match) => match[1]);
  const readingCount = exerciseTypes.filter((type) => type === "čitaj-slog").length;
  if (Number(start[1]) >= 10 && readingCount < 2) {
    failures.push(`Lekcija ${start[1]} mora imati najmanje dvije vježbe čitanja.`);
  }
}
if (/\b(?:šedda|šedde|shadda)\b/i.test(lessonsSource)) {
  failures.push("Korisnički sadržaj mora koristiti naziv tešdid.");
}
if (/\bhamz(?:a|e|u|om)\b/i.test(lessonsSource)) {
  failures.push("Korisnički sadržaj mora koristiti naziv hemza/hemze.");
}
if (/\bZejn\b/.test(lessonsSource)) {
  failures.push("Korisnički sadržaj mora koristiti naziv Za, ne Zejn.");
}

const mappingSource = readFileSync(mappingPath, "utf8");
const mappingEntries = [...mappingSource.matchAll(/^\s*"([^"]+)":\s*"([^"]+\.mp3)"/gm)]
  .map((match) => [match[1], match[2]]);
if (new Set(mappingEntries.map(([arabic]) => arabic)).size !== mappingEntries.length) {
  failures.push("Audio-mapa ne smije sadržavati isti arapski zapis više puta.");
}
if (new Set(mappingEntries.map(([, file]) => file)).size !== mappingEntries.length) {
  failures.push("Svaki arapski zapis mora imati vlastiti audio-fajl.");
}
const mapping = Object.fromEntries(mappingEntries);
const wordBankSource = readFileSync(wordBankPath, "utf8");
const wordBanks = [...wordBankSource.matchAll(/^\s*(\d+):\s*\[([\s\S]*?)\],/gm)]
  .map((match) => ({
    lessonId: Number(match[1]),
    words: [...match[2].matchAll(/"([^"]+)"/g)].map((word) => word[1]),
  }));
const introducedInLesson = new Map(Object.entries({
  ا: 2, ب: 3, ت: 3, ث: 3, ج: 4, ح: 4, خ: 4, د: 6, ذ: 6, ر: 6, ز: 6,
  س: 10, ش: 10, ص: 11, ض: 11, ط: 12, ظ: 12, ع: 13, غ: 13, ف: 14, ق: 14,
  ك: 15, ل: 15, م: 15, ن: 16, ه: 16, و: 16, ي: 16,
}));
for (const { lessonId, words } of wordBanks) {
  if (words.length !== 30) failures.push(`Lekcija ${lessonId} mora imati tačno 30 čitalačkih primjera.`);
  if (new Set(words).size !== words.length) failures.push(`Lekcija ${lessonId} ima ponovljen čitalački primjer.`);
  for (const word of words) {
    const baseLetters = [...word.normalize("NFD").replace(/\p{M}/gu, "")]
      .filter((character) => introducedInLesson.has(character));
    const unseen = baseLetters.find((character) => introducedInLesson.get(character) > lessonId);
    if (unseen) failures.push(`Lekcija ${lessonId} prerano koristi harf ${unseen} u primjeru ${word}.`);
  }
}
if (wordBanks.length !== lessonIds.length) {
  failures.push("Svaka lekcija mora imati vlastitu banku od 30 čitalačkih primjera.");
}
const readingWordAudioFile = (text) =>
  `openai-reading-${Array.from(text, (character) => character.codePointAt(0).toString(16)).join("-")}.mp3`;
for (const { words } of wordBanks) {
  for (const arabic of words) {
    if (!mapping[arabic]) mapping[arabic] = readingWordAudioFile(arabic);
  }
}
const readingBlocks = [...lessonsSource.matchAll(
  /type:\s*"čitaj-slog"[\s\S]*?items:\s*\[([\s\S]*?)\]\s*,?\n\s*\}/g,
)];
for (const block of readingBlocks) {
  const readingItems = [...block[1].matchAll(/show:\s*"([^"]+)"/g)].map((match) => match[1]);
  for (const arabic of readingItems) {
    if (!mapping[arabic]) failures.push(`Kartica čitanja nema audio-mapiranje: ${arabic}`);
  }
}
for (const [arabic, file] of Object.entries(mapping)) {
  if (!existsSync(join(slogoviDir, file))) {
    if (file.startsWith("openai-")) {
      warnings.push(`OpenAI kandidat još nije generiran za ${arabic}: audio/slogovi/${file}`);
    } else {
      failures.push(`Nedostaje audio za ${arabic}: audio/slogovi/${file}`);
    }
  }
}

const referencedFiles = new Set(
  [...lessonsSource.matchAll(/(?:audio|soundFile):\s*"([^"]+\.mp3)"/g)].map((match) => match[1]),
);
for (const file of referencedFiles) {
  if (!existsSync(join(harfoviDir, file)) && !existsSync(join(slogoviDir, file))) {
    failures.push(`Lekcija upućuje na nepostojeći audio: ${file}`);
  }
}

const approvalPath = join(srcRoot, "data", "audio-approval.ts");
const approvalSource = readFileSync(approvalPath, "utf8");
for (const file of readdirSync(harfoviDir).filter((name) => name.endsWith(".mp3"))) {
  if (!approvalSource.includes(`"${file}"`)) {
    failures.push(`Audio nije evidentiran u kontroli kvaliteta: audio/harfovi/${file}`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join("\n"));
  process.exit(1);
}

if (warnings.length) {
  console.warn(`⚠ ${warnings.length} OpenAI audio-kandidata čeka generiranje (pnpm audio:sufara:openai).`);
}

console.log(`✓ Sufara provjera prošla: ${lessonIds.length} lekcija, ${referencedFiles.size} direktnih audio putanja i ${Object.keys(mapping).length} slogova.`);
