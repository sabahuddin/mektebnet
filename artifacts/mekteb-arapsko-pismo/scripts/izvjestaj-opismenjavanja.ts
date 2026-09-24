// Prijedlog programa opismenjavanja — harfovi poredani tako da dijete što prije
// čita prave riječi.
//
// Pokretanje (iz foldera scripts):
//   pnpm --filter @workspace/scripts run opismenjavanje -- ../samer.tsv > prijedlog.md
//
// Ulaz je SAMER Readability Lexicon (CAMeL Lab, NYU Abu Dhabi): 26.578 arapskih
// riječi s harekama, sa značenjem i ocjenom težine 1–5 koju su nezavisno dali
// egipatski, sirijski i saudijski lektori. Preuzima se s
// https://github.com/CAMeL-Lab/samer-arabic-readability (data/lexicon).
// Ne držimo ga u repozitoriju — ima svoje uslove korištenja.
//
// Ništa ne mijenja; ispisuje prijedlog na standardni izlaz.
import { readFileSync } from "node:fs";
import { PROGRAM_OPISMENJAVANJA } from "@/data/sufara-program";
import { zahtjevZapisa } from "@/lib/sufara-zapis";

// pnpm proslijedi i sam „--", pa ga preskačemo.
const putanja = process.argv.slice(2).find((a) => a !== "--");
if (!putanja) throw new Error("Treba putanja do SAMER-Readability-Lexicon.tsv");

interface Rijec { zapis: string; vrsta: string; znacenje: string; nivo: number; ucestalost: number }

const fond: Rijec[] = readFileSync(putanja, "utf8")
  .split("\n").slice(1).filter(Boolean)
  .map((red) => {
    const p = red.split("\t");
    const [zapis, vrsta = ""] = (p[3] ?? "").split("#");
    return { zapis, vrsta, znacenje: (p[4] ?? "").split("#")[0].replace(/_/g, " "), nivo: Number(p[8]), ucestalost: Number(p[0]) };
  })
  .filter((w) => w.zapis && Number.isFinite(w.nivo) && w.nivo <= 2)
  .map((w) => ({ ...w, ...zahtjevZapisa(w.zapis) }))
  .filter((w) => (w as unknown as { duzina: number }).duzina >= 2 && (w as unknown as { duzina: number }).duzina <= 4);

const znaniHarfovi = new Set<string>();
const zaniZnakovi = new Set<string>(["fetha", "kesra", "damma"]);
const vidjeno = new Set<string>();

console.log("# Prijedlog: program opismenjavanja\n");
console.log("Harfovi su poredani po tome koliko riječi otvaraju, ne po abecedi. Riječi su");
console.log("iz SAMER-ovog rječnika, nivo 1–2 (najlakše), dvije do četiri slova.\n");
console.log("Značenja su engleska, onako kako stoje u rječniku — treba ih prevesti i");
console.log("prosijati: nije svaka riječ za dijete od pet godina.\n");

let prije = 0;
for (const korak of PROGRAM_OPISMENJAVANJA) {
  for (const h of korak.harfovi) znaniHarfovi.add(h);
  for (const z of korak.znakovi) zaniZnakovi.add(z);

  const citljivo = fond.filter((w) => {
    const z = w as unknown as { harfovi: string[]; znakovi: string[] };
    return z.harfovi.every((h) => znaniHarfovi.has(h)) && z.znakovi.every((s) => zaniZnakovi.has(s));
  });
  const nove = citljivo.filter((w) => !vidjeno.has(w.zapis));
  for (const w of citljivo) vidjeno.add(w.zapis);

  console.log(`\n## Lekcija ${korak.lekcija} — ${korak.naziv}\n`);
  const noviHarfovi = korak.harfovi.filter((h) => !"ءآأؤإئاٱ".includes(h));
  if (noviHarfovi.length) console.log(`**Uvodi harfove:** ${noviHarfovi.join("  ")}  \n`);
  if (korak.znakovi.length) console.log(`**Uvodi znak:** ${korak.znakovi.join(", ")}  \n`);
  console.log(`**Dijete sada može pročitati ${citljivo.length} riječi** (${citljivo.length - prije} novih).\n`);
  prije = citljivo.length;

  const izbor = nove
    .filter((w) => /^(noun|verb|adj)/.test(w.vrsta))
    .sort((a, b) => ((a as unknown as { duzina: number }).duzina - (b as unknown as { duzina: number }).duzina) || b.ucestalost - a.ucestalost)
    .slice(0, 20);
  if (izbor.length) {
    console.log("| riječ | značenje |");
    console.log("|---|---|");
    for (const w of izbor) console.log(`| ${w.zapis} | ${w.znacenje.slice(0, 40)} |`);
  }
}
