// Šta je zaista unutar predugačkih snimaka, i šta se od njih može spasiti.
//
// Pokretanje (iz korijena repozitorija, treba ffmpeg):
//   node artifacts/mekteb-arapsko-pismo/scripts/skrati-preduge-zvukove.mjs
//   node artifacts/mekteb-arapsko-pismo/scripts/skrati-preduge-zvukove.mjs --izlaz /tmp/spaseno
//   node artifacts/mekteb-arapsko-pismo/scripts/skrati-preduge-zvukove.mjs --primijeni
//
// Preporučeni redoslijed: prvo bez ičega (samo pregled), pa s --izlaz da se
// spašeni isječci naprave sa strane i preslušaju, pa tek onda --primijeni.
//
// Bez --primijeni ništa se ne dira: samo se sluša šta je u datotekama i ispiše
// prijedlog. Snimci su u gitu, pa se i nakon sječenja sve vraća s
//   git checkout -- artifacts/mekteb-arapsko-pismo/public/audio
//
// Tri ishoda po datoteci:
//   tišina  — nigdje nema zvuka iznad praga čujnosti; nema se šta spasiti,
//             takav slog treba iznova snimiti
//   spasivo — govor je na početku i stane u dozvoljeno trajanje; ostatak je
//             višak i može se odsjeći
//   ručno   — ima govora, ali ne po tom obrascu; neka to čovjek posluša
import { mkdir, readdir, readFile, rename, unlink, stat, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { trajanjeMp3IzDatoteke, formatirajTrajanje } from "./lib/mp3-trajanje.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO = path.join(ROOT, "public/audio");
const argv = process.argv.slice(2);
const PRIMIJENI = argv.includes("--primijeni");

function broj(zastavica, podrazumijevano) {
  const i = argv.indexOf(zastavica);
  if (i === -1) return podrazumijevano;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) ? v : podrazumijevano;
}

const PRAG = broj("--prag", 15);        // preko toliko sekundi snimak je greška
const NAJDUZE = broj("--najduze", 8);   // koliko smije trajati spašeni izgovor
const TISINA_DB = broj("--tisina-db", 40); // ispod -40 dB smatramo tišinom
const PARALELNO = broj("--paralelno", 8);
// Kraći „zvuk" od ovoga nije izgovor nego škljocaj ili artefakt na kraju
// datoteke: ffmpeg na kraju snimka koji se završava tišinom svakako javi
// silence_end, pa bi se bez ovog praga svaka tiha datoteka lažno prikazala
// kao da u zadnjoj desetinki sekunde ima govora.
const NAJKRACE = broj("--najkrace", 0.25);
// Dionica koja jeste iznad praga tišine, ali je jedva čujna, nije izgovor
// koji dijete može ponoviti. Mjerimo najglasniju tačku u predloženom isječku.
const NAJTISE_DB = broj("--najtise-db", 30);
const PRED = 0.15;  // koliko sekundi ostavimo prije govora
const IZA = 0.35;   // i koliko iza

// Slušanje svih snimaka traje nekoliko minuta, pa se nalaz može sačuvati i
// kasnije ponovo razvrstati drugim pragovima, bez ffmpega.
function tekstArg(zastavica) {
  const i = argv.indexOf(zastavica);
  return i === -1 ? null : argv[i + 1] ?? null;
}
const SACUVAJ = tekstArg("--izvjestaj");
const UCITAJ = tekstArg("--iz-izvjestaja");
// Sa --izlaz se izvornici ne diraju: skraćeni snimci se pišu u zadani folder,
// pa se mogu preslušati prije nego išta zamijeni postojeće datoteke.
const IZLAZ = tekstArg("--izlaz");
// Snimci iz kojih se nema šta spasiti samo zauzimaju disk i u aplikaciji su
// već odbačeni (audio-approval.ts). Brisanje je namjerno zasebna zastavica.
const OBRISI = argv.includes("--obrisi-neupotrebljive");

if (!UCITAJ && spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status !== 0) {
  throw new Error("Nedostaje ffmpeg. Na Replitu ga dodaj prije pokretanja.");
}

async function sveDatoteke(dir) {
  const nadjeno = [];
  for (const unos of await readdir(dir, { withFileTypes: true })) {
    const puna = path.join(dir, unos.name);
    if (unos.isDirectory()) nadjeno.push(...(await sveDatoteke(puna)));
    else if (unos.name.toLowerCase().endsWith(".mp3")) nadjeno.push(puna);
  }
  return nadjeno;
}

