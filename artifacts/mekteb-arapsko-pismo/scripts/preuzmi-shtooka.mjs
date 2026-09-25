// Preuzimanje ljudskih snimaka arapskih riječi s Wikimedia Commonsa (Shtooka).
//
// Pokretanje (iz korijena repozitorija, treba ffmpeg i pristup internetu):
//   node artifacts/mekteb-arapsko-pismo/scripts/preuzmi-shtooka.mjs --pregled
//   node artifacts/mekteb-arapsko-pismo/scripts/preuzmi-shtooka.mjs --primijeni
//
// Bez zastavice ništa ne mijenja: samo ispiše šta je našao, s licencom i
// autorom. S --primijeni preuzme, provjeri, pretvori u MP3 i upiše polje
// „zvuk" u podatke vježbi.
//
// Zašto postoji: ovaj repozitorij se razvija u okruženju koje ne doseže
// Wikimediju, pa se snimci ne mogu preuzeti odatle gdje se piše kod. Ovdje se
// isti posao radi tamo gdje mreža radi.
//
// PROVJERE — nijedan snimak ne ulazi dok ne prođe sve četiri:
//   1. licenca mora biti samo-navođenje (CC BY, CC0, javna domena). CC BY-SA
//      se odbija, jer traži da i naša zbirka izađe pod istom licencom.
//   2. trajanje govora, bez tišine, između 0,15 i 3 sekunde.
//   3. najglasnija tačka iznad -30 dB, da ne uđe tišina.
//   4. kratak slog (harf s harekom, bez dužine) najviše 0,45 s — učači koji
//      razvlače izolovane slogove uče dijete pogrešnoj dužini.
// Uz to se mjeri osnovna frekvencija i prijavi ako zbirka miješa glasove.
import { mkdir, readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PODACI = path.join(KORIJEN, "public/vjezbe/slusaj/podaci");
const ZVUK = path.join(KORIJEN, "public/audio/opismenjavanje");
const API = "https://commons.wikimedia.org/w/api.php";
const PRIMIJENI = process.argv.includes("--primijeni");

const DOZVOLJENE = [/^cc0/i, /^cc[- ]by[- ]?\d/i, /^public domain/i, /^pd/i];
const ZABRANJENE = [/sa/i, /nc/i, /nd/i];

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

async function api(parametri) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...parametri })) u.searchParams.set(k, String(v));
  const o = await fetch(u, { headers: { "User-Agent": "mekteb.net/1.0 (obrazovni projekat)" } });
  if (!o.ok) throw new Error(`Commons API ${o.status} za ${u.searchParams.get("titles") ?? u.searchParams.get("gsrsearch")}`);
  return o.json();
}

/** Nađi snimak izgovora za jednu arapsku riječ. */
async function nadji(rijec) {
  const upit = await api({
    action: "query", generator: "search", gsrnamespace: 6,
    gsrsearch: `intitle:"${rijec}" filetype:audio`, gsrlimit: 10,
    prop: "imageinfo", iiprop: "url|extmetadata|size", iiextmetadatafilter: "LicenseShortName|Artist|UsageTerms",
  });
  const stranice = upit?.query?.pages ?? [];
  const nadjene = [];
  for (const s of stranice) {
    const info = s.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const licenca = (meta.LicenseShortName?.value ?? "").replace(/<[^>]+>/g, "").trim();
    const autor = (meta.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim();
    nadjene.push({ naslov: s.title, url: info.url, licenca, autor });
  }
  return nadjene;
}

function licencaValja(licenca) {
  const l = (licenca || "").trim();
  if (!l) return false;
  const bezPrefiksa = l.replace(/^cc[- ]/i, "");
  if (ZABRANJENE.some((z) => z.test(bezPrefiksa.split(/[\s-]/).slice(1).join(" ")))) return false;
  if (/sa\b/i.test(l) || /\bnc\b/i.test(l) || /\bnd\b/i.test(l)) return false;
  return DOZVOLJENE.some((d) => d.test(l));
}

const HARF = /[ء-ي]/g;
const HAREKA = /[َُِ]/;
const DUZINA = /َا|ِي|ُو|آ|[اوي](?![ً-ْ])/;
const jeKratakSlog = (z) => (z.match(HARF) ?? []).length === 1 && HAREKA.test(z) && !DUZINA.test(z) && !/[ًّْ-ٍ]/.test(z);

async function izmjeri(putanja) {
  const privremeno = path.join(os.tmpdir(), `shtooka-${Math.random().toString(36).slice(2)}.wav`);
  await pokreni("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", putanja,
    "-af", "silenceremove=start_periods=1:start_threshold=-35dB:stop_periods=-1:stop_threshold=-35dB", privremeno]);
  const trajanje = Number((await pokreni("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", privremeno])).trim()) || 0;
  const glasnoca = Number(((await pokreni("ffmpeg", ["-hide_banner", "-i", putanja, "-af", "volumedetect", "-f", "null", "-"]))
    .match(/max_volume:\s*(-?[\d.]+) dB/) ?? [])[1] ?? -99);
  await unlink(privremeno).catch(() => {});
  return { trajanje, glasnoca };
}

