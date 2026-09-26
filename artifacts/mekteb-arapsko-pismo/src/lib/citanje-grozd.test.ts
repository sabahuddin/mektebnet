// Grozd mora pokupiti sve znakove svog harfa, i nijedan tuđi.
import assert from "node:assert/strict";
import test from "node:test";
import { grozdovi, osnova, sadrziHarf, jeDuzina, TATVIL } from "./citanje-grozd";
import { normalizirajZapis } from "./sufara-zapis";
import { RIJECI_CITANJA } from "../data/citanje-rijeci";
import { SLOGOVI_CITANJA } from "../data/citanje-slogovi";

test("harek ostaje uz svoj harf", () => {
  assert.deepEqual(grozdovi("مَالَ"), ["مَ", "ا", "لَ"]);
});

test("tešdid i vokal idu u isti grozd", () => {
  // Tešdid se piše prije vokala (0651 pa 064E) — vidjeti normalizirajZapis.
  const g = grozdovi(normalizirajZapis("كُلَّ"));
  assert.equal(g.length, 2, `očekivana dva grozda, dobiveno ${g.length}`);
  assert.equal(osnova(g[1]), "ل");
  assert.ok(g[1].includes("ّ"), "tešdid je ispao iz grozda");
});

test("tatvil je svoj grozd, a ne dio harfa", () => {
  const g = grozdovi(`${TATVIL}بـ`);
  assert.deepEqual(g, [TATVIL, "ب", TATVIL]);
});

test("naslonjeni znak na početku nema za što da se uhvati", () => {
  // Zapis koji počinje harekom je neispravan, ali ne smije srušiti razlaganje.
  assert.deepEqual(grozdovi("َم"), ["َ", "م"]);
});

test("razlaganje ne gubi nijedan znak", () => {
  const svi = [...RIJECI_CITANJA.map((r) => r.zapis), ...SLOGOVI_CITANJA.map((s) => s.zapis)];
  const lose = svi.filter((z) => grozdovi(z).join("") !== z);
  assert.deepEqual(lose, [], `razlaganje mijenja zapis:\n${lose.join("\n")}`);
});

test("traženje harfa ne vara na znakovima", () => {
  const rijec = "مَالَ";
  assert.ok(sadrziHarf(rijec, "ل"), "lam se ne nalazi");
  assert.ok(!sadrziHarf(rijec, "َ"), "fetha se broji kao harf");
});

test("dužina se prepoznaje po hareku ispred, ne po harfu", () => {
  const d = (z: string) => grozdovi(z).map((_, i) => jeDuzina(grozdovi(z), i));
  // مَا — elif iza fethe jeste dužina.
  assert.deepEqual(d("مَا"), [false, true]);
  // مُو — vav iza damme jeste dužina.
  assert.deepEqual(d("مُو"), [false, true]);
  // مَوَ — vav sa fethom je suglasnik, ne dužina.
  assert.deepEqual(d("مَوَ"), [false, false]);
  // مِو — vav iza kesre nije dužina; kesri pripada ja.
  assert.deepEqual(d("مِو"), [false, false]);
});
