// Provjera vježbe „Razvrstaj" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-razvrstaj.mjs
//
// Servira `dist/public` lokalno, ugradi vježbu u iframe kao što to radi
// stranica lekcije, pa provjeri: širine 360/768/1280, smještanje u kutije
// prevlačenjem i dodirom, vraćanje stavke, dugme „Pomozi mi", provjeru na kraju,
// kontrast teksta, prefers-reduced-motion, da poruka "kraj" stigne tačno
// jednom te da nema grešaka u konzoli ni ijednog zahtjeva prema vanjskim
// domenama. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const PODACI = "/vjezbe/razvrstaj/podaci/mjeseci.json";
const IGRA = "/vjezbe/razvrstaj/razvrstaj.html";
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
await new Promise(r => server.listen(4196, r));
const BASE = "http://localhost:4196";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

const podaci = await (await fetch(`${BASE}${PODACI}`)).json();
const kategorije = podaci.kategorije;
const ukupno = kategorije.reduce((z, k) => z + k.stavke.length, 0);
const kutijaZa = (tekst) => kategorije.findIndex(k => k.stavke.includes(tekst));

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
  await okvir.waitForSelector(".kutija");
  const stanje = await okvir.evaluate(() => ({
    kutija: document.querySelectorAll(".kutija").length,
    uPonudi: document.querySelectorAll("#ponuda .stavka").length,
    prelivanje: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    najmanjaMeta: Math.min(...[...document.querySelectorAll(".stavka, .dugme")]
      .filter(b => b.offsetParent !== null)
      .map(b => b.getBoundingClientRect().height)),
    font: document.fonts.check('800 16px Nunito'),
    naslov: document.getElementById("naslov").textContent,
    nazivi: [...document.querySelectorAll(".kutija h2")].map(h => h.firstChild.textContent).join("|"),
  }));
  provjeri(`${sirina}px: sve kutije iscrtane`, stanje.kutija === kategorije.length, `${stanje.kutija}`);
  provjeri(`${sirina}px: nazivi kutija iz JSON-a`, stanje.nazivi === kategorije.map(k => k.naziv).join("|"), stanje.nazivi);
  provjeri(`${sirina}px: sve stavke u ponudi`, stanje.uPonudi === ukupno, `${stanje.uPonudi}`);
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
await okvir.waitForSelector(".kutija");

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
const prvaUPonudi = () => okvir.evaluate(() => document.querySelector("#ponuda .stavka")?.textContent ?? null);

// prevlačenje stavke u POGREŠNU kutiju — mora se prihvatiti
const stavkaTekst = await prvaUPonudi();
const tacnaKutija = kutijaZa(stavkaTekst);
const pogresnaKutija = tacnaKutija === 0 ? 1 : 0;
const a = await tacka("#ponuda .stavka", 0);
const b = await tacka(".kutija", pogresnaKutija);
await page.mouse.move(a.x, a.y);
await page.mouse.down();
await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
await page.mouse.move(b.x, b.y, { steps: 8 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 200));
const poslijePogresne = await okvir.evaluate((k) => ({
  uKutiji: [...document.querySelectorAll(".kutija")[k].querySelectorAll(".stavka")].map(s => s.textContent),
  oznacenih: document.querySelectorAll(".stavka.netacna").length,
  zakljucanih: document.querySelectorAll(".stavka.tacna").length,
  provjeriZakljucano: document.getElementById("provjeri").disabled,
}), pogresnaKutija);
provjeri("stavka se prihvata i u pogrešnoj kutiji",
  poslijePogresne.uKutiji.includes(stavkaTekst) && poslijePogresne.oznacenih === 0 && poslijePogresne.zakljucanih === 0,
  JSON.stringify(poslijePogresne));
provjeri("dugme Provjeri je zaključano dok sve nije razvrstano", poslijePogresne.provjeriZakljucano === true);

// dodir na stavku u kutiji je vraća u ponudu
const uKutiji = await tacka(`.kutija:nth-of-type(${pogresnaKutija + 1}) .stavka`, 0);
await page.mouse.click(uKutiji.x, uKutiji.y);
await new Promise(r => setTimeout(r, 200));
provjeri("dodir na smještenu stavku vraća je u ponudu",
  (await okvir.evaluate(() => document.querySelectorAll("#ponuda .stavka").length)) === ukupno,
  `${await okvir.evaluate(() => document.querySelectorAll("#ponuda .stavka").length)}`);

