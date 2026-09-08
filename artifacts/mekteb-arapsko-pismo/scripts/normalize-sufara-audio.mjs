import { readdir, rename, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIRS = [
  path.join(ROOT, "public/audio/harfovi"),
  path.join(ROOT, "public/audio/slogovi"),
];
const DRY_RUN = process.argv.includes("--dry-run");

const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ffmpegCheck.status !== 0) {
  throw new Error("Nedostaje ffmpeg. U Replit okruženju instaliraj ffmpeg prije normalizacije audio-fajlova.");
}

const files = [];
for (const directory of AUDIO_DIRS) {
  for (const name of await readdir(directory)) {
    if (name.endsWith(".mp3")) files.push(path.join(directory, name));
  }
}

console.log(`Standardizacija ${files.length} MP3 fajlova: 44.100 Hz, mono, 128 kb/s, -18 LUFS.`);
if (DRY_RUN) process.exit(0);

for (const [index, input] of files.entries()) {
  const temporary = `${input}.normalizing.mp3`;
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", input,
    "-af", "loudnorm=I=-18:LRA=7:TP=-1.5",
    "-ar", "44100",
    "-ac", "1",
    "-b:a", "128k",
    temporary,
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    await unlink(temporary).catch(() => {});
    throw new Error(`Normalizacija nije uspjela za ${path.basename(input)}: ${result.stderr}`);
  }

  await rename(temporary, input);
  console.log(`[${index + 1}/${files.length}] ${path.basename(input)}`);
}

console.log("Gotovo: cijela Sufara audio-biblioteka ima isti tehnički format i glasnoću.");
