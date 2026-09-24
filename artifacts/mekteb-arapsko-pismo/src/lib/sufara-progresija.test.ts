// Da lekcija ponavljanja nikad više ne izgleda kao druga lekcija.
//
// Banka riječi za čitanje pravljena je lekcija po lekcija, od slova koja ta
// lekcija uvodi. Niko nije pazio šta se nosi iz ranijih, pa je sedamnaesta —
// zadnja i po namjeni ponavljanje svega — bila trideset golih trosložnih
// glagola s fethom: nula sukuna, nula tešdida, nula tenvina.
//
// Ovdje se to mjeri. Prag vrijedi za lekcije koje su usklađene s novim
// standardom; ostale su popisane kao dug, da se vidi šta preostaje.
import assert from "node:assert/strict";
import test from "node:test";
import { READING_WORDS_BY_LESSON } from "../data/reading-word-bank";
import { LESSONS } from "../data/lessons";

const HARF = /[ء-ي]/g;
const SUKUN = "ْ";
const TESDID = "ّ";
const KESRA = "ِ";
const DAMMA = "ُ";
const TENVIN = /[ً-ٍ]/;

/** Lekcije dovedene na novi standard. Dodaj lekciju tek kad ga zaista ispuni. */
const USKLAĐENE = [17];

/** Lekcija u kojoj se znak uvodi; prije nje se ne traži. */
const UVODI_SE = { sukun: 7, tesdid: 8, tenvin: 9 };

/** Najmanji udio riječi s pojedinim elementom u usklađenoj lekciji. */
const PRAG = { sukun: 25, tesdid: 15, tenvin: 25, kesra: 20, damma: 20 };

/**
 * Ta-marbuta i elif-maksura se ni u jednoj lekciji ne uvode, a ove tri riječi
 * ih koriste. Zatečeno stanje — popisano da se ne umnoži, ne da se odobri.
 */
const ZATEČENI_PROPUSTI = ["كَلِمَةٌ", "هُدًى", "هَدَى"];

const udio = (rijeci: readonly string[], ima: (w: string) => boolean) =>
  Math.round((rijeci.filter(ima).length / rijeci.length) * 100);

test("nijedna riječ ne koristi harf koji dotad nije uveden", () => {
  const uvedeni = new Set(["ء", "آ", "أ", "إ", "ئ", "ؤ", "ا"]);
  const nova: string[] = [];
  for (const lekcija of [...LESSONS].sort((a, b) => a.orderNum - b.orderNum)) {
    for (const harf of lekcija.letters) for (const z of harf.match(HARF) ?? []) uvedeni.add(z);
    for (const h of lekcija.letterData ?? []) for (const z of (h.arabic ?? "").match(HARF) ?? []) uvedeni.add(z);
    for (const rijec of READING_WORDS_BY_LESSON[lekcija.id] ?? []) {
      if ((rijec.match(HARF) ?? []).some((z) => !uvedeni.has(z)) && !ZATEČENI_PROPUSTI.includes(rijec)) {
        nova.push(`L${lekcija.id}: ${rijec}`);
      }
    }
  }
  assert.deepEqual(nova, [], `nove riječi s neuvedenim harfom:\n${nova.join("\n")}`);
});

for (const id of USKLAĐENE) {
  test(`lekcija ${id} zadržava sve što je dotad naučeno`, () => {
    const rijeci = READING_WORDS_BY_LESSON[id];
    assert.ok(rijeci, `lekcija ${id} nema banku riječi`);
    const izmjereno = {
      sukun: udio(rijeci, (w) => w.includes(SUKUN)),
      tesdid: udio(rijeci, (w) => w.includes(TESDID)),
      tenvin: udio(rijeci, (w) => TENVIN.test(w)),
      kesra: udio(rijeci, (w) => w.includes(KESRA)),
      damma: udio(rijeci, (w) => w.includes(DAMMA)),
    };
    for (const [element, prag] of Object.entries(PRAG)) {
      const uvodi = UVODI_SE[element as keyof typeof UVODI_SE];
      if (uvodi !== undefined && id < uvodi) continue;
      const sad = izmjereno[element as keyof typeof izmjereno];
      assert.ok(sad >= prag, `lekcija ${id}: ${element} je na ${sad}%, traži se najmanje ${prag}%`);
    }
  });
}

test("lekcija 17 ne uvodi nijednu riječ koju dijete nije već vidjelo", () => {
  const ranije = new Set<string>();
  for (const [id, rijeci] of Object.entries(READING_WORDS_BY_LESSON)) {
    if (Number(id) < 17) for (const w of rijeci) ranije.add(w);
  }
  for (const lekcija of LESSONS) {
    for (const vjezba of lekcija.exercises ?? []) {
      for (const stavka of (vjezba as { items?: { show?: unknown }[] }).items ?? []) {
        if (typeof stavka?.show === "string") ranije.add(stavka.show);
      }
    }
  }
  const nepoznate = READING_WORDS_BY_LESSON[17].filter((w) => !ranije.has(w));
  assert.deepEqual(nepoznate, [], `lekcija ponavljanja uvodi nove riječi: ${nepoznate.join(" ")}`);
});
