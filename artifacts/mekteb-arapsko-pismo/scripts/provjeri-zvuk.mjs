// Provjera diskretnih zvukova u našim vježbama (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-zvuk.mjs
//
// Zvuk se ne može „čuti" u testu, pa umjesto zvučnika podmetnemo lažni
// AudioContext i brojimo tonove: koliko ih je, koje su frekvencije i koliko su
// jaki. Provjerava se i da vježba šuti kad je zvučnik u zaglavlju isključen,
// da nema nijedne zvučne datoteke i nijednog vanjskog zahtjeva.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const TIPOVI = {
  ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TIPOVI[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404, { "Content-Type": "text/plain" }).end("404"); }
});
await new Promise(r => server.listen(4199, r));
const BASE = "http://localhost:4199";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

// Lažni zvučnik: bilježi svaki ton umjesto da ga pusti.
const LAZNI_ZVUCNIK = `
  window.__tonovi = [];
  class LazniGain {
    constructor(){ this.gain = { setValueAtTime: () => {}, exponentialRampToValueAtTime: (v) => { this.jacina = Math.max(this.jacina || 0, v); } }; }
    connect(){}
  }
  class LazniOscilator {
    constructor(k){ this.k = k; this.frequency = { setValueAtTime: (f) => { this.f = f; } }; }
    connect(g){ this.g = g; }
    start(kad){ this.kad = kad; }
    stop(kraj){ window.__tonovi.push({ f: this.f, jacina: this.g && this.g.jacina, trajanje: kraj - this.kad }); }
  }
  window.AudioContext = class {
    constructor(){ this.currentTime = 0; this.state = "running"; this.destination = {}; }
    resume(){ this.state = "running"; }
    createOscillator(){ return new LazniOscilator(this); }
    createGain(){ return new LazniGain(); }
  };
  window.webkitAudioContext = window.AudioContext;
`;

const VJEZBE = [
  { tip: "osmosmjerka", igra: "/vjezbe/osmosmjerka/osmosmjerka.html", podaci: "/vjezbe/osmosmjerka/podaci/ramazan.json", cekaj: ".celija, .polje, svg" },
  { tip: "popuni", igra: "/vjezbe/popuni/popuni.html", podaci: "/vjezbe/popuni/podaci/abdest.json", cekaj: ".praznina" },
  { tip: "poredak", igra: "/vjezbe/poredak/poredak.html", podaci: "/vjezbe/poredak/podaci/abdest-koraci.json", cekaj: ".stavka" },
  { tip: "razvrstaj", igra: "/vjezbe/razvrstaj/razvrstaj.html", podaci: "/vjezbe/razvrstaj/podaci/mjeseci.json", cekaj: ".kutija" },
  { tip: "spoji", igra: "/vjezbe/spoji/spoji.html", podaci: "/vjezbe/spoji/podaci/pojmovi.json", cekaj: ".par" },
  { tip: "upisi", igra: "/vjezbe/upisi/upisi.html", podaci: "/vjezbe/upisi/podaci/pojmovi.json", cekaj: ".pitanje" },
];

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"] });

