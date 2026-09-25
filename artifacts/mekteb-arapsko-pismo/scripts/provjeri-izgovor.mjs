// Traje li snimak onoliko koliko piše da traje.
//
// Pokretanje (iz korijena repozitorija, treba ffmpeg):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-izgovor.mjs
//
// Zašto: preuzeti snimci harfa s harekom razvlačili su vokal. Kod tog učača
// jedan slog „la" traje 0,75 sekundi, a cijela dvosložna riječ „leben" 0,66.
// Dijete bi čulo dužinu tamo gdje je napisano kratko. Veličina datoteke to ne
// pokaže, ni glasnoća, ni to što je snimio čovjek — pokaže tek trajanje
// podijeljeno brojem slogova.
//
// Mjeri se samo ono što se pouzdano da izmjeriti: KRATAK slog, dakle harf s
// harekom i bez ijedne dužine. Takav u normalnom govoru traje do 0,45 sekundi.
// Duge slogove („ميم", „باب") namjerno ne dira — jednosložni su, ali dugi, pa
// bi svako pravilo po broju slogova palo na njima. Za njih se samo traži da
// budu čujni i razumne dužine.
import { readdir, readFile, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PODACI = path.join(KORIJEN, "public/vjezbe/slusaj/podaci");
const JAVNO = path.join(KORIJEN, "public");

const KRATAK_SLOG_NAJDUZE = 0.45;
const RAZUMNO_NAJKRACE = 0.1;
const RAZUMNO_NAJDUZE = 3;

if (spawnSync("ffmpeg", ["-version"]).status !== 0) throw new Error("Nedostaje ffmpeg.");

function pokreni(naredba, argumenti) {
  return new Promise((rijesi) => {
    const d = spawn(naredba, argumenti);
    let izlaz = "";
    d.stderr.on("data", (x) => { izlaz += x; });
    d.stdout.on("data", (x) => { izlaz += x; });
    d.on("close", () => rijesi(izlaz));
  });
}

/** Trajanje samog govora, bez tišine na počeku i kraju. */
async function trajanjeGovora(putanja) {
  const privremeno = path.join(os.tmpdir(), `izgovor-${process.pid}-${Math.random().toString(36).slice(2)}.wav`);
  await pokreni("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", putanja,
    "-af", "silenceremove=start_periods=1:start_threshold=-35dB:stop_periods=-1:stop_threshold=-35dB",
    privremeno,
  ]);
  const izlaz = await pokreni("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", privremeno]);
  return Number(izlaz.trim()) || 0;
}

const HARF = /[\u0621-\u064A]/g;
const HAREKA = /[\u064E\u0650\u064F]/;
const DUZINA = /\u064E\u0627|\u0650\u064A|\u064F\u0648|\u0622|[\u0627\u0648\u064A](?![\u064B-\u0652])/;

/** Jedan harf s harekom, bez dužine i bez ijednog drugog znaka. */
function jeKratakSlog(zapis) {
  const harfova = (zapis.match(HARF) ?? []).length;
  return harfova === 1 && HAREKA.test(zapis) && !DUZINA.test(zapis)
    && !/[\u0652\u0651\u064B-\u064D]/.test(zapis);
}

const nalazi = [];
for (const naziv of (await readdir(PODACI)).filter((n) => n.endsWith(".json"))) {
  const vjezba = JSON.parse(await readFile(path.join(PODACI, naziv), "utf8"));
  for (const kljuc of ["harfovi", "slogovi", "rijeci"]) {
    for (const stavka of vjezba[kljuc] ?? []) {
      if (!stavka.zvuk || stavka.zvuk.startsWith("data:")) continue;
      const putanja = path.join(JAVNO, stavka.zvuk.replace(/^\//, ""));
      try { await stat(putanja); } catch {
        nalazi.push({ naziv, stavka, poruka: `snimak ne postoji: ${stavka.zvuk}` });
        continue;
      }
      const govor = await trajanjeGovora(putanja);
      const kratak = jeKratakSlog(stavka.zapis);
      const gornja = kratak ? KRATAK_SLOG_NAJDUZE : RAZUMNO_NAJDUZE;
      const ok = govor >= RAZUMNO_NAJKRACE && govor <= gornja;
      console.log(`${ok ? "OK  " : "PALO"} ${stavka.zapis.padEnd(8)} ${kratak ? "kratak slog" : "ostalo     "}  govor ${govor.toFixed(2)}s  ${path.basename(stavka.zvuk)}`);
      if (!ok) {
        nalazi.push({ naziv, stavka, poruka: kratak
          ? `kratak slog traje ${govor.toFixed(2)} s — razvučen je (najviše ${KRATAK_SLOG_NAJDUZE} s)`
          : `snimak traje ${govor.toFixed(2)} s, izvan razumnog (${RAZUMNO_NAJKRACE}–${RAZUMNO_NAJDUZE} s)` });
      }
    }
  }
}

if (nalazi.length) {
  console.log(`\nPALO: ${nalazi.length}`);
  for (const n of nalazi) console.log(`  ${n.naziv} — ${n.stavka.zapis}: ${n.poruka}`);
  process.exit(1);
}
console.log("\nSvi snimci traju koliko i treba.");
