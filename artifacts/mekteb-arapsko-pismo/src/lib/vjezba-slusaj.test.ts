// Nijedna vježba ne smije tražiti gradivo koje dijete još nije učilo.
//
// Vježba za lekciju četiri koristi dužine — „باب", „ماء". To je ispravno samo
// zato što novi program dužine uvodi u trećoj lekciji. Takvo pitanje se ne
// rješava gledanjem, nego mjerenjem, pa svaka vježba ovdje prolazi kroz
// program i mora stati u svoju lekciju.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rasporediZapise } from "./sufara-raspored";
import { normalizirajZapis } from "./sufara-zapis";
import { PROGRAM_OPISMENJAVANJA, PROGRAM_SUFARE } from "../data/sufara-program";

const PODACI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/vjezbe/slusaj/podaci");

interface Stavka { zapis?: unknown }
interface Vjezba {
  id?: string;
  program?: string;
  lekcija?: number;
  harfovi?: Stavka[];
  slogovi?: Stavka[];
  rijeci?: Stavka[];
}

const datoteke = readdirSync(PODACI).filter((n) => n.endsWith(".json"));

test("ima bar jedne vježbe za provjeru", () => {
  assert.ok(datoteke.length > 0, `nema JSON datoteka u ${PODACI}`);
});

for (const naziv of datoteke) {
  test(`vježba ${naziv} ne prehitava program`, () => {
    const v: Vjezba = JSON.parse(readFileSync(path.join(PODACI, naziv), "utf8"));
    assert.ok(typeof v.lekcija === "number", "vježba mora reći kojoj lekciji pripada");

    const program = v.program === "opismenjavanje" ? PROGRAM_OPISMENJAVANJA : PROGRAM_SUFARE;
    const zapisi = [...(v.harfovi ?? []), ...(v.slogovi ?? []), ...(v.rijeci ?? [])]
      .map((s) => s.zapis)
      .filter((z): z is string => typeof z === "string" && z.trim().length > 0);
    assert.ok(zapisi.length > 0, "vježba nema nijednog zapisa");

    const raspored = rasporediZapise(zapisi, program);
    const gdje = new Map(raspored.smjesteni.map((z) => [z.zapis, z.lekcija]));

    const prerano: string[] = [];
    for (const zapis of zapisi) {
      // Ista normalizacija kao u raspoređivaču. NFC nije dovoljan: on slaže
      // samoglasnik ispred tešdida, a Sufara i naš raspored obrnuto, pa bi se
      // svaka riječ s tešdidom tražila pogrešnim ključem.
      const kljuc = normalizirajZapis(zapis);
      const lekcija = gdje.get(kljuc);
      if (lekcija === undefined) {
        const razlog = raspored.nesmjesteni.find((n) => n.zapis === kljuc)?.razlog ?? "nije smješten";
        prerano.push(`${zapis} — ${razlog}`);
      } else if (lekcija > v.lekcija!) {
        prerano.push(`${zapis} — pripada lekciji ${lekcija}, a vježba je za ${v.lekcija}`);
      }
    }
    assert.deepEqual(prerano, [], `stavke traže gradivo koje dijete još nije učilo:\n${prerano.join("\n")}`);
  });
}
