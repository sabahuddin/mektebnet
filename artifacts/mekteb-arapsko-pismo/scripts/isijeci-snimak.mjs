// Jedan snimak čitanja → zasebna datoteka za svaku riječ.
//
// Pokretanje (iz korijena repozitorija, treba ffmpeg):
//   node artifacts/mekteb-arapsko-pismo/scripts/isijeci-snimak.mjs snimak.m4a spisak.txt
//   node artifacts/mekteb-arapsko-pismo/scripts/isijeci-snimak.mjs snimak.m4a spisak.txt --primijeni
//
// Bez --primijeni ništa se ne upisuje: skripta samo nađe granice, prebroji
// riječi i kaže šta bi uradila. Tako se greška u spisku vidi prije nego išta
// uđe u repozitorij.
//
// ZAŠTO POSTOJI: snimci skupljeni s tuđih stranica nikad nisu činili cjelinu.
// Različit glas, različita jačina, razvučeni vokali, padežni nastavci kojih u
// našem zapisu nema — svaka riječ ponaosob je bila upotrebljiva, a zajedno
// nisu zvučale kao jedna knjiga. Ovdje jedan čovjek pročita cijeli spisak
// odjednom, pa je sve što se čuje po sebi ujednačeno.
//
// KAKO SE SNIMA:
//   1. Pročitaj riječi redom sa spiska, jednu po jednu.
//   2. Između svake dvije zastani najmanje pola sekunde. Pauza je ono po čemu
//      se snimak siječe; kraća pauza spaja dvije riječi u jednu datoteku.
//   3. Ne počinji govoriti odmah — ostavi sekundu tišine na početku i kraju.
//   4. Ne mijenjaj udaljenost od mikrofona usred snimanja.
//
// SPISAK: obična tekstualna datoteka, jedan zapis po redu, istim redom kojim
// su riječi pročitane. Prazni redovi i redovi koji počinju s „#" se preskaču.
//
// PODEŠAVANJE VISINE: glas odraslog muškarca je oko 105 Hz, a snimke sluša
// dijete od pet godina. Zadano se podiže na 115 Hz — dovoljno da zvuči
// vedrije, premalo da se čuje da je dirano. Pomjeraju se i ton i formanti
// zajedno, običnim presempliranjem, pa nema onog metalnog prizvuka koji
// ostavljaju fazni postupci. Trajanje se vraća na izvorno, da se govor ne
// ubrza. S „--hz 0" se ne dira ništa.
import { readFile, readdir, writeFile, mkdir, unlink, copyFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { osnovnaFrekvencija, opisGlasa } from "./lib/frekvencija.mjs";

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PODACI = path.join(KORIJEN, "public/vjezbe/slusaj/podaci");
const ZVUK = path.join(KORIJEN, "public/audio/opismenjavanje");

const argumenti = process.argv.slice(2);
const zastavica = (ime) => argumenti.includes(ime);
const broj = (ime, zadano) => {
  const i = argumenti.indexOf(ime);
  return i >= 0 && argumenti[i + 1] ? Number(argumenti[i + 1]) : zadano;
};
// Zastavice koje uzimaju vrijednost, da se ta vrijednost ne pomiješa s
// imenom snimka ili spiska.
const SA_VRIJEDNOSCU = new Set(["--hz", "--prag", "--pauza", "--rub"]);
const slobodni = [];
for (let i = 0; i < argumenti.length; i++) {
  if (argumenti[i].startsWith("--")) {
    if (SA_VRIJEDNOSCU.has(argumenti[i])) i++;
    continue;
  }
  slobodni.push(argumenti[i]);
}

const [SNIMAK, SPISAK] = slobodni;
const PRIMIJENI = zastavica("--primijeni");
const CILJ_HZ = broj("--hz", 115);
const PRAG = broj("--prag", -35);
const PAUZA = broj("--pauza", 0.25);
const RUB = broj("--rub", 0.06);
// Kucanje po stolu, dah u mikrofon ili škljocaj pri paljenju snimača traju
// desetinku sekunde. Bez ovoga se broje kao riječ i cijeli spisak se pomjeri.
const NAJKRACA_DIONICA = broj("--najkraca", 0.25);

// Iste granice koje koristi provjeri-izgovor.mjs — snimak koji ih ne prođe ne
// smije ući, bez obzira ko ga je snimio.
const KRATAK_SLOG_NAJDUZE = 0.45;
const NAJKRACE = 0.1;
const NAJDUZE = 3;

if (!SNIMAK || !SPISAK) {
  console.error("Upotreba: isijeci-snimak.mjs <snimak> <spisak.txt> [--primijeni] [--hz 115]");
  process.exit(2);
}
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

/** Tešdid se piše prije samoglasnika; isti zapis obrnutim redom je druga niska. */
const normaliziraj = (z) => z.normalize("NFC").replace(/([ً-ِ])(ّ)/g, "$2$1").trim();

const HARF = /[ء-ي]/g;
const HAREKA = /[َُِ]/;
const DUZINA = /َا|ِي|ُو|آ|[اوي](?![ً-ْ])/;
const jeKratakSlog = (z) =>
  (z.match(HARF) ?? []).length === 1 && HAREKA.test(z) && !DUZINA.test(z) && !/[ً-ٍّْ]/.test(z);

// ── Spisak riječi ────────────────────────────────────────────────────────
const rijeci = (await readFile(SPISAK, "utf8"))
  .split("\n")
  .map((r) => r.trim())
  .filter((r) => r && !r.startsWith("#"))
  .map(normaliziraj);

if (!rijeci.length) { console.error(`Spisak ${SPISAK} je prazan.`); process.exit(2); }

// ── Granice govora ───────────────────────────────────────────────────────
const izlaz = await pokreni("ffmpeg", [
  "-hide_banner", "-nostats", "-i", SNIMAK,
  "-af", `silencedetect=noise=${PRAG}dB:d=${PAUZA}`, "-f", "null", "-",
]);
const ukupno = Number((await pokreni("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SNIMAK,
])).trim());

