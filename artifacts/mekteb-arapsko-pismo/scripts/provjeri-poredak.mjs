// Provjera vježbe „Poredak" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-poredak.mjs
//
// Servira `dist/public` lokalno, ugradi vježbu u iframe kao što to radi
// stranica lekcije, pa provjeri: širine 360/768/1280, zamjenu mjesta
// prevlačenjem, dodirom i strelicama, dugme „Pomozi mi", provjeru na kraju,
// kontrast teksta, prefers-reduced-motion, da poruka "kraj" stigne tačno
// jednom te da nema grešaka u konzoli ni ijednog zahtjeva prema vanjskim
// domenama. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const PODACI = "/vjezbe/poredak/podaci/abdest-koraci.json";
const IGRA = "/vjezbe/poredak/poredak.html";
const TIPOVI = {
  ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/favicon.ico") { res.writeHead(200, { "Content-Type": "image/x-icon" }); res.end(); return; }
  if (url.pathname === "/roditelj-test.html") {
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
<iframe id="okvir" src="${IGRA}?podaci=${PODACI}"
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
  referrerpolicy="no-referrer" style="width:100%;height:96vh;border:0"></iframe>
</body></html>`);
    return;
  }
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
await new Promise(r => server.listen(4195, r));
const BASE = "http://localhost:4195";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

const podaci = await (await fetch(`${BASE}${PODACI}`)).json();
const tacne = podaci.stavke;

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"] });

// ── 1. Širine ────────────────────────────────────────────────────────────
for (const sirina of [360, 768, 1280]) {
  const page = await browser.newPage();
  const greske = [];
  const vanjski = [];
  page.on("console", m => { if (m.type() === "error") greske.push(m.text()); });
  page.on("pageerror", e => greske.push(String(e)));
  page.on("request", r => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) vanjski.push(r.url()); });
  await page.setViewport({ width: sirina, height: 900 });
  await page.goto(`${BASE}/roditelj-test.html`, { waitUntil: "networkidle0" });
  const okvir = await (await page.$("#okvir")).contentFrame();
  await okvir.waitForSelector(".stavka");
  const stanje = await okvir.evaluate(() => ({
    stavki: document.querySelectorAll(".stavka").length,
    prelivanje: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    najmanjaMeta: Math.min(...[...document.querySelectorAll(".hvat, .dugme")]
      .filter(b => b.offsetParent !== null)
      .map(b => b.getBoundingClientRect().height)),
    font: document.fonts.check('800 16px Nunito'),
    naslov: document.getElementById("naslov").textContent,
    brojevi: [...document.querySelectorAll(".mjesto")].map(m => m.textContent).join(","),
  }));
  provjeri(`${sirina}px: sve stavke iscrtane`, stanje.stavki === tacne.length, `${stanje.stavki}`);
  provjeri(`${sirina}px: mjesta označena redom`, stanje.brojevi === tacne.map((_, i) => i + 1).join(","), stanje.brojevi);
  provjeri(`${sirina}px: nema horizontalnog prelivanja`, !stanje.prelivanje);
  provjeri(`${sirina}px: površine za dodir ≥ 44px`, stanje.najmanjaMeta >= 44, `najmanja ${stanje.najmanjaMeta.toFixed(1)}px`);
  provjeri(`${sirina}px: Nunito učitan lokalno`, stanje.font === true);
  provjeri(`${sirina}px: nema grešaka u konzoli`, greske.length === 0, greske.join(" | "));
  provjeri(`${sirina}px: nema zahtjeva prema vanjskim domenama`, vanjski.length === 0, vanjski.join(" | "));
  provjeri(`${sirina}px: naslov iz JSON-a`, stanje.naslov === podaci.naslov, stanje.naslov);
  await page.close();
}

// ── 2. Rješavanje ────────────────────────────────────────────────────────
const page = await browser.newPage();
const greske = [];
const vanjski = [];
page.on("console", m => { if (m.type() === "error") greske.push(m.text()); });
page.on("pageerror", e => greske.push(String(e)));
page.on("request", r => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) vanjski.push(r.url()); });
await page.setViewport({ width: 1280, height: 1000 });
await page.goto(`${BASE}/roditelj-test.html`, { waitUntil: "networkidle0" });
const okvirEl = await page.$("#okvir");
const okvir = await okvirEl.contentFrame();
await okvir.waitForSelector(".stavka");

const pocetni = await okvir.evaluate(() => [...document.querySelectorAll(".hvat")].map(h => h.textContent));
provjeri("stavke su izmiješane, a ne u tačnom redoslijedu",
  pocetni.join("|") !== tacne.join("|"), pocetni.slice(0, 3).join(" / "));
provjeri("na početku nema nijedne zelene ni crvene oznake",
  (await okvir.evaluate(() => document.querySelectorAll(".stavka.tacna, .stavka.netacna").length)) === 0);

const okvirBox = await okvirEl.boundingBox();
const tacka = async (selektor, indeks) => {
  const r = await okvir.evaluate((sel, i) => {
    const el = document.querySelectorAll(sel)[i];
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, selektor, indeks);
  return r ? { x: okvirBox.x + r.x, y: okvirBox.y + r.y } : null;
};
const redSada = () => okvir.evaluate(() => [...document.querySelectorAll(".hvat")].map(h => h.textContent));

// zamjena prevlačenjem
const prije = await redSada();
const a = await tacka(".hvat", 0);
const b = await tacka(".hvat", 3);
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
await page.mouse.move(b.x, b.y, { steps: 8 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 200));
const poslijeVuce = await redSada();
provjeri("prevlačenje mijenja mjesta dvjema stavkama",
  poslijeVuce[0] === prije[3] && poslijeVuce[3] === prije[0], `${poslijeVuce[0]} / ${poslijeVuce[3]}`);

// zamjena dodirom (dodirni jednu pa drugu)
const prije2 = await redSada();
const t1 = await tacka(".hvat", 1);
await page.mouse.click(t1.x, t1.y);
await new Promise(r => setTimeout(r, 120));
provjeri("dodir označi stavku", (await okvir.evaluate(() => document.querySelectorAll(".stavka.izabrana").length)) === 1);
const t2 = await tacka(".hvat", 2);
await page.mouse.click(t2.x, t2.y);
await new Promise(r => setTimeout(r, 150));
const poslijeDodira = await redSada();
provjeri("dodir na drugu stavku zamijeni im mjesta",
  poslijeDodira[1] === prije2[2] && poslijeDodira[2] === prije2[1], `${poslijeDodira[1]} / ${poslijeDodira[2]}`);

// strelice
const prije3 = await redSada();
const strelicaDolje = await tacka('.stavka[data-i="0"] .strelica[data-smjer="1"]', 0);
await page.mouse.click(strelicaDolje.x, strelicaDolje.y);
await new Promise(r => setTimeout(r, 150));
const poslijeStrelice = await redSada();
provjeri("strelica dolje pomjeri stavku za jedno mjesto",
  poslijeStrelice[0] === prije3[1] && poslijeStrelice[1] === prije3[0], `${poslijeStrelice[0]} / ${poslijeStrelice[1]}`);

// prva provjera na izmiješanom redoslijedu
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 300));
const prvaProvjera = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".stavka.tacna").length,
  crvenih: document.querySelectorAll(".stavka.netacna").length,
  poruka: document.getElementById("poruka").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  provjeriZakljucano: document.getElementById("provjeri").disabled,
}));
provjeri("provjera označi stavke koje nisu na mjestu", prvaProvjera.crvenih > 0, JSON.stringify(prvaProvjera));
provjeri("poruka kaže koliko je na svome mjestu", /na svome mjestu/i.test(prvaProvjera.poruka), prvaProvjera.poruka);
provjeri("vježba se ne završava dok redoslijed nije tačan", prvaProvjera.krajVidljiv === false);
provjeri("Provjeri se zaključa dok se ništa ne promijeni", prvaProvjera.provjeriZakljucano === true);
provjeri("zaključane stavke nemaju strelice u upotrebi",
  (await okvir.evaluate(() => [...document.querySelectorAll(".stavka.tacna .strelica")].every(s => s.disabled))) === true);

// dugme „Pomozi mi" dovodi jednu stavku na mjesto
const prijePomoci = await okvir.evaluate(() => document.querySelectorAll(".stavka.tacna").length);
await okvir.click("#pomoc");
await new Promise(r => setTimeout(r, 200));
provjeri("dugme Pomozi mi dovede stavku na njeno mjesto",
  (await okvir.evaluate(() => document.querySelectorAll(".stavka.tacna").length)) > prijePomoci);

// složi ostatak i provjeri
for (let krug = 0; krug < 40; krug++) {
  const gotovo = await okvir.evaluate((tacne) => {
    const red = [...document.querySelectorAll(".hvat")].map(h => h.textContent);
    for (let i = 0; i < tacne.length; i++) {
      if (red[i] === tacne[i]) continue;
      const j = red.indexOf(tacne[i]);
      if (j < 0) return "greska";
      document.querySelectorAll(".hvat")[i].click();
      document.querySelectorAll(".hvat")[j].click();
      return false;
    }
    return true;
  }, tacne);
  if (gotovo === true) break;
  if (gotovo === "greska") break;
  await new Promise(r => setTimeout(r, 60));
}
const prijeZadnje = await redSada();
provjeri("redoslijed je složen kako treba", prijeZadnje.join("|") === tacne.join("|"), prijeZadnje.slice(0, 2).join(" / "));
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 400));

const kraj = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".stavka.tacna").length,
  brojac: document.getElementById("brojac").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  krajOpis: document.getElementById("kraj-opis").textContent,
}));
provjeri("sve stavke su na svome mjestu", kraj.zelenih === tacne.length, JSON.stringify(kraj));
provjeri("panel kraja prikazan", kraj.krajVidljiv);
provjeri("brojač pokazuje sve na mjestu", kraj.brojac === `${tacne.length} od ${tacne.length}`, kraj.brojac);
provjeri("panel kraja kaže vrijeme i pomoć", /Vrijeme:/.test(kraj.krajOpis) && /Pomoć/.test(kraj.krajOpis), kraj.krajOpis);

const poruke = await page.evaluate(() => window.__poruke);
const krajevi = poruke.filter(p => p.dogadjaj === "kraj");
provjeri("događaj 'kraj' stigao tačno jednom", krajevi.length === 1, `${krajevi.length}×`);
provjeri("događaj 'kraj' nosi tražena polja", krajevi[0]
  && krajevi[0].id === podaci.id
  && krajevi[0].pronadjeno === tacne.length
  && krajevi[0].ukupno === tacne.length
  && typeof krajevi[0].sekunde === "number"
  && typeof krajevi[0].greske === "number"
  && krajevi[0].pomoc === 1
  && krajevi[0].provjere >= 2
  && typeof krajevi[0].tacnoIzPrve === "number", JSON.stringify(krajevi[0]));
provjeri("događaj 'stavka' po svakoj potvrđenoj stavci",
  poruke.filter(p => p.dogadjaj === "stavka").length === tacne.length,
  `${poruke.filter(p => p.dogadjaj === "stavka").length}`);
provjeri("događaj 'visina' poslan", poruke.some(p => p.dogadjaj === "visina"));
provjeri("nema grešaka u konzoli tokom igre", greske.length === 0, greske.join(" | "));
provjeri("nema vanjskih zahtjeva tokom igre", vanjski.length === 0, vanjski.join(" | "));

await okvir.click("#nova");
await new Promise(r => setTimeout(r, 300));
const poslijeNove = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".stavka.tacna").length,
  stavki: document.querySelectorAll(".stavka").length,
  krajSkriven: document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("Pocni ispocetka vraca vjezbu na pocetak",
  poslijeNove.zelenih === 0 && poslijeNove.stavki === tacne.length && poslijeNove.krajSkriven, JSON.stringify(poslijeNove));
await page.close();

// ── 3. Tastatura ─────────────────────────────────────────────────────────
const page2 = await browser.newPage();
await page2.setViewport({ width: 1280, height: 1000 });
await page2.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page2.waitForSelector(".stavka");
const fokus = await page2.evaluate(() => {
  const h = document.querySelector(".hvat");
  h.focus();
  return { fokus: document.activeElement === h, vidljivFokus: getComputedStyle(h).outlineStyle !== "none" };
});
await page2.keyboard.press("Enter");
provjeri("Enter na stavci je označi",
  (await page2.evaluate(() => document.querySelectorAll(".stavka.izabrana").length)) === 1, JSON.stringify(fokus));
const prijeTastature = await page2.evaluate(() => [...document.querySelectorAll(".hvat")].map(h => h.textContent));
await page2.evaluate(() => document.querySelectorAll(".hvat")[2].focus());
await page2.keyboard.press("Enter");
const poslijeTastature = await page2.evaluate(() => [...document.querySelectorAll(".hvat")].map(h => h.textContent));
provjeri("Enter na drugoj stavci zamijeni im mjesta",
  poslijeTastature[0] === prijeTastature[2] && poslijeTastature[2] === prijeTastature[0],
  `${poslijeTastature[0]} / ${poslijeTastature[2]}`);
await page2.close();

// ── 4. Kontrast (WCAG AA ≥ 4,5:1) ────────────────────────────────────────
const page3 = await browser.newPage();
await page3.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page3.waitForSelector(".stavka");
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
    "naslov": "#naslov", "kicker": ".kicker", "uputa": "#uputa", "stavka": ".hvat",
    "broj mjesta": ".mjesto", "strelica": ".strelica",
    "oznaka stanja": ".stanje dt", "broj u stanju": ".stanje dd",
    "dugme": ".dugme", "glavno dugme": ".dugme.glavno",
  };
  const out = {};
  for (const [ime, sel] of Object.entries(uzorci)) {
    const el = document.querySelector(sel);
    if (el) out[ime] = omjer(el);
  }
  const li = document.querySelector(".stavka");
  li.classList.add("tacna");
  out["stavka na mjestu"] = omjer(li.querySelector(".hvat"));
  li.classList.remove("tacna");
  li.classList.add("netacna");
  out["označena stavka"] = omjer(li.querySelector(".hvat"));
  li.classList.remove("netacna");
  return out;
});
for (const [ime, o] of Object.entries(kontrasti)) provjeri(`kontrast ≥ 4,5:1 — ${ime}`, o >= 4.5, `${o}:1`);

await page3.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page3.reload({ waitUntil: "networkidle0" });
await page3.waitForSelector(".stavka");
const animacija = await page3.evaluate(() => {
  const d = document.createElement("div");
  d.className = "kraj";
  document.body.appendChild(d);
  const t = getComputedStyle(d).animationDuration;
  d.remove();
  return t;
});
provjeri("prefers-reduced-motion skraćuje animacije", parseFloat(animacija) <= 0.05, animacija);
await page3.close();

await browser.close();
server.close();

const palo = rezultati.filter(r => !r.ok);
console.log(`\n${rezultati.length - palo.length}/${rezultati.length} provjera prošlo`);
if (palo.length) { console.log("PALO:\n- " + palo.map(r => r.naziv).join("\n- ")); process.exit(1); }
