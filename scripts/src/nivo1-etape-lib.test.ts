import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ETAPE_PO_NIVOU,
  IZVORNI_KVIZOVI_PO_NIVOU,
  etapeZaNivo,
  lekcijskaPitanja,
  PITANJA_PO_ETAPI,
  PITANJA_PO_KRUNISANJU,
  MAX_ETAPA,
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
  assert.equal(etapaZaRedoslijed(-10), 1);  // uvodna lekcija Nivoa 2
  assert.equal(etapaZaRedoslijed(0), 1);
  assert.equal(etapaZaRedoslijed(9), 1);   // Žuri Mirza na pouku — 10. lekcija
  assert.equal(etapaZaRedoslijed(10), 2);
  assert.equal(etapaZaRedoslijed(19), 2);  // Dinski šarti — 20. lekcija
  assert.equal(etapaZaRedoslijed(59), 6);
  assert.equal(etapaZaRedoslijed(60), 7);
  assert.equal(etapaZaRedoslijed(67), 7);
  assert.equal(etapaZaRedoslijed(90), 10);  // Nivo 3 ide do desete etape
  assert.equal(etapaZaRedoslijed(99), 10);
});

test("etape ne preklapaju blokove lekcija ni na jednom nivou", () => {
  // Nivoi 1 i 2 imaju do 70 lekcija, pa sedam etapa; Nivo 3 ima 100 lekcija, dakle deset.
  const ocekivanoEtapa: Record<number, number> = { 1: 7, 2: 7, 3: 10 };
  // `redoslijed` posljednje lekcije nivoa (0-baziran).
  const zadnjaLekcija: Record<number, number> = { 1: 63, 2: 67, 3: 99 };
  for (const nivo of [1, 2, 3]) {
    const etape = etapeZaNivo(nivo);
    assert.equal(etape.length, ocekivanoEtapa[nivo], `nivo ${nivo}`);
    assert.ok(etape.length <= MAX_ETAPA, `nivo ${nivo} prelazi ${MAX_ETAPA} etapa`);
    etape.forEach((e, i) => {
      assert.equal(e.redni, i + 1);
      assert.equal(e.od, i * 10);
      assert.ok(e.do >= e.od, `etapa ${e.redni} nivoa ${nivo} ima prazan raspon`);
      assert.equal(e.medaljonSlug, `nivo${nivo}-etapa-${i + 1}`);
      assert.equal(e.kvizSlug, `${nivo}-etapa-${i + 1}`);
    });
    // Posljednja etapa se zaustavlja na stvarnom broju lekcija nivoa.
    assert.equal(etape.at(-1)!.do, zadnjaLekcija[nivo], `nivo ${nivo}`);
  }
  assert.equal(ETAPE_PO_NIVOU[1]!.length, 7);
});

