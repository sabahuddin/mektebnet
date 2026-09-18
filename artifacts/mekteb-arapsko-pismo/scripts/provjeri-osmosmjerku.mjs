// Provjera osmosmjerke u pravom pregledniku (Chromium preko puppeteera).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-osmosmjerku.mjs
//
// Servira `dist/public` lokalno, ugradi igru u iframe kao što to radi stranica
// lekcije, pa provjeri: širine 360/768/1280, mrežu i dvoslove, povlačenje i
// način "prvo pa zadnje slovo", tastaturu, kontrast teksta, prefers-reduced-motion,
// da poruka "kraj" stigne tačno jednom te da nema grešaka u konzoli ni ijednog
// zahtjeva prema vanjskim domenama. Izlazni kod 1 znači da je nešto palo.
//
// Nakon dodavanja nove JSON datoteke u public/vjezbe/osmosmjerka/podaci/
// promijeni PODACI ispod da se provjeri baš ta osmosmjerka.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const PODACI = "/vjezbe/osmosmjerka/podaci/ramazan.json";
const TIPOVI = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/roditelj-test.html") {
    const podaci = url.searchParams.get("podaci") || PODACI;
    res.writeHead(200, { "Content-Type": TIPOVI[".html"] });
    res.end(`<!doctype html><html lang="bs"><head><meta charset="utf-8"><title>Test</title></head><body>
<script>
  window.__poruke = [];
  addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    if (e.source !== document.getElementById('okvir').contentWindow) return;
    var p = e.data; if (!p || p.izvor !== 'mekteb-igra') return;
    window.__poruke.push(p);
  });
</script>
<iframe id="okvir" src="/vjezbe/osmosmjerka/osmosmjerka.html?podaci=${podaci}"
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
  referrerpolicy="no-referrer" style="width:100%;height:96vh;border:0"></iframe>
</body></html>`);
    return;
  }
  if (url.pathname === "/favicon.ico") { res.writeHead(200, { "Content-Type": "image/x-icon" }); res.end(); return; }
  try {
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": TIPOVI[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("404");
  }
});
await new Promise(r => server.listen(4173, r));
const BASE = "http://localhost:4173";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov, dodatak });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ── 1. Širine 360 / 768 / 1280 ────────────────────────────────────────────
for (const sirina of [360, 768, 1280]) {
  const page = await browser.newPage();
  const greske = [];
  const vanjski = [];
  const nedostaje = [];
  page.on("console", m => { if (m.type() === "error") greske.push(m.text()); });
  page.on("pageerror", e => greske.push(String(e)));
  page.on("request", r => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) vanjski.push(r.url()); });
  page.on("requestfailed", r => nedostaje.push(r.url()));
  page.on("response", r => { if (r.status() === 404) nedostaje.push(r.url()); });
  await page.setViewport({ width: sirina, height: 900 });
  await page.goto(`${BASE}/roditelj-test.html`, { waitUntil: "networkidle0" });
  const okvir = await (await page.$("#okvir")).contentFrame();
  await okvir.waitForSelector(".polje");
  const stanje = await okvir.evaluate(() => ({
    polja: document.querySelectorAll(".polje").length,
    n: getComputedStyle(document.getElementById("mreza")).getPropertyValue("--n").trim(),
    sirinaMreze: document.getElementById("mreza").getBoundingClientRect().width,
    prelivanje: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    najmanjeDugme: Math.min(...[...document.querySelectorAll(".dugme, .opcije span")]
      .filter(b => b.offsetParent !== null)
      .map(b => b.getBoundingClientRect().height)),
    font: document.fonts.check('700 16px Nunito'),
    naslov: document.getElementById("naslov").textContent,
    dvoslovi: [...document.querySelectorAll(".polje")].filter(p => p.textContent.length > 1).length,
  }));
  provjeri(`${sirina}px: mreža nacrtana`, stanje.polja === Number(stanje.n) ** 2, `${stanje.polja} polja (n=${stanje.n})`);
  provjeri(`${sirina}px: nema horizontalnog prelivanja`, !stanje.prelivanje);
  provjeri(`${sirina}px: površine za dodir ≥ 44px`, stanje.najmanjeDugme >= 44, `najmanja ${stanje.najmanjeDugme.toFixed(1)}px`);
  provjeri(`${sirina}px: Nunito učitan lokalno`, stanje.font === true);
  provjeri(`${sirina}px: nema grešaka u konzoli`, greske.length === 0, greske.join(" | "));
  provjeri(`${sirina}px: nema zahtjeva prema vanjskim domenama`, vanjski.length === 0, vanjski.join(" | "));
  provjeri(`${sirina}px: naslov iz JSON-a`, stanje.naslov.length > 0, stanje.naslov);
  if (sirina === 1280) {
    // Dvoslovi se provjeravaju na osmosmjerci koja ih sigurno ima u riječima
    // (dž u "džamija" i "džemat"); nasumična popuna mreže nije pouzdan dokaz.
    const dvoPage = await browser.newPage();
    await dvoPage.goto(`${BASE}/vjezbe/osmosmjerka/osmosmjerka.html?podaci=/vjezbe/osmosmjerka/podaci/dzamija.json`, { waitUntil: "networkidle0" });
    await dvoPage.waitForSelector(".polje");
    const dvo = await dvoPage.evaluate(() => ({
      polja: [...document.querySelectorAll(".polje")].filter(p => p.textContent.length > 1).length,
      dz: [...document.querySelectorAll(".polje")].filter(p => p.textContent === "DŽ").length,
    }));
    provjeri("dvoslovi stoje u jednom polju (DŽ/LJ/NJ)", dvo.dz >= 2, `${dvo.dz}× DŽ, ukupno ${dvo.polja} dvoslovnih polja`);
    await dvoPage.close();
  }
  await page.close();
}

