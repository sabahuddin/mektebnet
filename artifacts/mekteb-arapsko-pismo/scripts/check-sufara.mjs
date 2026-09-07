import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(projectRoot, "src");
const lessonsPath = join(srcRoot, "data", "lessons.ts");
const mappingPath = join(srcRoot, "data", "slogovi-mapping.ts");
const harfoviDir = join(projectRoot, "public", "audio", "harfovi");
const slogoviDir = join(projectRoot, "public", "audio", "slogovi");

const failures = [];
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
const lessonIds = [...lessonsSource.matchAll(/id:\s*(\d+),\s*orderNum:/g)].map((match) => Number(match[1]));
if (new Set(lessonIds).size !== lessonIds.length) {
  failures.push("ID-jevi lekcija moraju biti jedinstveni.");
}
const lessonSlugs = [...lessonsSource.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]);
if (new Set(lessonSlugs).size !== lessonSlugs.length) {
  failures.push("Slugovi lekcija moraju biti jedinstveni.");
}
if (/\b(?:šedda|šedde|shadda)\b/i.test(lessonsSource)) {
  failures.push("Korisnički sadržaj mora koristiti naziv tešdid.");
}
if (/\bhamz(?:a|e|u|om)\b/i.test(lessonsSource)) {
  failures.push("Korisnički sadržaj mora koristiti naziv hemza/hemze.");
}

const mappingSource = readFileSync(mappingPath, "utf8");
const mapping = Object.fromEntries(
  [...mappingSource.matchAll(/^\s*"([^"]+)":\s*"([^"]+\.mp3)"/gm)].map((match) => [match[1], match[2]]),
);
for (const [arabic, file] of Object.entries(mapping)) {
  if (!existsSync(join(slogoviDir, file))) {
    failures.push(`Nedostaje audio za ${arabic}: audio/slogovi/${file}`);
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

console.log(`✓ Sufara provjera prošla: ${lessonIds.length} lekcija, ${referencedFiles.size} direktnih audio putanja i ${Object.keys(mapping).length} slogova.`);
