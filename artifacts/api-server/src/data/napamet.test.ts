import assert from "node:assert/strict";
import { test } from "node:test";
import { NAPAMET_KATALOG, NAPAMET_KATALOG_MAP } from "./napamet.js";

test("NAPAMET katalog ima četiri sekcije i jedinstvene stabilne stavke", () => {
  assert.deepEqual(
    [...new Set(NAPAMET_KATALOG.map((stavka) => stavka.nivo))],
    [1, 2, 3, 4],
  );
  assert.equal(NAPAMET_KATALOG_MAP.size, NAPAMET_KATALOG.length);
  assert.ok(NAPAMET_KATALOG.every((stavka) => stavka.id && stavka.naziv && stavka.redoslijed > 0));
});