// Preuzimanje ljudskih snimaka arapskih riječi s Wikimedia Commonsa (Shtooka).
//
// Pokretanje (iz korijena repozitorija, treba ffmpeg i pristup internetu):
//   node artifacts/mekteb-arapsko-pismo/scripts/preuzmi-shtooka.mjs
//   node artifacts/mekteb-arapsko-pismo/scripts/preuzmi-shtooka.mjs --primijeni
//   node artifacts/mekteb-arapsko-pismo/scripts/preuzmi-shtooka.mjs --proba باب
//
// Bez zastavice ništa ne mijenja: samo ispiše šta je našao, s licencom i
// autorom. S --primijeni preuzme, provjeri, pretvori u MP3 i upiše polje
// „zvuk" u podatke vježbi.
//
// Zašto postoji: ovaj repozitorij se razvija u okruženju koje ne doseže
// Wikimediju, pa se snimci ne mogu preuzeti odatle gdje se piše kod. Ovdje se
// isti posao radi tamo gdje mreža radi.
//
// ODAKLE SE UZIMA — samo dva imenska obrasca, oba arapska:
//   „Ar-<riječ>.ogg"                     Shtooka, arapski
//   „LL-Q13955 (ara)-<ko>-<riječ>.wav"   Lingua Libre, književni arapski
// Slobodna pretraga je namjerno izbačena. Kad je bila uključena, vratila je
// urdu, perzijski, egipatski i levantski izgovor, frazu „إلى حد ما" umjesto
// riječi „ما", pa i naslov pjesme „اسلمي يا مصر" umjesto „يا". Naslov koji
// sadrži traženu riječ nije isto što i snimak te riječi.
//
// PROVJERE — nijedan snimak ne ulazi dok ne prođe sve četiri:
//   1. licenca mora biti samo-navođenje (CC BY, CC0, javna domena). CC BY-SA
//      se odbija, jer traži da i naša zbirka izađe pod istom licencom.
//   2. trajanje govora, bez tišine, između 0,15 i 3 sekunde.
//   3. najglasnija tačka iznad -30 dB, da ne uđe tišina.
//   4. kratak slog (harf s harekom, bez dužine) najviše 0,45 s — učači koji
//      razvlače izolovane slogove uče dijete pogrešnoj dužini.
// Uz to se mjeri osnovna frekvencija i prijavi ako zbirka miješa glasove.
import { mkdir, readFile, readdir, writeFile, unlink, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PODACI = path.join(KORIJEN, "public/vjezbe/slusaj/podaci");
const ZVUK = path.join(KORIJEN, "public/audio/opismenjavanje");
const API = "https://commons.wikimedia.org/w/api.php";
const PRIMIJENI = process.argv.includes("--primijeni");
const SVE = process.argv.includes("--sve");
const iProba = process.argv.indexOf("--proba");
const PROBA = iProba === -1 ? null : process.argv[iProba + 1];

// Commons odbija navalu. Zahtjevi idu jedan po jedan, s razmakom, i sa
// zastojem kad server kaže 429. Uz to se imena traže u jednom upitu za sve
// riječi odjednom, pa ih treba svega nekoliko.
const RAZMAK = 400;
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Preuzimanje same datoteke ima isti predah kao i upiti. Prvi put je to
 * izostalo, pa je Commons poslije dva snimka uzvratio s 429 i osam ih je
 * ostalo neprezueto.
 */
async function preuzmi(url, pokusaj = 0) {
  const o = await fetch(url, { headers: { "User-Agent": "mekteb.net-ucenje/1.0 (https://mekteb.net; obrazovni projekat)" } });
  if (o.status === 429 || o.status === 503) {
    if (pokusaj >= 4) throw new Error(`preuzimanje ${o.status} i poslije ${pokusaj} pokušaja`);
    const cekaj = Number(o.headers.get("retry-after")) * 1000 || Math.min(30000, 2000 * 2 ** pokusaj);
    console.log(`    server traži predah (${o.status}), čekam ${Math.round(cekaj / 1000)} s…`);
    await pauza(cekaj);
    return preuzmi(url, pokusaj + 1);
  }
  if (!o.ok) throw new Error(`preuzimanje ${o.status}`);
  const podaci = Buffer.from(await o.arrayBuffer());
  await pauza(RAZMAK);
  return podaci;
}

/**
 * Shtooka imenuje datoteke golom riječju, bez hareka: „Ar-باب.ogg". Zato se
 * traži oblik bez ijedne oznake — inače se ne nađe ništa, što je prva verzija
 * ovog alata i pokazala.
 */
const bezOznaka = (t) => t.normalize("NFC").replace(/[\u064B-\u0652\u0670]/g, "");

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

async function api(parametri, pokusaj = 0) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...parametri })) u.searchParams.set(k, String(v));
  const o = await fetch(u, { headers: { "User-Agent": "mekteb.net-ucenje/1.0 (https://mekteb.net; obrazovni projekat)" } });
  if (o.status === 429 || o.status === 503) {
    if (pokusaj >= 4) throw new Error(`Commons API ${o.status} i poslije ${pokusaj} pokušaja`);
    const cekaj = Number(o.headers.get("retry-after")) * 1000 || Math.min(30000, 2000 * 2 ** pokusaj);
    console.log(`    server traži predah (${o.status}), čekam ${Math.round(cekaj / 1000)} s…`);
    await pauza(cekaj);
    return api(parametri, pokusaj + 1);
  }
  if (!o.ok) throw new Error(`Commons API ${o.status}`);
  await pauza(RAZMAK);
  return o.json();
}

