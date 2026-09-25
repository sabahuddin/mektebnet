// Zvuk za program učenja čitanja — Google Cloud Text-to-Speech.
//
// Pokretanje (iz korijena repozitorija, treba ffmpeg):
//   node artifacts/mekteb-arapsko-pismo/scripts/generisi-zvuk-citanja.mjs
//   node artifacts/mekteb-arapsko-pismo/scripts/generisi-zvuk-citanja.mjs --lekcija 1 --primijeni
//
// Bez --primijeni ne piše ništa: samo ispiše šta bi poslao i koliko znakova.
//
// KLJUČ SE NE VIDI ODAVDE. Stoji među API credentials okruženja, a Claude ga
// sam dodaje u zaglavlje svakog zahtjeva prema texttospeech.googleapis.com.
// Zato u ovoj datoteci nema ni ključa ni imena varijable — i ne može iscuriti
// ni kroz kod ni kroz historiju.
//
// ZAŠTO GOOGLE, A NE PREUZETI SNIMCI. Zbirka skupljena s Commonsa imala je
// četiri kvara koja se nisu dala popraviti: glas se mijenjao iz riječi u
// riječ, jačina takođe, izolovani slogovi su bili razvučeni preko mjere, a
// neki snimci su izgovarali padežni nastavak kojeg u zapisu nema. Prva tri
// nestaju sama, jer govori jedan glas. Četvrti se rješava pisanjem: Google
// čita tačno ono što je napisano, pa zapis s označenim krajem („مَالْ", ne
// „مال") daje tačno ono što dijete vidi. Vidjeti CLAUDE.md.
//
// NAPLAĆUJE SE PO ZNAKU POSLANOG TEKSTA, ne po dužini zvuka. Cijeli fond
// riječi kraći je od jedne stranice teksta. Skripta ispiše potrošnju i
// preskače ono što je već napravljeno.
import { mkdir, writeFile, stat, readdir, unlink } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZVUK = path.join(KORIJEN, "public/audio/citanje");
const KRAJNJA_TACKA = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Wavenet-A, ženski. Izabran poslije slušanja četiri glasa na petnaest
// stavki biranih da pogode slabe tačke; jedini koji nije razvukao nijedan
// izolovani slog.
const GLAS = "ar-XA-Wavenet-A";

const argumenti = process.argv.slice(2);
const PRIMIJENI = argumenti.includes("--primijeni");
const broj = (ime) => {
  const i = argumenti.indexOf(ime);
  return i >= 0 && argumenti[i + 1] ? Number(argumenti[i + 1]) : null;
};
const SAMO_LEKCIJA = broj("--lekcija");

if (spawnSync("ffmpeg", ["-version"]).status !== 0) throw new Error("Nedostaje ffmpeg.");

// Node-ov ugrađeni fetch ne gleda HTTPS_PROXY. U okruženju gdje ključ ubacuje
// posrednik to znači da zahtjev ode pravo Googleu, bez ključa, i vrati se 403
// „unregistered caller". Tamo gdje posrednika nema — na Replitu, na serveru —
// ovo se preskoči i fetch radi kako inače radi.
const POSREDNIK = process.env.HTTPS_PROXY || process.env.https_proxy;
if (POSREDNIK && !process.env.NODE_USE_ENV_PROXY) {
  // Node 22 zna sam, ali tek ako se zastavica postavi prije pokretanja —
  // ovdje je prekasno. Undici radi isto, kad je dostupan.
  try {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new EnvHttpProxyAgent());
  } catch {
    console.error("Postavljen je HTTPS_PROXY, a undici nije dostupan, pa Node ne bi");
    console.error("vidio posrednika i Google bi odbio zahtjev. Pokreni ovako:\n");
    console.error("  NODE_USE_ENV_PROXY=1 node artifacts/mekteb-arapsko-pismo/scripts/generisi-zvuk-citanja.mjs" + process.argv.slice(2).map((a) => ` ${a}`).join(""));
    process.exit(1);
  }
}

