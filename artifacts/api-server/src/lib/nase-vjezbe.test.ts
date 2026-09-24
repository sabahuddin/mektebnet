import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  NASE_VJEZBE_PREFIKSI,
  TIPOVI_VJEZBI,
  citajPodatke,
  getVjezba,
  isValidTip,
  isValidVjezbaId,
  jeNasaVjezba,
  jeziciPrijevoda,
  listSveVjezbe,
  listVjezbe,
  obrisiVjezbu,
  primijeniJezik,
  slobodanId,
  spremiVjezbu,
  validirajPodatke,
  vjezbaMarker,
  vjezbaUrl,
} from "./nase-vjezbe.js";

test("poznate su tačno dvije vrste naših vježbi", () => {
  assert.deepEqual(Object.keys(TIPOVI_VJEZBI).sort(), ["napamet", "osmosmjerka", "popuni", "poredak", "razvrstaj", "spoji", "upisi"]);
  for (const tip of Object.keys(TIPOVI_VJEZBI)) assert.equal(isValidTip(tip), true, tip);
  for (const nije of ["", "h5p", "../tajna", 7, null]) {
    assert.equal(isValidTip(nije as unknown), false, String(nije));
  }
});

test("ID vježbe prima samo mala slova, cifre i crticu", () => {
  for (const ok of ["abdest", "ramazan", "ramazan-01", "a1"]) {
    assert.equal(isValidVjezbaId(ok), true, ok);
  }
  for (const nok of ["", "Abdest", "../tajna", "podaci/abdest", "abdest.json", "-crtica", "a".repeat(65), 7, null]) {
    assert.equal(isValidVjezbaId(nok as unknown), false, String(nok));
  }
});

test("URL i marker vježbe ostaju na našoj domeni", () => {
  assert.equal(
    vjezbaUrl("popuni", "abdest"),
    "/vjezbe/popuni/popuni.html?podaci=/api/nase-vjezbe/podaci/popuni/abdest.json",
  );
  assert.equal(
    vjezbaUrl("osmosmjerka", "ramazan"),
    "/vjezbe/osmosmjerka/osmosmjerka.html?podaci=/api/nase-vjezbe/podaci/osmosmjerka/ramazan.json",
  );
  assert.equal(vjezbaMarker("popuni", "abdest"), "popuni:abdest");
  assert.throws(() => vjezbaUrl("popuni", "../tajna"), /Nevažeći ID/);
  assert.throws(() => vjezbaUrl("nepostojeci", "abdest"), /Nepoznata vrsta/);
});

test("naša vježba se prepoznaje po adresi, vanjski embed ne", () => {
  assert.equal(NASE_VJEZBE_PREFIKSI.length, Object.keys(TIPOVI_VJEZBI).length);
  assert.equal(jeNasaVjezba(vjezbaUrl("popuni", "abdest")), true);
  assert.equal(jeNasaVjezba(vjezbaUrl("osmosmjerka", "ramazan")), true);
  assert.equal(jeNasaVjezba("https://learningapps.org/watch?app=123"), false);
  assert.equal(jeNasaVjezba("/vjezbe/etapa-lekcije-1-10.html"), false);
  assert.equal(jeNasaVjezba(null), false);
});

test("spisak vježbi se čita iz javnog foldera, po vrstama", async () => {
  const osmosmjerke = await listVjezbe("osmosmjerka");
  assert.ok(osmosmjerke.length >= 2, "očekujemo bar dvije osmosmjerke");
  const popuni = await listVjezbe("popuni");
  assert.ok(popuni.length >= 2, "očekujemo bar dvije vježbe popuni prazninu");

  for (const stavka of [...osmosmjerke, ...popuni]) {
    assert.equal(isValidVjezbaId(stavka.id), true, stavka.id);
    assert.ok(stavka.naslov.length > 0, `${stavka.id}: naslov`);
    assert.ok(stavka.detalj.length > 0, `${stavka.id}: detalj`);
    assert.equal(stavka.url, vjezbaUrl(stavka.tip, stavka.id));
  }
  const naslovi = popuni.map(s => s.naslov);
  assert.deepEqual(naslovi, [...naslovi].sort((a, b) => a.localeCompare(b, "bs")));
  assert.deepEqual(await listVjezbe("nepostojeci"), []);
});

