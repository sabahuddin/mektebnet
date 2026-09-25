// Koliko zaista traje svaki snimak u audio-biblioteci Sufare.
//
// Pokretanje (iz korijena repozitorija):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-trajanje-zvuka.mjs
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-trajanje-zvuka.mjs --prag 4
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-trajanje-zvuka.mjs --json
//
// Ništa ne mijenja i ništa ne briše — samo mjeri i ispisuje. Ne treba ffmpeg.
//
// Zašto postoji: jedan slog treba trajati sekundu-dvije. Kad generator zvuka
// nema ograničenje dužine, model koji „upadne u petlju" zna naslagati desetak
// minuta govora u datoteku za jedan jedini slog. Veličina datoteke to nagovijesti,
// ali tek trajanje to dokaže.
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { trajanjeMp3IzDatoteke, formatirajTrajanje } from "./lib/mp3-trajanje.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = path.join(ROOT, "public/audio");
const argv = process.argv.slice(2);
const JSON_ISPIS = argv.includes("--json");

function broj(zastavica, podrazumijevano) {
  const i = argv.indexOf(zastavica);
  if (i === -1) return podrazumijevano;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) ? v : podrazumijevano;
}

const PRAG = broj("--prag", 15); // preko toliko sekundi za jedan zapis je greška, ne snimak
const TACNO = argv.includes("--tacno"); // pročitaj svaku datoteku do kraja (sporo)

async function sveDatoteke(dir) {
  const nadjeno = [];
  for (const unos of await readdir(dir, { withFileTypes: true })) {
    const puna = path.join(dir, unos.name);
    if (unos.isDirectory()) nadjeno.push(...(await sveDatoteke(puna)));
    else if (unos.name.toLowerCase().endsWith(".mp3")) nadjeno.push(puna);
  }
  return nadjeno;
}

const datoteke = (await sveDatoteke(AUDIO)).sort();
const zapisi = [];
for (const puna of datoteke) {
  const mjera = await trajanjeMp3IzDatoteke(puna, { tacno: TACNO });
  zapisi.push({
    datoteka: path.relative(AUDIO, puna),
    bajtova: mjera.bajtova,
    sekunde: mjera.sekunde,
    bitrate: mjera.bitrate ?? null,
    razlog: mjera.razlog ?? null,
  });
}

const citljivi = zapisi.filter((z) => z.sekunde !== null);
const neispravni = citljivi.filter((z) => z.sekunde > PRAG).sort((a, b) => b.sekunde - a.sekunde);
const neprocitani = zapisi.filter((z) => z.sekunde === null);
const ukupnoBajtova = zapisi.reduce((z, s) => z + s.bajtova, 0);
const ukupnoSekundi = citljivi.reduce((z, s) => z + s.sekunde, 0);
const viskaSekundi = neispravni.reduce((z, s) => z + (s.sekunde - PRAG), 0);
const viskaBajtova = neispravni.reduce(
  (z, s) => z + Math.round(s.bajtova * ((s.sekunde - PRAG) / s.sekunde)),
  0,
);

if (JSON_ISPIS) {
  console.log(JSON.stringify({ prag: PRAG, ukupnoBajtova, ukupnoSekundi, zapisi }, null, 2));
  process.exit(neispravni.length ? 1 : 0);
}

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const sati = (s) => `${(s / 3600).toFixed(1)} h`;

console.log(`Audio-biblioteka: ${zapisi.length} MP3 datoteka, ${mb(ukupnoBajtova)}, ${sati(ukupnoSekundi)} zvuka.`);
console.log(`Prag za jedan snimak: ${PRAG} s.\n`);

if (neprocitani.length) {
  console.log(`Nečitljivo (${neprocitani.length}):`);
  for (const z of neprocitani) console.log(`  ${z.datoteka} — ${z.razlog}`);
  console.log("");
}

if (!neispravni.length) {
  console.log("Nijedan snimak nije duži od praga.");
  process.exit(0);
}

console.log(`Predugi snimci: ${neispravni.length} od ${citljivi.length}`);
console.log(`  zajedno traju ${sati(neispravni.reduce((z, s) => z + s.sekunde, 0))}`);
console.log(`  najduži: ${formatirajTrajanje(neispravni[0].sekunde)} (${neispravni[0].datoteka})`);
console.log(`  skraćivanjem na ${PRAG} s oslobodilo bi se oko ${mb(viskaBajtova)} (${sati(viskaSekundi)} zvuka)\n`);

for (const z of neispravni.slice(0, 40)) {
  console.log(`  ${formatirajTrajanje(z.sekunde).padStart(11)}  ${mb(z.bajtova).padStart(8)}  ${z.datoteka}`);
}
if (neispravni.length > 40) console.log(`  … i još ${neispravni.length - 40}`);

console.log(`\nSljedeći korak: node artifacts/mekteb-arapsko-pismo/scripts/skrati-preduge-zvukove.mjs`);
process.exit(1);
