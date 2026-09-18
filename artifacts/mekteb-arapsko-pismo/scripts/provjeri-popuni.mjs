// Provjera vježbe „Popuni prazninu" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija, nakon `pnpm run build`):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-popuni.mjs
//
// Servira `dist/public` lokalno, ugradi vježbu u iframe kao što to radi
// stranica lekcije, pa provjeri: širine 360/768/1280, prevlačenje mišem i
// prstom, način „dodirni riječ pa prazninu", tastaturu, slobodno slaganje i
// provjeru na kraju (pogrešna riječ se prihvata, pa se ispravlja),
// dugme „Pomozi mi", kontrast teksta, prefers-reduced-motion, da poruka
// "kraj" stigne tačno jednom te da nema grešaka u konzoli ni ijednog zahtjeva
// prema vanjskim domenama. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist/public");
const PODACI = "/vjezbe/popuni/podaci/abdest.json";
const IGRA = "/vjezbe/popuni/popuni.html";
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
await new Promise(r => server.listen(4193, r));
const BASE = "http://localhost:4193";

const rezultati = [];
function provjeri(naziv, uslov, dodatak = "") {
  rezultati.push({ naziv, ok: !!uslov });
  console.log(`${uslov ? "OK  " : "PALO"} ${naziv}${dodatak ? " — " + dodatak : ""}`);
}

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
  await okvir.waitForSelector(".praznina");
  const stanje = await okvir.evaluate(() => ({
    praznine: document.querySelectorAll(".praznina").length,
    rijeci: document.querySelectorAll(".rijec").length,
    prelivanje: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    najmanjaMeta: Math.min(...[...document.querySelectorAll(".praznina, .rijec, .dugme")]
      .filter(b => b.offsetParent !== null)
      .map(b => b.getBoundingClientRect().height)),
    font: document.fonts.check('800 16px Nunito'),
    naslov: document.getElementById("naslov").textContent,
    pasusa: document.querySelectorAll(".prica p").length,
  }));
  provjeri(`${sirina}px: sve praznine iscrtane`, stanje.praznine === 11, `${stanje.praznine}`);
  provjeri(`${sirina}px: ponuđene riječi iscrtane`, stanje.rijeci === 11, `${stanje.rijeci}`);
  provjeri(`${sirina}px: priča razlomljena u pasuse`, stanje.pasusa >= 7, `${stanje.pasusa} pasusa`);
  provjeri(`${sirina}px: nema horizontalnog prelivanja`, !stanje.prelivanje);
  provjeri(`${sirina}px: površine za dodir ≥ 44px`, stanje.najmanjaMeta >= 44, `najmanja ${stanje.najmanjaMeta.toFixed(1)}px`);
  provjeri(`${sirina}px: Nunito učitan lokalno`, stanje.font === true);
  provjeri(`${sirina}px: nema grešaka u konzoli`, greske.length === 0, greske.join(" | "));
  provjeri(`${sirina}px: nema zahtjeva prema vanjskim domenama`, vanjski.length === 0, vanjski.join(" | "));
  provjeri(`${sirina}px: naslov iz JSON-a`, stanje.naslov.length > 0, stanje.naslov);
  await page.close();
}

// ── 2. Rješavanje: pogrešan pokušaj, prevlačenje, dodir, pomoć ───────────
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
await okvir.waitForSelector(".praznina");

const podaci = await (await fetch(`${BASE}${PODACI}`)).json();
const trazene = [...podaci.tekst.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);

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
const indeksRijeci = async (rijec) => okvir.evaluate((r) =>
  [...document.querySelectorAll(".rijec")].findIndex(b => b.textContent === r && !b.classList.contains("potrosena")), rijec);

async function prevuci(odRijeci, naPrazninu) {
  const i = await indeksRijeci(odRijeci);
  if (i < 0) return false;
  const a = await tacka(".rijec", i);
  const b = await tacka(".praznina", naPrazninu);
  if (!a || !b) return false;
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 150));
  return true;
}