test("vježba popuni prazninu ima izbrojane praznine u detalju", async () => {
  const abdest = await getVjezba("popuni", "abdest");
  assert.ok(abdest, "abdest.json mora postojati");
  assert.match(abdest!.naslov, /abdest/i, abdest!.naslov);
  assert.match(abdest!.detalj, /^\d+ praznin/, abdest!.detalj);
  const ramazan = await getVjezba("popuni", "ramazan");
  assert.match(ramazan!.detalj, /^\d+ praznin\S* · \d+ dodatn\S* riječ\S*/, ramazan!.detalj);
  assert.equal(await getVjezba("popuni", "ne-postoji"), null);
  assert.equal(await getVjezba("popuni", "../../../etc/passwd"), null);
});

test("jedan poziv vraća sve vrste sa svojim vježbama", async () => {
  const tipovi = await listSveVjezbe();
  assert.equal(tipovi.length, Object.keys(TIPOVI_VJEZBI).length);
  for (const tv of tipovi) {
    assert.ok(tv.naziv.length > 0, tv.tip);
    assert.ok(tv.vjezbe.every(v => v.tip === tv.tip), `${tv.tip}: vježbe nose svoju vrstu`);
  }
});

test("provjera sadržaja odbija nepotpune vježbe i prihvata ispravne", () => {
  assert.match(String(validirajPodatke("popuni", { naslov: "" })), /naslov/i);
  assert.match(String(validirajPodatke("popuni", { naslov: "Bez praznina", tekst: "Nema ništa." })), /praznin/i);
  assert.equal(validirajPodatke("popuni", { naslov: "Dobra", tekst: "Uzimamo {abdest}." }), null);

  assert.match(String(validirajPodatke("osmosmjerka", { naslov: "Malo riječi", rijeci: [{ rijec: "ezan" }] })), /dvije riječi/i);
  assert.match(String(validirajPodatke("osmosmjerka", {
    naslov: "Bez opisa", prikaz: "opisi",
    rijeci: [{ rijec: "ezan" }, { rijec: "namaz" }],
  })), /opis/i);
  assert.equal(validirajPodatke("osmosmjerka", {
    naslov: "Dobra", rijeci: [{ rijec: "ezan", opis: "Poziv na namaz." }, { rijec: "namaz", opis: "Molitva." }],
  }), null);
  assert.match(String(validirajPodatke("nepostojeci", { naslov: "X" })), /vrsta/i);
});

test("vježba iz panela se upiše, pročita, prekrije ugrađenu i obriše", async () => {
  const id = `test-panel-${Date.now()}`.slice(0, 60).toLowerCase();
  try {
    assert.equal(await slobodanId("popuni", id), true);
    const spremljeno = await spremiVjezbu("popuni", id, {
      naslov: "Test iz panela",
      tekst: "Prije namaza uzimamo {abdest}.",
      dodatne: ["sanke"],
    }, null);
    assert.equal(spremljeno.izvor, "vlastita");
    assert.match(spremljeno.detalj, /^1 praznina/);
    assert.equal(await slobodanId("popuni", id), false);

    const procitano = await citajPodatke("popuni", id);
    assert.equal(procitano?.izvor, "vlastita");
    assert.equal((procitano?.podaci as { id?: string }).id, id, "sadržaj nosi svoju oznaku");

    const uSpisku = (await listVjezbe("popuni")).find(v => v.id === id);
    assert.ok(uSpisku, "vježba je u spisku");
  } finally {
    await obrisiVjezbu("popuni", id);
  }
  assert.equal(await citajPodatke("popuni", id), null, "poslije brisanja je nema");
});

test("izmjena ugrađene vježbe prekrije datoteku, brisanje je vrati", async () => {
  const ugradjena = await citajPodatke("popuni", "abdest");
  assert.equal(ugradjena?.izvor, "ugradjena");
  try {
    await spremiVjezbu("popuni", "abdest", {
      naslov: "Izmijenjeni abdest",
      tekst: "Samo {jedna} praznina.",
    }, null);
    const poslije = await citajPodatke("popuni", "abdest");
    assert.equal(poslije?.izvor, "vlastita");
    assert.equal((poslije?.podaci as { naslov?: string }).naslov, "Izmijenjeni abdest");
  } finally {
    await obrisiVjezbu("popuni", "abdest");
  }
  const vraceno = await citajPodatke("popuni", "abdest");
  assert.equal(vraceno?.izvor, "ugradjena", "brisanje vraća ugrađenu verziju");
  assert.equal((vraceno?.podaci as { naslov?: string }).naslov, (ugradjena?.podaci as { naslov?: string }).naslov);
});

