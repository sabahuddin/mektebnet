// Generator ukrštenica za mekteb.net.
//
// Iz baze tema (teme.json), čiji su pojmovi provjereni naspram ilmihal lekcija,
// slaže mrežu ukrštenice i štampa PDF: prva stranica je radni list (prazna mreža
// + tragovi), druga je rješenje (popunjena mreža).
//
//   node scripts/ukrstenice/generate.mjs                 # sve teme
//   node scripts/ukrstenice/generate.mjs 03-namaz        # samo jedna tema
//   node scripts/ukrstenice/generate.mjs --seed 7        # drugi raspored iste teme
//   node scripts/ukrstenice/generate.mjs --html          # ostavi i .html fajlove
//
// PDF nastaje kroz Chromium (--headless --print-to-pdf). Putanja do Chromiuma
// uzima se iz CHROME_BIN, PLAYWRIGHT_BROWSERS_PATH ili uobičajenih lokacija.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IZLAZ = path.join(HERE, "pdf");
// Umanjena (440 px) print-varijanta logotipa iz artifacts/mekteb-arapsko-pismo/public/logo-mekteb.png.
// Logo se u HTML ugrađuje kao data URI, pa bi original od 2000 px bespotrebno
// napuhao svaki PDF na više stotina kilobajta.
const LOGO = path.join(HERE, "logo-print.png");

// ───────────────────────────── slaganje mreže ─────────────────────────────

/**
 * Riječ se u mreži piše bez razmaka i crtica. Slova Č, Ć, Ž, Š i Đ zauzimaju
 * jedno polje; DŽ se piše kao D + Ž, dakle dva polja — kao u klasičnim
 * mektebskim ukrštenicama.
 */
function uSlova(rijec) {
  return [...rijec.toUpperCase().replace(/[^A-ZČĆŽŠĐ]/gi, "")];
}

/** Deterministički generator slučajnih brojeva, da isti seed daje isti raspored. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function promijesaj(niz, rand) {
  const a = niz.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const VEL = 96; // radna mreža; gotova ukrštenica se poslije obreže na sadržaj

function praznaMreza() {
  return Array.from({ length: VEL }, () => new Array(VEL).fill(null));
}

function slovo(m, r, c) {
  if (r < 0 || c < 0 || r >= VEL || c >= VEL) return null;
  return m[r][c];
}

/**
 * Može li riječ stati na (r,c) u datom smjeru? Vraća broj ukrštanja ili -1.
 * Pravila su standardna: riječ ne smije nalijegati na drugu riječ bočno niti se
 * nastavljati na postojeću, a na presjeku se slova moraju poklopiti.
 */
function provjeri(m, slova, r, c, vodoravno) {
  const dr = vodoravno ? 0 : 1;
  const dc = vodoravno ? 1 : 0;
  const n = slova.length;

  if (r < 1 || c < 1) return -1;
  if (vodoravno ? c + n >= VEL - 1 : r + n >= VEL - 1) return -1;

  // polje neposredno prije i poslije riječi mora biti prazno
  if (slovo(m, r - dr, c - dc) !== null) return -1;
  if (slovo(m, r + dr * n, c + dc * n) !== null) return -1;

  let ukrstanja = 0;
  for (let i = 0; i < n; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const postojece = slovo(m, rr, cc);
    if (postojece !== null) {
      if (postojece !== slova[i]) return -1;
      ukrstanja++;
      continue;
    }
    // prazno polje ne smije imati susjeda okomito na smjer riječi
    if (vodoravno) {
      if (slovo(m, rr - 1, cc) !== null || slovo(m, rr + 1, cc) !== null) return -1;
    } else {
      if (slovo(m, rr, cc - 1) !== null || slovo(m, rr, cc + 1) !== null) return -1;
    }
  }
  return ukrstanja;
}

function upisi(m, slova, r, c, vodoravno) {
  for (let i = 0; i < slova.length; i++) {
    m[r + (vodoravno ? 0 : i)][c + (vodoravno ? i : 0)] = slova[i];
  }
}