function pokreni(naredba, argumenti) {
  return new Promise((rijesi, odbij) => {
    const d = spawn(naredba, argumenti);
    let greska = "";
    d.stderr.on("data", (x) => { greska += x; });
    d.on("close", (kod) => (kod === 0 ? rijesi() : odbij(new Error(greska.slice(0, 300)))));
  });
}

const imeDatoteke = (zapis) => `rijec-${Buffer.from(zapis).toString("hex")}.mp3`;

async function sintetiziraj(zapis) {
  const o = await fetch(KRAJNJA_TACKA, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: zapis },
      voice: { languageCode: "ar-XA", name: GLAS },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!o.ok) throw new Error(`Google je odbio (${o.status}): ${(await o.text()).slice(0, 200)}`);
  const { audioContent } = await o.json();
  if (!audioContent) throw new Error("Odgovor bez zvuka.");
  return Buffer.from(audioContent, "base64");
}

/** Isti format kao ostatak zbirke: mono 44,1 kHz, 96 kb/s, bez tišine na krajevima. */
async function obradi(sirovi, odrediste) {
  const privremeno = path.join(os.tmpdir(), `tts-${process.pid}-${Math.random().toString(36).slice(2)}.mp3`);
  await writeFile(privremeno, sirovi);
  await pokreni("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", privremeno,
    "-af", "silenceremove=start_periods=1:start_threshold=-40dB:stop_periods=-1:stop_threshold=-40dB,loudnorm=I=-18:TP=-2:LRA=7",
    "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "96k", odrediste,
  ]);
  await unlink(privremeno).catch(() => {});
}

// ── Šta treba ozvučiti ───────────────────────────────────────────────────
// Podaci žive u TypeScriptu. Da skripta ne ovisi o alatu za tipove, spisak se
// čita iz izvora — polja su jednostavna i pisana u jednom redu baš zato.
const spisak = [];
{
  const { readFile } = await import("node:fs/promises");
  const izvor = await readFile(path.join(KORIJEN, "src/data/citanje-rijeci.ts"), "utf8");
  for (const m of izvor.matchAll(/zapis:\s*"([^"]+)",\s*citanje:\s*"([^"]*)",[^}]*?lekcija:\s*(\d+)/g)) {
    spisak.push({ zapis: m[1], citanje: m[2], lekcija: Number(m[3]) });
  }
  const slogovi = await readFile(path.join(KORIJEN, "src/data/citanje-slogovi.ts"), "utf8").catch(() => "");
  for (const m of slogovi.matchAll(/zapis:\s*"([^"]+)",\s*citanje:\s*"([^"]*)",[^}]*?lekcija:\s*(\d+)/g)) {
    spisak.push({ zapis: m[1], citanje: m[2], lekcija: Number(m[3]) });
  }
}

const trazeni = spisak.filter((s) => SAMO_LEKCIJA === null || s.lekcija === SAMO_LEKCIJA);
if (!trazeni.length) { console.error("Nijedna stavka ne odgovara."); process.exit(1); }

await mkdir(ZVUK, { recursive: true });
const vecImamo = new Set(await readdir(ZVUK).catch(() => []));

let znakova = 0, novih = 0, preskoceno = 0;
console.log(`Glas: ${GLAS}\n`);
for (const s of trazeni) {
  const ime = imeDatoteke(s.zapis);
  if (vecImamo.has(ime)) { preskoceno += 1; continue; }
  znakova += s.zapis.length;
  novih += 1;
  if (!PRIMIJENI) { console.log(`  ${s.zapis.padEnd(10)} ${s.citanje.padEnd(8)} lekcija ${s.lekcija}  →  ${ime}`); continue; }
  try {
    await obradi(await sintetiziraj(s.zapis), path.join(ZVUK, ime));
    console.log(`  ${s.zapis.padEnd(10)} ${s.citanje.padEnd(8)} lekcija ${s.lekcija}  →  ${ime}`);
  } catch (g) {
    console.error(`  GREŠKA ${s.zapis}: ${g.message}`);
    process.exitCode = 1;
  }
}

console.log(`\nNovih ${novih}, već postoji ${preskoceno}. Poslano ${znakova} znakova.`);
if (!PRIMIJENI) console.log("Nije napravljeno ništa. Ponovi s --primijeni.");
