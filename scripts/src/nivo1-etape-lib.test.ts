import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETAPE,
  IZVORNI_KVIZOVI,
  PITANJA_PO_ETAPI,
  PITANJA_PO_KRUNISANJU,
  bankaKljuc,
  buildPool,
  etapaZaRedoslijed,
  jeBodivo,
  odaberiZaEtapu,
  parseLegacy,
  podijeliKrunisanje,
  type LegacyPitanje,
  type ParsedPitanje,
} from "./nivo1-etape-lib";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("etapaZaRedoslijed grupiše lekcije u blokove po deset", () => {
  assert.equal(etapaZaRedoslijed(0), 1);
  assert.equal(etapaZaRedoslijed(9), 1);   // Žuri Mirza na pouku — 10. lekcija
  assert.equal(etapaZaRedoslijed(10), 2);
  assert.equal(etapaZaRedoslijed(19), 2);  // Dinski šarti — 20. lekcija
  assert.equal(etapaZaRedoslijed(59), 6);
  // Lekcije 61-64 nemaju svoj medaljon i idu samo u krunisanje.
  assert.equal(etapaZaRedoslijed(60), 7);
  assert.equal(etapaZaRedoslijed(63), 7);
});

test("etape pokrivaju lekcije 1-60 bez preklapanja", () => {
  assert.equal(ETAPE.length, 6);
  ETAPE.forEach((e, i) => {
    assert.equal(e.od, i * 10);
    assert.equal(e.do, i * 10 + 9);
    assert.equal(e.medaljonSlug, `nivo1-etapa-${i + 1}`);
    assert.equal(e.kvizSlug, `1-etapa-${i + 1}`);
  });
});

test("DA/NE pitanje postaje truefalse sa opcijama Da/Ne", () => {
  const p = parseLegacy({ question: "Imanskih šarta ima šest.", options: ["DA", "NE"], answer: "DA" }, "t");
  assert.ok(p);
  assert.equal(p.vrsta, "truefalse");
  assert.deepEqual(p.opcije, ["Da", "Ne"]);
  assert.equal(p.correctIndex, 0);
  assert.equal(p.legacy.answer, "Da");
});

test("checkbox postaje multiple sa svim tačnim indeksima", () => {
  const p = parseLegacy({
    type: "checkbox",
    question: "Koji su stubovi islama?",
    options: ["Šehadet", "Namaz", "Vjerovanje u meleke"],
    answer: "Šehadet|||Namaz",
  }, "t");
  assert.ok(p);
  assert.equal(p.vrsta, "multiple");
  assert.deepEqual(p.correctIndexes, [0, 1]);
  assert.equal(p.correctIndex, 0);
});

test("markWords pretvara indekse pogrešnih riječi u same riječi", () => {
  const p = parseLegacy({
    type: "markWords",
    question: "Pronađi greške:",
    text: "Na sedždi učimo: Subhane Rabbijel-'Ažim tri puta.",
    words: ["Na", "sedždi", "učimo:", "Subhane", "Rabbijel-'Ažim", "tri", "puta."],
    incorrect: [4],
  }, "t");
  assert.ok(p);
  assert.equal(p.vrsta, "markWords");
  assert.deepEqual(p.meta?.incorrect, ["Rabbijel-'Ažim"]);
});

test("reorder čuva 1-bazirani redoslijed", () => {
  const p = parseLegacy({
    type: "reorder",
    question: "Poredaj:",
    items: [{ text: "Sabah", order: 1 }, { text: "Podne", order: 2 }],
  }, "t");
  assert.ok(p);
  assert.equal(p.vrsta, "reorder");
  assert.deepEqual(p.correctOrder, [1, 2]);
});

test("odgovor s viškom riječi se jednoznačno veže za opciju", () => {
  const p = parseLegacy({
    type: "checkbox",
    question: "Koliko poslanika je Allah poslao ljudima?",
    options: ["25", "313", "124.000", "1000"],
    answer: "124.000 ukupno",
  }, "t");
  assert.ok(p);
  assert.equal(p.correctIndex, 2);
});

test("višeznačno prefiksno poklapanje se ne pogađa nasumično", () => {
  const p = parseLegacy({
    question: "Test",
    options: ["Da", "Dan", "Ne"],
    answer: "Danas",
  }, "t");
  assert.equal(p, null);
});

test("bankaKljuc razlikuje dragDrop varijante istog teksta", () => {
  const a = parseLegacy({
    type: "dragDrop", question: "Dopuni:", template: ["Imanskih šarta ima", "DROP"],
    words: ["6", "5"], correct: ["6"],
  }, "t")!;
  const b = parseLegacy({
    type: "dragDrop", question: "Dopuni:", template: ["Islamskih šarta ima", "DROP"],
    words: ["6", "5"], correct: ["5"],
  }, "t")!;
  assert.notEqual(bankaKljuc(a), bankaKljuc(b));
});

test("na ispitu se boduju samo single i truefalse pitanja", () => {
  assert.equal(jeBodivo({ vrsta: "single" }), true);
  assert.equal(jeBodivo({ vrsta: "truefalse" }), true);
  assert.equal(jeBodivo({ vrsta: "multiple" }), false);
  assert.equal(jeBodivo({ vrsta: "dragDrop" }), false);
});