/** Jedan pokušaj slaganja: vraća { postavljeni, mreza }. */
function pokusaj(unosi, seed) {
  const rand = rng(seed);
  const m = praznaMreza();
  const postavljeni = [];

  // najduže riječi prve — one nose kostur mreže
  const redoslijed = promijesaj(unosi, rand).sort((a, b) => b.slova.length - a.slova.length);

  const prva = redoslijed[0];
  const r0 = Math.floor(VEL / 2);
  const c0 = Math.floor((VEL - prva.slova.length) / 2);
  upisi(m, prva.slova, r0, c0, true);
  postavljeni.push({ ...prva, r: r0, c: c0, vodoravno: true });

  for (const u of redoslijed.slice(1)) {
    let najbolje = null;
    for (const p of postavljeni) {
      for (let i = 0; i < p.slova.length; i++) {
        const cilj = p.slova[i];
        for (let j = 0; j < u.slova.length; j++) {
          if (u.slova[j] !== cilj) continue;
          // nova riječ ide okomito na onu na koju se kači
          const vodoravno = !p.vodoravno;
          const r = vodoravno ? p.r + (p.vodoravno ? 0 : i) : p.r + (p.vodoravno ? 0 : i) - j;
          const c = vodoravno ? p.c + (p.vodoravno ? i : 0) - j : p.c + (p.vodoravno ? i : 0);
          const ukrstanja = provjeri(m, u.slova, r, c, vodoravno);
          if (ukrstanja < 1) continue;
          // biramo raspored s najviše ukrštanja, a zatim najzbijeniji
          const ocjena = ukrstanja * 1000 - (Math.abs(r - VEL / 2) + Math.abs(c - VEL / 2));
          if (!najbolje || ocjena > najbolje.ocjena) najbolje = { r, c, vodoravno, ocjena };
        }
      }
    }
    if (najbolje) {
      upisi(m, u.slova, najbolje.r, najbolje.c, najbolje.vodoravno);
      postavljeni.push({ ...u, r: najbolje.r, c: najbolje.c, vodoravno: najbolje.vodoravno });
    }
  }
  return { postavljeni, mreza: m };
}

/** Više pokušaja; bira se onaj s najviše smještenih riječi i najzbijenijom mrežom. */
function slozi(unosi, seed, pokusaja = 400) {
  const pripremljeni = unosi.map((u) => ({ ...u, slova: uSlova(u.o) }));
  let najbolji = null;

  for (let k = 0; k < pokusaja; k++) {
    const kandidat = pokusaj(pripremljeni, seed * 7919 + k * 104729 + 1);
    const p = kandidat.postavljeni;
    let rMin = VEL, rMax = 0, cMin = VEL, cMax = 0;
    for (const w of p) {
      const rE = w.r + (w.vodoravno ? 0 : w.slova.length - 1);
      const cE = w.c + (w.vodoravno ? w.slova.length - 1 : 0);
      rMin = Math.min(rMin, w.r); rMax = Math.max(rMax, rE);
      cMin = Math.min(cMin, w.c); cMax = Math.max(cMax, cE);
    }
    const visina = rMax - rMin + 1;
    const sirina = cMax - cMin + 1;
    // više riječi je najvažnije; zatim manja površina; zatim oblik bliži kvadratu
    const ocjena = p.length * 100000 - visina * sirina - Math.abs(visina - sirina) * 40;
    if (!najbolji || ocjena > najbolji.ocjena) {
      najbolji = { ...kandidat, ocjena, rMin, rMax, cMin, cMax, visina, sirina };
    }
  }
  return najbolji;
}

/** Obreže mrežu na sadržaj i dodijeli brojeve poljima na kojima riječ počinje. */
function numerisi(rezultat) {
  const { mreza, rMin, cMin, visina, sirina } = rezultat;
  const polja = Array.from({ length: visina }, (_, r) =>
    Array.from({ length: sirina }, (_, c) => mreza[rMin + r][cMin + c])
  );

  const rijeci = rezultat.postavljeni.map((w) => ({ ...w, r: w.r - rMin, c: w.c - cMin }));
  const brojPolja = new Map();
  let broj = 0;
  for (let r = 0; r < visina; r++) {
    for (let c = 0; c < sirina; c++) {
      if (polja[r][c] === null) continue;
      const pocetakVodoravno = (c === 0 || polja[r][c - 1] === null) && c + 1 < sirina && polja[r][c + 1] !== null;
      const pocetakUspravno = (r === 0 || polja[r - 1][c] === null) && r + 1 < visina && polja[r + 1][c] !== null;
      if (pocetakVodoravno || pocetakUspravno) brojPolja.set(`${r},${c}`, ++broj);
    }
  }
  for (const w of rijeci) w.broj = brojPolja.get(`${w.r},${w.c}`);

  const vodoravno = rijeci.filter((w) => w.vodoravno).sort((a, b) => a.broj - b.broj);
  const uspravno = rijeci.filter((w) => !w.vodoravno).sort((a, b) => a.broj - b.broj);
  return { polja, visina, sirina, brojPolja, vodoravno, uspravno, rijeci };
}

