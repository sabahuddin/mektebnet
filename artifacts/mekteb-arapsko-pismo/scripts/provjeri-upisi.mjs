// Provjera vježbe „Upiši odgovor" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-upisi.mjs
//
// Servira `dist/public` lokalno, ugradi vježbu u iframe kao što to radi
// stranica lekcije, pa provjeri: širine 360/768/1280, upisivanje odgovora,
// blago poređenje (velika slova, razmaci, kvačice), dugme „Pomozi mi",
// kontrast teksta, prefers-reduced-motion, da poruka "kraj" stigne tačno
// jednom te da nema grešaka u konzoli ni ijednog zahtjeva prema vanjskim
// domenama. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const PODACI = "/vjezbe/upisi/podaci/pojmovi.json";
const IGRA = "/vjezbe/upisi/upisi.html";
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
await new Promise(r => server.listen(4198, r));
const BASE = "http://localhost:4198";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

const podaci = await (await fetch(`${BASE}${PODACI}`)).json();
const pitanja = podaci.pitanja;
const ukupno = pitanja.length;

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
  await okvir.waitForSelector(".pitanje");
  const stanje = await okvir.evaluate(() => ({
    pitanja: document.querySelectorAll(".pitanje").length,
    polja: document.querySelectorAll(".upis").length,
    prelivanje: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    najmanjaMeta: Math.min(...[...document.querySelectorAll(".upis, .dugme")]
      .filter(b => b.offsetParent !== null)
      .map(b => b.getBoundingClientRect().height)),
    font: document.fonts.check('800 16px Nunito'),
    naslov: document.getElementById("naslov").textContent,
    pomoci: document.querySelectorAll(".pomoc-tekst").length,
  }));
  provjeri(`${sirina}px: sva pitanja iscrtana`, stanje.pitanja === ukupno && stanje.polja === ukupno, `${stanje.pitanja}`);
  provjeri(`${sirina}px: pomoć uz pitanje prikazana`, stanje.pomoci === pitanja.filter(p => p.pomoc).length, `${stanje.pomoci}`);
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
const okvir = await (await page.$("#okvir")).contentFrame();
await okvir.waitForSelector(".pitanje");

const upisi = async (i, tekst) => {
  const polje = (await okvir.$$(".upis"))[i];
  await polje.click({ clickCount: 3 });
  await polje.type(tekst);
};

provjeri("dugme Provjeri je zaključano dok su polja prazna",
  (await okvir.evaluate(() => document.getElementById("provjeri").disabled)) === true);

// prvo pitanje tačno ali VELIKIM slovima i s tačkom, drugo pogrešno
await upisi(0, "  EZAN. ");
await upisi(1, "namaz");
for (let i = 2; i < ukupno; i++) await upisi(i, pitanja[i].odgovor);
await new Promise(r => setTimeout(r, 200));
provjeri("kad su sva polja popunjena, Provjeri se otključa",
  (await okvir.evaluate(() => document.getElementById("provjeri").disabled)) === false);
provjeri("događaj 'kraj' još nije poslan",
  (await page.evaluate(() => window.__poruke.filter(p => p.dogadjaj === "kraj").length)) === 0);

