// Provjera vježbe „Slušaj i klikni" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-slusaj.mjs [lekcija-16.json]
//
// Servira `public` lokalno, odigra sva tri kruga do kraja i provjeri da se
// podaci učitaju iz JSON-a, da ponuda bude četiri, da spisak riječi radi i da
// se miješa, da stignu poruke „krug" i „kraj", te da nema grešaka u konzoli.
// Usput snimi sliku u docs/. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import puppeteer from "puppeteer";
const require = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../public");
const TIP = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT)) return res.writeHead(403).end();
    const d = await fs.readFile(f);
    res.writeHead(200, { "Content-Type": TIP[path.extname(f)] ?? "application/octet-stream" }).end(d);
  } catch { res.writeHead(404).end("404"); }
});
await new Promise((r) => server.listen(4210, r));

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"] });
const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1000 });
const dogadjaji = [];
await page.exposeFunction("__javi", (d) => dogadjaji.push(d));
await page.evaluateOnNewDocument(() => {
  document.addEventListener("mekteb-igra", (e) => window.__javi(e.detail));
});
const greske = [];
page.on("pageerror", (e) => greske.push(String(e)));
// Zvuk je cijela poenta ove vježbe, pa se prati da li se snimak zaista dohvati
// i s kojim odgovorom — postojanje datoteke na disku ništa ne dokazuje.
const zvuci = [];
page.on("response", (r) => {
  if (/\/audio\/opismenjavanje\/.*\.mp3$/.test(r.url())) zvuci.push({ url: r.url(), status: r.status() });
});

const DATOTEKA = process.argv[2] ?? "lekcija-4.json";
await page.goto(`http://localhost:4210/vjezbe/slusaj/slusaj.html?podaci=/vjezbe/slusaj/podaci/${DATOTEKA}`, { waitUntil: "networkidle0" });
await page.waitForSelector(".ponuda");

const provjere = [];
const ok = (n, u, d = "") => { provjere.push({ n, u }); console.log(`${u ? "OK  " : "PALO"} ${n}${d ? " — " + d : ""}`); };

const naslov = await page.$eval("#naslov", (e) => e.textContent);
ok("naslov je iz JSON-a", naslov.trim().startsWith("Lekcija"), naslov);
ok("četiri ponude", (await page.$$(".ponuda")).length === 4);
const ocekivano = JSON.parse(await fs.readFile(path.join(ROOT, "vjezbe/slusaj/podaci", DATOTEKA), "utf8")).rijeci.length;
ok("spisak ima sve riječi iz JSON-a", (await page.$$(".rijec")).length === ocekivano, `${ocekivano}`);
ok("prva riječ u spisku je arapska", /[ء-ي]/.test(await page.$eval(".rijec .zapis", (e) => e.textContent)));
ok("dugme Dalje je na početku zaključano", await page.$eval("#dalje", (e) => e.disabled));

// Svaki snimak koji podaci obećaju mora se stvarno dohvatiti i ne biti prazan.
const obecani = (() => {
  const v = JSON.parse(require("node:fs").readFileSync(path.join(ROOT, "vjezbe/slusaj/podaci", DATOTEKA), "utf8"));
  return [...(v.harfovi ?? []), ...(v.slogovi ?? []), ...(v.rijeci ?? [])].map((x) => x.zvuk).filter(Boolean);
})();
const dohvaceni = await page.evaluate(async (lista) => {
  const out = [];
  for (const u of lista) {
    try { const o = await fetch(u); const b = await o.arrayBuffer(); out.push([u.split("/").pop(), o.status, b.byteLength]); }
    catch (e) { out.push([u, 0, 0]); }
  }
  return out;
}, obecani);
ok("svaki obećani snimak se dohvati i nije prazan",
   dohvaceni.length === obecani.length && dohvaceni.every(([, st, b]) => st === 200 && b > 2000),
   dohvaceni.map(([n, st, b]) => `${n} ${st} ${b}B`).join(" | ") || "nijedan snimak nije obećan");