test("poredak prima samo spisak razlicitih stavki", async () => {
  const dobra = { naslov: "Koraci", stavke: ["Prvo", "Drugo", "Treće"] };
  assert.equal(validirajPodatke("poredak", dobra), null);
  assert.match(String(validirajPodatke("poredak", { naslov: "X", stavke: ["Samo jedna"] })), /bar dvije stavke/);
  assert.match(String(validirajPodatke("poredak", { naslov: "X", stavke: ["Ista", "ista"] })), /ne smiju biti iste/);
  assert.match(String(validirajPodatke("poredak", { naslov: "X", stavke: ["Prvo", "  "] })), /prazna/);
  assert.match(String(validirajPodatke("poredak", { naslov: "X", stavke: "Prvo" })), /bar dvije stavke/);

  const spisak = await listVjezbe("poredak");
  assert.ok(spisak.length >= 2, "očekujemo bar dvije ugrađene vježbe poretka");
  for (const stavka of spisak) {
    assert.equal(isValidVjezbaId(stavka.id), true, stavka.id);
    assert.match(stavka.detalj, /stavk/, `${stavka.id}: detalj`);
    assert.equal(stavka.url, vjezbaUrl("poredak", stavka.id));
  }

  const koraci = await getVjezba("poredak", "abdest-koraci");
  assert.ok(koraci, "abdest-koraci.json mora postojati");
  assert.equal(koraci?.detalj, "9 stavki");
});

test("razvrstavanje trazi dvije do pet kutija i razlicite stavke", async () => {
  const dobra = {
    naslov: "Mjeseci",
    kategorije: [
      { naziv: "Hidžretski", stavke: ["muharrem", "safer"] },
      { naziv: "Po Suncu", stavke: ["januar"] },
    ],
  };
  assert.equal(validirajPodatke("razvrstaj", dobra), null);
  assert.match(String(validirajPodatke("razvrstaj", {
    naslov: "X", kategorije: [{ naziv: "Jedina", stavke: ["a"] }],
  })), /bar dvije kutije/);
  assert.match(String(validirajPodatke("razvrstaj", {
    naslov: "X",
    kategorije: [1, 2, 3, 4, 5, 6].map(n => ({ naziv: `K${n}`, stavke: [`s${n}`] })),
  })), /najviše pet kutija/);
  assert.match(String(validirajPodatke("razvrstaj", {
    naslov: "X", kategorije: [{ naziv: "", stavke: ["a"] }, { naziv: "B", stavke: ["b"] }],
  })), /naziv/);
  assert.match(String(validirajPodatke("razvrstaj", {
    naslov: "X", kategorije: [{ naziv: "A", stavke: [] }, { naziv: "B", stavke: ["b"] }],
  })), /nema nijednu stavku/);
  assert.match(String(validirajPodatke("razvrstaj", {
    naslov: "X", kategorije: [{ naziv: "A", stavke: ["ista"] }, { naziv: "B", stavke: ["Ista"] }],
  })), /u dvije kutije/);

  const spisak = await listVjezbe("razvrstaj");
  assert.ok(spisak.length >= 2, "očekujemo bar dvije ugrađene vježbe razvrstavanja");
  for (const stavka of spisak) {
    assert.equal(stavka.url, vjezbaUrl("razvrstaj", stavka.id));
    assert.match(stavka.detalj, /kutij\S* · \d+ stavk/, `${stavka.id}: detalj`);
  }
  const mjeseci = await getVjezba("razvrstaj", "mjeseci");
  assert.equal(mjeseci?.detalj, "2 kutije · 10 stavki");
});

test("spajanje parova trazi dva do dvanaest razlicitih parova", async () => {
  const dobra = {
    naslov: "Pojmovi",
    parovi: [
      { lijevo: "ezan", desno: "poziv na namaz" },
      { lijevo: "sehur", desno: "obrok prije zore" },
    ],
  };
  assert.equal(validirajPodatke("spoji", dobra), null);
  assert.match(String(validirajPodatke("spoji", {
    naslov: "X", parovi: [{ lijevo: "a", desno: "b" }],
  })), /bar dva para/);
  assert.match(String(validirajPodatke("spoji", {
    naslov: "X",
    parovi: Array.from({ length: 13 }, (_, i) => ({ lijevo: `l${i}`, desno: `d${i}` })),
  })), /najviše dvanaest/);
  assert.match(String(validirajPodatke("spoji", {
    naslov: "X", parovi: [{ lijevo: "a", desno: "" }, { lijevo: "b", desno: "d" }],
  })), /i lijevu i desnu/);
  assert.match(String(validirajPodatke("spoji", {
    naslov: "X", parovi: [{ lijevo: "ista", desno: "d1" }, { lijevo: "Ista", desno: "d2" }],
  })), /Pojam .* se ponavlja/);
  assert.match(String(validirajPodatke("spoji", {
    naslov: "X", parovi: [{ lijevo: "l1", desno: "isti" }, { lijevo: "l2", desno: "Isti" }],
  })), /Odgovor .* se ponavlja/);

  const spisak = await listVjezbe("spoji");
  assert.ok(spisak.length >= 2, "očekujemo bar dvije ugrađene vježbe spajanja");
  for (const stavka of spisak) {
    assert.equal(stavka.url, vjezbaUrl("spoji", stavka.id));
    assert.match(stavka.detalj, /\d+ par/, `${stavka.id}: detalj`);
  }
  const pojmovi = await getVjezba("spoji", "pojmovi");
  assert.equal(pojmovi?.detalj, "6 parova");
});

