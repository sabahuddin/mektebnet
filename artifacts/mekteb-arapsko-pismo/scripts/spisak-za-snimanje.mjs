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

// SNIMA SE SAMO ONO ŠTO SE SLUŠA. Vježbe u kojima dijete čita — voz slogova i
// redovi za tečnost — ne traže snimak; njih sluša muallim. Zvuk treba za novi
// glas, za slušanje, za kratko-dugo i za provjeru riječi, a sve to dolazi iz
// slogova i riječi. Zato se spisak pravi od njih, a ne od izvedenih vježbi.
//
// Podaci žive u TypeScriptu; da skripta ne ovisi o alatu za tipove, čitaju se
// iz izvora. Polja su zato pisana u jednom redu.
const uzmi = async (datoteka) => {
  const izvor = await readFile(path.join(KORIJEN, datoteka), "utf8");
  const izl = [];
  for (const m of izvor.matchAll(/zapis:\s*"([^"]+)",\s*citanje:\s*"([^"]*)",[^}]*?lekcija:\s*(\d+)/g)) {
    izl.push({ zapis: m[1], citanje: m[2], lekcija: Number(m[3]) });
  }
  return izl;
};
const stavke = [...await uzmi("src/data/citanje-slogovi.ts"), ...await uzmi("src/data/citanje-rijeci.ts")];

const naslovi = new Map();
{
  const prog = await readFile(path.join(KORIJEN, "src/data/citanje-program.ts"), "utf8");
  for (const m of prog.matchAll(/broj:\s*(\d+),\s*naziv:\s*"([^"]+)"/g)) naslovi.set(Number(m[1]), m[2]);
}

const lekcije = [...new Set(stavke.map((s) => s.lekcija))].sort((a, b) => a - b).map((broj) => ({
  broj,
  naslov: naslovi.get(broj) ?? "",
  zapisi: [...new Set(stavke.filter((s) => s.lekcija === broj).map((s) => s.zapis))],
}));

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
