import assert from "node:assert/strict";
import test from "node:test";
import {
  existingQuizNeedsRepair,
  existingTextNeedsRepair,
  htmlTranslationIssue,
  objasniOdbijanje,
  ocistiZaBazu,
  opisiGresku,
  preserveSourceCasing,
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

test("upravljački znakovi se uklanjaju prije upisa u bazu", () => {
  // Postgres odbija NUL bajt u text koloni: „invalid byte sequence for
  // encoding UTF8: 0x00". Model ga zna ubaciti u dugi HTML odgovor, pa je
  // upis lekcije padao dok god se prijevod nije očistio.
  assert.equal(ocistiZaBazu("Wudu\u0000 ist"), "Wudu ist");
  assert.equal(ocistiZaBazu("a\u0007b\u001Fc"), "abc");
  // Tabulator, novi red i povratak reda su legitimni i ostaju.
  assert.equal(ocistiZaBazu("prvi\ndrugi\ttreći\r\n"), "prvi\ndrugi\ttreći\r\n");
  // Naša slova i arapsko pismo se ne diraju.
  assert.equal(ocistiZaBazu("čćžšđ الله"), "čćžšđ الله");
  const čisto = "<p>Der Wudu ist eine Waschung.</p>";
  assert.equal(ocistiZaBazu(čisto), čisto);
});

test("ispis greške kaže Postgresov razlog, ne cijeli SQL", () => {
  // Drizzle u message stavi cijeli upit, a pravi razlog ostavi u cause —
  // zato se u ispisu vidjelo samo „Failed query: INSERT INTO …".
  const drizzle = Object.assign(
    new Error("Failed query: INSERT INTO content_prijevodi (tabela, red_id, polje…) VALUES ($1, $2)"),
    { cause: { message: 'invalid byte sequence for encoding "UTF8": 0x00', code: "22021" } },
  );
  assert.equal(opisiGresku(drizzle), 'invalid byte sequence for encoding "UTF8": 0x00 (22021)');

  // Bez cause ostaje poruka, ali u jednom redu i skraćena.
  const obicna = new Error("nešto\nje\npuklo");
  assert.equal(opisiGresku(obicna), "nešto je puklo");
  assert.ok(opisiGresku(new Error("x".repeat(400))).length <= 200);
});

test("čuva uppercase format lekcije kada čvor sadrži mixed-case naziv sure", () => {
  const source = "SURA El-Fatiha JE PRVA SURA U KUR’ANU. El-Fatiha GLASI:";
  const german = "Die Sure Al-Fatiha ist die erste Sure im Koran. Al-Fatiha lautet:";
  const english = "Surah Al-Fatihah is the first surah in the Qur'an. Al-Fatihah reads:";

  assert.equal(
    preserveSourceCasing(source, german),
    "DIE SURE AL-FATIHA IST DIE ERSTE SURE IM KORAN. AL-FATIHA LAUTET:",
  );
  assert.equal(
    preserveSourceCasing(source, english),
    "SURAH AL-FATIHAH IS THE FIRST SURAH IN THE QUR'AN. AL-FATIHAH READS:",
  );
  assert.equal(
    preserveSourceCasing("Dova za znanje", "Bittgebet für Wissen"),
    "Bittgebet für Wissen",
  );
});
