import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NASE_VJEZBE_PREFIKSI,
  TIPOVI_VJEZBI,
  getVjezba,
  isValidTip,
  isValidVjezbaId,
  jeNasaVjezba,
  listSveVjezbe,
  listVjezbe,
  vjezbaMarker,
  vjezbaUrl,
} from "./nase-vjezbe.js";

test("poznate su tačno dvije vrste naših vježbi", () => {
  assert.deepEqual(Object.keys(TIPOVI_VJEZBI).sort(), ["osmosmjerka", "popuni"]);
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
    "/vjezbe/popuni/popuni.html?podaci=/vjezbe/popuni/podaci/abdest.json",
  );
  assert.equal(
    vjezbaUrl("osmosmjerka", "ramazan"),
    "/vjezbe/osmosmjerka/osmosmjerka.html?podaci=/vjezbe/osmosmjerka/podaci/ramazan.json",
  );
  assert.equal(vjezbaMarker("popuni", "abdest"), "popuni:abdest");
  assert.throws(() => vjezbaUrl("popuni", "../tajna"), /Nevažeći ID/);
  assert.throws(() => vjezbaUrl("nepostojeci", "abdest"), /Nepoznata vrsta/);
});

test("naša vježba se prepoznaje po adresi, vanjski embed ne", () => {
  assert.equal(NASE_VJEZBE_PREFIKSI.length, 2);
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
  assert.match(abdest!.detalj, /^\d+ praznina/, abdest!.detalj);
  const ramazan = await getVjezba("popuni", "ramazan");
  assert.match(ramazan!.detalj, /^\d+ praznina · \d+ dodatnih riječi/, ramazan!.detalj);
  assert.equal(await getVjezba("popuni", "ne-postoji"), null);
  assert.equal(await getVjezba("popuni", "../../../etc/passwd"), null);
});

test("jedan poziv vraća sve vrste sa svojim vježbama", async () => {
  const tipovi = await listSveVjezbe();
  assert.equal(tipovi.length, 2);
  for (const tv of tipovi) {
    assert.ok(tv.naziv.length > 0, tv.tip);
    assert.ok(tv.vjezbe.every(v => v.tip === tv.tip), `${tv.tip}: vježbe nose svoju vrstu`);
  }
});