// pogrešna riječ se sada PRIHVATA — provjera dolazi tek na kraju
await prevuci(trazene[1], 0);
const poslijePogresne = await okvir.evaluate(() => ({
  poruka: document.getElementById("poruka").textContent,
  tekstPrve: document.querySelector(".praznina").textContent,
  popunjenih: document.querySelectorAll(".praznina.popunjena").length,
  oznacenih: document.querySelectorAll(".praznina.netacna").length,
  provjeriZakljucano: document.getElementById("provjeri").disabled,
}));
provjeri("pogrešna riječ se prihvata i ostaje u praznini",
  poslijePogresne.tekstPrve === trazene[1] && poslijePogresne.popunjenih === 1 && poslijePogresne.oznacenih === 0,
  JSON.stringify(poslijePogresne));
provjeri("dugme Provjeri je zaključano dok sve nije popunjeno", poslijePogresne.provjeriZakljucano === true);

// dodir na smještenu riječ vraća je među ponuđene
const tackaPrve = await tacka(".praznina", 0);
await page.mouse.click(tackaPrve.x, tackaPrve.y);
await new Promise(r => setTimeout(r, 150));
const poslijeVracanja = await okvir.evaluate(() => ({
  tekstPrve: document.querySelector(".praznina").textContent,
  popunjenih: document.querySelectorAll(".praznina.popunjena").length,
  brojac: document.getElementById("brojac").textContent,
}));
provjeri("dodir na smještenu riječ vraća je u ponudu",
  poslijeVracanja.tekstPrve === "?" && poslijeVracanja.popunjenih === 0,
  JSON.stringify(poslijeVracanja));

// tačna riječ prevlačenjem
await prevuci(trazene[0], 0);
const poslijeTacne = await okvir.evaluate(() => ({
  popunjenih: document.querySelectorAll(".praznina.popunjena").length,
  zelenih: document.querySelectorAll(".praznina.tacna").length,
  brojac: document.getElementById("brojac").textContent,
  tekstPrve: document.querySelector(".praznina").textContent,
}));
provjeri("riječ prevlačenjem sjeda na mjesto", poslijeTacne.popunjenih === 1 && poslijeTacne.tekstPrve === trazene[0], JSON.stringify(poslijeTacne));
provjeri("prije provjere nema zelenih oznaka", poslijeTacne.zelenih === 0, `${poslijeTacne.zelenih}`);
provjeri("brojač prati popunjenost", poslijeTacne.brojac === `1 od ${trazene.length}`, poslijeTacne.brojac);

// način „dodirni riječ pa prazninu"
const iDruge = await indeksRijeci(trazene[1]);
const tackaRijeci = await tacka(".rijec", iDruge);
await page.mouse.click(tackaRijeci.x, tackaRijeci.y);
await new Promise(r => setTimeout(r, 120));
const izabrana = await okvir.evaluate(() => document.querySelectorAll(".rijec.izabrana").length);
provjeri("dodir na riječ je označi", izabrana === 1);
const tackaPraznine = await tacka(".praznina", 1);
await page.mouse.click(tackaPraznine.x, tackaPraznine.y);
await new Promise(r => setTimeout(r, 150));
provjeri("dodir na prazninu smješta označenu riječ",
  (await okvir.evaluate(() => document.querySelectorAll(".praznina.popunjena").length)) === 2);

// dugme „Pomozi mi" rješava jednu prazninu odmah i zeleno
await okvir.click("#pomoc");
await new Promise(r => setTimeout(r, 150));
provjeri("dugme Pomozi mi riješi jednu prazninu",
  (await okvir.evaluate(() => document.querySelectorAll(".praznina.tacna").length)) === 1);

