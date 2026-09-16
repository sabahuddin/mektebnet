import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSurahNames,
  normalizeSurahNamesDeep,
  restoreSurahNameCaseInUppercaseText,
} from "./surah-names.js";

test("ujednačava velika slova, razmake, crtice i akademske znakove", () => {
  assert.equal(
    normalizeSurahNames("EL FATIHA, el-fīl, El-Kāfirūn, EL-MĀŪN, en nas"),
    "El-Fatiha, El-Fil, El-Kafirun, El-Maun, En-Nas",
  );
});

test("ujednačava kanonske nazive kratkih sura", () => {
  assert.equal(
    normalizeSurahNames("kurejs, EL-KEVSER, el-ihlas, el-felek, EN-NASR"),
    "El-Kurejš, El-Kevser, El-Ihlas, El-Felek, En-Nasr",
  );
});

test("ujednačava velika slova za nazive kroz svih 114 sura", () => {
  assert.equal(
    normalizeSurahNames("EL-BEKARA, ali imran, EŠ ŠUARA, ja sin, ET-TEVBA"),
    "El-Bekara, Ali Imran, Eš-Šuara, Ja-Sin, Et-Tevba",
  );
});

test("ne mijenja običnu bosansku riječ nas", () => {
  assert.equal(normalizeSurahNames("Namaz nas odvraća od lošeg."), "Namaz nas odvraća od lošeg.");
});

test("razlikuje suru El-Kurejš od plemena Kurejš", () => {
  assert.equal(normalizeSurahNames("Učimo suru Kurejš."), "Učimo suru El-Kurejš.");
  assert.equal(normalizeSurahNames("Rođen je u plemenu Kurejš."), "Rođen je u plemenu Kurejš.");
  assert.equal(normalizeSurahNames("Kurejš"), "El-Kurejš");
});

test("normalizuje tekst duboko u JSON podacima", () => {
  assert.deepEqual(
    normalizeSurahNamesDeep({ question: "Koja je EL-FATIHA?", options: ["EL-FELEK", "EN NAS"] }),
    { question: "Koja je El-Fatiha?", options: ["El-Felek", "En-Nas"] },
  );
});

test("čuva velika slova naziva sure unutar teksta pisanog velikim slovima", () => {
  assert.equal(
    normalizeSurahNames("<p>TO JE SURA EL-FATIHA I ONA JE MAJKA CIJELOG KUR'ANA.</p>"),
    "<p>TO JE SURA EL-FATIHA I ONA JE MAJKA CIJELOG KUR'ANA.</p>",
  );
  assert.equal(
    normalizeSurahNames("<p>Naša najvažnija sura je EL-FATIHA.</p>"),
    "<p>Naša najvažnija sura je El-Fatiha.</p>",
  );
  assert.equal(
    restoreSurahNameCaseInUppercaseText(
      "<p>TO JE SURA El-Fatiha I ONA JE MAJKA CIJELOG KUR'ANA.</p><p>Učimo El-Fatihu.</p>",
    ),
    "<p>TO JE SURA EL-FATIHA I ONA JE MAJKA CIJELOG KUR'ANA.</p><p>Učimo El-Fatihu.</p>",
  );
});