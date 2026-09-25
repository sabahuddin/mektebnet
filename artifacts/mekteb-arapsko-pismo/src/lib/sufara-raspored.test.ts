// Jamstvo novog okvira: dijete nikad ne dobije zapis za koji mu nešto fali.
import assert from "node:assert/strict";
import test from "node:test";
import { rasporediZapise, sastaviFond } from "./sufara-raspored";
import { PROGRAM_SUFARE } from "../data/sufara-program";
import { normalizirajZapis, zahtjevZapisa } from "./sufara-zapis";

test("zapis pada u prvu lekciju u kojoj dijete zna sve što mu treba", () => {
  const { smjesteni } = rasporediZapise(["بَ", "سَبَ", "عِلْمٌ", "رَبَّ"]);
  const gdje = Object.fromEntries(smjesteni.map((z) => [z.zapis, z.lekcija]));
  // Zapisi izlaze normalizirani, pa se i traže tako — inače tešdid unesen
  // obrnutim redom naprosto ne bi bio pronađen.
  const u = (zapis: string) => gdje[normalizirajZapis(zapis)];
  assert.equal(u("بَ"), 3, "ba i fetha su iz treće lekcije");
  assert.equal(u("سَبَ"), 10, "sin dolazi tek u desetoj");
  assert.equal(u("رَبَّ"), 8, "tešdid se uči u osmoj");
  assert.equal(u("عِلْمٌ"), 15, "ajn je iz trinaeste, ali lam i mim dolaze tek u petnaestoj");
});

test("zapis koji traži neuvedeno gradivo se prijavi, a ne prokrijumčari", () => {
  const { smjesteni, nesmjesteni } = rasporediZapise(["كِتَابٌ", "كَلِمَةٌ", "هُدًى"]);
  assert.equal(smjesteni.length, 0);
  assert.equal(nesmjesteni.length, 3);
  assert.match(nesmjesteni.find((n) => n.zapis === "كِتَابٌ")!.razlog, /medd/);
  assert.match(nesmjesteni.find((n) => n.zapis === "كَلِمَةٌ")!.razlog, /ة/);
});

test("fond nijedne lekcije ne traži ništa što dotad nije naučeno", () => {
  const zapisi = ["بَ", "تُ", "سَبَ", "رَبَّ", "عِلْمٌ", "شَرٌّ", "قُلْ", "مِنْ", "فَجْرٌ", "حَقٌّ", "نَعَمْ", "مَسْجِدٌ"];
  const raspored = rasporediZapise(zapisi);
  const naucenoDo = new Map<number, { harfovi: Set<string>; znakovi: Set<string> }>();
  const harfovi = new Set<string>();
  const znakovi = new Set<string>();
  for (const korak of PROGRAM_SUFARE) {
    for (const h of korak.harfovi) harfovi.add(h);
    for (const z of korak.znakovi) znakovi.add(z);
    naucenoDo.set(korak.lekcija, { harfovi: new Set(harfovi), znakovi: new Set(znakovi) });
  }
  for (const korak of PROGRAM_SUFARE) {
    const znano = naucenoDo.get(korak.lekcija)!;
    for (const zapis of sastaviFond(raspored, korak.lekcija, 10)) {
      const z = zahtjevZapisa(zapis);
      for (const h of z.harfovi) assert.ok(znano.harfovi.has(h), `L${korak.lekcija}: ${zapis} traži harf ${h}`);
      for (const zn of z.znakovi) assert.ok(znano.znakovi.has(zn), `L${korak.lekcija}: ${zapis} traži ${zn}`);
    }
  }
});

test("fond ne pada kako lekcije odmiču — kasnija ima bar koliko i ranija", () => {
  const raspored = rasporediZapise(["بَ", "تُ", "سَبَ", "رَبَّ", "شَرٌّ", "قُلْ", "فَجْرٌ", "حَقٌّ", "نَعَمْ", "مَسْجِدٌ", "مِنْ", "لَكُمْ"]);
  let prethodni = 0;
  for (const korak of PROGRAM_SUFARE) {
    const dostupno = raspored.smjesteni.filter((z) => z.lekcija <= korak.lekcija).length;
    assert.ok(dostupno >= prethodni, `L${korak.lekcija}: dostupno ${dostupno}, prije ${prethodni}`);
    prethodni = dostupno;
  }
});
