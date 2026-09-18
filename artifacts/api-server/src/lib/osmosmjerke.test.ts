import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OSMOSMJERKA_MARKER,
  getOsmosmjerka,
  isValidOsmosmjerkaId,
  listOsmosmjerke,
  osmosmjerkaMarker,
  osmosmjerkaUrl,
} from "./osmosmjerke.js";

test("ID osmosmjerke prima samo mala slova, cifre i crticu", () => {
  for (const ok of ["ramazan", "dzamija", "ramazan-01", "a1"]) {
    assert.equal(isValidOsmosmjerkaId(ok), true, ok);
  }
  for (const nok of ["", "Ramazan", "../tajna", "podaci/ramazan", "ramazan.json", "-pocinje-crticom", "a".repeat(65), 7, null]) {
    assert.equal(isValidOsmosmjerkaId(nok as unknown), false, String(nok));
  }
});

test("URL vježbe ostaje na našoj domeni i nosi putanju do JSON-a", () => {
  assert.equal(
    osmosmjerkaUrl("ramazan"),
    "/vjezbe/osmosmjerka/osmosmjerka.html?podaci=/api/nase-vjezbe/podaci/osmosmjerka/ramazan.json",
  );
  assert.throws(() => osmosmjerkaUrl("../tajna"), /Nevažeći ID/);
});

test("marker za prilozi.stored_name ima očekivani oblik", () => {
  assert.equal(osmosmjerkaMarker("ramazan"), `${OSMOSMJERKA_MARKER}ramazan`);
});

test("spisak čita JSON datoteke iz javnog foldera", async () => {
  const sve = await listOsmosmjerke();
  assert.ok(sve.length >= 2, "očekujemo bar ramazan i dzamija");
  for (const stavka of sve) {
    assert.equal(isValidOsmosmjerkaId(stavka.id), true, stavka.id);
    assert.ok(stavka.naslov.length > 0, `${stavka.id}: naslov`);
    assert.match(stavka.detalj, /\d+ riječi/, `${stavka.id}: detalj`);
    assert.equal(stavka.url, osmosmjerkaUrl(stavka.id));
  }
  const naslovi = sve.map(s => s.naslov);
  assert.deepEqual(naslovi, [...naslovi].sort((a, b) => a.localeCompare(b, "bs")));
});

test("getOsmosmjerka vraća poznatu vježbu, a odbija nepoznatu i putanju", async () => {
  const ramazan = await getOsmosmjerka("ramazan");
  assert.ok(ramazan, "ramazan.json mora postojati");
  assert.equal(ramazan?.naslov, "Ramazan");
  assert.equal(await getOsmosmjerka("ne-postoji-ova-vjezba"), null);
  assert.equal(await getOsmosmjerka("../../../etc/passwd"), null);
});
