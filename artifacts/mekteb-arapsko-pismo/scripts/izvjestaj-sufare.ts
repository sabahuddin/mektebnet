// Kako bi Sufara izgledala kad se lekcije izvedu iz fonda snimaka.
//
// Pokretanje:
//   pnpm --filter @workspace/scripts run sufara:raspored
//   pnpm --filter @workspace/scripts run sufara:raspored -- ../fond.json  (putanja od foldera scripts)
//
// Bez argumenta uzima zapise kojima je snimak već dodijeljen. S argumentom
// uzima JSON — niz arapskih zapisa ili objekat čiji su ključevi zapisi — pa se
// isti izvještaj može dobiti za bilo koju tuđu zbirku snimaka prije nego se
// išta preuzme. Ništa ne mijenja.
import { readFileSync } from "node:fs";
import { SLOGOVI_AUDIO } from "@/data/slogovi-mapping";
import { PROGRAM_SUFARE } from "@/data/sufara-program";
import { rasporediZapise, sastaviFond } from "@/lib/sufara-raspored";
import { zahtjevZapisa, type Znak } from "@/lib/sufara-zapis";

const putanja = process.argv[2];
let zapisi: string[];
if (putanja) {
  const ucitano: unknown = JSON.parse(readFileSync(putanja, "utf8"));
  zapisi = Array.isArray(ucitano) ? (ucitano as string[]) : Object.keys(ucitano as Record<string, unknown>);
  console.log(`Fond iz ${putanja}: ${zapisi.length} zapisa.\n`);
} else {
  zapisi = Object.keys(SLOGOVI_AUDIO);
  console.log(`Fond iz postojećih snimaka: ${zapisi.length} zapisa.\n`);
}

const raspored = rasporediZapise(zapisi);
const VELICINA = 30;

console.log("lek  naziv                          novo  ukupno   sukun tešdid tenvin  medd");
for (const korak of PROGRAM_SUFARE) {
  const novo = raspored.smjesteni.filter((z) => z.lekcija === korak.lekcija).length;
  const ukupno = raspored.smjesteni.filter((z) => z.lekcija <= korak.lekcija).length;
  const fond = sastaviFond(raspored, korak.lekcija, VELICINA);
  const udio = (znak: Znak) =>
    `${String(Math.round((fond.filter((w) => zahtjevZapisa(w).znakovi.includes(znak)).length / (fond.length || 1)) * 100)).padStart(4)}%`;
  console.log(
    `${String(korak.lekcija).padStart(3)}  ${korak.naziv.padEnd(30)} ${String(novo).padStart(4)} ${String(ukupno).padStart(7)}   ` +
      `${udio("sukun")} ${udio("tesdid")} ${udio("tenvin")} ${udio("medd")}`,
  );
}

if (raspored.nesmjesteni.length) {
  console.log(`\nNesmješteno: ${raspored.nesmjesteni.length} zapisa — traže nešto što program ne uči.`);
  const poRazlogu = new Map<string, string[]>();
  for (const n of raspored.nesmjesteni) poRazlogu.set(n.razlog, [...(poRazlogu.get(n.razlog) ?? []), n.zapis]);
  for (const [razlog, lista] of [...poRazlogu].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(lista.length).padStart(4)}  ${razlog}`);
    console.log(`        ${lista.slice(0, 12).join("  ")}${lista.length > 12 ? "  …" : ""}`);
  }
  console.log("\nSvaki od njih je odluka: ili se doda korak u program, ili zapis ispada.");
} else {
  console.log("\nSvi zapisi su smješteni.");
}
