import assert from "node:assert/strict";
import test from "node:test";
import { CJELINE } from "./transkripcija-podaci.js";
import {
  dotjeraj,
  njemackiIzEngleskog,
  normalizirajTranskripciju,
  primijeniEulogije,
  transkripcija,
} from "./transkripcija.js";

// Sura El-Fatiha onako kako stoji u lekciji na mekteb.net: bosanski, pa
// njemački i engleski oblik koji dijete treba moći pročitati.
const FATIHA: Array<{ bs: string; de: string; en: string }> = [
  {
    bs: "Bismillahir-rahmanir-rahim.",
    de: "Bismillahir-Rahmanir-Rahim.",
    en: "Bismillahir-Rahmanir-Rahim.",
  },
  {
    bs: "Elhamdu lillahi rabbil-alemin.",
    de: "Alhamdu lillahi Rabbil-alamin.",
    en: "Alhamdu lillahi Rabbil-alamin.",
  },
  { bs: "Er-rahmanir-rahim.", de: "Ar-Rahmanir-Rahim.", en: "Ar-Rahmanir-Rahim." },
  { bs: "Maliki jevmid-din.", de: "Maliki yaumid-din.", en: "Maliki yawmid-din." },
  {
    bs: "Ijjake na'budu ve ijjake neste'in.",
    de: "Iyyaka na'budu wa iyyaka nasta'in.",
    en: "Iyyaka na'budu wa iyyaka nasta'in.",
  },
  {
    bs: "Ihdines-siratal-mustekim.",
    de: "Ihdinas-siratal-mustaqim.",
    en: "Ihdinas-siratal-mustaqim.",
  },
  {
    bs: "Siratallezine en'amte alejhim, gajril-magdubi alejhim ve led-dallin.",
    de: "Siratal-ladhina an'amta alaihim, ghairil-maghdubi alaihim wa lad-dallin.",
    en: "Siratal-ladhina an'amta alayhim, ghayril-maghdubi alayhim wa lad-dallin.",
  },
];

test("El-Fatiha ima svoj oblik za njemački i svoj za engleski", () => {
  for (const ajet of FATIHA) {
    assert.equal(transkripcija(ajet.bs, "de"), ajet.de, `de: ${ajet.bs}`);
    assert.equal(transkripcija(ajet.bs, "en"), ajet.en, `en: ${ajet.bs}`);
    assert.equal(dotjeraj(ajet.bs, "bilo kakav prijevod", "de"), ajet.de);
    assert.equal(dotjeraj(ajet.bs, "bilo kakav prijevod", "en"), ajet.en);
  }
});

test("njemački i engleski se zaista razlikuju gdje se razlikuje i pravopis", () => {
  // aj → ai (njemački) naspram ay (engleski)
  assert.match(transkripcija("Maliki jevmid-din.", "de") ?? "", /yaumid/);
  assert.match(transkripcija("Maliki jevmid-din.", "en") ?? "", /yawmid/);
  // š → sch naspram sh, dž → dsch naspram j
  const euzuDe = transkripcija("Euzu billahi mineš-šejtanir-radžim.", "de") ?? "";
  const euzuEn = transkripcija("Euzu billahi mineš-šejtanir-radžim.", "en") ?? "";
  assert.equal(euzuDe, "A'udhu billahi minasch-schaitanir-radschim.");
  assert.equal(euzuEn, "A'udhu billahi minash-shaytanir-rajim.");
  assert.notEqual(euzuDe, euzuEn);
});

test("njemački oblik nema engleske digrafe sh, kh i samostalno j", () => {
  for (const ajet of FATIHA) {
    const de = transkripcija(ajet.bs, "de") ?? "";
    assert.doesNotMatch(de, /(?<!c)sh|kh/, `njemački ne piše sh/kh: ${de}`);
  }
  assert.doesNotMatch(transkripcija("Euzu billahi mineš-šejtanir-radžim.", "de") ?? "", /(?<!c)sh|kh/);
});

test("transkripcija se prepoznaje uz drugačije crtice, navodnike i velika slova", () => {
  for (const v of ["BISMILLAHIR-RAHMANIR-RAHIM", "„Bismillahir-rahmanir-rahim.“", "Bismillahir–rahmanir–rahim"]) {
    assert.match(transkripcija(v, "en") ?? "", /^Bismillahir-Rahmanir-Rahim/, v);
  }
});