const tacke = [...izlaz.matchAll(/silence_(start|end): ([\d.]+)/g)].map((m) => [m[1], Number(m[2])]);
const sve = [];
let od = 0;
for (const [vrsta, t] of tacke) {
  if (vrsta === "start") {
    if (od != null && t > od) sve.push([od, t]);
    od = null;
  } else od = t;
}
if (od != null && ukupno > od) sve.push([od, ukupno]);

const dionice = sve.filter(([a, b]) => b - a >= NAJKRACA_DIONICA);
const trzaji = sve.filter(([a, b]) => b - a > 0 && b - a < NAJKRACA_DIONICA);

console.log(`Snimak traje ${ukupno.toFixed(2)} s, u njemu ${dionice.length} dionica govora.`);
if (trzaji.length) {
  const gdje = trzaji.map(([a, b]) => `${a.toFixed(2)} s (${(b - a).toFixed(2)} s)`).join(", ");
  console.log(`Odbačeno kao šum, prekratko za riječ: ${gdje}.`);
}
console.log(`Spisak ima ${rijeci.length} riječi.\n`);

if (dionice.length !== rijeci.length) {
  console.error("Broj dionica se ne poklapa sa spiskom. Ništa nije upisano.\n");
  const najvise = Math.max(dionice.length, rijeci.length);
  for (let i = 0; i < najvise; i++) {
    const d = dionice[i] ? `${dionice[i][0].toFixed(2)}–${dionice[i][1].toFixed(2)} s` : "—";
    console.error(`  ${String(i + 1).padStart(3)}. ${d.padEnd(18)} ${rijeci[i] ?? "—"}`);
  }
  console.error("\nAko su dvije riječi spojene, pauza je bila prekratka: povisi --pauza ili");
  console.error("snizi --prag (npr. --prag -40). Ako je jedna riječ isječena na dvije,");
  console.error("u njoj je bila pauza — snizi --pauza.");
  process.exit(1);
}

// ── Visina glasa ─────────────────────────────────────────────────────────
const izvorna = await osnovnaFrekvencija(SNIMAK);
if (izvorna.hz == null) { console.error("Visina glasa se ne da izmjeriti — je li snimak prazan?"); process.exit(1); }
const odnos = CILJ_HZ > 0 ? CILJ_HZ / izvorna.hz : 1;
console.log(`Glas na snimku: ${izvorna.hz} Hz (${opisGlasa(izvorna.hz)}).`);
console.log(CILJ_HZ > 0
  ? `Podiže se na ${CILJ_HZ} Hz — odnos ×${odnos.toFixed(3)}.\n`
  : "Visina se ne dira.\n");

const lanac = [
  "aresample=44100",
  ...(Math.abs(odnos - 1) > 0.005
    ? [`asetrate=44100*${odnos.toFixed(5)}`, "aresample=44100", `atempo=${(1 / odnos).toFixed(5)}`]
    : []),
  "loudnorm=I=-18:TP=-2:LRA=7",
].join(",");

