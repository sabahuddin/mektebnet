// Nijedna vježba ne smije tražiti gradivo koje dijete još nije učilo.
//
// Provjerava se i svaki vagon u vozu slogova zasebno: „بَابْ" je ispravan u
// petoj lekciji, ali ako bi se rastavio na dijelove od kojih jedan traži
// slovo iz osme, vježba bi bila neispravna iako cjelina nije.
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEKCIJE_CITANJA } from "../data/citanje-lekcije";
import { vjezbeZaLekciju } from "../data/citanje-vjezbe";
import { PROGRAM_CITANJA, znanjeDoLekcije } from "../data/citanje-program";
import { zahtjevZapisa, zavrsetakOznacen } from "./sufara-zapis";

const ZADNJA = PROGRAM_CITANJA[PROGRAM_CITANJA.length - 1].broj;
const ZVUK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/audio/citanje");

function najranija(zapis: string): number | null {
  const { harfovi, znakovi } = zahtjevZapisa(zapis);
  for (let l = 1; l <= ZADNJA; l += 1) {
    const z = znanjeDoLekcije(l);
    if (harfovi.every((h) => z.harfovi.has(h)) && znakovi.every((s) => z.znakovi.has(s))) return l;
  }
  return null;
}

/**
 * Svaki zapis koji se u lekciji pojavi pred djetetom. Vagoni u vozu slogova i
 * kraći parnjaci u kratko-dugo se broje zasebno: cjelina može biti ispravna, a
 * dio tražiti gradivo iz kasnije lekcije.
 *
 * Oblici slova se izuzimaju — tatvil u njima je crta koja stoji umjesto
 * susjednog slova, ne harf, pa bi ga raspoređivač uzalud tražio.
 */
function sviZapisi(broj: number): string[] {
  const izl: string[] = [];
  for (const v of vjezbeZaLekciju(broj)) {
    if (v.vrsta === "oblici" || v.vrsta === "pronadi-harf") continue;
    for (const s of v.stavke) {
      izl.push(s.zapis);
      if (s.parnjak) izl.push(s.parnjak);
      for (const d of s.dijelovi ?? []) izl.push(d);
    }
    for (const red of v.redovi ?? []) izl.push(...red);
  }
  return izl;
}

test("svaka lekcija programa ima napisan sadržaj ili ga nema nijedna poslije nje", () => {
  const brojevi = LEKCIJE_CITANJA.map((l) => l.broj);
  assert.deepEqual(brojevi, [...brojevi].sort((a, b) => a - b), "lekcije nisu poredane");
  assert.deepEqual(brojevi, brojevi.map((_, i) => i + 1), "lekcije preskaču broj");
});