await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 300));
const prva = await okvir.evaluate(() => ({
  tacnih: document.querySelectorAll(".pitanje.tacno").length,
  netacnih: document.querySelectorAll(".pitanje.netacno").length,
  brojac: document.getElementById("brojac").textContent,
  poruka: document.getElementById("poruka").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("velika slova, razmaci i tačka ne smetaju",
  prva.tacnih === ukupno - 1 && prva.netacnih === 1, JSON.stringify(prva));
provjeri("brojač broji tačne odgovore", prva.brojac === `${ukupno - 1} od ${ukupno}`, prva.brojac);
provjeri("poruka kaže koliko je tačno", prva.poruka.includes(`${ukupno - 1} od ${ukupno}`), prva.poruka);
provjeri("vježba se ne završava dok ima grešaka", prva.krajVidljiv === false);
provjeri("tačna polja su zaključana",
  (await okvir.evaluate(() => [...document.querySelectorAll(".pitanje.tacno .upis")].every(p => p.disabled))) === true);

// ispravljanje: čim dijete kuca, crvena oznaka nestaje
await upisi(1, "x");
await new Promise(r => setTimeout(r, 200));
provjeri("kucanjem nestaje crvena oznaka",
  (await okvir.evaluate(() => document.querySelectorAll(".pitanje.netacno").length)) === 0);

// odgovor bez kvačica se priznaje uz napomenu
await upisi(1, "abdest");
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 400));
const kraj = await okvir.evaluate(() => ({
  tacnih: document.querySelectorAll(".pitanje.tacno").length,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  krajOpis: document.getElementById("kraj-opis").textContent,
  brojac: document.getElementById("brojac").textContent,
}));
provjeri("svi odgovori su tačni", kraj.tacnih === ukupno, JSON.stringify(kraj));
provjeri("panel kraja prikazan", kraj.krajVidljiv);
provjeri("brojač pokazuje sve tačno", kraj.brojac === `${ukupno} od ${ukupno}`, kraj.brojac);
provjeri("panel kraja kaže vrijeme i prvi pokušaj",
  /Vrijeme:/.test(kraj.krajOpis) && /Iz prve tačno: /.test(kraj.krajOpis), kraj.krajOpis);

const poruke = await page.evaluate(() => window.__poruke);
const krajevi = poruke.filter(p => p.dogadjaj === "kraj");
provjeri("događaj 'kraj' stigao tačno jednom", krajevi.length === 1, `${krajevi.length}×`);
provjeri("događaj 'kraj' nosi tražena polja", krajevi[0]
  && krajevi[0].id === podaci.id
  && krajevi[0].pronadjeno === ukupno
  && krajevi[0].ukupno === ukupno
  && typeof krajevi[0].sekunde === "number"
  && krajevi[0].greske === 1
  && krajevi[0].pomoc === 0
  && krajevi[0].provjere === 2
  && krajevi[0].tacnoIzPrve === ukupno - 1, JSON.stringify(krajevi[0]));
provjeri("događaj 'odgovor' po svakom tačnom odgovoru",
  poruke.filter(p => p.dogadjaj === "odgovor").length === ukupno,
  `${poruke.filter(p => p.dogadjaj === "odgovor").length}`);
provjeri("događaj 'visina' poslan", poruke.some(p => p.dogadjaj === "visina"));
provjeri("nema grešaka u konzoli tokom igre", greske.length === 0, greske.join(" | "));
provjeri("nema vanjskih zahtjeva tokom igre", vanjski.length === 0, vanjski.join(" | "));
await page.close();

// ── 3. Kvačice i „Pomozi mi" ─────────────────────────────────────────────
const page2 = await browser.newPage();
await page2.setViewport({ width: 1280, height: 1100 });
await page2.goto(`${BASE}${IGRA}?podaci=/vjezbe/upisi/podaci/ramazan.json`, { waitUntil: "networkidle0" });
await page2.waitForSelector(".pitanje");
const ramazan = await (await fetch(`${BASE}/vjezbe/upisi/podaci/ramazan.json`)).json();

// prvi odgovor bez kvačica (ramazan nema kvačica, pa uzmi „Ramazanski bajram" zadnji)
const polja2 = await page2.$$(".upis");
await polja2[0].type("Ramazan");
await polja2[1].type("sehur");
await polja2[2].type("iftar");
await polja2[3].type("ramazanski bajram");
await page2.click("#provjeri");
await new Promise(r => setTimeout(r, 400));
provjeri("mala slova u odgovoru se priznaju",
  (await page2.evaluate(() => document.querySelectorAll(".pitanje.tacno").length)) === ramazan.pitanja.length);

const page3 = await browser.newPage();
await page3.setViewport({ width: 1280, height: 1100 });
await page3.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page3.waitForSelector(".pitanje");
await page3.click("#pomoc");
await new Promise(r => setTimeout(r, 300));
const poslijePomoci = await page3.evaluate(() => ({
  tacnih: document.querySelectorAll(".pitanje.tacno").length,
  prviUpis: document.querySelector(".upis").value,
  napomena: document.querySelector(".napomena")?.textContent ?? "",
}));
provjeri("dugme Pomozi mi upiše tačan odgovor",
  poslijePomoci.tacnih === 1 && poslijePomoci.prviUpis === pitanja[0].odgovor, JSON.stringify(poslijePomoci));

// odgovor bez kvačica: provjeri na riječi sa kvačicom
const polja3 = await page3.$$(".upis");
let indeksSKvacicom = pitanja.findIndex(p => /[čćđšž]/i.test(p.odgovor));
if (indeksSKvacicom < 0) indeksSKvacicom = -1;
if (indeksSKvacicom >= 0) {
  const bez = pitanja[indeksSKvacicom].odgovor
    .replace(/[čć]/g, "c").replace(/đ/g, "d").replace(/š/g, "s").replace(/ž/g, "z");
  await polja3[indeksSKvacicom].type(bez);
  for (let i = 1; i < pitanja.length; i++) {
    if (i === indeksSKvacicom) continue;
    await polja3[i].type(pitanja[i].odgovor);
  }
  await page3.click("#provjeri");
  await new Promise(r => setTimeout(r, 400));
  const sKvacicom = await page3.evaluate(() => ({
    tacnih: document.querySelectorAll(".pitanje.tacno").length,
    napomene: [...document.querySelectorAll(".napomena")].map(n => n.textContent),
  }));
  provjeri("odgovor bez kvačica se priznaje uz napomenu",
    sKvacicom.tacnih === pitanja.length && sKvacicom.napomene.some(n => /Pazi samo kako se piše/.test(n)),
    JSON.stringify(sKvacicom));
} else {
  provjeri("odgovor bez kvačica se priznaje uz napomenu (nema takvog pitanja u primjeru)", true);
}
await page2.close();
await page3.close();

// ── 4. Kontrast (WCAG AA ≥ 4,5:1) ────────────────────────────────────────
const page4 = await browser.newPage();
await page4.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page4.waitForSelector(".pitanje");
const kontrasti = await page4.evaluate(() => {
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
    "pitanje": ".tekst", "redni broj": ".redni", "polje za upis": ".upis",
    "pomoć uz pitanje": ".pomoc-tekst",
    "oznaka stanja": ".stanje dt", "broj u stanju": ".stanje dd",
    "dugme": ".dugme", "glavno dugme": ".dugme.glavno",
  };
  const out = {};
  for (const [ime, sel] of Object.entries(uzorci)) {
    const el = document.querySelector(sel);
    if (el) out[ime] = omjer(el);
  }
  const p = document.querySelector(".pitanje");
  p.classList.add("netacno"); out["označeno pitanje"] = omjer(p.querySelector(".upis")); p.classList.remove("netacno");
  return out;
});
for (const [ime, o] of Object.entries(kontrasti)) provjeri(`kontrast ≥ 4,5:1 — ${ime}`, o >= 4.5, `${o}:1`);

await page4.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page4.reload({ waitUntil: "networkidle0" });
await page4.waitForSelector(".pitanje");
const animacija = await page4.evaluate(() => {
  const d = document.createElement("div");
  d.className = "kraj";
  document.body.appendChild(d);
  const t = getComputedStyle(d).animationDuration;
  d.remove();
  return t;
});
provjeri("prefers-reduced-motion skraćuje animacije", parseFloat(animacija) <= 0.05, animacija);
await page4.close();

await browser.close();
server.close();

const palo = rezultati.filter(r => !r.ok);
console.log(`\n${rezultati.length - palo.length}/${rezultati.length} provjera prošlo`);
if (palo.length) { console.log("PALO:\n- " + palo.map(r => r.naziv).join("\n- ")); process.exit(1); }
