import assert from "node:assert/strict";
import test from "node:test";
import {
  existingQuizNeedsRepair,
  existingTextNeedsRepair,
  htmlTranslationIssue,
  objasniOdbijanje,
} from "./translate-content";

test("ne šalje ponovo bankovno pitanje koje prevodi termin i čuva ga u zagradi", () => {
  const source = "Šta je šart u namazu?";
  const translation = "Was ist eine Bedingung (šart) im Gebet?";

  assert.equal(existingTextNeedsRepair(source, translation, "de"), false);
});

test("označava potpuno nepromijenjeno bankovno pitanje za popravku", () => {
  const source = "Šta je šart u namazu?";

  assert.equal(existingTextNeedsRepair(source, source, "de"), true);
});

test("ne šalje ponovo kviz_pitanja kada prijevod čuva termin dova u zagradi", () => {
  const source = [
    {
      question: "Šta je dova?",
      options: ["Molitva", "Igra"],
      answer: "Molitva",
    },
  ];
  const translation = JSON.stringify([
    {
      question: "Was ist ein Bittgebet (dova)?",
      options: ["Gebet", "Spiel"],
      answer: "Gebet",
    },
  ]);

  assert.equal(existingQuizNeedsRepair(source, translation, "de"), false);
});

test("označava potpuno nepromijenjeno kviz_pitanje za popravku", () => {
  const source = [
    {
      question: "Šta je dova?",
      options: ["Molitva", "Igra"],
      answer: "Molitva",
    },
  ];

  assert.equal(existingQuizNeedsRepair(source, JSON.stringify(source), "de"), true);
});

test("ne tretira nepromijenjeni URL u HTML-u kao neprevedenu rečenicu", () => {
  const source = '<p>https://youtu.be/4-VR0vjjDi8?si=vY-7nPPQWh_K3VxD</p>';

  assert.equal(htmlTranslationIssue(source, source, "de"), null);
});

test("ne odbacuje njemački HTML zbog bošnjačkih slova u vlastitim imenima", () => {
  const source = "<p>Đuro Đurić je učitelj u Žepču.</p>";
  const translation = "<p>Der Lehrer Đuro Đurić ist ein Lehrer aus Žepče und unterrichtet dort.</p>";

  assert.equal(htmlTranslationIssue(source, translation, "de"), null);
});

test("ne odbacuje albanski HTML zbog bošnjačkih slova u vlastitim imenima", () => {
  const source = "<p>Đuro Đurić je učitelj u Žepču.</p>";
  const translation = "<p>Mësuesi Đuro Đurić është një mësues nga Žepçe dhe jep mësim atje.</p>";

  assert.equal(htmlTranslationIssue(source, translation, "sq"), null);
});

test("ne tretira nepromijenjeno ime Derviš Sušić kao bosansku rečenicu", () => {
  const source = "<p>DERVIŠ SUŠIĆ</p>";

  assert.equal(htmlTranslationIssue(source, source, "de"), null);
});

test("čuva dugu arapsku transliteraciju u HTML-u", () => {
  const source = "<p>ALLAHU LA-ILAHE ILLA-HU, EL-HAJJUL-KAJJUM. LA TE'HUZUHU SINETUN VVE-LA NEVM.</p>";

  assert.equal(htmlTranslationIssue(source, source, "de"), null);
});

test("ispis odbijenog reda kaže razlog i pokaže sporni string", () => {
  // Najčešći slučaj: prevodilac je jedan string izostavio iz dugog odgovora.
  // Prije se u ispisu vidjelo samo „neispravan tekstualni prijevod", pa se
  // nije moglo razaznati je li kriv prevodilac ili provjera.
  const izostavljen = objasniOdbijanje(["Koliko puta se klanja?"], {}, "de");
  assert.match(izostavljen, /prevodilac nije vratio prijevod/);
  assert.match(izostavljen, /Koliko puta se klanja\?/);

  const prazan = objasniOdbijanje(["Pitanje"], { Pitanje: "   " }, "de");
  assert.match(prazan, /prevodilac nije vratio prijevod/);

  // Kad provjera odbije sadržaj, razlog dolazi iz nje same.
  const dodanaEulogija = objasniOdbijanje(
    ["Muhammed je rekao"],
    { "Muhammed je rekao": "Muhammed sallallahu alejhi ve sellem sagte" },
    "de",
  );
  assert.match(dodanaEulogija, /počasni oblik/);

  // Broj spornih stringova ide u ispis, da se vidi je li kviz pao na jednom
  // odgovoru ili na cijelom nizu.
  assert.match(objasniOdbijanje(["a", "b", "c"], {}, "de"), /3 stringa/);
  assert.match(objasniOdbijanje(["a"], {}, "de"), /1 string\b/);
});
