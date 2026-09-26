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

/** Svaki zapis koji se u lekciji pojavi pred djetetom, vagoni uključeni. */
function sviZapisi(lekcija: (typeof LEKCIJE_CITANJA)[number]): string[] {
  const izl: string[] = [];
  for (const v of lekcija.vjezbe) {
    for (const s of v.stavke) {
      izl.push(s.zapis);
      if (s.parnjak) izl.push(s.parnjak);
      for (const d of s.dijelovi ?? []) izl.push(d);
    }
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
    for (const zapis of new Set(sviZapisi(lekcija))) {
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

  test(`lekcija ${lekcija.broj} ima svih pet vrsta vježbi`, () => {
    const vrste = lekcija.vjezbe.map((v) => v.vrsta);
    for (const traženo of ["slusaj-klikni", "kratko-dugo", "voz-slogova", "citaj-rijeci", "brzina"]) {
      assert.ok(vrste.includes(traženo as never), `nedostaje vježba ${traženo}`);
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
    const lose = lekcija.vjezbe
      .filter((v) => v.vrsta === "citaj-rijeci")
      .flatMap((v) => v.stavke.map((s) => s.zapis))
      .filter((z) => !zavrsetakOznacen(z));
    assert.deepEqual(lose, [], `riječ bez označenog kraja:\n${lose.join("\n")}`);
  });
}

test("lekcija tvrdi da ima zvuk samo ako snimci postoje", () => {
  let datoteke: string[] = [];
  try { datoteke = readdirSync(ZVUK); } catch { datoteke = []; }
  const krivo: string[] = [];
  for (const lekcija of LEKCIJE_CITANJA) {
    const treba = new Set(sviZapisi(lekcija).map((z) => `rijec-${Buffer.from(z).toString("hex")}.mp3`));
    const fali = [...treba].filter((d) => !datoteke.includes(d));
    if (lekcija.imaZvuk && fali.length) krivo.push(`lekcija ${lekcija.broj} tvrdi da ima zvuk, a fali ${fali.length} snimaka`);
    if (!lekcija.imaZvuk && !fali.length) krivo.push(`lekcija ${lekcija.broj} ima sve snimke, a ne tvrdi to`);
  }
  assert.deepEqual(krivo, [], krivo.join("\n"));
});