test("upisivanje odgovora trazi pitanje i odgovor za svaki red", async () => {
  const dobra = {
    naslov: "Pitanja",
    pitanja: [{ pitanje: "Kako se zove poziv na namaz?", odgovor: "ezan", prihvati: ["Ezan"], pomoc: "S munare." }],
  };
  assert.equal(validirajPodatke("upisi", dobra), null);
  assert.match(String(validirajPodatke("upisi", { naslov: "X", pitanja: [] })), /bar jedno pitanje/);
  assert.match(String(validirajPodatke("upisi", {
    naslov: "X", pitanja: Array.from({ length: 21 }, (_, i) => ({ pitanje: `p${i}`, odgovor: `o${i}` })),
  })), /najviše dvadeset/);
  assert.match(String(validirajPodatke("upisi", {
    naslov: "X", pitanja: [{ pitanje: "", odgovor: "a" }],
  })), /tekst pitanja/);
  assert.match(String(validirajPodatke("upisi", {
    naslov: "X", pitanja: [{ pitanje: "Bez odgovora?", odgovor: "  " }],
  })), /nema odgovor/);
  assert.match(String(validirajPodatke("upisi", {
    naslov: "X", pitanja: [{ pitanje: "P", odgovor: "o", prihvati: "nije spisak" }],
  })), /spisak riječi/);

  const spisak = await listVjezbe("upisi");
  assert.ok(spisak.length >= 2, "očekujemo bar dvije ugrađene vježbe upisivanja");
  for (const stavka of spisak) {
    assert.equal(stavka.url, vjezbaUrl("upisi", stavka.id));
    assert.match(stavka.detalj, /\d+ pitanj/, `${stavka.id}: detalj`);
  }
  const pojmovi = await getVjezba("upisi", "pojmovi");
  assert.equal(pojmovi?.detalj, "4 pitanja");
});

test("prijevod mijenja samo tekst, nikad postavke vježbe", () => {
  const izvornik = {
    id: "ramazan-01",
    naslov: "Ramazan",
    tezina: "srednje",
    prikaz: "opisi",
    rijeci: [{ rijec: "post", opis: "Ne jedemo i ne pijemo." }],
    prijevodi: {
      // Prijevod pokušava promijeniti i ID i težinu — mora biti ignorisan.
      de: {
        id: "podmetnuto",
        tezina: "tesko",
        naslov: "Ramadan",
        rijeci: [{ rijec: "Fasten", opis: "Wir essen und trinken nicht." }],
      },
    },
  };
  const de = primijeniJezik(izvornik, "de");
  assert.equal(de.naslov, "Ramadan");
  assert.deepEqual(de.rijeci, [{ rijec: "Fasten", opis: "Wir essen und trinken nicht." }]);
  assert.equal(de.id, "ramazan-01");
  assert.equal(de.tezina, "srednje");
  assert.equal(de.prikaz, "opisi");
  assert.equal("prijevodi" in de, false, "mapa prijevoda ne ide djetetu");
});

test("jezik bez prijevoda i bosanski vraćaju izvornik", () => {
  const izvornik = { naslov: "Ramazan", prijevodi: { de: { naslov: "Ramadan" } } };
  for (const jezik of ["bs", "tr", "", undefined, null]) {
    const out = primijeniJezik(izvornik, jezik as string | undefined | null);
    assert.equal(out.naslov, "Ramazan", String(jezik));
    assert.equal("prijevodi" in out, false, String(jezik));
  }
});

