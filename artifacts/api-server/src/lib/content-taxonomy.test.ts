import assert from "node:assert/strict";
import test from "node:test";
import {
  KVIZ_KATEGORIJE,
  KVIZ_KATEGORIJE_META,
  KVIZ_TAG_KATEGORIJA_MAP,
} from "@workspace/db/schema";

test("Banka pitanja koristi iste prikazne predmete kao lekcije", () => {
  assert.deepEqual(
    KVIZ_KATEGORIJE.map(slug => KVIZ_KATEGORIJE_META[slug].naziv),
    ["Kiraet", "Vjerovanje", "Ibadet", "Ahlak", "Historija islama", "Ostali sadržaji"],
  );
});

test("pitanja o surama pripadaju Kiraetu", () => {
  assert.equal(KVIZ_TAG_KATEGORIJA_MAP.sure, "kiraet");
  assert.equal(KVIZ_TAG_KATEGORIJA_MAP.kuran_tekst, "kiraet");
  assert.equal(KVIZ_TAG_KATEGORIJA_MAP.ostalo, "bosna");
  assert.equal(KVIZ_TAG_KATEGORIJA_MAP.ostali_ibadeti, "ibadet");
});