// dodir na stavku pa na kutiju
const t1 = await tacka("#ponuda .stavka", 0);
await page.mouse.click(t1.x, t1.y);
await new Promise(r => setTimeout(r, 150));
provjeri("dodir označi stavku", (await okvir.evaluate(() => document.querySelectorAll(".stavka.izabrana").length)) === 1);
const t2 = await tacka(".kutija", tacnaKutija);
await page.mouse.click(t2.x, t2.y);
await new Promise(r => setTimeout(r, 200));
provjeri("dodir na kutiju smješta označenu stavku",
  (await okvir.evaluate((k, tekst) => [...document.querySelectorAll(".kutija")[k].querySelectorAll(".stavka")].some(s => s.textContent === tekst), tacnaKutija, stavkaTekst)) === true);

// razvrstaj ostatak, ali dvije stavke namjerno zamijeni kutijama
await okvir.evaluate((kategorije) => {
  const naziviPoStavci = {};
  kategorije.forEach((k, i) => k.stavke.forEach(s => { naziviPoStavci[s] = i; }));
  let obrnuto = 0;
  for (let straza = 0; straza < 100; straza++) {
    const stavka = document.querySelector("#ponuda .stavka");
    if (!stavka) break;
    const tekst = stavka.textContent;
    let cilj = naziviPoStavci[tekst];
    if (obrnuto < 2) { cilj = cilj === 0 ? 1 : 0; obrnuto++; }
    stavka.click();
    document.querySelectorAll(".kutija")[cilj].click();
  }
}, kategorije);
await new Promise(r => setTimeout(r, 300));
const prijeProvjere = await okvir.evaluate(() => ({
  uPonudi: document.querySelectorAll("#ponuda .stavka").length,
  brojac: document.getElementById("brojac").textContent,
  provjeriZakljucano: document.getElementById("provjeri").disabled,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  ponudaPrazna: !document.getElementById("ponuda-prazna").hasAttribute("hidden"),
}));
provjeri("kad je sve razvrstano, Provjeri se otključa", prijeProvjere.provjeriZakljucano === false, JSON.stringify(prijeProvjere));
provjeri("ponuda je prazna kad je sve smješteno", prijeProvjere.uPonudi === 0 && prijeProvjere.ponudaPrazna);
provjeri("brojač pokazuje da je sve razvrstano", prijeProvjere.brojac === `${ukupno} od ${ukupno}`, prijeProvjere.brojac);
provjeri("panel kraja se ne pojavljuje sam od sebe", prijeProvjere.krajVidljiv === false);
provjeri("događaj 'kraj' još nije poslan",
  (await page.evaluate(() => window.__poruke.filter(p => p.dogadjaj === "kraj").length)) === 0);

// prva provjera: dvije stavke su u pogrešnim kutijama
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 300));
const prvaProvjera = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".stavka.tacna").length,
  crvenih: document.querySelectorAll(".stavka.netacna").length,
  poruka: document.getElementById("poruka").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("provjera oboji tačne zeleno, a pogrešne crveno",
  prvaProvjera.zelenih === ukupno - 2 && prvaProvjera.crvenih === 2, JSON.stringify(prvaProvjera));
provjeri("poruka kaže koliko je tačno razvrstano",
  prvaProvjera.poruka.includes(`${ukupno - 2} od ${ukupno}`), prvaProvjera.poruka);
provjeri("vježba se ne završava dok ima grešaka", prvaProvjera.krajVidljiv === false);

// ispravi pogrešne
for (let i = 0; i < 5; i++) {
  const ostalo = await okvir.evaluate(() => {
    const s = document.querySelector(".stavka.netacna");
    if (!s) return false;
    s.click();
    return true;
  });
  if (!ostalo) break;
  await new Promise(r => setTimeout(r, 150));
}
provjeri("vraćanjem pogrešnih nestaju crvene oznake",
  (await okvir.evaluate(() => document.querySelectorAll(".stavka.netacna").length)) === 0);

// dugme „Pomozi mi" riješi jednu
const prijePomoci = await okvir.evaluate(() => document.querySelectorAll(".stavka.tacna").length);
await okvir.click("#pomoc");
await new Promise(r => setTimeout(r, 250));
provjeri("dugme Pomozi mi smjesti stavku u pravu kutiju",
  (await okvir.evaluate(() => document.querySelectorAll(".stavka.tacna").length)) === prijePomoci + 1);

