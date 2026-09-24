import assert from "node:assert/strict";
import test from "node:test";
import { normalizirajZapis, zahtjevZapisa, znakoviZapisa, duzinaZapisa } from "./sufara-zapis";

test("tešdid se sredi ispred samoglasnika, kako Sufara i piše", () => {
  // Isti zapis unesen obrnutim redom izgleda identično, a druga je niska.
  const obrnuto = "رَبَّ";
  const kakoTreba = "رَبَّ";
  assert.equal(normalizirajZapis(obrnuto), kakoTreba);
  assert.equal(normalizirajZapis(kakoTreba), kakoTreba);
});

test("medd se broji samo kad harf produženja nema oznaku iza sebe", () => {
  assert.ok(znakoviZapisa("كِتَابٌ").includes("medd"), "elif u kitabun produžava");
  assert.ok(!znakoviZapisa("وَلِيٌّ").includes("medd"), "ja s tešdidom je suglasnik, ne dužina");
  assert.ok(!znakoviZapisa("يَوْمٌ").includes("medd"), "vav sa sukunom nije dužina");
});

test("oznake se ne broje kao harfovi", () => {
  assert.equal(duzinaZapisa("عِلْمٌ"), 3);
  assert.equal(duzinaZapisa("أَجْرًا"), 4);
  assert.equal(duzinaZapisa("بَ"), 1);
});

test("zahtjev zapisa skupi harfove i znakove na jedno mjesto", () => {
  const z = zahtjevZapisa("عِلْمٌ");
  assert.deepEqual(z.harfovi, ["ع", "ل", "م"]);
  assert.deepEqual(z.znakovi.sort(), ["kesra", "sukun", "tenvin"]);
});
