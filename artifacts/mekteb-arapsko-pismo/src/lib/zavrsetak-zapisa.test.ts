// Svaki zapis mora reći kako se završava.
//
// Google izgovara arapski tačno onako kako je napisano, a ono što nije
// napisano — pogađa. Imenici doda padežni nastavak („مال" pročita kao
// „malun"), glagolu odsiječe zadnji vokal („كان" pročita kao „kan"). Dijete
// tada vidi jedno, a čuje drugo. Ista zamka je ranije izbacila „ماء" iz
// zbirke preuzetih snimaka.
//
// Zato zadnji harf svakog zapisa nosi vokal, tenvin, sukun ili tešdid. Dvije
// iznimke nisu iznimke nego pravopis: harf produženja na kraju („مَا") znak ne
// nosi, nego ga nosi harf ispred njega, a tešdid na kraju („أُمّ") već znači
// pauzalni izgovor i nikad uz sebe ne prima sukun.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zavrsetakOznacen, normalizirajZapis } from "./sufara-zapis";

const PODACI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/vjezbe/slusaj/podaci");

test("označen završetak se prepoznaje", () => {
  for (const z of ["بَ", "مَالْ", "كَانَ", "مَا", "لَا", "أُمّ", "رَبَّ", "أَجْرًا", "يَوْمْ", "آ"]) {
    assert.ok(zavrsetakOznacen(z), `${z} ima označen završetak, a prijavljeno je suprotno`);
  }
});

test("neoznačen završetak se hvata", () => {
  for (const z of ["مال", "كان", "باب", "ما", "لا", "يَوْم", "أَمام", "نَمِر"]) {
    assert.ok(!zavrsetakOznacen(z), `${z} nema označen završetak, a prošao je`);
  }
});

const datoteke = readdirSync(PODACI).filter((n) => n.endsWith(".json"));

interface Stavka { zapis?: unknown }
interface Vjezba { harfovi?: Stavka[]; slogovi?: Stavka[]; rijeci?: Stavka[] }

function zapisiVjezbe(naziv: string): string[] {
  const v: Vjezba = JSON.parse(readFileSync(path.join(PODACI, naziv), "utf8"));
  return [...(v.harfovi ?? []), ...(v.slogovi ?? []), ...(v.rijeci ?? [])]
    .map((s) => s.zapis)
    .filter((z): z is string => typeof z === "string" && z.trim().length > 0);
}

for (const naziv of datoteke) {
  test(`vježba ${naziv} označava završetak svakog zapisa`, () => {
    const lose = zapisiVjezbe(naziv).filter((z) => !zavrsetakOznacen(z));
    assert.deepEqual(lose, [], `zadnji harf nema vokal, tenvin, sukun ni tešdid:\n${lose.join("\n")}`);
  });
}

test("dva zapisa ne mogu dijeliti istu datoteku sa zvukom", () => {
  // Ime snimka se sastavlja od zapisa. Dok se skraćivalo na osam bajtova,
  // „أَمَلْ" i „أَمَامْ" su dobijali isto ime i dijelili bi jedan snimak.
  const po = new Map<string, string[]>();
  for (const naziv of datoteke) {
    for (const zapis of zapisiVjezbe(naziv)) {
      const kljuc = Buffer.from(normalizirajZapis(zapis)).toString("hex");
      po.set(kljuc, [...new Set([...(po.get(kljuc) ?? []), zapis])]);
    }
  }
  const sudari = [...po.values()].filter((z) => z.length > 1);
  assert.deepEqual(sudari, [], `isti ključ za različite zapise: ${JSON.stringify(sudari)}`);
});
