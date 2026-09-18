// Provjera vježbe „Spoji parove" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-spoji.mjs
//
// Servira `dist/public` lokalno, ugradi vježbu u iframe kao što to radi
// stranica lekcije, pa provjeri: širine 360/768/1280, spajanje prevlačenjem
// i dodirom, vraćanje odgovora, dugme „Pomozi mi", provjeru na kraju,
// kontrast teksta, prefers-reduced-motion, da poruka "kraj" stigne tačno
// jednom te da nema grešaka u konzoli ni ijednog zahtjeva prema vanjskim
// domenama. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const PODACI = "/vjezbe/spoji/podaci/pojmovi.json";
const IGRA = "/vjezbe/spoji/spoji.html";
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
await new Promise(r => server.listen(4197, r));
const BASE = "http://localhost:4197";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

const podaci = await (await fetch(`${BASE}${PODACI}`)).json();
const parovi = podaci.parovi;
const ukupno = parovi.length;

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
  await okvir.waitForSelector(".par");
  const stanje = await okvir.evaluate(() => ({
    parova: document.querySelectorAll(".par").length,
    mjesta: document.querySelectorAll(".mjesto").length,
    uPonudi: document.querySelectorAll("#ponuda .odgovor").length,
    prelivanje: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    najmanjaMeta: Math.min(...[...document.querySelectorAll(".odgovor, .dugme, .mjesto")]
      .filter(b => b.offsetParent !== null)
      .map(b => b.getBoundingClientRect().height)),
    font: document.fonts.check('800 16px Nunito'),
    naslov: document.getElementById("naslov").textContent,
    pojmovi: [...document.querySelectorAll(".pojam")].map(p => p.textContent).sort().join("|"),
  }));
  provjeri(`${sirina}px: svi parovi iscrtani`, stanje.parova === ukupno && stanje.mjesta === ukupno, `${stanje.parova}`);
  provjeri(`${sirina}px: pojmovi iz JSON-a`, stanje.pojmovi === parovi.map(p => p.lijevo).sort().join("|"), stanje.pojmovi);
  provjeri(`${sirina}px: svi odgovori u ponudi`, stanje.uPonudi === ukupno, `${stanje.uPonudi}`);
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
await page.setViewport({ width: 1280, height: 1100 });
await page.goto(`${BASE}/roditelj-test.html`, { waitUntil: "networkidle0" });
const okvirEl = await page.$("#okvir");
const okvir = await okvirEl.contentFrame();
await okvir.waitForSelector(".par");