function pokreni(naredba, argumenti) {
  return new Promise((rijesi, odbij) => {
    const dijete = spawn(naredba, argumenti);
    let izlaz = "";
    dijete.stderr.on("data", (d) => { izlaz += d; });
    dijete.stdout.on("data", () => {});
    dijete.on("error", odbij);
    dijete.on("close", (kod) => rijesi({ kod, izlaz }));
  });
}

// ffmpeg prijavljuje gdje tišina počinje i gdje prestaje; govor je ono između.
async function nadjiGovor(putanja, trajanje) {
  const { izlaz } = await pokreni("ffmpeg", [
    "-hide_banner", "-nostats", "-i", putanja,
    "-af", `silencedetect=noise=-${TISINA_DB}dB:d=0.3`,
    "-f", "null", "-",
  ]);

  const dogadjaji = [];
  for (const red of izlaz.split("\n")) {
    const pocetak = red.match(/silence_start:\s*(-?[\d.]+)/);
    if (pocetak) dogadjaji.push({ vrsta: "pocetak", u: Number(pocetak[1]) });
    const kraj = red.match(/silence_end:\s*([\d.]+)/);
    if (kraj) dogadjaji.push({ vrsta: "kraj", u: Number(kraj[1]) });
  }

  const govor = [];
  let od = 0;
  for (const d of dogadjaji) {
    if (d.vrsta === "pocetak") {
      if (d.u > od + 0.05) govor.push({ od, do: d.u });
      od = null;
    } else if (od === null) {
      od = d.u;
    }
  }
  if (od !== null && trajanje - od > 0.05) govor.push({ od, do: trajanje });
  return govor;
}

// Najglasnija tačka unutar predloženog isječka, u decibelima (0 = najglasnije).
async function glasnoca(putanja, od, doKad) {
  const { izlaz } = await pokreni("ffmpeg", [
    "-hide_banner", "-nostats",
    "-ss", String(od), "-to", String(doKad), "-i", putanja,
    "-af", "volumedetect", "-f", "null", "-",
  ]);
  const nadjeno = izlaz.match(/max_volume:\s*(-?[\d.]+) dB/);
  return nadjeno ? Number(nadjeno[1]) : null;
}

async function odsjeci(ulaz, od, doKad, odrediste = null) {
  const privremeno = odrediste ?? `${ulaz}.skracujem.mp3`;
  if (odrediste) await mkdir(path.dirname(odrediste), { recursive: true });
  const { kod, izlaz } = await pokreni("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(od), "-to", String(doKad), "-i", ulaz,
    "-ac", "1", "-ar", "44100", "-b:a", "128k",
    privremeno,
  ]);
  if (kod !== 0) {
    await unlink(privremeno).catch(() => {});
    throw new Error(`Sječenje nije uspjelo za ${path.basename(ulaz)}: ${izlaz}`);
  }
  if (!odrediste) await rename(privremeno, ulaz);
}

// ── Pregled ──────────────────────────────────────────────────────────────
let sirovi;
if (UCITAJ) {
  sirovi = JSON.parse(await readFile(UCITAJ, "utf8"));
  console.log(`Nalaz učitan iz ${UCITAJ}: ${sirovi.length} snimaka. ffmpeg se ne pokreće.`);
} else {
  const sve = (await sveDatoteke(AUDIO)).sort();
  const kandidati = [];
  for (const puna of sve) {
    const mjera = await trajanjeMp3IzDatoteke(puna);
    if (mjera.sekunde !== null && mjera.sekunde > PRAG) {
      kandidati.push({ naziv: path.relative(AUDIO, puna), trajanje: mjera.sekunde, bajtova: mjera.bajtova });
    }
  }

  console.log(`Predugih snimaka: ${kandidati.length} (preko ${PRAG} s), ukupno ${(kandidati.reduce((z, k) => z + k.bajtova, 0) / 1048576).toFixed(0)} MB.`);
  console.log(`Slušam ih ffmpegom, ${PARALELNO} odjednom…\n`);

  sirovi = [];
  let gotovo = 0;
  async function radnik(red) {
    while (red.length) {
      const k = red.shift();
      const puna = path.join(AUDIO, k.naziv);
      const govor = await nadjiGovor(puna, k.trajanje);
      const prvi = govor.find((g) => g.do - g.od >= NAJKRACE) ?? null;
      const db = prvi ? await glasnoca(puna, prvi.od, prvi.do) : null;
      sirovi.push({ ...k, govor, db });
      gotovo += 1;
      if (gotovo % 25 === 0) process.stdout.write(`  ${gotovo}/${kandidati.length}\n`);
    }
  }
  const red = [...kandidati];
  await Promise.all(Array.from({ length: PARALELNO }, () => radnik(red)));
  if (SACUVAJ) {
    await writeFile(SACUVAJ, JSON.stringify(sirovi, null, 2));
    console.log(`\nNalaz sačuvan u ${SACUVAJ}.`);
  }
}