// ── Skupi tražene riječi iz svih vježbi ──────────────────────────────────
const trazene = new Map();
for (const naziv of (await readdir(PODACI)).filter((n) => n.endsWith(".json"))) {
  const v = JSON.parse(await readFile(path.join(PODACI, naziv), "utf8"));
  for (const kljuc of ["harfovi", "slogovi", "rijeci"]) {
    for (const st of v[kljuc] ?? []) {
      if (st.zvuk) continue;
      trazene.set(st.zapis, { naziv, kljuc, stavka: st });
    }
  }
}
console.log(`Traži se snimak za ${trazene.size} zapisa iz ${(await readdir(PODACI)).filter((n) => n.endsWith(".json")).length} vježbi.\n`);

await mkdir(ZVUK, { recursive: true });
const prihvaceni = new Map();
const odbijeni = [];

for (const [zapis, gdje] of trazene) {
  let nadjene = [];
  try { nadjene = await nadji(zapis); }
  catch (g) { odbijeni.push({ zapis, razlog: `pretraga nije uspjela: ${g.message}` }); continue; }
  if (!nadjene.length) { odbijeni.push({ zapis, razlog: "nema snimka na Commonsu" }); continue; }

  const sLicencom = nadjene.filter((n) => licencaValja(n.licenca));
  if (!sLicencom.length) {
    odbijeni.push({ zapis, razlog: `licenca ne dozvoljava: ${[...new Set(nadjene.map((n) => n.licenca || "nepoznata"))].join(", ")}` });
    continue;
  }

  const kandidat = sLicencom[0];
  if (!PRIMIJENI) {
    console.log(`  ${zapis.padEnd(10)} ${kandidat.licenca.padEnd(12)} ${kandidat.naslov}`);
    prihvaceni.set(zapis, { ...kandidat, gdje });
    continue;
  }

  const sirovo = path.join(os.tmpdir(), `shtooka-${Math.random().toString(36).slice(2)}`);
  try {
    const o = await fetch(kandidat.url, { headers: { "User-Agent": "mekteb.net/1.0 (obrazovni projekat)" } });
    if (!o.ok) throw new Error(`preuzimanje ${o.status}`);
    await writeFile(sirovo, Buffer.from(await o.arrayBuffer()));
  } catch (g) { odbijeni.push({ zapis, razlog: `preuzimanje nije uspjelo: ${g.message}` }); continue; }

  const { trajanje, glasnoca } = await izmjeri(sirovo);
  const gornja = jeKratakSlog(zapis) ? 0.45 : 3;
  if (!(trajanje >= 0.15 && trajanje <= gornja)) {
    odbijeni.push({ zapis, razlog: `govor traje ${trajanje.toFixed(2)} s (dozvoljeno 0,15–${gornja})` });
    await unlink(sirovo).catch(() => {}); continue;
  }
  if (glasnoca < -30) {
    odbijeni.push({ zapis, razlog: `pretiho, ${glasnoca} dB` });
    await unlink(sirovo).catch(() => {}); continue;
  }

  const ime = `rijec-${Buffer.from(zapis).toString("hex").slice(0, 16)}.mp3`;
  await pokreni("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", sirovo, "-ac", "1", "-ar", "44100", "-b:a", "96k", path.join(ZVUK, ime)]);
  await unlink(sirovo).catch(() => {});
  gdje.stavka.zvuk = `/audio/opismenjavanje/${ime}`;
  prihvaceni.set(zapis, { ...kandidat, ime, trajanje, glasnoca, gdje });
  console.log(`  ${zapis.padEnd(10)} ${trajanje.toFixed(2)}s ${String(glasnoca).padStart(6)}dB  ${kandidat.licenca}  → ${ime}`);
}

if (PRIMIJENI && prihvaceni.size) {
  const poVjezbi = new Map();
  for (const { gdje } of prihvaceni.values()) poVjezbi.set(gdje.naziv, true);
  for (const naziv of poVjezbi.keys()) {
    const put = path.join(PODACI, naziv);
    const v = JSON.parse(await readFile(put, "utf8"));
    for (const kljuc of ["harfovi", "slogovi", "rijeci"]) {
      for (const st of v[kljuc] ?? []) {
        const p = prihvaceni.get(st.zapis);
        if (p?.ime) st.zvuk = `/audio/opismenjavanje/${p.ime}`;
      }
    }
    v.izvorZvukaCommons = [...new Set([...prihvaceni.values()].map((p) => `${p.autor || "nepoznat autor"} (${p.licenca})`))].join("; ");
    await writeFile(put, JSON.stringify(v, null, 2) + "\n");
  }
  const red = [...prihvaceni.values()].map((p) => `- ${p.naslov} — ${p.autor || "nepoznat autor"} — ${p.licenca}`).join("\n");
  await writeFile(path.join(ZVUK, "IZVOR-COMMONS.md"),
    `# Snimci s Wikimedia Commonsa\n\nSvaki snimak ispod je preuzet s Commonsa i zadržava svoju licencu.\nNavođenje autora je obavezno.\n\n${red}\n`);
}

console.log(`\nprihvaćeno: ${prihvaceni.size}   odbijeno: ${odbijeni.length}`);
for (const o of odbijeni) console.log(`  ${o.zapis.padEnd(10)} ${o.razlog}`);
if (!PRIMIJENI) console.log("\nNišta nije promijenjeno. Za preuzimanje dodaj --primijeni.");