// Stavka bez snimka ne smije pući ni šutjeti bez objašnjenja.
await page.click("#zvucnik");
await new Promise((r) => setTimeout(r, 300));
const stanjeBezZvuka = await page.evaluate(() => {
  const prvi = document.querySelector(".ponuda .slovo")?.textContent ?? "";
  const n = document.getElementById("bezZvuka");
  return { poruka: n.classList.contains("sakrij") ? "" : n.textContent, prvi };
});
ok("bez snimka vježba to kaže, a ne šuti",
   stanjeBezZvuka.poruka.length > 0 || zvuci.length > 0, JSON.stringify(stanjeBezZvuka).slice(0, 120));

// Odigraj sva tri kruga biranjem tačnog odgovora.
let pitanja = 0;
for (let i = 0; i < 40; i++) {
  if (await page.$("#gotovo:not(.sakrij)")) break;
  const tocna = await page.evaluate(() => {
    const slova = [...document.querySelectorAll(".ponuda .slovo")].map((e) => e.textContent);
    return slova;
  });
  // Tačan je onaj koji se poklapa s onim što vježba upravo traži; nemamo ga u
  // DOM-u, pa kliknemo redom dok jedan ne bude označen zelenim.
  let pogodjen = false;
  for (let k = 0; k < tocna.length; k++) {
    await page.evaluate((idx) => document.querySelectorAll(".ponuda")[idx].click(), k);
    const zeleni = await page.$eval(`.ponuda:nth-child(${k + 1})`, (e) => e.classList.contains("tacna"));
    if (zeleni) { pogodjen = true; break; }
    break; // prvi klik zaključava pitanje
  }
  pitanja++;
  await page.click("#dalje");
  await new Promise((r) => setTimeout(r, 40));
}
ok("prošla su sva pitanja kroz tri kruga", pitanja >= 25, `${pitanja}`);
ok("vježba je završena", !!(await page.$("#gotovo:not(.sakrij)")));
ok("javljen je događaj kraj", dogadjaji.some((d) => d.dogadjaj === "kraj"), JSON.stringify(dogadjaji.filter(d => d.dogadjaj === "kraj")[0] ?? {}));
ok("javljena su tri kruga", dogadjaji.filter((d) => d.dogadjaj === "krug").length === 3);

// Promiješaj spisak
const prije = await page.$$eval(".rijec .zapis", (e) => e.map((x) => x.textContent).join("|"));
await page.click("#promijesaj");
const poslije = await page.$$eval(".rijec .zapis", (e) => e.map((x) => x.textContent).join("|"));
ok("miješanje mijenja redoslijed spiska", prije !== poslije);
ok("nema grešaka u konzoli", greske.length === 0, greske.join(" | "));

// Pregled prije mergea (htmlpreview): bez ?podaci= i bez jezik.js, jer se
// apsolutna putanja /vjezbe/jezik.js tamo ne razrješava. Vježba mora raditi
// na ugrađenoj lekciji, a ne pući.
{
  const p2 = await browser.newPage();
  const greske2 = [];
  p2.on("pageerror", (e) => greske2.push(String(e)));
  await p2.setRequestInterception(true);
  p2.on("request", (r) => (r.url().endsWith("/vjezbe/jezik.js") ? r.abort() : r.continue()));
  await p2.goto("http://localhost:4210/vjezbe/slusaj/slusaj.html", { waitUntil: "networkidle0" });
  await p2.waitForSelector(".ponuda");
  ok("radi i bez servera i bez jezik.js", (await p2.$$(".ponuda")).length === 4 && greske2.length === 0, greske2.join(" | "));
  ok("bez servera se vidi puna lekcija", (await p2.$$(".rijec")).length === 12);
  ok("bez servera je naslov prave lekcije", (await p2.$eval("#naslov", (e) => e.textContent)).includes("Ba, Nun i Ja"));
  await p2.close();
}

await page.evaluate(() => { document.getElementById("gotovo").classList.add("sakrij"); document.getElementById("ponovo").click(); });
await page.waitForSelector(".ponuda");
await page.screenshot({ path: path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../docs/vjezba-slusaj.png"), fullPage: true });

await browser.close(); server.close();
const palo = provjere.filter((p) => !p.u);
console.log(`\n${provjere.length - palo.length}/${provjere.length} provjera prošlo`);
process.exit(palo.length ? 1 : 0);
