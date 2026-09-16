import assert from "node:assert/strict";
import { test } from "node:test";
import { STATIC_VJEZBE } from "./static-vjezbe.js";
import {
  applyLegacyStaticVjezbaRuntimePatch,
  applyStaticVjezbaReorderShuffle,
  readBundledStaticVjezba,
  validateStaticVjezbaSource,
} from "./static-vjezba-source.js";

test("svi bundlovani izvori statičkih vježbi prolaze validaciju", async () => {
  for (const key of Object.keys(STATIC_VJEZBE)) {
    const sourceHtml = await readBundledStaticVjezba(key);
    assert.equal(validateStaticVjezbaSource(sourceHtml), null, key);
  }
});

test("svih 23 izvora miješa odgovore i reorder kartice bez promjene tačnog reda", async () => {
  const bundledKey = "etapa-lekcije-11-20";

  for (const key of Object.keys(STATIC_VJEZBE)) {
    const bundledHtml = await readBundledStaticVjezba(key);
    const sourceHtml = applyStaticVjezbaReorderShuffle(bundledHtml);
    const questionTarget = key === bundledKey ? "Q" : "PITANJA";
    const answerCall = new RegExp(`izmijesajOdgovore\\(${questionTarget}\\)`, "g");
    const situationCall = /izmijesajSituacijskeIzbore\(SITUACIJE\)/g;

    assert.equal(
      (sourceHtml.match(/function izmijesajOdgovore/g) ?? []).length,
      1,
      `${key}: helper za odgovore`,
    );
    assert.equal(
      (sourceHtml.match(answerCall) ?? []).length,
      1,
      `${key}: odgovor se miješa tačno jednom`,
    );
    assert.equal(
      (sourceHtml.match(/function izmijesajSituacijskeIzbore/g) ?? []).length,
      1,
      `${key}: helper za situacije`,
    );
    assert.equal(
      (sourceHtml.match(situationCall) ?? []).length,
      1,
      `${key}: izbori situacije se miješaju tačno jednom`,
    );

    // Reorder dobija zasebnu izmiješanu kopiju za kartice. Kanonski
    // p.stavke ostaje neizmijenjen za slotove i provjeru tačnosti.
    assert.match(sourceHtml, /p\.tacno\s*=/, `${key}: remap single/truefalse`);
    assert.match(sourceHtml, /p\.tacniVise\s*=/, `${key}: remap multiple`);
    assert.match(sourceHtml, /izmijesaneStavke\s*=\s*fisherYates\(p\.stavke\.slice\(\)\)/);
    assert.match(sourceHtml, /izmijesaneStavke\s*\|\|/);
    assert.match(sourceHtml, /korak\.izbori/);
    assert.doesNotMatch(sourceHtml, /p\.stavke\s*=\s*fisherYates/);
  }
});

test("editor odbija prazan ili neispravan HTML bez protokola završetka", () => {
  assert.match(validateStaticVjezbaSource("") ?? "", /prazan/i);
  assert.match(
    validateStaticVjezbaSource("<!doctype html><title>Bez protokola</title>") ?? "",
    /protokol/i,
  );
});

test("prilagođena vježba 11–20 dobija novi dizajn bez promjene sadržaja", async () => {
  const bundled = await readBundledStaticVjezba("etapa-lekcije-11-20");
  const start = bundled.indexOf("    // This legacy exercise is distributed as a compressed bundler template.");
  const end = bundled.indexOf("    // Nested page bundles (iframe targets).", start);
  assert.ok(start >= 0 && end > start);

  const customMarker = "MOJ-PRILAGODJENI-SADRZAJ";
  const customized = (
    bundled.slice(0, start) + bundled.slice(end)
  ).replace("Trideset tri šarta, namaz i sure", customMarker);
  const patched = applyLegacyStaticVjezbaRuntimePatch(customized, bundled);

  assert.match(patched, /id="mekteb-nivo3-restyle"/);
  assert.match(patched, /izmijesajOdgovore/);
  assert.match(patched, new RegExp(customMarker));
});