// ── 2. Rješavanje: povlačenje prstom + "prvo pa zadnje slovo" ─────────────
const page = await browser.newPage();
const greske = [];
const vanjski = [];
page.on("console", m => { if (m.type() === "error") greske.push(m.text()); });
page.on("pageerror", e => greske.push(String(e)));
page.on("request", r => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) vanjski.push(r.url()); });
await page.setViewport({ width: 900, height: 1000 });
await page.goto(`${BASE}/roditelj-test.html`, { waitUntil: "networkidle0" });
const okvirEl = await page.$("#okvir");
const okvir = await okvirEl.contentFrame();
await okvir.waitForSelector(".polje");

// mreža slova + tražene riječi iz DOM-a
const mreza = await okvir.evaluate(() => {
  const n = Number(getComputedStyle(document.getElementById("mreza")).getPropertyValue("--n"));
  const polja = [...document.querySelectorAll(".polje")].map(p => p.textContent);
  const m = [];
  for (let r = 0; r < n; r++) m.push(polja.slice(r * n, (r + 1) * n));
  return { n, m };
});
const rijeci = await (await fetch(`${BASE}${PODACI}`)).json();
const DVOSLOVI = ["DŽ", "LJ", "NJ"];
function uSlova(rijec) {
  const s = rijec.toLocaleUpperCase("bs").replace(/[^A-ZČĆĐŠŽ|]/g, "");
  const izlaz = [];
  for (let i = 0; i < s.length; i++) {
    const dva = s.slice(i, i + 2);
    if (DVOSLOVI.includes(dva)) { izlaz.push(dva); i++; } else izlaz.push(s[i]);
  }
  return izlaz;
}
const SMJER8 = [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
function nadji(slova) {
  const { n, m } = mreza;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of SMJER8) {
    const kr = r + dr * (slova.length - 1), kc = c + dc * (slova.length - 1);
    if (kr < 0 || kc < 0 || kr >= n || kc >= n) continue;
    let ok = true;
    for (let k = 0; k < slova.length; k++) if (m[r + dr * k][c + dc * k] !== slova[k]) { ok = false; break; }
    if (ok) return { od: { r, c }, do: { r: kr, c: kc } };
  }
  return null;
}
const okvirOkvira = await okvirEl.boundingBox();
const geo = await okvir.evaluate(() => {
  const o = document.getElementById("mreza").getBoundingClientRect();
  return { left: o.left, top: o.top, w: o.width, h: o.height };
});
const centar = (p) => ({
  x: okvirOkvira.x + geo.left + (p.c + 0.5) * geo.w / mreza.n,
  y: okvirOkvira.y + geo.top + (p.r + 0.5) * geo.h / mreza.n,
});

let povuceno = 0, kliknuto = 0;
for (const [i, w] of rijeci.rijeci.entries()) {
  const mjesto = nadji(uSlova(w.rijec));
  if (!mjesto) { provjeri(`riječ u mreži: ${w.rijec}`, false); continue; }
  const a = centar(mjesto.od), b = centar(mjesto.do);
  if (i === 0) {
    // način "prvo pa zadnje slovo" (bez povlačenja)
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    kliknuto++;
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    povuceno++;
  }
  await new Promise(r => setTimeout(r, 60));
}
provjeri("sve riječi pronađene u mreži", povuceno + kliknuto === rijeci.rijeci.length, `${povuceno} povlačenjem, ${kliknuto} dodirom`);

const brojac = await okvir.$eval("#brojac", el => el.textContent);
provjeri("brojač pokazuje sve riječi", brojac === `${rijeci.rijeci.length} od ${rijeci.rijeci.length}`, brojac);
const krajVidljiv = await okvir.$eval("#kraj", el => !el.hasAttribute("hidden"));
provjeri("panel kraja prikazan", krajVidljiv);

const poruke = await page.evaluate(() => window.__poruke);
const krajevi = poruke.filter(p => p.dogadjaj === "kraj");
provjeri("događaj 'kraj' stigao tačno jednom", krajevi.length === 1, `${krajevi.length}×`);
provjeri("događaj 'kraj' nosi tražena polja", krajevi[0]
  && krajevi[0].id === rijeci.id
  && krajevi[0].pronadjeno === rijeci.rijeci.length
  && krajevi[0].ukupno === rijeci.rijeci.length
  && typeof krajevi[0].sekunde === "number"
  && typeof krajevi[0].pomoc === "number"
  && typeof krajevi[0].tezina === "string"
  && typeof krajevi[0].prikaz === "string", JSON.stringify(krajevi[0]));