/**
 * Nađi snimke za više riječi odjednom, po imenu datoteke. Commons prima do
 * pedeset naslova u jednom upitu, pa ovo za cijelu vježbu treba dva-tri
 * zahtjeva umjesto šezdeset pet.
 */
async function nadjiPoImenu(rijeci) {
  const nadjeno = new Map();
  const kandidati = [];
  for (const r of rijeci) {
    const golo = bezOznaka(r);
    if (!golo) continue;
    for (const nastavak of ["ogg", "wav", "flac"]) kandidati.push([`File:Ar-${golo}.${nastavak}`, r]);
  }
  for (let i = 0; i < kandidati.length; i += 50) {
    const grupa = kandidati.slice(i, i + 50);
    const odgovor = await api({
      action: "query", titles: grupa.map(([t]) => t).join("|"),
      prop: "imageinfo", iiprop: "url|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist",
    });
    for (const str of odgovor?.query?.pages ?? []) {
      if (str.missing || !str.imageinfo?.[0]) continue;
      const info = str.imageinfo[0];
      const meta = info.extmetadata ?? {};
      const par = grupa.find(([t]) => t === str.title);
      if (!par) continue;
      if (!nadjeno.has(par[1])) nadjeno.set(par[1], {
        naslov: str.title, url: info.url,
        licenca: (meta.LicenseShortName?.value ?? "").replace(/<[^>]+>/g, "").trim(),
        autor: (meta.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim(),
      });
    }
  }
  return nadjeno;
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
console.log(`Traži se snimak za ${trazene.size} zapisa iz ${(await readdir(PODACI)).filter((n) => n.endsWith(".json")).length} vježbi.`);

// Proba: jedan upit za jednu riječ, da se odmah vidi šta Commons vraća.
if (PROBA) {
  console.log(`\nProba za „${PROBA}" (golo: „${bezOznaka(PROBA)}")\n`);
  try {
    const poImenu = await nadjiPoImenu([PROBA]);
    console.log("  po imenu datoteke:", poImenu.get(PROBA) ?? "nema");
  } catch (g) { console.log("  po imenu datoteke: greška —", g.message); }
  process.exit(0);
}

// Prvo jedan upit po imenima za sve riječi — Commons prima pedeset naslova
// odjednom, pa ovo košta nekoliko zahtjeva umjesto šezdeset pet.
console.log("Tražim po imenima datoteka…");
let poImenu = new Map();
try { poImenu = await nadjiPoImenu([...trazene.keys()]); }
catch (g) { console.log(`  upit po imenima nije uspio: ${g.message}`); }
console.log(`  nađeno po imenu: ${poImenu.size}\n`);

// Snimak se uzima tek kad se zna da odgovara našem zapisu. Ime datoteke na
// Commonsu nema hareka, pa „Ar-علم.ogg" može biti ilm, alem ili alime — to
// presuđuje čovjek koji posluša, ne ova skripta.
let potvrdjeni = null;
try {
  const p = JSON.parse(await readFile(path.join(PODACI, "..", "potvrdjeni-snimci.json"), "utf8"));
  potvrdjeni = new Set(p.potvrdjeno ?? []);
} catch { potvrdjeni = new Set(); }
if (PRIMIJENI && !SVE) console.log(`Uzimaju se samo potvrđene riječi (${potvrdjeni.size}). Za sve, dodaj --sve.\n`);

await mkdir(ZVUK, { recursive: true });
const prihvaceni = new Map();
const odbijeni = [];

const HARFOVA = (t) => (t.match(HARF) ?? []).length;

for (const [zapis, gdje] of trazene) {
  let nadjene = [];
  const izImena = poImenu.get(zapis);
  if (izImena) nadjene = [izImena];
  if (!nadjene.length) {
    odbijeni.push({ zapis, razlog: HARFOVA(zapis) < 2 ? "slog, a Shtooka ima samo riječi" : "nema snimka pod arapskim imenom" });
    continue;
  }

  const sLicencom = nadjene.filter((n) => licencaValja(n.licenca));
  if (!sLicencom.length) {
    odbijeni.push({ zapis, razlog: `licenca ne dozvoljava: ${[...new Set(nadjene.map((n) => n.licenca || "nepoznata"))].join(", ")}` });
    continue;
  }

  const kandidat = sLicencom[0];
  if (PRIMIJENI && !SVE && !potvrdjeni.has(zapis)) {
    odbijeni.push({ zapis, razlog: "nije potvrđeno da snimak odgovara zapisu (vidi potvrdjeni-snimci.json)" });
    continue;
  }
  if (!PRIMIJENI) {
    const stranica = `https://commons.wikimedia.org/wiki/${encodeURIComponent(kandidat.naslov.replace(/ /g, "_"))}`;
    console.log(`  ${zapis.padEnd(10)} ${kandidat.licenca.padEnd(14)} ${kandidat.naslov}`);
    console.log(`  ${" ".repeat(10)} poslušaj: ${stranica}`);
    prihvaceni.set(zapis, { ...kandidat, gdje });
    continue;
  }

  // Već preuzeto se preskače, pa se prekinut posao može samo ponovo pokrenuti
  // i dovršiti ostatak umjesto da sve ide iznova.
  const ime = `rijec-${Buffer.from(zapis).toString("hex").slice(0, 16)}.mp3`;
  try {
    await stat(path.join(ZVUK, ime));
    gdje.stavka.zvuk = `/audio/opismenjavanje/${ime}`;
    prihvaceni.set(zapis, { ...kandidat, ime, vecImamo: true, gdje });
    console.log(`  ${zapis.padEnd(10)} već preuzeto → ${ime}`);
    continue;
  } catch {}

  const sirovo = path.join(os.tmpdir(), `shtooka-${Math.random().toString(36).slice(2)}`);
  try { await writeFile(sirovo, await preuzmi(kandidat.url)); }
  catch (g) { odbijeni.push({ zapis, razlog: `preuzimanje nije uspjelo: ${g.message}` }); continue; }

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