test("obična rečenica nije transkripcija i ostaje prevodiocu", () => {
  for (const tekst of ["Prije svakog posla izgovaramo bismillu.", "Sura El-Fatiha ima sedam ajeta.", ""]) {
    for (const jezik of ["de", "en"] as const) assert.equal(transkripcija(tekst, jezik), null, tekst);
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

test("dž.š. uz Allahovo ime dobija puni izraz, a zarezi ostaju", () => {
  const izvor = "Allah, dž.š., nauči nas je dvije lijepe rečenice.";
  assert.equal(primijeniEulogije(izvor, "en"), "Allah, the Almighty, nauči nas je dvije lijepe rečenice.");
  assert.equal(primijeniEulogije(izvor, "de"), "Allah, der Erhabene, nauči nas je dvije lijepe rečenice.");
});

test("dželle šanuhu i zapis bez kvačica daju isti izraz", () => {
  for (const izvor of ["Allah dželle šanuhu", "Allah dz.s."]) {
    assert.match(primijeniEulogije(izvor, "de"), /der Erhabene$/, izvor);
  }
});

test("r.a. uz ashabe dobija rodno neutralan puni izraz", () => {
  const izvor = "Ebu Bekr, r.a., bio je prvi halifa.";
  assert.equal(primijeniEulogije(izvor, "en"), "Ebu Bekr (may Allah be pleased with them), bio je prvi halifa.");
  assert.equal(primijeniEulogije(izvor, "de"), "Ebu Bekr (möge Allah mit ihnen zufrieden sein), bio je prvi halifa.");
});

test("rodno neutralan oblik vrijedi i uz žensko ime i uz množinu", () => {
  // Bosansko „r.a.“ je isto za sve rodove, pa oblik ne smije biti muški.
  for (const izvor of ["Hatidža, r.a.", "ashabi radijallahu anhum"]) {
    assert.match(primijeniEulogije(izvor, "en"), /\(may Allah be pleased with them\)$/, izvor);
    assert.doesNotMatch(primijeniEulogije(izvor, "en"), /with him|with her/);
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
    for (const jezik of ["de", "en"] as const) assert.equal(primijeniEulogije(tekst, jezik), tekst, tekst);
  }
});

test("eulogija na samom početku ne dobija vodeći razmak", () => {
  assert.equal(primijeniEulogije("a.s. je rekao", "en"), "(peace be upon him) je rekao");
});

test("svaka sura i dova iz programa ima transkripciju za oba jezika", () => {
  for (const cjelina of CJELINE) {
    assert.ok(cjelina.redovi.length > 0, `${cjelina.naziv}: prazna cjelina`);
    for (const red of cjelina.redovi) {
      for (const jezik of ["de", "en"] as const) {
        const oblik = transkripcija(red.bs, jezik);
        assert.ok(oblik && oblik.length > 0, `${cjelina.naziv} / ${jezik}: ${red.bs}`);
      }
    }
  }
});

test("njemački oblik se izvodi iz engleskog, bez engleskih digrafa", () => {
  for (const cjelina of CJELINE) {
    for (const red of cjelina.redovi) {
      const de = njemackiIzEngleskog(red.en);
      assert.equal(transkripcija(red.bs, "de"), de, `${cjelina.naziv}: ${red.bs}`);
      assert.doesNotMatch(de, /(?<!c)sh|kh/, `njemački ne piše sh/kh: ${de}`);
      assert.doesNotMatch(de, /\bj|[aeiou]j/, `njemački ne piše j za dž: ${de}`);
    }
  }
});

test("nijedna transkripcija ne nosi naša slova", () => {
  for (const cjelina of CJELINE) {
    for (const red of cjelina.redovi) {
      for (const jezik of ["de", "en"] as const) {
        assert.doesNotMatch(transkripcija(red.bs, jezik) ?? "", /[čćžšđ]/i, `${cjelina.naziv}: ${red.bs}`);
      }
    }
  }
});

test("bosanski ključevi se ne ponavljaju", () => {
  const kljucevi = CJELINE.flatMap((c) => c.redovi).map((r) => normalizirajTranskripciju(r.bs));
  assert.equal(new Set(kljucevi).size, kljucevi.length, "ista bosanska transkripcija stoji dvaput");
});