// ostatak popunjavamo, ali dvije riječi namjerno zamijenimo
const zamjena = { [trazene.length - 2]: trazene[trazene.length - 1], [trazene.length - 1]: trazene[trazene.length - 2] };
for (let i = 3; i < trazene.length; i++) {
  await prevuci(zamjena[i] ?? trazene[i], i);
}
const prijeProvjere = await okvir.evaluate(() => ({
  brojac: document.getElementById("brojac").textContent,
  provjeriZakljucano: document.getElementById("provjeri").disabled,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("kad je sve popunjeno, Provjeri se otključa", prijeProvjere.provjeriZakljucano === false, JSON.stringify(prijeProvjere));
provjeri("panel kraja se ne pojavljuje sam od sebe", prijeProvjere.krajVidljiv === false);
provjeri("brojač pokazuje da je sve popunjeno", prijeProvjere.brojac === `${trazene.length} od ${trazene.length}`, prijeProvjere.brojac);
provjeri("događaj 'kraj' još nije poslan",
  (await page.evaluate(() => window.__poruke.filter(p => p.dogadjaj === "kraj").length)) === 0);

// prva provjera: dvije riječi su zamijenjene
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 250));
const prvaProvjera = await okvir.evaluate(() => ({
  zelenih: document.querySelectorAll(".praznina.tacna").length,
  crvenih: document.querySelectorAll(".praznina.netacna").length,
  poruka: document.getElementById("poruka").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("provjera oboji tačne zeleno, a pogrešne crveno",
  prvaProvjera.zelenih === trazene.length - 2 && prvaProvjera.crvenih === 2, JSON.stringify(prvaProvjera));
provjeri("poruka kaže koliko je tačno",
  prvaProvjera.poruka.includes(`${trazene.length - 2} od ${trazene.length}`), prvaProvjera.poruka);
provjeri("vježba se ne završava dok ima grešaka", prvaProvjera.krajVidljiv === false);

// ispravljanje: vrati dvije pogrešne pa ih smjesti kako treba
for (const i of [trazene.length - 2, trazene.length - 1]) {
  const t = await tacka(".praznina", i);
  await page.mouse.click(t.x, t.y);
  await new Promise(r => setTimeout(r, 120));
}
provjeri("vraćanjem pogrešnih nestaju crvene oznake",
  (await okvir.evaluate(() => document.querySelectorAll(".praznina.netacna").length)) === 0);
for (const i of [trazene.length - 2, trazene.length - 1]) {
  await prevuci(trazene[i], i);
}
await okvir.click("#provjeri");
await new Promise(r => setTimeout(r, 300));

const kraj = await okvir.evaluate(() => ({
  tacnih: document.querySelectorAll(".praznina.tacna").length,
  brojac: document.getElementById("brojac").textContent,
  krajVidljiv: !document.getElementById("kraj").hasAttribute("hidden"),
  krajOpis: document.getElementById("kraj-opis").textContent,
  ponudaPrazna: !document.getElementById("ponuda-prazna").hasAttribute("hidden"),
}));
provjeri("sve praznine tačno popunjene", kraj.tacnih === trazene.length, JSON.stringify(kraj));
provjeri("panel kraja prikazan", kraj.krajVidljiv);
provjeri("panel kraja kaže koliko je bilo tačno iz prve",
  kraj.krajOpis.includes(`Iz prve tačno: ${trazene.length - 2} od ${trazene.length}`), kraj.krajOpis);
provjeri("ponuda riječi je prazna na kraju", kraj.ponudaPrazna);

const poruke = await page.evaluate(() => window.__poruke);
const krajevi = poruke.filter(p => p.dogadjaj === "kraj");
provjeri("događaj 'kraj' stigao tačno jednom", krajevi.length === 1, `${krajevi.length}×`);
provjeri("događaj 'kraj' nosi tražena polja", krajevi[0]
  && krajevi[0].id === podaci.id
  && krajevi[0].pronadjeno === trazene.length
  && krajevi[0].ukupno === trazene.length
  && typeof krajevi[0].sekunde === "number"
  && typeof krajevi[0].greske === "number"
  && typeof krajevi[0].pomoc === "number", JSON.stringify(krajevi[0]));
provjeri("greške, pomoć i broj provjera su izbrojani",
  krajevi[0]?.greske === 2 && krajevi[0]?.pomoc === 1 && krajevi[0]?.provjere === 2
  && krajevi[0]?.tacnoIzPrve === trazene.length - 2, JSON.stringify(krajevi[0]));
provjeri("događaj 'rijec' po svakoj tačnoj riječi", poruke.filter(p => p.dogadjaj === "rijec").length === trazene.length);
provjeri("događaj 'visina' poslan", poruke.some(p => p.dogadjaj === "visina"));
provjeri("nema grešaka u konzoli tokom igre", greske.length === 0, greske.join(" | "));
provjeri("nema vanjskih zahtjeva tokom igre", vanjski.length === 0, vanjski.join(" | "));

// „Počni ispočetka" vraća vježbu na početak
await okvir.click("#nova");
await new Promise(r => setTimeout(r, 300));
const poslijeNove = await okvir.evaluate(() => ({
  tacnih: document.querySelectorAll(".praznina.tacna").length,
  rijeci: document.querySelectorAll(".rijec:not(.potrosena)").length,
  krajSkriven: document.getElementById("kraj").hasAttribute("hidden"),
}));
provjeri("Pocni ispocetka vraca vjezbu na pocetak", poslijeNove.tacnih === 0 && poslijeNove.rijeci === trazene.length && poslijeNove.krajSkriven, JSON.stringify(poslijeNove));
await page.close();

// ── 3. Tastatura ─────────────────────────────────────────────────────────
const page2 = await browser.newPage();
await page2.setViewport({ width: 1280, height: 1000 });
await page2.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page2.waitForSelector(".praznina");
const prvaRijec = await page2.evaluate((r) => {
  const b = [...document.querySelectorAll(".rijec")].find(x => x.textContent === r);
  if (!b) return null;
  b.focus();
  return { fokus: document.activeElement === b, vidljivFokus: getComputedStyle(b).outlineStyle !== "none" };
}, trazene[0]);
await page2.keyboard.press("Enter");
const oznacena = await page2.evaluate(() => document.querySelectorAll(".rijec.izabrana").length);
provjeri("Enter na riječi je označi", oznacena === 1, JSON.stringify(prvaRijec));
await page2.evaluate(() => document.querySelector(".praznina").focus());
await page2.keyboard.press("Enter");
provjeri("Enter na praznini smješta riječ", (await page2.evaluate(() => document.querySelectorAll(".praznina.popunjena").length)) === 1);
await page2.close();

// ── 4. Kontrast (WCAG AA ≥ 4,5:1) ────────────────────────────────────────
const page3 = await browser.newPage();
await page3.goto(`${BASE}${IGRA}?podaci=${PODACI}`, { waitUntil: "networkidle0" });
await page3.waitForSelector(".praznina");
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
  const uzorci = { "naslov": "#naslov", "kicker": ".kicker", "uputa": "#uputa", "tekst priče": ".prica p", "praznina": ".praznina", "ponuđena riječ": ".rijec", "oznaka stanja": ".stanje dt", "broj u stanju": ".stanje dd", "dugme": ".dugme", "glavno dugme": ".dugme.glavno" };
  const out = {};
  for (const [ime, sel] of Object.entries(uzorci)) {
    const el = document.querySelector(sel);
    if (el) out[ime] = omjer(el);
  }
  const tacna = document.querySelector(".praznina");
  tacna.classList.add("tacna");
  out["popunjena praznina"] = omjer(tacna);
  tacna.classList.remove("tacna");
  return out;
});
for (const [ime, o] of Object.entries(kontrasti)) provjeri(`kontrast ≥ 4,5:1 — ${ime}`, o >= 4.5, `${o}:1`);

await page3.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page3.reload({ waitUntil: "networkidle0" });
await page3.waitForSelector(".praznina");
const animacija = await page3.evaluate(() => {
  const d = document.createElement("div");
  d.className = "kraj";
  document.body.appendChild(d);
  const t = getComputedStyle(d).animationDuration;
  d.remove();
  return t;
});
provjeri("prefers-reduced-motion skraćuje animacije", parseFloat(animacija) <= 0.02, animacija);
await page3.close();

await browser.close();
server.close();
const palo = rezultati.filter(r => !r.ok);
console.log(`\n${rezultati.length - palo.length}/${rezultati.length} provjera prošlo`);
process.exit(palo.length ? 1 : 0);
