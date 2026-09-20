/**
 * Ispiše cijelu tabelu transkripcije za urednički pregled uz mushaf.
 *
 * Pokretanje:
 *   pnpm --filter @workspace/scripts exec tsx src/ispisi-transkripciju.ts
 *   ... --jezik de      (samo njemački)
 */
import { CJELINE } from "./transkripcija-podaci.js";
import { njemackiIzEngleskog } from "./transkripcija.js";

const args = process.argv.slice(2);
const i = args.indexOf("--jezik");
const samo = i >= 0 ? args[i + 1] : null;

let redova = 0;
for (const cjelina of CJELINE) {
  console.log(`\n── ${cjelina.naziv} ${"─".repeat(Math.max(0, 60 - cjelina.naziv.length))}`);
  for (const red of cjelina.redovi) {
    redova++;
    console.log(`  BS: ${red.bs}`);
    if (samo !== "en") console.log(`  DE: ${njemackiIzEngleskog(red.en)}`);
    if (samo !== "de") console.log(`  EN: ${red.en}`);
    console.log("");
  }
}
console.log(`Ukupno: ${CJELINE.length} cjelina, ${redova} redova.`);