/**
 * Sigurnosna provjera složene mreže: svaka riječ mora se u mreži čitati tačno
 * onako kako je zapisana, i nijedan niz od dva ili više susjednih slova ne smije
 * ostati bez svog traga. Bez ovoga bi greška u slaganju prošla nezapaženo tek
 * kada je muallim već odštampa.
 */
function provjeriMrezu(u) {
  const greske = [];

  for (const w of u.rijeci) {
    const procitano = w.slova
      .map((_, i) => u.polja[w.r + (w.vodoravno ? 0 : i)][w.c + (w.vodoravno ? i : 0)])
      .join("");
    if (procitano !== w.slova.join("")) {
      greske.push(`riječ ${w.o} se u mreži čita kao ${procitano}`);
    }
    if (!w.broj) greske.push(`riječ ${w.o} nije dobila broj`);
  }

  const ocekivane = new Map();
  for (const w of u.rijeci) {
    const kljuc = `${w.vodoravno ? "V" : "U"}:${w.r},${w.c}`;
    ocekivane.set(kljuc, w.slova.join(""));
  }

  for (const vodoravno of [true, false]) {
    const vanjska = vodoravno ? u.visina : u.sirina;
    const unutarnja = vodoravno ? u.sirina : u.visina;
    for (let a = 0; a < vanjska; a++) {
      let niz = "";
      let pocetak = 0;
      for (let b = 0; b <= unutarnja; b++) {
        const slovo = b < unutarnja ? (vodoravno ? u.polja[a][b] : u.polja[b][a]) : null;
        if (slovo !== null) {
          if (!niz) pocetak = b;
          niz += slovo;
          continue;
        }
        if (niz.length > 1) {
          const r = vodoravno ? a : pocetak;
          const c = vodoravno ? pocetak : a;
          const kljuc = `${vodoravno ? "V" : "U"}:${r},${c}`;
          if (ocekivane.get(kljuc) !== niz) {
            greske.push(`niz "${niz}" na ${r + 1}. redu / ${c + 1}. koloni nema svoj trag`);
          }
        }
        niz = "";
      }
    }
  }
  return greske;
}

// ───────────────────────────── ispis u HTML ─────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mrezaHtml(u, saRjesenjem) {
  const redovi = [];
  for (let r = 0; r < u.visina; r++) {
    const celije = [];
    for (let c = 0; c < u.sirina; c++) {
      const slovo = u.polja[r][c];
      if (slovo === null) {
        celije.push('<td class="prazno"></td>');
        continue;
      }
      const broj = u.brojPolja.get(`${r},${c}`);
      celije.push(
        `<td class="polje"${saRjesenjem ? ' data-rj="1"' : ""}>` +
          (broj ? `<span class="br">${broj}</span>` : "") +
          (saRjesenjem ? `<span class="sl">${esc(slovo)}</span>` : "") +
          "</td>"
      );
    }
    redovi.push(`<tr>${celije.join("")}</tr>`);
  }
  return `<table class="mreza"><tbody>${redovi.join("")}</tbody></table>`;
}

function tragoviHtml(u) {
  const lista = (rijeci) =>
    rijeci
      .map((w) => `<li><b>${w.broj}.</b> ${esc(w.t)} <span class="duz">(${w.slova.length})</span></li>`)
      .join("");
  return `
  <div class="tragovi">
    <div class="kolona">
      <h3>Vodoravno</h3>
      <ol class="cl">${lista(u.vodoravno)}</ol>
    </div>
    <div class="kolona">
      <h3>Uspravno</h3>
      <ol class="cl">${lista(u.uspravno)}</ol>
    </div>
  </div>`;
}

function rjesenjaHtml(u) {
  const lista = (rijeci) =>
    rijeci.map((w) => `<li><b>${w.broj}.</b> ${esc(w.o)}</li>`).join("");
  return `
  <div class="tragovi">
    <div class="kolona"><h3>Vodoravno</h3><ol class="cl rj">${lista(u.vodoravno)}</ol></div>
    <div class="kolona"><h3>Uspravno</h3><ol class="cl rj">${lista(u.uspravno)}</ol></div>
  </div>`;
}