// dovrši
await okvir.evaluate((kategorije) => {
  const naziviPoStavci = {};
  kategorije.forEach((k, i) => k.stavke.forEach(s => { naziviPoStavci[s] = i; }));
  for (let straza = 0; straza < 100; straza++) {
    const stavka = document.querySelector("#ponuda .stavka");
    if (!stavka) break;
    const tekst = stavka.textContent;
    stavka.click();
    document.querySelectorAll(".kutija")[naziviPoStavci[tekst]].click();
  }
}, kategorije);
await new Promise(r => setTimeout(r, 300));
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 400));

const kraj = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".stavka.tacna").length,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  krajOpis: document.getElementById("kraj-opis").textContent,
}));
provjeri("sve stavke su tačno razvrstane", kraj.zelenih === ukupno, JSON.stringify(kraj));
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
provjeri("događaj 'stavka' po svakoj potvrđenoj stavci",
  poruke.filter(p => p.dogadjaj === "stavka").length === ukupno,
  `${poruke.filter(p => p.dogadjaj === "stavka").length}`);
provjeri("događaj 'visina' poslan", poruke.some(p => p.dogadjaj === "visina"));
provjeri("nema grešaka u konzoli tokom igre", greske.length === 0, greske.join(" | "));
provjeri("nema vanjskih zahtjeva tokom igre", vanjski.length === 0, vanjski.join(" | "));

await okvir.click("#nova");
await new Promise(r => setTimeout(r, 300));
const poslijeNove = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".stavka.tacna").length,
  uPonudi: document.querySelectorAll("#ponuda .stavka").length,
  krajSkriven: document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("Pocni ispocetka vraca vjezbu na pocetak",
  poslijeNove.zelenih === 0 && poslijeNove.uPonudi === ukupno && poslijeNove.krajSkriven, JSON.stringify(poslijeNove));
await page.close();

// ── 3. Tastatura ─────────────────────────────────────────────────────────
const page2 = await browser.newPage();
await page2.setViewport({ width: 1280, height: 1100 });
await page2.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page2.waitForSelector(".kutija");
const fokus = await page2.evaluate(() => {
  const s = document.querySelector("#ponuda .stavka");
  s.focus();
  return { fokus: document.activeElement === s, vidljivFokus: getComputedStyle(s).outlineStyle !== "none" };
});
await page2.keyboard.press("Enter");
provjeri("Enter na stavci je označi",
  (await page2.evaluate(() => document.querySelectorAll(".stavka.izabrana").length)) === 1, JSON.stringify(fokus));
await page2.evaluate(() => document.querySelector(".kutija").focus());
await page2.keyboard.press("Enter");
await new Promise(r => setTimeout(r, 200));
provjeri("Enter na kutiji smješta označenu stavku",
  (await page2.evaluate(() => document.querySelectorAll(".kutija .stavka").length)) === 1);
await page2.close();

// ── 4. Kontrast (WCAG AA ≥ 4,5:1) ────────────────────────────────────────
const page3 = await browser.newPage();
await page3.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page3.waitForSelector(".kutija");
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
    "naziv kutije": ".kutija h2", "brojka u kutiji": ".kutija h2 .broj", "prazna kutija": ".kutija .prazno",
    "stavka": ".stavka", "oznaka stanja": ".stanje dt", "broj u stanju": ".stanje dd",
    "dugme": ".dugme", "glavno dugme": ".dugme.glavno",
  };
  const out = {};
  for (const [ime, sel] of Object.entries(uzorci)) {
    const el = document.querySelector(sel);
    if (el) out[ime] = omjer(el);
  }
  const s = document.querySelector(".stavka");
  s.classList.add("tacna"); out["tačna stavka"] = omjer(s); s.classList.remove("tacna");
  s.classList.add("netacna"); out["označena stavka"] = omjer(s); s.classList.remove("netacna");
  return out;
});
for (const [ime, o] of Object.entries(kontrasti)) provjeri(`kontrast ≥ 4,5:1 — ${ime}`, o >= 4.5, `${o}:1`);

await page3.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page3.reload({ waitUntil: "networkidle0" });
await page3.waitForSelector(".kutija");
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
