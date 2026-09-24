// Provjera vježbe „Slušaj i klikni" u pravom pregledniku (Chromium/puppeteer).
//
// Pokretanje (iz korijena repozitorija):
//   node artifacts/mekteb-arapsko-pismo/scripts/provjeri-slusaj.mjs
//
// Servira `public` lokalno, odigra sva tri kruga do kraja i provjeri da se
// podaci učitaju iz JSON-a, da ponuda bude četiri, da spisak riječi radi i da
// se miješa, da stignu poruke „krug" i „kraj", te da nema grešaka u konzoli.
// Usput snimi sliku u docs/. Izlazni kod 1 znači da je nešto palo.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

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

await page.goto("http://localhost:4210/vjezbe/slusaj/slusaj.html?podaci=/vjezbe/slusaj/podaci/lekcija-4.json", { waitUntil: "networkidle0" });
await page.waitForSelector(".ponuda");

const provjere = [];
const ok = (n, u, d = "") => { provjere.push({ n, u }); console.log(`${u ? "OK  " : "PALO"} ${n}${d ? " — " + d : ""}`); };

ok("naslov je iz JSON-a", (await page.$eval("#naslov", (e) => e.textContent)).includes("Ba, Nun i Ja"));
ok("četiri ponude", (await page.$$(".ponuda")).length === 4);
ok("spisak ima 12 riječi", (await page.$$(".rijec")).length === 12);
ok("prva riječ u spisku je arapska", /[ء-ي]/.test(await page.$eval(".rijec .zapis", (e) => e.textContent)));
ok("dugme Dalje je na početku zaključano", await page.$eval("#dalje", (e) => e.disabled));

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
ok("prošlo je bar 25 pitanja kroz tri kruga", pitanja >= 25, `${pitanja}`);
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