function stranicaHtml(tema, u, logoDataUri, izostavljeni) {
  // Polje se skalira i po širini i po visini mreže, kako bi list uvijek stao na
  // jednu A4 stranicu zajedno s tragovima ispod mreže.
  const mm = Math.max(5.0, Math.min(9.2, 170 / u.sirina, 122 / u.visina));
  const font = (mm * 0.62).toFixed(2);

  const zaglavlje = (podnaslov) => `
    <header class="vrh">
      <div class="tekst">
        <p class="marka">mekteb.net · ukrštenica</p>
        <h1>${esc(tema.naslov)}</h1>
        <p class="pod">${esc(podnaslov)}</p>
      </div>
      <img class="logo" src="${logoDataUri}" alt="Mekteb.net">
    </header>`;

  const podnozje = (tekst) => `<footer class="dno">
      <img class="znak" src="${logoDataUri}" alt="">
      <span>${esc(tekst)}</span>
    </footer>`;

  return `<!DOCTYPE html>
<html lang="bs"><head><meta charset="utf-8">
<title>${esc(tema.naslov)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; color: #1c2b33; }
  .list { page-break-after: always; }
  .list:last-child { page-break-after: auto; }

  .vrh { display: flex; align-items: flex-start; justify-content: space-between;
         gap: 8mm; border-bottom: 2.2pt solid #1a8a86; padding-bottom: 3mm; margin-bottom: 5mm; }
  .marka { margin: 0 0 1mm; font-size: 8pt; letter-spacing: .14em; text-transform: uppercase;
           color: #1a8a86; font-weight: 700; }
  .vrh h1 { margin: 0; font-size: 20pt; line-height: 1.12; font-weight: 800; letter-spacing: -.01em; }
  .pod { margin: 1.2mm 0 0; font-size: 9.5pt; color: #5c6b73; }
  .logo { width: 24mm; height: auto; flex: none; }

  .uputa { margin: 0 0 4mm; font-size: 8.6pt; color: #5c6b73; line-height: 1.45; }

  .mreza { border-collapse: collapse; margin: 0 auto 6mm; }
  .mreza td { width: ${mm}mm; height: ${mm}mm; padding: 0; }
  .prazno { border: none; }
  .polje { border: .5pt solid #7d8b93; position: relative; background: #fff; }
  .br { position: absolute; top: .18mm; left: .45mm; font-size: ${(mm * 0.3).toFixed(2)}mm;
        line-height: 1; color: #46555d; font-weight: 600; }
  .sl { display: block; text-align: center; line-height: ${mm}mm; font-size: ${font}mm;
        font-weight: 700; color: #0f5f5c; }

  .tragovi { display: flex; gap: 8mm; }
  .kolona { flex: 1; min-width: 0; }
  .kolona h3 { margin: 0 0 2mm; font-size: 10pt; text-transform: uppercase; letter-spacing: .1em;
               color: #1a8a86; border-bottom: .8pt solid #cfdcdd; padding-bottom: 1.2mm; }
  .cl { list-style: none; margin: 0; padding: 0; font-size: 8.7pt; line-height: 1.5; }
  .cl li { margin-bottom: .9mm; padding-left: 6.5mm; text-indent: -6.5mm; }
  .cl b { color: #1a8a86; }
  .duz { color: #94a3a8; }
  .rj li { font-weight: 600; letter-spacing: .02em; }

  .dno { margin-top: 5mm; padding-top: 2.4mm; border-top: .8pt solid #dbe4e6;
         display: flex; align-items: center; gap: 2.4mm; font-size: 7.6pt; color: #8b9aa1; }
  .znak { width: 8mm; height: auto; opacity: .5; }

  .oznaka-rj { display: inline-block; background: #1a8a86; color: #fff; font-size: 8pt;
               font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
               padding: 1.1mm 3mm; border-radius: 1.4mm; margin-bottom: 4mm; }
</style></head>
<body>
  <section class="list">
    ${zaglavlje(tema.podnaslov)}
    <div class="sredina">
      <p class="uputa">Popuni ukrštenicu prema tragovima. Broj u zagradi kazuje koliko riječ ima slova.
      Slova <b>Č, Ć, Ž, Š</b> i <b>Đ</b> upisuju se u jedno polje, a <b>DŽ</b> u dva polja (D i Ž).</p>
      ${mrezaHtml(u, false)}
      ${tragoviHtml(u)}
    </div>
    ${podnozje("mekteb.net · Ime i prezime: ______________________________  Grupa: ____________")}
  </section>

  <section class="list">
    ${zaglavlje("Rješenje")}
    <div class="sredina">
      <span class="oznaka-rj">Rješenje</span>
      ${mrezaHtml(u, true)}
      ${rjesenjaHtml(u)}
      ${
        izostavljeni.length
          ? `<p class="uputa" style="margin-top:4mm">Pojmovi koje raspored nije mogao ukrstiti: ${izostavljeni
              .map((w) => esc(w.o))
              .join(", ")}.</p>`
          : ""
      }
    </div>
    ${podnozje("mekteb.net · ukrštenica za mektebsku pouku")}
  </section>
</body></html>`;
}