// ── Sječenje ─────────────────────────────────────────────────────────────
if (PRIMIJENI) await mkdir(ZVUK, { recursive: true });

const napravljeni = new Map();
const sumnjivi = [];

for (let i = 0; i < rijeci.length; i++) {
  const zapis = rijeci[i];
  const [pocetak, kraj] = dionice[i];
  const ime = `rijec-${Buffer.from(zapis).toString("hex")}.mp3`;
  const privremeno = path.join(os.tmpdir(), `isijeci-${process.pid}-${i}.mp3`);

  await pokreni("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(Math.max(0, pocetak - RUB)), "-to", String(Math.min(ukupno, kraj + RUB)),
    "-i", SNIMAK, "-af", lanac, "-ac", "1", "-ar", "44100",
    "-codec:a", "libmp3lame", "-b:a", "96k", privremeno,
  ]);

  // Provjere se rade nad gotovim isječkom, ne nad izvornikom: mjeri se ono
  // što će dijete stvarno čuti.
  const bezTisine = path.join(os.tmpdir(), `isijeci-${process.pid}-${i}.wav`);
  await pokreni("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", privremeno,
    "-af", "silenceremove=start_periods=1:start_threshold=-35dB:stop_periods=-1:stop_threshold=-35dB",
    bezTisine,
  ]);
  const govor = Number((await pokreni("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", bezTisine,
  ])).trim()) || 0;
  const { hz } = await osnovnaFrekvencija(privremeno);
  await unlink(bezTisine).catch(() => {});

  const gornja = jeKratakSlog(zapis) ? KRATAK_SLOG_NAJDUZE : NAJDUZE;
  const zamjerke = [];
  if (govor < NAJKRACE) zamjerke.push(`govor traje samo ${govor.toFixed(2)} s`);
  if (govor > gornja) {
    zamjerke.push(jeKratakSlog(zapis)
      ? `kratak slog traje ${govor.toFixed(2)} s (najviše ${gornja}) — vokal je razvučen`
      : `govor traje ${govor.toFixed(2)} s (najviše ${gornja})`);
  }
  if (hz != null && CILJ_HZ > 0 && Math.abs(hz - CILJ_HZ) > 25) {
    zamjerke.push(`visina ${hz} Hz odstupa od ciljanih ${CILJ_HZ}`);
  }

  const oznaka = zamjerke.length ? "✗" : "·";
  console.log(`  ${oznaka} ${String(i + 1).padStart(2)}. ${zapis.padEnd(10)} ${govor.toFixed(2)} s  ${String(hz ?? "—").padStart(4)} Hz  → ${ime}`);
  for (const z of zamjerke) console.log(`       ${z}`);

  if (zamjerke.length) sumnjivi.push({ zapis, zamjerke });
  if (PRIMIJENI) {
    await copyFile(privremeno, path.join(ZVUK, ime));
    napravljeni.set(zapis, `/audio/opismenjavanje/${ime}`);
  }
  await unlink(privremeno).catch(() => {});
}

// ── Upis u vježbe ────────────────────────────────────────────────────────
if (!PRIMIJENI) {
  console.log(`\nNije upisano ništa. Ako spisak i granice valjaju, ponovi s --primijeni.`);
  process.exit(sumnjivi.length ? 1 : 0);
}

let dodano = 0;
const nepovezani = new Set(napravljeni.keys());
for (const naziv of (await readdir(PODACI)).filter((n) => n.endsWith(".json"))) {
  const staza = path.join(PODACI, naziv);
  const v = JSON.parse(await readFile(staza, "utf8"));
  let promijenjeno = false;
  for (const kljuc of ["harfovi", "slogovi", "rijeci"]) {
    for (const st of v[kljuc] ?? []) {
      const zapis = normaliziraj(st.zapis);
      const adresa = napravljeni.get(zapis);
      if (!adresa) continue;
      nepovezani.delete(zapis);
      if (st.zvuk === adresa) continue;
      st.zvuk = adresa;
      promijenjeno = true;
      dodano++;
    }
  }
  if (promijenjeno) await writeFile(staza, `${JSON.stringify(v, null, 2)}\n`);
}

console.log(`\nNapravljeno ${napravljeni.size} snimaka, povezano uz ${dodano} stavki u vježbama.`);
if (nepovezani.size) {
  console.log(`Nijedna vježba još ne traži: ${[...nepovezani].join(" ")}`);
}
if (sumnjivi.length) {
  console.log(`\nProvjeri ove: ${sumnjivi.map((s) => s.zapis).join(" ")}`);
  process.exit(1);
}