for (const lekcija of LEKCIJE_CITANJA) {
  test(`lekcija ${lekcija.broj} ne prehitava program`, () => {
    const prerano: string[] = [];
    for (const zapis of new Set(sviZapisi(lekcija.broj))) {
      const treba = najranija(zapis);
      if (treba === null) {
        const { harfovi, znakovi } = zahtjevZapisa(zapis);
        prerano.push(`${zapis} — nijedna lekcija je ne pokriva; traži ${harfovi.join("")} i ${znakovi.join(", ")}`);
      } else if (treba > lekcija.broj) {
        prerano.push(`${zapis} — traži lekciju ${treba}, a stoji u ${lekcija.broj}`);
      }
    }
    assert.deepEqual(prerano, [], `stavke traže gradivo koje dijete još nije učilo:\n${prerano.join("\n")}`);
  });

  test(`lekcija ${lekcija.broj} ide redom: vidjeti, prepoznati, čuti, pročitati`, () => {
    const vrste = vjezbeZaLekciju(lekcija.broj).map((v) => v.vrsta);
    for (const traženo of ["oblici", "pronadi-harf", "glas", "slusaj-klikni", "voz-slogova", "citaj-rijeci", "brzina"]) {
      assert.ok(vrste.includes(traženo as never), `nedostaje vježba ${traženo}`);
    }
    assert.ok(vrste.indexOf("oblici") < vrste.indexOf("pronadi-harf"), "oblici moraju doći prije prepoznavanja");
    assert.ok(vrste.indexOf("pronadi-harf") < vrste.indexOf("glas"), "prepoznavanje mora doći prije slušanja");
    assert.ok(vrste.indexOf("slusaj-klikni") < vrste.indexOf("citaj-rijeci"), "slušanje mora doći prije čitanja");
  });

  test(`lekcija ${lekcija.broj} ima dovoljno građe za rad`, () => {
    // Prva verzija je imala šest do deset stavki po vježbi — to je pet minuta,
    // a Akordion 2 je pola sata. Ovo je donja granica ispod koje lekcija nije
    // lekcija nego obrazac s uzorkom.
    const v = vjezbeZaLekciju(lekcija.broj);
    const ukupno = v.reduce((z, x) => z + x.stavke.length + (x.redovi ?? []).flat().length, 0);
    assert.ok(ukupno >= 60, `lekcija ${lekcija.broj} ima samo ${ukupno} stavki, a treba bar 60`);
  });

  test(`lekcija ${lekcija.broj} objašnjava harf našim riječima`, () => {
    assert.ok(lekcija.objasnjenje.length > 0, "nema objašnjenja");
    for (const o of lekcija.objasnjenje) {
      assert.ok(o.tekst.length > 80, `objašnjenje \u201e${o.naslov}\u201c je prekratko`);
    }
  });

  test(`lekcija ${lekcija.broj} uvodi ono što joj program propisuje`, () => {
    const program = PROGRAM_CITANJA.find((p) => p.broj === lekcija.broj);
    assert.ok(program, "lekcija nema svoj unos u programu");
    assert.equal(lekcija.naslov, program.naziv, "naslov lekcije se razišao s programom");
  });

  test(`lekcija ${lekcija.broj} označava završetak svakog zapisa`, () => {
    // Vagoni u vozu slogova su dijelovi riječi, ne riječi, pa se od njih ne
    // traži označen kraj — „مِ" u „مِنْ" završava vokalom jer se nastavlja.
    const lose = vjezbeZaLekciju(lekcija.broj)
      .filter((v) => v.vrsta === "citaj-rijeci")
      .flatMap((v) => v.stavke.map((s) => s.zapis))
      .filter((z) => !zavrsetakOznacen(z));
    assert.deepEqual(lose, [], `riječ bez označenog kraja:\n${lose.join("\n")}`);
  });
}

/**
 * Zvuk treba samo ondje gdje se sluša. Voz slogova i redovi za tečnost su
 * čitanje — dijete ih čita, a muallim sluša, pa se snimci za njih ne prave.
 */
function zapisiKojiTrazeZvuk(broj: number): string[] {
  return vjezbeZaLekciju(broj)
    .filter((v) => v.trebaZvuk)
    .flatMap((v) => v.stavke.flatMap((s) => [s.zapis, ...(s.parnjak ? [s.parnjak] : [])]));
}

test("lekcija tvrdi da ima zvuk samo ako snimci postoje", () => {
  let datoteke: string[] = [];
  try { datoteke = readdirSync(ZVUK); } catch { datoteke = []; }
  const krivo: string[] = [];
  for (const lekcija of LEKCIJE_CITANJA) {
    const treba = new Set(zapisiKojiTrazeZvuk(lekcija.broj).map((z) => `rijec-${Buffer.from(z).toString("hex")}.mp3`));
    const fali = [...treba].filter((d) => !datoteke.includes(d));
    if (lekcija.imaZvuk && fali.length) krivo.push(`lekcija ${lekcija.broj} tvrdi da ima zvuk, a fali ${fali.length} snimaka`);
    if (!lekcija.imaZvuk && !fali.length) krivo.push(`lekcija ${lekcija.broj} ima sve snimke, a ne tvrdi to`);
  }
  assert.deepEqual(krivo, [], krivo.join("\n"));
});