// ───────────────────────────── PDF preko Chromiuma ─────────────────────────────

function nadjiChromium() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const korijen = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (existsSync(korijen)) {
    for (const d of readdirSync(korijen)) {
      const p = path.join(korijen, d, "chrome-linux", "chrome");
      if (d.startsWith("chromium-") && existsSync(p)) return p;
    }
  }
  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
    if (existsSync(p)) return p;
  }
  throw new Error("Chromium nije pronađen. Postavi CHROME_BIN na putanju do Chrome/Chromium binarija.");
}

function uPdf(htmlPut, pdfPut, chromium) {
  const profil = path.join(os.tmpdir(), `ukrstenice-${process.pid}-${Math.random().toString(36).slice(2)}`);
  try {
    execFileSync(
      chromium,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        `--user-data-dir=${profil}`,
        `--print-to-pdf=${pdfPut}`,
        `file://${htmlPut}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
  } finally {
    rmSync(profil, { recursive: true, force: true });
  }
}

// ───────────────────────────── pokretanje ─────────────────────────────

const argv = process.argv.slice(2);
const zadrziHtml = argv.includes("--html");
const seedArg = argv.indexOf("--seed");
const seed = seedArg >= 0 ? Number(argv[seedArg + 1]) : 1;
const filter = argv.filter((a, i) => !a.startsWith("--") && !(seedArg >= 0 && i === seedArg + 1));

const baza = JSON.parse(readFileSync(path.join(HERE, "teme.json"), "utf8"));
const teme = filter.length ? baza.teme.filter((t) => filter.includes(t.id)) : baza.teme;
if (!teme.length) {
  console.error(`Nema teme za: ${filter.join(", ")}. Dostupne: ${baza.teme.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

mkdirSync(IZLAZ, { recursive: true });
const logoDataUri = `data:image/png;base64,${readFileSync(LOGO).toString("base64")}`;
const chromium = nadjiChromium();

for (const tema of teme) {
  const rezultat = slozi(tema.unosi, seed);
  const u = numerisi(rezultat);
  const smjesteni = new Set(u.rijeci.map((w) => w.o));
  const izostavljeni = tema.unosi.filter((x) => !smjesteni.has(x.o));

  const greske = provjeriMrezu(u);
  if (greske.length) {
    console.error(`✗ ${tema.id}: neispravna mreža\n   - ${greske.join("\n   - ")}`);
    process.exitCode = 1;
    continue;
  }

  const html = stranicaHtml(tema, u, logoDataUri, izostavljeni);
  const htmlPut = path.join(IZLAZ, `${tema.id}.html`);
  const pdfPut = path.join(IZLAZ, `${tema.id}.pdf`);
  writeFileSync(htmlPut, html, "utf8");
  uPdf(htmlPut, pdfPut, chromium);
  if (!zadrziHtml) rmSync(htmlPut, { force: true });

  console.log(
    `✓ ${tema.id.padEnd(16)} ${String(u.sirina).padStart(2)}×${String(u.visina).padEnd(2)} polja, ` +
      `${u.rijeci.length}/${tema.unosi.length} pojmova` +
      (izostavljeni.length ? `  (izostavljeno: ${izostavljeni.map((x) => x.o).join(", ")})` : "")
  );
}

console.log(`\nPDF-ovi: ${path.relative(process.cwd(), IZLAZ)}`);
