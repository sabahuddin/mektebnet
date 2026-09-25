// Osnovna frekvencija glasa (visina tona) iz snimka.
//
// Zašto: kad snimke daje više ljudi, ili kad se jedan glas podiže da zvuči
// mlađe, jedina mjera koja to pokaže brojem jeste osnovna frekvencija. Na uho
// se čuje da „nije isti glas"; ovdje se to vidi kao 107 naspram 180 Hz.
//
// Kako: snimak se dekodira u 16 kHz mono, isječe na okvire od 40 ms i u svakom
// okviru traži period autokorelacijom. Uzima se medijana po okvirima, ne jedna
// mjera nad cijelim snimkom — jedan okvir može pasti na šum ili na oktavu
// niže, ali medijana deset okvira ne može.
import { spawn } from "node:child_process";

const UZORAK = 16000;
const NAJNIZE = 70;   // Hz — ispod ovoga nije ljudski glas nego brujanje.
const NAJVISE = 400;  // Hz — iznad ovoga smo u šumu.
const OKVIR = 0.04;   // s
const KORAK = 0.02;   // s

/** Dekodira bilo koji audio zapis u niz uzoraka od -1 do 1. */
function dekodiraj(putanja) {
  return new Promise((rijesi, odbij) => {
    const d = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-i", putanja,
      "-ac", "1", "-ar", String(UZORAK), "-f", "s16le", "-",
    ]);
    const dijelovi = [];
    d.stdout.on("data", (x) => dijelovi.push(x));
    d.on("error", odbij);
    d.on("close", () => {
      const b = Buffer.concat(dijelovi);
      const n = Math.floor(b.length / 2);
      const uzorci = new Float32Array(n);
      for (let i = 0; i < n; i++) uzorci[i] = b.readInt16LE(i * 2) / 32768;
      rijesi(uzorci);
    });
  });
}

/** Period jednog okvira, autokorelacijom. Vraća Hz ili null ako ga nema. */
function visinaOkvira(x, od, duzina) {
  let srednja = 0;
  for (let i = 0; i < duzina; i++) srednja += x[od + i];
  srednja /= duzina;

  let snaga = 0;
  for (let i = 0; i < duzina; i++) {
    const v = x[od + i] - srednja;
    snaga += v * v;
  }
  // Tiši okviri su pauze između riječi ili dah; iz njih se visina ne čita.
  if (snaga / duzina < 1e-5) return null;

  const najmanjiPomak = Math.floor(UZORAK / NAJVISE);
  const najveciPomak = Math.min(Math.floor(UZORAK / NAJNIZE), duzina - 1);
  let najbolji = 0;
  let najboljiPomak = 0;
  for (let pomak = najmanjiPomak; pomak <= najveciPomak; pomak++) {
    let zbir = 0;
    for (let i = 0; i + pomak < duzina; i++) {
      zbir += (x[od + i] - srednja) * (x[od + i + pomak] - srednja);
    }
    const mjera = zbir / (duzina - pomak);
    if (mjera > najbolji) { najbolji = mjera; najboljiPomak = pomak; }
  }
  // Slab vrh znači da okvir nije zvučan (bezvučni suglasnik, šum).
  if (!najboljiPomak || najbolji < 0.3 * (snaga / duzina)) return null;
  return UZORAK / najboljiPomak;
}

/**
 * Osnovna frekvencija snimka u hercima, ili null ako se ne da izmjeriti.
 * Vraća i broj okvira iz kojih je izvedena, da se vidi koliko je mjera nosiva.
 */
export async function osnovnaFrekvencija(putanja) {
  const x = await dekodiraj(putanja);
  const duzina = Math.round(OKVIR * UZORAK);
  const korak = Math.round(KORAK * UZORAK);
  const mjere = [];
  for (let od = 0; od + duzina < x.length; od += korak) {
    const hz = visinaOkvira(x, od, duzina);
    if (hz) mjere.push(hz);
  }
  if (mjere.length < 3) return { hz: null, okvira: mjere.length };
  mjere.sort((a, b) => a - b);
  return { hz: Math.round(mjere[Math.floor(mjere.length / 2)]), okvira: mjere.length };
}

/** Muški, ženski ili dječiji raspon — za prijavu da se glasovi miješaju. */
export function opisGlasa(hz) {
  if (hz == null) return "nemjerljivo";
  if (hz < 155) return "muški";
  if (hz < 180) return "na granici";
  if (hz < 260) return "ženski ili starije dijete";
  return "dijete";
}