// ── 1. Svaka vježba učita zvuk s naše domene ─────────────────────────────
for (const v of VJEZBE) {
  const page = await browser.newPage();
  const vanjski = [];
  const zvucneDatoteke = [];
  page.on("request", r => {
    if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) vanjski.push(r.url());
    if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(new URL(r.url()).pathname)) zvucneDatoteke.push(r.url());
  });
  await page.evaluateOnNewDocument(LAZNI_ZVUCNIK);
  await page.goto(`${BASE}${v.igra}?podaci=${v.podaci}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(v.cekaj);
  const ima = await page.evaluate(() => typeof window.MektebZvuk === "object" && typeof window.MektebZvuk.kraj === "function");
  provjeri(`${v.tip}: zvuk.js učitan s naše domene`, ima === true);
  provjeri(`${v.tip}: nema nijedne zvučne datoteke`, zvucneDatoteke.length === 0, zvucneDatoteke.join(" | "));
  provjeri(`${v.tip}: nema zahtjeva prema vanjskim domenama`, vanjski.length === 0, vanjski.join(" | "));
  await page.close();
}

// ── 2. Zvuk se javi tek poslije dodira, i to tiho ────────────────────────
const page = await browser.newPage();
await page.evaluateOnNewDocument(LAZNI_ZVUCNIK);
await page.goto(`${BASE}/vjezbe/popuni/popuni.html?podaci=/vjezbe/popuni/podaci/abdest.json`, { waitUntil: "networkidle0" });
await page.waitForSelector(".praznina");

await page.evaluate(() => window.MektebZvuk.kraj());
provjeri("bez dodira djeteta zvuka nema (pravilo preglednika)",
  (await page.evaluate(() => window.__tonovi.length)) === 0);

await page.click("body");
await new Promise(r => setTimeout(r, 100));
await page.evaluate(() => { window.__tonovi = []; window.MektebZvuk.tacno(); });
const tik = await page.evaluate(() => window.__tonovi);
provjeri("„tačno” je jedan kratak i tih ton",
  tik.length === 1 && tik[0].trajanje <= 0.15 && tik[0].jacina <= 0.06, JSON.stringify(tik));

await page.evaluate(() => { window.__tonovi = []; window.MektebZvuk.greska(); });
const lose = await page.evaluate(() => window.__tonovi);
provjeri("„greška” je niži i tiši od „tačno”",
  lose.length === 1 && lose[0].f < tik[0].f && lose[0].jacina <= tik[0].jacina, JSON.stringify(lose));

await page.evaluate(() => { window.__tonovi = []; window.MektebZvuk.kraj(); });
const kraj = await page.evaluate(() => window.__tonovi);
provjeri("„kraj” su tri note naviše", kraj.length === 3 && kraj[0].f < kraj[1].f && kraj[1].f < kraj[2].f, JSON.stringify(kraj.map(t => Math.round(t.f))));
provjeri("nijedan ton nije glasan (≤ 0,1)", [...tik, ...lose, ...kraj].every(t => t.jacina <= 0.1));
provjeri("cijeli „kraj” traje manje od sekunde",
  Math.max(...kraj.map(t => t.trajanje)) <= 0.4, `${Math.max(...kraj.map(t => t.trajanje))}s`);
await page.close();

// ── 3. Zvučnik u zaglavlju platforme gasi i zvuk vježbe ──────────────────
for (const [naziv, kljuc, vrijednost] of [
  ["zvučnik u zaglavlju (mekteb-audio-muted)", "mekteb-audio-muted", "true"],
  ["zvučni efekti u profilu (mekteb:soundEffectsEnabled)", "mekteb:soundEffectsEnabled", "false"],
]) {
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(LAZNI_ZVUCNIK);
  await p.evaluateOnNewDocument((k, v) => { try { localStorage.setItem(k, v); } catch {} }, kljuc, vrijednost);
  await p.goto(`${BASE}/vjezbe/popuni/popuni.html?podaci=/vjezbe/popuni/podaci/abdest.json`, { waitUntil: "networkidle0" });
  await p.waitForSelector(".praznina");
  await p.click("body");
  await p.evaluate(() => { window.__tonovi = []; window.MektebZvuk.kraj(); window.MektebZvuk.tacno(); });
  provjeri(`${naziv} ušutka vježbu`, (await p.evaluate(() => window.__tonovi.length)) === 0);
  await p.close();
}

const p2 = await browser.newPage();
await p2.evaluateOnNewDocument(LAZNI_ZVUCNIK);
await p2.goto(`${BASE}/vjezbe/popuni/popuni.html?podaci=/vjezbe/popuni/podaci/abdest.json&zvuk=ne`, { waitUntil: "networkidle0" });
await p2.waitForSelector(".praznina");
await p2.click("body");
await p2.evaluate(() => { window.__tonovi = []; window.MektebZvuk.kraj(); });
provjeri("adresa ?zvuk=ne ušutka vježbu", (await p2.evaluate(() => window.__tonovi.length)) === 0);
await p2.close();

// ── 4. Rješavanje do kraja zaista oglasi kraj ────────────────────────────
const p3 = await browser.newPage();
await p3.evaluateOnNewDocument(LAZNI_ZVUCNIK);
// Prethodne provjere su u istom pregledniku ugasile zvuk — vrati ga.
await p3.evaluateOnNewDocument(() => {
  try {
    localStorage.removeItem("mekteb-audio-muted");
    localStorage.removeItem("mekteb:soundEffectsEnabled");
  } catch {}
});
await p3.goto(`${BASE}/vjezbe/upisi/upisi.html?podaci=/vjezbe/upisi/podaci/pojmovi.json`, { waitUntil: "networkidle0" });
await p3.waitForSelector(".pitanje");
const pitanja = await (await fetch(`${BASE}/vjezbe/upisi/podaci/pojmovi.json`)).json();
const polja = await p3.$$(".upis");
await polja[0].type("pogrešno");
for (let i = 1; i < pitanja.pitanja.length; i++) await polja[i].type(pitanja.pitanja[i].odgovor);
await p3.click("#provjeri");
await new Promise(r => setTimeout(r, 300));
const poslijeGreske = await p3.evaluate(() => window.__tonovi);
provjeri("provjera s greškom oglasi tihi niski ton",
  poslijeGreske.length === 1 && poslijeGreske[0].f < 300, JSON.stringify(poslijeGreske));

await p3.evaluate(() => { window.__tonovi = []; });
const polja2 = await p3.$$(".upis");
await polja2[0].click({ clickCount: 3 });
await polja2[0].type(pitanja.pitanja[0].odgovor);
await p3.click("#provjeri");
await new Promise(r => setTimeout(r, 400));
const poslijeKraja = await p3.evaluate(() => window.__tonovi);
provjeri("riješena vježba oglasi kraj (tri note)", poslijeKraja.length === 3, JSON.stringify(poslijeKraja.map(t => Math.round(t.f))));
await p3.close();

await browser.close();
server.close();

const palo = rezultati.filter(r => !r.ok);
console.log(`\n${rezultati.length - palo.length}/${rezultati.length} provjera prošlo`);
if (palo.length) { console.log("PALO:\n- " + palo.map(r => r.naziv).join("\n- ")); process.exit(1); }
