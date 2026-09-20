import assert from "node:assert/strict";
import test from "node:test";
import {
  dotjeraj,
  medjunarodnaTranskripcija,
  normalizirajTranskripciju,
  primijeniEulogije,
} from "./transkripcija.js";

// Sura El-Fatiha onako kako stoji u lekciji na mekteb.net, ajet po ajet.
const FATIHA: Array<[string, string]> = [
  ["Bismillahir-rahmanir-rahim.", "Bismillahir-Rahmanir-Rahim."],
  ["Elhamdu lillahi rabbil-alemin.", "Alhamdu lillahi Rabbil-alamin."],
  ["Er-rahmanir-rahim.", "Ar-Rahmanir-Rahim."],
  ["Maliki jevmid-din.", "Maliki yawmid-din."],
  ["Ijjake na'budu ve ijjake neste'in.", "Iyyaka na'budu wa iyyaka nasta'in."],
  ["Ihdines-siratal-mustekim.", "Ihdinas-siratal-mustaqim."],
  [
    "Siratallezine en'amte alejhim, gajril-magdubi alejhim ve led-dallin.",
    "Siratal-ladhina an'amta alayhim, ghayril-maghdubi alayhim wa lad-dallin.",
  ],
];

test("El-Fatiha dobija međunarodnu transkripciju, ista za oba jezika", () => {
  for (const [bosanski, medjunarodni] of FATIHA) {
    assert.equal(medjunarodnaTranskripcija(bosanski), medjunarodni, `ajet: ${bosanski}`);
    for (const jezik of ["de", "en"] as const) {
      assert.equal(dotjeraj(bosanski, "bilo kakav prijevod", jezik), medjunarodni);
    }
  }
});

test("transkripcija se prepoznaje i uz drugačije crtice, navodnike i velika slova", () => {
  const varijante = [
    "BISMILLAHIR-RAHMANIR-RAHIM",
    "„Bismillahir-rahmanir-rahim.“",
    "Bismillahir–rahmanir–rahim",
  ];
  for (const v of varijante) {
    assert.match(medjunarodnaTranskripcija(v) ?? "", /^Bismillahir-Rahmanir-Rahim/, v);
  }
});

test("euzu-formula ima svoj međunarodni oblik", () => {
  assert.equal(
    medjunarodnaTranskripcija("Euzu billahi mineš-šejtanir-radžim."),
    "A'udhu billahi minash-shaytanir-rajim.",
  );
});

test("obična rečenica nije transkripcija i ostaje prevodiocu", () => {
  for (const tekst of ["Prije svakog posla izgovaramo bismillu.", "Sura El-Fatiha ima sedam ajeta.", ""]) {
    assert.equal(medjunarodnaTranskripcija(tekst), null, tekst);
  }
});

test("normalizacija skida naše kvačice i interpunkciju", () => {
  assert.equal(normalizirajTranskripciju("Mineš-šejtanir-radžim!"), "mines sejtanir radzim");
});

test("eulogija za Poslanika postaje puni izraz, bez arapskog znaka", () => {
  const izvor = "Allahov Poslanik, s.a.v.s., rekao je.";
  assert.equal(primijeniEulogije(izvor, "en"), "Allahov Poslanik (peace be upon him), rekao je.");
  assert.equal(primijeniEulogije(izvor, "de"), "Allahov Poslanik (Friede sei mit ihm), rekao je.");
});

test("a.s., alejhis-selam i ﷺ daju isti puni izraz", () => {
  for (const izvor of ["Adem a.s. je prvi čovjek.", "Adem alejhis-selam je prvi čovjek.", "Adem ﷺ je prvi čovjek."]) {
    assert.equal(primijeniEulogije(izvor, "en"), "Adem (peace be upon him) je prvi čovjek.", izvor);
  }
});

test("arapski znak ﷺ nikad ne ostaje u njemačkom ni engleskom", () => {
  for (const jezik of ["de", "en"] as const) {
    assert.doesNotMatch(primijeniEulogije("Muhammed ﷺ", jezik), /ﷺ/);
  }
});

test("dž.š. i r.a. se ne diraju — to su druge formule", () => {
  const izvor = "Allah, dž.š., i Ebu Bekr, r.a.";
  for (const jezik of ["de", "en"] as const) {
    assert.equal(primijeniEulogije(izvor, jezik), izvor);
  }
});

test("tekst bez eulogije se ne dira — ni razmaci ni interpunkcija", () => {
  const netaknuto = [
    " (uslov: {uslov})",
    " (datum nedostupan)",
    "Sačuvaj kao .h5p i uploaduj u Mekteb",
    "https://wordwall.net/... ili <iframe ...></iframe>",
    "1. Pročitaj bez pomoći  ·  2. Klikni i provjeri",
    "Radni list — Muallim: ______   Datum: ______",
  ];
  for (const tekst of netaknuto) {
    for (const jezik of ["de", "en"] as const) {
      assert.equal(primijeniEulogije(tekst, jezik), tekst, tekst);
    }
  }
});

test("eulogija na samom početku ne dobija vodeći razmak", () => {
  assert.equal(primijeniEulogije("a.s. je rekao", "en"), "(peace be upon him) je rekao");
});
