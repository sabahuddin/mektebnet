// Nijedan zapis koji dijete čita kao riječ ne smije početi slovom kojim
// arapska riječ ne počinje.
//
// Slagalica koja slogove spaja u riječi ne zna arapski. Prije ovog testa
// sastavljala je 113 nemogućih zapisa kroz šesnaest lekcija — „ئَبَا", „ؤُحَ",
// „ةُلُ", „ىُظُ". Sve su izgledale kao riječi i nijedna to nije mogla biti.
import assert from "node:assert/strict";
import test from "node:test";
import { PROGRAM_CITANJA } from "../data/citanje-program";
import { vjezbeZaLekciju, radniList } from "../data/citanje-vjezbe";
import { obliciHarfa } from "../data/citanje-oblici";
import { RIJECI_CITANJA } from "../data/citanje-rijeci";
import { SLOGOVI_CITANJA } from "../data/citanje-slogovi";
import { NE_POCINJE_RIJEC, SAMO_NA_KRAJU } from "../data/citanje-pravopis";
import { grozdovi, osnova } from "./citanje-grozd";

const harfovi = (zapis: string): string[] => grozdovi(zapis).map(osnova);

/**
 * Svaki zapis koji dijete pred sobom čita kao cjelinu.
 *
 * Oblici slova, pisanje i lov na slova se izuzimaju: ondje se slovo pokazuje
 * samo, ili s tatvilom umjesto susjeda, i nije riječ nego prikaz slova.
 */
function zapisiKaoRijeci(broj: number): string[] {
  const izl: string[] = [];
  for (const v of vjezbeZaLekciju(broj)) {
    if (v.vrsta === "oblici" || v.vrsta === "pisi" || v.vrsta === "pronadi-harf") continue;
    for (const s of v.stavke) {
      izl.push(s.zapis);
      if (s.parnjak) izl.push(s.parnjak);
      izl.push(...(s.dijelovi ?? []));
    }
    for (const red of v.redovi ?? []) izl.push(...red);
  }
  izl.push(...radniList(broj).flat());
  return izl;
}

for (const p of PROGRAM_CITANJA) {
  test(`lekcija ${p.broj} ne počinje zapis slovom kojim riječ ne počinje`, () => {
    const lose = [...new Set(zapisiKaoRijeci(p.broj))]
      .filter((z) => NE_POCINJE_RIJEC.has(harfovi(z)[0] ?? ""));
    assert.deepEqual(lose, [], `nemoguć početak:\n${lose.join("\n")}`);
  });

  test(`lekcija ${p.broj} drži vezano ta i skraćeni elif na kraju`, () => {
    const lose = [...new Set(zapisiKaoRijeci(p.broj))]
      .filter((z) => harfovi(z).slice(0, -1).some((h) => SAMO_NA_KRAJU.has(h)));
    assert.deepEqual(lose, [], `završno slovo stoji u sredini:\n${lose.join("\n")}`);
  });
}

test("ručno pisane riječi i slogovi poštuju isto pravilo", () => {
  const svi = [...RIJECI_CITANJA.map((r) => r.zapis), ...SLOGOVI_CITANJA.map((s) => s.zapis)];
  const lose = svi.filter((z) => NE_POCINJE_RIJEC.has(harfovi(z)[0] ?? ""));
  assert.deepEqual(lose, [], `nemoguć početak:\n${lose.join("\n")}`);
});

test("hemze na jau nema početni oblik", () => {
  const polozaji = obliciHarfa("ئ").map((o) => o.polozaj);
  assert.ok(!polozaji.includes("pocetni"), `nudi početni oblik: ${polozaji.join(", ")}`);
  assert.ok(polozaji.includes("srednji"), "izgubio je srednji oblik, koji postoji");
  assert.ok(polozaji.includes("krajnji"), "izgubio je krajnji oblik, koji postoji");
});

test("skraćeni elif ima samo sam i krajnji oblik", () => {
  assert.deepEqual(obliciHarfa("ى").map((o) => o.polozaj), ["sam", "krajnji"]);
});

test("hemze na vavu nema početni oblik", () => {
  const polozaji = obliciHarfa("ؤ").map((o) => o.polozaj);
  assert.ok(!polozaji.includes("pocetni"), `nudi početni oblik: ${polozaji.join(", ")}`);
});