const nalazi = sirovi
  .map((s) => {
    const govor = s.govor.filter((g) => g.do - g.od >= NAJKRACE);
    const prvi = govor[0] ?? null;
    const preslab = prvi && s.db !== null && s.db < -NAJTISE_DB;
    const ishod = !govor.length || preslab
      ? "tišina"
      : prvi.do - prvi.od <= NAJDUZE
        ? "spasivo"
        : "ručno";
    return { ...s, puna: path.join(AUDIO, s.naziv), govor, prvi, ishod };
  })
  .sort((a, b) => a.naziv.localeCompare(b.naziv));

const poIshodu = (i) => nalazi.filter((n) => n.ishod === i);
const mb = (b) => `${(b / 1048576).toFixed(0)} MB`;

console.log(`\n── Nalaz ──`);
for (const ishod of ["tišina", "spasivo", "ručno"]) {
  const g = poIshodu(ishod);
  if (!g.length) continue;
  console.log(`  ${ishod.padEnd(8)} ${String(g.length).padStart(4)} datoteka, ${mb(g.reduce((z, n) => z + n.bajtova, 0))}`);
}

const spasivi = poIshodu("spasivo");
if (spasivi.length) {
  console.log(`\nPrimjeri spasivih (govor na početku):`);
  for (const n of spasivi.slice(0, 10)) {
    console.log(`  ${n.naziv} — govor ${n.prvi.od.toFixed(2)}–${n.prvi.do.toFixed(2)} s (${n.db} dB) od ${formatirajTrajanje(n.trajanje)}`);
  }
}
const rucni = poIshodu("ručno");
if (rucni.length) {
  console.log(`\nZa ručno slušanje:`);
  for (const n of rucni.slice(0, 10)) {
    console.log(`  ${n.naziv} — ${n.govor.length} dionica govora, prva ${n.prvi.od.toFixed(1)}–${n.prvi.do.toFixed(1)} s`);
  }
  if (rucni.length > 10) console.log(`  … i još ${rucni.length - 10}`);
}

if (OBRISI) {
  const zaBrisanje = [...poIshodu("tišina"), ...poIshodu("ručno")];
  const oslobodjeno = zaBrisanje.reduce((z, n) => z + n.bajtova, 0);
  console.log(`\nBrišem ${zaBrisanje.length} neupotrebljivih snimaka (${mb(oslobodjeno)})…`);
  for (const n of zaBrisanje) await unlink(n.puna);
  console.log(`Obrisano. U aplikaciji su ti snimci ionako odbačeni, pa se ništa ne mijenja`);
  console.log(`za dijete: gdje je bila tišina, ostaje tišina.`);
  console.log(`Povratak: git checkout -- artifacts/mekteb-arapsko-pismo/public/audio`);
}

if (!PRIMIJENI && !IZLAZ) {
  if (!OBRISI) {
    console.log(`\nNišta nije promijenjeno.`);
    console.log(`  --izlaz <folder>           napravi skraćene snimke sa strane, izvornici ostaju netaknuti`);
    console.log(`  --primijeni                zamijeni ${spasivi.length} izvornika skraćenim snimcima`);
    console.log(`  --obrisi-neupotrebljive    obriši ${poIshodu("tišina").length + poIshodu("ručno").length} snimaka iz kojih se nema šta spasiti`);
  }
  process.exit(0);
}

if (!spasivi.length) {
  console.log(`\nNema se šta odsjeći.`);
  process.exit(0);
}

console.log(`\nSijem ${spasivi.length} snimaka${IZLAZ ? ` u ${IZLAZ}` : " na mjestu"}…`);
let prije = 0;
let poslije = 0;
for (const [i, n] of spasivi.entries()) {
  prije += n.bajtova;
  const odrediste = IZLAZ ? path.join(IZLAZ, n.naziv) : null;
  await odsjeci(n.puna, Math.max(0, n.prvi.od - PRED), n.prvi.do + IZA, odrediste);
  poslije += (await stat(odrediste ?? n.puna)).size;
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${spasivi.length}`);
}
console.log(`\nGotovo: ${mb(prije)} → ${mb(poslije)}, ušteda ${mb(prije - poslije)}.`);
if (IZLAZ) {
  console.log(`Izvornici nisu dirani. Skraćeni snimci su u ${IZLAZ} — preslušaj ih pa ih prekopiraj.`);
} else {
  console.log(`Obavezno preslušaj uzorak prije objave. Povratak: git checkout -- artifacts/mekteb-arapsko-pismo/public/audio`);
}