const okvirBox = await okvirEl.boundingBox();
const tacka = async (selektor, indeks = 0) => {
  const r = await okvir.evaluate((sel, i) => {
    const el = document.querySelectorAll(sel)[i];
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const b = el.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, selektor, indeks);
  return r ? { x: okvirBox.x + r.x, y: okvirBox.y + r.y } : null;
};

// prevlačenje odgovora na POGREŠAN pojam — mora se prihvatiti
const prviOdgovor = await okvir.evaluate(() => document.querySelector("#ponuda .odgovor").textContent);
const tacanPojam = parovi.find(p => p.desno === prviOdgovor).lijevo;
const pogresanIndeks = await okvir.evaluate((pojam) =>
  [...document.querySelectorAll(".par")].findIndex(par => par.querySelector(".pojam").textContent !== pojam), tacanPojam);
const a = await tacka("#ponuda .odgovor", 0);
const b = await tacka(".mjesto", pogresanIndeks);
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
await page.mouse.move(b.x, b.y, { steps: 8 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 200));
const poslijePogresnog = await okvir.evaluate((i) => ({
  uMjestu: document.querySelectorAll(".mjesto")[i].querySelector(".odgovor")?.textContent ?? null,
  oznacenih: document.querySelectorAll(".odgovor.netacan").length,
  zelenih: document.querySelectorAll(".odgovor.tacan").length,
  provjeriZakljucano: document.getElementById("provjeri").disabled,
}), pogresanIndeks);
provjeri("odgovor se prihvata i uz pogrešan pojam",
  poslijePogresnog.uMjestu === prviOdgovor && poslijePogresnog.oznacenih === 0 && poslijePogresnog.zelenih === 0,
  JSON.stringify(poslijePogresnog));
provjeri("dugme Provjeri je zaključano dok sve nije spojeno", poslijePogresnog.provjeriZakljucano === true);

// dodir na smješten odgovor vraća ga u ponudu
const uMjestu = await tacka(".mjesto .odgovor", 0);
await page.mouse.click(uMjestu.x, uMjestu.y);
await new Promise(r => setTimeout(r, 200));
provjeri("dodir na smješten odgovor vraća ga u ponudu",
  (await okvir.evaluate(() => document.querySelectorAll("#ponuda .odgovor").length)) === ukupno);

// dodir na odgovor pa na mjesto
const t1 = await tacka("#ponuda .odgovor", 0);
await page.mouse.click(t1.x, t1.y);
await new Promise(r => setTimeout(r, 150));
provjeri("dodir označi odgovor", (await okvir.evaluate(() => document.querySelectorAll(".odgovor.izabrana").length)) === 1);
const t2 = await tacka(".mjesto", 0);
await page.mouse.click(t2.x, t2.y);
await new Promise(r => setTimeout(r, 200));
provjeri("dodir na mjesto uz pojam smješta odgovor",
  (await okvir.evaluate(() => document.querySelectorAll(".mjesto .odgovor").length)) === 1);

// spoji ostatak, ali dva odgovora namjerno zamijeni
await okvir.evaluate((parovi) => {
  const tacnoZa = {};
  parovi.forEach(p => { tacnoZa[p.desno] = p.lijevo; });
  // Prvo isprazni sve, pa spoji redom.
  for (let i = 0; i < 30; i++) {
    const s = document.querySelector(".mjesto .odgovor");
    if (!s) break;
    s.click();
  }
  const redoslijed = [...document.querySelectorAll("#ponuda .odgovor")].map(o => o.textContent);
  redoslijed.forEach((tekst, n) => {
    const odgovor = [...document.querySelectorAll("#ponuda .odgovor")].find(o => o.textContent === tekst);
    if (!odgovor) return;
    let ciljniPojam = tacnoZa[tekst];
    // Prva dva odgovora idu naopako (jedan kod drugog pojma).
    if (n === 0) ciljniPojam = tacnoZa[redoslijed[1]];
    if (n === 1) ciljniPojam = tacnoZa[redoslijed[0]];
    odgovor.click();
    const par = [...document.querySelectorAll(".par")].find(p => p.querySelector(".pojam").textContent === ciljniPojam);
    par.querySelector(".mjesto").click();
  });
}, parovi);
await new Promise(r => setTimeout(r, 400));
const prijeProvjere = await okvir.evaluate(() => ({
  uPonudi: document.querySelectorAll("#ponuda .odgovor").length,
  brojac: document.getElementById("brojac").textContent,
  provjeriZakljucano: document.getElementById("provjeri").disabled,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("kad je sve spojeno, Provjeri se otključa", prijeProvjere.provjeriZakljucano === false, JSON.stringify(prijeProvjere));
provjeri("brojač pokazuje da je sve spojeno", prijeProvjere.brojac === `${ukupno} od ${ukupno}`, prijeProvjere.brojac);
provjeri("panel kraja se ne pojavljuje sam od sebe", prijeProvjere.krajVidljiv === false);
provjeri("događaj 'kraj' još nije poslan",
  (await page.evaluate(() => window.__poruke.filter(p => p.dogadjaj === "kraj").length)) === 0);

await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 300));
const prvaProvjera = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".odgovor.tacan").length,
  crvenih: document.querySelectorAll(".odgovor.netacan").length,
  crvenihParova: document.querySelectorAll(".par.netacan").length,
  poruka: document.getElementById("poruka").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("provjera oboji tačne parove zeleno, a pogrešne crveno",
  prvaProvjera.zelenih === ukupno - 2 && prvaProvjera.crvenih === 2 && prvaProvjera.crvenihParova === 2,
  JSON.stringify(prvaProvjera));
provjeri("poruka kaže koliko je parova tačno",
  prvaProvjera.poruka.includes(`${ukupno - 2} od ${ukupno}`), prvaProvjera.poruka);
provjeri("vježba se ne završava dok ima grešaka", prvaProvjera.krajVidljiv === false);

for (let i = 0; i < 5; i++) {
  const ostalo = await okvir.evaluate(() => {
    const s = document.querySelector(".odgovor.netacan");
    if (!s) return false;
    s.click();
    return true;
  });
  if (!ostalo) break;
  await new Promise(r => setTimeout(r, 150));
}
provjeri("vraćanjem pogrešnih nestaju crvene oznake",
  (await okvir.evaluate(() => document.querySelectorAll(".odgovor.netacan, .par.netacan").length)) === 0);

const prijePomoci = await okvir.evaluate(() => document.querySelectorAll(".odgovor.tacan").length);
await okvir.click("#pomoc");
await new Promise(r => setTimeout(r, 250));
provjeri("dugme Pomozi mi spoji jedan par",
  (await okvir.evaluate(() => document.querySelectorAll(".odgovor.tacan").length)) === prijePomoci + 1);

// dovrši tačno
await okvir.evaluate((parovi) => {
  const tacnoZa = {};
  parovi.forEach(p => { tacnoZa[p.desno] = p.lijevo; });
  for (let i = 0; i < 30; i++) {
    const odgovor = document.querySelector("#ponuda .odgovor");
    if (!odgovor) break;
    const tekst = odgovor.textContent;
    odgovor.click();
    const par = [...document.querySelectorAll(".par")].find(p => p.querySelector(".pojam").textContent === tacnoZa[tekst]);
    par.querySelector(".mjesto").click();
  }
}, parovi);
await new Promise(r => setTimeout(r, 400));
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 500));

