/**
 * Sučelje naših vježbi (public/vjezbe/*) ne prolazi kroz `t()` iz aplikacije —
 * vježba je samostalan HTML u iframe-u i ima svoj rječnik u
 * `public/vjezbe/jezik.js`. Ovaj test drži to dvoje u koraku: svaki ključ koji
 * vježba traži mora stvarno imati njemački i engleski prijevod, inače bi
 * dijete dobilo bosansko dugme usred njemačke lekcije.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const VJEZBE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/vjezbe",
);
const TIPOVI = ["osmosmjerka", "popuni", "poredak", "razvrstaj", "spoji", "upisi", "napamet"];

/** Učitaj jezik.js kao što ga učita vježba otvorena sa ?lang=<jezik>. */
interface Jezik {
  jezik: string;
  t: (k: string, p?: Record<string, unknown>) => string;
  ima: (k: string) => boolean;
  saJezikom: (adresa: string) => string;
}

function ucitajJezik(jezik: string): Jezik {
  const kod = fs.readFileSync(path.join(VJEZBE_DIR, "jezik.js"), "utf8");
  const okvir: Record<string, unknown> = {
    location: { search: `?lang=${jezik}` },
    document: { title: "", body: null, addEventListener() {} },
    URLSearchParams,
  };
  okvir.window = okvir;
  vm.createContext(okvir);
  vm.runInContext(kod, okvir);
  return (okvir as { MektebJezik: Jezik }).MektebJezik;
}

/** Ključevi koje vježba traži — svi `T('…')` pozivi u njenoj skripti. */
function kljuceviVjezbe(tip: string): string[] {
  const html = fs.readFileSync(path.join(VJEZBE_DIR, tip, `${tip}.html`), "utf8");
  return [...html.matchAll(/T\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]!);
}

test("svaka vježba učitava zajednički rječnik prije svoje skripte", () => {
  for (const tip of TIPOVI) {
    const html = fs.readFileSync(path.join(VJEZBE_DIR, tip, `${tip}.html`), "utf8");
    const jezikNaIndeksu = html.indexOf('<script src="/vjezbe/jezik.js"></script>');
    assert.notEqual(jezikNaIndeksu, -1, `${tip}: nema <script src="/vjezbe/jezik.js">`);
    const glavnaNaIndeksu = html.indexOf("var T = window.MektebJezik.t;");
    assert.notEqual(glavnaNaIndeksu, -1, `${tip}: skripta ne uzima T`);
    assert.ok(jezikNaIndeksu < glavnaNaIndeksu, `${tip}: rječnik se učitava poslije skripte`);
  }
});

test("svaki ključ iz vježbi ima njemački i engleski prijevod", () => {
  const de = ucitajJezik("de");
  const en = ucitajJezik("en");
  assert.equal(de.jezik, "de");
  assert.equal(en.jezik, "en");
  let provjereno = 0;
  for (const tip of TIPOVI) {
    const kljucevi = kljuceviVjezbe(tip);
    assert.ok(kljucevi.length > 10, `${tip}: samo ${kljucevi.length} ključeva — je li prevođenje izostalo?`);
    for (const kljuc of kljucevi) {
      // Poredi se postojanje ključa, ne sadržaj: neki oblici („%broj%. %tekst%")
      // jednaki su na sva tri jezika, a i dalje moraju stajati u rječniku.
      assert.ok(de.ima(kljuc), `${tip}: nema njemačkog za „${kljuc}"`);
      assert.ok(en.ima(kljuc), `${tip}: nema engleskog za „${kljuc}"`);
      provjereno += 1;
    }
  }
  assert.ok(provjereno >= 100, `provjereno samo ${provjereno} ključeva`);
});

test("dugmad i natpisi koje dijete vidi prevedeni su u oba jezika", () => {
  const de = ucitajJezik("de");
  const en = ucitajJezik("en");
  const chrome = [
    "Provjeri", "Pomozi mi", "Počni ispočetka", "Pokušaj ponovo", "Igraj ponovo", "Nova igra",
    "Vrijeme", "0 od 0", "Mekteb.net · vježba", "Za ovu vježbu treba uključiti JavaScript.",
    "Pronađeno", "Popunjeno", "Na mjestu", "Razvrstano", "Spojeno", "Tačno",
    "Riječi koje tražiš", "Riječi koje nedostaju", "Stavke za razvrstavanje", "Odgovori",
    "Težina", "Lako", "Srednje", "Teško",
  ];
  for (const kljuc of chrome) {
    assert.ok(de.ima(kljuc) && de.t(kljuc) !== kljuc, `nema njemačkog za „${kljuc}"`);
    assert.ok(en.ima(kljuc) && en.t(kljuc) !== kljuc, `nema engleskog za „${kljuc}"`);
  }
});

test("bosanski i nepoznat jezik vraćaju izvorni tekst", () => {
  for (const jezik of ["bs", "tr", "xx", ""]) {
    const m = ucitajJezik(jezik);
    assert.equal(m.jezik, "bs", jezik);
    assert.equal(m.t("Provjeri"), "Provjeri", jezik);
  }
});

test("zamjene u tekstu se popunjavaju, a nepoznate ostaju vidljive", () => {
  const de = ucitajJezik("de");
  assert.equal(de.t("%broj% od %ukupno%", { broj: 3, ukupno: 7 }), "3 von 7");
  assert.equal(de.t("%broj% od %ukupno%", { broj: 3 }), "3 von %ukupno%");
});

test("vježba traži svoj sadržaj na jeziku djeteta", () => {
  const de = ucitajJezik("de");
  assert.equal(
    de.saJezikom("/api/nase-vjezbe/podaci/spoji/pojmovi.json"),
    "/api/nase-vjezbe/podaci/spoji/pojmovi.json?lang=de",
  );
  assert.equal(de.saJezikom("/x.json?a=1"), "/x.json?a=1&lang=de");
  assert.equal(de.saJezikom("/x.json?lang=en"), "/x.json?lang=en", "već zadan jezik se ne dira");
  assert.equal(de.saJezikom(""), "");
  // Na bosanskom adresa ostaje kakva je spremljena u prilogu.
  assert.equal(ucitajJezik("bs").saJezikom("/x.json"), "/x.json");
});

test("svaka vježba dopisuje jezik na zahtjev za podacima", () => {
  for (const tip of TIPOVI) {
    const html = fs.readFileSync(path.join(VJEZBE_DIR, tip, `${tip}.html`), "utf8");
    assert.match(
      html,
      /fetch\(window\.MektebJezik\.saJezikom\(/,
      `${tip}: sadržaj se traži bez jezika, pa bi ostao bosanski`,
    );
  }
});
