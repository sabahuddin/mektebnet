// Mjerenje trajanja MP3 je osnova svega ostalog: po njemu se odlučuje šta je
// neispravan snimak, šta generator smije upisati i šta se briše. Zato se ovdje
// provjerava na okvirima koje sami složimo, bez ijedne stvarne zvučne datoteke.
import test from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error — biblioteka je obični .mjs bez tipova, dijele je skripte.
import { trajanjeMp3, formatirajTrajanje } from "../../artifacts/mekteb-arapsko-pismo/scripts/lib/mp3-trajanje.mjs";

// MPEG 1, Layer III, 128 kb/s, 44.100 Hz — format cijele naše biblioteke.
// Okvir tada nosi 1152 uzorka i dug je 417 bajta (bez dopune).
const UZORAKA_PO_OKVIRU = 1152;
const FREKVENCIJA = 44100;
const DUZINA_OKVIRA = 417;

function okvir(): Buffer {
  const b = Buffer.alloc(DUZINA_OKVIRA);
  b[0] = 0xff;
  b[1] = 0xfb; // sinhronizacija + MPEG 1 + Layer III + bez zaštite
  b[2] = 0x90; // bitrate 128 kb/s, frekvencija 44.100 Hz, bez dopune
  b[3] = 0xc0; // mono
  return b;
}

function snimak(okvira: number, prefiks: Buffer = Buffer.alloc(0)): Buffer {
  return Buffer.concat([prefiks, ...Array.from({ length: okvira }, okvir)]);
}

test("trajanje se računa iz broja okvira, a ne iz veličine datoteke", () => {
  const mjera = trajanjeMp3(snimak(100));
  assert.equal(mjera.okvira, 100);
  assert.equal(mjera.frekvencija, FREKVENCIJA);
  assert.equal(mjera.bitrate, 128000);
  assert.equal(mjera.sekunde, (100 * UZORAKA_PO_OKVIRU) / FREKVENCIJA);
});

test("kratak snimak sloga i razbježali snimak se jasno razlikuju", () => {
  const slog = trajanjeMp3(snimak(38)); // otprilike sekunda
  const razbjezali = trajanjeMp3(snimak(31353)); // koliko su imali pokvareni snimci
  assert.ok(slog.sekunde < 1.1, `slog traje ${slog.sekunde}`);
  assert.ok(razbjezali.sekunde > 800, `razbježali traje ${razbjezali.sekunde}`);
});

test("ID3v2 zaglavlje se preskače i ne broji kao zvuk", () => {
  const zaglavlje = Buffer.alloc(10 + 200);
  zaglavlje.write("ID3", 0, "latin1");
  zaglavlje[6] = 0x00;
  zaglavlje[7] = 0x00;
  zaglavlje[8] = 0x01; // 0x80 = 128
  zaglavlje[9] = 0x48; // + 72 = 200 bajta podataka
  const mjera = trajanjeMp3(snimak(50, zaglavlje));
  assert.equal(mjera.okvira, 50);
});

test("datoteka bez ijednog okvira se prijavi, a ne izmisli trajanje", () => {
  const mjera = trajanjeMp3(Buffer.alloc(4096));
  assert.equal(mjera.sekunde, null);
  assert.match(mjera.razlog, /MP3/);
});

test("trajanje se ispisuje razumljivo i u sekundama i u minutama", () => {
  assert.equal(formatirajTrajanje(2.4), "2.4 s");
  assert.equal(formatirajTrajanje(819), "13 min 39 s");
  assert.equal(formatirajTrajanje(null), "—");
});