const kraj = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".odgovor.tacan").length,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  krajOpis: document.getElementById("kraj-opis").textContent,
}));
provjeri("svi parovi su tačni", kraj.zelenih === ukupno, JSON.stringify(kraj));
provjeri("panel kraja prikazan", kraj.krajVidljiv);
provjeri("panel kraja kaže vrijeme, prvi pokušaj i pomoć",
  /Vrijeme:/.test(kraj.krajOpis) && /Iz prve/.test(kraj.krajOpis) && /Pomoć/.test(kraj.krajOpis), kraj.krajOpis);

const poruke = await page.evaluate(() => window.__poruke);
const krajevi = poruke.filter(p => p.dogadjaj === "kraj");
provjeri("događaj 'kraj' stigao tačno jednom", krajevi.length === 1, `${krajevi.length}×`);
provjeri("događaj 'kraj' nosi tražena polja", krajevi[0]
  && krajevi[0].id === podaci.id
  && krajevi[0].pronadjeno === ukupno
  && krajevi[0].ukupno === ukupno
  && typeof krajevi[0].sekunde === "number"
  && krajevi[0].greske === 2
  && krajevi[0].pomoc === 1
  && krajevi[0].provjere >= 2
  && krajevi[0].tacnoIzPrve === ukupno - 2, JSON.stringify(krajevi[0]));
provjeri("događaj 'par' po svakom tačnom paru",
  poruke.filter(p => p.dogadjaj === "par").length === ukupno,
  `${poruke.filter(p => p.dogadjaj === "par").length}`);
provjeri("događaj 'visina' poslan", poruke.some(p => p.dogadjaj === "visina"));
provjeri("nema grešaka u konzoli tokom igre", greske.length === 0, greske.join(" | "));
provjeri("nema vanjskih zahtjeva tokom igre", vanjski.length === 0, vanjski.join(" | "));

await okvir.click("#nova");
await new Promise(r => setTimeout(r, 300));
const poslijeNove = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".odgovor.tacan").length,
  uPonudi: document.querySelectorAll("#ponuda .odgovor").length,
  krajSkriven: document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("Pocni ispocetka vraca vjezbu na pocetak",
  poslijeNove.zelenih === 0 && poslijeNove.uPonudi === ukupno && poslijeNove.krajSkriven, JSON.stringify(poslijeNove));
await page.close();

// ── 3. Tastatura ─────────────────────────────────────────────────────────
const page2 = await browser.newPage();
await page2.setViewport({ width: 1280, height: 1100 });
await page2.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page2.waitForSelector(".par");
const fokus = await page2.evaluate(() => {
  const o = document.querySelector("#ponuda .odgovor");
  o.focus();
  return { fokus: document.activeElement === o, vidljivFokus: getComputedStyle(o).outlineStyle !== "none" };
});
await page2.keyboard.press("Enter");
provjeri("Enter na odgovoru ga označi",
  (await page2.evaluate(() => document.querySelectorAll(".odgovor.izabrana").length)) === 1, JSON.stringify(fokus));
await page2.evaluate(() => document.querySelector(".mjesto").focus());
await page2.keyboard.press("Enter");
await new Promise(r => setTimeout(r, 200));
provjeri("Enter na mjestu uz pojam smješta odgovor",
  (await page2.evaluate(() => document.querySelectorAll(".mjesto .odgovor").length)) === 1);
await page2.close();

// ── 4. Kontrast (WCAG AA ≥ 4,5:1) ────────────────────────────────────────
const page3 = await browser.newPage();
await page3.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page3.waitForSelector(".par");
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
    "naslov": "#naslov", "kicker": ".kicker", "uputa": "#uputa",
    "pojam": ".pojam", "prazno mjesto": ".mjesto .prazno", "odgovor": ".odgovor",
    "oznaka stanja": ".stanje dt", "broj u stanju": ".stanje dd",
    "dugme": ".dugme", "glavno dugme": ".dugme.glavno",
  };
  const out = {};
  for (const [ime, sel] of Object.entries(uzorci)) {
    const el = document.querySelector(sel);
    if (el) out[ime] = omjer(el);
  }
  const o = document.querySelector(".odgovor");
  o.classList.add("tacan"); out["tačan odgovor"] = omjer(o); o.classList.remove("tacan");
  o.classList.add("netacan"); out["označen odgovor"] = omjer(o); o.classList.remove("netacan");
  return out;
});
for (const [ime, o] of Object.entries(kontrasti)) provjeri(`kontrast ≥ 4,5:1 — ${ime}`, o >= 4.5, `${o}:1`);

await page3.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page3.reload({ waitUntil: "networkidle0" });
await page3.waitForSelector(".par");
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