test("odaberiZaEtapu daje prednost bodivim pitanjima i determinističan je", () => {
  const napravi = (i: number, vrsta: ParsedPitanje["vrsta"]) =>
    ({ ...parseLegacy({ question: `Pitanje ${i}`, options: ["a", "b"], answer: "a" }, "t")!, vrsta, etapa: 1 });
  const svi = [
    ...Array.from({ length: 30 }, (_, i) => napravi(i, "multiple")),
    ...Array.from({ length: 8 }, (_, i) => napravi(100 + i, "single")),
  ];
  const izbor = odaberiZaEtapu(svi, 1, 10);
  assert.equal(izbor.length, 10);
  assert.equal(izbor.filter(jeBodivo).length, 8, "sva bodiva pitanja moraju ući prije interaktivnih");
  assert.deepEqual(izbor.map((p) => p.pitanje), odaberiZaEtapu(svi, 1, 10).map((p) => p.pitanje));
});

// ── Provjera stvarnih podataka: seed + mapa + ispravke + nova pitanja ───────

type Kandidat = ParsedPitanje & { etapa: number };

function izgradiKandidate(): Kandidat[] {
  const seed = JSON.parse(
    gunzipSync(readFileSync(resolve(__dirname, "../content-seed.json.gz"))).toString("utf-8"),
  ) as { kvizovi: { slug: string; pitanja?: LegacyPitanje[] }[]; lekcije: { nivo: number; slug: string; redoslijed: number; kvizPitanja?: LegacyPitanje[] }[] };
  const poSlugu = new Map(seed.kvizovi.map((k) => [k.slug, k.pitanja ?? []]));
  const pool = buildPool(IZVORNI_KVIZOVI.map((slug) => ({ slug, pitanja: poSlugu.get(slug) ?? [] })));
  const mapa = JSON.parse(readFileSync(resolve(__dirname, "../data/nivo1-mapa-pitanja.json"), "utf-8")) as Record<string, number>;
  const ispravke = JSON.parse(readFileSync(resolve(__dirname, "../data/nivo1-lekcijska-ispravke.json"), "utf-8")) as Record<string, LegacyPitanje>;
  const nova = JSON.parse(readFileSync(resolve(__dirname, "../data/nivo1-nova-pitanja.json"), "utf-8")) as { pitanja: (LegacyPitanje & { etapa: number })[] };

  const kandidati: Kandidat[] = [];
  for (const p of pool) {
    const parsed = parseLegacy(p.pitanje, p.id);
    assert.ok(parsed, `pitanje ${p.id} se ne može parsirati`);
    assert.ok(mapa[p.id], `pitanje ${p.id} nema etapu u nivo1-mapa-pitanja.json`);
    kandidati.push({ ...parsed, etapa: mapa[p.id]! });
  }
  for (const l of seed.lekcije.filter((x) => x.nivo === 1 && x.redoslijed <= 63)) {
    (l.kvizPitanja ?? []).forEach((raw, idx) => {
      const parsed = parseLegacy(ispravke[`${l.slug}#${idx}`] ?? raw, `${l.slug}#${idx}`);
      if (parsed) kandidati.push({ ...parsed, etapa: etapaZaRedoslijed(l.redoslijed) });
    });
  }
  for (const n of nova.pitanja) {
    const parsed = parseLegacy(n, "novo");
    assert.ok(parsed, `novo pitanje se ne može parsirati: ${n.question}`);
    kandidati.push({ ...parsed, etapa: n.etapa });
  }
  const jedinstveni = new Map<string, Kandidat>();
  for (const k of kandidati) if (!jedinstveni.has(bankaKljuc(k))) jedinstveni.set(bankaKljuc(k), k);
  return [...jedinstveni.values()];
}

test("svih 6 etapa dobije puna 100 pitanja iz svojih lekcija", () => {
  const svi = izgradiKandidate();
  for (const e of ETAPE) {
    const izbor = odaberiZaEtapu(svi, e.redni);
    assert.equal(izbor.length, PITANJA_PO_ETAPI, `etapa ${e.redni} ima ${izbor.length} pitanja`);
    assert.ok(izbor.every((p) => p.etapa === e.redni), `etapa ${e.redni} sadrži pitanje iz drugog bloka lekcija`);
    assert.ok(
      izbor.filter(jeBodivo).length >= 70,
      `etapa ${e.redni} ima premalo bodivih pitanja (${izbor.filter(jeBodivo).length})`,
    );
    assert.equal(new Set(izbor.map(bankaKljuc)).size, izbor.length, `etapa ${e.redni} ima duplikate`);
  }
});

test("krunisanje daje tri kviza od po 100 različitih bodivih pitanja iz cijelog nivoa", () => {
  const svi = izgradiKandidate();
  const { a, b, c } = podijeliKrunisanje(svi);
  for (const [ime, varijanta] of Object.entries({ a, b, c })) {
    assert.equal(varijanta.length, PITANJA_PO_KRUNISANJU, `varijanta ${ime}`);
    assert.ok(varijanta.every(jeBodivo), `varijanta ${ime} sadrži pitanje koje ispit ne može bodovati`);
    // Svaka varijanta pokriva sve blokove lekcija, uključujući lekcije 61-64.
    assert.equal(new Set(varijanta.map((p) => p.etapa)).size, 7, `varijanta ${ime} ne pokriva sve blokove`);
  }
  const sve = [...a, ...b, ...c];
  assert.equal(new Set(sve.map(bankaKljuc)).size, sve.length, "varijante se preklapaju");
});
