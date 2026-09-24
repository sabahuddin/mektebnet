// Mjerenje trajanja MP3 datoteke bez ijednog vanjskog alata.
//
// Veličina datoteke ne govori koliko zvuk traje ako bitrate nije svuda isti,
// pa se ovdje broje sami MP3 okviri: svaki okvir nosi tačno određen broj
// uzoraka, a zbir uzoraka podijeljen frekvencijom daje sekunde. Tako mjerenje
// radi i za VBR, i ne treba ni ffmpeg ni ffprobe.

// Tabele iz MP3 specifikacije (ISO/IEC 11172-3 i 13818-3), samo Layer III.
const BITRATE_MPEG1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATE_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const FREKVENCIJE = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000],  // MPEG 2.5
};

// ID3v2 zaglavlje stoji ispred zvuka i nije okvir — preskoči ga.
function pocetakZvuka(buffer) {
  if (buffer.length >= 10 && buffer.toString("latin1", 0, 3) === "ID3") {
    const velicina =
      (buffer[6] & 0x7f) * 0x200000 +
      (buffer[7] & 0x7f) * 0x4000 +
      (buffer[8] & 0x7f) * 0x80 +
      (buffer[9] & 0x7f);
    return 10 + velicina;
  }
  return 0;
}

function procitajOkvir(buffer, i) {
  if (i + 4 > buffer.length) return null;
  // Sinhronizacija: jedanaest jedinica zaredom.
  if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) return null;

  const verzija = (buffer[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const sloj = (buffer[i + 1] >> 1) & 3;    // 1 = Layer III
  const indeksBitratea = (buffer[i + 2] >> 4) & 15;
  const indeksFrekvencije = (buffer[i + 2] >> 2) & 3;
  const dopuna = (buffer[i + 2] >> 1) & 1;

  if (verzija === 1 || sloj !== 1) return null;
  if (indeksBitratea === 0 || indeksBitratea === 15) return null;
  if (indeksFrekvencije === 3) return null;

  const mpeg1 = verzija === 3;
  const bitrate = (mpeg1 ? BITRATE_MPEG1 : BITRATE_MPEG2)[indeksBitratea] * 1000;
  const frekvencija = FREKVENCIJE[verzija][indeksFrekvencije];
  const uzoraka = mpeg1 ? 1152 : 576;
  const duzina = Math.floor((uzoraka / 8) * (bitrate / frekvencija)) + dopuna;

  if (duzina < 4) return null;
  return { duzina, uzoraka, frekvencija, bitrate };
}

/**
 * Vraća { sekunde, okvira, frekvencija, bitrate, promjenjivBitrate } ili
 * { sekunde: null, razlog } ako datoteka nije čitljiv MP3.
 */
export function trajanjeMp3(buffer) {
  let i = pocetakZvuka(buffer);
  let uzoraka = 0;
  let okvira = 0;
  let frekvencija = null;
  const bitratei = new Set();

  // Prvi okvir znamo tražiti i kroz smeće na početku, dalje idemo okvir po okvir.
  let trazimo = true;
  while (i < buffer.length) {
    const okvir = procitajOkvir(buffer, i);
    if (!okvir) {
      if (!trazimo) { trazimo = true; }
      i += 1;
      continue;
    }
    trazimo = false;
    uzoraka += okvir.uzoraka;
    frekvencija = okvir.frekvencija;
    bitratei.add(okvir.bitrate);
    okvira += 1;
    i += okvir.duzina;
  }

  if (!okvira || !frekvencija) return { sekunde: null, razlog: "nije prepoznat kao MP3" };
  return {
    sekunde: uzoraka / frekvencija,
    okvira,
    frekvencija,
    bitrate: Math.max(...bitratei),
    promjenjivBitrate: bitratei.size > 1,
  };
}

export function formatirajTrajanje(sekunde) {
  if (sekunde === null) return "—";
  if (sekunde < 60) return `${sekunde.toFixed(1)} s`;
  const minute = Math.floor(sekunde / 60);
  return `${minute} min ${Math.round(sekunde - minute * 60)} s`;
}

// ── Brzo mjerenje: pročitaj samo početak datoteke ────────────────────────
//
// Cijela biblioteka je preko tri gigabajta, pa čitanje svake datoteke do kraja
// traje minutama. Skoro svi naši snimci imaju stalan bitrate, a kod njih je
// dovoljno izmjeriti prosječnu dužinu okvira na početku i ostatak izračunati iz
// veličine datoteke. Ako bitrate nije stalan, vraćamo se na tačno brojanje.
import { open, stat } from "node:fs/promises";

const GLAVA = 128 * 1024;
const OKVIRA_ZA_UZORAK = 200;

export async function trajanjeMp3IzDatoteke(putanja, { tacno = false } = {}) {
  const { size } = await stat(putanja);
  const rukovalac = await open(putanja, "r");
  try {
    if (tacno || size <= GLAVA) {
      const cijela = Buffer.alloc(size);
      await rukovalac.read(cijela, 0, size, 0);
      return { ...trajanjeMp3(cijela), bajtova: size, procijenjeno: false };
    }

    const glava = Buffer.alloc(GLAVA);
    await rukovalac.read(glava, 0, GLAVA, 0);

    const pocetak = pocetakZvuka(glava);
    let i = pocetak;
    let okvira = 0;
    let bajtovaOkvira = 0;
    let prvi = null;
    let stalan = true;

    while (i < glava.length && okvira < OKVIRA_ZA_UZORAK) {
      const okvir = procitajOkvir(glava, i);
      if (!okvir) { i += 1; continue; }
      if (!prvi) prvi = okvir;
      else if (okvir.bitrate !== prvi.bitrate || okvir.frekvencija !== prvi.frekvencija) stalan = false;
      okvira += 1;
      bajtovaOkvira += okvir.duzina;
      i += okvir.duzina;
    }

    if (!prvi) return { sekunde: null, razlog: "nije prepoznat kao MP3", bajtova: size };
    if (!stalan || okvira < 10) {
      const cijela = Buffer.alloc(size);
      await rukovalac.read(cijela, 0, size, 0);
      return { ...trajanjeMp3(cijela), bajtova: size, procijenjeno: false };
    }

    const prosjecniOkvir = bajtovaOkvira / okvira;
    const ukupnoOkvira = (size - pocetak) / prosjecniOkvir;
    return {
      sekunde: (ukupnoOkvira * prvi.uzoraka) / prvi.frekvencija,
      okvira: Math.round(ukupnoOkvira),
      frekvencija: prvi.frekvencija,
      bitrate: prvi.bitrate,
      promjenjivBitrate: false,
      bajtova: size,
      procijenjeno: true,
    };
  } finally {
    await rukovalac.close();
  }
}
