// Svako slovo mora imati sliku, a slike moraju stajati u porodicama.
//
// Slika je jedino čime dijete pamti oblik — ime slova se ne spominje, pa ako
// slika izostane, slovo ostaje bez ijednog oslonca. Zato test pada i kad se
// programu doda slovo bez slike, i kad se slovo iz programa izbaci a slika
// ostane za njim.
import assert from "node:assert/strict";
import test from "node:test";
import { ASOCIJACIJE, asocijacija, porodicaHarfa } from "../data/citanje-asocijacije";
import { PROGRAM_CITANJA, znanjeDoLekcije } from "../data/citanje-program";
import { LEKCIJE_CITANJA } from "../data/citanje-lekcije";
import { vjezbeZaLekciju, radniList } from "../data/citanje-vjezbe";
import { zahtjevZapisa } from "./sufara-zapis";

const SVA_SLOVA = PROGRAM_CITANJA.flatMap((p) => p.harfovi);
const lekcijaHarfa = new Map(PROGRAM_CITANJA.flatMap((p) => p.harfovi.map((h) => [h, p.broj] as const)));

test("svako slovo programa ima sliku, opis i potez", () => {
  const bez = SVA_SLOVA.filter((h) => !asocijacija(h));
  assert.deepEqual(bez, [], `slova bez slike: ${bez.join(" ")}`);
  for (const h of SVA_SLOVA) {
    const a = asocijacija(h)!;
    assert.ok(a.slika.length >= 3, `slika za ${h} je prekratka`);
    assert.ok(a.opis.length >= 40, `opis za ${h} je prekratak`);
    assert.ok(a.potez.length >= 25, `potez za ${h} je prekratak`);
  }
});

test("nema slike za slovo koje program ne uvodi", () => {
  const viska = Object.keys(ASOCIJACIJE).filter((h) => !lekcijaHarfa.has(h));
  assert.deepEqual(viska, [], `slike bez slova u programu: ${viska.join(" ")}`);
});

/**
 * Porodica je pomoć samo ako među njenim slovima stoji vrijeme. Dva slova
 * istog kostura u istoj lekciji znače da dijete ne uči oblike nego broji
 * tačkice — upravo ono što redoslijed iz citanje-program.ts izbjegava.
 *
 * Hemze je izuzet: „ء أ إ ؤ ئ" nisu pet slova nego jedan znak na raznim
 * nosačima, i uče se kao cjelina.
 */
test("slova istog kostura nisu u istoj lekciji", () => {
  const skupine = new Map<string, string[]>();
  for (const h of SVA_SLOVA) {
    const p = asocijacija(h)?.porodica;
    if (!p || p === "hemze") continue;
    skupine.set(p, [...(skupine.get(p) ?? []), h]);
  }
  const sudari: string[] = [];
  for (const [p, harfovi] of skupine) {
    const po = new Map<number, string[]>();
    for (const h of harfovi) {
      const l = lekcijaHarfa.get(h)!;
      po.set(l, [...(po.get(l) ?? []), h]);
    }
    for (const [l, u] of po) {
      if (u.length > 1) sudari.push(`porodica „${p}“ ima ${u.join(" ")} u lekciji ${l}`);
    }
  }
  assert.deepEqual(sudari, [], sudari.join("\n"));
});

test("drugo slovo porodice se ima na što osloniti", () => {
  const tihi: string[] = [];
  for (const h of SVA_SLOVA) {
    const p = asocijacija(h)?.porodica;
    if (!p || p === "hemze") continue;
    const l = lekcijaHarfa.get(h)!;
    const stariji = SVA_SLOVA.filter((d) => asocijacija(d)?.porodica === p && lekcijaHarfa.get(d)! < l);
    if (!stariji.length) continue;
    const rod = porodicaHarfa(h, znanjeDoLekcije(l - 1).harfovi);
    if (!rod.length) tihi.push(`${h} u lekciji ${l} ne pokazuje ${stariji.join(" ")}`);
  }
  assert.deepEqual(tihi, [], tihi.join("\n"));
});

for (const lekcija of LEKCIJE_CITANJA) {
  test(`lekcija ${lekcija.broj} daje ruci sva svoja slova`, () => {
    const program = PROGRAM_CITANJA.find((p) => p.broj === lekcija.broj)!;
    const pisi = vjezbeZaLekciju(lekcija.broj).find((v) => v.vrsta === "pisi");
    assert.ok(pisi, "nema vježbe pisanja");
    assert.deepEqual(pisi.stavke.map((s) => s.harf), program.harfovi, "pisanje ne pokriva slova lekcije");
    for (const s of pisi.stavke) {
      assert.ok(s.potez && s.potez.length >= 25, `${s.harf} nema potez`);
      assert.ok(s.slika, `${s.harf} nema sliku`);
    }
  });

  test(`lekcija ${lekcija.broj} ide oko pa ruka pa prepoznavanje`, () => {
    const red = vjezbeZaLekciju(lekcija.broj).map((v) => v.vrsta);
    const oblici = red.indexOf("oblici");
    const pisi = red.indexOf("pisi");
    const lov = red.indexOf("pronadi-harf");
    assert.ok(pisi > oblici, "ruka dolazi prije nego oko vidi oblike");
    if (lov >= 0) assert.ok(pisi < lov, "lov na slova dolazi prije nego ruka napravi slovo");
  });

  test(`lekcija ${lekcija.broj} ima šta zadati za kući`, () => {
    assert.ok(lekcija.domaca.length >= 1, "nema domaće");
    for (const d of lekcija.domaca) {
      assert.ok(d.length >= 40, `domaća „${d}“ je prekratka da bi bila uputa`);
    }
  });

  test(`lekcija ${lekcija.broj} ima pun radni list`, () => {
    const list = radniList(lekcija.broj);
    assert.ok(list.length >= 4, `radni list ima samo ${list.length} reda`);
    const duzine = new Set(list.map((r) => r.length));
    assert.equal(duzine.size, 1, `redovi radnog lista nisu iste dužine: ${[...duzine].join(", ")}`);
    assert.ok(!list.flat().some((z) => !z), "radni list ima prazno polje");

    // Ništa na radnom listu ne smije tražiti gradivo iz kasnije lekcije —
    // dijete ga prelazi samo, bez muallima koji bi pomogao.
    const znanje = znanjeDoLekcije(lekcija.broj);
    const prerano = [...new Set(list.flat())].filter((z) => {
      const { harfovi, znakovi } = zahtjevZapisa(z);
      return !harfovi.every((h) => znanje.harfovi.has(h)) || !znakovi.every((s) => znanje.znakovi.has(s));
    });
    assert.deepEqual(prerano, [], `radni list prehitava program: ${prerano.join(" ")}`);
  });
}
