// Spisak svega što treba pročitati, redom, za program učenja čitanja.
//
// Pokretanje (iz korijena repozitorija):
//   node artifacts/mekteb-arapsko-pismo/scripts/spisak-za-snimanje.mjs > spisak.txt
//   node artifacts/mekteb-arapsko-pismo/scripts/spisak-za-snimanje.mjs --lekcija 3
//
// Ispisuje samo ono za šta snimak još ne postoji, pa se snimanje može
// prekinuti i nastaviti kasnije bez ponavljanja.
//
// Kako se čita: jedna stavka, pa pauza od pola sekunde, pa sljedeća. Pauza je
// jedino po čemu se snimak siječe. Postupak je opisan u docs/snimanje-glasa.md.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZVUK = path.join(KORIJEN, "public/audio/citanje");

const arg = process.argv.slice(2);
const i = arg.indexOf("--lekcija");
const SAMO = i >= 0 && arg[i + 1] ? Number(arg[i + 1]) : null;

// Podaci žive u TypeScriptu; da skripta ne ovisi o alatu za tipove, čitaju se
// iz izvora. Polja su zato pisana u jednom redu.
const izvor = await readFile(path.join(KORIJEN, "src/data/citanje-lekcije.ts"), "utf8");

const lekcije = [];
for (const dio of izvor.split(/\n  \{\n    broj: /).slice(1)) {
  const broj = Number(dio.match(/^(\d+)/)?.[1]);
  const naslov = dio.match(/naslov:\s*"([^"]+)"/)?.[1] ?? "";
  const zapisi = [];
  for (const m of dio.matchAll(/zapis:\s*"([^"]+)"/g)) zapisi.push(m[1]);
  for (const m of dio.matchAll(/parnjak:\s*"([^"]+)"/g)) zapisi.push(m[1]);
  for (const m of dio.matchAll(/dijelovi:\s*\[([^\]]+)\]/g)) {
    for (const d of m[1].matchAll(/"([^"]+)"/g)) zapisi.push(d[1]);
  }
  lekcije.push({ broj, naslov, zapisi: [...new Set(zapisi)] });
}

const postoje = new Set(await readdir(ZVUK).catch(() => []));
const ime = (z) => `rijec-${Buffer.from(z).toString("hex")}.mp3`;

let ukupno = 0;
const redovi = [];
for (const l of lekcije) {
  if (SAMO !== null && l.broj !== SAMO) continue;
  const treba = l.zapisi.filter((z) => !postoje.has(ime(z)));
  if (!treba.length) continue;
  redovi.push("", `# ${l.broj}. ${l.naslov}  — ${treba.length} stavki`);
  redovi.push(...treba);
  ukupno += treba.length;
}

if (!ukupno) {
  console.error("Sve je već snimljeno.");
  process.exit(0);
}

console.log("# Spisak za snimanje — program učenja čitanja");
console.log("#");
console.log("# Čitati redom, jednu stavku pa pauza od pola sekunde.");
console.log("# Ostaviti sekundu tišine na početku i na kraju snimka.");
console.log("# Kratak slog čitati kratko, dugi dvaput duže.");
console.log("#");
console.log(`# Ukupno: ${ukupno} stavki.`);
console.log(redovi.join("\n"));
console.error(`Ispisano ${ukupno} stavki iz ${lekcije.filter((l) => SAMO === null || l.broj === SAMO).length} lekcija.`);