test("lekcijskaPitanja prihvata oba oblika ugrađenog kviza lekcije", () => {
  const niz = lekcijskaPitanja([{ question: "A?", options: ["x", "y"], answer: "x" }]);
  assert.equal(niz.length, 1);
  assert.equal(niz[0]!.answer, "x");

  const string = lekcijskaPitanja(JSON.stringify([
    { pitanje: "Koliko ajeta ima sura El-Ma'un?", odgovori: ["3", "5", "7", "10"], tacanOdgovor: 2 },
  ]));
  assert.equal(string.length, 1);
  assert.equal(string[0]!.question, "Koliko ajeta ima sura El-Ma'un?");
  assert.equal(string[0]!.answer, "7");

  assert.deepEqual(lekcijskaPitanja(null), []);
  assert.deepEqual(lekcijskaPitanja("nije json"), []);
  // Nevažeći indeks tačnog odgovora se preskače.
  assert.deepEqual(lekcijskaPitanja(JSON.stringify([{ pitanje: "X", odgovori: ["a"], tacanOdgovor: 5 }])), []);
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

test("odaberiZaEtapu bira samo pitanja svoje etape i determinističan je", () => {
  const napravi = (i: number, etapa: number) =>
    ({ ...parseLegacy({ question: `Pitanje ${i}`, options: ["a", "b"], answer: "a" }, "t")!, etapa });
  const svi = [
    ...Array.from({ length: 30 }, (_, i) => napravi(i, 1)),
    ...Array.from({ length: 30 }, (_, i) => napravi(100 + i, 2)),
  ];
  const izbor = odaberiZaEtapu(svi, 1, 10);
  assert.equal(izbor.length, 10);
  assert.ok(izbor.every((p) => p.etapa === 1));
  assert.deepEqual(izbor.map((p) => p.pitanje), odaberiZaEtapu(svi, 1, 10).map((p) => p.pitanje));
});

// ── Provjera stvarnih podataka: seed + mapa + ispravke + nova pitanja ───────

type Kandidat = ParsedPitanje & { etapa: number };

function izgradiKandidate(nivo: number): Kandidat[] {
  const seed = JSON.parse(
    gunzipSync(readFileSync(resolve(__dirname, "../content-seed.json.gz"))).toString("utf-8"),
  ) as { kvizovi: { slug: string; pitanja?: LegacyPitanje[] }[]; lekcije: { nivo: number; slug: string; redoslijed: number; kvizPitanja?: LegacyPitanje[] }[] };
  const poSlugu = new Map(seed.kvizovi.map((k) => [k.slug, k.pitanja ?? []]));
  const pool = buildPool(IZVORNI_KVIZOVI_PO_NIVOU[nivo]!.map((slug) => ({ slug, pitanja: poSlugu.get(slug) ?? [] })));
  const citaj = <T,>(ime: string, ako: T): T => {
    try { return JSON.parse(readFileSync(resolve(__dirname, `../data/${ime}`), "utf-8")) as T; } catch { return ako; }
  };
  const mapa = citaj<Record<string, number>>(`nivo${nivo}-mapa-pitanja.json`, {});
  const ispravke = citaj<Record<string, LegacyPitanje>>(`nivo${nivo}-lekcijska-ispravke.json`, {});
  const kvizIspravke = citaj<Record<string, LegacyPitanje>>(`nivo${nivo}-kviz-ispravke.json`, {});
  const nova = citaj<{ pitanja: (LegacyPitanje & { etapa: number })[] }>(`nivo${nivo}-nova-pitanja.json`, { pitanja: [] });

  const kandidati: Kandidat[] = [];
  for (const p of pool) {
    const parsed = parseLegacy(kvizIspravke[p.id] ?? p.pitanje, p.id);
    assert.ok(parsed, `pitanje ${p.id} se ne može parsirati`);
    assert.ok(mapa[p.id] !== undefined, `pitanje ${p.id} nema etapu u nivo${nivo}-mapa-pitanja.json`);
    kandidati.push({ ...parsed, etapa: mapa[p.id]! });
  }
  for (const l of seed.lekcije.filter((x) => x.nivo === nivo)) {
    lekcijskaPitanja(l.kvizPitanja).forEach((raw, idx) => {
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

for (const nivo of [1, 2, 3]) {
  test(`Nivo ${nivo}: svaka etapa dobije pitanja samo iz svojih lekcija, bez duplikata`, () => {
    const svi = izgradiKandidate(nivo);
    for (const e of etapeZaNivo(nivo)) {
      const izbor = odaberiZaEtapu(svi, e.redni);
      assert.ok(izbor.length > 0, `nivo ${nivo}, etapa ${e.redni} je prazna`);
      assert.ok(izbor.length <= PITANJA_PO_ETAPI, `nivo ${nivo}, etapa ${e.redni} ima ${izbor.length} pitanja`);
      assert.ok(izbor.every((p) => p.etapa === e.redni), `nivo ${nivo}, etapa ${e.redni} sadrži pitanje iz drugog bloka`);
      assert.equal(new Set(izbor.map(bankaKljuc)).size, izbor.length, `nivo ${nivo}, etapa ${e.redni} ima duplikate`);
    }
  });

  test(`Nivo ${nivo}: krunisanje daje tri kviza od po 100 različitih bodivih pitanja`, () => {
    const svi = izgradiKandidate(nivo);
    const { a, b, c } = podijeliKrunisanje(svi);
    for (const [ime, varijanta] of Object.entries({ a, b, c })) {
      assert.equal(varijanta.length, PITANJA_PO_KRUNISANJU, `nivo ${nivo}, varijanta ${ime}`);
      assert.ok(varijanta.every(jeBodivo), `nivo ${nivo}, varijanta ${ime} ima pitanje koje ispit ne može bodovati`);
      assert.ok(new Set(varijanta.map((p) => p.etapa)).size >= 6, `nivo ${nivo}, varijanta ${ime} ne pokriva dovoljno blokova`);
    }
    const sve = [...a, ...b, ...c];
    assert.equal(new Set(sve.map(bankaKljuc)).size, sve.length, `nivo ${nivo}: varijante se preklapaju`);
  });
}

test("Nivo 1: svih sedam etapa dobije po 100 pitanja osim posljednje (samo četiri lekcije)", () => {
  const svi = izgradiKandidate(1);
  const duzine = etapeZaNivo(1).map((e) => odaberiZaEtapu(svi, e.redni).length);
  assert.deepEqual(duzine.slice(0, 6), Array(6).fill(PITANJA_PO_ETAPI));
  assert.ok(duzine[6]! >= 80, `etapa 7 ima samo ${duzine[6]} pitanja`);
});

test("Nivo 2: svih sedam etapa dobije po 100 pitanja", () => {
  const svi = izgradiKandidate(2);
  for (const e of etapeZaNivo(2)) {
    assert.equal(odaberiZaEtapu(svi, e.redni).length, PITANJA_PO_ETAPI, `etapa ${e.redni}`);
  }
});

test("Nivo 3: svih deset etapa dobije po 100 pitanja", () => {
  const svi = izgradiKandidate(3);
  for (const e of etapeZaNivo(3)) {
    assert.equal(odaberiZaEtapu(svi, e.redni).length, PITANJA_PO_ETAPI, `etapa ${e.redni}`);
  }
});
