import assert from "node:assert/strict";
import test from "node:test";
import { surahName, surahBosnianName, surahSearchNames } from "./quran";

const JEZICI = ["bs", "de", "en"] as const;

test("svaki jezik ima naziv za svih 114 sura", () => {
  for (const lang of JEZICI) {
    for (let broj = 1; broj <= 114; broj++) {
      const ime = surahName(broj, lang);
      assert.ok(ime.length > 0, `${lang}: nedostaje naziv za suru ${broj}`);
    }
  }
});

test("nazivi se ne ponavljaju unutar jednog jezika", () => {
  for (const lang of JEZICI) {
    const sva = Array.from({ length: 114 }, (_, i) => surahName(i + 1, lang));
    assert.equal(new Set(sva).size, 114, `${lang}: ima ponovljenih naziva`);
  }
});

test("njemački i engleski koriste svoju transkripciju, ne bosansku", () => {
  const uzorak: Array<[number, string, string]> = [
    [1, "Al-Fatiha", "Al-Fatihah"],
    [2, "Al-Baqara", "Al-Baqarah"],
    [91, "Asch-Schams", "Ash-Shams"],
    [106, "Quraisch", "Quraysh"],
    [108, "Al-Kauthar", "Al-Kawthar"],
    [112, "Al-Ichlas", "Al-Ikhlas"],
    [114, "An-Nas", "An-Nas"],
  ];
  for (const [broj, de, en] of uzorak) {
    assert.equal(surahName(broj, "de"), de);
    assert.equal(surahName(broj, "en"), en);
  }
});

test("njemački i engleski nemaju bosanska slova ni bosanski član El-", () => {
  for (const lang of ["de", "en"] as const) {
    for (let broj = 1; broj <= 114; broj++) {
      const ime = surahName(broj, lang);
      assert.doesNotMatch(ime, /[čćžšđČĆŽŠĐ]/, `${lang}: sura ${broj} ima bosansko slovo — ${ime}`);
      assert.doesNotMatch(ime, /^E[lšsnrtzd]-/i, `${lang}: sura ${broj} je ostala na bosanskom — ${ime}`);
    }
  }
});

test("jezik bez vlastite liste pada na bosansku transkripciju", () => {
  for (const lang of ["sq", "tr", "ar", "xx"]) {
    assert.equal(surahName(2, lang), surahBosnianName(2));
  }
});

test("pretraga nalazi suru i po nazivu iz drugog jezika", () => {
  const imena = surahSearchNames(112);
  assert.ok(imena.includes("El-Ihlas"));
  assert.ok(imena.includes("Al-Ichlas"));
  assert.ok(imena.includes("Al-Ikhlas"));
});

test("van opsega vraća prazan string", () => {
  for (const broj of [0, 115, -1]) {
    for (const lang of JEZICI) assert.equal(surahName(broj, lang), "");
  }
});