provjeri("događaj 'rijec' po svakoj riječi", poruke.filter(p => p.dogadjaj === "rijec").length === rijeci.rijeci.length);
provjeri("događaj 'visina' poslan", poruke.some(p => p.dogadjaj === "visina"));

// promjena težine i prikaza → nova visina
const prijeVisina = poruke.filter(p => p.dogadjaj === "visina").pop()?.visina;
await okvir.click('#tezina input[value="tesko"]');
await new Promise(r => setTimeout(r, 400));
await okvir.click('#prikaz input[value="opisi"]');
await new Promise(r => setTimeout(r, 400));
const poslije = await page.evaluate(() => window.__poruke.filter(p => p.dogadjaj === "visina").pop()?.visina);
provjeri("visina se javlja i nakon promjene težine/prikaza", typeof poslije === "number", `prije ${prijeVisina}, poslije ${poslije}`);
const novaMreza = await okvir.evaluate(() => document.querySelectorAll(".polje").length);
provjeri("nova igra nakon promjene težine", novaMreza > 0);

provjeri("nema grešaka u konzoli tokom igre", greske.length === 0, greske.join(" | "));
provjeri("nema vanjskih zahtjeva tokom igre", vanjski.length === 0, vanjski.join(" | "));

// ── 3. Tastatura ──────────────────────────────────────────────────────────
const page2 = await browser.newPage();
await page2.goto(`${BASE}/vjezbe/osmosmjerka/osmosmjerka.html?podaci=/vjezbe/osmosmjerka/podaci/dzamija.json`, { waitUntil: "networkidle0" });
await page2.waitForSelector(".polje");
await page2.focus(".polje");
await page2.keyboard.press("ArrowRight");
await page2.keyboard.press("ArrowDown");
const fokus = await page2.evaluate(() => {
  const el = document.activeElement;
  return { r: el?.dataset?.r, c: el?.dataset?.c, vidljivFokus: getComputedStyle(el).boxShadow !== "none" };
});
provjeri("strelice pomjeraju fokus", fokus.r === "1" && fokus.c === "1", JSON.stringify(fokus));
await page2.keyboard.press("Enter");
const sidro = await page2.evaluate(() => document.querySelectorAll(".polje.sidro").length);
provjeri("Enter postavlja sidro (prvo slovo)", sidro === 1);
await page2.close();

// ── 4. Kontrast teksta (WCAG AA ≥ 4,5:1) ─────────────────────────────────
const page3 = await browser.newPage();
await page3.goto(`${BASE}/vjezbe/osmosmjerka/osmosmjerka.html?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page3.waitForSelector(".polje");
const kontrasti = await page3.evaluate(() => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const boja = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  const pozadina = (el) => {
    let n = el;
    while (n) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !bg.includes("rgba(0, 0, 0, 0)") && bg !== "transparent") return boja(bg);
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const omjer = (el) => {
    const f = lum(boja(getComputedStyle(el).color));
    const b = lum(pozadina(el));
    const [hi, lo] = f > b ? [f, b] : [b, f];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const uzorci = {
    "naslov": "#naslov",
    "kicker": ".kicker",
    "uputa": "#uputa",
    "oznaka stanja": ".stanje dt",
    "broj u stanju": ".stanje dd",
    "slovo u mreži": ".polje",
    "riječ na spisku": ".stavka .rijec, .stavka .nepoznata",
    "opis riječi": ".stavka span",
    "dugme": ".dugme",
    "glavno dugme": ".dugme.glavno",
    "legenda": ".izbor legend",
  };
  const out = {};
  for (const [ime, sel] of Object.entries(uzorci)) {
    const el = document.querySelector(sel);
    if (el) out[ime] = omjer(el);
  }
  // izabrana opcija (bijelo na tirkizu)
  const izabrana = document.querySelector('.opcije input:checked + span');
  if (izabrana) out["izabrana opcija"] = omjer(izabrana);
  return out;
});
for (const [ime, o] of Object.entries(kontrasti)) provjeri(`kontrast ≥ 4,5:1 — ${ime}`, o >= 4.5, `${o}:1`);

// ── 5. prefers-reduced-motion ────────────────────────────────────────────
await page3.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page3.reload({ waitUntil: "networkidle0" });
await page3.waitForSelector(".polje");
const animacije = await page3.evaluate(() => {
  const potez = document.createElement("div");
  potez.className = "kraj";
  document.body.appendChild(potez);
  const d = getComputedStyle(potez).animationDuration;
  potez.remove();
  return d;
});
provjeri("prefers-reduced-motion skraćuje animacije", parseFloat(animacije) <= 0.02, animacije);
await page3.close();

await browser.close();
server.close();

const palo = rezultati.filter(r => !r.ok);
console.log(`\n${rezultati.length - palo.length}/${rezultati.length} provjera prošlo`);
process.exit(palo.length ? 1 : 0);