test("neispravan prijevod pada na validaciji kao i izvornik", () => {
  const osnova = {
    naslov: "Razvrstaj",
    kategorije: [
      { naziv: "Prva", stavke: ["jedan", "dva"] },
      { naziv: "Druga", stavke: ["tri"] },
    ],
  };
  assert.equal(validirajPodatke("razvrstaj", osnova), null);
  // Ista stavka u dvije kutije — dijete ne bi znalo gdje ide.
  const losPrijevod = {
    ...osnova,
    prijevodi: {
      de: {
        naslov: "Sortiere",
        kategorije: [
          { naziv: "Erste", stavke: ["eins", "zwei"] },
          { naziv: "Zweite", stavke: ["eins"] },
        ],
      },
    },
  };
  assert.match(String(validirajPodatke("razvrstaj", losPrijevod)), /^Prijevod \(de\):/);
  assert.match(String(validirajPodatke("razvrstaj", { ...osnova, prijevodi: { xx: {} } })), /Nepoznat jezik/);
  assert.match(String(validirajPodatke("razvrstaj", { ...osnova, prijevodi: [] })), /mapa jezik/);
});

// Izvor istine za ugrađene vježbe je `public/`; `citajPodatke` čita iz build
// foldera kad on postoji, pa bi test inače ovisio o tome je li build svjež.
const PODACI_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../mekteb-arapsko-pismo/public/vjezbe",
);

test("svaka ugrađena vježba ima ispravan njemački i engleski prijevod", async () => {
  let provjereno = 0;
  for (const tip of Object.keys(TIPOVI_VJEZBI)) {
    const dir = path.join(PODACI_DIR, tip, "podaci");
    const datoteke = (await fsp.readdir(dir)).filter((f) => f.endsWith(".json"));
    assert.ok(datoteke.length > 0, `${tip} nema nijednu ugrađenu vježbu`);
    for (const datoteka of datoteke) {
      const oznaka = `${tip}/${datoteka}`;
      const podaci = JSON.parse(await fsp.readFile(path.join(dir, datoteka), "utf8"));
      assert.equal(validirajPodatke(tip, podaci), null, oznaka);
      assert.deepEqual(jeziciPrijevoda(podaci), ["de", "en"], `${oznaka} nema prijevod na oba jezika`);
      for (const jezik of ["de", "en"]) {
        const prevedeno = primijeniJezik(podaci, jezik);
        assert.equal(validirajPodatke(tip, prevedeno), null, `${oznaka} (${jezik})`);
        assert.notEqual(
          String(prevedeno.naslov),
          String(podaci.naslov),
          `${oznaka} (${jezik}): naslov nije preveden`,
        );
        provjereno += 1;
      }
    }
  }
  assert.ok(provjereno >= 24, `provjereno samo ${provjereno} prijevoda`);
});

test("učenje napamet traži broj sure i transkripciju po ajetu", () => {
  const ispravno = {
    naslov: "Nauči El-Fatihu napamet",
    sura: 1,
    ucac: "husary_muallim",
    transkripcija: ["Bismillahir-rahmanir-rahim", "Elhamdu lillahi rabbil-alemin"],
  };
  assert.equal(validirajPodatke("napamet", ispravno), null);
  // Učač nije obavezan — bez njega se koristi zadani.
  assert.equal(validirajPodatke("napamet", { ...ispravno, ucac: undefined }), null);

  assert.match(String(validirajPodatke("napamet", { ...ispravno, sura: 0 })), /između 1 i 114/);
  assert.match(String(validirajPodatke("napamet", { ...ispravno, sura: 115 })), /između 1 i 114/);
  assert.match(String(validirajPodatke("napamet", { ...ispravno, sura: "prva" })), /između 1 i 114/);
  assert.match(String(validirajPodatke("napamet", { ...ispravno, transkripcija: [] })), /jedan red po ajetu/);
  assert.match(String(validirajPodatke("napamet", { ...ispravno, transkripcija: ["a", "  "] })), /ne smije biti prazan/);
  assert.match(String(validirajPodatke("napamet", { ...ispravno, ucac: "neko" })), /Učač može biti/);
});

test("arapski tekst se ne upisuje u sadržaj vježbe napamet", () => {
  // Mushafski zapis dolazi sa istog izvora kao u Kur'an modulu, pa ga niko ne
  // prepisuje rukom. Ako se ipak nađe u datoteci, to je znak da je neko počeo
  // držati dvije verzije istog teksta.
  const dir = path.join(PODACI_DIR, "napamet", "podaci");
  for (const datoteka of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const sirovo = fs.readFileSync(path.join(dir, datoteka), "utf8");
    assert.doesNotMatch(sirovo, /[؀-ۿ]/u, `${datoteka} sadrži arapsko pismo`);
  }
});
